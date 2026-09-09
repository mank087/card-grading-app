import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * These tests assert the ONE property this module must never lose: it returns
 * null instead of throwing, for every failure mode. They never reach the
 * network — the OpenAI client is mocked (see vitest.config.ts: unit tests must
 * not make grading calls).
 */

const create = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
    constructor(_opts: any) {}
  },
}));
vi.mock('@/lib/images/cardThumbnails', () => ({
  makeThumbnail: vi.fn(async (b: Buffer) => b),
}));

const { identifyCardFromImages } = await import('./identifyCard');

const FRONT = Buffer.from('front-bytes');
const BACK = Buffer.from('back-bytes');
const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

function completion(body: unknown) {
  return {
    choices: [{ message: { content: typeof body === 'string' ? body : JSON.stringify(body) } }],
    usage: { prompt_tokens: 312, completion_tokens: 74 },
  };
}

beforeEach(() => {
  create.mockReset();
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.IDENTIFICATION_MODEL = 'gpt-5.6-luna';
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  delete process.env.IDENTIFICATION_MODEL;
});

describe('identifyCardFromImages', () => {
  it('parses a well-formed answer and reports model/tokens/latency', async () => {
    create.mockResolvedValue(
      completion({
        printed_name_seen: 'AL PILARCIK',
        player_or_character: 'Al Pilarcik',
        card_name: 'Al Pilarcik',
        set_name: 'Topps',
        card_number: '7',
        card_number_text_seen: '7',
        year_hint: '1958',
        language: 'en',
        variant: null,
        confidence: 'high',
      })
    );

    const out = await identifyCardFromImages({ front: FRONT, back: BACK }, { category: 'sports' });
    expect(out).not.toBeNull();
    expect(out!.printed_name_seen).toBe('AL PILARCIK');
    expect(out!.card_number).toBe('7');
    expect(out!.confidence).toBe('high');
    expect(out!.model).toBe('gpt-5.6-luna');
    expect(out!.tokens).toEqual({ in: 312, out: 74 });
    expect(typeof out!.ms).toBe('number');
  });

  it('sends both faces at detail:low, one short prompt, and no sampling params on luna', async () => {
    create.mockResolvedValue(completion({ confidence: 'low' }));
    await identifyCardFromImages({ front: FRONT, back: BACK }, { category: 'pokemon' });

    const [config] = create.mock.calls[0];
    const content = config.messages[0].content;
    expect(content.filter((c: any) => c.type === 'image_url')).toHaveLength(2);
    expect(content.every((c: any) => c.type !== 'image_url' || c.image_url.detail === 'low')).toBe(true);
    expect(content[0].text).toContain('Category hint: pokemon.');
    expect(content[0].text.length).toBeLessThan(900); // stays SHORT — the whole point
    // gpt-5.6-* 400s on these; applyModelCompat must have stripped them.
    expect(config.temperature).toBeUndefined();
    expect(config.top_p).toBeUndefined();
    expect(config.response_format).toEqual({ type: 'json_object' });
  });

  it('sends only the front when there is no back image', async () => {
    create.mockResolvedValue(completion({ confidence: 'low' }));
    await identifyCardFromImages({ front: FRONT, back: null });
    const [config] = create.mock.calls[0];
    expect(config.messages[0].content.filter((c: any) => c.type === 'image_url')).toHaveLength(1);
  });

  it('coerces placeholder junk to null and unknown confidence to low', async () => {
    create.mockResolvedValue(
      completion({ player_or_character: 'unknown', card_number: 'N/A', set_name: '...', confidence: 'pretty sure' })
    );
    const out = await identifyCardFromImages({ front: FRONT });
    expect(out!.player_or_character).toBeNull();
    expect(out!.card_number).toBeNull();
    expect(out!.set_name).toBeNull();
    expect(out!.confidence).toBe('low');
  });

  it('returns null (never throws) when the API call fails', async () => {
    create.mockRejectedValue(new Error('429 rate limited'));
    await expect(identifyCardFromImages({ front: FRONT })).resolves.toBeNull();
  });

  it('returns null on a non-JSON completion', async () => {
    create.mockResolvedValue(completion('This card appears to be a Mickey Mantle.'));
    await expect(identifyCardFromImages({ front: FRONT })).resolves.toBeNull();
  });

  it('returns null on an empty completion', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: '' } }] });
    await expect(identifyCardFromImages({ front: FRONT })).resolves.toBeNull();
  });

  it('skips without calling the API when there is no front image or no key', async () => {
    await expect(identifyCardFromImages({ front: Buffer.alloc(0) })).resolves.toBeNull();
    delete process.env.OPENAI_API_KEY;
    await expect(identifyCardFromImages({ front: FRONT })).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('propagates the caller abort to the request and returns null', async () => {
    create.mockImplementation(async (_config: any, opts: any) => {
      if (opts?.signal?.aborted) throw new Error('The operation was aborted');
      return completion({ confidence: 'high' });
    });
    const ac = new AbortController();
    ac.abort();
    await expect(identifyCardFromImages({ front: FRONT }, { signal: ac.signal })).resolves.toBeNull();
    expect(create.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
