/**
 * Label Data Hook / Utility
 *
 * Provides easy access to label data from cards.
 * Falls back to generating label data on-the-fly if not stored in database.
 */

import { generateLabelData, type LabelData, type CardForLabel } from './labelDataGenerator';

/**
 * Extract label data from a card object
 * 🔧 v7.2: Always generates fresh label data to ensure accuracy
 * This fixes issues where stored label_data was incomplete
 */
export function getCardLabelData(card: any): LabelData {
  // Always generate fresh label data from card fields
  // This ensures we use the latest data regardless of what's stored in label_data
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
