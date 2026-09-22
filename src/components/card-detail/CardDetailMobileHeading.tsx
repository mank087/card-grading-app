'use client';

/**
 * The card's name, on a phone, ABOVE the photograph (review 2026-09-22).
 *
 * On a narrow screen the hero stacks: the label and card image, the style
 * controls, the holder links, and only THEN the identity block with the name in
 * it. A reader arriving from a search result or a shared link had to scroll
 * past all of that to find out which card they were looking at.
 *
 * WHY IT IS NOT A HEADING. The document has exactly one `<h1>` — the identity
 * block's — and this is the same words shown twice in one document, which is
 * the definition of a duplicate heading. So this is a paragraph, marked
 * `aria-hidden`, and a screen reader gets the real `<h1>` where it has always
 * been. The visible duplicate is a sighted-reader affordance and nothing else.
 *
 * It is hidden above 760px in CSS (`.cd-mobile-heading`), which is the same
 * breakpoint the mobile action bar uses.
 */

export interface CardDetailMobileHeadingProps {
  name: string;
  /** Number · rarity · language, already joined by the caller. */
  subtitle?: string | null;
}

export function CardDetailMobileHeading({ name, subtitle }: CardDetailMobileHeadingProps) {
  if (!name) return null;
  return (
    <div className="cd-mobile-heading" aria-hidden="true">
      <p className="cd-mobile-heading-name">{name}</p>
      {subtitle && <p className="cd-mobile-heading-sub">{subtitle}</p>}
    </div>
  );
}

export default CardDetailMobileHeading;
