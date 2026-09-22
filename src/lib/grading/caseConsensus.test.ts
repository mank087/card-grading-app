import { describe, expect, it } from 'vitest';
import { caseConsensus, isRigidCase } from './caseConsensus';

const none = { case_type: 'none', impact_level: 'none', notes: 'No protective case observed.' };
const topLoader = { case_type: 'top_loader', impact_level: 'minor', notes: 'Card appears to be in a top loader.' };
const sleeve = { case_type: 'penny_sleeve', impact_level: 'minor' };

describe('what counts as a rigid holder', () => {
  it('keeps the long-standing definition', () => {
    for (const type of ['top_loader', 'semi_rigid', 'slab']) expect(isRigidCase({ case_type: type, impact_level: 'none' })).toBe(true);
    expect(isRigidCase({ case_type: 'penny_sleeve', impact_level: 'moderate' })).toBe(true);
    expect(isRigidCase(sleeve)).toBe(false);
    expect(isRigidCase(none)).toBe(false);
    expect(isRigidCase(null)).toBe(false);
  });
});

describe('holder consensus across the three evaluations', () => {
  it('does not let one evaluation imagine a holder onto a bare card', () => {
    // Owner-reported Toxtricity, Sept 21 2026: a flatbed scan, 10/10/10, held at 9 in one run
    // of six because the base completion reported a top loader.
    const out = caseConsensus([topLoader, none, none], topLoader);
    expect(out).toMatchObject({ rigid: false, votes: 1, total: 3, overruledBase: true });
    expect(out.detection).toBe(none);
  });

  it('still holds a card two or three evaluations agree is in a rigid holder', () => {
    expect(caseConsensus([topLoader, topLoader, none], topLoader)).toMatchObject({ rigid: true, votes: 2, overruledBase: false });
    expect(caseConsensus([topLoader, topLoader, topLoader], topLoader).rigid).toBe(true);
  });

  it('catches a holder the base evaluation missed, and reports it', () => {
    // The mirror image matters as much: undetected holders were seen in production too.
    const out = caseConsensus([none, topLoader, topLoader], none);
    expect(out).toMatchObject({ rigid: true, votes: 2, overruledBase: true });
    expect(out.detection).toBe(topLoader);
  });

  it('never treats a penny sleeve as rigid, however many evaluations see it', () => {
    expect(caseConsensus([sleeve, sleeve, sleeve], sleeve)).toMatchObject({ rigid: false, votes: 0 });
  });

  it('needs a strict majority: one of two is not enough', () => {
    expect(caseConsensus([topLoader, none], topLoader).rigid).toBe(false);
    expect(caseConsensus([topLoader, topLoader], topLoader).rigid).toBe(true);
  });

  it('falls back to the base evaluation when there is nothing to vote with', () => {
    expect(caseConsensus([], topLoader)).toMatchObject({ rigid: true, total: 0, overruledBase: false });
    expect(caseConsensus([null, undefined], none)).toMatchObject({ rigid: false, overruledBase: false });
    expect(caseConsensus([], null)).toMatchObject({ rigid: false, detection: null });
  });
});
