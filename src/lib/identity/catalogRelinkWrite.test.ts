import { describe, expect, it, vi } from 'vitest';
import { writeCatalogLink } from './catalogRelink';

/** A chainable fake of supabase.from('cards').update(...).eq/.is(...).select('id'). */
function fakeDb(result: { data?: unknown[]; error?: { message: string } | null }) {
  const calls: Array<[string, string, unknown]> = [];
  const chain: any = {
    eq: (f: string, v: unknown) => { calls.push(['eq', f, v]); return chain; },
    is: (f: string, v: unknown) => { calls.push(['is', f, v]); return chain; },
    select: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  };
  const update = vi.fn(() => chain);
  return { db: { from: () => ({ update }) } as any, update, calls };
}

const card = { id: 'card-1', identity_revision: 3, identity_confirmed_revision: null, grade_status: 'complete' };

describe('writeCatalogLink', () => {
  it('writes only when identity revision, confirmation and grade status are unchanged', async () => {
    const { db, update, calls } = fakeDb({ data: [{ id: 'card-1' }] });
    const r = await writeCatalogLink(db, card, { mtg_card_id: 'x' });
    expect(r.error).toBeNull();
    expect(update).toHaveBeenCalledWith({ mtg_card_id: 'x' });
    expect(calls).toEqual([
      ['eq', 'id', 'card-1'],
      ['eq', 'identity_revision', 3],
      ['is', 'identity_confirmed_revision', null],
      ['eq', 'grade_status', 'complete'],
    ]);
  });

  it('reports a skipped write when the card changed during the lookup', async () => {
    const { db } = fakeDb({ data: [] });
    const r = await writeCatalogLink(db, card, { mtg_card_id: 'x' });
    expect(r.error?.message).toMatch(/identity changed/);
  });

  it('passes a database error through', async () => {
    const { db } = fakeDb({ error: { message: 'offline' } });
    expect((await writeCatalogLink(db, card, {})).error?.message).toBe('offline');
  });
});
