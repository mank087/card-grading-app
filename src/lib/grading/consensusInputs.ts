/**
 * Consensus inputs (Oct 2026, v9.38; on by default, CONSENSUS_INPUTS_V1=0 is the kill switch).
 *
 * THE PROBLEM. The grader runs three independent evaluations and takes per-category
 * medians, then picks ONE "base" completion (the median-pick) whose JSON becomes the
 * stored report. Several inputs that move the grade were read from that single base
 * while the design claims three:
 *   - raw_sub_scores (per-face scores). Step 3.5 clamps each category to MIN(front, back)
 *     of the BASE's faces. Measured Sept 15: 22% of cards showed passes 10/10/10 above a
 *     consensus 9 from this clamp - the base reported weighted 10 with faces 10/9 while
 *     the other two reported 10/10.
 *   - the per-category prose sections, so the words could describe a different
 *     evaluation from the one whose score is shown (centering ratios included, which the
 *     centering policy reads).
 *   - image_quality.confidence_letter. A C or D letter maps to uncertainty >= 2, which
 *     blocks every 10, so one completion's impression decided.
 *   - case_detection. caseConsensus already majority-votes RIGID holders, but when the
 *     majority is not rigid the base's own reading was stored and shown (Oct 14 customer
 *     case: no sleeve, the report said "penny sleeve").
 *
 * THE RULE.
 *   1. Per category, the face pair (and that category's section object) comes from an
 *      evaluation whose category score equals the consensus median. Faces are never mixed
 *      across evaluations: pairs (10,8),(8,10),(10,10) have face medians 10/10 (min 10)
 *      but per-pass minimums 8/8/10 (median 8); a coherent pair keeps the 8 honest.
 *      Among the qualifying evaluations one whose own pair minimum also equals the median
 *      is preferred (so Step 3.5 has nothing to clamp), then the base, then pass order.
 *      Step 3.5 runs unchanged afterwards and still clamps (and explains) when every
 *      qualifying evaluation's faces sit below its own category score.
 *   2. The confidence letter is the median of the three on A<B<C<D. No single-letter veto:
 *      one C among B, B is noise like any other lone dissent.
 *   3. The stored case_detection follows the majority case_type, taken from an evaluation
 *      that agrees with caseConsensus's rigid decision (which is unchanged).
 *   4. Gem gate: a majority 10 whose dissent named no defect (majorityTenAwarded) is not
 *      blocked by the spread of the pass finals. Letter C/D, clipped corners, uninspected
 *      regions, unconfirmed structural flags and rigid holders still hold it. The
 *      displayed +/- range still includes the spread.
 *
 * Everything here is pure (applyConsensusInputs mutates only the object it is given).
 */
import { isRigidCase, type CaseDetection } from './caseConsensus';

export type ConsensusCat = 'centering' | 'corners' | 'edges' | 'surface';
export const CONSENSUS_CATS: readonly ConsensusCat[] = ['centering', 'corners', 'edges', 'surface'];
export const CONSENSUS_INPUTS_VERSION = 'consensus-inputs-v1';

/** On unless CONSENSUS_INPUTS_V1 is '0', 'off' or 'false' (same shape as STRUCTURAL_V2). */
export function consensusInputsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.CONSENSUS_INPUTS_V1 ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false');
}

// ── 1. Per-category donor ──────────────────────────────────────────────────

export interface DonorCandidate {
  /** The category score shown in this evaluation's pass row. */
  score: number | null | undefined;
  front: unknown;
  back: unknown;
}

const isFace = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Index (0-based) of the evaluation that donates this category's face pair, or null
 * when no evaluation both matches the consensus and carries a usable pair.
 * Preference: matches AND its own pair minimum equals the target (base first, then pass
 * order); otherwise matches (base first, then pass order).
 */
export function chooseDonor(target: number, candidates: DonorCandidate[], baseIndex: number): number | null {
  const qualifies = (c: DonorCandidate | undefined) =>
    !!c && c.score === target && isFace(c.front) && isFace(c.back);
  const coherent = (c: DonorCandidate | undefined) =>
    qualifies(c) && Math.min(c!.front as number, c!.back as number) === target;
  const order = [baseIndex, ...candidates.map((_, i) => i).filter(i => i !== baseIndex)];
  for (const test of [coherent, qualifies]) {
    const hit = order.find(i => test(candidates[i]));
    if (hit !== undefined) return hit;
  }
  return null;
}

// ── 2. Confidence letter ───────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'] as const;
export const normaliseLetter = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return (LETTERS as readonly string[]).includes(s) ? s : null;
};

export interface LetterConsensus {
  votes: Array<string | null>;
  chosen: string | null;
  /** True when chosen differs from the base's own (normalised) letter. */
  changed: boolean;
}

/**
 * The median letter on A<B<C<D. Missing / unreadable letters are ignored; with fewer
 * than two letters the base's letter stands. With exactly two that disagree there is no
 * middle, so the base's letter stands when it is one of them, otherwise the worse one.
 */
export function medianLetter(letters: unknown[], baseLetter: unknown): LetterConsensus {
  const votes = letters.map(normaliseLetter);
  const base = normaliseLetter(baseLetter);
  const valid = votes.filter((v): v is string => v !== null).sort();
  let chosen: string | null = base;
  if (valid.length >= 3) chosen = valid[Math.floor((valid.length - 1) / 2)];
  else if (valid.length === 2) chosen = valid[0] === valid[1] ? valid[0] : (base && valid.includes(base) ? base : valid[1]);
  return { votes, chosen, changed: chosen !== base && chosen !== null };
}

// ── 3. Holder reading ──────────────────────────────────────────────────────

/** 'Penny Sleeve' / 'penny-sleeve' -> 'penny_sleeve'; null / '' -> 'none'. */
export function normaliseCaseType(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return s === '' || s === 'null' ? 'none' : s;
}

export interface CaseMajority {
  /** Normalised case_type per evaluation; null when the evaluation returned no block. */
  votes: Array<string | null>;
  /** The majority case_type, or null when there is none. */
  majority: string | null;
  /** Index of the evaluation whose case_detection should be stored, or null to keep the current one. */
  index: number | null;
}

/**
 * Majority case_type across the evaluations that returned a case_detection block. The
 * stored block must agree with the rigid decision caseConsensus made (`rigid`), so a
 * winning-type evaluation whose impact level would flip isRigidCase is skipped. The
 * `current` block (what caseConsensus chose) is kept when it already has the majority type.
 */
export function majorityCase(
  detections: Array<CaseDetection | null | undefined>,
  current: CaseDetection | null | undefined,
  rigid: boolean,
  baseIndex: number,
): CaseMajority {
  const votes = detections.map(d => (d && typeof d === 'object' ? normaliseCaseType(d.case_type) : null));
  const cast = votes.filter((v): v is string => v !== null);
  const majority = cast.find(t => cast.filter(v => v === t).length * 2 > cast.length && cast.filter(v => v === t).length >= 2) ?? null;
  if (!majority) return { votes, majority, index: null };
  if (current && typeof current === 'object' && normaliseCaseType(current.case_type) === majority && isRigidCase(current) === rigid) {
    return { votes, majority, index: null };
  }
  const order = [baseIndex, ...detections.map((_, i) => i).filter(i => i !== baseIndex)];
  const hit = order.find(i => votes[i] === majority && isRigidCase(detections[i]) === rigid);
  return { votes, majority, index: hit ?? null };
}

// ── 4. Gem gate ────────────────────────────────────────────────────────────

export interface GemGateInput {
  enabled: boolean;
  finalGrade: number;
  uninspectedRegions: number;
  letterUncertainty: number;
  passSpread: number;
  clampLowered: number;
  structuralUncertainty: number;
  rigidCase: boolean;
  unanimous10: boolean;
  majorityTenAwarded: boolean;
}

export interface GemGateDecision {
  /** The uncertainty the 10-gate reads. Equals the displayed value unless the spread was set aside. */
  gateUncertainty: number;
  /** The spread alone would have blocked this majority 10 and was set aside. */
  spreadIgnored: boolean;
  /** Spread to hand the hold explainer (0 when it was set aside, so it names the true cause). */
  explainSpread: number;
  /** The 10 is held at 9. */
  hold: boolean;
}

export function gemGateDecision(i: GemGateInput): GemGateDecision {
  const displayed = Math.min(3, Math.max(i.letterUncertainty, i.passSpread, i.clampLowered, i.structuralUncertainty));
  const setAside = i.enabled && i.majorityTenAwarded;
  const gateUncertainty = setAside
    ? Math.min(3, Math.max(i.letterUncertainty, i.clampLowered, i.structuralUncertainty))
    : displayed;
  const hold = i.finalGrade === 10 && (i.uninspectedRegions > 0 || gateUncertainty >= 2 || i.rigidCase || (!i.unanimous10 && !i.majorityTenAwarded));
  return {
    gateUncertainty,
    spreadIgnored: setAside && displayed >= 2 && gateUncertainty < 2,
    explainSpread: setAside ? 0 : i.passSpread,
    hold,
  };
}

// ── Applying it to the report ─────────────────────────────────────────────

export interface ConsensusInputsRecord {
  version: typeof CONSENSUS_INPUTS_VERSION;
  /** 1-based evaluation index per category. */
  donors: Partial<Record<ConsensusCat, number>>;
  letter: { votes: Array<string | null>; chosen: string | null };
  case: { votes: Array<string | null>; chosen: string | null };
  gate?: { majority_award: boolean; spread_ignored: boolean };
}

export interface ApplyConsensusInputsArgs {
  /** The base completion's JSON (the stored report). Mutated in place. */
  jsonData: any;
  /** The three evaluations' JSON, in pass order. Never mutated. */
  completions: any[];
  /** Pass-row category scores per evaluation, in pass order. */
  passScores: Array<Partial<Record<ConsensusCat, number | null>>>;
  /** The consensus value per category before Step 3.5 (serverRounded). */
  targets: Record<ConsensusCat, number>;
  baseIndex: number;
  /** caseConsensus's rigid decision (unchanged by this module). */
  holderRigid: boolean;
}

export interface ApplyConsensusInputsResult {
  record: ConsensusInputsRecord;
  /** Categories whose faces/section came from a non-base evaluation, with the 0-based donor. */
  changedCats: Array<{ cat: ConsensusCat; donor: number }>;
  letterChanged: boolean;
  caseChanged: boolean;
  /** One consensus note, or null when nothing differs from the base. */
  note: string | null;
}

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

export function applyConsensusInputs(a: ApplyConsensusInputsArgs): ApplyConsensusInputsResult {
  const { jsonData, completions, passScores, targets, baseIndex, holderRigid } = a;
  const donors: ConsensusInputsRecord['donors'] = {};
  const changedCats: ApplyConsensusInputsResult['changedCats'] = [];

  // 1. Face pairs + prose sections.
  for (const cat of CONSENSUS_CATS) {
    const candidates = completions.map((j, i) => ({
      score: passScores[i]?.[cat],
      front: j?.raw_sub_scores?.[`${cat}_front`],
      back: j?.raw_sub_scores?.[`${cat}_back`],
    }));
    const donor = chooseDonor(targets[cat], candidates, baseIndex);
    if (donor === null) continue;
    donors[cat] = donor + 1;
    if (donor === baseIndex) continue;
    const src = completions[donor];
    jsonData.raw_sub_scores = { ...(jsonData.raw_sub_scores || {}),
      [`${cat}_front`]: src.raw_sub_scores[`${cat}_front`], [`${cat}_back`]: src.raw_sub_scores[`${cat}_back`] };
    // Cloned: later steps (zoom prose addenda, centering policy) edit the stored
    // section in place and must not reach back into the donor's pass record.
    if (src[cat] !== undefined) jsonData[cat] = clone(src[cat]);
    changedCats.push({ cat, donor });
  }

  // 2. Confidence letter (base's other image_quality fields kept).
  const baseLetter = jsonData.image_quality?.confidence_letter;
  const letter = medianLetter(completions.map(j => j?.image_quality?.confidence_letter), baseLetter);
  if (letter.changed) {
    jsonData.image_quality = { ...(jsonData.image_quality || {}), confidence_letter: letter.chosen };
  }

  // 3. Holder reading.
  const caseBefore = normaliseCaseType(jsonData.case_detection?.case_type);
  const cm = majorityCase(completions.map(j => j?.case_detection), jsonData.case_detection, holderRigid, baseIndex);
  let caseChanged = false;
  if (cm.index !== null) {
    jsonData.case_detection = clone(completions[cm.index].case_detection);
    caseChanged = normaliseCaseType(jsonData.case_detection?.case_type) !== caseBefore;
  }

  const record: ConsensusInputsRecord = {
    version: CONSENSUS_INPUTS_VERSION,
    donors,
    letter: { votes: letter.votes, chosen: normaliseLetter(jsonData.image_quality?.confidence_letter) },
    case: { votes: cm.votes, chosen: jsonData.case_detection ? normaliseCaseType(jsonData.case_detection.case_type) : null },
  };
  const note = consensusInputsNote({ changedCats, letter: letter.changed ? letter : null, caseVotes: caseChanged ? cm.votes : null, caseChosen: record.case.chosen });
  return { record, changedCats, letterChanged: letter.changed, caseChanged, note };
}

const human = (s: string) => s.replace(/_/g, ' ');
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function consensusInputsNote(p: {
  changedCats: Array<{ cat: ConsensusCat; donor: number }>;
  letter: LetterConsensus | null;
  caseVotes: Array<string | null> | null;
  caseChosen: string | null;
}): string | null {
  const parts: string[] = [];
  if (p.changedCats.length) {
    const donorsUsed = [...new Set(p.changedCats.map(c => c.donor))];
    parts.push(donorsUsed.length === 1
      ? `Per-face scores and notes for ${joinAnd(p.changedCats.map(c => c.cat))} were taken from the evaluation that matched the consensus (evaluation ${donorsUsed[0] + 1})`
      : `Per-face scores and notes were taken from the evaluation that matched the consensus in each category (${p.changedCats.map(c => `${c.cat}: evaluation ${c.donor + 1}`).join('; ')})`);
  }
  if (p.letter) {
    parts.push(`the photo-confidence letter is the median of the three (${p.letter.votes.map(v => v ?? '-').join(', ')} → ${p.letter.chosen})`);
  }
  if (p.caseVotes && p.caseChosen) {
    parts.push(`the holder reading follows the majority of the three (${p.caseVotes.map(v => (v ? human(v) : '-')).join(', ')} → ${human(p.caseChosen)})`);
  }
  if (!parts.length) return null;
  const text = parts.join('; ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/** Sentence appended to the majority-10 note when the spread was set aside. */
export function spreadIgnoredSentence(uncertainty: number, finals: [number, number, number]): string {
  return ` The ±${uncertainty} range still reflects the spread of the three evaluations (${finals.join('/')}); the dissent named no defect, so that spread did not hold the 10.`;
}
