'use client';

/**
 * The identity block at the top of the hero summary: category tag, context
 * line, serial, the card's name (the page's `<h1>`), its subtitle, the one
 * identity notice, and the `IdentityReview` mount. Extracted from
 * `CardDetailShell` (Sept 23 mobile review, Phase 3); markup unchanged.
 *
 * ALWAYS MOUNTED, ON EVERY TAB AND AT EVERY WIDTH. `IdentityReview` pops its
 * confirm-details dialog at most once per page load, and unmounting it would
 * reset that guard. On a phone (S1) this block sits directly above the
 * section nav and is never part of the Overview-only hero that the other tabs
 * park out of view.
 */

import IdentityReview from '@/components/cards/IdentityReview';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import type { IdentityConcern } from '@/lib/cardDetail/identityConcern';
import CardIdentityNotice from './CardIdentityNotice';

export interface CardDetailIdentityProps {
  vm: CardDetailViewModel;
  card: any;
  categoryLabel: string;
  isOwner: boolean;
  currentUserId: string | null | undefined;
  concern: IdentityConcern | null;
  /** True while IdentityReview's own banner is on screen. */
  reviewShowing: boolean;
  onReviewShowingChange: (showing: boolean) => void;
  onEdited: () => void;
}

export function CardDetailIdentity({
  vm,
  card,
  categoryLabel,
  isOwner,
  currentUserId,
  concern,
  reviewShowing,
  onReviewShowingChange,
  onEdited,
}: CardDetailIdentityProps) {
  /** Number · rarity · language. One line, under the <h1>. */
  const subtitle =
    [vm.identity.cardNumberFormatted, vm.identity.rarityOrVariant, vm.identity.language]
      .filter(Boolean)
      .join(' · ') || null;

  return (
    <div className="cd-identity">
      <div className="cd-identity-tags">
        <span className="cd-tag">{categoryLabel}</span>
        {vm.identity.contextLine && <span>{vm.identity.contextLine}</span>}
        <span className="cd-serial">#{vm.identity.serial}</span>
      </div>
      <h1>{vm.identity.displayName}</h1>
      {subtitle && <p className="cd-subtitle">{subtitle}</p>}

      {/* One identity notice, under the name. IdentityReview (the
          confirm-details popup + banner) is mounted here, outside the
          tabbed sections, so it exists on every tab and pops at most
          once per page load; the database-match notice steps aside
          while its banner is showing. */}
      <CardIdentityNotice
        concern={concern}
        suppressed={isOwner && reviewShowing}
        isOwner={isOwner}
        card={card}
        currentUserId={currentUserId}
        onEdited={onEdited}
      />
      <div className="cd-identity-review">
        <IdentityReview
          card={card}
          currentUserId={currentUserId}
          frontUrl={vm.images.front.url}
          backUrl={vm.images.back.url}
          onSaved={onEdited}
          onNeedsReviewChange={onReviewShowingChange}
        />
      </div>
    </div>
  );
}

export default CardDetailIdentity;
