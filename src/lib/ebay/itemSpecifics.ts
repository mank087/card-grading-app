/**
 * eBay Item Specifics Mapping
 *
 * Maps DCM card data to eBay item specifics based on card type.
 */

import { EBAY_CATEGORIES, DCM_TO_EBAY_CATEGORY } from './constants';

export interface ItemSpecific {
  name: string;
  value: string | string[];
  required?: boolean;
  editable?: boolean;
}

/**
 * Get eBay category ID for a card type
 */
export function getCategoryForCardType(cardType: string): string {
  const typeMap: Record<string, string> = {
    'pokemon': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
    'mtg': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
    'lorcana': EBAY_CATEGORIES.CCG_INDIVIDUAL_CARDS,
    'sports': EBAY_CATEGORIES.SPORTS_TRADING_CARDS,
    'other': EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS,
  };

  return typeMap[cardType.toLowerCase()] || EBAY_CATEGORIES.NON_SPORT_TRADING_CARDS;
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
    value: 'English',
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

  // Sport (required)
  const sport = detectSport(card.category || cardInfo.category);
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
    value: 'English',
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
    value: 'English',
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
  if (card.serial_numbering) features.push('Serial Numbered');

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
    value: 'English',
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
 * Main function to map any card to item specifics based on card type
 */
export function mapCardToItemSpecifics(card: any, cardType: string): ItemSpecific[] {
  let specifics: ItemSpecific[];

  switch (cardType.toLowerCase()) {
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
    case 'other':
    default:
      specifics = mapOtherCardToSpecifics(card);
      break;
  }

  // Add DCM Certification Number (the DCM serial) as an item specific
  // This supplements the condition descriptor 27503 for additional visibility
  if (card.serial) {
    specifics.push({
      name: 'Certification Number',
      value: card.serial,
      required: false,
      editable: true,
    });
  }

  return specifics;
}

// Helper functions

/**
 * Get serial numbering from card data (e.g., "12/99", "/25", "1/1")
 */
export function getSerialNumbering(card: any): string | null {
  const cardInfo = card.conversational_card_info || {};

  // Check various sources for serial numbering
  const serialNum = cardInfo.serial_number ||
                    cardInfo.serial_number_fraction ||
                    card.serial_numbering ||
                    null;

  if (!serialNum) return null;

  // Clean up the value
  const cleaned = String(serialNum).trim();
  if (!cleaned || cleaned.toLowerCase() === 'none' || cleaned.toLowerCase() === 'n/a') {
    return null;
  }

  return cleaned;
}

/**
 * Extract the denominator from a serial number (e.g., "12/99" -> "/99", "/25" -> "/25")
 * Returns the format "/X" for use in titles
 */
export function getSerialDenominator(serialNumber: string | null): string | null {
  if (!serialNumber) return null;

  // Match patterns like "12/99", "/99", "1/1", etc.
  const match = serialNumber.match(/\/(\d+)/);
  if (match) {
    return `/${match[1]}`;
  }

  return null;
}

/**
 * Check if card has an autograph based on all possible data sources
 */
function hasAutograph(card: any): boolean {
  const cardInfo = card.conversational_card_info || {};

  // Check conversational_card_info.autographed (can be true, 'Yes', 'yes', etc.)
  if (cardInfo.autographed === true ||
      cardInfo.autographed === 'Yes' ||
      cardInfo.autographed === 'yes' ||
      cardInfo.autographed === 'true') {
    return true;
  }

  // Check card.autographed boolean
  if (card.autographed === true) {
    return true;
  }

  // Check card.autograph_type (should be something other than 'none', 'false', null, undefined)
  if (card.autograph_type &&
      card.autograph_type !== 'none' &&
      card.autograph_type !== 'false' &&
      card.autograph_type !== 'None' &&
      card.autograph_type !== 'N/A') {
    return true;
  }

  return false;
}

function extractYear(dateString: string): string {
  if (!dateString) return '';

  // Try to extract 4-digit year
  const yearMatch = dateString.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];

  // If it looks like just a year already
  if (/^\d{4}$/.test(dateString.trim())) return dateString.trim();

  return dateString;
}

function detectSport(category: string): string {
  if (!category) return 'Baseball'; // Default

  const lowerCategory = category.toLowerCase();

  if (lowerCategory.includes('baseball')) return 'Baseball';
  if (lowerCategory.includes('football')) return 'Football';
  if (lowerCategory.includes('basketball')) return 'Basketball';
  if (lowerCategory.includes('hockey')) return 'Hockey';
  if (lowerCategory.includes('soccer')) return 'Soccer';
  if (lowerCategory.includes('wrestling')) return 'Wrestling';
  if (lowerCategory.includes('golf')) return 'Golf';
  if (lowerCategory.includes('tennis')) return 'Tennis';
  if (lowerCategory.includes('racing') || lowerCategory.includes('nascar')) return 'Racing';
  if (lowerCategory.includes('boxing') || lowerCategory.includes('ufc') || lowerCategory.includes('mma')) return 'Boxing';

  return 'Multi-Sport';
}

function detectLeague(sport: string): string | null {
  const leagueMap: Record<string, string> = {
    'Baseball': 'MLB',
    'Football': 'NFL',
    'Basketball': 'NBA',
    'Hockey': 'NHL',
    'Soccer': 'MLS',
  };

  return leagueMap[sport] || null;
}
