import { describe, it, expect } from 'vitest';
import { centeringFaceLine } from './centeringLine';
import { readFaceCentering } from './gradeDetails';

const face = (lr: unknown, tb: unknown, tier?: string) =>
  readFaceCentering(
    { conversational_centering_ratios: { front_lr: lr, front_tb: tb, front_quality_tier: tier } },
    'front',
  );

describe('centeringFaceLine', () => {
  it('prints a real measurement as stored', () => {
    expect(centeringFaceLine('Front', face('52/48', '50/50'))).toBe('Front 52/48 · 50/50');
  });

  // Every shape the grader stores for "could not measure". Each one used to
  // print as "NaN/NaN" or as a made-up "50/50".
  it.each(['XX/XX', 'n/a', 'N/A', 'borderless'])('never prints NaN or 50/50 for %s', (raw) => {
    const line = centeringFaceLine('Front', face(raw, raw));
    expect(line).not.toContain('NaN');
    expect(line).not.toContain('50/50');
    expect(line).toBe('Front: not measurable');
  });

  it('says there is no border when R0 marked the face Centered', () => {
    expect(centeringFaceLine('Front', face('XX/XX', 'XX/XX', 'Centered'))).toBe('Front: no border to measure');
  });

  it('says not measurable when nothing was stored at all', () => {
    expect(centeringFaceLine('Back', readFaceCentering({}, 'back'))).toBe('Back: not measurable');
  });

  it('dashes the one axis that could not be measured', () => {
    expect(centeringFaceLine('Front', face('55/45', 'XX/XX'))).toBe('Front 55/45 · —');
  });
});
