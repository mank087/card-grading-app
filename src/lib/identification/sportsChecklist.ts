/**
 * sportsChecklist.ts — independent year/set corroboration for sports cards.
 *
 * Motivating misses (Sep 2026):
 *   - a 1960 Topps Mickey Mantle #350 was saved as 1957 Topps #35
 *   - a 1959 Topps Al Pilarcik #7 was saved as "Cal Ripken Jr."
 *
 * The common factor is that on vintage sports the MODEL'S YEAR IS A GUESS. The
 * © line is 5pt type on a 65-year-old cardboard back; repeat runs of one card
 * spread across 1958-1961. yearGuard can only check the model against its own
 * transcription, so a confident misread survives it.
 *
 * The checklist gives an INDEPENDENT signal. Player + set + card number is
 * enough to identify a vintage card uniquely in the SportsCardsPro catalogue,
 * and the catalogue's set name carries the year ("Baseball Cards 1960 Topps").
 * We deliberately do NOT pass the model's year into the search — passing it
 * would let the wrong year select the wrong set and confirm itself.
 *
 * This never renames a card. When the catalogue's player disagrees with the
 * model's, the answer is "flag it for review", not "trust the catalogue" —
 * the number could be the thing that was misread.
 */

import { searchSportsCardPrices } from '@/lib/priceCharting';

export interface SportsChecklistInput {
  playerName?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  /** The model's proposed year — logged for comparison, never sent to the API. */
  modelYear?: string | null;
}

export interface SportsChecklistResult {
  /** Four-digit year parsed out of the catalogue set name, e.g. "1960". */
  year: string | null;
  /** Catalogue set name, e.g. "Baseball Cards 1960 Topps". */
  setName: string | null;
  /** Catalogue product name, e.g. "Mickey Mantle #350". */
  productName: string | null;
  /** Does the catalogue product name name the same player the model read? */
  playerAgrees: boolean;
  confidence: 'high' | 'medium' | 'none';
  note: string;
}

/** Hard ceiling on the lookup — identification must never hang on pricing. */
const TIMEOUT_MS = 6000;

const NONE = (note: string): SportsChecklistResult => ({
  year: null,
  setName: null,
  productName: null,
  playerAgrees: false,
  confidence: 'none',
  note,
});

/** Kill switch: SPORTS_CHECKLIST_ENABLED=0 disables. Default ON. */
export function isSportsChecklistEnabled(): boolean {
  const raw = process.env.SPORTS_CHECKLIST_ENABLED;
  if (raw == null || raw === '') return true;
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
}

/** "Baseball Cards 1960 Topps" → "1960". */
export function parseYearFromSetName(setName: string | null | undefined): string | null {
  if (!setName) return null;
  const m = String(setName).match(/\b((?:1[89]|20)\d{2})\b/);
  return m ? m[1] : null;
}

function normalizeName(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/\[.*?\]/g, ' ')      // parallel markers: "[Refractor]"
    .replace(/#\S+/g, ' ')         // card number: "#350"
    .replace(/\b(jr|sr|ii|iii|iv|rc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lenient player comparison: case/punctuation-insensitive, and a shared last
 * name is enough. Catalogue names differ from card faces in initials and
 * suffixes ("C.J. Stroud" / "CJ Stroud", "Ken Griffey Jr"), so an exact match
 * would reject far more true matches than false ones. A LAST-NAME disagreement
 * is the signal we actually want ("Pilarcik" vs "Ripken").
 */
export function playerNamesAgree(
  modelName: string | null | undefined,
  productName: string | null | undefined,
): boolean {
  const a = normalizeName(modelName || '');
  const b = normalizeName(productName || '');
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const aParts = a.split(' ').filter(p => p.length > 1);
  const bParts = b.split(' ').filter(p => p.length > 1);
  if (aParts.length === 0 || bParts.length === 0) return false;
  const aLast = aParts[aParts.length - 1];
  return bParts.includes(aLast);
}

/** Do the catalogue product name and the supplied number refer to one card? */
function productCarriesNumber(productName: string, cardNumber: string): boolean {
  const clean = cardNumber.trim().replace(/^#+/, '');
  if (!clean) return false;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Boundary-aware so "#35" does not satisfy "#350".
  return new RegExp(`(^|[^a-z0-9])#?${escaped}([^a-z0-9]|$)`, 'i').test(productName);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sportsChecklist timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Look the card up in the SportsCardsPro checklist and report what year that
 * checklist says it is. Never throws; every failure path returns 'none'.
 *
 * NOTE: no retry. A rate limit or an outage means "no answer this run" — the
 * pricing layer already has its own backoff and identification must not add
 * load on top of it.
 */
export async function resolveSportsChecklist(
  input: SportsChecklistInput,
): Promise<SportsChecklistResult> {
  const playerName = (input.playerName || '').trim();
  if (!playerName) return NONE('no player name supplied');
  if (!isSportsChecklistEnabled()) return NONE('SPORTS_CHECKLIST_ENABLED=0');

  const cardNumber = (input.cardNumber || '').trim() || undefined;
  const setName = (input.setName || '').trim() || undefined;

  try {
    const result = await withTimeout(
      searchSportsCardPrices({
        playerName,
        setName,
        cardNumber,
        // Deliberately NO year — see the file header. The model's year is the
        // thing under test; feeding it in would let it confirm itself.
      }),
      TIMEOUT_MS,
    );

    const prices = result?.prices;
    if (!prices || !prices.productName) return NONE('no checklist product matched');

    const productName = prices.productName;
    const catalogSetName = prices.setName || null;
    const year = parseYearFromSetName(catalogSetName);
    const playerAgrees = playerNamesAgree(playerName, productName);

    if (!playerAgrees) {
      return {
        year,
        setName: catalogSetName,
        productName,
        playerAgrees: false,
        confidence: 'none',
        note: `checklist product "${productName}" is not "${playerName}" — identification disputed`,
      };
    }

    if (!year) {
      return {
        year: null,
        setName: catalogSetName,
        productName,
        playerAgrees: true,
        confidence: 'none',
        note: `no year in checklist set name ${JSON.stringify(catalogSetName)}`,
      };
    }

    const numberConfirmed = !!cardNumber && productCarriesNumber(productName, cardNumber);
    return {
      year,
      setName: catalogSetName,
      productName,
      playerAgrees: true,
      confidence: numberConfirmed ? 'high' : 'medium',
      note: numberConfirmed
        ? `checklist: ${productName} — ${catalogSetName} (year ${year}${
            input.modelYear && input.modelYear !== year ? `, model said ${input.modelYear}` : ''
          })`
        : `checklist matched ${productName} on player/set only; card number ${
            cardNumber ? `"${cardNumber}" not confirmed` : 'not supplied'
          }`,
    };
  } catch (err: any) {
    return NONE(`checklist lookup failed: ${err?.message || String(err)}`);
  }
}
