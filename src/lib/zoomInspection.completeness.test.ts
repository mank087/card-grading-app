import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn() }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
vi.mock('./apiUsageLogger', () => ({ logOpenAIUsage: vi.fn() }));
vi.mock('./images/originalImages', () => ({ fetchCardOriginals: mocks.fetch }));
import { runZoomInspection, detectCardGeometry, verifyStructuralClaim } from './zoomInspection';
import { buildCaptureQualityRecord } from './grading/captureQualityLog';

let images: { front: Buffer; back: Buffer };
const choice = (value: unknown) => ({ finish_reason: 'stop', message: { content: JSON.stringify(value) } });
beforeAll(async () => {
  const buffer = await sharp({ create: { width: 600, height: 840, channels: 3, background: '#888888' } }).jpeg().toBuffer();
  images = { front: buffer, back: buffer };
});
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ZOOM_DISABLED', '0'); });
afterEach(() => vi.unstubAllEnvs());
function cleanResponse(config: any) {
  const ids = config.messages.flatMap((message: any) => Array.isArray(message.content) ? message.content : [])
    .filter((item: any) => item.type === 'text' && /^REGION /.test(item.text))
    .map((item: any) => item.text.split(' ')[1]);
  return { choices: Array.from({ length: 5 }, () => choice({ clean: ids, findings: [] })) };
}
const options = () => ({ images, cardType: 'sports', precomputedGeometry: { frontFill: 90, backFill: 90 } });

describe('actual zoom pipeline with injected API failures', () => {
  it('reports only coverage supported by complete region responses', async () => {
    mocks.create.mockImplementation(async config => cleanResponse(config));
    const result = await runZoomInspection('unused-front', 'unused-back', options());
    expect(result.ok).toBe(true);
    expect(result.regionsInspected).toBeGreaterThan(0);
    expect(result.coverage?.inspected).toBe(result.coverage?.expected);
    expect(result.defects).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not report an empty JSON object as a clean inspection', async () => {
    mocks.create.mockResolvedValue({ choices: Array.from({ length: 5 }, () => choice({})) });
    const result = await runZoomInspection('unused-front', 'unused-back', options());
    expect(result.ok).toBe(false);
    expect(result.regionsInspected).toBe(0);
    expect(result.coverage?.incompleteBatches).toBeGreaterThan(0);
  });
  it('preserves successful batch coverage when another batch request fails', async () => {
    mocks.create.mockImplementation(async config => {
      const response = cleanResponse(config);
      if (JSON.parse(response.choices[0].message.content).clean.includes('F-COR-TL')) throw new Error('batch unavailable');
      return response;
    });
    const result = await runZoomInspection('unused-front', 'unused-back', options());
    expect(result.ok).toBe(false);
    expect(result.regionsInspected).toBeGreaterThan(0);
    expect(result.regionsInspected).toBeLessThan(result.coverage!.expected);
    expect(result.faceCaps).toEqual({});
    expect(buildCaptureQualityRecord(result)).toMatchObject({ gate_version: 'cq-2', zoom_inspection_status: 'incomplete',
      zoom_coverage: { inspected: result.regionsInspected } });
  });
  it('abandons unknown geometry instead of assuming full frame fill', async () => {
    const result = await runZoomInspection('unused-front', 'unused-back', {
      images, precomputedGeometry: { frontFill: null, backFill: null },
    });
    expect(result).toMatchObject({ ok: false, regionsInspected: 0, capture: { outcome: 'abandoned' } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('abandons geometry service failures instead of proceeding with blind crops', async () => {
    mocks.create.mockRejectedValue(new Error('gate unavailable'));
    expect(await runZoomInspection('unused-front', 'unused-back', { images })).toMatchObject({ ok: false, capture: { outcome: 'abandoned' } });
  });
  it('rejects truncated geometry and null/string fill values', async () => {
    mocks.create.mockResolvedValueOnce({ choices: [{ ...choice({ front_fill_percent: 90 }), finish_reason: 'length' }] });
    await expect(detectCardGeometry(images.front, images.back)).rejects.toThrow('incomplete');
    mocks.create.mockResolvedValueOnce({ choices: [choice({ front_fill_percent: null, back_fill_percent: '90' })] });
    expect(await detectCardGeometry(images.front, images.back)).toMatchObject({ frontFill: null, backFill: null });
  });
  it('rejects crossed or concave corner geometry before creating card-relative crops', async () => {
    const corners = [{ x: 50, y: 50 }, { x: 950, y: 50 }, { x: 300, y: 300 }, { x: 50, y: 950 }];
    const result = await runZoomInspection('unused', 'unused', { images,
      precomputedGeometry: { frontFill: 40, backFill: 40, front: corners, back: corners } });
    expect(result).toMatchObject({ ok: false, capture: { outcome: 'abandoned' } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('leaves disabled inspection explicitly incomplete', async () => {
    vi.stubEnv('ZOOM_DISABLED', '1');
    expect(await runZoomInspection('unused', 'unused', options())).toMatchObject({ ok: false, regionsInspected: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('structural verification has an unknown outcome', () => {
  const findings = [{ type: 'crease', location: 'front top left', description: 'line' }];
  it('does not confirm on request failure, malformed output, or a missing claim', async () => {
    for (const response of [null, { choices: [choice({})] }, { choices: Array.from({ length: 3 }, () => choice({ verdicts: [] })) }]) {
      mocks.create.mockImplementation(async () => { if (!response) throw new Error('offline'); return response; });
      expect(await verifyStructuralClaim('unused', 'unused', findings, { images })).toMatchObject({ ok: false, confirmed: null });
    }
  });
  it('keeps unknown distinct from a complete rejection or confirmation', async () => {
    for (const damaged of [false, true]) {
      mocks.create.mockImplementation(async config => {
        const labels = config.messages[0].content.filter((item: any) => item.type === 'text' && item.text.startsWith('CLAIM — '))
          .map((item: any) => item.text.slice('CLAIM — '.length, -1));
        return { choices: Array.from({ length: 3 }, () => choice({ verdicts: labels.map((claim: string) => ({
          claim, physical_damage: damaged, evidence: damaged ? 'ink_break_or_fiber' : 'none', reason: 'Reviewed visible material.',
        })) })) };
      });
      expect(await verifyStructuralClaim('unused', 'unused', findings, { images })).toMatchObject({ ok: true, confirmed: damaged });
    }
  });
  it('merges claims that share a crop and verifies more than four crops in chunks', async () => {
    const respond = (damagedWhen: (label: string) => boolean) => async (config: any) => {
      const labels = config.messages[0].content.filter((item: any) => item.type === 'text' && item.text.startsWith('CLAIM — '))
        .map((item: any) => item.text.slice('CLAIM — '.length, -1));
      return { choices: Array.from({ length: 3 }, () => choice({ verdicts: labels.map((claim: string) => {
        const damaged = damagedWhen(claim);
        return { claim, physical_damage: damaged, evidence: damaged ? 'ink_break_or_fiber' : 'none', reason: 'Reviewed visible material.' };
      }) })) };
    };
    // Six claims (holistic + zoom duplicates) over two crops: one request, not "incomplete".
    const duplicated = Array.from({ length: 6 }, (_, i) => ({ type: i % 2 ? 'bend' : 'crease', location: i < 3 ? 'front top left' : 'back lower right', description: `line ${i}` }));
    mocks.create.mockReset();
    mocks.create.mockImplementation(respond(() => false));
    expect(await verifyStructuralClaim('unused', 'unused', duplicated, { images })).toMatchObject({ ok: true, confirmed: false });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    // Six DISTINCT crops: two requests; damage confirmed in the second chunk still confirms.
    const spread = ['front top left', 'front top right', 'front lower left', 'front lower right', 'back top left', 'back lower right']
      .map(location => ({ type: 'crease', location, description: 'line' }));
    mocks.create.mockReset();
    mocks.create.mockImplementation(respond(label => label.includes('back lower right')));
    expect(await verifyStructuralClaim('unused', 'unused', spread, { images })).toMatchObject({ ok: true, confirmed: true });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it('does not confirm when originals cannot be fetched or claim types cannot be verified', async () => {
    mocks.fetch.mockRejectedValue(new Error('image unavailable'));
    expect(await verifyStructuralClaim('unused', 'unused', findings)).toMatchObject({ ok: false, confirmed: null });
    expect(await verifyStructuralClaim('unused', 'unused', [{ ...findings[0], type: 'unknown' }], { images })).toMatchObject({ ok: false, confirmed: null });
  });
});
