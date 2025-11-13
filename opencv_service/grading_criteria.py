#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Professional Card Grading Criteria Configuration
=================================================

This module defines the precise thresholds, severity scales, and detection
parameters used in professional card grading. All values are derived from
the Phase 1 grading instructions and comprehensive grading scale (1.0-10.0).

These criteria align OpenCV detection logic with AI grading standards to ensure
consistency across the entire grading pipeline.
"""

from typing import Dict, Tuple
from enum import Enum


# =============================================================================
# UNIVERSAL DEFECT SEVERITY SCALE (CRITICAL - USE EXACT TERMINOLOGY)
# =============================================================================

class DefectSeverity(Enum):
    """
    Standardized defect severity classification.
    MUST be used consistently across all grading and documentation.
    """
    MICROSCOPIC = "microscopic"  # <0.1mm
    MINOR = "minor"              # 0.1-0.3mm
    MODERATE = "moderate"        # 0.3-1mm
    HEAVY = "heavy"              # >1mm
    NONE = "none"                # No defect detected


# Size thresholds in millimeters
SEVERITY_THRESHOLDS = {
    "microscopic_max": 0.1,   # <0.1mm
    "minor_max": 0.3,         # 0.1-0.3mm
    "moderate_max": 1.0,      # 0.3-1mm
    "heavy_min": 1.0,         # >1mm
}


# Grade impact for each severity level
SEVERITY_GRADE_IMPACT = {
    DefectSeverity.MICROSCOPIC: {"max_grade": 9.5, "description": "Requires zoom/magnification"},
    DefectSeverity.MINOR: {"max_grade": 9.5, "description": "Visible upon close inspection"},
    DefectSeverity.MODERATE: {"max_grade": 8.5, "description": "Visible to naked eye"},
    DefectSeverity.HEAVY: {"max_grade": 8.0, "description": "Obviously damaged"},
}


def classify_defect_severity(size_mm: float) -> DefectSeverity:
    """
    Classify defect severity based on size in millimeters.

    Args:
        size_mm: Size of defect in millimeters

    Returns:
        DefectSeverity enum value
    """
    if size_mm < SEVERITY_THRESHOLDS["microscopic_max"]:
        return DefectSeverity.MICROSCOPIC
    elif size_mm < SEVERITY_THRESHOLDS["minor_max"]:
        return DefectSeverity.MINOR
    elif size_mm < SEVERITY_THRESHOLDS["moderate_max"]:
        return DefectSeverity.MODERATE
    else:
        return DefectSeverity.HEAVY


# =============================================================================
# DETECTION THRESHOLDS (From Phase 1 Instructions)
# =============================================================================

# Color difference thresholds (LAB ΔE)
DELTA_E_THRESHOLDS = {
    "whitening": 6.0,          # ΔE > 6 indicates exposed card stock
    "chipping": 6.0,           # ΔE > 6 with edge deviation
    "print_defect": 4.0,       # Lower threshold for print inconsistencies
    "surface_scratch": 3.0,    # Subtle color change from scratches
}

# Edge detection thresholds
EDGE_THRESHOLDS = {
    "deviation_mm": 0.05,      # Edge deviation > 0.05mm indicates chipping
    "strip_width_px": 8,       # Width of edge strip to sample (in pixels)
    "segment_splits": 10,      # Divide each edge into 10 segments (40 total)
}

# Corner detection thresholds
CORNER_THRESHOLDS = {
    "patch_size_px": 80,       # Corner patch size for analysis
    "rounding_threshold": 2.0, # Radius > 2.0px indicates rounded corner
}

# Surface detection thresholds
SURFACE_THRESHOLDS = {
    "white_dot_min_area": 3,   # Minimum pixel area for white dot
    "white_dot_max_area": 200, # Maximum pixel area for white dot
    "white_dot_threshold": 245, # Grayscale value threshold (0-255)
    "scratch_min_length": 40,  # Minimum length for scratch detection (pixels)
    "crease_min_length": 60,   # Minimum length for crease detection (pixels)
}

# Glare and sleeve detection
GLARE_THRESHOLDS = {
    "saturation_max": 40,      # HSV saturation < 40 indicates glare
    "value_min": 230,          # HSV value > 230 indicates bright glare
    "sleeve_edge_ratio": 0.06, # Double-edge ratio indicating sleeve
    "toploader_edge_ratio": 0.08,
    "slab_edge_ratio": 0.10,
    "sleeve_contrast_max": 55.0,
}


# =============================================================================
# COMPREHENSIVE GRADING SCALE (1.0 - 10.0)
# =============================================================================

GRADING_SCALE = {
    10.0: {
        "name": "Gem Mint (Perfect)",
        "defect_threshold": "ZERO defects on all categories",
        "frequency": "<1%",
        "corners": "All 8 corners perfect 90° angles, <0.05mm whitening if any",
        "edges": "Zero white dots, zero chipping, zero roughness",
        "surface": "Flawless gloss, zero scratches, zero print defects",
        "centering": "50/50 to 55/45 on all axes",
        "structural": "No protective case (raw card only)",
    },
    9.5: {
        "name": "Gem Mint (Near Perfect)",
        "defect_threshold": "Microscopic defects only (<0.1mm)",
        "frequency": "5-10%",
        "corners": "1-2 corners with microscopic whitening (<0.1mm)",
        "edges": "1-3 isolated white dots (<0.1mm each)",
        "surface": "1-2 microscopic print dots or hairline scratches",
        "centering": "50/50 to 60/40",
    },
    9.0: {
        "name": "Mint",
        "defect_threshold": "Minor defects (0.1-0.3mm)",
        "frequency": "20-30%",
        "corners": "2-3 corners with minor whitening (0.1-0.3mm) OR 1 corner moderate rounding",
        "edges": "Minor whitening on 1-2 edges (0.1-0.3mm) OR 4-6 white dots",
        "surface": "Minor scratches (<5mm) OR 3-5 small print defects",
        "centering": "56/45 to 70/30",
    },
    8.5: {
        "name": "Near Mint-Mint",
        "defect_threshold": "Moderate defects (0.3-1mm) on 1 component OR multiple minor",
        "frequency": "15-20%",
        "corners": "1 corner moderate (0.3-1mm) OR 3-4 corners minor",
        "edges": "Moderate whitening on 1 edge (0.3-1mm) OR minor on multiple",
        "surface": "Moderate scratch visible OR multiple minor scratches",
        "centering": "56/45 to 75/25",
    },
    8.0: {
        "name": "Near Mint",
        "defect_threshold": "Moderate defects (0.3-1mm) on multiple OR 1 heavy (>1mm)",
        "frequency": "20-25%",
        "corners": "2-3 corners moderate (0.3-1mm) OR 1 heavy rounding",
        "edges": "Moderate whitening on 2-3 edges OR continuous wear",
        "surface": "Multiple moderate scratches OR 1 long scratch (>10mm)",
        "centering": "61/39 to 75/25",
    },
    7.0: {
        "name": "Near Mint (Lower End)",
        "defect_threshold": "Heavy defects (>1mm) on 1-2 components OR extensive moderate",
        "frequency": "10-15%",
        "corners": "1-2 corners heavy (>1mm) OR 3-4 corners moderate",
        "edges": "Heavy whitening (>1mm) on 1-2 edges OR moderate on all",
        "surface": "Heavy scratch (>15mm) OR multiple moderate OR staining",
        "centering": "71/29 to 85/15",
    },
    6.0: {
        "name": "Excellent-Mint",
        "defect_threshold": "Heavy defects on multiple OR extreme on 1 component",
        "frequency": "5-8%",
        "corners": "2-3 corners heavy (>1mm) OR 1 extreme (>2mm radius)",
        "edges": "Heavy whitening on 3-4 edges OR extensive material loss",
        "surface": "Multiple heavy scratches OR moderate staining OR print misalignment",
        "centering": "76/24 to 85/15",
    },
    5.0: {
        "name": "Excellent",
        "defect_threshold": "Extreme wear, approaching structural compromise (NO CREASES)",
        "frequency": "3-5%",
        "corners": "3-4 corners heavy OR 1-2 corners extreme (>2mm)",
        "edges": "All edges heavy whitening OR material loss on multiple",
        "surface": "Heavy scratches covering significant area OR 10-20% staining OR gloss loss",
        "centering": "≥86/14",
        "note": "LOWEST GRADE WITHOUT STRUCTURAL DAMAGE",
    },
    4.0: {
        "name": "Very Good-Excellent",
        "defect_threshold": "STRUCTURAL DAMAGE (crease, bent corner) OR extreme wear all components",
        "frequency": "3-5%",
        "structural_triggers": [
            "ANY crease (fold line through paper, any size)",
            "ANY bent corner (raised/warped, doesn't lie flat)",
            "Card structure permanently compromised"
        ],
        "note": "AUTOMATIC CAP if ANY structural damage detected",
    },
    3.0: {
        "name": "Very Good",
        "defect_threshold": "Multiple structural defects OR heavy crease",
        "structural": "2-3 light creases OR 1 heavy crease OR split corner (<2mm)",
    },
    2.0: {
        "name": "Good",
        "defect_threshold": "Severe structural damage OR near-tear conditions",
        "structural": "Heavy multiple creases OR corner tear (2-5mm) OR edge tear",
    },
    1.0: {
        "name": "Poor",
        "defect_threshold": "Extreme structural damage, card barely intact",
        "structural": "Major tears (>5mm) OR multiple tears OR extreme creasing (4+ creases) OR missing pieces",
    }
}


# =============================================================================
# CREASE DETECTION INDICATORS (From Phase 1 Glare Analysis Protocol)
# =============================================================================

CREASE_PRIMARY_INDICATORS = {
    "visible_line": "Visible LINE running across card (straight, curved, or angular)",
    "depression": "Line appears as DEPRESSION or VALLEY in card surface (has depth/dimension)",
    "paired_shadow": "PAIRED SHADOW RIDGE running along fold line (light side + dark side)",
    "gloss_break": "BREAK IN GLOSS: Surface reflection interrupted, not smooth (CRITICAL INDICATOR)",
    "fiber_exposure": "FIBER EXPOSURE: White or lighter paper where fibers bent or broke",
    "image_distortion": "IMAGE DISTORTION: Printed design warps, shifts, or distorts along line",
    "kink_in_glare": "KINK IN GLARE: Light reflection bends or breaks where print design is smooth",
    "depth_variation": "DEPTH VARIATION: Line has dimension - appears recessed (valley) or raised (ridge)",
}

CREASE_SECONDARY_INDICATORS = {
    "reflection_angle": "Reflection angle changes sharply along line (not smooth)",
    "shadow_effect": "Shadow creates 'before and after' effect (one side lighter, other darker)",
    "print_shift": "Print registration shifts across line (colors slightly misaligned)",
    "texture_change": "Card surface has texture change along line (smooth to rough)",
}

# Key differentiator: Creases visible on BOTH sides at same coordinates
CREASE_CROSS_SIDE_VERIFICATION = {
    "mandatory": True,
    "rule": "If suspected crease on one side, MUST check exact same coordinates on opposite side",
    "confirmed_if": "ANY evidence (faint line, shadow, gloss break, color variation) at same location on both sides",
    "false_positive_if": "Visible on ONLY one side with NO evidence on opposite = surface scratch or photo artifact",
}


# =============================================================================
# CENTERING DEFECT TYPES (From Phase 1 DCM v2.0)
# =============================================================================

CENTERING_DEFECT_TYPES = {
    "off_cut_borders": {
        "description": "Unequal frame thickness - border varies between opposite sides",
        "detection": "L/R differ by >15% OR T/B differ by >15%",
        "grade_impact": "60/40 to 65/35 → caps at 8.5-9.0",
    },
    "tilted_print": {
        "description": "Printed design rotated/angled relative to physical edges",
        "detection": "One side thicker at top vs bottom",
        "grade_impact": "Noticeable tilt → caps at 8.0-8.5",
    },
    "crooked_cropping": {
        "description": "Print frame not parallel to physical edges",
        "detection": "Inner design border and outer card edge not parallel",
        "grade_impact": "Visible misalignment → caps at 8.5",
    },
    "partial_trimming": {
        "description": "Factory mis-cut removing part of intended border",
        "detection": "Missing border segment, design edge touching card edge",
        "grade_impact": "IF ALTERED → N/A; IF FACTORY → Note variant",
    },
    "edge_fade": {
        "description": "Print bleeds unevenly on opposite sides",
        "detection": "Color gradient extends 1-2mm on one edge, 0mm on opposite",
        "grade_impact": "Minor cosmetic, typically no cap",
    },
}


# =============================================================================
# CORNER DEFECT TYPES (10 Types from Phase 1)
# =============================================================================

CORNER_DEFECT_TYPES = {
    "whitening": {
        "severity_scale": "Per Universal Scale (microscopic/minor/moderate/heavy)",
        "grade_impact": "Varies by severity and count",
    },
    "chipping": {
        "severity_scale": "Per Universal Scale",
        "grade_impact": "Varies by severity",
    },
    "rounding": {
        "minor": {"range": "0.2-0.5mm", "max_grade": 9.0},
        "moderate": {"range": "0.5-1.0mm", "max_grade": 8.5},
        "heavy": {"range": ">1.0mm", "max_grade": 8.0},
    },
    "bent_corner": {
        "description": "Corner raised/warped, doesn't lie flat",
        "structural_damage": True,
        "grade_cap": 4.0,
    },
    "folded_corner": {
        "description": "Corner folded over with crease",
        "structural_damage": True,
        "grade_cap": 4.0,
    },
    "crushed_corner": {
        "description": "Corner compressed/flattened",
        "structural_damage": True,
        "grade_cap": 3.0,
    },
    "delamination": {
        "description": "Corner layers separating",
        "structural_damage": True,
        "grade_cap": 4.0,
    },
    "frayed_fibers": {
        "description": "Exposed card fibers at corner",
        "grade_impact": "Cosmetic, reduce 0.5-1.0 grade",
    },
    "ink_loss": {
        "description": "Print missing at corner tip",
        "grade_impact": "Minor defect, typically Max 9.5",
    },
    "stain": {
        "light": "reduce 0.5 grade",
        "heavy": "reduce 1.0-1.5 grade",
    },
}


# =============================================================================
# EDGE DEFECT TYPES (10 Types from Phase 1)
# =============================================================================

EDGE_DEFECT_TYPES = {
    "whitening": {
        "severity_scale": "Per Universal Scale",
    },
    "chipping_nick": {
        "severity_scale": "Per Universal Scale",
    },
    "rough_cut": {
        "description": "Factory characteristic, minor defect only",
    },
    "abrasion_rubbing": {
        "2_5mm": "Max 9.0",
        "5_10mm": "Max 8.5",
        ">10mm": "Max 8.0",
    },
    "delamination_line": {
        "description": "Edge layers separating",
        "structural_damage": True,
        "grade_cap": 4.0,
    },
    "crack_tear": {
        "description": "Edge split or tear",
        "structural_damage": True,
        "grade_cap": 3.0,
    },
    "ripple_warp": {
        "description": "Edge waving or bending",
        "structural_damage": True,
        "grade_cap": 5.0,
    },
    "indent_dent": {
        "description": "Edge compressed inward",
        "structural_damage": True,
        "grade_cap": 4.0,
    },
    "stain_residue": {
        "light": "Max 9.0",
        "heavy": "Max 8.0-8.5",
    },
    "miscut": {
        "altered": "Grade N/A",
        "factory": "Note as variant",
    },
}


# =============================================================================
# PIXEL TO MM CONVERSION (Calibration Required)
# =============================================================================

# Standard trading card dimensions
STANDARD_CARD_SIZE = {
    "width_mm": 63.5,      # 2.5 inches
    "height_mm": 88.9,     # 3.5 inches
    "width_inches": 2.5,
    "height_inches": 3.5,
}


def pixels_to_mm(pixels: float, card_height_px: int, card_height_mm: float = 88.9) -> float:
    """
    Convert pixel measurements to millimeters.

    Args:
        pixels: Measurement in pixels
        card_height_px: Detected card height in pixels
        card_height_mm: Physical card height in mm (default: 88.9mm for standard card)

    Returns:
        Measurement in millimeters
    """
    pixels_per_mm = card_height_px / card_height_mm
    return pixels / pixels_per_mm


def mm_to_pixels(mm: float, card_height_px: int, card_height_mm: float = 88.9) -> float:
    """
    Convert millimeter measurements to pixels.

    Args:
        mm: Measurement in millimeters
        card_height_px: Detected card height in pixels
        card_height_mm: Physical card height in mm (default: 88.9mm for standard card)

    Returns:
        Measurement in pixels
    """
    pixels_per_mm = card_height_px / card_height_mm
    return mm * pixels_per_mm


# =============================================================================
# OPENCV-SPECIFIC CALIBRATION
# =============================================================================

# These thresholds should be calibrated on your specific dataset
OPENCV_CALIBRATION = {
    "canny_low": 50,
    "canny_high": 150,
    "gaussian_blur_ksize": (5, 5),
    "morphology_kernel": (3, 3),
    "contour_approx_epsilon": 0.02,  # Percentage of perimeter for polygon approximation
    "min_card_area_ratio": 0.3,      # Minimum card area as ratio of image area
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_max_grade_for_defect(defect_type: str, severity: DefectSeverity, count: int = 1) -> float:
    """
    Calculate maximum achievable grade based on defect type, severity, and count.

    Args:
        defect_type: Type of defect (whitening, chipping, scratch, etc.)
        severity: DefectSeverity enum value
        count: Number of defects of this type/severity

    Returns:
        Maximum achievable grade (1.0-10.0)
    """
    # Structural damage always caps at 4.0 or lower
    structural_defects = ["bent_corner", "folded_corner", "delamination", "crack_tear", "indent_dent"]
    if defect_type in structural_defects:
        return 4.0

    # Apply severity-based grading
    if severity == DefectSeverity.MICROSCOPIC:
        return 9.5 if count <= 2 else 9.0
    elif severity == DefectSeverity.MINOR:
        if count <= 3:
            return 9.0
        else:
            return 8.5
    elif severity == DefectSeverity.MODERATE:
        if count == 1:
            return 8.5
        else:
            return 8.0
    elif severity == DefectSeverity.HEAVY:
        if count == 1:
            return 8.0
        elif count <= 2:
            return 7.0
        else:
            return 6.0

    return 10.0  # No defects


def is_structural_damage(defect_type: str) -> bool:
    """Check if defect type constitutes structural damage."""
    structural_defects = [
        "crease", "bent_corner", "folded_corner", "crushed_corner",
        "delamination", "crack_tear", "ripple_warp", "indent_dent"
    ]
    return defect_type in structural_defects


# =============================================================================
# EXPORT CONFIGURATION
# =============================================================================

GRADING_CONFIG = {
    "version": "1.0.0",
    "source": "Phase 1 Grading Instructions + Comprehensive Grading Scale",
    "last_updated": "2025-10-17",
    "severity_thresholds": SEVERITY_THRESHOLDS,
    "delta_e_thresholds": DELTA_E_THRESHOLDS,
    "edge_thresholds": EDGE_THRESHOLDS,
    "corner_thresholds": CORNER_THRESHOLDS,
    "surface_thresholds": SURFACE_THRESHOLDS,
    "glare_thresholds": GLARE_THRESHOLDS,
    "grading_scale": GRADING_SCALE,
    "crease_indicators": {
        "primary": CREASE_PRIMARY_INDICATORS,
        "secondary": CREASE_SECONDARY_INDICATORS,
        "cross_side_verification": CREASE_CROSS_SIDE_VERIFICATION,
    },
    "centering_defects": CENTERING_DEFECT_TYPES,
    "corner_defects": CORNER_DEFECT_TYPES,
    "edge_defects": EDGE_DEFECT_TYPES,
}
