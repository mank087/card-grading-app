/**
 * eBay Item Specifics Mapping
 *
 * Maps DCM card data to eBay item specifics based on card type.
 */

import { getEbayCategoryForDcmCategory } from './constants';
import {
  resolveListingFields,
  isMeaningfulValue,
  detectCardLanguage,
  getSerialNumbering,
  getSerialDenominator,
  hasAutograph,
  extractYear,
  detectSport,
  detectLeague,
  type ListingFields,
} from './listingFields';

// The value helpers used to live here. They now live in listingFields.ts, the
// one place that reads a card row, and are re-exported so existing importers
// (EbayListingModal, ebay-image-prep) don't have to care where they moved.
export { detectCardLanguage, getSerialNumbering, getSerialDenominator };

export interface ItemSpecific {
  name: string;
  value: string | string[];
  required?: boolean;
  editable?: boolean;
}

/**
 * Get eBay category ID for a card type.
 *
 * Derives from DCM_TO_EBAY_CATEGORY in constants.ts — the single source of
 * truth shared with the server listing route — so the client-built aspects
 * and the server-chosen category can never disagree. Lookup is case- and
 * punctuation-insensitive ('onepiece', 'One Piece', 'Yu-Gi-Oh!', 'starwars'
 * all resolve); unknown types fall back to Non-Sport Trading Cards (183050).
 */
export function getCategoryForCardType(cardType: string): string {
  return getEbayCategoryForDcmCategory(cardType);
}

/**
 * Map Pokemon card data to eBay item specifics
 */
export function mapPokemonCardToSpecifics(card: any): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Game (required for CCG)
  specifics.push({
    name: 'Game',
    value: 'Pokémon TCG',
    required: true,
    editable: false,
  });

  // Character/Pokemon name
  const character = card.pokemon_featured || card.featured || cardInfo.player_or_character || card.card_name;
  if (character) {
    specifics.push({
      name: 'Character',
      value: character,
      required: false,
      editable: true,
    });
  }

  // Set name
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Card number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Rarity
  const rarity = cardInfo.rarity || card.rarity;
  if (rarity) {
    specifics.push({
      name: 'Rarity',
      value: rarity,
      required: false,
      editable: true,
    });
  }

  // Year
  const year = cardInfo.card_date || cardInfo.release_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });
  }

  // Language
  specifics.push({
    name: 'Language',
    value: detectCardLanguage(card),
    required: false,
    editable: true,
  });

  // Manufacturer
  specifics.push({
    name: 'Manufacturer',
    value: 'The Pokémon Company',
    required: false,
    editable: true,
  });

  // Serial Numbering (e.g., "12/99", "/25")
  const serialNum = getSerialNumbering(card);
  if (serialNum) {
    specifics.push({
      name: 'Numbered',
      value: serialNum,
      required: false,
      editable: true,
    });
  }

  // Features (special attributes)
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (hasAutograph(card)) features.push('Autographed');
  if (serialNum) features.push('Serial Numbered');

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  // Autographed
  specifics.push({
    name: 'Autographed',
    value: hasAutograph(card) ? 'Yes' : 'No',
    required: false,
    editable: true,
  });

  return specifics;
}

/**
 * Map Sports card data to eBay item specifics
 */
export function mapSportsCardToSpecifics(card: any): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Sport (required). detectSport returns '' when it can't tell; eBay still
  // needs a value here, and Multi-Sport is the honest one.
  const sport = detectSport(card.sub_category || card.category || cardInfo.category) || 'Multi-Sport';
  specifics.push({
    name: 'Sport',
    value: sport,
    required: true,
    editable: true,
  });

  // Player/Athlete
  const player = card.featured || cardInfo.player_or_character || card.card_name;
  if (player) {
    specifics.push({
      name: 'Player/Athlete',
      value: player,
      required: true,
      editable: true,
    });
  }

  // Team
  const team = cardInfo.team || card.team;
  if (team) {
    specifics.push({
      name: 'Team',
      value: team,
      required: false,
      editable: true,
    });
  }

  // Manufacturer/Brand
  const manufacturer = cardInfo.manufacturer || card.manufacturer;
  if (manufacturer) {
    specifics.push({
      name: 'Manufacturer',
      value: manufacturer,
      required: false,
      editable: true,
    });
  }

  // Set
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Year/Season
  const year = cardInfo.card_date || cardInfo.release_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });

    specifics.push({
      name: 'Season',
      value: year,
      required: false,
      editable: true,
    });
  }

  // Card Number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Card Name (subset/insert name)
  const cardName = cardInfo.subset || cardInfo.insert_set;
  if (cardName) {
    specifics.push({
      name: 'Card Name',
      value: cardName,
      required: false,
      editable: true,
    });
  }

  // League
  const league = detectLeague(sport);
  if (league) {
    specifics.push({
      name: 'League',
      value: league,
      required: false,
      editable: true,
    });
  }

  // Serial Numbering (e.g., "12/99", "/25")
  const serialNum = getSerialNumbering(card);
  if (serialNum) {
    specifics.push({
      name: 'Numbered',
      value: serialNum,
      required: false,
      editable: true,
    });
  }

  // Features
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (cardInfo.rookie || card.is_rookie) features.push('Rookie');
  if (hasAutograph(card)) features.push('Autograph');
  if (serialNum) features.push('Serial Numbered');
  if (cardInfo.parallel) features.push(cardInfo.parallel);

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  // Parallel/Variety
  if (cardInfo.parallel || cardInfo.variety) {
    specifics.push({
      name: 'Parallel/Variety',
      value: cardInfo.parallel || cardInfo.variety,
      required: false,
      editable: true,
    });
  }

  // Autographed
  specifics.push({
    name: 'Autographed',
    value: hasAutograph(card) ? 'Yes' : 'No',
    required: false,
    editable: true,
  });

  return specifics;
}

/**
 * Map Other/Non-Sport card data to eBay item specifics
 */
export function mapOtherCardToSpecifics(card: any): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Franchise (REQUIRED for Non-Sport Trading Cards category)
  // Use set name, manufacturer, or a generic value
  const franchise = cardInfo.set_name || cardInfo.manufacturer || card.card_set || 'Entertainment';
  specifics.push({
    name: 'Franchise',
    value: franchise,
    required: true,
    editable: true,
  });

  // Type/Category
  const type = cardInfo.category || card.category || 'Trading Card';
  specifics.push({
    name: 'Type',
    value: type,
    required: false,
    editable: true,
  });

  // Subject (character/person)
  const subject = card.featured || cardInfo.player_or_character || card.card_name;
  if (subject) {
    specifics.push({
      name: 'Subject',
      value: subject,
      required: false,
      editable: true,
    });
  }

  // Card Name
  const cardName = cardInfo.card_name || card.card_name;
  if (cardName && cardName !== subject) {
    specifics.push({
      name: 'Card Name',
      value: cardName,
      required: false,
      editable: true,
    });
  }

  // Set
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Manufacturer
  const manufacturer = cardInfo.manufacturer || card.manufacturer;
  if (manufacturer) {
    specifics.push({
      name: 'Manufacturer',
      value: manufacturer,
      required: false,
      editable: true,
    });
  }

  // Year
  const year = cardInfo.card_date || cardInfo.release_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });
  }

  // Card Number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Language
  specifics.push({
    name: 'Language',
    value: detectCardLanguage(card),
    required: false,
    editable: true,
  });

  // Serial Numbering (e.g., "12/99", "/25")
  const serialNum = getSerialNumbering(card);
  if (serialNum) {
    specifics.push({
      name: 'Numbered',
      value: serialNum,
      required: false,
      editable: true,
    });
  }

  // Features
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (hasAutograph(card)) features.push('Autographed');
  if (serialNum) features.push('Serial Numbered');

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  // Autographed
  specifics.push({
    name: 'Autographed',
    value: hasAutograph(card) ? 'Yes' : 'No',
    required: false,
    editable: true,
  });

  return specifics;
}

/**
 * Map MTG card data to eBay item specifics
 */
export function mapMTGCardToSpecifics(card: any): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Game (required for CCG)
  specifics.push({
    name: 'Game',
    value: 'Magic: The Gathering',
    required: true,
    editable: false,
  });

  // Card Name
  const cardName = card.card_name || cardInfo.card_name;
  if (cardName) {
    specifics.push({
      name: 'Card Name',
      value: cardName,
      required: false,
      editable: true,
    });
  }

  // Set
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Card Number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Rarity
  const rarity = cardInfo.rarity || card.rarity;
  if (rarity) {
    specifics.push({
      name: 'Rarity',
      value: rarity,
      required: false,
      editable: true,
    });
  }

  // Year
  const year = cardInfo.card_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });
  }

  // Manufacturer
  specifics.push({
    name: 'Manufacturer',
    value: 'Wizards of the Coast',
    required: false,
    editable: true,
  });

  // Language
  specifics.push({
    name: 'Language',
    value: detectCardLanguage(card),
    required: false,
    editable: true,
  });

  // Features
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (cardInfo.foil || card.is_foil) features.push('Foil');
  // Through the resolver, like every other mapper: the raw column carries the
  // model's "N/A"/"none" spellings, which read as truthy and filed every MTG
  // card under the Serial Numbered feature.
  if (getSerialNumbering(card)) features.push('Serial Numbered');

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  // Finish (foil/non-foil)
  specifics.push({
    name: 'Finish',
    value: cardInfo.foil || card.is_foil ? 'Foil' : 'Regular',
    required: false,
    editable: true,
  });

  return specifics;
}

/**
 * Map Lorcana card data to eBay item specifics
 */
export function mapLorcanaCardToSpecifics(card: any): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Game (required for CCG)
  specifics.push({
    name: 'Game',
    value: 'Disney Lorcana',
    required: true,
    editable: false,
  });

  // Character
  const character = card.featured || cardInfo.player_or_character || card.card_name;
  if (character) {
    specifics.push({
      name: 'Character',
      value: character,
      required: false,
      editable: true,
    });
  }

  // Card Name
  const cardName = cardInfo.card_name || card.card_name;
  if (cardName && cardName !== character) {
    specifics.push({
      name: 'Card Name',
      value: cardName,
      required: false,
      editable: true,
    });
  }

  // Set
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Card Number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Rarity
  const rarity = cardInfo.rarity || card.rarity;
  if (rarity) {
    specifics.push({
      name: 'Rarity',
      value: rarity,
      required: false,
      editable: true,
    });
  }

  // Year
  const year = cardInfo.card_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });
  }

  // Manufacturer
  specifics.push({
    name: 'Manufacturer',
    value: 'Ravensburger',
    required: false,
    editable: true,
  });

  // Language
  specifics.push({
    name: 'Language',
    value: detectCardLanguage(card),
    required: false,
    editable: true,
  });

  // Features
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (cardInfo.enchanted || card.is_enchanted) features.push('Enchanted');
  if (card.serial_numbering) features.push('Serial Numbered');

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  return specifics;
}

/**
 * Shared CCG mapping for TCGs that follow the standard CCG aspect set
 * (One Piece, Yu-Gi-Oh, Star Wars Unlimited). Mirrors the shape of the
 * Pokemon/MTG/Lorcana mappers so aspect names stay consistent across all
 * CCG Individual Cards (183454) listings: Game (required), Character,
 * Card Name, Set, Card Number, Rarity, Year, Manufacturer, Language,
 * Numbered, Features.
 */
function mapGenericCcgCardToSpecifics(card: any, game: string, manufacturer: string): ItemSpecific[] {
  const cardInfo = card.conversational_card_info || {};
  const specifics: ItemSpecific[] = [];

  // Game (required for CCG)
  specifics.push({
    name: 'Game',
    value: game,
    required: true,
    editable: false,
  });

  // Character
  const character = card.featured || cardInfo.player_or_character || card.card_name;
  if (character) {
    specifics.push({
      name: 'Character',
      value: character,
      required: false,
      editable: true,
    });
  }

  // Card Name
  const cardName = cardInfo.card_name || card.card_name;
  if (cardName && cardName !== character) {
    specifics.push({
      name: 'Card Name',
      value: cardName,
      required: false,
      editable: true,
    });
  }

  // Set
  const setName = cardInfo.set_name || card.card_set;
  if (setName) {
    specifics.push({
      name: 'Set',
      value: setName,
      required: false,
      editable: true,
    });
  }

  // Card Number
  const cardNumber = cardInfo.card_number || card.card_number;
  if (cardNumber) {
    specifics.push({
      name: 'Card Number',
      value: cardNumber,
      required: false,
      editable: true,
    });
  }

  // Rarity
  const rarity = cardInfo.rarity || card.rarity;
  if (rarity) {
    specifics.push({
      name: 'Rarity',
      value: rarity,
      required: false,
      editable: true,
    });
  }

  // Year
  const year = cardInfo.card_date || card.release_date;
  if (year) {
    specifics.push({
      name: 'Year Manufactured',
      value: extractYear(year),
      required: false,
      editable: true,
    });
  }

  // Manufacturer
  specifics.push({
    name: 'Manufacturer',
    value: manufacturer,
    required: false,
    editable: true,
  });

  // Language
  specifics.push({
    name: 'Language',
    value: detectCardLanguage(card),
    required: false,
    editable: true,
  });

  // Serial Numbering (e.g., "12/99", "/25")
  const serialNum = getSerialNumbering(card);
  if (serialNum) {
    specifics.push({
      name: 'Numbered',
      value: serialNum,
      required: false,
      editable: true,
    });
  }

  // Features
  const features: string[] = [];
  if (cardInfo.special_features) {
    if (Array.isArray(cardInfo.special_features)) {
      features.push(...cardInfo.special_features);
    } else {
      features.push(cardInfo.special_features);
    }
  }
  if (cardInfo.foil || card.is_foil) features.push('Foil');
  if (hasAutograph(card)) features.push('Autographed');
  if (serialNum) features.push('Serial Numbered');

  if (features.length > 0) {
    specifics.push({
      name: 'Features',
      value: features,
      required: false,
      editable: true,
    });
  }

  return specifics;
}

/**
 * Map One Piece card data to eBay item specifics (CCG category 183454)
 */
export function mapOnePieceCardToSpecifics(card: any): ItemSpecific[] {
  return mapGenericCcgCardToSpecifics(card, 'One Piece Card Game', 'Bandai');
}

/**
 * Map Yu-Gi-Oh card data to eBay item specifics (CCG category 183454)
 */
export function mapYuGiOhCardToSpecifics(card: any): ItemSpecific[] {
  return mapGenericCcgCardToSpecifics(card, 'Yu-Gi-Oh! TCG', 'Konami');
}

/**
 * Map Star Wars Unlimited card data to eBay item specifics (CCG category 183454)
 */
export function mapStarWarsCardToSpecifics(card: any): ItemSpecific[] {
  return mapGenericCcgCardToSpecifics(card, 'Star Wars Unlimited', 'Fantasy Flight Games');
}

/**
 * Main function to map any card to item specifics based on card type
 */
export function mapCardToItemSpecifics(card: any, cardType: string): ItemSpecific[] {
  let specifics: ItemSpecific[];

  // Normalize so 'One Piece', 'onepiece', 'Yu-Gi-Oh!', 'star wars' etc. all
  // route the same way — mirrors the category lookup in constants.ts.
  const normalizedType = cardType.toLowerCase().replace(/[^a-z0-9]/g, '');

  switch (normalizedType) {
    case 'pokemon':
      specifics = mapPokemonCardToSpecifics(card);
      break;
    case 'sports':
      specifics = mapSportsCardToSpecifics(card);
      break;
    case 'mtg':
      specifics = mapMTGCardToSpecifics(card);
      break;
    case 'lorcana':
      specifics = mapLorcanaCardToSpecifics(card);
      break;
    case 'onepiece':
      specifics = mapOnePieceCardToSpecifics(card);
      break;
    case 'yugioh':
      specifics = mapYuGiOhCardToSpecifics(card);
      break;
    case 'starwars':
      specifics = mapStarWarsCardToSpecifics(card);
      break;
    case 'other':
    default:
      specifics = mapOtherCardToSpecifics(card);
      break;
  }

  // Add Certification Number as an item specific (supplements condition
  // descriptor 27503). Enterprise org cards use their branded serial
  // (e.g. APX442921); consumer cards use the DCM serial.
  const certSerial = card.org_serial_display || card.serial;
  if (certSerial) {
    specifics.push({
      name: 'Certification Number',
      value: String(certSerial),
      required: false,
      editable: true,
    });
  }

  // Graded-card search facets. eBay's left-rail filters read ASPECTS, not
  // condition descriptors — without these, graded-card searches filtered by
  // grade/grader never surface the listing. Grades are whole numbers 1-10.
  const grade = card.conversational_whole_grade ?? card.conversational_decimal_grade ?? card.grade_numeric;
  const wholeGrade = typeof grade === 'number' && isFinite(grade) ? Math.round(grade) : null;
  if (wholeGrade !== null && wholeGrade >= 1 && wholeGrade <= 10) {
    specifics.push({ name: 'Grade', value: String(wholeGrade), required: false, editable: true });
  }
  specifics.push({ name: 'Graded', value: 'Yes', required: false, editable: true });
  // DCM has no eBay grader ID, so the recognized-value list requires "Other".
  specifics.push({ name: 'Professional Grader', value: 'Other', required: false, editable: true });

  // eBay's RECOMMENDED aspects, filled from data we already hold. eBay states
  // outright that complete required + recommended specifics get more
  // visibility, and the buyer's left-rail filters (Parallel, Season, Team,
  // Vintage, Finish) read aspects — nothing else.
  const fields = resolveListingFields(card, cardType);
  for (const [name, value] of Object.entries(recommendedAspectValues(fields))) {
    if (!isMeaningfulValue(value)) continue;
    if (specifics.some(s => s.name.toLowerCase() === name.toLowerCase())) continue;
    specifics.push({ name, value, required: false, editable: true });
  }

  // Never send an empty / "N/A" / "Unknown" value. eBay treats a filled-but-
  // meaningless aspect as answered and stops prompting the seller for the real
  // one, so an absent aspect is strictly better than a hollow one.
  return specifics.filter(s =>
    Array.isArray(s.value)
      ? s.value.filter(isMeaningfulValue).length > 0
      : isMeaningfulValue(s.value)
  ).map(s =>
    Array.isArray(s.value) ? { ...s, value: s.value.filter(isMeaningfulValue) } : s
  );
}

/**
 * eBay's recommended aspects for graded trading cards, resolved from the card.
 * Keyed by eBay's exact localized aspect name so the aspects merge in the
 * listing modal can look values up by the name eBay returns.
 *
 * Values that don't apply come back empty and are dropped by the caller.
 * "Professional Grader" is deliberately absent: it stays "Other" (DCM is not
 * on eBay's recognized-grader list, and claiming another value is a policy
 * violation).
 */
export function recommendedAspectValues(fields: ListingFields): Record<string, string> {
  return {
    // eBay expects this exact value on a 2750-condition card.
    'Card Condition': 'Graded',
    'Parallel/Variety': fields.parallel,
    'Season': fields.season,
    'Team': fields.team,
    'League': fields.league,
    'Sport': fields.sport,
    // "Signed By" names the SIGNER. On a v9.23 unverified-autograph card the
    // signer is exactly what we could not establish, so filling in the card's
    // subject would assert that the player signed it — omitted instead.
    'Signed By': fields.autograph && !fields.designation ? fields.name : '',
    'Autograph Format': fields.autograph ? fields.autographFormat : '',
    // Policy: DCM grades the card, it does not authenticate signatures.
    'Autograph Authentication': fields.autograph ? 'Not Authenticated' : '',
    'Type': fields.category === 'sports' ? 'Sports Trading Card' : 'Trading Card',
    // Original/Licensed Reprint is deliberately absent: we do not detect
    // reprints, so sending "Original" on every card asserts something we have
    // not established. Country/Region is asserted only for Japanese-language
    // cards; everything else varies by print run and we do not know it.
    'Country/Region of Manufacture': fields.countryOfManufacture,
    'Vintage': fields.vintage ? 'Yes' : '',
    'Finish': fields.finish,
    'Card Type': fields.cardType,
    'Language': fields.language,
    'Manufacturer': fields.manufacturer,
    'Set': fields.setName,
    'Card Number': fields.cardNumber,
    'Rarity': fields.rarity,
    'Year Manufactured': fields.year,
    'Character': fields.category === 'sports' ? '' : fields.name,
    'Player/Athlete': fields.category === 'sports' ? fields.name : '',
    'Insert Set': fields.subset,
    'Era': fields.vintage ? 'Vintage' : 'Modern',
  };
}

/**
 * Value to pre-fill for one of eBay's fetched aspect names, or '' when we hold
 * nothing for it. Used where the listing modal merges the Taxonomy API's
 * required + recommended list: those rows used to arrive blank for the seller
 * to type, which is how Parallel/Variety ended up empty on almost every card.
 */
export function prefillAspectValue(aspectName: string, fields: ListingFields): string {
  const table = recommendedAspectValues(fields);
  const wanted = aspectName.trim().toLowerCase();
  for (const [name, value] of Object.entries(table)) {
    if (name.toLowerCase() === wanted) return isMeaningfulValue(value) ? value : '';
  }
  return '';
}

