import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  guardedPriceUpdate, readPriceRevisions, parseRequestRevisions,
  PRICE_REVISION_SELECT, PRICE_WRITE_STALE_CODE, __resetGuardWarnings,
} from './guardedPriceWrite';
import { createFakeSupabase } from './__testSupport__/fakeSupabase';

const CARD = '11111111-1111-4111-8111-111111111111';

function pricedRow(extra: Record<string, any> = {}) {
  return {
    id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    dcm_price_estimate: null, ...extra,
  };
}

beforeEach(() => {
  __resetGuardWarnings();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('readPriceRevisions', () => {
  it('reads both counters off a row', () => {
    expect(readPriceRevisions({ identity_revision: 4, pricing_selection_revision: 2 }))
      .toEqual({ identity_revision: 4, pricing_selection_revision: 2 });
  });

  it('treats a null column as 0, because the column defaults to 0', () => {
    expect(readPriceRevisions({ identity_revision: null, pricing_selection_revision: null }))
      .toEqual({ identity_revision: 0, pricing_selection_revision: 0 });
  });

  it('returns null when the row did not select the columns', () => {
    expect(readPriceRevisions({ id: CARD })).toBeNull();
    expect(readPriceRevisions({ identity_revision: 1 })).toBeNull();
    expect(readPriceRevisions(null)).toBeNull();
    expect(readPriceRevisions(undefined)).toBeNull();
  });
});

describe('guardedPriceUpdate', () => {
  it('puts the card id AND both revisions in the WHERE clause', async () => {
    const db = createFakeSupabase({ rows: [pricedRow()] });
    const result = await guardedPriceUpdate(
      db as any, CARD,
      { identity_revision: 3, pricing_selection_revision: 1 },
      { dcm_price_estimate: 120 },
    );

    expect(result.status).toBe('written');
    expect(db.lastUpdateFilters()).toEqual({
      id: CARD, identity_revision: 3, pricing_selection_revision: 1,
    });
    // The guard is the WHERE clause, not a read-then-write: exactly one query.
    expect(db.queries).toHaveLength(1);
    expect(db.updates[0].selected).toBe('id');
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(120);
  });

  it('reports stale and writes nothing when the identity moved', async () => {
    const db = createFakeSupabase({ rows: [pricedRow({ identity_revision: 4 })] });
    const result = await guardedPriceUpdate(
      db as any, CARD,
      { identity_revision: 3, pricing_selection_revision: 1 },
      { dcm_price_estimate: 120 },
    );

    expect(result.status).toBe('stale');
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });

  it('reports stale when only the product selection moved', async () => {
    const db = createFakeSupabase({ rows: [pricedRow({ pricing_selection_revision: 2 })] });
    const result = await guardedPriceUpdate(
      db as any, CARD,
      { identity_revision: 3, pricing_selection_revision: 1 },
      { dcm_price_estimate: 99 },
    );
    expect(result.status).toBe('stale');
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBeNull();
  });

  it('reports stale when the row is gone', async () => {
    const db = createFakeSupabase({ rows: [] });
    const result = await guardedPriceUpdate(
      db as any, CARD, { identity_revision: 0, pricing_selection_revision: 0 }, { dcm_price_estimate: 1 },
    );
    expect(result.status).toBe('stale');
  });

  it('writes unguarded, by id alone, when the caller has no revisions', async () => {
    const db = createFakeSupabase({ rows: [pricedRow({ identity_revision: 9 })] });
    const result = await guardedPriceUpdate(db as any, CARD, null, { dcm_price_estimate: 55 });

    expect(result.status).toBe('unguarded_written');
    expect(db.lastUpdateFilters()).toEqual({ id: CARD });
    expect(db.rows.get(CARD)!.dcm_price_estimate).toBe(55);
  });

  it('warns about unguarded writes once per process, not once per card', async () => {
    const db = createFakeSupabase({ rows: [pricedRow()] });
    await guardedPriceUpdate(db as any, CARD, null, { dcm_price_estimate: 1 });
    await guardedPriceUpdate(db as any, CARD, null, { dcm_price_estimate: 2 });
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('returns error, never throws, when the database rejects the write', async () => {
    const db = createFakeSupabase({
      rows: [pricedRow()],
      updateError: { code: '42501', message: 'permission denied' },
    });
    const result = await guardedPriceUpdate(
      db as any, CARD, { identity_revision: 3, pricing_selection_revision: 1 }, { dcm_price_estimate: 1 },
    );
    expect(result.status).toBe('error');
    expect(result.error).toContain('permission denied');
  });

  it('falls back to an unguarded write if the columns are missing', async () => {
    const db = createFakeSupabase({
      rows: [pricedRow()],
      updateError: { code: '42703', message: 'column "identity_revision" does not exist' },
    });
    const result = await guardedPriceUpdate(
      db as any, CARD, { identity_revision: 3, pricing_selection_revision: 1 }, { dcm_price_estimate: 1 },
    );
    expect(result.status).toBe('error'); // the retry hits the same forced error
    expect(db.updates.length).toBe(2);
    expect(Object.fromEntries(db.updates[1].filters)).toEqual({ id: CARD });
  });

  it('never throws when the client itself explodes', async () => {
    const exploding = { from() { throw new Error('socket closed'); } };
    const result = await guardedPriceUpdate(
      exploding as any, CARD, { identity_revision: 1, pricing_selection_revision: 0 }, {},
    );
    expect(result.status).toBe('error');
    expect(result.error).toBe('socket closed');
  });
});

describe('parseRequestRevisions', () => {
  it('accepts both revisions, including numeric strings', () => {
    expect(parseRequestRevisions({ identity_revision: 2, pricing_selection_revision: 0 }))
      .toEqual({ identity_revision: 2, pricing_selection_revision: 0 });
    expect(parseRequestRevisions({ identity_revision: '2', pricing_selection_revision: '3' }))
      .toEqual({ identity_revision: 2, pricing_selection_revision: 3 });
  });

  it('treats a request with one or neither revision as unguarded', () => {
    expect(parseRequestRevisions({ identity_revision: 2 })).toBeNull();
    expect(parseRequestRevisions({ pricing_selection_revision: 2 })).toBeNull();
    expect(parseRequestRevisions({})).toBeNull();
    expect(parseRequestRevisions(null)).toBeNull();
    expect(parseRequestRevisions({ identity_revision: 'x', pricing_selection_revision: 1 })).toBeNull();
  });
});

describe('constants', () => {
  it('names both columns in the shared select fragment', () => {
    expect(PRICE_REVISION_SELECT).toContain('identity_revision');
    expect(PRICE_REVISION_SELECT).toContain('pricing_selection_revision');
  });

  it('keeps the 409 code stable — clients match on it', () => {
    expect(PRICE_WRITE_STALE_CODE).toBe('price_write_stale');
  });
});
