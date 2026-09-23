'use client';

/**
 * The InstaList tab — the pre-listing workbench. Owner-only.
 *
 * WHAT IT IS. Everything the eBay listing will carry, shown before the listing
 * flow is opened and editable here: the five photos, the title, the description
 * as it renders on eBay, the item specifics and the asking price, and one
 * button that opens the EXISTING flow with those edits.
 *
 * ORDER (Phase 2, O1): status, photos, title, price, the Continue button — and
 * only then Description and Item specifics, each collapsed. The price and the
 * next step used to sit below every item specific.
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

import type { ReactNode } from 'react';
import InstaListImages from './InstaListImages';
import SectionTitle from '../SectionTitle';
import InstaListFields, { InstaListMoreFields } from './InstaListFields';
import { CONNECT_TO_EDIT_NOTE, listingEditGate } from '@/lib/ebay/listingDraftState';
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
   * NOT-CONNECTED: the redirect itself still exists exactly once, in
   * `EbayListingButton.handleClick` — `beginListing` bumps its `openSignal`
   * and that component hops to `/ebay/connect?redirect=<here, fragment and
   * all>`. What this file adds is the ORDER (review 2026-09-22, finding 2):
   * with no connection the connect step comes first and the fields are
   * read-only, because that redirect is a full-page navigation and the draft
   * is React state — anything typed before it would be silently discarded.
   */
  insta: CardDetailInstaList;
  /** Identity notice, when the card's details need checking before listing. */
  notice?: ReactNode;
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
  notice,
}: InstaListSectionProps) {
  const { status, draft, ebayConnected, beginListing: onBeginListing } = insta;
  // Locked/sold FIRST, then the connection. A disconnected owner gets the
  // fields read-only, because pressing the button sends the whole page to
  // /ebay/connect and the draft is React state — see `listingEditGate`.
  const lock = listingEditGate(status.state, ebayConnected);
  const listingUrl = status.listing?.listing_url ?? null;

  const beginLabel =
    ebayConnected === false ? 'Connect eBay to continue' : 'Continue to eBay';

  /** The connect step, shown FIRST when there is no connection yet. */
  const connectStep = lock.needsConnect ? (
    <section className="cd-panel cd-instalist-connect" aria-labelledby="cd-il-connect-h">
      <p className="cd-eyebrow">First, the connection</p>
      <h3 id="cd-il-connect-h" className="cd-instalist-h3">
        Connect your eBay account.
      </h3>
      <p className="cd-caption">
        {CONNECT_TO_EDIT_NOTE} Connecting opens eBay in this tab and brings you straight back
        here. Everything below is already prepared — you can look at all of it first.
      </p>
      <div className="dcm-actions" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="dcm-button dcm-button--primary"
          disabled={!lock.canBegin}
          onClick={onBeginListing}
        >
          Connect eBay
        </button>
      </div>
    </section>
  ) : null;

  return (
    <div className="cd-section cd-instalist-section" id="instalist-panel">
      {/* On a phone the lead goes (one heading per section), but its last
          sentence is the one-line edit note O1 keeps, so that stays. */}
      <SectionTitle
        eyebrow="Ready for its next collector?"
        title="Your listing, before you list it."
        phoneTitle="InstaList"
        lead={
          <>
            The photos, the title, the description and the specifics that will go to eBay.
            {lock.needsConnect
              ? ' Connect eBay to edit any of it — editing is unlocked once connected.'
              : ' Edit anything here and it carries into the listing flow. Edits last for this visit only.'}
          </>
        }
        phoneNote={
          lock.needsConnect
            ? 'Connect eBay to edit any of it — editing is unlocked once connected.'
            : 'Edits last for this visit only.'
        }
      />

      {notice}

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

      {connectStep}

      <InstaListImages
        card={card}
        cardType={cardType}
        labelStyle={labelStyle}
        customLabelConfig={customLabelConfig}
        showFounderEmblem={showFounderEmblem}
      />

      <InstaListFields
        draft={draft}
        locked={lock.locked}
        readOnlyNote={lock.needsConnect ? CONNECT_TO_EDIT_NOTE : null}
      />

      {/* ── begin ─────────────────────────────────────────────────────── */}
      <div className="dcm-actions cd-instalist-begin">
        {lock.locked && !lock.needsConnect ? (
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

      {/* The long part of the listing, collapsed and AFTER the next step (O1).
          Display only: the values are the shell's draft either way. */}
      <InstaListMoreFields draft={draft} locked={lock.locked} />
    </div>
  );
}

export default InstaListSection;
