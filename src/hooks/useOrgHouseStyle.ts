'use client';

/**
 * Org house label style for org-graded cards.
 *
 * Enterprise members see their brand's locked label design (set in Brand
 * Setup) on org-graded cards, regardless of their personal Label Studio
 * style. Band colors come from the org's choice: custom colors, the brand
 * palette, or the card's own colors (color_source 'card' leaves
 * heritageBandColors unset so existing call sites fall back to
 * resolveHeritageBandColors(card.card_colors), exactly like the consumer
 * 'card' source).
 *
 * useCustomLabelStyleWithOrg is a drop-in replacement for
 * useCustomLabelStyle on card surfaces: pass the card's org_id and the
 * return value is overridden with the house style when it applies; consumer
 * cards and non-members get the personal hook result untouched.
 *
 * The house style only applies when the card's org matches the MEMBER'S org
 * — a member viewing a card graded under some other store keeps the personal
 * style. The membership context doesn't carry the org id, so the hook
 * resolves it once per session from /api/org/branding (module-cached). The
 * collection page's 'org' scope sentinel skips the id check by design: that
 * surface already filters to the member's own org cards.
 */

import { useEffect, useState } from 'react';
import { useCustomLabelStyle } from '@/hooks/useCustomLabelStyle';
import { useOrgContext } from '@/contexts/OrgContext';
import { getStoredSession } from '@/lib/directAuth';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import { extractColorOverrides } from '@/lib/labelPresets';

const FALLBACK_BAND = ['#7C3AED', '#4C1D95'];

// undefined = not fetched yet; null = fetched, no org (or fetch failed).
let cachedMemberOrgId: string | null | undefined;
let memberOrgIdPromise: Promise<string | null> | null = null;

async function fetchMemberOrgId(): Promise<string | null> {
  const sess = getStoredSession();
  if (!sess?.access_token) return null;
  try {
    const res = await fetch('/api/org/branding', {
      headers: { Authorization: `Bearer ${sess.access_token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const orgId = data?.branding?.orgId;
    return typeof orgId === 'string' ? orgId : null;
  } catch {
    return null;
  }
}

/** The signed-in member's org id, or null; undefined while resolving. */
function useMemberOrgId(enabled: boolean): string | null | undefined {
  const [orgId, setOrgId] = useState<string | null | undefined>(cachedMemberOrgId);
  useEffect(() => {
    if (!enabled || cachedMemberOrgId !== undefined) {
      if (cachedMemberOrgId !== undefined) setOrgId(cachedMemberOrgId);
      return;
    }
    if (!memberOrgIdPromise) {
      memberOrgIdPromise = fetchMemberOrgId().then((id) => {
        cachedMemberOrgId = id;
        return id;
      });
    }
    let alive = true;
    memberOrgIdPromise.then((id) => { if (alive) setOrgId(id); });
    return () => { alive = false; };
  }, [enabled]);
  return orgId;
}

export function useCustomLabelStyleWithOrg(orgId?: string | null): ReturnType<typeof useCustomLabelStyle> {
  const personal = useCustomLabelStyle();
  const { membership } = useOrgContext();

  const slab = membership?.slab;
  // 'org' is the collection page's scope sentinel — that surface is already
  // scoped to the member's own org, so no per-card id check is needed.
  const needsIdCheck = !!orgId && orgId !== 'org';
  const memberOrgId = useMemberOrgId(needsIdCheck && !!membership && !!slab);

  if (!orgId || !membership || !slab) return personal;
  // Another store's card (or the member org id is still resolving / unknown):
  // keep the personal style rather than mis-branding.
  if (needsIdCheck && memberOrgId !== orgId) return personal;

  if (slab.labelStyle === 'modern') {
    // House modern = the standard DCM modern formatting (no custom overrides);
    // org identity comes from the logo slot.
    return { ...personal, labelStyle: 'modern', activeConfig: null, colorOverrides: undefined };
  }

  // House heritage: synthesize the minimal config the heritage resolution
  // reads (style/pattern/band colors/color source).
  const useCardColors = slab.colorSource === 'card';
  const explicitColors = slab.colors.length > 0
    ? slab.colors
    : membership.brandColors.length > 0
      ? membership.brandColors
      : FALLBACK_BAND;
  const activeConfig = {
    style: 'heritage',
    heritagePattern: slab.pattern,
    heritageColorSource: useCardColors ? 'card' : 'brand',
    ...(useCardColors ? {} : { heritageBandColors: explicitColors }),
  } as unknown as CustomLabelConfig;

  return {
    ...personal,
    labelStyle: 'heritage',
    activeConfig,
    colorOverrides: extractColorOverrides(activeConfig),
  };
}
