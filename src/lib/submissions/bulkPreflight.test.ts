import { beforeEach, describe, expect, it, vi } from 'vitest';
const { gate, single, eq } = vi.hoisted(() => ({ gate: vi.fn(), single: vi.fn(), eq: vi.fn() }));
vi.mock('../supabaseServer', () => ({ supabaseServer: () => ({ from: () => ({ select: () => ({ eq }) }) }) }));
vi.mock('../grading/prechargeGate', () => ({ prechargePhotoGate: gate }));
import { bulkPreflight, bulkPreflightAll } from './bulkPreflight';

beforeEach(() => { vi.clearAllMocks(); eq.mockImplementation(() => ({ eq, maybeSingle: single })); });

describe('bulk pre-charge photo check', () => {
  it('checks ownership and passes the card row to the single-card gate', async () => {
    const card = { id: 'c', user_id: 'u' };
    single.mockResolvedValue({ data: card }); gate.mockResolvedValue({ blocked: false });
    expect(await bulkPreflight('c', 'u')).toEqual({ status: 'allowed' });
    expect(eq).toHaveBeenCalledWith('user_id', 'u');
    expect(gate).toHaveBeenCalledWith(card);
  });

  it('blocks a bad photo with the gate reason, and a card the owner does not own', async () => {
    single.mockResolvedValue({ data: { id: 'c' } });
    gate.mockResolvedValue({ blocked: true, body: { error: 'Retake both photos; no credit was charged.' } });
    expect(await bulkPreflight('c', 'u')).toEqual({ status: 'blocked', reason: 'Retake both photos; no credit was charged.' });
    single.mockResolvedValue({ data: null });
    expect((await bulkPreflight('c', 'u')).status).toBe('blocked');
    expect(gate).toHaveBeenCalledTimes(1);
  });

  it('defers on a read error or a thrown gate instead of charging', async () => {
    single.mockResolvedValue({ error: { message: 'offline' } });
    expect((await bulkPreflight('c', 'u')).status).toBe('defer');
    expect(gate).not.toHaveBeenCalled();
    single.mockResolvedValue({ data: { id: 'c' } }); gate.mockRejectedValue(new Error('boom'));
    expect((await bulkPreflight('c', 'u')).status).toBe('defer');
  });

  it('runs the checks concurrently and keys the results by item id', async () => {
    let inFlight = 0, peak = 0;
    const check = vi.fn(async (cardId: string) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return cardId === 'bad' ? { status: 'blocked' as const, reason: 'no' } : { status: 'allowed' as const };
    });
    const items = [{ id: 'i1', card_id: 'a' }, { id: 'i2', card_id: 'bad' }, { id: 'i3', card_id: 'c' }, { id: 'i4', card_id: 'd' }, { id: 'i5', card_id: 'e' }];
    const out = await bulkPreflightAll(items, 'u', 3, check);
    expect(out.get('i2')).toEqual({ status: 'blocked', reason: 'no' });
    expect(out.get('i1')).toEqual({ status: 'allowed' });
    expect(out.size).toBe(5);
    expect(peak).toBe(3);
  });
});
