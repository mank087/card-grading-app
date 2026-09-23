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
 *
 * PHONES (≤760px, Sept 23 review, Phase 4 M) — the value first:
 *   1. `valueSummary`: estimate, source, freshness and the low/median/high
 *      strip (CardValueSummary's `market` variant, which carries no ids — the
 *      hero's copy owns `#tour-market-value`);
 *   2. "Matched: <product> · <confidence>" when the lookup reported one;
 *   3. the category price lookup inside "Prices by grade", CLOSED;
 *   4. the mail-away estimates inside their own disclosure, CLOSED;
 *   5. the marketplace links and the portfolio link, as before.
 * The price lookup is never unmounted by any of this: a closed `<details>`
 * keeps its children mounted, so the lookup still fetches and saves.
 *
 * DESKTOP: unchanged. 1 and 2 are phone-only, both disclosures are open with
 * their summaries hidden (PhoneDisclosure), and the estimates panel — which is
 * after the links in the DOM so a phone reads it in the order above — is put
 * back after the links with `order`. It holds nothing focusable on a desktop
 * (its summary is hidden), so the Tab order there is unchanged too.
 */

import type { ReactNode } from 'react';
import SectionTitle from '../SectionTitle';
import PhoneDisclosure from '../PhoneDisclosure';

/** What the category lookup matched, as it reported it through `onPriceLoad`. */
export interface MarketPriceMatch {
  productName: string;
  matchConfidence?: 'high' | 'medium' | 'low' | 'none' | null;
}

export interface MarketSectionProps {
  /** The category's price lookup, mounted exactly as legacy mounts it. */
  pricing: ReactNode;
  /** The category's marketplace search links. */
  marketplaceLinks: ReactNode;
  /** The PSA/BGS/SGC/CGC panel, or null when there is nothing to draw. */
  proEstimates: ReactNode | null;
  isOwner: boolean;
  /** Phone-only value summary. Omitted: nothing is drawn. */
  valueSummary?: ReactNode;
  /** Phone-only matched-product row. Omitted or null: no row. */
  priceMatch?: MarketPriceMatch | null;
}

const CONFIDENCE_WORDS: Record<string, string> = {
  high: 'High-confidence match',
  medium: 'Medium-confidence match',
  low: 'Low-confidence match',
};

export function MarketSection({
  pricing,
  marketplaceLinks,
  proEstimates,
  isOwner,
  valueSummary,
  priceMatch,
}: MarketSectionProps) {
  const confidence = priceMatch?.matchConfidence
    ? CONFIDENCE_WORDS[priceMatch.matchConfidence]
    : undefined;

  return (
    <div className="cd-section cd-market-section">
      <SectionTitle
        eyebrow="Know what you hold"
        title="Your card in the market."
        phoneTitle="Market value"
        lead="Estimates, not sale guarantees."
      />

      {valueSummary && <div className="cd-phone-only cd-market-value">{valueSummary}</div>}

      {priceMatch?.productName && (
        <p className="cd-phone-only cd-market-match">
          <span className="cd-market-match-label">Matched:</span>{' '}
          <strong>{priceMatch.productName}</strong>
          {confidence && <> · {confidence}</>}
        </p>
      )}

      <PhoneDisclosure summary="Prices by grade" className="cd-market-prices">
        <div id="tour-live-market-pricing">{pricing}</div>
      </PhoneDisclosure>

      <section id="tour-pro-estimates" className="cd-panel cd-market-pro">
        {proEstimates ? (
          <PhoneDisclosure summary="Estimated mail-away grades">
            <h3 className="cd-market-pro-h" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              Estimated mail-away grades
            </h3>
            {proEstimates}
          </PhoneDisclosure>
        ) : (
          <p className="cd-caption" style={{ margin: 0 }}>
            No mail-away grade estimates for this card.
          </p>
        )}
      </section>

      <section id="tour-market-pricing" className="cd-panel cd-market-links">
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
          Find and price this card or similar
        </h3>
        <p className="cd-caption" style={{ marginBottom: 14 }}>
          Search the marketplaces for comparable listings.
        </p>
        <div className="cd-link-grid">{marketplaceLinks}</div>
      </section>

      {isOwner && (
        <div className="dcm-actions cd-market-portfolio">
          <a className="cd-quiet" href="/market-pricing" target="_blank" rel="noopener">
            View full portfolio
          </a>
        </div>
      )}
    </div>
  );
}

export default MarketSection;
