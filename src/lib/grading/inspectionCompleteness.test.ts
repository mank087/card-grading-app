import { describe, expect, it, vi } from 'vitest';
import { inspectZoomBatch, parseZoomSample, validFill, requireCompleteZoom,
  IncompleteInspectionError, inspectionFailureResponse, requireCompleteEnsemble } from './inspectionCompleteness';

const ids = ['F-COR-TL', 'B-COR-TL'];
const choice = (value: unknown, extra = {}) => ({ finish_reason: 'stop', message: { content: JSON.stringify(value) }, ...extra });
const clean = () => choice({ clean: ids, findings: [] });
const finding = { id: ids[1], card_area: 'most', defects: [{ type: 'chip', severity: 'minor', description: 'Visible missing material at the tip.' }] };

describe('zoom sample evidence contract', () => {
  it('keeps explicit clean votes and canonicalizes known region aliases', () => {
    expect(parseZoomSample(choice({ clean: ['REGION F-COR-TL', ids[1]], findings: [] }), ids)?.regions).toHaveLength(2);
    expect(parseZoomSample(choice({ clean: [ids[0]], findings: [finding] }), ids)?.regions[1].clean).toBe(false);
  });
  it.each([
    {}, { clean: ids, findings: [finding] },
    { clean: [...ids, 'UNKNOWN'], findings: [] }, { clean: ids, findings: [null] },
    { clean: ids, findings: 'broken' },
    { clean: [ids[0]], findings: [{ ...finding, card_area: 'sideways' }] },
    { clean: [ids[0]], findings: [{ ...finding, defects: [{ type: 'chip', severity: 'extreme', description: 'tip' }] }] },
  ])('rejects contradictory or malformed evidence: %j', value => {
    expect(parseZoomSample(choice(value), ids)).toBeNull();
  });
  it.each([
    { clean: [ids[0]], findings: [] }, // omitted
    { clean: [ids[0]], findings: [{ ...finding, card_area: 'none' }] }, // no card in the crop
    { clean: [ids[0]], findings: [{ ...finding, card_area: 'some', defects: [] }] }, // listed, nothing inspectable
  ])('gives an unobserved region no vote — never a clean one: %j', value => {
    expect(parseZoomSample(choice(value), ids)?.regions.map(r => r.id)).toEqual([ids[0]]);
  });
  it('keeps a background-heavy crop that still shows a defect (edge strips always include background)', () => {
    expect(parseZoomSample(choice({ clean: [ids[0]], findings: [{ ...finding, card_area: 'some' }] }), ids)?.regions).toHaveLength(2);
  });
  it('counts a fully visible region filed under findings with nothing to report as an observed clean vote', () => {
    const regions = parseZoomSample(choice({ clean: [ids[0]], findings: [{ ...finding, defects: [] }] }), ids)?.regions;
    expect(regions).toHaveLength(2);
    expect(regions?.[1]).toMatchObject({ id: ids[1], clean: true });
  });
  it('requires quorum per region, not a perfect sample', async () => {
    // Each sample misses a different region, yet every region is observed by 3+.
    const three = ['F-COR-TL', 'B-COR-TL', 'F-EDG-T'];
    const miss = (i: number) => choice({ clean: three.filter((_, k) => k !== i), findings: [] });
    const ok = await inspectZoomBatch(three, async () => ({ choices: [miss(0), miss(1), miss(2), choice({ clean: three, findings: [] }), choice({ clean: three, findings: [] })] }));
    expect(ok).toMatchObject({ complete: true, covered: 3, attempts: 1 });
    // One region observed by only two samples, twice: incomplete, and it says how much was covered.
    const thin = await inspectZoomBatch(three, async () => ({ choices: [miss(0), miss(0), miss(0), choice({ clean: three, findings: [] }), choice({ clean: three, findings: [] })] }));
    expect(thin).toMatchObject({ complete: false, covered: 2, attempts: 2 });
  });
  it('rejects truncation and refusal even when JSON happens to parse', () => {
    expect(parseZoomSample({ ...clean(), finish_reason: 'length' }, ids)).toBeNull();
    expect(parseZoomSample({ ...clean(), message: { ...clean().message, refusal: 'cannot inspect' } }, ids)).toBeNull();
  });
  it('accepts fully specified legacy verdicts without inventing defaults', () => {
    const regions = ids.map(id => ({ id, card_area: 'most', clean: true, defects: [] }));
    expect(parseZoomSample(choice({ regions }), ids)).not.toBeNull();
    delete (regions[0] as any).card_area;
    expect(parseZoomSample(choice({ regions }), ids)).toBeNull();
  });
});

describe('batch fault isolation', () => {
  it('retries a rejected request and recovers with a complete quorum', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline failure'))
      .mockResolvedValueOnce({ choices: [clean(), clean(), clean()] });
    expect(await inspectZoomBatch(ids, request)).toMatchObject({ complete: true, attempts: 2 });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not aggregate two insufficient retries into a false quorum', async () => {
    const request = vi.fn().mockResolvedValue({ choices: [clean(), clean()] });
    const result = await inspectZoomBatch(ids, request);
    expect(result.complete).toBe(false);
    expect(result.batchSamples).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('keeps a successful batch independent of a persistently failing batch', async () => {
    const success = vi.fn().mockResolvedValue({ choices: [clean(), clean(), clean()] });
    const failure = vi.fn().mockRejectedValue(new Error('unavailable'));
    const results = await Promise.all([inspectZoomBatch(ids, success), inspectZoomBatch(ids, failure)]);
    expect(results.map(result => result.complete)).toEqual([true, false]);
    expect(success).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledTimes(2);
  });
});

describe('incomplete outcome boundary', () => {
  it('requires three real scored evaluations, without substituting surviving passes', () => {
    const pass = { final: 9, cats: { centering: 9, corners: 9, edges: 9, surface: 9 } };
    expect(() => requireCompleteEnsemble([pass, pass, pass])).not.toThrow();
    expect(() => requireCompleteEnsemble([pass, pass])).toThrow(IncompleteInspectionError);
    for (const score of [null, NaN, Infinity, -1, 11]) {
      expect(() => requireCompleteEnsemble([pass, pass, { ...pass, cats: { ...pass.cats, surface: score } }])).toThrow(IncompleteInspectionError);
    }
  });
  it.each([null, undefined, '', '90', -1, 101, NaN, Infinity])('does not coerce invalid fill %j into evidence', value => {
    expect(validFill(value)).toBeNull();
  });
  it('allows valid fill endpoints and blocks incomplete grades with a safe public response', () => {
    expect(validFill(0)).toBe(0);
    expect(validFill(100)).toBe(100);
    expect(() => requireCompleteZoom({ ok: false })).toThrow(IncompleteInspectionError);
    expect(() => requireCompleteZoom(null)).toThrow(IncompleteInspectionError);
    expect(() => requireCompleteZoom({ ok: true })).not.toThrow();
    const response = inspectionFailureResponse(new IncompleteInspectionError('geometry', 'private diagnostic'));
    expect(response).toMatchObject({ inspection_incomplete: true, next_action: 'retake_photos' });
    expect(response.error).toMatch(/^Inspection incomplete \(geometry\)\. .*Retake both photos/);
    expect(response).toMatchObject({ inspection_reason: null });
    const declined = inspectionFailureResponse(new IncompleteInspectionError('ensemble', 'x', 'different_cards'));
    expect(declined).toMatchObject({ inspection_reason: 'different_cards', next_action: 'retake_photos' });
    expect(declined.error).toMatch(/^Inspection incomplete \(ensemble\)\. \[different_cards\] The front and back photos appear to show two different cards\./);
    expect(inspectionFailureResponse(new IncompleteInspectionError('ensemble', 'x', 'altered_marking'))).toMatchObject({ next_action: 'contact_support' });
    expect(JSON.stringify(response)).not.toContain('private diagnostic');
    expect(inspectionFailureResponse(new Error('other'))).toEqual({});
  });
});
