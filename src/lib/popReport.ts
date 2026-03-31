// Population Report shared constants and helpers

export interface PopCategory {
  slug: string;
  dbCategory: string;
  dbSubCategory?: string; // Optional sub-category filter within a category
  displayName: string;
  icon: string;
}

export const POP_CATEGORIES: PopCategory[] = [
  { slug: 'pokemon', dbCategory: 'Pokemon', displayName: 'Pokemon', icon: '\u26A1' },
  { slug: 'mtg', dbCategory: 'MTG', displayName: 'Magic: The Gathering', icon: '\uD83E\uDDD9' },
  { slug: 'lorcana', dbCategory: 'Lorcana', displayName: 'Lorcana', icon: '\u2728' },
  { slug: 'one-piece', dbCategory: 'One Piece', displayName: 'One Piece', icon: '\uD83C\uDFF4\u200D\u2620\uFE0F' },
  { slug: 'yugioh', dbCategory: 'Yu-Gi-Oh', displayName: 'Yu-Gi-Oh!', icon: '\uD83D\uDD2E' },
  { slug: 'football', dbCategory: 'Football', displayName: 'Football', icon: '\uD83C\uDFC8' },
  { slug: 'baseball', dbCategory: 'Baseball', displayName: 'Baseball', icon: '\u26BE' },
  { slug: 'basketball', dbCategory: 'Basketball', displayName: 'Basketball', icon: '\uD83C\uDFC0' },
  { slug: 'hockey', dbCategory: 'Hockey', displayName: 'Hockey', icon: '\uD83C\uDFD2' },
  { slug: 'soccer', dbCategory: 'Soccer', displayName: 'Soccer', icon: '\u26BD' },
  { slug: 'wrestling', dbCategory: 'Wrestling', displayName: 'Wrestling', icon: '\uD83E\uDD3C' },
  { slug: 'sports', dbCategory: 'Sports', displayName: 'Sports (Other)', icon: '\uD83C\uDFC6' },
  // Sub-category entries (category = 'Other' with sub_category filter)
  { slug: 'star-wars', dbCategory: 'Other', dbSubCategory: 'Star Wars', displayName: 'Star Wars', icon: '\u2B50' },
  { slug: 'digimon', dbCategory: 'Other', dbSubCategory: 'Digimon', displayName: 'Digimon', icon: '\uD83D\uDC32' },
  { slug: 'dragon-ball', dbCategory: 'Other', dbSubCategory: 'Dragon Ball', displayName: 'Dragon Ball', icon: '\uD83D\uDD25' },
  { slug: 'marvel', dbCategory: 'Other', dbSubCategory: 'Marvel', displayName: 'Marvel', icon: '\uD83E\uDDB8' },
  { slug: 'dc-comics', dbCategory: 'Other', dbSubCategory: 'DC Comics', displayName: 'DC Comics', icon: '\uD83E\uDDB8' },
  { slug: 'garbage-pail-kids', dbCategory: 'Other', dbSubCategory: 'Garbage Pail Kids', displayName: 'Garbage Pail Kids', icon: '\uD83D\uDDD1\uFE0F' },
  { slug: 'flesh-and-blood', dbCategory: 'Other', dbSubCategory: 'Flesh and Blood', displayName: 'Flesh and Blood', icon: '\u2694\uFE0F' },
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
  const cat = POP_CATEGORIES.find((c) => c.dbCategory === category && !c.dbSubCategory);
  return cat ? cat.slug : category.toLowerCase().replace(/\s+/g, '-');
}

/** Get the full PopCategory metadata from a slug */
export function getCategoryMeta(slug: string): PopCategory | undefined {
  return POP_CATEGORIES.find((c) => c.slug === slug);
}

/** TCG categories where card name = character name (no separate player column needed) */
const TCG_SLUGS = new Set(['pokemon', 'mtg', 'lorcana', 'one-piece', 'yugioh']);

/** Returns true if the category is a TCG (card name IS the character) */
export function isTcgCategory(slug: string): boolean {
  return TCG_SLUGS.has(slug);
}
