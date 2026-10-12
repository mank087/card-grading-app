import { describe, expect, it } from 'vitest';
import {
  backToleranceReleaseNote,
  centeringDissentEvidence,
  dissentReleaseEnabled,
  faceDev,
  ratioDev,
  worstBackRatio,
} from './dissentRelease';

const r = (front_lr: string, front_tb: string, back_lr: string, back_tb: string) => ({ front_lr, front_tb, back_lr, back_tb });
const dev = (ratios: Record<string, string>) => {
  const ds = Object.values(ratios).map(ratioDev).filter((d): d is number => d != null);
  return ds.length ? Math.max(...ds) : null;
};
const vote = (ratios: Record<string, string>) => ({ ratios, dev: dev(ratios) });

describe('flag', () => {
  it('is off unless explicitly enabled', () => {
    expect(dissentReleaseEnabled({})).toBe(false);
    expect(dissentReleaseEnabled({ DISSENT_RELEASE_V1: '0' })).toBe(false);
    expect(dissentReleaseEnabled({ DISSENT_RELEASE_V1: '1' })).toBe(true);
    expect(dissentReleaseEnabled({ DISSENT_RELEASE_V1: 'true' })).toBe(true);
  });
});

describe('ratio parsing matches the engine', () => {
  it('reads deviations and rejects placeholders', () => {
    expect(ratioDev('55/45')).toBe(5);
    expect(ratioDev('44/56')).toBe(6);
    expect(ratioDev('XX/XX')).toBeNull();
    expect(ratioDev('80/80')).toBeNull();
    expect(faceDev(r('52/48', '54/46', '50/50', '58/42'), 'front')).toBe(4);
    expect(faceDev(r('52/48', '54/46', '50/50', '58/42'), 'back')).toBe(8);
    expect(faceDev(r('XX/XX', 'XX/XX', '55/45', '52/48'), 'front')).toBeNull();
  });
});

describe('flag OFF reproduces v9.15 exactly', () => {
  it('back at 56/44 on the card counts as measured evidence (the behaviour being fixed)', () => {
    const input = {
      cardRatios: r('52/48', '54/46', '51/49', '56/44'),
      dissenter: vote(r('52/48', '54/46', '51/49', '56/44')),
      majority: [vote(r('52/48', '52/48', '51/49', '52/48')), vote(r('50/50', '52/48', '50/50', '52/48'))],
    };
    expect(centeringDissentEvidence(input, false)).toEqual({ evidence: true, arm: 'measured' });
  });
  it('disagreement arm uses the stored worst-of-both-faces deviation', () => {
    // Production case 7be4770e (Jordan, Fleer Pro-Vision): dissent back 56/44, majority 50/50s.
    const input = {
      cardRatios: r('50/50', '50/50', '50/50', '52/48'),
      dissenter: vote(r('50/50', '52/48', '51/49', '56/44')),
      majority: [vote(r('50/50', '50/50', '50/50', '52/48')), vote(r('50/50', '50/50', '50/50', '51/49'))],
    };
    expect(centeringDissentEvidence(input, false)).toEqual({ evidence: true, arm: 'disagreement' });
  });
  it('no evidence when nothing reaches the lines', () => {
    const input = {
      cardRatios: r('52/48', '52/48', '52/48', '52/48'),
      dissenter: vote(r('53/47', '52/48', '52/48', '53/47')),
      majority: [vote(r('52/48', '52/48', '52/48', '52/48'))],
    };
    expect(centeringDissentEvidence(input, false)).toEqual({ evidence: false, arm: null });
  });
});

describe('flag ON: each face against its own tolerance', () => {
  it('releases the back-only dissent (Jordan Pro-Vision 7be4770e)', () => {
    const input = {
      cardRatios: r('50/50', '50/50', '50/50', '52/48'),
      dissenter: vote(r('50/50', '52/48', '51/49', '56/44')),
      majority: [vote(r('50/50', '50/50', '50/50', '52/48')), vote(r('50/50', '50/50', '50/50', '51/49'))],
    };
    expect(centeringDissentEvidence(input, true)).toEqual({ evidence: false, arm: null });
  });
  it('releases a full-art front whose back reads 55/45 (One Ring 1d3b4d30)', () => {
    const input = {
      cardRatios: r('XX/XX', 'XX/XX', '53/47', '52/48'),
      dissenter: vote(r('XX/XX', 'XX/XX', '55/45', '52/48')),
      majority: [vote(r('XX/XX', 'XX/XX', '51/49', '50/50')), vote(r('XX/XX', 'XX/XX', '50/50', '51/49'))],
    };
    expect(centeringDissentEvidence(input, false).evidence).toBe(true);
    expect(centeringDissentEvidence(input, true).evidence).toBe(false);
  });
  it('KEEPS the front at exactly 55/45 as evidence (by-eye split; not released)', () => {
    const input = {
      cardRatios: r('52/48', '55/45', '50/50', '52/48'),
      dissenter: vote(r('52/48', '56/44', '51/49', '54/46')),
      majority: [vote(r('52/48', '55/45', '50/50', '52/48'))],
    };
    expect(centeringDissentEvidence(input, true)).toEqual({ evidence: true, arm: 'measured_front' });
  });
  it('KEEPS a front disagreement as evidence (Peterson 877b9b10: by eye 43/57 TB)', () => {
    const input = {
      cardRatios: r('50/50', '52/48', '50/50', '50/50'),
      dissenter: vote(r('50/50', '56/44', '50/50', '52/48')),
      majority: [vote(r('50/50', '52/48', '50/50', '50/50')), vote(r('50/50', '52/48', '50/50', '52/48'))],
    };
    expect(centeringDissentEvidence(input, true)).toEqual({ evidence: true, arm: 'disagreement_front' });
  });
  it('a back past 75/25 is still evidence, on the card or on the dissenter', () => {
    expect(centeringDissentEvidence({
      cardRatios: r('52/48', '52/48', '50/50', '78/22'),
      dissenter: vote(r('52/48', '52/48', '50/50', '78/22')),
      majority: [vote(r('52/48', '52/48', '50/50', '60/40'))],
    }, true)).toEqual({ evidence: true, arm: 'measured_back' });
    expect(centeringDissentEvidence({
      cardRatios: r('52/48', '52/48', '50/50', '60/40'),
      dissenter: vote(r('52/48', '52/48', '50/50', '80/20')),
      majority: [vote(r('52/48', '52/48', '50/50', '60/40'))],
    }, true)).toEqual({ evidence: true, arm: 'dissent_back_past_tolerance' });
  });
  it('never tightens: anything flag-ON holds, flag-OFF holds too', () => {
    const samples = ['50/50', '52/48', '54/46', '55/45', '56/44', '58/42', '62/38', '78/22', 'XX/XX'];
    let i = 0;
    for (const a of samples) for (const b of samples) for (const c of samples) {
      if (i++ % 7) continue; // a deterministic subsample keeps this fast
      const input = { cardRatios: r(a, '52/48', b, '52/48'), dissenter: vote(r(b, a, c, '52/48')), majority: [vote(r('52/48', a, '50/50', c))] };
      if (centeringDissentEvidence(input, true).evidence) expect(centeringDissentEvidence(input, false).evidence).toBe(true);
    }
  });
});

describe('release note', () => {
  it('names the back reading and both tolerances', () => {
    expect(worstBackRatio(r('50/50', '52/48', '51/49', '56/44'))).toBe('56/44');
    expect(worstBackRatio(r('50/50', '52/48', 'XX/XX', 'XX/XX'))).toBeNull();
    const note = backToleranceReleaseNote(9, '56/44');
    expect(note).toMatch(/third scored the centering at 9 on a back-border reading \(56\/44\)/);
    expect(note).toMatch(/75\/25/);
    expect(note).toMatch(/55\/45/);
    expect(backToleranceReleaseNote(9, null)).toMatch(/back-border reading that is inside/);
  });
});
