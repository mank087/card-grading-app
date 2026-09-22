/**
 * The grader's rarity CLASSIFICATION BUCKETS — and why they must not be
 * printed as a card's rarity outside sports.
 *
 * `cards.rarity_tier` does not hold a rarity name. It holds one of the eleven
 * fixed buckets `RarityClassification.rarity_tier` declares in
 * `src/lib/conversationalGradingV3_3.ts:30-34`, and `visionGrader.ts:3910`
 * stamps 'Parallel / Insert Variant' whenever the model's card_info carries a
 * `parallel_type` OR a `subset`. For Pokemon the model puts the RARITY NAME in
 * `subset` ("Secret Rare"), so almost every Pokemon card lands in that bucket
 * and the page ends up telling the owner their Secret Rare is a
 * "Parallel / Insert Variant".
 *
 * The real rarity for those categories is `conversational_card_info.rarity_tier`.
 *
 * For SPORTS the buckets ARE how the card is described — a parallel or an
 * insert is exactly what a sports collector calls it — so nothing changes
 * there.
 *
 * This module is the shared vocabulary only. It is deliberately dependency
 * free so both `src/lib/cardDetail/` and `src/lib/ebay/` can read it without
 * either importing the other.
 *
 * FIXING THE READ SITES, NOT THE WRITER: `visionGrader.ts` is the grading
 * engine and is out of scope.
 */

/** Every value `RarityClassification.rarity_tier` is allowed to take. */
export const RARITY_BUCKETS = [
  '1-of-1 / Unique',
  'Super Short Print (SSP)',
  'Short Print (SP)',
  'Authenticated Autograph',
  'Memorabilia / Relic',
  'Parallel / Insert Variant',
  'Rookie / Debut / First Edition',
  'Limited Edition / Event Issue',
  'Commemorative / Promo',
  'Base / Common',
  'Unconfirmed',
] as const;

export type RarityBucket = (typeof RARITY_BUCKETS)[number];

const BUCKET_SET = new Set<string>(RARITY_BUCKETS.map((b) => b.toLowerCase()));

/** True when `value` is one of the grader's buckets, not a rarity name. */
export function isRarityBucket(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return BUCKET_SET.has(normalized);
}

/**
 * `cards.category` does not always say "sports": it can hold the SPORT
 * ("Baseball"). The same list `normalizeListingCategory` folds into 'sports'
 * (listingFields.ts:127-130) is repeated here rather than imported, because
 * this module is the shared, dependency-free vocabulary and `src/lib/ebay`
 * must not become a dependency of `src/lib/cardDetail` or the other way round.
 */
const SPORTS_ALIASES = new Set([
  'sports',
  'football',
  'baseball',
  'basketball',
  'hockey',
  'soccer',
  'golf',
  'tennis',
  'wrestling',
  'boxing',
  'racing',
  'ufc',
  'mma',
]);

/**
 * Whether a DCM category DESCRIBES its cards with the buckets.
 *
 * Only sports does. Everything else (Pokemon, MTG, Lorcana, One Piece,
 * Yu-Gi-Oh, Star Wars, Other) has its own printed rarity names.
 */
export function categoryUsesRarityBuckets(category: unknown): boolean {
  if (typeof category !== 'string') return false;
  return SPORTS_ALIASES.has(category.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/**
 * The first candidate that is a real rarity for this category.
 *
 * For sports every candidate is taken as-is. For every other category a
 * bucket is skipped, so the chain falls through to the next source — and if
 * nothing but buckets is on offer the answer is null. Printing the bucket is
 * never the fallback.
 */
export function pickRarity(category: unknown, ...candidates: unknown[]): string | null {
  const allowBuckets = categoryUsesRarityBuckets(category);
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (!allowBuckets && isRarityBucket(trimmed)) continue;
    return trimmed;
  }
  return null;
}
