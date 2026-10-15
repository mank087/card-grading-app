/**
 * Pre-charge photo check for bulk submissions (Oct 2026).
 *
 * Single-card grading runs `prechargePhotoGate` inside /api/stripe/deduct, so a
 * screenshot, a wrong card or an unframed photo is refused before the credit is
 * spent. The bulk drain charged through `deductCredit` directly and skipped it,
 * so bulk cards paid for photos that single cards would have bounced. This runs
 * the same gate, for a card the submission's owner actually owns, before the
 * drain charges it. The gate fails open; only a database read error defers.
 */
import { supabaseServer } from '../supabaseServer';
import { prechargePhotoGate } from '../grading/prechargeGate';

export type BulkPreflight = { status: 'allowed' } | { status: 'blocked' | 'defer'; reason: string };

export async function bulkPreflight(cardId: string, ownerId: string): Promise<BulkPreflight> {
  try {
    const { data, error } = await supabaseServer().from('cards')
      .select('id,user_id,front_path,back_path,grade_status,error_message')
      .eq('id', cardId).eq('user_id', ownerId).maybeSingle();
    if (error) return { status: 'defer', reason: 'Photo check could not load the card. It will be retried.' };
    if (!data) return { status: 'blocked', reason: 'This card is not owned by the submission owner. No credit was charged.' };
    const result = await prechargePhotoGate(data);
    return result.blocked ? { status: 'blocked', reason: result.body.error } : { status: 'allowed' };
  } catch {
    return { status: 'defer', reason: 'Photo check unavailable. It will be retried.' };
  }
}

/** Run the check for every item at once (bounded), so a bulk tick is not N × 12 s. */
export async function bulkPreflightAll(
  items: Array<{ id: string; card_id: string }>,
  ownerId: string,
  concurrency = 4,
  check: typeof bulkPreflight = bulkPreflight,
): Promise<Map<string, BulkPreflight>> {
  const out = new Map<string, BulkPreflight>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      out.set(item.id, await check(item.card_id, ownerId));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
