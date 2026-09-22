'use client';

/**
 * The five photos an eBay listing gets, rendered here exactly as the listing
 * flow renders them.
 *
 * It calls the SAME `prepareListingImages` the modal's image step calls —
 * labelled front, labelled back, raw front, raw back, mini grade report — with
 * the label style the page is CURRENTLY previewing, so switching the design
 * upstairs changes what this tab shows, same as it changes the downloads.
 *
 * IT NEVER UPLOADS. `uploadListingImages` is the other half of that module and
 * is deliberately not imported here: this tab is a preview and an editor, and
 * the only thing that may put bytes on eBay's servers is the publish step
 * inside the modal.
 *
 * THREE THINGS THE 2026-09-22 REVIEW ASKED FOR:
 *  - ENLARGE. A 5-across grid of listing photos is a contact sheet, not a look
 *    at the picture. Each one opens in the same dialog pattern the holder
 *    previews use (Escape, focus trap, focus returned).
 *  - TRY AGAIN. `prepareListingImages` reads images over the network and
 *    re-encodes them through a canvas; when it throws, the tab used to end at
 *    a sentence with nothing to press.
 *  - A SESSION CACHE. The section is unmounted whenever another tab is active
 *    (CardDetailSections), so every return re-rendered five canvases. They only
 *    change when the card or the design changes, which is exactly what
 *    `listingImageKey` names.
 *
 * WHAT THE CACHE MEANS FOR OBJECT URLs. A cached set's URLs must stay alive, so
 * this no longer revokes on unmount — it revokes when an entry is EVICTED, and
 * only entries are evicted that nothing is rendering any more. The cache is a
 * module-level map: it lives as long as the JavaScript context, which is one
 * page session, and a full reload starts empty.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  prepareListingImages,
  SYSTEM_IMAGE_LABELS,
  type PreparedListingImages,
} from '@/lib/ebay/prepareListingImages';
import { listingImageKey } from '@/lib/cardDetail/listingImageKey';
import ListingImageDialog from './ListingImageDialog';
import type { CustomLabelConfig } from '@/lib/labelPresets';

export interface InstaListImagesProps {
  card: any;
  cardType: string;
  /** The style the page is previewing — not the saved account default. */
  labelStyle: string;
  customLabelConfig: CustomLabelConfig | null;
  showFounderEmblem: boolean;
}

const PLACEHOLDER_KEYS = ['front', 'back', 'rawFront', 'rawBack', 'miniReport'] as const;

/**
 * The rendered sets for this page session, newest last. Small on purpose: an
 * owner tries a handful of designs at most, and each entry holds five blobs.
 */
const CACHE_LIMIT = 4;
const renderedCache = new Map<string, PreparedListingImages>();

function readCache(key: string): PreparedListingImages | null {
  return renderedCache.get(key) ?? null;
}

function writeCache(key: string, value: PreparedListingImages) {
  renderedCache.set(key, value);
  while (renderedCache.size > CACHE_LIMIT) {
    const oldestKey = renderedCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const evicted = renderedCache.get(oldestKey);
    renderedCache.delete(oldestKey);
    // Nothing is rendering an evicted set: the only reader is this component,
    // and it re-reads the cache by key on every mount.
    if (evicted) for (const img of evicted.images) URL.revokeObjectURL(img.objectUrl);
  }
}

export function InstaListImages({
  card,
  cardType,
  labelStyle,
  customLabelConfig,
  showFounderEmblem,
}: InstaListImagesProps) {
  const cacheKey = listingImageKey({
    cardId: card?.id,
    cardType,
    labelStyle,
    customLabelConfig,
    showFounderEmblem,
  });

  const [prepared, setPrepared] = useState<PreparedListingImages | null>(() => readCache(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [enlarged, setEnlarged] = useState<{ src: string; label: string } | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;

  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached && attempt === 0) {
      setPrepared(cached);
      setError(null);
      return;
    }

    let cancelled = false;
    setPrepared(null);
    setError(null);

    prepareListingImages(cardRef.current, {
      cardType,
      labelStyle,
      customLabelConfig,
      showFounderEmblem,
    })
      .then((result) => {
        if (cancelled) {
          // Rendered after we were torn down. Keep it — the reader is one tab
          // away and this is exactly what the cache is for. Eviction revokes.
          writeCache(cacheKey, result);
          return;
        }
        writeCache(cacheKey, result);
        setPrepared(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'These photos could not be rendered.');
      });

    return () => {
      cancelled = true;
    };
    // `card` is read through a ref: a row refetched with an identical identity
    // must not re-render five canvases. The cache key carries what matters.
  }, [cacheKey, cardType, labelStyle, customLabelConfig, showFounderEmblem, attempt]);

  const retry = useCallback(() => {
    renderedCache.delete(cacheKey);
    setAttempt((n) => n + 1);
  }, [cacheKey]);

  return (
    <section className="cd-panel cd-instalist-images" aria-labelledby="cd-il-images-heading">
      <p className="cd-eyebrow">The photos that go out</p>
      <h3 id="cd-il-images-heading" className="cd-instalist-h3">
        Five images, already made.
      </h3>
      <p className="cd-caption">
        The same five the listing uploads, in the design you are previewing. Select one to see it
        full size. Nothing is sent anywhere from this tab.
      </p>

      {error ? (
        <div className="cd-instalist-error" role="status">
          <p className="cd-caption">{error}</p>
          <button type="button" className="dcm-button dcm-button--secondary" onClick={retry}>
            Try again
          </button>
        </div>
      ) : (
        <ul className="cd-instalist-image-grid">
          {(prepared
            ? prepared.images
            : PLACEHOLDER_KEYS.map((key) => ({
                key,
                label: SYSTEM_IMAGE_LABELS[key],
                objectUrl: '',
              }))
          ).map((img) => (
            <li key={img.key} className="cd-instalist-image">
              {img.objectUrl ? (
                <button
                  type="button"
                  className="cd-instalist-image-button"
                  onClick={() => setEnlarged({ src: img.objectUrl, label: img.label })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.objectUrl} alt={`${img.label} listing photo`} loading="lazy" />
                  <span className="cd-instalist-image-zoom" aria-hidden="true">
                    Enlarge
                  </span>
                </button>
              ) : (
                <div className="cd-instalist-image-skeleton" aria-hidden="true" />
              )}
              <span className="cd-caption">{img.label}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="cd-caption" role="status" aria-live="polite">
        {error ? '' : prepared ? 'Photos ready.' : 'Rendering the listing photos…'}
      </p>

      <ListingImageDialog
        src={enlarged?.src ?? null}
        label={enlarged?.label ?? ''}
        onClose={() => setEnlarged(null)}
      />
    </section>
  );
}

export default InstaListImages;
