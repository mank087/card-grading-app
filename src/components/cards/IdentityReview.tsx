'use client';

/**
 * Phase 2B entry point. The eight category detail pages mount this ONCE, just
 * above the card details block, and it decides on its own whether the owner sees
 * the confirmation popup, the quieter review banner, or nothing at all.
 *
 * Why one component: there are eight 4,000-line detail pages. Anything that
 * needed per-page state would be eight copies to keep in step. This owns all of
 * it, and the value-guard callout on each page opens the same dialog by
 * dispatching a window event rather than holding its own copy of the state.
 *
 * Off unless NEXT_PUBLIC_IDENTITY_CONFIRM=1: nothing renders and no request is
 * made.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import EditCardDetailsModal from './EditCardDetailsModal';
import ConfirmCardDetailsDialog, { type IdentityReviewState } from './ConfirmCardDetailsDialog';
import { getStoredSession } from '@/lib/directAuth';
import { isRecordLocked } from '@/lib/cards/ownership';

/** Any page can ask for the dialog by dispatching this on `window`. */
export const IDENTITY_REVIEW_OPEN_EVENT = 'dcm:open-identity-review';

export function identityConfirmEnabled(): boolean {
  return process.env.NEXT_PUBLIC_IDENTITY_CONFIRM === '1';
}

function firstLookOnDemandEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIRST_LOOK_ON_DEMAND === '1';
}

/** Our own overlays, so the "is another modal open?" check can skip them. */
const OWN_MARKER = 'data-dcm-identity-review';

/**
 * True when something else already has the screen: an onboarding tour step, the
 * first-grade congratulations modal, a post-result offer, the label editor, a
 * cookie banner. They are all full-screen fixed overlays with a stacking
 * context, so that is what we look for rather than hard-coding their names.
 */
function anotherOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  const nodes = document.querySelectorAll<HTMLElement>(`[role="dialog"], .fixed.inset-0`);
  for (const node of Array.from(nodes)) {
    if (node.closest(`[${OWN_MARKER}="true"]`)) continue;
    if (node.getClientRects().length === 0) continue;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    if (node.getAttribute('role') === 'dialog') return true;
    const zIndex = Number.parseInt(style.zIndex, 10);
    if (Number.isFinite(zIndex) && zIndex >= 40) return true;
  }
  return false;
}

interface ReviewCard {
  id: string;
  user_id?: string | null;
  category?: string | null;
  ownership_status?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

interface Props {
  card: ReviewCard | null | undefined;
  currentUserId?: string | null;
  frontUrl?: string | null;
  backUrl?: string | null;
  /** Called after a save, with the updated card. Use the page's existing edit handler. */
  onSaved: (card: unknown) => void;
  /**
   * ADDITIVE (card detail V2). Told whether this review currently needs the
   * owner, so a page can avoid showing a second "check your card details"
   * notice beside this one. Pages that omit it are unaffected.
   */
  onNeedsReviewChange?: (needsReview: boolean) => void;
}

/**
 * A button for the "Confirm your card details to see a value" callout. It only
 * asks the mounted IdentityReview to open, so the eight pages hold no state.
 */
export function ConfirmCardDetailsCalloutButton({ className = '' }: { className?: string }) {
  if (!identityConfirmEnabled()) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(IDENTITY_REVIEW_OPEN_EVENT))}
      className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold ${className}`}
    >
      Confirm card details
    </button>
  );
}

export default function IdentityReview({ card, currentUserId, frontUrl, backUrl, onSaved, onNeedsReviewChange }: Props) {
  const [state, setState] = useState<IdentityReviewState | null>(null);
  const [open, setOpen] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const popupUsedRef = useRef(false);
  // True while the dialog on screen opened by itself (first visit) rather than by a click.
  const autoOpenedRef = useRef(false);

  const cardId = card?.id;
  // Cheap, certain refusals only. Everything else (graded, confirmed, dismissed,
  // rollout date) is the server's decision, because the detail pages do not all
  // select the same columns.
  const owner = !!(currentUserId && card?.user_id && card.user_id === currentUserId);
  const eligible = identityConfirmEnabled() && !!cardId && owner
    && !isRecordLocked(card as { ownership_status?: string | null })
    && !card?.deleted_at;

  const load = useCallback(async (): Promise<IdentityReviewState | null> => {
    if (!cardId) return null;
    try {
      const session = getStoredSession();
      if (!session?.access_token) return null;
      const response = await fetch(`/api/cards/${cardId}/identity-review`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as IdentityReviewState;
      if (!Array.isArray(data?.fields)) return null;
      setState(data);
      return data;
    } catch {
      return null;
    }
  }, [cardId]);

  // Re-read the review state when the grade lands. A freshly graded card is
  // opened while grading is still running, when the server answers "none"
  // (grade_processing); without this the first visit never got its popup.
  // Owner report, Sept 18 2026: a new grade on mobile web showed no popup.
  const gradeKey = `${(card as any)?.grade_status ?? ''}|${(card as any)?.conversational_whole_grade ?? ''}`;

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    load().then(data => { if (!cancelled && data) setDismissed(data.dismissed); });
    return () => { cancelled = true; };
  }, [eligible, load, gradeKey]);

  /* The popup, at most once per page load and never over another modal. */
  useEffect(() => {
    if (!eligible || !state || state.mode !== 'popup' || popupUsedRef.current) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const attempt = () => {
      if (popupUsedRef.current) return;
      if (!anotherOverlayOpen()) {
        popupUsedRef.current = true;
        autoOpenedRef.current = true;
        setOpen(true);
        return;
      }
      attempts += 1;
      // ~15s of waiting for a tour or offer to finish. After that the banner is
      // the owner's way in; we do not ambush them later in the session.
      if (attempts < 30) timer = setTimeout(attempt, 500);
    };
    timer = setTimeout(attempt, 600);
    return () => { if (timer) clearTimeout(timer); };
  }, [eligible, state]);

  /* The value-guard callout and anything else that wants the dialog. */
  useEffect(() => {
    if (!eligible) return;
    const openNow = () => {
      popupUsedRef.current = true;
      autoOpenedRef.current = false;
      setOpen(true);
      if (!state) void load();
    };
    window.addEventListener(IDENTITY_REVIEW_OPEN_EVENT, openNow);
    return () => window.removeEventListener(IDENTITY_REVIEW_OPEN_EVENT, openNow);
  }, [eligible, load, state]);

  // Hooks before the early return. Reports the same condition the banner uses.
  const needsReviewNow = eligible && !!state && state.mode !== 'none';
  useEffect(() => {
    onNeedsReviewChange?.(needsReviewNow);
  }, [needsReviewNow, onNeedsReviewChange]);

  if (!eligible) return null;
  const needsReview = !!state && state.mode !== 'none';
  const showBanner = needsReview && !open;

  return (
    <>
      {showBanner && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Confirm your card details</p>
            <p className="text-xs text-slate-600 mt-0.5">
              {dismissed
                ? 'You can still check what we have on file for this card.'
                : 'Check the set, year and number against your photos so the value and the label match the card.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { popupUsedRef.current = true; setOpen(true); }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold self-start sm:self-auto"
          >
            Review details
          </button>
        </div>
      )}

      {open && state && cardId && (
        <div {...{ [OWN_MARKER]: 'true' }}>
          <ConfirmCardDetailsDialog
            cardId={cardId}
            review={state}
            frontUrl={frontUrl}
            backUrl={backUrl}
            fetchFirstLook={!state.first_look_present && firstLookOnDemandEnabled()}
            onClose={() => {
              setOpen(false);
              // First time only: a popup the owner closed has been seen. Record it the
              // same way "Review later" does, so the next visit shows the banner, not
              // the popup again. A dialog the owner opened themselves is just closed.
              if (autoOpenedRef.current) {
                autoOpenedRef.current = false;
                setDismissed(true);
                const session = getStoredSession();
                if (session?.access_token) {
                  void fetch(`/api/cards/${cardId}/details`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify({ dismiss: true }),
                  }).catch(() => undefined);
                }
              }
            }}
            onDismissed={() => { setDismissed(true); setOpen(false); void load(); }}
            onSaved={updated => { setOpen(false); onSaved(updated); }}
            onOpenMoreDetails={() => { setOpen(false); setMoreDetailsOpen(true); }}
            onReload={load}
          />
        </div>
      )}

      {moreDetailsOpen && card && (
        <EditCardDetailsModal
          card={card as any}
          isOpen
          onClose={() => setMoreDetailsOpen(false)}
          onSave={updated => { setMoreDetailsOpen(false); onSaved(updated); }}
        />
      )}
    </>
  );
}
