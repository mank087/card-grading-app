/**
 * Label Data Hook / Utility
 *
 * Provides easy access to label data from cards.
 * Falls back to generating label data on-the-fly if not stored in database.
 * Applies user custom_label_data overrides when present.
 */

import { generateLabelData, type LabelData, type CardForLabel, buildContextLine, buildFeaturesLine } from './labelDataGenerator';

/** Fields that can be overridden via custom_label_data */
export interface CustomLabelFields {
  primaryName?: string;
  setName?: string | null;
  subset?: string | null;
  cardNumber?: string | null;
  year?: string | null;
  features?: string[];
}

/**
 * Apply custom_label_data overrides to generated label data.
 * Only overrides fields the user has explicitly customized.
 */
function applyCustomOverrides(labelData: LabelData, custom: CustomLabelFields): LabelData {
  const result = { ...labelData };

  if (custom.primaryName !== undefined) {
    result.primaryName = custom.primaryName;
  }

  // If any context line component is overridden, rebuild the full context line
  const hasContextOverride = custom.setName !== undefined || custom.subset !== undefined
    || custom.cardNumber !== undefined || custom.year !== undefined;

  if (hasContextOverride) {
    if (custom.setName !== undefined) result.setName = custom.setName;
    if (custom.subset !== undefined) result.subset = custom.subset;
    if (custom.cardNumber !== undefined) result.cardNumber = custom.cardNumber;
    if (custom.year !== undefined) result.year = custom.year;
    result.contextLine = buildContextLine(result.setName, result.subset, result.cardNumber, result.year);
  }

  if (custom.features !== undefined) {
    result.features = custom.features;
    result.featuresLine = buildFeaturesLine(custom.features);
  }

  return result;
}

/**
 * Extract label data from a card object
 * Generates fresh label data, then applies any custom_label_data overrides.
 */
export function getCardLabelData(card: any): LabelData {
  // Always generate fresh label data from card fields
  const cardForLabel: CardForLabel = {
    id: card.id,
    category: card.category,
    serial: card.serial,
    conversational_decimal_grade: card.conversational_decimal_grade,
    conversational_whole_grade: card.conversational_whole_grade,
    conversational_condition_label: card.conversational_condition_label,
    conversational_card_info: card.conversational_card_info,
    dvg_decimal_grade: card.dvg_decimal_grade,
    dvg_whole_grade: card.dvg_whole_grade,
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
    // Pass grading data for nested grade lookup
    dvg_grading: card.dvg_grading,  // Sports cards use this top-level field
    ai_grading: card.ai_grading,     // Alternative nested structure
  } as CardForLabel & { dvg_grading?: any; ai_grading?: any };

  let labelData = generateLabelData(cardForLabel);

  // Apply user's custom label overrides if present
  if (card.custom_label_data && typeof card.custom_label_data === 'object') {
    labelData = applyCustomOverrides(labelData, card.custom_label_data as CustomLabelFields);
  }

  return labelData;
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
