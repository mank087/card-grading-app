/**
 * The shared owner delete: JWT ownership, sold lock, and a restorable soft
 * delete (deleted_at + visibility private) — never a row delete or an image
 * purge. /api/cards/[id] and every per-category DELETE route delegate here.
 */
import { readFileSync } from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CARD = '88888888-8888-4888-8888-888888888888';
const OWNER = '99999999-9999-4999-8999-999999999999';
const OTHER = '77777777-7777-4777-8777-777777777777';

let authUserId: string | null = OWNER;
let row: Record<string, any> | null;
let updateError: any = null;
const calls: { op: string; args: any[] }[] = [];
const storageRemove = vi.fn();

function fakeDb() {
  return {
    storage: { from: () => ({ remove: storageRemove }) },
    from(table: string) {
      const q: any = {
        _filters: [] as any[],
        select(cols: string) { calls.push({ op: 'select', args: [table, cols] }); return q; },
        update(values: any) { calls.push({ op: 'update', args: [table, values] }); q._update = values; return q; },
        delete() { calls.push({ op: 'delete', args: [table] }); return q; },
        eq(col: string, val: any) { q._filters.push([col, val]); calls.push({ op: 'eq', args: [col, val] }); return q; },
        async single() { return row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116' } }; },
        then(resolve: any) { return Promise.resolve({ error: updateError }).then(resolve); },
      };
      return q;
    },
  };
}

vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => fakeDb() }));
vi.mock('@/lib/serverAuth', () => ({
  verifyAuth: async () => ({ authenticated: authUserId !== null, userId: authUserId }),
}));

const { softDeleteOwnedCard } = await import('./softDeleteCard');
const req = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  calls.length = 0;
  authUserId = OWNER;
  updateError = null;
  row = { id: CARD, user_id: OWNER, serial: 'DCM-1', ownership_status: 'owned' };
});

const writes = () => calls.filter((c) => c.op === 'update' || c.op === 'delete');

describe('softDeleteOwnedCard', () => {
  it('soft-deletes the owner\'s card: deleted_at + visibility private, scoped to the owner', async () => {
    const result = await softDeleteOwnedCard(req, CARD);
    expect(result).toEqual({ ok: true, cardId: CARD, serial: 'DCM-1' });
    const w = writes();
    expect(w).toHaveLength(1);
    expect(w[0].op).toBe('update');
    expect(w[0].args[1].visibility).toBe('private');
    expect(typeof w[0].args[1].deleted_at).toBe('string');
    expect(calls).toContainEqual({ op: 'eq', args: ['user_id', OWNER] });
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it('401s without a verified user and never writes', async () => {
    authUserId = null;
    const result = await softDeleteOwnedCard(req, CARD);
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(writes()).toHaveLength(0);
  });

  it('403s for someone else\'s card and never writes', async () => {
    authUserId = OTHER;
    const result = await softDeleteOwnedCard(req, CARD);
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(writes()).toHaveLength(0);
  });

  it('423s a sold card (sold lock) and never writes', async () => {
    row!.ownership_status = 'sold';
    const result = await softDeleteOwnedCard(req, CARD);
    expect(result).toMatchObject({ ok: false, status: 423, body: { code: 'card_sold_locked' } });
    expect(writes()).toHaveLength(0);
  });

  it('404s a missing card or a non-uuid id', async () => {
    row = null;
    expect(await softDeleteOwnedCard(req, CARD)).toMatchObject({ ok: false, status: 404 });
    expect(await softDeleteOwnedCard(req, 'not-a-uuid')).toMatchObject({ ok: false, status: 404 });
    expect(writes()).toHaveLength(0);
  });

  it('500s on a failed update with no hard-delete fallback', async () => {
    updateError = { code: '42703', message: 'column does not exist' };
    const result = await softDeleteOwnedCard(req, CARD);
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });
});

describe('every card DELETE route delegates to softDeleteOwnedCard', () => {
  const routes = ['cards', 'pokemon', 'sports', 'mtg', 'lorcana', 'onepiece', 'starwars', 'yugioh'];
  it.each(routes)('/api/%s/[id] DELETE uses the shared soft delete and never hard-deletes', (name) => {
    const src = readFileSync(path.resolve(__dirname, `../../app/api/${name}/[id]/route.ts`), 'utf-8');
    const start = src.indexOf('export async function DELETE(');
    expect(start).toBeGreaterThan(-1);
    const next = src.indexOf('export async function', start + 10);
    const body = src.slice(start, next === -1 ? undefined : next);
    expect(body).toContain('softDeleteOwnedCard(');
    expect(body).not.toMatch(/\.delete\(\)/);
    expect(body).not.toMatch(/storage\s*\.from/);
  });
});
