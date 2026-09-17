'use client';

/**
 * "Confirm your card details" — Phase 2B.
 *
 * The owner sees their two photos and a short form of what DCM thinks the card
 * is. Nothing here decides anything: a value DCM read off the card is labelled
 * as read, a value it recognized is labelled "Please check", and a disagreement
 * is offered as a suggestion the owner can take or ignore. See
 * src/lib/identity/reviewPrefill.ts for why (first look's set names are wrong on
 * look-alike products and its parallels are right well under half the time).
 *
 * Saving sends ONLY the fields that differ from what is stored, plus
 * `confirm: true` and the revision the owner was looking at, to
 * PATCH /api/cards/[id]/details. A stale revision (409) reloads the review state
 * and keeps everything the owner typed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import {
  changedFieldPayload,
  NO_CANDIDATE,
  type ReviewAlternative,
  type ReviewCandidate,
  type ReviewField,
} from '@/lib/identity/reviewPrefill';

export interface IdentityReviewState {
  card_id: string;
  mode: 'popup' | 'banner' | 'none';
  reason: string;
  locked: boolean;
  identity_revision: number | null;
  identity_confirmed: boolean;
  dismissed: boolean;
  category: string | null;
  is_sports: boolean;
  fields: ReviewField[];
  alternatives: ReviewAlternative[];
  first_look_present: boolean;
  candidates: ReviewCandidate[];
  candidates_available: boolean;
  candidates_error: boolean;
  suggested_candidate_id: string;
}

interface Props {
  cardId: string;
  review: IdentityReviewState;
  frontUrl?: string | null;
  backUrl?: string | null;
  /** Escape, backdrop or the close button. Not a dismissal: the banner stays. */
  onClose: () => void;
  /** "Review later" was saved. */
  onDismissed: () => void;
  /** Identity saved. The page refreshes its card exactly as after the advanced editor. */
  onSaved: (card: unknown) => void;
  onOpenMoreDetails: () => void;
  /** Re-read the review state, for the conflict path. */
  onReload: () => Promise<IdentityReviewState | null>;
  /** Ask for a first look in the background when the card has none. */
  fetchFirstLook?: boolean;
}

/** Which field an alternative from first look would change. */
const ALTERNATIVE_FIELD: Record<string, string> = {
  set_name: 'card_set',
  year: 'release_date',
  parallel: 'parallel_type',
  card_number: 'card_number',
  insert_or_subset: 'subset_variant',
};

const ALTERNATIVE_LABEL: Record<string, string> = {
  set_name: 'Set',
  year: 'Year',
  parallel: 'Parallel',
  card_number: 'Card number',
  insert_or_subset: 'Insert or subset',
  language: 'Language',
};

/** Matches the details route's per-field validation so a save cannot 400 on length. */
const MAX_LENGTH: Record<string, number> = {
  release_date: 4,
  serial_numbering: 20,
  card_number: 50,
  parallel_type: 100,
  subset_variant: 100,
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function ConfirmCardDetailsDialog({
  cardId,
  review,
  frontUrl,
  backUrl,
  onClose,
  onDismissed,
  onSaved,
  onOpenMoreDetails,
  onReload,
  fetchFirstLook = false,
}: Props) {
  const [fields, setFields] = useState<ReviewField[]>(review.fields);
  const [revision, setRevision] = useState<number | null>(review.identity_revision);
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(review.fields.map(f => [f.key, f.value])),
  );
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [candidates, setCandidates] = useState<ReviewCandidate[]>(review.candidates);
  const [candidateId, setCandidateId] = useState<string>(review.suggested_candidate_id || NO_CANDIDATE);
  const [saving, setSaving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<unknown | null>(null);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = 'confirm-card-details-title';

  const changed = useMemo(() => changedFieldPayload(fields, values), [fields, values]);
  const hasChanges = Object.keys(changed).length > 0;

  /* ---------------- keyboard, focus and scroll ---------------- */

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const firstInput = containerRef.current?.querySelector<HTMLElement>('input, button');
    firstInput?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (zoom) setZoom(null);
      else if (!saving) onClose();
      return;
    }
    if (event.key !== 'Tab' || !containerRef.current) return;
    const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(node => node.offsetParent !== null);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  };

  /* ---------------- merging a later first look ---------------- */

  /**
   * Adopt new prefill metadata, but never overwrite a box the owner has typed
   * in. A background answer arriving mid-edit must not eat their work.
   */
  const mergeFields = useCallback((incoming: ReviewField[]) => {
    setFields(previous => {
      const byKey = new Map(previous.map(f => [f.key, f]));
      return incoming.map(next => ({ ...(byKey.get(next.key) || next), ...next }));
    });
    setValues(previous => {
      const merged = { ...previous };
      for (const next of incoming) {
        if (!touched[next.key]) merged[next.key] = next.value;
      }
      return merged;
    });
  }, [touched]);

  useEffect(() => {
    if (!fetchFirstLook) return;
    let cancelled = false;
    const session = getStoredSession();
    if (!session?.access_token) return;
    setChecking(true);
    fetch(`/api/cards/${cardId}/first-look`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then(response => response.json().catch(() => null))
      .then(data => {
        if (cancelled || !data?.fields) return;
        mergeFields(data.fields as ReviewField[]);
      })
      .catch(() => { /* the stored values are still fine */ })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, fetchFirstLook]);

  /* ---------------- editing ---------------- */

  const setValue = (key: string, value: string) => {
    setValues(previous => ({ ...previous, [key]: value }));
    setTouched(previous => ({ ...previous, [key]: true }));
  };

  const applyAlternative = (alternative: ReviewAlternative) => {
    const key = ALTERNATIVE_FIELD[alternative.differs_in];
    if (!key || !fields.some(f => f.key === key)) return;
    setValue(key, alternative.value);
  };

  /* ---------------- saving ---------------- */

  const save = async () => {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const session = getStoredSession();
      if (!session?.access_token) throw new Error('Please sign in again to save your card details.');

      const body: Record<string, unknown> = { ...changed, confirm: true };
      if (typeof revision === 'number') body.expected_identity_revision = revision;

      const response = await fetch(`/api/cards/${cardId}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        const fresh = await onReload();
        if (fresh) {
          mergeFields(fresh.fields);
          setRevision(fresh.identity_revision);
          setCandidates(fresh.candidates);
        }
        setError('This card was updated somewhere else while you were reviewing it. Your entries are still here. Check them once more and save again.');
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error || 'We could not save your card details. Please try again.');
      }

      // The identity is saved. A pricing failure from here on is reported
      // softly: it must never look like the correction was lost.
      if (review.is_sports && candidateId && candidateId !== NO_CANDIDATE) {
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
          try {
            const selection = await fetch('/api/pricing/dcm-select', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ cardId, productId: candidate.id, productName: candidate.name }),
            });
            if (!selection.ok) throw new Error('selection rejected');
          } catch {
            setSavedCard(data.card);
            setNote('Your card details are saved. We could not save the version you picked, so you can set that in Market Pricing below.');
            return;
          }
        }
      }

      onSaved(data.card);
    } catch (err: any) {
      setError(err?.message || 'We could not save your card details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reviewLater = async () => {
    setDismissing(true);
    setError(null);
    try {
      const session = getStoredSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch(`/api/cards/${cardId}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ dismiss: true }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'We could not save that. Please try again.');
      }
      onDismissed();
    } catch (err: any) {
      setError(err?.message || 'We could not save that. Please try again.');
    } finally {
      setDismissing(false);
    }
  };

  /* ---------------- rendering ---------------- */

  const marker = (field: ReviewField) => {
    if (field.needsCheck) {
      return <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Please check</span>;
    }
    if (field.origin === 'read_from_card') {
      return <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">Read from card</span>;
    }
    return null;
  };

  const photo = (url: string | null | undefined, label: string) => (
    <div className="flex-1 min-w-0">
      {url ? (
        <button
          type="button"
          onClick={() => setZoom({ url, label })}
          className="block w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
          aria-label={`Enlarge the ${label.toLowerCase()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-auto object-contain max-h-44" />
        </button>
      ) : (
        <div className="h-24 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
      )}
      <p className="mt-1 text-[11px] text-slate-500 text-center">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto" onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50" onClick={() => { if (!saving) onClose(); }} aria-hidden="true" />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-lg bg-white rounded-xl shadow-xl max-h-[92vh] overflow-y-auto"
        >
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-start justify-between rounded-t-xl">
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">Confirm your card details</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Check what we have against your photos. Correct anything that is wrong.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (!saving) onClose(); }}
              className="ml-3 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div className="flex gap-2">
              {photo(frontUrl, 'Front')}
              {photo(backUrl, 'Back')}
            </div>

            {checking && (
              <p className="text-xs text-slate-500" role="status">Checking the card...</p>
            )}

            <div className="space-y-3">
              {fields.map(field => (
                <div key={field.key}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor={`identity-review-${field.key}`} className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      {field.label}
                    </label>
                    {marker(field)}
                  </div>
                  <input
                    id={`identity-review-${field.key}`}
                    type="text"
                    value={values[field.key] ?? ''}
                    onChange={event => setValue(field.key, event.target.value)}
                    inputMode={field.key === 'release_date' ? 'numeric' : undefined}
                    maxLength={MAX_LENGTH[field.key] ?? 200}
                    placeholder={field.key === 'release_date' ? 'YYYY' : 'Leave blank if you are not sure'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  {field.displayValue && field.displayValue !== (values[field.key] ?? '') && (
                    <p className="mt-1 text-[11px] text-slate-500">Printed as {field.displayValue}</p>
                  )}
                  {/* A value read off the card replaced what was on file: say so, and
                      make the old value one tap away. A transcription can be wrong too. */}
                  {field.differsFromStored && field.storedValue && field.storedValue !== (values[field.key] ?? '') && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      We had: {field.storedValue}
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setValue(field.key, field.storedValue!)}
                        className="font-semibold text-slate-800 underline"
                      >
                        Keep that
                      </button>
                    </p>
                  )}
                  {field.suggestion && field.suggestion.value !== (values[field.key] ?? '') && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      Suggested: {field.suggestion.displayValue || field.suggestion.value}
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setValue(field.key, field.suggestion!.value)}
                        className="font-semibold text-slate-800 underline"
                      >
                        Use
                      </button>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {review.alternatives.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Could also be</p>
                <ul className="mt-1 space-y-1">
                  {review.alternatives.map((alternative, index) => (
                    <li key={`${alternative.differs_in}-${index}`} className="text-xs text-slate-600">
                      {ALTERNATIVE_LABEL[alternative.differs_in] || alternative.differs_in}: {alternative.value}
                      {ALTERNATIVE_FIELD[alternative.differs_in] && (
                        <>
                          {' · '}
                          <button
                            type="button"
                            onClick={() => applyAlternative(alternative)}
                            className="font-semibold text-slate-800 underline"
                          >
                            Use
                          </button>
                        </>
                      )}
                      {alternative.what_would_settle_it && (
                        <span className="block text-[11px] text-slate-500">Check: {alternative.what_would_settle_it}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {review.is_sports ? (
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="text-xs font-semibold text-slate-700 px-1">Which version is it?</legend>
                {candidates.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    {review.candidates_error
                      ? 'We could not load the catalog versions right now. You can pick one in Market Pricing below.'
                      : 'We have no catalog versions for this card yet. You can pick one in Market Pricing below.'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {candidates.map(candidate => (
                      <label key={candidate.id} className="flex items-start gap-2 text-xs text-slate-700 py-1">
                        <input
                          type="radio"
                          name="identity-review-candidate"
                          value={candidate.id}
                          checked={candidateId === candidate.id}
                          onChange={() => setCandidateId(candidate.id)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-slate-800">
                            {candidate.name}{candidate.isBase ? ' (Base)' : ''}
                          </span>
                          {candidate.setName && <span className="block text-slate-500">{candidate.setName}</span>}
                        </span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-xs text-slate-700 py-1 border-t border-slate-200 pt-2">
                      <input
                        type="radio"
                        name="identity-review-candidate"
                        value={NO_CANDIDATE}
                        checked={candidateId === NO_CANDIDATE}
                        onChange={() => setCandidateId(NO_CANDIDATE)}
                      />
                      <span>None of these / not sure</span>
                    </label>
                  </div>
                )}
              </fieldset>
            ) : (
              <p className="text-xs text-slate-600">
                To match this card to a priced product, use the Market Pricing section further down this page.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">{error}</p>
            )}
            {note && (
              <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3" role="status">{note}</p>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 rounded-b-xl">
            {savedCard ? (
              <button
                type="button"
                onClick={() => onSaved(savedCard)}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
              >
                Done
              </button>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || dismissing}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : hasChanges ? 'Save and confirm' : 'Looks correct'}
                  </button>
                  <button
                    type="button"
                    onClick={reviewLater}
                    disabled={saving || dismissing}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium disabled:opacity-60"
                  >
                    {dismissing ? 'Saving...' : 'Review later'}
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={onOpenMoreDetails}
                    className="text-xs text-slate-600 underline"
                  >
                    More details
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-label={zoom.label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.url} alt={zoom.label} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
