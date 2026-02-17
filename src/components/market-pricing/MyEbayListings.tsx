'use client';

import Image from 'next/image';
import Link from 'next/link';

interface ListingCard {
  name: string;
  category: string;
  grade: number | null;
  imageUrl: string | null;
}

interface Listing {
  id: string;
  card_id: string;
  listing_id: string | null;
  listing_url: string | null;
  title: string;
  price: number;
  currency: string;
  listing_format: string;
  status: string;
  created_at: string;
  published_at: string | null;
  ended_at: string | null;
  sold_at: string | null;
  card: ListingCard | null;
}

interface MyEbayListingsProps {
  listings: Listing[];
  ebayConnected: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-100 text-gray-600',
  sold: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
  error: 'bg-red-100 text-red-700',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyEbayListings({ listings, ebayConnected }: MyEbayListingsProps) {
  if (!ebayConnected) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Connect Your eBay Account</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
          Link your eBay account to list cards directly from DCM and track your listings here.
        </p>
        <Link
          href="/ebay/connect"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Connect eBay
        </Link>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Listings Yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          You haven&apos;t listed any cards on eBay yet. Visit a card&apos;s detail page and use the &quot;List on eBay&quot; button to get started.
        </p>
      </div>
    );
  }

  // Summary stats
  const active = listings.filter(l => l.status === 'active').length;
  const sold = listings.filter(l => l.status === 'sold').length;
  const totalListedValue = listings
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + (l.price || 0), 0);

  return (
    <div>
      {/* Summary row */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <div className="text-lg font-bold text-green-700">{active}</div>
          <div className="text-xs text-green-600">Active</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <div className="text-lg font-bold text-blue-700">{sold}</div>
          <div className="text-xs text-blue-600">Sold</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
          <div className="text-lg font-bold text-purple-700">
            ${totalListedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-purple-600">Active Value</div>
        </div>
      </div>

      {/* Listings table */}
      <div className="divide-y divide-gray-100">
        {listings.map((listing) => (
          <div key={listing.id} className="flex items-center gap-3 py-3">
            {/* Thumbnail */}
            <div className="w-10 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0 relative">
              {listing.card?.imageUrl ? (
                <Image
                  src={listing.card.imageUrl}
                  alt={listing.title}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">?</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{listing.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[listing.status] || STATUS_STYLES.draft}`}>
                  {listing.status}
                </span>
                <span className="text-xs text-gray-400">
                  {listing.listing_format === 'AUCTION' ? 'Auction' : 'Fixed Price'}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(listing.published_at || listing.created_at)}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-gray-900">
                ${listing.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* eBay link */}
            {listing.listing_url && (
              <a
                href={listing.listing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-blue-500 hover:text-blue-700 transition-colors p-1"
                title="View on eBay"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
