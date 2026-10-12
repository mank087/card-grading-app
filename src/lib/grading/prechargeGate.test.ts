import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase + model mocks: no network, no database ─────────────────────────
const state = vi.hoisted(() => ({
  priorCharge: null as null | { id: string },
  updateResult: { data: [{ id: 'c' }] as any[] | null, error: null as any },
  updates: [] as any[],
  downloads: [] as string[],
  precheck: null as any,
  precheckCalls: 0,
  sizes: [null, null] as Array<{ width: number; height: number } | null>,
}));

vi.mock('@/lib/supabaseAdmin', () => {
  const txQuery: any = {
    select: () => txQuery, eq: () => txQuery, limit: () => txQuery,
    maybeSingle: async () => ({ data: state.priorCharge }),
  };
  const cardsQuery = (patch: any) => {
    const q: any = {
      eq: () => q,
      is: (col: string, val: any) => { state.updates.push({ patch, cas: [col, val] }); return q; },
      select: async () => state.updateResult,
    };
    return q;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => (table === 'credit_transactions' ? txQuery : { update: (patch: any) => cardsQuery(patch) }),
      storage: {
        from: () => ({
          download: async (p: string) => {
            state.downloads.push(p);
            return { data: { arrayBuffer: async () => new ArrayBuffer(8) }, error: null };
          },
        }),
      },
    },
  };
});

vi.mock('./photoPrecheck', async (orig) => {
  const actual: any = await orig();
  return {
    ...actual,
    runPhotoPrecheck: async () => { state.precheckCalls++; return state.precheck; },
    // The download mock returns 8 bytes; sizes come from state instead.
    readImageSize: async () => state.sizes.shift() ?? null,
  };
});

import { prechargeBlockBody, prechargeBlockFromRow, prechargeBlockedResponse, prechargeErrorMessage, prechargePhotoGate, PRECHARGE_ERROR_TAG } from './prechargeGate';
import { incompleteInspectionFromErrorMessage, incompleteInspectionMessage } from './inspectionMessageText';

const blockResult = (reason: string, side: string) => ({
  version: 'pc-1', model: 'm', verdict: 'block', reason, side, signals: [], failed_open: false, latency_ms: 10,
});
const passResult = { version: 'pc-1', model: 'm', verdict: 'pass', signals: [], failed_open: false, latency_ms: 10 };
const freshCard = { id: 'card-1', user_id: 'u1', front_path: 'u1/card-1/front.jpg', back_path: 'u1/card-1/back.jpg', grade_status: null, error_message: null };

beforeEach(() => {
  state.priorCharge = null;
  state.updateResult = { data: [{ id: 'card-1' }], error: null };
  state.updates = [];
  state.downloads = [];
  state.precheck = passResult;
  state.precheckCalls = 0;
  delete process.env.PRECHARGE_PHOTO_CHECK;
  delete process.env.PRECHARGE_MIN_SHORT_SIDE;
  state.sizes = [null, null];
});

describe('block body and stored message', () => {
  it('is the INSPECTION_INCOMPLETE shape both clients already render, marked not charged', () => {
    const body = prechargeBlockBody('no_card', 'back');
    expect(body).toMatchObject({
      code: 'INSPECTION_INCOMPLETE', inspection_incomplete: true, inspection_stage: 'precharge',
      inspection_reason: 'no_card', photo_side: 'back', credit_refunded: false,
      credit_refund_status: 'not_charged', photo_check_blocked: true, next_action: 'retake_photos',
    });
    expect(body.error).toContain('We could not find a trading card');
    expect(body.error).toContain('The problem is in the back photo.');
    expect(body.error).toContain('No grading credit was charged');
    expect(incompleteInspectionMessage(body)).toBe(body.error);
  });

  it('sends a comic to support rather than a retake', () => {
    expect(prechargeBlockBody('not_a_card', 'front').next_action).toBe('contact_support');
  });

  it('has owner-facing text for blurry and screenshot', () => {
    expect(prechargeBlockBody('blurry', 'front').error).toContain('too blurry');
    expect(prechargeBlockBody('screenshot', 'both').error).toContain('screenshot');
    expect(prechargeBlockBody('screenshot', 'both').error).not.toContain('The problem is in');
  });

  it('round-trips through the card row, and the row text names the reason and photo', () => {
    const msg = prechargeErrorMessage('framing', 'back');
    expect(msg.startsWith(PRECHARGE_ERROR_TAG)).toBe(true);
    expect(msg.length).toBeLessThanOrEqual(500);
    const body = prechargeBlockFromRow({ grade_status: 'failed', error_message: msg });
    expect(body).toMatchObject({ inspection_reason: 'framing', photo_side: 'back' });
    // What an app reading the row shows (the older-app path).
    const fromRow = incompleteInspectionFromErrorMessage(msg)!;
    expect(fromRow).toContain("Part of the card's edge was cut off");
    expect(fromRow).toContain('The problem is in the back photo.');
    // Older app builds parse only "[reason]"; the tag must stay first.
    expect(/\[([a-z_]+)\]/.exec(msg)?.[1]).toBe('framing');
  });

  it('ignores other failures and non-failed rows', () => {
    expect(prechargeBlockFromRow({ grade_status: 'failed', error_message: 'Inspection incomplete (zoom). [framing] x' })).toBeNull();
    expect(prechargeBlockFromRow({ grade_status: 'complete', error_message: prechargeErrorMessage('blurry', 'front') })).toBeNull();
    expect(prechargeBlockFromRow(null)).toBeNull();
  });
});

describe('grading-route guard', () => {
  const blocked = { id: 'c', grade_status: 'failed', error_message: prechargeErrorMessage('different_cards', 'both') };
  it('refuses a blocked card with 422 and the not-charged body', async () => {
    const res = prechargeBlockedResponse(blocked, false)!;
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'INSPECTION_INCOMPLETE', credit_refund_status: 'not_charged', inspection_reason: 'different_cards', grading_failed: true });
  });
  it('lets a regrade and an ordinary card through', () => {
    expect(prechargeBlockedResponse(blocked, true)).toBeNull();
    expect(prechargeBlockedResponse({ id: 'c', grade_status: null }, false)).toBeNull();
  });
});

describe('prechargePhotoGate', () => {
  it('passes when the check passes, without touching the row', async () => {
    const out = await prechargePhotoGate(freshCard);
    expect(out.blocked).toBe(false);
    expect(state.downloads).toEqual([freshCard.front_path, freshCard.back_path]);
    expect(state.updates).toEqual([]);
  });

  it('blocks and records the block with a compare-and-set on a never-graded row', async () => {
    state.precheck = blockResult('screenshot', 'front');
    const out = await prechargePhotoGate(freshCard);
    expect(out).toMatchObject({ blocked: true, body: { inspection_reason: 'screenshot', photo_side: 'front' } });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].cas).toEqual(['grade_status', null]);
    expect(state.updates[0].patch.grade_status).toBe('failed');
    expect(state.updates[0].patch.error_message.startsWith(PRECHARGE_ERROR_TAG)).toBe(true);
  });

  it('fails open when the block cannot be recorded (the grading route would not see it)', async () => {
    state.precheck = blockResult('no_card', 'back');
    state.updateResult = { data: [], error: null };
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    state.updateResult = { data: null, error: { message: 'boom' } };
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
  });

  it('never checks a card that was already charged, graded, locked or failed', async () => {
    state.precheck = blockResult('no_card', 'back');
    state.priorCharge = { id: 'tx' };
    expect(await prechargePhotoGate(freshCard)).toMatchObject({ blocked: false, skipped: 'already charged' });
    state.priorCharge = null;
    for (const grade_status of ['complete', 'failed', 'processing:2026-09-25T00:00:00Z']) {
      expect((await prechargePhotoGate({ ...freshCard, grade_status })).blocked).toBe(false);
    }
    expect(state.precheckCalls).toBe(0);
  });

  it('answers a repeat call for an already-blocked card from the row, with no model call', async () => {
    const out = await prechargePhotoGate({ ...freshCard, grade_status: 'failed', error_message: prechargeErrorMessage('multiple_cards', 'both') });
    expect(out).toMatchObject({ blocked: true, body: { inspection_reason: 'multiple_cards' } });
    expect(state.precheckCalls).toBe(0);
  });

  it('does nothing when the flag is off', async () => {
    process.env.PRECHARGE_PHOTO_CHECK = 'off';
    state.precheck = blockResult('no_card', 'back');
    expect(await prechargePhotoGate(freshCard)).toMatchObject({ blocked: false, skipped: 'disabled' });
    expect(state.precheckCalls).toBe(0);
  });

  it('fails open when an image path is missing', async () => {
    expect((await prechargePhotoGate({ ...freshCard, back_path: null })).blocked).toBe(false);
  });
});

describe('minimum-resolution gate (too_small)', () => {
  const big = { width: 2250, height: 3000 };
  const tiny = { width: 755, height: 1057 };

  it('blocks a 755x1057 front before the model call and before any charge', async () => {
    state.sizes = [tiny, big];
    const out = await prechargePhotoGate(freshCard);
    expect(out).toMatchObject({ blocked: true, body: { inspection_reason: 'too_small', photo_side: 'front', credit_refund_status: 'not_charged', next_action: 'retake_photos' } });
    expect(state.precheckCalls).toBe(0);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].cas).toEqual(['grade_status', null]);
    expect(state.updates[0].patch.error_message).toContain('[too_small] (front photo)');
    if (out.blocked) {
      expect(out.body.error).toContain('This photo is too small to grade accurately.');
      expect(out.body.error).toContain('Please retake it with the card filling the frame.');
      expect(out.body.error).toContain('No grading credit was charged');
    }
  });

  it('names both photos when both are small, and the row round-trips for older apps', async () => {
    state.sizes = [tiny, { width: 1057, height: 755 }];
    const out = await prechargePhotoGate(freshCard);
    expect(out).toMatchObject({ blocked: true, body: { inspection_reason: 'too_small', photo_side: 'both' } });
    const row = { grade_status: 'failed', error_message: state.updates[0].patch.error_message };
    expect(prechargeBlockFromRow(row)).toMatchObject({ inspection_reason: 'too_small', photo_side: 'both' });
    expect(incompleteInspectionFromErrorMessage(row.error_message)).toContain('too small to grade accurately');
  });

  it('passes normal photos on to the model check', async () => {
    state.sizes = [big, big];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    expect(state.precheckCalls).toBe(1);
  });

  it('uses the short side: 1000x1400 passes, 999x3000 blocks', async () => {
    state.sizes = [{ width: 1000, height: 1400 }, big];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    state.sizes = [big, { width: 3000, height: 999 }];
    expect(await prechargePhotoGate(freshCard)).toMatchObject({ blocked: true, body: { photo_side: 'back' } });
  });

  it('reads the threshold from PRECHARGE_MIN_SHORT_SIDE and can be turned off', async () => {
    process.env.PRECHARGE_MIN_SHORT_SIDE = '700';
    state.sizes = [tiny, tiny];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    process.env.PRECHARGE_MIN_SHORT_SIDE = 'off';
    state.sizes = [{ width: 300, height: 400 }, tiny];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    expect(state.updates).toEqual([]);
  });

  it('fails open when the size cannot be read or the block cannot be recorded', async () => {
    state.sizes = [null, null];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    state.sizes = [tiny, big];
    state.updateResult = { data: [], error: null };
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
  });

  it('is covered by the master kill switch and skipped for an already-charged card', async () => {
    process.env.PRECHARGE_PHOTO_CHECK = 'off';
    state.sizes = [tiny, tiny];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
    delete process.env.PRECHARGE_PHOTO_CHECK;
    state.priorCharge = { id: 'tx' };
    state.sizes = [tiny, tiny];
    expect((await prechargePhotoGate(freshCard)).blocked).toBe(false);
  });
});

describe('minShortSidePx / tooSmallSide', () => {
  it('defaults to 1000 and ignores out-of-range values', async () => {
    const { minShortSidePx, tooSmallSide } = await vi.importActual<typeof import('./photoPrecheck')>('./photoPrecheck');
    expect(minShortSidePx()).toBe(1000);
    process.env.PRECHARGE_MIN_SHORT_SIDE = '50';
    expect(minShortSidePx()).toBe(1000);
    process.env.PRECHARGE_MIN_SHORT_SIDE = '1200';
    expect(minShortSidePx()).toBe(1200);
    process.env.PRECHARGE_MIN_SHORT_SIDE = 'false';
    expect(minShortSidePx()).toBe(0);
    expect(tooSmallSide({ width: 755, height: 1057 }, null, 1000)).toBe('front');
    expect(tooSmallSide(null, null, 1000)).toBeNull();
    expect(tooSmallSide({ width: 10, height: 10 }, { width: 10, height: 10 }, 0)).toBeNull();
  });
});
