import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

const openaiMode = vi.hoisted(() => ({ mode: 'throw' as 'throw' | 'hang' | 'garbage' }));
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: () => {
          if (openaiMode.mode === 'hang') return new Promise(() => {});
          if (openaiMode.mode === 'garbage') return Promise.resolve({ choices: [{ finish_reason: 'stop', message: { content: '{"front":{}}' } }] });
          return Promise.reject(new Error('503 upstream'));
        },
      },
    };
  },
}));
vi.mock('../apiUsageLogger', () => ({ logOpenAIUsage: () => {} }));

import {
  runPhotoPrecheck,
  decidePrecharge,
  isModelAssessment,
  isPrechargePhotoCheckEnabled,
  type ImageSignals,
  type ModelAssessment,
  type PhotoAssessment,
} from './photoPrecheck';

const card = (over: Partial<PhotoAssessment> = {}): PhotoAssessment => ({
  subject: 'one_trading_card', subject_certain: true, screen_capture: false, screen_capture_certain: false,
  sides_cut_off: 0, print_legibility: 'sharp', note: '', ...over,
});
const answer = (over: Partial<ModelAssessment> = {}): ModelAssessment => ({
  front: card(), back: card(), same_card: 'yes', same_card_certain: true, same_card_evidence: '', ...over,
});
const camera: ImageSignals = { width: 2250, height: 3000, aspect: 4 / 3, format: 'jpeg', blurVariance: 5000 };
const px = (front: Partial<ImageSignals> = {}, back: Partial<ImageSignals> = {}) => ({ front: { ...camera, ...front }, back: { ...camera, ...back } });

describe('decidePrecharge', () => {
  it('passes a normal pair', () => {
    expect(decidePrecharge(answer(), px())).toEqual({ verdict: 'pass', signals: [] });
  });

  it('blocks a certain selfie back as no_card on the back', () => {
    const d = decidePrecharge(answer({ back: card({ subject: 'person', print_legibility: 'no_card' }), same_card: 'no' }), px());
    expect(d).toMatchObject({ verdict: 'block', reason: 'no_card', side: 'back' });
  });

  it('never blocks on an uncertain subject', () => {
    for (const subject of ['person', 'several_cards', 'comic_magazine_or_book', 'no_card_other'] as const) {
      expect(decidePrecharge(answer({ front: card({ subject, subject_certain: false }) }), px()).verdict).toBe('pass');
    }
  });

  it('maps a comic or page front to not_a_card, but a page back to no_card', () => {
    expect(decidePrecharge(answer({ front: card({ subject: 'comic_magazine_or_book' }) }), px())).toMatchObject({ reason: 'not_a_card', side: 'front' });
    expect(decidePrecharge(answer({ back: card({ subject: 'printed_page_or_document' }) }), px())).toMatchObject({ reason: 'no_card', side: 'back' });
  });

  it('blocks several cards', () => {
    const d = decidePrecharge(answer({ front: card({ subject: 'several_cards' }), back: card({ subject: 'several_cards' }) }), px());
    expect(d).toMatchObject({ verdict: 'block', reason: 'multiple_cards', side: 'both' });
  });

  it('blocks different cards only when certain and both photos are cards', () => {
    expect(decidePrecharge(answer({ same_card: 'no' }), px())).toMatchObject({ reason: 'different_cards', side: 'both' });
    expect(decidePrecharge(answer({ same_card: 'no', same_card_certain: false }), px()).verdict).toBe('pass');
    expect(decidePrecharge(answer({ same_card: 'cannot_tell', same_card_certain: false }), px()).verdict).toBe('pass');
  });

  it('blocks framing at two or more cut sides, never at one', () => {
    expect(decidePrecharge(answer({ back: card({ sides_cut_off: 1 }) }), px()).verdict).toBe('pass');
    expect(decidePrecharge(answer({ back: card({ sides_cut_off: 2 }) }), px())).toMatchObject({ reason: 'framing', side: 'back' });
    expect(decidePrecharge(answer({ front: card({ sides_cut_off: 4 }) }), px())).toMatchObject({ reason: 'framing', side: 'front' });
  });

  it('honours PRECHARGE_FRAMING_MIN_CUT_SIDES', () => {
    process.env.PRECHARGE_FRAMING_MIN_CUT_SIDES = '3';
    try {
      expect(decidePrecharge(answer({ back: card({ sides_cut_off: 2 }) }), px()).verdict).toBe('pass');
      expect(decidePrecharge(answer({ back: card({ sides_cut_off: 3 }) }), px()).verdict).toBe('block');
    } finally {
      delete process.env.PRECHARGE_FRAMING_MIN_CUT_SIDES;
    }
  });

  it('blocks blur only when the pixels agree with the model', () => {
    const blurry = answer({ front: card({ print_legibility: 'illegible_blur' }) });
    expect(decidePrecharge(blurry, px({ blurVariance: 555 }))).toMatchObject({ reason: 'blurry', side: 'front' });
    expect(decidePrecharge(blurry, px({ blurVariance: 4000 })).verdict).toBe('pass');
    expect(decidePrecharge(blurry, px({ blurVariance: null })).verdict).toBe('pass');
    // Low variance alone (a sleeved card measured 436) never blocks.
    expect(decidePrecharge(answer(), px({ blurVariance: 436 })).verdict).toBe('pass');
  });

  it('blocks a screenshot only with a certain model call AND a screen-shaped image', () => {
    const shot = answer({ front: card({ screen_capture: true, screen_capture_certain: true }) });
    expect(decidePrecharge(shot, px({ width: 1290, height: 2796, aspect: 2796 / 1290 }))).toMatchObject({ reason: 'screenshot', side: 'front' });
    expect(decidePrecharge(shot, px({ width: 500, height: 700, aspect: 1.4 }))).toMatchObject({ reason: 'screenshot' });
    expect(decidePrecharge(shot, px()).verdict).toBe('pass');
    const unsure = answer({ front: card({ screen_capture: true, screen_capture_certain: false }) });
    expect(decidePrecharge(unsure, px({ width: 1290, height: 2796, aspect: 2796 / 1290 })).verdict).toBe('pass');
  });

  it('reports the highest-priority reason when several fire', () => {
    const d = decidePrecharge(answer({
      front: card({ screen_capture: true, screen_capture_certain: true, sides_cut_off: 4 }),
      same_card: 'no',
    }), px({ width: 1290, height: 2796, aspect: 2.17 }));
    expect(d.reason).toBe('screenshot');
  });
});

describe('isModelAssessment', () => {
  it('accepts the schema shape and rejects partial answers', () => {
    expect(isModelAssessment(answer())).toBe(true);
    expect(isModelAssessment({ front: card() })).toBe(false);
    expect(isModelAssessment({ ...answer(), same_card: 'maybe' })).toBe(false);
  });
});

describe('isPrechargePhotoCheckEnabled', () => {
  afterEach(() => { delete process.env.PRECHARGE_PHOTO_CHECK; });
  it('defaults on and turns off only on an explicit value', () => {
    expect(isPrechargePhotoCheckEnabled()).toBe(true);
    for (const v of ['off', '0', 'false', 'OFF']) {
      process.env.PRECHARGE_PHOTO_CHECK = v;
      expect(isPrechargePhotoCheckEnabled()).toBe(false);
    }
    process.env.PRECHARGE_PHOTO_CHECK = 'on';
    expect(isPrechargePhotoCheckEnabled()).toBe(true);
  });
});

describe('runPhotoPrecheck fails open', () => {
  const img = () => sharp({ create: { width: 60, height: 80, channels: 3, background: '#357' } }).jpeg().toBuffer();
  for (const mode of ['throw', 'hang', 'garbage'] as const) {
    it(`passes with failed_open when the model call ${mode}s`, async () => {
      openaiMode.mode = mode;
      const r = await runPhotoPrecheck(await img(), await img(), { timeoutMs: 1000 });
      expect(r.verdict).toBe('pass');
      expect(r.failed_open).toBe(true);
      expect(r.error).toBeTruthy();
    });
  }
  it('passes with failed_open on an undecodable image', async () => {
    openaiMode.mode = 'throw';
    const r = await runPhotoPrecheck(Buffer.from('not an image'), Buffer.from('nope'), { timeoutMs: 1000 });
    expect(r).toMatchObject({ verdict: 'pass', failed_open: true });
  });
});
