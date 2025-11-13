/**
 * Shared TypeScript interfaces for card grading data
 * Ensures type safety across backend and frontend
 */

// Defect severity levels
export type DefectSeverity = 'none' | 'microscopic' | 'minor' | 'moderate' | 'heavy';

// Single defect detail
export interface DefectDetail {
  severity: DefectSeverity;
  description: string;
}

// Corner defects (4 corners)
export interface CornerDefects {
  top_left: DefectDetail;
  top_right: DefectDetail;
  bottom_left: DefectDetail;
  bottom_right: DefectDetail;
}

// Edge defects (4 edges)
export interface EdgeDefects {
  top: DefectDetail;
  bottom: DefectDetail;
  left: DefectDetail;
  right: DefectDetail;
}

// Surface defects (5 categories)
export interface SurfaceDefects {
  scratches: DefectDetail;
  creases: DefectDetail;
  print_defects: DefectDetail;
  stains: DefectDetail;
  other: DefectDetail;
}

// Complete defect analysis for one side
export interface SideDefects {
  corners: CornerDefects;
  edges: EdgeDefects;
  surface: SurfaceDefects;
}

// Complete card defects (front + back)
export interface CardDefects {
  front: SideDefects;
  back: SideDefects;
}

// Centering measurements
export interface CenteringMeasurements {
  front_left_right: string; // e.g., "55/45"
  front_top_bottom: string; // e.g., "50/50"
  back_left_right: string;
  back_top_bottom: string;
  centering_score: number; // 0-10
}

// Sub-scores
export interface SubScores {
  centering: { raw: number; weighted: number };
  corners: { raw: number; weighted: number };
  edges: { raw: number; weighted: number };
  surface: { raw: number; weighted: number };
}

// Professional grades
export interface ProfessionalGrades {
  psa: { grade: number; label: string };
  bgs: { grade: number; label: string };
  sgc: { grade: number; label: string };
  cgc: { grade: number; label: string };
}

// Card info
export interface CardInfo {
  card_name: string;
  player_or_character: string;
  set_name: string;
  year: string;
  manufacturer: string;
  card_number: string;
  sport_or_category: string;
  serial_number?: string | null;
  rookie_or_first?: boolean | string | null;
  rarity_or_variant?: string | null;
  authentic?: boolean | null;
  subset?: string | null;
  card_back_text?: string | null;  // 🆕 Descriptive text from back of card
  autographed?: boolean | null;
  memorabilia?: string | null;
  pokemon_type?: string | null;
  pokemon_stage?: string | null;
  hp?: string | number | null;
  card_type?: string | null;
}

// Grading metadata
export interface GradingMetadata {
  cross_side_verification: string | null;
  microscopic_inspection_count: number;
  timestamp: string;
}

// Complete card type (matches database schema)
export interface Card {
  // IDs
  id: string;
  user_id: string;

  // Images
  front_path: string;
  back_path: string;
  front_url?: string;
  back_url?: string;

  // Conversational grading (current system)
  conversational_grading: string | null; // Markdown report
  conversational_decimal_grade: number | null;
  conversational_whole_grade: number | null;
  conversational_grade_uncertainty: number | null;
  conversational_condition_label: string | null;
  conversational_card_info: CardInfo | null;
  conversational_sub_scores: SubScores | null;
  conversational_weighted_summary: string | null;
  conversational_centering_ratios: any | null;

  // v3.2+ fields
  conversational_image_confidence: string | null; // v3.6/7: A/B/C/D letter grade
  conversational_case_detection: string | null; // Protective case detection (penny sleeve, toploader)
  conversational_slab_detection: any | null; // v4.0 JSON: Professional slab detection (PSA/BGS/SGC/CGC)
  conversational_validation_checklist: any | null;
  conversational_front_summary: string | null;
  conversational_back_summary: string | null;
  conversational_corners_edges_surface: any | null; // JSON details for defects
  conversational_meta: any | null;

  // 🆕 v3.8: Weakest Link Scoring
  conversational_weighted_sub_scores: {
    centering: number;
    corners: number;
    edges: number;
    surface: number;
  } | null;
  conversational_limiting_factor: string | null; // 'centering' | 'corners' | 'edges' | 'surface'
  conversational_preliminary_grade: number | null;

  // NEW: Structured defect data (Phase 2)
  conversational_defects_front?: SideDefects | null;
  conversational_defects_back?: SideDefects | null;
  conversational_centering?: CenteringMeasurements | null;
  conversational_metadata?: GradingMetadata | null;

  // Professional grades
  estimated_professional_grades: ProfessionalGrades | null;

  // DVG v2 (optional)
  dvg_grading?: any;
  dvg_decimal_grade?: number | null;

  // v3.3 enhanced fields
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
  defect_coordinates?: any;
  cross_side_verification_result?: string | null;
  microscopic_inspection_count?: number;

  // Metadata
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  slab_detected?: boolean;
  slab_company?: string | null;
  slab_grade?: string | null;
}

// Default/empty defects structure
export const DEFAULT_DEFECT_DETAIL: DefectDetail = {
  severity: 'none',
  description: 'No data'
};

export const DEFAULT_CORNER_DEFECTS: CornerDefects = {
  top_left: DEFAULT_DEFECT_DETAIL,
  top_right: DEFAULT_DEFECT_DETAIL,
  bottom_left: DEFAULT_DEFECT_DETAIL,
  bottom_right: DEFAULT_DEFECT_DETAIL
};

export const DEFAULT_EDGE_DEFECTS: EdgeDefects = {
  top: DEFAULT_DEFECT_DETAIL,
  bottom: DEFAULT_DEFECT_DETAIL,
  left: DEFAULT_DEFECT_DETAIL,
  right: DEFAULT_DEFECT_DETAIL
};

export const DEFAULT_SURFACE_DEFECTS: SurfaceDefects = {
  scratches: DEFAULT_DEFECT_DETAIL,
  creases: DEFAULT_DEFECT_DETAIL,
  print_defects: DEFAULT_DEFECT_DETAIL,
  stains: DEFAULT_DEFECT_DETAIL,
  other: DEFAULT_DEFECT_DETAIL
};

export const DEFAULT_SIDE_DEFECTS: SideDefects = {
  corners: DEFAULT_CORNER_DEFECTS,
  edges: DEFAULT_EDGE_DEFECTS,
  surface: DEFAULT_SURFACE_DEFECTS
};

export const DEFAULT_CARD_DEFECTS: CardDefects = {
  front: DEFAULT_SIDE_DEFECTS,
  back: DEFAULT_SIDE_DEFECTS
};
