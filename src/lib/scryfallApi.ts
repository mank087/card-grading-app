/**
 * Scryfall API Integration for MTG Card Lookup
 * API Documentation: https://scryfall.com/docs/api
 */

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity?: string[];
  artist?: string;
  released_at: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
}

interface ScryfallLookupResult {
  success: boolean;
  set_name?: string;
  set_code?: string;
  collector_number?: string;
  rarity?: string;
  scryfall_id?: string;
  artist?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power_toughness?: string;
  color_identity?: string;
  error?: string;
}

/**
 * Look up MTG card by collector number, name, or set code
 */
export async function lookupMTGCard(
  collectorNumber?: string,
  cardName?: string,
  setCode?: string
): Promise<ScryfallLookupResult> {
  try {
    console.log('[Scryfall API] Looking up card:', { collectorNumber, cardName, setCode });

    let searchUrl = 'https://api.scryfall.com/cards/search?q=';

    // Build search query
    const queryParts: string[] = [];
    if (cardName) queryParts.push(`!"${cardName}"`);
    if (collectorNumber) queryParts.push(`number:${collectorNumber}`);
    if (setCode) queryParts.push(`set:${setCode}`);

    if (queryParts.length === 0) {
      return { success: false, error: 'No search parameters provided' };
    }

    searchUrl += queryParts.join(' ');

    // Respect Scryfall rate limit (100ms between requests)
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DCM-Grading-App/1.0'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Card not found in Scryfall database' };
      }
      throw new Error(`Scryfall API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { success: false, error: 'No matching cards found' };
    }

    // Take first result (most relevant)
    const card: ScryfallCard = data.data[0];

    // Format power/toughness
    let powerToughness = null;
    if (card.power && card.toughness) {
      powerToughness = `${card.power}/${card.toughness}`;
    }

    // Format color identity
    let colorIdentity = null;
    if (card.color_identity && card.color_identity.length > 0) {
      colorIdentity = card.color_identity.join('');
    }

    console.log('[Scryfall API] ✅ Card found:', card.name);

    return {
      success: true,
      set_name: card.set_name,
      set_code: card.set.toUpperCase(),
      collector_number: card.collector_number,
      rarity: formatRarity(card.rarity),
      scryfall_id: card.id,
      artist: card.artist,
      mana_cost: card.mana_cost,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      power_toughness: powerToughness,
      color_identity: colorIdentity
    };

  } catch (error: any) {
    console.error('[Scryfall API] Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format rarity from Scryfall format to display format
 */
function formatRarity(rarity: string): string {
  const rarityMap: {[key: string]: string} = {
    'common': 'Common',
    'uncommon': 'Uncommon',
    'rare': 'Rare',
    'mythic': 'Mythic Rare',
    'special': 'Special',
    'bonus': 'Bonus'
  };

  return rarityMap[rarity] || rarity;
}

/**
 * Get card image from Scryfall
 */
export async function getScryfallImage(scryfallId: string, size: 'small' | 'normal' | 'large' = 'normal'): Promise<string | null> {
  try {
    const response = await fetch(`https://api.scryfall.com/cards/${scryfallId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch card: ${response.status}`);
    }

    const card: ScryfallCard = await response.json();

    return card.image_uris?.[size] || null;
  } catch (error) {
    console.error('[Scryfall API] Error fetching image:', error);
    return null;
  }
}
