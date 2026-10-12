import printedNumbers from './pokemonAnniversaryPrintedNumbers.json';
import { pokemonNumberForSet, pokemonSetIdOfCardId } from './pokemonPromoNumber';

// Public Scrydex card-page printed_number values, captured 2026-09-16.
// Classic reprints keep their original fractions; RGB cards have no numeric total.
// This small exception catalog avoids inventing fractions from expansion size.
// Promo sets (svp, swshp, ...) print the bare number: never "173/215".
export function pokemonPrintedNumber(id: string, number: string, total: number): string {
  return (printedNumbers as Record<string, string>)[id] || pokemonNumberForSet(number, pokemonSetIdOfCardId(id), total);
}

export function anniversaryNumber(value: string): string | null {
  const rgb = value.trim().match(/^([RGB])(?:\s*\/\s*RGB)?$/i);
  return rgb ? rgb[1].toUpperCase() : null;
}

export type AnniversaryBadge = '30' | '25';

/** "30" / "25" (string or number) → the badge; anything else (null, "none", "3O") → null. */
export function anniversaryBadgeOf(value: unknown): AnniversaryBadge | null {
  const v = String(value ?? '').trim();
  return v === '30' || v === '25' ? v : null;
}

/** card_info.printed_badge values: the two anniversary badges and the Trick or Trade pumpkin (pokemonTrickOrTrade.ts). */
export type PrintedBadge = AnniversaryBadge | 'pumpkin';

export function printedBadgeOf(value: unknown): PrintedBadge | null {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'pumpkin' ? 'pumpkin' : anniversaryBadgeOf(v);
}

export interface AnniversaryEvidence {
  set_name?: string;
  set_code?: string;
  card_number_raw?: string;
  card_number?: string;
  set_total?: string;
  /** The grading call's read of the printed anniversary badge (v9.31). */
  printed_badge?: string | null;
  /** First look's read of the same badge, used when the grading call reports none. */
  first_look_printed_badge?: string | null;
}

/** The badge the reads report: the grading call's first, then first look's. */
export function reportedAnniversaryBadge(info: AnniversaryEvidence | null | undefined): AnniversaryBadge | null {
  return anniversaryBadgeOf(info?.printed_badge) ?? anniversaryBadgeOf(info?.first_look_printed_badge);
}

/**
 * The two catalog sets behind each badge. Oct 2026: every 30th Celebration card
 * prints a yellow "30" + Pikachu badge (2021 Celebrations: "25"); the Classic
 * Collection reprints keep the ORIGINAL number and copyright line, so without
 * the badge they matched the 1999 card (production card 911451, Pikachu 58/102).
 */
export const ANNIVERSARY_SETS: Record<AnniversaryBadge, { classic: string; main: string; mainTotal: number; year: string }> = {
  '30': { classic: 'me55c', main: 'me55', mainTotal: 128, year: '2026' },
  '25': { classic: 'cel25c', main: 'cel25', mainTotal: 25, year: '2021' },
};
export const ANNIVERSARY_SET_IDS: readonly string[] = ['me55', 'me55c', 'cel25', 'cel25c'];
export const CLASSIC_SET_IDS: readonly string[] = ['me55c', 'cel25c'];

/** The badge a catalog set belongs to, or null for any other set. */
export function badgeOfSetId(setId: string | null | undefined): AnniversaryBadge | null {
  if (setId === 'me55' || setId === 'me55c') return '30';
  if (setId === 'cel25' || setId === 'cel25c') return '25';
  return null;
}

/**
 * A badge says WHICH anniversary; the printed number says which of its two
 * sets. The main set prints its own total (/128, /25, secrets above it, R/G/B);
 * a Classic Collection reprint keeps its original fraction (58/102, 149/147).
 */
export function badgeSetIds(badge: AnniversaryBadge, info: AnniversaryEvidence): string[] {
  const sets = ANNIVERSARY_SETS[badge];
  const raw = (info.card_number_raw || info.card_number || '').trim();
  if (badge === '30' && anniversaryNumber(raw)) return [sets.main];
  const total = parseInt(String(info.set_total || raw.split('/')[1] || '').trim().replace(/^[A-Za-z]+/, ''), 10);
  if (!Number.isFinite(total)) return [sets.classic, sets.main];
  return total === sets.mainTotal ? [sets.main] : [sets.classic];
}

/** What put the card in an anniversary scope: its set name/code/RGB number, its badge, or nothing. */
export function anniversaryEvidenceKind(info: AnniversaryEvidence): 'named' | 'badge' | null {
  const name = (info.set_name || '').toLowerCase();
  const named = /\b30th\s+(?:celebration|anniversary)\b/.test(name);
  const code = (info.set_code || '').trim().toUpperCase() === '30C';
  const rgb = /^[RGB]\s*\/\s*RGB$/i.test((info.card_number_raw || info.card_number || '').trim());
  if (named || code || rgb) return 'named';
  return reportedAnniversaryBadge(info) ? 'badge' : null;
}

export function anniversarySetIds(info: AnniversaryEvidence): string[] | null {
  const name = (info.set_name || '').toLowerCase();
  const named = /\b30th\s+(?:celebration|anniversary)\b/.test(name);
  const code = (info.set_code || '').trim().toUpperCase() === '30C';
  const rgb = /^[RGB]\s*\/\s*RGB$/i.test((info.card_number_raw || info.card_number || '').trim());
  if (!named && !code && !rgb) {
    // The printed badge is evidence too, whatever set name the read gave.
    const badge = reportedAnniversaryBadge(info);
    return badge ? badgeSetIds(badge, info) : null;
  }
  if (/classic\s+collection/.test(name) && (named || code)) return ['me55c'];
  if (rgb) return ['me55'];
  // 30C is shared by BOTH expansions, and the main name can be an umbrella read.
  return ['me55', 'me55c'];
}

export function printedDenominatorMatches(printed: string, observed?: string): boolean {
  if (!observed) return true;
  const expected = printed.split('/')[1];
  if (!expected) return false;
  const normalize = (value: string) => value.trim().toUpperCase().replace(/^0+(?=\d)/, '');
  return normalize(expected) === normalize(observed);
}
