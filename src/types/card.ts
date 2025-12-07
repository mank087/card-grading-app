/**
 * Shared TypeScript interfaces for card grading data
 * Ensures type safety across backend and frontend
 */

// Defect severity levels (v5.12 - aligned with Human Eye Standard)
// Note: "microscopic" removed to align with visible-defect-only grading philosophy
export type DefectSeverity = 'none' | 'minor' | 'moderate' | 'heavy';

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
  // Quality tier fields (v5.0+)
  front_quality_tier?: 'Perfect' | 'Excellent' | 'Good' | 'Fair' | 'Off-Center';
  back_quality_tier?: 'Perfect' | 'Excellent' | 'Good' | 'Fair' | 'Off-Center';
}

// Case detection (protective sleeve/holder detection)
export interface CaseDetection {
  case_type: 'penny_sleeve' | 'top_loader' | 'semi_rigid' | 'slab' | 'none';
  case_visibility: 'full' | 'partial' | 'unknown';
  impact_level: 'none' | 'minor' | 'moderate' | 'high';
  adjusted_uncertainty: '±0.0' | '±0.25' | '±0.5' | '±1.0';
  notes: string;
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

// Card presence validation (v5.12) - verifies images contain actual trading cards
export interface CardPresenceValidation {
  front_card_detected: boolean;
  back_card_detected: boolean;
  front_validation_notes: string;
  back_validation_notes: string;
}

// Three-Pass Grading System (v5.5)
export interface GradingPass {
  centering: number;      // Weighted centering score (0-10)
  corners: number;        // Weighted corners score (0-10)
  edges: number;          // Weighted edges score (0-10)
  surface: number;        // Weighted surface score (0-10)
  final: number;          // Final grade for this pass (0-10)
  defects_noted: string[]; // Key defects observed in this pass
}

export interface GradingPassAveraged {
  centering: number;      // Averaged centering score
  corners: number;        // Averaged corners score
  edges: number;          // Averaged edges score
  surface: number;        // Averaged surface score
  final: number;          // Averaged final grade
}

export interface GradingPasses {
  pass_1: GradingPass;
  pass_2: GradingPass;
  pass_3: GradingPass;
  averaged: GradingPassAveraged;        // Raw averages before rounding
  averaged_rounded: GradingPassAveraged; // Averages rounded to nearest 0.5
  variance: number;                      // MAX - MIN of final grades
  consistency: 'high' | 'moderate' | 'low';
  consensus_notes: string[];             // Notes about 1/3 pass defects
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
  conversational_case_detection: CaseDetection | null; // v5.0: Protective case detection (penny sleeve, toploader, etc.)
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

  // NEW: Three-Pass Consensus Grading (v5.5)
  conversational_grading_passes?: GradingPasses | null;

  // NEW: Card Presence Validation (v5.12)
  conversational_card_presence_validation?: CardPresenceValidation | null;

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

  // Category
  category?: string | null;

  // 🎴 Pokemon TCG API verification
  pokemon_api_id?: string | null;
  pokemon_api_data?: any | null;
  pokemon_api_verified?: boolean;
  pokemon_api_verified_at?: string | null;
  pokemon_api_confidence?: 'high' | 'medium' | 'low' | null;
  pokemon_api_method?: string | null;

  // 🃏 MTG Scryfall API verification
  mtg_api_id?: string | null;
  mtg_oracle_id?: string | null;
  mtg_api_data?: any | null;
  mtg_api_verified?: boolean;
  mtg_api_verified_at?: string | null;
  mtg_api_confidence?: 'high' | 'medium' | 'low' | null;
  mtg_api_method?: string | null;

  // MTG-specific fields
  mtg_mana_cost?: string | null;
  mtg_type_line?: string | null;
  mtg_colors?: string[] | null;
  mtg_rarity?: string | null;
  mtg_set_code?: string | null;
  card_language?: string | null;
  is_foil?: boolean;
  foil_type?: string | null;
  is_double_faced?: boolean;

  // Market pricing (Scryfall)
  scryfall_price_usd?: number | null;
  scryfall_price_usd_foil?: number | null;
  scryfall_price_eur?: number | null;
  scryfall_price_updated_at?: string | null;
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
