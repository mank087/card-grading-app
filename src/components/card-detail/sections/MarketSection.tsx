'use client';

/**
 * The Market & portfolio tab's body.
 *
 * Extracted from `CardDetailShell` (owner review, 2026-09-22) so the shell
 * keeps to composition and does not grow as these sections do. Nothing about
 * how it mounts has changed: this is the SAME tree, and `CardDetailSections`
 * still keeps Market mounted while it is inactive so the category price
 * lookup runs on every view, exactly as the legacy page's hidden
 * CollapsibleSection did.
 *
 * ITEM 8 — "No mail-away estimates were produced for this card" is NOT a bug.
 * `/api/<category>/<id>` really does return `estimated_professional_grades:
 * null` for cards graded before the two-stage system wrote that column, and
 * the legacy page renders nothing at all in that case. The note is correct, so
 * it stays — as one calm line. The heading is rendered only when there IS
 * something under it, because a heading over an empty panel reads as a section
 * that failed to load.
 */

import type { ReactNode } from 'react';

export interface MarketSectionProps {
  /** The category's price lookup, mounted exactly as legacy mounts it. */
  pricing: ReactNode;
  /** The category's marketplace search links. */
  marketplaceLinks: ReactNode;
  /** The PSA/BGS/SGC/CGC panel, or null when there is nothing to draw. */
  proEstimates: ReactNode | null;
  isOwner: boolean;
}

export function MarketSection({
  pricing,
  marketplaceLinks,
  proEstimates,
  isOwner,
}: MarketSectionProps) {
  return (
    <div className="cd-section">
      <div className="cd-section-title">
        <p className="cd-eyebrow">Know what you hold</p>
        <h2>Your card in the market.</h2>
        <p>Estimates, not sale guarantees.</p>
      </div>

      <div id="tour-live-market-pricing">{pricing}</div>

      <section id="tour-market-pricing" className="cd-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
          Find and price this card or similar
        </h3>
        <p className="cd-caption" style={{ marginBottom: 14 }}>
          Search the marketplaces for comparable listings.
        </p>
        <div className="cd-link-grid">{marketplaceLinks}</div>
      </section>

      <section id="tour-pro-estimates" className="cd-panel">
        {proEstimates ? (
          <>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              Estimated mail-away grades
            </h3>
            {proEstimates}
          </>
        ) : (
          <p className="cd-caption" style={{ margin: 0 }}>
            No mail-away grade estimates for this card.
          </p>
        )}
      </section>

      {isOwner && (
        <div className="dcm-actions">
          <a className="cd-quiet" href="/market-pricing" target="_blank" rel="noopener">
            View full portfolio
          </a>
        </div>
      )}
    </div>
  );
}

export default MarketSection;
