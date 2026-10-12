'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminCardHref } from '@/lib/admin/cardCategories';
import { STRUCTURAL_CLEARED_NOTE } from '@/lib/gradeReview/structuralCheckText';

type Check = {
  id: string;
  serial: string | null;
  category: string | null;
  card_name: string | null;
  owner_email: string | null;
  grade: number | null;
  evaluated_at: string | null;
  stale: boolean;
  check: { uncapped_grade: number; capped_grade: number; flagged_at: string; evidence?: string } | null;
  photos: { front: string | null; back: string | null; front_original: string | null; back_original: string | null };
};

export default function StructuralChecksPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/admin/structural-checks?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setChecks(data.checks); setHasMore(data.hasMore); }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load structural checks.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refresh]);

  async function resolve(entry: Check, action: 'confirm' | 'clear') {
    const label = action === 'confirm'
      ? `Confirm the crease on ${entry.card_name || entry.id}? The grade stays ${entry.grade}.`
      : `Remove the cap on ${entry.card_name || entry.id}? The grade changes from ${entry.grade} to ${entry.check?.uncapped_grade}.`;
    if (!window.confirm(label)) return;
    setBusy(entry.id);
    try {
      const response = await fetch(`/api/admin/structural-checks/${entry.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(action === 'clear' && notes[entry.id]?.trim() ? { notes: notes[entry.id].trim() } : {}) }) });
      const result = await response.json();
      if (!response.ok) {
        setMessages(value => ({ ...value, [entry.id]: result.error || 'Unable to save.' }));
        if (result.stale) setRefresh(value => value + 1);
        return;
      }
      setMessages(value => ({ ...value, [entry.id]: action === 'confirm' ? `Crease confirmed. Grade stays ${result.before}.` : `Cap removed. Grade ${result.before} → ${result.after}.` }));
      setChecks(value => value.filter(check => check.id !== entry.id));
    } catch {
      setMessages(value => ({ ...value, [entry.id]: 'Unable to save. Reload and try again.' }));
    } finally {
      setBusy(null);
    }
  }

  const done = Object.entries(messages).filter(([id]) => !checks.some(check => check.id === id));
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900">Structural Checks</h1>
        <p className="mt-1 text-sm text-gray-600">Crease/bend caps that cost 3 or more grade points. The customer sees the capped grade with a note that our team will double-check it. The customer is not emailed when you resolve one.</p></div>
      <button onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50">Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {done.length > 0 && <ul className="space-y-1 rounded-lg bg-green-50 p-4 text-sm text-green-900">{done.map(([id, message]) => <li key={id}>{message} <span className="text-xs text-green-700">({id})</span></li>)}</ul>}
    {loading ? <p role="status">Loading structural checks…</p> : !error && checks.length === 0 ? <p>No pending structural checks.</p> : !error && <div className="space-y-4">
      {checks.map(entry => <article key={entry.id} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-semibold text-gray-900">{entry.card_name || entry.serial || entry.id}</h2>
          <span className="text-sm font-medium text-purple-800">Capped {entry.check?.capped_grade} · without cap {entry.check?.uncapped_grade}</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{entry.category} · Serial {entry.serial || 'Unavailable'} · Owner {entry.owner_email || 'Unknown'} · Flagged {entry.check?.flagged_at ? new Date(entry.check.flagged_at).toLocaleString() : 'Unknown'}</p>
        {entry.stale && <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">The card&apos;s grade is now {entry.grade}, not the flagged {entry.check?.capped_grade}. It was probably re-graded; either action will check and drop it from the list.</p>}
        {entry.check?.evidence && <p className="mt-3 whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm text-gray-800"><span className="font-semibold">Detected: </span>{entry.check.evidence}</p>}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['front', 'back'] as const).map(side => <figure key={side}>
            {entry.photos[side]
              // eslint-disable-next-line @next/next/no-img-element
              ? <a href={entry.photos[side] ?? undefined} target="_blank" rel="noreferrer"><img src={entry.photos[side] ?? undefined} alt={`${side} of ${entry.card_name || 'card'}`} loading="lazy" className="max-h-[520px] w-full rounded border object-contain" /></a>
              : <div className="flex h-40 items-center justify-center rounded border text-sm text-gray-500">No {side} photo</div>}
            <figcaption className="mt-1 text-xs text-gray-600">{side === 'front' ? 'Front' : 'Back'}{entry.photos[`${side}_original`] && <> · <a className="text-purple-700 underline" href={entry.photos[`${side}_original`] ?? undefined} target="_blank" rel="noreferrer">Original photo</a></>}</figcaption>
          </figure>)}
        </div>
        <label className="mt-4 block text-sm text-gray-700">Note shown to the customer if you remove the cap (optional, at least 10 characters)
          <textarea value={notes[entry.id] ?? ''} onChange={event => setNotes(value => ({ ...value, [entry.id]: event.target.value }))} placeholder={STRUCTURAL_CLEARED_NOTE} rows={2} maxLength={1500} className="mt-1 w-full rounded border p-2 text-sm" />
        </label>
        {messages[entry.id] && <p role="alert" className="mt-2 text-sm text-amber-800">{messages[entry.id]}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => resolve(entry, 'confirm')} disabled={busy !== null} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Crease confirmed</button>
          <button onClick={() => resolve(entry, 'clear')} disabled={busy !== null} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Not damage — remove cap ({entry.check?.capped_grade} → {entry.check?.uncapped_grade})</button>
          <Link className="text-sm text-purple-700 underline" href={adminCardHref(entry.category, entry.id)}>Card page</Link>
        </div>
      </article>)}
    </div>}
    <div className="flex items-center gap-4">
      <button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button>
      <span className="text-sm">Page {page + 1}</span>
      <button disabled={loading || !hasMore || Boolean(error)} onClick={() => setPage(value => value + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button>
    </div>
  </div>;
}
