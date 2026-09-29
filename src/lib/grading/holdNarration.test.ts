import { describe, expect, it } from 'vitest';
import { describeDissent, describeFaceAdjustment, finishHoldReason, friendlyCitation, reflectiveFinish } from './holdNarration';

describe('describeFaceAdjustment never blames magnification for a hold', () => {
  const base = { cat: 'edges' as const, face: 'front' as const, cap: 9 };
  it('zoom-capped face keeps its findings sentence', () => {
    expect(describeFaceAdjustment({ ...base, zoomPhrases: 'faint whitening (left edge)', holdReason: 'x' }))
      .toBe('Magnified inspection found faint whitening (left edge) and set this face to 9/10 — see the magnified evidence photo for this section.');
  });
  it('a Gem Mint hold names the hold reason (Mike Evans case)', () => {
    const s = describeFaceAdjustment({ ...base, holdReason: 'one of the three independent evaluations scored the surface at 7.' });
    expect(s).toBe('This face shows 9/10 because the overall grade is held at 9: one of the three independent evaluations scored the surface at 7.');
    expect(s).not.toMatch(/magnified/i);
  });
  it('structural, dissent and consensus causes each say so', () => {
    expect(describeFaceAdjustment({ ...base, cat: 'surface', cap: 4, structural: true })).toMatch(/structural damage/);
    expect(describeFaceAdjustment({ ...base, structural: true })).not.toMatch(/structural/); // only the surface carries it
    expect(describeFaceAdjustment({ ...base, dissentScore: 9 })).toMatch(/one of the three independent evaluations scored the edges at 9/);
    expect(describeFaceAdjustment(base)).toBe('This face shows 9/10 to match the edges score the three independent evaluations agreed on.');
  });
  it('no branch ever emits the old unexplained line', () => {
    for (const extra of [{}, { holdReason: 'r' }, { dissentScore: 8 }, { structural: true }, { zoomCapApplied: true }]) {
      expect(describeFaceAdjustment({ ...base, ...extra })).not.toMatch(/adjusted this face/);
    }
  });
});

describe('describeDissent names what the lowest evaluation found', () => {
  it('Mike Evans: passes 10 / 7 / 10', () => {
    const r = describeDissent([
      { final: 10, centering: 10, corners: 10, edges: 10, surface: 10, defects_noted: [] },
      { final: 7, centering: 9, corners: 10, edges: 8, surface: 7, defects_noted: [
        'surface front scratch (minor, upper right): faint line across the helmet',
        'edges front left whitening (moderate, left edge): white flecks',
      ] },
      { final: 10, centering: 10, corners: 10, edges: 10, surface: 10, defects_noted: [] },
    ]);
    expect(r).toBe('one of the three independent evaluations scored the centering at 9, the edges at 8 and the surface at 7, noting noticeable whitening (front left edge) and light scratch (front upper right), while the others scored it a 10, and Gem Mint needs the evaluations to confirm each other');
  });
  it('says so plainly when the dissent cited nothing', () => {
    expect(describeDissent([
      { final: 10, centering: 10, corners: 10, edges: 10, surface: 10 },
      { final: 9, centering: 10, corners: 9, edges: 10, surface: 10, defects_noted: [] },
      { final: 10, centering: 10, corners: 10, edges: 10, surface: 10 },
    ])).toBe('one of the three independent evaluations scored the corners at 9 without naming a specific defect, while the others scored it a 10, and Gem Mint needs the evaluations to confirm each other');
  });
  it('counts two dissenters and returns null when nothing is below 10', () => {
    expect(describeDissent([
      { final: 9, corners: 9, centering: 10, edges: 10, surface: 10 },
      { final: 9, corners: 9, centering: 10, edges: 10, surface: 10 },
      { final: 10, corners: 10, centering: 10, edges: 10, surface: 10 },
    ])).toMatch(/^two of the three independent evaluations scored the corners at 9/);
    expect(describeDissent([{ final: 10 }, { final: 10 }, { final: 10 }])).toBeNull();
    expect(describeDissent([])).toBeNull();
  });
  it('friendly citations', () => {
    expect(friendlyCitation('corners front top left softening (minor, top-left corner): tip slightly rounded', 'corners')).toBe('light softening (front top-left corner)');
    expect(friendlyCitation('corners front: soft corner', 'corners')).toBe('soft corner');
  });
});

describe('reflective finish wording', () => {
  it('detects chrome/refractor/prizm from card_info', () => {
    expect(reflectiveFinish({ set_name: '2014 Topps Chrome' })).toBe('chrome');
    expect(reflectiveFinish({ parallel_type: 'X-Fractor' })).toBe('refractor');
    expect(reflectiveFinish({ subset: 'Silver Prizm' })).toBe('prizm');
    expect(reflectiveFinish({ set_name: 'Score' })).toBeNull();
    expect(reflectiveFinish(null)).toBeNull();
  });
  it('explains the hold in plain words', () => {
    expect(finishHoldReason('chrome')).toMatch(/^a 10 on a chrome finish can't be confirmed from photos/);
  });
});
