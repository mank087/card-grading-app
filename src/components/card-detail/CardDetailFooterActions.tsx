'use client';

/**
 * The owner actions legacy keeps at the foot of the page (CardDetailClient
 * 6918-6940 and below): grade another card, the post-result offer, mark as
 * sold, and the binder picker.
 *
 * Extracted from `CardDetailShell` unchanged — the shell is composition, and
 * this block is four unrelated widgets sharing a padding rule.
 *
 * "Grade another card" is not decoration: the happy path used to end here with
 * no next step, and most first-time graders stopped after one card. The
 * onboarding-funnel work added this CTA and V2 may not quietly drop it.
 *
 * COMPACT MANAGEMENT ROWS (Sept 23 review, O4). The full binder list and the
 * "Sold this card?" block used to sit under every tab. They are now two rows —
 * "Binders · Manage" and "Mark as sold" — each opening the SAME shared
 * component in a sheet (`CardDetailSheet`), which is where the consequences
 * are explained. Owner-only, as before. The binder picker stays mounted inside
 * its closed sheet, so it still loads exactly once per page view and labels
 * its row through its additive `onMembershipChange`.
 */

import { useEffect, useState } from 'react';
import { ActionLink } from '@/components/design/Primitives';
import { MarkAsSoldButton } from '@/components/cards/MarkAsSoldButton';
import { isCardGradeComplete } from './useCardDetail';
import { useCredits } from '@/contexts/CreditsContext';
import {
  CardBinderPicker,
  type CardBinderMembership,
} from '@/components/binders/CardBinderPicker';
import { PostResultOffer } from '@/components/conversion/PostResultOffer';
import CardDetailSheet from './CardDetailSheet';

export interface CardDetailFooterActionsProps {
  card: any;
  cardName: string;
  isOwner: boolean;
  loading: boolean;
  balance: number;
  creditsLoading: boolean;
  /** Where "grade another" goes when the card has a retake route. */
  retakeHref?: string | null;
  uploadHref: string;
  /** Reports the management sheet, so the shell locks the page and hides the bar. */
  onSheetOpenChange?: (open: boolean) => void;
}

type ManageSheet = 'binders' | 'sold' | null;

export function CardDetailFooterActions({
  card,
  cardName,
  isOwner,
  loading,
  balance,
  creditsLoading,
  retakeHref,
  uploadHref,
  onSheetOpenChange,
}: CardDetailFooterActionsProps) {
  const outOfCredits = !creditsLoading && balance === 0;
  // "Free grades" is only true for someone who has never bought credits.
  const { totalPurchased } = useCredits();
  const [sheet, setSheet] = useState<ManageSheet>(null);
  // Null until the picker's own load answers.
  const [binders, setBinders] = useState<CardBinderMembership | null>(null);
  const isSold = card.ownership_status === 'sold';

  useEffect(() => {
    onSheetOpenChange?.(sheet !== null);
  }, [sheet, onSheetOpenChange]);
  // Never leave the shell thinking a sheet is open after this unmounts.
  useEffect(() => () => onSheetOpenChange?.(false), [onSheetOpenChange]);

  const closeSheet = () => setSheet(null);

  return (
    <div className="cd-footer-actions" style={{ paddingBottom: 40 }}>
      {isOwner && (
        <div style={{ textAlign: 'center', paddingBlock: 24 }}>
          <ActionLink href={outOfCredits ? '/credits' : (retakeHref ?? uploadHref)} variant="primary">
            {outOfCredits ? 'See all options to keep grading' : 'Grade another card'}
          </ActionLink>
          {!creditsLoading && (
            <p className="cd-caption" style={{ marginTop: 8 }}>
              {balance === 0
                ? (totalPurchased === 0 ? 'You’ve used your free grades.' : 'You’re out of credits.')
                : `You have ${balance} credit${balance === 1 ? '' : 's'} left.`}
            </p>
          )}
        </div>
      )}
      <PostResultOffer
        ownerId={card?.user_id ?? null}
        gradeComplete={!loading && isCardGradeComplete(card)}
        orgId={(card as { org_id?: string | null } | null)?.org_id ?? null}
      />
      {isOwner && (
        <div className="cd-manage-rows" role="group" aria-label="Manage this card">
          {/* Hidden only when the binders feature is unavailable — the picker
              would render nothing inside the sheet. */}
          {binders?.available !== false && (
            <button
              type="button"
              className="cd-manage-row"
              aria-haspopup="dialog"
              onClick={() => setSheet('binders')}
            >
              <span className="cd-manage-row-label">Binders</span>
              <span className="cd-manage-row-value">
                {binders ? (binders.names.length ? binders.names.join(', ') : 'Not in a binder') : ''}
              </span>
              <span className="cd-manage-row-action">Manage</span>
            </button>
          )}
          {isSold ? (
            // The SoldBanner at the top carries the detail and the reversal.
            <p className="cd-manage-row cd-manage-row--static">
              <span className="cd-manage-row-label">Sold</span>
            </p>
          ) : (
            <button
              type="button"
              className="cd-manage-row"
              aria-haspopup="dialog"
              onClick={() => setSheet('sold')}
            >
              <span className="cd-manage-row-label">Mark as sold</span>
              <span className="cd-manage-row-value" />
              <span className="cd-manage-row-action" aria-hidden="true">
                ›
              </span>
            </button>
          )}
        </div>
      )}

      {isOwner && (
        <CardDetailSheet open={sheet === 'binders'} title="Binders" onClose={closeSheet} keepMounted>
          <CardBinderPicker cardId={card.id} isOwner={isOwner} onMembershipChange={setBinders} />
        </CardDetailSheet>
      )}
      {isOwner && !isSold && (
        <CardDetailSheet open={sheet === 'sold'} title="Mark as sold" onClose={closeSheet}>
          <MarkAsSoldButton
            cardId={card.id}
            cardName={cardName}
            serial={card.serial}
            ownershipStatus={card.ownership_status}
            isOwner={isOwner}
          />
        </CardDetailSheet>
      )}
    </div>
  );
}

export default CardDetailFooterActions;
