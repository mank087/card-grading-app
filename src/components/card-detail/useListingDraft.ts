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
  changedDraftFields,
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
import { cardIdentityKey } from '@/lib/ebay/cardIdentityKey';
import type { InitialListingDraft } from '@/lib/ebay/listingSeed';
import type { ItemSpecific } from '@/lib/ebay/itemSpecifics';
import type { ListingBranding, ListingDescriptionFields } from '@/lib/ebay/listingDescription';

export interface UseListingDraftResult {
  values: ListingDraftValues;
  dirty: Record<ListingDraftField, boolean>;
  /**
   * True only when the owner edited the description BODY themselves. A title
   * edit rewrites the headline too, which sets `dirty.descriptionHtml`, but
   * that is not the owner editing the description — the "Edited" marker on
   * the collapsed Description section reads this instead.
   */
  bodyEdited: boolean;
  anyDirty: boolean;
  /** Where the seeded price came from, worded as the modal words it. */
  priceLabel: string | null;
  /** True while the saved-defaults fetch is in flight. */
  loadingDefaults: boolean;
  /**
   * Set when a correction to the CARD moved a field the owner had not edited —
   * so the tab can say "Updated from card details" rather than silently
   * swapping the title under them. Cleared by `dismissRebaseNote`.
   */
  rebasedFromCard: boolean;
  dismissRebaseNote: () => void;
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

  /**
   * THE CARD'S IDENTITY, not just its id (review 2026-09-22, finding 5).
   *
   * The draft used to reseed only when the card ID changed — but an owner can
   * correct the card WITHOUT leaving the page ("Edit card details", "Edit this
   * card's label text"), and the page then refetches the same id. The draft sat
   * there with the old name, the old set and the old specifics, and the
   * once-per-id defaults flag meant the saved template was never re-resolved
   * for the corrected card either. `cardIdentityKey` names everything a listing
   * is actually built from, and deliberately excludes `updated_at` so a price
   * refresh does not count as a correction.
   */
  const identityKey = useMemo(() => cardIdentityKey(card), [card]);
  const [rebasedFromCard, setRebasedFromCard] = useState(false);
  const dismissRebaseNote = useCallback(() => setRebasedFromCard(false), []);

  // A different card means a different draft. Editing card A and navigating to
  // card B must not carry A's title across. The SAME card, corrected, is the
  // second branch: edits are kept, everything clean follows the correction.
  const seededFor = useRef<string | undefined>(cardId);
  const identityFor = useRef<string>(identityKey);
  /** Requested, but not necessarily applied — the two are tracked apart. */
  const defaultsRequestedFor = useRef<string | null>(null);
  /** Applied. Only this suppresses a repeat. */
  const defaultsAppliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (seededFor.current !== cardId) {
      seededFor.current = cardId;
      identityFor.current = identityKey;
      defaultsRequestedFor.current = null;
      defaultsAppliedFor.current = null;
      setRebasedFromCard(false);
      descContext.current = {
        fields: baseDraft?.descriptionFields ?? null,
        template: null,
        branding: null,
      };
      setState(createListingDraftState(seedValues()));
      return;
    }

    if (identityFor.current === identityKey) return;
    identityFor.current = identityKey;
    // The saved template and grade label were resolved against the OLD card,
    // so let stage 2 run again for the corrected one.
    defaultsRequestedFor.current = null;
    defaultsAppliedFor.current = null;
    descContext.current = {
      fields: baseDraft?.descriptionFields ?? null,
      template: descContext.current.template,
      branding: descContext.current.branding,
    };
    // Rebase rather than reset: a title the owner wrote survives a correction
    // to the card's set or number; everything they did not touch follows it.
    setState((prev) => {
      const next = rebaseListingDraftDefaults(prev, seedValues(), titleSync);
      if (changedDraftFields(prev.values, next.values).length > 0) setRebasedFromCard(true);
      return next;
    });
  }, [cardId, identityKey, seedValues, baseDraft, titleSync]);

  /**
   * Stage 2. Once per card IDENTITY, and only after the tab has been opened.
   *
   * REQUESTED vs APPLIED. The flag used to be set before the fetch and never
   * cleared, so a request cancelled by the cleanup (a refresh landing while it
   * was in flight) left the draft on the built-in defaults for good, with the
   * once-per-id flag blocking any replacement. Now the cleanup releases a
   * request that never applied, and only an applied one suppresses a repeat.
   */
  useEffect(() => {
    if (!enabled || !card || !baseDraft) return;
    const key = `${cardId ?? ''}::${identityKey}`;
    if (defaultsAppliedFor.current === key) return;
    if (defaultsRequestedFor.current === key) return;
    defaultsRequestedFor.current = key;

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
        defaultsAppliedFor.current = key;
        setState((prev) =>
          rebaseListingDraftDefaults(
            prev,
            {
              ...prev.defaults,
              title: seeded.title,
              descriptionHtml: seeded.descriptionHtml,
            },
            // So a clean description follows an edited TITLE rather than
            // re-appearing under the default headline.
            titleSync,
          ),
        );
      })
      .catch(() => {
        // The built-in DCM defaults already on screen are the right fallback,
        // and they are what the modal would fall back to as well. The request
        // flag is released so a later identity change can try again.
        if (!cancelled) defaultsRequestedFor.current = null;
      })
      .finally(() => {
        if (!cancelled) setLoadingDefaults(false);
      });

    return () => {
      cancelled = true;
      if (defaultsAppliedFor.current !== key) defaultsRequestedFor.current = null;
    };
  }, [enabled, card, cardId, identityKey, baseDraft, titleSync]);

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
    bodyEdited: state.bodyEdited,
    anyDirty: isListingDraftDirty(state),
    priceLabel: basePrice.label,
    loadingDefaults,
    rebasedFromCard,
    dismissRebaseNote,
    setField,
    resetField,
    initialDraft,
  };
}

export default useListingDraft;
