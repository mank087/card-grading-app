/**
 * Structural-cap check (Oct 2026).
 *
 * A confirmed crease/bend caps a grade at 4. An audit of 21 random capped cards
 * found about half were not damage (sticker backing splits, factory "bend and
 * peel" corners, Garbage Pail Kids peel-cut lines, printed lines in the art), and
 * the crease verifier had voted 3/3 "physical damage" on every one. Until the
 * detector is fixed, a structural cap that costs 3 or more grade points is sent
 * to a person: the grade stands as the engine decided, the customer summary says
 * the team will double-check it, and an admin either confirms the crease or
 * removes the cap from /admin/structural-checks.
 *
 * Where the flag lives (no schema change):
 *   report.structural_check          full record, inside conversational_grading
 *   capture_quality.structural_check  small mirror the admin list filters on
 *                                     (capture_quality->structural_check->>status).
 * capture_quality is jsonb, server-owned and rewritten by every new grade's
 * preflight, so a regrade drops a stale mirror. conversational_card_info was not
 * used: the regrade identity guard carries the stored value forward.
 *
 * Everything in this file is pure; the writers live in structuralCheckServer.ts
 * and the admin route.
 */
import { buildManualResult } from './manualReview';

export const STRUCTURAL_CHECK_MIN_DROP = 3;
import { STRUCTURAL_CHECK_SENTENCE, STRUCTURAL_CLEARED_NOTE, STRUCTURAL_CONFIRMED_SENTENCE } from './structuralCheckText';
export { STRUCTURAL_CHECK_SENTENCE, STRUCTURAL_CLEARED_NOTE, STRUCTURAL_CONFIRMED_SENTENCE };

/** 'stale': the mirror said pending but the card's report no longer does (regraded, or a harness run). */
export type StructuralCheckStatus = 'pending' | 'confirmed' | 'cleared' | 'stale';
const FACE_KEYS = ['centering_front', 'centering_back', 'corners_front', 'corners_back', 'edges_front', 'edges_back', 'surface_front', 'surface_back'] as const;
export type FaceScores = Record<typeof FACE_KEYS[number], number>;

export interface StructuralCheck {
  status: StructuralCheckStatus;
  uncapped_grade: number;
  capped_grade: number;
  /** The eight face scores without the structural clamp; "remove cap" applies exactly these. */
  uncapped_scores: FaceScores;
  flagged_at: string;
  evidence: string;
  resolved_by?: string;
  resolved_at?: string;
}
/** The slice mirrored into capture_quality for the admin list. */
export interface StructuralCheckMirror {
  status: StructuralCheckStatus;
  uncapped_grade: number;
  capped_grade: number;
  flagged_at: string;
  evidence: string;
  resolved_at?: string;
}

const obj = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10;
const clip = (text: unknown, max: number) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** The eight face scores, or null when any is missing or not a whole 1-10. */
export function faceScoresOf(value: unknown): FaceScores | null {
  const raw = obj(value);
  if (!FACE_KEYS.every(key => isScore(raw[key]))) return null;
  return Object.fromEntries(FACE_KEYS.map(key => [key, raw[key]])) as FaceScores;
}
/** The grade buildManualResult produces from these face scores with cap 10. */
export function gradeFromFaceScores(scores: FaceScores): number {
  return Math.min(...(['centering', 'corners', 'edges', 'surface'] as const).map(c => Math.min(scores[`${c}_front`], scores[`${c}_back`])));
}

/** "crease on back upper-left: thin line..." for each finding, plus who saw it. */
export function structuralEvidence(input: { structuralDamage?: unknown; votes: number; passes: number; zoom: boolean }): string {
  const sd = obj(input.structuralDamage);
  const findings = (Array.isArray(sd.findings) ? sd.findings : []).slice(0, 3).map((f: unknown) => {
    const finding = obj(f);
    const what = clip(finding.type || 'structural damage', 30);
    const where = clip(finding.location || finding.face || '', 60);
    const detail = clip(finding.description || '', 140);
    return `${what}${where ? ` at ${where}` : ''}${detail ? `: ${detail}` : ''}`;
  });
  if (!findings.length && sd.description) findings.push(clip(sd.description, 200));
  const seenBy = `${input.votes}/${input.passes} evaluations${input.zoom ? ' + magnified zoom' : ''}`;
  const verifier = sd.verification ? ` Verifier: ${clip(sd.verification, 160)}` : '';
  return clip(`${(findings.join('; ') || 'Structural damage flagged').replace(/[.\s]+$/, '')}. Seen by ${seenBy}.${verifier}`, 600);
}

/**
 * Should this grade be sent to a person? Only when a structural cap applied and
 * it cost STRUCTURAL_CHECK_MIN_DROP or more against the grade the face scores
 * give without it. `finalScores` are the report's final raw_sub_scores (surface
 * clamped); `preCapSurface` are the surface faces just before the clamp.
 */
export function buildStructuralCheck(input: {
  structuralDetected: boolean;
  finalGrade: number;
  finalScores: unknown;
  preCapSurface: { front: unknown; back: unknown };
  evidence: string;
  now?: Date;
}): StructuralCheck | null {
  if (!input.structuralDetected || !isScore(input.finalGrade)) return null;
  const final = faceScoresOf(input.finalScores);
  if (!final) return null;
  const uncapped: FaceScores = { ...final };
  // Only restore what the clamp took away; a face already at or below the cap keeps its score.
  if (isScore(input.preCapSurface.front) && input.preCapSurface.front > final.surface_front) uncapped.surface_front = input.preCapSurface.front;
  if (isScore(input.preCapSurface.back) && input.preCapSurface.back > final.surface_back) uncapped.surface_back = input.preCapSurface.back;
  const uncappedGrade = gradeFromFaceScores(uncapped);
  if (uncappedGrade - input.finalGrade < STRUCTURAL_CHECK_MIN_DROP) return null;
  return { status: 'pending', uncapped_grade: uncappedGrade, capped_grade: input.finalGrade, uncapped_scores: uncapped,
    flagged_at: (input.now ?? new Date()).toISOString(), evidence: input.evidence };
}

export function structuralMirror(check: StructuralCheck): StructuralCheckMirror {
  return { status: check.status, uncapped_grade: check.uncapped_grade, capped_grade: check.capped_grade, flagged_at: check.flagged_at,
    evidence: check.evidence, ...(check.resolved_at ? { resolved_at: check.resolved_at } : {}) };
}

/** Append the "will double-check" sentence once. */
export function withStructuralCheckSentence(summary: unknown): string {
  const text = typeof summary === 'string' ? summary.trim() : '';
  if (text.includes(STRUCTURAL_CHECK_SENTENCE)) return text;
  return text ? `${text} ${STRUCTURAL_CHECK_SENTENCE}` : STRUCTURAL_CHECK_SENTENCE;
}
/** Swap the "will double-check" sentence for `replacement` (or drop it). */
export function replaceStructuralCheckSentence(summary: unknown, replacement = ''): string {
  const text = typeof summary === 'string' ? summary : '';
  if (!text.includes(STRUCTURAL_CHECK_SENTENCE)) return replacement && !text.includes(replacement) ? `${text.trim()} ${replacement}`.trim() : text.trim();
  return text.replace(STRUCTURAL_CHECK_SENTENCE, replacement).replace(/\s{2,}/g, ' ').trim();
}

/** The pending check on a stored report, or null. */
export function pendingStructuralCheck(reportText: unknown): { report: Record<string, any>; check: StructuralCheck } | null {
  if (typeof reportText !== 'string') return null;
  let report: unknown;
  try { report = JSON.parse(reportText); } catch { return null; }
  const check = obj(obj(report).structural_check);
  if (check.status !== 'pending') return null;
  return { report: report as Record<string, any>, check: check as StructuralCheck };
}

type Card = Record<string, unknown>;
export interface StructuralPatch { patch: Record<string, unknown>; expectedGrade: number; check: StructuralCheck; afterGrade: number }

function resolved(check: StructuralCheck, status: StructuralCheckStatus, adminId: string, now: Date): StructuralCheck {
  return { ...check, status, resolved_by: adminId, resolved_at: now.toISOString() };
}
function mirrorPatch(card: Card, check: StructuralCheck) {
  return { ...obj(card.capture_quality), structural_check: structuralMirror(check) };
}

/**
 * "Crease confirmed": the grade is unchanged; the report records who confirmed
 * it and the summary sentence becomes STRUCTURAL_CONFIRMED_SENTENCE. Throws
 * 'not_pending' when the card has no pending check (resolved, or regraded).
 */
export function buildStructuralConfirm(card: Card, adminId: string, now = new Date()): StructuralPatch {
  const pending = pendingStructuralCheck(card.conversational_grading);
  if (!pending) throw Error('not_pending');
  const { report } = pending;
  const check = resolved(pending.check, 'confirmed', adminId, now);
  report.structural_check = check;
  if (report.final_grade && typeof report.final_grade === 'object') {
    report.final_grade.summary = replaceStructuralCheckSentence(report.final_grade.summary, STRUCTURAL_CONFIRMED_SENTENCE);
  }
  const patch: Record<string, unknown> = { conversational_grading: JSON.stringify(report), capture_quality: mirrorPatch(card, check) };
  if ('conversational_final_grade_summary' in card && typeof card.conversational_final_grade_summary === 'string') {
    patch.conversational_final_grade_summary = replaceStructuralCheckSentence(card.conversational_final_grade_summary, STRUCTURAL_CONFIRMED_SENTENCE);
  }
  const grade = Number(card.conversational_whole_grade);
  return { patch, expectedGrade: grade, check, afterGrade: grade };
}

/**
 * "Not damage - remove cap": the same direct correction a manual review applies
 * (buildManualResult, propose_change, cap 10, structural not confirmed) with the
 * face scores recorded before the clamp. `card` must be the full row (select *):
 * the correction only patches columns the card carries.
 */
export function buildStructuralClear(card: Card, adminId: string, notes = STRUCTURAL_CLEARED_NOTE, now = new Date()): StructuralPatch {
  const pending = pendingStructuralCheck(card.conversational_grading);
  if (!pending) throw Error('not_pending');
  const scores = faceScoresOf(pending.check.uncapped_scores);
  if (!scores) throw Error('no_uncapped_scores');
  const snapshot = { report: String(card.conversational_grading), grade: Number(card.conversational_whole_grade) };
  const result = buildManualResult(card, snapshot, `structural-check:${String(card.id ?? '')}`,
    { verdict: 'propose_change', notes, scores, cap: 10, structuralConfirmed: false });
  const report = JSON.parse(String(result.patch.conversational_grading));
  const check = resolved(pending.check, 'cleared', adminId, now);
  report.structural_check = check;
  // Keep the findings for the record, but stop presenting them as confirmed damage.
  if (report.structural_damage && typeof report.structural_damage === 'object') {
    report.structural_damage = { ...report.structural_damage, detected: false, unconfirmed: true,
      unconfirmed_note: 'A person reviewed the line flagged as a possible crease and found it is not damage. Grade not capped.' };
  }
  const patch: Record<string, unknown> = { ...result.patch, conversational_grading: JSON.stringify(report), capture_quality: mirrorPatch(card, check) };
  return { patch, expectedGrade: snapshot.grade, check, afterGrade: Number(result.proposedGrade) };
}
