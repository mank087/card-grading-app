/** Helpers for POST /api/cards/[id]/first-look. They live here because a Next.js
 *  route file may export only its handlers and route config. */

export function firstLookOnDemandEnabled(): boolean {
  return process.env.FIRST_LOOK_ON_DEMAND === '1';
}

/**
 * Cards with a run in flight in THIS instance. It is not a distributed lock —
 * two lambdas can still both run one — but it stops the common case: a dialog
 * that mounts twice, or an owner who reopens it before the first answer lands.
 */
export const firstLookInFlight = new Set<string>();

/** Test seam. */
export function __clearFirstLookGuard(): void {
  firstLookInFlight.clear();
}
