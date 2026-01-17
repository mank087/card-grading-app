/**
 * Label Data Generator
 *
 * Generates standardized label data for all card types.
 * This ensures 100% consistency across all display contexts:
 * - Card detail pages
 * - Collection grid
 * - Featured cards
 * - Search results
 * - PDF reports
 * - Downloadable images
 *
 * Label Structure:
 * ┌─────────────────────────────────────────────────────────────┐
 * │         │  LINE 1: Primary Subject Name          │  GRADE  │
 * │  LOGO   │  LINE 2: Set • Subset • #Number • Year │  ─────  │
 * │         │  LINE 3: Special Features (if any)     │CONDITION│
 * │         │  LINE 4: DCM Serial Number             │         │
 * └─────────────────────────────────────────────────────────────┘
 */

import { getConditionFromGrade } from './conditionAssessment';

// ============================================================================
// CJK/UNICODE HANDLING FOR PDF/CANVAS
// ============================================================================

/**
 * Check if text contains CJK (Chinese/Japanese/Korean) characters
 */
export function containsCJK(text: string): boolean {
  if (!text) return false;
  // Japanese Hiragana, Katakana, CJK Unified Ideographs, Hangul
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(text);
}

/**
 * Extract ASCII-safe text for PDF/Canvas generators that don't support CJK fonts.
 *
 * Strategy:
 * 1. If text has no CJK, return as-is
 * 2. If text has format "Japanese (English)", extract the English portion
 * 3. If englishFallback provided, use it (possibly with ASCII suffix from text)
 * 4. If text has significant ASCII portion (multiple words or meaningful content), use it
 * 5. Otherwise use generic fallback
 *
 * @param text - Input text that may contain CJK characters
 * @param fallback - Fallback text if result is empty (default: "Card")
 * @param englishFallback - Optional English name to use for CJK-only text
 * @returns ASCII-safe string
 */
/**
 * Check if a value should be filtered (unknown, n/a, etc.)
 */
function shouldFilterValue(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();
  return (
    lower === 'unknown' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === '??' ||
    lower === '?' ||
    lower.startsWith('unknown ')  // "Unknown Set", "Unknown Year", etc.
  );
}

export function extractAsciiSafe(
  text: string,
  fallback: string = 'Card',
  englishFallback?: string
): string {
  if (!text) return englishFallback || fallback;

  // Filter out "Unknown...", "N/A", etc. values
  if (shouldFilterValue(text)) {
    return englishFallback || fallback;
  }

  // If no CJK characters, return the text as-is (just clean it)
  if (!containsCJK(text)) {
    const cleaned = text.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
    // Check if cleaned result should be filtered
    if (shouldFilterValue(cleaned)) {
      return fallback;
    }
    // Fix any existing double variant suffixes (e.g., "Mega Gengar EX EX" → "Mega Gengar EX")
    const fixedDoubles = cleaned.replace(/\b(VMAX|VSTAR|V|GX|EX|Prime)\s+\1\b/gi, '$1');
    return fixedDoubles || fallback;
  }

  // Check for "Japanese (English)" format - extract English from parentheses
  // This handles AI output like "メガゲンガー (Mega Gengar)" or "ピカチュウ (Pikachu)"
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const englishFromParens = parenMatch[1].replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
    if (englishFromParens && /[a-zA-Z]/.test(englishFromParens)) {
      // Add " - Japanese" suffix if the original had CJK outside parentheses
      const outsideParens = text.replace(/\([^)]+\)/, '').trim();
      if (containsCJK(outsideParens)) {
        return `${englishFromParens} - Japanese`;
      }
      return englishFromParens;
    }
  }

  // Extract ASCII portion from the text
  const asciiOnly = text
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII (including CJK)
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim();

  // Helper to fix double variants and build result
  const fixDoubleVariants = (str: string): string => {
    return str.replace(/\b(VMAX|VSTAR|V|GX|EX|Prime)\s+\1\b/gi, '$1');
  };

  // Check englishFallback first - it might have better translation
  if (englishFallback && englishFallback.trim()) {
    // Check if englishFallback has "Japanese (English)" format
    const fallbackParenMatch = englishFallback.match(/\(([^)]+)\)/);
    if (fallbackParenMatch && fallbackParenMatch[1]) {
      const englishFromFallback = fallbackParenMatch[1].replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
      if (englishFromFallback && /[a-zA-Z]/.test(englishFromFallback)) {
        // Append any ASCII suffix from the original text (like "EX", "VMAX")
        // But ONLY if the fallback doesn't already contain it
        const variantMatch = asciiOnly.match(/\b(VMAX|VSTAR|V|GX|EX|Prime)\b/i);
        if (variantMatch && !englishFromFallback.toUpperCase().includes(variantMatch[1].toUpperCase())) {
          return fixDoubleVariants(`${englishFromFallback} ${variantMatch[1]} - Japanese`);
        }
        return fixDoubleVariants(`${englishFromFallback} - Japanese`);
      }
    }

    // Clean englishFallback directly
    const cleanFallback = englishFallback.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanFallback && cleanFallback.length > 2 && /[a-zA-Z]/.test(cleanFallback)) {
      // Append any ASCII variant suffix from original text
      // But ONLY if the fallback doesn't already contain it
      const variantMatch = asciiOnly.match(/\b(VMAX|VSTAR|V|GX|EX|Prime)\b/i);
      if (variantMatch && !cleanFallback.toUpperCase().includes(variantMatch[1].toUpperCase())) {
        return fixDoubleVariants(`${cleanFallback} ${variantMatch[1]} - Japanese`);
      }
      return fixDoubleVariants(`${cleanFallback} - Japanese`);
    }
  }

  // If we got something meaningful from original text (not just short suffix), use it
  // Consider it meaningful if it's multiple words or long enough to be a name
  if (asciiOnly && asciiOnly.length > 3 && (asciiOnly.includes(' ') || /[a-zA-Z]{3,}/.test(asciiOnly))) {
    return asciiOnly;
  }

  // Last resort - use generic fallback
  return fallback;
}

// ============================================================================
// TYPES
// ============================================================================

export interface LabelData {
  // Line 1: Primary Subject Name
  primaryName: string;

  // Line 2: Context (Set • Subset • #Number • Year)
  setName: string | null;
  subset: string | null;
  cardNumber: string | null;
  year: string | null;
  contextLine: string;  // Pre-formatted: "Set • Subset • #123 • 2023"

  // Line 3: Special Features
  features: string[];
  featuresLine: string | null;  // Pre-formatted: "RC • Auto • /99" or null

  // Line 4: Serial
  serial: string;

  // Grade Info (right side)
  grade: number | null;
  gradeFormatted: string;
  condition: string;

  // Metadata
  category: string;
  isAlteredAuthentic: boolean;
}

export interface ConversationalCardInfo {
  card_name?: string | null;
  player_or_character?: string | null;
  set_name?: string | null;
  set_era?: string | null;
  subset?: string | null;
  card_number?: string | null;
  card_number_raw?: string | null;  // Full card number as printed (e.g., "94/102", "SM226")
  collector_number?: string | null;
  year?: string | null;
  set_year?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  rookie_or_first?: boolean | string | null;
  autographed?: boolean | null;
  memorabilia?: boolean | null;
  facsimile_autograph?: boolean | null;
  official_reprint?: boolean | null;
  rarity_tier?: string | null;
  special_features?: string | null;

  // Pokemon-specific
  pokemon_type?: string | null;
  pokemon_stage?: string | null;
  hp?: string | null;
  card_type?: string | null;
  holofoil?: string | null;

  // MTG-specific
  mtg_card_type?: string | null;
  creature_type?: string | null;
  mana_cost?: string | null;
  color_identity?: string | null;
  power_toughness?: string | null;
  expansion_code?: string | null;
  is_foil?: boolean | null;
  foil_type?: string | null;
  is_promo?: boolean | null;
  is_double_faced?: boolean | null;

  // Lorcana-specific
  ink_color?: string | null;
  lorcana_card_type?: string | null;
  character_version?: string | null;
  inkwell?: boolean | null;
  ink_cost?: number | null;
  is_enchanted?: boolean | null;
}

export interface CardForLabel {
  id: string;
  category?: string | null;
  serial?: string | null;

  // Grade fields
  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
  dvg_decimal_grade?: number | null;
  dvg_whole_grade?: number | null;

  // Legacy fields (fallbacks)
  card_name?: string | null;
  card_set?: string | null;
  card_number?: string | null;
  featured?: string | null;
  pokemon_featured?: string | null;
  release_date?: string | null;
  serial_numbering?: string | null;
  rarity_tier?: string | null;
  rarity_description?: string | null;
  autographed?: boolean | null;
  autograph_type?: string | null;
  memorabilia_type?: string | null;
  rookie_card?: boolean | null;
  first_print_rookie?: string | null;
  holofoil?: string | null;

  // MTG legacy
  is_foil?: boolean | null;
  foil_type?: string | null;
  is_double_faced?: boolean | null;
  mtg_rarity?: string | null;

  // Pokemon API data (for verified cards)
  pokemon_api_data?: {
    set?: {
      printedTotal?: number;
      [key: string]: any;
    };
    [key: string]: any;
  } | null;

  // Conversational data
  conversational_card_info?: ConversationalCardInfo | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Strip markdown formatting from text
 */
function stripMarkdown(text: string | null | undefined): string | null {
  if (!text) return null;
  if (text === 'null' || text === 'undefined') return null;
  return text.replace(/\*\*/g, '').trim() || null;
}

/**
 * Format grade for display
 * v6.0: Grades are whole integers (1-10), no half-points
 */
function formatGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined || isNaN(grade)) return 'N/A';
  // v6.0: Always return whole number (no decimals)
  return Math.round(grade).toString();
}

/**
 * Check if a serial number is valid (not empty, N/A, or "not present")
 */
function isValidSerialNumber(serial: string | null | undefined): boolean {
  if (!serial) return false;
  const lower = serial.toLowerCase().trim();
  return lower !== '' &&
         lower !== 'n/a' &&
         !lower.includes('not present') &&
         !lower.includes('none') &&
         !lower.includes('not visible') &&
         lower !== 'null';
}

/**
 * Clean a value by removing parenthetical explanations and truncating
 * E.g., "XY – Flashfire (assumed from card number...)" → "XY – Flashfire"
 */
function cleanValue(value: string | null | undefined): string | null {
  if (!value) return null;

  let cleaned = value.trim();

  // Remove parenthetical explanations (but keep short ones like "(2014)" or "(Holo)")
  // Match opening paren followed by lowercase word (indicates explanation)
  cleaned = cleaned.replace(/\s*\([a-z].*$/i, '').trim();

  // Also remove if parenthetical is very long (more than 30 chars)
  const parenMatch = cleaned.match(/^(.*?)\s*\((.{30,})\)(.*)$/);
  if (parenMatch) {
    cleaned = (parenMatch[1] + parenMatch[3]).trim();
  }

  // Remove trailing " - " or " – " if the explanation was at the end
  cleaned = cleaned.replace(/\s*[-–]\s*$/, '').trim();

  // If still too long (over 60 chars), truncate at a reasonable break point
  if (cleaned.length > 60) {
    // Try to break at a delimiter
    const breakPoints = [' - ', ' – ', ' • ', ', '];
    for (const bp of breakPoints) {
      const idx = cleaned.indexOf(bp);
      if (idx > 10 && idx < 50) {
        cleaned = cleaned.substring(0, idx).trim();
        break;
      }
    }
    // If still too long, hard truncate
    if (cleaned.length > 60) {
      cleaned = cleaned.substring(0, 57) + '...';
    }
  }

  return cleaned || null;
}

/**
 * Check if a string value is valid (not empty or placeholder)
 * Filters out: null, undefined, "unknown", "n/a", "??", values starting with "Unknown", etc.
 */
function isValidValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Reject empty
  if (lower === '') return false;

  // Reject exact placeholder values
  if (lower === 'n/a' ||
      lower === 'unknown' ||
      lower === 'null' ||
      lower === 'undefined' ||
      lower === 'none' ||
      lower === 'not available' ||
      lower === 'not specified' ||
      lower === 'tbd' ||
      lower === '??' ||
      lower === '?') {
    return false;
  }

  // Reject values that START with "Unknown" (e.g., "Unknown Lorcana Set (card number...)")
  if (lower.startsWith('unknown')) return false;

  // Reject values that START with "Assumed" or contain "(assumed"
  if (lower.startsWith('assumed') || lower.includes('(assumed')) return false;

  // Reject values that contain question marks (e.g., "Set Name??")
  if (trimmed.includes('??')) return false;

  // Reject values that are just placeholders in parentheses
  if (lower.startsWith('(') && lower.endsWith(')')) return false;

  // Reject overly long values (likely explanations, not actual data)
  if (trimmed.length > 100) return false;

  return true;
}

/**
 * Clean and validate a value for label display
 * Returns cleaned value if valid, null otherwise
 */
function getCleanValue(value: string | null | undefined): string | null {
  if (!isValidValue(value)) return null;
  return cleanValue(value);
}

/**
 * Get grade from card, checking multiple possible fields
 * Priority: conversational grades > dvg grades > ai_grading nested grades
 */
function getGrade(card: CardForLabel): number | null {
  // 1. Conversational grades (newest system)
  if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
    return card.conversational_decimal_grade;
  }
  if (card.conversational_whole_grade !== null && card.conversational_whole_grade !== undefined) {
    return card.conversational_whole_grade;
  }

  // 2. Top-level DVG grades
  if (card.dvg_decimal_grade !== null && card.dvg_decimal_grade !== undefined) {
    return card.dvg_decimal_grade;
  }
  if (card.dvg_whole_grade !== null && card.dvg_whole_grade !== undefined) {
    return card.dvg_whole_grade;
  }

  // 3. Nested ai_grading grades (for sports cards)
  const aiGrading = (card as any).ai_grading;
  const dvgGrading = aiGrading?.dvg_grading;
  const recommendedGrade = dvgGrading?.recommended_grade;

  if (recommendedGrade?.recommended_decimal_grade !== null && recommendedGrade?.recommended_decimal_grade !== undefined) {
    return recommendedGrade.recommended_decimal_grade;
  }
  if (recommendedGrade?.recommended_whole_grade !== null && recommendedGrade?.recommended_whole_grade !== undefined) {
    return recommendedGrade.recommended_whole_grade;
  }

  return null;
}

/**
 * Get condition label from card
 * v6.1: Always use deterministic grade-to-condition mapping for uniformity
 * This ensures cards with the same grade always get the same condition label
 */
function getCondition(card: CardForLabel, grade: number | null): string {
  // Always use the deterministic mapping based on whole number grade
  // This ensures uniform labeling (e.g., all 10s = "Gem Mint", all 9s = "Mint")
  if (grade !== null) {
    return getConditionFromGrade(Math.round(grade));
  }
  return '';
}

/**
 * Check if card is Altered/Authentic
 */
function checkAlteredAuthentic(card: CardForLabel): boolean {
  const label = card.conversational_condition_label?.toLowerCase() || '';
  return label.includes('altered') ||
         label.includes('authentic altered') ||
         label.includes('(aa)');
}

// ============================================================================
// PRIMARY NAME LOGIC BY CATEGORY
// ============================================================================

/**
 * Get the primary name for Sports cards
 * Sports: Player name is primary, card_name might be subset
 */
function getSportsName(cardInfo: ConversationalCardInfo, card: CardForLabel): string {
  const playerName = stripMarkdown(cardInfo.player_or_character);
  if (isValidValue(playerName)) return playerName!;
  if (isValidValue(card.featured)) return card.featured!;
  return 'Card';
}

/**
 * Get the primary name for Pokemon cards
 * Pokemon: Use card_name if it includes variant (VMAX, GX, etc.), else pokemon name
 */
function getPokemonName(cardInfo: ConversationalCardInfo, card: CardForLabel): string {
  const cardName = stripMarkdown(cardInfo.card_name);
  const pokemonName = stripMarkdown(cardInfo.player_or_character) ||
                      card.pokemon_featured ||
                      card.featured;

  // Check if card_name has a variant suffix that makes it more specific
  const variantPattern = /\b(VMAX|VSTAR|V|GX|EX|ex|Prime|LV\.X|LEGEND|BREAK|δ|Star|Gold Star|Shining|Crystal|Radiant)\b/i;

  if (isValidValue(cardName) && cardName !== pokemonName && variantPattern.test(cardName!)) {
    return cardName!;
  }

  if (isValidValue(pokemonName)) return pokemonName!;
  if (isValidValue(cardName)) return cardName!;
  return 'Card';
}

/**
 * Get the primary name for MTG cards
 * MTG: Full card name is primary (e.g., "Jace, the Mind Sculptor")
 */
function getMTGName(cardInfo: ConversationalCardInfo, card: CardForLabel): string {
  const cardName = stripMarkdown(cardInfo.card_name);
  const characterName = stripMarkdown(cardInfo.player_or_character);
  if (isValidValue(cardName)) return cardName!;
  if (isValidValue(characterName)) return characterName!;
  if (isValidValue(card.card_name)) return card.card_name!;
  if (isValidValue(card.featured)) return card.featured!;
  return 'Card';
}

/**
 * Get the primary name for Lorcana cards
 * Lorcana: Full card name with version (e.g., "Mickey Mouse - Brave Little Tailor")
 */
function getLorcanaName(cardInfo: ConversationalCardInfo, card: CardForLabel): string {
  const cardName = stripMarkdown(cardInfo.card_name);
  const characterName = stripMarkdown(cardInfo.player_or_character);
  const version = stripMarkdown(cardInfo.character_version);

  // If we have a full card_name, use it
  if (isValidValue(cardName)) return cardName!;

  // Otherwise build from character + version
  if (isValidValue(characterName) && isValidValue(version)) {
    return `${characterName} - ${version}`;
  }

  if (isValidValue(characterName)) return characterName!;
  if (isValidValue(card.featured)) return card.featured!;
  return 'Card';
}

/**
 * Get the primary name for Other cards
 */
function getOtherName(cardInfo: ConversationalCardInfo, card: CardForLabel): string {
  const characterName = stripMarkdown(cardInfo.player_or_character);
  const cardName = stripMarkdown(cardInfo.card_name);
  if (isValidValue(characterName)) return characterName!;
  if (isValidValue(cardName)) return cardName!;
  if (isValidValue(card.featured)) return card.featured!;
  if (isValidValue(card.card_name)) return card.card_name!;
  return 'Card';
}

// ============================================================================
// SUBSET LOGIC BY CATEGORY
// ============================================================================

/**
 * Get subset for Sports cards
 * For sports: If card_name differs from player name, card_name IS the subset (insert/parallel)
 */
function getSportsSubset(cardInfo: ConversationalCardInfo, card: CardForLabel): string | null {
  const cardName = stripMarkdown(cardInfo.card_name) || '';
  const playerName = stripMarkdown(cardInfo.player_or_character) || card.featured || '';

  // If card_name is different from player name, it's likely the insert/parallel name
  if (cardName && playerName &&
      cardName.toLowerCase() !== playerName.toLowerCase() &&
      !cardName.toLowerCase().includes(playerName.toLowerCase())) {
    return cardName;
  }

  // Otherwise use explicit subset field
  return stripMarkdown(cardInfo.subset);
}

/**
 * Get subset for Pokemon cards
 * Pokemon: Holo variant, Reverse Holo, Full Art, etc.
 */
function getPokemonSubset(cardInfo: ConversationalCardInfo, card: CardForLabel): string | null {
  const subset = stripMarkdown(cardInfo.subset);
  if (subset) return subset;

  // Check holofoil type
  const holofoil = stripMarkdown(cardInfo.holofoil) || card.holofoil;
  if (holofoil && holofoil.toLowerCase() !== 'no' && holofoil.toLowerCase() !== 'none') {
    // Format nicely
    if (holofoil.toLowerCase() === 'yes' || holofoil.toLowerCase() === 'holo') {
      return 'Holo';
    }
    if (holofoil.toLowerCase() === 'reverse') {
      return 'Reverse Holo';
    }
    return holofoil;
  }

  return null;
}

/**
 * Get subset for MTG cards
 * MTG: Frame treatment (Borderless, Extended Art, Showcase, etc.)
 */
function getMTGSubset(cardInfo: ConversationalCardInfo, card: CardForLabel): string | null {
  return stripMarkdown(cardInfo.subset);
}

/**
 * Get subset for Lorcana cards
 * Lorcana: Usually no separate subset
 */
function getLorcanaSubset(cardInfo: ConversationalCardInfo, card: CardForLabel): string | null {
  return stripMarkdown(cardInfo.subset);
}

// ============================================================================
// FEATURES LOGIC BY CATEGORY
// ============================================================================

/**
 * Build features array for Sports cards
 */
function getSportsFeatures(cardInfo: ConversationalCardInfo, card: CardForLabel): string[] {
  const features: string[] = [];

  // Rookie Card
  if (cardInfo.rookie_or_first === true ||
      cardInfo.rookie_or_first === 'true' ||
      card.rookie_card === true) {
    features.push('RC');
  }

  // Autograph
  if (cardInfo.autographed === true ||
      card.autographed === true ||
      card.autograph_type === 'authentic') {
    features.push('Auto');
  }

  // Facsimile Autograph
  if (cardInfo.facsimile_autograph === true) {
    features.push('Facsimile');
  }

  // Memorabilia/Relic
  if (cardInfo.memorabilia === true ||
      (card.memorabilia_type && card.memorabilia_type !== 'none')) {
    features.push('Mem');
  }

  // Official Reprint
  if (cardInfo.official_reprint === true) {
    features.push('Reprint');
  }

  // Serial Number
  const serialNum = stripMarkdown(cardInfo.serial_number) || card.serial_numbering;
  if (isValidSerialNumber(serialNum)) {
    features.push(serialNum!);
  }

  return features;
}

/**
 * Build features array for Pokemon cards
 */
function getPokemonFeatures(cardInfo: ConversationalCardInfo, card: CardForLabel): string[] {
  const features: string[] = [];

  // 1st Edition
  if (cardInfo.rookie_or_first === true ||
      cardInfo.rookie_or_first === 'true' ||
      card.first_print_rookie === 'true') {
    features.push('1st Ed');
  }

  // Autograph (rare for Pokemon but possible)
  if (cardInfo.autographed === true) {
    features.push('Auto');
  }

  // Serial Number
  const serialNum = stripMarkdown(cardInfo.serial_number) || card.serial_numbering;
  if (isValidSerialNumber(serialNum)) {
    features.push(serialNum!);
  }

  return features;
}

/**
 * Build features array for MTG cards
 */
function getMTGFeatures(cardInfo: ConversationalCardInfo, card: CardForLabel): string[] {
  const features: string[] = [];

  // Foil
  if (cardInfo.is_foil === true || card.is_foil === true) {
    const foilType = stripMarkdown(cardInfo.foil_type) || card.foil_type;
    features.push(foilType || 'Foil');
  }

  // Promo
  if (cardInfo.is_promo === true) {
    features.push('Promo');
  }

  // Double-Faced
  if (cardInfo.is_double_faced === true || card.is_double_faced === true) {
    features.push('DFC');
  }

  // Rarity (for MTG, show rarity if notable)
  const rarity = card.mtg_rarity;
  if (rarity === 'mythic') {
    features.push('Mythic');
  }

  // Serial Number (for serialized cards)
  const serialNum = stripMarkdown(cardInfo.serial_number);
  if (isValidSerialNumber(serialNum)) {
    features.push(serialNum!);
  }

  return features;
}

/**
 * Build features array for Lorcana cards
 */
function getLorcanaFeatures(cardInfo: ConversationalCardInfo, card: CardForLabel): string[] {
  const features: string[] = [];

  // Enchanted (premium variant)
  if (cardInfo.is_enchanted === true) {
    features.push('Enchanted');
  }

  // Foil
  if (cardInfo.is_foil === true) {
    features.push('Foil');
  }

  // Serial Number
  const serialNum = stripMarkdown(cardInfo.serial_number);
  if (isValidSerialNumber(serialNum)) {
    features.push(serialNum!);
  }

  return features;
}

/**
 * Build features array for Other cards
 */
function getOtherFeatures(cardInfo: ConversationalCardInfo, card: CardForLabel): string[] {
  const features: string[] = [];

  // Rookie/First
  if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true') {
    features.push('RC');
  }

  // Autograph
  if (cardInfo.autographed === true || card.autographed === true) {
    features.push('Auto');
  }

  // Facsimile
  if (cardInfo.facsimile_autograph === true) {
    features.push('Facsimile');
  }

  // Serial Number
  const serialNum = stripMarkdown(cardInfo.serial_number) || card.serial_numbering;
  if (isValidSerialNumber(serialNum)) {
    features.push(serialNum!);
  }

  return features;
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate standardized label data for any card type
 */
export function generateLabelData(card: CardForLabel): LabelData {
  const category = card.category || 'Other';
  const cardInfo = card.conversational_card_info || {};

  // ========================================
  // LINE 1: Primary Name
  // ========================================
  let rawPrimaryName: string;

  // Sports cards can have specific sport categories
  const isSportsCard = ['Sports', 'Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling'].includes(category);

  if (isSportsCard) {
    rawPrimaryName = getSportsName(cardInfo, card);
  } else {
    switch (category) {
      case 'Pokemon':
        rawPrimaryName = getPokemonName(cardInfo, card);
        break;
      case 'MTG':
        rawPrimaryName = getMTGName(cardInfo, card);
        break;
      case 'Lorcana':
        rawPrimaryName = getLorcanaName(cardInfo, card);
        break;
      default:
        rawPrimaryName = getOtherName(cardInfo, card);
    }
  }

  // Clean the primary name to remove any explanatory text
  const primaryName = cleanValue(rawPrimaryName) || 'Card';

  // ========================================
  // LINE 2: Context (Set • Subset • #Number • Year)
  // ========================================
  // Use getCleanValue to strip explanatory text and validate
  const rawSetName = stripMarkdown(cardInfo.set_name) ||
                     stripMarkdown(cardInfo.set_era) ||
                     card.card_set ||
                     null;
  const setName = getCleanValue(rawSetName);

  let rawSubset: string | null;
  if (isSportsCard) {
    rawSubset = getSportsSubset(cardInfo, card);
  } else {
    switch (category) {
      case 'Pokemon':
        rawSubset = getPokemonSubset(cardInfo, card);
        break;
      case 'MTG':
        rawSubset = getMTGSubset(cardInfo, card);
        break;
      case 'Lorcana':
        rawSubset = getLorcanaSubset(cardInfo, card);
        break;
      default:
        rawSubset = stripMarkdown(cardInfo.subset);
    }
  }
  const subset = getCleanValue(rawSubset);

  // Prefer card_number_raw for full format (e.g., "94/102", "SM226")
  // This matches the logic in CardDetailClient.tsx for the Card Information section
  const rawCardNumber = stripMarkdown(cardInfo.card_number_raw) ||
                        stripMarkdown(cardInfo.card_number) ||
                        stripMarkdown(cardInfo.collector_number) ||
                        card.card_number ||
                        null;
  // Clean card number - remove explanatory text like "(printed as 125/094★...)"
  let cardNumber = getCleanValue(rawCardNumber);

  // For Pokemon cards, format the card number properly
  // - Promo formats (SM226, SWSH039, SVP085) - show as-is, no "#" prefix
  // - Standard fractions (232/182) - show as-is with "#" prefix
  // - Just numerator (232) - try to add set total if we have it
  let formattedCardNumber: string | null = null;
  if (cardNumber && category === 'Pokemon') {
    // Check if it's already in fraction format (X/Y)
    if (/^\d+\/\d+$/.test(cardNumber)) {
      // Already has fraction format - use as-is with "#" prefix
      formattedCardNumber = `#${cardNumber}`;
    }
    // Check for promo-style formats (SM###, SWSH###, SVP###, TG##, GG##)
    else if (/^(SM|SWSH|SVP|TG|GG|XY|BW)\d+$/i.test(cardNumber)) {
      // Promo format - show as-is without "#" prefix
      formattedCardNumber = cardNumber.toUpperCase();
    }
    // Check if it's a pure number that needs the set total
    else if (/^\d+$/.test(cardNumber)) {
      // Try to get set total from various sources
      // 1. From card's pokemon_api_data (if verified)
      const setPrintedTotal = card.pokemon_api_data?.set?.printedTotal;

      if (setPrintedTotal) {
        formattedCardNumber = `#${cardNumber}/${setPrintedTotal}`;
      } else {
        // Just use the number with "#" prefix
        formattedCardNumber = `#${cardNumber}`;
      }
    }
    // Gallery formats like TG10/TG30 or GG33/GG70
    else if (/^(TG|GG)\d+\/(TG|GG)\d+$/i.test(cardNumber)) {
      // Show first part only with no prefix (TG10)
      const firstPart = cardNumber.split('/')[0];
      formattedCardNumber = firstPart.toUpperCase();
    }
    else {
      // Unknown format - show with "#" prefix
      formattedCardNumber = `#${cardNumber}`;
    }
  } else if (cardNumber) {
    // Non-Pokemon cards - standard "#" prefix
    formattedCardNumber = `#${cardNumber}`;
  }

  const rawYear = stripMarkdown(cardInfo.year) ||
                  stripMarkdown(cardInfo.set_year) ||
                  card.release_date ||
                  null;
  const year = getCleanValue(rawYear);

  // Build context line: Set • Subset • #Number • Year
  const contextParts: string[] = [];
  if (setName) contextParts.push(setName);
  if (subset) contextParts.push(subset);
  if (formattedCardNumber) contextParts.push(formattedCardNumber);
  if (year) contextParts.push(year);

  const contextLine = contextParts.join(' • ');

  // ========================================
  // LINE 3: Special Features
  // ========================================
  let features: string[];

  if (isSportsCard) {
    features = getSportsFeatures(cardInfo, card);
  } else {
    switch (category) {
      case 'Pokemon':
        features = getPokemonFeatures(cardInfo, card);
        break;
      case 'MTG':
        features = getMTGFeatures(cardInfo, card);
        break;
      case 'Lorcana':
        features = getLorcanaFeatures(cardInfo, card);
        break;
      default:
        features = getOtherFeatures(cardInfo, card);
    }
  }

  const featuresLine = features.length > 0 ? features.join(' • ') : null;

  // ========================================
  // LINE 4: Serial
  // ========================================
  const serial = card.serial || `DCM-${card.id?.slice(0, 8) || 'UNKNOWN'}`;

  // ========================================
  // GRADE INFO (right side)
  // ========================================
  const grade = getGrade(card);
  const gradeFormatted = formatGrade(grade);
  const condition = getCondition(card, grade);
  const isAlteredAuthentic = checkAlteredAuthentic(card);

  return {
    primaryName,
    setName,
    subset,
    cardNumber,
    year,
    contextLine,
    features,
    featuresLine,
    serial,
    grade,
    gradeFormatted,
    condition,
    category,
    isAlteredAuthentic,
  };
}

/**
 * Generate label data from a card that already has label_data stored
 * Falls back to generating if not present
 */
export function getLabelData(card: CardForLabel & { label_data?: LabelData | null }): LabelData {
  // If label_data is already stored, use it
  if (card.label_data) {
    return card.label_data;
  }

  // Otherwise generate it
  return generateLabelData(card);
}

// ============================================================================
// DYNAMIC FONT SIZE UTILITIES
// ============================================================================

/**
 * Calculate appropriate font size for primary name based on length
 * Returns font size in pixels for web, can be adapted for PDF/canvas
 */
export function getPrimaryNameFontSize(name: string, maxWidth: number = 200): number {
  const length = name.length;

  if (length <= 15) return 14;
  if (length <= 20) return 13;
  if (length <= 25) return 12;
  if (length <= 30) return 11;
  if (length <= 35) return 10;
  if (length <= 40) return 9;
  return 8;
}

/**
 * Calculate appropriate font size for context line based on length
 */
export function getContextLineFontSize(line: string): number {
  const length = line.length;

  if (length <= 30) return 11;
  if (length <= 40) return 10;
  if (length <= 50) return 9;
  if (length <= 60) return 8;
  return 7;
}

/**
 * Calculate scale factor for text to fit in container
 * Used for CSS transform: scaleX()
 */
export function getTextScaleFactor(text: string, maxChars: number): number {
  if (text.length <= maxChars) return 1;
  return Math.max(0.6, maxChars / text.length);
}
