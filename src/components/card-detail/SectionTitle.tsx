'use client';

/**
 * A tab's section title: a small eyebrow, the `h2`, and a lead paragraph.
 *
 * PHONES (≤760px, Sept 23 mobile review, "one heading per section"): the
 * eyebrow and the lead are hidden and a SHORT `h2` is shown instead of the
 * long one — "Market value" rather than "Your card in the market." Both
 * headings are rendered and card-detail.css shows exactly one of them at each
 * width, the same way the tab row swaps its short labels. The hidden one is
 * `display: none`, so it is out of the accessibility tree: a screen reader
 * hears the wording that is on screen, and the page never has two `h2`s for
 * one section.
 *
 * `phoneNote` is a line that must survive on a phone although the lead does
 * not (InstaList's "Edits last for this visit only."). `children` render after
 * the lead at every width.
 */

import type { ReactNode } from 'react';

export interface SectionTitleProps {
  eyebrow: ReactNode;
  title: ReactNode;
  /** The phone's one heading. */
  phoneTitle: ReactNode;
  lead?: ReactNode;
  phoneNote?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function SectionTitle({
  eyebrow,
  title,
  phoneTitle,
  lead,
  phoneNote,
  className,
  children,
}: SectionTitleProps) {
  return (
    <div className={className ? `cd-section-title ${className}` : 'cd-section-title'}>
      <p className="cd-eyebrow">{eyebrow}</p>
      <h2 className="cd-title-wide">{title}</h2>
      <h2 className="cd-title-phone">{phoneTitle}</h2>
      {lead && <p className="cd-title-lead">{lead}</p>}
      {phoneNote && <p className="cd-caption cd-title-phone-note">{phoneNote}</p>}
      {children}
    </div>
  );
}

export default SectionTitle;
