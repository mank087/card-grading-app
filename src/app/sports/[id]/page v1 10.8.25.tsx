"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { QRCodeCanvas } from 'qrcode.react';
import GradeBadge from "../../ui/GradeBadge";
import ImageZoomModal from "./ImageZoomModal";
import { generateEbaySearchUrl, generateEbaySoldListingsUrl, type CardData } from "@/lib/ebayUtils";
import {
  generateFacebookShareUrl,
  generateTwitterShareUrl,
  handleInstagramShare,
  copyCardUrl,
  openSocialShare,
  showShareSuccess,
  type CardSharingData
} from "@/lib/socialUtils";
import { assessCardCondition, getConditionColor, getConditionDescription, type DCMConditionAssessment, type VisualInspectionResults } from '@/lib/conditionAssessment';

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

const getGradeColor = (grade: string | number) => {
  const numGrade = typeof grade === 'string' ? parseFloat(grade) : grade;
  if (numGrade >= 9.5) return 'text-green-600 font-bold';
  if (numGrade >= 8.5) return 'text-blue-600 font-semibold';
  if (numGrade >= 7.0) return 'text-yellow-600 font-semibold';
  if (numGrade >= 5.0) return 'text-orange-600';
  return 'text-red-600';
};

export default function SportsCardDetails() {
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
  const [zoomModal, setZoomModal] = useState<{isOpen: boolean, imageUrl: string, alt: string, title: string}>({
    isOpen: false,
    imageUrl: '',
    alt: '',
    title: ''
  });

  // Fetch sports card details using sports-specific API
  const fetchSportsCardDetails = useCallback(async () => {
    if (!cardId) return;

    try {
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      console.log(`[FRONTEND DEBUG] Calling DVG v1 endpoint: /api/vision-grade/${cardId}`);
      const res = await fetch(`/api/vision-grade/${cardId}?t=${Date.now()}`); // Cache-busting
      console.log(`[FRONTEND DEBUG] DVG v1 API response status: ${res.status}`);

      if (!res.ok) {
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
              console.log(`[FRONTEND DEBUG] Retry ${attempt}: Calling /api/vision-grade/${cardId}`);
              const retryRes = await fetch(`/api/vision-grade/${cardId}?t=${Date.now()}`); // Cache-busting

              if (retryRes.ok) {
                const data = await retryRes.json();
                console.log('[FRONTEND DEBUG] DVG v1 card data received after retry:', data);
                setCard(data);
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
      setCard(data);

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
      console.log('Fetching sports card details for:', cardId);
      fetchSportsCardDetails();
    }
  }, [cardId, fetchSportsCardDetails]);

  // Set origin for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

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
    return (
      <div className="text-red-500 text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p>{error}</p>
        <div className="mt-4 space-x-4">
          <button
            onClick={fetchSportsCardDetails}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
          <Link href="/upload/sports" className="text-blue-500 inline-block">
            Back to Sports Upload
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Sports Card Not Found</h1>
        <Link href="/upload/sports" className="text-blue-500">
          Back to Sports Upload
        </Link>
      </div>
    );
  }

  // Extract data from AI grading
  // DVG v1 data structure
  const dvgGrading = card.dvg_grading || {};
  const cardInfo = dvgGrading.card_info || {};
  const recommendedGrade = dvgGrading.recommended_grade || {};
  const centering = dvgGrading.centering || {};
  const imageQuality = dvgGrading.image_quality || {};
  const analysisSummary = dvgGrading.analysis_summary || {};
  const defects = dvgGrading.defects || {};

  // Legacy fallback for compatibility
  const aiCardInfo = card.ai_grading?.["Card Information"] || {};
  const aiCardDetails = card.ai_grading?.["Card Details"] || {};
  const finalScore = card.ai_grading?.["Final Score"] || {};
  const gradingScale = card.ai_grading?.["Grading (DCM Master Scale)"] || {};
  const visualInspection = gradingScale["Visual_Inspection_Results"] || {};

  // v3.1: Read centering from multiple possible sources (v3.1 centerings_used, legacy Centering_Measurements, or stage0_detection)
  const centeringData = card.ai_grading?.["Centering_Measurements"] ||
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
  console.log('[Sports Page] Card AI grading:', card.ai_grading);
  console.log('[Sports Page] Grading scale data:', gradingScale);
  console.log('[Sports Page] Visual inspection results:', visualInspection);
  console.log('[Sports Page] Centering measurements variable:', centeringMeasurements);
  console.log('[Sports Page] Centering measurements has data?', Object.keys(centeringMeasurements).length > 0);
  console.log('[Sports Page] front_x_axis_ratio value:', centeringMeasurements?.front_x_axis_ratio);
  console.log('[Sports Page] Centering_Measurements (underscore):', card.ai_grading?.["Centering_Measurements"]);
  console.log('[Sports Page] Available ai_grading keys:', card.ai_grading ? Object.keys(card.ai_grading) : 'none');
  const companyScores = card.ai_grading?.["Estimated Scoring by Major Companies"] || {};
  const dcmSystem = card.ai_grading?.["DCM Score System"] || {};
  const aiConfidence = card.ai_grading?.["AI Confidence Assessment"] || {};

  // Calculate DCM Condition Assessment from visual inspection results
  const dcmConditionAssessment: DCMConditionAssessment | null = visualInspection && Object.keys(visualInspection).length > 0
    ? assessCardCondition(visualInspection as VisualInspectionResults)
    : null;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/upload/sports" className="text-blue-600 hover:text-blue-800">
          ← Back to Sports Upload
        </Link>
        <div className="flex items-center space-x-4">
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            🏈 Sports Card
          </div>
          <div className="text-sm text-gray-500">
            {card.processing_time && (
              <span>Evaluated in {(card.processing_time / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="space-y-8">
        {/* DCM Card Label - Centered at Top */}
        <div className="flex justify-center">
          <div className="bg-white border-2 border-purple-600 rounded-lg shadow-lg p-4 max-w-2xl w-full">
            <div className="flex items-center justify-between">
              {/* Left Section: Logo and Card Info */}
              <div className="flex items-start space-x-4 flex-1">
                {/* DCM Logo */}
                <div className="flex-shrink-0">
                  <img
                    src="/DCM-logo.png"
                    alt="DCM"
                    className="h-12 w-auto"
                  />
                </div>

                {/* Card Information */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 text-sm leading-tight truncate" title={cardInfo.card_name || card.card_name || "Unknown Card"}>
                    {cardInfo.card_name || card.card_name || "Unknown Card"}
                  </div>
                  <div className="text-gray-600 text-xs leading-tight truncate mt-1" title={cardInfo.set_name || "Unknown Set"}>
                    {cardInfo.set_name || "Unknown Set"}
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    Serial: {card.serial || `#${card.id}`}
                  </div>
                </div>
              </div>

              {/* Right Section: Grade Display */}
              <div className="text-center flex-shrink-0 ml-4">
                <div className="font-bold text-purple-700 text-3xl leading-none">
                  {(() => {
                    // Check if this is an N/A grade (null values)
                    if (recommendedGrade.recommended_whole_grade === null || card.dvg_whole_grade === null) {
                      return 'N/A';
                    }
                    return card.dvg_whole_grade || recommendedGrade.recommended_whole_grade || card.dcm_grade_whole || '?';
                  })()}
                </div>
                <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
                <div className="font-semibold text-purple-600 text-lg">
                  {card.dvg_image_quality || imageQuality.grade || card.ai_confidence_score || 'B'}
                </div>
                {dcmConditionAssessment && (
                  <div className={`text-xs font-medium px-2 py-1 rounded mt-2 ${getConditionColor(dcmConditionAssessment.overallCondition)}`}>
                    {dcmConditionAssessment.overallCondition}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card Images - Side by Side */}
        <div className="flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Front</h4>
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => openZoomModal(card.front_url, "Sports card front", "Card Front - Click for detailed view")}
              >
                <Image
                  src={card.front_url}
                  alt="Sports card front"
                  width={400}
                  height={560}
                  className="rounded-lg shadow-lg w-full"
                  priority
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Click to zoom</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Back</h4>
              <div
                className="cursor-pointer transition-transform hover:scale-105"
                onClick={() => openZoomModal(card.back_url, "Sports card back", "Card Back - Click for detailed view")}
              >
                <Image
                  src={card.back_url}
                  alt="Sports card back"
                  width={400}
                  height={560}
                  className="rounded-lg shadow-lg w-full"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">Click to zoom</p>
            </div>
          </div>
        </div>

        {/* Card Details and Grading */}
        <div className="space-y-6">

          {/* 1. Card Information */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Card Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <span className="font-semibold text-gray-600">Card Name:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Card Name"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Player(s) Featured:</span>
                  <span className="ml-2">{renderValue(aiCardDetails["Player(s)/Character(s) Featured"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Category:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Category"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Card Number:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Card Number"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Serial Number:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Serial Numbering"])}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="font-semibold text-gray-600">Card Set:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Card Set"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Manufacturer:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Manufacturer Name"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Release Date:</span>
                  <span className="ml-2">{renderValue(aiCardInfo["Release Date"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Rookie/First Print:</span>
                  <span className={`ml-2 ${aiCardDetails["Rookie/First Print"] === "Yes" ? "text-green-600 font-semibold" : ""}`}>
                    {renderValue(aiCardDetails["Rookie/First Print"])}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Rarity:</span>
                  <span className="ml-2">{renderValue(aiCardDetails["Rarity"])}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Authentic:</span>
                  <span className={`ml-2 ${aiCardInfo["Authentic"] === "Yes" ? "text-green-600 font-semibold" : ""}`}>
                    {renderValue(aiCardInfo["Authentic"])}
                  </span>
                </div>
              </div>
            </div>
          </div>


          {/* DVG v1 Grading Results */}
          {dvgGrading && Object.keys(dvgGrading).length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">DVG v1 Grading Results</h2>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                  {dvgGrading.meta?.model_name || 'gpt-4o'} • {dvgGrading.meta?.version || 'dvg-v1'}
                </span>
              </div>

              {/* Main Grade Display */}
              <div className={`rounded-lg p-6 mb-6 ${
                recommendedGrade.recommended_decimal_grade === null
                  ? 'bg-gradient-to-r from-red-50 to-orange-50'
                  : 'bg-gradient-to-r from-blue-50 to-purple-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recommended Grade</p>
                    {recommendedGrade.recommended_decimal_grade === null ? (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-5xl font-black text-red-600">N/A</span>
                        </div>
                        {dvgGrading.grading_status && (
                          <p className="text-sm text-red-700 mt-2 font-semibold">
                            {dvgGrading.grading_status}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-3">
                          <span className="text-5xl font-black text-blue-600">
                            {recommendedGrade.recommended_decimal_grade.toFixed(1)}
                          </span>
                          <span className="text-2xl text-gray-500">
                            / 10.0
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Whole Grade: {recommendedGrade.recommended_whole_grade} •
                          Uncertainty: {recommendedGrade.grade_uncertainty || '±0.5'}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Image Quality</p>
                    <span className={`text-3xl font-bold ${
                      imageQuality.grade === 'A' ? 'text-green-600' :
                      imageQuality.grade === 'B' ? 'text-blue-600' :
                      imageQuality.grade === 'C' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {imageQuality.grade || 'B'}
                    </span>
                    {card.dvg_reshoot_required && (
                      <p className="text-xs text-red-600 mt-1">Reshoot Recommended</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Information */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-700">Card Details</h3>
                  <p className="text-sm"><span className="text-gray-600">Player:</span> {cardInfo.player_or_character || 'Unknown'}</p>
                  <p className="text-sm"><span className="text-gray-600">Set:</span> {cardInfo.set_name || 'Unknown'}</p>
                  <p className="text-sm"><span className="text-gray-600">Year:</span> {cardInfo.year || 'Unknown'}</p>
                  <p className="text-sm"><span className="text-gray-600">Manufacturer:</span> {cardInfo.manufacturer || 'Unknown'}</p>
                  <p className="text-sm"><span className="text-gray-600">Card #:</span> {cardInfo.card_number || 'N/A'}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-700">Centering</h3>
                  <p className="text-sm"><span className="text-gray-600">Front L/R:</span> {centering.front_left_right_ratio_text || '50/50'}</p>
                  <p className="text-sm"><span className="text-gray-600">Front T/B:</span> {centering.front_top_bottom_ratio_text || '50/50'}</p>
                  <p className="text-sm"><span className="text-gray-600">Back L/R:</span> {centering.back_left_right_ratio_text || '50/50'}</p>
                  <p className="text-sm"><span className="text-gray-600">Back T/B:</span> {centering.back_top_bottom_ratio_text || '50/50'}</p>
                  <p className="text-xs text-gray-500 mt-2">Method: {centering.method_front || 'design-anchor'}</p>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="font-semibold text-green-700 mb-2">✓ Positives</h3>
                  <ul className="text-sm space-y-1">
                    {analysisSummary.positives?.map((positive: string, idx: number) => (
                      <li key={idx} className="text-gray-700">• {positive}</li>
                    )) || <li className="text-gray-500">No data</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-red-700 mb-2">✗ Issues Found</h3>
                  <ul className="text-sm space-y-1">
                    {analysisSummary.negatives?.map((negative: string, idx: number) => (
                      <li key={idx} className="text-gray-700">• {negative}</li>
                    )) || <li className="text-gray-500">No defects found</li>}
                  </ul>
                </div>
              </div>

              {/* Autograph Detection */}
              {dvgGrading.autograph?.present && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">🖊️ Autograph Detected</h3>
                  <p className="text-sm text-amber-700">Type: {dvgGrading.autograph.type || 'Unknown'}</p>
                  {dvgGrading.autograph.cert_markers && dvgGrading.autograph.cert_markers.length > 0 && (
                    <p className="text-sm text-amber-700 mt-1">Markers: {dvgGrading.autograph.cert_markers.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dual-Sided Sub-Scores (Front/Back Breakdown) */}
          {dvgGrading.sub_scores && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Front/Back Grade Breakdown</h2>
              <p className="text-sm text-gray-600 mb-6">
                Front = 65% weight (display importance) • Back = 35% weight
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Centering */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-blue-900">🎯 Centering</h3>
                    <div className="text-2xl font-bold text-blue-700">
                      {dvgGrading.sub_scores.centering.weighted_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Front:</span>
                      <span className="font-semibold text-blue-900">
                        {dvgGrading.sub_scores.centering.front_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700">Back:</span>
                      <span className="font-semibold text-blue-900">
                        {dvgGrading.sub_scores.centering.back_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Corners */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-green-900">📐 Corners</h3>
                    <div className="text-2xl font-bold text-green-700">
                      {dvgGrading.sub_scores.corners.weighted_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Front:</span>
                      <span className="font-semibold text-green-900">
                        {dvgGrading.sub_scores.corners.front_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-700">Back:</span>
                      <span className="font-semibold text-green-900">
                        {dvgGrading.sub_scores.corners.back_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edges */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-purple-900">📏 Edges</h3>
                    <div className="text-2xl font-bold text-purple-700">
                      {dvgGrading.sub_scores.edges.weighted_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700">Front:</span>
                      <span className="font-semibold text-purple-900">
                        {dvgGrading.sub_scores.edges.front_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700">Back:</span>
                      <span className="font-semibold text-purple-900">
                        {dvgGrading.sub_scores.edges.back_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Surface */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-amber-900">✨ Surface</h3>
                    <div className="text-2xl font-bold text-amber-700">
                      {dvgGrading.sub_scores.surface.weighted_score.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-700">Front:</span>
                      <span className="font-semibold text-amber-900">
                        {dvgGrading.sub_scores.surface.front_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-700">Back:</span>
                      <span className="font-semibold text-amber-900">
                        {dvgGrading.sub_scores.surface.back_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weighted Grade Summary */}
              {dvgGrading.weighted_grade_summary && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">Weighted Grade Calculation</h3>
                    <div className="text-xl font-bold text-gray-900">
                      {dvgGrading.weighted_grade_summary.weighted_total.toFixed(2)}
                    </div>
                  </div>
                  {dvgGrading.weighted_grade_summary.grade_cap_reason &&
                   dvgGrading.weighted_grade_summary.grade_cap_reason !== 'No cap applied' && (
                    <div className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded p-3">
                      <span className="font-semibold">Grade Cap:</span> {dvgGrading.weighted_grade_summary.grade_cap_reason}
                    </div>
                  )}
                </div>
              )}

              {/* Front/Back Observations */}
              {(analysisSummary.front_observations || analysisSummary.back_observations) && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisSummary.front_observations && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 mb-2">Front Side Observations</h3>
                      <ul className="text-sm space-y-1">
                        {analysisSummary.front_observations.map((obs: string, idx: number) => (
                          <li key={idx} className="text-blue-800">• {obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisSummary.back_observations && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-900 mb-2">Back Side Observations</h3>
                      <ul className="text-sm space-y-1">
                        {analysisSummary.back_observations.map((obs: string, idx: number) => (
                          <li key={idx} className="text-green-800">• {obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
                  const weightPercent = weight < 1 ? (weight * 100).toFixed(0) : weight.toFixed(0);

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800 capitalize">
                          {category.replace(/_/g, ' ')}
                        </span>
                        <div className="text-right">
                          <span className={`text-2xl font-bold ${isNA ? 'text-red-600' : 'text-blue-600'}`}>
                            {isNA ? 'NA' : score.toFixed(1)}
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
                        <span>Contribution: {isNA ? 'N/A' : contribution.toFixed(2)}</span>
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
                          : Number(gradingScale["Weighted Composite Score"]).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* 4. AI Confidence and Image Quality */}
          {(card.ai_grading?.["AI Confidence Assessment"] || card.ai_grading?.["Image Conditions"]) && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">AI Confidence and Image Quality</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* AI Confidence Section */}
                {card.ai_grading?.["AI Confidence Assessment"] && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">AI Confidence</h3>
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

          {/* 6. Visual Inspection Checklist */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Visual Inspection Checklist</h2>

            {/* Centering Measurements */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">Centering Measurements</h3>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Front Centering */}
                <div className="border-l-4 border-blue-500 pl-3">
                  <div className="font-medium text-gray-700 mb-2">Front</div>
                  <div className="ml-3 text-sm space-y-1">
                    <div><span className="text-gray-600">Left/Right:</span> <span className="font-semibold">{centeringMeasurements?.front_x_axis_ratio || 'N/A'}</span></div>
                    <div><span className="text-gray-600">Top/Bottom:</span> <span className="font-semibold">{centeringMeasurements?.front_y_axis_ratio || 'N/A'}</span></div>
                    {centeringMeasurements?.front_edge_description && (
                      <div className="text-gray-500 italic mt-1">{centeringMeasurements.front_edge_description}</div>
                    )}
                    {/* Method & Confidence */}
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      {centeringMeasurements?.front_centering_method && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Method:</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize">
                            {centeringMeasurements.front_centering_method.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {centeringMeasurements?.front_centering_confidence && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Confidence:</span>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize font-semibold ${
                            centeringMeasurements.front_centering_confidence === 'high' ? 'bg-green-100 text-green-700' :
                            centeringMeasurements.front_centering_confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {centeringMeasurements.front_centering_confidence}
                          </span>
                        </div>
                      )}
                      {centeringMeasurements?.front_quality_note && (
                        <div className="text-xs text-gray-600 italic">
                          <span className="text-gray-500">Note:</span> {centeringMeasurements.front_quality_note}
                        </div>
                      )}
                    </div>

                    {/* Enhanced Measurement Details */}
                    {(centeringMeasurements?.front_reference_points || centeringMeasurements?.front_visual_observation || centeringMeasurements?.front_measurement_approach) && (
                      <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                        {centeringMeasurements?.front_reference_points && (
                          <div className="text-xs">
                            <span className="font-semibold text-blue-700">Reference Points:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.front_reference_points}</p>
                          </div>
                        )}
                        {centeringMeasurements?.front_visual_observation && (
                          <div className="text-xs">
                            <span className="font-semibold text-blue-700">Visual Observation:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.front_visual_observation}</p>
                          </div>
                        )}
                        {centeringMeasurements?.front_measurement_approach && (
                          <div className="text-xs">
                            <span className="font-semibold text-blue-700">Measurement Approach:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.front_measurement_approach}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Centering */}
                <div className="border-l-4 border-purple-500 pl-3">
                  <div className="font-medium text-gray-700 mb-2">Back</div>
                  <div className="ml-3 text-sm space-y-1">
                    <div><span className="text-gray-600">Left/Right:</span> <span className="font-semibold">{centeringMeasurements?.back_x_axis_ratio || 'N/A'}</span></div>
                    <div><span className="text-gray-600">Top/Bottom:</span> <span className="font-semibold">{centeringMeasurements?.back_y_axis_ratio || 'N/A'}</span></div>
                    {centeringMeasurements?.back_edge_description && (
                      <div className="text-gray-500 italic mt-1">{centeringMeasurements.back_edge_description}</div>
                    )}
                    {/* Method & Confidence */}
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      {centeringMeasurements?.back_centering_method && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Method:</span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded capitalize">
                            {centeringMeasurements.back_centering_method.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {centeringMeasurements?.back_centering_confidence && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Confidence:</span>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize font-semibold ${
                            centeringMeasurements.back_centering_confidence === 'high' ? 'bg-green-100 text-green-700' :
                            centeringMeasurements.back_centering_confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {centeringMeasurements.back_centering_confidence}
                          </span>
                        </div>
                      )}
                      {centeringMeasurements?.back_quality_note && (
                        <div className="text-xs text-gray-600 italic">
                          <span className="text-gray-500">Note:</span> {centeringMeasurements.back_quality_note}
                        </div>
                      )}
                    </div>

                    {/* Enhanced Measurement Details */}
                    {(centeringMeasurements?.back_reference_points || centeringMeasurements?.back_visual_observation || centeringMeasurements?.back_measurement_approach) && (
                      <div className="mt-3 pt-3 border-t border-purple-200 space-y-2">
                        {centeringMeasurements?.back_reference_points && (
                          <div className="text-xs">
                            <span className="font-semibold text-purple-700">Reference Points:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.back_reference_points}</p>
                          </div>
                        )}
                        {centeringMeasurements?.back_visual_observation && (
                          <div className="text-xs">
                            <span className="font-semibold text-purple-700">Visual Observation:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.back_visual_observation}</p>
                          </div>
                        )}
                        {centeringMeasurements?.back_measurement_approach && (
                          <div className="text-xs">
                            <span className="font-semibold text-purple-700">Measurement Approach:</span>
                            <p className="text-gray-600 mt-0.5">{centeringMeasurements.back_measurement_approach}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* V3.0 5-Category Defect Analysis */}
            <div className="space-y-6">
              {(() => {
                const v3Categories = [
                  {
                    key: 'structural_integrity',
                    title: 'Structural Integrity (Corners & Edges)',
                    icon: '📐',
                    weight: 30
                  },
                  {
                    key: 'surface_condition',
                    title: 'Surface Condition',
                    icon: '✨',
                    weight: 25
                  },
                  {
                    key: 'centering_quality',
                    title: 'Centering Quality',
                    icon: '🎯',
                    weight: 20
                  },
                  {
                    key: 'print_quality',
                    title: 'Print/Manufacturing Quality',
                    icon: '🖨️',
                    weight: 15
                  },
                  {
                    key: 'authenticity_assessment',
                    title: 'Authenticity & Alterations',
                    icon: '🔍',
                    weight: 10
                  }
                ];

                const categoryData = {
                  structural_integrity: gradingScale?.structural_integrity,
                  surface_condition: gradingScale?.surface_condition,
                  centering_quality: gradingScale?.centering_quality,
                  print_quality: gradingScale?.print_quality,
                  authenticity_assessment: gradingScale?.authenticity_assessment
                };

                return v3Categories.map(category => {
                  const data = categoryData[category.key];
                  if (!data) return null;

                  // Check if card is altered - if so, override scores to NA
                  const isAltered = card.ai_grading?.["Alteration Check"]?.card_is_altered === true;
                  const overallScore = isAltered ? 'NA' : (data.overall_score !== undefined ? data.overall_score : 10);
                  const confidence = data.confidence || 'medium';

                  // v2.3: Use observations_applied from Stage 2 (includes calculation proof)
                  const observationsApplied = data.observations_applied || [];

                  // v3.1: Filter observations into pristine vs defects
                  let pristineElements = data.pristine_elements_applied || data.pristine_elements || [];
                  let defects = data.defects_detected || data.defects || [];

                  // If observations_applied exists, split it into pristine and defects
                  if (observationsApplied.length > 0) {
                    const filteredPristine = observationsApplied.filter((obs: any) => {
                      // Check for pristine indicators
                      const isPristineType = obs.type?.includes('pristine') || obs.type?.includes('edge_clean');
                      const hasNoDeduction = obs.applied_deduction === 0 || obs.deduction === 0;
                      const isNoDefectProof = obs.calculation_proof?.toLowerCase().includes('no deduction') ||
                                             obs.calculation_proof?.toLowerCase().includes('pristine');
                      return isPristineType || (hasNoDeduction && isNoDefectProof);
                    });

                    const filteredDefects = observationsApplied.filter((obs: any) => {
                      // Defects have actual deductions or size
                      const hasDeduction = (obs.applied_deduction || obs.deduction || 0) > 0;
                      const isPristineType = obs.type?.includes('pristine') || obs.type?.includes('edge_clean');
                      const isNoDefectProof = obs.calculation_proof?.toLowerCase().includes('no deduction') ||
                                             obs.calculation_proof?.toLowerCase().includes('pristine');
                      return hasDeduction && !isPristineType && !isNoDefectProof;
                    });

                    // Use filtered observations if available, otherwise keep existing arrays
                    if (filteredPristine.length > 0 || filteredDefects.length > 0) {
                      pristineElements = filteredPristine.length > 0 ? filteredPristine.map((obs: any) =>
                        obs.calculation_proof || obs.evidence || obs.type?.replace(/_/g, ' ')
                      ) : pristineElements;
                      defects = filteredDefects.length > 0 ? filteredDefects : defects;
                    } else {
                      // Fallback: use all observations as defects if filtering didn't work
                      defects = observationsApplied;
                    }
                  }

                  const uncertainAreas = data.uncertain_areas || [];
                  const totalDeductions = data.total_deductions || 0;

                  // Handle NA or non-numeric scores
                  const numericScore = typeof overallScore === 'number' ? overallScore : (overallScore === 'NA' || overallScore === 0 ? 0 : parseFloat(overallScore) || 0);

                  return (
                    <div key={category.key} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Category Header */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{category.icon}</span>
                            <div>
                              <h4 className="font-semibold text-gray-800">{category.title}</h4>
                              <p className="text-xs text-gray-500">Weight: {category.weight}%</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              numericScore >= 9 ? 'text-green-600' :
                              numericScore >= 7 ? 'text-blue-600' :
                              numericScore >= 5 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {overallScore === 'NA' ? 'NA' : numericScore.toFixed(1)}/10
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                              confidence === 'high' ? 'bg-green-100 text-green-700' :
                              confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {confidence} confidence
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Category Content */}
                      <div className="p-4 space-y-3">
                        {/* Side by Side: Pristine Elements and Defects */}
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Pristine Elements - Left Side */}
                          <div>
                            <h5 className="text-sm font-semibold text-green-700 mb-2">✓ Pristine Elements</h5>
                            {pristineElements.length > 0 ? (
                              <div className="space-y-2">
                                {pristineElements.map((element: any, idx: number) => {
                                  // Handle both string and object formats
                                  const displayText = typeof element === 'string' ? element :
                                    (element.calculation_proof || element.evidence || element.type?.replace(/_/g, ' ') || 'Pristine condition');
                                  const elementType = typeof element === 'string' ? '' :
                                    (element.type?.replace(/_/g, ' ') || '');
                                  const location = typeof element === 'string' ? '' :
                                    (element.location?.replace(/_/g, ' ') || '');

                                  return (
                                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-2">
                                      <div className="flex items-start gap-2">
                                        <span className="text-green-600 text-lg mt-0.5">✓</span>
                                        <div className="flex-1">
                                          <div className="text-sm text-green-800">
                                            {elementType && <span className="font-medium capitalize">{elementType}</span>}
                                            {location && <span className="text-xs text-gray-600 ml-2">({location})</span>}
                                          </div>
                                          <div className="text-xs text-green-700 mt-1">{displayText}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 italic">No pristine elements noted</p>
                            )}
                          </div>

                          {/* Defects - Right Side */}
                          <div>
                            <h5 className="text-sm font-semibold text-red-700 mb-2">❌ Defects</h5>
                            {defects.length > 0 ? (
                              <div className="space-y-2">
                                {defects.map((defect: any, idx: number) => (
                                  <div key={idx} className="bg-red-50 border border-red-200 rounded p-2">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-red-800 capitalize">
                                          {(defect.type || defect.defect_type || 'Unknown defect').replace(/_/g, ' ')}
                                          {defect.location && (
                                            <span className="text-xs text-gray-600 ml-2">
                                              ({defect.location.replace(/_/g, ' ')})
                                            </span>
                                          )}
                                        </div>
                                        {defect.evidence && (
                                          <div className="text-xs text-red-600 mt-1">{defect.evidence}</div>
                                        )}
                                        {defect.calculation_proof && (
                                          <div className="text-xs text-gray-600 mt-1 italic">
                                            📊 {defect.calculation_proof}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            defect.severity === 'minor' || defect.severity === 'faint' || defect.severity === 'microscopic' ? 'bg-yellow-100 text-yellow-700' :
                                            defect.severity === 'moderate' || defect.severity === 'visible' ? 'bg-orange-100 text-orange-700' :
                                            defect.severity === 'severe' || defect.severity === 'obvious' ? 'bg-red-200 text-red-800' :
                                            'bg-orange-100 text-orange-700'
                                          }`}>
                                            {defect.severity || 'moderate'}
                                          </span>
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            defect.confidence === 'certain' || defect.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                            defect.confidence === 'probable' || defect.confidence === 'medium' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {defect.confidence || 'probable'}
                                          </span>
                                          {defect.base_deduction !== undefined && (
                                            <span className="text-xs text-gray-500">
                                              Base: -{defect.base_deduction} × {defect.confidence_multiplier || 1.0}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right ml-3">
                                        <div className="text-sm font-bold text-red-700">
                                          -{defect.applied_deduction || defect.deduction || 0}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {totalDeductions > 0 && (
                                  <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-red-200">
                                    <strong>Total Deductions:</strong> -{totalDeductions.toFixed(1)} points
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-green-600">
                                <span className="text-lg">✓</span>
                                <p className="text-sm">No defects detected</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Uncertain Areas */}
                        {uncertainAreas.length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold text-yellow-700 mb-2">⚠️ Uncertain Areas</h5>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {uncertainAreas.map((area: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-yellow-600 mt-0.5">•</span>
                                  <span className="italic">{area}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* No Defects */}
                        {defects.length === 0 && pristineElements.length === 0 && (
                          <div className="text-center py-2 text-green-600">
                            <span className="text-lg">✓</span>
                            <p className="text-sm">No defects detected in this category</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }).filter(Boolean);
              })()}
            </div>

            {/* Grade Summary and Analysis */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-800 mb-3">Grade Analysis</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {gradingScale["Grade Analysis Summary"] || gradingScale["Summary for Grade"] ? (
                  <div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {gradingScale["Grade Analysis Summary"] || gradingScale["Summary for Grade"]}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {(() => {
                        // v3.1: Check multiple possible grade field names
                        const currentGrade =
                          gradingScale?.final_grade?.whole_number_grade ||
                          gradingScale?.final_grade?.decimal_final_grade ||
                          gradingScale["Whole Number Grade"] ||
                          gradingScale["Decimal Final Grade"] ||
                          gradingScale["Final Grade (After Deductions)"] ||
                          gradingScale?.weighted_composite_score ||
                          card.ai_grading?.["Final DCM Grade"]?.["DCM Grade (Whole Number)"] ||
                          card.ai_grading?.["Final DCM Grade"]?.["DCM Grade (Decimal)"] ||
                          card.ai_grading?.["Final Score"]?.["Overall Grade"] ||
                          card.ai_grading?.["Final Score"]?.["Whole Number Grade"] ||
                          0;
                        const gradeNum = Number(currentGrade);

                        // Check for NA grades - but make sure it's actually NA string, not just falsy
                        if (currentGrade === 'NA' || (gradeNum === 0 && currentGrade !== 0)) {
                          return "This card could not be assigned a standard numerical grade. Please review the alteration check or authenticity assessment for more details.";
                        }

                        if (gradeNum >= 9.5) {
                          return "This card achieved an exceptional grade reflecting near-perfect condition with minimal visible flaws. The card demonstrates excellent centering, sharp corners, clean edges, and pristine surface quality.";
                        } else if (gradeNum >= 8.5) {
                          return "This card received a high grade indicating very good condition with only minor imperfections. The card shows strong centering, well-preserved corners, and good overall structural integrity.";
                        } else if (gradeNum >= 7.0) {
                          return "This card earned a solid grade reflecting good condition with some noticeable but acceptable flaws. The card maintains reasonable centering and structural integrity despite visible wear.";
                        } else if (gradeNum >= 5.0) {
                          return "This card received a moderate grade due to multiple condition issues affecting its overall presentation. The card shows significant wear patterns but maintains basic structural integrity.";
                        } else {
                          return "This card received a lower grade due to substantial condition issues that significantly impact its appearance and structural integrity.";
                        }
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>


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

          {/* 4. DCM Condition Assessment */}
          {dcmConditionAssessment && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">DCM Condition Assessment</h2>

              {/* Overall Condition Badge */}
              <div className="text-center mb-6">
                <div className={`inline-flex items-center px-6 py-3 rounded-full text-xl font-bold border-2 ${getConditionColor(dcmConditionAssessment.overallCondition)}`}>
                  {dcmConditionAssessment.overallCondition} Condition
                </div>
                <p className="text-sm text-gray-600 mt-2">Based on DCM Professional Standards</p>
                <p className="text-xs text-gray-500 mt-1">Assessment Score: {dcmConditionAssessment.assessmentScore}/100</p>
              </div>

              {/* Category Breakdown */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {Object.entries(dcmConditionAssessment.categoryConditions).map(([key, category]) => (
                  <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-800">{category.name}:</span>
                      {category.defectCount > 0 && (
                        <span className="text-xs text-gray-500 ml-2">({category.defectCount} issue{category.defectCount !== 1 ? 's' : ''})</span>
                      )}
                    </div>
                    <span className={`font-semibold px-3 py-1 rounded-full text-sm border ${getConditionColor(category.condition)}`}>
                      {category.condition}
                    </span>
                  </div>
                ))}
              </div>

              {/* Detailed Summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Condition Summary</h4>
                <p className="text-sm text-blue-800 leading-relaxed">{dcmConditionAssessment.conditionSummary}</p>
              </div>

              {/* Category Details - Expandable */}
              <div className="mt-4">
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 list-none">
                    <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <span>View Detailed Category Analysis</span>
                      <span className="transform group-open:rotate-180 transition-transform">▼</span>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3">
                    {Object.entries(dcmConditionAssessment.categoryConditions).map(([key, category]) => (
                      category.defectCount > 0 && (
                        <div key={key} className="p-3 border border-gray-200 rounded-lg">
                          <h5 className="font-medium text-gray-800 mb-2">{category.name} Issues:</h5>
                          <div className="flex flex-wrap gap-2">
                            {category.flagsDetected.map((flag, index) => (
                              <span key={index} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                {flag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </details>
              </div>

              {/* Condition Legend */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {(['Mint', 'Excellent', 'Good', 'Fair'] as const).map((condition) => (
                  <div key={condition} className={`p-2 rounded text-center border ${getConditionColor(condition)}`}>
                    <div className="font-semibold">{condition}</div>
                    <div className="mt-1 text-xs opacity-80">{getConditionDescription(condition).split(' ').slice(0, 4).join(' ')}...</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Estimated Scoring by Major Companies */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Estimated Scoring by Major Companies</h2>
            <div className="space-y-4">
              {/* PSA */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">PSA:</span>
                  <span className={`font-bold text-lg ${getGradeColor(parseFloat(companyScores["PSA"]?.grade || companyScores["PSA"]) || 0)}`}>
                    {renderValue(typeof companyScores["PSA"] === 'object' ? companyScores["PSA"]?.grade : companyScores["PSA"])}
                  </span>
                </div>
                {companyScores["PSA"]?.reasoning && (
                  <p className="text-sm text-gray-600">{companyScores["PSA"].reasoning}</p>
                )}
              </div>

              {/* BGS */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">BGS:</span>
                  <span className={`font-bold text-lg ${getGradeColor(parseFloat(companyScores["BGS"]?.grade || companyScores["BGS"]) || 0)}`}>
                    {renderValue(typeof companyScores["BGS"] === 'object' ? companyScores["BGS"]?.grade : companyScores["BGS"])}
                  </span>
                </div>
                {companyScores["BGS"]?.reasoning && (
                  <p className="text-sm text-gray-600">{companyScores["BGS"].reasoning}</p>
                )}
              </div>

              {/* SGC */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">SGC:</span>
                  <span className={`font-bold text-lg ${getGradeColor(parseFloat(companyScores["SGC"]?.grade || companyScores["SGC"]) || 0)}`}>
                    {renderValue(typeof companyScores["SGC"] === 'object' ? companyScores["SGC"]?.grade : companyScores["SGC"])}
                  </span>
                </div>
                {companyScores["SGC"]?.reasoning && (
                  <p className="text-sm text-gray-600">{companyScores["SGC"].reasoning}</p>
                )}
              </div>
            </div>

          </div>

          {/* 7. Find and Price This Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find and Price This Card or Similar
            </h2>
            <p className="text-gray-600 mb-4">
              Search eBay to find similar cards and current market pricing for this {card.featured || card.card_name} card.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* General Search */}
              <a
                href={generateEbaySearchUrl({
                  card_name: card.card_name,
                  card_set: card.card_set,
                  featured: card.featured,
                  release_date: card.release_date,
                  manufacturer_name: card.manufacturer_name,
                  card_number: card.card_number,
                  serial_numbering: card.serial_numbering,
                  rookie_or_first_print: card.rookie_or_first_print,
                  autographed: card.autographed,
                  dcm_grade_whole: card.dcm_grade_whole
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
                <p className="text-sm text-blue-700 text-center leading-relaxed">Find all available cards matching this player and set</p>
              </a>

              {/* Sold Listings */}
              <a
                href={generateEbaySoldListingsUrl({
                  card_name: card.card_name,
                  card_set: card.card_set,
                  featured: card.featured,
                  release_date: card.release_date,
                  manufacturer_name: card.manufacturer_name,
                  card_number: card.card_number,
                  serial_numbering: card.serial_numbering,
                  rookie_or_first_print: card.rookie_or_first_print,
                  autographed: card.autographed,
                  dcm_grade_whole: card.dcm_grade_whole
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

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> eBay links will search for "{card.featured || card.card_name} {card.card_set}" and similar terms.
                Prices may vary based on condition, authenticity, and market demand. Use these searches as reference only.
              </p>
            </div>
          </div>

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

          {/* v2.2 REVISED: Image Quality Impact */}
          {card.ai_grading?.["Image Quality Impact"] && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Image Quality Impact on Grading
                </h3>
              </div>
              <div className="p-4 bg-white space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Confidence Tier</div>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      card.ai_grading["Image Quality Impact"].stage1_confidence_tier === 'high' ? 'bg-green-100 text-green-800' :
                      card.ai_grading["Image Quality Impact"].stage1_confidence_tier === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {card.ai_grading["Image Quality Impact"].stage1_confidence_tier?.toUpperCase() || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Grade Uncertainty</div>
                    <div className="text-sm font-semibold text-gray-800">
                      {card.ai_grading["Image Quality Impact"].grade_uncertainty || 'N/A'}
                    </div>
                  </div>
                </div>

                {card.ai_grading["Image Quality Impact"].uncertainty_reason && (
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-xs font-medium text-blue-800 mb-1">Why this uncertainty range?</div>
                    <div className="text-sm text-blue-700">{card.ai_grading["Image Quality Impact"].uncertainty_reason}</div>
                  </div>
                )}

                {card.ai_grading["Image Quality Impact"].fatal_flags_impact && card.ai_grading["Image Quality Impact"].fatal_flags_impact.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded">
                    <div className="text-xs font-medium text-yellow-800 mb-1">Image Quality Issues:</div>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {card.ai_grading["Image Quality Impact"].fatal_flags_impact.map((impact, idx) => (
                        <li key={idx}>{impact}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {card.ai_grading["Image Quality Impact"].recommended_action && card.ai_grading["Image Quality Impact"].recommended_action !== 'none' && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <div className="text-xs font-medium text-orange-800 mb-1">📸 Recommendation:</div>
                    <div className="text-sm text-orange-700 font-medium capitalize">
                      {card.ai_grading["Image Quality Impact"].recommended_action.replace(/_/g, ' ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* v2.2 REVISED: Alteration Check */}
          {card.ai_grading?.["Alteration Check"] && card.ai_grading["Alteration Check"].performed && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className={`px-4 py-3 border-b ${
                card.ai_grading["Alteration Check"].card_is_altered ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              }`}>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Authenticity & Alteration Check
                </h3>
              </div>
              <div className="p-4 bg-white">
                {card.ai_grading["Alteration Check"].card_is_altered ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                      <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold text-red-800 mb-1">⚠️ Card Has Been Altered</div>
                        <div className="text-sm text-red-700">{card.ai_grading["Alteration Check"].reason}</div>
                        {card.ai_grading["Alteration Check"].grade_override && (
                          <div className="text-sm text-red-800 font-semibold mt-2">
                            Grade Override: {card.ai_grading["Alteration Check"].grade_override}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">No alterations detected - card appears authentic</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* v2.2 REVISED: Analysis Summary */}
          {card.ai_grading?.["Analysis Summary"] && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Grading Analysis Summary
                </h3>
              </div>
              <div className="p-4 bg-white space-y-4">
                {/* Primary Grade Factors */}
                {card.ai_grading["Analysis Summary"].primary_grade_factors && card.ai_grading["Analysis Summary"].primary_grade_factors.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Key Strengths
                    </div>
                    <ul className="space-y-1">
                      {card.ai_grading["Analysis Summary"].primary_grade_factors.map((factor, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Limiting Factors */}
                {card.ai_grading["Analysis Summary"].limiting_factors && card.ai_grading["Analysis Summary"].limiting_factors.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Grade Limitations
                    </div>
                    <ul className="space-y-1">
                      {card.ai_grading["Analysis Summary"].limiting_factors.map((factor, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-yellow-600 mt-1">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Image Quality Notes */}
                {card.ai_grading["Analysis Summary"].image_quality_notes && (
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-xs font-medium text-blue-800 mb-1">📷 Image Quality Notes:</div>
                    <div className="text-sm text-blue-700">{card.ai_grading["Analysis Summary"].image_quality_notes}</div>
                  </div>
                )}

                {/* Recommended Grade Range */}
                {card.ai_grading["Analysis Summary"].recommended_grade_range && (
                  <div className="p-3 bg-purple-50 rounded">
                    <div className="text-xs font-medium text-purple-800 mb-1">Recommended Grade Range:</div>
                    <div className="text-lg font-bold text-purple-700">{card.ai_grading["Analysis Summary"].recommended_grade_range}</div>
                  </div>
                )}

                {/* Confidence Statement */}
                {card.ai_grading["Analysis Summary"].confidence_statement && (
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="text-sm text-gray-700 italic">{card.ai_grading["Analysis Summary"].confidence_statement}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage 1 Raw Observations Accordion */}
          {card.stage1_observations && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowStage1Observations(!showStage1Observations)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="font-semibold text-gray-800">Stage 1: Raw AI Observations</h3>
                  {card.stage1_observations.observations && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {card.stage1_observations.observations.length} observations
                    </span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showStage1Observations ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showStage1Observations && (
                <div className="p-4 bg-white border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-4 italic">
                    This shows the raw observations from Stage 1 AI before scoring was applied in Stage 2.
                  </p>

                  {/* Image Quality Assessment */}
                  {card.stage1_observations.image_quality && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">Image Quality Assessment</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-600">Resolution:</span> <span className="font-medium">{card.stage1_observations.image_quality.resolution || 'N/A'}</span></div>
                        <div><span className="text-gray-600">Lighting:</span> <span className="font-medium">{card.stage1_observations.image_quality.lighting || 'N/A'}</span></div>
                        <div><span className="text-gray-600">Angle:</span> <span className="font-medium">{card.stage1_observations.image_quality.angle || 'N/A'}</span></div>
                        <div><span className="text-gray-600">Clarity:</span> <span className="font-medium">{card.stage1_observations.image_quality.clarity || 'N/A'}</span></div>
                        <div><span className="text-gray-600">Overall Score:</span> <span className="font-medium">{card.stage1_observations.image_quality.overall_score || 'N/A'}/10</span></div>
                        <div><span className="text-gray-600">Confidence Tier:</span> <span className="font-medium uppercase">{card.stage1_observations.image_quality.confidence_tier || 'N/A'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Centering Measurements */}
                  {(card.stage1_observations.front_centering || card.stage1_observations.back_centering) && (
                    <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">Centering Measurements</h4>
                      {card.stage1_observations.front_centering && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-gray-700">Front:</div>
                          <div className="ml-2 text-xs">
                            <div><span className="text-gray-600">L/R:</span> <span className="font-medium">{card.stage1_observations.front_centering.x_axis_ratio || 'N/A'}</span></div>
                            <div><span className="text-gray-600">T/B:</span> <span className="font-medium">{card.stage1_observations.front_centering.y_axis_ratio || 'N/A'}</span></div>
                            {card.stage1_observations.front_centering.analysis && (
                              <div className="text-gray-500 italic mt-1">{card.stage1_observations.front_centering.analysis}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {card.stage1_observations.back_centering && (
                        <div>
                          <div className="text-xs font-medium text-gray-700">Back:</div>
                          <div className="ml-2 text-xs">
                            <div><span className="text-gray-600">L/R:</span> <span className="font-medium">{card.stage1_observations.back_centering.x_axis_ratio || 'N/A'}</span></div>
                            <div><span className="text-gray-600">T/B:</span> <span className="font-medium">{card.stage1_observations.back_centering.y_axis_ratio || 'N/A'}</span></div>
                            {card.stage1_observations.back_centering.analysis && (
                              <div className="text-gray-500 italic mt-1">{card.stage1_observations.back_centering.analysis}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Autograph Detection */}
                  {card.stage1_observations.autograph && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">Autograph Detection</h4>
                      <div className="text-xs space-y-1">
                        <div><span className="text-gray-600">Has Handwriting:</span> <span className="font-medium">{card.stage1_observations.autograph.has_handwriting ? 'Yes' : 'No'}</span></div>
                        {card.stage1_observations.autograph.signature_location && (
                          <div><span className="text-gray-600">Location:</span> <span className="font-medium">{card.stage1_observations.autograph.signature_location}</span></div>
                        )}
                        {card.stage1_observations.autograph.authentication_type && (
                          <div><span className="text-gray-600">Type:</span> <span className="font-medium">{card.stage1_observations.autograph.authentication_type}</span></div>
                        )}
                        {card.stage1_observations.autograph.authentication_markers_found && card.stage1_observations.autograph.authentication_markers_found.length > 0 && (
                          <div><span className="text-gray-600">Authentication Markers:</span> <span className="font-medium">{card.stage1_observations.autograph.authentication_markers_found.join(', ')}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Structural Observations (Corners & Edges) */}
                  {card.stage1_observations.observations && card.stage1_observations.observations.length > 0 && (() => {
                    const structuralObs = card.stage1_observations.observations.filter(obs =>
                      obs.category === 'structural' || obs.category === 'corner' || obs.category === 'edge' ||
                      obs.type?.includes('corner') || obs.type?.includes('edge')
                    );
                    const defectObs = structuralObs.filter(obs => !obs.type?.includes('pristine'));
                    const pristineObs = structuralObs.filter(obs => obs.type?.includes('pristine'));

                    return structuralObs.length > 0 ? (
                      <div className="mb-4">
                        <h4 className="font-semibold text-sm text-gray-800 mb-2">
                          Structural Analysis ({structuralObs.length} observations)
                        </h4>

                        {/* Defects */}
                        {defectObs.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-red-600 mb-2">Defects Found:</div>
                            <div className="space-y-2">
                              {defectObs.map((obs) => (
                                <div key={obs.id} className="p-3 bg-red-50 rounded border border-red-200">
                                  <div className="flex items-start justify-between mb-1">
                                    <div className="font-medium text-sm text-gray-800">{obs.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                                    {obs.confidence && (
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        obs.confidence === 'high' ? 'bg-red-100 text-red-800' :
                                        obs.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {obs.confidence}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600 mb-2">
                                    <span className="font-medium">Location:</span> {obs.location?.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-xs text-gray-700 mb-2">{obs.description}</div>
                                  {obs.proof_anchor && (
                                    <div className="text-xs text-gray-600 mb-1">
                                      <span className="font-medium">Proof:</span> {obs.proof_anchor}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 space-y-1">
                                    {obs.estimated_size_mm && (
                                      <div><span className="font-medium">Size:</span> {obs.estimated_size_mm}mm</div>
                                    )}
                                    {obs.visibility && (
                                      <div><span className="font-medium">Visibility:</span> {obs.visibility}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pristine Elements */}
                        {pristineObs.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-green-600 mb-2">Pristine Elements:</div>
                            <div className="space-y-2">
                              {pristineObs.map((obs) => (
                                <div key={obs.id} className="p-2 bg-green-50 rounded border border-green-200">
                                  <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-gray-700">{obs.location?.replace(/_/g, ' ')}</div>
                                      <div className="text-xs text-gray-600">{obs.description}</div>
                                      {obs.proof_anchor && (
                                        <div className="text-xs text-gray-500 mt-1">{obs.proof_anchor}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {/* Other Defect Observations (Surface, Print, etc.) */}
                  {card.stage1_observations.observations && (() => {
                    const otherDefects = card.stage1_observations.observations.filter(obs =>
                      obs.category !== 'structural' && obs.category !== 'corner' && obs.category !== 'edge' &&
                      !obs.type?.includes('corner') && !obs.type?.includes('edge') && !obs.type?.includes('pristine')
                    );

                    return otherDefects.length > 0 ? (
                      <div className="mb-4">
                        <h4 className="font-semibold text-sm text-gray-800 mb-2">Other Defects ({otherDefects.length})</h4>
                        <div className="space-y-2">
                          {otherDefects.map((obs) => (
                            <div key={obs.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                              <div className="flex items-start justify-between mb-1">
                                <div className="font-medium text-sm text-gray-800">{obs.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                                {obs.confidence && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    obs.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                    obs.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {obs.confidence}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mb-2">
                                <span className="font-medium">Location:</span> {obs.location?.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs text-gray-700 mb-2">{obs.description}</div>
                              <div className="text-xs text-gray-500 space-y-1">
                                {obs.estimated_size_mm && (
                                  <div><span className="font-medium">Size:</span> {obs.estimated_size_mm}mm</div>
                                )}
                                {obs.visibility && (
                                  <div><span className="font-medium">Visibility:</span> {obs.visibility}</div>
                                )}
                                {obs.how_distinguished_from_glare && (
                                  <div><span className="font-medium">vs Glare:</span> {obs.how_distinguished_from_glare}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Pristine Observations */}
                  {card.stage1_observations.pristine_observations && card.stage1_observations.pristine_observations.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">Pristine Elements</h4>
                      <ul className="text-xs text-gray-700 space-y-1">
                        {card.stage1_observations.pristine_observations.map((obs, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>{obs}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Card Information */}
                  {card.stage1_observations.card_information && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">Card Information (Stage 1)</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {card.stage1_observations.card_information.player_name && (
                          <div><span className="text-gray-600">Player:</span> <span className="font-medium">{card.stage1_observations.card_information.player_name}</span></div>
                        )}
                        {card.stage1_observations.card_information.card_set && (
                          <div><span className="text-gray-600">Set:</span> <span className="font-medium">{card.stage1_observations.card_information.card_set}</span></div>
                        )}
                        {card.stage1_observations.card_information.card_year && (
                          <div><span className="text-gray-600">Year:</span> <span className="font-medium">{card.stage1_observations.card_information.card_year}</span></div>
                        )}
                        {card.stage1_observations.card_information.manufacturer && (
                          <div><span className="text-gray-600">Manufacturer:</span> <span className="font-medium">{card.stage1_observations.card_information.manufacturer}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete Card Section */}
          {/* 7. Front/Back Specific Feedback (Parallel Processing v2.3) */}
          {(card.ai_grading?.front_specific_feedback || card.ai_grading?.back_specific_feedback) && (
            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">📊 Front/Back Analysis</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Front Analysis */}
                {card.ai_grading.front_specific_feedback && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <span>🔵 Front Condition</span>
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
                    <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <span>🟢 Back Condition</span>
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
                          🔒 {card.ai_grading.back_specific_feedback.authentication_status}
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
              <h2 className="text-xl font-bold mb-4 text-gray-800">📝 Card Text (OCR)</h2>
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