'use client';

/**
 * Card Information — the identity block for the Overview section.
 *
 * The grid comes from the view model's `identity`, which is built from
 * `getCardLabelData` — the same text the printed label and the PDF use. The
 * legacy page builds a second `cardInfo` object with a different precedence
 * per category, which is exactly the divergence the view model exists to end;
 * nothing category-specific is read for the grid.
 *
 * Everything else in legacy's "Card Information" collapsible
 * (CardDetailClient.tsx 3685-4390 [sports 3592-4297]) is reproduced around it:
 *
 *   3689-3814   the detected holder  → ./DetectedSlabPanel
 *   3816-3839   the heading and the owner's edit button (`tour-edit-details`)
 *   4224-4388   special features, feature tags, card description
 *               → ./SpecialFeatures
 *
 * The category-specific remainder — bilingual naming and Type/Stage/HP/card
 * text for Pokemon, Manufacturer/Sport/Team/Parallel for sports — arrives
 * through `categorySlot`, supplied by the adapter. Nothing in this file knows
 * which category it is rendering.
 *
 * The owner affordances are the existing ones, mounted the way the legacy
 * pokemon client mounts them (3676-3690, 3827-3836):
 *   - `NotStandardCardNotice` above the grid. (`IdentityReview` is mounted by
 *     the shell, outside the tabs, so it is present on every tab.) It decides
 *     between the popup, the quiet banner and
 *     nothing, and it also answers `ConfirmCardDetailsCalloutButton` in the
 *     hero value panel, which fires a window event at it.
 *   - `EditCardDetailsButton` in the panel heading, inside `#tour-edit-details`.
 */

import type { ReactNode } from 'react';
import EditCardDetailsButton from '@/components/cards/EditCardDetailsButton';
import NotStandardCardNotice from '@/components/cards/NotStandardCardNotice';
import OrgBrandingBadge from '@/components/org/OrgBrandingBadge';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import { buildCardInfo } from '@/lib/cardDetail/cardInfo';
import { readDvgGrading } from '@/lib/cardDetail/gradeDetails';
import DetectedSlabPanel from './DetectedSlabPanel';
import SpecialFeatures from './SpecialFeatures';

export interface CardFactsProps {
  vm: CardDetailViewModel;
  card: any;
  currentUserId: string | null | undefined;
  isOwner: boolean;
  /** Legacy reloads the page after an identity edit; the shell decides how. */
  onEdited: () => void;
  /** The category's own fields, rendered under the shared grid. */
  categorySlot?: ReactNode;
  /** The category's own special-feature badges. */
  categoryBadges?: ReactNode;
}

export function CardFacts({
  vm,
  card,
  currentUserId,
  isOwner,
  onEdited,
  categorySlot,
  categoryBadges,
}: CardFactsProps) {
  const { identity } = vm;
  const cardInfo = buildCardInfo(card);
  const dvgGrading = readDvgGrading(card);

  const facts: Array<[string, string | null]> = [
    ['Set', identity.setName],
    ['Subset', identity.subset],
    ['Year', identity.year],
    ['Card number', identity.cardNumberFormatted ?? identity.cardNumber],
    ['Rarity / variant', identity.rarityOrVariant],
    ['Language', identity.language],
    ['DCM serial', identity.serial],
  ];

  return (
    <div className="cd-card-info">
      <DetectedSlabPanel card={card} />

      <section className="cd-panel">
        {/* Org-graded cards carry the store's badge with their identity. */}
        {vm.permissions.isOrgBranded && <OrgBrandingBadge cardId={vm.id} />}

        <NotStandardCardNotice card={card} className="mb-4" />
        <div className="cd-panel-heading">
          <h3>The card behind the grade</h3>
          {isOwner && (
            <div id="tour-edit-details">
              <EditCardDetailsButton
                card={card}
                currentUserId={currentUserId ?? undefined}
                onEditComplete={onEdited}
                variant="icon-only"
              />
            </div>
          )}
        </div>

        <dl id="tour-card-info" className="cd-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              {/* An em dash for a field the record does not carry. */}
              <dd>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>

        {identity.featuresLine && (
          <p className="cd-caption" style={{ marginTop: 14 }}>
            Features: {identity.featuresLine}
          </p>
        )}

        {categorySlot}
      </section>

      <SpecialFeatures
        card={card}
        cardInfo={cardInfo}
        dvgGrading={dvgGrading}
        extraBadges={categoryBadges}
      />
    </div>
  );
}

export default CardFacts;
