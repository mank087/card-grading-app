/**
 * Card Grading JSON Schema v5.0
 * For use with OpenAI Structured Outputs (json_schema response format)
 *
 * Architecture: Master Rubric + Card-Type Deltas
 * - Universal grading rules in master_grading_rubric_v5.txt
 * - Card-specific extraction in delta files (sports, pokemon, mtg, lorcana, other)
 *
 * Key Features:
 * - Enforces Evidence-Based Grading Protocol validation rules
 * - Supports all card types with flexible card_info structure
 * - Validates description-score consistency requirements
 * - Ensures defects array matches narrative descriptions
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════
// PART 1: SHARED/UNIVERSAL SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Meta information about the grading analysis
 */
const MetaSchema = z.object({
  model_name: z.string().describe('AI model used for grading (e.g., "gpt-5.1")'),
  provider: z.string().describe('AI provider (e.g., "openai")'),
  version: z.string().describe('Schema version (e.g., "v6.2")'),
  prompt_version: z.string().describe('Grading prompt version (e.g., "Conversational_Grading_v6.2_THREE_PASS")'),
  card_type: z.enum(['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'other']).describe('Card type determines which delta rules were applied')
});

/**
 * Defect coordinate for pinpointing defect locations on card
 */
const DefectCoordinateSchema = z.object({
  x_percent: z.number().min(0).max(100).describe('X position as percentage from left edge (0-100)'),
  y_percent: z.number().min(0).max(100).describe('Y position as percentage from top edge (0-100)'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in coordinate accuracy')
}).describe('Approximate defect location coordinates');

/**
 * Individual defect with evidence-based documentation
 *
 * CRITICAL VALIDATION FROM EVIDENCE-BASED PROTOCOL:
 * - Every defect MUST include: location, size/extent, visual characteristics, observable colors, detection method
 * - Description must be UNIQUE (no template language or copy-paste)
 * - If defect exists, corresponding score MUST be < 10.0
 */
const DefectSchema = z.object({
  type: z.string().describe('Defect type (e.g., "fiber_exposure", "whitening", "scratch", "rounding", "crease")'),
  severity: z.enum(['none', 'minor', 'moderate', 'heavy']).describe('Defect severity level'),
  description: z.string().min(30).describe(
    'REQUIRED: Detailed evidence-based description including: ' +
    '(1) LOCATION: Specific position on card (e.g., "Top-left corner", "Right edge center section"). ' +
    '(2) SIZE/EXTENT: Approximate measurement with qualifier (e.g., "Approximately 0.2mm fiber exposure", "Roughly 3mm scratch"). ' +
    '(3) VISUAL CHARACTERISTICS: Describe actual appearance using THIS card\'s features (e.g., "White cardstock visible against red border"). ' +
    '(4) OBSERVABLE COLORS: State colors from THIS card, not generic assumptions (e.g., "Navy blue border with white fiber showing"). ' +
    '(5) DETECTION METHOD: Explain inspection approach (e.g., "At maximum zoom, examining corner tip"). ' +
    'Minimum 30 characters. MUST be unique - no template language or repetition.'
  ),
  size_mm: z.number().optional().describe('Defect size in millimeters if measurable'),
  coordinates: DefectCoordinateSchema.optional().describe('Approximate location on card')
}).describe('Single defect with complete evidence-based documentation');

/**
 * Centering analysis for one side of card
 */
const CenteringAnalysisSchema = z.object({
  left_right: z.string().describe('Left-right centering ratio (e.g., "50/50", "60/40", "75/25")'),
  top_bottom: z.string().describe('Top-bottom centering ratio (e.g., "50/50", "55/45", "70/30")'),
  worst_axis: z.enum(['left_right', 'top_bottom']).describe('Which axis has worse centering'),
  worst_ratio: z.string().describe('The worst ratio value (e.g., "75/25")'),
  quality_tier: z.enum(['Perfect', 'Excellent', 'Good', 'Fair', 'Off-Center']).describe(
    'REQUIRED: Standardized quality tier based on worst axis deviation. ' +
    'Perfect (0-1% = 50/50 or 51/49), Excellent (2-3% = 52/48 or 53/47), ' +
    'Good (4-5% = 54/46 or 55/45), Fair (6-10% = 56/44 to 60/40), ' +
    'Off-Center (11%+ = 61/39 or worse). Use ONLY these exact terms.'
  ),
  method: z.enum(['border-present', 'design-anchor', 'design-anchor-asymmetric']).describe('Measurement method used'),
  analysis: z.string().min(30).max(400).describe(
    'REQUIRED: MAXIMUM 2-3 SENTENCES centering analysis. ' +
    'CRITICAL: First sentence MUST START with the EXACT SAME WORD from quality_tier field. ' +
    'If quality_tier="Excellent", start with "Excellent centering...". ' +
    'If quality_tier="Good", start with "Good centering...". NO EXCEPTIONS. ' +
    'Sentence 1: [quality_tier word] centering with [L/R ratio] and [T/B ratio], [worst axis]. ' +
    'Sentence 2: Context (PSA standards, visual assessment, design factors). ' +
    'Sentence 3 (optional): Measurement notes if relevant. ' +
    'Must reference THIS card\'s specific characteristics. ' +
    'Minimum 30 characters, maximum 400 characters.'
  ),
  measurement_features: z.array(z.string()).optional().describe('Specific features used for measurement (e.g., ["red border", "player photo edge"])')
}).describe('Centering measurements and evidence-based analysis');

/**
 * Corner condition with evidence-based inspection documentation
 *
 * CRITICAL: If score = 10.0, must document inspection proving NO defects exist
 * CRITICAL: If score < 10.0, must describe defects that caused deduction
 */
const CornerConditionSchema = z.object({
  score: z.number().min(0).max(10).describe('Corner condition score (0.0 to 10.0)'),
  condition: z.string().min(80).describe(
    'REQUIRED: Evidence-based corner condition description. ' +
    'IF SCORE = 10.0: Must document (1) inspection method, (2) what defects were checked for, (3) negative findings (defects NOT found), (4) observable features supporting pristine claim, (5) actual card colors/design. ' +
    'IF SCORE < 10.0: Must describe defects with (1) location, (2) size, (3) visual characteristics, (4) observable colors, (5) detection method. ' +
    'Minimum 80 characters. Must be UNIQUE for each corner - no template language or copy-paste.'
  ),
  defects: z.array(DefectSchema).describe('Array of defects found at this corner. MUST match narrative description. Empty array only if score = 10.0.')
}).describe('Single corner condition with evidence-based documentation');

/**
 * Edge condition with evidence-based inspection documentation
 */
const EdgeConditionSchema = z.object({
  score: z.number().min(0).max(10).describe('Edge condition score (0.0 to 10.0)'),
  condition: z.string().min(80).describe(
    'REQUIRED: Evidence-based edge condition description. ' +
    'IF SCORE = 10.0: Must document inspection proving NO defects. ' +
    'IF SCORE < 10.0: Must describe defects with full evidence (location, size, visual characteristics, colors, detection method). ' +
    'Minimum 80 characters. Must be UNIQUE for each edge.'
  ),
  defects: z.array(DefectSchema).describe('Array of defects found along this edge. MUST match narrative description.')
}).describe('Single edge condition with evidence-based documentation');

/**
 * Surface condition with evidence-based inspection documentation
 */
const SurfaceConditionSchema = z.object({
  score: z.number().min(0).max(10).describe('Surface condition score (0.0 to 10.0)'),
  condition: z.string().min(80).describe(
    'REQUIRED: Evidence-based surface condition description. ' +
    'IF SCORE = 10.0: Must document inspection method, areas checked, what defects were looked for, negative findings, observable pristine characteristics. ' +
    'IF SCORE < 10.0: Must describe each defect with complete evidence. ' +
    'Minimum 80 characters. Must reference THIS card\'s specific surface characteristics (holographic, matte, glossy, etc.).'
  ),
  defects: z.array(DefectSchema).describe('Array of surface defects. MUST match narrative description.'),
  summary: z.string().min(30).describe(
    'REQUIRED: 2-3 SENTENCES MAXIMUM - (1) Overall surface assessment, (2) How grade was determined. ' +
    'Must reference THIS card\'s specific characteristics. Minimum 30 characters.'
  )
}).describe('Surface condition with evidence-based documentation');

/**
 * Complete defects for one side of card (front or back)
 */
const CardSideDefectsSchema = z.object({
  corners: z.object({
    top_left: CornerConditionSchema,
    top_right: CornerConditionSchema,
    bottom_left: CornerConditionSchema,
    bottom_right: CornerConditionSchema
  }).describe('All 4 corners with individual evidence-based assessments'),
  edges: z.object({
    top: EdgeConditionSchema,
    bottom: EdgeConditionSchema,
    left: EdgeConditionSchema,
    right: EdgeConditionSchema
  }).describe('All 4 edges with individual evidence-based assessments'),
  surface: SurfaceConditionSchema.describe('Surface condition with evidence-based assessment')
}).describe('Complete defect analysis for one side of card');

/**
 * Sub-scores for one grading category (centering, corners, edges, or surface)
 */
const CategorySubScoresSchema = z.object({
  front_score: z.number().min(0).max(10).describe('Front side score (0.0 to 10.0)'),
  back_score: z.number().min(0).max(10).describe('Back side score (0.0 to 10.0)'),
  weighted_score: z.number().min(0).max(10).describe('Weighted score (front 60% + back 40%)')
}).describe('Front, back, and weighted scores for one category');

/**
 * Image quality assessment
 */
const ImageQualitySchema = z.object({
  confidence_letter: z.enum(['A', 'B', 'C', 'D']).describe('Overall image quality grade: A (excellent) to D (poor)'),
  focus_ok: z.boolean().describe('Is image in focus?'),
  glare_present: z.boolean().describe('Is glare present?'),
  lighting_ok: z.boolean().describe('Is lighting adequate?'),
  color_balance_ok: z.boolean().describe('Is color balance good?'),
  notes: z.string().describe('Image quality notes and any limitations')
}).describe('Image quality assessment affecting grading confidence');

/**
 * Professional grading slab detection
 */
const SlabDetectionSchema = z.object({
  slab_detected: z.boolean().describe('Is card in a professional grading slab?'),
  company: z.enum(['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'HGA', 'CSG', 'unknown']).nullable().describe('Grading company if detected'),
  grade: z.string().nullable().describe('Visible grade on slab (e.g., "10", "9.5")'),
  cert_number: z.string().nullable().describe('Certification number if visible'),
  subgrades: z.object({
    centering: z.number().optional(),
    corners: z.number().optional(),
    edges: z.number().optional(),
    surface: z.number().optional()
  }).optional().describe('Subgrades if visible (BGS/HGA style)'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in slab detection'),
  notes: z.string().describe('Additional slab detection notes')
}).describe('Professional grading slab detection results');

/**
 * Card Presence Validation (v5.12)
 * Validates that submitted images actually contain trading cards
 */
const CardPresenceValidationSchema = z.object({
  front_card_detected: z.boolean().describe('Is a valid trading card detected in the front image?'),
  back_card_detected: z.boolean().describe('Is a valid trading card detected in the back image?'),
  front_validation_notes: z.string().describe('Description of what was detected in front image - explain if no card found'),
  back_validation_notes: z.string().describe('Description of what was detected in back image - explain if no card found')
}).describe('Card presence validation - verifies images contain actual trading cards before grading');

/**
 * Alteration/tampering detection
 */
const AlterationDetectionSchema = z.object({
  altered: z.boolean().describe('Is card altered, trimmed, or tampered with?'),
  alteration_types: z.array(z.string()).describe('Types of alterations detected (e.g., ["trimming", "re-coloring", "surface coating"])'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in alteration detection'),
  evidence: z.string().describe('Evidence supporting alteration claim or evidence supporting authentic claim'),
  gradeable: z.boolean().describe('Is card gradeable despite alterations?')
}).describe('Alteration and tampering detection');

/**
 * Autograph detection
 */
const AutographSchema = z.object({
  present: z.boolean().describe('Is autograph present?'),
  type: z.enum(['none', 'on-card', 'sticker']).describe('Autograph type'),
  authenticated: z.boolean().describe('Does card have manufacturer authentication markers?'),
  cert_markers: z.array(z.string()).describe('Authentication markers found (e.g., ["hologram sticker", "cert number"])'),
  notes: z.string().describe('Autograph notes')
}).describe('Autograph presence and authentication');

/**
 * Professional grade estimates
 */
const ProfessionalGradeEstimateSchema = z.object({
  estimated_grade: z.string().describe('Estimated grade in company scale (e.g., "PSA 10", "BGS 9.5")'),
  numeric_score: z.number().describe('Numeric equivalent of estimate'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in estimate'),
  notes: z.string().describe('Notes explaining estimate')
}).describe('Estimated grade for one professional grading company');

const ProfessionalGradeEstimatesSchema = z.object({
  PSA: ProfessionalGradeEstimateSchema.describe('PSA grade estimate'),
  BGS: ProfessionalGradeEstimateSchema.describe('Beckett grade estimate'),
  SGC: ProfessionalGradeEstimateSchema.describe('SGC grade estimate'),
  CGC: ProfessionalGradeEstimateSchema.describe('CGC grade estimate')
}).describe('Estimated grades across major professional grading companies');

/**
 * Three-Pass Grading System (v5.5)
 * Each pass contains weighted sub-scores and final grade
 */
const GradingPassSchema = z.object({
  centering: z.number().min(0).max(10).describe('Weighted centering score for this pass (0-10, use .0 or .5 only)'),
  corners: z.number().min(0).max(10).describe('Weighted corners score for this pass (0-10, use .0 or .5 only)'),
  edges: z.number().min(0).max(10).describe('Weighted edges score for this pass (0-10, use .0 or .5 only)'),
  surface: z.number().min(0).max(10).describe('Weighted surface score for this pass (0-10, use .0 or .5 only)'),
  final: z.number().min(0).max(10).describe('Final grade for this pass using weakest link (0-10, use .0 or .5 only)'),
  defects_noted: z.array(z.string()).describe('Key defects observed in this pass')
}).describe('Single grading pass with weighted sub-scores');

const GradingPassAveragedSchema = z.object({
  centering: z.number().min(0).max(10).describe('Averaged centering score across all passes'),
  corners: z.number().min(0).max(10).describe('Averaged corners score across all passes'),
  edges: z.number().min(0).max(10).describe('Averaged edges score across all passes'),
  surface: z.number().min(0).max(10).describe('Averaged surface score across all passes'),
  final: z.number().min(0).max(10).describe('Averaged final grade across all passes')
}).describe('Averaged scores across all three passes');

const GradingPassesSchema = z.object({
  pass_1: GradingPassSchema.describe('First independent grading pass'),
  pass_2: GradingPassSchema.describe('Second independent grading pass'),
  pass_3: GradingPassSchema.describe('Third independent grading pass'),
  averaged: GradingPassAveragedSchema.describe('Raw averaged scores (before rounding)'),
  averaged_rounded: GradingPassAveragedSchema.describe('Averaged scores rounded to nearest 0.5'),
  variance: z.number().min(0).describe('Variance between passes (MAX - MIN of final grades)'),
  consistency: z.enum(['high', 'moderate', 'low']).describe(
    'Consistency classification based on variance: ' +
    'high (variance ≤ 0.5), moderate (0.5 < variance ≤ 1.0), low (variance > 1.0)'
  ),
  consensus_notes: z.array(z.string()).describe(
    'Notes about defects detected in only 1 of 3 passes (not included in final score). ' +
    'Format: "[Defect type] detected in 1 of 3 passes (not included in final score)"'
  )
}).describe('Three-pass consensus grading results (v5.5)');

/**
 * Final grade with validation (v6.0 - WHOLE NUMBERS ONLY)
 *
 * CRITICAL VALIDATION FROM EVIDENCE-BASED PROTOCOL:
 * - v6.0: decimal_grade and whole_grade MUST be whole integers (no 8.5, 9.5, etc.)
 * - If decimal_grade = 10, ALL defects arrays across entire response must be empty
 * - If decimal_grade < 10, at least one defects array must have entries
 * - Summary must explain condition tier and dominant defect
 */
const FinalGradeSchema = z.object({
  decimal_grade: z.number().int().min(0).max(10).nullable().describe('v6.0: Final grade as whole integer (1-10) or null if not gradeable. NO half-points.'),
  whole_grade: z.number().int().min(0).max(10).nullable().describe('Final whole number grade (must match decimal_grade)'),
  grade_range: z.enum(['±0', '±1', '±2', '±3']).describe('Uncertainty range based on image quality (v7.4: whole numbers)'),
  condition_label: z.string().optional().describe('Condition label (e.g., "Gem Mint", "Near Mint", "Excellent")'),
  condition_tier: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional().describe('v6.0: Condition tier (A=N/A, B=1-4, C=5-6, D=7, E=8, F=9, G=10)'),
  dominant_defect: z.string().optional().describe('v6.0: Category with lowest score that controlled the grade'),
  summary: z.string().min(100).describe(
    '⚠️ PROCESS ORDER - THIS FIELD MUST BE GENERATED LAST: ' +
    'Before writing this summary, you MUST have already: ' +
    '(1) Completed all three grading passes, ' +
    '(2) Calculated averaged_rounded scores, ' +
    '(3) Determined the final decimal_grade value. ' +
    'ONLY THEN write this summary. ' +
    'CRITICAL: Any grade mentioned in this summary MUST exactly match the decimal_grade field value. ' +
    'If decimal_grade is 9, you must write "grade of 9" or "9/10" - NEVER a different number. ' +
    'Content: Describe overall condition, key defects affecting grade, and final grade with justification. ' +
    'Do NOT mention condition tiers or internal scoring mechanics. ' +
    'Minimum 100 characters.'
  ),
  grading_status: z.enum(['gradeable', 'not_gradeable_altered', 'not_gradeable_damaged', 'not_gradeable_slabbed']).optional().describe('Grading eligibility status')
}).describe('Final grade with evidence-based justification (v6.0: whole numbers only)');

// ═══════════════════════════════════════════════════════════════════════
// PART 2: CARD-TYPE-SPECIFIC SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sports card information (from sports_delta_v5.txt)
 */
const SportsCardInfoSchema = z.object({
  // Required universal fields
  card_name: z.string().describe('Full card name/title'),
  player_or_character: z.string().describe('Player or character name'),
  set_name: z.string().nullable().describe('Set/product name'),
  year: z.string().nullable().describe('Release year (4 digits)'),
  manufacturer: z.string().nullable().describe('Card manufacturer/publisher'),
  card_number: z.string().nullable().describe(
    'CRITICAL: Read the EXACT card number as printed on the card. ' +
    'DO NOT GUESS - read the actual digits. Include any prefixes or suffixes.'
  ),
  card_number_raw: z.string().nullable().optional().describe('The EXACT card number as printed verbatim'),
  authentic: z.boolean().describe('Is card authentic (true) or proxy/counterfeit (false)?'),

  // Sports-specific required fields
  sport_or_category: z.string().describe('Sport or category (e.g., "Baseball", "Basketball", "Football")'),

  // Sports-specific enhanced fields
  team: z.string().optional().describe('Player team'),
  position: z.string().optional().describe('Player position'),
  subset: z.string().optional().describe('Subset/parallel/variant'),
  serial_number: z.string().optional().describe('Serial number (e.g., "/99", "1/1")'),
  rookie_or_first: z.string().optional().describe('Rookie or first designation'),
  rarity_tier: z.string().optional().describe('Highest rarity tier (see sports_delta_v5.txt Section B)'),
  card_front_text: z.string().optional().describe('Text visible on card front'),
  card_back_text: z.string().optional().describe('Text visible on card back')
}).describe('Sports card information extraction (see sports_delta_v5.txt)');

/**
 * Pokemon card information (from pokemon_delta_v5.txt)
 */
const PokemonCardInfoSchema = z.object({
  // Required universal fields
  card_name: z.string().describe('Full card name (format: "Pokemon Name - Language" if non-English)'),
  player_or_character: z.string().describe('Pokemon name'),
  set_name: z.string().nullable().describe('Set name'),
  year: z.string().nullable().describe('Release year (4 digits)'),
  manufacturer: z.string().nullable().describe('Always "The Pokemon Company" or "Nintendo"'),
  card_number_ocr_breakdown: z.string().nullable().optional().describe(
    'MANDATORY: Character-by-character breakdown of card number. ' +
    'Format: "Position 1: [char], Position 2: [char], ..." ' +
    'Example for 179/132: "Position 1: 1, Position 2: 7, Position 3: 9, Position 4: /, Position 5: 1, Position 6: 3, Position 7: 2" ' +
    'You MUST fill this BEFORE card_number. Forces actual OCR instead of guessing.'
  ),
  card_number: z.string().nullable().describe(
    'CRITICAL: Read the EXACT card number as printed on the card. ' +
    'Location: Usually bottom-left or bottom-right corner of the card front. ' +
    'Format: "XXX/YYY" where XXX is the card number and YYY is the set total (e.g., "125/094", "179/132"). ' +
    'For promos: Use prefix format (e.g., "SM228", "SWSH039", "SVP085"). ' +
    'DO NOT GUESS OR INFER - read the actual digits printed on the card. ' +
    'Must match the digits from card_number_ocr_breakdown above.'
  ),
  card_number_raw: z.string().nullable().optional().describe(
    'The EXACT card number as printed, including any special characters or formatting. ' +
    'Copy verbatim from the card - do not normalize or clean up. Must match card_number_ocr_breakdown.'
  ),
  authentic: z.boolean().describe('Is card authentic?'),

  // Pokemon-specific required fields
  pokemon_stage: z.string().nullable().describe('Evolution stage: Basic, Stage 1, Stage 2, VMAX, ex, etc.'),
  pokemon_type: z.string().nullable().describe('Pokemon type (Fire, Water, Grass, Psychic, etc.)'),
  hp: z.string().nullable().describe('Hit points value'),
  card_type: z.string().nullable().describe('Card type: Pokemon, Trainer, Energy, etc.'),

  // Pokemon-specific enhanced fields
  rarity_tier: z.string().optional().describe('Highest rarity tier (see pokemon_delta_v5.txt Section C)'),
  attacks: z.array(z.object({
    name: z.string(),
    cost: z.string(),
    damage: z.string().optional(),
    effect: z.string().optional()
  })).optional().describe('Pokemon attacks'),
  weakness: z.string().optional().describe('Weakness type and multiplier'),
  resistance: z.string().optional().describe('Resistance type and reduction'),
  retreat_cost: z.string().optional().describe('Retreat cost'),
  pokedex_number: z.string().optional().describe('National Pokedex number'),
  regulation_mark: z.string().optional().describe('Regulation mark (D, E, F, G, H, etc.)'),
  card_front_text: z.string().optional().describe('Abilities and attack text'),
  card_back_text: z.string().optional().describe('Standard Pokemon card back')
}).describe('Pokemon card information extraction (see pokemon_delta_v5.txt)');

/**
 * Magic: The Gathering card information (from mtg_delta_v5.txt)
 */
const MtgCardInfoSchema = z.object({
  // Required universal fields
  card_name: z.string().describe('Card name as printed'),
  player_or_character: z.string().describe('Card name (same as card_name for MTG)'),
  set_name: z.string().nullable().describe('Set/expansion name'),
  year: z.string().nullable().describe('Release year (4 digits)'),
  manufacturer: z.string().nullable().describe('Always "Wizards of the Coast"'),
  card_number: z.string().nullable().describe(
    'CRITICAL: Read the EXACT collector number as printed on the card. ' +
    'Location: Usually bottom-left corner. Format: "XXX/YYY" (e.g., "234/287"). ' +
    'DO NOT GUESS - read the actual digits printed on the card.'
  ),
  card_number_raw: z.string().nullable().optional().describe('The EXACT card number as printed verbatim'),
  authentic: z.boolean().describe('Is card authentic?'),

  // MTG-specific required fields
  mtg_card_type: z.string().nullable().describe('Card type line (e.g., "Legendary Creature — Human Wizard", "Instant")'),
  mana_cost: z.string().nullable().describe('Mana cost using notation like {2}{U}{U}, {3}{W}{W}'),
  color_identity: z.string().nullable().describe('Card colors: W, U, B, R, G, C (e.g., "W,U" for Azorius)'),

  // MTG-specific enhanced fields
  creature_type: z.string().optional().describe('Creature subtypes if creature (e.g., "Human Wizard", "Dragon")'),
  power_toughness: z.string().optional().describe('Power/Toughness for creatures (e.g., "3/3", "*/2")'),
  rarity_tier: z.string().optional().describe('Highest rarity tier (see mtg_delta_v5.txt Section B)'),
  subset: z.string().optional().describe('Treatment/variant (Borderless, Extended Art, Showcase, etc.)'),
  serial_number: z.string().optional().describe('Serial number if present (rare in MTG)'),
  card_front_text: z.string().optional().describe('Rules text and abilities'),
  card_back_text: z.string().optional().describe('Standard Magic card back')
}).describe('Magic: The Gathering card information extraction (see mtg_delta_v5.txt)');

/**
 * Disney Lorcana card information (from lorcana_delta_v5.txt)
 */
const LorcanaCardInfoSchema = z.object({
  // Required universal fields
  card_name: z.string().describe('Full card title (format: "Character - Version")'),
  player_or_character: z.string().describe('Disney character name'),
  set_name: z.string().nullable().describe('Set name'),
  year: z.string().nullable().describe('Release year (4 digits)'),
  manufacturer: z.string().nullable().describe('Always "Ravensburger"'),
  card_number: z.string().nullable().describe(
    'CRITICAL: Read the EXACT collector number as printed on the card. ' +
    'Format: "XXX/YYY" (e.g., "156/204"). DO NOT GUESS - read the actual digits.'
  ),
  card_number_raw: z.string().nullable().optional().describe('The EXACT card number as printed verbatim'),
  authentic: z.boolean().describe('Is card authentic?'),

  // Lorcana-specific required fields
  character_version: z.string().nullable().describe('Version subtitle (after dash in card name)'),
  ink_color: z.enum(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']).nullable().describe('Card ink color'),
  lorcana_card_type: z.enum(['Character', 'Action', 'Item', 'Location', 'Song']).nullable().describe('Card type'),
  inkwell: z.boolean().nullable().describe('Has inkwell symbol (can be used as ink)?'),

  // Lorcana-specific enhanced fields
  strength: z.string().optional().describe('Character strength (attack value)'),
  willpower: z.string().optional().describe('Character willpower (defense value)'),
  lore_value: z.string().optional().describe('Lore value (quest value)'),
  ink_cost: z.string().optional().describe('Ink cost to play card'),
  classifications: z.array(z.string()).optional().describe('Character classifications (Storyborn, Dreamborn, Floodborn, Hero, Villain, etc.)'),
  rarity_tier: z.string().optional().describe('Highest rarity tier (see lorcana_delta_v5.txt Section B)'),
  subset: z.string().optional().describe('Variant type (Foil, Enchanted, Promo)'),
  card_front_text: z.string().optional().describe('Abilities and effects')
}).describe('Disney Lorcana card information extraction (see lorcana_delta_v5.txt)');

/**
 * Other/Generic trading card information (from other_delta_v5.txt)
 */
const OtherCardInfoSchema = z.object({
  // Required universal fields - player_or_character is PRIMARY identifier
  player_or_character: z.string().describe('PRIMARY: Person, character, or subject featured on the card (e.g., "Gisele Bundchen", "Blue-Eyes White Dragon")'),
  card_name: z.string().describe('Full card name/title as printed'),
  set_name: z.string().nullable().describe('Set/expansion/product line name (e.g., "Pop Century", "Legend of Blue Eyes")'),
  year: z.string().nullable().describe('Release year (4 digits)'),
  manufacturer: z.string().nullable().describe('Card publisher (Panini, Upper Deck, Topps, Konami, Bushiroad, etc.)'),
  card_number: z.string().nullable().describe(
    'CRITICAL: Read the EXACT card number as printed on the card. ' +
    'DO NOT GUESS - read the actual digits. Include any prefixes or suffixes.'
  ),
  card_number_raw: z.string().nullable().optional().describe('The EXACT card number as printed verbatim'),
  authentic: z.boolean().describe('Is card authentic licensed product?'),
  autographed: z.boolean().describe('Does card contain an autograph/signature?'),
  memorabilia: z.boolean().describe('Does card contain memorabilia/relic material?'),

  // Generic/Other enhanced fields
  rarity_tier: z.string().optional().describe('Card rarity (see other_delta_v5.txt Section B)'),
  subset: z.string().optional().describe('Subset/variant (Holographic, Foil, Parallel, etc.)'),
  serial_number: z.string().optional().describe('Serial number if present'),
  card_type: z.string().optional().describe('Card type classification (game-specific)'),
  card_front_text: z.string().optional().describe('Card text and effects'),
  card_back_text: z.string().optional().describe('Card back description')
}).describe('Generic trading card information extraction (see other_delta_v5.txt)');

/**
 * Union of all card info types - system selects appropriate schema based on card_type in meta
 */
const CardInfoSchema = z.union([
  SportsCardInfoSchema,
  PokemonCardInfoSchema,
  MtgCardInfoSchema,
  LorcanaCardInfoSchema,
  OtherCardInfoSchema
]).describe('Card-specific information extraction - structure varies by card type');

// ═══════════════════════════════════════════════════════════════════════
// PART 3: MAIN RESPONSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════

/**
 * Complete card grading response schema v5.0
 *
 * CRITICAL VALIDATION RULES (Evidence-Based Grading Protocol):
 *
 * 1. BURDEN OF PROOF (Universal):
 *    - Every defect claim requires: location, size, visual characteristics, colors, detection method
 *    - Every "no defect" claim requires: inspection documentation, negative findings, observable features
 *
 * 2. DESCRIPTION-SCORE CONSISTENCY (Two-Directional):
 *    - IF defect described → MUST deduct points AND add to defects array
 *    - IF score < 10.0 → MUST describe why in narrative
 *    - Defects array MUST match narrative descriptions (count and content)
 *
 * 3. MANDATORY INSPECTION DOCUMENTATION:
 *    - State WHAT inspected (which areas)
 *    - State HOW inspected (zoom level, viewing angles)
 *    - State WHAT looked for (fiber, whitening, scratches, etc.)
 *    - State WHAT found (defects OR confirmed absence)
 *
 * 4. TEMPLATE LANGUAGE PROHIBITION:
 *    - Each corner/edge/surface must have UNIQUE description
 *    - Must reference actual observable colors from THIS card
 *    - No copy-paste or generic phrases
 *
 * 5. VERIFICATION (Before Submission):
 *    - Every defect in narrative appears in defects array
 *    - Every defect array entry mentioned in narrative
 *    - Scores match descriptions logically
 *    - If score = 10.0, description states "zero defects" with evidence
 *    - If score < 10.0, description explains what caused deduction
 */
export const CardGradingResponseSchemaV5 = z.object({
  // Meta information
  meta: MetaSchema,

  // Card presence validation (v5.12) - MUST check first before any grading
  card_presence_validation: CardPresenceValidationSchema.optional().describe(
    'Card presence validation - verifies images contain actual trading cards. ' +
    'If front_card_detected or back_card_detected is false, corresponding scores should be null.'
  ),

  // Card information (structure varies by card type)
  card_info: CardInfoSchema,

  // Alteration detection (must check first - affects gradeability)
  alteration_detection: AlterationDetectionSchema.optional(),

  // Professional slab detection (affects gradeability)
  slab_detection: SlabDetectionSchema.optional(),

  // Image quality (affects confidence/uncertainty)
  image_quality: ImageQualitySchema,

  // Three-Pass Consensus Grading (v5.5) — GENERATED FIRST
  // The model commits to three independent pass scores BEFORE writing any detailed narratives.
  // Centering, defects, raw_sub_scores, weighted_scores, and final_grade derive from these passes.
  grading_passes: GradingPassesSchema.describe(
    'THREE-PASS CONSENSUS GRADING — GENERATE FIRST. Complete all three independent grading passes ' +
    '(pass_1, pass_2, pass_3) with scores and defects_noted BEFORE writing any detailed centering, ' +
    'corner, edge, or surface narratives. The detailed analysis sections that follow must reflect ' +
    'the consensus from these passes. Contains scores from three independent evaluations, ' +
    'averaged results, variance/consistency metrics, and notes about defects detected in only 1 pass.'
  ),

  // Centering analysis
  centering: z.object({
    front: CenteringAnalysisSchema.describe('Front centering analysis'),
    back: CenteringAnalysisSchema.describe('Back centering analysis'),
    front_summary: z.string().optional().describe('Optional summary of front centering'),
    back_summary: z.string().optional().describe('Optional summary of back centering')
  }).describe('Centering measurements and analysis for both sides'),

  // Defect analysis (MUST follow evidence-based protocol)
  defects: z.object({
    front: CardSideDefectsSchema.describe('Front side defects with evidence-based documentation'),
    back: CardSideDefectsSchema.describe('Back side defects with evidence-based documentation')
  }).describe('Complete defect analysis for front and back'),

  // Defect summary (human-readable aggregation)
  defect_summary: z.object({
    front: z.string().describe('Summary of front defects'),
    back: z.string().describe('Summary of back defects')
  }).optional(),

  // Autograph detection
  autograph: AutographSchema.optional(),

  // Raw sub-scores (before weighting)
  raw_sub_scores: z.object({
    centering_front: z.number().min(0).max(10),
    centering_back: z.number().min(0).max(10),
    corners_front: z.number().min(0).max(10),
    corners_back: z.number().min(0).max(10),
    edges_front: z.number().min(0).max(10),
    edges_back: z.number().min(0).max(10),
    surface_front: z.number().min(0).max(10),
    surface_back: z.number().min(0).max(10)
  }).describe('Raw sub-scores before front/back weighting'),

  // Subgrade scores (v7.2: MIN of front and back for each category)
  weighted_scores: z.object({
    centering_weighted: z.number().min(0).max(10),
    corners_weighted: z.number().min(0).max(10),
    edges_weighted: z.number().min(0).max(10),
    surface_weighted: z.number().min(0).max(10)
  }).describe('Subgrade scores - v7.2: MIN(front, back) for each category'),

  // Final grade (MUST follow validation rules)
  final_grade: FinalGradeSchema,

  // Professional grade estimates
  professional_grade_estimates: ProfessionalGradeEstimatesSchema.optional(),

  // Case detection (protective case affecting visibility)
  // ALWAYS populate - document any protective materials observed
  case_detection: z.object({
    case_type: z.enum(['penny_sleeve', 'top_loader', 'semi_rigid', 'slab', 'none']).describe('Type of protective case/holder detected (or "none")'),
    case_visibility: z.enum(['full', 'partial', 'unknown']).describe('How well card is visible through case'),
    impact_level: z.enum(['none', 'minor', 'moderate', 'high']).describe('Impact of case on grading visibility'),
    adjusted_uncertainty: z.enum(['±0', '±1', '±2', '±3']).describe('Grade uncertainty adjustment due to case (v7.4: whole numbers)'),
    notes: z.string().describe('Description of case observed and its impact on visibility. If none, state "No protective case observed."')
  }).describe('Protective case/holder detection - ALWAYS populate this field'),

  // Analysis summary
  analysis_summary: z.object({
    front_observations: z.array(z.string()).describe('Key observations from front'),
    back_observations: z.array(z.string()).describe('Key observations from back'),
    positives: z.array(z.string()).describe('Positive aspects of card condition'),
    negatives: z.array(z.string()).describe('Negative aspects / defects found')
  }).optional()
}).describe('Complete card grading analysis v5.5 with three-pass consensus grading');

// Export type for TypeScript usage
export type CardGradingResponseV5 = z.infer<typeof CardGradingResponseSchemaV5>;

// Export Three-Pass Grading types (v5.5)
export type GradingPass = z.infer<typeof GradingPassSchema>;
export type GradingPassAveraged = z.infer<typeof GradingPassAveragedSchema>;
export type GradingPasses = z.infer<typeof GradingPassesSchema>;

/**
 * Create OpenAI zodResponseFormat for structured outputs
 *
 * Usage:
 * ```typescript
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-5.1',
 *   messages: [...],
 *   response_format: getCardGradingResponseFormat()
 * });
 * ```
 */
export function getCardGradingResponseFormat() {
  return zodResponseFormat(CardGradingResponseSchemaV5, 'card_grading_response');
}

/**
 * Validate a grading response against the schema
 *
 * @param response - The response object to validate
 * @returns Validation result with parsed data or errors
 */
export function validateGradingResponse(response: unknown): {
  success: boolean;
  data?: CardGradingResponseV5;
  errors?: z.ZodError;
} {
  try {
    const parsed = CardGradingResponseSchemaV5.parse(response);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Additional runtime validation for evidence-based protocol rules (v6.0 updated)
 * These rules are harder to enforce at the schema level but critical for quality
 *
 * @param response - Validated response object
 * @returns Array of validation warnings/errors
 */
export function validateEvidenceBasedRules(response: CardGradingResponseV5): string[] {
  const warnings: string[] = [];

  // v6.0 Rule 0: Final grade must be a whole integer
  if (response.final_grade.decimal_grade !== null) {
    if (!Number.isInteger(response.final_grade.decimal_grade)) {
      warnings.push(
        `CRITICAL v6.0: Grade is ${response.final_grade.decimal_grade} but must be whole integer. ` +
        `NO half-point grades allowed (no 8.5, 9.5, etc.). Round DOWN to nearest integer.`
      );
    }
    // Check that decimal_grade and whole_grade match
    if (response.final_grade.decimal_grade !== response.final_grade.whole_grade) {
      warnings.push(
        `CRITICAL v6.0: decimal_grade (${response.final_grade.decimal_grade}) must equal whole_grade (${response.final_grade.whole_grade}).`
      );
    }
  }

  // Rule 1: If final_grade.decimal_grade = 10, ALL defects arrays must be empty
  if (response.final_grade.decimal_grade === 10) {
    const frontDefectCount = countDefects(response.defects.front);
    const backDefectCount = countDefects(response.defects.back);

    if (frontDefectCount > 0 || backDefectCount > 0) {
      warnings.push(
        `CRITICAL: Grade is 10 but ${frontDefectCount + backDefectCount} defects found. ` +
        `If grade = 10, ALL defects arrays must be empty. ` +
        `Either lower the grade or remove defects from descriptions.`
      );
    }
  }

  // Rule 2: If final_grade.decimal_grade < 10, at least one defect must exist
  if (response.final_grade.decimal_grade !== null &&
      response.final_grade.decimal_grade < 10) {
    const frontDefectCount = countDefects(response.defects.front);
    const backDefectCount = countDefects(response.defects.back);

    if (frontDefectCount === 0 && backDefectCount === 0) {
      warnings.push(
        `CRITICAL: Grade is ${response.final_grade.decimal_grade} but zero defects found. ` +
        `If grade < 10, must describe defects that caused point deduction. ` +
        `Either raise the grade to 10 or add defects to justify the deduction.`
      );
    }
  }

  // Rule 2.5: Check if summary mentions a different grade than decimal_grade
  if (response.final_grade.decimal_grade !== null && response.final_grade.summary) {
    const actualGrade = response.final_grade.decimal_grade;
    const summary = response.final_grade.summary;

    // Look for grade mentions in summary like "grade of 4", "a 4", "grade: 4", etc.
    // Match patterns: "grade of X", "grade X", "X/10", "a X", etc.
    const gradePatterns = [
      /\bgrade\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/gi,
      /\ba\s+(\d+(?:\.\d+)?)\s+(?:overall|grade|out\s+of)/gi,
      /\b(\d+(?:\.\d+)?)\s*\/\s*10\b/gi,
      /\bfinal\s+(?:grade\s+)?(?:of\s+)?(\d+(?:\.\d+)?)\b/gi,
      /\breceives?\s+(?:a\s+)?(\d+(?:\.\d+)?)\b/gi,
      /\bearns?\s+(?:a\s+)?(\d+(?:\.\d+)?)\b/gi
    ];

    for (const pattern of gradePatterns) {
      let match;
      while ((match = pattern.exec(summary)) !== null) {
        const mentionedGrade = parseFloat(match[1]);
        if (!isNaN(mentionedGrade) && mentionedGrade !== actualGrade) {
          warnings.push(
            `CRITICAL: Summary mentions grade "${match[1]}" but decimal_grade is ${actualGrade}. ` +
            `Summary text must match the actual calculated grade. ` +
            `Context: "...${summary.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20)}..."`
          );
        }
      }
    }
  }

  // Rule 3: Check for template language (repeated descriptions)
  const cornerDescriptions = [
    response.defects.front.corners.top_left.condition,
    response.defects.front.corners.top_right.condition,
    response.defects.front.corners.bottom_left.condition,
    response.defects.front.corners.bottom_right.condition,
    response.defects.back.corners.top_left.condition,
    response.defects.back.corners.top_right.condition,
    response.defects.back.corners.bottom_left.condition,
    response.defects.back.corners.bottom_right.condition
  ];

  const uniqueCornerDescriptions = new Set(cornerDescriptions);
  if (uniqueCornerDescriptions.size < cornerDescriptions.length) {
    warnings.push(
      `WARNING: Detected identical corner descriptions (template language). ` +
      `Each corner must have a UNIQUE description. Found ${cornerDescriptions.length} corners ` +
      `but only ${uniqueCornerDescriptions.size} unique descriptions.`
    );
  }

  // Rule 4: Check corner scores match defect presence
  checkCornerConsistency(response.defects.front.corners.top_left, 'Front Top-Left', warnings);
  checkCornerConsistency(response.defects.front.corners.top_right, 'Front Top-Right', warnings);
  checkCornerConsistency(response.defects.front.corners.bottom_left, 'Front Bottom-Left', warnings);
  checkCornerConsistency(response.defects.front.corners.bottom_right, 'Front Bottom-Right', warnings);
  checkCornerConsistency(response.defects.back.corners.top_left, 'Back Top-Left', warnings);
  checkCornerConsistency(response.defects.back.corners.top_right, 'Back Top-Right', warnings);
  checkCornerConsistency(response.defects.back.corners.bottom_left, 'Back Bottom-Left', warnings);
  checkCornerConsistency(response.defects.back.corners.bottom_right, 'Back Bottom-Right', warnings);

  return warnings;
}

/**
 * Fix grade mismatches in the summary text (v6.2)
 *
 * The AI sometimes generates summaries that mention a different grade than the actual calculated grade.
 * This function finds and replaces incorrect grade mentions with the actual grade.
 *
 * @param summary - The original summary text
 * @param actualGrade - The actual calculated grade
 * @returns Corrected summary text
 */
export function fixSummaryGradeMismatch(summary: string, actualGrade: number): string {
  if (!summary || actualGrade === null || actualGrade === undefined) {
    return summary;
  }

  let correctedSummary = summary;

  // Patterns that capture grade mentions with surrounding context for replacement
  // Each pattern captures: (prefix)(grade)(suffix)
  const replacementPatterns = [
    // "grade of 8" -> "grade of 9"
    { pattern: /(\bgrade\s+of\s+)(\d+(?:\.\d+)?)(\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "grade is 8" -> "grade is 9"
    { pattern: /(\bgrade\s+is\s+)(\d+(?:\.\d+)?)(\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "final grade 8" or "final grade of 8"
    { pattern: /(\bfinal\s+(?:grade\s+)?(?:of\s+)?)(\d+(?:\.\d+)?)(\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "assigned grade is 8"
    { pattern: /(\bassigned\s+grade\s+is\s+)(\d+(?:\.\d+)?)(\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "receives a 8" or "receives 8"
    { pattern: /(\breceives?\s+(?:a\s+)?)(\d+(?:\.\d+)?)(\s+(?:overall|grade|out\s+of)|\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "earns a 8" or "earns 8"
    { pattern: /(\bearns?\s+(?:a\s+)?)(\d+(?:\.\d+)?)(\s+(?:overall|grade|out\s+of)|\b)/gi, prefix: 1, grade: 2, suffix: 3 },
    // "8/10" -> "9/10"
    { pattern: /(\b)(\d+(?:\.\d+)?)(\s*\/\s*10\b)/gi, prefix: 1, grade: 2, suffix: 3 },
  ];

  for (const { pattern, prefix, grade, suffix } of replacementPatterns) {
    correctedSummary = correctedSummary.replace(pattern, (match, p1, p2, p3) => {
      const mentionedGrade = parseFloat(p2);
      // Only replace if the grade is different and is a valid grade (1-10)
      if (!isNaN(mentionedGrade) && mentionedGrade !== actualGrade && mentionedGrade >= 1 && mentionedGrade <= 10) {
        console.log(`[fixSummaryGradeMismatch] Replacing grade "${p2}" with "${actualGrade}" in: "${match}"`);
        return `${p1}${actualGrade}${p3}`;
      }
      return match;
    });
  }

  return correctedSummary;
}

/**
 * Helper: Count all defects in a card side
 */
function countDefects(side: z.infer<typeof CardSideDefectsSchema>): number {
  let count = 0;

  // Count corner defects
  count += side.corners.top_left.defects.filter(d => d.severity !== 'none').length;
  count += side.corners.top_right.defects.filter(d => d.severity !== 'none').length;
  count += side.corners.bottom_left.defects.filter(d => d.severity !== 'none').length;
  count += side.corners.bottom_right.defects.filter(d => d.severity !== 'none').length;

  // Count edge defects
  count += side.edges.top.defects.filter(d => d.severity !== 'none').length;
  count += side.edges.bottom.defects.filter(d => d.severity !== 'none').length;
  count += side.edges.left.defects.filter(d => d.severity !== 'none').length;
  count += side.edges.right.defects.filter(d => d.severity !== 'none').length;

  // Count surface defects
  count += side.surface.defects.filter(d => d.severity !== 'none').length;

  return count;
}

/**
 * Helper: Check corner score/defect consistency
 */
function checkCornerConsistency(
  corner: z.infer<typeof CornerConditionSchema>,
  location: string,
  warnings: string[]
): void {
  const defectCount = corner.defects.filter(d => d.severity !== 'none').length;

  if (corner.score === 10.0 && defectCount > 0) {
    warnings.push(
      `CRITICAL: ${location} corner has score 10.0 but ${defectCount} defects listed. ` +
      `Score 10.0 requires empty defects array.`
    );
  }

  if (corner.score < 10.0 && defectCount === 0) {
    warnings.push(
      `CRITICAL: ${location} corner has score ${corner.score} but zero defects listed. ` +
      `Score < 10.0 requires defects that explain the deduction.`
    );
  }
}
