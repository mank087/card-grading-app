'use client';

/**
 * The InstaList tab's editable listing draft — session-only.
 *
 * WHAT IT HOLDS: `{ title, descriptionHtml, itemSpecifics, price }`, seeded
 * exactly as `EbayListingModal` seeds them, plus which of the four the owner
 * has actually changed. Nothing is stored: no column, no migration, no
 * localStorage. A reload drops it, which is the owner's stated design.
 *
 * WHERE THE SEED COMES FROM, in two stages, the same two the modal uses:
 *   1. SYNCHRONOUS — `buildListingDraft(card, { cardType })` for the title,
 *      description, specifics; `seedListingPrice(card)` for the asking price
 *      (the shared `resolveCardValue` chain, so the tab and the modal cannot
 *      show different numbers).
 *   2. ASYNCHRONOUS — the account's saved listing defaults and the org
 *      branding, folded in by the SHARED `resolveSeedDefaults` /
 *      `buildSeededDefaults` (listingSeed.ts). A store's grade label re-renders
 *      the title; a saved template replaces the description layout.
 * When stage 2 lands, `rebaseListingDraftDefaults` moves only the fields the
 * owner has NOT edited — the same "don't clobber what they typed" rule the
 * modal's `prev === defaultTitle` guard expresses.
 *
 * WHY `enabled`: stage 2 is a network call. It runs when the tab is first
 * opened, not on every page view, so an owner who never opens InstaList costs
 * nothing extra. Before it runs the draft is still complete — just built on the
 * built-in DCM defaults — and `dirtyDraftValues()` is empty, so the modal seeds
 * everything itself anyway.
 *
 * WHAT IT DOES NOT DO: it never publishes, uploads or calls eBay. The only
 * network this tab causes is this defaults fetch and the shared listing check.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildListingDraft } from '@/lib/ebay/listingDraft';
import {
  buildSeededDefaults,
  renderDescriptionForTitle,
  resolveSeedDefaults,
  retitleDescriptionHtml,
  seedListingPrice,
} from '@/lib/ebay/listingSeed';
import { fetchListingSeedContext } from '@/lib/ebay/listingSeedFetch';
import {
  createListingDraftState,
  dirtyDraftValues,
  isListingDraftDirty,
  rebaseListingDraftDefaults,
  resetListingDraftField,
  resetListingDraftTitle,
  setListingDraftField,
  setListingDraftTitle,
  type TitleSync,
  type ListingDraftField,
  type ListingDraftState,
  type ListingDraftValues,
} from '@/lib/ebay/listingDraftState';
import type { InitialListingDraft } from '@/lib/ebay/listingSeed';
import type { ItemSpecific } from '@/lib/ebay/itemSpecifics';
import type { ListingBranding, ListingDescriptionFields } from '@/lib/ebay/listingDescription';

export interface UseListingDraftResult {
  values: ListingDraftValues;
  dirty: Record<ListingDraftField, boolean>;
  anyDirty: boolean;
  /** Where the seeded price came from, worded as the modal words it. */
  priceLabel: string | null;
  /** True while the saved-defaults fetch is in flight. */
  loadingDefaults: boolean;
  setField: <K extends ListingDraftField>(field: K, value: ListingDraftValues[K]) => void;
  resetField: (field: ListingDraftField) => void;
  /** Only the edited fields — what `EbayListingModal.initialDraft` takes. */
  initialDraft: InitialListingDraft;
}

export function useListingDraft(
  card: any,
  cardType: string,
  { enabled = true }: { enabled?: boolean } = {},
): UseListingDraftResult {
  const cardId: string | undefined = card?.id;

  /** Stage 1. Recomputed only when the card or its category changes. */
  const baseDraft = useMemo(
    () => (card ? buildListingDraft(card, { cardType }) : null),
    [card, cardType],
  );
  const basePrice = useMemo(() => (card ? seedListingPrice(card) : { price: '', label: null }), [card]);

  const seedValues = useCallback(
    (): ListingDraftValues => ({
      title: baseDraft?.title ?? '',
      descriptionHtml: baseDraft?.descriptionHtml ?? '',
      itemSpecifics: (baseDraft?.itemSpecifics ?? []) as ItemSpecific[],
      price: basePrice.price,
    }),
    [baseDraft, basePrice],
  );

  const [state, setState] = useState<ListingDraftState>(() => createListingDraftState(seedValues()));
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  /**
   * What the description is rebuilt FROM when the title changes: its fields,
   * the account's saved template (null = the standard layout) and the org
   * branding. Stage 2 replaces it; a ref, not state, because every read of it
   * happens inside an event handler.
   */
  const descContext = useRef<{
    fields: ListingDescriptionFields | null;
    template: string | null;
    branding: ListingBranding | null;
  }>({ fields: baseDraft?.descriptionFields ?? null, template: null, branding: null });

  // A different card means a different draft. Editing card A and navigating to
  // card B must not carry A's title across.
  const seededFor = useRef<string | undefined>(cardId);
  const defaultsFor = useRef<string | null>(null);
  useEffect(() => {
    if (seededFor.current === cardId) return;
    seededFor.current = cardId;
    defaultsFor.current = null;
    descContext.current = {
      fields: baseDraft?.descriptionFields ?? null,
      template: null,
      branding: null,
    };
    setState(createListingDraftState(seedValues()));
  }, [cardId, seedValues, baseDraft]);

  /** Stage 2. Once per card, and only after the tab has been opened. */
  useEffect(() => {
    if (!enabled || !card || !baseDraft) return;
    if (defaultsFor.current === cardId) return;
    defaultsFor.current = cardId ?? null;

    let cancelled = false;
    setLoadingDefaults(true);
    fetchListingSeedContext(card)
      .then(({ branding, defaults }) => {
        if (cancelled) return;
        const resolution = resolveSeedDefaults(card, defaults, baseDraft);
        const seeded = buildSeededDefaults(baseDraft, resolution, branding);
        descContext.current = {
          fields: seeded.descriptionFields,
          template: resolution.template,
          branding,
        };
        setState((prev) =>
          rebaseListingDraftDefaults(prev, {
            ...prev.defaults,
            title: seeded.title,
            descriptionHtml: seeded.descriptionHtml,
          }),
        );
      })
      .catch(() => {
        // The built-in DCM defaults already on screen are the right fallback,
        // and they are what the modal would fall back to as well.
      })
      .finally(() => {
        if (!cancelled) setLoadingDefaults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, card, cardId, baseDraft]);

  /**
   * Rebuilding the description for a title, and patching the headline of one
   * the owner already wrote. Both go through the shared builders, so the tab
   * and the modal cannot render the same title differently.
   */
  const titleSync: TitleSync = useMemo(
    () => ({
      render: (title: string) => {
        const ctx = descContext.current;
        if (!ctx.fields) return '';
        return renderDescriptionForTitle(ctx.fields, title, ctx.template, ctx.branding);
      },
      retitle: retitleDescriptionHtml,
    }),
    [],
  );

  const setField = useCallback(
    <K extends ListingDraftField>(field: K, value: ListingDraftValues[K]) => {
      // The title is the one field with a consequence: the description's
      // opening line repeats it, so the two move together.
      if (field === 'title') {
        setState((prev) => setListingDraftTitle(prev, value as string, titleSync));
        return;
      }
      setState((prev) => setListingDraftField(prev, field, value));
    },
    [titleSync],
  );

  const resetField = useCallback(
    (field: ListingDraftField) => {
      if (field === 'title') {
        setState((prev) => resetListingDraftTitle(prev, titleSync));
        return;
      }
      setState((prev) => resetListingDraftField(prev, field));
    },
    [titleSync],
  );

  const initialDraft = useMemo(() => dirtyDraftValues(state), [state]);

  return {
    values: state.values,
    dirty: state.dirty,
    anyDirty: isListingDraftDirty(state),
    priceLabel: basePrice.label,
    loadingDefaults,
    setField,
    resetField,
    initialDraft,
  };
}

export default useListingDraft;
