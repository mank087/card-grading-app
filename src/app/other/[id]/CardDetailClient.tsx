"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { QRCodeCanvas } from 'qrcode.react';
import GradeBadge from "../../ui/GradeBadge";
import ImageZoomModal from "./ImageZoomModal";
import ReactMarkdown from 'react-markdown';
import { generateOtherEbaySearchUrl, generateOtherEbaySoldListingsUrl, type CardData } from "@/lib/ebayUtils";
import {
  generateFacebookShareUrl,
  generateTwitterShareUrl,
  handleInstagramShare,
  copyCardUrl,
  openSocialShare,
  showShareSuccess,
  type CardSharingData
} from "@/lib/socialUtils";
import { mapToEbayCondition, getEbayConditionColor, getEbayConditionDescription, type EbayCondition } from '@/lib/ebayConditionMapper';
import { getConditionFromGrade } from '@/lib/conditionAssessment';
import { getStoredSession } from '@/lib/directAuth';
import { Card as CardType, CardDefects, DEFAULT_CARD_DEFECTS } from '@/types/card';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';

interface SportsAIGrading {
  "Final Score"?: {
    "Overall Grade"?: string;
  };
  "Final Score"?: {
    "Overall Grade"?: number;
    "Decimal Grade"?: number;
    "Whole Number Grade"?: number;
    "Grade Range"?: string;
    "Uncertainty"?: string;
  };
  "Final DCM Grade"?: {
    "Raw Decimal Grade"?: number;
    "DCM Grade (Whole Number)"?: number;
    "DCM Grade (Decimal)"?: number;
    "Grade Range Min"?: number;
    "Grade Range Max"?: number;
    "Confidence Level"?: string;
    "Confidence Tier"?: string;
    "Grade Uncertainty"?: string;
  };
  "Card Information"?: {
    "Card Name"?: string;
    "Category"?: string;
    "Card Number"?: string;
    "Serial Numbering"?: string;
    "Card Set"?: string;
    "Manufacturer Name"?: string;
    "Release Date"?: string;
    "Authentic"?: string;
  };
  "Card Details"?: {
    "Player(s)/Character(s) Featured"?: string;
    "Rookie/First Print"?: string;
    "Rarity"?: string;
  };
  "Grading (DCM Master Scale)"?: {
    "Centering Starting Grade"?: number;
    "Centering Basis"?: string;
    "Total Defect Count"?: number;
    "Total Deductions"?: number;
    "Final Grade (After Deductions)"?: number;
    "Decimal Final Grade"?: number;
    "Whole Number Grade"?: number;
    "Preliminary Grade"?: number;
    "Grade Cap Applied"?: string;
    "Image Quality Cap Applied"?: string;
    "Category Scores"?: Record<string, {score: number; weight: number; contribution?: number}>;
    "Weighted Composite Score"?: number;
    "Defect Deductions"?: Array<{
      category?: string;
      type?: string;
      defect?: string;
      defect_type?: string;
      severity?: string;
      confidence?: string;
      base_deduction?: number;
      confidence_multiplier?: number;
      applied_deduction?: number;
      deduction?: number;
      value?: boolean;
    }>;
    "Visual_Inspection_Details"?: Record<string, any>;
    // V3.0 5-Category Defect Structure
    structural_integrity?: {
      overall_score?: number;
      confidence?: string;
      defects_detected?: Array<{
        type?: string;
        defect_type?: string;
        severity?: string;
        confidence?: string;
        evidence?: string;
        deduction?: number;
        applied_deduction?: number;
        confidence_multiplier?: number;
      }>;
      pristine_elements?: string[];
      uncertain_areas?: string[];
    };
    surface_condition?: {
      overall_score?: number;
      confidence?: string;
      defects?: Array<{
        type?: string;
        defect_type?: string;
        severity?: string;
        confidence?: string;
        evidence?: string;
        deduction?: number;
        applied_deduction?: number;
        confidence_multiplier?: number;
      }>;
      front_assessment?: any;
      back_assessment?: any;
      pristine_elements?: string[];
      uncertain_areas?: string[];
    };
    centering_quality?: {
      front_ratio_worst?: string;
      back_ratio_worst?: string;
      worst_overall?: string;
      estimated_deduction?: number;
      note?: string;
      overall_score?: number;
      confidence?: string;
      pristine_elements?: string[];
      uncertain_areas?: string[];
    };
    print_quality?: {
      overall_score?: number;
      confidence?: string;
      defects?: Array<{
        type?: string;
        defect_type?: string;
        severity?: string;
        confidence?: string;
        evidence?: string;
        location?: string;
        deduction?: number;
        applied_deduction?: number;
        confidence_multiplier?: number;
      }>;
      print_characteristics?: any;
      pristine_elements?: string[];
      uncertain_areas?: string[];
    };
    authenticity_assessment?: {
      overall_score?: number;
      confidence?: string;
      alterations_detected?: any[];
      checked_for?: string[];
      authentication_markers?: string[];
      pristine_elements?: string[];
      uncertain_areas?: string[];
    };
    "Centering_Measurements"?: {
      front_x_axis_ratio?: string;
      front_y_axis_ratio?: string;
      front_edge_description?: string;
      front_centering_method?: string;
      front_centering_confidence?: string;
      front_quality_note?: string | null;
      front_reference_points?: string | null;
      front_visual_observation?: string | null;
      front_measurement_approach?: string | null;
      back_x_axis_ratio?: string;
      back_y_axis_ratio?: string;
      back_edge_description?: string;
      back_centering_method?: string;
      back_centering_confidence?: string;
      back_quality_note?: string | null;
      back_reference_points?: string | null;
      back_visual_observation?: string | null;
      back_measurement_approach?: string | null;
      measurement_source?: string;
      measurement_confidence?: string;
    };
    "Grade Analysis Summary"?: string;
  };
  "DCM Score System"?: {
    "Condition Grade (Base)"?: string | number;
    "AI Confidence Score"?: string;
    "Final DCM Score"?: string;
  };
  "AI Confidence Assessment"?: {
    "Overall Confidence"?: string;
    "Confidence Tier"?: string;
    "Grade Uncertainty"?: string;
    "Image Quality Score"?: number | string | null;
    "Quality Calculation"?: string | null;
    "Grading Reliability"?: string;
    "Grading Summary"?: any;
    "Recommendations"?: string[] | string | null;
  };
  "Image Conditions"?: {
    "Resolution"?: string;
    "Resolution Score"?: number | null;
    "Lighting"?: string;
    "Lighting Score"?: number | null;
    "Angle"?: string;
    "Angle Score"?: number | null;
    "Clarity"?: string;
    "Clarity Score"?: number | null;
    "Glare Present"?: string;
    "Glare Penalty"?: number;
    "Obstructions"?: string;
    "Obstruction Penalty"?: number;
    "Overall Quality Score"?: number | string | null;
    "Quality Tier"?: string;
    "Calculation"?: string;
  };
  "Card Detection Assessment"?: {
    "Detection Confidence"?: string;
    "Detected Aspect Ratio"?: string;
    "Aspect Ratio Validation"?: string;
    "Card Boundary Quality"?: string;
    "Detection Factors"?: string;
    "Detection Impact on Grading"?: string;
    "Fallback Methods Used"?: string;
  };
  "Image Conditions"?: {
    "Resolution"?: string;
    "Angle Deviation"?: string;
    "Perspective Distortion"?: string;
    "Obstructions"?: string[];
    "Quality Tier"?: string;
    "Impact on Grading"?: string;
  };

  // v2.2 REVISED - New Fields
  "Visual Geometry"?: {
    front?: {
      card_orientation?: string;
      rotation_estimate?: string;
      perspective_distortion?: string;
      all_corners_visible?: boolean;
      corners_description?: string;
    };
    back?: {
      card_orientation?: string;
      rotation_estimate?: string;
      perspective_distortion?: string;
      all_corners_visible?: boolean;
      corners_description?: string;
    };
  };

  "Design Profile"?: {
    front?: string;
    back?: string;
    border_characteristics?: {
      front?: string;
      back?: string;
    };
    anchor_strategy?: string;
  };

  "Execution Control"?: {
    all_steps_completed?: boolean;
    skipped_steps?: string[];
    fatal_flags?: string[];
  };

  "Image Quality Impact"?: {
    stage1_confidence_tier?: string;
    grade_uncertainty?: string;
    uncertainty_reason?: string;
    fatal_flags_impact?: string[];
    recommended_action?: string;
  };

  "Alteration Check"?: {
    performed?: boolean;
    card_is_altered?: boolean;
    reason?: string;
    grade_override?: string | null;
  };

  "Input Validation"?: {
    stage1_data_received?: boolean;
    fatal_flags_from_stage1?: string[];
    skipped_steps_from_stage1?: string[];
    observations_count?: number;
    pristine_count?: number;
  };

  "Centering Measurements"?: {
    Front?: {
      visual_anchors_lr?: string[];
      visual_anchors_tb?: string[];
      border_comparison_lr?: string;
      border_comparison_tb?: string;
      left_right_ratio?: string;
      top_bottom_ratio?: string;
      worst_ratio?: string;
      measurement_proof?: string;
      discrepancy_detected?: boolean;
      confidence?: string;
      notes?: string;
    };
    Back?: {
      visual_anchors_lr?: string[];
      visual_anchors_tb?: string[];
      border_comparison_lr?: string;
      border_comparison_tb?: string;
      left_right_ratio?: string;
      top_bottom_ratio?: string;
      worst_ratio?: string;
      measurement_proof?: string;
      discrepancy_detected?: boolean;
      confidence?: string;
      notes?: string;
    };
  };

  "Analysis Summary"?: {
    primary_grade_factors?: string[];
    limiting_factors?: string[];
    image_quality_notes?: string;
    recommended_grade_range?: string;
    confidence_statement?: string;
  };
}

interface SportsCard {
  id: string;
  serial: string;
  front_url: string;
  back_url: string;
  email?: string;
  user_email?: string;
  ai_grading: SportsAIGrading | null;
  stage1_observations?: {
    observations?: Array<{
      id: string;
      location: string;
      type: string;
      description: string;
      estimated_size_mm?: number;
      visibility?: string;
      how_distinguished_from_glare?: string;
      confidence?: string;
    }>;
    image_quality?: {
      resolution?: string;
      lighting?: string;
      angle?: string;
      clarity?: string;
      glare_present?: boolean;
      obstructions?: string;
      overall_score?: number;
      confidence_tier?: string;
    };
    autograph?: {
      has_handwriting?: boolean;
      signature_location?: string;
      authentication_markers_found?: string[];
      authentication_type?: string;
    };
    front_centering?: {
      x_axis_ratio?: string;
      y_axis_ratio?: string;
      analysis?: string;
    };
    back_centering?: {
      x_axis_ratio?: string;
      y_axis_ratio?: string;
      analysis?: string;
    };
    card_information?: {
      player_name?: string;
      card_set?: string;
      card_year?: string;
      manufacturer?: string;
    };
    pristine_observations?: string[];
  } | null;
  opencv_detection?: {
    front?: any;
    back?: any;
  } | null;
  card_boundaries?: {
    front?: any;
    back?: any;
  } | null;
  raw_decimal_grade: number | null;
  dcm_grade_whole: number | null;
  ai_confidence_score: string;
  processing_time?: number;
  category: string;
  // Professional grading slab detection
  slab_detected?: boolean;
  slab_company?: string | null;
  slab_grade?: string | null;
  slab_grade_description?: string | null;
  slab_cert_number?: string | null;
  slab_serial?: string | null;
  slab_subgrades?: {
    centering?: number;
    corners?: number;
    edges?: number;
    surface?: number;
  } | null;
  slab_metadata?: {
    grade_date?: string;
    population?: string;
    label_type?: string;
    label_color?: string;
  } | null;
  slab_confidence?: string | null;
  slab_notes?: string | null;
  ai_vs_slab_comparison?: string | null;

  // 🎯 PRIMARY: Conversational AI grading v3.2 (2025-10-22)
  conversational_grading?: string | null;
  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_grade_uncertainty?: string | null;
  conversational_sub_scores?: {
    centering: { front: number; back: number; weighted: number };
    corners: { front: number; back: number; weighted: number };
    edges: { front: number; back: number; weighted: number };
    surface: { front: number; back: number; weighted: number };
  } | null;
  conversational_weighted_summary?: {
    front_weight: number;
    back_weight: number;
    weighted_total: number;
    grade_cap_reason: string | null;
  } | null;
  // v3.2 NEW fields
  conversational_condition_label?: string | null;
  conversational_image_confidence?: string | null;
  conversational_validation_checklist?: {
    autograph_verified: boolean;
    handwritten_markings: boolean;
    structural_damage: boolean;
    both_sides_present: boolean;
    confidence_letter: string;
    condition_label_assigned: boolean;
    all_steps_completed: boolean;
  } | null;
  conversational_front_summary?: string | null;
  conversational_back_summary?: string | null;
  conversational_card_info?: any;
  conversational_meta?: {
    prompt_version: string;
    evaluated_at_utc: string | null;
  } | null;
  // v3.2 Centering ratios (from API response)
  conversational_centering_ratios?: {
    front_lr: string | null;
    front_tb: string | null;
    back_lr: string | null;
    back_tb: string | null;
  } | null;

  // Professional grading company estimates (deterministic mapper)
  estimated_professional_grades?: {
    PSA: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    BGS: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    SGC?: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    TAG?: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    CGC?: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
    CSG?: {
      estimated_grade: string;
      numeric_score: number;
      confidence: 'high' | 'medium' | 'low';
      notes: string;
    };
  } | null;

  // DVG grading data (when DVG v2 is enabled)
  dvg_grading?: any;

  // Database fields for card info (from conversational AI or manual entry)
  card_name?: string | null;
  featured?: string | null;
  card_set?: string | null;
  release_date?: string | null;
  manufacturer_name?: string | null;
  card_number?: string | null;
  sport?: string | null;
  serial_numbering?: string | null;
  rookie_card?: boolean;
  subset?: string | null;
  rarity_tier?: string | null;
  autograph_type?: string | null;
  memorabilia_type?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

const renderValue = (value: any) => {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return "N/A";
  }
  // Handle objects by converting to string or returning "N/A"
  if (typeof value === 'object' && value !== null) {
    // If it's an array, join with commas
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : "N/A";
    }
    // For other objects, return "N/A" to avoid rendering errors
    return "N/A";
  }
  return value;
};

const formatGrade = (grade: number | null) => {
  // 🔧 FIX: Treat 0, null, and undefined as N/A (0 is not a valid grade)
  if (grade === null || grade === undefined || grade === 0) {
    return "N/A";
  }
  // If the grade is a whole number (e.g., 10.0, 9.0), display without decimal
  // Otherwise keep the decimal (e.g., 9.5, 8.5)
  return grade % 1 === 0 ? Math.floor(grade).toString() : grade.toString();
};

// Helper: Map confidence score to uncertainty value
const getUncertaintyFromConfidence = (confidence: string | null | undefined): string => {
  if (!confidence) return '±0.5'; // Default to B confidence

  const conf = confidence.toUpperCase().trim();
  switch (conf) {
    case 'A': return '±0.25';
    case 'B': return '±0.5';
    case 'C': return '±1.0';
    case 'D': return '±1.5';
    default: return '±0.5'; // Default to B confidence
  }
};

const getGradeColor = (grade: string | number) => {
  const numGrade = typeof grade === 'string' ? parseFloat(grade) : grade;
  if (numGrade >= 9.5) return 'text-green-600 font-bold';
  if (numGrade >= 8.5) return 'text-blue-600 font-semibold';
  if (numGrade >= 7.0) return 'text-yellow-600 font-semibold';
  if (numGrade >= 5.0) return 'text-orange-600';
  return 'text-red-600';
};

// Helper: Format date as "Month Day, Year"
const formatGradedDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    return 'N/A';
  }
};

// Helper: Format conversational grading markdown with professional styling (v3.5 PATCHED v2 optimized)
const formatConversationalGrading = (markdown: string): string => {
  console.log('[FRONTEND] formatConversationalGrading called, markdown length:', markdown?.length);

  if (!markdown) {
    console.log('[FRONTEND] No markdown provided, returning empty string');
    return '';
  }

  console.log('[FRONTEND] First 500 chars of markdown:', markdown.substring(0, 500));

  // Strip out parser-only blocks
  let cleaned = markdown
    .replace(/:::SUBSCORES[\s\S]*?:::END/g, '')
    .replace(/:::CHECKLIST[\s\S]*?:::END/g, '')
    .replace(/:::META[\s\S]*?:::END/g, '');

  console.log('[FRONTEND] After cleaning, length:', cleaned.length);
  console.log('[FRONTEND] First 500 chars after cleaning:', cleaned.substring(0, 500));

  // Split by steps using v3.5 format: ## [STEP N] TITLE
  const stepRegex = /## \[STEP (\d+)\] (.+?)(?=## \[STEP|$)/gs;
  const steps = new Map<number, { title: string; content: string }>();

  let match;
  while ((match = stepRegex.exec(cleaned)) !== null) {
    const stepNumber = parseInt(match[1]);
    const stepTitle = match[2].trim();
    const stepContent = match[0].replace(/## \[STEP \d+\] .+?\n/, '').trim();
    steps.set(stepNumber, { title: stepTitle, content: stepContent });
    console.log(`[FRONTEND] Matched STEP ${stepNumber}: ${stepTitle}`);
  }

  console.log(`[FRONTEND] Rendering ${steps.size} steps:`, Array.from(steps.keys()));

  let html = '';
  let frontEvalContent = '';

  // Render steps in order using explicit switch
  steps.forEach((step, stepNumber) => {
    switch (stepNumber) {
      case 0: // ALTERATION DETECTION (optional)
        html += renderStandardSection(step.title, step.content);
        break;

      case 1: // CARD INFORMATION EXTRACTION
        html += renderCardInfoSection(step.title, step.content);
        break;

      case 2: // IMAGE QUALITY & CONFIDENCE ASSESSMENT
        html += renderImageQualitySection(step.title, step.content);
        break;

      case 3: // FRONT EVALUATION
        frontEvalContent = step.content;
        break;

      case 4: // BACK EVALUATION
        html += renderFrontBackEvaluationSections(frontEvalContent, step.content);
        break;

      case 5: // SIDE-TO-SIDE CROSS-VERIFICATION
        html += renderCrossVerificationSection(step.title, step.content);
        break;

      case 6: // DEFECT PATTERN ANALYSIS
        html += renderDefectPatternSection(step.title, step.content);
        break;

      case 10: // FINAL GRADE CALCULATION AND REPORT
        html += renderFinalCalculationSection(step.title, step.content);
        break;

      case 14: // STATISTICAL & CONSERVATIVE CONTROL
        html += renderStatisticalControlSection(step.title, step.content);
        break;

      case 15: // APPENDIX – DEFINITIONS
        html += renderAppendixSection(step.title, step.content);
        break;

      // Skip technical steps: 7, 8, 9, 11, 12, 13, 16
      default:
        console.log(`[FRONTEND] Skipping technical STEP ${stepNumber}: ${step.title}`);
        break;
    }
  });

  return html;
};

// Render Functions for Each Step Type

function renderCardInfoSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'card-info');
}

function renderImageQualitySection(title: string, content: string): string {
  return renderStandardSection(title, content, 'image-quality');
}

function renderFrontBackEvaluationSections(frontContent: string, backContent: string): string {
  return `
    <div class="my-6">
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-l-4 border-blue-500 shadow-sm">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <h3 class="text-lg font-bold text-blue-900">Front Evaluation</h3>
          </div>
          ${formatEvaluationSubsections(frontContent)}
        </div>
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-l-4 border-green-500 shadow-sm">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <h3 class="text-lg font-bold text-green-900">Back Evaluation</h3>
          </div>
          ${formatEvaluationSubsections(backContent)}
        </div>
      </div>
    </div>
  `;
}

function formatEvaluationSubsections(content: string): string {
  // Split by subsections: ### A. Centering, ### B. Corners, etc.
  const subsectionRegex = /### ([A-D])\. (.+?)(?=###|$)/gs;
  let html = '<div class="space-y-4">';

  let match;
  while ((match = subsectionRegex.exec(content)) !== null) {
    const letter = match[1];
    const subsectionTitle = match[2].trim();
    const subsectionContent = match[0].replace(/### [A-D]\. .+?\n/, '').trim();

    html += `
      <div class="border-l-2 border-gray-300 pl-4">
        <h4 class="text-sm font-bold text-gray-800 mb-2">${letter}. ${subsectionTitle}</h4>
        ${formatBulletList(subsectionContent)}
      </div>
    `;
  }

  html += '</div>';
  return html;
}

function renderCrossVerificationSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'cross-verification');
}

function renderDefectPatternSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'defect-pattern');
}

function renderFinalCalculationSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'final-calculation');
}

function renderStatisticalControlSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'statistical');
}

function renderAppendixSection(title: string, content: string): string {
  return renderStandardSection(title, content, 'appendix');
}

function renderStandardSection(title: string, content: string, type?: string): string {
  const icon = getSectionIcon(type || title);

  return `
    <div class="my-6">
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border-l-4 border-indigo-500 shadow-sm">
        <div class="flex items-center gap-3 mb-4">
          ${icon}
          <h3 class="text-lg font-bold text-gray-900">${escapeHtml(title)}</h3>
        </div>
        ${formatBulletList(content)}
      </div>
    </div>
  `;
}

function getSectionIcon(type: string): string {
  if (type.includes('card-info') || type.includes('CARD INFORMATION')) {
    return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/></svg>';
  } else if (type.includes('image-quality') || type.includes('IMAGE QUALITY')) {
    return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
  } else if (type.includes('final-calculation') || type.includes('FINAL GRADE')) {
    return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';
  } else {
    return '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>';
  }
}

function formatBulletList(content: string): string {
  const lines = content.trim().split('\n');
  let html = '<div class="space-y-2">';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Bullet point: - **Key**: Value
    if (trimmed.startsWith('-')) {
      const bulletText = trimmed.substring(1).trim();

      // Check for key-value format: **Key**: Value
      const kvMatch = bulletText.match(/\*\*(.+?)\*\*:\s*(.+)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2];
        html += `
          <div class="flex items-start gap-2 pl-4">
            <span class="text-indigo-600 mt-1">•</span>
            <div>
              <span class="font-semibold text-gray-900">${escapeHtml(key)}:</span>
              <span class="text-gray-700"> ${escapeHtml(value)}</span>
            </div>
          </div>
        `;
      } else {
        // Plain bullet point
        html += `
          <div class="flex items-start gap-2 pl-4">
            <span class="text-indigo-600 mt-1">•</span>
            <span class="text-gray-700">${escapeHtml(bulletText)}</span>
          </div>
        `;
      }
    }
    // Regular paragraph
    else {
      html += `<p class="text-gray-700 leading-relaxed">${escapeHtml(trimmed)}</p>`;
    }
  }

  html += '</div>';
  return html;
}

// Helper: Format a section with header
function formatSection(section: string, title: string): string {
  const titleMatch = section.match(/### (.+)/);
  const actualTitle = title || (titleMatch ? titleMatch[1] : '');
  const content = section.replace(/### .+\n?/, '');

  let icon = '';
  if (actualTitle.includes('Overall Impression')) {
    icon = '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
  } else if (actualTitle.includes('Image Quality') || actualTitle.includes('IMAGE QUALITY')) {
    icon = '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
  } else if (actualTitle.includes('Score') || actualTitle.includes('Grade') || actualTitle.includes('Sub')) {
    icon = '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>';
  } else if (actualTitle.includes('CARD INFORMATION') || actualTitle.includes('Card Information')) {
    icon = '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/></svg>';
  } else {
    icon = '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>';
  }

  const formattedContent = formatSectionContent(content);

  if (actualTitle) {
    return `<div class="my-6">
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border-l-4 border-indigo-500 shadow-sm">
        <div class="flex items-center gap-3 mb-4">
          ${icon}
          <h3 class="text-lg font-bold text-gray-900">${escapeHtml(actualTitle)}</h3>
        </div>
        ${formattedContent}
      </div>
    </div>`;
  }

  return formattedContent;
}

// Helper: Format section content (subsections, lists, tables, text)
function formatSectionContent(content: string): string {
  if (!content || !content.trim()) return '';

  const lines = content.trim().split('\n');
  let html = '<div class="space-y-3">';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Bullet point (starts with -)
    if (line.startsWith('- ')) {
      const text = line.substring(2).trim();
      // Check if it's a key-value pair (has colon)
      if (text.includes(':')) {
        const colonIndex = text.indexOf(':');
        const key = text.substring(0, colonIndex).trim();
        const value = text.substring(colonIndex + 1).trim();
        html += `<div class="flex items-start gap-2 pl-4">
          <span class="text-indigo-600 mt-1">•</span>
          <div><span class="font-semibold text-gray-900">${escapeHtml(key)}:</span> <span class="text-gray-700">${escapeHtml(value)}</span></div>
        </div>`;
      } else {
        html += `<div class="flex items-start gap-2 pl-4">
          <span class="text-indigo-600 mt-1">•</span>
          <span class="text-gray-700">${escapeHtml(text)}</span>
        </div>`;
      }
    }
    // Bold header (starts with **)
    else if (line.startsWith('**') && line.includes(':**')) {
      const headerText = line.replace(/\*\*/g, '').replace(':', '').trim();
      html += `<h4 class="font-bold text-gray-900 mt-4 mb-2">${escapeHtml(headerText)}</h4>`;
    }
    // Regular paragraph
    else {
      html += `<p class="text-gray-700 leading-relaxed">${escapeHtml(line)}</p>`;
    }
  }

  html += '</div>';
  return html;
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: Parse content into card-based sections
function parseSectionsIntoCards(content: string): string[] {
  const lines = content.split('\n');
  const cards: string[] = [];
  let currentSection: { title: string; items: string[] } | null = null;

  // Main section names we're looking for
  const mainSections = ['centering', 'corners', 'edges', 'surface'];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a MAIN section header (bold text with colon)
    const sectionMatch = trimmed.match(/\*\*([^*:]+):\*\*/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();

      // Only treat as section header if it's one of the main sections
      const isMainSection = mainSections.some(main =>
        sectionName.toLowerCase().includes(main)
      );

      if (isMainSection) {
        // Save previous section
        if (currentSection) {
          cards.push(createSectionCard(currentSection.title, currentSection.items));
        }
        // Start new section
        currentSection = { title: sectionName, items: [] };
        continue;
      }
    }

    // Skip HTML (tables already processed)
    if (trimmed.startsWith('<')) {
      if (currentSection) {
        currentSection.items.push(line);
      }
      continue;
    }

    // Add content to current section
    if (currentSection && trimmed.startsWith('- ')) {
      const content = trimmed.substring(2).trim();
      // Remove any bold markdown markers
      const cleanContent = content.replace(/\*\*/g, '');
      currentSection.items.push(cleanContent);
    } else if (currentSection && trimmed) {
      // Remove any bold markdown markers
      const cleanContent = trimmed.replace(/\*\*/g, '');
      currentSection.items.push(cleanContent);
    }
  }

  // Save last section
  if (currentSection) {
    cards.push(createSectionCard(currentSection.title, currentSection.items));
  }

  return cards;
}

// Helper: Create a beautiful card for each section
function createSectionCard(title: string, items: string[]): string {
  if (items.length === 0) return '';

  // Determine icon and color based on section title
  let icon = '📊';
  let colorClass = 'indigo';

  if (title.toLowerCase().includes('centering')) {
    icon = '🎯';
    colorClass = 'blue';
  } else if (title.toLowerCase().includes('corner')) {
    icon = '📐';
    colorClass = 'purple';
  } else if (title.toLowerCase().includes('edge')) {
    icon = '✂️';
    colorClass = 'green';
  } else if (title.toLowerCase().includes('surface')) {
    icon = '✨';
    colorClass = 'amber';
  }

  const bgColor = `bg-${colorClass}-50`;
  const borderColor = `border-${colorClass}-200`;
  const headerBg = `bg-${colorClass}-100`;
  const headerText = `text-${colorClass}-900`;
  const tableBorder = `border-${colorClass}-300`;

  // Separate items into table rows and general text
  const tableRows: { label: string; value: string }[] = [];
  const generalText: string[] = [];

  for (const item of items) {
    // Skip HTML
    if (item.startsWith('<')) {
      generalText.push(item);
      continue;
    }

    // Check if it's a label-value pair
    if (item.includes(':')) {
      const colonIndex = item.indexOf(':');
      const label = item.substring(0, colonIndex).trim();
      const value = item.substring(colonIndex + 1).trim();

      // Skip if label starts with "Overall" - that's summary text
      if (label.toLowerCase().startsWith('overall')) {
        generalText.push(item);
      } else if (value) {
        tableRows.push({ label, value });
      } else {
        generalText.push(item);
      }
    } else {
      // Regular text
      generalText.push(item);
    }
  }

  // Build card content
  let cardContent = `
    <div class="${bgColor} border ${borderColor} rounded-lg shadow-sm overflow-hidden">
      <div class="${headerBg} px-4 py-2 border-b ${borderColor}">
        <div class="flex items-center gap-2">
          <span class="text-xl">${icon}</span>
          <span class="font-bold ${headerText} text-base">${title}</span>
        </div>
      </div>
      <div class="p-4">`;

  // Add table if we have structured data
  if (tableRows.length > 0) {
    cardContent += `
        <table class="w-full text-sm border ${tableBorder} rounded overflow-hidden">
          <tbody>`;

    for (const row of tableRows) {
      cardContent += `
            <tr class="border-b ${tableBorder} last:border-b-0">
              <td class="px-3 py-2 font-semibold text-gray-700 bg-white bg-opacity-50 w-1/3">${row.label}</td>
              <td class="px-3 py-2 text-gray-600">${row.value}</td>
            </tr>`;
    }

    cardContent += `
          </tbody>
        </table>`;
  }

  // Add general text items
  if (generalText.length > 0) {
    cardContent += `<div class="mt-3 space-y-2">`;
    for (const text of generalText) {
      if (text.startsWith('<')) {
        cardContent += text;
      } else {
        cardContent += `<div class="text-gray-600 text-sm italic">${text}</div>`;
      }
    }
    cardContent += `</div>`;
  }

  cardContent += `
      </div>
    </div>`;

  return cardContent;
}

// Helper: Process only table content
function processTablesOnly(content: string): string {
  if (!content.includes('|')) return content;

  // Split by lines
  const lines = content.split('\n');
  const result: string[] = [];
  let tableRows: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a table line
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Check if it's a separator line (|---|---|)
      if (trimmed.match(/^\|[\s\-|]+\|$/)) {
        continue; // Skip separator lines
      }

      // Parse table row
      const cells = trimmed
        .substring(1, trimmed.length - 1)
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);

      if (cells.length > 0) {
        // Determine if header row
        const isHeader = cells.some(cell =>
          cell.toLowerCase().includes('category') ||
          cell.toLowerCase().includes('front') ||
          cell.toLowerCase().includes('back') ||
          cell.toLowerCase().includes('weighted')
        );

        if (isHeader) {
          tableRows.push(`<tr class="bg-indigo-100">${cells.map(cell =>
            `<th class="px-4 py-2 text-left font-bold text-indigo-900 border border-indigo-200">${cell}</th>`
          ).join('')}</tr>`);
        } else {
          tableRows.push(`<tr class="hover:bg-gray-50">${cells.map(cell =>
            `<td class="px-4 py-2 text-gray-700 border border-gray-200">${cell}</td>`
          ).join('')}</tr>`);
        }
        inTable = true;
      }
    } else {
      // Not a table line
      if (inTable && tableRows.length > 0) {
        // Close previous table
        result.push('<div class="overflow-x-auto my-6"><table class="min-w-full border-collapse rounded-lg overflow-hidden shadow-sm">');
        result.push(tableRows.join('\n'));
        result.push('</table></div>');
        tableRows = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  // Close any remaining table
  if (tableRows.length > 0) {
    result.push('<div class="overflow-x-auto my-6"><table class="min-w-full border-collapse rounded-lg overflow-hidden shadow-sm">');
    result.push(tableRows.join('\n'));
    result.push('</table></div>');
  }

  return result.join('\n');
}

// Helper: Generate structured data (JSON-LD) for SEO
function generateStructuredData(card: any, dvgGrading: any, cardUrl: string) {
  const playerName = dvgGrading?.card_info?.player_or_character || card.featured || '';
  const year = dvgGrading?.card_info?.year || card.release_date || '';
  const manufacturer = dvgGrading?.card_info?.manufacturer || '';
  const setName = dvgGrading?.card_info?.set_name || card.card_set || '';
  const grade = dvgGrading?.recommended_grade?.recommended_decimal_grade;
  const cardName = dvgGrading?.card_info?.card_name || card.card_name || '';
  const subset = dvgGrading?.card_info?.subset || '';

  // Build full card name
  const fullCardName = [playerName, year, manufacturer, setName, subset]
    .filter(p => p)
    .join(' ') || cardName;

  // Build description
  const gradeText = grade !== null && grade !== undefined ? `${grade}/10` : 'N/A';
  const description = `${fullCardName} - DCM graded ${gradeText}. Professional sports card grading with DCM-powered analysis.`;

  // Special features
  const isRookie = dvgGrading?.rarity_features?.rookie_or_first === 'true' ||
                   dvgGrading?.rarity_features?.feature_tags?.includes('rookie_card');
  const hasAuto = dvgGrading?.rarity_features?.autograph?.present;

  const additionalProperties = [];

  if (year) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Year',
      value: year
    });
  }

  if (manufacturer) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Manufacturer',
      value: manufacturer
    });
  }

  if (setName) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Set',
      value: setName
    });
  }

  if (grade !== null && grade !== undefined) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'DCM Grade',
      value: gradeText
    });
  }

  if (isRookie) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Card Type',
      value: 'Rookie Card'
    });
  }

  if (hasAuto) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Autograph',
      value: 'Yes'
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: fullCardName,
    description: description,
    image: card.front_url,
    brand: manufacturer ? {
      '@type': 'Brand',
      name: manufacturer
    } : undefined,
    aggregateRating: grade !== null && grade !== undefined ? {
      '@type': 'AggregateRating',
      ratingValue: grade,
      bestRating: 10,
      worstRating: 1,
      ratingCount: 1
    } : undefined,
    additionalProperty: additionalProperties,
    url: cardUrl
  };
}

export function OtherCardDetails() {
  const params = useParams<{ id: string }>();
  const cardId = params?.id;
  const router = useRouter();
  const [card, setCard] = useState<SportsCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStage1Observations, setShowStage1Observations] = useState(false);
  const [showConversationalGrading, setShowConversationalGrading] = useState(false); // 🧪 Experimental
  const [activeTab, setActiveTab] = useState<'analysis' | 'centering' | 'corners' | 'surface' | 'professional' | 'market' | 'details'>('analysis'); // 🗂️ Tab navigation
  const [zoomModal, setZoomModal] = useState<{isOpen: boolean, imageUrl: string, alt: string, title: string}>({
    isOpen: false,
    imageUrl: '',
    alt: '',
    title: ''
  });
  // 🔒 Visibility state (default: public for new cards)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);
  // 🐛 Parsing error state
  const [parsingError, setParsingError] = useState<string | null>(null);
  // 📦 Parsed defects state
  const [conversationalDefects, setConversationalDefects] = useState<CardDefects | null>(null);

  // Fetch Other Card Details using MTG-specific API
  const fetchOtherCardDetails = useCallback(async () => {
    if (!cardId) return;

    try {
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      console.log(`[FRONTEND DEBUG] Calling MTG API endpoint: /api/other/${cardId}`);
      const res = await fetch(`/api/other/${cardId}?t=${Date.now()}`); // Cache-busting
      console.log(`[FRONTEND DEBUG] MTG API response status: ${res.status}`);

      if (!res.ok) {
        // Check for private card access denied (403 status)
        if (res.status === 403) {
          const errorData = await res.json();
          console.log('🔒 Private card access denied:', errorData);
          setError('PRIVATE_CARD');
          setLoading(false);
          return;
        }

        // Check for alteration error (400 status with CARD_ALTERED error)
        if (res.status === 400) {
          const errorData = await res.json();
          if (errorData.error === 'CARD_ALTERED') {
            console.error('Card alteration detected:', errorData);
            setError(`CARD ALTERED: ${errorData.details || 'This card has been altered and cannot be graded.'}\n\n${errorData.recommendation || ''}`);
            setLoading(false);
            setCard({
              ...errorData,
              is_altered: true,
              alteration_detected: true
            } as any);
            return;
          }
        }

        if (res.status === 429) {
          console.log('Sports card is being processed, showing processing state...');
          setIsProcessing(true);
          setLoading(false);

          // Auto-retry with visual feedback
          const retryWithBackoff = async (attempt: number = 1): Promise<void> => {
            if (attempt > 5) {
              setError('Processing is taking longer than expected. The card analysis is still running in the background.');
              setIsProcessing(false);
              return;
            }

            const delay = 3000 * attempt; // 3s, 6s, 9s, 12s, 15s
            console.log(`Auto-retry attempt ${attempt}/5 in ${delay/1000} seconds...`);

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
              console.log(`[FRONTEND DEBUG] Retry ${attempt}: Calling /api/other/${cardId}`);
              const retryRes = await fetch(`/api/other/${cardId}?t=${Date.now()}`); // Cache-busting

              if (retryRes.ok) {
                const data = await retryRes.json();
                console.log('[FRONTEND DEBUG] DVG v1 card data received after retry:', data);
                console.log('🧪 Conversational grading after retry:', data.conversational_grading ? `${data.conversational_grading.substring(0, 100)}...` : 'NULL');
                setCard(data);
                setVisibility(data.visibility || 'private');
                setIsProcessing(false);
                return;
              }

              if (retryRes.status === 429) {
                // Still processing, continue retrying
                await retryWithBackoff(attempt + 1);
              } else {
                throw new Error(`Failed to load sports card: ${retryRes.status}`);
              }
            } catch (error) {
              console.error(`Retry attempt ${attempt} failed:`, error);
              await retryWithBackoff(attempt + 1);
            }
          };

          await retryWithBackoff();
          return;
        }
        throw new Error(`Failed to load sports card: ${res.status}`);
      }

      const data = await res.json();
      console.log('Sports card data received:', data);
      console.log('OpenCV detection in response:', data.opencv_detection);
      console.log('🧪 Conversational grading in response:', data.conversational_grading ? `${data.conversational_grading.substring(0, 100)}...` : 'NULL');
      setCard(data);
      // Initialize visibility from card data
      setVisibility(data.visibility || 'private');

    } catch (e: any) {
      console.error('Sports card fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  // Single fetch on mount
  useEffect(() => {
    if (cardId) {
      console.log('Fetching Other Card Details for:', cardId);
      fetchOtherCardDetails();
    }
  }, [cardId, fetchOtherCardDetails]);

  // Set origin for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // 📦 Parse defects when card data changes
  useEffect(() => {
    if (!card) {
      setConversationalDefects(null);
      setParsingError(null);
      return;
    }

    try {
      // Priority 1: Use structured data from database (parsed on backend)
      if (card.conversational_defects_front && card.conversational_defects_back) {
        console.log('[Defects] ✅ Using structured data from database (no parsing needed)');
        console.log('[Defects] 🐛 DEBUG front:', JSON.stringify(card.conversational_defects_front, null, 2));
        console.log('[Defects] 🐛 DEBUG back:', JSON.stringify(card.conversational_defects_back, null, 2));
        console.log('[Defects] 🐛 DEBUG front.corners type:', typeof card.conversational_defects_front.corners);
        console.log('[Defects] 🐛 DEBUG front.corners value:', card.conversational_defects_front.corners);
        setConversationalDefects({
          front: card.conversational_defects_front,
          back: card.conversational_defects_back
        } as CardDefects);
        setParsingError(null);
      }
      // Priority 2: Fall back to regex parsing (backward compatibility)
      else if (card.conversational_grading) {
        console.log('[Defects] ⚠️ No structured data found, falling back to regex parsing');
        const parsed = parseConversationalDefects(card.conversational_grading);

        if (parsed) {
          console.log('[Conversational Parser] ✅ Successfully parsed defects from markdown');
          setConversationalDefects(parsed);
          setParsingError(null);
        } else {
          const errorMsg = 'Grading report format not recognized. Some details may be unavailable.';
          setParsingError(errorMsg);
          setConversationalDefects(null);
          console.warn('[Conversational Parser] ⚠️ Parser returned null');
        }
      }
      // Priority 3: No data available
      else {
        setParsingError('No grading data available from analysis.');
        setConversationalDefects(null);
        console.warn('[Defects] ⚠️ No conversational_grading data');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      setParsingError(`Failed to load grading details: ${errorMsg}`);
      setConversationalDefects(null);
      console.error('[Defects Error] ❌ Failed to get defects:', error);
    }
  }, [card]);

  // Open zoom modal
  const openZoomModal = (imageUrl: string, alt: string, title: string) => {
    setZoomModal({
      isOpen: true,
      imageUrl,
      alt,
      title
    });
  };

  // Close zoom modal
  const closeZoomModal = () => {
    setZoomModal({
      isOpen: false,
      imageUrl: '',
      alt: '',
      title: ''
    });
  };


  // Re-grade card function - forces fresh grading with latest model
  const regradeCard = async () => {
    try {
      if (!card) return;

      const confirmed = confirm('Regrade card with the same uploaded images?');
      if (!confirmed) return;

      setLoading(true);
      setError(null);

      // Call MTG API with force_regrade parameter to bypass cache
      console.log('[REGRADE] Forcing fresh grading for Lorcana card:', cardId);
      const res = await fetch(`/api/other/${cardId}?force_regrade=true&t=${Date.now()}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to re-grade card');
      }

      const data = await res.json();
      console.log('[REGRADE] Fresh grading completed:', data);

      // Refresh the page to show new data
      window.location.reload();
    } catch (error: any) {
      console.error('Error re-grading card:', error);
      setError(error.message || 'Failed to re-grade card');
      alert(`Error re-grading card: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete card function
  const deleteCard = async () => {
    try {
      if (!card) return;

      setIsDeleting(true);

      const response = await fetch(`/api/sports/${card.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Delete failed:', errorData);
        throw new Error(errorData.error || 'Failed to delete card');
      }

      const result = await response.json();
      console.log('Card deletion result:', result);

      // Navigate back to collection page
      router.push('/collection');

    } catch (error: any) {
      console.error('Error deleting card:', error);
      alert(`Error deleting card: ${error.message || 'Please try again.'}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 🔒 Toggle card visibility
  const toggleVisibility = async () => {
    try {
      if (!card) return;

      const newVisibility = visibility === 'public' ? 'private' : 'public';

      setIsTogglingVisibility(true);

      // Get user session for authentication
      const session = getStoredSession();
      if (!session || !session.user) {
        throw new Error('You must be logged in to change visibility');
      }

      const response = await fetch(`/api/cards/${card.id}/visibility?user_id=${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update visibility');
      }

      const result = await response.json();
      console.log('✅ Visibility updated:', result);

      // Update local state
      setVisibility(newVisibility);
      setShowVisibilityConfirm(false);

      // Show success message
      alert(`Card is now ${newVisibility}! ${newVisibility === 'public' ? '🌐 Anyone can view and search for this card.' : '🔒 Only you can view this card. Shared links will no longer work.'}`);

    } catch (error: any) {
      console.error('Error toggling visibility:', error);
      alert(`Error updating visibility: ${error.message || 'Please try again.'}`);
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  if (loading || isProcessing) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-6"></div>
          <p className="text-lg">Finalizing analysis...</p>
          <p className="text-sm text-gray-500 mt-2">Almost ready!</p>
        </div>
      </div>
    );
  }

  if (error) {
    // 🔒 Special UI for private card access
    if (error === 'PRIVATE_CARD') {
      return (
        <div className="container mx-auto p-6 max-w-2xl">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-4 border-gray-400 rounded-2xl shadow-2xl p-12 text-center">
            {/* Lock Icon */}
            <div className="text-8xl mb-6">🔒</div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              This Card is Private
            </h1>

            {/* Message */}
            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Only the owner can view this card.
            </p>

            {/* Info Box */}
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-8 text-left">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">What does this mean?</h2>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2 text-xl">•</span>
                  <span>This card has been set to <strong>private</strong> by its owner</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2 text-xl">•</span>
                  <span>Private cards are <strong>not visible</strong> to other users</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2 text-xl">•</span>
                  <span>Private cards <strong>cannot be searched</strong> or shared</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">If this is your card, please log in to view it.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Log In
                </Link>
                <Link
                  href="/collection"
                  className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-lg"
                >
                  View Your Collection
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Regular error display
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Card Not Available</h1>
        <p className="text-gray-600 mb-6">This card no longer exists or is not viewable at this moment.</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/collection"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
          >
            My Collection
          </Link>
          <Link
            href="/upload?category=Other"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
          >
            Grade a Card
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Other Card Not Found</h1>
        <Link href="/other/upload" className="text-blue-500">
          Back to Lorcana Upload
        </Link>
      </div>
    );
  }

  // Debug: Check what data we have
  console.log('[Card Data Debug] Has conversational_grading?', !!card.conversational_grading);
  console.log('[Card Data Debug] conversational_grading length:', card.conversational_grading?.length || 0);
  console.log('[Card Data Debug] Has dvg_grading?', !!card.dvg_grading);
  console.log('[Card Data Debug] dvg_grading keys:', card.dvg_grading ? Object.keys(card.dvg_grading) : []);

  // Extract data from AI grading
  // DVG v1 data structure
  /**
   * ✨ NEW: Access structured defect data (no more regex parsing!)
   * Structured data is pre-parsed on backend and saved to database
   * Falls back to regex parsing only if structured data unavailable
   */
  function parseConversationalDefects(markdown: string | null | undefined) {
    if (!markdown) return null;

    const parseCorner = (text: string) => {
      const severity = text.match(/(Microscopic|Minor|Moderate|Heavy)/i)?.[1] || 'none';
      const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();
      return { severity: severity.toLowerCase(), description };
    };

    const parseEdge = (text: string) => {
      const severity = text.match(/(Microscopic|Minor|Moderate|Heavy|Clean)/i)?.[1] || 'none';
      const description = text.replace(/^-?\s*\*\*[^*]+\*\*:\s*/i, '').trim();
      return { severity: severity === 'Clean' ? 'none' : severity.toLowerCase(), description };
    };

    const parseSurface = (section: string) => {
      const defects = {
        scratches: { severity: 'none', description: 'No scratches detected' },
        creases: { severity: 'none', description: 'No creases detected' },
        print_defects: { severity: 'none', description: 'No print defects detected' },
        stains: { severity: 'none', description: 'No stains detected' },
        other: { severity: 'none', description: 'No other issues detected' }
      };

      // Look for surface mentions
      if (section.match(/scratch/i)) {
        const match = section.match(/([Mm]inor|[Mm]oderate|[Hh]eavy)?\s*(?:surface\s*)?scratch/i);
        const severity = match?.[1]?.toLowerCase() || 'minor';
        defects.scratches = {
          severity,
          description: section.match(/- ([^\n]*scratch[^\n]*)/i)?.[1]?.trim() || 'Surface scratch detected'
        };
      }

      if (section.match(/crease/i)) {
        defects.creases = {
          severity: 'moderate',
          description: section.match(/- ([^\n]*crease[^\n]*)/i)?.[1]?.trim() || 'Crease detected'
        };
      }

      if (section.match(/print/i)) {
        defects.print_defects = {
          severity: 'minor',
          description: section.match(/- ([^\n]*print[^\n]*)/i)?.[1]?.trim() || 'Print defect detected'
        };
      }

      if (section.match(/stain|discolor/i)) {
        defects.stains = {
          severity: 'minor',
          description: section.match(/- ([^\n]*(?:stain|discolor)[^\n]*)/i)?.[1]?.trim() || 'Staining detected'
        };
      }

      // If no defects found, check for "clean" or "no visible" statements
      if (section.match(/clean|no visible|no major/i) && !section.match(/scratch|crease|print|stain/i)) {
        defects.other = { severity: 'none', description: 'Surface appears clean' };
      }

      return defects;
    };

    // Extract STEP 3 (Front) and STEP 4 (Back)
    const frontMatch = markdown.match(/\[STEP 3\] FRONT ANALYSIS[\s\S]*?(?=\[STEP 4\]|$)/i);
    const backMatch = markdown.match(/\[STEP 4\] BACK ANALYSIS[\s\S]*?(?=\[STEP 5\]|$)/i);

    const extractDefects = (sectionText: string) => {
      // Extract corners
      const cornersSection = sectionText.match(/CORNERS.*?\((?:Front|Back)\)[\s\S]*?(?=EDGES|$)/i)?.[0] || '';
      const corners = {
        top_left: parseCorner(cornersSection.match(/-?\s*Top Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
        top_right: parseCorner(cornersSection.match(/-?\s*Top Right:\s*([^\n]+)/i)?.[1] || 'Clean'),
        bottom_left: parseCorner(cornersSection.match(/-?\s*Bottom Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
        bottom_right: parseCorner(cornersSection.match(/-?\s*Bottom Right:\s*([^\n]+)/i)?.[1] || 'Clean')
      };

      // Extract edges
      const edgesSection = sectionText.match(/EDGES.*?\((?:Front|Back)\)[\s\S]*?(?=SURFACE|$)/i)?.[0] || '';
      const edges = {
        top: parseEdge(edgesSection.match(/-?\s*Top:\s*([^\n]+)/i)?.[1] || 'Clean'),
        bottom: parseEdge(edgesSection.match(/-?\s*Bottom:\s*([^\n]+)/i)?.[1] || 'Clean'),
        left: parseEdge(edgesSection.match(/-?\s*Left:\s*([^\n]+)/i)?.[1] || 'Clean'),
        right: parseEdge(edgesSection.match(/-?\s*Right:\s*([^\n]+)/i)?.[1] || 'Clean')
      };

      // Extract surface
      const surfaceSection = sectionText.match(/SURFACE.*?\((?:Front|Back)\)[\s\S]*?(?=COLOR|FEATURE|FRONT SUMMARY|BACK SUMMARY|$)/i)?.[0] || '';
      const surface = parseSurface(surfaceSection);

      return { corners, edges, surface };
    };

    const frontDefects = frontMatch ? extractDefects(frontMatch[0]) : null;
    const backDefects = backMatch ? extractDefects(backMatch[0]) : null;

    if (!frontDefects && !backDefects) return null;

    return {
      front: frontDefects || {
        corners: {
          top_left: { severity: 'none', description: 'No data' },
          top_right: { severity: 'none', description: 'No data' },
          bottom_left: { severity: 'none', description: 'No data' },
          bottom_right: { severity: 'none', description: 'No data' }
        },
        edges: {
          top: { severity: 'none', description: 'No data' },
          bottom: { severity: 'none', description: 'No data' },
          left: { severity: 'none', description: 'No data' },
          right: { severity: 'none', description: 'No data' }
        },
        surface: {
          scratches: { severity: 'none', description: 'No data' },
          creases: { severity: 'none', description: 'No data' },
          print_defects: { severity: 'none', description: 'No data' },
          stains: { severity: 'none', description: 'No data' },
          other: { severity: 'none', description: 'No data' }
        }
      },
      back: backDefects || {
        corners: {
          top_left: { severity: 'none', description: 'No data' },
          top_right: { severity: 'none', description: 'No data' },
          bottom_left: { severity: 'none', description: 'No data' },
          bottom_right: { severity: 'none', description: 'No data' }
        },
        edges: {
          top: { severity: 'none', description: 'No data' },
          bottom: { severity: 'none', description: 'No data' },
          left: { severity: 'none', description: 'No data' },
          right: { severity: 'none', description: 'No data' }
        },
        surface: {
          scratches: { severity: 'none', description: 'No data' },
          creases: { severity: 'none', description: 'No data' },
          print_defects: { severity: 'none', description: 'No data' },
          stains: { severity: 'none', description: 'No data' },
          other: { severity: 'none', description: 'No data' }
        }
      }
    };
  }

  // ✨ Defects are now parsed in useEffect (see lines 1203-1249)
  // This prevents infinite re-renders by keeping setState calls out of render phase

  // Extract condition summary from conversational markdown
  const extractConditionSummary = (markdown: string | null | undefined): string | null => {
    if (!markdown) return null;

    // Try to extract from STEP 6 Visual Condition Framework or similar sections
    const summaryMatch = markdown.match(/\[STEP 6\] VISUAL CONDITION FRAMEWORK[\s\S]*?(?=\[STEP 7\]|$)/i);
    if (summaryMatch) {
      const section = summaryMatch[0];
      // Extract bullet points or summary text
      const lines = section.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .join('. ');

      if (lines) return lines;
    }

    // Fallback: extract from Step 10 Final Grade Calculation
    const finalMatch = markdown.match(/\[STEP 10\][\s\S]*?Condition Label.*?:\s*([^\n]+)/i);
    if (finalMatch) {
      return `Card condition: ${finalMatch[1].trim()}`;
    }

    return null;
  };

  const conversationalSummary = extractConditionSummary(card.conversational_grading);

  // Extract centering analysis text from conversational grading
  const extractCenteringAnalysis = (markdown: string | null | undefined): { front: string | null, back: string | null } => {
    // 🎯 PRIORITY: Use pre-parsed database fields if available (v3.5 parser)
    if (card.conversational_front_summary || card.conversational_back_summary) {
      console.log('[Centering Analysis] Using pre-parsed database fields');
      return {
        front: card.conversational_front_summary || null,
        back: card.conversational_back_summary || null
      };
    }

    // ⚠️ FALLBACK: Parse from markdown for backward compatibility
    console.log('[Centering Analysis] Falling back to markdown parsing');
    if (!markdown) return { front: null, back: null };

    // Extract from Step 3 (Front Evaluation)
    const frontMatch = markdown.match(/##\s*\[STEP 3\]\s*FRONT EVALUATION[\s\S]*?(?=##\s*\[STEP|$)/i);
    let frontAnalysis: string | null = null;
    if (frontMatch) {
      // Look for "- **Centering Analysis**: text"
      const centeringAnalysisMatch = frontMatch[0].match(/-\s*\*\*Centering Analysis\*\*:\s*([^\n]+)/i);
      if (centeringAnalysisMatch) {
        frontAnalysis = centeringAnalysisMatch[1].trim();
      }
    }

    // Extract from Step 4 (Back Evaluation)
    const backMatch = markdown.match(/##\s*\[STEP 4\]\s*BACK EVALUATION[\s\S]*?(?=##\s*\[STEP|$)/i);
    let backAnalysis: string | null = null;
    if (backMatch) {
      // Look for "- **Back Centering Analysis**: text"
      const centeringAnalysisMatch = backMatch[0].match(/-\s*\*\*Back Centering Analysis\*\*:\s*([^\n]+)/i);
      if (centeringAnalysisMatch) {
        backAnalysis = centeringAnalysisMatch[1].trim();
      }
    }

    return { front: frontAnalysis, back: backAnalysis };
  };

  const centeringAnalysisText = extractCenteringAnalysis(card.conversational_grading);

  // Debug logging
  console.log('[Centering Analysis Debug]', {
    hasFront: !!centeringAnalysisText.front,
    hasBack: !!centeringAnalysisText.back,
    frontText: centeringAnalysisText.front,
    backText: centeringAnalysisText.back
  });

  // More detailed debug - show all section headers
  if (card.conversational_grading) {
    // Find all lines that look like section headers (start with ## or [STEP)
    const headers = card.conversational_grading.match(/^##?\s*\[?STEP.*$/gm) || [];
    console.log('[Section Headers Found]', headers);

    // Also try to find "Centering Analysis" anywhere in the text
    const centeringMatches = card.conversational_grading.match(/.{0,100}Centering Analysis.{0,100}/g);
    console.log('[Centering Analysis Matches]', centeringMatches);
  }

  // ✨ Priority: Use structured conversational data FIRST, then fall back to legacy dvg_grading
  // Check BOTH state variable AND database fields
  const structuredDefects = conversationalDefects || (
    card.conversational_defects_front && card.conversational_defects_back ? {
      front: card.conversational_defects_front,
      back: card.conversational_defects_back
    } : null
  );

  // 🎯 For Lorcana cards: Build dvgGrading from conversational data
  const dvgGrading = {
    // Start with legacy data as base
    ...(card.dvg_grading && Object.keys(card.dvg_grading).length > 0 ? card.dvg_grading : {}),
    // Override with structured conversational data (always prioritize this)
    ...(structuredDefects ? {
      defects: structuredDefects,
      condition_summary: conversationalSummary || 'DCM condition analysis available in conversational report.',
      // Map to corners_assessment format (for tabs compatibility)
      corners_assessment: {
        front: structuredDefects.front.corners,
        back: structuredDefects.back.corners
      },
      // Map to edges_assessment format (for tabs compatibility)
      edges_assessment: {
        front: structuredDefects.front.edges,
        back: structuredDefects.back.edges
      },
      // Map to surface_assessment format (for tabs compatibility)
      surface_assessment: {
        front: structuredDefects.front.surface,
        back: structuredDefects.back.surface
      }
    } : {}),
    // 🆕 Always include sub_scores from conversational data for Lorcana cards
    ...(card.conversational_sub_scores ? {
      sub_scores: card.conversational_sub_scores
    } : {}),
    // 🆕 Include recommended_grade if we have conversational grade
    ...(card.conversational_decimal_grade ? {
      recommended_grade: {
        recommended_decimal_grade: card.conversational_decimal_grade,
        recommended_whole_grade: card.conversational_whole_grade,
        grade_uncertainty: card.conversational_grade_uncertainty
      }
    } : {})
  };

  // Helper function to safely convert and format numeric values
  const safeToFixed = (value: any, decimals: number = 1): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return (typeof num === 'number' && !isNaN(num)) ? num.toFixed(decimals) : '0.0';
  };

  // Professional grades are stored as a separate column (two-stage system)
  const professionalGrades = card.estimated_professional_grades || null;

  // 🎯 Card info - Use top-level database fields (populated by conversational AI)
  // Helper: Strip markdown formatting from text
  const stripMarkdown = (text: any): string | null => {
    if (!text) return null;
    // Convert to string if not already
    const str = typeof text === 'string' ? text : String(text);
    // Handle "null" string (AI sometimes returns this)
    if (str === 'null') return null;
    // Remove **bold** formatting
    return str.replace(/\*\*/g, '').trim();
  };

  // Helper: Extract English name from bilingual format for marketplace searches
  const extractEnglishForSearch = (text: any): string | null => {
    if (!text) return null;
    // Convert to string if not already
    const str = typeof text === 'string' ? text : String(text);

    // Check if text contains Japanese characters and bilingual format
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(str);
    if (!hasJapanese) return str; // Already English-only

    // Extract English from "Japanese (English)" format
    const parts = str.split(/[/()（）]/);
    const englishPart = parts.find((p: string) => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));

    return englishPart ? englishPart.trim() : str;
  };

  // 🎯 v3.2: Use conversational_card_info first, then database fields, then DVG fallback
  const cardInfo = {
    card_name: stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading.card_info?.card_name,
    player_or_character: stripMarkdown(card.conversational_card_info?.player_or_character) || card.pokemon_featured || card.featured || dvgGrading.card_info?.player_or_character,
    set_name: stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading.card_info?.set_name,
    set_era: stripMarkdown(card.conversational_card_info?.set_era) || dvgGrading.card_info?.set_era,  // 🆕 Set era fallback when set_name is unknown
    year: stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading.card_info?.year,
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading.card_info?.manufacturer,
    card_number: stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || dvgGrading.card_info?.card_number,
    sport_or_category: stripMarkdown(card.conversational_card_info?.sport_or_category) || card.category || dvgGrading.card_info?.sport_or_category,
    serial_number: stripMarkdown(card.conversational_card_info?.serial_number) || card.serial_numbering || dvgGrading.card_info?.serial_number,
    rookie_or_first: card.conversational_card_info?.rookie_or_first || card.rookie_card || dvgGrading.card_info?.rookie_or_first,
    subset: stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading.card_info?.subset,
    rarity_tier: stripMarkdown(card.conversational_card_info?.rarity_tier) || card.rarity_tier || card.rarity_description || dvgGrading.card_info?.rarity_tier,
    autographed: card.conversational_card_info?.autographed === true || card.autographed === true || card.autograph_type === 'authentic',
    memorabilia: card.conversational_card_info?.memorabilia === true || card.memorabilia_type !== 'none',
    card_front_text: card.conversational_card_info?.card_front_text || dvgGrading.card_info?.card_front_text,  // 🆕 Card front text (abilities, attacks)
    card_back_text: card.conversational_card_info?.card_back_text || dvgGrading.card_info?.card_back_text,  // 🆕 Card back description
    // Pokemon-specific fields
    pokemon_type: stripMarkdown(card.conversational_card_info?.pokemon_type) || card.pokemon_type || null,
    pokemon_stage: stripMarkdown(card.conversational_card_info?.pokemon_stage) || card.pokemon_stage || null,
    hp: stripMarkdown(card.conversational_card_info?.hp) || card.hp || null,
    card_type: stripMarkdown(card.conversational_card_info?.card_type) || card.card_type || null,
    // 🎯 OTHER-SPECIFIC FIELDS
    manufacturer: stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer || null,
    card_date: stripMarkdown(card.conversational_card_info?.card_date) || card.card_date || null,
    autographed: (card.conversational_card_info?.autographed === true || card.conversational_card_info?.autographed === 'Yes' || card.conversational_card_info?.autographed === 'yes') ? true : false,
    memorabilia: (card.conversational_card_info?.memorabilia === true || card.conversational_card_info?.memorabilia === 'Yes' || card.conversational_card_info?.memorabilia === 'yes') ? true : false,
    special_features: stripMarkdown(card.conversational_card_info?.special_features) || card.special_features || null,
    front_text: card.conversational_card_info?.front_text || card.front_text || null,
    back_text: card.conversational_card_info?.back_text || card.back_text || null
  };

  // 🎯 Other cards use conversational grading as PRIMARY source
  const recommendedGrade = card.conversational_decimal_grade ? {
    recommended_decimal_grade: card.conversational_decimal_grade,
    recommended_whole_grade: card.conversational_whole_grade,
    grade_uncertainty: card.conversational_grade_uncertainty,
    condition_label: card.conversational_condition_label
  } : (dvgGrading.recommended_grade || {});

  const centering = card.conversational_centering_ratios || dvgGrading.centering || {};

  const imageQuality = card.conversational_image_confidence ? {
    grade: card.conversational_image_confidence,
    confidence_letter: card.conversational_image_confidence
  } : (dvgGrading.image_quality || {});

  const analysisSummary = dvgGrading.analysis_summary || {};
  const defects = dvgGrading.defects || {};

  // Map to eBay condition category
  let ebayCondition: EbayCondition = 'Near Mint or Better';
  // Only map to eBay condition if we have full DVG defect data (not stub)
  if (dvgGrading &&
      Object.keys(dvgGrading).length > 0 &&
      dvgGrading.defects &&
      dvgGrading.recommended_grade &&
      dvgGrading.defects.front &&
      dvgGrading.defects.back) {
    ebayCondition = mapToEbayCondition(dvgGrading);
  }

  // Construct current URL for QR code
  const currentUrl = `${origin}/sports/${cardId}`;

  // DEBUG: Check if professional grades exist
  console.log('[Professional Grades Debug] estimated_professional_grades exists?', !!professionalGrades);
  console.log('[Professional Grades Debug] professionalGrades data:', professionalGrades);
  console.log('[Professional Grades Debug] card.estimated_professional_grades:', card.estimated_professional_grades);
  console.log('[Professional Grades Debug] Full card keys:', Object.keys(card));
  console.log('[Professional Grades Debug] Full dvgGrading keys:', Object.keys(dvgGrading));

  // 🎯 Lorcana cards: Map conversational data to expected structure
  const aiCardInfo = card.conversational_card_info || card.ai_grading?.["Card Information"] || {};
  const aiCardDetails = card.ai_grading?.["Card Details"] || {};
  const finalScore = card.ai_grading?.["Final Score"] || {};

  // For Lorcana cards, create gradingScale from conversational data
  const gradingScale = card.conversational_sub_scores ? {
    "Visual_Inspection_Results": {
      centering: card.conversational_sub_scores.centering,
      corners: card.conversational_sub_scores.corners,
      edges: card.conversational_sub_scores.edges,
      surface: card.conversational_sub_scores.surface
    },
    "Centering_Measurements": card.conversational_centering_ratios || {}
  } : (card.ai_grading?.["Grading (DCM Master Scale)"] || {});

  const visualInspection = gradingScale["Visual_Inspection_Results"] || {};

  // 🎯 Lorcana cards: Use conversational_centering_ratios
  const centeringData = card.conversational_centering_ratios ||
                        card.ai_grading?.["Centering_Measurements"] ||
                        card.ai_grading?.centerings_used ||
                        card.stage0_detection ||
                        gradingScale["Centering_Measurements"] || {};

  // v3.1: Map centerings_used fields to legacy format for display
  const centeringMeasurements = {
    front_x_axis_ratio: centeringData.front_x_axis_ratio || centeringData.front_lr || "N/A",
    front_y_axis_ratio: centeringData.front_y_axis_ratio || centeringData.front_tb || "N/A",
    back_x_axis_ratio: centeringData.back_x_axis_ratio || centeringData.back_lr || "N/A",
    back_y_axis_ratio: centeringData.back_y_axis_ratio || centeringData.back_tb || "N/A",
    front_centering_method: centeringData.front_centering_method || centeringData.front_type || "N/A",
    back_centering_method: centeringData.back_centering_method || centeringData.back_type || "N/A",
    ...centeringData // Include all other fields
  };

  // Debug visual inspection data
  console.log('[Pokemon Page] Card AI grading:', card.ai_grading);
  console.log('[Pokemon Page] Conversational sub-scores:', card.conversational_sub_scores);
  console.log('[Pokemon Page] Grading scale data:', gradingScale);
  console.log('[Pokemon Page] Visual inspection results:', visualInspection);
  console.log('[Pokemon Page] Centering measurements variable:', centeringMeasurements);
  console.log('[Pokemon Page] Centering measurements has data?', Object.keys(centeringMeasurements).length > 0);
  console.log('[Pokemon Page] front_x_axis_ratio value:', centeringMeasurements?.front_x_axis_ratio);
  console.log('[Pokemon Page] Available ai_grading keys:', card.ai_grading ? Object.keys(card.ai_grading) : 'none');
  const dcmSystem = card.ai_grading?.["DCM Score System"] || {};
  const aiConfidence = card.ai_grading?.["AI Confidence Assessment"] || {};

  // Generate structured data for SEO
  const structuredData = generateStructuredData(card, dvgGrading, currentUrl);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Structured Data (JSON-LD) for SEO */}
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData)
        }}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/other/upload" className="text-gray-600 hover:text-gray-800">
          ← Back to Other Upload
        </Link>
        <div className="flex items-center space-x-4">
          <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
            🎴 Other Collectible Card
          </div>
          {/* 🔒 Visibility Toggle Button */}
          <button
            onClick={() => {
              // Show confirmation modal for making private
              if (visibility === 'public') {
                const confirmed = confirm(
                  '⚠️ Make this card private?\n\n' +
                  '🔒 Only you will be able to view this card\n' +
                  '🔒 Card will NOT be searchable by anyone\n' +
                  '🔒 Shared links will stop working\n\n' +
                  'Continue?'
                );
                if (confirmed) {
                  toggleVisibility();
                }
              } else {
                // No confirmation needed for making public
                toggleVisibility();
              }
            }}
            disabled={isTogglingVisibility}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              visibility === 'public'
                ? 'bg-green-100 text-green-800 hover:bg-green-200 border-2 border-green-500'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-2 border-gray-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={visibility === 'public' ? 'This card is public (click to make private)' : 'This card is private (click to make public)'}
          >
            <span>{isTogglingVisibility ? 'Updating...' : visibility === 'public' ? 'Public' : 'Private'}</span>
          </button>
          <button
            onClick={regradeCard}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title="Re-grade this card with the latest model"
          >
            <span>{loading ? 'Re-grading...' : 'Re-grade Card'}</span>
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="space-y-8">
        {/* Card Images with Professional-Style Labels */}
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
            {/* Front Card with Label */}
            <div>
              {/* Front Label - PSA Style */}
              <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-purple-600 rounded-lg shadow-md p-3 mb-3 h-[86px]">
                <div className="flex items-center justify-between h-full">
                  {/* Left: DCM Logo */}
                  <div className="flex-shrink-0">
                    <img
                      src="/DCM-logo.png"
                      alt="DCM"
                      className="h-14 w-auto"
                    />
                  </div>

                  {/* Center: Card Information */}
                  <div className="flex-1 min-w-0 mx-3 py-1">
                    <div
                      className={`font-bold text-gray-900 leading-tight overflow-hidden ${/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cardInfo.card_name || cardInfo.player_or_character || card.card_name || "") ? 'font-noto-sans-jp' : ''}`}
                      style={{
                        fontSize: (cardInfo.card_name || cardInfo.player_or_character || card.card_name || "Unknown Card").length > 25 ? '0.75rem' : '0.875rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        maxHeight: '2.5em'
                      }}
                      title={cardInfo.card_name || cardInfo.player_or_character || card.card_name || "Unknown Card"}
                    >
                      {cardInfo.card_name || cardInfo.player_or_character || card.card_name || "Unknown Card"}
                    </div>
                    <div
                      className="text-gray-700 leading-tight mt-0.5 overflow-hidden"
                      style={{
                        fontSize: (() => {
                          // Build special features string
                          const features: string[] = [];
                          if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true') features.push('RC');
                          if (cardInfo.autographed) features.push('Auto');
                          const serialNum = cardInfo.serial_number;
                          if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
                            features.push(serialNum);
                          }
                          const specialFeatures = features.length > 0 ? features.join(' ') : '';

                          // Build full text: set name - special features - card number - date (no duplicate card name)
                          const parts = [
                            cardInfo.set_name || cardInfo.set_era || "Unknown Set",
                            specialFeatures,
                            cardInfo.card_number,
                            cardInfo.card_date || cardInfo.year || card.card_date
                          ].filter(p => p && p.trim() !== '');
                          const fullText = parts.join(' - ');
                          return fullText.length > 40 ? '0.625rem' : '0.75rem';
                        })(),
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        maxHeight: '2em'
                      }}
                    >
                      {(() => {
                        // Build special features string
                        const features: string[] = [];
                        if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true') features.push('RC');
                        if (cardInfo.autographed) features.push('Auto');
                        const serialNum = cardInfo.serial_number;
                        if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
                          features.push(serialNum);
                        }
                        const specialFeatures = features.length > 0 ? features.join(' ') : '';

                        // Build full text: set name - special features - card number - date (no duplicate card name)
                        const parts = [
                          cardInfo.set_name || cardInfo.set_era || "Unknown Set",
                          specialFeatures,
                          cardInfo.card_number,
                          cardInfo.card_date || cardInfo.year || card.card_date
                        ].filter(p => p && p.trim() !== '');
                        return parts.join(' - ');
                      })()}
                    </div>
                    <div className="text-gray-500 text-[10px] mt-1 font-mono truncate">
                      {card.serial || `DCM-${card.id?.slice(0, 8)}`}
                    </div>
                  </div>

                  {/* Right: Grade Display */}
                  <div className="text-center flex-shrink-0">
                    {(() => {
                      // Get the numeric grade
                      let grade: number | null = null;
                      if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
                        grade = card.conversational_decimal_grade;
                      } else if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
                        grade = card.dvg_decimal_grade;
                      } else if (recommendedGrade.recommended_decimal_grade !== null && recommendedGrade.recommended_decimal_grade !== undefined) {
                        grade = recommendedGrade.recommended_decimal_grade;
                      } else if (card.dcm_grade_decimal !== null && card.dcm_grade_decimal !== undefined) {
                        grade = card.dcm_grade_decimal;
                      }

                      // Use actual AI-generated condition label, stripping abbreviation like (GM), (M), etc
                      const condition = card.conversational_condition_label
                        ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
                        : (grade !== null ? getConditionFromGrade(grade) : '');
                      const displayGrade = grade !== null ? formatGrade(grade) : 'N/A';

                      return (
                        <>
                          <div className="font-bold text-purple-700 text-3xl leading-none">
                            {displayGrade}
                          </div>
                          {condition && (
                            <>
                              <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
                              <div className="font-semibold text-purple-600 text-[0.65rem] leading-tight">
                                {condition}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Front Card Image */}
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => openZoomModal(card.front_url, "Lorcana card front", "Card Front - Click for detailed view")}
              >
                <Image
                  src={card.front_url}
                  alt="Lorcana card front"
                  width={400}
                  height={560}
                  className="rounded-lg shadow-lg w-full"
                  priority
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Click to zoom</p>
            </div>

            {/* Back Card with Label */}
            <div>
              {/* Back Label - QR Code Centered */}
              <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-purple-600 rounded-lg shadow-md mb-3 h-[86px] flex items-center justify-center p-3">
                {/* QR Code with Logo Overlay */}
                <div className="bg-white p-1 rounded relative">
                  <QRCodeCanvas
                    value={currentUrl}
                    size={58}
                    level="H"
                    includeMargin={false}
                  />
                  {/* DCM Logo Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-full p-0.5 flex items-center justify-center" style={{ width: '20px', height: '20px' }}>
                      <img
                        src="/DCM-logo.png"
                        alt="DCM"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Back Card Image */}
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => openZoomModal(card.back_url, "Lorcana card back", "Card Back - Click for detailed view")}
              >
                <Image
                  src={card.back_url}
                  alt="Lorcana card back"
                  width={400}
                  height={560}
                  className="rounded-lg shadow-lg w-full"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Click to zoom</p>
            </div>
          </div>
        </div>

        {/* Card Details and Grading */}
        <div className="space-y-6">

          {/* Professional Grading Slab Information */}
          {card.slab_detected && card.slab_company && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <h2 className="text-2xl font-bold">Professional Grading</h2>
              </div>
              <div className="space-y-3 text-center">
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-100 mb-1">Professional Grade</p>
                  <p className="text-3xl font-extrabold">
                    {card.slab_company} {card.slab_grade}
                    {card.slab_grade_description && (
                      <span className="text-xl ml-2">({card.slab_grade_description})</span>
                    )}
                  </p>
                </div>
                {card.slab_cert_number && (
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-100 mb-1">Certification Number</p>
                    <p className="text-lg font-semibold font-mono">{card.slab_cert_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DVG v1 Grading Results */}
          {dvgGrading && Object.keys(dvgGrading).length > 0 && (
            <div className="space-y-6">
              {/* Header / Grade Summary */}
              <div className={`${
                // 🎯 Check conversational AI grade first, then DVG v1
                (card.conversational_decimal_grade === null && recommendedGrade.recommended_decimal_grade === null)
                  ? 'bg-gradient-to-r from-red-600 to-orange-600'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600'
              } text-white rounded-2xl p-8 shadow-lg text-center`}>
                <h1 className="text-7xl font-extrabold tracking-tight mb-2">
                  {/* 🎯 PRIMARY: Use conversational AI grade, FALLBACK: DVG v1 */}
                  {formatGrade(card.conversational_decimal_grade ?? recommendedGrade.recommended_decimal_grade)}
                </h1>

                {/* 🎯 v3.2: Show condition label (not eBay condition) */}
                <p className="text-lg font-medium">
                  {card.conversational_condition_label || ebayCondition}
                </p>

                <div className="mt-4 flex justify-center space-x-4 flex-wrap gap-2">
                  {/* 🎯 v3.2: Uncertainty badge */}
                  <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                    Uncertainty: {(() => {
                      // 🔧 FIX: For N/A grades, derive uncertainty from confidence score
                      let uncertainty = '';
                      if (card.conversational_grade_uncertainty && card.conversational_grade_uncertainty !== 'N/A') {
                        uncertainty = card.conversational_grade_uncertainty;
                      } else if (recommendedGrade.grade_uncertainty && recommendedGrade.grade_uncertainty !== 'N/A') {
                        uncertainty = recommendedGrade.grade_uncertainty;
                      } else {
                        // Derive from confidence score
                        uncertainty = getUncertaintyFromConfidence(card.conversational_image_confidence || card.dvg_image_quality || imageQuality.grade);
                      }
                      // Extract only the ± portion (e.g., "10.0 ± 0.25" → "± 0.25")
                      const plusMinusMatch = uncertainty.match(/±\s*[\d.]+/);
                      return plusMinusMatch ? plusMinusMatch[0] : uncertainty;
                    })()}
                  </span>

                  {/* 🎯 v3.2: Image Confidence Badge (A/B/C/D) */}
                  {card.conversational_image_confidence ? (
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      card.conversational_image_confidence === 'A' ? 'bg-green-500/30 border border-green-300' :
                      card.conversational_image_confidence === 'B' ? 'bg-blue-500/30 border border-blue-300' :
                      card.conversational_image_confidence === 'C' ? 'bg-yellow-500/30 border border-yellow-300' :
                      'bg-red-500/30 border border-red-300'
                    }`}>
                      Confidence Score: {card.conversational_image_confidence}
                    </span>
                  ) : (
                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                      Confidence Score: {imageQuality.grade || 'B'}
                    </span>
                  )}
                </div>
                {card.dvg_reshoot_required && (
                  <div className="mt-3 bg-red-500/30 px-4 py-2 rounded-lg inline-block">
                    <p className="text-sm font-semibold">⚠️ Reshoot Recommended</p>
                  </div>
                )}
              </div>

              {/* Grading Status Warning - Shows when grade is N/A (but NOT when DVG is disabled) */}
              {(card.conversational_decimal_grade === null || recommendedGrade.recommended_decimal_grade === null) &&
               dvgGrading.grading_status &&
               !dvgGrading.grading_status.includes('disabled') &&
               !dvgGrading.grading_status.includes('N/A') && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-500 rounded-xl shadow-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-red-800 mb-3">Grading Status</h2>
                      <p className="text-lg text-red-700 font-semibold mb-3">
                        {dvgGrading.grading_status}
                      </p>
                      <div className="bg-white/60 rounded-lg p-4 border-2 border-red-300">
                        <p className="text-sm text-red-800">
                          <span className="font-bold">Important:</span> This card cannot receive a numerical grade due to the detected issues described below.
                          Professional grading companies (PSA, BGS, SGC) also do not assign numerical grades to cards with these conditions.
                        </p>
                      </div>
                      <p className="text-xs text-red-600 mt-3 italic">
                        See the detailed analysis below for more information about the specific issues detected.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 🎯 v3.2: N/A Grade Reason (from conversational AI) */}
              {card.conversational_decimal_grade === null && card.conversational_weighted_summary?.grade_cap_reason && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-500 rounded-xl shadow-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-red-800 mb-3">Card Not Gradable</h2>
                      <p className="text-lg text-red-700 font-semibold mb-3">
                        {card.conversational_weighted_summary.grade_cap_reason}
                      </p>
                      <div className="bg-white/60 rounded-lg p-4 border-2 border-red-300">
                        <p className="text-sm text-red-800">
                          <span className="font-bold">Important:</span> This card cannot receive a numerical grade due to the detected issues described below.
                          Professional grading companies (PSA, BGS, SGC) also do not assign numerical grades to cards with these conditions.
                        </p>
                      </div>
                      <p className="text-xs text-red-600 mt-3 italic">
                        See the detailed analysis below for more information about the specific issues detected.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Scores - Positioned directly below main grade */}
              {/* 🎯 v3.8: Display weighted scores with limiting factor highlight */}
              {(card.conversational_sub_scores || dvgGrading.sub_scores) && (() => {
                const subScores = card.conversational_sub_scores || dvgGrading.sub_scores;
                const weightedScores = card.conversational_weighted_sub_scores;
                const limitingFactor = card.conversational_limiting_factor;

                return (
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-200 -mt-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Centering */}
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg mb-2">
                        {safeToFixed(weightedScores?.centering ?? subScores.centering.weighted ?? subScores.centering.weighted_score ?? 0)}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">🎯 Centering</h3>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>F: <span className="font-semibold text-blue-700">{safeToFixed(subScores.centering.front_score ?? subScores.centering.front)}</span> | B: <span className="font-semibold text-blue-700">{safeToFixed(subScores.centering.back_score ?? subScores.centering.back)}</span></p>
                        <p className="font-semibold text-blue-800 mt-1">Weighted: {safeToFixed(weightedScores?.centering ?? subScores.centering.weighted ?? subScores.centering.weighted_score ?? 0)}</p>
                      </div>
                    </div>

                    {/* Corners */}
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-green-500 to-green-600 shadow-lg mb-2">
                        {safeToFixed(weightedScores?.corners ?? subScores.corners.weighted ?? subScores.corners.weighted_score ?? 0)}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">📐 Corners</h3>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>F: <span className="font-semibold text-green-700">{safeToFixed(subScores.corners.front_score ?? subScores.corners.front)}</span> | B: <span className="font-semibold text-green-700">{safeToFixed(subScores.corners.back_score ?? subScores.corners.back)}</span></p>
                        <p className="font-semibold text-green-800 mt-1">Weighted: {safeToFixed(weightedScores?.corners ?? subScores.corners.weighted ?? subScores.corners.weighted_score ?? 0)}</p>
                      </div>
                    </div>

                    {/* Edges */}
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg mb-2">
                        {safeToFixed(weightedScores?.edges ?? subScores.edges.weighted ?? subScores.edges.weighted_score ?? 0)}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">📏 Edges</h3>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>F: <span className="font-semibold text-purple-700">{safeToFixed(subScores.edges.front_score ?? subScores.edges.front)}</span> | B: <span className="font-semibold text-purple-700">{safeToFixed(subScores.edges.back_score ?? subScores.edges.back)}</span></p>
                        <p className="font-semibold text-purple-800 mt-1">Weighted: {safeToFixed(weightedScores?.edges ?? subScores.edges.weighted ?? subScores.edges.weighted_score ?? 0)}</p>
                      </div>
                    </div>

                    {/* Surface */}
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg mb-2">
                        {safeToFixed(weightedScores?.surface ?? subScores.surface.weighted ?? subScores.surface.weighted_score ?? 0)}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">✨ Surface</h3>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>F: <span className="font-semibold text-amber-700">{safeToFixed(subScores.surface.front_score ?? subScores.surface.front)}</span> | B: <span className="font-semibold text-amber-700">{safeToFixed(subScores.surface.back_score ?? subScores.surface.back)}</span></p>
                        <p className="font-semibold text-amber-800 mt-1">Weighted: {safeToFixed(weightedScores?.surface ?? subScores.surface.weighted ?? subScores.surface.weighted_score ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Overall Card Condition Summary */}
              {card.conversational_final_grade_summary && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6 border-2 border-indigo-200 mt-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">
                    Overall Card Condition Summary
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {card.conversational_final_grade_summary}
                  </p>
                </div>
              )}

              {/* 📄 Download Report Button & Social Sharing */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 my-6 px-4">
                <DownloadReportButton card={card} />

                {/* Social Sharing Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Facebook */}
                  <button
                    onClick={() => {
                      const shareData: CardSharingData = {
                        cardName: dvgGrading?.card_info?.card_name || card.card_name,
                        playerName: dvgGrading?.card_info?.player_or_character || card.featured,
                        setName: dvgGrading?.card_info?.set_name || card.card_set,
                        year: dvgGrading?.card_info?.year || card.release_date,
                        manufacturer: dvgGrading?.card_info?.manufacturer,
                        grade: (card.conversational_decimal_grade ?? recommendedGrade.recommended_decimal_grade) || undefined,
                        gradeUncertainty: card.conversational_image_confidence || card.dvg_image_quality || imageQuality.grade || card.ai_confidence_score || 'B',
                        url: currentUrl
                      };
                      const fbUrl = generateFacebookShareUrl(shareData);
                      openSocialShare(fbUrl);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </button>

                  {/* X (Twitter) */}
                  <button
                    onClick={() => {
                      const shareData: CardSharingData = {
                        cardName: dvgGrading?.card_info?.card_name || card.card_name,
                        playerName: dvgGrading?.card_info?.player_or_character || card.featured,
                        setName: dvgGrading?.card_info?.set_name || card.card_set,
                        year: dvgGrading?.card_info?.year || card.release_date,
                        manufacturer: dvgGrading?.card_info?.manufacturer,
                        grade: (card.conversational_decimal_grade ?? recommendedGrade.recommended_decimal_grade) || undefined,
                        gradeUncertainty: card.conversational_image_confidence || card.dvg_image_quality || imageQuality.grade || card.ai_confidence_score || 'B',
                        url: currentUrl
                      };
                      const twitterUrl = generateTwitterShareUrl(shareData);
                      openSocialShare(twitterUrl);
                    }}
                    className="flex items-center justify-center bg-black hover:bg-gray-800 text-white font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all duration-200 hover:scale-105 w-12"
                    title="Share on X"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={() => {
                      const shareData: CardSharingData = {
                        cardName: dvgGrading?.card_info?.card_name || card.card_name,
                        playerName: dvgGrading?.card_info?.player_or_character || card.featured,
                        setName: dvgGrading?.card_info?.set_name || card.card_set,
                        year: dvgGrading?.card_info?.year || card.release_date,
                        manufacturer: dvgGrading?.card_info?.manufacturer,
                        grade: (card.conversational_decimal_grade ?? recommendedGrade.recommended_decimal_grade) || undefined,
                        gradeUncertainty: card.conversational_image_confidence || card.dvg_image_quality || imageQuality.grade || card.ai_confidence_score || 'B',
                        url: currentUrl
                      };
                      handleInstagramShare(shareData);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span>Instagram</span>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={async () => {
                      try {
                        if (navigator.clipboard && window.isSecureContext) {
                          await navigator.clipboard.writeText(currentUrl);
                        } else {
                          // Fallback for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = currentUrl;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          textArea.remove();
                        }
                        alert('✅ Link copied to clipboard!');
                      } catch (err) {
                        alert('❌ Failed to copy link. Please try again.');
                        console.error('Copy failed:', err);
                      }
                    }}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold px-4 py-2.5 rounded-lg shadow-md transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>

              {/* 📄 Scrollable Content Sections */}
              <div className="space-y-8">

                  {/* Professional Grades Tab Content */}
              {/* Professional Grading Slab Detection - Dual Display */}
              {card.slab_detected && card.slab_company && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl shadow-xl p-6 border-4 border-yellow-400">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Professional Grade Detected
                    </h2>
                    <span className="text-xs bg-yellow-600 text-white px-3 py-1 rounded-full font-semibold">
                      {card.slab_company}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Professional Grade */}
                    <div className="bg-white rounded-lg p-6 shadow-md border-2 border-yellow-400">
                      <p className="text-sm text-gray-600 mb-2 uppercase tracking-wide">Professional Grade</p>
                      <p className="text-6xl font-extrabold text-yellow-600 mb-1">{card.slab_grade}</p>
                      <p className="text-sm font-semibold text-gray-700">{card.slab_company} Certified</p>
                      {card.slab_cert_number && (
                        <p className="text-xs text-gray-500 mt-2">
                          Cert #: <span className="font-mono">{card.slab_cert_number}</span>
                        </p>
                      )}
                      {card.slab_serial && (
                        <p className="text-xs text-gray-500">
                          Serial: <span className="font-mono">{card.slab_serial}</span>
                        </p>
                      )}
                    </div>

                    {/* DCM Grade */}
                    <div className="bg-white rounded-lg p-6 shadow-md border-2 border-indigo-400">
                      <p className="text-sm text-gray-600 mb-2 uppercase tracking-wide">DCM Grade</p>
                      <p className="text-6xl font-extrabold text-indigo-600 mb-1">
                        {formatGrade(recommendedGrade.recommended_decimal_grade)}
                      </p>
                      <p className="text-sm font-semibold text-gray-700">Independent Verification</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Based on visible card through slab
                      </p>
                    </div>
                  </div>

                  {/* Subgrades */}
                  {card.slab_subgrades && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-md">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Professional Subgrades</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        {card.slab_subgrades.centering !== undefined && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Centering</p>
                            <p className="text-2xl font-bold text-gray-800">{card.slab_subgrades.centering}</p>
                          </div>
                        )}
                        {card.slab_subgrades.corners !== undefined && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Corners</p>
                            <p className="text-2xl font-bold text-gray-800">{card.slab_subgrades.corners}</p>
                          </div>
                        )}
                        {card.slab_subgrades.edges !== undefined && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Edges</p>
                            <p className="text-2xl font-bold text-gray-800">{card.slab_subgrades.edges}</p>
                          </div>
                        )}
                        {card.slab_subgrades.surface !== undefined && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-500">Surface</p>
                            <p className="text-2xl font-bold text-gray-800">{card.slab_subgrades.surface}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comparison */}
                  {card.ai_vs_slab_comparison && (
                    <div className="bg-white rounded-lg p-4 shadow-md">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Grade Comparison</p>
                      <p className="text-sm text-gray-600">{card.ai_vs_slab_comparison}</p>
                    </div>
                  )}

                  {/* Additional Metadata */}
                  {card.slab_metadata && Object.keys(card.slab_metadata).length > 0 && (
                    <div className="bg-white rounded-lg p-4 mt-4 shadow-md">
                      <p className="text-sm font-semibold text-gray-700 mb-3">Additional Information</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {card.slab_metadata.grade_date && (
                          <div>
                            <p className="text-gray-500 text-xs">Grade Date</p>
                            <p className="font-semibold text-gray-800">{card.slab_metadata.grade_date}</p>
                          </div>
                        )}
                        {card.slab_metadata.population && (
                          <div>
                            <p className="text-gray-500 text-xs">Population</p>
                            <p className="font-semibold text-gray-800">{card.slab_metadata.population}</p>
                          </div>
                        )}
                        {card.slab_metadata.label_type && (
                          <div>
                            <p className="text-gray-500 text-xs">Label Type</p>
                            <p className="font-semibold text-gray-800">{card.slab_metadata.label_type}</p>
                          </div>
                        )}
                        {card.slab_metadata.label_color && (
                          <div>
                            <p className="text-gray-500 text-xs">Label Color</p>
                            <p className="font-semibold text-gray-800">{card.slab_metadata.label_color}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="bg-blue-50 rounded-lg p-3 mt-4 border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> The professional grade from {card.slab_company} is the certified grade for this card.
                      The DCM analysis grade is provided as independent verification and may differ due to limited visibility through the slab holder.
                    </p>
                  </div>
                </div>
              )}

                  {/* Card Details Tab Content */}
              {/* Section Header: Card Information */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg px-6 py-3 shadow-md">
                <h2 className="text-xl font-bold">
                  Card Information
                </h2>
              </div>

              {/* Other Card Information Section */}
              <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-200">
                  🎴 Card Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Card Name with bilingual support */}
                  {(cardInfo.card_name || card.card_name) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Card Name</p>
                      {(() => {
                        const cardName = cardInfo.card_name || card.card_name;
                        const hasJapanese = /[぀-ゟ゠-ヿ一-龯]/.test(cardName);

                        if (hasJapanese) {
                          const parts = cardName.split(/[/()（）]/);
                          const japanesePart = parts.find(p => /[぀-ゟ゠-ヿ一-龯]/.test(p));
                          const englishPart = parts.find(p => p.trim() && !/[぀-ゟ゠-ヿ一-龯]/.test(p));

                          if (japanesePart && englishPart) {
                            return (
                              <div>
                                <p className="text-lg font-bold text-gray-900 font-noto-sans-jp">
                                  {japanesePart?.trim()}
                                </p>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {englishPart.trim()}
                                </p>
                              </div>
                            );
                          }

                          return <p className="text-lg font-bold text-gray-900 font-noto-sans-jp">{cardName}</p>;
                        }

                        return <p className="text-lg font-bold text-gray-900">{cardName}</p>;
                      })()}
                    </div>
                  )}

                  {/* Ink Color with colored badge */}
                  {(cardInfo.ink_color || card.ink_color) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Ink Color</p>
                      <div className="flex gap-1">
                        {(() => {
                          const inkColor = cardInfo.ink_color || card.ink_color;
                          const colorMap: {[key: string]: {bg: string, text: string, emoji: string}} = {
                            'Amber': {bg: 'bg-yellow-100', text: 'text-yellow-800', emoji: '🟡'},
                            'Amethyst': {bg: 'bg-purple-100', text: 'text-purple-800', emoji: '🟣'},
                            'Emerald': {bg: 'bg-green-100', text: 'text-green-800', emoji: '🟢'},
                            'Ruby': {bg: 'bg-red-100', text: 'text-red-800', emoji: '🔴'},
                            'Sapphire': {bg: 'bg-blue-100', text: 'text-blue-800', emoji: '🔵'},
                            'Steel': {bg: 'bg-gray-200', text: 'text-gray-800', emoji: '⚫'}
                          };
                          const colorInfo = colorMap[inkColor] || {bg: 'bg-gray-100', text: 'text-gray-700', emoji: '⚪'};
                          return (
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${colorInfo.bg} ${colorInfo.text} flex items-center gap-2`}>
                              <span>{colorInfo.emoji}</span>
                              {inkColor}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Card Type */}
                  {(cardInfo.lorcana_card_type || card.lorcana_card_type) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Card Type</p>
                      <p className="text-lg font-bold text-gray-900">
                        {cardInfo.lorcana_card_type || card.lorcana_card_type}
                      </p>
                    </div>
                  )}

                  {/* Character Version */}
                  {(cardInfo.character_version || card.character_version) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Character Version</p>
                      <p className="text-lg text-gray-900">
                        {cardInfo.character_version || card.character_version}
                      </p>
                    </div>
                  )}

                  {/* Ink Cost */}
                  {(cardInfo.ink_cost || card.ink_cost) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Ink Cost</p>
                      <p className="text-2xl font-bold text-purple-700 font-mono">
                        {cardInfo.ink_cost || card.ink_cost}
                      </p>
                    </div>
                  )}

                  {/* Strength */}
                  {(cardInfo.strength || card.strength) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">⚔️ Strength</p>
                      <p className="text-lg font-bold text-red-700">
                        {cardInfo.strength || card.strength}
                      </p>
                    </div>
                  )}

                  {/* Willpower */}
                  {(cardInfo.willpower || card.willpower) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">🛡️ Willpower</p>
                      <p className="text-lg font-bold text-blue-700">
                        {cardInfo.willpower || card.willpower}
                      </p>
                    </div>
                  )}

                  {/* Set Name */}
                  {(() => {
                    const setName = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name :
                                   (card.card_set && card.card_set !== 'null') ? card.card_set :
                                   cardInfo.set_era || card.card_set || 'Unknown Set';

                    return setName !== 'Unknown Set' && (
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-1">Set Name</p>
                        <p className="text-lg text-gray-900">{setName}</p>
                      </div>
                    );
                  })()}

                  {/* Card Number */}
                  {(cardInfo.collector_number || cardInfo.card_number || card.card_number) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Card Number</p>
                      <p className="text-lg text-gray-900 font-mono">
                        {cardInfo.collector_number || cardInfo.card_number || card.card_number}
                      </p>
                    </div>
                  )}

                  {/* Manufacturer */}
                  {(cardInfo.manufacturer || card.manufacturer) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Manufacturer</p>
                      <p className="text-lg text-gray-900">
                        {cardInfo.manufacturer || card.manufacturer}
                      </p>
                    </div>
                  )}

                  {/* Card Date */}
                  {(cardInfo.card_date || card.card_date) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Year/Date</p>
                      <p className="text-lg text-gray-900">
                        {cardInfo.card_date || card.card_date}
                      </p>
                    </div>
                  )}

                  {/* Autographed */}
                  {(cardInfo.autographed === true || cardInfo.autographed === 'Yes' || cardInfo.autographed === 'yes' || card.autographed === true) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Autographed</p>
                      <p className="text-lg text-gray-900">true</p>
                    </div>
                  )}
                  {(cardInfo.autographed === false || cardInfo.autographed === 'No' || cardInfo.autographed === 'no' || (!cardInfo.autographed && card.autographed === false)) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Autographed</p>
                      <p className="text-lg text-gray-900">false</p>
                    </div>
                  )}

                  {/* Memorabilia */}
                  {(cardInfo.memorabilia === true || cardInfo.memorabilia === 'Yes' || cardInfo.memorabilia === 'yes' || card.memorabilia === true) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Memorabilia</p>
                      <p className="text-lg text-gray-900">true</p>
                    </div>
                  )}
                  {(cardInfo.memorabilia === false || cardInfo.memorabilia === 'No' || cardInfo.memorabilia === 'no' || (!cardInfo.memorabilia && card.memorabilia === false)) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Memorabilia</p>
                      <p className="text-lg text-gray-900">false</p>
                    </div>
                  )}

                  {/* Special Features */}
                  {(cardInfo.special_features || card.special_features) && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Special Features</p>
                      <p className="text-lg text-gray-900">
                        {cardInfo.special_features || card.special_features}
                      </p>
                    </div>
                  )}

                  {/* Language */}
                  {(cardInfo.language || card.language) && (cardInfo.language || card.language) !== 'English' && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">Language</p>
                      <p className="text-lg text-gray-900">
                        {cardInfo.language || card.language}
                      </p>
                    </div>
                  )}

                  {/* Front Text (for Other cards) */}
                  {(cardInfo.front_text || card.front_text) && (
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-gray-600 mb-2">Front Text</p>
                      <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {cardInfo.front_text || card.front_text}
                      </div>
                    </div>
                  )}

                  {/* Back Text (for Other cards) */}
                  {(cardInfo.back_text || card.back_text) && (
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-gray-600 mb-2">Back Text</p>
                      <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {cardInfo.back_text || card.back_text}
                      </div>
                    </div>
                  )}

                  {/* Flavor Text */}
                  {(cardInfo.flavor_text || card.flavor_text) && (
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-gray-600 mb-2">Flavor Text</p>
                      <div className="px-4 py-3 bg-gray-50 rounded-lg border-l-4 border-purple-400">
                        <p className="text-sm text-gray-700 italic">
                          "{cardInfo.flavor_text || card.flavor_text}"
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Market Listings Section - eBay Search */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-bold mb-3 text-gray-800">Market Listings</h2>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* eBay Active Listings */}
                  <a
                    href={generateOtherEbaySearchUrl({
                      card_name: cardInfo.card_name || card.card_name,
                      card_set: cardInfo.set_name || card.card_set,
                      featured: cardInfo.player_or_character || card.featured,
                      manufacturer: cardInfo.manufacturer || card.manufacturer,
                      card_number: cardInfo.card_number || card.card_number,
                      card_date: cardInfo.card_date || card.card_date,
                      release_date: cardInfo.year || card.release_date,
                      serial_numbering: cardInfo.serial_number || card.serial_numbering,
                      autographed: cardInfo.autographed ? "Yes" : "No",  // Use only cardInfo (AI analysis), don't fall back to old data
                      dcm_grade_whole: card.conversational_whole_grade || card.dcm_grade_whole
                    } as CardData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 group"
                  >
                    <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-blue-900 mb-2 text-lg">General Search</h3>
                    <p className="text-sm text-blue-700 text-center leading-relaxed">Find all available cards matching this description</p>
                  </a>

                  {/* eBay Sold Listings */}
                  <a
                    href={generateOtherEbaySoldListingsUrl({
                      card_name: cardInfo.card_name || card.card_name,
                      card_set: cardInfo.set_name || card.card_set,
                      featured: cardInfo.player_or_character || card.featured,
                      manufacturer: cardInfo.manufacturer || card.manufacturer,
                      card_number: cardInfo.card_number || card.card_number,
                      card_date: cardInfo.card_date || card.card_date,
                      release_date: cardInfo.year || card.release_date,
                      serial_numbering: cardInfo.serial_number || card.serial_numbering,
                      autographed: cardInfo.autographed ? "Yes" : "No",  // Use only cardInfo (AI analysis), don't fall back to old data
                      dcm_grade_whole: card.conversational_whole_grade || card.dcm_grade_whole
                    } as CardData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center p-6 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200 group"
                  >
                    <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-green-900 mb-2 text-lg">Sold Listings</h3>
                    <p className="text-sm text-green-700 text-center leading-relaxed">See actual sale prices and market history</p>
                  </a>
                </div>
              </div>

                {/* Special Features Section */}
                {(dvgGrading.rarity_features || cardInfo.serial_number || cardInfo.rookie_or_first || dvgGrading.autograph || cardInfo.subset) && (
                  <div className="border-t pt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-bold text-gray-800">Special Features</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Subset/Insert */}
                      {cardInfo.subset && (
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                          <p className="text-amber-700 text-xs font-semibold mb-1">SUBSET/INSERT</p>
                          <p className="font-bold text-amber-900">{cardInfo.subset}</p>
                        </div>
                      )}
                      {/* Serial Number - 🎯 Exclude "Not present", "None visible", etc. */}
                      {(() => {
                        const serialNum = cardInfo.serial_number || dvgGrading.rarity_features?.serial_number;
                        const hasSerial = serialNum &&
                          serialNum !== 'N/A' &&
                          !serialNum.toLowerCase().includes('not present') &&
                          !serialNum.toLowerCase().includes('none visible') &&
                          !serialNum.toLowerCase().includes('none');
                        return hasSerial ? (
                          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                            <p className="text-purple-700 text-xs font-semibold mb-1">SERIAL #</p>
                            <p className="font-bold text-purple-900 text-lg">
                              {serialNum}
                            </p>
                          </div>
                        ) : null;
                      })()}

                      {/* Rookie Card - 🎯 Handle boolean from conversational AI */}
                      {(cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true' || dvgGrading.rarity_features?.rookie_or_first === 'true') && (
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <p className="text-green-700 text-xs font-semibold mb-1">ROOKIE CARD</p>
                          <p className="font-bold text-green-900 text-xl">🏆 Yes</p>
                        </div>
                      )}

                      {/* Autograph - 🎯 v3.2: Use conversational AI data first */}
                      {(() => {
                        // Only show autograph badge if explicitly present
                        const hasAutograph = (
                          (cardInfo.autographed === true || cardInfo.autographed === 'true' || cardInfo.autographed === 'Yes') ||
                          dvgGrading.autograph?.present === true ||
                          dvgGrading.rarity_features?.autograph?.present === true
                        );
                        return hasAutograph ? (
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <p className="text-blue-700 text-xs font-semibold mb-1">AUTOGRAPH</p>
                            <p className="font-bold text-blue-900 mb-2">
                              ✒️ {dvgGrading.rarity_features?.autograph?.type || dvgGrading.autograph?.type || 'Yes'}
                            </p>
                            {dvgGrading.autograph?.cert_markers && dvgGrading.autograph.cert_markers.length > 0 && (
                              <p className="text-xs text-blue-700 mt-1">
                                <strong>Auth Markers:</strong> {dvgGrading.autograph.cert_markers.join(', ')}
                              </p>
                            )}
                            {/* 🔧 FIX: Show footnote if autograph is not verified on-card */}
                            {card.conversational_validation_checklist && !card.conversational_validation_checklist.autograph_verified && (
                              <p className="text-xs text-orange-700 mt-2 italic border-t border-orange-200 pt-2">
                                <strong>⚠️ Note:</strong> No on-card authentication detected
                              </p>
                            )}
                          </div>
                        ) : null;
                      })()}

                      {/* Print Finish */}
                      {dvgGrading.rarity_features?.print_finish && (
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                          <p className="text-indigo-700 text-xs font-semibold mb-1">PRINT FINISH</p>
                          <p className="font-bold text-indigo-900 capitalize">
                            {dvgGrading.rarity_features.print_finish.replace(/_/g, ' ')}
                          </p>
                        </div>
                      )}

                      {/* Variant */}
                      {cardInfo.rarity_or_variant && (
                        <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                          <p className="text-pink-700 text-xs font-semibold mb-1">VARIANT</p>
                          <p className="font-bold text-pink-900">{cardInfo.rarity_or_variant}</p>
                        </div>
                      )}

                      {/* Authentic */}
                      {typeof cardInfo.authentic === 'boolean' && (
                        <div className={`rounded-lg p-3 border ${cardInfo.authentic ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <p className={`text-xs font-semibold mb-1 ${cardInfo.authentic ? 'text-green-700' : 'text-red-700'}`}>
                            AUTHENTIC
                          </p>
                          <p className={`font-bold ${cardInfo.authentic ? 'text-green-900' : 'text-red-900'}`}>
                            {cardInfo.authentic ? '✓ Licensed' : '✗ Unlicensed'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Additional Feature Tags */}
                    {dvgGrading.rarity_features?.feature_tags && dvgGrading.rarity_features.feature_tags.length > 0 && (
                      <div className="mt-4">
                        <p className="text-gray-600 text-xs font-semibold mb-2 uppercase tracking-wide">Additional Features</p>
                        <div className="flex flex-wrap gap-2">
                          {dvgGrading.rarity_features.feature_tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 text-xs font-semibold rounded-full border border-blue-300 shadow-sm"
                            >
                              {tag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Description Section */}
                {dvgGrading.card_text_blocks && dvgGrading.card_text_blocks.main_text_box && (
                  <div className="border-t pt-5 mt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-bold text-gray-800">Card Description</h3>
                      {dvgGrading.card_text_blocks.text_confidence && (
                        <span className={`ml-auto px-3 py-1 text-xs font-medium rounded-full ${
                          dvgGrading.card_text_blocks.text_confidence === 'high'
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : dvgGrading.card_text_blocks.text_confidence === 'medium'
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            : 'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                          Text Quality: {dvgGrading.card_text_blocks.text_confidence}
                        </span>
                      )}
                    </div>

                    {/* Main Text */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {dvgGrading.card_text_blocks.main_text_box}
                      </p>
                    </div>

                    {/* Stat Table (if present) */}
                    {dvgGrading.card_text_blocks.stat_table_text && dvgGrading.card_text_blocks.stat_table_text !== 'None' && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 mb-2">Statistics</p>
                        <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                          {dvgGrading.card_text_blocks.stat_table_text}
                        </p>
                      </div>
                    )}

                    {/* Copyright */}
                    {dvgGrading.card_text_blocks.copyright_text && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 italic">
                          {dvgGrading.card_text_blocks.copyright_text}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

                  {/* Centering Tab Content */}
              {/* Section Header: Centering Details */}
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg px-6 py-3 shadow-md">
                <h2 className="text-xl font-bold">
                  Centering Details
                </h2>
              </div>

              {/* Centering Visual Analysis - Show if conversational AI or DVG has centering data */}
              {(card.conversational_sub_scores || centering.front_left_right_ratio_text || centering.back_left_right_ratio_text) && (
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border-2 border-blue-200 p-6 shadow-lg">

                {/* Card Images with Centering Bars */}
                <div className="mb-6">
                  {(() => {
                    const parseRatio = (ratioStr: string): { left: number; right: number; quality: string; color: string } => {
                      const parts = ratioStr.split('/').map(p => parseInt(p.trim()));
                      if (parts.length !== 2) return { left: 50, right: 50, quality: 'Perfect', color: 'text-green-400' };
                      const [left, right] = parts;
                      const diff = Math.abs(left - right);

                      if (diff === 0) return { left, right, quality: 'Perfect (50/50)', color: 'text-green-400' };
                      if (diff <= 4) return { left, right, quality: 'Excellent (±2%)', color: 'text-green-400' };
                      if (diff <= 8) return { left, right, quality: 'Good (±4%)', color: 'text-blue-400' };
                      if (diff <= 12) return { left, right, quality: 'Fair (±6%)', color: 'text-yellow-400' };
                      return { left, right, quality: 'Off-Center (>6%)', color: 'text-orange-400' };
                    };

                    const frontLR = parseRatio(card.conversational_centering_ratios?.front_lr || centering.front_left_right_ratio_text || '50/50');
                    const frontTB = parseRatio(card.conversational_centering_ratios?.front_tb || centering.front_top_bottom_ratio_text || '50/50');
                    const backLR = parseRatio(card.conversational_centering_ratios?.back_lr || centering.back_left_right_ratio_text || '50/50');
                    const backTB = parseRatio(card.conversational_centering_ratios?.back_tb || centering.back_top_bottom_ratio_text || '50/50');

                    return (
                      <div className="space-y-6">
                        {/* Images and Vertical Bars - Mobile Responsive */}
                        <div className="flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-4">
                          {/* Front T/B Vertical Bar (Left of Front Image) - Hidden on mobile */}
                          <div className="hidden lg:flex flex-col items-center gap-2">
                            <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">Top/Bottom</span>
                            <div className="flex flex-col h-96 w-6 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                              <div
                                className="bg-gradient-to-b from-purple-500 to-purple-400 transition-all duration-500"
                                style={{ height: `${frontTB.left}%` }}
                              />
                              <div
                                className="bg-gradient-to-b from-purple-700 to-purple-800 transition-all duration-500"
                                style={{ height: `${frontTB.right}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-purple-600 mt-2">{frontTB.left}/{frontTB.right}</span>
                          </div>

                          {/* Front Image with L/R Bar Below */}
                          <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg px-4 py-1.5">
                              <p className="text-white font-bold text-sm uppercase tracking-wider">Front</p>
                            </div>
                            <div className="relative overflow-hidden rounded-lg border-2 border-blue-300 shadow-lg w-full max-w-xs lg:w-64">
                              <img
                                src={card.front_url}
                                alt="Card Front"
                                className="w-full h-auto"
                              />
                            </div>

                            {/* Front L/R Bar directly below front image */}
                            <div className="space-y-1 w-full max-w-xs lg:w-64">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 font-semibold">L/R: <span className="text-blue-600">{frontLR.left}/{frontLR.right}</span></span>
                                <span className={`text-sm font-medium ${frontLR.color}`}>{frontLR.quality}</span>
                              </div>
                              <div className="flex h-5 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                                  style={{ width: `${frontLR.left}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-purple-700 to-purple-800 transition-all duration-500"
                                  style={{ width: `${frontLR.right}%` }}
                                />
                              </div>
                            </div>

                            {/* Front T/B ratio - Mobile Only */}
                            <div className="lg:hidden w-full max-w-xs">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 font-semibold">T/B: <span className="text-purple-600">{frontTB.left}/{frontTB.right}</span></span>
                                <span className={`text-sm font-medium ${frontTB.color}`}>{frontTB.quality}</span>
                              </div>
                              <div className="flex h-5 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                                  style={{ width: `${frontTB.left}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-purple-700 to-purple-800 transition-all duration-500"
                                  style={{ width: `${frontTB.right}%` }}
                                />
                              </div>
                            </div>

                            {card.conversational_sub_scores?.centering && (
                              <div className="text-center w-full max-w-xs lg:w-64">
                                <span className="text-sm text-gray-600">Score: </span>
                                <span className="text-xl font-bold text-blue-600">{card.conversational_sub_scores.centering.front}/10</span>
                              </div>
                            )}

                            {/* Front Centering Analysis */}
                            {(card.conversational_corners_edges_surface?.front_centering?.summary || centeringAnalysisText.front || centering.front_centering_analysis) && (
                              <div className="w-full max-w-xs lg:w-64 mt-2">
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-3 border-2 border-blue-300 shadow-md">
                                  <p className="text-xs text-blue-900 font-bold mb-1.5 uppercase tracking-wide">DCM Optic™ Analysis</p>
                                  <p className="text-xs text-gray-800 leading-relaxed">
                                    {card.conversational_corners_edges_surface?.front_centering?.summary || centeringAnalysisText.front || centering.front_centering_analysis}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Back Image with L/R Bar Below */}
                          <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg px-4 py-1.5">
                              <p className="text-white font-bold text-sm uppercase tracking-wider">Back</p>
                            </div>
                            <div className="relative overflow-hidden rounded-lg border-2 border-cyan-300 shadow-lg w-full max-w-xs lg:w-64">
                              <img
                                src={card.back_url}
                                alt="Card Back"
                                className="w-full h-auto"
                              />
                            </div>

                            {/* Back L/R Bar directly below back image */}
                            <div className="space-y-1 w-full max-w-xs lg:w-64">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 font-semibold">L/R: <span className="text-cyan-600">{backLR.left}/{backLR.right}</span></span>
                                <span className={`text-sm font-medium ${backLR.color}`}>{backLR.quality}</span>
                              </div>
                              <div className="flex h-5 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                                  style={{ width: `${backLR.left}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-purple-700 to-purple-800 transition-all duration-500"
                                  style={{ width: `${backLR.right}%` }}
                                />
                              </div>
                            </div>

                            {/* Back T/B ratio - Mobile Only */}
                            <div className="lg:hidden w-full max-w-xs">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-700 font-semibold">T/B: <span className="text-purple-600">{backTB.left}/{backTB.right}</span></span>
                                <span className={`text-sm font-medium ${backTB.color}`}>{backTB.quality}</span>
                              </div>
                              <div className="flex h-5 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                                  style={{ width: `${backTB.left}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-purple-700 to-purple-800 transition-all duration-500"
                                  style={{ width: `${backTB.right}%` }}
                                />
                              </div>
                            </div>

                            {card.conversational_sub_scores?.centering && (
                              <div className="text-center w-full max-w-xs lg:w-64">
                                <span className="text-sm text-gray-600">Score: </span>
                                <span className="text-xl font-bold text-cyan-600">{card.conversational_sub_scores.centering.back}/10</span>
                              </div>
                            )}

                            {/* Back Centering Analysis */}
                            {(card.conversational_corners_edges_surface?.back_centering?.summary || centeringAnalysisText.back || centering.back_centering_analysis) && (
                              <div className="w-full max-w-xs lg:w-64 mt-2">
                                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-3 border-2 border-cyan-300 shadow-md">
                                  <p className="text-xs text-cyan-900 font-bold mb-1.5 uppercase tracking-wide">DCM Optic™ Analysis</p>
                                  <p className="text-xs text-gray-800 leading-relaxed">
                                    {card.conversational_corners_edges_surface?.back_centering?.summary || centeringAnalysisText.back || centering.back_centering_analysis}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Back T/B Vertical Bar (Right of Back Image) - Hidden on mobile */}
                          <div className="hidden lg:flex flex-col items-center gap-2">
                            <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">Top/Bottom</span>
                            <div className="flex flex-col h-96 w-6 rounded-full overflow-hidden bg-black border-2 border-purple-500/40 shadow-md">
                              <div
                                className="bg-gradient-to-b from-purple-500 to-purple-400 transition-all duration-500"
                                style={{ height: `${backTB.left}%` }}
                              />
                              <div
                                className="bg-gradient-to-b from-purple-700 to-purple-800 transition-all duration-500"
                                style={{ height: `${backTB.right}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-purple-600 mt-2">{backTB.left}/{backTB.right}</span>
                          </div>
                        </div>

                        {/* Footnote */}
                        <div className="pt-3 border-t border-blue-200">
                          <p className="text-xs text-gray-500 text-center">
                            Perfect centering = 50/50 • Lighter shade = Primary side
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Orientation Info */}
                {dvgGrading.card_orientation && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-bold text-indigo-900 flex items-center gap-2 text-lg">
                          Card Orientation: <span className="text-indigo-600">{dvgGrading.card_orientation.detected_orientation.toUpperCase()}</span>
                        </p>
                        <p className="text-sm text-indigo-700 mt-1">
                          Aspect Ratio: {safeToFixed(dvgGrading.card_orientation.aspect_ratio, 2)}
                          {dvgGrading.card_orientation.detected_orientation === 'landscape' && ' (Horizontal)'}
                          {dvgGrading.card_orientation.detected_orientation === 'portrait' && ' (Vertical)'}
                        </p>
                      </div>
                      {(centering.primary_axis || (centering.worst_axis && centering.worst_ratio_value)) && (
                        <div className="bg-white rounded-lg px-4 py-2 border-2 border-indigo-300">
                          {centering.primary_axis && (
                            <p className="text-sm text-indigo-800">
                              <strong>Primary Axis:</strong> {centering.primary_axis === 'horizontal' ? 'Left/Right' : 'Top/Bottom'}
                            </p>
                          )}
                          {centering.worst_axis && centering.worst_ratio_value && (
                            <p className="text-sm text-red-700 font-semibold">
                              <strong>Worst:</strong> {centering.worst_axis === 'left_right' ? 'L/R' : 'T/B'} ({centering.worst_ratio_value})
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Centering Measurement Analysis Accordion */}
                {(centering.front_centering_analysis || centering.back_centering_analysis) && (
                  <details className="group bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 mt-6 shadow-md">
                    <summary className="cursor-pointer font-bold text-blue-900 hover:text-blue-700 flex items-center gap-3 p-4 rounded-xl transition-colors">
                      <span className="text-2xl group-open:rotate-90 transition-transform">▶</span>
                      <span className="text-base">How Centering Was Measured</span>
                    </summary>
                    <div className="p-5 space-y-4">
                      {centering.front_centering_analysis && (
                        <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                          <p className="font-bold text-blue-900 text-sm uppercase tracking-wide mb-2">
                            Front Analysis
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {centering.front_centering_analysis}
                          </p>
                        </div>
                      )}
                      {centering.back_centering_analysis && (
                        <div className="bg-white rounded-lg p-4 border-2 border-cyan-200 shadow-sm">
                          <p className="font-bold text-cyan-900 text-sm uppercase tracking-wide mb-2">
                            Back Analysis
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {centering.back_centering_analysis}
                          </p>
                        </div>
                      )}
                      {centering.measurement_features && centering.measurement_features.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border-2 border-indigo-200 shadow-sm">
                          <p className="font-bold text-indigo-900 text-sm uppercase tracking-wide mb-3">Features Used</p>
                          <div className="flex flex-wrap gap-2">
                            {centering.measurement_features.map((feature: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 text-xs font-semibold rounded-full border-2 border-blue-300 shadow-sm"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg p-3 shadow-sm">
                        <p className="text-sm text-amber-900 italic font-medium">
                          This analysis explains the specific visual elements and measurements used to determine centering ratios.
                        </p>
                      </div>
                    </div>
                  </details>
                )}
              </div>
              )}


                  {/* Corners Tab Content */}
              {/* Section Header: Corners, Edges and Surface Analysis */}
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg px-6 py-3 shadow-md">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Corners, Edges and Surface Analysis
                </h2>
              </div>

              {(() => {
                // Extract JSON data or fall back to parsed data
                const detailsJson = card.conversational_corners_edges_surface || {};

                // 🔍 DEBUG: Log what data we have
                console.log('[FRONTEND DEBUG] conversational_corners_edges_surface:', card.conversational_corners_edges_surface);
                console.log('[FRONTEND DEBUG] detailsJson:', detailsJson);

                // Map from new nested structure to expected flat structure
                const rawFrontCorners = detailsJson.corners?.front || detailsJson.front_corners || {};
                const rawBackCorners = detailsJson.corners?.back || detailsJson.back_corners || {};
                const rawFrontEdges = detailsJson.edges?.front || detailsJson.front_edges || {};
                const rawBackEdges = detailsJson.edges?.back || detailsJson.back_edges || {};
                const rawFrontSurface = detailsJson.surface?.front || detailsJson.front_surface || {};
                const rawBackSurface = detailsJson.surface?.back || detailsJson.back_surface || {};

                // Extract condition text from nested structure
                const frontCorners = {
                  top_left: rawFrontCorners.top_left?.condition || rawFrontCorners.top_left,
                  top_right: rawFrontCorners.top_right?.condition || rawFrontCorners.top_right,
                  bottom_left: rawFrontCorners.bottom_left?.condition || rawFrontCorners.bottom_left,
                  bottom_right: rawFrontCorners.bottom_right?.condition || rawFrontCorners.bottom_right,
                  summary: rawFrontCorners.front_summary || rawFrontCorners.summary,
                  sub_score: rawFrontCorners.score
                };

                const backCorners = {
                  top_left: rawBackCorners.top_left?.condition || rawBackCorners.top_left,
                  top_right: rawBackCorners.top_right?.condition || rawBackCorners.top_right,
                  bottom_left: rawBackCorners.bottom_left?.condition || rawBackCorners.bottom_left,
                  bottom_right: rawBackCorners.bottom_right?.condition || rawBackCorners.bottom_right,
                  summary: rawBackCorners.back_summary || rawBackCorners.summary,
                  sub_score: rawBackCorners.score
                };

                const frontEdges = {
                  top: rawFrontEdges.top?.condition || rawFrontEdges.top,
                  bottom: rawFrontEdges.bottom?.condition || rawFrontEdges.bottom,
                  left: rawFrontEdges.left?.condition || rawFrontEdges.left,
                  right: rawFrontEdges.right?.condition || rawFrontEdges.right,
                  summary: rawFrontEdges.front_summary || rawFrontEdges.summary,
                  sub_score: rawFrontEdges.score
                };

                const backEdges = {
                  top: rawBackEdges.top?.condition || rawBackEdges.top,
                  bottom: rawBackEdges.bottom?.condition || rawBackEdges.bottom,
                  left: rawBackEdges.left?.condition || rawBackEdges.left,
                  right: rawBackEdges.right?.condition || rawBackEdges.right,
                  summary: rawBackEdges.back_summary || rawBackEdges.summary,
                  sub_score: rawBackEdges.score
                };

                const frontSurface = {
                  analysis: rawFrontSurface.analysis,
                  summary: rawFrontSurface.front_summary || rawFrontSurface.summary,
                  sub_score: rawFrontSurface.score
                };

                const backSurface = {
                  analysis: rawBackSurface.analysis,
                  summary: rawBackSurface.back_summary || rawBackSurface.summary,
                  sub_score: rawBackSurface.score
                };

                return (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: FRONT */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 shadow-md">
                        <h3 className="text-lg font-bold">Front Side</h3>
                      </div>

                      {/* Front Corners */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-blue-900">Corners</h4>
                          {frontCorners.sub_score !== undefined && (
                            <span className="text-xl font-bold text-blue-600">{frontCorners.sub_score}/10</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {frontCorners.top_left && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Top Left</div>
                              <p className="text-xs text-gray-700">{frontCorners.top_left}</p>
                            </div>
                          )}
                          {frontCorners.top_right && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Top Right</div>
                              <p className="text-xs text-gray-700">{frontCorners.top_right}</p>
                            </div>
                          )}
                          {frontCorners.bottom_left && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Bottom Left</div>
                              <p className="text-xs text-gray-700">{frontCorners.bottom_left}</p>
                            </div>
                          )}
                          {frontCorners.bottom_right && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Bottom Right</div>
                              <p className="text-xs text-gray-700">{frontCorners.bottom_right}</p>
                            </div>
                          )}
                        </div>

                        {frontCorners.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-blue-300 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-blue-700 font-bold">DCM Optic™ Analysis:</span> {frontCorners.summary}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Front Edges */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-blue-900">Edges</h4>
                          {frontEdges.sub_score !== undefined && (
                            <span className="text-xl font-bold text-blue-600">{frontEdges.sub_score}/10</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {frontEdges.top && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Top</div>
                              <p className="text-xs text-gray-700">{frontEdges.top}</p>
                            </div>
                          )}
                          {frontEdges.bottom && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Bottom</div>
                              <p className="text-xs text-gray-700">{frontEdges.bottom}</p>
                            </div>
                          )}
                          {frontEdges.left && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Left</div>
                              <p className="text-xs text-gray-700">{frontEdges.left}</p>
                            </div>
                          )}
                          {frontEdges.right && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 mb-1">Right</div>
                              <p className="text-xs text-gray-700">{frontEdges.right}</p>
                            </div>
                          )}
                        </div>

                        {frontEdges.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-blue-300 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-blue-700 font-bold">DCM Optic™ Analysis:</span> {frontEdges.summary}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Front Surface */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-blue-900">Surface</h4>
                          {frontSurface.sub_score !== undefined && (
                            <span className="text-xl font-bold text-blue-600">{frontSurface.sub_score}/10</span>
                          )}
                        </div>

                        {frontSurface.analysis && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-700">{frontSurface.analysis}</p>
                          </div>
                        )}

                        {/* Display defects if available */}
                        {frontSurface.defects && Array.isArray(frontSurface.defects) && frontSurface.defects.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <div className="text-xs font-semibold text-blue-900 mb-1">Defects:</div>
                            {frontSurface.defects.map((defect: any, idx: number) => (
                              <div key={idx} className="p-2 bg-blue-50 rounded border border-blue-200">
                                <div className="text-xs font-semibold text-blue-900 mb-1">
                                  {defect.type || 'Defect'} {defect.severity && `(${defect.severity})`}
                                </div>
                                {defect.location && (
                                  <p className="text-xs text-gray-600 mb-1"><strong>Location:</strong> {defect.location}</p>
                                )}
                                {defect.size && (
                                  <p className="text-xs text-gray-600 mb-1"><strong>Size:</strong> {defect.size}</p>
                                )}
                                {defect.description && (
                                  <p className="text-xs text-gray-700">{defect.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {frontSurface.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-blue-300 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-blue-700 font-bold">DCM Optic™ Analysis:</span> {frontSurface.summary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: BACK */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg px-4 py-2 shadow-md">
                        <h3 className="text-lg font-bold">Back Side</h3>
                      </div>

                      {/* Back Corners */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-purple-900">Corners</h4>
                          {backCorners.sub_score !== undefined && (
                            <span className="text-xl font-bold text-purple-600">{backCorners.sub_score}/10</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {backCorners.top_left && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Top Left</div>
                              <p className="text-xs text-gray-700">{backCorners.top_left}</p>
                            </div>
                          )}
                          {backCorners.top_right && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Top Right</div>
                              <p className="text-xs text-gray-700">{backCorners.top_right}</p>
                            </div>
                          )}
                          {backCorners.bottom_left && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Bottom Left</div>
                              <p className="text-xs text-gray-700">{backCorners.bottom_left}</p>
                            </div>
                          )}
                          {backCorners.bottom_right && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Bottom Right</div>
                              <p className="text-xs text-gray-700">{backCorners.bottom_right}</p>
                            </div>
                          )}
                        </div>

                        {backCorners.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-purple-300 bg-purple-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-purple-700 font-bold">DCM Optic™ Analysis:</span> {backCorners.summary}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Back Edges */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-purple-900">Edges</h4>
                          {backEdges.sub_score !== undefined && (
                            <span className="text-xl font-bold text-purple-600">{backEdges.sub_score}/10</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {backEdges.top && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Top</div>
                              <p className="text-xs text-gray-700">{backEdges.top}</p>
                            </div>
                          )}
                          {backEdges.bottom && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Bottom</div>
                              <p className="text-xs text-gray-700">{backEdges.bottom}</p>
                            </div>
                          )}
                          {backEdges.left && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Left</div>
                              <p className="text-xs text-gray-700">{backEdges.left}</p>
                            </div>
                          )}
                          {backEdges.right && (
                            <div className="p-2 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 mb-1">Right</div>
                              <p className="text-xs text-gray-700">{backEdges.right}</p>
                            </div>
                          )}
                        </div>

                        {backEdges.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-purple-300 bg-purple-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-purple-700 font-bold">DCM Optic™ Analysis:</span> {backEdges.summary}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Back Surface */}
                      <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-4 min-h-[280px] flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-bold text-purple-900">Surface</h4>
                          {backSurface.sub_score !== undefined && (
                            <span className="text-xl font-bold text-purple-600">{backSurface.sub_score}/10</span>
                          )}
                        </div>

                        {backSurface.analysis && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-700">{backSurface.analysis}</p>
                          </div>
                        )}

                        {/* Display defects if available */}
                        {backSurface.defects && Array.isArray(backSurface.defects) && backSurface.defects.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <div className="text-xs font-semibold text-purple-900 mb-1">Defects:</div>
                            {backSurface.defects.map((defect: any, idx: number) => (
                              <div key={idx} className="p-2 bg-purple-50 rounded border border-purple-200">
                                <div className="text-xs font-semibold text-purple-900 mb-1">
                                  {defect.type || 'Defect'} {defect.severity && `(${defect.severity})`}
                                </div>
                                {defect.location && (
                                  <p className="text-xs text-gray-600 mb-1"><strong>Location:</strong> {defect.location}</p>
                                )}
                                {defect.size && (
                                  <p className="text-xs text-gray-600 mb-1"><strong>Size:</strong> {defect.size}</p>
                                )}
                                {defect.description && (
                                  <p className="text-xs text-gray-700">{defect.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {backSurface.summary && (
                          <div className="pt-3 mt-auto border-t-2 border-purple-300 bg-purple-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                            <p className="text-sm text-gray-800 font-medium">
                              <span className="text-purple-700 font-bold">DCM Optic™ Analysis:</span> {backSurface.summary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}


              {/* DCM Optic™ Confidence Score */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-300 shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  DCM Optic™ Confidence Score
                </h2>

                {(() => {
                  // Calculate image grade first (use same priority as display)
                  const imageGrade = card.conversational_image_confidence || card.dvg_image_quality || imageQuality?.grade || card.ai_confidence_score || 'B';

                  const getConfidenceLevel = (grade: string) => {
                    // Check grade uncertainty first (if available and matches known values)
                    // Maps to Image Confidence: A=±0.25, B=±0.5, C=±1.0, D=±1.5
                    if (recommendedGrade.grade_uncertainty === '±0.0') return { level: 'Very High', width: '95%', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                    if (recommendedGrade.grade_uncertainty === '±0.25') return { level: 'High', width: '85%', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                    if (recommendedGrade.grade_uncertainty === '±0.5') return { level: 'Medium-High', width: '70%', color: 'bg-green-400', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                    if (recommendedGrade.grade_uncertainty === '±1.0') return { level: 'Medium', width: '55%', color: 'bg-yellow-400', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
                    if (recommendedGrade.grade_uncertainty === '±1.5') return { level: 'Low', width: '40%', color: 'bg-red-400', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300' };

                    // Fallback: Use the actual image grade (from conversational AI or fallback)
                    // Maps to prompt: A=±0.25, B=±0.5, C=±1.0, D=±1.5
                    if (grade === 'A') return { level: 'High', width: '85%', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                    if (grade === 'B') return { level: 'Medium-High', width: '70%', color: 'bg-green-400', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                    if (grade === 'C') return { level: 'Medium', width: '55%', color: 'bg-yellow-400', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
                    if (grade === 'D') return { level: 'Low', width: '40%', color: 'bg-red-400', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300' };

                    // Default to Medium-High for B grade
                    return { level: 'Medium-High', width: '70%', color: 'bg-green-400', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
                  };

                  const getImageQualityInfo = (grade: string) => {
                    const gradeDefinitions = {
                      'A': {
                        name: 'Grade A - Excellent',
                        description: 'Clear, well-lit images with no obstructions. Optimal for accurate grading with minimal uncertainty.',
                        icon: '✨'
                      },
                      'B': {
                        name: 'Grade B - Good',
                        description: 'Minor issues with lighting or focus. Reliable for grading with slight uncertainty in fine details.',
                        icon: '👍'
                      },
                      'C': {
                        name: 'Grade C - Fair',
                        description: 'Moderate issues with glare, blur, or lighting. May increase grading uncertainty for defect detection.',
                        icon: '⚠️'
                      },
                      'D': {
                        name: 'Grade D - Poor',
                        description: 'Significant image quality issues that limit assessment accuracy. Results should be verified with better images.',
                        icon: '❌'
                      }
                    };
                    return gradeDefinitions[grade as keyof typeof gradeDefinitions] || gradeDefinitions['D'];
                  };

                  const confidence = getConfidenceLevel(imageGrade);
                  const gradeInfo = getImageQualityInfo(imageGrade);

                  return (
                    <>
                      {/* Confidence Bar */}
                      <div className="mb-6">
                        <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-6 rounded-full transition-all duration-500 ${confidence.color} flex items-center justify-center`}
                            style={{ width: confidence.width }}
                          >
                            <span className="text-xs font-bold text-white">{confidence.level}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-sm font-semibold text-gray-700">Confidence Level: {confidence.level}</p>
                          <p className="text-sm font-semibold text-gray-600">Grade Uncertainty: {(() => {
                            const uncertainty = recommendedGrade.grade_uncertainty || '';
                            // Extract only the ± portion (e.g., "10.0 ± 0.25" → "± 0.25")
                            const plusMinusMatch = uncertainty.match(/±\s*[\d.]+/);
                            return plusMinusMatch ? plusMinusMatch[0] : uncertainty;
                          })()}</p>
                        </div>
                      </div>

                      {/* Image Quality Grade Callout */}
                      <div className={`${confidence.bgColor} ${confidence.borderColor} border-2 rounded-lg p-4 shadow-sm`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{gradeInfo.icon}</span>
                          <div className="flex-1">
                            <h3 className={`text-lg font-bold ${confidence.textColor} mb-2`}>
                              {gradeInfo.name}
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {gradeInfo.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Professional Slab Detection - JSON Mode v4.0 */}
                      {(() => {
                        const slabDetection = card.conversational_slab_detection;
                        return slabDetection && slabDetection.detected && (
                          <div className="mt-4 bg-purple-50 border-2 border-purple-300 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-purple-800 mb-2">
                                  Professional Slab Detected: {slabDetection.company?.toUpperCase() || 'Unknown Company'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  {slabDetection.grade && (
                                    <div className="bg-white rounded p-3 border border-purple-200">
                                      <p className="font-bold text-purple-700 mb-1">Slab Grade</p>
                                      <p className="text-purple-900">{slabDetection.grade}</p>
                                      {slabDetection.grade_description && (
                                        <p className="text-xs text-purple-600 mt-1">{slabDetection.grade_description}</p>
                                      )}
                                    </div>
                                  )}
                                  {slabDetection.cert_number && (
                                    <div className="bg-white rounded p-3 border border-purple-200">
                                      <p className="font-bold text-purple-700 mb-1">Cert Number</p>
                                      <p className="text-purple-900 font-mono text-xs">{slabDetection.cert_number}</p>
                                    </div>
                                  )}
                                  {slabDetection.subgrades && (
                                    <div className="bg-white rounded p-3 border border-purple-200">
                                      <p className="font-bold text-purple-700 mb-1">Sub-Grades</p>
                                      <p className="text-xs text-purple-900">{JSON.stringify(slabDetection.subgrades.raw)}</p>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-purple-700 mt-3 italic">
                                  Note: DCM provides independent analysis. The slab grade shown is for reference only.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Protective Case Detection - Integrated into Confidence */}
                      {(() => {
                        const caseDetection = card.conversational_case_detection || dvgGrading.case_detection;
                        return caseDetection && caseDetection.case_type && caseDetection.case_type !== 'none' && (
                        <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-blue-800 mb-2">
                                Protective Case Detected: {caseDetection.case_type.replace(/_/g, ' ').toUpperCase()}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="bg-white rounded p-3 border border-blue-200">
                                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Visibility</p>
                                  <p className="font-semibold text-blue-700 capitalize">{caseDetection.visibility}</p>
                                </div>
                                <div className="bg-white rounded p-3 border border-blue-200">
                                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Impact Level</p>
                                  <p className="font-semibold text-blue-700 capitalize">{caseDetection.impact_level}</p>
                                </div>
                                {caseDetection.adjusted_uncertainty && (
                                  <div className="bg-white rounded p-3 border border-blue-200">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Adjusted Uncertainty</p>
                                    <p className="font-semibold text-blue-700">{caseDetection.adjusted_uncertainty}</p>
                                  </div>
                                )}
                              </div>
                              {caseDetection.notes && (
                                <p className="text-xs text-blue-700 mt-3 italic">
                                  {caseDetection.notes}
                                </p>
                              )}
                              <p className="text-xs text-blue-700 mt-2 italic">
                                Note: Protective cases may limit visibility of minor defects and can increase grade uncertainty.
                              </p>
                            </div>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Raw Card Notification */}
                      {(() => {
                        const caseDetection = card.conversational_case_detection || dvgGrading.case_detection;
                        return caseDetection && caseDetection.case_type === 'none' && (
                          <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-green-800 mb-1">
                                  Raw Card - No Protective Case
                                </h3>
                                <p className="text-sm text-green-700">
                                  Card photographed without protective covering. All features and defects fully visible for optimal assessment accuracy.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Footer Note */}
                      <p className="text-xs text-gray-500 mt-4 text-center">
                        Confidence based on image clarity, protective case impact, defect detection certainty, and grade uncertainty
                      </p>
                    </>
                  );
                })()}
              </div>
                  {/* Professional Grades Tab Content - Grade Estimates */}
              {/* Section Header: Professional Grades */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg px-6 py-3 shadow-md">
                <h2 className="text-xl font-bold">
                  Professional Grades
                </h2>
              </div>

              {/* Professional Grading Company Estimates */}
              {professionalGrades && (
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 p-6 shadow-lg">
                  <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-3">
                    Professional Grading Estimates
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Estimated grades from major grading companies based on measured DCM metrics. These are projections only and not official grades.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* PSA Card */}
                    <div className="bg-white rounded-lg border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg">
                        <h3 className="text-lg font-bold">PSA</h3>
                        <p className="text-xs opacity-90">Professional Sports Authenticator</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-3xl font-bold text-blue-700">
                              {professionalGrades.PSA.estimated_grade}
                            </p>
                            <p className="text-sm text-gray-600">
                              Numeric: {professionalGrades.PSA.numeric_score}
                            </p>
                          </div>
                          <div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              professionalGrades.PSA.confidence === 'high'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : professionalGrades.PSA.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}>
                              {professionalGrades.PSA.confidence.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                          {professionalGrades.PSA.notes}
                        </div>
                      </div>
                    </div>

                    {/* BGS Card */}
                    <div className="bg-white rounded-lg border-2 border-amber-200 shadow-md hover:shadow-lg transition-shadow">
                      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 rounded-t-lg">
                        <h3 className="text-lg font-bold">
                          BGS
                        </h3>
                        <p className="text-xs opacity-90">Beckett Grading Services</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-3xl font-bold text-amber-600">
                              {professionalGrades.BGS.estimated_grade}
                            </p>
                            <p className="text-sm text-gray-600">
                              Numeric: {professionalGrades.BGS.numeric_score}
                            </p>
                          </div>
                          <div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              professionalGrades.BGS.confidence === 'high'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : professionalGrades.BGS.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}>
                              {professionalGrades.BGS.confidence.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                          {professionalGrades.BGS.notes}
                        </div>
                      </div>
                    </div>

                    {/* SGC Card (with fallback to TAG for old cards) */}
                    {(professionalGrades.SGC || professionalGrades.TAG) && (
                      <div className="bg-white rounded-lg border-2 border-gray-800 shadow-md hover:shadow-lg transition-shadow">
                        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3 rounded-t-lg">
                          <h3 className="text-lg font-bold">SGC</h3>
                          <p className="text-xs opacity-90">Sportscard Guaranty</p>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-3xl font-bold text-gray-800">
                                {(professionalGrades.SGC || professionalGrades.TAG).estimated_grade}
                              </p>
                              <p className="text-sm text-gray-600">
                                Numeric: {(professionalGrades.SGC || professionalGrades.TAG).numeric_score}
                              </p>
                            </div>
                            <div>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                (professionalGrades.SGC || professionalGrades.TAG).confidence === 'high'
                                  ? 'bg-green-100 text-green-800 border border-green-300'
                                  : (professionalGrades.SGC || professionalGrades.TAG).confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}>
                                {(professionalGrades.SGC || professionalGrades.TAG).confidence.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            {(professionalGrades.SGC || professionalGrades.TAG).notes}
                            {!professionalGrades.SGC && professionalGrades.TAG && (
                              <div className="mt-2 text-xs text-amber-600">
                                ⚠️ Showing TAG estimate (legacy) - regrade to get SGC estimate
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CGC Card (with fallback to CSG for old cards) */}
                    {(professionalGrades.CGC || professionalGrades.CSG) && (
                      <div className="bg-white rounded-lg border-2 border-teal-200 shadow-md hover:shadow-lg transition-shadow">
                        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-3 rounded-t-lg">
                          <h3 className="text-lg font-bold">CGC</h3>
                          <p className="text-xs opacity-90">Certified Guaranty Company</p>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-3xl font-bold text-teal-700">
                                {(professionalGrades.CGC || professionalGrades.CSG).estimated_grade}
                              </p>
                              <p className="text-sm text-gray-600">
                                Numeric: {(professionalGrades.CGC || professionalGrades.CSG).numeric_score}
                              </p>
                            </div>
                            <div>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                (professionalGrades.CGC || professionalGrades.CSG).confidence === 'high'
                                  ? 'bg-green-100 text-green-800 border border-green-300'
                                  : (professionalGrades.CGC || professionalGrades.CSG).confidence === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  : 'bg-gray-100 text-gray-800 border border-gray-300'
                              }`}>
                                {(professionalGrades.CGC || professionalGrades.CSG).confidence.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            {(professionalGrades.CGC || professionalGrades.CSG).notes}
                            {!professionalGrades.CGC && professionalGrades.CSG && (
                              <div className="mt-2 text-xs text-amber-600">
                                ⚠️ Showing CSG estimate (legacy) - regrade to get CGC estimate
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-900">
                      <strong>⚠️ Disclaimer:</strong> These are estimates based on visual analysis and published grading standards.
                      Actual professional grades may vary. Only official grading by these companies provides authentic certification.
                    </p>
                  </div>
                </div>
              )}

                  {/* Market & Pricing Tab Content */}
              {/* Section Header: Market & Pricing */}
              <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-lg px-6 py-3 shadow-md">
                <h2 className="text-xl font-bold">
                  Market & Pricing
                </h2>
              </div>

              {/* Find and Price This Card */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-bold mb-3 text-gray-800">Market Listings</h2>

                {/* eBay Marketplace Buttons - Only eBay for Other cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* eBay General Search */}
                  <a
                    href={generateOtherEbaySearchUrl({
                      category: 'Other',
                      card_name: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
                      manufacturer: extractEnglishForSearch(cardInfo.manufacturer) || extractEnglishForSearch(card.manufacturer),
                      card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
                      card_date: cardInfo.card_date || card.card_date,
                      card_number: cardInfo.card_number || card.card_number,
                      dcm_grade_whole: card.conversational_whole_grade
                    } as CardData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 group"
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center mr-3 group-hover:scale-105 transition-transform flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-blue-900 text-sm">eBay</h3>
                      <p className="text-xs text-blue-700 truncate">Active listings</p>
                    </div>
                  </a>

                  {/* eBay Sold Listings */}
                  <a
                    href={generateOtherEbaySoldListingsUrl({
                      category: 'Other',
                      card_name: extractEnglishForSearch(cardInfo.card_name) || extractEnglishForSearch(card.card_name),
                      manufacturer: extractEnglishForSearch(cardInfo.manufacturer) || extractEnglishForSearch(card.manufacturer),
                      card_set: extractEnglishForSearch(cardInfo.set_name) || extractEnglishForSearch(card.card_set),
                      card_date: cardInfo.card_date || card.card_date,
                      card_number: cardInfo.card_number || card.card_number,
                      dcm_grade_whole: card.conversational_whole_grade
                    } as CardData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200 group"
                  >
                    <div className="w-10 h-10 bg-green-600 rounded flex items-center justify-center mr-3 group-hover:scale-105 transition-transform flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-green-900 text-sm">eBay Sold</h3>
                      <p className="text-xs text-green-700 truncate">Price history</p>
                    </div>
                  </a>
                </div>

              </div>
            </div>
          )}

          {/* 3. Category Breakdown Scores (v3.0) - Legacy Fallback */}
          {(!dvgGrading || Object.keys(dvgGrading).length === 0) && (() => {
            // v3.1: Read category scores with fallback to v3.1 category_scores field
            const categoryScores = gradingScale["Category Scores"] || card.ai_grading?.category_scores;
            return categoryScores && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Category Breakdown Scores</h2>
                {card.ai_grading?.["Alteration Check"]?.card_is_altered && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    ⚠️ Category scores are not applicable for altered cards. See Alteration Check section below for details.
                  </div>
                )}
                <div className="space-y-4">
                  {Object.entries(categoryScores).map(([category, data]: [string, any]) => {
                  const rawScore = data.score;
                  const isNA = rawScore === "NA" || rawScore === null || rawScore === undefined;
                  const score = isNA ? 0 : (typeof rawScore === 'number' ? rawScore : parseFloat(rawScore) || 0);
                  const weight = data.weight || 0;
                  const contribution = data.contribution || 0;
                  const percentage = isNA ? 0 : (score / 10) * 100;
                  // Convert weight to percentage if it's a decimal (0.30 → 30%)
                  const weightPercent = weight < 1 ? safeToFixed(weight * 100, 0) : safeToFixed(weight, 0);

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800 capitalize">
                          {category.replace(/_/g, ' ')}
                        </span>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${isNA ? 'text-red-600' : 'text-blue-600'}`}>
                            {isNA ? 'NA' : safeToFixed(score, 1)}
                          </span>
                          {!isNA && <span className="text-sm text-gray-500 ml-2">/ 10</span>}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isNA ? 'bg-gray-400' :
                            percentage >= 90 ? 'bg-green-500' :
                            percentage >= 80 ? 'bg-blue-500' :
                            percentage >= 70 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Weight: {weightPercent}%</span>
                        <span>Contribution: {isNA ? 'N/A' : safeToFixed(contribution, 2)}</span>
                      </div>
                    </div>
                  );
                })}
                {gradingScale["Weighted Composite Score"] && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Weighted Composite Score:</span>
                      <span className={`text-3xl font-bold ${card.ai_grading?.["Alteration Check"]?.card_is_altered ? 'text-red-600' : 'text-blue-600'}`}>
                        {card.ai_grading?.["Alteration Check"]?.card_is_altered
                          ? 'NA'
                          : safeToFixed(gradingScale["Weighted Composite Score"], 2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* 4. DCM Confidence and Image Quality */}
          {(card.ai_grading?.["AI Confidence Assessment"] || card.ai_grading?.["Image Conditions"]) && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">DCM Confidence and Image Quality</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* DCM Confidence Section */}
                {card.ai_grading?.["AI Confidence Assessment"] && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">DCM Confidence</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-gray-600">Confidence Tier:</span>
                        <span className={`ml-2 capitalize font-bold ${
                          card.ai_grading["AI Confidence Assessment"]["Confidence Tier"] === 'high' ? 'text-green-600' :
                          card.ai_grading["AI Confidence Assessment"]["Confidence Tier"] === 'medium' ? 'text-blue-600' :
                          'text-yellow-600'
                        }`}>
                          {renderValue(card.ai_grading["AI Confidence Assessment"]["Confidence Tier"])}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Confidence Letter Grade:</span>
                        <span className="ml-2 font-bold text-lg text-blue-600">
                          {renderValue(card.ai_grading["AI Confidence Assessment"]["Confidence Letter Grade"])}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-600">Grade Uncertainty:</span>
                        <span className="ml-2 font-semibold">
                          {renderValue(card.ai_grading["AI Confidence Assessment"]["Grade Uncertainty"])}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Quality Section */}
                {card.ai_grading?.["Image Conditions"] && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Image Quality</h3>

                    {/* Overall Quality Score */}
                    {card.ai_grading["Image Conditions"]["Overall Quality Score"] && (
                      <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Overall Score:</span>
                          <span className={`text-2xl font-bold ${
                            Number(card.ai_grading["Image Conditions"]["Overall Quality Score"]) >= 7 ? 'text-green-600' :
                            Number(card.ai_grading["Image Conditions"]["Overall Quality Score"]) >= 5 ? 'text-blue-600' :
                            'text-yellow-600'
                          }`}>
                            {renderValue(card.ai_grading["Image Conditions"]["Overall Quality Score"])}/10
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Resolution:</span>
                        <span className={`capitalize ${
                          card.ai_grading["Image Conditions"]["Resolution"] === 'high' ? 'text-green-600 font-semibold' :
                          card.ai_grading["Image Conditions"]["Resolution"] === 'standard' ? 'text-blue-600' :
                          'text-red-600'
                        }`}>
                          {renderValue(card.ai_grading["Image Conditions"]["Resolution"])}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Lighting:</span>
                        <span className={`capitalize ${
                          card.ai_grading["Image Conditions"]["Lighting"] === 'even' ? 'text-green-600 font-semibold' :
                          card.ai_grading["Image Conditions"]["Lighting"] === 'adequate' ? 'text-blue-600' :
                          'text-red-600'
                        }`}>
                          {renderValue(card.ai_grading["Image Conditions"]["Lighting"])}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Clarity:</span>
                        <span className={`capitalize ${
                          card.ai_grading["Image Conditions"]["Clarity"] === 'sharp' ? 'text-green-600 font-semibold' :
                          card.ai_grading["Image Conditions"]["Clarity"] === 'moderate' ? 'text-blue-600' :
                          'text-red-600'
                        }`}>
                          {renderValue(card.ai_grading["Image Conditions"]["Clarity"])}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Glare:</span>
                        <span className={`${
                          card.ai_grading["Image Conditions"]["Glare Present"] === 'Yes' ? 'text-red-600 font-semibold' :
                          'text-green-600 font-semibold'
                        }`}>
                          {renderValue(card.ai_grading["Image Conditions"]["Glare Present"])}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-600">Quality Tier:</span>
                        <span className={`capitalize font-semibold ${
                          card.ai_grading["Image Conditions"]["Quality Tier"] === 'high' ? 'text-green-600' :
                          card.ai_grading["Image Conditions"]["Quality Tier"] === 'medium' ? 'text-blue-600' :
                          'text-yellow-600'
                        }`}>
                          {renderValue(card.ai_grading["Image Conditions"]["Quality Tier"])}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info Sections */}
              {card.ai_grading?.["AI Confidence Assessment"]?.["Grading Reliability"] && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Grading Reliability: </span>
                    {card.ai_grading["AI Confidence Assessment"]["Grading Reliability"]}
                  </p>
                </div>
              )}

              {card.ai_grading?.["Image Conditions"]?.["Impact on Grading"] && (
                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Impact on Grading: </span>
                    {card.ai_grading["Image Conditions"]["Impact on Grading"]}
                  </p>
                </div>
              )}

              {card.ai_grading?.["AI Confidence Assessment"]?.["Recommendations"] && (
                <div className="mt-4 bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Recommendations</h3>
                  {Array.isArray(card.ai_grading["AI Confidence Assessment"]["Recommendations"]) ? (
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {card.ai_grading["AI Confidence Assessment"]["Recommendations"].map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700">{card.ai_grading["AI Confidence Assessment"]["Recommendations"]}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Card Detection Assessment */}
          {card.ai_grading?.["Card Detection Assessment"] && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Card Detection Assessment</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="font-semibold text-gray-600">Detection Confidence:</span>
                    <span className="ml-2">{renderValue(card.ai_grading["Card Detection Assessment"]["Detection Confidence"])}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Aspect Ratio:</span>
                    <span className="ml-2">{renderValue(card.ai_grading["Card Detection Assessment"]["Detected Aspect Ratio"])}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Aspect Ratio Validation:</span>
                    <span className={`ml-2 ${card.ai_grading["Card Detection Assessment"]["Aspect Ratio Validation"] === "Pass" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}`}>
                      {renderValue(card.ai_grading["Card Detection Assessment"]["Aspect Ratio Validation"])}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="font-semibold text-gray-600">Boundary Quality:</span>
                    <span className="ml-2">{renderValue(card.ai_grading["Card Detection Assessment"]["Card Boundary Quality"])}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Detection Factors:</span>
                    <span className="ml-2">{renderValue(card.ai_grading["Card Detection Assessment"]["Detection Factors"])}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Impact on Grading:</span>
                    <span className="ml-2">{renderValue(card.ai_grading["Card Detection Assessment"]["Detection Impact on Grading"])}</span>
                  </div>
                </div>
              </div>
              {card.ai_grading["Card Detection Assessment"]["Fallback Methods Used"] && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <span className="font-semibold text-yellow-800">Fallback Methods Used:</span>
                  <span className="ml-2 text-yellow-700">{card.ai_grading["Card Detection Assessment"]["Fallback Methods Used"]}</span>
                </div>
              )}
            </div>
          )}

          {/* 5. Professional Grading Company Estimates - REMOVED OLD SECTION */}
          {/* v2.2 REVISED: Execution Control & Fatal Flags */}
          {card.ai_grading?.["Execution Control"] && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Grading Process Status
                </h3>
              </div>
              <div className="p-4 bg-white space-y-3">
                {/* All Steps Completed */}
                <div className="flex items-center gap-2">
                  {card.ai_grading["Execution Control"].all_steps_completed ? (
                    <>
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-green-700 font-medium">All grading steps completed successfully</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-yellow-700 font-medium">Some steps incomplete or skipped</span>
                    </>
                  )}
                </div>

                {/* Skipped Steps Warning */}
                {card.ai_grading["Execution Control"].skipped_steps && card.ai_grading["Execution Control"].skipped_steps.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-sm font-medium text-yellow-800 mb-1">⚠️ Skipped Steps:</div>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {card.ai_grading["Execution Control"].skipped_steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fatal Flags Alert */}
                {card.ai_grading["Execution Control"].fatal_flags && card.ai_grading["Execution Control"].fatal_flags.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm font-medium text-red-800 mb-1">🚨 Critical Issues Detected:</div>
                    <ul className="text-sm text-red-700 list-disc list-inside">
                      {card.ai_grading["Execution Control"].fatal_flags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* END OF DVG SECTIONS */}

          {/* Delete Card Section */}
          {/* 7. Front/Back Specific Feedback (Parallel Processing v2.3) */}
          {(card.ai_grading?.front_specific_feedback || card.ai_grading?.back_specific_feedback) && (
            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">📊 Front/Back Analysis</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Front Analysis */}
                {card.ai_grading.front_specific_feedback && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-3">
                      Front Condition
                    </h3>
                    <p className="text-sm text-blue-800 mb-3">
                      {card.ai_grading.front_specific_feedback.overall_front_condition || 'Analysis complete'}
                    </p>
                    <div className="text-xs text-blue-700 space-y-1">
                      {card.ai_grading.front_specific_feedback.corner_status && (
                        <div><strong>Corners:</strong> {card.ai_grading.front_specific_feedback.corner_status}</div>
                      )}
                      {card.ai_grading.front_specific_feedback.edge_status && (
                        <div><strong>Edges:</strong> {card.ai_grading.front_specific_feedback.edge_status}</div>
                      )}
                      {card.ai_grading.front_specific_feedback.surface_status && (
                        <div><strong>Surface:</strong> {card.ai_grading.front_specific_feedback.surface_status}</div>
                      )}
                      {card.ai_grading.front_specific_feedback.centering_lr && card.ai_grading.front_specific_feedback.centering_tb && (
                        <div><strong>Centering:</strong> {card.ai_grading.front_specific_feedback.centering_lr} L/R, {card.ai_grading.front_specific_feedback.centering_tb} T/B</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Back Analysis */}
                {card.ai_grading.back_specific_feedback && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-green-900 mb-3">
                      Back Condition
                    </h3>
                    <p className="text-sm text-green-800 mb-3">
                      {card.ai_grading.back_specific_feedback.overall_back_condition || 'Analysis complete'}
                    </p>
                    <div className="text-xs text-green-700 space-y-1">
                      {card.ai_grading.back_specific_feedback.corner_status && (
                        <div><strong>Corners:</strong> {card.ai_grading.back_specific_feedback.corner_status}</div>
                      )}
                      {card.ai_grading.back_specific_feedback.edge_status && (
                        <div><strong>Edges:</strong> {card.ai_grading.back_specific_feedback.edge_status}</div>
                      )}
                      {card.ai_grading.back_specific_feedback.surface_status && (
                        <div><strong>Surface:</strong> {card.ai_grading.back_specific_feedback.surface_status}</div>
                      )}
                      {card.ai_grading.back_specific_feedback.centering_lr && card.ai_grading.back_specific_feedback.centering_tb && (
                        <div><strong>Centering:</strong> {card.ai_grading.back_specific_feedback.centering_lr} L/R, {card.ai_grading.back_specific_feedback.centering_tb} T/B</div>
                      )}
                      {card.ai_grading.back_specific_feedback.authentication_status && (
                        <div className="font-semibold mt-2 pt-2 border-t border-green-200">
                          {card.ai_grading.back_specific_feedback.authentication_status}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. Text Transcription (OCR) - Parallel Processing v2.3 */}
          {card.ai_grading?.text_transcription_summary && (
            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Card Text (OCR)</h2>
              <p className="text-xs text-gray-500 mb-4 italic">
                All visible text extracted from card images for searchability and verification
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Front Text */}
                {card.ai_grading.text_transcription_summary.front_key_text && card.ai_grading.text_transcription_summary.front_key_text.length > 0 && (
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Front Text ({card.ai_grading.text_transcription_summary.front_text_count || 0} items)</h3>
                    <ul className="text-sm space-y-1 text-gray-600">
                      {card.ai_grading.text_transcription_summary.front_key_text.map((text: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Back Text */}
                {card.ai_grading.text_transcription_summary.back_key_text && card.ai_grading.text_transcription_summary.back_key_text.length > 0 && (
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Back Text ({card.ai_grading.text_transcription_summary.back_text_count || 0} items)</h3>
                    <ul className="text-sm space-y-1 text-gray-600">
                      {card.ai_grading.text_transcription_summary.back_key_text.map((text: string, i: number) => (
                        <li key={i} className="flex items-start">
                          <span className="text-green-500 mr-2">•</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {card.ai_grading.text_transcription_summary.transcription_confidence && (
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Transcription Confidence: <span className={`font-semibold ${
                    card.ai_grading.text_transcription_summary.transcription_confidence === 'high' ? 'text-green-600' :
                    card.ai_grading.text_transcription_summary.transcription_confidence === 'medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>{card.ai_grading.text_transcription_summary.transcription_confidence.toUpperCase()}</span>
                </div>
              )}
            </div>
          )}

          {/* DCM Optic™ Report */}
          {card.conversational_grading && (
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-xl p-8 mt-8 border border-indigo-200">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-6 border-b-2 border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-3 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">DCM Optic™ Report</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowConversationalGrading(!showConversationalGrading)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  {showConversationalGrading ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      Hide Full Report
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      View Full Report
                    </>
                  )}
                </button>
              </div>

              {/* Expanded Report */}
              {showConversationalGrading && (
                <div className="space-y-6">
                  {/* Professional Executive Report */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 border-b border-gray-200">
                      <h3 className="text-2xl font-bold text-white">DCM Optic™ Analysis Report</h3>
                      <p className="text-sm text-indigo-100 mt-2">Professional Card Grading Assessment</p>
                    </div>
                    <div className="p-8">
                      {(() => {
                        // Parse and format the report professionally
                        const report = card.conversational_grading || '';

                        // 🆕 v4.0: Detect if report is JSON format
                        let isJSONReport = false;
                        let jsonData: any = null;

                        try {
                          jsonData = JSON.parse(report);
                          isJSONReport = true;
                          console.log('[DCM Optic Report] 📊 JSON format detected, formatting for display');
                        } catch {
                          console.log('[DCM Optic Report] 📝 Markdown format detected');
                        }

                        // JSON Format Handler
                        if (isJSONReport && jsonData) {
                          const formatJSONSection = (title: string, content: any, isFirst = false) => {
                            if (!content) return null;

                            let formattedContent = '';

                            if (typeof content === 'string') {
                              formattedContent = content;
                            } else if (typeof content === 'object') {
                              // Filter out Pokemon-specific fields for sports cards
                              const pokemonFields = ['pokemon_type', 'pokemon_stage', 'hp', 'card_type'];
                              const filteredEntries = Object.entries(content).filter(([key, value]) => {
                                // Skip Pokemon fields that are null or undefined
                                if (pokemonFields.includes(key) && (value === null || value === undefined)) {
                                  return false;
                                }
                                return true;
                              });

                              formattedContent = filteredEntries
                                .map(([key, value]) => {
                                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                  if (typeof value === 'object') {
                                    return `${label}:\n${JSON.stringify(value, null, 2)}`;
                                  }
                                  return `${label}: ${value}`;
                                })
                                .join('\n\n');
                            }

                            return (
                              <div key={title} className={`${isFirst ? '' : 'mt-8 pt-8 border-t border-gray-200'}`}>
                                <h4 className="text-lg font-bold text-gray-900 mb-4">{title}</h4>
                                <div className="text-gray-700 leading-relaxed space-y-3 whitespace-pre-line">
                                  {formattedContent}
                                </div>
                              </div>
                            );
                          };

                          return (
                            <div className="prose prose-sm max-w-none">
                              {formatJSONSection('Card Information', jsonData.card_info, true)}
                              {formatJSONSection('Front Evaluation', jsonData.front, false)}
                              {formatJSONSection('Back Evaluation', jsonData.back, false)}
                              {formatJSONSection('Image Quality Assessment', jsonData.image_confidence, false)}
                              {formatJSONSection('Centering Analysis', jsonData.centering, false)}
                              {formatJSONSection('Corner Analysis', jsonData.corners, false)}
                              {formatJSONSection('Edge Analysis', jsonData.edges, false)}
                              {formatJSONSection('Surface Analysis', jsonData.surface, false)}
                              {formatJSONSection('Defect Pattern Analysis', jsonData.defect_pattern_analysis, false)}
                              {formatJSONSection('Sub-Scores', jsonData.sub_scores, false)}
                              {formatJSONSection('Final Grade Calculation', jsonData.final_grade || {
                                decimal_grade: jsonData.decimal_grade,
                                whole_grade: jsonData.whole_grade,
                                preliminary_grade: jsonData.preliminary_grade,
                                grade_range: jsonData.grade_range,
                                condition_label: jsonData.condition_label,
                                limiting_factor: jsonData.limiting_factor
                              }, false)}
                              {formatJSONSection('Grade Cap Analysis', jsonData.grade_cap_analysis, false)}
                              {formatJSONSection('Professional Grade Estimates', jsonData.professional_grade_estimates, false)}

                              {/* Meta Information */}
                              {jsonData.prompt_version && (
                                <div className="mt-8 pt-8 border-t-2 border-gray-300 bg-gray-50 -mx-8 -mb-8 px-8 py-6">
                                  <h4 className="text-lg font-bold text-gray-900 mb-3">Evaluation Details</h4>
                                  <div className="space-y-3 text-sm">
                                    {/* Prompt Version - Full Width */}
                                    <div>
                                      <span className="font-semibold text-gray-700">Prompt Version:</span>{' '}
                                      <span className="text-gray-600">{jsonData.prompt_version}</span>
                                    </div>
                                    {/* Evaluation Date and Processing Time - Side by Side */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <span className="font-semibold text-gray-700">Evaluation Date:</span>{' '}
                                        <span className="text-gray-600">{formatGradedDate(card.created_at)}</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-gray-700">Processing Time:</span>{' '}
                                        <span className="text-gray-600">
                                          {card.processing_time ? `${(card.processing_time / 1000).toFixed(1)}s` : 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Markdown Format Handler (existing logic)
                        // Extract sections by step markers
                        const extractStep = (stepNum: number | string, stepTitle?: string) => {
                          const regex = new RegExp(`\\[STEP ${stepNum}\\][^\\n]*\\n([\\s\\S]*?)(?=\\[STEP |:::META|$)`, 'i');
                          const match = report.match(regex);
                          return match ? match[1].trim() : '';
                        };

                        // Extract meta section
                        const extractMeta = () => {
                          const metaMatch = report.match(/:::META[\s\S]*?Prompt Version:\s*([^\n]+)[\s\S]*?Evaluation Date:\s*([^\n]+)/i);
                          return metaMatch ? {
                            promptVersion: metaMatch[1].trim(),
                            evaluationDate: metaMatch[2].trim()
                          } : null;
                        };

                        // Parse markdown tables into clean format
                        const parseTable = (text: string): string => {
                          const lines = text.split('\n');
                          const tableLines: string[] = [];
                          let inTable = false;
                          let headers: string[] = [];

                          for (const line of lines) {
                            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                              const cells = line.split('|').map(c => c.trim()).filter(c => c);

                              // Skip separator rows
                              if (cells.every(cell => /^[-:]+$/.test(cell))) {
                                continue;
                              }

                              if (!inTable) {
                                // First row is headers
                                headers = cells;
                                inTable = true;
                              } else {
                                // Data rows - format as key: value
                                if (cells.length === headers.length) {
                                  // Special handling for Field/Description tables
                                  if (headers.length === 2 &&
                                      headers[0].toLowerCase().includes('field') &&
                                      headers[1].toLowerCase().includes('description')) {
                                    // Format as: FirstColumn: SecondColumn
                                    if (cells[0] && cells[1]) {
                                      tableLines.push(`${cells[0]}: ${cells[1]}`);
                                    }
                                  } else {
                                    // Standard format with header labels
                                    for (let i = 0; i < headers.length; i++) {
                                      if (cells[i]) {
                                        tableLines.push(`${headers[i]}: ${cells[i]}`);
                                      }
                                    }
                                    tableLines.push(''); // Blank line between rows
                                  }
                                }
                              }
                            } else {
                              if (inTable && tableLines.length > 0) {
                                inTable = false;
                              }
                              tableLines.push(line);
                            }
                          }

                          return tableLines.join('\n');
                        };

                        // Clean markdown artifacts from text
                        const cleanMarkdown = (text: string) => {
                          // First parse tables
                          let cleaned = parseTable(text);

                          // Then clean other markdown
                          cleaned = cleaned
                            // Remove block markers
                            .replace(/:::[\w_]+/gi, '')
                            // Remove standalone ## lines
                            .replace(/^##\s*$/gm, '')
                            // Remove heading markers from start of lines
                            .replace(/^#{1,6}\s+/gm, '')
                            // Remove bold markers
                            .replace(/\*\*([^*]+)\*\*/g, '$1')
                            // Remove italic markers
                            .replace(/\*([^*]+)\*/g, '$1')
                            // Convert markdown list markers to bullets
                            .replace(/^[-*+]\s+/gm, '  • ')
                            // Remove deprecated fields
                            .replace(/^.*Rarity Tier.*$/gm, '') // Remove Rarity Tier line
                            // Normalize multiple line breaks
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();

                          return cleaned;
                        };

                        // Format a section with title and content
                        const formatSection = (title: string, content: string, isFirst = false) => {
                          if (!content) return null;
                          const cleaned = cleanMarkdown(content);
                          return (
                            <div key={title} className={`${isFirst ? '' : 'mt-8 pt-8 border-t border-gray-200'}`}>
                              <h4 className="text-lg font-bold text-gray-900 mb-4">{title}</h4>
                              <div className="text-gray-700 leading-relaxed space-y-3 whitespace-pre-line">
                                {cleaned}
                              </div>
                            </div>
                          );
                        };

                        // Extract all steps
                        const step1 = extractStep(1);
                        const step2 = extractStep(2);
                        const step3 = extractStep(3);
                        const step4 = extractStep(4);
                        const step5 = extractStep(5);
                        const step6 = extractStep(6);
                        const step7 = extractStep(7);
                        const step8 = extractStep(8);
                        const step9 = extractStep(9);
                        const step10 = extractStep(10);
                        const step11 = extractStep(11);
                        const meta = extractMeta();

                        // Render sections in specified order
                        return (
                          <div className="prose prose-sm max-w-none">
                            {formatSection('Card Information Details', step1, true)}
                            {formatSection('Front Evaluation', step3)}
                            {formatSection('Back Evaluation', step4)}
                            {formatSection('Image Quality & Confidence Assessment', step2)}
                            {formatSection('Centering Analysis', step5)}
                            {formatSection('Defect Pattern Analysis', step6)}
                            {formatSection('Sub-Score Guidelines', step7)}
                            {formatSection('Final Grade Calculation', step8)}
                            {formatSection('Grade Cap Enforcement', step9)}
                            {formatSection('Final Grade', step10)}
                            {formatSection('Condition Label', step11)}

                            {/* Meta Information */}
                            {meta && (
                              <div className="mt-8 pt-8 border-t-2 border-gray-300 bg-gray-50 -mx-8 -mb-8 px-8 py-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-3">Evaluation Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-700">Prompt Version:</span>{' '}
                                    <span className="text-gray-600">{meta.promptVersion}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700">Evaluation Date:</span>{' '}
                                    <span className="text-gray-600">{meta.evaluationDate}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Graded Date Section */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              Graded Date: <span className="font-semibold text-gray-800">{formatGradedDate(card.created_at)}</span>
            </p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Delete card from collection
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Delete Card from Collection
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              Are you sure you want to delete this card from your DCM collection? This action will permanently remove the card and all associated data from the system.
            </p>
            <p className="text-xs text-red-600 text-center mb-6 font-medium">
              ⚠️ This action is non-reversible
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteCard}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete Card'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEBUG PANEL - Development Only */}
      {/* Image Zoom Modal */}
      <ImageZoomModal
        isOpen={zoomModal.isOpen}
        onClose={closeZoomModal}
        imageUrl={zoomModal.imageUrl}
        alt={zoomModal.alt}
        title={zoomModal.title}
      />
    </div>
  );
}

export default OtherCardDetails;