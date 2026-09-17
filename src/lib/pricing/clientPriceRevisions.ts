/**
 * Client half of the Phase 2C price-write guard.
 *
 * A detail page loads its card with select('*'), so `identity_revision` and
 * `pricing_selection_revision` are already on the card prop. The price lookup
 * components send them with every save. If the owner corrected the card in
 * another tab (or the same tab, before this fetch came back), the route answers
 * 409 and the component refetches once, quietly. The customer never sees an
 * error, because nothing went wrong: their correction won.
 *
 * A component that has no revisions (an older cached bundle, or a card object
 * built without them) sends nothing and the save is written unguarded, exactly
 * as it behaved before Phase 2C.
 */
import { PRICE_WRITE_STALE_CODE } from '@/lib/pricing/guardedPriceWrite';

export interface CardWithPriceRevisions {
  identity_revision?: number | null;
  pricing_selection_revision?: number | null;
}

/**
 * Spread this into a price-save request body. It is empty unless BOTH revisions
 * are known, because half a compare-and-set is not one.
 */
export function priceRevisionPayload(
  card: CardWithPriceRevisions | null | undefined,
): { identity_revision?: number; pricing_selection_revision?: number } {
  const identity = card?.identity_revision;
  const selection = card?.pricing_selection_revision;
  if (typeof identity !== 'number' || typeof selection !== 'number') return {};
  return { identity_revision: identity, pricing_selection_revision: selection };
}

/** True when a pricing response means "this card moved on, refetch it". */
export function isStalePriceResponse(
  response: { status: number },
  body: { code?: string } | null | undefined,
): boolean {
  return response.status === 409 || body?.code === PRICE_WRITE_STALE_CODE;
}
