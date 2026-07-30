/**
 * Card ownership lifecycle — shared helpers.
 *
 * See supabase/migrations/20260730_add_card_ownership_status.sql for why a
 * graded card is never deleted: the printed slab's QR points at
 * /verify/<serial>, the eBay sale record cascades off cards.id, and the pop
 * report counts card rows. Selling a card changes who holds it, not whether
 * it exists.
 */

export type OwnershipStatus = 'owned' | 'sold' | 'archived';

export const OWNERSHIP_STATUSES: OwnershipStatus[] = ['owned', 'sold', 'archived'];

/** States hidden from the owner's active collection and the eBay listing picker. */
export const INACTIVE_OWNERSHIP: OwnershipStatus[] = ['sold', 'archived'];

export type SoldChannel = 'ebay' | 'manual' | 'other';

export const SOLD_CHANNELS: SoldChannel[] = ['ebay', 'manual', 'other'];

export function isOwnershipStatus(v: unknown): v is OwnershipStatus {
  return typeof v === 'string' && (OWNERSHIP_STATUSES as string[]).includes(v);
}

export function isSoldChannel(v: unknown): v is SoldChannel {
  return typeof v === 'string' && (SOLD_CHANNELS as string[]).includes(v);
}

/**
 * True when a PostgREST error is "that column doesn't exist" (42703).
 *
 * The ownership columns land via a manually-applied migration, so there is a
 * window where deployed code can run against a schema that predates them. In
 * that window the read paths fall back to an unfiltered query rather than
 * 500ing the collection page — the app degrades to its old behaviour (sold
 * cards still visible) instead of breaking outright.
 *
 * This is a migration-window safety net, not a permanent mode: every call site
 * logs loudly when it fires so it can't rot silently.
 */
export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42703') return true;
  return typeof e.message === 'string' && /column .* does not exist/i.test(e.message);
}

/**
 * True once a card has been sold on. The buyer-facing record is frozen from
 * this point.
 *
 * The threat this closes: a seller lists a card, sells it, and then edits the
 * card's name / set / number / year — or hides the page, or deletes it. The
 * buyer, holding a slab whose QR points at /verify/<serial>, then sees details
 * that don't match what they bought, or nothing at all. Once money has changed
 * hands the grade record stops being the seller's to rewrite.
 *
 * Reversible by design: "Still mine" moves the card back to 'owned' and unlocks
 * it, because sales get cancelled and manual marks are self-reported.
 */
export function isRecordLocked(card: { ownership_status?: string | null } | null | undefined): boolean {
  return card?.ownership_status === 'sold';
}

/** Standard 423 body for a write blocked by the sold lock. */
export const LOCKED_RECORD_ERROR = {
  error:
    "This card is marked as sold, so its grade record is locked — the buyer can " +
    "verify it by scanning the label. If you still own it, move it back to your " +
    "collection with \"Still mine\" first.",
  code: 'card_sold_locked',
} as const;

/**
 * Run a query that uses the new ownership/deleted_at columns; if the schema
 * predates them, fall back to a variant that doesn't.
 *
 * Both callbacks return the usual supabase `{ data, error }`. Used by paths
 * where a hard failure during the migration window would be user-visible —
 * most importantly /verify/<serial>, the QR target printed on every slab.
 */
export async function withColumnFallback<T extends { data: any; error: any }>(
  primary: () => PromiseLike<T>,
  fallback: () => PromiseLike<T>,
  label = 'query'
): Promise<T> {
  const result = await primary();
  if (result.error && isMissingColumnError(result.error)) {
    console.warn(
      `[ownership] ${label}: ownership columns missing — using the pre-migration query. ` +
      `Apply supabase/migrations/20260730_add_card_ownership_status.sql.`
    );
    return fallback();
  }
  return result;
}

/** Human-readable label for a sale channel. */
export function soldChannelLabel(channel: string | null | undefined): string {
  switch (channel) {
    case 'ebay': return 'eBay';
    case 'manual': return 'Private sale';
    default: return 'Sold';
  }
}
