/**
 * The weakest of the four subgrades as they are finally displayed, ties broken
 * in the order centering, corners, edges, surface (the order used everywhere
 * else in the report). null when no category has a number.
 */
export type SubgradeCategory = 'centering' | 'corners' | 'edges' | 'surface';

const ORDER: readonly SubgradeCategory[] = ['centering', 'corners', 'edges', 'surface'];

export function weakestCategory(scores: Partial<Record<SubgradeCategory, number | null | undefined>>): SubgradeCategory | null {
  let best: SubgradeCategory | null = null;
  for (const cat of ORDER) {
    const v = scores[cat];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (best === null || v < (scores[best] as number)) best = cat;
  }
  return best;
}
