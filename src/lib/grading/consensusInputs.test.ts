import { describe, expect, it } from 'vitest';
import {
  consensusInputsEnabled, chooseDonor, medianLetter, normaliseCaseType, majorityCase, gemGateDecision,
  applyConsensusInputs, consensusInputsNote, spreadIgnoredSentence, CONSENSUS_INPUTS_VERSION, type GemGateInput,
} from './consensusInputs';
import { caseConsensus } from './caseConsensus';

describe('switch', () => {
  it('is on by default; CONSENSUS_INPUTS_V1=0/off/false is the kill switch', () => {
    expect(consensusInputsEnabled({})).toBe(true);
    for (const v of ['0', 'off', 'FALSE', ' Off ']) expect(consensusInputsEnabled({ CONSENSUS_INPUTS_V1: v })).toBe(false);
    for (const v of ['1', 'on', 'true', '']) expect(consensusInputsEnabled({ CONSENSUS_INPUTS_V1: v })).toBe(true);
  });
});

describe('per-category donor', () => {
  const c = (score: number, front: number, back: number) => ({ score, front, back });

  it('never mixes faces: (10,8),(8,10),(10,10) keeps a coherent pair at the median 8', () => {
    // Face medians would be 10/10 (min 10); the per-pass minimums are 8/8/10 (median 8).
    const pairs = [c(8, 10, 8), c(8, 8, 10), c(10, 10, 10)];
    const donor = chooseDonor(8, pairs, 2)!;
    expect([0, 1]).toContain(donor);
    expect(Math.min(pairs[donor].front, pairs[donor].back)).toBe(8);
    expect(donor).toBe(0); // base (index 2) does not qualify -> first in pass order
  });

  it('prefers the base when it qualifies', () => {
    expect(chooseDonor(9, [c(9, 9, 10), c(9, 10, 9), c(10, 10, 10)], 1)).toBe(1);
  });

  it('prefers an evaluation whose own faces match the consensus over a self-inconsistent base', () => {
    // The Sept 15 shape: passes 10/10/10, base reports weighted 10 with faces 10/9.
    expect(chooseDonor(10, [c(10, 10, 10), c(10, 10, 9), c(10, 10, 10)], 1)).toBe(0);
    // Every qualifying evaluation has a lower face: the base stays, Step 3.5 still clamps.
    expect(chooseDonor(10, [c(10, 9, 10), c(10, 10, 9), c(10, 10, 9)], 1)).toBe(1);
  });

  it('returns null when no evaluation matches with a usable pair', () => {
    expect(chooseDonor(9, [c(8, 8, 8), { score: 9, front: null, back: 9 }, c(10, 10, 10)], 0)).toBeNull();
  });
});

describe('confidence letter', () => {
  it('takes the middle of three', () => {
    expect(medianLetter(['B', 'B', 'C'], 'C')).toMatchObject({ chosen: 'B', changed: true });
    expect(medianLetter(['A', 'D', 'C'], 'A')).toMatchObject({ chosen: 'C', changed: true });
    expect(medianLetter(['b', 'C', 'c'], 'b')).toMatchObject({ chosen: 'C', votes: ['B', 'C', 'C'] });
  });
  it('has no single-letter veto', () => {
    expect(medianLetter(['B', 'B', 'D'], 'B')).toMatchObject({ chosen: 'B', changed: false });
  });
  it('ignores missing letters and keeps the base with fewer than two', () => {
    expect(medianLetter(['B', null, 'B'], 'C')).toMatchObject({ chosen: 'B', changed: true });
    expect(medianLetter([undefined, 'X', 'C'], 'B')).toMatchObject({ chosen: 'B', changed: false });
    // Two disagreeing letters: no middle - the base's stands when it is one of them, else the worse.
    expect(medianLetter(['B', 'C', null], 'B').chosen).toBe('B');
    expect(medianLetter(['B', 'C', null], undefined).chosen).toBe('C');
  });
});

describe('holder majority', () => {
  const none = { case_type: 'none', impact_level: 'none' };
  const sleeve = { case_type: 'penny_sleeve', impact_level: 'minor', notes: 'sleeve' };
  const top = { case_type: 'top_loader', impact_level: 'minor' };

  it('normalises case and spaces; null counts as none', () => {
    expect(normaliseCaseType('Penny Sleeve')).toBe('penny_sleeve');
    expect(normaliseCaseType('penny-sleeve')).toBe('penny_sleeve');
    expect(normaliseCaseType(null)).toBe('none');
    expect(normaliseCaseType('')).toBe('none');
  });

  it('replaces a lone hallucinated penny sleeve (Oct 14 customer case)', () => {
    const dets = [sleeve, none, { case_type: null, impact_level: 'none' }];
    const cc = caseConsensus(dets, sleeve);
    expect(cc.rigid).toBe(false);
    const out = majorityCase(dets, cc.detection, cc.rigid, 0);
    expect(out).toMatchObject({ majority: 'none', index: 1, votes: ['penny_sleeve', 'none', 'none'] });
  });

  it('keeps what caseConsensus chose when it already has the majority type, or there is no majority', () => {
    expect(majorityCase([none, none, sleeve], none, false, 0).index).toBeNull();
    expect(majorityCase([none, sleeve, top], sleeve, false, 1)).toMatchObject({ majority: null, index: null });
  });

  it('never stores a block that disagrees with the rigid decision', () => {
    const heavySleeve = { case_type: 'penny_sleeve', impact_level: 'moderate' }; // isRigidCase true
    const dets = [heavySleeve, sleeve, none];
    const cc = caseConsensus(dets, none); // 1 rigid vote of 3 -> not rigid
    expect(cc.rigid).toBe(false);
    const out = majorityCase(dets, cc.detection, cc.rigid, 2);
    expect(out.index).toBe(1); // the minor-impact sleeve, not the heavy one
  });

  it('a rigid majority is untouched', () => {
    const dets = [top, top, none];
    const cc = caseConsensus(dets, none);
    expect(cc.rigid).toBe(true);
    expect(majorityCase(dets, cc.detection, cc.rigid, 2).index).toBeNull(); // caseConsensus already chose a top loader
  });
});

describe('gem gate decision', () => {
  const base: GemGateInput = {
    enabled: true, finalGrade: 10, uninspectedRegions: 0, letterUncertainty: 1, passSpread: 2, clampLowered: 0,
    structuralUncertainty: 0, rigidCase: false, unanimous10: false, majorityTenAwarded: true,
  };

  it('a 10/10/8 whose dissent named no defect is not held by the spread', () => {
    expect(gemGateDecision(base)).toEqual({ gateUncertainty: 1, spreadIgnored: true, explainSpread: 0, hold: false });
  });

  it('switched off it reads exactly as before', () => {
    expect(gemGateDecision({ ...base, enabled: false })).toEqual({ gateUncertainty: 2, spreadIgnored: false, explainSpread: 2, hold: true });
  });

  it('letter C/D, clipped corners (letter), structural doubt, uninspected regions and rigid holders still hold', () => {
    expect(gemGateDecision({ ...base, letterUncertainty: 2 })).toMatchObject({ hold: true, spreadIgnored: false, explainSpread: 0 });
    expect(gemGateDecision({ ...base, structuralUncertainty: 2 }).hold).toBe(true);
    expect(gemGateDecision({ ...base, uninspectedRegions: 1 }).hold).toBe(true);
    expect(gemGateDecision({ ...base, rigidCase: true }).hold).toBe(true);
  });

  it('only the majority award sets the spread aside', () => {
    expect(gemGateDecision({ ...base, majorityTenAwarded: false })).toMatchObject({ gateUncertainty: 2, hold: true, spreadIgnored: false });
    expect(gemGateDecision({ ...base, passSpread: 0, unanimous10: true, majorityTenAwarded: false }).hold).toBe(false);
    expect(gemGateDecision({ ...base, finalGrade: 9 }).hold).toBe(false);
  });

  it('switched off it equals the pre-v9.38 gate on every input combination', () => {
    for (const finalGrade of [9, 10]) for (const letter of [0, 1, 2, 3]) for (const spread of [0, 1, 2, 4]) for (const clamp of [0, 1])
      for (const structural of [0, 2]) for (const rigid of [false, true]) for (const uninspected of [0, 1])
        for (const unanimous of [false, true]) for (const majority of [false, true]) {
          const input = { enabled: false, finalGrade, uninspectedRegions: uninspected, letterUncertainty: letter, passSpread: spread,
            clampLowered: clamp, structuralUncertainty: structural, rigidCase: rigid, unanimous10: unanimous, majorityTenAwarded: majority };
          const uncertaintyValue = Math.min(3, Math.max(letter, spread, clamp, structural));
          const oldHold = finalGrade === 10 && (uninspected > 0 || uncertaintyValue >= 2 || rigid || (!unanimous && !majority));
          expect(gemGateDecision(input)).toEqual({ gateUncertainty: uncertaintyValue, spreadIgnored: false, explainSpread: spread, hold: oldHold });
        }
  });

  it('caps at 3 like the displayed value', () => {
    expect(gemGateDecision({ ...base, majorityTenAwarded: false, passSpread: 5 }).gateUncertainty).toBe(3);
  });
});

describe('applying consensus inputs to the report', () => {
  const evaluation = (faces: Record<string, [number, number]>, letter: string, caseType: string, tag: string) => ({
    raw_sub_scores: Object.fromEntries(Object.entries(faces).flatMap(([k, [f, b]]) => [[`${k}_front`, f], [`${k}_back`, b]])),
    corners: { front_summary: `${tag} corners`, front: { defects: [] } },
    edges: { front_summary: `${tag} edges` },
    surface: { front_summary: `${tag} surface` },
    centering: { front: { left_right: `${tag} 50/50` } },
    image_quality: { confidence_letter: letter, notes: `${tag} notes` },
    case_detection: { case_type: caseType, impact_level: 'none', notes: tag },
  });
  const allTen = { centering: [10, 10], corners: [10, 10], edges: [10, 10], surface: [10, 10] } as Record<string, [number, number]>;
  const scoresOf = (j: any) => Object.fromEntries(['centering', 'corners', 'edges', 'surface'].map(c => [c, Math.min(j.raw_sub_scores[`${c}_front`], j.raw_sub_scores[`${c}_back`])]));

  it('swaps faces, sections, letter and holder; records it; one note', () => {
    const e1 = evaluation(allTen, 'B', 'none', 'e1');
    const e2 = evaluation({ ...allTen, corners: [9, 10] }, 'B', 'none', 'e2');
    // e3 reports corners 9 (weighted) over faces 8/10: self-inconsistent.
    const e3 = evaluation({ ...allTen, corners: [8, 10] }, 'C', 'penny_sleeve', 'e3');
    const completions = [e1, e2, e3];
    const passScores = completions.map(scoresOf);
    passScores[2].corners = 9;
    // base = e3 (index 2); median corners = 9; e3 qualifies but its faces would clamp to 8 -> e2's (9,10)
    const jsonData = structuredClone(e3);
    const out = applyConsensusInputs({ jsonData, completions, passScores, targets: { centering: 10, corners: 9, edges: 10, surface: 10 }, baseIndex: 2, holderRigid: false });
    expect(jsonData.raw_sub_scores.corners_front).toBe(9);
    expect(jsonData.raw_sub_scores.corners_back).toBe(10);
    expect(jsonData.corners.front_summary).toBe('e2 corners');
    expect(jsonData.corners).not.toBe(e2.corners); // cloned, later edits stay in the report
    expect(jsonData.edges.front_summary).toBe('e3 edges'); // base qualified, untouched
    expect(jsonData.image_quality).toEqual({ confidence_letter: 'B', notes: 'e3 notes' });
    expect(jsonData.case_detection).toMatchObject({ case_type: 'none', notes: 'e1' });
    expect(out.record).toEqual({
      version: CONSENSUS_INPUTS_VERSION,
      donors: { centering: 3, corners: 2, edges: 3, surface: 3 },
      letter: { votes: ['B', 'B', 'C'], chosen: 'B' },
      case: { votes: ['none', 'none', 'penny_sleeve'], chosen: 'none' },
    });
    expect(out.note).toBe('Per-face scores and notes for corners were taken from the evaluation that matched the consensus (evaluation 2); '
      + 'the photo-confidence letter is the median of the three (B, B, C → B); the holder reading follows the majority of the three (none, none, penny sleeve → none).');
    // The pass records are never touched.
    expect(e3.raw_sub_scores.corners_front).toBe(8);
    expect(e3.image_quality.confidence_letter).toBe('C');
  });

  it('changes nothing and writes no note when the base already matches', () => {
    const e = [evaluation(allTen, 'B', 'none', 'a'), evaluation(allTen, 'B', 'none', 'b'), evaluation(allTen, 'A', 'none', 'c')];
    const jsonData = structuredClone(e[1]);
    const before = structuredClone(jsonData);
    const out = applyConsensusInputs({ jsonData, completions: e, passScores: e.map(scoresOf), targets: { centering: 10, corners: 10, edges: 10, surface: 10 }, baseIndex: 1, holderRigid: false });
    expect(jsonData).toEqual(before);
    expect(out.note).toBeNull();
    expect(out.record.donors).toEqual({ centering: 2, corners: 2, edges: 2, surface: 2 });
  });

  it('notes several donors per category', () => {
    expect(consensusInputsNote({ changedCats: [{ cat: 'corners', donor: 0 }, { cat: 'surface', donor: 2 }], letter: null, caseVotes: null, caseChosen: null }))
      .toBe('Per-face scores and notes were taken from the evaluation that matched the consensus in each category (corners: evaluation 1; surface: evaluation 3).');
  });

  it('says the spread did not hold the 10', () => {
    expect(spreadIgnoredSentence(2, [10, 10, 8])).toContain('±2 range still reflects the spread of the three evaluations (10/10/8); the dissent named no defect');
  });
});
