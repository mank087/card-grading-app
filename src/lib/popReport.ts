// Population Report shared constants and helpers

export interface PopCategory {
  slug: string;
  dbCategory: string;
  displayName: string;
  icon: string;
}

export const POP_CATEGORIES: PopCategory[] = [
  { slug: 'pokemon', dbCategory: 'Pokemon', displayName: 'Pokemon', icon: '\u26A1' },
  { slug: 'mtg', dbCategory: 'MTG', displayName: 'Magic: The Gathering', icon: '\uD83E\uDDD9' },
  { slug: 'lorcana', dbCategory: 'Lorcana', displayName: 'Lorcana', icon: '\u2728' },
  { slug: 'one-piece', dbCategory: 'One Piece', displayName: 'One Piece', icon: '\uD83C\uDFF4\u200D\u2620\uFE0F' },
  { slug: 'football', dbCategory: 'Football', displayName: 'Football', icon: '\uD83C\uDFC8' },
  { slug: 'baseball', dbCategory: 'Baseball', displayName: 'Baseball', icon: '\u26BE' },
  { slug: 'basketball', dbCategory: 'Basketball', displayName: 'Basketball', icon: '\uD83C\uDFC0' },
  { slug: 'hockey', dbCategory: 'Hockey', displayName: 'Hockey', icon: '\uD83C\uDFD2' },
  { slug: 'soccer', dbCategory: 'Soccer', displayName: 'Soccer', icon: '\u26BD' },
  { slug: 'wrestling', dbCategory: 'Wrestling', displayName: 'Wrestling', icon: '\uD83E\uDD3C' },
  { slug: 'sports', dbCategory: 'Sports', displayName: 'Sports (Other)', icon: '\uD83C\uDFC6' },
  { slug: 'other', dbCategory: 'Other', displayName: 'Other', icon: '\uD83C\uDCCF' },
];

export const GRADE_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Map a URL slug to the database category name.
 *  Falls back to title-casing the slug for dynamic categories
 *  (e.g. AI-identified sports like "Racing" that aren't in the hardcoded list). */
export function getCategoryFromSlug(slug: string): string {
  const cat = POP_CATEGORIES.find((c) => c.slug === slug);
  if (cat) return cat.dbCategory;
  // Reverse the fallback from getSlugFromCategory: "auto-racing" → "Auto Racing"
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Map a database category name to a URL slug */
export function getSlugFromCategory(category: string): string {
  const cat = POP_CATEGORIES.find((c) => c.dbCategory === category);
  return cat ? cat.slug : category.toLowerCase().replace(/\s+/g, '-');
}

/** Get the full PopCategory metadata from a slug */
export function getCategoryMeta(slug: string): PopCategory | undefined {
  return POP_CATEGORIES.find((c) => c.slug === slug);
}

/** TCG categories where card name = character name (no separate player column needed) */
const TCG_SLUGS = new Set(['pokemon', 'mtg', 'lorcana', 'one-piece']);

/** Returns true if the category is a TCG (card name IS the character) */
export function isTcgCategory(slug: string): boolean {
  return TCG_SLUGS.has(slug);
}
