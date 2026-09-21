'use client';

/**
 * "The card behind the grade" — the identity grid for the Overview section.
 *
 * Every field comes from the view model's `identity`, which is built from
 * `getCardLabelData` — the same text the printed label and the PDF use. The
 * legacy page builds a second `cardInfo` object with a different precedence
 * per category, which is exactly the divergence the view model exists to end;
 * nothing category-specific is read here.
 *
 * The owner affordances are the existing ones, mounted the way the legacy
 * pokemon client mounts them (CardDetailClient.tsx 3676-3690, 3827-3836):
 *   - `NotStandardCardNotice` and `IdentityReview` above the grid. One
 *     `IdentityReview` mount decides between the popup, the quiet banner and
 *     nothing, and it also answers `ConfirmCardDetailsCalloutButton` in the
 *     hero value panel, which fires a window event at it.
 *   - `EditCardDetailsButton` in the panel heading, inside `#tour-edit-details`.
 */

import EditCardDetailsButton from '@/components/cards/EditCardDetailsButton';
import IdentityReview from '@/components/cards/IdentityReview';
import NotStandardCardNotice from '@/components/cards/NotStandardCardNotice';
import OrgBrandingBadge from '@/components/org/OrgBrandingBadge';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';

export interface CardFactsProps {
  vm: CardDetailViewModel;
  card: any;
  currentUserId: string | null | undefined;
  isOwner: boolean;
  /** Legacy reloads the page after an identity edit; the shell decides how. */
  onEdited: () => void;
}

export function CardFacts({ vm, card, currentUserId, isOwner, onEdited }: CardFactsProps) {
  const { identity } = vm;

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
    <section className="cd-panel">
      {/* Org-graded cards carry the store's badge with their identity. */}
      {vm.permissions.isOrgBranded && <OrgBrandingBadge cardId={vm.id} />}

      <NotStandardCardNotice card={card} className="mb-4" />
      <IdentityReview
        card={card}
        currentUserId={currentUserId}
        frontUrl={vm.images.front.url}
        backUrl={vm.images.back.url}
        onSaved={onEdited}
      />

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
    </section>
  );
}

export default CardFacts;
