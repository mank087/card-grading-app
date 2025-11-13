#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Card Observation and Analysis - Stage 1 (OpenCV with Grading Criteria)
================================================================================

This enhanced version integrates professional grading criteria from Phase 1
instructions, providing severity classification (microscopic/minor/moderate/heavy)
and precise measurements aligned with the 1.0-10.0 grading scale.

Key Enhancements:
- Severity classification using mm measurements
- Defect detection aligned with Phase 1 definitions
- Cross-side verification support for structural damage
- Comprehensive defect reporting with grade impact

Author: Claude Code for Doug at Manicz Media
Version: 2.0 (Enhanced with Grading Criteria)
Date: 2025-10-17
"""

import os
import json
import math
import argparse
import uuid
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Tuple, Optional

import numpy as np

try:
    import cv2
except Exception as e:
    raise SystemExit("OpenCV (cv2) is required. Install: pip install opencv-python")

# Import grading criteria
try:
    from grading_criteria import (
        DefectSeverity, classify_defect_severity, pixels_to_mm, mm_to_pixels,
        DELTA_E_THRESHOLDS, EDGE_THRESHOLDS, CORNER_THRESHOLDS,
        SURFACE_THRESHOLDS, GLARE_THRESHOLDS, SEVERITY_THRESHOLDS,
        get_max_grade_for_defect, is_structural_damage, GRADING_CONFIG
    )
except ImportError:
    raise SystemExit("grading_criteria.py not found. Ensure it's in the same directory.")


# =============================================================================
# Enhanced Data Classes with Severity Classification
# =============================================================================

@dataclass
class DefectMeasurement:
    """Detailed defect measurement with severity classification."""
    size_px: float
    size_mm: float
    severity: str  # microscopic, minor, moderate, heavy
    max_grade_impact: float
    location: str
    description: str


@dataclass
class EdgeSegmentMetricsEnhanced:
    segment_name: str
    whitening_length_px: float
    whitening_length_mm: float
    whitening_severity: str
    whitening_count: int
    chips_count: int
    chips_severity: str
    white_dots_count: int
    defects: List[DefectMeasurement] = field(default_factory=list)


@dataclass
class CornerMetricsEnhanced:
    corner_name: str
    rounding_radius_px: float
    rounding_radius_mm: float
    rounding_severity: str
    whitening_length_px: float
    whitening_length_mm: float
    whitening_severity: str
    white_dots_count: int
    defects: List[DefectMeasurement] = field(default_factory=list)
    structural_damage: bool = False


@dataclass
class SurfaceMetricsEnhanced:
    white_dots_count: int
    white_dots_severity: str
    scratch_count: int
    scratch_details: List[DefectMeasurement]
    crease_like_count: int
    crease_indicators: List[str]
    glare_coverage_percent: float
    focus_variance: float
    lighting_uniformity_score: float
    color_bias_bgr: Tuple[float, float, float]
    structural_damage_suspected: bool = False


@dataclass
class CenteringMetrics:
    lr_ratio: Tuple[float, float]
    tb_ratio: Tuple[float, float]
    left_border_mean_px: float
    right_border_mean_px: float
    top_border_mean_px: float
    bottom_border_mean_px: float
    centering_defects: List[str] = field(default_factory=list)


@dataclass
class SideMetricsEnhanced:
    side_label: str
    width: int
    height: int
    pixels_per_mm: float
    centering: CenteringMetrics
    edge_segments: Dict[str, List[EdgeSegmentMetricsEnhanced]]
    corners: List[CornerMetricsEnhanced]
    surface: SurfaceMetricsEnhanced
    sleeve_indicator: bool
    top_loader_indicator: bool
    slab_indicator: bool
    glare_mask_percent: float
    obstructions: List[Dict[str, str]]
    debug_assets: Dict[str, str]
    estimated_max_grade: float = 10.0
    grade_limiting_defects: List[str] = field(default_factory=list)


@dataclass
class CombinedMetricsEnhanced:
    front: Optional[SideMetricsEnhanced]
    back: Optional[SideMetricsEnhanced]
    cross_side_verification: Dict[str, any] = field(default_factory=dict)
    version: str = "stage1_opencv_v2.0_enhanced"
    grading_criteria_version: str = GRADING_CONFIG["version"]
    run_id: str = ""


# =============================================================================
# Core Utilities
# =============================================================================

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
    std = float(np.std(means) + 1e-6)
    score = 1.0 / (1.0 + std / 20.0)
    return float(np.clip(score, 0.0, 1.0))


def color_bias_bgr(img_bgr: np.ndarray) -> Tuple[float, float, float]:
    b_mean = float(np.mean(img_bgr[:, :, 0]))
    g_mean = float(np.mean(img_bgr[:, :, 1]))
    r_mean = float(np.mean(img_bgr[:, :, 2]))
    return (b_mean, g_mean, r_mean)


# =============================================================================
# Card Detection and Normalization
# =============================================================================

def detect_card_quadrilateral(img_bgr: np.ndarray) -> Optional[np.ndarray]:
    img_small = resize_max_dim(img_bgr, 1200)
    ratio = img_bgr.shape[1] / img_small.shape[1]
    gray = to_gray(img_small)
    gray = auto_contrast(gray)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

    best_quad = None
    best_area = 0.0

    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > best_area:
                best_area = area
                best_quad = approx

    if best_quad is None:
        return None

    quad = best_quad.reshape(4, 2).astype(np.float32) * ratio
    return order_quad_points(quad)


def order_quad_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def warp_to_rect(img_bgr: np.ndarray, quad: np.ndarray, target_height: int = 1500) -> Tuple[np.ndarray, np.ndarray]:
    (tl, tr, br, bl) = quad
    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = int(max(widthA, widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = int(max(heightA, heightB))

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


# =============================================================================
# Glare and Sleeve Detection
# =============================================================================

def detect_glare_mask(img_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    glare = ((s < GLARE_THRESHOLDS["saturation_max"]) &
             (v > GLARE_THRESHOLDS["value_min"])).astype(np.uint8) * 255
    glare = cv2.morphologyEx(glare, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    glare = cv2.dilate(glare, np.ones((3, 3), np.uint8), iterations=1)
    return glare


def detect_sleeve_like_features(img_bgr: np.ndarray) -> Tuple[bool, bool, bool]:
    gray = to_gray(img_bgr)
    edges = cv2.Canny(gray, 80, 160)
    h, w = gray.shape[:2]

    border_band = 10
    edge_border = np.zeros_like(edges)
    edge_border[:, :border_band] = edges[:, :border_band]
    edge_border[:, -border_band:] = np.maximum(edge_border[:, -border_band:], edges[:, -border_band:])
    edge_border[:border_band, :] = np.maximum(edge_border[:border_band, :], edges[:border_band, :])
    edge_border[-border_band:, :] = np.maximum(edge_border[-border_band:, :], edges[-border_band:, :])

    double_edge_ratio = float(np.mean(edge_border > 0))
    contrast = float(np.std(gray))

    sleeve = (double_edge_ratio > GLARE_THRESHOLDS["sleeve_edge_ratio"] and
              contrast < GLARE_THRESHOLDS["sleeve_contrast_max"])
    top_loader = (double_edge_ratio > GLARE_THRESHOLDS["toploader_edge_ratio"] and
                  contrast < 52.0)
    slab = (double_edge_ratio > GLARE_THRESHOLDS["slab_edge_ratio"] and
            contrast < 50.0)
    return sleeve, top_loader, slab


# =============================================================================
# Enhanced Centering with Defect Detection
# =============================================================================

def measure_centering_enhanced(img_bgr: np.ndarray, mask: np.ndarray,
                                pixels_per_mm: float) -> CenteringMetrics:
    h, w = img_bgr.shape[:2]
    lab = to_lab(img_bgr)
    border_sample_width = 24

    def border_thickness_along_axis(axis: str) -> Tuple[float, float]:
        if axis == "lr":
            left_thicks = []
            right_thicks = []
            for y in range(border_sample_width, h - border_sample_width, max(8, h // 48)):
                left_line = lab[y, :, 0]
                grad = np.abs(np.gradient(left_line.astype(np.float32)))
                end = max(5, int(0.25 * w))
                idx = np.argmax(grad[:end])
                left_thicks.append(float(idx))

                right_line = lab[y, :, 0]
                grad_r = np.abs(np.gradient(right_line.astype(np.float32)))
                start = int(0.75 * w)
                idx_r = np.argmax(grad_r[start:]) + start
                right_thicks.append(float(w - 1 - idx_r))
            left_mean = float(np.mean(left_thicks))
            right_mean = float(np.mean(right_thicks))
            return left_mean, right_mean
        else:
            top_thicks = []
            bottom_thicks = []
            for x in range(border_sample_width, w - border_sample_width, max(8, w // 48)):
                column = lab[:, x, 0]
                grad = np.abs(np.gradient(column.astype(np.float32)))
                end = max(5, int(0.25 * h))
                idx = np.argmax(grad[:end])
                top_thicks.append(float(idx))

                grad_b = np.abs(np.gradient(column.astype(np.float32)))
                start = int(0.75 * h)
                idx_b = np.argmax(grad_b[start:]) + start
                bottom_thicks.append(float(h - 1 - idx_b))
            top_mean = float(np.mean(top_thicks))
            bottom_mean = float(np.mean(bottom_thicks))
            return top_mean, bottom_mean

    left_mean, right_mean = border_thickness_along_axis("lr")
    top_mean, bottom_mean = border_thickness_along_axis("tb")

    lr_sum = left_mean + right_mean + 1e-6
    tb_sum = top_mean + bottom_mean + 1e-6
    lr_ratio = (float(100.0 * left_mean / lr_sum), float(100.0 * right_mean / lr_sum))
    tb_ratio = (float(100.0 * top_mean / tb_sum), float(100.0 * bottom_mean / tb_sum))

    # Detect centering defects
    centering_defects = []

    # Off-cut borders: L/R or T/B differ by >15%
    lr_diff_percent = abs(lr_ratio[0] - lr_ratio[1])
    tb_diff_percent = abs(tb_ratio[0] - tb_ratio[1])
    if lr_diff_percent > 15 or tb_diff_percent > 15:
        centering_defects.append("off_cut_borders")

    # Tilted print detection (simplified - would need more sophisticated analysis)
    # This is a placeholder for more complex geometric analysis

    return CenteringMetrics(
        lr_ratio=lr_ratio,
        tb_ratio=tb_ratio,
        left_border_mean_px=left_mean,
        right_border_mean_px=right_mean,
        top_border_mean_px=top_mean,
        bottom_border_mean_px=bottom_mean,
        centering_defects=centering_defects,
    )


# =============================================================================
# Enhanced Edge Analysis with Severity Classification
# =============================================================================

def delta_e_lab(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    return np.sqrt(np.sum((lab1.astype(np.float32) - lab2.astype(np.float32)) ** 2, axis=2))


def detect_edge_whitening_enhanced(img_bgr: np.ndarray, pixels_per_mm: float) -> Dict[str, List[EdgeSegmentMetricsEnhanced]]:
    h, w = img_bgr.shape[:2]
    strip_width = EDGE_THRESHOLDS["strip_width_px"]
    segment_splits = EDGE_THRESHOLDS["segment_splits"]

    strips = {
        "top": img_bgr[0:strip_width, :, :],
        "bottom": img_bgr[h - strip_width:h, :, :],
        "left": img_bgr[:, 0:strip_width, :],
        "right": img_bgr[:, w - strip_width:w, :],
    }

    results: Dict[str, List[EdgeSegmentMetricsEnhanced]] = {
        "top": [], "right": [], "bottom": [], "left": []
    }

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
            whitening_mask = (de > DELTA_E_THRESHOLDS["whitening"]).astype(np.uint8)
            whitening_length_px = float(np.sum(whitening_mask > 0) / max(1, whitening_mask.shape[0]))
            whitening_length_mm = pixels_to_mm(whitening_length_px, h)

            # Classify whitening severity
            whitening_severity = classify_defect_severity(whitening_length_mm).value

            chips_mask = cv2.morphologyEx(whitening_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
            chips_count, _ = cv2.connectedComponents(chips_mask)

            # Classify chipping severity based on count and size
            total_chip_area_mm = pixels_to_mm(np.sum(chips_mask), h)
            chips_severity = classify_defect_severity(total_chip_area_mm).value

            gray = to_gray(roi)
            _, thr = cv2.threshold(gray, SURFACE_THRESHOLDS["white_dot_threshold"], 255, cv2.THRESH_BINARY)
            dots_count, _ = cv2.connectedComponents(thr)

            # Create detailed defect list
            defects = []
            if whitening_length_mm > 0.05:
                defects.append(DefectMeasurement(
                    size_px=whitening_length_px,
                    size_mm=whitening_length_mm,
                    severity=whitening_severity,
                    max_grade_impact=get_max_grade_for_defect("whitening", classify_defect_severity(whitening_length_mm)),
                    location=f"{side}_{i+1}",
                    description=f"Edge whitening: {whitening_length_mm:.2f}mm ({whitening_severity})"
                ))

            results[side].append(EdgeSegmentMetricsEnhanced(
                segment_name=f"{side}_{i+1}",
                whitening_length_px=float(whitening_length_px),
                whitening_length_mm=float(whitening_length_mm),
                whitening_severity=whitening_severity,
                whitening_count=int(np.sum(whitening_mask)),
                chips_count=max(0, chips_count - 1),
                chips_severity=chips_severity,
                white_dots_count=max(0, dots_count - 1),
                defects=defects
            ))

    return results


# =============================================================================
# Enhanced Corner Analysis
# =============================================================================

def analyze_corners_enhanced(img_bgr: np.ndarray, pixels_per_mm: float) -> List[CornerMetricsEnhanced]:
    h, w = img_bgr.shape[:2]
    patch_size = CORNER_THRESHOLDS["patch_size_px"]

    corners = {
        "tl": img_bgr[0:patch_size, 0:patch_size],
        "tr": img_bgr[0:patch_size, w - patch_size:w],
        "bl": img_bgr[h - patch_size:h, 0:patch_size],
        "br": img_bgr[h - patch_size:h, w - patch_size:w],
    }

    out: List[CornerMetricsEnhanced] = []

    for name, patch in corners.items():
        gray = to_gray(patch)
        edges = cv2.Canny(gray, 50, 150)
        ys, xs = np.where(edges > 0)

        if len(xs) > 10:
            pts = np.vstack([xs, ys]).T.astype(np.float32)
            (cx, cy), radius = cv2.minEnclosingCircle(pts)
            rounding_px = float(radius)
        else:
            rounding_px = 0.0

        rounding_mm = pixels_to_mm(rounding_px, h)
        rounding_severity = classify_defect_severity(rounding_mm).value

        lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
        center = lab[patch_size // 4: 3 * patch_size // 4, patch_size // 4: 3 * patch_size // 4]
        border = lab
        center_resized = cv2.resize(center, (border.shape[1], border.shape[0]), interpolation=cv2.INTER_LINEAR)
        de = delta_e_lab(border, center_resized)
        whitening_mask = (de > DELTA_E_THRESHOLDS["whitening"]).astype(np.uint8)
        whitening_length_px = float(np.sum(whitening_mask))
        whitening_length_mm = pixels_to_mm(whitening_length_px, h)
        whitening_severity = classify_defect_severity(whitening_length_mm).value

        dots = cv2.inRange(to_gray(patch), SURFACE_THRESHOLDS["white_dot_threshold"], 255)
        dots_count, _ = cv2.connectedComponents(dots)

        # Create detailed defect list
        defects = []
        if rounding_mm > 0.2:
            defects.append(DefectMeasurement(
                size_px=rounding_px,
                size_mm=rounding_mm,
                severity=rounding_severity,
                max_grade_impact=get_max_grade_for_defect("rounding", classify_defect_severity(rounding_mm)),
                location=name,
                description=f"Corner rounding: {rounding_mm:.2f}mm radius ({rounding_severity})"
            ))

        if whitening_length_mm > 0.05:
            defects.append(DefectMeasurement(
                size_px=whitening_length_px,
                size_mm=whitening_length_mm,
                severity=whitening_severity,
                max_grade_impact=get_max_grade_for_defect("whitening", classify_defect_severity(whitening_length_mm)),
                location=name,
                description=f"Corner whitening: {whitening_length_mm:.2f}mm ({whitening_severity})"
            ))

        out.append(CornerMetricsEnhanced(
            corner_name=name,
            rounding_radius_px=rounding_px,
            rounding_radius_mm=rounding_mm,
            rounding_severity=rounding_severity,
            whitening_length_px=whitening_length_px,
            whitening_length_mm=whitening_length_mm,
            whitening_severity=whitening_severity,
            white_dots_count=max(0, int(dots_count) - 1),
            defects=defects,
            structural_damage=False
        ))

    return out


# =============================================================================
# Enhanced Surface Analysis with Crease Detection
# =============================================================================

def detect_crease_indicators(img_bgr: np.ndarray, pixels_per_mm: float) -> Tuple[int, List[str]]:
    """
    Detect potential crease indicators using Phase 1 criteria.
    Returns count and list of indicators found.
    """
    gray = to_gray(img_bgr)
    indicators = []

    # Use Scharr operator for gradient analysis (depth variation detection)
    scharrx = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    scharry = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    mag = cv2.magnitude(scharrx, scharry)
    mag = (mag / (mag.max() + 1e-6) * 255).astype(np.uint8)
    _, thr = cv2.threshold(mag, 30, 255, cv2.THRESH_BINARY)
    thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    crease_like_count = 0
    min_len_mm = 5.0  # Creases typically span significant length

    for cnt in contours:
        x, y, w_cnt, h_cnt = cv2.boundingRect(cnt)
        length_px = max(w_cnt, h_cnt)
        length_mm = pixels_to_mm(length_px, img_bgr.shape[0])

        if length_mm >= min_len_mm:
            crease_like_count += 1
            indicators.append(f"depth_variation_{length_mm:.1f}mm")

    # Detect gloss breaks (would need glossiness analysis - simplified here)
    # This is a placeholder for more sophisticated gloss detection

    return crease_like_count, indicators


def compute_surface_metrics_enhanced(img_bgr: np.ndarray, glare_mask: np.ndarray,
                                      pixels_per_mm: float) -> SurfaceMetricsEnhanced:
    h, w = img_bgr.shape[:2]

    # Focus and lighting
    focus = variance_of_laplacian(to_gray(img_bgr))
    light_score = brightness_uniformity(to_gray(img_bgr))
    bias = color_bias_bgr(img_bgr)

    # White dots detection
    gray = to_gray(img_bgr)
    _, thr = cv2.threshold(gray, SURFACE_THRESHOLDS["white_dot_threshold"], 255, cv2.THRESH_BINARY)
    thr = cv2.morphologyEx(thr, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thr, connectivity=8)

    dots_count = 0
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if SURFACE_THRESHOLDS["white_dot_min_area"] <= area <= SURFACE_THRESHOLDS["white_dot_max_area"]:
            dots_count += 1

    dots_severity = "none"
    if dots_count > 10:
        dots_severity = "heavy"
    elif dots_count > 5:
        dots_severity = "moderate"
    elif dots_count > 2:
        dots_severity = "minor"
    elif dots_count > 0:
        dots_severity = "microscopic"

    # Scratch detection
    gray_blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(gray_blur, 40, 100)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180.0, threshold=50,
                            minLineLength=SURFACE_THRESHOLDS["scratch_min_length"],
                            maxLineGap=8)

    scratch_details = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length_px = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            length_mm = pixels_to_mm(length_px, h)
            severity = classify_defect_severity(length_mm).value

            scratch_details.append(DefectMeasurement(
                size_px=length_px,
                size_mm=length_mm,
                severity=severity,
                max_grade_impact=get_max_grade_for_defect("scratch", classify_defect_severity(length_mm)),
                location=f"surface_{x1},{y1}",
                description=f"Scratch: {length_mm:.1f}mm ({severity})"
            ))

    # Crease detection
    crease_count, crease_indicators = detect_crease_indicators(img_bgr, pixels_per_mm)
    structural_suspected = crease_count > 0

    glare_percent = float(100.0 * np.sum(glare_mask > 0) / float(h * w))

    return SurfaceMetricsEnhanced(
        white_dots_count=dots_count,
        white_dots_severity=dots_severity,
        scratch_count=len(scratch_details),
        scratch_details=scratch_details,
        crease_like_count=crease_count,
        crease_indicators=crease_indicators,
        glare_coverage_percent=glare_percent,
        focus_variance=focus,
        lighting_uniformity_score=light_score,
        color_bias_bgr=bias,
        structural_damage_suspected=structural_suspected
    )


# =============================================================================
# Grade Estimation
# =============================================================================

def estimate_max_grade(side_metrics: SideMetricsEnhanced) -> Tuple[float, List[str]]:
    """
    Estimate maximum achievable grade based on detected defects.
    Returns (max_grade, list of limiting defects).
    """
    max_grade = 10.0
    limiting_defects = []

    # Check for structural damage (automatic 4.0 cap)
    if side_metrics.surface.structural_damage_suspected:
        max_grade = min(max_grade, 4.0)
        limiting_defects.append("Suspected structural damage (crease indicators detected)")

    # Check corners
    for corner in side_metrics.corners:
        for defect in corner.defects:
            if defect.max_grade_impact < max_grade:
                max_grade = defect.max_grade_impact
                limiting_defects.append(f"{corner.corner_name}: {defect.description}")

    # Check edges
    for side, segments in side_metrics.edge_segments.items():
        for seg in segments:
            for defect in seg.defects:
                if defect.max_grade_impact < max_grade:
                    max_grade = defect.max_grade_impact
                    limiting_defects.append(f"{seg.segment_name}: {defect.description}")

    # Check surface
    for scratch in side_metrics.surface.scratch_details:
        if scratch.max_grade_impact < max_grade:
            max_grade = scratch.max_grade_impact
            limiting_defects.append(f"Surface: {scratch.description}")

    # Check centering (simplified - would need more sophisticated analysis)
    lr_ratio = side_metrics.centering.lr_ratio
    tb_ratio = side_metrics.centering.tb_ratio
    max_centering_diff = max(abs(lr_ratio[0] - 50), abs(lr_ratio[1] - 50),
                              abs(tb_ratio[0] - 50), abs(tb_ratio[1] - 50))

    if max_centering_diff > 25:  # 75/25 or worse
        max_grade = min(max_grade, 8.0)
        limiting_defects.append(f"Centering: {max_centering_diff:.1f}% off-center")
    elif max_centering_diff > 15:  # 65/35 to 75/25
        max_grade = min(max_grade, 8.5)
        limiting_defects.append(f"Centering: {max_centering_diff:.1f}% off-center")

    return max_grade, limiting_defects


# =============================================================================
# Visualization
# =============================================================================

def draw_overlays_enhanced(img_bgr: np.ndarray,
                            edges_metrics: Dict[str, List[EdgeSegmentMetricsEnhanced]],
                            corners: List[CornerMetricsEnhanced],
                            glare_mask: np.ndarray) -> np.ndarray:
    vis = img_bgr.copy()
    h, w = vis.shape[:2]

    # Draw glare mask
    mask_rgb = cv2.cvtColor(glare_mask, cv2.COLOR_GRAY2BGR)
    vis = cv2.addWeighted(vis, 1.0, mask_rgb, 0.25, 0)

    # Draw edge segments with severity color coding
    severity_colors = {
        "none": (0, 255, 0),        # Green
        "microscopic": (0, 255, 255),  # Yellow
        "minor": (0, 165, 255),     # Orange
        "moderate": (0, 100, 255),  # Red-Orange
        "heavy": (0, 0, 255),       # Red
    }

    for side, segs in edges_metrics.items():
        for seg in segs:
            color = severity_colors.get(seg.whitening_severity, (255, 255, 255))
            n = len(segs)
            if side in ("top", "bottom"):
                seg_len = w // n if n > 0 else w
                y = 2 if side == "top" else (h - 2)
                idx = int(seg.segment_name.split("_")[1]) - 1
                x0 = idx * seg_len
                x1 = w if idx == n - 1 else (idx + 1) * seg_len
                cv2.line(vis, (x0, y), (x1, y), color, 2)
            else:
                seg_len = h // n if n > 0 else h
                x = 2 if side == "left" else (w - 2)
                idx = int(seg.segment_name.split("_")[1]) - 1
                y0 = idx * seg_len
                y1 = h if idx == n - 1 else (idx + 1) * seg_len
                cv2.line(vis, (x, y0), (x, y1), color, 2)

    # Draw corner annotations with severity
    for c in corners:
        color = severity_colors.get(c.whitening_severity, (255, 255, 255))
        if c.corner_name == "tl":
            pt = (10, 20)
        elif c.corner_name == "tr":
            pt = (w - 280, 20)
        elif c.corner_name == "bl":
            pt = (10, h - 10)
        else:
            pt = (w - 280, h - 10)
        txt = f"{c.corner_name}: r={c.rounding_radius_mm:.2f}mm w={c.whitening_length_mm:.2f}mm"
        cv2.putText(vis, txt, pt, cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)

    return vis


# =============================================================================
# Main Analysis Pipeline
# =============================================================================

def analyze_side_enhanced(image_path: str, outdir: str, side_label: str) -> SideMetricsEnhanced:
    img = imread_color(image_path)
    img = resize_max_dim(img, 2200)

    quad = detect_card_quadrilateral(img)
    obstructions = []
    debug_assets = {}

    if quad is None:
        warped = img.copy()
        mask = np.ones(warped.shape[:2], dtype=np.uint8) * 255
        obstructions.append({"zone": "full", "type": "no_quad_detected", "action": "fallback_full_image"})
    else:
        warped, mask = warp_to_rect(img, quad, target_height=1600)

    # Calculate pixels per mm for this card
    pixels_per_mm = warped.shape[0] / 88.9  # Standard card height

    glare_mask = detect_glare_mask(warped)
    sleeve, top_loader, slab = detect_sleeve_like_features(warped)

    centering = measure_centering_enhanced(warped, mask, pixels_per_mm)
    edge_metrics = detect_edge_whitening_enhanced(warped, pixels_per_mm)
    corner_metrics = analyze_corners_enhanced(warped, pixels_per_mm)
    surface_metrics = compute_surface_metrics_enhanced(warped, glare_mask, pixels_per_mm)

    overlay = draw_overlays_enhanced(warped, edge_metrics, corner_metrics, glare_mask)

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

    side_metrics = SideMetricsEnhanced(
        side_label=side_label,
        width=int(warped.shape[1]),
        height=int(warped.shape[0]),
        pixels_per_mm=float(pixels_per_mm),
        centering=centering,
        edge_segments=edge_metrics,
        corners=corner_metrics,
        surface=surface_metrics,
        sleeve_indicator=bool(sleeve),
        top_loader_indicator=bool(top_loader),
        slab_indicator=bool(slab),
        glare_mask_percent=surface_metrics.glare_coverage_percent,
        obstructions=obstructions,
        debug_assets=debug_assets
    )

    # Estimate grade
    max_grade, limiting_defects = estimate_max_grade(side_metrics)
    side_metrics.estimated_max_grade = max_grade
    side_metrics.grade_limiting_defects = limiting_defects

    return side_metrics


# =============================================================================
# CLI
# =============================================================================

def run_cli_enhanced(front_path: Optional[str], back_path: Optional[str], outdir: str) -> CombinedMetricsEnhanced:
    ensure_outdir(outdir)
    run_id = str(uuid.uuid4())

    front_metrics = analyze_side_enhanced(front_path, outdir, "front") if front_path else None
    back_metrics = analyze_side_enhanced(back_path, outdir, "back") if back_path else None

    # Cross-side verification for structural damage
    cross_side_verification = {}
    if front_metrics and back_metrics:
        if front_metrics.surface.structural_damage_suspected or back_metrics.surface.structural_damage_suspected:
            cross_side_verification = {
                "front_structural_suspected": front_metrics.surface.structural_damage_suspected,
                "back_structural_suspected": back_metrics.surface.structural_damage_suspected,
                "both_sides_show_damage": (front_metrics.surface.structural_damage_suspected and
                                            back_metrics.surface.structural_damage_suspected),
                "recommendation": "Manual cross-side verification required at same coordinates"
            }

    combined = CombinedMetricsEnhanced(
        front=front_metrics,
        back=back_metrics,
        cross_side_verification=cross_side_verification,
        run_id=run_id
    )

    json_path = os.path.join(outdir, "stage1_metrics_enhanced.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(serialize_combined_metrics_enhanced(combined), f, indent=2)

    print(f"\n{'='*70}")
    print(f"Stage 1 Enhanced Analysis Complete")
    print(f"{'='*70}")
    print(f"Metrics saved to: {json_path}")

    if front_metrics:
        print(f"\nFRONT ANALYSIS:")
        print(f"  Estimated Max Grade: {front_metrics.estimated_max_grade}")
        print(f"  Limiting Defects: {len(front_metrics.grade_limiting_defects)}")
        for defect in front_metrics.grade_limiting_defects[:3]:  # Show top 3
            print(f"    - {defect}")

    if back_metrics:
        print(f"\nBACK ANALYSIS:")
        print(f"  Estimated Max Grade: {back_metrics.estimated_max_grade}")
        print(f"  Limiting Defects: {len(back_metrics.grade_limiting_defects)}")
        for defect in back_metrics.grade_limiting_defects[:3]:
            print(f"    - {defect}")

    if cross_side_verification:
        print(f"\nCROSS-SIDE VERIFICATION:")
        print(f"  {cross_side_verification['recommendation']}")

    print(f"{'='*70}\n")

    return combined


def serialize_combined_metrics_enhanced(data: CombinedMetricsEnhanced) -> Dict:
    """Serialize enhanced metrics to JSON-compatible dict."""
    def defect_to_dict(d: DefectMeasurement) -> Dict:
        return asdict(d)

    def edge_to_dict(d: Dict[str, List[EdgeSegmentMetricsEnhanced]]) -> Dict[str, List[Dict]]:
        result = {}
        for k, v in d.items():
            result[k] = []
            for seg in v:
                seg_dict = asdict(seg)
                seg_dict["defects"] = [defect_to_dict(df) for df in seg.defects]
                result[k].append(seg_dict)
        return result

    def side_to_dict(s: SideMetricsEnhanced) -> Dict:
        surface_dict = asdict(s.surface)
        surface_dict["scratch_details"] = [defect_to_dict(sc) for sc in s.surface.scratch_details]

        corners_list = []
        for c in s.corners:
            c_dict = asdict(c)
            c_dict["defects"] = [defect_to_dict(df) for df in c.defects]
            corners_list.append(c_dict)

        return {
            "side_label": s.side_label,
            "width": s.width,
            "height": s.height,
            "pixels_per_mm": s.pixels_per_mm,
            "centering": asdict(s.centering),
            "edge_segments": edge_to_dict(s.edge_segments),
            "corners": corners_list,
            "surface": surface_dict,
            "sleeve_indicator": s.sleeve_indicator,
            "top_loader_indicator": s.top_loader_indicator,
            "slab_indicator": s.slab_indicator,
            "glare_mask_percent": s.glare_mask_percent,
            "obstructions": s.obstructions,
            "debug_assets": s.debug_assets,
            "estimated_max_grade": s.estimated_max_grade,
            "grade_limiting_defects": s.grade_limiting_defects
        }

    return {
        "version": data.version,
        "grading_criteria_version": data.grading_criteria_version,
        "run_id": data.run_id,
        "front": side_to_dict(data.front) if data.front else None,
        "back": side_to_dict(data.back) if data.back else None,
        "cross_side_verification": data.cross_side_verification
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enhanced Stage 1 Card Analysis with Professional Grading Criteria"
    )
    parser.add_argument("--front", type=str, default="", help="Path to front image")
    parser.add_argument("--back", type=str, default="", help="Path to back image")
    parser.add_argument("--outdir", type=str, default="./out", help="Output directory")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    front = args.front if args.front else None
    back = args.back if args.back else None
    run_cli_enhanced(front, back, args.outdir)


if __name__ == "__main__":
    main()
