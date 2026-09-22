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
  /**
   * TRUE ONLY WHEN THE OWNER WROTE THE DESCRIPTION BODY THEMSELVES.
   *
   * `dirty.descriptionHtml` answers "does this differ from the default?", which
   * a TITLE edit also makes true — the headline repeats the title, so the
   * rendered HTML changes even though nobody touched the body. Handing that
   * HTML to the modal made it look hand-authored, and the modal's regeneration
   * guard then froze the description for the rest of the flow: later title
   * changes, the shipping/returns summary and a template's `{shippingSummary}`
   * all stopped following (review 2026-09-22, finding 4).
   *
   * So authorship is tracked separately from difference. Only a write to the
   * description field itself sets this, and only a state carrying it hands the
   * modal an HTML body. A title-only edit carries the TITLE, and the modal
   * regenerates the description from it through its normal path.
   */
  bodyEdited: boolean;
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
    bodyEdited: false,
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
  const differs = !sameValue(field, values, state.defaults);
  return {
    ...state,
    values,
    dirty: { ...state.dirty, [field]: differs },
    // A write to the description field IS authorship — and typing it back to
    // the default un-authors it, exactly as the dirty flag un-sets.
    bodyEdited: field === 'descriptionHtml' ? differs : state.bodyEdited,
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
 * WHAT A TITLE EDIT DOES **NOT** DO: it does not make the description
 * hand-authored. The tab's own preview is re-rendered so the reader sees the
 * new headline, but `bodyEdited` stays false, so `dirtyDraftValues` carries the
 * TITLE alone and the modal regenerates the description itself — with the
 * shipping summary and the saved template that only the modal knows about
 * (review 2026-09-22, finding 4).
 */
export function setListingDraftTitle(
  state: ListingDraftState,
  nextTitle: string,
  sync: TitleSync,
): ListingDraftState {
  const previousTitle = state.values.title;
  if (previousTitle === nextTitle) return state;

  const descriptionHtml = state.bodyEdited
    ? sync.retitle(state.values.descriptionHtml, previousTitle, nextTitle)
    : sync.render(nextTitle);

  const values: ListingDraftValues = { ...state.values, title: nextTitle, descriptionHtml };
  return {
    ...state,
    values,
    dirty: {
      ...state.dirty,
      title: values.title !== state.defaults.title,
      // Still derived by comparison, so a title typed back to the default
      // renders the default description again and the field goes clean. It is
      // `bodyEdited`, not this flag, that decides what the modal receives.
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
    // Putting the body back to its default gives up authorship of it.
    bodyEdited: field === 'descriptionHtml' ? false : state.bodyEdited,
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
  /**
   * Optional, and the reason it exists: when the owner has edited the TITLE but
   * not the body, the description is clean and therefore follows the new
   * default — which is rendered with the DEFAULT title. Without this the tab's
   * preview would show the new template under the old headline. Given the sync,
   * the clean description is re-rendered for the title actually in the field.
   * Callers that pass nothing get the previous behaviour exactly.
   */
  sync?: TitleSync,
): ListingDraftState {
  const values = { ...state.values };
  for (const field of LISTING_DRAFT_FIELDS) {
    if (!state.dirty[field]) (values as Record<string, unknown>)[field] = defaults[field];
  }
  if (sync && !state.bodyEdited && values.title !== defaults.title) {
    values.descriptionHtml = sync.render(values.title);
  }
  const dirty = { ...state.dirty };
  for (const field of LISTING_DRAFT_FIELDS) {
    dirty[field] = state.dirty[field] && !sameValue(field, values, defaults);
  }
  // A description re-rendered for a dirty title differs from the new default
  // without being hand-authored; say so, so a Reset is still offered.
  dirty.descriptionHtml = state.bodyEdited
    ? dirty.descriptionHtml
    : values.descriptionHtml !== defaults.descriptionHtml;
  return { values, defaults, dirty, bodyEdited: state.bodyEdited };
}

/** Which fields differ between two draft states. Used to word a rebase note. */
export function changedDraftFields(
  before: ListingDraftValues,
  after: ListingDraftValues,
): ListingDraftField[] {
  return LISTING_DRAFT_FIELDS.filter((field) => !sameValue(field, before, after));
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
 *
 * THE DESCRIPTION IS GATED ON AUTHORSHIP, not on difference (finding 4): a body
 * the owner wrote is carried and the modal leaves it alone; a body that merely
 * followed a title edit is NOT carried, so the modal rebuilds it from the
 * carried title with its own shipping summary and template.
 */
export function dirtyDraftValues(state: ListingDraftState): InitialListingDraft {
  const out: InitialListingDraft = {};
  if (state.dirty.title) out.title = state.values.title;
  if (state.bodyEdited && state.dirty.descriptionHtml) {
    out.descriptionHtml = state.values.descriptionHtml;
  }
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
/**
 * The same rule, plus the eBay connection (review 2026-09-22, finding 2).
 *
 * WHY EDITING IS GATED ON CONNECTING. "Begin listing" for a disconnected
 * account does not open the modal: `EbayListingButton` sends the whole page to
 * `/ebay/connect`, and the draft is React state, so everything typed here is
 * gone the moment that navigation starts. Nothing can carry it across — the
 * design is session-only by decision, with no column and no localStorage — so
 * the honest move is to not invite the typing in the first place.
 *
 * So a disconnected owner gets the fields READ-ONLY, under one line that says
 * why and what unlocks them. The photos and the seeded preview still render;
 * there is nothing to lose in looking.
 *
 * `connected` is null while `/api/ebay/status` is still answering. Null does
 * NOT lock: a connected owner must never watch their own editor flash
 * read-only on every page view.
 */
export function listingEditGate(state: InstaListState, connected: boolean | null): ListingLock & {
  /** Show the connect step first, above the photos and the fields. */
  needsConnect: boolean;
} {
  const lock = listingLockFor(state);
  if (lock.locked || connected !== false) return { ...lock, needsConnect: false };
  return {
    locked: true,
    note: null,
    canBegin: lock.canBegin,
    needsConnect: true,
  };
}

export const CONNECT_TO_EDIT_NOTE =
  'Connect eBay to edit and list — editing is unlocked once connected.';

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
