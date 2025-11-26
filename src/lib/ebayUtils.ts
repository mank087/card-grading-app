/**
 * Utility functions for eBay integration
 */

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

  // 2. Add card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
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

  // 2. Add card number
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
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
 * Generate eBay search URL for MTG cards (optimized for Magic: The Gathering)
 * Priority: Card Name + Set Name > Foil > Variant > Collector Number
 */
export function generateMTGEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (REQUIRED - most important)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Set name (CRITICAL for MTG pricing)
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 3. Foil indicator (IMPORTANT - huge price difference)
  if (cardData.is_foil) {
    searchTerms.push('foil');
  } else {
    // Explicitly add "non-foil" or "nonfoil" to exclude foil results
    searchTerms.push('nonfoil');
  }

  // 4. Special variant/treatment (Borderless, Extended Art, Showcase, etc.)
  if (cardData.subset && !cardData.subset.toLowerCase().includes('null')) {
    searchTerms.push(cardData.subset);
  }

  // 5. Collector number (helps narrow results)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 6. Language (if non-English)
  if (cardData.language && cardData.language !== 'English') {
    searchTerms.push(cardData.language);
  }

  // 7. Add condition hint based on grade
  if (cardData.dcm_grade_whole) {
    if (cardData.dcm_grade_whole >= 9) {
      searchTerms.push('NM'); // Near Mint
    } else if (cardData.dcm_grade_whole >= 7) {
      searchTerms.push('LP'); // Lightly Played
    }
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
 * Generate eBay sold listings URL for MTG cards
 * Shows completed sales for pricing reference
 */
export function generateMTGEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Set name
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 3. Foil indicator
  if (cardData.is_foil) {
    searchTerms.push('foil');
  } else {
    searchTerms.push('nonfoil');
  }

  // 4. Special variant
  if (cardData.subset && !cardData.subset.toLowerCase().includes('null')) {
    searchTerms.push(cardData.subset);
  }

  // 5. Collector number
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 6. Language (if non-English)
  if (cardData.language && cardData.language !== 'English') {
    searchTerms.push(cardData.language);
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
 * Order: Player Name + Card Number + Set Name + Special Features (auto, RC, /99, etc.)
 */
export function generateEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (most important identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 3. Set name
  if (cardData.card_set) {
    searchTerms.push(cardData.card_set);
  }

  // 4. Special features (only add if applicable)

  // Autograph - add "auto" keyword
  if (cardData.autographed === "Yes" || cardData.autographed === "true" || cardData.autographed === true) {
    searchTerms.push("auto");
  }

  // Rookie card - add "RC" keyword
  if (cardData.rookie_or_first_print === "Yes" || cardData.rookie_or_first_print === "true" || cardData.rookie_or_first_print === true) {
    searchTerms.push("RC");
  }

  // Serial numbered - add the /XX format (e.g., "/99")
  if (cardData.serial_numbering &&
      cardData.serial_numbering !== "N/A" &&
      !cardData.serial_numbering.toLowerCase().includes('not present') &&
      !cardData.serial_numbering.toLowerCase().includes('none')) {
    const numberMatch = cardData.serial_numbering.match(/\/(\d+)/);
    if (numberMatch) {
      searchTerms.push(`/${numberMatch[1]}`);
    }
  }

  // 5. Subset/parallel (only if it adds useful info not in set name)
  if (cardData.subset &&
      cardData.subset !== cardData.card_name &&
      cardData.subset !== cardData.card_set &&
      !cardData.card_set?.toLowerCase().includes(cardData.subset.toLowerCase())) {
    searchTerms.push(cardData.subset);
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
 * Order: Player Name + Card Number + Set Name + Special Features (auto, RC, /99, etc.)
 */
export function generateEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (most important identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 3. Set name
  if (cardData.card_set) {
    searchTerms.push(cardData.card_set);
  }

  // 4. Special features (only add if applicable)

  // Autograph - add "auto" keyword
  if (cardData.autographed === "Yes" || cardData.autographed === "true" || cardData.autographed === true) {
    searchTerms.push("auto");
  }

  // Rookie card - add "RC" keyword
  if (cardData.rookie_or_first_print === "Yes" || cardData.rookie_or_first_print === "true" || cardData.rookie_or_first_print === true) {
    searchTerms.push("RC");
  }

  // Serial numbered - add the /XX format (e.g., "/99")
  if (cardData.serial_numbering &&
      cardData.serial_numbering !== "N/A" &&
      !cardData.serial_numbering.toLowerCase().includes('not present') &&
      !cardData.serial_numbering.toLowerCase().includes('none')) {
    const numberMatch = cardData.serial_numbering.match(/\/(\d+)/);
    if (numberMatch) {
      searchTerms.push(`/${numberMatch[1]}`);
    }
  }

  // 5. Subset/parallel (only if it adds useful info not in set name)
  if (cardData.subset &&
      cardData.subset !== cardData.card_name &&
      cardData.subset !== cardData.card_set &&
      !cardData.card_set?.toLowerCase().includes(cardData.subset.toLowerCase())) {
    searchTerms.push(cardData.subset);
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
 * Order: Player Name + Card Number + Set Name + Special Features + "graded"
 */
export function generateEbayGradedSearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Player/Character name (most important identifier)
  if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Card number (for precise identification)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 3. Set name
  if (cardData.card_set) {
    searchTerms.push(cardData.card_set);
  }

  // 4. Special features (only add if applicable)

  // Autograph - add "auto" keyword
  if (cardData.autographed === "Yes" || cardData.autographed === "true" || cardData.autographed === true) {
    searchTerms.push("auto");
  }

  // Rookie card - add "RC" keyword
  if (cardData.rookie_or_first_print === "Yes" || cardData.rookie_or_first_print === "true" || cardData.rookie_or_first_print === true) {
    searchTerms.push("RC");
  }

  // Serial numbered - add the /XX format (e.g., "/99")
  if (cardData.serial_numbering &&
      cardData.serial_numbering !== "N/A" &&
      !cardData.serial_numbering.toLowerCase().includes('not present') &&
      !cardData.serial_numbering.toLowerCase().includes('none')) {
    const numberMatch = cardData.serial_numbering.match(/\/(\d+)/);
    if (numberMatch) {
      searchTerms.push(`/${numberMatch[1]}`);
    }
  }

  // 5. Add "graded" keyword for graded card search
  searchTerms.push("graded");

  // 6. Add specific grade if high grade (PSA 9, PSA 10, etc.)
  if (cardData.dcm_grade_whole && cardData.dcm_grade_whole >= 9) {
    searchTerms.push(`${cardData.dcm_grade_whole}`);
  }

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
 * Priority: Character Name + Character Version > Set Name > Enchanted/Foil > Card Number
 */
export function generateLorcanaEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Character name (REQUIRED - most important)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Character version (CRITICAL - same character has many versions)
  if (cardData.character_version) {
    searchTerms.push(cardData.character_version);
  }

  // 3. Set name
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 4. Card number (helps narrow results)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 5. Variant indicator (IMPORTANT - huge price difference)
  if (cardData.is_enchanted) {
    searchTerms.push('Enchanted');
  } else if (cardData.is_foil) {
    searchTerms.push('Foil');
  }

  // 6. Add condition hint based on grade
  if (cardData.dcm_grade_whole) {
    if (cardData.dcm_grade_whole >= 9) {
      searchTerms.push('NM'); // Near Mint
    }
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
 * Shows completed sales for pricing reference
 */
export function generateLorcanaEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Character name
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  } else if (cardData.featured) {
    searchTerms.push(cardData.featured);
  }

  // 2. Character version
  if (cardData.character_version) {
    searchTerms.push(cardData.character_version);
  }

  // 3. Set name
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 4. Card number
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 5. Variant indicator
  if (cardData.is_enchanted) {
    searchTerms.push('Enchanted');
  } else if (cardData.is_foil) {
    searchTerms.push('Foil');
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
 */
export function generateOtherEbaySearchUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  }

  // 2. Manufacturer (important for Other cards)
  if (cardData.manufacturer) {
    searchTerms.push(cardData.manufacturer);
  }

  // 3. Set name (if applicable)
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 4. Date (helps narrow results)
  if (cardData.card_date) {
    searchTerms.push(cardData.card_date);
  }

  // 5. Card number (if available)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 🆕 PRIORITY CALLOUTS - Add special attributes prominently
  const callouts: string[] = [];

  // Autograph callout (high value indicator) - ONLY if explicitly Yes/true
  if ((cardData.autographed === "Yes" || cardData.autographed === "true" || cardData.autographed === true) &&
      cardData.autographed !== "No" && cardData.autographed !== false && cardData.autographed !== "false" && cardData.autographed !== "N/A") {
    callouts.push("auto");
    callouts.push("autograph");
  }

  // Serial numbered callout (rarity indicator)
  if (cardData.serial_numbering &&
      cardData.serial_numbering !== "N/A" &&
      !cardData.serial_numbering.toLowerCase().includes('not present') &&
      !cardData.serial_numbering.toLowerCase().includes('none')) {
    callouts.push("numbered");
    const numberMatch = cardData.serial_numbering.match(/\/(\d+)/);
    if (numberMatch) {
      callouts.push(`/${numberMatch[1]}`);
    }
  }

  // 6. Grade-based condition indicator
  if (cardData.dcm_grade_whole && cardData.dcm_grade_whole >= 9) {
    searchTerms.push('NM'); // Near Mint condition
  }

  // Combine all terms: callouts first for prominence, then card details
  const allTerms = [...callouts, ...searchTerms];
  const searchQuery = allTerms.join(' ');

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
 */
export function generateOtherEbaySoldListingsUrl(cardData: CardData): string {
  const searchTerms: string[] = [];

  // 1. Card name (primary identifier)
  if (cardData.card_name) {
    searchTerms.push(cardData.card_name);
  }

  // 2. Manufacturer (important for Other cards)
  if (cardData.manufacturer) {
    searchTerms.push(cardData.manufacturer);
  }

  // 3. Set name (if applicable)
  if (cardData.card_set && cardData.card_set !== 'Unknown') {
    searchTerms.push(cardData.card_set);
  }

  // 4. Date (helps narrow results)
  if (cardData.card_date) {
    searchTerms.push(cardData.card_date);
  }

  // 5. Card number (if available)
  if (cardData.card_number) {
    searchTerms.push(cardData.card_number);
  }

  // 🆕 PRIORITY CALLOUTS - Add special attributes prominently
  const callouts: string[] = [];

  // Autograph callout (high value indicator) - ONLY if explicitly Yes/true
  if ((cardData.autographed === "Yes" || cardData.autographed === "true" || cardData.autographed === true) &&
      cardData.autographed !== "No" && cardData.autographed !== false && cardData.autographed !== "false" && cardData.autographed !== "N/A") {
    callouts.push("auto");
    callouts.push("autograph");
  }

  // Serial numbered callout (rarity indicator)
  if (cardData.serial_numbering &&
      cardData.serial_numbering !== "N/A" &&
      !cardData.serial_numbering.toLowerCase().includes('not present') &&
      !cardData.serial_numbering.toLowerCase().includes('none')) {
    callouts.push("numbered");
    const numberMatch = cardData.serial_numbering.match(/\/(\d+)/);
    if (numberMatch) {
      callouts.push(`/${numberMatch[1]}`);
    }
  }

  // Combine all terms: callouts first for prominence, then card details
  const allTerms = [...callouts, ...searchTerms];
  const searchQuery = allTerms.join(' ');

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

