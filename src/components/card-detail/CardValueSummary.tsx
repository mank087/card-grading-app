'use client';

/**
 * The hero's value panel.
 *
 * WHICH NUMBER THIS SHOWS (decision recorded in the Phase 1 brief):
 *
 *  - On first render it shows the view model's `value`, which comes from
 *    `resolveCardValue` on the stored row. That is the same resolver the
 *    portfolio uses, so the hero and the portfolio cannot disagree while the
 *    page is loading its live lookup.
 *  - When the category pricing component (mounted in the Market section)
 *    reports a fresh estimate through `onPriceLoad`, the adapter runs it
 *    through `assessValueTrust` exactly as the legacy page does and passes the
 *    trusted number down. Only a TRUSTED estimate replaces the stored number.
 *
 * FRESHNESS BELONGS TO THE NUMBER SHOWN (review finding 5). Amount, source and
 * freshness are now one object from one tested function — `buildValuation` —
 * so the panel can no longer print a live amount beside the stored row's
 * timestamp. A null freshness means UNKNOWN and prints nothing; a cached live
 * result says it is cached; a completed fetch never restamps a cached price.
 *
 * WHAT IS DELIBERATELY ABSENT: sparkline, % change, purchase price and
 * gain/loss. `card_price_history` is written but read by no UI, and there is
 * no purchase-price column anywhere in the schema (plan gaps G7/G8).
 */

import type { CardDetailValue } from '@/lib/cardDetail/viewModel';
import type { MarketRange } from '@/lib/pricing/marketRange';
import { buildValuation, type LiveValuationInput } from '@/lib/cardDetail/valuation';
import { ConfirmCardDetailsCalloutButton } from '@/components/cards/IdentityReview';

export interface CardValueSummaryProps {
  value: CardDetailValue;
  /**
   * The live lookup's result — the trusted amount AND the freshness that
   * belongs to it. Null until the pricing component reports one.
   */
  live: LiveValuationInput | null;
  /**
   * Low / median / high from the live price match — the same three numbers the
   * Market Value panel prints, now carrying the tier each end came from.
   */
  marketRange?: MarketRange | null;
  isOwner: boolean;
  /** Activate the Market & portfolio section. */
  onJumpToMarket: () => void;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Low / median / high at a glance, with a marker for where the DCM estimate
 * sits. The track is positioned on a log scale: the range runs from a raw copy
 * to the top graded tier, often 50x apart, and on a linear track every
 * ordinary card would be pinned against the left edge.
 *
 * WHAT THESE NUMBERS ARE (review finding 2): they pool a raw copy with every
 * graded tier the match returned, so the ends are NAMED — "Low · Raw",
 * "High · PSA 10" — the middle says it is a median across tiers, and a caption
 * says the group is not a sale range for this card. It is not a confidence
 * interval and is never described as one.
 */
function MarketRangeStrip({
  range,
  estimate,
}: {
  range: MarketRange;
  estimate: number;
}) {
  const position = (amount: number) => {
    const clamped = Math.min(Math.max(amount, range.low), range.high);
    const span = Math.log(range.high) - Math.log(range.low);
    return span > 0 ? ((Math.log(clamped) - Math.log(range.low)) / span) * 100 : 50;
  };
  const where = position(estimate);
  const lowName = range.lowLabel ?? 'lowest tier';
  const highName = range.highLabel ?? 'highest tier';

  return (
    <div className="cd-range">
      <div
        className="cd-range-track"
        role="img"
        aria-label={
          `Across raw and graded conditions for this card: lowest ${formatMoney(range.low)} (${lowName}), ` +
          `median of all tiers ${formatMoney(range.median)}, highest ${formatMoney(range.high)} (${highName}). ` +
          `The DCM estimate for this card's condition is ${formatMoney(estimate)}.`
        }
      >
        <span className="cd-range-median" style={{ left: `${position(range.median)}%` }} aria-hidden="true" />
        <span className="cd-range-marker" style={{ left: `${where}%` }} aria-hidden="true" />
      </div>
      <dl className="cd-range-legend" aria-hidden="true">
        <div>
          <dt>Low · {lowName}</dt>
          <dd>{formatMoney(range.low)}</dd>
        </div>
        <div>
          <dt>Median of all tiers</dt>
          <dd>{formatMoney(range.median)}</dd>
        </div>
        <div>
          <dt>High · {highName}</dt>
          <dd>{formatMoney(range.high)}</dd>
        </div>
      </dl>
      <p className="cd-caption" aria-hidden="true">
        Across raw and graded conditions — not a sale range for this card.
      </p>
    </div>
  );
}

export function CardValueSummary({
  value,
  live,
  marketRange = null,
  isOwner,
  onJumpToMarket,
}: CardValueSummaryProps) {
  const valuation = buildValuation(
    { status: value.status, amount: value.amount, source: value.source, updatedAt: value.updatedAt },
    live,
  );

  // Withheld and no live estimate to replace it: the owner gets the same
  // correction callout the legacy page shows; the public sees nothing at all.
  if (valuation.isWithheld) {
    if (!isOwner) return null;
    return (
      <section id="tour-market-value" className="cd-panel cd-value-panel" aria-labelledby="cd-value-heading">
        <p className="cd-eyebrow" id="cd-value-heading">
          Estimated market value
        </p>
        <p style={{ fontSize: 15, fontWeight: 650 }}>Confirm your card details to see a value</p>
        <p className="cd-caption" style={{ marginTop: 6 }}>
          This card has no set or year on file, so the matched listing may be a different
          printing. Add the set and year with Edit Card Details and the value will appear here.
        </p>
        <ConfirmCardDetailsCalloutButton />
      </section>
    );
  }

  return (
    <section id="tour-market-value" className="cd-panel cd-value-panel" aria-labelledby="cd-value-heading">
      <div className="cd-panel-heading">
        <p className="cd-eyebrow" id="cd-value-heading">
          Estimated market value
        </p>
      </div>

      {valuation.amount !== null ? (
        <p className="cd-price">{formatMoney(valuation.amount)}</p>
      ) : (
        // Never $0. "Unavailable" is the honest word for no usable price.
        <p className="cd-price cd-price--unavailable">Unavailable</p>
      )}

      {valuation.amount !== null && marketRange && marketRange.high > marketRange.low && (
        <MarketRangeStrip range={marketRange} estimate={valuation.amount} />
      )}

      <div className="cd-value-footer">
        <span>
          {valuation.sourceLabel}
          {valuation.freshnessLabel ? ` · ${valuation.freshnessLabel}` : ''}
        </span>
        <button type="button" className="dcm-button dcm-button--text" onClick={onJumpToMarket}>
          Pricing &amp; portfolio
        </button>
      </div>
      <p className="cd-caption" style={{ marginTop: 8 }}>
        {isOwner ? (
          <>
            <a href="/market-pricing">Open your portfolio</a> to see this card beside the rest of
            your collection. Estimates are not sale guarantees.
          </>
        ) : (
          'Estimates are not sale guarantees.'
        )}
      </p>
    </section>
  );
}

export default CardValueSummary;
