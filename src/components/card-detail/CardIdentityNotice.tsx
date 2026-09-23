'use client';

/**
 * The ONE identity notice, under the card name.
 *
 * Two things can say "check this card's details":
 *   1. the confirm-details review (IdentityReview), which the server decides;
 *   2. a weak database match (`pokemon_api_confidence`, identityConcern.ts).
 * They used to appear in two places — the review's banner under the hero, and
 * a callout buried in the Pokémon card facts — and could both show at once.
 *
 * IdentityReview renders its own banner here too (the shell mounts it right
 * after this), so when that banner is showing this notice steps aside:
 * `suppressed`. Visitors never get the review, so for them this notice is the
 * only disclosure, without the action.
 */

import { ConfirmCardDetailsCalloutButton, identityConfirmEnabled } from '@/components/cards/IdentityReview';
import EditCardDetailsButton from '@/components/cards/EditCardDetailsButton';
import { identityConcernCopy, type IdentityConcern } from '@/lib/cardDetail/identityConcern';

export interface CardIdentityNoticeProps {
  concern: IdentityConcern | null;
  /** True while IdentityReview's own banner is on screen — it says the same thing. */
  suppressed: boolean;
  isOwner: boolean;
  card: any;
  currentUserId: string | null | undefined;
  onEdited: () => void;
  /**
   * The confirm-details review is waiting for the owner. Under the name its own
   * banner says so; in InstaList (far below it) this notice says it instead.
   */
  reviewPending?: boolean;
  /** Extra framing, e.g. in InstaList where the title is built from these fields. */
  context?: string;
}

export function CardIdentityNotice({
  concern,
  suppressed,
  isOwner,
  card,
  currentUserId,
  onEdited,
  reviewPending = false,
  context,
}: CardIdentityNoticeProps) {
  if (suppressed || (!concern && !reviewPending)) return null;
  const copy = concern
    ? identityConcernCopy(concern)
    : { title: 'Confirm your card details', line: 'Check the set, year and number against your photos.' };

  return (
    <div className="cd-callout cd-identity-notice" role="note">
      <p>
        <strong>{copy.title}</strong>
      </p>
      <p className="cd-caption">
        {copy.line}
        {context ? ` ${context}` : ''}
      </p>
      {isOwner &&
        (identityConfirmEnabled() ? (
          // Opens the existing confirm-details dialog.
          <ConfirmCardDetailsCalloutButton />
        ) : (
          <EditCardDetailsButton
            card={card}
            currentUserId={currentUserId ?? undefined}
            onEditComplete={onEdited}
            variant="default"
          />
        ))}
    </div>
  );
}

export default CardIdentityNotice;
