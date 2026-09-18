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
  mergeReviewFields,
  mergeReviewValues,
  NO_CANDIDATE,
  parallelFromListingName,
  REVIEW_ALTERNATIVE_FIELD as ALTERNATIVE_FIELD,
  REVIEW_ALTERNATIVE_LABEL as ALTERNATIVE_LABEL,
  REVIEW_MAX_LENGTH as MAX_LENGTH,
  reviewOwnerEdited,
  versionPickNeedsSaving,
  type IdentityReviewState,
  type ReviewAlternative,
  type ReviewCandidate,
  type ReviewField,
} from '@/lib/identity/reviewClient';

export type { IdentityReviewState };

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

/** Sentinel value of the set dropdown's "not listed" row. */
const CUSTOM_SET = '__custom__';

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

  // Set names from DCM's internal card databases (TCG categories only), so the set
  // is spelled the way the catalog and the price lookups spell it.
  const [setOptions, setSetOptions] = useState<{ name: string; year: string | null }[]>([]);
  const [customSet, setCustomSet] = useState(false);
  useEffect(() => {
    if (review.is_sports || !review.category) return;
    let cancelled = false;
    fetch(`/api/cards/set-options?category=${encodeURIComponent(review.category)}`)
      .then(response => response.json())
      .then(data => { if (!cancelled && Array.isArray(data?.sets)) setSetOptions(data.sets); })
      .catch(() => { /* free text still works */ });
    return () => { cancelled = true; };
  }, [review.is_sports, review.category]);

  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = 'confirm-card-details-title';

  const changed = useMemo(() => changedFieldPayload(fields, values), [fields, values]);
  // What the dialog opened with (DCM's findings). The button reads "Update details"
  // only once the owner moves something away from these, and "Reset to original
  // findings" puts every box and the version pick back.
  const defaultCandidateId = review.suggested_candidate_id || NO_CANDIDATE;
  const ownerEdited = reviewOwnerEdited(fields, values, candidateId, defaultCandidateId);
  const resetToFindings = () => {
    setValues(Object.fromEntries(fields.map(f => [f.key, f.value])));
    setTouched({});
    setCandidateId(defaultCandidateId);
    setError(null);
  };

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
  // Read `touched` through a ref: the background first-look request captures this
  // callback when the dialog opens, so a state value here would be the empty one
  // from that moment and a late answer would overwrite what the owner has typed.
  const touchedRef = useRef(touched);
  touchedRef.current = touched;
  const mergeFields = useCallback((incoming: ReviewField[]) => {
    setFields(previous => mergeReviewFields(previous, incoming));
    setValues(previous => mergeReviewValues(previous, incoming, touchedRef.current));
  }, []);

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

  /** "Joe Mixon [Autograph Jersey Mirror Red] #214" → "Autograph Jersey Mirror Red"; a base listing → "Base". */
  const parallelOf = (candidate: ReviewCandidate): string => parallelFromListingName(candidate.name);
  // Picking a version also fills the Parallel box, so Card Information shows it
  // after saving. A parallel the owner typed themselves is left alone.
  const chooseCandidate = (candidate: ReviewCandidate) => {
    setCandidateId(candidate.id);
    if (fields.some(f => f.key === 'parallel_type') && !touched.parallel_type) {
      setValues(previous => ({ ...previous, parallel_type: parallelOf(candidate) }));
    }
  };

  // The owner already picked a version for pricing but the card has no parallel on
  // file: start the Parallel box from that pick, as part of the findings (so the
  // button still reads "Looks correct" and saving records it on the card).
  useEffect(() => {
    const picked = review.current_product_id ? review.candidates.find(c => c.id === review.current_product_id) : null;
    if (!picked) return;
    const derived = parallelOf(picked);
    setFields(previous => previous.map(f => (f.key === 'parallel_type' && !f.value ? { ...f, value: derived, origin: 'suggested' as const } : f)));
    setValues(previous => (previous.parallel_type ? previous : { ...previous, parallel_type: derived }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The set dropdown. Picking a catalog set also fills an empty Year from that
   * set's release date; "Type a set that is not listed" opens a free-text box so a
   * brand new release or a promo can still be confirmed.
   */
  const chooseSet = (choice: string) => {
    if (choice === CUSTOM_SET) {
      setCustomSet(true);
      setValue('card_set', '');
      return;
    }
    setCustomSet(false);
    setValue('card_set', choice);
    const picked = setOptions.find(option => option.name === choice);
    if (picked?.year && !(values.release_date || '').trim()) setValue('release_date', picked.year);
  };

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
      // Re-posting the pick the card already has would only clear and refetch its
      // prices. It is needed again only when this save changed the identity, because
      // that clears the pick.
      if (versionPickNeedsSaving({
        isSports: review.is_sports,
        candidateId,
        currentProductId: review.current_product_id,
        pricingInvalidated: data?.pricing_invalidated === true,
      })) {
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
                  {/* TCG categories get a real list of that game's sets, from DCM's own
                      set tables, so a confirmed set is spelled the way the catalog and
                      the price lookups spell it. "Type a set that is not listed" keeps a
                      brand new release or a promo confirmable. */}
                  {field.key === 'card_set' && setOptions.length > 0 ? (
                    <>
                      <select
                        id={`identity-review-${field.key}`}
                        value={customSet ? CUSTOM_SET : (setOptions.some(o => o.name === values.card_set) ? values.card_set : (values.card_set ? CUSTOM_SET : ''))}
                        onChange={event => chooseSet(event.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <option value="">Not sure</option>
                        {setOptions.map(option => (
                          <option key={option.name} value={option.name}>
                            {option.name}{option.year ? ` (${option.year})` : ''}
                          </option>
                        ))}
                        <option value={CUSTOM_SET}>Type a set that is not listed</option>
                      </select>
                      {(customSet || (!!values.card_set && !setOptions.some(o => o.name === values.card_set))) && (
                        <input
                          type="text"
                          value={values.card_set ?? ''}
                          onChange={event => setValue('card_set', event.target.value)}
                          maxLength={200}
                          placeholder="Type the set name"
                          aria-label="Set name that is not in the list"
                          className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      )}
                    </>
                  ) : (
                  <input
                    id={`identity-review-${field.key}`}
                    type="text"
                    value={values[field.key] ?? ''}
                    onChange={event => {
                      setValue(field.key, event.target.value);
                      // Choosing a catalog set also fills an empty Year from that set's release date.
                      if (field.key === 'card_set') {
                        const picked = setOptions.find(option => option.name === event.target.value);
                        if (picked?.year && !(values.release_date || '').trim()) setValue('release_date', picked.year);
                      }
                    }}
                    list={field.key === 'card_set' && setOptions.length > 0 ? 'identity-review-set-options' : undefined}
                    autoComplete={field.key === 'card_set' ? 'off' : undefined}
                    inputMode={field.key === 'release_date' ? 'numeric' : undefined}
                    maxLength={MAX_LENGTH[field.key] ?? 200}
                    placeholder={field.key === 'release_date' ? 'YYYY' : 'Leave blank if you are not sure'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  )}
                  {field.key === 'card_set' && setOptions.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {setOptions.some(option => option.name === (values.card_set || ''))
                        ? 'This set is in our catalog.'
                        : (values.card_set ? 'This set is not in our catalog, so pricing may not find a match.' : `${setOptions.length.toLocaleString()} sets to choose from.`)}
                    </p>
                  )}
                  {field.catalogNote && (values[field.key] ?? '') === field.value && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-700">{field.catalogNote}</p>
                  )}
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
                      Possible {field.label.toLowerCase()} alternative: {field.suggestion.displayValue || field.suggestion.value}
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
                {candidates.length > 0 && (values.serial_numbering || '').includes('/') && (
                  <p className="text-xs text-slate-600 mb-2">
                    Your card is numbered <span className="font-semibold text-slate-800">{values.serial_numbering}</span>. Pick the version with that print run (/{(values.serial_numbering || '').split('/').pop()}).
                    {candidates.every(c => !c.serialDenominator) ? ' The catalog does not list print runs for these versions, so go by the name and colour.' : ''}
                  </p>
                )}
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
                          onChange={() => chooseCandidate(candidate)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-slate-800">
                            {candidate.name}{candidate.isBase ? ' (Base)' : ''}
                          </span>
                          {(candidate.setName || candidate.serialDenominator || candidate.rawPrice) && (
                            <span className="block text-slate-500">
                              {[candidate.setName, candidate.serialDenominator ? `Numbered /${candidate.serialDenominator}` : null, candidate.rawPrice ? `about ${candidate.rawPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} ungraded` : null].filter(Boolean).join(' · ')}
                            </span>
                          )}
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
            ) : null}

            {/* What Market Pricing is matched to, for every category. */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">Market pricing match</p>
              {review.pricing_match ? (
                <>
                  <p className="text-sm text-slate-900 mt-1">{review.pricing_match.product_name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {review.pricing_match.picked_by_owner ? 'You picked this listing.' : 'Matched automatically.'}
                    {' '}If it is not your card, {review.is_sports ? 'pick the right version above.' : 'correct the details here, then choose the right listing in Market Pricing on the card page.'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-600 mt-1">
                  No market pricing match yet. Make sure the card name and card number are correct, because pricing is looked up from them.
                </p>
              )}
            </div>

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
                    {saving ? 'Saving...' : ownerEdited ? 'Update details' : 'Looks correct'}
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
                <div className="mt-2 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={resetToFindings}
                    disabled={!ownerEdited || saving || dismissing}
                    className="text-xs text-slate-600 underline disabled:opacity-40 disabled:no-underline"
                  >
                    Reset to original findings
                  </button>
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
