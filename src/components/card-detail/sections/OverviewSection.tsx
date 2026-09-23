'use client';

/**
 * The Overview tab's body, extracted from `CardDetailShell` (Sept 23 mobile
 * review, Phase 3) so the shell stays composition only. Markup unchanged.
 *
 * PHONES (≤760px, S2): the "Why this grade" block — its section title and
 * `GradeHighlights` — is hidden by CSS (`cd-overview-why`, card-detail.css).
 * On a phone its content lives in the hero's subgrade tiles instead, and the
 * holder band follows the hero directly. A desktop keeps both.
 */

import type { ReactNode } from 'react';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';
import type { CardDetailSectionId } from '@/lib/cardDetail/anchorMap';
import GradeHighlights from '../GradeHighlights';
import CardFacts from '../CardFacts';
import { OverviewHoldersBand, type HolderSectionCommonProps } from '../holders/HolderSections';

export interface OverviewSectionProps {
  vm: CardDetailViewModel;
  card: any;
  category: CardDetailCategory;
  conditionSummary: string | null;
  isOwner: boolean;
  currentUserId: string | null | undefined;
  onEdited: () => void;
  jumpTo: (id: CardDetailSectionId, anchorId?: string) => void;
  holderSectionProps: HolderSectionCommonProps;
  categorySlot?: ReactNode;
  categoryBadges?: ReactNode;
  categoryVariantBadge?: ReactNode;
  categoryFeaturesVisible?: boolean;
}

export function OverviewSection({
  vm,
  card,
  category,
  conditionSummary,
  isOwner,
  currentUserId,
  onEdited,
  jumpTo,
  holderSectionProps,
  categorySlot,
  categoryBadges,
  categoryVariantBadge,
  categoryFeaturesVisible,
}: OverviewSectionProps) {
  return (
    <div className="cd-section">
      <div className="cd-section-title cd-overview-why">
        <p className="cd-eyebrow">The grade, at a glance</p>
        <h2>What we found on your card.</h2>
        <p>The findings behind each subgrade, then the record behind the label.</p>
      </div>
      <GradeHighlights
        vm={vm}
        card={card}
        conditionSummary={conditionSummary}
        onJumpToGrade={(anchorId) => jumpTo('grade', anchorId)}
      />
      <OverviewHoldersBand {...holderSectionProps} onSeeAll={() => jumpTo('labels')} />

      <div className="cd-two-col" style={{ marginTop: 20 }}>
        <CardFacts
          vm={vm}
          card={card}
          currentUserId={currentUserId}
          isOwner={isOwner}
          onEdited={onEdited}
          categorySlot={categorySlot}
          category={category}
          categoryBadges={categoryBadges}
          categoryVariantBadge={categoryVariantBadge}
          categoryFeaturesVisible={categoryFeaturesVisible}
        />
        {/* On a phone the eyebrow and the lead line go (one heading each). */}
        <section className="cd-panel cd-overview-more">
          <p className="cd-eyebrow">The whole picture</p>
          <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Your grade, explained.</h3>
          <p className="cd-caption cd-overview-more-lead" style={{ marginTop: 8 }}>
            Read the front-to-back findings, or take a report away with you.
          </p>
          <div className="dcm-actions" style={{ marginTop: 16 }}>
            <button type="button" className="cd-quiet" onClick={() => jumpTo('grade')}>
              Grade details
            </button>
            <button type="button" className="cd-quiet" onClick={() => jumpTo('reports')}>
              Reports &amp; downloads
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default OverviewSection;
