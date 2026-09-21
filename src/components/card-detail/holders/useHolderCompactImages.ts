'use client';

/**
 * Heritage Compact artwork for the two small holders, built from the SAME
 * inputs the printed sheet is built from.
 *
 * This is deliberately a thin wrapper, not a new pipeline. It assembles
 * exactly what `DownloadReportButton.buildCompactHeritageSheet`
 * (DownloadReportButton.tsx:929-953) assembles — `resolveCompactHeritage`,
 * `buildHeritageCompactInputs`, `compactQrDataUrl`, `loadWordmarkDataUrl`,
 * the three emblem flags and the org chip theme — and hands it to the existing
 * `useHeritageCompactImages` renderer (labelWizard/HeritageCompactPreview.tsx),
 * which is the very canvas path the sheet uses. Preview and paper therefore
 * cannot drift.
 *
 * It returns null for EVERY non-heritage style, because there is nothing to
 * supply: the Avery generators ignore `labelStyle` and `customLabelConfig`
 * entirely and print DCM's fixed compact design. `LabelMockup`'s own built-in
 * compact mock is what that looks like, so the caller passes no `labelImages`
 * and the mockup draws it — the same thing Label Studio's gallery shows
 * (LabelStudioClient.tsx:969, which passes no `labelImages` at all).
 * `holderStyleSupport` is what tells the reader that substitution happened.
 */

import { useEffect, useState } from 'react';
import {
  useHeritageCompactImages,
  type CompactFormat,
  type CompactImages,
} from '@/components/labelWizard/HeritageCompactPreview';
import type { HeritageCompactInputs } from '@/lib/labels/heritageCompact';
import { resolveCompactHeritage } from '@/lib/labels/labelStyleResolution';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign';

export type { CompactFormat };

export interface HolderCompactOptions {
  card: unknown;
  labelStyle: string | null | undefined;
  activeConfig: CustomLabelConfig | null;
  /** The QR destination — the same URL the slab artwork encodes. */
  verifyUrl: string;
  emblems?: {
    showFounderEmblem?: boolean;
    showVipEmblem?: boolean;
    showCardLoversEmblem?: boolean;
  };
  /** Enterprise Label Designer document for an org-graded card, if any. */
  orgDesign?: OrgLabelDesign | null;
}

const EMPTY: CompactImages = { front: null, back: null };

/**
 * Both faces of the compact Heritage label as PNG data URLs, or null when the
 * active style is not Heritage.
 */
export function useHolderCompactImages(
  format: CompactFormat,
  options: HolderCompactOptions | null,
): CompactImages | null {
  const [inputs, setInputs] = useState<HeritageCompactInputs | null>(null);

  const card = options?.card ?? null;
  const labelStyle = options?.labelStyle ?? null;
  const activeConfig = options?.activeConfig ?? null;
  const verifyUrl = options?.verifyUrl ?? '';
  const showFounderEmblem = !!options?.emblems?.showFounderEmblem;
  const showVipEmblem = !!options?.emblems?.showVipEmblem;
  const showCardLoversEmblem = !!options?.emblems?.showCardLoversEmblem;
  const chipTheme = options?.orgDesign?.chip?.theme;

  const selection = resolveCompactHeritage(labelStyle, activeConfig);
  const isHeritage = !!selection;
  const pattern = selection?.pattern ?? 'diamond';
  const bandKey = selection?.bandColors?.join(',') ?? '';

  useEffect(() => {
    if (!isHeritage || !card) {
      setInputs(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@/lib/labels/heritageCompactInputs');
        const [qrDataUrl, wordmarkDataUrl] = await Promise.all([
          verifyUrl ? mod.compactQrDataUrl(verifyUrl).catch(() => null) : Promise.resolve(null),
          mod.loadWordmarkDataUrl().catch(() => null),
        ]);
        if (cancelled) return;
        setInputs(
          mod.buildHeritageCompactInputs(card, {
            qrDataUrl,
            // null = sample this card's own artwork, exactly as the sheets do.
            bandColors: bandKey ? bandKey.split(',') : null,
            pattern,
            wordmarkDataUrl,
            showFounderEmblem,
            showVipEmblem,
            showCardLoversEmblem,
            chipTheme,
          }),
        );
      } catch {
        if (!cancelled) setInputs(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isHeritage,
    card,
    verifyUrl,
    pattern,
    bandKey,
    showFounderEmblem,
    showVipEmblem,
    showCardLoversEmblem,
    chipTheme,
  ]);

  // Hooks cannot sit behind the early return, so this always runs; it is a
  // no-op with null inputs.
  const images = useHeritageCompactImages(inputs, format);
  if (!isHeritage) return null;
  return inputs ? images : EMPTY;
}

export default useHolderCompactImages;
