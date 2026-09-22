'use client';

/**
 * The InstaList tab — the pre-listing workbench. Owner-only.
 *
 * WHAT IT IS. Everything the eBay listing will carry, shown before the listing
 * flow is opened and editable here: the five photos, the title, the description
 * as it renders on eBay, the item specifics and the asking price. Then one
 * button that opens the EXISTING flow with those edits.
 *
 * WHAT IT IS NOT. It publishes nothing. It uploads nothing. The only requests
 * this tab is responsible for are the shared listing check (one per page view,
 * owned by the shell) and the account's saved listing defaults, fetched once
 * when the tab is first opened. `uploadListingImages` is deliberately not
 * imported anywhere in this tree.
 *
 * EDITS ARE SESSION-ONLY — no column, no migration, no localStorage — and only
 * the fields the owner actually CHANGED are carried into the modal, so an
 * untouched tab leaves the modal seeding byte-for-byte as it did before this
 * tab existed. See ../useListingDraft and lib/ebay/listingDraftState.ts.
 *
 * STATE comes from the one `useInstaListStatus` instance the shell owns and the
 * hero panel and the mobile bar already share, so the three cannot disagree and
 * there is exactly one `/api/ebay/listing/check` per page view.
 */

import InstaListImages from './InstaListImages';
import InstaListFields from './InstaListFields';
import { listingLockFor } from '@/lib/ebay/listingDraftState';
import type { InstaListStatus } from '../useInstaListStatus';
import type { CardDetailInstaList } from '../useCardDetailInstaList';
import type { CustomLabelConfig } from '@/lib/labelPresets';

export interface InstaListSectionProps {
  card: any;
  cardType: string;
  labelStyle: string;
  customLabelConfig: CustomLabelConfig | null;
  showFounderEmblem: boolean;
  /**
   * The page's ONE listing bundle: the shared status the hero panel and the
   * mobile bar read, the session-only draft, the open signal, and whether eBay
   * is connected.
   *
   * NOT-CONNECTED is not handled here. `beginListing` bumps
   * `EbayListingButton`'s `openSignal`, and that component's own `handleClick`
   * hops to `/ebay/connect?redirect=<current path>` when disconnected — the
   * redirect exists once, there. `ebayConnected` only decides what this
   * button SAYS.
   */
  insta: CardDetailInstaList;
}

function statusLine(state: InstaListStatus['state']): string {
  switch (state) {
    case 'checking':
      return 'Checking whether this card is already listed on eBay…';
    case 'listed':
      return 'This card is live on eBay.';
    case 'unlisted':
      return 'Not listed yet. Everything below is ready to go.';
    case 'unverified':
      return 'We couldn’t check whether this card is already listed. You can still open the listing flow — it checks again before it lets you publish.';
    case 'sold':
      return 'This card is marked as sold. Listing actions are closed for sold records.';
    default:
      return '';
  }
}

export function InstaListSection({
  card,
  cardType,
  labelStyle,
  customLabelConfig,
  showFounderEmblem,
  insta,
}: InstaListSectionProps) {
  const { status, draft, ebayConnected, beginListing: onBeginListing } = insta;
  const lock = listingLockFor(status.state);
  const listingUrl = status.listing?.listing_url ?? null;

  const beginLabel =
    ebayConnected === false ? 'Connect eBay to continue' : 'Begin listing on eBay';

  return (
    <div className="cd-section cd-instalist-section" id="instalist-panel">
      <div className="cd-section-title">
        <p className="cd-eyebrow">Ready for its next collector?</p>
        <h2>Your listing, before you list it.</h2>
        <p>
          The photos, the title, the description and the specifics that will go to eBay. Edit
          anything here and it carries into the listing flow. Edits last for this visit only.
        </p>
      </div>

      {/* ── status ────────────────────────────────────────────────────── */}
      <section className="cd-panel cd-instalist-status" aria-labelledby="cd-il-status-h">
        <p className="cd-eyebrow" id="cd-il-status-h">
          Listing status
        </p>
        <div role="status" aria-live="polite" className="cd-instalist-status-body">
          <p className="cd-instalist-status-line">{statusLine(status.state)}</p>
          {status.state === 'listed' && listingUrl && (
            <a
              className="dcm-button dcm-button--primary"
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View live listing on eBay
            </a>
          )}
          {status.state === 'listed' && !listingUrl && (
            <p className="cd-caption">eBay did not return a link for this listing.</p>
          )}
          {status.state === 'unverified' && (
            <button type="button" className="cd-quiet" onClick={status.refresh}>
              Check again
            </button>
          )}
        </div>
      </section>

      {lock.note && (
        <p className="cd-caption cd-instalist-lock-note" role="note">
          {lock.note}
        </p>
      )}

      <InstaListImages
        card={card}
        cardType={cardType}
        labelStyle={labelStyle}
        customLabelConfig={customLabelConfig}
        showFounderEmblem={showFounderEmblem}
      />

      <InstaListFields draft={draft} locked={lock.locked} />

      {/* ── begin ─────────────────────────────────────────────────────── */}
      <div className="dcm-actions cd-instalist-begin">
        {lock.locked ? (
          listingUrl ? (
            <a
              className="dcm-button dcm-button--primary"
              href={listingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View live listing on eBay
            </a>
          ) : null
        ) : (
          <button
            type="button"
            className="dcm-button dcm-button--primary"
            disabled={!lock.canBegin}
            onClick={onBeginListing}
          >
            {status.state === 'checking' ? 'Checking listing…' : beginLabel}
          </button>
        )}
        {draft.anyDirty && !lock.locked && (
          <span className="cd-caption">Your edits will be carried in.</span>
        )}
      </div>
    </div>
  );
}

export default InstaListSection;
