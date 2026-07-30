'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';

/**
 * "In binders" control for the bottom of a card detail page.
 *
 * Filing a card while you're looking at it is the obvious moment to do it, and
 * until now the only route in was bulk-select on the collection page. Shows the
 * binders this card is in, lets you toggle membership, and creates a new binder
 * inline.
 *
 * Owner-only. Renders nothing at all when the binders migration isn't applied,
 * so it can ship ahead of the schema.
 */

interface Binder {
  id: string;
  name: string;
  accent_color: string | null;
  card_count: number;
  smart_filter: unknown | null;
  system_key: string | null;
}

export function CardBinderPicker({ cardId, isOwner }: { cardId: string; isOwner: boolean }) {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [available, setAvailable] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const headers = () => {
    const s = getStoredSession();
    return s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : null;
  };

  const load = useCallback(async () => {
    const h = headers();
    if (!h) { setLoaded(true); return; }
    try {
      const [listRes, mineRes] = await Promise.all([
        fetch('/api/binders', { headers: h }),
        fetch(`/api/cards/${cardId}/binders`, { headers: h }),
      ]);
      const list = await listRes.json();
      if (list?.available === false) { setAvailable(false); return; }
      setBinders(list.binders || []);
      if (mineRes.ok) {
        const mine = await mineRes.json();
        setMemberOf(new Set((mine.binderIds || []) as string[]));
      }
    } catch {
      setAvailable(false);
    } finally {
      setLoaded(true);
    }
  }, [cardId]);

  useEffect(() => { if (isOwner) load(); else setLoaded(true); }, [isOwner, load]);

  if (!isOwner || !available || !loaded) return null;

  const toggle = async (binder: Binder) => {
    const h = headers();
    if (!h) return;
    const isIn = memberOf.has(binder.id);
    setBusyId(binder.id);
    // Optimistic — the round trip is short and a checkbox that lags feels broken.
    setMemberOf(prev => {
      const next = new Set(prev);
      isIn ? next.delete(binder.id) : next.add(binder.id);
      return next;
    });
    try {
      const res = await fetch(`/api/binders/${binder.id}/cards`, {
        method: isIn ? 'DELETE' : 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds: [cardId] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    } catch {
      setMemberOf(prev => {
        const next = new Set(prev);
        isIn ? next.add(binder.id) : next.delete(binder.id);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const createAndAdd = async () => {
    const h = headers();
    const name = window.prompt('Name this binder', 'New binder');
    if (!h || !name?.trim()) return;
    setBusyId('new');
    try {
      const res = await fetch('/api/binders', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetch(`/api/binders/${data.binder.id}/cards`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds: [cardId] }),
      });
      await load();
    } catch { /* surfaced by the unchanged UI */ }
    finally { setBusyId(null); }
  };

  // Smart binders fill themselves — you can't file a card into one by hand.
  const manual = binders.filter(b => !b.smart_filter);

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-gray-900">Add to a binder</h3>
      <p className="text-sm text-gray-500 mt-0.5">
        Organise this card however you like. It can be in as many binders as you want.
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {manual.map(b => {
          const active = memberOf.has(b.id);
          return (
            <button
              key={b.id}
              onClick={() => toggle(b)}
              disabled={busyId === b.id}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: b.accent_color || (active ? '#fff' : '#a78bfa') }}
              />
              {b.name}
              <span className={active ? 'text-purple-100' : 'text-gray-400'}>{active ? '✓' : '＋'}</span>
            </button>
          );
        })}

        <button
          onClick={createAndAdd}
          disabled={busyId === 'new'}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          ＋ New binder
        </button>
      </div>

      {manual.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">
          No binders yet — create one and this card goes straight into it.
        </p>
      )}
    </div>
  );
}

export default CardBinderPicker;
