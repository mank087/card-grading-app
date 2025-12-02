/**
 * Utility functions for TCGPlayer integration (Pokemon & MTG)
 */

import { CardData } from './ebayUtils';

// Extended CardData type to include MTG and Lorcana-specific fields
export interface MTGCardData extends CardData {
  category?: string;
  expansion_code?: string;
  is_foil?: boolean;
  // Lorcana-specific fields
  character_version?: string;
  is_enchanted?: boolean;
}

/**
 * Format set name for TCGPlayer URL slug
 * Converts set names to TCGPlayer-friendly URL format
 * Examples:
 * - "Base Set" → "base-set"
 * - "Sword & Shield" → "swsh-promos" (for promos)
 * - "Scarlet & Violet" → "sv-promos" (for promos)
 * - "Sun & Moon" → "sun-and-moon"
 */
function formatSetNameForTCGPlayer(setName: string, cardNumber?: string): string {
  if (!setName || setName === 'Unknown') return '';

  const setLower = setName.toLowerCase();

  // 🎯 Handle promo cards specially - TCGPlayer uses specific promo set names
  if (cardNumber) {
    const numberUpper = cardNumber.toUpperCase();

    // Scarlet & Violet Promos (SVP, SV)
    if ((setLower.includes('scarlet') && setLower.includes('violet')) ||
        numberUpper.startsWith('SVP') || numberUpper.startsWith('SV')) {
      return 'sv-promos';
    }

    // Sword & Shield Promos (SWSH)
    if ((setLower.includes('sword') && setLower.includes('shield')) ||
        numberUpper.startsWith('SWSH')) {
      return 'swsh-promos';
    }

    // Sun & Moon Promos (SM)
    if ((setLower.includes('sun') && setLower.includes('moon')) ||
        numberUpper.startsWith('SM-') || (numberUpper.startsWith('SM') && numberUpper.length <= 5)) {
      return 'sm-promos';
    }

    // XY Promos
    if (setLower.includes('xy') || numberUpper.startsWith('XY')) {
      return 'xy-promos';
    }

    // Black & White Promos (BW)
    if ((setLower.includes('black') && setLower.includes('white')) ||
        numberUpper.startsWith('BW')) {
      return 'bw-promos';
    }
  }

  // Standard set name formatting
  return setName
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate TCGPlayer search URL for Pokemon and MTG cards
 * Automatically detects card category and routes appropriately
 */
export function generateTCGPlayerSearchUrl(cardData: MTGCardData): string {
  const searchTerms: string[] = [];

  // Detect if this is an MTG card
  if (cardData.category === 'MTG') {
    // MTG-specific search (simplified - card name + number only)
    // User requested: Just card name and card number, no other details

    // 1. Card name (REQUIRED - most important)
    if (cardData.card_name) {
      searchTerms.push(cardData.card_name);
    } else if (cardData.featured) {
      searchTerms.push(cardData.featured);
    }

    // 2. Card number (for precise identification)
    if (cardData.card_number) {
      searchTerms.push(cardData.card_number);
    }

    const searchQuery = searchTerms.join(' ');

    // TCGPlayer URL structure for MTG
    const baseUrl = 'https://www.tcgplayer.com/search/magic/product';
    const params = new URLSearchParams({
      productLineName: 'magic',
      q: searchQuery,
      view: 'grid',
      productTypeName: 'Cards'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Lorcana-specific search
  if (cardData.category === 'Lorcana') {
    // Lorcana-specific search - optimized for Disney Lorcana TCG
    // Priority: Card Name > Card Number only

    // 1. Card name (REQUIRED - most important)
    if (cardData.card_name) {
      searchTerms.push(cardData.card_name);
    } else if (cardData.featured) {
      searchTerms.push(cardData.featured);
    }

    // 2. Card number
    if (cardData.card_number) {
      searchTerms.push(cardData.card_number);
    }

    const searchQuery = searchTerms.join(' ');

    // TCGPlayer URL structure for Lorcana
    const baseUrl = 'https://www.tcgplayer.com/search/lorcana/product';
    const params = new URLSearchParams({
      productLineName: 'lorcana',
      q: searchQuery,
      view: 'grid',
      productTypeName: 'Cards'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Pokemon-specific search (default)
  // 1. Pokemon name (most important)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  // TCGPlayer works better without set name in general search
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 3. Add rarity/variant if available (Full Art, Rainbow Rare, etc.)
  // This helps narrow down to the specific version
  if (cardData.subset) {
    // Common Pokemon variants that TCGPlayer recognizes
    const variantKeywords = ['full art', 'rainbow', 'secret', 'ultra rare', 'reverse holo', 'holo', 'vmax', 'vstar', 'v', 'gx', 'ex'];
    const subsetLower = cardData.subset.toLowerCase();

    // Only add if it contains a recognized variant keyword
    if (variantKeywords.some(keyword => subsetLower.includes(keyword))) {
      searchTerms.push(cardData.subset);
    }
  }

  // Build search query (simpler is better for TCGPlayer)
  const searchQuery = searchTerms.join(' ');

  // TCGPlayer URL structure for Pokemon
  const baseUrl = 'https://www.tcgplayer.com/search/pokemon/product';
  const params = new URLSearchParams({
    productLineName: 'pokemon',
    q: searchQuery,
    view: 'grid',
    productTypeName: 'Cards'
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate set-specific TCGPlayer search (if set is known)
 * Returns null if set name is not available or is "Unknown"
 * Note: This is more accurate when we have the correct set name
 * Supports both Pokemon and MTG cards
 */
export function generateTCGPlayerSetSearchUrl(cardData: MTGCardData): string | null {
  if (!cardData.card_set || cardData.card_set === 'Unknown') {
    return null;
  }

  // MTG cards (simplified - card name + number only)
  if (cardData.category === 'MTG') {
    const searchTerms: string[] = [];

    // 1. Card name (REQUIRED)
    if (cardData.card_name) {
      searchTerms.push(cardData.card_name);
    } else if (cardData.featured) {
      searchTerms.push(cardData.featured);
    }

    // 2. Card number (for precise identification)
    if (cardData.card_number) {
      searchTerms.push(cardData.card_number);
    }

    const searchQuery = searchTerms.join(' ');

    // MTG search - simplified
    const baseUrl = 'https://www.tcgplayer.com/search/magic/product';
    const params = new URLSearchParams({
      productLineName: 'magic',
      q: searchQuery,
      view: 'grid',
      productTypeName: 'Cards'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Lorcana set-specific search
  if (cardData.category === 'Lorcana') {
    const searchTerms: string[] = [];

    // 1. Card name (REQUIRED)
    if (cardData.card_name) {
      searchTerms.push(cardData.card_name);
    } else if (cardData.featured) {
      searchTerms.push(cardData.featured);
    }

    // 2. Card number
    if (cardData.card_number) {
      searchTerms.push(cardData.card_number);
    }

    const searchQuery = searchTerms.join(' ');

    // Lorcana search - simplified to just card name and number
    const baseUrl = 'https://www.tcgplayer.com/search/lorcana/product';
    const params = new URLSearchParams({
      productLineName: 'lorcana',
      q: searchQuery,
      view: 'grid',
      productTypeName: 'Cards'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Pokemon set-specific search
  // Pass card number to help detect promo sets
  const setSlug = formatSetNameForTCGPlayer(cardData.card_set, cardData.card_number);
  if (!setSlug) return null;

  const searchTerms: string[] = [];

  // Pokemon name (most important)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // Card number for precision
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // Add rarity/variant only if it's a recognized type
  if (cardData.subset) {
    const variantKeywords = ['full art', 'rainbow', 'secret', 'ultra rare', 'reverse holo', 'holo', 'vmax', 'vstar', 'v', 'gx', 'ex'];
    const subsetLower = cardData.subset.toLowerCase();

    if (variantKeywords.some(keyword => subsetLower.includes(keyword))) {
      searchTerms.push(cardData.subset);
    }
  }

  const searchQuery = searchTerms.join(' ');

  // Try set-specific URL first (more accurate if set is correct)
  const baseUrl = `https://www.tcgplayer.com/search/pokemon/${setSlug}`;
  const params = new URLSearchParams({
    q: searchQuery,
    view: 'grid'
  });

  return `${baseUrl}?${params.toString()}`;
}
