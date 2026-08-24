/**
 * Client-side org branding: resolves the store branding for a card (or the
 * signed-in user) and converts logos to data URLs — the currency every label,
 * report, and image generator already consumes. Falls back to DCM assets when
 * the card has no org.
 */

import {
  loadLogoAsBase64,
  loadWhiteLogoAsBase64,
  loadBlackLogoAsBase64,
} from '@/lib/foldableLabelGenerator';
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign';

export interface OrgBrandingClient {
  orgId: string;
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  logoBlackUrl: string | null;
  /** Brand Setup label-mark settings. */
  logoVariant?: 'color' | 'black' | 'white';
  logoScale?: number;
  /** Label Designer document (enterprise only); absent on older payloads. */
  design?: OrgLabelDesign | null;
}

/**
 * The URL a card's QR codes should encode: org-graded cards point at the
 * org's branded card page; everything else keeps the DCM verify page.
 */
export function cardQrUrl(
  cardId: string,
  serial: string | null | undefined,
  branding: { slug: string } | null | undefined,
  fallback?: string
): string {
  if (branding?.slug) return `https://dcmgrading.com/enterprise/${branding.slug}/card/${cardId}`;
  if (serial) return `https://dcmgrading.com/verify/${serial}`;
  return fallback || `https://dcmgrading.com/card/${cardId}`;
}

export interface OrgLogoSet {
  /** Full-color logo data URL (org logo, or DCM color logo). */
  color: string;
  /** White-ink variant for dark labels. */
  white: string;
  /** Black-ink variant for light/Heritage labels. */
  black: string;
  /**
   * The variant the store chose for its label mark, already a data URL —
   * use this wherever a single org mark is drawn, so Brand Setup drives it.
   * Falls back to the color logo (and to DCM when there is no org).
   */
  mark: string;
  /** Mark size multiplier from Brand Setup; 1 for DCM and unset orgs. */
  logoScale: number;
  /**
   * The store's Label Designer document, or null for DCM. Pass it to every
   * heritage renderer alongside the logos; consumers always get null.
   */
  design: OrgLabelDesign | null;
  /** Present when the logos are a store's, not DCM's. */
  branding: OrgBrandingClient | null;
}

const brandingCache = new Map<string, OrgBrandingClient | null>();

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Branding of the org that graded a card, or null. Cached per session. */
export async function fetchBrandingForCard(cardId: string): Promise<OrgBrandingClient | null> {
  if (!cardId) return null;
  if (brandingCache.has(cardId)) return brandingCache.get(cardId) ?? null;
  try {
    const res = await fetch(`/api/org/branding?cardId=${encodeURIComponent(cardId)}`);
    if (!res.ok) {
      brandingCache.set(cardId, null);
      return null;
    }
    const data = await res.json();
    const branding = (data?.branding as OrgBrandingClient | null) ?? null;
    brandingCache.set(cardId, branding);
    return branding;
  } catch {
    brandingCache.set(cardId, null);
    return null;
  }
}

/**
 * The three logo data URLs for a card's label/report surfaces: the store's
 * uploaded logo + derived variants when the card is org-graded, DCM's
 * otherwise. Any org asset that fails to load falls back to its DCM
 * counterpart so a surface never renders logo-less.
 */
export async function loadLogosForCard(cardId?: string | null): Promise<OrgLogoSet> {
  const branding = cardId ? await fetchBrandingForCard(cardId) : null;

  const [dcmColor, dcmWhite, dcmBlack] = await Promise.all([
    loadLogoAsBase64(),
    loadWhiteLogoAsBase64(),
    loadBlackLogoAsBase64(),
  ]);

  if (!branding) {
    return { color: dcmColor, white: dcmWhite, black: dcmBlack, mark: dcmColor, logoScale: 1, design: null, branding: null };
  }

  const [orgColor, orgWhite, orgBlack] = await Promise.all([
    branding.logoUrl ? urlToDataUrl(branding.logoUrl) : Promise.resolve(null),
    branding.logoWhiteUrl ? urlToDataUrl(branding.logoWhiteUrl) : Promise.resolve(null),
    branding.logoBlackUrl ? urlToDataUrl(branding.logoBlackUrl) : Promise.resolve(null),
  ]);

  const color = orgColor ?? dcmColor;
  const variant = branding.logoVariant || 'color';
  const mark = (variant === 'white' ? orgWhite : variant === 'black' ? orgBlack : orgColor) ?? color;
  return {
    color,
    white: orgWhite ?? dcmWhite,
    black: orgBlack ?? dcmBlack,
    mark,
    logoScale: branding.logoScale && branding.logoScale > 0 ? branding.logoScale : 1,
    design: branding.design ?? null,
    branding,
  };
}
