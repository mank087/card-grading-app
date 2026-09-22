'use client';

/**
 * The one network call behind a listing seed: the account's saved listing
 * defaults, plus the org branding an enterprise card's description banner
 * needs.
 *
 * Split out of ./listingSeed so the fold itself stays a pure, node-testable
 * module — this file reaches for the stored session and the browser `fetch`,
 * and `EbayListingModal` already made exactly these two requests side by side
 * in its open effect.
 */

import { getStoredSession } from '@/lib/directAuth';
import { loadLogosForCard } from '@/lib/orgBranding';
import type { ListingBranding } from '@/lib/ebay/listingDescription';
import type { ListingDefaultsPayload } from '@/lib/ebay/listingDraft';

export interface ListingSeedContext {
  branding: ListingBranding | null;
  defaults: ListingDefaultsPayload | null;
  /** The token both callers keep for their own later requests. */
  sessionToken: string | null;
}

/**
 * Fetch both halves in parallel. Never throws: a failure on either side
 * resolves to null and the caller keeps the built-in DCM defaults, which is
 * what the modal has always done (`.catch(() => null)` on both).
 */
export async function fetchListingSeedContext(card: any): Promise<ListingSeedContext> {
  const session = getStoredSession();
  const token = session?.access_token ?? null;

  const [logos, defaultsRes] = await Promise.all([
    card?.org_id ? loadLogosForCard(card.id).catch(() => null) : Promise.resolve(null),
    token
      ? fetch('/api/ebay/listing-defaults', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const branding: ListingBranding | null = logos?.branding
    ? { name: logos.branding.name, brandColor: logos.branding.brandColor || null }
    : null;

  return { branding, defaults: (defaultsRes as ListingDefaultsPayload | null) ?? null, sessionToken: token };
}
