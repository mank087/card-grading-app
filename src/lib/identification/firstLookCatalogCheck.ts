/**
 * Does first look's pass-1 read already name exactly one catalog card? When it
 * does, the optional web-search pass cannot improve the identity and is skipped
 * (identification/firstLookRunner.ts, RunFirstLookOptions.catalogConfirms).
 *
 * Measured Sept 25 on 392 Pokemon search passes: 257 ran although pass 1 had a
 * unique catalog match, and none of them moved to a different card. Categories
 * without a live catalog (Sports, Other, Star Wars, Yu-Gi-Oh) always search.
 */
import type { FirstLook } from './firstLook';
import { findUniqueCatalogMatch } from '../pokemonApiVerification';
import { catalogConfirmsIdentity } from '../identity/catalogRelink';

const CATEGORY: Record<string, string> = { mtg: 'MTG', lorcana: 'Lorcana', onepiece: 'One Piece' };

function readOf(v: FirstLook): { name: string | null; set: string | null; number: string | null; printed: string | null } {
  const val = (f: { value: string | null } | undefined) => (typeof f?.value === 'string' && f.value.trim() ? f.value.trim() : null);
  const name = val(v.identity?.card_title) || val(v.identity?.subject);
  const number = val(v.identity?.card_number);
  // identity.card_number holds the numerator ("140"); the printed form keeps the total ("140/149").
  const asPrinted = String(v.printed_text?.card_number_as_printed || '');
  const fraction = asPrinted.match(/[A-Za-z]{0,6}\d+[A-Za-z]?\s*\/\s*[A-Za-z]{0,6}\d+/)?.[0] ?? (number && number.includes('/') ? number : null);
  return { name, set: val(v.identity?.set_name), number, printed: fraction };
}

export function firstLookCatalogCheck(cardType: string | null | undefined): ((read: FirstLook) => Promise<boolean>) | undefined {
  const type = String(cardType || '').toLowerCase();
  if (type === 'pokemon') {
    return async (v) => {
      const r = readOf(v);
      if (!r.name || !r.printed) return false;
      return !!(await findUniqueCatalogMatch(r.name, r.printed)).card;
    };
  }
  const category = CATEGORY[type];
  if (!category) return undefined;
  return async (v) => {
    const r = readOf(v);
    if (!r.name) return false;
    return catalogConfirmsIdentity(category, { name: r.name, set: r.set, number: r.number });
  };
}
