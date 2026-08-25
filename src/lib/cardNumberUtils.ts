// src/lib/cardNumberUtils.ts
// Shared helpers for rescuing single-digit card-number misreads.
//
// The vision model occasionally misreads exactly one digit of a printed card
// number (customer case Jul 27: "227" for a card printed 127/094 — a 1↔2
// confusion). When the card NAME matches database candidates and exactly one
// candidate's number differs from the AI's number by a single character in
// the same position, that is overwhelmingly an OCR-class misread. Ambiguity
// (zero or 2+ such candidates) must keep the AI value.

/** True when a and b are the same length and differ in exactly one position. */
export function oneDigitOff(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? '').trim().toUpperCase();
  const y = String(b ?? '').trim().toUpperCase();
  if (!x || !y || x.length !== y.length || x === y) return false;
  let diffs = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) { diffs++; if (diffs > 1) return false; }
  }
  return diffs === 1;
}

/**
 * Number of differing positions between two same-length strings (case-insensitive),
 * or Infinity when lengths differ or either is empty.
 */
export function positionsOff(a: string | null | undefined, b: string | null | undefined): number {
  const x = String(a ?? '').trim().toUpperCase();
  const y = String(b ?? '').trim().toUpperCase();
  if (!x || !y || x.length !== y.length) return Infinity;
  let diffs = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diffs++;
  return diffs;
}

/**
 * Among candidates, find the ONE whose number is a single-character variant
 * of the AI-extracted number. Returns null unless exactly one qualifies.
 * `maxDiffs` widens the tolerance (e.g. 2 for a set-code prefix misread such as
 * "PHNI" for "PHRE") — only use a wider tolerance when the card NAME has
 * already matched strongly, otherwise ambiguity climbs fast.
 */
export function findUniqueDigitVariant<T>(
  candidates: T[],
  getNumber: (c: T) => string | null | undefined,
  aiNumber: string | null | undefined,
  maxDiffs: number = 1
): T | null {
  if (!aiNumber) return null;
  const hits = candidates.filter(c => {
    const d = positionsOff(aiNumber, getNumber(c));
    return d >= 1 && d <= maxDiffs;
  });
  return hits.length === 1 ? hits[0] : null;
}
