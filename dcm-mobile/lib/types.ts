// Card data types matching the web app's database schema

export interface SubScores {
  centering: number | null
  corners: number | null
  edges: number | null
  surface: number | null
}

export interface CenteringData {
  front_left_right?: string
  front_top_bottom?: string
  back_left_right?: string
  back_top_bottom?: string
  centering_score?: number
  front_quality_tier?: string
  back_quality_tier?: string
  front_lr?: string
  front_tb?: string
  back_lr?: string
  back_tb?: string
}

export interface CardInfo {
  card_name?: string
  player_or_character?: string
  set_name?: string
  year?: string
  manufacturer?: string
  card_number?: string
  sport_or_category?: string
  serial_number?: string
  rookie_or_first?: boolean | string | null
  rarity_or_variant?: string | null
  rarity_tier?: string | null
  authentic?: boolean | null
}

export interface DefectDetail {
  severity: 'none' | 'minor' | 'moderate' | 'heavy'
  description: string
}

export interface SideDefects {
  corners?: {
    top_left?: DefectDetail
    top_right?: DefectDetail
    bottom_left?: DefectDetail
    bottom_right?: DefectDetail
    condition?: string
    defects?: Array<{ description: string; severity: string; location: string }>
  }
  edges?: {
    top?: DefectDetail
    bottom?: DefectDetail
    left?: DefectDetail
    right?: DefectDetail
    condition?: string
    defects?: Array<{ description: string; severity: string; location: string }>
  }
  surface?: {
    scratches?: DefectDetail
    creases?: DefectDetail
    print_defects?: DefectDetail
    stains?: DefectDetail
    other?: DefectDetail
    condition?: string
    defects?: Array<{ description: string; severity: string; location: string }>
  }
}

export interface ProfessionalGradeEstimate {
  estimated_grade: string
  numeric_score: number
  confidence: 'high' | 'medium' | 'low'
  notes?: string
}

export interface ProfessionalGrades {
  PSA?: ProfessionalGradeEstimate
  BGS?: ProfessionalGradeEstimate
  SGC?: ProfessionalGradeEstimate
  TAG?: ProfessionalGradeEstimate
  CGC?: ProfessionalGradeEstimate
}

export interface CaseDetection {
  case_type: string
  case_visibility?: string
  impact_level?: string
  adjusted_uncertainty?: string
  notes?: string
}

export interface Card {
  id: string
  serial: string
  user_id?: string
  category: string
  sub_category?: string | null

  // Card identity
  card_name: string | null
  featured?: string | null
  pokemon_featured?: string | null
  card_set: string | null
  card_number: string | null
  release_date: string | null
  manufacturer_name: string | null

  // Images
  front_path: string
  back_path: string
  front_url?: string | null
  back_url?: string | null

  // Grades
  conversational_whole_grade: number | null
  conversational_decimal_grade: number | null
  conversational_condition_label: string | null
  conversational_grade_uncertainty: string | null
  conversational_image_confidence: string | null
  conversational_limiting_factor: string | null
  conversational_preliminary_grade: number | null
  conversational_prompt_version?: string | null
  conversational_weighted_summary?: { grade_cap_reason?: string | null; [key: string]: any } | null

  // Subgrades
  conversational_weighted_sub_scores: SubScores | null
  conversational_sub_scores: any | null

  // Card info from AI
  conversational_card_info: CardInfo | null

  // Defects
  conversational_defects_front: SideDefects | null
  conversational_defects_back: SideDefects | null
  conversational_front_summary: string | null
  conversational_back_summary: string | null
  conversational_final_grade_summary?: string | null
  conversational_corners_edges_surface?: any | null

  // Centering
  conversational_centering: CenteringData | null
  conversational_centering_ratios: any | null

  // Professional estimates
  estimated_professional_grades: ProfessionalGrades | null

  // Case/slab detection
  conversational_case_detection: CaseDetection | null
  conversational_slab_detection: any | null
  slab_detected?: boolean
  slab_company?: string | null
  slab_grade?: string | null
  slab_cert_number?: string | null

  // Pricing
  ebay_price_lowest: number | null
  ebay_price_median: number | null
  ebay_price_highest: number | null
  ebay_price_average: number | null
  ebay_price_listing_count: number | null
  ebay_price_updated_at: string | null
  dcm_price_estimate: number | null
  dcm_price_raw: number | null
  dcm_price_average?: number | null
  dcm_price_updated_at: string | null
  dcm_prices_cached_at?: string | null
  dcm_cached_prices?: any | null
  dcm_price_match_confidence?: string | null
  dcm_price_product_name?: string | null
  scryfall_price_usd: number | null
  scryfall_price_usd_foil: number | null

  // Ownership lifecycle — a sold card leaves the collection but keeps its
  // grade page online so the buyer's slab QR still resolves. Never delete a
  // graded card; see the web migration 20260730_add_card_ownership_status.sql.
  ownership_status?: 'owned' | 'sold' | 'archived' | null
  sold_at?: string | null
  sold_price?: number | null
  sold_channel?: 'ebay' | 'manual' | 'other' | null
  sold_note?: string | null
  deleted_at?: string | null

  // Card characteristics
  visibility: 'public' | 'private'
  is_foil: boolean | null
  foil_type: string | null
  holofoil: string | null
  autographed: boolean | null
  autograph_type: string | null
  memorabilia_type: string | null
  rookie_card: boolean | null
  first_print_rookie: boolean | null
  serial_numbering: string | null
  rarity_tier: string | null
  rarity_description: string | null

  // Full grading data
  conversational_grading: string | null

  // Timestamps
  created_at: string
  updated_at?: string

  // Custom label
  custom_label_data: any | null
}
