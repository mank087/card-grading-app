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
 */

import { useCustomLabelStyle } from '@/hooks/useCustomLabelStyle';
import { useOrgContext } from '@/contexts/OrgContext';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import { extractColorOverrides } from '@/lib/labelPresets';

const FALLBACK_BAND = ['#7C3AED', '#4C1D95'];

export function useCustomLabelStyleWithOrg(orgId?: string | null): ReturnType<typeof useCustomLabelStyle> {
  const personal = useCustomLabelStyle();
  const { membership } = useOrgContext();

  const slab = membership?.slab;
  if (!orgId || !membership || !slab) return personal;

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
