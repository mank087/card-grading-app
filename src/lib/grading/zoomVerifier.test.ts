import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn() }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
vi.mock('../apiUsageLogger', () => ({ logOpenAIUsage: vi.fn() }));
vi.mock('../images/originalImages', () => ({ fetchCardOriginals: mocks.fetch }));
import {
  referenceRegionId, isVerifiable, parseZoomVerifierSample, tallyZoomVerifier, zoomVerifierEnabled, zoomVerifierPrompt,
} from './zoomVerifier';
import { runZoomInspection } from '../zoomInspection';

const flags = (list: Array<[string, string, string[]?]>) =>
  JSON.stringify({ flags: list.map(([id, cls, evidence = []]) => ({ id, class: cls, evidence, justification: `${cls} reason` })) });

describe('zoom verifier (pure)', () => {
  it('is on unless ZOOM_VERIFIER_V1 is off', () => {
    expect(zoomVerifierEnabled({})).toBe(true);
    expect(zoomVerifierEnabled({ ZOOM_VERIFIER_V1: 'off' })).toBe(false);
    expect(zoomVerifierEnabled({ ZOOM_VERIFIER_V1: '0' })).toBe(false);
  });

  it('maps each crop to the opposite position on the same face', () => {
    expect(referenceRegionId('F-COR-TL')).toBe('F-COR-BR');
    expect(referenceRegionId('B-COR-TR')).toBe('B-COR-BL');
    expect(referenceRegionId('F-EDG-L-2')).toBe('F-EDG-R-2');
    expect(referenceRegionId('B-EDG-T')).toBe('B-EDG-B');
    expect(referenceRegionId('F-SUR-Q2')).toBe('F-SUR-Q3');
    expect(referenceRegionId('F-SUR-HB')).toBe('F-SUR-VB');
    expect(referenceRegionId('nonsense')).toBeNull();
  });

  it('never verifies structural findings or stains', () => {
    expect(isVerifiable({ category: 'structural', type: 'crease' })).toBe(false);
    expect(isVerifiable({ category: 'surface', type: 'bend' })).toBe(false);
    expect(isVerifiable({ category: 'edges', type: 'whitening' })).toBe(true);
    expect(isVerifiable({ category: 'surface', type: 'stain' })).toBe(false);
  });

  it('a wear verdict without a physical sign counts as cannot_tell', () => {
    const s = parseZoomVerifierSample(flags([['D1', 'physical_wear'], ['D2', 'physical_wear', ['exposed_stock_at_cut']]]), 2)!;
    expect(s.map(v => v.cls)).toEqual(['cannot_tell', 'physical_wear']);
  });

  it('rejects a sample with a missing, duplicate or unknown entry', () => {
    expect(parseZoomVerifierSample(flags([['D1', 'printed_design']]), 2)).toBeNull();
    expect(parseZoomVerifierSample(flags([['D1', 'printed_design'], ['D1', 'printed_design']]), 2)).toBeNull();
    expect(parseZoomVerifierSample(flags([['D1', 'graffiti']]), 1)).toBeNull();
    expect(parseZoomVerifierSample('not json', 1)).toBeNull();
  });

  it('drops only on a majority of printed / photo verdicts from at least two complete samples', () => {
    const p = (cls: string, ev?: string[]) => parseZoomVerifierSample(flags([['D1', cls, ev]]), 1);
    expect(tallyZoomVerifier([p('printed_design'), p('photo_artifact'), p('physical_wear', ['gloss_break'])], 1)[0]).toMatchObject({ drop: true, cls: 'printed_design', notDamageVotes: 2, samples: 3 });
    expect(tallyZoomVerifier([p('printed_design'), p('cannot_tell'), p('physical_wear', ['gloss_break'])], 1)[0].drop).toBe(false);
    expect(tallyZoomVerifier([p('printed_design'), null, null], 1)[0].drop).toBe(false); // one sample is not a majority
    expect(tallyZoomVerifier([p('printed_design'), p('printed_design'), null], 1)[0].drop).toBe(true);
    expect(tallyZoomVerifier([p('printed_design'), p('cannot_tell')], 1)[0].drop).toBe(false); // a tie keeps
  });

  it('names every flag in the prompt', () => {
    const text = zoomVerifierPrompt([
      { region: 'F-EDG-T-1', face: 'front', category: 'edges', type: 'whitening', severity: 'heavy' },
      { region: 'B-SUR-Q4', face: 'back', category: 'surface', type: 'scratch', severity: 'minor' },
    ], 'Magic: The Gathering');
    expect(text).toContain('D1. heavy whitening - front edges, crop F-EDG-T-1');
    expect(text).toContain('D2. minor scratch - back surface, crop B-SUR-Q4');
    expect(text).toContain('Magic: The Gathering');
  });
});

describe('zoom verifier in runZoomInspection', () => {
  let images: { front: Buffer; back: Buffer };
  const choice = (value: unknown) => ({ finish_reason: 'stop', message: { content: typeof value === 'string' ? value : JSON.stringify(value) } });
  const regionIds = (config: any): string[] => config.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : [])
    .filter((i: any) => i.type === 'text' && /^REGION /.test(i.text)).map((i: any) => i.text.split(' ')[1]);
  const isVerifierCall = (config: any) => JSON.stringify(config.messages).includes('FLAGGED:');
  const FINDINGS: Record<string, any[]> = {
    'F-EDG-T-1': [{ type: 'whitening', severity: 'heavy', description: 'Light worn band along the top edge.' }],
    'B-COR-BR': [{ type: 'whitening', severity: 'moderate', description: 'White fibre at the corner tip.' }],
  };
  const zoomReply = (config: any) => {
    const ids = regionIds(config);
    const flagged = ids.filter(id => FINDINGS[id]);
    return { choices: Array.from({ length: 5 }, () => choice({ clean: ids.filter(id => !FINDINGS[id]), findings: flagged.map(id => ({ id, card_area: 'most', defects: FINDINGS[id] })) })) };
  };
  const verifierReply = (config: any, classFor: (label: string) => [string, string[]?]) => {
    const text = config.messages[0].content[0].text as string;
    const lines = [...text.matchAll(/^D(\d+)\. (.+)$/gm)];
    return { choices: Array.from({ length: 3 }, () => choice(flags(lines.map(m => [`D${m[1]}`, ...classFor(m[2])] as [string, string, string[]?])))) };
  };
  const options = () => ({ images, cardType: 'mtg', precomputedGeometry: { frontFill: 90, backFill: 90 } });

  beforeAll(async () => {
    const b = await sharp({ create: { width: 600, height: 840, channels: 3, background: '#888888' } }).jpeg().toBuffer();
    images = { front: b, back: b };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ZOOM_DISABLED', '0');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('off: no verifier call and the findings stand', async () => {
    vi.stubEnv('ZOOM_VERIFIER_V1', 'off');
    mocks.create.mockImplementation(async (c: any) => zoomReply(c));
    const r = await runZoomInspection('u', 'u', options());
    expect(mocks.create.mock.calls.some(([c]) => isVerifierCall(c))).toBe(false);
    expect(r.defects.map(d => d.region).sort()).toEqual(['B-COR-BR', 'F-EDG-T-1']);
    expect(r.verifier).toBeUndefined();
  });

  it('on: printed design is removed and its cap goes; real wear stays', async () => {
    vi.stubEnv('ZOOM_VERIFIER_V1', 'on');
    mocks.create.mockImplementation(async (c: any) => isVerifierCall(c)
      ? verifierReply(c, (label) => label.includes('F-EDG-T-1') ? ['printed_design'] : ['physical_wear', ['exposed_stock_at_cut']])
      : zoomReply(c));
    const r = await runZoomInspection('u', 'u', options());
    expect(r.defects.map(d => d.region)).toEqual(['B-COR-BR']);
    expect(r.faceCaps).toEqual({ corners_back: 8 });
    expect(r.verifier).toMatchObject({ checked: 2, failedCalls: 0, dropped: [{ region: 'F-EDG-T-1', cls: 'printed_design', votes: '3/3' }] });
    // the verifier saw the flagged crop, its opposite crop and the whole face
    const call = mocks.create.mock.calls.find(([c]) => isVerifierCall(c))![0];
    const texts = call.messages[0].content.filter((i: any) => i.type === 'text').map((i: any) => i.text);
    expect(texts).toEqual(expect.arrayContaining(['WHOLE FRONT:', 'D1 REFERENCE crop (F-EDG-B-1, opposite position):']));
  });

  it('on: a failed verifier call keeps every finding', async () => {
    vi.stubEnv('ZOOM_VERIFIER_V1', 'on');
    mocks.create.mockImplementation(async (c: any) => { if (isVerifierCall(c)) throw new Error('timeout'); return zoomReply(c); });
    const r = await runZoomInspection('u', 'u', options());
    expect(r.ok).toBe(true);
    expect(r.defects).toHaveLength(2);
    expect(r.verifier).toMatchObject({ dropped: [], failedCalls: 1 });
  });
});
