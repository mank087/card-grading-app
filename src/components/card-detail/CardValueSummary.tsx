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
 *    through `assessValueTrust` exactly as the legacy page does (pokemon
 *    CardDetailClient.tsx 3498-3520) and passes the trusted number down as
 *    `liveEstimate`. Only a TRUSTED estimate replaces the stored number.
 *
 * WHAT IS DELIBERATELY ABSENT: sparkline, % change, purchase price and
 * gain/loss. `card_price_history` is written but read by no UI, and there is
 * no purchase-price column anywhere in the schema (plan gaps G7/G8). The
 * mockup shows all four; they are cut, not forgotten.
 *
 * FRESHNESS: printed only when `updatedAt` is non-null. A null timestamp means
 * unknown, which is not the same as stale — so it prints nothing at all. The
 * portfolio review (Sept 2026) found ~21k rows whose eBay-fallback path never
 * stamps `dcm_price_updated_at`; calling those "stale" would be a lie.
 */

import type { CardDetailValue } from '@/lib/cardDetail/viewModel';
import type { PriceSource } from '@/lib/pricing/resolveCardValue';
import { ConfirmCardDetailsCalloutButton } from '@/components/cards/IdentityReview';

export interface CardValueSummaryProps {
  value: CardDetailValue;
  /**
   * A fresh estimate the adapter has already put through `assessValueTrust`
   * and found trustworthy. Null until the pricing component reports one.
   */
  liveEstimate: number | null;
  isOwner: boolean;
  /** Activate the Market & portfolio section. */
  onJumpToMarket: () => void;
}

const SOURCE_LABEL: Record<PriceSource, string> = {
  'dcm-estimate': 'DCM estimate',
  'dcm-cached': 'DCM estimate (cached)',
  'scryfall-foil': 'Scryfall (foil)',
  scryfall: 'Scryfall',
  'ebay-median': 'eBay sold median',
  withheld: 'Withheld',
  none: 'No source',
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "Updated 2 hours ago". Returns null for anything unparseable. */
function formatFreshness(iso: string): string | null {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 0) return null;
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
}

export function CardValueSummary({
  value,
  liveEstimate,
  isOwner,
  onJumpToMarket,
}: CardValueSummaryProps) {
  // A trusted live estimate wins over the stored number; everything else
  // falls back to what resolveCardValue produced.
  const shownAmount = liveEstimate ?? value.amount;
  const shownSource: string =
    liveEstimate !== null ? 'DCM estimate (live lookup)' : SOURCE_LABEL[value.source];
  const freshness = value.updatedAt ? formatFreshness(value.updatedAt) : null;

  // Withheld and no live estimate to replace it: the owner gets the same
  // correction callout the legacy page shows; the public sees nothing at all.
  if (value.status === 'withheld' && liveEstimate === null) {
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

      {shownAmount !== null ? (
        <p className="cd-price">{formatMoney(shownAmount)}</p>
      ) : (
        // Never $0. "Unavailable" is the honest word for no usable price.
        <p className="cd-price cd-price--unavailable">Unavailable</p>
      )}

      <div className="cd-value-footer">
        <span>
          {shownAmount !== null ? shownSource : 'No price source for this card yet'}
          {freshness ? ` · ${freshness}` : ''}
        </span>
        <button type="button" className="dcm-button dcm-button--text" onClick={onJumpToMarket}>
          Pricing &amp; portfolio
        </button>
      </div>
      <p className="cd-caption" style={{ marginTop: 8 }}>
        <a href="/market-pricing">Open your portfolio</a> to see this card beside the rest of
        your collection. Estimates are not sale guarantees.
      </p>
    </section>
  );
}

export default CardValueSummary;
