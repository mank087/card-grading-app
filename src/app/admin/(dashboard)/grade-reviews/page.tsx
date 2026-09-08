'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { concernLabels, reviewStatusLabels, type ReviewSummary } from '@/lib/gradeReview/types';

type Entry = ReviewSummary & {
  card_id: string;
  requester_id: string;
  grade_run_id: string;
  cards: { serial: string | null; category: string | null; card_name: string | null } | null;
  attempt_count: number;
  last_error_code: string | null;
};

export default function GradeReviewsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [view,setView]=useState('pending');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/admin/grade-reviews?page=${page}&view=${view}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setEntries(data.reviews); setHasMore(data.hasMore); }
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load reviews.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, refresh, view]);

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900">Grade Reviews</h1>
        <p className="mt-1 text-sm text-gray-600">Manual review queue. Reviews can take up to two business days.</p></div>
      <button onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50">Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    <label className="block text-sm">Show <select value={view} onChange={event=>{setView(event.target.value);setPage(0);}} className="ml-2 rounded border p-2"><option value="pending">Awaiting admin review (oldest first)</option><option value="all">All reviews and history</option></select></label>
    {loading ? <p role="status">Loading reviews…</p> : !error && entries.length === 0 ? <p>No grade review requests yet.</p> : !error && <div className="space-y-4">
      {entries.map(entry => <article key={entry.id} className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-semibold text-gray-900">{entry.cards?.card_name || entry.cards?.serial || entry.card_id}</h2>
          <span className="text-sm font-medium text-purple-800">{reviewStatusLabels[entry.status]}</span>
        </div>
        <p className="mt-2 text-sm text-gray-600">Requested {new Date(entry.requested_at).toLocaleString()} · Serial {entry.cards?.serial || 'Unavailable'}</p>
        <p className="mt-2 break-all text-xs text-gray-500">Customer: {entry.requester_id} · Card: {entry.card_id}</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-800">{entry.concerns.map(concern => <li key={concern.category}>{concernLabels[concern.category]}{concern.category === 'explanation' ? '' : ` — ${concern.side}`}</li>)}</ul>
        {entry.note && <p className="mt-3 whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm text-gray-800">{entry.note}</p>}
        {entry.customer_result && <section className="mt-4 rounded-lg bg-purple-50 p-4"><h3 className="font-semibold">{entry.outcome?.replaceAll("_", " ")}</h3><p className="mt-2 text-sm">{entry.customer_result}</p>{entry.completed_at && <p className="mt-2 text-xs">Completed {new Date(entry.completed_at).toLocaleString()}</p>}</section>}
        {entry.last_error_code && <p className="mt-2 text-sm text-amber-800">Processing delayed after {entry.attempt_count} attempt(s). Code: {entry.last_error_code}</p>}
        <p className="mt-3 break-all text-xs text-gray-500">Review {entry.id} · Grade run {entry.grade_run_id}</p>
        {entry.proposed_grade != null && <p className="mt-2 text-sm">Original grade: {entry.original_grade}. Proposed grade: {entry.proposed_grade}. {entry.owner_decision ? `Owner decision: ${entry.owner_decision === 'accept' ? 'Accepted' : 'Kept original'}.` : 'Awaiting owner decision.'}</p>}
        <div className="mt-3 flex gap-4 text-sm text-purple-700"><Link href={`/admin/grade-reviews/${entry.id}`}>Open Review</Link><Link href="/admin/cards">Cards</Link><Link href="/admin/users">Customers</Link></div>
      </article>)}
    </div>}
    <div className="flex items-center gap-4">
      <button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button>
      <span className="text-sm">Page {page + 1}</span>
      <button disabled={loading || !hasMore || Boolean(error)} onClick={() => setPage(value => value + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button>
    </div>
  </div>;
}
