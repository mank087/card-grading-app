'use client';

/**
 * Listing photo pipeline — browser side.
 *
 * Lifted out of EbayListingModal so it can run for one card (the modal) or for
 * N cards in a row (the bulk review list, Part 2 Phase 1). Everything here
 * needs a DOM: the label front/back and the raw crops are canvas renders and
 * the compression step is a canvas re-encode, so this is a client module and
 * always will be.
 *
 * Two halves, deliberately separate:
 * - prepareListingImages(card, opts) renders the five system images
 * - uploadListingImages(...) compresses and pushes them to /api/ebay/images
 *
 * The bulk flow renders during review and uploads before publish, so the drain
 * only has to call the Trading API.
 */

import { generateCardImages, generateRawCardImages, type CardImageData } from '@/lib/cardImageGenerator';
import { generateMiniReportJpg } from '@/lib/miniReportJpgGenerator';
import { type FoldableLabelData, generateQRCodeWithLogo } from '@/lib/foldableLabelGenerator';
import { loadLogosForCard, cardQrUrl } from '@/lib/orgBranding';
import { getCardLabelData } from '@/lib/useLabelData';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import { resolveEmblemVisibility } from '@/lib/labelEmblems';
import { getAuthenticatedClient } from '@/lib/directAuth';

export type SystemImageKey = 'front' | 'back' | 'miniReport' | 'rawFront' | 'rawBack';

export type OrderedImageItem =
  | { kind: 'system'; key: SystemImageKey }
  | { kind: 'custom'; id: string };

/**
 * Default gallery order. The FIRST selected image becomes eBay's main photo,
 * and the main photo is what drives click-through from search results, so the
 * labelled front (card with its slab label above it) leads deliberately —
 * this order used to be whatever the tiles happened to be rendered in.
 * The seller can still reorder every item in the picker.
 */
export const DEFAULT_IMAGE_ORDER: readonly OrderedImageItem[] = [
  { kind: 'system', key: 'front' },
  { kind: 'system', key: 'back' },
  { kind: 'system', key: 'rawFront' },
  { kind: 'system', key: 'rawBack' },
  { kind: 'system', key: 'miniReport' },
] as const;

/** Tile captions, in the same order the picker renders them. */
export const SYSTEM_IMAGE_LABELS: Record<SystemImageKey, string> = {
  front: 'Front',
  back: 'Back',
  miniReport: 'Report',
  rawFront: 'Front (Raw)',
  rawBack: 'Back (Raw)',
};

/**
 * Client-side compression cap for listing photos. eBay recommends 1600 px on
 * the long side (its zoom viewer judges quality at that size); we shipped 1200
 * px, below the threshold. 1 MB keeps the base64 POST comfortably inside the
 * request limit — eBay itself accepts up to 12 MB.
 */
export const LISTING_IMAGE_MAX_DIM = 1600;
export const LISTING_IMAGE_MAX_KB = 1024;

export interface PrepareListingImagesOptions {
  cardType: string;
  labelStyle?: string;
  customLabelConfig?: import('@/lib/labelPresets').CustomLabelConfig | null;
  /** Fallback founder-badge flag when the profile lookup fails. */
  showFounderEmblem?: boolean;
  /** Coarse progress for a batch UI; the single-card modal passes nothing. */
  onProgress?: (stage: 'branding' | 'labels' | 'miniReport' | 'done') => void;
}

export interface PreparedListingImages {
  blobs: Record<SystemImageKey, Blob>;
  /** Object URLs for preview tiles. The caller owns revoking them. */
  objectUrls: Record<SystemImageKey, string>;
  /** The codified default order, ready to seed a picker. */
  order: OrderedImageItem[];
  /** Per-image metadata in default order, for a list/grid to render. */
  images: Array<{ key: SystemImageKey; label: string; blob: Blob; objectUrl: string }>;
}

/**
 * Render the five system photos for one card: labelled front/back, raw
 * front/back and the mini grade report.
 */
export async function prepareListingImages(
  card: any,
  opts: PrepareListingImagesOptions
): Promise<PreparedListingImages> {
  const { cardType, labelStyle = 'modern', customLabelConfig = null, showFounderEmblem = false, onProgress } = opts;

  const labelData = getCardLabelData(card);

  // Get image URLs
  let frontImageUrl = card.front_url;
  let backImageUrl = card.back_url;

  if (!frontImageUrl || !backImageUrl) {
    if (!card.front_path || !card.back_path) {
      throw new Error('Card images not found');
    }

    const authClient = getAuthenticatedClient();
    const [frontUrl, backUrl] = await Promise.all([
      authClient.storage.from('cards').createSignedUrl(card.front_path, 3600),
      authClient.storage.from('cards').createSignedUrl(card.back_path, 3600),
    ]);

    if (!frontUrl.data?.signedUrl || !backUrl.data?.signedUrl) {
      throw new Error('Failed to get card image URLs');
    }

    frontImageUrl = frontUrl.data.signedUrl;
    backImageUrl = backUrl.data.signedUrl;
  }

  // Get subgrades
  const weightedScores = card.conversational_weighted_sub_scores || {};
  const subScoresData = card.conversational_sub_scores || {};
  const englishName = card.featured || card.pokemon_featured || card.card_name || undefined;

  // Resolve badges from the profile — the prop chain only ever carried
  // the founder flag, so VIP / Card Lover badges were missing from
  // listing images.
  // The badge lookup and the org branding load are independent of each
  // other; run them together rather than back to back.
  onProgress?.('branding');
  const t0 = performance.now();
  let emblemFlags = { showFounderEmblem, showVipEmblem: false, showCardLoversEmblem: false };
  const [, orgLogoSet] = await Promise.all([
    (async () => {
      try {
        const sb = getAuthenticatedClient();
        const { data: creditsRow } = await sb
          .from('user_credits')
          .select('is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge, preferred_label_emblem')
          .single();
        if (creditsRow) emblemFlags = resolveEmblemVisibility(creditsRow);
      } catch { /* keep prop fallback */ }
    })(),
    // Org branding: only org-graded cards have any. Every other card was
    // paying for a round trip to /api/org/branding plus three logo fetches
    // to be told it has no store, on the critical path of every listing.
    card.org_id ? loadLogosForCard(card.id).catch(() => null) : Promise.resolve(null),
  ]);
  console.log(`[eBay Listing] prep (badges + branding): ${Math.round(performance.now() - t0)}ms`);
  const qrTargetUrl = cardQrUrl(card.id, card.serial, orgLogoSet?.branding, `${window.location.origin}/${cardType}/${card.id}`);

  // Generate card images (front & back with labels)
  const cardImageData: CardImageData = {
    cardName: labelData.primaryName,
    contextLine: labelData.contextLine,
    specialFeatures: labelData.featuresLine || undefined,
    serial: labelData.serial,
    englishName,
    grade: labelData.grade ?? 0,
    conditionLabel: labelData.condition,
    cardUrl: qrTargetUrl,
    frontImageUrl,
    backImageUrl,
    showFounderEmblem: emblemFlags.showFounderEmblem,
    showVipEmblem: emblemFlags.showVipEmblem,
    showCardLoversEmblem: emblemFlags.showCardLoversEmblem,
    labelStyle,
    heritage: (() => {
      const sel = resolveHeritageSelection(labelStyle, customLabelConfig);
      return sel.active
        ? { pattern: sel.pattern, bandColors: sel.bandColors ?? resolveHeritageBandColors(card?.card_colors), gradeColors: sel.gradeColors }
        : undefined;
    })(),
    subScores: {
      centering: weightedScores.centering ?? subScoresData.centering?.weighted ?? 0,
      corners: weightedScores.corners ?? subScoresData.corners?.weighted ?? 0,
      edges: weightedScores.edges ?? subScoresData.edges?.weighted ?? 0,
      surface: weightedScores.surface ?? subScoresData.surface?.weighted ?? 0,
    },
    logoOverrides: orgLogoSet?.branding
      ? { color: orgLogoSet.color, white: orgLogoSet.white, black: orgLogoSet.black, mark: orgLogoSet.mark, scale: orgLogoSet.logoScale }
      : undefined,
    orgDesign: orgLogoSet?.design ?? null,
  };

  // The QR only needs the card URL, so it does not have to wait behind the
  // label rendering — the mini report is what depends on it.
  onProgress?.('labels');
  const cardUrl = qrTargetUrl;
  const t1 = performance.now();
  const [{ front, back }, rawImages, qrCodeDataUrl] = await Promise.all([
    generateCardImages(cardImageData),
    generateRawCardImages(frontImageUrl, backImageUrl),
    generateQRCodeWithLogo(cardUrl, orgLogoSet?.branding ? orgLogoSet.color : undefined)
      .catch(() => generateQRCodeWithLogo(cardUrl)),
  ]);
  console.log(`[eBay Listing] card images + raw + QR: ${Math.round(performance.now() - t1)}ms (labelStyle=${labelStyle})`);
  const logoDataUrl = orgLogoSet?.mark || undefined;

  const miniReportData: FoldableLabelData = {
    cardName: labelData.primaryName,
    setName: labelData.setName || '',
    cardNumber: labelData.cardNumber || undefined,
    year: labelData.year || undefined,
    specialFeatures: labelData.featuresLine || undefined,
    serial: labelData.serial,
    englishName,
    grade: labelData.grade ?? 0,
    conditionLabel: labelData.condition,
    subgrades: {
      centering: weightedScores.centering ?? subScoresData.centering?.weighted ?? 0,
      corners: weightedScores.corners ?? subScoresData.corners?.weighted ?? 0,
      edges: weightedScores.edges ?? subScoresData.edges?.weighted ?? 0,
      surface: weightedScores.surface ?? subScoresData.surface?.weighted ?? 0,
    },
    overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
    qrCodeDataUrl,
    cardUrl,
    logoDataUrl,
  };

  onProgress?.('miniReport');
  const t2 = performance.now();
  const miniReport = await generateMiniReportJpg(miniReportData);
  console.log(
    `[eBay Listing] mini report: ${Math.round(performance.now() - t2)}ms | total ${Math.round(performance.now() - t0)}ms`,
  );

  const blobs: Record<SystemImageKey, Blob> = {
    front,
    back,
    miniReport,
    rawFront: rawImages.front,
    rawBack: rawImages.back,
  };
  const objectUrls: Record<SystemImageKey, string> = {
    front: URL.createObjectURL(front),
    back: URL.createObjectURL(back),
    miniReport: URL.createObjectURL(miniReport),
    rawFront: URL.createObjectURL(rawImages.front),
    rawBack: URL.createObjectURL(rawImages.back),
  };

  onProgress?.('done');
  return {
    blobs,
    objectUrls,
    order: [...DEFAULT_IMAGE_ORDER],
    images: DEFAULT_IMAGE_ORDER.filter(
      (i): i is { kind: 'system'; key: SystemImageKey } => i.kind === 'system'
    ).map(i => ({
      key: i.key,
      label: SYSTEM_IMAGE_LABELS[i.key],
      blob: blobs[i.key],
      objectUrl: objectUrls[i.key],
    })),
  };
}

/** Base64 data URL for a blob (what /api/ebay/images accepts). */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Compress any image blob to keep requests under payload limits */
export function compressListingImage(blob: Blob, maxKB: number = LISTING_IMAGE_MAX_KB): Promise<Blob> {
  return new Promise((resolve) => {
    if (blob.size <= maxKB * 1024) { resolve(blob); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = LISTING_IMAGE_MAX_DIM;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((result) => resolve(result || blob), 'image/jpeg', 0.82);
    };
    img.onerror = () => resolve(blob);
    img.src = URL.createObjectURL(blob);
  });
}

export interface UploadListingImagesInput {
  cardId: string;
  accessToken: string;
  /** The user's arranged order; first SELECTED item becomes eBay's main image. */
  order: OrderedImageItem[];
  blobs: Partial<Record<SystemImageKey, Blob>>;
  selected: Record<SystemImageKey, boolean>;
  additionalImages?: Array<{ id: string; blob: Blob; selected: boolean }>;
  onProgress?: (uploaded: number, total: number) => void;
}

/**
 * Compress and upload the selected photos, in order, returning the eBay-hosted
 * URLs. Uploads are one request per image on purpose: a single batched POST of
 * five base64 images exceeds the request size limit.
 */
export async function uploadListingImages(input: UploadListingImagesInput): Promise<string[]> {
  const { cardId, accessToken, order, blobs, selected, additionalImages = [], onProgress } = input;

  const uploadSingleImage = async (imageKey: string, blob: Blob): Promise<string | null> => {
    const compressed = await compressListingImage(blob);
    const base64 = await toBase64(compressed);
    const response = await fetch('/api/ebay/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        cardId,
        images: { [imageKey]: base64 },
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to upload ${imageKey}`);
    }
    const data = await response.json();
    return data.urls[imageKey] || null;
  };

  const urls: string[] = [];

  // Walk the order so the gallery upload order matches the order the
  // user arranged in the picker. First selected becomes eBay main image.
  for (const item of order) {
    if (item.kind === 'system') {
      if (!selected[item.key]) continue;
      const blob = blobs[item.key];
      if (!blob) continue;
      const url = await uploadSingleImage(item.key, blob);
      if (url) urls.push(url);
    } else {
      const img = additionalImages.find(a => a.id === item.id);
      if (!img || !img.selected) continue;
      try {
        const compressed = await compressListingImage(img.blob);
        const base64 = await toBase64(compressed);
        const response = await fetch('/api/ebay/images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            cardId,
            additionalImages: [base64],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.urls.additional?.length) urls.push(...data.urls.additional);
        } else {
          console.error('[eBay Images] Failed to upload additional image:', await response.text());
        }
      } catch (err) {
        console.error('[eBay Images] Error uploading additional image:', err);
      }
    }
    onProgress?.(urls.length, order.length);
  }

  return urls;
}

/**
 * Run an async mapper over items with at most `limit` in flight, preserving
 * input order in the result. The bulk review renders label art for a whole
 * batch; three canvases at a time keeps a mid-range laptop responsive without
 * serialising a 100-card batch.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
