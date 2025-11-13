"""
DCM Grading System v3.3 - Hybrid OpenCV Card Processor
Enhanced detection for borderless/full-art cards with design-anchor centering fallback
v3.3: Added area sanity check, differential edge filter, and fallback cropping
"""

import cv2
import numpy as np
import requests
import tempfile
import os
from typing import Tuple, Dict, Any, Optional
from PIL import Image

# Card dimensions and aspect ratio
# v3.1: More permissive to handle various card types
ASPECT_MIN = 0.60  # Reduced from 0.68 to catch more cards
ASPECT_MAX = 0.80  # Increased from 0.73 to catch more cards
MIN_AREA_FRAC = 0.05  # Reduced from 0.10 to accept smaller detections
WARP_WIDTH = 750
WARP_HEIGHT = 1050


def _download_image_to_tmp(url: str) -> str:
    """Download image from URL to temporary file."""
    r = requests.get(url, stream=True, timeout=30)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=".jpg")
    with os.fdopen(fd, "wb") as f:
        for chunk in r.iter_content(1024 * 64):
            if chunk:
                f.write(chunk)
    return path


def _apply_clahe_bgr(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) for better edge detection."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    lab2 = cv2.merge((l2, a, b))
    return cv2.cvtColor(lab2, cv2.COLOR_LAB2BGR)


def _focus_metric(gray: np.ndarray) -> float:
    """Calculate focus quality using Laplacian variance."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _edge_density(edges: np.ndarray) -> float:
    """Calculate edge density (proportion of edge pixels)."""
    return float(np.count_nonzero(edges) / edges.size)


def _choose_card_contour(contours, img_w: int, img_h: int) -> Optional[np.ndarray]:
    """
    Select the best card contour based on area and aspect ratio.
    v3.3: Added area sanity check to reject full-frame detections (>90% of image).
    """
    best = None
    best_area = 0.0
    frame_area = img_w * img_h

    for c in contours:
        area = cv2.contourArea(c)
        if area < MIN_AREA_FRAC * frame_area:
            continue

        # v3.3: Reject if contour covers >90% of frame (likely detected entire image)
        area_ratio = area / float(frame_area)
        if area_ratio > 0.90:
            print(f"[v3.3] Rejecting full-frame contour (area ratio: {area_ratio:.2%})", flush=True)
            continue

        x, y, w, h = cv2.boundingRect(c)
        aspect = w / float(h) if h > 0 else 0

        if ASPECT_MIN <= aspect <= ASPECT_MAX:
            if area > best_area:
                best = c
                best_area = area

    return best


def _warp_from_contour(img: np.ndarray, contour: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Warp detected card to normalized rectangle."""
    rect = cv2.minAreaRect(contour)
    box = cv2.boxPoints(rect)
    box = np.array(sorted(box, key=lambda p: (p[1], p[0])), dtype="float32")

    tl, tr = box[0], box[1]
    bl, br = box[2], box[3]
    if tl[0] > tr[0]:
        tl, tr = tr, tl
    if bl[0] > br[0]:
        bl, br = br, bl

    src = np.array([tl, tr, br, bl], dtype="float32")
    dst = np.array([
        [0, 0],
        [WARP_WIDTH - 1, 0],
        [WARP_WIDTH - 1, WARP_HEIGHT - 1],
        [0, WARP_HEIGHT - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(img, M, (WARP_WIDTH, WARP_HEIGHT), flags=cv2.INTER_LINEAR)

    return warped, box


def _measure_centering_simple(warped: np.ndarray) -> Dict[str, str]:
    """Measure centering using border white-space detection."""
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)

    band = 40
    h, w = bw.shape

    left_white = int(np.sum(bw[:, 0:band] == 255))
    right_white = int(np.sum(bw[:, -band:] == 255))
    top_white = int(np.sum(bw[0:band, :] == 255))
    bottom_white = int(np.sum(bw[-band:, :] == 255))

    # Debug: Print border measurements
    print(f"[CENTERING-DEBUG] L:{left_white} R:{right_white} delta:{left_white-right_white}", flush=True)
    print(f"[CENTERING-DEBUG] T:{top_white} B:{bottom_white} delta:{top_white-bottom_white}", flush=True)

    def to_ratio(delta: int) -> Tuple[int, int]:
        # v3.1: More sensitive centering detection
        # Typical card has ~42,000 pixels in a 40px border band (1050h × 40w)
        # A 1% difference in white pixels = ~420 pixel delta
        # Make each 500 pixels = 1 ratio point for better sensitivity
        shift = max(-15, min(15, delta // 500))
        left = max(35, min(65, 50 - shift))
        right = max(35, min(65, 50 + shift))
        return left, right

    lrL, lrR = to_ratio(left_white - right_white)
    tbT, tbB = to_ratio(top_white - bottom_white)

    # v3.2: Add numeric centering ratios for Stage 2 direct consumption
    centering_lr_numeric = round(lrL / 100.0, 3)
    centering_tb_numeric = round(tbT / 100.0, 3)

    return {
        # Text format (backward compatibility)
        "centering_estimate_lr": f"{lrL}/{lrR}",
        "centering_estimate_tb": f"{tbT}/{tbB}",
        "centering_estimate_type": "border-detected",
        # v3.2: Numeric format for Stage 2
        "centering_lr_numeric": centering_lr_numeric,
        "centering_tb_numeric": centering_tb_numeric
    }


def _image_quality_grade(focus: float, edge_density: float, brightness: int) -> Dict[str, Any]:
    """Calculate image quality grade (A-D) based on focus, edge density, and brightness."""
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

    # v3.2: Add reshoot flag for C/D grades
    reshoot_required = grade in ["C", "D"]

    return {
        "image_quality_score": round(score, 1),
        "image_quality_grade": grade,
        "reshoot_required": reshoot_required
    }


def process_card_url(image_url: str, side: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Process card image URL and return v3.1 detection results.

    Returns:
        - Detection metadata dict (v3.1 format)
        - Path to cropped/warped image (if detected), or None
    """
    tmp_path = _download_image_to_tmp(image_url)

    try:
        img = cv2.imread(tmp_path)
        if img is None:
            raise ValueError(f"Could not load image from {tmp_path}")

        orig_h, orig_w = img.shape[:2]

        # Apply CLAHE enhancement
        img_eq = _apply_clahe_bgr(img)

        # v3.3: Improved edge detection with differential filter
        hsv = cv2.cvtColor(img_eq, cv2.COLOR_BGR2HSV)
        v = hsv[:, :, 2]
        blur = cv2.GaussianBlur(v, (3, 3), 0)  # Smaller kernel for sharper edges
        edges = cv2.Canny(blur, 40, 120)  # Standard thresholds

        # v3.3: Differential edge filter - dilate then erode to reduce internal noise
        kernel_small = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel_small, iterations=1)
        edges = cv2.erode(edges, kernel_small, iterations=1)

        # v3.3: Background masking - limit search to likely card area (5-95% of frame)
        mask = np.zeros(edges.shape, dtype=np.uint8)
        margin_x, margin_y = int(orig_w * 0.05), int(orig_h * 0.05)
        cv2.rectangle(mask, (margin_x, margin_y), (orig_w - margin_x, orig_h - margin_y), 255, -1)
        edges = cv2.bitwise_and(edges, edges, mask=mask)

        # Calculate image quality metrics
        gray = cv2.cvtColor(img_eq, cv2.COLOR_BGR2GRAY)
        focus = _focus_metric(gray)
        edens = _edge_density(edges)
        brightness = int(np.mean(gray))

        # Try to find card contour
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contour = _choose_card_contour(contours, orig_w, orig_h)
        detection_mode = "standard"

        # Fallback: Color-channel edge detection for borderless cards
        if contour is None:
            print(f"[v3.3] Standard detection failed for {side}, trying color-channel fallback", flush=True)
            lab = cv2.cvtColor(img_eq, cv2.COLOR_BGR2LAB)
            a_channel, b_channel = cv2.split(lab)[1:]
            edge_a = cv2.Canny(a_channel, 20, 80)  # More aggressive thresholds
            edge_b = cv2.Canny(b_channel, 20, 80)  # More aggressive thresholds
            combined_edges = cv2.bitwise_or(edge_a, edge_b)
            # Strengthen edges with morphology
            kernel_color = np.ones((5, 5), np.uint8)
            combined_edges = cv2.morphologyEx(combined_edges, cv2.MORPH_CLOSE, kernel_color)
            combined_edges = cv2.dilate(combined_edges, kernel_color, iterations=2)
            contours, _ = cv2.findContours(combined_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            contour = _choose_card_contour(contours, orig_w, orig_h)
            detection_mode = "color-channel" if contour is not None else "approx-bounds"

        # v3.3: Final fallback - approximate card boundaries with 5% margin
        if contour is None:
            print(f"[v3.3] Color-channel fallback also failed for {side}, using approximate bounds", flush=True)
            margin_x, margin_y = int(orig_w * 0.05), int(orig_h * 0.05)
            contour = np.array([
                [[margin_x, margin_y]],
                [[orig_w - margin_x, margin_y]],
                [[orig_w - margin_x, orig_h - margin_y]],
                [[margin_x, orig_h - margin_y]]
            ])
            detection_mode = "approx-bounds"

        # v3.3: Always have a contour now (due to fallback), but confidence varies
        detected = contour is not None
        high_confidence_detection = detection_mode in ["standard", "color-channel"]

        # Always warp and measure since we always have a contour
        warped, box = _warp_from_contour(img_eq, contour)
        centering = _measure_centering_simple(warped)
        card_img = warped

        # Save cropped image
        fd, out_path = tempfile.mkstemp(suffix=f"_{side}_cropped.jpg")
        os.close(fd)
        Image.fromarray(cv2.cvtColor(card_img, cv2.COLOR_BGR2RGB)).save(out_path, quality=90, optimize=True)

        iq = _image_quality_grade(focus, edens, brightness)

        # v3.3 Response Format (backward-compatible with existing fields)
        resp = {
            "side": side,
            "detected": bool(detected),
            "edge_detection_mode": detection_mode,
            "confidence": "high" if high_confidence_detection else "low",

            # v3.1 NEW: Image quality signals
            "signals": {
                "focus_metric": round(focus, 2),
                "edge_density": round(edens, 4),
                "brightness": brightness
            },

            # Geometry (existing)
            "geometry": {
                "input_w": orig_w,
                "input_h": orig_h,
                "warp_w": WARP_WIDTH if detected else None,
                "warp_h": WARP_HEIGHT if detected else None,
                "aspect_ratio_target": round(WARP_WIDTH / WARP_HEIGHT, 3)
            },

            # v3.1 ENHANCED: Centering with type classification
            "centering": centering,

            # v3.1 NEW: Image quality grade
            "image_quality_score": iq["image_quality_score"],
            "image_quality_grade": iq["image_quality_grade"],
            # v3.2: Reshoot flag
            "reshoot_required": iq["reshoot_required"],

            # BACKWARD-COMPATIBLE: Legacy format for existing code
            "success": detected,
            "centering_ratios": {
                "horizontal": centering["centering_estimate_lr"],
                "vertical": centering["centering_estimate_tb"]
            } if detected else None,
            "border_measurements": {
                "left_border": "N/A",
                "right_border": "N/A",
                "top_border": "N/A",
                "bottom_border": "N/A"
            },
            "measurement_method": f"v3.3 Hybrid ({detection_mode})",

            "notes": "Approximate bounds applied (low confidence)" if detection_mode == "approx-bounds" else ("Full-art fallback applied" if detection_mode != "standard" else "")
        }

        return resp, out_path

    except Exception as e:
        print(f"[v3.1] Error processing {side}: {str(e)}", flush=True)
        # Return fallback response
        return {
            "side": side,
            "detected": False,
            "edge_detection_mode": "manual-fallback",
            "confidence": "low",
            "signals": {"focus_metric": 0, "edge_density": 0, "brightness": 128},
            "geometry": {"input_w": 0, "input_h": 0, "warp_w": None, "warp_h": None, "aspect_ratio_target": 0.714},
            "centering": {
                "centering_estimate_lr": "N/A",
                "centering_estimate_tb": "N/A",
                "centering_estimate_type": "design-anchor",
                "centering_lr_numeric": 0.50,
                "centering_tb_numeric": 0.50
            },
            "image_quality_score": 0,
            "image_quality_grade": "D",
            "reshoot_required": True,
            "success": False,
            "notes": f"Error: {str(e)}"
        }, None

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# Legacy compatibility function
def process_card_image(image_path: str) -> Dict[str, Any]:
    """
    Legacy function for backward compatibility.
    Processes a local image file (not URL).
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}

        # Use existing detection logic from card_detector.py
        # This maintains compatibility with existing calls
        return {
            "success": False,
            "note": "v3.1 uses process_card_url() for URL-based processing"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
