/**
 * The face clamp and the zoom cap on OPPOSITE faces.
 *
 * Measured in production 2026-09-15 and reported by review: whole-card passes at
 * corners 10/10/10, the detailed FRONT assessment clamping corners to 8 (Step
 * 3.5), and the magnified inspection capping the BACK to 9. The v9.1 fold writes
 * the zoom cap into the displayed pass rows, so the table read 9 / 9 / 9 over a
 * consensus of 8, and the v9.25 exclusion skipped the clamp note because "a zoom
 * cap exists in this category" - leaving the 9 to 8 step with nothing behind it.
 *
 * These tests drive the PURE pieces the grading path now delegates to
 * (decideClampExplanation + the fold + buildClampNote) through the three shapes
 * that matter, so the value comparison is pinned rather than reasoned about
 * inside a 3,500-line function.
 *
 * Nothing here can move a grade: the fold only ever writes the consensus that
 * has already settled into the DISPLAY rows.
 */

import { describe, it, expect } from 'vitest';
import {
  buildClampNote,
  decideClampExplanation,
  type ExplainCategory,
} from './consensusExplain';

type PassRow = { centering: number; corners: number; edges: number; surface: number; final: number };

/** The v9.1/v9.25 fold, in the same shape visionGrader applies it. */
function foldPassRows(passes: PassRow[], cat: ExplainCategory, foldTo: number): PassRow[] {
  return passes.map(p => {
    const next = { ...p };
    if (next[cat] > foldTo) next[cat] = foldTo;
    next.final = Math.min(next.centering, next.corners, next.edges, next.surface);
    return next;
  });
}

const row = (corners: number): PassRow => ({
  centering: 10,
  corners,
  edges: 10,
  surface: 10,
  final: corners,
});

describe('face clamp vs zoom cap on opposite faces', () => {
  it('front clamp 8 + back zoom cap 9: explains, and folds the 9 rows down to 8', () => {
    // Raw whole-card passes all scored corners 10; the v9.1 fold has already
    // written the back zoom cap of 9 into the displayed rows.
    const rawPassScores = [10, 10, 10];
    const displayed = [row(9), row(9), row(9)];
    const consensus = 8; // MIN(front 8, back 9)

    const decision = decideClampExplanation({
      rawMedian: 10,
      consensus,
      clampFaceScore: 8,
      zoomCaps: [undefined, 9], // front uncapped, back capped to 9
      structuralCap: null,
      dissentValue: null,
      dragValue: null,
    });

    expect(decision).toEqual({ shouldExplain: true, foldTo: 8, reason: 'explain' });

    const folded = foldPassRows(displayed, 'corners', decision.foldTo!);
    expect(folded.map(p => p.corners)).toEqual([8, 8, 8]);
    expect(folded.map(p => p.final)).toEqual([8, 8, 8]);

    const note = buildClampNote({
      cat: 'corners',
      face: 'front',
      faceScore: 8,
      consensus,
      passScores: rawPassScores,
      detail: 'The upper left corner shows a blunted tip with light whitening.',
    });
    expect(note).toBe(
      'Corners consensus is 8 although each whole-card evaluation scored it 10: ' +
        'the detailed front assessment scored 8. ' +
        'The upper left corner shows a blunted tip with light whitening.',
    );
  });

  it('front clamp 9 + back zoom cap 9: already explained by the zoom addendum', () => {
    const decision = decideClampExplanation({
      rawMedian: 10,
      consensus: 9,
      clampFaceScore: 9,
      zoomCaps: [undefined, 9],
    });
    expect(decision.shouldExplain).toBe(false);
    expect(decision.reason).toBe('already-explained');
  });

  it('zoom cap 8 + front clamp 9: the zoom cap owns the consensus, not the clamp', () => {
    const decision = decideClampExplanation({
      rawMedian: 10,
      consensus: 8,
      clampFaceScore: 9,
      zoomCaps: [8],
    });
    expect(decision.shouldExplain).toBe(false);
    expect(decision.reason).toBe('clamp-not-binding');
  });

  it('no gap: the consensus already equals the raw pass median', () => {
    expect(
      decideClampExplanation({ rawMedian: 9, consensus: 9, clampFaceScore: 9 }).reason,
    ).toBe('no-gap');
    expect(
      decideClampExplanation({ rawMedian: null, consensus: 8, clampFaceScore: 8 }).reason,
    ).toBe('no-gap');
  });

  it('a gap with no face clamp is somebody else to explain', () => {
    expect(
      decideClampExplanation({ rawMedian: 10, consensus: 8, clampFaceScore: null }).reason,
    ).toBe('no-clamp');
  });

  it('a gate drag to the consensus suppresses the note; a drag to a higher value does not', () => {
    expect(
      decideClampExplanation({
        rawMedian: 10, consensus: 9, clampFaceScore: 9, dragValue: 9,
      }).shouldExplain,
    ).toBe(false);
    expect(
      decideClampExplanation({
        rawMedian: 10, consensus: 8, clampFaceScore: 8, dragValue: 9,
      }).shouldExplain,
    ).toBe(true);
  });

  it('surface: a structural cap at or below the consensus suppresses the note', () => {
    expect(
      decideClampExplanation({
        rawMedian: 10, consensus: 7, clampFaceScore: 7, structuralCap: 7,
      }).reason,
    ).toBe('already-explained');
    expect(
      decideClampExplanation({
        rawMedian: 10, consensus: 6, clampFaceScore: 6, structuralCap: 7,
      }).reason,
    ).toBe('explain');
  });

  it('the fold never raises a row and never touches an already-lower row', () => {
    const folded = foldPassRows([row(10), row(8), row(7)], 'corners', 8);
    expect(folded.map(p => p.corners)).toEqual([8, 8, 7]);
  });
});
