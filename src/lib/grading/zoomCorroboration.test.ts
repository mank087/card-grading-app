import { describe, expect, it } from 'vitest';
import {
  attributeZoomDefects, corroborateZoomDefects, cropKind, DEFAULT_MAJORITY_SHARE, locationContradiction, majorityShare,
  namedCardLocations, wholeCardEvidence, zoomCorroborationEnabled, type CorroborationDefect,
} from './zoomCorroboration';

const d = (region: string, type: string, severity: string, description: string, extra: Partial<CorroborationDefect> = {}): CorroborationDefect => ({
  region, face: region.startsWith('F') ? 'front' : 'back',
  category: /-COR-/.test(region) ? 'corners' : /-EDG-/.test(region) ? 'edges' : 'surface',
  type, severity, description, ...extra,
});

describe('flag parsing', () => {
  it('is off unless explicitly on', () => {
    for (const v of [undefined, '', 'off', '0', 'false', 'no']) expect(zoomCorroborationEnabled({ ZOOM_CORROBORATION_V1: v })).toBe(false);
    for (const v of ['on', 'ON', '1', 'true']) expect(zoomCorroborationEnabled({ ZOOM_CORROBORATION_V1: v })).toBe(true);
  });
  it('majority share defaults to 0.8 and rejects nonsense', () => {
    expect(majorityShare({})).toBe(DEFAULT_MAJORITY_SHARE);
    expect(majorityShare({ ZOOM_CORROBORATION_MAJORITY: '0.6' })).toBe(0.6);
    for (const v of ['0', '-1', '2', 'abc']) expect(majorityShare({ ZOOM_CORROBORATION_MAJORITY: v })).toBe(DEFAULT_MAJORITY_SHARE);
  });
});

describe('crop geometry', () => {
  it('classifies crops', () => {
    expect(cropKind('F-COR-TL')).toBe('corner');
    expect(cropKind('B-EDG-L-2')).toBe('edge');
    expect(cropKind('F-SUR-HB')).toBe('surface');
    expect(cropKind('weird')).toBeNull();
  });
  it('reads card-level corner and edge names, not positions within the crop', () => {
    expect(namedCardLocations('Scratch near the upper-left corner and along the right edge')).toEqual({ corners: ['top-left'], sides: ['right'] });
    expect(namedCardLocations('Bottom right corner tip is soft; lower dark edge')).toEqual({ corners: ['bottom-right'], sides: ['bottom'] });
    expect(namedCardLocations('Short scratch near the lower-center/right area')).toEqual({ corners: [], sides: [] });
    expect(namedCardLocations('Thin scratch on the green area near the center-left')).toEqual({ corners: [], sides: [] });
  });
  it('flags only locations the crop cannot contain', () => {
    expect(locationContradiction('F-COR-BR', 'Scratch near the top-left corner')).toMatch(/top-left corner/);
    expect(locationContradiction('F-COR-BR', 'Whitening along the left edge')).toMatch(/left edge/);
    expect(locationContradiction('F-COR-BR', 'Whitening along the right edge near the bottom-right corner')).toBeNull();
    expect(locationContradiction('F-EDG-B-3', 'Flecks along the bottom edge near the bottom-right corner')).toBeNull();
    expect(locationContradiction('F-EDG-B-3', 'Flecks along the top edge')).toMatch(/top edge/);
    expect(locationContradiction('F-SUR-Q1', 'Whitening along the dark left edge')).toBeNull();
    expect(locationContradiction('F-SUR-Q1', 'Scuff near the bottom-right corner')).toMatch(/bottom-right/);
    expect(locationContradiction('F-SUR-HB', 'line near the bottom edge')).toBeNull();
  });
});

describe('(b) attribution', () => {
  it('forces the crop category and keeps real corner/edge wear', () => {
    const { kept, dropped } = attributeZoomDefects([
      { ...d('F-COR-TL', 'whitening', 'moderate', 'White fibers at the corner tip.'), category: 'surface' },
      d('F-EDG-L-1', 'whitening', 'moderate', 'Rough run along the left cut edge.'),
    ]);
    expect(dropped).toEqual([]);
    expect(kept.map(k => k.category)).toEqual(['corners', 'edges']);
  });
  it('drops a surface scratch filed under a corner (Topps Chrome Refractor case)', () => {
    const { kept, dropped } = attributeZoomDefects([d('F-COR-BR', 'scratch', 'minor', 'Thin curved surface scratch visible on the green card area near the center-left.')]);
    expect(kept).toEqual([]);
    expect(dropped[0].reason).toMatch(/surface mark \(scratch\) seen in a corner crop/);
  });
  it('drops a surface stain filed under an edge strip', () => {
    const { dropped } = attributeZoomDefects([d('B-EDG-B-2', 'stain', 'minor', 'Tiny dark spot on the tan bottom border.')]);
    expect(dropped).toHaveLength(1);
  });
  it('re-files an edge run seen in a corner crop to the edge it names (Strata / Score cases)', () => {
    const { kept, dropped, refiled } = attributeZoomDefects([
      d('F-COR-TL', 'whitening', 'moderate', 'Multiple white exposed fibers and roughness run along the left cut edge near the corner.'),
      d('F-EDG-L', 'whitening', 'moderate', 'A continuous jagged run of exposed white cardstock is visible along the left edge.'),
    ]);
    expect(dropped).toEqual([]);
    expect(kept.map(k => `${k.region}:${k.category}`)).toEqual(['F-EDG-L:edges', 'F-EDG-L:edges']);
    expect(refiled).toEqual([expect.objectContaining({ from: 'F-COR-TL', to: 'F-EDG-L', reason: expect.stringMatching(/left edge/) })]);
  });
  it('re-files even when the edge strip saw nothing, so the wear is never lost', () => {
    const { kept } = attributeZoomDefects([d('F-COR-BL', 'whitening', 'moderate', 'A run of white flecks along the lower dark edge near the corner.')]);
    expect(kept).toEqual([expect.objectContaining({ region: 'F-EDG-B', category: 'edges', severity: 'moderate' })]);
  });
  it('without a named side, re-files only to an adjoining edge that reports wear', () => {
    const run = d('F-COR-TL', 'whitening', 'minor', 'Fibers run along the cut edge.');
    expect(attributeZoomDefects([run]).kept[0].region).toBe('F-COR-TL');
    expect(attributeZoomDefects([run, d('F-EDG-T-1', 'whitening', 'minor', 'x')]).kept[0].region).toBe('F-EDG-T');
  });
  it('keeps the corner finding when it describes the tip', () => {
    expect(attributeZoomDefects([
      d('F-COR-TL', 'whitening', 'moderate', 'Whitening at the corner tip, running along the top edge.'),
      d('F-EDG-T-1', 'whitening', 'moderate', 'Whitening along the top edge.'),
    ]).kept).toHaveLength(2);
    // An edge on the OTHER face does not absorb this corner.
    expect(attributeZoomDefects([
      d('F-COR-TL', 'whitening', 'moderate', 'Roughness runs along the left cut edge near the corner.'),
      d('B-EDG-L-1', 'whitening', 'moderate', 'Rough left edge.'),
    ]).kept).toHaveLength(2);
  });
  it('never touches structural findings', () => {
    const s = { ...d('F-SUR-Q1', 'crease', 'heavy', 'Line near the bottom-right corner'), category: 'structural' as const };
    expect(attributeZoomDefects([s]).kept).toEqual([s]);
  });
});

describe('(a) whole-card corroboration', () => {
  const clean = { raw_sub_scores: { corners_front: 10, corners_back: 10, edges_front: 10, edges_back: 10, surface_front: 10, surface_back: 10 },
    corners: { front: { summary: 'Sharp', defects: [] }, back: {} }, edges: { front: {}, back: {} }, surface: { front: { defects: [{ type: 'none', severity: 'none' }] }, back: {} } };
  it('reads evidence from scores below 10 and cited defects, per face and category', () => {
    const noted = { ...clean, raw_sub_scores: { ...clean.raw_sub_scores, edges_back: 9 },
      corners: { front: { top_left: { defects: [{ type: 'whitening', severity: 'minor' }] } }, back: {} } };
    const ev = wholeCardEvidence([clean, noted, clean]);
    expect(ev).toMatchObject({ corners_front: true, corners_back: false, edges_back: true, edges_front: false, surface_front: false });
  });
  it('ignores zoom-sourced defects when reading the whole-card evidence', () => {
    const merged = { ...clean, surface: { front: { defects: [{ type: 'scratch', severity: 'minor', source: 'zoom-inspection' }] } } };
    expect(wholeCardEvidence([merged]).surface_front).toBe(false);
  });
  it('drops a zoom-only finding without a clear majority; keeps corroborated or majority ones', () => {
    const findings = [
      d('F-EDG-B', 'whitening', 'moderate', 'flecks along the bottom edge', { votes: 3, samples: 5 }),
      d('F-COR-TL', 'whitening', 'moderate', 'fibers at the tip', { votes: 2, samples: 5 }),
      d('B-EDG-L', 'whitening', 'moderate', 'rough left edge', { votes: 4, samples: 5 }),
      { ...d('F-SUR-Q1', 'crease', 'heavy', 'line'), category: 'structural' as const },
    ];
    const { kept, dropped } = corroborateZoomDefects(findings, { corners_front: true }, 0.8);
    expect(kept.map(k => k.region)).toEqual(['F-COR-TL', 'B-EDG-L', 'F-SUR-Q1']);
    expect(dropped).toEqual([expect.objectContaining({ region: 'F-EDG-B', reason: expect.stringMatching(/3 of 5 zoom samples is below the 80% majority/) })]);
  });
  it('a moderate/heavy finding with no vote record needs whole-card evidence', () => {
    expect(corroborateZoomDefects([d('F-EDG-B', 'whitening', 'heavy', 'x')], {}).kept).toEqual([]);
  });
  it('minor findings are exempt (Topps Chrome Adams true-9 case)', () => {
    const minor = d('B-COR-BL', 'softening', 'minor', 'tip slightly rounded', { votes: 3, samples: 5 });
    expect(corroborateZoomDefects([minor], {}, 0.8)).toEqual({ kept: [minor], dropped: [] });
  });
});
