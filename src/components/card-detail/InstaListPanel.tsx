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
 * STATE COMES FROM `GET /api/ebay/listing/check?cardId=` (Bearer token).
 * Its shape (src/app/api/ebay/listing/check/route.ts):
 *
 *   { hasListing: true,  listing: { id, listing_id, listing_url, status,
 *                                   created_at }, verified: true, ebayStatus }
 *   { hasListing: false, listing: null }                       // nothing on file
 *   { hasListing: false, listing: null, previousListing: {...},
 *     verified?: false, message?: string }                     // ended/sold, or
 *                                                              // eBay unreachable
 *
 * Panel state ← response:
 *   sold card (permissions.isSold)      → sold state, no create action.
 *                                         Checked before the network call.
 *   hasListing === true                 → "View listing" → listing.listing_url
 *   hasListing === false                → the create/connect button
 *   request failed / 401 / no session   → the create/connect button
 *
 * There is NO draft state. `ebay_listings.status` is active|sold|ended and
 * `draft` exists only for bulk batches (plan gap G4), so the mockup's
 * "resume draft" affordance is not built. And the page never blocks on eBay:
 * every failure path lands on the plain create button.
 */

import { useEffect, useState } from 'react';
import { EbayListingButton } from '@/components/ebay/EbayListingButton';
import { getStoredSession } from '@/lib/directAuth';
import type { CustomLabelConfig } from '@/lib/labelPresets';

type EbayCardType = 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'onepiece' | 'yugioh' | 'starwars' | 'other';

export interface InstaListPanelProps {
  card: any;
  cardId: string;
  cardType: EbayCardType;
  isOwner: boolean;
  isSold: boolean;
  showFounderEmblem: boolean;
  labelStyle: string;
  customLabelConfig: CustomLabelConfig | null;
}

interface ActiveListing {
  listing_url?: string | null;
  listing_id?: string | null;
  status?: string | null;
}

export function InstaListPanel({
  card,
  cardId,
  cardType,
  isOwner,
  isSold,
  showFounderEmblem,
  labelStyle,
  customLabelConfig,
}: InstaListPanelProps) {
  const [activeListing, setActiveListing] = useState<ActiveListing | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isOwner || isSold) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    const session = getStoredSession();
    if (!session?.access_token) {
      setChecked(true);
      return;
    }

    fetch(`/api/ebay/listing/check?cardId=${encodeURIComponent(cardId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        // Anything other than a verified active listing falls through to the
        // create button. A failed check must never hide the action.
        if (data?.hasListing && data.listing) setActiveListing(data.listing as ActiveListing);
      })
      .catch(() => {
        /* Never block the page on eBay. */
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, isOwner, isSold]);

  if (!isOwner) return null;

  return (
    <section id="tour-insta-list" className="cd-panel cd-instalist" aria-labelledby="cd-instalist-heading">
      <p className="cd-eyebrow" id="cd-instalist-heading">
        Ready for its next collector?
      </p>
      <h2>Meet InstaList.</h2>
      <p>Your card details, photos and grading report — already prepared.</p>

      <div className="cd-instalist-actions">
        {isSold ? (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>
            This card is marked as sold. Listing actions are closed for sold records.
          </p>
        ) : activeListing?.listing_url ? (
          <>
            <a
              className="dcm-button dcm-button--primary"
              href={activeListing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View listing
            </a>
            <span style={{ fontSize: 12, color: 'var(--dcm-on-dark-muted, #aab7cc)' }}>
              Already listed on eBay
            </span>
          </>
        ) : (
          // Renders "Connect eBay to List" or "List on eBay" from the live
          // connection status, and opens the existing editor — never publishes.
          <EbayListingButton
            card={card}
            cardType={cardType}
            showFounderEmblem={showFounderEmblem}
            labelStyle={labelStyle}
            customLabelConfig={customLabelConfig}
          />
        )}
        {!checked && !isSold && (
          <span className="cd-sr-only" role="status">
            Checking your eBay listing status
          </span>
        )}
      </div>
    </section>
  );
}

export default InstaListPanel;
