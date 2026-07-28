/**
 * Sports cards are NOT stored under a single category value. Cards land under
 * their specific sport (Baseball, Football, Basketball, …) with a generic
 * 'Sports' bucket for everything else. Any "sports" total or feed that filters
 * on category === 'Sports' alone silently misses ~40% of the real volume.
 *
 * Mirrors the sports entries in src/lib/popReport.ts POP_CATEGORIES.
 */
export const SPORTS_CATEGORIES = [
  'Sports',
  'Football',
  'Baseball',
  'Basketball',
  'Hockey',
  'Soccer',
  'Wrestling',
  'Racing',
  'Golf',
  'MMA',
  'Tennis',
  'Boxing',
] as const

/** Comma-separated form for the ?categories= query param. */
export const SPORTS_CATEGORIES_PARAM = SPORTS_CATEGORIES.join(',')

/** Sum the graded totals for every sports category in a pop-report payload. */
export function sumSportsGraded(
  categories: Array<{ dbCategory?: string; totalGraded?: number }> | null | undefined
): number {
  if (!categories) return 0
  const wanted = new Set<string>(SPORTS_CATEGORIES)
  return categories.reduce(
    (sum, c) => (c.dbCategory && wanted.has(c.dbCategory) ? sum + (Number(c.totalGraded) || 0) : sum),
    0
  )
}
