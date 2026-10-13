import { describe, expect, it } from 'vitest';
import { printedWearLifts, printedWearReconcileEnabled, type PrintedWearInput } from './printedWearReconcile';

const printed = (region: string, category = 'edges') => ({ region, category, cls: 'printed_design' });
const base = (over: Partial<PrintedWearInput> = {}): PrintedWearInput => ({
  scores: { corners: 5, edges: 4 },
  zoomOk: true,
  zoomDefects: [],
  verifierDropped: [printed('F-EDG-T-1'), printed('F-EDG-L-2')],
  uninspectedRegions: [],
  appliedFaceCaps: {},
  rigidCase: false,
  structuralDetected: false,
  ...over,
});

describe('printed-wear reconciliation', () => {
  it('is on unless PRINTED_WEAR_RECONCILE is off', () => {
    expect(printedWearReconcileEnabled({})).toBe(true);
    expect(printedWearReconcileEnabled({ PRINTED_WEAR_RECONCILE: 'off' })).toBe(false);
  });

  it('Smaug pattern: printed frame read as wear, zoom clean -> corners and edges take 9', () => {
    expect(printedWearLifts(base())).toEqual([
      { cat: 'corners', from: 5, to: 9, printedRegions: ['F-EDG-T-1', 'F-EDG-L-2'] },
      { cat: 'edges', from: 4, to: 9, printedRegions: ['F-EDG-T-1', 'F-EDG-L-2'] },
    ]);
  });

  it('a minor zoom face cap bounds the lift', () => {
    const lifts = printedWearLifts(base({ zoomDefects: [{ category: 'edges', severity: 'minor', region: 'B-EDG-R-1' }], appliedFaceCaps: { edges_back: 8 } }));
    expect(lifts.find(l => l.cat === 'edges')?.to).toBe(8);
  });

  it('surviving moderate or heavy wear in the category blocks that category only', () => {
    const lifts = printedWearLifts(base({ zoomDefects: [{ category: 'corners', severity: 'moderate', region: 'B-COR-TL' }] }));
    expect(lifts.map(l => l.cat)).toEqual(['edges']);
  });

  it('needs two distinct printed crops', () => {
    expect(printedWearLifts(base({ verifierDropped: [printed('F-EDG-T-1')] }))).toEqual([]);
    expect(printedWearLifts(base({ verifierDropped: [printed('F-EDG-T-1'), { ...printed('F-EDG-T-1'), category: 'edges' }] }))).toEqual([]);
    expect(printedWearLifts(base({ verifierDropped: [printed('F-SUR-Q1', 'surface'), printed('F-SUR-Q2', 'surface')] }))).toEqual([]);
    expect(printedWearLifts(base({ verifierDropped: [{ ...printed('F-EDG-T-1'), cls: 'photo_artifact' }, printed('F-EDG-L-2')] }))).toEqual([]);
  });

  it('leaves 8s, held cases, structural damage, failed zoom and uninspected crops alone', () => {
    expect(printedWearLifts(base({ scores: { corners: 8, edges: 8 } }))).toEqual([]);
    expect(printedWearLifts(base({ rigidCase: true }))).toEqual([]);
    expect(printedWearLifts(base({ structuralDetected: true }))).toEqual([]);
    expect(printedWearLifts(base({ zoomOk: false }))).toEqual([]);
    expect(printedWearLifts(base({ uninspectedRegions: ['B-EDG-B-2'] })).map(l => l.cat)).toEqual(['corners']);
  });
});
