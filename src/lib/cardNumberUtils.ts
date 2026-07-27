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
 * Among candidates, find the ONE whose number is a single-character variant
 * of the AI-extracted number. Returns null unless exactly one qualifies.
 */
export function findUniqueDigitVariant<T>(
  candidates: T[],
  getNumber: (c: T) => string | null | undefined,
  aiNumber: string | null | undefined
): T | null {
  if (!aiNumber) return null;
  const hits = candidates.filter(c => oneDigitOff(aiNumber, getNumber(c)));
  return hits.length === 1 ? hits[0] : null;
}
