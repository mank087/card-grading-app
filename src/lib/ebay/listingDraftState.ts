/**
 * Session-only listing-draft state: values, their defaults, and which of them
 * the owner has actually changed.
 *
 * WHAT THIS IS FOR. The card-detail V2 "InstaList" tab lets an owner edit the
 * title, the description HTML, the item specifics and the price BEFORE opening
 * the eBay listing modal. Nothing is stored: no column, no migration, no
 * localStorage. The state lives in the page for as long as the page does, and
 * a reload drops it. That is the owner's stated design.
 *
 * WHY DIRTY TRACKING MATTERS. It is not a nicety for a "Reset" link. It is how
 * the tab stays ADDITIVE on the modal: only fields the owner actually edited
 * are carried across, so a modal opened from an untouched tab seeds exactly as
 * it does today — including the parts the tab cannot know about, like the
 * shipping summary that the modal's own shipping step folds into the
 * description. See `dirtyDraftValues`.
 *
 * Pure. No React, no network, no DOM.
 */

import type { ItemSpecific } from '@/lib/ebay/itemSpecifics';
import type { InstaListState } from '@/components/card-detail/useInstaListStatus';
import type { InitialListingDraft } from '@/lib/ebay/listingSeed';

export const LISTING_DRAFT_FIELDS = ['title', 'descriptionHtml', 'itemSpecifics', 'price'] as const;
export type ListingDraftField = (typeof LISTING_DRAFT_FIELDS)[number];

export interface ListingDraftValues {
  title: string;
  descriptionHtml: string;
  itemSpecifics: ItemSpecific[];
  price: string;
}

export interface ListingDraftState {
  values: ListingDraftValues;
  /** What a Reset returns a field to. Replaced when the async defaults land. */
  defaults: ListingDraftValues;
  dirty: Record<ListingDraftField, boolean>;
}

function sameSpecifics(a: ItemSpecific[], b: ItemSpecific[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((spec, i) => {
    const other = b[i];
    return (
      spec.name === other.name &&
      String(spec.value ?? '') === String(other.value ?? '') &&
      !!spec.required === !!other.required
    );
  });
}

function sameValue(field: ListingDraftField, a: ListingDraftValues, b: ListingDraftValues): boolean {
  if (field === 'itemSpecifics') return sameSpecifics(a.itemSpecifics, b.itemSpecifics);
  return a[field] === b[field];
}

export function createListingDraftState(defaults: ListingDraftValues): ListingDraftState {
  return {
    values: defaults,
    defaults,
    dirty: { title: false, descriptionHtml: false, itemSpecifics: false, price: false },
  };
}

/**
 * Write one field. "Dirty" is derived by comparison, not by the fact that a
 * keystroke happened, so typing a character and deleting it again leaves the
 * field clean — and therefore leaves the modal's own seeding in charge of it.
 */
export function setListingDraftField<K extends ListingDraftField>(
  state: ListingDraftState,
  field: K,
  value: ListingDraftValues[K],
): ListingDraftState {
  const values = { ...state.values, [field]: value } as ListingDraftValues;
  return {
    ...state,
    values,
    dirty: { ...state.dirty, [field]: !sameValue(field, values, state.defaults) },
  };
}

/**
 * How a title edit reaches the description.
 *
 * The standard description layout opens with a headline that REPEATS the
 * listing title, so the two must move together or the buyer reads one title in
 * the search result and a different one at the top of the page.
 */
export interface TitleSync {
  /** Rebuild the whole description from its fields with this title. */
  render: (title: string) => string;
  /** Swap only the headline inside a description the owner has edited. */
  retitle: (html: string, previousTitle: string, nextTitle: string) => string;
}

/**
 * Write the title AND keep the description's headline in step.
 *
 * Two paths, and the difference is whether the owner has written their own
 * description:
 *  - UNTOUCHED description: re-rendered in full from its fields, through the
 *    same builder that produced it. Type the default title back and it renders
 *    identical to the default again, so the field goes clean on its own.
 *  - HAND-EDITED description: only the headline element is swapped. Everything
 *    else they wrote survives, which is the whole point.
 *
 * A title edit therefore usually makes the DESCRIPTION dirty too — deliberately.
 * The pair is carried into the modal together and is already consistent, rather
 * than the modal re-seeding a description that names the old title.
 */
export function setListingDraftTitle(
  state: ListingDraftState,
  nextTitle: string,
  sync: TitleSync,
): ListingDraftState {
  const previousTitle = state.values.title;
  if (previousTitle === nextTitle) return state;

  const descriptionHtml = state.dirty.descriptionHtml
    ? sync.retitle(state.values.descriptionHtml, previousTitle, nextTitle)
    : sync.render(nextTitle);

  const values: ListingDraftValues = { ...state.values, title: nextTitle, descriptionHtml };
  return {
    ...state,
    values,
    dirty: {
      ...state.dirty,
      title: values.title !== state.defaults.title,
      descriptionHtml: values.descriptionHtml !== state.defaults.descriptionHtml,
    },
  };
}

/**
 * Reset the title, and let the description follow it back.
 *
 * Routed through `setListingDraftTitle` on purpose: a description that was only
 * ever changed BY the title returns to its default, while one the owner wrote
 * themselves keeps their words and just gets its headline put back.
 */
export function resetListingDraftTitle(
  state: ListingDraftState,
  sync: TitleSync,
): ListingDraftState {
  return setListingDraftTitle(state, state.defaults.title, sync);
}

/** Put one field back to its default. */
export function resetListingDraftField(
  state: ListingDraftState,
  field: ListingDraftField,
): ListingDraftState {
  return {
    ...state,
    values: { ...state.values, [field]: state.defaults[field] } as ListingDraftValues,
    dirty: { ...state.dirty, [field]: false },
  };
}

/**
 * Swap in a new set of defaults — the account's saved template and grade label
 * arrive from a fetch after the first render, so the "default" title and
 * description change under the owner's feet.
 *
 * A field the owner has already edited KEEPS their text and stays dirty; a
 * clean field follows the new default. Same rule the modal's own
 * `prev === defaultTitle` guard applies, expressed once.
 */
export function rebaseListingDraftDefaults(
  state: ListingDraftState,
  defaults: ListingDraftValues,
): ListingDraftState {
  const values = { ...state.values };
  for (const field of LISTING_DRAFT_FIELDS) {
    if (!state.dirty[field]) (values as Record<string, unknown>)[field] = defaults[field];
  }
  const dirty = { ...state.dirty };
  for (const field of LISTING_DRAFT_FIELDS) {
    dirty[field] = state.dirty[field] && !sameValue(field, values, defaults);
  }
  return { values, defaults, dirty };
}

export function isListingDraftDirty(state: ListingDraftState): boolean {
  return LISTING_DRAFT_FIELDS.some((f) => state.dirty[f]);
}

/**
 * The edited fields ONLY, shaped for `EbayListingModal`'s `initialDraft`.
 *
 * An absent key means "I did not touch this", and the modal keeps its own
 * default for it. This is the whole additive contract: an owner who opens the
 * tab, looks, and presses "Begin listing" hands over `{}`, and the modal seeds
 * byte-for-byte as it did before the tab existed.
 */
export function dirtyDraftValues(state: ListingDraftState): InitialListingDraft {
  const out: InitialListingDraft = {};
  if (state.dirty.title) out.title = state.values.title;
  if (state.dirty.descriptionHtml) out.descriptionHtml = state.values.descriptionHtml;
  if (state.dirty.itemSpecifics) out.itemSpecifics = state.values.itemSpecifics;
  if (state.dirty.price) out.price = state.values.price;
  return out;
}

/* ── the locked rule ───────────────────────────────────────────────────── */

export interface ListingLock {
  /** Every field is disabled and greyed. */
  locked: boolean;
  /** Shown beside the fields when locked; null when they are editable. */
  note: string | null;
  /** Whether "Begin listing" is offered at all. */
  canBegin: boolean;
}

const LOCK_NOTE = 'This listing is live on eBay — details are locked here. Edit it on eBay.';
const SOLD_NOTE = 'This card is marked as sold. Listing details are locked.';

/**
 * One rule, read by the whole tab.
 *
 * 'listed' and 'sold' lock. 'checking' does not lock but cannot begin either —
 * offering "Begin listing" before we know whether the card is already listed is
 * how a duplicate listing gets made. 'unverified' leaves the fields editable
 * and DOES offer the flow, because `EbayListingModal` re-runs the very same
 * `/api/ebay/listing/check` when it opens and blocks a duplicate itself
 * (EbayListingModal.tsx:627-671) — the same reasoning `InstaListPanel` already
 * documents for the hero.
 */
export function listingLockFor(state: InstaListState): ListingLock {
  switch (state) {
    case 'listed':
      return { locked: true, note: LOCK_NOTE, canBegin: false };
    case 'sold':
      return { locked: true, note: SOLD_NOTE, canBegin: false };
    case 'checking':
      return { locked: false, note: null, canBegin: false };
    case 'unlisted':
    case 'unverified':
      return { locked: false, note: null, canBegin: true };
    case 'not-owner':
    default:
      return { locked: true, note: null, canBegin: false };
  }
}
