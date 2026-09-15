/**
 * consensusExplain.ts — say WHY a displayed subgrade sits below the numbers in
 * the three-pass table.
 *
 * ── The failure this exists for ────────────────────────────────────────────
 * Measured in production 2026-09-15: 22% of recent cards showed the three-pass
 * table with centering 10 / 10 / 10 and a consensus row of 9, with nothing on
 * the page explaining the gap. Two separate mechanisms produce it:
 *
 *   1. The FACE-LEVEL CLAMP (visionGrader Step 3.5). Each whole-card pass scores
 *      a category holistically; the detailed per-face sections score it front
 *      and back. Weakest-link says the category is MIN(front, back), so a front
 *      section scored 9 pulls the category to 9 even when all three whole-card
 *      passes said 10. That clamp logged to the console and nowhere else.
 *
 *   2. The GATE DRAG. The uncertainty and rigid-case gates hold a 10 at 9 for a
 *      reason about evidence QUALITY, and the weakest-link display invariant
 *      then drags every tile down to match. The summary carried the reason; the
 *      tiles did not, so four tiles silently moved from 10 to 9.
 *
 * Both are correct arithmetic. Neither was legible. These are pure string
 * builders over plain data so the wording is unit-tested rather than reasoned
 * about inside a 3,500-line grading path.
 *
 * Nothing here decides a grade. It only describes one that has already settled.
 */

export type ExplainCategory = 'centering' | 'corners' | 'edges' | 'surface';

/** Longest quoted fragment of the model's own prose we will repeat in a note. */
export const MAX_QUOTED_CHARS = 200;

const CATEGORY_LABEL: Record<ExplainCategory, string> = {
  centering: 'Centering',
  corners: 'Corners',
  edges: 'Edges',
  surface: 'Surface',
};

/**
 * First sentence of a face section's prose, trimmed to MAX_QUOTED_CHARS.
 *
 * Returns '' when there is nothing usable, and every caller treats '' as "say
 * the numbers and stop" rather than emitting a dangling quote. Truncation cuts
 * at a word boundary where one is available and always ends in a period, so the
 * note never reads as though the sentence simply ran out.
 */
export function firstSentence(text: unknown, max: number = MAX_QUOTED_CHARS): string {
  if (typeof text !== 'string') return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  // Sentence end = . ! ? followed by whitespace or end of string. Decimal
  // scores ("9.5/10") and ratios are not sentence ends.
  const m = flat.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let s = (m ? m[0] : flat).trim();
  if (s.length > max) {
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
    s = s.replace(/[.,;:!?\-–]+$/, '');
    return `${s}.`;
  }
  if (!/[.!?]$/.test(s)) s = `${s}.`;
  return s;
}

/** How the three whole-card evaluations scored one category. */
function passPhrase(passScores: number[]): string {
  const scores = passScores.filter(n => typeof n === 'number' && Number.isFinite(n));
  if (scores.length === 0) return 'the whole-card evaluations scored it higher';
  const uniq = Array.from(new Set(scores));
  if (uniq.length === 1) {
    return scores.length === 1
      ? `the whole-card evaluation scored it ${uniq[0]}`
      : `each whole-card evaluation scored it ${uniq[0]}`;
  }
  return `the whole-card evaluations scored it ${scores.join(', ')}`;
}

export interface ClampNoteInput {
  cat: ExplainCategory;
  /** The face that carried the lower score. */
  face: 'front' | 'back';
  /** That face's score. */
  faceScore: number;
  /** The consensus actually displayed for the category. */
  consensus: number;
  /** RAW per-pass category scores, captured before any mutation. */
  passScores: number[];
  /** The face section's own prose (centering: `analysis`; others: `summary`). */
  detail?: string | null;
}

/**
 * The consensus note for a face-level clamp.
 *
 * Example:
 *   "Centering consensus is 9 although each whole-card evaluation scored it 10:
 *    the detailed front assessment scored 9. The left border is close to twice
 *    the width of the right."
 */
export function buildClampNote(input: ClampNoteInput): string {
  const label = CATEGORY_LABEL[input.cat] ?? input.cat;
  const head =
    `${label} consensus is ${input.consensus} although ${passPhrase(input.passScores)}: ` +
    `the detailed ${input.face} assessment scored ${input.faceScore}.`;
  const quoted = firstSentence(input.detail);
  return quoted ? `${head} ${quoted}` : head;
}

/**
 * Why a category might already be explained elsewhere on the page, in which
 * case a second note only repeats it in different words.
 *
 * Every flag here corresponds to text the customer can already read:
 *   zoomCapped        — the magnified-inspection addendum on the face prose
 *   structuralCapped  — the structural-damage notice and the capped summary
 *   dissentReflected  — the v9.9 unanimity consensus note naming the category
 *   gateDragged       — the gate-drag note built below, which covers the tile
 *
 * Nothing here looks at WHY the clamp happened; it only asks whether the gap is
 * already accounted for.
 */
export interface AlreadyExplainedInput {
  zoomCapped?: boolean;
  structuralCapped?: boolean;
  dissentReflected?: boolean;
  gateDragged?: boolean;
}

export function isAlreadyExplained(input: AlreadyExplainedInput): boolean {
  return Boolean(
    input.zoomCapped || input.structuralCapped || input.dissentReflected || input.gateDragged,
  );
}

/** Join a list as "a, b and c" (no Oxford comma, matching the rest of the prose). */
function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export interface GateDragNoteInput {
  /** Categories whose displayed tile moved, with the score they held before. */
  moved: Array<{ cat: ExplainCategory; from: number }>;
  /** The value every moved tile now shows (the held grade). */
  shown: number;
  /** The gate's own reason, reused verbatim so the two texts cannot drift. */
  reason: string;
}

/**
 * The consensus note for tiles dragged down to match a held grade.
 *
 * Example:
 *   "Subgrades shown at 9 to match the held grade: the evaluations scored
 *    corners, edges and surface at 10, but the grade is held at 9 because the
 *    photos are not clear enough to confirm a 10."
 */
export function buildGateDragNote(input: GateDragNoteInput): string | null {
  if (!input.moved.length) return null;
  const byScore = new Map<number, ExplainCategory[]>();
  for (const m of input.moved) {
    const list = byScore.get(m.from) ?? [];
    list.push(m.cat);
    byScore.set(m.from, list);
  }
  const clauses = Array.from(byScore.entries()).map(
    ([from, cats]) => `${joinList(cats)} at ${from}`,
  );
  const reason = input.reason.trim().replace(/[.\s]+$/, '');
  return (
    `Subgrades shown at ${input.shown} to match the held grade: the evaluations scored ` +
    `${joinList(clauses)}, but the grade is held at ${input.shown} because ${reason}.`
  );
}
