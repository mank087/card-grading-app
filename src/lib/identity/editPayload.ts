/**
 * Payload clean-up for the full "Edit card details" form, which sends every
 * field of the card's category on every save.
 *
 * It sent `false` for every unticked flag and the Parallel box as-is, so one
 * save of a card with blank flags logged a dozen null-to-false "corrections" in
 * card_identity_history (about 700 rows by Oct 2026). Those fills are dropped
 * here; every other field is sent untouched, because an equal value still keeps
 * the column and the card-info JSON in step on the server.
 */
import { isIdentityFlagField, isNoOpIdentityChange } from './reviewClient';
import { currentIdentityValue } from './saveCardIdentity';

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Drop flag and parallel fields that would only fill a blank with a no-op
 * value: a blank flag with false, a blank parallel with '' or "Base". A real
 * value (true, "Refractor", false over a stored true) is always kept.
 */
export function dropNoOpIdentityFills<T extends Record<string, unknown>>(
  payload: T,
  card: Record<string, any>,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(payload) as (keyof T & string)[]) {
    const value = payload[key];
    const fillable = isIdentityFlagField(key) || key === 'parallel_type';
    if (fillable && isBlank(currentIdentityValue(card, key)) && isNoOpIdentityChange(key, null, value)) continue;
    out[key] = value;
  }
  return out;
}
