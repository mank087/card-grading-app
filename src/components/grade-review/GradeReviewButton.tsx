'use client';

import { useEffect, useRef, useState } from 'react';
import { AUTH_STATE_CHANGE_EVENT, getStoredSession } from '@/lib/directAuth';
import { concernLabels, reviewStatusLabels, type ReviewRequest, type ReviewState } from '@/lib/gradeReview/types';
import { detailsClaimLabels, detailsFieldLabels } from '@/lib/gradeReview/cardDetails';

export function GradeReviewButton({ cardId, ownerId }: { cardId: string; ownerId: string | null | undefined }) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const concerns: ReviewRequest['concerns'] = ['centering','corners','edges','surface'].map(category => ({ category: category as ReviewRequest['concerns'][number]['category'], side: 'both' }));
  const [note, setNote] = useState('');
  const [reviewGrade, setReviewGrade] = useState(true);
  const [disputeDetails, setDisputeDetails] = useState(false);
  // Details-only disputes are open to every owner; the grade dispute keeps the membership gate.
  const gradeAllowed = Boolean(state?.eligible);
  const detailsAllowed = Boolean(state?.detailsEligible);
  const lowConfidence = state?.identificationConfidence === 'low' && !state?.review;
  const [claim, setClaim] = useState<Record<string, string>>({ card_name: '', set_name: '', year: '', card_number: '', other: '' });
  const claimFilled = Object.values(claim).some(v => v.trim());
  const canSubmit = (reviewGrade && gradeAllowed) || (disputeDetails && claimFilled);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let controller = new AbortController();
    async function load() {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState(null);
      setOpen(false);
      const session = getStoredSession();
      if (!session?.access_token || session.user?.id !== ownerId) return;
      try {
        const response = await fetch(`/api/cards/${cardId}/grade-review`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal,
        });
        if (response.ok && !signal.aborted) {
          const data = await response.json();
          if (!signal.aborted) setState(data);
        }
      } catch { /* Keep unavailable requests out of the completed grade UI. */ }
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

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);

  const reviewStatus = state?.review?.status;
  useEffect(() => {
    if (!reviewStatus || !['queued', 'processing'].includes(reviewStatus)) return;
    const controller = new AbortController();
    const refresh = async () => {
      const session = getStoredSession();
      if (document.visibilityState !== 'visible' || !session?.access_token || session.user?.id !== ownerId) return;
      try {
        const response = await fetch(`/api/cards/${cardId}/grade-review`, { cache: 'no-store', signal: controller.signal,
          headers: { Authorization: `Bearer ${session.access_token}` } });
        if (response.ok) {
          const latest = await response.json();
          if (!controller.signal.aborted && getStoredSession()?.user?.id === ownerId) setState(latest);
        }
      } catch { /* Keep the last confirmed request visible during a transient failure. */ }
    };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [cardId, ownerId, reviewStatus]);

  function close() {
    if (inFlight.current) return;
    setOpen(false);
    trigger.current?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!state?.gradeRunId || inFlight.current) return;
    const session = getStoredSession();
    if (!session?.access_token || session.user?.id !== ownerId) {
      setError('Please sign in as the card owner.'); return;
    }
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/cards/${cardId}/grade-review`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeRunId: state.gradeRunId, concerns, note, reviewGrade, ...(disputeDetails && claimFilled ? { details: Object.fromEntries(Object.entries(claim).filter(([, v]) => v.trim())) } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to request a review. Please try again.');
      // A logout during submission must not reveal private notes in this view.
      if (getStoredSession()?.user?.id !== ownerId) { setState(null); setOpen(false); return; }
      setState(previous => previous ? { ...previous, eligible: false, review: data.review } : previous);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to request a review. Please try again.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function decide(decision: 'accept' | 'keep_original') {
    const session = getStoredSession();
    if (inFlight.current || !state?.review || !session?.access_token || session.user?.id !== ownerId) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/cards/${cardId}/grade-review/decision`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: state.review.id, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your decision.');
      if (getStoredSession()?.user?.id !== ownerId) { setState(null); setOpen(false); return; }
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save your decision.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  if (!state || (!state.enabled && !state.review)) return null;
  const openRequest = () => {
    setError('');
    // Non-members can only dispute details; low-confidence cards start on the details form.
    if (!gradeAllowed || lowConfidence) { setReviewGrade(gradeAllowed && !lowConfidence); setDisputeDetails(true); }
    setOpen(true);
  };
  return (
    <div className="text-center max-w-xs">
      {lowConfidence && (
        <div role="status" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900">
          <p className="font-semibold">We may have misread this card&rsquo;s details.</p>
          <p className="mt-1">If the name, set, year or card number is wrong, tell us and we will correct it and refresh the market value at no charge.</p>
        </div>
      )}
      <button ref={trigger} type="button" disabled={!gradeAllowed && !detailsAllowed && !state.review} onClick={openRequest}
        className="rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 focus-visible:outline-2 focus-visible:outline-purple-600">
        {state.review ? 'View Review' : lowConfidence ? 'Fix Card Details' : gradeAllowed ? 'Request Grade Review' : 'Fix Card Details'}
      </button>
      <p className="mt-2 text-xs text-gray-600">
        {state.review ? `${reviewStatusLabels[state.review.status]} · ${new Date(state.review.requested_at).toLocaleDateString()}` : gradeAllowed ? 'One complimentary manual review included with this grade.' : detailsAllowed ? 'Card-detail corrections are free for every owner. Grade reviews are available to VIP purchasers and active Card Lovers members.' : 'Available on grades completed after the review program launched. Re-grade this card to become eligible.'}
      </p>
      <p className="mt-1 text-xs text-gray-600">Manual reviews can take up to two business days.</p>
      <dialog ref={dialog} aria-labelledby={`grade-review-title-${cardId}`}
        onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 text-left text-gray-900 shadow-xl backdrop:bg-black/50">
        <h2 id={`grade-review-title-${cardId}`} className="text-xl font-bold">{state.review ? 'Grade Review' : 'Request a Grade Review'}</h2>
        {state.review ? (
          <div className="mt-4 space-y-4">
            <p role="status" className="font-semibold text-purple-800">{reviewStatusLabels[state.review.status]}</p>
            <p className="text-sm text-gray-600">Requested {new Date(state.review.requested_at).toLocaleString()}</p>
            {state.review.details_claim && Object.keys(state.review.details_claim).length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">Card details you reported</p>
                <ul className="mt-1 list-disc pl-5">{Object.entries(state.review.details_claim).map(([k, v]) => <li key={k}>{detailsClaimLabels[k as keyof typeof detailsClaimLabels] ?? k}: {v}</li>)}</ul>
              </div>
            )}
            {state.review.details_changes && state.review.details_changes.length > 0 && (
              <div className="rounded-lg bg-green-50 p-3 text-sm">
                <p className="font-semibold text-green-900">Card details corrected</p>
                <ul className="mt-1 list-disc pl-5">{state.review.details_changes.map(c => <li key={c.field}>{detailsFieldLabels[c.field] ?? c.field}: {c.from ?? '(blank)'} → {c.to}</li>)}</ul>
              </div>
            )}
            {state.review.proposed_grade == null ? (
              <p className="text-sm text-gray-600">{state.review.concerns.some(c => c.category !== 'details') ? 'Requested a check of centering, corners, edges and surface on both sides.' : 'Card details only; the grade was not disputed.'}</p>
            ) : (
              <div className="rounded-lg bg-purple-50 p-3 text-sm">
                <p className="font-semibold text-purple-900">What changed</p>
                {state.review.changes?.length ? (
                  <ul className="mt-1 list-disc pl-5">
                    {state.review.changes.map(change => <li key={`${change.category}-${change.side}`}>{concernLabels[change.category]} ({change.side}): {change.from} → {change.to}</li>)}
                  </ul>
                ) : <p className="mt-1">Subgrades unchanged; the overall grade cap was revised.</p>}
                <p className="mt-2 font-semibold">Overall grade: {state.review.original_grade} → {state.review.proposed_grade}</p>
              </div>
            )}
            {state.review.note && <p className="whitespace-pre-wrap break-words text-sm text-gray-600">Your note: {state.review.note}</p>}
            {state.review.customer_result ? (
              <div className="text-sm">
                <p className="font-semibold">Note from the DCM review team</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{state.review.customer_result}</p>
              </div>
            ) : <p className="text-sm">Your request has been saved. Your current grade remains in place while the review is pending.</p>}
            {state.review.status === 'awaiting_owner' && <div className="space-y-3 rounded-lg border border-purple-200 p-4">
              <p className="text-sm">Accept to update your grade, report and label to {state.review.proposed_grade}, or keep your original {state.review.original_grade}. Either choice completes your one review. Files you already downloaded, printed labels and active eBay listings keep the old grade until you regenerate them.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => decide('accept')} className="rounded-lg bg-purple-700 px-4 py-2 text-white disabled:opacity-50">Accept Grade Change</button>
                <button type="button" disabled={busy} onClick={() => decide('keep_original')} className="rounded-lg border px-4 py-2 disabled:opacity-50">Keep Original Grade</button>
              </div>
            </div>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {state.review.status === 'completed' && ['grade_corrected', 'report_corrected'].includes(state.review.outcome || '') && <div className="space-y-2 text-sm">
              <p>Refresh the card to see its current grade and download an updated report or label. Previously downloaded files, printed labels and active eBay listings do not update automatically; relist or regenerate those to show the new grade.</p>
              <button type="button" onClick={() => window.location.reload()} className="font-semibold text-purple-700 underline">Refresh card and report</button>
            </div>}
            <button type="button" onClick={close} className="rounded-lg bg-purple-700 px-4 py-2 text-white">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-gray-600">Our team reviews your original photos and grading report. Manual reviews can take up to two business days. We’ll email you when your card has been evaluated.</p>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="mb-2 text-sm font-semibold">What would you like reviewed?</legend>
              <label className={`flex items-start gap-2 text-sm ${gradeAllowed ? '' : 'opacity-60'}`}><input type="checkbox" checked={reviewGrade && gradeAllowed} disabled={!gradeAllowed} onChange={e => setReviewGrade(e.target.checked)} className="mt-1" /><span><span className="font-medium">The grade</span><br /><span className="text-gray-600">{gradeAllowed ? 'All four subgrades on both sides are re-checked.' : 'Grade reviews are available to VIP purchasers and active Card Lovers members.'}</span></span></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={disputeDetails} onChange={e => setDisputeDetails(e.target.checked)} className="mt-1" /><span><span className="font-medium">The card details</span><br /><span className="text-gray-600">Wrong name, set, year or card number. Corrections also refresh the market value.</span></span></label>
              {disputeDetails && (
                <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                  <p className="text-xs text-gray-600 sm:col-span-2">Enter the correct value for anything that is wrong. Leave the rest blank.</p>
                  {(['card_name', 'set_name', 'year', 'card_number', 'other'] as const).map(f => (
                    <label key={f} className={`text-xs font-medium ${f === 'other' ? 'sm:col-span-2' : ''}`}>{detailsClaimLabels[f]}
                      <input type="text" maxLength={200} value={claim[f]} onChange={e => setClaim(v => ({ ...v, [f]: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm font-normal" placeholder={f === 'year' ? 'e.g. 1960' : f === 'card_number' ? 'e.g. 350' : ''} />
                    </label>
                  ))}
                </div>
              )}
              <label className="block text-sm font-medium">Additional details (optional)
                <textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border p-3 font-normal" placeholder="For example: The front left/right centering appears different from the reported measurement." />
              </label>
            </fieldset>
            <p className="text-xs text-gray-600">A suggested grade change needs your approval before it is applied. Our team may clarify your report without changing the grade. One complimentary review is available for this grade.</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={close} className="rounded-lg border px-4 py-2 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={busy || !canSubmit} className="rounded-lg bg-purple-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit Review Request'}</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
