"""
DCM Grading System v3.4.1 - Adaptive Card Detector
Improvements:
- Hybrid edge detection (adaptive + standard Canny)
- Flexible contour filtering (4-8 points, 30-90% area ratio)
- Validated border measurement with sanity checks
- Debug overlay export for troubleshooting
- Guaranteed warp on true card region
"""

import cv2
import numpy as np
import requests
import tempfile
import os
from typing import Dict, Any, Tuple, Optional

# --- Tunable constants ---
ASPECT_MIN, ASPECT_MAX = 0.60, 0.80          # Card aspect tolerance (widened for various card types)
MIN_RATIO, MAX_RATIO = 0.30, 0.95            # Acceptable card-to-frame area ratio (v3.4.2: raised to 95% for product photos)
WARP_W, WARP_H = 750, 1050                   # Normalized output size (≈2.5x3.5)
DEBUG_DIR = tempfile.gettempdir()            # Debug export path (OS temp directory)

# -------------------------------------------------------------
# Utility
# -------------------------------------------------------------
def download_tmp_image(url: str) -> str:
    """Download image from URL to temporary file."""
    r = requests.get(url, stream=True, timeout=25)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=".jpg")
    with os.fdopen(fd, "wb") as f:
        for chunk in r.iter_content(65536):
            if chunk:
                f.write(chunk)
    return path


def focus_metric(gray: np.ndarray) -> float:
    """Calculate focus quality using Laplacian variance."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness_metric(img: np.ndarray) -> float:
    """Calculate average brightness."""
    return float(np.mean(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)))


def edge_density_metric(edges: np.ndarray) -> float:
    """Calculate edge density (proportion of edge pixels)."""
    return float(np.count_nonzero(edges) / edges.size)


# -------------------------------------------------------------
# Pre-processing
# -------------------------------------------------------------
def equalize_lighting(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE to improve contrast in uneven lighting."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    merged = cv2.merge((l2, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def adaptive_edges(img: np.ndarray) -> np.ndarray:
    """
    v3.4.1: Adaptive edge detection with fallback.
    Tries adaptive thresholding first, then standard Canny if needed.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    # Try adaptive threshold first
    th = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )
    edges_adaptive = cv2.Canny(th, 25, 80)

    # Also try standard Canny
    edges_standard = cv2.Canny(gray, 50, 150)

    # Combine both (take union of edges)
    edges = cv2.bitwise_or(edges_adaptive, edges_standard)

    # Clean up
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
    edges = cv2.erode(edges, np.ones((3, 3), np.uint8), iterations=1)
    return edges


# -------------------------------------------------------------
# Contour logic
# -------------------------------------------------------------
def choose_card_contour(contours, w, h):
    """
    v3.4.1: Select best card contour (4-8 points allowed).
    Rejects micro (<30% area) and full-frame (>90% area) detections.
    """
    best, best_area = None, 0
    frame_area = w * h

    print(f"[v3.4.1] Analyzing {len(contours)} contours...", flush=True)

    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)

        # v3.4.1: Accept 4-8 points (more flexible for warped cards)
        if len(approx) < 4 or len(approx) > 8:
            continue

        area = cv2.contourArea(approx)
        area_pct = area / frame_area

        # v3.4: Reject too small or too large
        if area < MIN_RATIO * frame_area or area > MAX_RATIO * frame_area:
            if area > MAX_RATIO * frame_area:
                print(f"[v3.4.1] Rejecting full-frame contour: {area_pct:.1%}", flush=True)
            continue

        x, y, cw, ch = cv2.boundingRect(approx)
        aspect = cw / float(ch)

        if ASPECT_MIN <= aspect <= ASPECT_MAX and area > best_area:
            best, best_area = approx, area
            print(f"[v3.4.1] Found candidate: {len(approx)} points, area={area_pct:.1%}, aspect={aspect:.2f}", flush=True)

    if best is not None:
        print(f"[v3.4.1] SUCCESS: Selected contour with {len(best)} points, area={best_area/frame_area:.1%}", flush=True)
    else:
        print(f"[v3.4.1] FAILED: No valid contour found", flush=True)

    return best


def warp_from_contour(img: np.ndarray, contour: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Warp detected card to normalized rectangle."""
    # Sort corners: top-left, top-right, bottom-right, bottom-left
    rect = np.array(sorted(contour.reshape(4, 2), key=lambda p: (p[1], p[0])), dtype="float32")

    # Destination corners
    dst = np.array([
        [0, 0],
        [WARP_W - 1, 0],
        [WARP_W - 1, WARP_H - 1],
        [0, WARP_H - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(img, M, (WARP_W, WARP_H))
    return warped, rect


# -------------------------------------------------------------
# Border measurement on warped card
# -------------------------------------------------------------
def measure_borders(warped: np.ndarray) -> Dict[str, Any]:
    """
    v3.4.1: Measure actual border widths by finding edge transitions.
    Uses pixel intensity analysis on warped card with sanity checks.
    """
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    h, w = bw.shape

    # Sum white pixels along each axis
    cols_sum = np.sum(bw, axis=0)
    rows_sum = np.sum(bw, axis=1)

    def edge_pos(profile):
        """Find left and right edge positions from intensity profile."""
        max_val = np.max(profile)
        if max_val < 100:  # Not enough white pixels
            return None, None
        thresh = max_val * 0.5
        left = np.argmax(profile > thresh)
        right = len(profile) - np.argmax(profile[::-1] > thresh)
        return left, right

    l, r = edge_pos(cols_sum)
    t, b = edge_pos(rows_sum)

    # v3.4.1: Check if edge detection failed
    if l is None or r is None or t is None or b is None:
        print(f"[v3.4.1] Border detection failed - insufficient white pixels", flush=True)
        return {
            "top_border": "N/A",
            "bottom_border": "N/A",
            "left_border": "N/A",
            "right_border": "N/A"
        }

    left_border = l
    right_border = w - r
    top_border = t
    bottom_border = h - b

    # v3.4.1: Sanity check - borders must be positive and < 20% of card dimension
    max_lr_border = int(w * 0.20)  # Max 20% of width
    max_tb_border = int(h * 0.20)  # Max 20% of height

    if (left_border <= 0 or right_border <= 0 or
        top_border <= 0 or bottom_border <= 0 or
        left_border > max_lr_border or right_border > max_lr_border or
        top_border > max_tb_border or bottom_border > max_tb_border):
        print(f"[v3.4.1] Border sanity check failed - invalid measurements: L={left_border} R={right_border} T={top_border} B={bottom_border}", flush=True)
        return {
            "top_border": "N/A",
            "bottom_border": "N/A",
            "left_border": "N/A",
            "right_border": "N/A"
        }

    # v3.4: Convert pixels to mm (approximate: 750px ≈ 63mm wide)
    px_to_mm = 63.0 / WARP_W

    return {
        "top_border": f"{round(top_border * px_to_mm, 1)}mm",
        "bottom_border": f"{round(bottom_border * px_to_mm, 1)}mm",
        "left_border": f"{round(left_border * px_to_mm, 1)}mm",
        "right_border": f"{round(right_border * px_to_mm, 1)}mm"
    }


# -------------------------------------------------------------
# Image-quality grade
# -------------------------------------------------------------
def grade_image_quality(focus, edge_density, brightness):
    """Calculate image quality grade (A-D) based on metrics."""
    score = (
        min(focus / 250.0, 1.0) * 0.5 +
        min(edge_density / 0.08, 1.0) * 0.3 +
        (1 - abs(128 - brightness) / 128.0) * 0.2
    ) * 100

    if score >= 85:
        grade = "A"
    elif score >= 70:
        grade = "B"
    elif score >= 55:
        grade = "C"
    else:
        grade = "D"

    return {
        "score": round(score, 1),
        "grade": grade,
        "reshoot": grade in ["C", "D"]
    }


# -------------------------------------------------------------
# Master process (compatible with app.py expectations)
# -------------------------------------------------------------
def process_card_url(image_url: str, side: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    v3.4.1: Process card image URL and return detection results.

    Returns:
        - Detection metadata dict (v3.4.1 format)
        - Path to cropped/warped image (if detected), or None
    """
    tmp = download_tmp_image(image_url)
    out_path = None

    try:
        img = cv2.imread(tmp)
        if img is None:
            raise ValueError(f"Could not load image from {tmp}")

        h, w = img.shape[:2]
        print(f"[v3.4.1] Processing {side}: {w}x{h}", flush=True)

        img_eq = equalize_lighting(img)
        edges = adaptive_edges(img_eq)

        # v3.4.1: Apply background mask to limit detection area
        mask = np.zeros(edges.shape, dtype=np.uint8)
        margin_x, margin_y = int(w * 0.03), int(h * 0.03)  # 3% margin
        cv2.rectangle(mask, (margin_x, margin_y), (w - margin_x, h - margin_y), 255, -1)
        edges = cv2.bitwise_and(edges, edges, mask=mask)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = choose_card_contour(contours, w, h)
        detection_mode = "standard" if contour is not None else "approx-bounds"

        # v3.4.1: Fallback to rectangular crop with 5% margin
        if contour is None:
            print(f"[v3.4.1] No valid contour for {side}, using approx-bounds fallback", flush=True)
            margin_x, margin_y = int(w * 0.05), int(h * 0.05)
            contour = np.array([
                [[margin_x, margin_y]],
                [[w - margin_x, margin_y]],
                [[w - margin_x, h - margin_y]],
                [[margin_x, h - margin_y]]
            ])
            detection_mode = "approx-bounds"

        # Always warp
        warped, rect = warp_from_contour(img_eq, contour)

        # v3.4: Secondary contour pass for precise border measurement
        borders = measure_borders(warped)

        # Save warped card image
        fd, out_path = tempfile.mkstemp(suffix=f"_{side}_cropped.jpg")
        os.close(fd)
        cv2.imwrite(out_path, warped, [cv2.IMWRITE_JPEG_QUALITY, 90])

        # v3.4: Debug overlay export
        if os.getenv('STAGE0_DEBUG', 'false').lower() == 'true':
            dbg = img.copy()
            cv2.drawContours(dbg, [contour.astype(int)], -1, (0, 255, 0), 2)
            cv2.imwrite(os.path.join(DEBUG_DIR, f"debug_edges_{side}.jpg"), edges)
            cv2.imwrite(os.path.join(DEBUG_DIR, f"debug_contour_{side}.jpg"), dbg)
            cv2.imwrite(os.path.join(DEBUG_DIR, f"warped_{side}.jpg"), warped)
            print(f"[v3.4] Debug images saved to {DEBUG_DIR}", flush=True)

        # Calculate metrics
        focus = focus_metric(cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY))
        bright = brightness_metric(warped)
        density = edge_density_metric(edges)
        iq = grade_image_quality(focus, density, bright)

        # v3.4: Compute centering ratios from border measurements
        if "N/A" in borders["left_border"]:
            lr_text, tb_text = "50/50", "50/50"
            lr_val, tb_val = 0.5, 0.5
        else:
            left = float(borders["left_border"].replace("mm", ""))
            right = float(borders["right_border"].replace("mm", ""))
            top = float(borders["top_border"].replace("mm", ""))
            bottom = float(borders["bottom_border"].replace("mm", ""))

            lr_val = left / (left + right) if (left + right) > 0 else 0.5
            tb_val = top / (top + bottom) if (top + bottom) > 0 else 0.5

            lr_text = f"{int(lr_val * 100)}/{int((1 - lr_val) * 100)}"
            tb_text = f"{int(tb_val * 100)}/{int((1 - tb_val) * 100)}"

        resp = {
            "side": side,
            "detected": True,
            "edge_detection_mode": detection_mode,
            "confidence": "high" if detection_mode == "standard" else "low",

            # Geometry
            "geometry": {
                "input_w": w,
                "input_h": h,
                "warp_w": WARP_W,
                "warp_h": WARP_H,
                "aspect_ratio_target": round(WARP_W / WARP_H, 3)
            },

            # v3.4: Actual border measurements
            "border_measurements": borders,

            # Centering
            "centering": {
                "centering_estimate_lr": lr_text,
                "centering_estimate_tb": tb_text,
                "centering_lr_numeric": round(lr_val, 3),
                "centering_tb_numeric": round(tb_val, 3),
                "centering_estimate_type": "border-detected" if "N/A" not in borders["left_border"] else "design-anchor"
            },

            # Signals
            "signals": {
                "focus_metric": round(focus, 2),
                "edge_density": round(density, 4),
                "brightness": round(bright, 1)
            },

            # Image quality
            "image_quality_grade": iq["grade"],
            "image_quality_score": iq["score"],
            "reshoot_required": iq["reshoot"],

            # Metadata
            "measurement_method": "v3.4.1 Adaptive Hybrid",
            "success": True,

            # Backward compatibility
            "centering_ratios": {
                "horizontal": lr_text,
                "vertical": tb_text
            },

            "notes": "Approximate bounds applied (low confidence)" if detection_mode == "approx-bounds" else ""
        }

        return resp, out_path

    except Exception as e:
        print(f"[v3.4.1] Error processing {side}: {str(e)}", flush=True)
        # Return fallback response
        return {
            "side": side,
            "detected": False,
            "edge_detection_mode": "error",
            "confidence": "low",
            "signals": {"focus_metric": 0, "edge_density": 0, "brightness": 128},
            "geometry": {"input_w": 0, "input_h": 0, "warp_w": None, "warp_h": None, "aspect_ratio_target": 0.714},
            "centering": {
                "centering_estimate_lr": "N/A",
                "centering_estimate_tb": "N/A",
                "centering_lr_numeric": 0.50,
                "centering_tb_numeric": 0.50,
                "centering_estimate_type": "design-anchor"
            },
            "border_measurements": {
                "top_border": "N/A",
                "bottom_border": "N/A",
                "left_border": "N/A",
                "right_border": "N/A"
            },
            "image_quality_score": 0,
            "image_quality_grade": "D",
            "reshoot_required": True,
            "success": False,
            "notes": f"Error: {str(e)}"
        }, None

    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
