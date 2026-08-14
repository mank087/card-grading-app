'use client';

import { useEffect, useState } from 'react';

export interface OrgBranding {
  orgId: string;
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  logoBlackUrl: string | null;
}

// Module-level cache so the 8 card detail pages don't refetch per mount.
// null = fetched, card has no org branding.
const brandingCache = new Map<string, OrgBranding | null>();

export function OrgBrandingBadge({ cardId, className }: { cardId: string; className?: string }) {
  const [branding, setBranding] = useState<OrgBranding | null>(() => brandingCache.get(cardId) ?? null);

  useEffect(() => {
    if (brandingCache.has(cardId)) {
      setBranding(brandingCache.get(cardId) ?? null);
      return;
    }
    let cancelled = false;
    fetch(`/api/org/branding?cardId=${encodeURIComponent(cardId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const result: OrgBranding | null = data?.branding ?? null;
        brandingCache.set(cardId, result);
        if (!cancelled) setBranding(result);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cardId]);

  if (!branding) return null;

  return (
    <div
      className={`flex items-center gap-3 bg-white/50 rounded-lg border border-gray-200 border-l-4 px-4 py-2 shadow-sm ${className ?? ''}`}
      style={{ borderLeftColor: branding.brandColor }}
    >
      {branding.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branding.logoUrl} alt={`${branding.name} logo`} className="h-8 w-auto object-contain" />
      )}
      <div>
        <p className="font-semibold text-gray-900 leading-tight">Graded for {branding.name}</p>
        <p className="text-xs text-gray-500">Powered by DCM Optic™</p>
      </div>
    </div>
  );
}

export default OrgBrandingBadge;
