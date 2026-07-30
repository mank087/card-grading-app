'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import type { BinderSummary } from './BinderStrip';

/**
 * Binder list + the cards of the selected binder.
 *
 * `available` is false when the binders migration hasn't been applied yet — the
 * collection then renders exactly as it did before, with no strip, rather than
 * erroring. Same migration-window contract as the ownership work.
 */
export function useBinders() {
  const [binders, setBinders] = useState<BinderSummary[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  const auth = () => {
    const s = getStoredSession();
    return s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : null;
  };

  const refresh = useCallback(async () => {
    const headers = auth();
    if (!headers) { setLoading(false); return; }
    try {
      const res = await fetch('/api/binders', { headers });
      const data = await res.json();
      if (data?.available === false) { setAvailable(false); setBinders([]); return; }
      setBinders(data.binders || []);
      setAvailable(true);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createBinder = useCallback(async (name: string) => {
    const headers = auth();
    if (!headers) throw new Error('You must be logged in');
    const res = await fetch('/api/binders', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create binder');
    await refresh();
    return data.binder as BinderSummary;
  }, [refresh]);

  const renameBinder = useCallback(async (id: string, name: string) => {
    const headers = auth();
    const res = await fetch(`/api/binders/${id}`, {
      method: 'PATCH',
      headers: { ...headers!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not rename binder');
    await refresh();
  }, [refresh]);

  const deleteBinder = useCallback(async (id: string) => {
    const headers = auth();
    const res = await fetch(`/api/binders/${id}`, { method: 'DELETE', headers: headers! });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete binder');
    await refresh();
  }, [refresh]);

  const addCards = useCallback(async (binderId: string, cardIds: string[]) => {
    const headers = auth();
    const res = await fetch(`/api/binders/${binderId}/cards`, {
      method: 'POST',
      headers: { ...headers!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add cards');
    await refresh();
    return data as { added: number; skipped: number };
  }, [refresh]);

  const removeCards = useCallback(async (binderId: string, cardIds: string[]) => {
    const headers = auth();
    const res = await fetch(`/api/binders/${binderId}/cards`, {
      method: 'DELETE',
      headers: { ...headers!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not remove cards');
    await refresh();
  }, [refresh]);

  /** Move a card after another (null = to the front). Server computes the position. */
  const reorderCard = useCallback(async (binderId: string, cardId: string, afterCardId: string | null) => {
    const headers = auth();
    const res = await fetch(`/api/binders/${binderId}/cards/reorder`, {
      method: 'PATCH',
      headers: { ...headers!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, afterCardId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save the new order');
    return data;
  }, []);

  return {
    binders, available, loading, refresh,
    createBinder, renameBinder, deleteBinder,
    addCards, removeCards, reorderCard,
  };
}
