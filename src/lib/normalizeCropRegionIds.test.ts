import { describe, it, expect } from 'vitest';
import { normalizeCropRegionIds } from './normalizeCropRegionIds';

const EXPECTED = ['F-COR-TL', 'F-COR-TR', 'B-SUR-Q1'];

describe('normalizeCropRegionIds', () => {
  it('maps a "REGION " prefixed id to the exact expected id', () => {
    const raw = { clean: ['REGION F-COR-TL'], findings: [{ id: 'REGION F-COR-TR', defects: [{ type: 'scratch' }] }] };
    const out = normalizeCropRegionIds(raw, EXPECTED);
    expect(out.value.clean).toEqual(['F-COR-TL']);
    expect(out.value.findings).toEqual([{ id: 'F-COR-TR', defects: [{ type: 'scratch' }] }]);
    expect(out.aliases).toEqual([
      { original: 'REGION F-COR-TL', canonical: 'F-COR-TL' },
      { original: 'REGION F-COR-TR', canonical: 'F-COR-TR' },
    ]);
    expect(out.rejected).toEqual([]);
  });

  it('passes exact ids through untouched', () => {
    const raw = { clean: ['F-COR-TL'], findings: [{ id: 'B-SUR-Q1', defects: [] }] };
    const out = normalizeCropRegionIds(raw, EXPECTED);
    expect(out.value).toEqual(raw);
    expect(out.aliases).toEqual([]);
  });

  it('rejects unknown, partial, lower-case and non-string ids without inferring anything', () => {
    const raw = {
      clean: ['f-cor-tl', 'F-COR', 'REGION F-COR-BL', 'REGION  F-COR-TL', 42, null],
      findings: [{ id: 'F-COR-TLX', defects: [] }, { id: undefined, defects: [] }, 'not-an-object'],
    };
    const out = normalizeCropRegionIds(raw as any, EXPECTED);
    expect(out.value.clean).toEqual([]);
    expect(out.value.findings).toEqual([]);
    expect(out.rejected).toEqual(['f-cor-tl', 'F-COR', 'REGION F-COR-BL', 'REGION  F-COR-TL', 42, null, 'F-COR-TLX', undefined]);
  });

  it('handles the legacy {regions:[...]} shape', () => {
    const raw = { regions: [{ id: 'REGION B-SUR-Q1', clean: true }, { id: 'nope', clean: true }] };
    const out = normalizeCropRegionIds(raw, EXPECTED);
    expect(out.value.regions).toEqual([{ id: 'B-SUR-Q1', clean: true }]);
    expect(out.rejected).toEqual(['nope']);
  });

  it('leaves duplicates alone — the tally dedups per sample', () => {
    const raw = { clean: ['F-COR-TL', 'REGION F-COR-TL'], findings: [] };
    const out = normalizeCropRegionIds(raw, EXPECTED);
    expect(out.value.clean).toEqual(['F-COR-TL', 'F-COR-TL']);
  });

  it('never throws on garbage', () => {
    expect(normalizeCropRegionIds(null as any, EXPECTED).value).toBeNull();
    expect(normalizeCropRegionIds({} as any, EXPECTED).value).toEqual({});
    // A non-array `clean` is not the compact shape: pass it through untouched.
    expect(normalizeCropRegionIds({ clean: 'x' } as any, EXPECTED).value).toEqual({ clean: 'x' });
  });
});
