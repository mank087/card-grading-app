/**
 * Scryfall API Client for Magic: The Gathering card verification
 *
 * API Documentation: https://scryfall.com/docs/api
 * Rate Limit: 10 requests per second (we use 100ms delay between requests)
 */

// Scryfall card response interface
export interface ScryfallCard {
  id: string;  // Scryfall UUID
  oracle_id: string;  // Links all printings of same card
  name: string;
  lang: string;
  released_at: string;
  uri: string;
  scryfall_uri: string;
  layout: string;  // normal, transform, modal_dfc, etc.

  // Images
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };

  // For double-faced cards
  card_faces?: Array<{
    name: string;
    mana_cost: string;
    type_line: string;
    oracle_text: string;
    colors: string[];
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      png: string;
      art_crop: string;
      border_crop: string;
    };
  }>;

  // Card details
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords: string[];

  // Set info
  set: string;  // 3-letter code
  set_name: string;
  set_type: string;
  collector_number: string;
  rarity: string;  // common, uncommon, rare, mythic, special, bonus

  // Foil/Finish info
  foil: boolean;
  nonfoil: boolean;
  finishes: string[];  // nonfoil, foil, etched

  // Frame/Treatment info
  frame: string;  // 1993, 1997, 2003, 2015, future
  full_art: boolean;
  textless: boolean;
  booster: boolean;
  border_color: string;  // black, white, borderless, silver, gold
  frame_effects?: string[];  // legendary, miracle, extendedart, showcase, etc.
  promo: boolean;
  promo_types?: string[];

  // Pricing
  prices: {
    usd?: string;
    usd_foil?: string;
    usd_etched?: string;
    eur?: string;
    eur_foil?: string;
    tix?: string;
  };

  // Links
  purchase_uris?: {
    tcgplayer?: string;
    cardmarket?: string;
    cardhoarder?: string;
  };

  // Legalities
  legalities: Record<string, string>;

  // Other
  artist?: string;
  artist_ids?: string[];
  illustration_id?: string;
  digital: boolean;
  reprint: boolean;
  variation: boolean;
  games: string[];
  reserved: boolean;
  oversized: boolean;
}

export interface ScryfallSearchResponse {
  object: string;
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}

export interface ScryfallError {
  object: 'error';
  code: string;
  status: number;
  details: string;
}

// Rate limiting - Scryfall allows 10 req/sec, we use 100ms between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scryfallFetch<T>(url: string): Promise<T | null> {
  // Enforce rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DCMCardGrading/1.0'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json() as ScryfallError;
      console.error('Scryfall API error:', error);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.error('Scryfall fetch error:', error);
    return null;
  }
}

/**
 * Get card by set code and collector number (most accurate method)
 */
export async function getCardBySetAndNumber(
  setCode: string,
  collectorNumber: string,
  language?: string
): Promise<ScryfallCard | null> {
  const langParam = language && language !== 'English'
    ? `/${getLanguageCode(language)}`
    : '';
  const url = `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${collectorNumber}${langParam}`;
  return scryfallFetch<ScryfallCard>(url);
}

/**
 * Get card by Scryfall ID
 */
export async function getCardById(scryfallId: string): Promise<ScryfallCard | null> {
  const url = `https://api.scryfall.com/cards/${scryfallId}`;
  return scryfallFetch<ScryfallCard>(url);
}

/**
 * Fuzzy search by card name (handles typos and partial names)
 */
export async function searchCardByFuzzyName(
  cardName: string,
  setCode?: string
): Promise<ScryfallCard | null> {
  let url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
  if (setCode) {
    url += `&set=${setCode.toLowerCase()}`;
  }
  return scryfallFetch<ScryfallCard>(url);
}

/**
 * Exact name search
 */
export async function searchCardByExactName(
  cardName: string,
  setCode?: string
): Promise<ScryfallCard | null> {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
  if (setCode) {
    url += `&set=${setCode.toLowerCase()}`;
  }
  return scryfallFetch<ScryfallCard>(url);
}

/**
 * Advanced search with Scryfall query syntax
 */
export async function searchCards(query: string): Promise<ScryfallSearchResponse | null> {
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
  return scryfallFetch<ScryfallSearchResponse>(url);
}

/**
 * Search with multiple parameters
 */
export async function searchCardsAdvanced(params: {
  name?: string;
  set?: string;
  collector_number?: string;
  language?: string;
  is_foil?: boolean;
}): Promise<ScryfallSearchResponse | null> {
  const queryParts: string[] = [];

  if (params.name) {
    queryParts.push(`name:"${params.name}"`);
  }
  if (params.set) {
    queryParts.push(`set:${params.set.toLowerCase()}`);
  }
  if (params.collector_number) {
    queryParts.push(`cn:${params.collector_number}`);
  }
  if (params.language && params.language !== 'English') {
    queryParts.push(`lang:${getLanguageCode(params.language)}`);
  }
  if (params.is_foil !== undefined) {
    queryParts.push(params.is_foil ? 'is:foil' : '-is:foil');
  }

  if (queryParts.length === 0) {
    return null;
  }

  return searchCards(queryParts.join(' '));
}

/**
 * Get all printings of a card by oracle ID
 */
export async function getCardPrintings(oracleId: string): Promise<ScryfallSearchResponse | null> {
  return searchCards(`oracle_id:${oracleId}`);
}

/**
 * Convert language name to Scryfall language code
 */
function getLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Italian': 'it',
    'Portuguese': 'pt',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Russian': 'ru',
    'Chinese Simplified': 'zhs',
    'Chinese Traditional': 'zht',
    'Hebrew': 'he',
    'Latin': 'la',
    'Ancient Greek': 'grc',
    'Arabic': 'ar',
    'Sanskrit': 'sa',
    'Phyrexian': 'ph',
  };

  return languageMap[language] || 'en';
}

/**
 * Convert Scryfall language code to language name
 */
export function getLanguageName(code: string): string {
  const codeMap: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ru': 'Russian',
    'zhs': 'Chinese Simplified',
    'zht': 'Chinese Traditional',
    'he': 'Hebrew',
    'la': 'Latin',
    'grc': 'Ancient Greek',
    'ar': 'Arabic',
    'sa': 'Sanskrit',
    'ph': 'Phyrexian',
  };

  return codeMap[code] || 'English';
}

/**
 * Determine foil type from Scryfall data
 */
export function determineFoilType(card: ScryfallCard): string | null {
  if (!card.foil && !card.finishes?.includes('foil') && !card.finishes?.includes('etched')) {
    return null;
  }

  // Check for etched foil
  if (card.finishes?.includes('etched')) {
    return 'Etched';
  }

  // Check frame effects for special foil types
  const frameEffects = card.frame_effects || [];
  const promoTypes = card.promo_types || [];

  // Galaxy foil (Unfinity)
  if (card.set === 'unf' && frameEffects.includes('shatteredglass')) {
    return 'Galaxy';
  }

  // Surge foil (specific sets)
  if (promoTypes.includes('surgefoil')) {
    return 'Surge';
  }

  // Textured foil
  if (promoTypes.includes('texturedfoil')) {
    return 'Textured';
  }

  // Gilded foil
  if (promoTypes.includes('gilded')) {
    return 'Gilded';
  }

  // Confetti foil (Secret Lair, etc.)
  if (promoTypes.includes('confettifoil')) {
    return 'Confetti';
  }

  // Default traditional foil
  if (card.foil || card.finishes?.includes('foil')) {
    return 'Traditional';
  }

  return null;
}

/**
 * Check if card is double-faced
 */
export function isDoubleFaced(card: ScryfallCard): boolean {
  const doubleFacedLayouts = [
    'transform',
    'modal_dfc',
    'double_faced_token',
    'reversible_card',
    'art_series'
  ];
  return doubleFacedLayouts.includes(card.layout);
}

/**
 * Extract MTG metadata from Scryfall card for storage
 */
export function extractMTGMetadata(card: ScryfallCard): {
  mtg_api_id: string;
  mtg_oracle_id: string;
  mtg_mana_cost: string | null;
  mtg_type_line: string;
  mtg_colors: string[];
  mtg_rarity: string;
  mtg_set_code: string;
  card_language: string;
  is_foil: boolean;
  foil_type: string | null;
  is_double_faced: boolean;
  scryfall_price_usd: number | null;
  scryfall_price_usd_foil: number | null;
  scryfall_price_eur: number | null;
} {
  return {
    mtg_api_id: card.id,
    mtg_oracle_id: card.oracle_id,
    mtg_mana_cost: card.mana_cost || (card.card_faces?.[0]?.mana_cost) || null,
    mtg_type_line: card.type_line,
    mtg_colors: card.colors || card.card_faces?.[0]?.colors || [],
    mtg_rarity: card.rarity,
    mtg_set_code: card.set.toUpperCase(),
    card_language: getLanguageName(card.lang),
    is_foil: card.foil || card.finishes?.includes('foil') || card.finishes?.includes('etched') || false,
    foil_type: determineFoilType(card),
    is_double_faced: isDoubleFaced(card),
    scryfall_price_usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
    scryfall_price_usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    scryfall_price_eur: card.prices.eur ? parseFloat(card.prices.eur) : null,
  };
}

/**
 * Map common set names to Scryfall set codes
 */
export const SET_NAME_TO_CODE: Record<string, string> = {
  // Recent Standard sets
  'Murders at Karlov Manor': 'mkm',
  'Karlov Manor': 'mkm',
  'Lost Caverns of Ixalan': 'lci',
  'Ixalan': 'lci',
  'Wilds of Eldraine': 'woe',
  'Eldraine': 'woe',
  'Lord of the Rings': 'ltr',
  'LOTR': 'ltr',
  'March of the Machine': 'mom',
  'March of the Machine: The Aftermath': 'mat',
  'Phyrexia: All Will Be One': 'one',
  'All Will Be One': 'one',
  'Dominaria United': 'dmu',
  'Streets of New Capenna': 'snc',
  'New Capenna': 'snc',
  'Kamigawa: Neon Dynasty': 'neo',
  'Neon Dynasty': 'neo',
  'Innistrad: Crimson Vow': 'vow',
  'Crimson Vow': 'vow',
  'Innistrad: Midnight Hunt': 'mid',
  'Midnight Hunt': 'mid',

  // Modern Horizons
  'Modern Horizons 3': 'mh3',
  'Modern Horizons 2': 'mh2',
  'Modern Horizons': 'mh1',

  // Masters sets
  'Double Masters 2022': '2x2',
  'Double Masters': '2xm',
  'Ultimate Masters': 'uma',
  'Masters 25': 'a25',
  'Iconic Masters': 'ima',
  'Modern Masters 2017': 'mm3',
  'Modern Masters 2015': 'mm2',
  'Modern Masters': 'mma',

  // Commander sets
  'Commander Masters': 'cmm',
  'Commander Legends: Battle for Baldurs Gate': 'clb',
  'Commander Legends': 'cmr',

  // Vintage/Legacy sets
  'Alpha': 'lea',
  'Limited Edition Alpha': 'lea',
  'Beta': 'leb',
  'Limited Edition Beta': 'leb',
  'Unlimited': '2ed',
  'Unlimited Edition': '2ed',
  'Revised': '3ed',
  'Revised Edition': '3ed',
  'Fourth Edition': '4ed',
  '4th Edition': '4ed',
  'Fifth Edition': '5ed',
  '5th Edition': '5ed',
  'Sixth Edition': '6ed',
  '6th Edition': '6ed',
  'Seventh Edition': '7ed',
  '7th Edition': '7ed',
  'Eighth Edition': '8ed',
  '8th Edition': '8ed',
  'Ninth Edition': '9ed',
  '9th Edition': '9ed',
  'Tenth Edition': '10e',
  '10th Edition': '10e',

  // Arabian Nights through Alliances
  'Arabian Nights': 'arn',
  'Antiquities': 'atq',
  'Legends': 'leg',
  'The Dark': 'drk',
  'Fallen Empires': 'fem',
  'Ice Age': 'ice',
  'Homelands': 'hml',
  'Alliances': 'all',

  // Mirage block
  'Mirage': 'mir',
  'Visions': 'vis',
  'Weatherlight': 'wth',

  // Tempest block
  'Tempest': 'tmp',
  'Stronghold': 'sth',
  'Exodus': 'exo',

  // Urza block
  'Urzas Saga': 'usg',
  "Urza's Saga": 'usg',
  'Urzas Legacy': 'ulg',
  "Urza's Legacy": 'ulg',
  'Urzas Destiny': 'uds',
  "Urza's Destiny": 'uds',

  // Masques block
  'Mercadian Masques': 'mmq',
  'Nemesis': 'nem',
  'Prophecy': 'pcy',

  // Invasion block
  'Invasion': 'inv',
  'Planeshift': 'pls',
  'Apocalypse': 'apc',

  // Odyssey block
  'Odyssey': 'ody',
  'Torment': 'tor',
  'Judgment': 'jud',

  // Onslaught block
  'Onslaught': 'ons',
  'Legions': 'lgn',
  'Scourge': 'scg',

  // Mirrodin block
  'Mirrodin': 'mrd',
  'Darksteel': 'dst',
  'Fifth Dawn': '5dn',

  // Kamigawa block
  'Champions of Kamigawa': 'chk',
  'Betrayers of Kamigawa': 'bok',
  'Saviors of Kamigawa': 'sok',

  // Ravnica block (original)
  'Ravnica: City of Guilds': 'rav',
  'Ravnica': 'rav',
  'Guildpact': 'gpt',
  'Dissension': 'dis',

  // Time Spiral block
  'Time Spiral': 'tsp',
  'Planar Chaos': 'plc',
  'Future Sight': 'fut',

  // Lorwyn block
  'Lorwyn': 'lrw',
  'Morningtide': 'mor',
  'Shadowmoor': 'shm',
  'Eventide': 'eve',

  // Shards of Alara block
  'Shards of Alara': 'ala',
  'Conflux': 'con',
  'Alara Reborn': 'arb',

  // Zendikar block (original)
  'Zendikar': 'zen',
  'Worldwake': 'wwk',
  'Rise of the Eldrazi': 'roe',

  // Scars of Mirrodin block
  'Scars of Mirrodin': 'som',
  'Mirrodin Besieged': 'mbs',
  'New Phyrexia': 'nph',

  // Innistrad block (original)
  'Innistrad': 'isd',
  'Dark Ascension': 'dka',
  'Avacyn Restored': 'avr',

  // Return to Ravnica block
  'Return to Ravnica': 'rtr',
  'Gatecrash': 'gtc',
  'Dragons Maze': 'dgm',
  "Dragon's Maze": 'dgm',

  // Theros block
  'Theros': 'ths',
  'Born of the Gods': 'bng',
  'Journey into Nyx': 'jou',

  // Khans block
  'Khans of Tarkir': 'ktk',
  'Fate Reforged': 'frf',
  'Dragons of Tarkir': 'dtk',

  // Battle for Zendikar block
  'Battle for Zendikar': 'bfz',
  'Oath of the Gatewatch': 'ogw',

  // Shadows over Innistrad block
  'Shadows over Innistrad': 'soi',
  'Eldritch Moon': 'emn',

  // Kaladesh block
  'Kaladesh': 'kld',
  'Aether Revolt': 'aer',

  // Amonkhet block
  'Amonkhet': 'akh',
  'Hour of Devastation': 'hou',

  // Ixalan block
  'Ixalan (2017)': 'xln',
  'Rivals of Ixalan': 'rix',

  // Dominaria and after
  'Dominaria': 'dom',
  'Core Set 2019': 'm19',
  'M19': 'm19',
  'Core Set 2020': 'm20',
  'M20': 'm20',
  'Core Set 2021': 'm21',
  'M21': 'm21',
  'Guilds of Ravnica': 'grn',
  'Ravnica Allegiance': 'rna',
  'War of the Spark': 'war',
  'Throne of Eldraine': 'eld',
  'Theros Beyond Death': 'thb',
  'Ikoria: Lair of Behemoths': 'iko',
  'Ikoria': 'iko',
  'Zendikar Rising': 'znr',
  'Kaldheim': 'khm',
  'Strixhaven': 'stx',
  'Strixhaven: School of Mages': 'stx',
  'Adventures in the Forgotten Realms': 'afr',
  'Forgotten Realms': 'afr',

  // Secret Lair
  'Secret Lair': 'sld',
  'Secret Lair Drop': 'sld',

  // Outlaws of Thunder Junction
  'Outlaws of Thunder Junction': 'otj',
  'Thunder Junction': 'otj',

  // Bloomburrow
  'Bloomburrow': 'blb',

  // Duskmourn
  'Duskmourn: House of Horror': 'dsk',
  'Duskmourn': 'dsk',

  // Foundations
  'Foundations': 'fdn',
};

/**
 * Try to extract set code from set name
 */
export function getSetCodeFromName(setName: string): string | null {
  // Direct lookup
  if (SET_NAME_TO_CODE[setName]) {
    return SET_NAME_TO_CODE[setName];
  }

  // Try case-insensitive lookup
  const lowerSetName = setName.toLowerCase();
  for (const [name, code] of Object.entries(SET_NAME_TO_CODE)) {
    if (name.toLowerCase() === lowerSetName) {
      return code;
    }
  }

  // Try partial match
  for (const [name, code] of Object.entries(SET_NAME_TO_CODE)) {
    if (name.toLowerCase().includes(lowerSetName) || lowerSetName.includes(name.toLowerCase())) {
      return code;
    }
  }

  // If it's already a 3-letter code, return it
  if (/^[a-zA-Z0-9]{3,4}$/.test(setName)) {
    return setName.toLowerCase();
  }

  return null;
}
