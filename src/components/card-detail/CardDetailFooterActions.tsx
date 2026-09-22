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
 */

import { ActionLink } from '@/components/design/Primitives';
import { MarkAsSoldButton } from '@/components/cards/MarkAsSoldButton';
import { CardBinderPicker } from '@/components/binders/CardBinderPicker';
import { PostResultOffer } from '@/components/conversion/PostResultOffer';

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
}

export function CardDetailFooterActions({
  card,
  cardName,
  isOwner,
  loading,
  balance,
  creditsLoading,
  retakeHref,
  uploadHref,
}: CardDetailFooterActionsProps) {
  const outOfCredits = !creditsLoading && balance === 0;

  return (
    <div style={{ paddingBottom: 40 }}>
      {isOwner && (
        <div style={{ textAlign: 'center', paddingBlock: 24 }}>
          <ActionLink href={outOfCredits ? '/credits' : (retakeHref ?? uploadHref)} variant="primary">
            {outOfCredits ? 'Get credits to grade more' : 'Grade another card'}
          </ActionLink>
          {!creditsLoading && (
            <p className="cd-caption" style={{ marginTop: 8 }}>
              {balance === 0
                ? 'Your free grades are used up.'
                : `You have ${balance} credit${balance === 1 ? '' : 's'} left.`}
            </p>
          )}
        </div>
      )}
      <PostResultOffer
        ownerId={card?.user_id ?? null}
        gradeComplete={!loading && typeof card?.grade === 'number' && (card.grade ?? 0) > 0}
        orgId={(card as { org_id?: string | null } | null)?.org_id ?? null}
      />
      <MarkAsSoldButton
        cardId={card.id}
        cardName={cardName}
        serial={card.serial}
        ownershipStatus={card.ownership_status}
        isOwner={isOwner}
      />
      <CardBinderPicker cardId={card.id} isOwner={isOwner} />
    </div>
  );
}

export default CardDetailFooterActions;
