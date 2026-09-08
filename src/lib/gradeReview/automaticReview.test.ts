import { describe, expect, it } from 'vitest';
import { explainGradeLimit } from './automaticReview';
import { ratiosAgree } from './centeringReview';

describe('grounded result explanations', () => {
  it('reports only the known score limit and never invents a physical defect', () => {
    expect(explainGradeLimit({ grading_passes: { averaged_rounded: { centering: 10, corners: 8, edges: 9, surface: 10 } } }, 8))
      .toBe('The report records corners at 8, which limits the overall grade.');
  });
  it('declines to explain absent or inconsistent scores', () => {
    expect(explainGradeLimit({}, 8)).toBe('');
    expect(explainGradeLimit({ grading_passes: { averaged_rounded: { centering: 10, corners: 7, edges: 9, surface: 10 } } }, 8)).toBe('');
  });
  it('recognizes recorded constraints without inventing their cause', () => {
    expect(explainGradeLimit({ weighted_scores: { centering_weighted: 10, corners_weighted: 9, edges_weighted: 9, surface_weighted: 10 } }, 8))
      .toBe('The original report includes a separate limit on the overall grade.');
  });
  it('keeps tolerance orientation-sensitive and bounded', () => {
    expect(ratiosAgree('50/50','52/48')).toBe(true);
    expect(ratiosAgree('50/50','53/47')).toBe(false);
    expect(ratiosAgree('63/37','37/63')).toBe(false);
    expect(ratiosAgree(null,'50/50')).toBe(false);
  });
});
