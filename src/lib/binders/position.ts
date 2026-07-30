/**
 * Fractional indexing for binder ordering.
 *
 * `position` is NUMERIC, not a sequential integer. Appending takes max+STEP;
 * inserting between two items takes their midpoint. A drag therefore writes
 * exactly ONE row.
 *
 * The naive alternative — integer positions renumbered on every move — rewrites
 * the whole binder per drag. That is slow, it races when two clients drag at
 * once (both compute the same new integers from stale reads), and it turns a
 * 50-card reorder into 50 writes.
 *
 * Positions are always computed SERVER-side from the client's intent ("put this
 * after that card"). The client never invents a number, which is what keeps
 * concurrent drags from colliding.
 */

/** Gap between appended items. Large enough for ~20 midpoint inserts before a rebalance. */
export const POSITION_STEP = 1024;

/**
 * Below this gap, midpoint inserts are close enough to float precision that we
 * renumber the binder instead. With STEP=1024 this needs ~30 consecutive
 * inserts into the same gap, so it is rare — but without it a determined user
 * eventually exhausts precision and two cards collide on one position.
 */
export const MIN_GAP = 1e-6;

export interface Neighbours {
  /** position of the item this one goes AFTER (null = moving to the front) */
  before: number | null;
  /** position of the item this one goes BEFORE (null = moving to the end) */
  after: number | null;
}

/**
 * Position for an item dropped between two neighbours.
 * Returns null when the gap is too tight — the caller must rebalance and retry.
 */
export function positionBetween({ before, after }: Neighbours): number | null {
  // Empty list.
  if (before === null && after === null) return POSITION_STEP;
  // Moving to the front: half of whatever is currently first. Halving keeps
  // this valid forever without touching the other rows.
  if (before === null) return after! / 2;
  // Moving to the end.
  if (after === null) return before + POSITION_STEP;

  const gap = after - before;
  if (gap <= MIN_GAP) return null;
  return before + gap / 2;
}

/** Position for a brand-new item appended to a list whose current max is `max`. */
export function positionAfterMax(max: number | null | undefined): number {
  return (max ?? 0) + POSITION_STEP;
}

/**
 * Evenly spaced positions for a full rebalance, preserving current order.
 * Used when positionBetween() reports the gap has collapsed.
 */
export function rebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}

/**
 * Resolve a client's drop intent into the neighbouring positions.
 *
 * `ordered` is the binder's current membership in position order. `afterId` is
 * the card the dragged card should land AFTER — null means "move to the front".
 * The dragged card is excluded from its own neighbour calculation, otherwise a
 * small move computes a midpoint against itself and doesn't move.
 */
export function neighboursForDrop(
  ordered: { card_id: string; position: number }[],
  movingCardId: string,
  afterId: string | null
): Neighbours | null {
  const without = ordered.filter(r => r.card_id !== movingCardId);

  if (afterId === null) {
    return { before: null, after: without.length ? without[0].position : null };
  }

  const idx = without.findIndex(r => r.card_id === afterId);
  if (idx === -1) return null; // anchor isn't in this binder — stale client

  return {
    before: without[idx].position,
    after: idx + 1 < without.length ? without[idx + 1].position : null,
  };
}
