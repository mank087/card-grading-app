'use client';

/**
 * Proposed grade change, shown at the top of the card page (Sept 2026).
 *
 * The Accept / Keep buttons used to live only inside GradeReviewButton's
 * dialog: Grade details tab → bottom of the page → "View Review". A customer
 * who followed the "Review and decide on your card" email wrote back asking
 * whether to reply to the email to accept, because he could not find them.
 *
 * The email links here with ?review=decide. Owner signed in: the banner shows
 * and scrolls into view. Nobody signed in: a sign-in prompt that returns to
 * this card. Signed in to another account: a prompt to switch accounts.
 * Without the parameter the banner still shows for the owner whenever a
 * decision is pending, so a customer who opens the card another way finds it.
 */

import { useEffect, useRef, useState } from 'react';
import { AUTH_STATE_CHANGE_EVENT, getStoredSession } from '@/lib/directAuth';
import { concernLabels, type ReviewState } from '@/lib/gradeReview/types';

/** Query parameter the review-result email adds to the card link. */
export const REVIEW_DECIDE_PARAM = 'review';
export const REVIEW_DECIDE_VALUE = 'decide';

type Viewer = 'unknown' | 'signed_out' | 'owner' | 'other';

export function PendingGradeChangeBanner({ cardId, ownerId }: { cardId: string; ownerId: string | null | undefined }) {
  const [viewer, setViewer] = useState<Viewer>('unknown');
  const [state, setState] = useState<ReviewState | null>(null);
  const [fromEmail, setFromEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    try { setFromEmail(new URLSearchParams(window.location.search).get(REVIEW_DECIDE_PARAM) === REVIEW_DECIDE_VALUE); } catch { /* no URL */ }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    async function load() {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState(null);
      const session = getStoredSession();
      if (!session?.access_token) { setViewer('signed_out'); return; }
      if (!ownerId || session.user?.id !== ownerId) { setViewer('other'); return; }
      setViewer('owner');
      try {
        const response = await fetch(`/api/cards/${cardId}/grade-review`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal,
        });
        if (response.ok && !signal.aborted) {
          const data = await response.json();
          if (!signal.aborted) setState(data);
        }
      } catch { /* The review dialog under Grade details remains available. */ }
    }
    void load();
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, load);
    window.addEventListener('storage', load);
    return () => {
      controller.abort();
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, load);
      window.removeEventListener('storage', load);
    };
  }, [cardId, ownerId]);

  const review = state?.review;
  const pending = viewer === 'owner' && review?.status === 'awaiting_owner' && review.proposed_grade != null;

  useEffect(() => {
    if (fromEmail && (pending || viewer === 'signed_out' || viewer === 'other')) {
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [fromEmail, pending, viewer]);

  async function decide(decision: 'accept' | 'keep_original') {
    const session = getStoredSession();
    if (inFlight.current || !review || !session?.access_token || session.user?.id !== ownerId) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/cards/${cardId}/grade-review/decision`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your decision.');
      // Drop ?review=decide so the reload shows the card as it now stands.
      const url = new URL(window.location.href);
      url.searchParams.delete(REVIEW_DECIDE_PARAM);
      window.location.replace(url.toString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your decision.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  const frame = 'mx-auto my-4 max-w-3xl rounded-xl border-2 border-purple-300 bg-purple-50 p-4 text-left text-gray-900 shadow-sm sm:p-5';

  if (fromEmail && viewer === 'signed_out') {
    const back = `${window.location.pathname}?${REVIEW_DECIDE_PARAM}=${REVIEW_DECIDE_VALUE}`;
    return (
      <section ref={box} className={frame} aria-label="Grade review decision">
        <h2 className="text-lg font-bold text-purple-900">Sign in to review your grade change</h2>
        <p className="mt-1 text-sm">Your manual grade review is ready. Sign in to the account that owns this card to accept the new grade or keep your original.</p>
        <a href={`/login?mode=login&redirect=${encodeURIComponent(back)}`}
          className="mt-3 inline-block rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">Sign in</a>
      </section>
    );
  }

  if (fromEmail && viewer === 'other') {
    return (
      <section ref={box} className={frame} aria-label="Grade review decision">
        <h2 className="text-lg font-bold text-purple-900">This card belongs to a different account</h2>
        <p className="mt-1 text-sm">You are signed in, but not to the account that owns this card. Sign out and sign in with the account you graded it on to accept or keep the grade.</p>
      </section>
    );
  }

  if (!pending || !review) return null;

  return (
    <section ref={box} className={frame} aria-label="Grade review decision">
      <p className="text-xs font-bold uppercase tracking-wide text-purple-700">Manual grade review · your decision needed</p>
      <h2 className="mt-1 text-xl font-bold">
        We propose changing this grade from {review.original_grade} to {review.proposed_grade}
      </h2>
      {review.changes?.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {review.changes.map(change => (
            <li key={`${change.category}-${change.side}`}>{concernLabels[change.category]} ({change.side}): {change.from} → {change.to}</li>
          ))}
        </ul>
      ) : null}
      {review.customer_result && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">Note from the DCM review team</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{review.customer_result}</p>
        </div>
      )}
      <p className="mt-3 text-sm text-gray-700">
        Accept to update your grade, report and label to {review.proposed_grade}, or keep your original {review.original_grade}.
        Either choice completes your review. Labels you already printed and live eBay listings keep the old grade until you regenerate them.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => decide('accept')}
          className="rounded-lg bg-purple-700 px-5 py-2.5 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">
          {busy ? 'Saving…' : `Accept grade ${review.proposed_grade}`}
        </button>
        <button type="button" disabled={busy} onClick={() => decide('keep_original')}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
          Keep original {review.original_grade}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
