import { describe, expect, it } from 'vitest';
import {
  buildStructuralCheck, buildStructuralClear, buildStructuralConfirm, replaceStructuralCheckSentence, structuralEvidence, structuralMirror,
  withStructuralCheckSentence, STRUCTURAL_CHECK_SENTENCE, STRUCTURAL_CONFIRMED_SENTENCE,
} from './structuralCheck';
import { structuralCheckEmail } from './structuralCheckServer';

const capped = { centering_front: 9, centering_back: 10, corners_front: 9, corners_back: 9, edges_front: 9, edges_back: 9, surface_front: 4, surface_back: 4 };
const evidence = 'crease at back upper-left: thin line. Seen by 3/3 evaluations.';
const now = new Date('2026-10-12T12:00:00Z');

describe('buildStructuralCheck', () => {
  it('restores only faces the clamp lowered', () => {
    // The back was already below the cap, so it keeps its final 4 and nothing is lost to the cap.
    expect(buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: capped, preCapSurface: { front: 9, back: 3 }, evidence, now })).toBeNull();
  });
  it('computes the uncapped grade from the eight faces', () => {
    const check = buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: capped, preCapSurface: { front: 10, back: 9 }, evidence, now });
    expect(check).toEqual({ status: 'pending', uncapped_grade: 9, capped_grade: 4, flagged_at: now.toISOString(), evidence,
      uncapped_scores: { ...capped, surface_front: 10, surface_back: 9 } });
  });
  it('does not flag a small drop, an undetected cap, or a report without whole face scores', () => {
    expect(buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: { ...capped, edges_front: 6 }, preCapSurface: { front: 9, back: 9 }, evidence })).toBeNull();
    expect(buildStructuralCheck({ structuralDetected: false, finalGrade: 4, finalScores: capped, preCapSurface: { front: 9, back: 9 }, evidence })).toBeNull();
    expect(buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: { ...capped, corners_back: 8.5 }, preCapSurface: { front: 9, back: 9 }, evidence })).toBeNull();
    expect(buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: undefined, preCapSurface: { front: 9, back: 9 }, evidence })).toBeNull();
  });
  it('flags exactly at a 3-point drop', () => {
    expect(buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: { ...capped, edges_back: 7 }, preCapSurface: { front: 9, back: 9 }, evidence })?.uncapped_grade).toBe(7);
  });
});

it('summarizes the findings, who saw them and the verifier', () => {
  const text = structuralEvidence({ votes: 3, passes: 3, zoom: true, structuralDamage: { findings: [{ type: 'crease', location: 'back upper-left', description: 'Thin diagonal line.' }], verification: '3/3 physical damage' } });
  expect(text).toBe('crease at back upper-left: Thin diagonal line. Seen by 3/3 evaluations + magnified zoom. Verifier: 3/3 physical damage');
  expect(structuralEvidence({ votes: 2, passes: 3, zoom: false, structuralDamage: {} })).toBe('Structural damage flagged. Seen by 2/3 evaluations.');
});

describe('summary sentence', () => {
  it('appends once and swaps or drops it', () => {
    const once = withStructuralCheckSentence('Surface crease limits the grade. Final grade: 4 (Very Good).');
    expect(once).toBe(`Surface crease limits the grade. Final grade: 4 (Very Good). ${STRUCTURAL_CHECK_SENTENCE}`);
    expect(withStructuralCheckSentence(once)).toBe(once);
    expect(withStructuralCheckSentence(undefined)).toBe(STRUCTURAL_CHECK_SENTENCE);
    expect(replaceStructuralCheckSentence(once, STRUCTURAL_CONFIRMED_SENTENCE)).toBe(`Surface crease limits the grade. Final grade: 4 (Very Good). ${STRUCTURAL_CONFIRMED_SENTENCE}`);
    expect(replaceStructuralCheckSentence(once)).toBe('Surface crease limits the grade. Final grade: 4 (Very Good).');
  });
});

function flaggedCard() {
  const check = buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: capped, preCapSurface: { front: 10, back: 9 }, evidence, now })!;
  const summary = withStructuralCheckSentence('A crease on the back limits the grade. Final grade: 4 (Very Good).');
  const report = {
    raw_sub_scores: capped, surface: { front: { score: 4 }, back: { score: 4 } }, structural_damage: { detected: true, findings: [{ type: 'crease' }] },
    grading_passes: { averaged_rounded: { centering: 9, corners: 9, edges: 9, surface: 4, final: 4 } },
    final_grade: { whole_grade: 4, grade_range: '±1', summary }, structural_check: check,
  };
  return {
    id: '00000000-0000-4000-8000-000000000001', conversational_grading: JSON.stringify(report, null, 2), conversational_whole_grade: 4,
    conversational_final_grade_summary: summary, conversational_sub_scores: { surface: { front: 4, back: 4, weighted: 4 } },
    capture_quality: { front: { fill_percent: 80 }, structural_check: structuralMirror(check) },
    ai_grading: { 'Grading (DCM Master Scale)': { 'DCM Grade (Final Whole Number)': 4 } }, label_data: { grade: 4 },
  } as Record<string, unknown>;
}

describe('admin actions', () => {
  it('confirm keeps the grade, records the admin and swaps the sentence', () => {
    const card = flaggedCard();
    const result = buildStructuralConfirm(card, 'admin-1', now);
    expect(result.afterGrade).toBe(4);
    expect(result.expectedGrade).toBe(4);
    expect(result.patch).not.toHaveProperty('conversational_whole_grade');
    const report = JSON.parse(String(result.patch.conversational_grading));
    expect(report.structural_check).toMatchObject({ status: 'confirmed', resolved_by: 'admin-1', resolved_at: now.toISOString() });
    expect(report.final_grade.summary).toBe(`A crease on the back limits the grade. Final grade: 4 (Very Good). ${STRUCTURAL_CONFIRMED_SENTENCE}`);
    expect(result.patch.conversational_final_grade_summary).toBe(report.final_grade.summary);
    expect(result.patch.capture_quality).toMatchObject({ front: { fill_percent: 80 }, structural_check: { status: 'confirmed' } });
    expect(() => buildStructuralConfirm({ ...card, conversational_grading: result.patch.conversational_grading }, 'admin-1')).toThrow('not_pending');
  });

  it('clear applies the manual-review correction with the uncapped face scores', () => {
    const card = flaggedCard();
    const result = buildStructuralClear(card, 'admin-1', undefined, now);
    expect(result.afterGrade).toBe(9);
    expect(result.patch.conversational_whole_grade).toBe(9);
    expect((result.patch.label_data as Record<string, unknown>).grade).toBe(9);
    expect((result.patch.ai_grading as Record<string, Record<string, unknown>>)['Grading (DCM Master Scale)']['DCM Grade (Final Whole Number)']).toBe(9);
    const report = JSON.parse(String(result.patch.conversational_grading));
    expect(report.raw_sub_scores).toMatchObject({ surface_front: 10, surface_back: 9 });
    expect(report.manual_review).toMatchObject({ cap: 10, structural_confirmed: false });
    expect(report.structural_check).toMatchObject({ status: 'cleared', resolved_by: 'admin-1' });
    expect(report.structural_damage).toMatchObject({ detected: false, unconfirmed: true });
    expect(report.final_grade.summary).not.toContain(STRUCTURAL_CHECK_SENTENCE);
    expect(report.final_grade.summary).toContain('Grade updated from 4 to 9.');
    expect(result.patch.conversational_final_grade_summary).toBe(report.final_grade.summary);
    expect(result.patch.capture_quality).toMatchObject({ structural_check: { status: 'cleared', resolved_at: now.toISOString() } });
  });

  it('refuses a report without a pending check or without uncapped scores', () => {
    const card = flaggedCard();
    const report = JSON.parse(String(card.conversational_grading));
    delete report.structural_check.uncapped_scores;
    expect(() => buildStructuralClear({ ...card, conversational_grading: JSON.stringify(report) }, 'a')).toThrow('no_uncapped_scores');
    expect(() => buildStructuralClear({ ...card, conversational_grading: '{}' }, 'a')).toThrow('not_pending');
    expect(() => buildStructuralClear({ ...card, conversational_grading: 'not json' }, 'a')).toThrow('not_pending');
  });
});

it('builds the admin alert subject and escapes the body', () => {
  const check = buildStructuralCheck({ structuralDetected: true, finalGrade: 4, finalScores: capped, preCapSurface: { front: 10, back: 9 }, evidence: 'line <b>', now })!;
  const email = structuralCheckEmail({ cardId: 'c1', cardName: 'Charizard <1st>', category: 'pokemon', check });
  expect(email.subject).toBe('Structural cap check: Charizard <1st> (4 from 9)');
  expect(email.text).toContain('https://dcmgrading.com/admin/structural-checks');
  expect(email.bodyHtml).toContain('Charizard &lt;1st&gt;');
  expect(email.bodyHtml).toContain('line &lt;b&gt;');
});
