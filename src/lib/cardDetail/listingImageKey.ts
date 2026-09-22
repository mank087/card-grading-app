/**
 * The identity of a rendered set of listing photos, for the InstaList tab's
 * session cache (review 2026-09-22, polish).
 *
 * The five photos are canvas renders — the labelled front and back, the two raw
 * crops and the mini grade report — and they took a visible moment to appear
 * every single time the reader came back to the tab, because the section is
 * unmounted while another tab is active. They only change when the CARD or the
 * DESIGN changes, so this names that pair and the tab keeps the last few sets
 * for the length of the visit.
 *
 * Everything `prepareListingImages` is actually given is in the key, so a key
 * collision cannot show one card's photos for another's.
 *
 * Pure.
 */

import type { CustomLabelConfig } from '@/lib/labelPresets';

export interface ListingImageKeyInput {
  cardId: string | null | undefined;
  cardType: string;
  labelStyle: string;
  customLabelConfig: CustomLabelConfig | null;
  showFounderEmblem: boolean;
}

/**
 * The custom design, flattened. Every field is included: the Label Studio
 * config is the whole design, and a renderer reads all of it.
 */
function configKey(config: CustomLabelConfig | null): string {
  if (!config) return 'none';
  try {
    // Sorted keys, so two structurally identical configs cannot produce two
    // different strings just because they were assembled in a different order.
    return JSON.stringify(config, Object.keys(config).sort());
  } catch {
    return 'unserialisable';
  }
}

export function listingImageKey(input: ListingImageKeyInput): string {
  return [
    input.cardId ?? 'no-card',
    input.cardType,
    input.labelStyle,
    input.showFounderEmblem ? 'emblem' : 'no-emblem',
    configKey(input.customLabelConfig),
  ].join('|');
}

export default listingImageKey;
