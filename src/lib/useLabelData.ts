/**
 * Label Data Hook / Utility
 *
 * Provides easy access to label data from cards.
 * Falls back to generating label data on-the-fly if not stored in database.
 */

import { generateLabelData, type LabelData, type CardForLabel } from './labelDataGenerator';

/**
 * Extract label data from a card object
 * Uses stored label_data if available and complete, otherwise generates on the fly
 */
export function getCardLabelData(card: any): LabelData {
  // If card has pre-generated label_data, check if it's complete
  if (card.label_data && typeof card.label_data === 'object') {
    const stored = card.label_data as LabelData;

    // 🔧 v7.2: Regenerate if stored label_data has obvious placeholder values
    // This handles cases where label_data was saved before card_info was available
    const hasValidGrade = stored.grade !== null && stored.grade !== undefined;
    const hasValidName = stored.primaryName && stored.primaryName !== 'Card';

    // If we have a grade in the card but not in label_data, regenerate
    const cardHasGrade = card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined;

    if (hasValidGrade && hasValidName) {
      return stored;
    }

    // If stored data is incomplete but card has more data, regenerate
    if (!hasValidGrade && cardHasGrade) {
      console.log('[getCardLabelData] Regenerating label_data - stored has no grade but card does');
      // Fall through to regenerate
    } else if (!hasValidName && (card.featured || card.card_name || card.conversational_card_info?.player_or_character)) {
      console.log('[getCardLabelData] Regenerating label_data - stored has placeholder name but card has data');
      // Fall through to regenerate
    } else {
      // Use stored data even if incomplete - it's the best we have
      return stored;
    }
  }

  // Otherwise, generate it on the fly for backward compatibility
  const cardForLabel: CardForLabel = {
    id: card.id,
    category: card.category,
    serial: card.serial,
    conversational_decimal_grade: card.conversational_decimal_grade,
    conversational_whole_grade: card.conversational_whole_grade,
    conversational_condition_label: card.conversational_condition_label,
    conversational_card_info: card.conversational_card_info,
    dvg_decimal_grade: card.dvg_decimal_grade,
    dcm_grade_decimal: card.dcm_grade_decimal,
    card_name: card.card_name,
    card_set: card.card_set,
    card_number: card.card_number,
    featured: card.featured,
    pokemon_featured: card.pokemon_featured,
    release_date: card.release_date,
    serial_numbering: card.serial_numbering,
    rarity_tier: card.rarity_tier,
    rarity_description: card.rarity_description,
    autographed: card.autographed,
    autograph_type: card.autograph_type,
    memorabilia_type: card.memorabilia_type,
    rookie_card: card.rookie_card,
    first_print_rookie: card.first_print_rookie,
    holofoil: card.holofoil,
    is_foil: card.is_foil,
    foil_type: card.foil_type,
    is_double_faced: card.is_double_faced,
    mtg_rarity: card.mtg_rarity,
  };

  return generateLabelData(cardForLabel);
}

/**
 * Get props for CardSlabGrid from a card object
 * This is the main interface for using label data with the CardSlab components
 */
export function getCardSlabProps(card: any): {
  displayName: string;
  setLineText: string;
  features: string[];
  serial: string;
  grade: number | null;
  condition: string;
  isAlteredAuthentic: boolean;
} {
  const labelData = getCardLabelData(card);

  return {
    displayName: labelData.primaryName,
    setLineText: labelData.contextLine,
    features: labelData.features,
    serial: labelData.serial,
    grade: labelData.grade,
    condition: labelData.condition,
    isAlteredAuthentic: labelData.isAlteredAuthentic,
  };
}

/**
 * Get all label display data including formatted strings
 */
export function getFullLabelData(card: any): LabelData & {
  // Additional computed properties for display
  hasFeatures: boolean;
  gradeDisplay: string;
} {
  const labelData = getCardLabelData(card);

  return {
    ...labelData,
    hasFeatures: labelData.features.length > 0,
    gradeDisplay: labelData.grade !== null ? labelData.gradeFormatted : (labelData.isAlteredAuthentic ? 'A' : 'N/A'),
  };
}
