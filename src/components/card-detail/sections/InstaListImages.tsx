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
 * Object URLs are revoked on unmount. The section is unmounted whenever
 * another tab is active (CardDetailSections), so five canvas renders' worth of
 * blobs do not sit in memory for the whole visit.
 */

import { useEffect, useRef, useState } from 'react';
import {
  prepareListingImages,
  SYSTEM_IMAGE_LABELS,
  type PreparedListingImages,
} from '@/lib/ebay/prepareListingImages';
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

export function InstaListImages({
  card,
  cardType,
  labelStyle,
  customLabelConfig,
  showFounderEmblem,
}: InstaListImagesProps) {
  const [prepared, setPrepared] = useState<PreparedListingImages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const liveUrls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPrepared(null);
    setError(null);

    prepareListingImages(card, { cardType, labelStyle, customLabelConfig, showFounderEmblem })
      .then((result) => {
        if (cancelled) {
          // Rendered after we were torn down: revoke immediately rather than
          // leak the five blobs.
          for (const img of result.images) URL.revokeObjectURL(img.objectUrl);
          return;
        }
        liveUrls.current = result.images.map((i) => i.objectUrl);
        setPrepared(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'These photos could not be rendered.');
      });

    return () => {
      cancelled = true;
      for (const url of liveUrls.current) URL.revokeObjectURL(url);
      liveUrls.current = [];
    };
  }, [card, cardType, labelStyle, customLabelConfig, showFounderEmblem]);

  return (
    <section className="cd-panel cd-instalist-images" aria-labelledby="cd-il-images-heading">
      <p className="cd-eyebrow">The photos that go out</p>
      <h3 id="cd-il-images-heading" className="cd-instalist-h3">
        Five images, already made.
      </h3>
      <p className="cd-caption">
        The same five the listing uploads, in the design you are previewing. Nothing is sent
        anywhere from this tab.
      </p>

      {error ? (
        <p className="cd-caption cd-instalist-error" role="status">
          {error}
        </p>
      ) : (
        <ul className="cd-instalist-image-grid">
          {(prepared ? prepared.images : PLACEHOLDER_KEYS.map((key) => ({ key, label: SYSTEM_IMAGE_LABELS[key], objectUrl: '' }))).map(
            (img) => (
              <li key={img.key} className="cd-instalist-image">
                {img.objectUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.objectUrl} alt={`${img.label} listing photo`} loading="lazy" />
                ) : (
                  <div className="cd-instalist-image-skeleton" aria-hidden="true" />
                )}
                <span className="cd-caption">{img.label}</span>
              </li>
            ),
          )}
        </ul>
      )}

      <p className="cd-caption" role="status" aria-live="polite">
        {error ? '' : prepared ? 'Photos ready.' : 'Rendering the listing photos…'}
      </p>
    </section>
  );
}

export default InstaListImages;
