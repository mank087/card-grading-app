/**
 * Do two set names name the same product, differing only in how they are
 * written? Used to keep naming-only first-look suggestions out of the owner's
 * "Confirm your card details" dialog.
 *
 * Measured Oct 2026: when first look's set disagreed with the grader, owners
 * kept the grader's set ~15:1 (1,943 vs 129), and most of those "disagreements"
 * were spelling: "Prizm" vs "Panini Prizm Football", "Topps" vs "2025 Topps
 * Football". Each one is a tap the owner has to dismiss for nothing.
 *
 * Deliberately conservative: only years, brand words, sport words and filler
 * may differ. Any other extra word is a different product ("Mars Attacks" vs
 * "Mars Attacks Christmas", "Base Set" vs "Base Set 2", "Star Wars" vs "Star
 * Wars Wonder Bread"), and two DIFFERENT brands are never equivalent ("Topps
 * Chrome" vs "Bowman Chrome").
 *
 * Pure: no imports, no I/O.
 */

/** Manufacturer words. Both sides may name one; they must not name different ones. */
const BRAND_WORDS = new Set(['topps', 'panini', 'upperdeck', 'fleer', 'bowman', 'donruss']);

/** Words that never identify a product on their own. */
const FILLER_WORDS = new Set([
  'football', 'baseball', 'basketball', 'hockey', 'soccer',
  'pokemon', 'trading', 'cards', 'card', 'tcg',
  'and', 'the', 'of',
]);

/** Generic product words: ignored beside a real name, but "Base Set" alone is a name. */
const WEAK_WORDS = new Set(['base', 'set']);

interface ParsedSetName {
  core: string[];
  brands: Set<string>;
  weak: Set<string>;
  years: Set<string>;
  filler: Set<string>;
}

function parse(value: string): ParsedSetName {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Pokémon -> Pokemon
    .toLowerCase()
    .replace(/\bupper[\s-]*deck\b/g, 'upperdeck');
  // Years and seasons (2025, 1993-94, 2023-2024) are naming, unless both names
  // carry one and they disagree. A season counts as its first year.
  const years = new Set<string>();
  const withoutYears = normalized.replace(/\b((?:19|20)\d{2})(?:\s*[-/]\s*(?:\d{2}|(?:19|20)\d{2}))?\b/g, (_m, year: string) => {
    years.add(year);
    return ' ';
  });
  const words = withoutYears.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const parsed: ParsedSetName = { core: [], brands: new Set(), weak: new Set(), years, filler: new Set() };
  for (const word of words) {
    if (BRAND_WORDS.has(word)) parsed.brands.add(word);
    else if (WEAK_WORDS.has(word)) parsed.weak.add(word);
    else if (FILLER_WORDS.has(word)) parsed.filler.add(word);
    else parsed.core.push(word);
  }
  return parsed;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every(x => b.has(x));
}

function subsetEitherWay(a: Set<string>, b: Set<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  return [...small].every(x => large.has(x));
}

export function setNamesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || '').trim();
  const right = (b || '').trim();
  if (!left || !right) return false;
  if (left.toLowerCase() === right.toLowerCase()) return true;

  const x = parse(left);
  const y = parse(right);
  if (x.years.size && y.years.size && !sameSet(x.years, y.years)) return false;

  if (x.core.length || y.core.length) {
    // The product name proper must match word for word, and the brands may
    // only be added or dropped, never swapped.
    return x.core.join(' ') === y.core.join(' ') && subsetEitherWay(x.brands, y.brands);
  }
  // No product name beyond brand/generic words on either side.
  if (x.brands.size || y.brands.size) return sameSet(x.brands, y.brands);
  if (x.weak.size || y.weak.size) return sameSet(x.weak, y.weak);
  // Nothing but filler on both sides ("Football" vs "Baseball"): compare it all.
  return sameSet(x.filler, y.filler);
}
