/**
 * Pokémon one-off special promos (Oct 2026).
 *
 * Some promos are not in the pokemon_cards catalog at all: no set, no printed
 * number, so the catalog matcher can only link them to the WRONG card and the
 * PriceCharting search lands on whatever shares the name ("Ancient Mew" priced
 * as "Mew ex #232" at $864-2,438 on 13 production cards). Each entry here says
 * how to recognise one, the ONE canonical identity it is saved under, and the
 * PriceCharting product to price it as (by language).
 *
 * Applied in three places:
 *   - grading route (src/app/api/pokemon/[id]/route.ts), next to Trick or Trade;
 *   - post-grade verify (identity/pokemonCatalogLink.ts): no catalog match is
 *     attempted, the stale link is cleared;
 *   - scripts/backfill-pokemon-special-promos.ts for cards already saved.
 * The pricing pin is cards.dcm_selected_product_id / _name, which
 * pricing/batchPriceRefresh.ts refreshCardPrice honours before any search.
 *
 * To add a promo: add one SPECIAL_PROMOS entry (id, match, canonical, pricing,
 * notes) and a test. Keep the name patterns specific enough that the ordinary
 * card ("Mew") never matches.
 */

export type PromoLanguage = 'en' | 'ja' | 'ko';

export interface PromoProduct {
  /** PriceCharting product id. */
  productId: string;
  /** Stored as dcm_selected_product_name (PriceCharting's product name). */
  productName: string;
}

export interface SpecialPromo {
  id: string;
  match: {
    /** Any of these on card_name / player_or_character / featured is a match. */
    names: RegExp[];
    /**
     * Weaker route: the base Pokémon name (e.g. exactly "Mew") PLUS one of the
     * `evidence` patterns in the card's transcribed front text, and no printed number.
     */
    baseName?: RegExp;
    evidence?: RegExp[];
  };
  canonical: {
    card_name: string;
    /** featured / pokemon_featured / card_info.player_or_character */
    featured: string;
    card_set: string;
    card_number: null;
    release_date: string;
  };
  /** Default product by language. A language without one is not pinned. */
  pricing: Partial<Record<PromoLanguage, PromoProduct>>;
  /** Named variants: only when the card's own text names them. */
  variants?: Array<{ match: RegExp; language?: PromoLanguage } & PromoProduct>;
  notes: string;
}

export const SPECIAL_PROMOS: readonly SpecialPromo[] = [
  {
    id: 'ancient-mew-2000',
    match: {
      names: [/\bancient\s*mew\b/i, /古代\s*の?\s*ミュウ/],
      baseName: /^\s*(?:mew|ミュウ(?:\s*\(\s*mew\s*\))?)\s*$/i,
      evidence: [/\bunown\b/i, /\brun(?:e|ic)\b/i, /\bglyphs?\b/i, /hieroglyph/i],
    },
    canonical: {
      card_name: 'Ancient Mew',
      featured: 'Ancient Mew',
      // Spelled the way the owner's hand fix (serial 834669, Oct 13 2026) has it.
      card_set: 'Pokemon Movie 2000 Promo',
      card_number: null,
      release_date: '2000',
    },
    pricing: {
      en: { productId: '1958438', productName: 'Ancient Mew' },
      ja: { productId: '3834602', productName: 'Ancient Mew' },
    },
    variants: [
      // The Japanese misprint reads "Nintedo" in the copyright line.
      { match: /\bnintedo\b/i, language: 'ja', productId: '4602476', productName: 'Ancient Mew [Nintedo Error]' },
      { match: /\bgame\s*boy\b/i, productId: '6206667', productName: 'Ancient Mew [Gameboy]' },
    ],
    notes:
      'Pokémon the Movie 2000 theatre promo (1999-2000). Text printed in Unown script instead of English, '
      + 'gold/foil glyph border, no set number; copyright "©1995, 96, 98, 99 Nintendo, Creatures, GAMEFREAK. '
      + '© 1999-2000 Wizards." PriceCharting also lists JP [2019], [II], Korean [2020] and [Norway] variants: '
      + 'not pinned automatically (the card text does not name them).',
  },
];

/** Fields read from card_info (or a cards row). */
export type PromoInfo = Record<string, any> | null | undefined;

const CJK = /[぀-ヿ一-鿿]/;
const KOREAN = /[가-힯]/;

function names(info: Record<string, any>): string[] {
  return [info.card_name, info.player_or_character, info.featured, info.pokemon_featured]
    .filter(v => typeof v === 'string' && v.trim()) as string[];
}

function evidenceText(info: Record<string, any>): string {
  return [info.card_front_text, info.card_text, info.front_text, info.rarity_or_variant, info.subset]
    .filter(v => typeof v === 'string').join(' \n ');
}

function copyrightText(info: Record<string, any>): string {
  return [info.year_text_seen, info.copyright_text, info.manufacturer].filter(v => typeof v === 'string').join(' ');
}

function hasPrintedNumber(info: Record<string, any>): boolean {
  const n = String(info.card_number_raw ?? info.card_number ?? '').trim();
  return /\d/.test(n);
}

/**
 * The card's language. An explicit language wins; a Wizards copyright means the
 * English print (the grader often writes "ミュウ (Mew)" for the Unown-text card);
 * otherwise Japanese/Korean script in the name decides.
 */
export function promoLanguage(info: PromoInfo): PromoLanguage {
  if (!info) return 'en';
  const stated = String(info.language ?? info.card_language ?? '').trim().toLowerCase();
  if (/^(ja|jp|jpn|japanese)\b/.test(stated)) return 'ja';
  if (/^(ko|kr|kor|korean)\b/.test(stated)) return 'ko';
  if (/^(en|eng|english)\b/.test(stated)) return 'en';
  if (/wizards/i.test(copyrightText(info))) return 'en';
  const cardName = String(info.card_name ?? '');
  const all = names(info).join(' ');
  if (KOREAN.test(cardName) || KOREAN.test(all)) return 'ko';
  if (CJK.test(cardName) || CJK.test(all)) return 'ja';
  return 'en';
}

export interface SpecialPromoMatch {
  promo: SpecialPromo;
  language: PromoLanguage;
  via: 'name' | 'evidence';
}

/** The special promo this card is, or null. */
export function matchSpecialPromo(info: PromoInfo): SpecialPromoMatch | null {
  if (!info || typeof info !== 'object') return null;
  const ns = names(info);
  for (const promo of SPECIAL_PROMOS) {
    if (ns.some(n => promo.match.names.some(re => re.test(n)))) {
      return { promo, language: promoLanguage(info), via: 'name' };
    }
    const { baseName, evidence } = promo.match;
    if (baseName && evidence?.length && ns.length && ns.every(n => baseName.test(n)) && !hasPrintedNumber(info)) {
      const text = evidenceText(info);
      if (evidence.some(re => re.test(text))) return { promo, language: promoLanguage(info), via: 'evidence' };
    }
  }
  return null;
}

/** The PriceCharting product to pin: a variant the card text names, else the language default. */
export function specialPromoProduct(match: SpecialPromoMatch, info?: PromoInfo): PromoProduct | null {
  const { promo, language } = match;
  if (info && promo.variants?.length) {
    const text = [names(info).join(' '), info.set_name, info.card_set, evidenceText(info), copyrightText(info)]
      .filter(v => typeof v === 'string').join(' ');
    const v = promo.variants.find(x => (!x.language || x.language === language) && x.match.test(text));
    if (v) return { productId: v.productId, productName: v.productName };
  }
  return promo.pricing[language] ?? null;
}

/** Already saved exactly as the canonical identity (columns of a cards row). */
export function isCanonicalSpecialPromo(row: PromoInfo, promo: SpecialPromo): boolean {
  if (!row) return false;
  const c = promo.canonical;
  return row.card_name === c.card_name && row.featured === c.featured && row.card_set === c.card_set
    && !String(row.card_number ?? '').trim() && String(row.release_date ?? '') === c.release_date;
}

/**
 * Grading-time: put the canonical identity on card_info (mutates). Returns the
 * match (null = not a special promo). The printed-number fields are cleared:
 * there is no number, and a misread one would send the catalog matcher to a
 * wrong card.
 */
export function applySpecialPromo(info: PromoInfo): SpecialPromoMatch | null {
  const match = matchSpecialPromo(info);
  if (!match || !info) return null;
  const c = match.promo.canonical;
  info.card_name = c.card_name;
  info.player_or_character = c.featured;
  info.set_name = c.card_set;
  info.year = c.release_date;
  info.card_number = null;
  info.card_number_raw = null;
  info.set_total = null;
  info.card_number_format = 'none';
  info.needs_api_lookup = false;
  info.validated_source = SPECIAL_PROMO_SOURCE;
  info.special_promo = match.promo.id;
  if (match.language !== 'en') info.language = match.language;
  return match;
}

/** validated_source value for a card identified from this table. */
export const SPECIAL_PROMO_SOURCE = 'pokemon_special_promos';

/** The cards-row columns for a special promo (identity + pricing pin). */
export function specialPromoColumns(match: SpecialPromoMatch, info?: PromoInfo): Record<string, any> {
  const c = match.promo.canonical;
  const product = specialPromoProduct(match, info);
  return {
    card_name: c.card_name,
    featured: c.featured,
    pokemon_featured: c.featured,
    card_set: c.card_set,
    card_number: c.card_number,
    release_date: c.release_date,
    ...(product ? { dcm_selected_product_id: product.productId, dcm_selected_product_name: product.productName } : {}),
  };
}
