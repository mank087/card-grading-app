/**
 * A stable key over everything on a card row that a LISTING is built from.
 *
 * WHY (review 2026-09-22, finding 5). The InstaList draft reseeded only when
 * the card ID changed. But the owner can correct the card's identity without
 * leaving the page — "Edit card details", "Edit this card's label text" — and
 * the page then refetches the SAME id. The draft kept the old name, the old
 * set, the old number and the old specifics, and there was no way to tell it to
 * catch up short of a reload. The once-per-id defaults flag made it worse: the
 * saved template and grade label were never re-fetched for the corrected card.
 *
 * WHAT IS IN THE KEY. The fields a title, a description and the item specifics
 * are actually assembled from (see listingDraft.ts) — name, set, number, year,
 * rarity, grade, serial — read through the same fallback chains the builder
 * uses, plus `identity_revision` when the row carries one.
 *
 * WHAT IS DELIBERATELY NOT IN IT: `updated_at`. That column moves every time a
 * price refresh touches the row, and a price refresh does not change one word
 * of the listing. Keying on it would rebase the draft (and re-run the defaults
 * fetch) for something the owner never did.
 *
 * Pure. Tolerant of anything: a null card is '', and a missing field is ''.
 */

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value);
}

/** The first value that is neither null, undefined nor an empty string. */
function firstOf(...values: unknown[]): string {
  for (const value of values) {
    const asText = text(value);
    if (asText !== '') return asText;
  }
  return '';
}

export function cardIdentityKey(card: unknown): string {
  if (!card || typeof card !== 'object') return '';
  const row = card as Record<string, any>;
  const info = (row.conversational_card_info as Record<string, any>) || {};

  return [
    text(row.id),
    // An explicit revision counter, when the schema grows one, short-circuits
    // every guess below — but the field list still stands on its own.
    text(row.identity_revision),
    firstOf(row.featured, row.pokemon_featured, row.card_name, info.name),
    firstOf(info.set_name, row.card_set, row.set_name),
    firstOf(info.card_number, row.card_number),
    firstOf(info.year, row.year, row.card_year),
    firstOf(info.rarity, row.rarity, row.card_rarity),
    text(row.grade),
    firstOf(row.org_serial_display, row.serial),
    // The print-run serial is printed on the label and named in the title.
    firstOf(row.print_run_serial, info.print_run_serial),
    // A custom label overrides the printed identity wholesale.
    row.custom_label_data ? 'custom' : '',
  ].join('|');
}

export default cardIdentityKey;
