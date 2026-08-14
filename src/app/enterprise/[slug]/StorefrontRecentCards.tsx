'use client';

import Link from 'next/link';
import { CardSlabGrid } from '@/components/CardSlab';
import { getCardLabelData } from '@/lib/useLabelData';

/**
 * Optional "recently graded" strip on the storefront home: a horizontal
 * scroll of the org's 10 newest public cards in the org's house slab design,
 * each linking to the org-branded card report page.
 */
export default function StorefrontRecentCards({
  slug,
  cards,
  pattern,
  bandColors,
  orgLogoColor,
}: {
  slug: string;
  cards: { card: Record<string, unknown>; frontUrl: string | null }[];
  pattern: string;
  bandColors: string[];
  orgLogoColor: string | null;
}) {
  if (!cards.length) return null;
  return (
    <div className="flex gap-5 overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      {cards.map(({ card, frontUrl }) => {
        const c = card as any;
        const label = getCardLabelData(c);
        return (
          <Link
            key={c.id}
            href={`/enterprise/${slug}/card/${c.id}`}
            className="flex-shrink-0 w-[240px] block hover:opacity-95 transition-opacity"
          >
            <CardSlabGrid
              displayName={label.primaryName}
              setLineText={label.contextLine}
              features={label.features}
              serial={label.serial}
              grade={label.grade}
              condition={label.condition}
              frontImageUrl={frontUrl}
              isAlteredAuthentic={label.isAlteredAuthentic}
              heritage={{ pattern, bandColors }}
              orgLogoColor={orgLogoColor}
              className="hover:shadow-xl transition-shadow duration-200"
            />
          </Link>
        );
      })}
    </div>
  );
}
