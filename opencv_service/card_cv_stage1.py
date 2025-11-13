#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Card Observation and Analysis, Stage 1 (OpenCV-based)
# Author: ChatGPT for Doug at Manicz Media
# Description:
# A comprehensive pixel-first analysis pipeline that prepares quantitative metrics and masks
# for trading card grading. It analyzes a single side at a time (front or back) and can be
# called twice for both sides. It also includes a CLI that can accept two images and will
# output combined JSON and visualization assets.
#
# Major features:
# 1) Image loading, resizing (optional), color space conversions.
# 2) Card detection by contour, perspective correction, and normalization.
# 3) Background removal using the detected quadrilateral.
# 4) Border sampling and centering measurement for both axes.
# 5) Edge whitening and chip detection using LAB ΔE and morphological analysis.
# 6) Corner radius and whitening measurement per corner.
# 7) Surface white dot, scratch, and crease likelihood detection with tunable thresholds.
# 8) Sleeve/top-loader indicator and glare masking in HSV.
# 9) Focus, lighting uniformity, and color balance diagnostics.
# 10) Structured JSON output plus overlay images for the UI.
#
# Requirements:
#   Python 3.10+
#   OpenCV (cv2), NumPy
#   Optional: scikit-image (for skimage.exposure) but not required.
#
# Usage:
#   python card_cv_stage1.py --front path/to/front.jpg --back path/to/back.jpg --outdir ./out
#
# The script will save:
#   - stage1_metrics.json: combined metrics for front and back
#   - normalized images and masks
#   - overlay visualizations for borders, edges, corners, and glare
#
# Notes:
#   Thresholds are conservative defaults. You should calibrate these on your own dataset.

import os
import json
import math
import argparse
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple, Optional

import numpy as np

try:
    import cv2
except Exception as e:
    raise SystemExit("OpenCV (cv2) is required. Please install it with: pip install opencv-python")


# -----------------------------
# Utility data classes and types
# -----------------------------

@dataclass
class EdgeSegmentMetrics:
    segment_name: str
    whitening_length_px: float
    whitening_count: int
    chips_count: int
    white_dots_count: int


@dataclass
class CornerMetrics:
    corner_name: str
    rounding_radius_px: float
    whitening_length_px: float
    white_dots_count: int


@dataclass
class SurfaceMetrics:
    white_dots_count: int
    scratch_count: int
    crease_like_count: int
    glare_coverage_percent: float
    focus_variance: float
    lighting_uniformity_score: float
    color_bias_bgr: Tuple[float, float, float]


@dataclass
class CenteringMetrics:
    lr_ratio: Tuple[float, float]
    tb_ratio: Tuple[float, float]
    left_border_mean_px: float
    right_border_mean_px: float
    top_border_mean_px: float
    bottom_border_mean_px: float
    method_used: str  # "border-present", "design-anchor-required", "failed"
    confidence: str   # "high", "medium", "low", "unreliable"
    validation_notes: str  # Details about measurement
    fallback_mode: bool = False  # True if measuring full image, not card boundaries


@dataclass
class SideMetrics:
    side_label: str
    width: int
    height: int
    centering: CenteringMetrics
    edge_segments: Dict[str, List[EdgeSegmentMetrics]]
    corners: List[CornerMetrics]
    surface: SurfaceMetrics
    sleeve_indicator: bool
    top_loader_indicator: bool
    slab_indicator: bool
    glare_mask_percent: float
    obstructions: List[Dict[str, str]]
    debug_assets: Dict[str, str]
    detection_metadata: Optional[Dict[str, any]] = None  # Fusion detection metadata (Phase 5)


@dataclass
class CombinedMetrics:
    front: Optional[SideMetrics]
    back: Optional[SideMetrics]
    version: str = "stage1_opencv_v1.0"
    run_id: str = ""


@dataclass
class Profile:
    """
    Detection profile that biases thresholds and detector order for specific scenarios.

    Different card types (raw cards, sleeves, slabs, etc.) require different detection
    strategies. This dataclass encapsulates all the parameters needed to optimize
    detection for each scenario.
    """
    name: str
    min_area_ratio: float
    max_area_ratio: float
    aspect_target: Tuple[float, float]
    detector_order: List[str]
    glare_max_for_edges: float
    erosions_for_inner: int
    notes: str


# Profile definitions optimized for different card scenarios
PROFILES = {
    "raw_on_mat": Profile(
        name="raw_on_mat",
        min_area_ratio=0.25,
        max_area_ratio=0.98,
        aspect_target=(1.30, 1.55),
        detector_order=["fused_edges", "lab_chroma", "lsd", "hough", "grabcut", "color_seg", "saliency"],
        glare_max_for_edges=12.0,
        erosions_for_inner=0,
        notes="Single card on neutral background - default profile"
    ),
    "sleeve": Profile(
        name="sleeve",
        min_area_ratio=0.12,
        max_area_ratio=0.98,
        aspect_target=(1.30, 1.60),
        detector_order=["lab_chroma", "fused_edges", "lsd", "grabcut", "color_seg", "hough", "saliency"],
        glare_max_for_edges=25.0,
        erosions_for_inner=2,
        notes="Card in penny sleeve or toploader - inner refinement needed"
    ),
    "slab": Profile(
        name="slab",
        min_area_ratio=0.08,
        max_area_ratio=0.98,
        aspect_target=(1.25, 1.70),
        detector_order=["lsd", "hough", "fused_edges", "lab_chroma", "grabcut", "color_seg"],
        glare_max_for_edges=35.0,
        erosions_for_inner=0,  # DISABLED: Inner refinement not working reliably for slabs with black borders
        notes="Graded slab with thick outer acrylic - measures outer boundary only"
    ),
    "busy_bg": Profile(
        name="busy_bg",
        min_area_ratio=0.20,
        max_area_ratio=0.98,
        aspect_target=(1.25, 1.70),
        detector_order=["lab_chroma", "grabcut", "fused_edges", "lsd", "color_seg", "saliency"],
        glare_max_for_edges=18.0,
        erosions_for_inner=1,
        notes="Textured or patterned background - suppress background"
    ),
    "phone_screenshot": Profile(
        name="phone_screenshot",
        min_area_ratio=0.15,
        max_area_ratio=0.98,
        aspect_target=(1.25, 1.70),
        detector_order=["lab_chroma", "fused_edges", "hough", "lsd", "grabcut", "color_seg"],
        glare_max_for_edges=20.0,
        erosions_for_inner=1,
        notes="Screenshot with status bar or gallery UI"
    ),
    "holo_full_bleed": Profile(
        name="holo_full_bleed",
        min_area_ratio=0.15,
        max_area_ratio=0.98,
        aspect_target=(1.25, 1.70),
        detector_order=["lab_chroma", "grabcut", "lsd", "color_seg", "hough", "fused_edges"],
        glare_max_for_edges=30.0,
        erosions_for_inner=2,
        notes="Foils, full-art cards with weak outer borders"
    ),
}


# -----------------------------
# Core helpers
# -----------------------------

def ensure_outdir(path: str) -> None:
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def imread_color(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {path}")
    return img


def resize_max_dim(img: np.ndarray, max_dim: int = 1800) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / float(max(h, w))
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def to_lab(img_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)


def to_gray(img_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)


def auto_contrast(img_gray: np.ndarray) -> np.ndarray:
    # Simple histogram stretch
    p2, p98 = np.percentile(img_gray, (2, 98))
    if p98 - p2 < 1e-5:
        return img_gray
    img_rescaled = np.clip((img_gray - p2) * 255.0 / (p98 - p2), 0, 255).astype(np.uint8)
    return img_rescaled


def variance_of_laplacian(img_gray: np.ndarray) -> float:
    return float(cv2.Laplacian(img_gray, cv2.CV_64F).var())


def brightness_uniformity(img_gray: np.ndarray, grid_rows: int = 6, grid_cols: int = 4) -> float:
    h, w = img_gray.shape[:2]
    tile_h = max(1, h // grid_rows)
    tile_w = max(1, w // grid_cols)
    means = []
    for r in range(grid_rows):
        for c in range(grid_cols):
            y0 = r * tile_h
            x0 = c * tile_w
            y1 = h if r == grid_rows - 1 else (r + 1) * tile_h
            x1 = w if c == grid_cols - 1 else (c + 1) * tile_w
            tile = img_gray[y0:y1, x0:x1]
            means.append(float(np.mean(tile)))
    means = np.array(means)
    # Uniformity score: higher is better. Normalize by global std.
    std = float(np.std(means) + 1e-6)
    score = 1.0 / (1.0 + std / 20.0)
    return float(np.clip(score, 0.0, 1.0))


def color_bias_bgr(img_bgr: np.ndarray) -> Tuple[float, float, float]:
    b_mean = float(np.mean(img_bgr[:, :, 0]))
    g_mean = float(np.mean(img_bgr[:, :, 1]))
    r_mean = float(np.mean(img_bgr[:, :, 2]))
    return (b_mean, g_mean, r_mean)


# -----------------------------
# Preflight Feature Detection
# -----------------------------

def compute_edge_entropy(img_bgr: np.ndarray) -> float:
    """
    Compute edge entropy to detect how much edge information is present.
    High entropy = many edges (detailed image, textured background)
    Low entropy = few edges (clean background, low contrast)
    """
    gray = to_gray(img_bgr)
    edges = cv2.Canny(gray, 50, 150)
    edge_percent = np.sum(edges > 0) / float(edges.size)
    return float(edge_percent * 100)


def detect_ui_bars(img_bgr: np.ndarray, bar_height_percent: float = 8.0) -> Tuple[bool, int, int]:
    """
    Detect UI bars at top/bottom (phone screenshots with status bars, gallery UI).

    Returns:
        (has_ui_bars, top_crop_px, bottom_crop_px)
    """
    h, w = img_bgr.shape[:2]
    bar_h = int(h * bar_height_percent / 100)

    # Check top bar
    top_strip = img_bgr[:bar_h, :]
    gray_top = to_gray(top_strip)
    edges_top = cv2.Canny(gray_top, 50, 150)

    # Look for horizontal edges (UI bars typically have strong horizontal lines)
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 4, 1))
    horiz_edges_top = cv2.morphologyEx(edges_top, cv2.MORPH_CLOSE, horiz_kernel)
    top_score = np.sum(horiz_edges_top > 0) / float(horiz_edges_top.size)

    # Check bottom bar
    bottom_strip = img_bgr[-bar_h:, :]
    gray_bottom = to_gray(bottom_strip)
    edges_bottom = cv2.Canny(gray_bottom, 50, 150)
    horiz_edges_bottom = cv2.morphologyEx(edges_bottom, cv2.MORPH_CLOSE, horiz_kernel)
    bottom_score = np.sum(horiz_edges_bottom > 0) / float(horiz_edges_bottom.size)

    # Threshold: if >5% of horizontal edge density, likely a UI bar
    has_top = top_score > 0.05
    has_bottom = bottom_score > 0.05

    top_crop = bar_h if has_top else 0
    bottom_crop = bar_h if has_bottom else 0

    return (has_top or has_bottom, top_crop, bottom_crop)


def crop_ui_bars(img_bgr: np.ndarray) -> np.ndarray:
    """
    Crop UI bars from phone screenshots (status bar, navigation bar).

    This removes the top and bottom UI elements that interfere with card detection.

    Args:
        img_bgr: Input image with UI bars

    Returns:
        Cropped image with UI bars removed
    """
    has_ui, top_crop, bottom_crop = detect_ui_bars(img_bgr)

    if not has_ui:
        return img_bgr

    h, w = img_bgr.shape[:2]

    # Crop with 5px margin to be safe
    top_crop = max(0, top_crop - 5)
    bottom_crop = max(0, bottom_crop - 5)

    if bottom_crop > 0:
        cropped = img_bgr[top_crop:h-bottom_crop, :]
    else:
        cropped = img_bgr[top_crop:, :]

    print(f"[UI Crop] Removed {top_crop}px from top, {bottom_crop}px from bottom")
    return cropped


def analyze_background_texture(img_bgr: np.ndarray) -> float:
    """
    Analyze background texture using FFT to detect patterned/textured backgrounds.

    Returns:
        Texture score (0-100, higher = more textured)
    """
    gray = to_gray(img_bgr)
    gray_small = cv2.resize(gray, (256, 256))

    # Compute FFT
    f = np.fft.fft2(gray_small)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = np.abs(fshift)

    # Exclude DC component (center)
    h, w = magnitude_spectrum.shape
    center_mask = np.ones((h, w), dtype=bool)
    center_y, center_x = h // 2, w // 2
    center_mask[center_y-10:center_y+10, center_x-10:center_x+10] = False

    # Check for strong spatial frequencies (indicates texture/pattern)
    spectrum_no_dc = magnitude_spectrum[center_mask]
    texture_score = float(np.percentile(spectrum_no_dc, 99) / np.percentile(spectrum_no_dc, 50))

    # Normalize to 0-100 scale
    texture_score = min(100, texture_score * 5)

    return texture_score


def detect_foil_highlights(img_bgr: np.ndarray) -> Tuple[bool, float]:
    """
    Detect periodic foil highlights (holographic cards).

    Returns:
        (is_foil, highlight_density)
    """
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # Foils have many small, bright, high-saturation spots
    bright_mask = v > 200
    high_sat_mask = s > 100
    foil_mask = bright_mask & high_sat_mask

    # Count small bright regions (not large glare)
    foil_mask_uint8 = foil_mask.astype(np.uint8) * 255
    contours, _ = cv2.findContours(foil_mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Count small highlights (3-50 px area)
    small_highlights = [c for c in contours if 3 < cv2.contourArea(c) < 50]
    highlight_density = len(small_highlights) / float(img_bgr.shape[0] * img_bgr.shape[1] / 1000)

    is_foil = highlight_density > 5.0  # More than 5 highlights per 1000px²

    return (is_foil, float(highlight_density))


def detect_translucent_edges(img_bgr: np.ndarray) -> bool:
    """
    Detect translucent frame edges (sleeves, toploaders).

    Sleeves create a translucent boundary with specular reflections.
    """
    gray = to_gray(img_bgr)
    h, w = gray.shape

    # Check edges of image for translucent/reflective boundaries
    border_width = int(min(h, w) * 0.10)  # 10% border

    # Extract border regions
    top_border = gray[:border_width, :]
    bottom_border = gray[-border_width:, :]
    left_border = gray[:, :border_width]
    right_border = gray[:, -border_width:]

    borders = [top_border, bottom_border, left_border, right_border]

    # Look for vertical/horizontal lines in borders (sleeve edges)
    edge_counts = []
    for border in borders:
        edges = cv2.Canny(border, 30, 100)
        edge_count = np.sum(edges > 0) / float(edges.size)
        edge_counts.append(edge_count)

    # If all 4 borders have significant edges, likely a sleeve
    avg_edge_density = np.mean(edge_counts)
    has_translucent = avg_edge_density > 0.03  # 3% edge density in borders

    return has_translucent


def detect_thick_acrylic_edges(img_bgr: np.ndarray) -> bool:
    """
    Detect thick acrylic edges and screws (graded slabs).

    Slabs have thick, reflective acrylic borders and often visible screws.

    DISABLED 2025-10-19: This function was causing false positives on raw cards
    with circular artwork features (player photos, logos). Relying instead on
    detect_sleeve_like_features() which has more reliable slab detection.
    """
    # DISABLED: Too many false positives
    # Raw cards with player photos or circular logos trigger false slab detection
    return False

    # Original code kept for reference:
    # gray = to_gray(img_bgr)
    # h, w = gray.shape
    # border_width = int(min(h, w) * 0.20)
    # corner_size = 80
    # corners = [
    #     gray[:corner_size, :corner_size],
    #     gray[:corner_size, -corner_size:],
    #     gray[-corner_size:, :corner_size],
    #     gray[-corner_size:, -corner_size:]
    # ]
    # screw_count = 0
    # for corner in corners:
    #     circles = cv2.HoughCircles(corner, cv2.HOUGH_GRADIENT, dp=1, minDist=30,
    #                                param1=50, param2=20, minRadius=3, maxRadius=15)
    #     if circles is not None:
    #         screw_count += len(circles[0])
    # has_screws = screw_count >= 2
    # return has_screws


def select_profile(img_bgr: np.ndarray, sleeve_detected: bool = False,
                   slab_detected: bool = False) -> Profile:
    """
    Switchboard: Select the optimal detection profile based on preflight analysis.

    This function analyzes the image characteristics and picks the profile that's
    most likely to succeed for this specific card/photo type.

    Args:
        img_bgr: Input image
        sleeve_detected: Whether sleeve features were detected
        slab_detected: Whether slab features were detected

    Returns:
        Selected Profile object
    """
    h, w = img_bgr.shape[:2]
    aspect = w / float(h) if h > 0 else 1.0

    # Run preflight checks
    has_ui_bars, _, _ = detect_ui_bars(img_bgr)
    texture_score = analyze_background_texture(img_bgr)
    is_foil, foil_density = detect_foil_highlights(img_bgr)
    has_translucent = detect_translucent_edges(img_bgr)
    has_acrylic = detect_thick_acrylic_edges(img_bgr)

    print(f"[Preflight] Image aspect: {aspect:.2f}")
    print(f"[Preflight] UI bars: {has_ui_bars}")
    print(f"[Preflight] Background texture: {texture_score:.1f}")
    print(f"[Preflight] Foil highlights: {is_foil} (density: {foil_density:.1f})")
    print(f"[Preflight] Translucent edges: {has_translucent}")
    print(f"[Preflight] Acrylic edges: {has_acrylic}")

    # Decision tree for profile selection

    # Priority 1: Explicit slab detection
    if slab_detected or has_acrylic:
        profile = PROFILES["slab"]
        print(f"[Switchboard] Selected profile: {profile.name} (thick acrylic edges detected)")
        return profile

    # Priority 2: Explicit sleeve detection
    if sleeve_detected or has_translucent:
        profile = PROFILES["sleeve"]
        print(f"[Switchboard] Selected profile: {profile.name} (translucent frame detected)")
        return profile

    # Priority 3: Phone screenshot with UI
    if has_ui_bars:
        profile = PROFILES["phone_screenshot"]
        print(f"[Switchboard] Selected profile: {profile.name} (UI bars detected)")
        return profile

    # Priority 4: Holo/foil cards
    if is_foil:
        profile = PROFILES["holo_full_bleed"]
        print(f"[Switchboard] Selected profile: {profile.name} (foil highlights detected)")
        return profile

    # Priority 5: Busy/textured background
    if texture_score > 40:
        profile = PROFILES["busy_bg"]
        print(f"[Switchboard] Selected profile: {profile.name} (textured background)")
        return profile

    # Default: Raw card on mat
    profile = PROFILES["raw_on_mat"]
    print(f"[Switchboard] Selected profile: {profile.name} (default)")
    return profile


def normalize_color_and_illum(img_bgr: np.ndarray) -> np.ndarray:
    """
    Normalize color cast and illumination before card detection.

    Uneven lighting and warm LEDs crush edge contrast. This function:
    1. Gray-World white balance to remove color casts
    2. CLAHE on L channel for local contrast enhancement (Retinex-like)

    Args:
        img_bgr: Input image in BGR format

    Returns:
        Normalized image in BGR format

    Updated: 2025-10-17 - Added based on ChatGPT recommendations
    """
    eps = 1e-6

    # Gray-World white balance
    b, g, r = cv2.split(img_bgr.astype(np.float32))
    mean_b, mean_g, mean_r = float(b.mean()), float(g.mean()), float(r.mean())
    k = (mean_b + mean_g + mean_r) / 3.0

    b *= k / (mean_b + eps)
    g *= k / (mean_g + eps)
    r *= k / (mean_r + eps)

    wb = cv2.merge([b, g, r]).clip(0, 255).astype(np.uint8)

    # Retinex-like local contrast using CLAHE on L channel
    lab = cv2.cvtColor(wb, cv2.COLOR_BGR2LAB)
    L, A, B = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    L = clahe.apply(L)

    normalized = cv2.cvtColor(cv2.merge([L, A, B]), cv2.COLOR_LAB2BGR)

    print(f"[OpenCV Normalization] Applied color and illumination normalization")
    return normalized


def score_quad(quad: np.ndarray, edges: np.ndarray, img_shape: Tuple[int, int]) -> float:
    """
    Score a quadrilateral candidate based on quality metrics.

    Instead of picking the FIRST valid quad, we score ALL candidates and pick the BEST.

    Scoring criteria:
    1. Rectangularity (0-40 points): How close to 90-degree angles
    2. Edge support (0-40 points): How many edge pixels along perimeter
    3. Aspect ratio (0-20 points): Prefer 0.55-0.80 (standard cards)

    Total: 100 points max

    Args:
        quad: Quadrilateral points [TL, TR, BR, BL]
        edges: Edge image (from Canny detection)
        img_shape: Image shape (height, width)

    Returns:
        Score (0-100, higher is better)

    Updated: 2025-10-17 - Added based on ChatGPT recommendations
    """
    (tl, tr, br, bl) = quad
    h_img, w_img = img_shape[:2]

    # --- Metric 1: Rectangularity (40 points max) ---
    # Measure how close the 4 interior angles are to 90 degrees
    def angle_between_vectors(v1: np.ndarray, v2: np.ndarray) -> float:
        """Calculate angle in degrees between two vectors"""
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        return float(np.degrees(np.arccos(cos_angle)))

    # Calculate 4 interior angles
    angles = []
    points = [tl, tr, br, bl]
    for i in range(4):
        # Get the 3 points for this corner (wrap around with modulo)
        p_prev = points[(i - 1) % 4]
        p_curr = points[i]
        p_next = points[(i + 1) % 4]

        # Vectors pointing INTO and OUT of the corner
        v1 = p_curr - p_prev  # Vector into corner
        v2 = p_next - p_curr  # Vector out of corner
        angle = angle_between_vectors(v1, v2)
        angles.append(angle)

    # Score based on deviation from 90 degrees
    angle_deviations = [abs(a - 90.0) for a in angles]
    mean_deviation = float(np.mean(angle_deviations))
    max_deviation = float(np.max(angle_deviations))

    # Perfect rectangle: 0 deviation = 40 points
    # 10 degree deviation: 20 points
    # 20+ degree deviation: 0 points
    rectangularity_score = max(0, 40.0 - 2.0 * mean_deviation)

    # --- Metric 2: Edge Support (40 points max) ---
    # Count how many edge pixels lie along the quad perimeter
    perimeter_points = []
    for i in range(4):
        p1 = points[i].astype(int)
        p2 = points[(i + 1) % 4].astype(int)

        # Sample points along this edge (Bresenham-like)
        num_samples = int(np.linalg.norm(p2 - p1))
        if num_samples > 0:
            x_samples = np.linspace(p1[0], p2[0], num_samples, dtype=int)
            y_samples = np.linspace(p1[1], p2[1], num_samples, dtype=int)

            # Clip to image bounds
            x_samples = np.clip(x_samples, 0, w_img - 1)
            y_samples = np.clip(y_samples, 0, h_img - 1)

            perimeter_points.extend(zip(x_samples, y_samples))

    # Count how many perimeter points overlap with edges
    edge_hits = 0
    for (x, y) in perimeter_points:
        if edges[y, x] > 0:
            edge_hits += 1

    edge_support_ratio = edge_hits / (len(perimeter_points) + 1e-6)
    edge_support_score = min(40.0, edge_support_ratio * 100)  # 40% support = max 40 points

    # --- Metric 3: Aspect Ratio (20 points max) ---
    # Trading cards are typically 0.63-0.72 (portrait)
    # Prefer 0.55-0.80 range, penalize outside
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    aspect = width / (height + 1e-6)

    # Optimal range: 0.55-0.80
    if 0.55 <= aspect <= 0.80:
        aspect_score = 20.0
    elif 0.50 <= aspect <= 0.90:
        # Acceptable but not ideal
        aspect_score = 10.0
    else:
        # Poor aspect ratio
        deviation = min(abs(aspect - 0.55), abs(aspect - 0.80))
        aspect_score = max(0, 10.0 - deviation * 20)

    # --- Total Score ---
    total_score = rectangularity_score + edge_support_score + aspect_score

    return float(total_score)


def score_quad_fusion(quad: np.ndarray, img_bgr: np.ndarray, edges: np.ndarray,
                      glare_mask: Optional[np.ndarray], profile: Profile) -> Tuple[float, str]:
    """
    Enhanced fusion scoring for quadrilateral candidates.

    This scoring function integrates:
    - Rectangularity (40 points)
    - Edge support with glare exclusion (40 points)
    - Aspect ratio vs profile target (20 points)
    - Border continuity bonus (up to +15 points)
    - Area sanity check (penalty if outside profile bounds)
    - Glare penalty (reduce if excessive glare along edges)

    Args:
        quad: Quadrilateral points [TL, TR, BR, BL]
        img_bgr: Original image in BGR
        edges: Edge image (from Canny/enhanced detection)
        glare_mask: Binary mask where 255=glare, 0=valid (or None)
        profile: Detection profile with target parameters

    Returns:
        (score, confidence_level) tuple
    """
    (tl, tr, br, bl) = quad
    h_img, w_img = img_bgr.shape[:2]
    points = [tl, tr, br, bl]

    # --- Metric 1: Rectangularity (40 points) ---
    def angle_between_vectors(v1: np.ndarray, v2: np.ndarray) -> float:
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        return float(np.degrees(np.arccos(cos_angle)))

    angles = []
    for i in range(4):
        p_prev = points[(i - 1) % 4]
        p_curr = points[i]
        p_next = points[(i + 1) % 4]
        v1 = p_curr - p_prev
        v2 = p_next - p_curr
        angle = angle_between_vectors(v1, v2)
        angles.append(angle)

    angle_deviations = [abs(a - 90.0) for a in angles]
    mean_deviation = float(np.mean(angle_deviations))
    rectangularity_score = max(0, 40.0 - 2.0 * mean_deviation)

    # --- Metric 2: Edge Support with Glare Exclusion (40 points) ---
    perimeter_points = []
    for i in range(4):
        p1 = points[i].astype(int)
        p2 = points[(i + 1) % 4].astype(int)

        num_samples = int(np.linalg.norm(p2 - p1))
        if num_samples > 0:
            x_samples = np.linspace(p1[0], p2[0], num_samples, dtype=int)
            y_samples = np.linspace(p1[1], p2[1], num_samples, dtype=int)
            x_samples = np.clip(x_samples, 0, w_img - 1)
            y_samples = np.clip(y_samples, 0, h_img - 1)
            perimeter_points.extend(zip(x_samples, y_samples))

    # Count edge support, EXCLUDING glare regions
    edge_hits = 0
    valid_points = 0
    glare_along_border = 0

    for (x, y) in perimeter_points:
        # Skip glare regions in scoring
        if glare_mask is not None and glare_mask[y, x] > 0:
            glare_along_border += 1
            continue

        valid_points += 1
        if edges[y, x] > 0:
            edge_hits += 1

    edge_support_ratio = edge_hits / (valid_points + 1e-6)
    edge_support_score = min(40.0, edge_support_ratio * 100)

    # --- Metric 3: Aspect Ratio vs Profile Target (20 points) ---
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
    aspect = width / (height + 1e-6)

    # Check against profile's aspect target
    target_min, target_max = profile.aspect_target
    if target_min <= aspect <= target_max:
        aspect_score = 20.0
    elif (target_min - 0.05) <= aspect <= (target_max + 0.10):
        aspect_score = 15.0  # Close to target
    else:
        # Penalty based on deviation
        deviation = min(abs(aspect - target_min), abs(aspect - target_max))
        aspect_score = max(0, 15.0 - deviation * 30)

    # --- Metric 4: Border Continuity Bonus (up to +15 points) ---
    # Check if the quad has continuous borders (not fragmented)
    # Sample more densely along perimeter and look for gaps
    continuity_score = 0.0
    for i in range(4):
        p1 = points[i].astype(int)
        p2 = points[(i + 1) % 4].astype(int)

        # Dense sampling for continuity check
        side_length = int(np.linalg.norm(p2 - p1))
        if side_length > 0:
            samples = max(side_length, 50)  # At least 50 samples per side
            x_samples = np.linspace(p1[0], p2[0], samples, dtype=int)
            y_samples = np.linspace(p1[1], p2[1], samples, dtype=int)
            x_samples = np.clip(x_samples, 0, w_img - 1)
            y_samples = np.clip(y_samples, 0, h_img - 1)

            # Check continuity (consecutive edge pixels)
            edge_pixels = [edges[y, x] > 0 for x, y in zip(x_samples, y_samples)]

            # Count consecutive runs of edge pixels
            max_run = 0
            current_run = 0
            for has_edge in edge_pixels:
                if has_edge:
                    current_run += 1
                    max_run = max(max_run, current_run)
                else:
                    current_run = 0

            # Score based on longest continuous run
            continuity_ratio = max_run / len(edge_pixels)
            continuity_score += continuity_ratio * 3.75  # 3.75 * 4 sides = 15 points max

    # --- Penalty 1: Area Sanity Check ---
    quad_area = cv2.contourArea(quad)
    image_area = h_img * w_img
    area_ratio = quad_area / image_area

    area_penalty = 0.0
    if area_ratio < profile.min_area_ratio:
        # Too small
        deficit = profile.min_area_ratio - area_ratio
        area_penalty = min(30.0, deficit * 200)  # Heavy penalty for tiny quads
    elif area_ratio > profile.max_area_ratio:
        # Too large (likely measuring image borders)
        excess = area_ratio - profile.max_area_ratio
        area_penalty = min(20.0, excess * 100)

    # --- Penalty 2: Glare Along Borders ---
    glare_penalty = 0.0
    if glare_mask is not None:
        glare_percent = (glare_along_border / (len(perimeter_points) + 1e-6)) * 100
        if glare_percent > profile.glare_max_for_edges:
            excess_glare = glare_percent - profile.glare_max_for_edges
            glare_penalty = min(15.0, excess_glare * 0.5)

    # --- Final Score Calculation ---
    base_score = rectangularity_score + edge_support_score + aspect_score
    bonus_score = continuity_score
    total_penalty = area_penalty + glare_penalty

    final_score = base_score + bonus_score - total_penalty
    final_score = max(0.0, final_score)  # Floor at 0

    # --- Confidence Level Determination ---
    if final_score >= 80 and area_penalty == 0:
        confidence = "high"
    elif final_score >= 60:
        confidence = "medium"
    elif final_score >= 40:
        confidence = "low"
    else:
        confidence = "unreliable"

    return (float(final_score), confidence)


# -----------------------------
# Card detection and normalization
# -----------------------------

def validate_card_quad(img_bgr: np.ndarray, quad: np.ndarray, sleeve_detected: bool = False) -> Tuple[bool, str]:
    """
    Validate that detected quadrilateral is actually a card, not background.

    Checks:
    1. Aspect ratio (~0.60-0.75 for standard trading cards)
    2. Size (should be 45-98% of image area, or 25-98% if sleeve detected)
    3. Not too skewed (reasonable rectangle shape)

    Args:
        img_bgr: Input image
        quad: Detected quadrilateral
        sleeve_detected: If True, use more lenient validation (card might be smaller in frame)

    Returns:
        (is_valid, reason_message)
    """
    h, w = img_bgr.shape[:2]
    image_area = float(h * w)

    # Calculate quad area
    quad_area = float(cv2.contourArea(quad))
    area_ratio = quad_area / image_area

    # Calculate aspect ratio
    (tl, tr, br, bl) = quad
    width_top = float(np.linalg.norm(tr - tl))
    width_bottom = float(np.linalg.norm(br - bl))
    height_left = float(np.linalg.norm(bl - tl))
    height_right = float(np.linalg.norm(br - tr))

    avg_width = (width_top + width_bottom) / 2.0
    avg_height = (height_left + height_right) / 2.0

    aspect = avg_width / avg_height if avg_height > 0 else 0

    # Trading cards are portrait (taller than wide): aspect ~0.63-0.72
    # Allow wider range for detection tolerance: 0.55-0.80
    # BUT if aspect > 1.5 or aspect < 0.4, definitely wrong

    # More lenient size thresholds if sleeve detected
    min_area = 0.25 if sleeve_detected else 0.45
    max_area = 0.98

    # Validation checks
    if area_ratio < min_area:
        return False, f"Card too small ({area_ratio:.1%} of image) - likely detected wrong object"

    if area_ratio > max_area:
        return False, f"Detected quad fills entire frame ({area_ratio:.1%}) - likely detecting background/table edge"

    # Check for extreme aspect ratios (clearly not a card)
    if aspect > 1.8:  # Way too wide (landscape)
        return False, f"Invalid aspect ratio ({aspect:.2f}) - card is way too wide (expected ~0.63-0.72 portrait)"

    if aspect < 0.35:  # Way too narrow
        return False, f"Invalid aspect ratio ({aspect:.2f}) - card is way too narrow (expected ~0.63-0.72 portrait)"

    # Warn for unusual but possibly valid aspect ratios
    if aspect > 1.0:  # Landscape orientation (unusual but possible)
        return True, f"Landscape card detected (aspect {aspect:.2f}) - unusual but proceeding"

    if aspect < 0.55 or aspect > 0.80:
        return True, f"Unusual aspect ratio ({aspect:.2f}) but within acceptable range"

    sleeve_note = " [sleeve mode]" if sleeve_detected else ""
    return True, f"Valid card detected (aspect {aspect:.2f}, area {area_ratio:.1%}){sleeve_note}"


# -----------------------------
# New Detection Methods (Phase 2)
# -----------------------------

def _detect_with_lsd(img_small: np.ndarray, ratio: float, profile: Profile) -> Optional[np.ndarray]:
    """
    Line Segment Detector: Find card by detecting long parallel lines.

    This method works well for:
    - Graded slabs with thick acrylic edges
    - Geometric cards with multi-layer borders (Donruss)
    - Any card with strong, straight edges

    Strategy:
    1. Detect line segments using LSD
    2. Cluster lines into two orthogonal sets (horizontal/vertical)
    3. Find extremes of each set to form rectangle
    4. Score and return best candidate
    """
    gray = to_gray(img_small)

    # Create LSD detector
    lsd = cv2.createLineSegmentDetector(0)
    lines = lsd.detect(gray)[0]

    if lines is None or len(lines) < 4:
        return None

    # Flatten lines for easier processing
    lines = lines.reshape(-1, 4)  # (x1, y1, x2, y2)

    # Separate lines by orientation
    horizontal_lines = []
    vertical_lines = []

    for line in lines:
        x1, y1, x2, y2 = line
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        length = np.sqrt(dx**2 + dy**2)

        # Only consider long lines (at least 10% of image width/height)
        min_length = min(img_small.shape[0], img_small.shape[1]) * 0.10
        if length < min_length:
            continue

        # Classify by angle
        angle = np.degrees(np.arctan2(dy, dx))

        if abs(angle) < 20 or abs(angle - 180) < 20:  # Horizontal
            horizontal_lines.append(line)
        elif abs(angle - 90) < 20:  # Vertical
            vertical_lines.append(line)

    if len(horizontal_lines) < 2 or len(vertical_lines) < 2:
        return None

    # Find extreme lines to form rectangle
    h_lines = np.array(horizontal_lines)
    v_lines = np.array(vertical_lines)

    # Get topmost and bottommost horizontal lines
    top_y = np.min(h_lines[:, [1, 3]])
    bottom_y = np.max(h_lines[:, [1, 3]])

    # Get leftmost and rightmost vertical lines
    left_x = np.min(v_lines[:, [0, 2]])
    right_x = np.max(v_lines[:, [0, 2]])

    # Form rectangle from extremes
    quad_small = np.array([
        [left_x, top_y],      # TL
        [right_x, top_y],     # TR
        [right_x, bottom_y],  # BR
        [left_x, bottom_y]    # BL
    ], dtype=np.float32)

    # Scale to full resolution
    quad = quad_small * ratio
    quad = order_quad_points(quad)

    return quad


def _detect_with_hough_lines(img_small: np.ndarray, ratio: float, profile: Profile) -> Optional[np.ndarray]:
    """
    HoughLinesP Rectangle Assembly: Use probabilistic Hough transform to find lines,
    then RANSAC to fit 4 sides and find their intersections.

    This method works well for:
    - Clear, strong edges
    - Multi-bordered cards
    - Cards with geometric designs
    """
    gray = to_gray(img_small)
    edges = cv2.Canny(gray, 50, 150)

    # Run HoughLinesP
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi/180,
        threshold=50,
        minLineLength=int(min(img_small.shape[:2]) * 0.15),
        maxLineGap=10
    )

    if lines is None or len(lines) < 4:
        return None

    lines = lines.reshape(-1, 4)

    # Group lines by orientation
    horizontal_lines = []
    vertical_lines = []

    for x1, y1, x2, y2 in lines:
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        angle = np.degrees(np.arctan2(dy, dx))

        if abs(angle) < 20 or abs(angle - 180) < 20:
            horizontal_lines.append((x1, y1, x2, y2))
        elif abs(angle - 90) < 20:
            vertical_lines.append((x1, y1, x2, y2))

    if len(horizontal_lines) < 2 or len(vertical_lines) < 2:
        return None

    # Find the most extreme lines
    h_lines = np.array(horizontal_lines)
    v_lines = np.array(vertical_lines)

    # Top and bottom horizontal lines
    top_idx = np.argmin(h_lines[:, [1, 3]].mean(axis=1))
    bottom_idx = np.argmax(h_lines[:, [1, 3]].mean(axis=1))

    # Left and right vertical lines
    left_idx = np.argmin(v_lines[:, [0, 2]].mean(axis=1))
    right_idx = np.argmax(v_lines[:, [0, 2]].mean(axis=1))

    # Get the 4 boundary lines
    top_line = h_lines[top_idx]
    bottom_line = h_lines[bottom_idx]
    left_line = v_lines[left_idx]
    right_line = v_lines[right_idx]

    # Calculate intersections to form quad
    def line_intersection(line1, line2):
        """Find intersection of two lines"""
        x1, y1, x2, y2 = line1
        x3, y3, x4, y4 = line2

        denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
        if abs(denom) < 1e-6:
            return None

        px = ((x1*y2-y1*x2)*(x3-x4) - (x1-x2)*(x3*y4-y3*x4)) / denom
        py = ((x1*y2-y1*x2)*(y3-y4) - (y1-y2)*(x3*y4-y3*x4)) / denom
        return (px, py)

    # Find 4 corners
    tl = line_intersection(top_line, left_line)
    tr = line_intersection(top_line, right_line)
    br = line_intersection(bottom_line, right_line)
    bl = line_intersection(bottom_line, left_line)

    if None in [tl, tr, br, bl]:
        return None

    quad_small = np.array([tl, tr, br, bl], dtype=np.float32)
    quad = quad_small * ratio
    quad = order_quad_points(quad)

    return quad


def _detect_with_grabcut(img_small: np.ndarray, ratio: float, profile: Profile) -> Optional[np.ndarray]:
    """
    GrabCut Foreground Segmentation: Seed the center as foreground and extract
    the largest foreground blob.

    This method works well for:
    - Busy, textured backgrounds (teal mat, patterned surfaces)
    - Cards where background has different color/texture than card
    - Cases where edges are ambiguous
    """
    h, w = img_small.shape[:2]

    # Create initial mask (0=background, 1=foreground, 2=probably bg, 3=probably fg)
    mask = np.zeros((h, w), dtype=np.uint8)

    # Seed center 70% as "probably foreground"
    margin_h = int(h * 0.15)
    margin_w = int(w * 0.15)
    mask[margin_h:h-margin_h, margin_w:w-margin_w] = cv2.GC_PR_FGD

    # Initialize background/foreground models
    bgd_model = np.zeros((1, 65), dtype=np.float64)
    fgd_model = np.zeros((1, 65), dtype=np.float64)

    # Run GrabCut
    try:
        cv2.grabCut(img_small, mask, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)
    except Exception as e:
        print(f"[GrabCut] Failed: {e}")
        return None

    # Extract foreground mask
    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Clean up mask
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=3)

    # Find largest connected component
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)

    # Get rotated bounding rectangle
    rect = cv2.minAreaRect(largest)
    box = cv2.boxPoints(rect)
    box = np.array(box, dtype=np.float32) * ratio

    return order_quad_points(box)


def _detect_with_saliency(img_small: np.ndarray, ratio: float, profile: Profile) -> Optional[np.ndarray]:
    """
    Saliency Map Detection: Find the most salient (visually interesting) region.

    This is a last-resort fallback method that works by:
    1. Computing spectral residual saliency
    2. Finding the most salient blob
    3. Extracting its bounding rectangle

    This method works when all else fails, assuming the card is the most
    visually interesting object in the image.
    """
    # OpenCV saliency module
    try:
        saliency_algo = cv2.saliency.StaticSaliencySpectralResidual_create()
        success, saliency_map = saliency_algo.computeSaliency(img_small)

        if not success:
            return None

        # Threshold saliency map
        saliency_map = (saliency_map * 255).astype(np.uint8)
        _, saliency_thresh = cv2.threshold(saliency_map, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        saliency_thresh = cv2.morphologyEx(saliency_thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        saliency_thresh = cv2.morphologyEx(saliency_thresh, cv2.MORPH_CLOSE, kernel, iterations=3)

        # Find largest salient region
        contours, _ = cv2.findContours(saliency_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)

        # Get minimal area rectangle
        rect = cv2.minAreaRect(largest)
        box = cv2.boxPoints(rect)
        box = np.array(box, dtype=np.float32) * ratio

        return order_quad_points(box)

    except Exception as e:
        print(f"[Saliency] Detection failed: {e}")
        return None


def _detect_with_lab_chroma(img_small: np.ndarray, ratio: float, profile: Profile) -> Optional[np.ndarray]:
    """
    LAB Chroma Segmentation: Separate card from background using color difference.

    This method computes |A - B| in LAB color space, which effectively separates
    card paper from most backgrounds (especially useful for holo/foil cards).

    Strategy:
    1. Convert to LAB color space
    2. Compute chroma difference: |A - B|
    3. Threshold to separate card from background
    4. Find largest connected component
    5. Extract bounding rectangle
    """
    lab = to_lab(img_small)
    L, A, B = cv2.split(lab)

    # Compute chroma delta: |A - B|
    # Card paper often has different A/B balance than backgrounds
    chroma_delta = np.abs(A.astype(np.float32) - B.astype(np.float32))
    chroma_delta = chroma_delta.astype(np.uint8)

    # Also use brightness difference
    L_blur = cv2.GaussianBlur(L, (15, 15), 0)

    # Combine chroma and brightness information
    _, mask_chroma = cv2.threshold(chroma_delta, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    _, mask_brightness = cv2.threshold(L_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Combine masks (vote-based: both should agree for strong signal)
    combined = cv2.bitwise_or(mask_chroma, mask_brightness)

    # Morphological cleanup
    kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel_open, iterations=2)

    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_close, iterations=3)

    # Find contours
    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Get largest contour
    largest = max(contours, key=cv2.contourArea)

    # Reject if touching border
    if _contour_touches_border(largest, img_small.shape, margin=10):
        return None

    # Get rotated bounding rectangle
    rect = cv2.minAreaRect(largest)
    box = cv2.boxPoints(rect)
    box = np.array(box, dtype=np.float32) * ratio

    return order_quad_points(box)


# -----------------------------
# Phase 4: Inner Card Refinement
# -----------------------------

def refine_inner_card(quad_outer: np.ndarray, img_bgr: np.ndarray, profile: Profile) -> Optional[np.ndarray]:
    """
    Refine card boundary to find the INNER card inside a sleeve/slab.

    This is critical for sleeves and slabs where the initial detection finds
    the outer plastic/acrylic boundary, but we need the actual card edges inside.

    Strategy (IMPROVED 2025-10-19):
    1. Warp outer quad to normalized perspective
    2. Try multiple detection strategies in order:
       a) LAB chroma segmentation (separates card from black borders)
       b) Morphological erosion + edge detection
       c) Color-based separation (card vs. sleeve/border)
    3. Detect inner quadrilateral
    4. Map back to original image coordinates

    Args:
        quad_outer: Outer boundary quadrilateral (sleeve/slab edges)
        img_bgr: Original full-resolution image
        profile: Detection profile (contains erosions_for_inner)

    Returns:
        Refined inner quadrilateral or None if refinement fails
    """
    if profile.erosions_for_inner == 0:
        # No refinement needed for this profile
        return None

    print(f"[Inner Refinement] Attempting to find card inside {profile.name}...")

    # Warp to normalized space (make it rectangular)
    # NOTE: warp_to_rect returns (warped_image, mask) not (warped_image, transform_matrix)
    warped, mask = warp_to_rect(img_bgr, quad_outer, target_height=1500)
    h_warp, w_warp = warped.shape[:2]

    # Compute transformation matrix ourselves for inverse mapping later
    dst_rect = np.array([[0, 0],
                         [w_warp - 1, 0],
                         [w_warp - 1, h_warp - 1],
                         [0, h_warp - 1]], dtype=np.float32)
    M_forward = cv2.getPerspectiveTransform(quad_outer, dst_rect)

    # STRATEGY 1: LAB Chroma Segmentation (best for colored cards inside black borders)
    print("[Inner Refinement] Strategy 1: LAB chroma segmentation")
    inner_quad = _try_lab_inner_detection(warped, M_forward, h_warp, w_warp)
    if inner_quad is not None:
        print("[Inner Refinement] SUCCESS: LAB chroma method succeeded")
        return inner_quad

    # STRATEGY 2: Increased erosion + edge detection (best for high-contrast boundaries)
    print("[Inner Refinement] Strategy 2: Increased erosion + edge detection")
    inner_quad = _try_erosion_inner_detection(warped, M_forward, h_warp, w_warp, profile.erosions_for_inner * 3)
    if inner_quad is not None:
        print("[Inner Refinement] SUCCESS: Erosion method succeeded")
        return inner_quad

    # STRATEGY 3: Color-based foreground/background separation
    print("[Inner Refinement] Strategy 3: Color-based separation")
    inner_quad = _try_color_inner_detection(warped, M_forward, h_warp, w_warp)
    if inner_quad is not None:
        print("[Inner Refinement] SUCCESS: Color-based method succeeded")
        return inner_quad

    print("[Inner Refinement] FAILED: All strategies failed - no suitable inner quad found")
    return None


def _try_lab_inner_detection(warped: np.ndarray, M: np.ndarray, h_warp: int, w_warp: int) -> Optional[np.ndarray]:
    """
    Strategy 1: Use LAB color space to separate card from black/grey borders.
    Works well for colored cards inside slabs with black borders.
    """
    lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    # Calculate chroma (colorfulness)
    chroma = cv2.sqrt(cv2.add(cv2.multiply(a.astype(np.float32), a.astype(np.float32)),
                               cv2.multiply(b.astype(np.float32), b.astype(np.float32)))).astype(np.uint8)

    # Threshold on high chroma (colorful card vs. grey/black border)
    # Use Otsu to automatically find threshold
    _, chroma_mask = cv2.threshold(chroma, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Also threshold on brightness (card is usually brighter than black borders)
    _, brightness_mask = cv2.threshold(l, 50, 255, cv2.THRESH_BINARY)

    # Combine masks
    combined = cv2.bitwise_or(chroma_mask, brightness_mask)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=3)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=2)

    # Erode to shrink away from borders
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 30))
    combined = cv2.erode(combined, kernel_erode, iterations=2)

    return _extract_quad_from_mask(combined, M, h_warp, w_warp)


def _try_erosion_inner_detection(warped: np.ndarray, M: np.ndarray, h_warp: int, w_warp: int, erosion_iters: int) -> Optional[np.ndarray]:
    """
    Strategy 2: Heavy erosion + edge detection.
    Works well when there's a clear contrast boundary.
    """
    gray_warp = to_gray(warped)

    # Apply adaptive threshold
    thresh = cv2.adaptiveThreshold(
        gray_warp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 21, 10
    )

    # Heavy morphological erosion to shrink from outer edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    eroded = cv2.erode(thresh, kernel, iterations=erosion_iters)

    # Invert if needed
    if np.mean(eroded) > 127:
        eroded = cv2.bitwise_not(eroded)

    # Find edges
    edges_inner = cv2.Canny(eroded, 30, 100)

    # Connect edges
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    edges_inner = cv2.morphologyEx(edges_inner, cv2.MORPH_CLOSE, kernel_close, iterations=3)

    return _extract_quad_from_mask(edges_inner, M, h_warp, w_warp)


def _try_color_inner_detection(warped: np.ndarray, M: np.ndarray, h_warp: int, w_warp: int) -> Optional[np.ndarray]:
    """
    Strategy 3: Color-based foreground/background separation.
    Uses HSV color space to separate card from dark borders.
    """
    hsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # Card is usually brighter and more saturated than borders
    _, v_mask = cv2.threshold(v, 40, 255, cv2.THRESH_BINARY)
    _, s_mask = cv2.threshold(s, 20, 255, cv2.THRESH_BINARY)

    # Combine
    combined = cv2.bitwise_or(v_mask, s_mask)

    # Cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

    # Erode to shrink
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    combined = cv2.erode(combined, kernel_erode, iterations=1)

    return _extract_quad_from_mask(combined, M, h_warp, w_warp)


def _extract_quad_from_mask(mask: np.ndarray, M_forward: np.ndarray, h_warp: int, w_warp: int) -> Optional[np.ndarray]:
    """
    Helper: Extract quadrilateral from a binary mask and map back to original coordinates.

    Args:
        mask: Binary mask in warped space
        M_forward: Forward perspective transform matrix (original -> warped)
        h_warp: Height of warped image
        w_warp: Width of warped image

    Returns:
        Quadrilateral in original image coordinates, or None if extraction fails
    """
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Look for large quadrilateral contours
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        area_ratio = cv2.contourArea(cnt) / (h_warp * w_warp)

        # Inner card should be 25-95% of warped area (lowered from 40% to catch more cases)
        if area_ratio < 0.25 or area_ratio > 0.95:
            continue

        # Try to approximate as quadrilateral
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.03 * peri, True)

        # If not exactly 4 points, try using minimum area rectangle
        if len(approx) == 4:
            quad_warp = approx.reshape(4, 2).astype(np.float32)
        else:
            # Use minAreaRect as fallback
            rect = cv2.minAreaRect(cnt)
            quad_warp = cv2.boxPoints(rect).astype(np.float32)

        quad_warp = order_quad_points(quad_warp)

        # Map back to original image coordinates using inverse transform
        # M_forward is a 3x3 perspective transform matrix, so we can invert it
        try:
            M_inverse = cv2.invert(M_forward.astype(np.float32))[1]
            quad_inner = cv2.perspectiveTransform(quad_warp.reshape(1, 4, 2), M_inverse).reshape(4, 2)

            print(f"[Inner Refinement] -> Found inner quad (area: {area_ratio:.1%} of warped)")
            return quad_inner
        except cv2.error as e:
            print(f"[Inner Refinement] FAILED: Could not invert transformation matrix: {e}")
            return None

    return None


def detect_card_quadrilateral(img_bgr: np.ndarray, sleeve_detected: bool = False,
                              slab_detected: bool = False) -> Tuple[Optional[np.ndarray], Dict[str, any]]:
    """
    FUSION-BASED card boundary detection with profile-aware detector cascade.

    NEW STRATEGY (Phase 3):
    1. Select optimal profile based on preflight analysis
    2. Run ALL detectors in profile's preferred order
    3. Collect ALL valid candidates
    4. Score ALL candidates using fusion scoring
    5. Return BEST candidate (highest score)

    This eliminates the "0.1-2.9% tiny object" problem by:
    - Scoring all candidates in consistent full-resolution coordinates
    - Preferring high-quality rectangles over first-match
    - Using glare-aware scoring and profile-specific thresholds

    Args:
        img_bgr: Input image in BGR format
        sleeve_detected: Whether sleeve features were detected
        slab_detected: Whether slab features were detected

    Returns:
        (quad, metadata) tuple where:
        - quad: Ordered quadrilateral [TL, TR, BR, BL] or None if all fail
        - metadata: Dict with profile, method, score, confidence
    """
    print("\n" + "="*70)
    print("[OpenCV Fusion Detection] Starting comprehensive card detection")
    print("="*70)

    # PHASE 5: Crop UI bars if phone screenshot
    has_ui_bars, _, _ = detect_ui_bars(img_bgr)
    if has_ui_bars:
        print("\n[Phase 5] Phone screenshot detected - cropping UI bars...")
        img_bgr = crop_ui_bars(img_bgr)

    h_orig, w_orig = img_bgr.shape[:2]

    # STEP 1: Select optimal profile based on preflight analysis
    profile = select_profile(img_bgr, sleeve_detected, slab_detected)
    print(f"\n[Profile] Using: {profile.name}")
    print(f"[Profile] Detector order: {', '.join(profile.detector_order)}")
    print(f"[Profile] Area range: {profile.min_area_ratio:.2f}-{profile.max_area_ratio:.2f}")
    print(f"[Profile] Aspect target: {profile.aspect_target[0]:.2f}-{profile.aspect_target[1]:.2f}")

    # STEP 2: Preprocess and prepare images
    img_small = resize_max_dim(img_bgr, 1200)
    ratio = w_orig / float(img_small.shape[1])

    # Generate glare mask for scoring
    glare_mask = detect_glare_mask(img_bgr)
    glare_percent = (np.sum(glare_mask > 0) / float(glare_mask.size)) * 100
    print(f"[Preprocessing] Glare coverage: {glare_percent:.1f}%")

    # Generate edges for scoring
    edges = _generate_enhanced_edges(img_small)
    edges_full = cv2.resize(edges, (w_orig, h_orig), interpolation=cv2.INTER_NEAREST)

    # STEP 3: Run ALL detectors and collect candidates
    print(f"\n[Fusion] Running {len(profile.detector_order)} detectors in profile order...")
    candidates = []  # List of (quad, method_name) tuples

    for method_name in profile.detector_order:
        print(f"\n[Detector] Trying: {method_name}")

        quad = None
        try:
            if method_name == "fused_edges":
                # Legacy Canny-based detection
                quad = _detect_with_canny(img_small, ratio, 50, 150, 0.02)

            elif method_name == "lsd":
                quad = _detect_with_lsd(img_small, ratio, profile)

            elif method_name == "hough":
                quad = _detect_with_hough_lines(img_small, ratio, profile)

            elif method_name == "grabcut":
                quad = _detect_with_grabcut(img_small, ratio, profile)

            elif method_name == "color_seg":
                quad = _detect_with_color_segmentation(img_small, ratio)

            elif method_name == "lab_chroma":
                quad = _detect_with_lab_chroma(img_small, ratio, profile)

            elif method_name == "saliency":
                quad = _detect_with_saliency(img_small, ratio, profile)

            else:
                print(f"[Detector] Unknown method: {method_name}, skipping")
                continue

        except Exception as e:
            print(f"[Detector] {method_name} failed with error: {e}")
            continue

        # If detector found something, validate and add to candidates
        if quad is not None:
            is_valid, msg = validate_card_quad(img_bgr, quad, sleeve_detected=sleeve_detected)
            if is_valid:
                candidates.append((quad, method_name))
                print(f"[Detector] {method_name} found valid candidate - {msg}")
            else:
                print(f"[Detector] {method_name} rejected - {msg}")
        else:
            print(f"[Detector] {method_name} found nothing")

    # STEP 4: Score all candidates and pick the best
    if not candidates:
        print("\n[Fusion] No valid candidates found across all detectors")
        print("="*70)
        return None, {
            "profile": profile.name,
            "method": None,
            "score": 0.0,
            "confidence": "unreliable",
            "candidates_tested": 0
        }

    print(f"\n[Fusion Scoring] Evaluating {len(candidates)} candidates...")
    scored_candidates = []

    for quad, method_name in candidates:
        score, confidence = score_quad_fusion(quad, img_bgr, edges_full, glare_mask, profile)

        # Calculate area ratio for logging
        quad_area = cv2.contourArea(quad)
        area_ratio = quad_area / (h_orig * w_orig)

        scored_candidates.append((score, confidence, quad, method_name, area_ratio))
        print(f"  [{method_name:12s}] Score: {score:5.1f}/100, Confidence: {confidence:10s}, Area: {area_ratio:.1%}")

    # Sort by score (highest first)
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    # STEP 5: Return the best candidate
    best_score, best_conf, best_quad, best_method, best_area = scored_candidates[0]

    # STEP 5.5: Inner Card Refinement (for sleeves/slabs)
    if profile.erosions_for_inner > 0:
        print(f"\n[Phase 4] Profile requires inner refinement (erosions: {profile.erosions_for_inner})")
        inner_quad = refine_inner_card(best_quad, img_bgr, profile)

        if inner_quad is not None:
            # Score the inner quad
            inner_score, inner_conf = score_quad_fusion(inner_quad, img_bgr, edges_full, glare_mask, profile)
            inner_area = cv2.contourArea(inner_quad) / (h_orig * w_orig)

            print(f"[Inner Refinement] Inner quad score: {inner_score:.1f}/100 (outer was {best_score:.1f}/100)")

            # Use inner quad if it scores better OR if outer score was low
            if inner_score > best_score or best_score < 60:
                print(f"[Inner Refinement] Using INNER quad (better score)")
                best_quad = inner_quad
                best_score = inner_score
                best_conf = inner_conf
                best_area = inner_area
                best_method = f"{best_method}+inner"
            else:
                print(f"[Inner Refinement] Keeping OUTER quad (better score)")

    print(f"\n[Fusion Winner] Method: {best_method}")
    print(f"[Fusion Winner] Score: {best_score:.1f}/100")
    print(f"[Fusion Winner] Confidence: {best_conf}")
    print(f"[Fusion Winner] Area: {best_area:.1%}")
    print("="*70 + "\n")

    metadata = {
        "profile": profile.name,
        "method": best_method,
        "score": float(best_score),
        "confidence": best_conf,
        "candidates_tested": len(candidates),
        "area_ratio": float(best_area)
    }

    return best_quad, metadata


def _detect_with_canny(img_small: np.ndarray, ratio: float,
                       canny_low: int, canny_high: int,
                       approx_tolerance: float) -> Optional[np.ndarray]:
    """
    Helper: Detect card using Canny edge detection with specified parameters.

    Updated 2025-10-17:
    - Added edge enhancement, aspect ratio filtering, and border rejection
    - Added rectangle scoring to pick BEST candidate instead of FIRST candidate
    - OPTION A: Using enhanced multi-channel edge detection with glare masking
    """
    # Use new enhanced edge detection (glare masking, multi-channel, morphological closing)
    edges = _generate_enhanced_edges(img_small)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Sort by area and try top 15 contours (increased from 10)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:15]

    # INSTEAD of returning the FIRST match, collect ALL candidates and score them
    candidates = []

    for cnt in contours:
        # Reject contours touching image borders (likely background/table edges)
        if _contour_touches_border(cnt, img_small.shape):
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, approx_tolerance * peri, True)

        if len(approx) == 4:
            quad = approx.reshape(4, 2).astype(np.float32) * ratio

            # Quick aspect ratio check BEFORE scoring
            (tl, tr, br, bl) = quad
            width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
            height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
            aspect = width / height if height > 0 else 0

            # Trading cards are portrait (aspect ~0.63-0.72)
            # Allow range 0.50-0.90 for initial detection
            if 0.50 < aspect < 0.90:
                quad_ordered = order_quad_points(quad)

                # Score this candidate
                # Scale quad back to img_small coordinates for scoring
                quad_small = quad_ordered / ratio
                score = score_quad(quad_small, edges, img_small.shape)

                candidates.append((score, quad_ordered))

    # Return the BEST scoring candidate (not the first one!)
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)  # Sort by score descending
        best_score, best_quad = candidates[0]
        print(f"[OpenCV Scoring] Found {len(candidates)} candidates, best score: {best_score:.1f}/100")
        return best_quad

    return None


def _detect_bounding_box(img_small: np.ndarray, ratio: float) -> Optional[np.ndarray]:
    """
    Helper: Use bounding box of largest contour as fallback.
    This works even when the card has rounded corners.

    Updated 2025-10-17:
    - Added edge enhancement and border rejection
    - Added rectangle scoring to pick BEST candidate instead of FIRST candidate
    - OPTION A: Using enhanced multi-channel edge detection with glare masking
    """
    # Use enhanced edge detection for scoring
    edges = _generate_enhanced_edges(img_small)

    # Also generate threshold-based contours (complementary to edge-based detection)
    gray = to_gray(img_small)
    gray = auto_contrast(gray)
    gray_enhanced = _enhance_card_edges(gray)
    blur = cv2.GaussianBlur(gray_enhanced, (9, 9), 0)

    # Try adaptive thresholding
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)

    # Morphological operations to clean up
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Try multiple large contours, not just the largest (could be background)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    # Collect ALL candidates and score them
    candidates = []

    for cnt in contours:
        # Reject contours touching borders
        if _contour_touches_border(cnt, img_small.shape):
            continue

        # Get rotated bounding box
        rect = cv2.minAreaRect(cnt)
        box = cv2.boxPoints(rect)
        box = np.array(box, dtype=np.float32) * ratio

        # Quick aspect ratio check
        (tl, tr, br, bl) = box
        width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
        height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
        aspect = width / height if height > 0 else 0

        # Check if aspect looks like a card
        if 0.50 < aspect < 0.90:
            quad_ordered = order_quad_points(box)

            # Score this candidate using enhanced edges
            quad_small = quad_ordered / ratio
            score = score_quad(quad_small, edges, img_small.shape)

            candidates.append((score, quad_ordered))

    # Return the BEST scoring candidate
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_quad = candidates[0]
        print(f"[OpenCV Scoring] Found {len(candidates)} candidates, best score: {best_score:.1f}/100")
        return best_quad

    return None


def _detect_card_in_sleeve(img_small: np.ndarray, ratio: float) -> Optional[np.ndarray]:
    """
    Helper: Detect card INSIDE a sleeve by looking for inner boundaries.

    Strategy:
    - Enhanced edge detection specifically for sleeved cards
    - Try erosion-based inner boundary detection
    - Look through multiple contours with valid card aspect ratio
    - Skip contours touching borders (likely sleeve edges, not card)
    - Use rectangle scoring to find best candidate

    Updated 2025-10-17:
    - Added edge enhancement, adaptive thresholding, and border rejection
    - Added erosion-based inner boundary detection
    - Added rectangle scoring for best candidate selection
    - OPTION A: Using enhanced multi-channel edge detection with glare masking
    """
    # Use new enhanced edge detection (glare masking, multi-channel, morphological closing)
    edges_enhanced = _generate_enhanced_edges(img_small)

    # Additional erosion pass specifically for sleeve-aware detection
    # This helps find the inner card edge when sleeve edge is dominant
    kernel_erode = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges_eroded = cv2.erode(edges_enhanced, kernel_erode, iterations=2)
    edges_combined_final = cv2.bitwise_or(edges_enhanced, edges_eroded)

    contours, _ = cv2.findContours(edges_combined_final, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Sort by area and try top 20 contours (increased for better sleeve detection)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:20]

    # Collect ALL candidates and score them (like we did for other methods)
    candidates = []

    for cnt in contours:
        # Reject contours touching borders (likely sleeve edges, not card)
        if _contour_touches_border(cnt, img_small.shape, margin=15):
            continue

        peri = cv2.arcLength(cnt, True)

        # Try multiple approximation tolerances
        for tol in [0.02, 0.03, 0.04, 0.05, 0.06, 0.07]:
            approx = cv2.approxPolyDP(cnt, tol * peri, True)

            if len(approx) == 4:
                quad = approx.reshape(4, 2).astype(np.float32) * ratio

                # Quick aspect ratio check
                (tl, tr, br, bl) = quad
                width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
                height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
                aspect = width / height if height > 0 else 0

                # If aspect looks like a card, score it
                if 0.50 < aspect < 0.90:
                    quad_ordered = order_quad_points(quad)

                    # Score this candidate
                    quad_small = quad_ordered / ratio
                    score = score_quad(quad_small, edges_combined_final, img_small.shape)

                    candidates.append((score, quad_ordered))
                    break  # Don't try more tolerances for this contour once we found one

    # Return the BEST scoring candidate
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_quad = candidates[0]
        print(f"[OpenCV Scoring] Sleeve-aware detection found {len(candidates)} candidates, best score: {best_score:.1f}/100")
        return best_quad

    return None


def _detect_with_color_segmentation(img_small: np.ndarray, ratio: float) -> Optional[np.ndarray]:
    """
    Helper: Detect card using color-based segmentation (for low-contrast edges).

    PROBLEM SOLVED: Black card borders on dark backgrounds have invisible edges,
    but the card face (colorful artwork) has strong color contrast with the background.

    Strategy:
    1. Segment card from background using color/brightness difference
    2. Find largest connected component with card-like aspect ratio
    3. Extract bounding quadrilateral from color mask
    4. Score candidates using existing scoring system

    Added: 2025-10-17 - Method 6 for low-contrast boundary detection
    """
    h, w = img_small.shape[:2]

    # Generate a dummy edge map for scoring (since we're not using edges here)
    dummy_edges = np.zeros((h, w), dtype=np.uint8)

    # APPROACH 1: Brightness-based segmentation
    # Cards are often brighter than dark backgrounds
    gray = to_gray(img_small)
    gray_blur = cv2.GaussianBlur(gray, (15, 15), 0)

    # Otsu's threshold to automatically separate card from background
    _, mask_brightness = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # APPROACH 2: Saturation-based segmentation
    # Card artwork typically has more color saturation than plain backgrounds
    hsv = cv2.cvtColor(img_small, cv2.COLOR_BGR2HSV)
    h_ch, s_ch, v_ch = cv2.split(hsv)

    # Threshold saturation: card artwork has higher saturation
    _, mask_saturation = cv2.threshold(s_ch, 30, 255, cv2.THRESH_BINARY)

    # APPROACH 3: Variance-based segmentation
    # Card artwork has more texture variation than plain backgrounds
    variance_kernel = 15
    mean_img = cv2.blur(gray, (variance_kernel, variance_kernel))
    sqr_img = cv2.blur(gray.astype(np.float32)**2, (variance_kernel, variance_kernel))
    variance = sqr_img - mean_img.astype(np.float32)**2
    variance = np.clip(variance, 0, 255).astype(np.uint8)

    _, mask_variance = cv2.threshold(variance, 20, 255, cv2.THRESH_BINARY)

    # Combine all three masks (vote-based)
    # If at least 2 out of 3 masks agree a pixel is "card", mark it as card
    combined_votes = (mask_brightness > 0).astype(np.uint8) + \
                     (mask_saturation > 0).astype(np.uint8) + \
                     (mask_variance > 0).astype(np.uint8)

    mask_combined = (combined_votes >= 2).astype(np.uint8) * 255

    # Clean up mask with morphological operations
    kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    mask_combined = cv2.morphologyEx(mask_combined, cv2.MORPH_OPEN, kernel_open, iterations=2)

    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    mask_combined = cv2.morphologyEx(mask_combined, cv2.MORPH_CLOSE, kernel_close, iterations=3)

    # Find contours in the cleaned mask
    contours, _ = cv2.findContours(mask_combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Sort by area and try top 5 largest regions
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    candidates = []

    for cnt in contours:
        # Reject contours touching borders
        if _contour_touches_border(cnt, img_small.shape, margin=10):
            continue

        # Get rotated bounding rectangle
        rect = cv2.minAreaRect(cnt)
        box = cv2.boxPoints(rect)
        box = np.array(box, dtype=np.float32) * ratio

        # Quick aspect ratio check
        (tl, tr, br, bl) = box
        width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
        height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))
        aspect = width / height if height > 0 else 0

        # Check if aspect looks like a card
        if 0.50 < aspect < 0.90:
            quad_ordered = order_quad_points(box)

            # Score based on area and rectangularity (since we don't have edges)
            # Use a modified scoring approach for color-based detection
            quad_small = quad_ordered / ratio

            # Calculate area score (prefer larger regions that look like full cards)
            contour_area = cv2.contourArea(cnt)
            image_area = h * w
            area_ratio = contour_area / image_area

            # Area score: prefer 45-80% of image
            if 0.45 <= area_ratio <= 0.80:
                area_score = 40.0
            elif 0.30 <= area_ratio < 0.45:
                area_score = 30.0 * (area_ratio - 0.30) / 0.15 + 10.0
            elif 0.80 < area_ratio <= 0.95:
                area_score = 40.0 - 20.0 * (area_ratio - 0.80) / 0.15
            else:
                area_score = 0.0

            # Rectangularity score (from existing scoring function)
            (tl_s, tr_s, br_s, bl_s) = quad_small
            points = [tl_s, tr_s, br_s, bl_s]

            def angle_between_vectors(v1: np.ndarray, v2: np.ndarray) -> float:
                cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
                cos_angle = np.clip(cos_angle, -1.0, 1.0)
                return float(np.degrees(np.arccos(cos_angle)))

            angles = []
            for i in range(4):
                p_prev = points[(i - 1) % 4]
                p_curr = points[i]
                p_next = points[(i + 1) % 4]
                v1 = p_curr - p_prev
                v2 = p_next - p_curr
                angle = angle_between_vectors(v1, v2)
                angles.append(angle)

            angle_deviations = [abs(a - 90.0) for a in angles]
            mean_deviation = float(np.mean(angle_deviations))
            rectangularity_score = max(0, 40.0 - 2.0 * mean_deviation)

            # Aspect ratio score (from existing scoring function)
            if 0.55 <= aspect <= 0.80:
                aspect_score = 20.0
            elif 0.50 <= aspect <= 0.90:
                aspect_score = 10.0
            else:
                deviation = min(abs(aspect - 0.55), abs(aspect - 0.80))
                aspect_score = max(0, 10.0 - deviation * 20)

            # Total score for color-based detection
            total_score = area_score + rectangularity_score + aspect_score

            candidates.append((total_score, quad_ordered))

    # Return the BEST scoring candidate
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_quad = candidates[0]
        print(f"[OpenCV Scoring] Color-based detection found {len(candidates)} candidates, best score: {best_score:.1f}/100")
        return best_quad

    return None


def order_quad_points(pts: np.ndarray) -> np.ndarray:
    # Order points in consistent order: top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _enhance_card_edges(img: np.ndarray) -> np.ndarray:
    """
    Enhance card edges for better detection when card is in sleeve.

    Strategy:
    1. Bilateral filter to preserve edges while removing noise
    2. CLAHE for local contrast enhancement
    3. Emphasize boundaries

    Args:
        img: Grayscale image

    Returns:
        Enhanced grayscale image
    """
    # Bilateral filter preserves sharp edges while smoothing noise
    bilateral = cv2.bilateralFilter(img, 9, 75, 75)

    # CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(bilateral)

    return enhanced


def _generate_enhanced_edges(img_bgr: np.ndarray) -> np.ndarray:
    """
    Generate enhanced edge map using multiple techniques for robust card detection.

    OPTION A IMPROVEMENTS (2025-10-17):
    1. Glare masking - Exclude glare regions from edge detection
    2. Multi-channel detection - Grayscale + HSV-V channel
    3. Fused edge maps - Combine Canny + Sobel
    4. Morphological closing - Connect broken edges

    Args:
        img_bgr: Input image in BGR format (full size or resized)

    Returns:
        Enhanced edge map (single channel, binary)
    """
    # Step 1: Generate glare mask to exclude reflection zones
    glare_mask = detect_glare_mask(img_bgr, sat_thresh=40, val_thresh=230)

    # Step 2: Multi-channel edge detection
    # Channel 1: Grayscale with enhancement
    gray = to_gray(img_bgr)
    gray = auto_contrast(gray)
    gray_enhanced = _enhance_card_edges(gray)
    blur_gray = cv2.GaussianBlur(gray_enhanced, (5, 5), 0)

    # Channel 2: HSV-V channel (value/brightness) - better for cards with color variations
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    v_channel = hsv[:, :, 2]
    v_enhanced = _enhance_card_edges(v_channel)
    blur_v = cv2.GaussianBlur(v_enhanced, (5, 5), 0)

    # Step 3: Generate multiple edge maps
    # Canny edges on grayscale (good for sharp transitions)
    edges_canny_gray = cv2.Canny(blur_gray, 40, 120)

    # Canny edges on V channel (good for brightness-based boundaries)
    edges_canny_v = cv2.Canny(blur_v, 40, 120)

    # Sobel edges (good for gradual transitions that Canny misses)
    sobel_x = cv2.Sobel(blur_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(blur_gray, cv2.CV_64F, 0, 1, ksize=3)
    sobel_mag = np.sqrt(sobel_x**2 + sobel_y**2)
    sobel_mag = np.clip(sobel_mag, 0, 255).astype(np.uint8)
    _, edges_sobel = cv2.threshold(sobel_mag, 30, 255, cv2.THRESH_BINARY)

    # Step 4: Fuse all edge maps
    edges_fused = cv2.bitwise_or(edges_canny_gray, edges_canny_v)
    edges_fused = cv2.bitwise_or(edges_fused, edges_sobel)

    # Step 5: Apply glare masking - Zero out edges in glare regions
    edges_fused[glare_mask > 0] = 0

    # Step 6: Morphological closing to connect broken edges
    # This helps when glare or sleeve reflections break card boundary continuity
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges_closed = cv2.morphologyEx(edges_fused, cv2.MORPH_CLOSE, kernel_close, iterations=2)

    print(f"[OpenCV Enhanced Edges] Applied multi-channel detection, glare masking, and morphological closing")

    return edges_closed


def _contour_touches_border(cnt: np.ndarray, img_shape: Tuple[int, int], margin: int = 10) -> bool:
    """
    Check if contour touches image borders (likely background/table edge).

    Args:
        cnt: Contour to check
        img_shape: Image shape (height, width)
        margin: Pixel margin from edge (default 10px)

    Returns:
        True if contour touches border, False otherwise
    """
    x, y, w, h = cv2.boundingRect(cnt)
    h_img, w_img = img_shape[:2]

    # Check if bounding box touches any edge
    if x < margin or y < margin:
        return True
    if (x + w) > (w_img - margin):
        return True
    if (y + h) > (h_img - margin):
        return True

    return False


def warp_to_rect(img_bgr: np.ndarray, quad: np.ndarray, target_height: int = 1500) -> Tuple[np.ndarray, np.ndarray]:
    # Estimate aspect using the distances
    (tl, tr, br, bl) = quad
    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = int(max(widthA, widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = int(max(heightA, heightB))

    # Normalize height to target while preserving aspect
    scale = target_height / float(maxHeight if maxHeight > 0 else target_height)
    out_h = target_height
    out_w = int(maxWidth * scale)

    dst = np.array([[0, 0],
                    [out_w - 1, 0],
                    [out_w - 1, out_h - 1],
                    [0, out_h - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(quad, dst)
    warped = cv2.warpPerspective(img_bgr, M, (out_w, out_h), flags=cv2.INTER_CUBIC)

    mask = np.zeros((out_h, out_w), dtype=np.uint8)
    cv2.fillConvexPoly(mask, dst.astype(np.int32), 255)

    return warped, mask


# -----------------------------
# Glare and sleeve detection
# -----------------------------

def detect_glare_mask(img_bgr: np.ndarray, sat_thresh: int = 40, val_thresh: int = 230) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    glare = ((s < sat_thresh) & (v > val_thresh)).astype(np.uint8) * 255
    glare = cv2.morphologyEx(glare, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    glare = cv2.dilate(glare, np.ones((3, 3), np.uint8), iterations=1)
    return glare


def detect_sleeve_like_features(img_bgr: np.ndarray) -> Tuple[bool, bool, bool]:
    """
    Detect if card is in a protective sleeve, top loader, or slab.

    Strategy:
    1. Check for double edges near image borders (sleeve creates extra edges)
    2. Check for reflection/glare patterns typical of plastic
    3. Analyze color consistency (sleeves often add slight tint)
    4. Check for vertical reflection lines (common in penny sleeves)

    Returns:
        (sleeve, top_loader, slab) - booleans indicating presence
    """
    gray = to_gray(img_bgr)
    h, w = gray.shape[:2]

    # Method 1: Double edge detection
    edges = cv2.Canny(gray, 60, 120)  # Lower thresholds for better detection

    border_band = 15  # Wider band to catch sleeve edges
    edge_border = np.zeros_like(edges)
    edge_border[:, :border_band] = edges[:, :border_band]
    edge_border[:, -border_band:] = np.maximum(edge_border[:, -border_band:], edges[:, -border_band:])
    edge_border[:border_band, :] = np.maximum(edge_border[:border_band, :], edges[:border_band, :])
    edge_border[-border_band:, :] = np.maximum(edge_border[-border_band:, :], edges[-border_band:, :])

    double_edge_ratio = float(np.mean(edge_border > 0))

    # Method 2: Glare/reflection detection (HSV)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h_ch, s_ch, v_ch = cv2.split(hsv)

    # Plastic sleeves create high-value, low-saturation regions (glare)
    glare_mask = ((s_ch < 50) & (v_ch > 200)).astype(np.uint8)
    glare_ratio = float(np.mean(glare_mask))

    # Method 3: Vertical reflection lines (common in penny sleeves)
    # Look for vertical bright lines that span most of the height
    gray_blur = cv2.GaussianBlur(gray, (3, 3), 0)
    grad_x = cv2.Sobel(gray_blur, cv2.CV_64F, 1, 0, ksize=3)
    grad_x = np.abs(grad_x)

    # Find strong vertical gradients
    vertical_lines = (grad_x > np.percentile(grad_x, 98)).astype(np.uint8)
    vertical_line_ratio = float(np.mean(vertical_lines))

    # Method 4: Color consistency check
    # Sleeves often add slight color cast or reduce color variation
    lab = to_lab(img_bgr)
    color_std = float(np.std(lab[:, :, 1:]))  # a and b channels

    # Decision logic with multiple indicators
    # UPDATED THRESHOLDS (2025-10-17) - Based on real-world testing
    #
    # KEY INSIGHT: Natural card glare (15-19%) is DIFFERENT from sleeve glare
    # - Raw cards: 15-19% glare from card surface (NOT a sleeve)
    # - Penny sleeves: Either LOW glare (0.5-12%) OR HIGH glare (20-35%)
    # - Top loaders: Very high glare (35-65%)
    # - Slabs: Extreme glare (>50%)
    #
    # Penny Sleeve indicators:
    # - Moderate edge density (0.015-0.045) - tightened minimum
    # - LOW glare (0.5-12%) OR HIGH glare (20-35%) - split range to exclude natural card glare
    # - Vertical reflection lines (common in glossy sleeves)
    # - Normal color variation (sleeves don't dampen much)
    #
    # Top Loader indicators:
    # - Higher edge density (>0.03)
    # - Very high glare (35-65%)
    # - More color dampening
    #
    # Slab indicators:
    # - Very high edge density (>0.06)
    # - Extreme glare (>50%)
    # - Significant color dampening

    sleeve_score = 0
    # Edge detection: Tightened minimum to 0.015 (was 0.01) to filter out natural card edges
    if 0.015 < double_edge_ratio < 0.045:  # Penny sleeves have moderate edges
        sleeve_score += 2

    # Glare detection: SPLIT RANGE to exclude natural card glare (15-19%)
    # Low glare sleeves (matte/semi-gloss): 0.5-12%
    # High glare sleeves (glossy): 20-35%
    if (0.005 < glare_ratio < 0.12) or (0.20 < glare_ratio < 0.35):
        sleeve_score += 3

    # Vertical reflection lines (common in penny sleeves)
    if vertical_line_ratio > 0.015:  # Raised from 0.01 to 0.015
        sleeve_score += 1

    # Color consistency - sleeves don't dampen color much
    if 15.0 < color_std < 45:  # Adjusted range
        sleeve_score += 1

    # Top Loader indicators (thicker plastic, more rigid):
    toploader_score = 0
    if double_edge_ratio > 0.03:  # Thicker edges (raised from 0.025)
        toploader_score += 2
    if 0.35 < glare_ratio < 0.65:  # Very high glare (35-65%)
        toploader_score += 3
    if vertical_line_ratio > 0.015:
        toploader_score += 1
    if color_std < 20:  # More color dampening
        toploader_score += 1

    # Slab indicators (very thick plastic, professional casing):
    slab_score = 0
    if double_edge_ratio > 0.06:  # Very thick edges (raised from 0.05)
        slab_score += 2
    if glare_ratio > 0.50:  # Extreme glare (>50%)
        slab_score += 3
    if color_std < 12:  # Significant color dampening
        slab_score += 2

    # Decision thresholds - RAISED to 5/7 to reduce false positives
    sleeve = sleeve_score >= 5  # RAISED from 4 to 5 - requires stronger evidence
    top_loader = toploader_score >= 5  # Requires strong evidence
    slab = slab_score >= 5  # Requires strong evidence

    # Override logic: If multiple indicators match, choose the most specific
    if sleeve and (top_loader or slab):
        # If glare is in penny sleeve range, prefer penny sleeve
        if glare_ratio < 0.35:
            top_loader = False
            slab = False

    print(f"[OpenCV Sleeve Detection] Scores: sleeve={sleeve_score}, toploader={toploader_score}, slab={slab_score}")
    print(f"[OpenCV Sleeve Detection] Indicators: edge_ratio={double_edge_ratio:.3f}, glare={glare_ratio:.3f}, v_lines={vertical_line_ratio:.3f}, color_std={color_std:.1f}")
    print(f"[OpenCV Sleeve Detection] Result: sleeve={sleeve}, top_loader={top_loader}, slab={slab}")

    return sleeve, top_loader, slab


# -----------------------------
# Centering measurement
# -----------------------------

def measure_centering(img_bgr: np.ndarray, mask: np.ndarray, border_sample_width: int = 24, gradient_threshold: float = 10.0) -> CenteringMetrics:
    """
    Measure card centering using border detection with validation.

    Strategy:
    1. Scan for gradients (border → design transitions)
    2. Validate detected borders (must be 2-15mm range)
    3. Count sides with clear borders
    4. Determine method and confidence

    Returns:
        CenteringMetrics with method_used, confidence, and validation_notes
    """
    h, w = img_bgr.shape[:2]
    lab = to_lab(img_bgr)

    # Assume standard card height of ~88.9mm for pixel-to-mm conversion
    pixels_per_mm = h / 88.9  # Approximate

    def border_thickness_along_axis(axis: str) -> Tuple[float, float, float]:
        # Returns (mean_thickness_side1, mean_thickness_side2, max_gradient_strength)
        if axis == "lr":
            # left and right
            left_thicks = []
            right_thicks = []
            left_gradients = []
            right_gradients = []

            for y in range(border_sample_width, h - border_sample_width, max(8, h // 48)):
                # left scan
                left_line = lab[y, :, 0]
                grad = np.abs(np.gradient(left_line.astype(np.float32)))
                end = max(5, int(0.25 * w))
                idx = int(np.argmax(grad[:end]))
                left_thicks.append(float(idx))
                left_gradients.append(float(grad[idx]) if idx < len(grad) else 0.0)

                # right scan
                right_line = lab[y, :, 0]
                grad_r = np.abs(np.gradient(right_line.astype(np.float32)))
                start = int(0.75 * w)
                idx_r = int(np.argmax(grad_r[start:])) + start
                right_thicks.append(float(w - 1 - idx_r))
                right_gradients.append(float(grad_r[idx_r]) if idx_r < len(grad_r) else 0.0)

            left_mean = float(np.mean(left_thicks))
            right_mean = float(np.mean(right_thicks))
            max_grad = max(float(np.mean(left_gradients)), float(np.mean(right_gradients)))
            return left_mean, right_mean, max_grad
        else:
            # top and bottom
            top_thicks = []
            bottom_thicks = []
            top_gradients = []
            bottom_gradients = []

            for x in range(border_sample_width, w - border_sample_width, max(8, w // 48)):
                column = lab[:, x, 0]
                grad = np.abs(np.gradient(column.astype(np.float32)))
                end = max(5, int(0.25 * h))
                idx = int(np.argmax(grad[:end]))
                top_thicks.append(float(idx))
                top_gradients.append(float(grad[idx]) if idx < len(grad) else 0.0)

                grad_b = np.abs(np.gradient(column.astype(np.float32)))
                start = int(0.75 * h)
                idx_b = int(np.argmax(grad_b[start:])) + start
                bottom_thicks.append(float(h - 1 - idx_b))
                bottom_gradients.append(float(grad_b[idx_b]) if idx_b < len(grad_b) else 0.0)

            top_mean = float(np.mean(top_thicks))
            bottom_mean = float(np.mean(bottom_thicks))
            max_grad = max(float(np.mean(top_gradients)), float(np.mean(bottom_gradients)))
            return top_mean, bottom_mean, max_grad

    left_mean, right_mean, lr_gradient = border_thickness_along_axis("lr")
    top_mean, bottom_mean, tb_gradient = border_thickness_along_axis("tb")

    # Convert to mm for validation
    left_mm = left_mean / pixels_per_mm
    right_mm = right_mean / pixels_per_mm
    top_mm = top_mean / pixels_per_mm
    bottom_mm = bottom_mean / pixels_per_mm

    # Validate borders (should be 2-15mm for typical cards)
    MIN_BORDER_MM = 2.0
    MAX_BORDER_MM = 15.0

    sides_valid = []
    validation_details = []

    # Check left
    if MIN_BORDER_MM <= left_mm <= MAX_BORDER_MM and lr_gradient >= gradient_threshold:
        sides_valid.append("left")
    else:
        validation_details.append(f"Left: {left_mm:.1f}mm, grad {lr_gradient:.1f} (suspect)")

    # Check right
    if MIN_BORDER_MM <= right_mm <= MAX_BORDER_MM and lr_gradient >= gradient_threshold:
        sides_valid.append("right")
    else:
        validation_details.append(f"Right: {right_mm:.1f}mm, grad {lr_gradient:.1f} (suspect)")

    # Check top
    if MIN_BORDER_MM <= top_mm <= MAX_BORDER_MM and tb_gradient >= gradient_threshold:
        sides_valid.append("top")
    else:
        validation_details.append(f"Top: {top_mm:.1f}mm, grad {tb_gradient:.1f} (suspect)")

    # Check bottom
    if MIN_BORDER_MM <= bottom_mm <= MAX_BORDER_MM and tb_gradient >= gradient_threshold:
        sides_valid.append("bottom")
    else:
        validation_details.append(f"Bottom: {bottom_mm:.1f}mm, grad {tb_gradient:.1f} (suspect)")

    # Determine method and confidence based on validation
    valid_count = len(sides_valid)

    if valid_count >= 4:
        method = "border-present"
        confidence = "high"
        notes = f"Clear borders detected on all 4 sides. L={left_mm:.1f}mm R={right_mm:.1f}mm T={top_mm:.1f}mm B={bottom_mm:.1f}mm"
    elif valid_count == 3:
        method = "border-present"
        confidence = "medium"
        notes = f"Borders detected on 3 sides: {', '.join(sides_valid)}. {' '.join(validation_details)}"
    elif valid_count >= 2:
        method = "border-present"
        confidence = "low"
        notes = f"Borders detected on {valid_count} sides: {', '.join(sides_valid)}. {' '.join(validation_details)}"
    else:
        method = "design-anchor-required"
        confidence = "low"
        notes = f"Insufficient border detection ({valid_count}/4 sides). Card may be borderless/full-bleed. {' '.join(validation_details)}"

    # Ratios as percent
    lr_sum = left_mean + right_mean + 1e-6
    tb_sum = top_mean + bottom_mean + 1e-6
    lr_ratio = (float(100.0 * left_mean / lr_sum), float(100.0 * right_mean / lr_sum))
    tb_ratio = (float(100.0 * top_mean / tb_sum), float(100.0 * bottom_mean / tb_sum))

    return CenteringMetrics(
        lr_ratio=lr_ratio,
        tb_ratio=tb_ratio,
        left_border_mean_px=left_mean,
        right_border_mean_px=right_mean,
        top_border_mean_px=top_mean,
        bottom_border_mean_px=bottom_mean,
        method_used=method,
        confidence=confidence,
        validation_notes=notes
    )


# -----------------------------
# Edge whitening and corner analysis
# -----------------------------

def delta_e_lab(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    # Simple ΔE 1976
    return np.sqrt(np.sum((lab1.astype(np.float32) - lab2.astype(np.float32)) ** 2, axis=2))


def sample_edge_strips(img_bgr: np.ndarray, strip_width: int = 8) -> Dict[str, np.ndarray]:
    h, w = img_bgr.shape[:2]
    strips = {
        "top": img_bgr[0:strip_width, :, :],
        "bottom": img_bgr[h - strip_width:h, :, :],
        "left": img_bgr[:, 0:strip_width, :],
        "right": img_bgr[:, w - strip_width:w, :],
    }
    return strips


def detect_edge_whitening(img_bgr: np.ndarray, strip_width: int = 8, segment_splits: int = 3, delta_e_thresh: float = 8.0) -> Dict[str, List[EdgeSegmentMetrics]]:
    h, w = img_bgr.shape[:2]
    strips = sample_edge_strips(img_bgr, strip_width=strip_width)

    results: Dict[str, List[EdgeSegmentMetrics]] = {"top": [], "right": [], "bottom": [], "left": []}
    for side, strip in strips.items():
        side_len = strip.shape[1] if side in ("top", "bottom") else strip.shape[0]
        seg_len = side_len // segment_splits if segment_splits > 0 else side_len
        for i in range(segment_splits):
            if side in ("top", "bottom"):
                x0 = i * seg_len
                x1 = side_len if i == segment_splits - 1 else (i + 1) * seg_len
                if side == "top":
                    roi = img_bgr[0:strip_width, x0:x1]
                    adj = img_bgr[strip_width:strip_width * 2, x0:x1]
                else:
                    roi = img_bgr[h - strip_width:h, x0:x1]
                    adj = img_bgr[h - 2 * strip_width:h - strip_width, x0:x1]
            else:
                y0 = i * seg_len
                y1 = side_len if i == segment_splits - 1 else (i + 1) * seg_len
                if side == "left":
                    roi = img_bgr[y0:y1, 0:strip_width]
                    adj = img_bgr[y0:y1, strip_width:2 * strip_width]
                else:
                    roi = img_bgr[y0:y1, w - strip_width:w]
                    adj = img_bgr[y0:y1, w - 2 * strip_width:w - strip_width]

            roi_lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB)
            adj_lab = cv2.cvtColor(adj, cv2.COLOR_BGR2LAB)

            de = delta_e_lab(roi_lab, adj_lab)
            whitening_mask = (de > delta_e_thresh).astype(np.uint8)
            whitening_length_px = float(np.sum(whitening_mask > 0) / max(1, whitening_mask.shape[0]))

            chips_mask = cv2.morphologyEx(whitening_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
            chips_count, _ = cv2.connectedComponents(chips_mask)

            gray = to_gray(roi)
            _, thr = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
            dots_count, _ = cv2.connectedComponents(thr)

            results[side].append(EdgeSegmentMetrics(
                segment_name=f"{side}_{i+1}",
                whitening_length_px=float(whitening_length_px),
                whitening_count=int(np.sum(whitening_mask)),
                chips_count=max(0, chips_count - 1),
                white_dots_count=max(0, dots_count - 1)
            ))

    return results


def analyze_corners(img_bgr: np.ndarray, patch_size: int = 80, delta_e_thresh: float = 8.0) -> List[CornerMetrics]:
    h, w = img_bgr.shape[:2]
    corners = {
        "tl": img_bgr[0:patch_size, 0:patch_size],
        "tr": img_bgr[0:patch_size, w - patch_size:w],
        "bl": img_bgr[h - patch_size:h, 0:patch_size],
        "br": img_bgr[h - patch_size:h, w - patch_size:w],
    }

    out: List[CornerMetrics] = []
    for name, patch in corners.items():
        gray = to_gray(patch)
        edges = cv2.Canny(gray, 50, 150)
        ys, xs = np.where(edges > 0)
        if len(xs) > 10:
            pts = np.vstack([xs, ys]).T.astype(np.float32)
            (cx, cy), radius = cv2.minEnclosingCircle(pts)
            rounding = float(radius)
        else:
            rounding = 0.0

        lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
        center = lab[patch_size // 4: 3 * patch_size // 4, patch_size // 4: 3 * patch_size // 4]
        border = lab
        center_resized = cv2.resize(center, (border.shape[1], border.shape[0]), interpolation=cv2.INTER_LINEAR)
        de = delta_e_lab(border, center_resized)
        whitening_mask = (de > delta_e_thresh).astype(np.uint8)
        whitening_length_px = float(np.sum(whitening_mask))

        dots = cv2.inRange(to_gray(patch), 240, 255)
        dots_count, _ = cv2.connectedComponents(dots)

        out.append(CornerMetrics(
            corner_name=name,
            rounding_radius_px=rounding,
            whitening_length_px=whitening_length_px,
            white_dots_count=max(0, int(dots_count) - 1)
        ))
    return out


# -----------------------------
# Surface analysis
# -----------------------------

def detect_white_dots_surface(img_bgr: np.ndarray, min_area: int = 3, max_area: int = 200) -> int:
    gray = to_gray(img_bgr)
    _, thr = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)
    thr = cv2.morphologyEx(thr, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thr, connectivity=8)
    count = 0
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if min_area <= area <= max_area:
            count += 1
    return int(count)


def detect_scratches(img_bgr: np.ndarray, low_thresh: int = 40, high_thresh: int = 100, min_len_px: int = 40) -> int:
    gray = to_gray(img_bgr)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(gray, low_thresh, high_thresh)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180.0, threshold=50, minLineLength=min_len_px, maxLineGap=8)
    if lines is None:
        return 0
    return int(len(lines))


def detect_crease_like(img_bgr: np.ndarray, min_len_px: int = 60) -> int:
    gray = to_gray(img_bgr)
    scharrx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    scharry = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = cv2.magnitude(scharrx, scharry)
    mag = (mag / (mag.max() + 1e-6) * 255).astype(np.uint8)
    _, thr = cv2.threshold(mag, 30, 255, cv2.THRESH_BINARY)
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    long_count = 0
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if max(w, h) >= min_len_px:
            long_count += 1
    return int(long_count)


def compute_surface_metrics(img_bgr: np.ndarray, glare_mask: np.ndarray) -> SurfaceMetrics:
    h, w = img_bgr.shape[:2]
    focus = variance_of_laplacian(to_gray(img_bgr))
    light_score = brightness_uniformity(to_gray(img_bgr))
    dots = detect_white_dots_surface(img_bgr)
    scratches = detect_scratches(img_bgr)
    creases = detect_crease_like(img_bgr)
    glare_percent = float(100.0 * np.sum(glare_mask > 0) / float(h * w))
    bias = color_bias_bgr(img_bgr)
    return SurfaceMetrics(
        white_dots_count=dots,
        scratch_count=scratches,
        crease_like_count=creases,
        glare_coverage_percent=glare_percent,
        focus_variance=focus,
        lighting_uniformity_score=light_score,
        color_bias_bgr=bias
    )


# -----------------------------
# Visualization helpers
# -----------------------------

def draw_overlays(img_bgr: np.ndarray,
                  edges_metrics: Dict[str, List[EdgeSegmentMetrics]],
                  corners: List[CornerMetrics],
                  glare_mask: np.ndarray) -> np.ndarray:
    vis = img_bgr.copy()
    h, w = vis.shape[:2]

    # Draw glare mask in semi-transparent white
    mask_rgb = cv2.cvtColor(glare_mask, cv2.COLOR_GRAY2BGR)
    vis = cv2.addWeighted(vis, 1.0, mask_rgb, 0.25, 0)

    # Segment separators
    seg_color = (0, 255, 255)
    thickness = 1

    for side, segs in edges_metrics.items():
        n = len(segs)
        if n <= 0:
            continue
        if side in ("top", "bottom"):
            side_len = w
            seg_len = side_len // n if n > 0 else side_len
            y = 2 if side == "top" else (h - 2)
            for i in range(n):
                x0 = i * seg_len
                x1 = w if i == n - 1 else (i + 1) * seg_len
                cv2.line(vis, (x0, y), (x1, y), seg_color, thickness)
        else:
            side_len = h
            seg_len = side_len // n if n > 0 else side_len
            x = 2 if side == "left" else (w - 2)
            for i in range(n):
                y0 = i * seg_len
                y1 = h if i == n - 1 else (i + 1) * seg_len
                cv2.line(vis, (x, y0), (x, y1), seg_color, thickness)

    # Corner marks
    for c in corners:
        if c.corner_name == "tl":
            pt = (10, 20)
        elif c.corner_name == "tr":
            pt = (w - 220, 20)
        elif c.corner_name == "bl":
            pt = (10, h - 10)
        else:
            pt = (w - 220, h - 10)
        txt = f"r={c.rounding_radius_px:.1f}px w={c.whitening_length_px:.0f} d={c.white_dots_count}"
        cv2.putText(vis, txt, pt, cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1, cv2.LINE_AA)

    return vis


# -----------------------------
# Side analysis wrapper
# -----------------------------

def analyze_side(image_path: str, outdir: str, side_label: str) -> SideMetrics:
    img = imread_color(image_path)
    img = resize_max_dim(img, 2200)

    # Apply illumination and color normalization for better edge detection
    img_normalized = normalize_color_and_illum(img)

    # Detect sleeve BEFORE boundary detection (use normalized image)
    print(f"[OpenCV] Pre-detecting sleeve for {side_label}...")
    sleeve_pre, top_loader_pre, slab_pre = detect_sleeve_like_features(img_normalized)
    sleeve_detected = sleeve_pre or top_loader_pre
    slab_detected = slab_pre

    # Now detect boundaries with profile-aware fusion detection (use normalized image)
    quad, detection_metadata = detect_card_quadrilateral(
        img_normalized,
        sleeve_detected=sleeve_detected,
        slab_detected=slab_detected
    )
    obstructions = []
    debug_assets = {}

    if quad is None:
        warped = img.copy()
        mask = np.ones(warped.shape[:2], dtype=np.uint8) * 255
        obstructions.append({"zone": "full", "type": "no_quad_detected", "action": "fallback_full_image"})
        boundary_detected = False
    else:
        warped, mask = warp_to_rect(img, quad, target_height=1600)
        boundary_detected = True

    glare_mask = detect_glare_mask(warped)
    # Re-check sleeve on warped image for final determination
    sleeve, top_loader, slab = detect_sleeve_like_features(warped)

    centering = measure_centering(warped, mask)

    # Mark centering as unreliable if boundary detection failed
    if not boundary_detected:
        centering.confidence = "unreliable"
        centering.fallback_mode = True
        centering.validation_notes += " | WARNING: Measuring full image, not card boundaries - OpenCV centering unreliable"
        print(f"[OpenCV Centering] WARNING: Boundary detection failed for {side_label} - centering measurements are from full image, not card boundaries")
    edge_metrics = detect_edge_whitening(warped)
    corner_metrics = analyze_corners(warped)
    surface_metrics = compute_surface_metrics(warped, glare_mask)

    overlay = draw_overlays(warped, edge_metrics, corner_metrics, glare_mask)

    ensure_outdir(outdir)
    norm_path = os.path.join(outdir, f"{side_label}_normalized.png")
    glare_path = os.path.join(outdir, f"{side_label}_glare_mask.png")
    overlay_path = os.path.join(outdir, f"{side_label}_overlay.png")
    mask_path = os.path.join(outdir, f"{side_label}_card_mask.png")

    cv2.imwrite(norm_path, warped)
    cv2.imwrite(glare_path, glare_mask)
    cv2.imwrite(overlay_path, overlay)
    cv2.imwrite(mask_path, mask)

    debug_assets.update({
        "normalized_image": norm_path,
        "glare_mask": glare_path,
        "overlay": overlay_path,
        "card_mask": mask_path
    })

    return SideMetrics(
        side_label=side_label,
        width=int(warped.shape[1]),
        height=int(warped.shape[0]),
        centering=centering,
        edge_segments=edge_metrics,
        corners=corner_metrics,
        surface=surface_metrics,
        sleeve_indicator=bool(sleeve),
        top_loader_indicator=bool(top_loader),
        slab_indicator=bool(slab),
        glare_mask_percent=surface_metrics.glare_coverage_percent,
        obstructions=obstructions,
        debug_assets=debug_assets,
        detection_metadata=detection_metadata
    )


# -----------------------------
# CLI and main
# -----------------------------

def run_cli(front_path: Optional[str], back_path: Optional[str], outdir: str) -> CombinedMetrics:
    ensure_outdir(outdir)
    run_id = str(uuid.uuid4())

    front_metrics = analyze_side(front_path, outdir, "front") if front_path else None
    back_metrics = analyze_side(back_path, outdir, "back") if back_path else None

    combined = CombinedMetrics(front=front_metrics, back=back_metrics, run_id=run_id)

    json_path = os.path.join(outdir, "stage1_metrics.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(serialize_combined_metrics(combined), f, indent=2)

    print(f"Saved Stage 1 metrics to: {json_path}")
    return combined


def serialize_combined_metrics(data: CombinedMetrics) -> Dict:
    def edge_to_dict(d: Dict[str, List[EdgeSegmentMetrics]]) -> Dict[str, List[Dict]]:
        return {k: [asdict(seg) for seg in v] for k, v in d.items()}

    def side_to_dict(s: SideMetrics) -> Dict:
        return {
            "side_label": s.side_label,
            "width": s.width,
            "height": s.height,
            "centering": asdict(s.centering),
            "edge_segments": edge_to_dict(s.edge_segments),
            "corners": [asdict(c) for c in s.corners],
            "surface": asdict(s.surface),
            "sleeve_indicator": s.sleeve_indicator,
            "top_loader_indicator": s.top_loader_indicator,
            "slab_indicator": s.slab_indicator,
            "glare_mask_percent": s.glare_mask_percent,
            "obstructions": s.obstructions,
            "debug_assets": s.debug_assets
        }

    return {
        "version": data.version,
        "run_id": data.run_id,
        "front": side_to_dict(data.front) if data.front else None,
        "back": side_to_dict(data.back) if data.back else None
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage 1 Card Observation and Analysis using OpenCV.")
    parser.add_argument("--front", type=str, default="", help="Path to the front image")
    parser.add_argument("--back", type=str, default="", help="Path to the back image")
    parser.add_argument("--outdir", type=str, default="./out", help="Output directory for metrics and visualizations")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    front = args.front if args.front else None
    back = args.back if args.back else None
    run_cli(front, back, args.outdir)


if __name__ == "__main__":
    main()
