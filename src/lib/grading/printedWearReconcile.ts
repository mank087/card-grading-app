/**
 * Printed-wear reconciliation (Oct 2026, v9.37; on by default, PRINTED_WEAR_RECONCILE=off is the kill switch).
 *
 * The zoom findings verifier (zoomVerifier.ts, v9.36) removes zoom flags that are
 * printing, but the three whole-card evaluations make the same misread on their
 * own: an MTG Smaug with a printed distressed frame (true grade 10) came back
 * 4-5 on "heavy edge whitening" / "heavy rounding" with ZERO zoom findings left.
 * A rubric rule (v9.33) did not move them.
 *
 * No new model call. Two witnesses that already ran have to agree:
 *   1. the card's printing reads as wear - the zoom verifier dropped at least
 *      MIN_PRINTED_DROPS corner/edge flags (distinct crops) as printed_design;
 *   2. the magnified inspection does not see that wear - every crop of the
 *      category was inspected and no moderate/heavy finding survives in it.
 * Then a corners/edges score at or below MAX_LIFTED_SCORE takes what the magnified
 * inspection supports: 9, or a lower zoom face cap. A verifier built to judge the
 * evaluations' own corner/edge claims was tried in Sept (severeScoreCheck.ts) and
 * cleared real worn corners 36% of the time, which is why this one does not ask a
 * model whether wear is real.
 *
 * Never applies to a card in a rigid holder (zoom cosmetic caps are skipped there),
 * with confirmed structural damage, or when the zoom pass did not run cleanly.
 * Pure.
 */

export function printedWearReconcileEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.PRINTED_WEAR_RECONCILE ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false');
}

export const MIN_PRINTED_DROPS = 2;
/** Only real deductions are reconsidered; an 8 is left to the normal gates. */
export const MAX_LIFTED_SCORE = 7;
export const RECONCILED_SCORE = 9;

type Cat = 'corners' | 'edges';

export interface PrintedWearInput {
  scores: Record<Cat, number>;
  zoomOk: boolean;
  zoomDefects: Array<{ category: string; severity: string; region: string }>;
  verifierDropped: Array<{ category: string; cls: string; region: string }>;
  uninspectedRegions: string[];
  /** Applied zoom face caps, e.g. { edges_front: 9 }. */
  appliedFaceCaps: Record<string, number>;
  rigidCase: boolean;
  structuralDetected: boolean;
}

export interface PrintedWearLift { cat: Cat; from: number; to: number; printedRegions: string[] }

export function printedWearLifts(input: PrintedWearInput): PrintedWearLift[] {
  if (!input.zoomOk || input.rigidCase || input.structuralDetected) return [];
  const printedRegions = [...new Set(input.verifierDropped
    .filter(d => d.cls === 'printed_design' && (d.category === 'corners' || d.category === 'edges'))
    .map(d => d.region))];
  if (printedRegions.length < MIN_PRINTED_DROPS) return [];
  const lifts: PrintedWearLift[] = [];
  for (const cat of ['corners', 'edges'] as const) {
    const score = input.scores[cat];
    if (typeof score !== 'number' || score > MAX_LIFTED_SCORE) continue;
    const kind = cat === 'corners' ? '-COR-' : '-EDG-';
    if (input.uninspectedRegions.some(r => r.includes(kind))) continue;
    if (input.zoomDefects.some(d => d.category === cat && d.severity !== 'minor')) continue;
    const caps = ['front', 'back'].map(f => input.appliedFaceCaps[`${cat}_${f}`]).filter((n): n is number => typeof n === 'number');
    const to = Math.min(RECONCILED_SCORE, ...caps);
    if (to > score) lifts.push({ cat, from: score, to, printedRegions });
  }
  return lifts;
}
