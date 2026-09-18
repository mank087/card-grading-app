/**
 * Revision-guarded price writes (Phase 2C).
 *
 * Every price writer used to write by card id alone:
 *
 *   1. a refresh reads the card's identity and starts a PriceCharting/eBay
 *      lookup (seconds for one card, minutes for a cron batch),
 *   2. the owner corrects the identity — Phase 2A bumps
 *      `cards.identity_revision` and nulls the stored price columns,
 *   3. the in-flight response lands and writes the OLD card's price onto the
 *      corrected card.
 *
 * The correction looks like it did not stick and the displayed-value guard can
 * be beaten by a stale write. The fix is a compare-and-set: a writer reads
 * `identity_revision` and `pricing_selection_revision` in the SAME select that
 * reads the identity it is about to price, carries them through the async work,
 * and puts them in the WHERE clause of the UPDATE. If either moved, the UPDATE
 * matches zero rows and the result is discarded. The next refresh prices the
 * corrected card, so nothing is lost from the customer's point of view.
 *
 * This is deliberately NOT read-then-write. A read of the revisions immediately
 * before the update would have the same race, just a narrower window.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The two revision counters a price write is bound to.
 *
 * - identity_revision moves when the owner (or an admin review) materially
 *   changes which card this is.
 * - pricing_selection_revision moves when the owner picks or clears the
 *   PriceCharting product the card should be priced against.
 */
export type PriceRevisions = {
  identity_revision: number;
  pricing_selection_revision: number;
};

/**
 * Add this to any select whose result will later be used to write prices.
 * Keeping it as one constant means a new writer cannot forget a column.
 */
export const PRICE_REVISION_SELECT = 'identity_revision, pricing_selection_revision';

/** The columns themselves, for callers that build a select list as an array. */
export const PRICE_REVISION_COLUMNS: readonly string[] = [
  'identity_revision',
  'pricing_selection_revision',
];

export type GuardedWriteStatus = 'written' | 'stale' | 'unguarded_written' | 'error';

export interface GuardedWriteResult {
  status: GuardedWriteStatus;
  error?: string;
}

/** Only log the "writing unguarded" warning once per process, not per card. */
let warnedUnguarded = false;
/** Same for a database that somehow lacks the columns. */
let warnedMissingColumns = false;

function isMissingRevisionColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return typeof error.message === 'string'
    && /identity_revision|pricing_selection_revision/.test(error.message)
    && /does not exist|could not find/i.test(error.message);
}

function toRevision(value: unknown): number | null {
  if (value === undefined) return null;
  // A freshly added NOT NULL DEFAULT 0 column can still read back as null
  // through a view or a partially-populated row; treat that as 0.
  if (value === null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pull the revisions off a card row that was read from the database.
 *
 * Returns null when the row did not select the columns, which means "this
 * caller cannot guard". That is the honest answer: inventing 0 would make the
 * write look guarded while actually filtering on the wrong value, and every
 * write would silently become stale.
 */
export function readPriceRevisions(row: Record<string, any> | null | undefined): PriceRevisions | null {
  if (!row) return null;
  const identity = toRevision(row.identity_revision);
  const selection = toRevision(row.pricing_selection_revision);
  if (identity === null || selection === null) return null;
  return { identity_revision: identity, pricing_selection_revision: selection };
}

/**
 * Write price columns for a card, but only if the identity and the owner's
 * product selection are still the ones the caller priced.
 *
 * - `revisions` present: one UPDATE with both revisions in the WHERE clause.
 *   Zero rows matched means the card moved on -> 'stale', nothing written.
 * - `revisions` null: writes as the code did before Phase 2C and returns
 *   'unguarded_written'. This keeps callers that genuinely cannot supply the
 *   revisions (older mobile builds, cached web bundles) working instead of
 *   silently dropping their prices.
 *
 * Never throws. A price write must never be the reason a grade, a review or a
 * cron batch fails.
 */
export async function guardedPriceUpdate(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  revisions: PriceRevisions | null,
  payload: Record<string, unknown>,
  context?: string,
): Promise<GuardedWriteResult> {
  const label = context ? `[guardedPriceUpdate:${context}]` : '[guardedPriceUpdate]';
  try {
    if (!revisions) {
      if (!warnedUnguarded) {
        warnedUnguarded = true;
        console.warn(
          `${label} writing card prices without a revision guard. The caller did not ` +
          'read identity_revision/pricing_selection_revision, so a concurrent identity ' +
          'correction can be overwritten. See docs/DCM_PHASE2C_PRICE_WRITE_GUARD.md.',
        );
      }
      const { error } = await supabase.from('cards').update(payload).eq('id', cardId);
      if (error) {
        console.error(`${label} unguarded update failed for card ${cardId}:`, error);
        return { status: 'error', error: error.message };
      }
      return { status: 'unguarded_written' };
    }

    const { data, error } = await supabase
      .from('cards')
      .update(payload)
      .eq('id', cardId)
      .eq('identity_revision', revisions.identity_revision)
      .eq('pricing_selection_revision', revisions.pricing_selection_revision)
      .select('id');

    if (error) {
      // Should not happen in production (both columns are live), but a database
      // without them must degrade to the old behaviour rather than stop pricing.
      if (isMissingRevisionColumn(error)) {
        if (!warnedMissingColumns) {
          warnedMissingColumns = true;
          console.warn(
            `${label} cards.identity_revision / cards.pricing_selection_revision are ` +
            'missing from this database. Falling back to unguarded price writes.',
          );
        }
        return guardedPriceUpdate(supabase, cardId, null, payload, context);
      }
      console.error(`${label} guarded update failed for card ${cardId}:`, error);
      return { status: 'error', error: error.message };
    }

    if (!data || data.length === 0) {
      // Either the identity/selection moved while we were pricing, or the row
      // is gone. Both mean: throw this price away, do not retry.
      console.log(
        `${label} discarded a stale price write for card ${cardId} ` +
        `(priced at identity_revision=${revisions.identity_revision}, ` +
        `pricing_selection_revision=${revisions.pricing_selection_revision})`,
      );
      return { status: 'stale' };
    }

    return { status: 'written' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${label} threw for card ${cardId}:`, message);
    return { status: 'error', error: message };
  }
}

/**
 * The response code a client-initiated price save gets when the card moved on.
 * The client's contract is: refetch this card once, quietly. It is never an
 * error the customer sees, because nothing is wrong. Their correction won.
 */
export const PRICE_WRITE_STALE_CODE = 'price_write_stale';

/**
 * Read the revisions a client sent with a price save.
 *
 * A request that sends neither is accepted and written unguarded, which is what
 * keeps a cached web bundle and the mobile app working. A request that sends
 * only one is treated as unguarded too: half a compare-and-set is worse than
 * none, because it would filter on a value the client never checked.
 */
export function parseRequestRevisions(body: Record<string, any> | null | undefined): PriceRevisions | null {
  if (!body) return null;
  const identity = body.identity_revision;
  const selection = body.pricing_selection_revision;
  if (identity === undefined || identity === null) return null;
  if (selection === undefined || selection === null) return null;
  const i = Number(identity);
  const s = Number(selection);
  if (!Number.isFinite(i) || !Number.isFinite(s)) return null;
  return { identity_revision: i, pricing_selection_revision: s };
}

/** Test seam: reset the once-per-process log flags. */
export function __resetGuardWarnings(): void {
  warnedUnguarded = false;
  warnedMissingColumns = false;
}
