import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn() }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
vi.mock('./apiUsageLogger', () => ({ logOpenAIUsage: vi.fn() }));
vi.mock('./images/originalImages', () => ({ fetchCardOriginals: mocks.fetch }));
import { runZoomInspection, zoomSystemPrompt, computeZoomFaceCaps, type ZoomDefect } from './zoomInspection';
import { ZOOM_DESIGN_ARTIFACT_EXCLUSIONS } from './grading/zoomCorroboration';

// sha256 of the shipped ZOOM_SYSTEM_PROMPT. The default path must keep sending exactly this
// text; change it only with a zoom calibration run (scripts/run-zoom-calibration.ts).
// Oct 5 2026: + PRINTED TEXTURE IS NOT A STAIN (was 0c6f32c5... from 3c535e58).
const SHIPPED_PROMPT_SHA256 = '786e1bb4d6192d196ec0a2fb26eee2dab99cc6a8e1b65b8c85e2c2ea79de1504';

let images: { front: Buffer; back: Buffer };
const choice = (value: unknown) => ({ finish_reason: 'stop', message: { content: JSON.stringify(value) } });
const regionIds = (config: any): string[] => config.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : [])
  .filter((item: any) => item.type === 'text' && /^REGION /.test(item.text)).map((item: any) => item.text.split(' ')[1]);

/** Five samples; `findings[id]` lists defects reported by the first `votes` samples for that region. */
function respond(findings: Record<string, { votes: number; defects: any[] }>) {
  return async (config: any) => {
    const ids = regionIds(config);
    return {
      choices: Array.from({ length: 5 }, (_, sample) => {
        const flagged = ids.filter(id => findings[id] && sample < findings[id].votes);
        return choice({
          clean: ids.filter(id => !flagged.includes(id)),
          findings: flagged.map(id => ({ id, card_area: 'most', defects: findings[id].defects })),
        });
      }),
    };
  };
}
const options = () => ({ images, cardType: 'sports', precomputedGeometry: { frontFill: 90, backFill: 90 } });

beforeAll(async () => {
  const buffer = await sharp({ create: { width: 600, height: 840, channels: 3, background: '#888888' } }).jpeg().toBuffer();
  images = { front: buffer, back: buffer };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ZOOM_DISABLED', '0');
  // No storage writes from a unit test: evidence upload needs both of these.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());

const FINDINGS = {
  // corner crop reporting a surface scratch at a location the crop cannot contain
  'F-COR-BR': { votes: 5, defects: [{ type: 'scratch', severity: 'minor', description: 'Thin scratch near the top-left corner.' }] },
  // edge wear along the bottom edge, reported in both the corner and the edge strip
  'F-COR-BL': { votes: 4, defects: [{ type: 'whitening', severity: 'moderate', description: 'A run of white flecks along the lower dark edge near the corner.' }] },
  'F-EDG-B-2': { votes: 4, defects: [{ type: 'whitening', severity: 'moderate', description: 'White flecks along the dark bottom edge.' }] },
};

describe('ZOOM_CORROBORATION_V1 off: default path unchanged', () => {
  it('sends exactly the shipped zoom prompt', async () => {
    expect(createHash('sha256').update(zoomSystemPrompt(false)).digest('hex')).toBe(SHIPPED_PROMPT_SHA256);
    mocks.create.mockImplementation(respond({}));
    await runZoomInspection('u', 'u', options());
    const sent = mocks.create.mock.calls.map(([config]: any) => config.messages[0].content);
    expect(sent.length).toBeGreaterThan(0);
    for (const s of sent) expect(createHash('sha256').update(s).digest('hex')).toBe(SHIPPED_PROMPT_SHA256);
  });

  it.each([undefined, '', 'off', '0', 'false'])('flag=%s: no votes, no attribution, caps as before', async (flag) => {
    if (flag !== undefined) vi.stubEnv('ZOOM_CORROBORATION_V1', flag);
    mocks.create.mockImplementation(respond(FINDINGS));
    const result = await runZoomInspection('u', 'u', options());
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('corroboration');
    for (const d of result.defects) {
      expect(d).not.toHaveProperty('votes');
      expect(d).not.toHaveProperty('samples');
    }
    // Pre-flag behaviour: the corner-crop scratch counts against the corner (minor -> 9)
    // and the corner-crop edge run counts too (moderate -> 8).
    expect(result.defects.map(d => `${d.region}:${d.type}`).sort()).toEqual(['F-COR-BL:whitening', 'F-COR-BR:scratch', 'F-EDG-B-2:whitening']);
    expect(result.faceCaps).toEqual({ corners_front: 8, edges_front: 8 });
    expect(result.faceCaps).toEqual(computeZoomFaceCaps(result.defects));
  });
});

describe('ZOOM_CORROBORATION_V1 on', () => {
  it('appends the design/photo artifact exclusions to the prompt', async () => {
    vi.stubEnv('ZOOM_CORROBORATION_V1', 'on');
    expect(zoomSystemPrompt(true)).toBe(zoomSystemPrompt(false) + ZOOM_DESIGN_ARTIFACT_EXCLUSIONS);
    mocks.create.mockImplementation(respond({}));
    await runZoomInspection('u', 'u', options());
    for (const [config] of mocks.create.mock.calls as any[]) expect(config.messages[0].content).toBe(zoomSystemPrompt(true));
  });

  it('records votes and applies attribution before caps', async () => {
    vi.stubEnv('ZOOM_CORROBORATION_V1', 'on');
    mocks.create.mockImplementation(respond(FINDINGS));
    const result = await runZoomInspection('u', 'u', options());
    expect(result.ok).toBe(true);
    expect(result.defects.map(d => `${d.region}:${d.category}:${d.votes}/${d.samples}`).sort())
      .toEqual(['F-EDG-B-2:edges:4/5', 'F-EDG-B:edges:4/5']);
    // the corner-crop run and the edge strip are one physical side: counted once
    expect(result.faceCaps).toEqual({ edges_front: 8 });
    expect(result.corroboration?.dropped.map(d => d.region)).toEqual(['F-COR-BR']);
    expect(result.corroboration?.refiled).toEqual([expect.objectContaining({ from: 'F-COR-BL', to: 'F-EDG-B' })]);
  });
});

describe('computeZoomFaceCaps keeps the v9.3 ladder rules', () => {
  const d = (region: string, category: ZoomDefect['category'], type: string, severity: ZoomDefect['severity']): ZoomDefect =>
    ({ region, face: region.startsWith('F') ? 'front' : 'back', category, type, severity, description: '' });
  it('native crops only, minor-only never below 9, 3+ locations one lower, border wear ignored on surface', () => {
    expect(computeZoomFaceCaps([
      d('F-COR-TL', 'corners', 'whitening', 'moderate'), d('F-COR-TR', 'corners', 'whitening', 'moderate'), d('F-COR-BL', 'corners', 'chip', 'moderate'),
      d('B-EDG-L-1', 'edges', 'whitening', 'minor'), d('B-EDG-L-2', 'edges', 'whitening', 'minor'),
      d('F-SUR-Q1', 'surface', 'whitening', 'heavy'), d('B-SUR-Q2', 'surface', 'scratch', 'heavy'),
      d('F-EDG-T-1', 'corners', 'whitening', 'heavy'),
    ])).toEqual({ corners_front: 7, edges_back: 9, surface_back: 6 });
  });
});
