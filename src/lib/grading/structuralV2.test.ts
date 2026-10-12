import { describe, expect, it } from 'vitest';
import {
  structuralV2Enabled, structuralUnsureCap, isStickerProduct, cardContextOf, neutralStructuralClaims, structuralV2Prompt,
  parseStructuralV2Sample, tallyStructuralV2, sampleVote, structuralRecheckNote, structuralV2Note, liftRefutedStructural,
  type V2Line,
} from './structuralV2';

const line = (id: string, cls: string, extra: Record<string, unknown> = {}) =>
  ({ id, class: cls, follows_artwork: false, evidence: [], justification: 'seen in the quarter', ...extra });
const sample = (...lines: any[]) => JSON.stringify({ lines });
const parsed = (...classes: string[]): V2Line[] =>
  parseStructuralV2Sample(sample(...classes.map((c, i) => line(`C${i + 1}`, c, c === 'real_crease_or_bend' ? { evidence: ['surface_break'] } : {}))), classes.length)!;

describe('flag + settings', () => {
  it('is off unless STRUCTURAL_V2 is on/1/true', () => {
    expect(structuralV2Enabled({})).toBe(false);
    expect(structuralV2Enabled({ STRUCTURAL_V2: '0' })).toBe(false);
    for (const v of ['1', 'on', 'TRUE']) expect(structuralV2Enabled({ STRUCTURAL_V2: v })).toBe(true);
  });
  it('unsure cap defaults to 6 and only accepts whole 4-9', () => {
    expect(structuralUnsureCap({})).toBe(6);
    expect(structuralUnsureCap({ STRUCTURAL_V2_UNSURE_CAP: '7' })).toBe(7);
    expect(structuralUnsureCap({ STRUCTURAL_V2_UNSURE_CAP: '10' })).toBe(6);
    expect(structuralUnsureCap({ STRUCTURAL_V2_UNSURE_CAP: 'x' })).toBe(6);
  });
});

describe('card context', () => {
  it('recognises sticker products from the identity', () => {
    expect(isStickerProduct({ set: 'NBPA BASKETBALL STICKER' })).toBe(true);
    expect(isStickerProduct({ set: 'Fleer Basketball Super Star Sticker' })).toBe(true);
    expect(isStickerProduct({ set: 'Garbage Pail Kids', name: 'Bullseye Barry' })).toBe(true);
    expect(isStickerProduct({ set: 'Wacky Packages' })).toBe(true);
    expect(isStickerProduct({ set: '1994 Flair', name: 'Spider-Man' })).toBe(false);
    expect(isStickerProduct({ set: 'Panini Prizm' })).toBe(false);
    expect(isStickerProduct(null)).toBe(false);
  });
  it('reads card_info defensively', () => {
    expect(cardContextOf({ player_or_character: 'Michael Jordan', set_name: 'Fleer', year: 1986 }, 'sports'))
      .toEqual({ category: 'sports', name: 'Michael Jordan', set: 'Fleer', subset: null, year: '1986', manufacturer: null, extra: null });
    expect(cardContextOf(null).name).toBeNull();
  });
  it('tells the verifier when the card is a sticker', () => {
    expect(structuralV2Prompt(['crease - back center'], { set: 'Fleer Sticker' })).toContain('THIS CARD IS A STICKER PRODUCT');
    expect(structuralV2Prompt(['crease - back center'], { set: 'Topps' })).not.toContain('STICKER PRODUCT');
  });
});

describe('neutral claims', () => {
  it('keeps type + location only, dedupes, caps at six', () => {
    const findings = [
      { type: 'crease', location: 'back full-width horizontal center band', description: 'A continuous plane-disrupting line' },
      { type: 'Crease', location: 'back full-width horizontal center band', description: 'same again' },
      ...Array.from({ length: 8 }, (_, i) => ({ type: 'bend', location: `corner ${i}` })),
    ];
    const claims = neutralStructuralClaims(findings);
    expect(claims[0]).toBe('crease - back full-width horizontal center band');
    expect(claims.join(' ')).not.toContain('plane-disrupting');
    expect(claims).toHaveLength(6);
  });
});

describe('parsing one sample', () => {
  it('accepts a complete answer', () => {
    const lines = parseStructuralV2Sample(sample(line('C1', 'printed_design_element', { follows_artwork: true }), line('C2', 'factory_cut_or_score')), 2)!;
    expect(lines.map(l => l.cls)).toEqual(['printed_design_element', 'factory_cut_or_score']);
  });
  it('rejects wrong counts, unknown classes, duplicate ids and missing justification', () => {
    expect(parseStructuralV2Sample(sample(line('C1', 'cannot_tell')), 2)).toBeNull();
    expect(parseStructuralV2Sample(sample(line('C1', 'physical')), 1)).toBeNull();
    expect(parseStructuralV2Sample(sample(line('C1', 'cannot_tell'), line('C1', 'cannot_tell')), 2)).toBeNull();
    expect(parseStructuralV2Sample(sample(line('C1', 'cannot_tell', { justification: ' ' })), 1)).toBeNull();
    expect(parseStructuralV2Sample('not json', 1)).toBeNull();
  });
  it('reads a real call with no physical sign as cannot_tell', () => {
    const [l] = parseStructuralV2Sample(sample(line('C1', 'real_crease_or_bend')), 1)!;
    expect(l).toMatchObject({ cls: 'cannot_tell', coerced: true });
  });
  it('reads a real call on a line that follows the artwork as cannot_tell', () => {
    const [l] = parseStructuralV2Sample(sample(line('C1', 'real_crease_or_bend', { evidence: ['opposite_face_line'], follows_artwork: true })), 1)!;
    expect(l.cls).toBe('cannot_tell');
  });
  it('a real warp needs a bowed outline', () => {
    const real = line('C1', 'real_crease_or_bend', { evidence: ['surface_break'] });
    expect(parseStructuralV2Sample(sample(real), 1, ['warp'])![0].cls).toBe('cannot_tell');
    expect(parseStructuralV2Sample(sample({ ...real, evidence: ['outline_deformation'] }), 1, ['warp'])![0].cls).toBe('real_crease_or_bend');
    expect(parseStructuralV2Sample(sample(real), 1, ['crease'])![0].cls).toBe('real_crease_or_bend');
  });
  it('sticker check reads every evaluation\'s card_info', () => {
    const ctx = cardContextOf({ card_name: 'Michael Jordan' }, 'sports', [{ card_name: 'Michael Jordan' }, { set_name: 'NBPA Basketball Sticker' }]);
    expect(isStickerProduct(ctx)).toBe(true);
  });
  it('keeps a real call with evidence, dropping unknown evidence words', () => {
    const [l] = parseStructuralV2Sample(sample(line('C1', 'real_crease_or_bend', { evidence: ['fiber_or_ink_crack', 'ridge_shadow'] })), 1)!;
    expect(l).toMatchObject({ cls: 'real_crease_or_bend', evidence: ['fiber_or_ink_crack'] });
  });
});

describe('tally', () => {
  const claims = ['crease - front center'];
  it('one real line makes the sample real; all non-damage lines make it not_damage', () => {
    expect(sampleVote(parsed('printed_design_element', 'real_crease_or_bend'))).toBe('real');
    expect(sampleVote(parsed('printed_design_element', 'photo_artifact_or_sleeve'))).toBe('not_damage');
    expect(sampleVote(parsed('printed_design_element', 'cannot_tell'))).toBe('cannot_tell');
  });
  it('an unresolved warp beside ruled-out lines does not block not_damage', () => {
    const lines = parsed('printed_design_element', 'cannot_tell');
    expect(sampleVote(lines, ['crease', 'warp'])).toBe('not_damage');
    expect(sampleVote(lines, ['crease', 'crease'])).toBe('cannot_tell');
    expect(sampleVote(parsed('cannot_tell'), ['warp'])).toBe('cannot_tell');
  });
  it('confirms on a majority of real samples', () => {
    const v = tallyStructuralV2([parsed('real_crease_or_bend'), parsed('real_crease_or_bend'), parsed('printed_design_element')], claims);
    expect(v).toMatchObject({ ok: true, outcome: 'confirmed' });
    expect(v.lines[0]).toMatchObject({ cls: 'real_crease_or_bend', evidence: ['surface_break'] });
  });
  it('needs all three when unanimity is required', () => {
    const v = tallyStructuralV2([parsed('real_crease_or_bend'), parsed('real_crease_or_bend'), parsed('printed_design_element')], claims, { requireUnanimous: true });
    expect(v.outcome).toBe('uncertain');
  });
  it('refutes on a majority of non-damage samples with no real vote', () => {
    expect(tallyStructuralV2([parsed('factory_cut_or_score'), parsed('printed_design_element'), parsed('cannot_tell')], claims).outcome).toBe('refuted');
  });
  it('a single real vote blocks refutation', () => {
    expect(tallyStructuralV2([parsed('factory_cut_or_score'), parsed('printed_design_element'), parsed('real_crease_or_bend')], claims).outcome).toBe('uncertain');
  });
  it('a cannot_tell majority is uncertain', () => {
    expect(tallyStructuralV2([parsed('cannot_tell'), parsed('cannot_tell'), parsed('printed_design_element')], claims).outcome).toBe('uncertain');
  });
  it('fewer than three complete samples is not a verdict', () => {
    expect(tallyStructuralV2([parsed('real_crease_or_bend'), null, parsed('real_crease_or_bend')], claims)).toMatchObject({ ok: false, outcome: null });
  });
});

describe('re-grade note and customer note', () => {
  const refuted = tallyStructuralV2([parsed('factory_cut_or_score'), parsed('factory_cut_or_score'), parsed('factory_cut_or_score')], ['crease - back center']);
  it('refuted: tells the re-grade the line is not damage', () => {
    const note = structuralRecheckNote(refuted)!;
    expect(note).toContain('are NOT a crease or bend');
    expect(note).toContain('a factory cut or score line');
  });
  it('uncertain: tells the re-grade not to cap', () => {
    const unsure = tallyStructuralV2([parsed('cannot_tell'), parsed('cannot_tell'), parsed('cannot_tell')], ['crease - back center']);
    expect(structuralRecheckNote(unsure)).toContain('could NOT be confirmed');
  });
  it('confirmed: no re-grade', () => {
    const confirmed = tallyStructuralV2([parsed('real_crease_or_bend'), parsed('real_crease_or_bend'), parsed('real_crease_or_bend')], ['crease']);
    expect(structuralRecheckNote(confirmed)).toBeNull();
  });
  it('customer notes', () => {
    expect(structuralV2Note('refuted', 6)).toContain('Grade not capped');
    expect(structuralV2Note('uncertain', 6)).toContain('no more than 6');
  });
});

describe('fallback lift', () => {
  const base = {
    scores: { corners: 4, edges: 4, surface: 4 },
    faces: { corners_front: 4, corners_back: 5, edges_front: 4, edges_back: 5, surface_front: 4, surface_back: 4 },
    cleanPassScores: { corners: [], edges: [], surface: [] } as any,
    zoomOk: true,
    zoomCaps: { corners_front: 8, edges_front: 8, surface_back: 9 },
    structCap: 4,
  };
  it('every evaluation carried the line: the magnified reading decides (Bo Jackson shape)', () => {
    const r = liftRefutedStructural(base);
    expect(r.scores).toEqual({ corners: 8, edges: 8, surface: 9 });
    expect(r.faces).toMatchObject({ corners_front: 8, corners_back: 8, surface_front: 9 });
  });
  it('a clean evaluation is the reading when there is one', () => {
    const r = liftRefutedStructural({ ...base, cleanPassScores: { corners: [7], edges: [9], surface: [8] }, zoomCaps: {} });
    expect(r.scores).toEqual({ corners: 7, edges: 9, surface: 8 });
  });
  it('without a magnified reading or a clean evaluation nothing moves', () => {
    const r = liftRefutedStructural({ ...base, zoomOk: false });
    expect(r.changed).toEqual([]);
    expect(r.scores).toEqual(base.scores);
  });
  it('categories above the structural cap are untouched', () => {
    const r = liftRefutedStructural({ ...base, scores: { corners: 6, edges: 4, surface: 4 } });
    expect(r.scores.corners).toBe(6);
  });
});
