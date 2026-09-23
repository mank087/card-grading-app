'use client';

/**
 * The hero's InstaList panel. Owner-only.
 *
 * It promotes the EXISTING listing workflow; it does not publish anything.
 * `EbayListingButton` already owns both halves of the pre-listing flow — it
 * checks `/api/ebay/status` and either redirects to
 * `/ebay/connect?redirect=<current path>` or opens `EbayListingModal` — so
 * this panel mounts that button rather than re-deriving either behaviour.
 *
 * The listing state itself comes from `useInstaListStatus`, which the shell
 * owns and also hands to the mobile action bar, so one tap down there does
 * exactly what this panel would do. Every state is named: see that file.
 *
 * ON "UNABLE TO VERIFY": the create flow is still offered, because
 * `EbayListingModal` re-runs the very same `/api/ebay/listing/check` when it
 * opens (EbayListingModal.tsx:627-671) and blocks a duplicate itself. A failed
 * check here therefore costs the reader a warning, not the action.
 *
 * There is NO draft state. `ebay_listings.status` is active|sold|ended and
 * `draft` exists only for bulk batches (plan gap G4), so the mockup's
 * "resume draft" affordance is not built.
 */

import { EbayListingButton } from '@/components/ebay/EbayListingButton';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { InstaListStatus } from './useInstaListStatus';
import type { InitialListingDraft } from '@/lib/ebay/listingSeed';
import { listingImageKey } from '@/lib/cardDetail/listingImageKey';
import { readCachedListingImages } from './sections/InstaListImages';

type EbayCardType = 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';

export interface InstaListPanelProps {
  card: any;
  cardType: EbayCardType;
  isOwner: boolean;
  showFounderEmblem: boolean;
  labelStyle: string;
  customLabelConfig: CustomLabelConfig | null;
  /** Owned by the shell so the mobile bar shares it. */
  status: InstaListStatus;
  /** Bumped by the mobile bar to open the existing flow from outside. */
  openSignal?: number;
  /** So the shell can hide the mobile bar behind the listing modal. */
  onModalOpenChange?: (open: boolean) => void;
  /**
   * The fields the owner edited in the InstaList TAB, carried into the modal
   * this panel mounts. Only edited fields are present, so an untouched draft
   * leaves the modal's own seeding exactly as it was.
   */
  initialDraft?: InitialListingDraft | null;
  /** Reports the eBay connection so the tab can label its own button. */
  onConnectionChange?: (connected: boolean) => void;
}

export function InstaListPanel({
  card,
  cardType,
  isOwner,
  showFounderEmblem,
  labelStyle,
  customLabelConfig,
  status,
  openSignal,
  onModalOpenChange,
  initialDraft,
  onConnectionChange,
}: InstaListPanelProps) {
  if (!isOwner) return null;

  const { state, listing, refresh } = status;

  const listingFlow = (
    <EbayListingButton
      card={card}
      cardType={cardType}
      showFounderEmblem={showFounderEmblem}
      labelStyle={labelStyle}
      customLabelConfig={customLabelConfig}
      openSignal={openSignal}
      onListed={refresh}
      onModalOpenChange={onModalOpenChange}
      initialDraft={initialDraft}
      onConnectionChange={onConnectionChange}
      // The InstaList tab renders the same five images with the same inputs;
      // reuse them so the modal's photos appear at once instead of re-rendering.
      getPreparedImages={() =>
        readCachedListingImages(
          listingImageKey({ cardId: card?.id, cardType, labelStyle, customLabelConfig, showFounderEmblem }),
        )
      }
      // O2: it opens a review flow; publishing is a separate step inside it.
      label="Prepare eBay listing"
    />
  );

  return (
    <section id="tour-insta-list" className="cd-panel cd-instalist" aria-labelledby="cd-instalist-heading">
      <p className="cd-eyebrow" id="cd-instalist-heading">
        Ready for its next collector?
      </p>
      <h2>Meet InstaList.</h2>
      <p>Your card details, photos and grading report — already prepared.</p>

      {/* One announcement for every state change, so a reader who is not
          watching this corner of the page still learns what happened. */}
      <div className="cd-instalist-actions" role="status" aria-live="polite">
        {state === 'sold' && (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>
            This card is marked as sold. Listing actions are closed for sold records.
          </p>
        )}

        {state === 'checking' && (
          <p style={{ margin: 0, fontSize: 14 }}>Checking whether this card is already listed…</p>
        )}

        {/* The SAME `listing.listing_url` the InstaList tab links to — one
            state object, read twice, so the two can never point apart. */}
        {state === 'listed' && (
          <>
            {listing?.listing_url ? (
              <a
                className="dcm-button dcm-button--primary"
                href={listing.listing_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View listing on eBay
              </a>
            ) : (
              <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>
                This card is listed on eBay.
              </p>
            )}
            <span style={{ fontSize: 12, color: 'var(--dcm-on-dark-muted, #aab7cc)' }}>
              Already listed on eBay
            </span>
          </>
        )}

        {state === 'unlisted' && listingFlow}

        {state === 'unverified' && (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              We couldn&rsquo;t check whether this card is already listed. You can still open the
              listing flow &mdash; it checks again before it lets you publish.
            </p>
            <button type="button" className="cd-quiet" onClick={refresh}>
              Check again
            </button>
            {listingFlow}
          </>
        )}
      </div>
    </section>
  );
}

export default InstaListPanel;
