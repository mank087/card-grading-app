/**
 * Utility functions for eBay integration
 */

/**
 * Format card number for eBay search with # prefix
 * Examples: "9/111" -> "#9/111", "23" -> "#23", "SWSH039" -> "#SWSH039"
 */
function formatCardNumber(cardNumber: string): string {
  if (!cardNumber) return '';
  // Add # prefix for better eBay search matching
  return `#${cardNumber}`;
}

export interface CardData {
  card_name?: string;
  card_set?: string;
  featured?: string;
  release_date?: string;
  manufacturer_name?: string;
  card_number?: string;
  serial_numbering?: string;
  rookie_or_first_print?: string;
  autographed?: string;
  dcm_grade_whole?: number;
  subset?: string;
  // MTG-specific fields
  category?: string;
  expansion_code?: string;
  is_foil?: boolean;
  language?: string;
  // Lorcana-specific fields
  character_version?: string;
  is_enchanted?: boolean;
  // Other-specific fields
  manufacturer?: string;
  card_date?: string;
}

/**
 * Generate eBay search URL for Pokemon cards (simplified - card name + number only)
 */
export function generatePokemonEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Add Pokemon name (most important)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Add card number with # prefix (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  // Join terms and encode for URL
  const searchQuery = searchTerms.join(" ");

  // eBay search URL with Pokemon category
  const baseUrl = "https://www.ebay.com/sch/i.html";
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: "2536", // Pokemon Trading Card Games category
    LH_TitleDesc: "0", // Search title only
    _udlo: "1", // Minimum price $1
    _sop: "16", // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for Pokemon cards (simplified - card name + number only)
 */
export function generatePokemonEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Add Pokemon name
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Add card number with # prefix
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(" ");

  const baseUrl = "https://www.ebay.com/sch/i.html";
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: "2536", // Pokemon Trading Card Games category
    LH_Sold: "1", // Sold listings only
    LH_Complete: "1", // Completed listings
    _udlo: "1", // Minimum price $1
    _sop: "13", // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay search URL for MTG cards (simplified - card name + number only)
 * User requested: Just card name and card number, no other details
 */
export function generateMTGEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (REQUIRED - most important)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  // eBay search URL with MTG category
  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '19107', // Magic: The Gathering category
    LH_TitleDesc: '0', // Search title only
    _udlo: '1', // Minimum price $1
    _sop: '16', // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for MTG cards (simplified - card name + number only)
 * User requested: Just card name and card number, no other details
 */
export function generateMTGEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '19107', // Magic: The Gathering category
    LH_Sold: '1', // Sold listings only
    LH_Complete: '1', // Completed listings
    _udlo: '1', // Minimum price $1
    _sop: '13', // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay search URL for a specific card (Sports cards - simplified search)
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (primary identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(" ");

  const baseUrl = "https://www.ebay.com/sch/i.html";
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: "213", // Sports Trading Cards category
    LH_TitleDesc: "0", // Search title only
    _udlo: "1", // Minimum price $1
    _sop: "16", // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for pricing research (Sports cards - simplified)
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (primary identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(" ");

  const baseUrl = "https://www.ebay.com/sch/i.html";
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: "213", // Sports Trading Cards category
    LH_Sold: "1", // Sold listings only
    LH_Complete: "1", // Completed listings
    _udlo: "1", // Minimum price $1
    _sop: "13", // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay graded cards search URL (Sports cards - simplified)
 * Simplified: Card Name + Card Number + "graded" for more accurate searches
 */
export function generateEbayGradedSearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (primary identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  // 3. Add "graded" keyword for graded card search
  searchTerms.push("graded");

  const searchQuery = searchTerms.join(" ");

  const baseUrl = "https://www.ebay.com/sch/i.html";
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: "213", // Sports Trading Cards category
    LH_TitleDesc: "0", // Search title only
    _udlo: "5", // Minimum price $5 for graded cards
    _sop: "16", // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay search URL for Lorcana cards
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateLorcanaEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Character name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  // eBay search URL with Disney Lorcana category
  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '183454', // Disney Lorcana TCG category
    LH_TitleDesc: '0', // Search title only
    _udlo: '1', // Minimum price $1
    _sop: '16', // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for Lorcana cards
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateLorcanaEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Character name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '183454', // Disney Lorcana TCG category
    LH_Sold: '1', // Sold listings only
    LH_Complete: '1', // Completed listings
    _udlo: '1', // Minimum price $1
    _sop: '13', // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}


// Other category functions

/**
 * Generate eBay search URL for Other collectible cards (active listings)
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateOtherEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '0', // All categories (Other cards span multiple categories)
    LH_TitleDesc: '0', // Search title only
    _udlo: '1', // Minimum price $1
    _sop: '16', // Sort by: Best Match
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate eBay sold listings URL for Other collectible cards
 * Simplified: Card Name + Card Number only for more accurate searches
 */
export function generateOtherEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(formatCardNumber(cardData.card_number));
  }

  const searchQuery = searchTerms.join(' ');

  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams({
    _nkw: searchQuery,
    _sacat: '0', // All categories
    LH_TitleDesc: '0', // Search title only
    LH_Complete: '1', // Completed listings
    LH_Sold: '1', // Sold listings only
    _udlo: '1', // Minimum price $1
    _sop: '13', // Sort by: Price + Shipping: lowest first
  });

  return `${baseUrl}?${params.toString()}`;
}

