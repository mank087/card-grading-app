/**
 * The account-defaults half of a listing seed, as PURE functions.
 *
 * WHY THIS FILE EXISTS. `buildListingDraft` assembles a card into a title, a
 * description and item specifics without touching the network. But that is not
 * the whole default: an account (or an enterprise store) can save a
 * `titleGradeLabel` that replaces "DCM" in the title, and a
 * `descriptionTemplate` that replaces the standard description layout. Those
 * arrive from `GET /api/ebay/listing-defaults`, and until now the logic that
 * folds them into the draft lived inline in `EbayListingModal`'s open effect.
 *
 * The card-detail V2 "InstaList" tab renders the SAME defaults before the modal
 * is ever opened. Two copies of this fold would be free to drift, and the whole
 * point of the tab is that what you edit there is what the modal publishes — so
 * the fold moved here and both callers call it.
 *
 * Nothing here fetches. The caller supplies the payload it already has (the
 * modal fetches it in its open effect; the tab uses ./listingSeedFetch), which
 * is also what keeps this file unit-testable in the node environment.
 */

import { buildEbayTitle } from '@/lib/ebay/titleBuilder';
import { buildKeywordSentence } from '@/lib/ebay/listingFields';
import {
  buildListingHeadline,
  generateHtmlDescription,
  renderDescriptionTemplate,
  type ListingDescriptionFields,
  type ListingBranding,
} from '@/lib/ebay/listingDescription';
import {
  resolveActiveDefaults,
  type ListingDefaultsPayload,
  type ListingDefaultsRow,
  type ListingDraft,
} from '@/lib/ebay/listingDraft';
import { type ItemSpecific } from '@/lib/ebay/itemSpecifics';
import { resolveCardValue } from '@/lib/pricing/resolveCardValue';

/** eBay's hard cap on a listing title. The modal's input enforces the same. */
export const EBAY_TITLE_MAX_LENGTH = 80;

/**
 * What the saved defaults do to a draft.
 *
 * `relabelledTitle` and `descriptionFieldsPatch` are null when the account has
 * no grade label, which is the built-in "DCM" case — the draft is already
 * correct and the caller must not write anything.
 */
export interface SeedDefaultsResolution {
  /** The row that applies: org when the caller's org graded the card, else personal. */
  activeDefaults: ListingDefaultsRow | null;
  /** The saved description template, or null for the standard layout. */
  template: string | null;
  /** The store's own word for a grade ("KINGS"), or null for the built-in "DCM". */
  gradeLabel: string | null;
  /** The title re-rendered with that grade label; null when there is none. */
  relabelledTitle: string | null;
  /** The description fields the grade label changes; null when there is none. */
  descriptionFieldsPatch: { gradeLabel: string; keywords: string } | null;
}

/**
 * Fold a fetched listing-defaults payload into an already-built draft.
 *
 * Lifted verbatim out of `EbayListingModal`'s open effect (the block that ran
 * after `Promise.all([loadLogosForCard, /api/ebay/listing-defaults])`), so the
 * modal's output is unchanged: it now calls this and writes the same two
 * pieces of state under the same `prev === defaultTitle` guard.
 */
export function resolveSeedDefaults(
  card: unknown,
  defaults: ListingDefaultsPayload | null | undefined,
  draft: Pick<ListingDraft, 'titleInput' | 'fields'>,
): SeedDefaultsResolution {
  const activeDefaults = resolveActiveDefaults(card, defaults ?? null);
  const template = activeDefaults?.descriptionTemplate || null;
  const gradeLabel = activeDefaults?.titleGradeLabel || null;

  if (!gradeLabel) {
    return {
      activeDefaults,
      template,
      gradeLabel: null,
      relabelledTitle: null,
      descriptionFieldsPatch: null,
    };
  }

  return {
    activeDefaults,
    template,
    gradeLabel,
    relabelledTitle: buildEbayTitle({ ...draft.titleInput, gradeLabel }),
    descriptionFieldsPatch: {
      gradeLabel,
      keywords: buildKeywordSentence(draft.fields, gradeLabel, draft.fields.grade),
    },
  };
}

/**
 * The fully-defaulted seed: what the modal's "Listing Details" step shows once
 * its async fetch has landed and before the seller types anything.
 *
 * ONE DELIBERATE DIFFERENCE from the modal, and it is not a drift:
 * `shippingSummary` is empty here. The shipping block of the description is
 * rendered from the modal's SHIPPING STEP, which does not exist outside the
 * modal — the tab has no shipping form to read. The modal's own regeneration
 * effect fills it in as soon as it opens, and the tab only ever hands the modal
 * a description the owner actually EDITED (see `applyInitialDraft`), so a
 * default description is still assembled by the modal, shipping and all.
 */
export function buildSeededDefaults(
  draft: ListingDraft,
  resolution: SeedDefaultsResolution,
  branding: ListingBranding | null,
): { title: string; descriptionHtml: string; descriptionFields: ListingDescriptionFields } {
  const title = resolution.relabelledTitle ?? draft.title;
  const descriptionFields: ListingDescriptionFields = resolution.descriptionFieldsPatch
    ? { ...draft.descriptionFields, ...resolution.descriptionFieldsPatch, title }
    : draft.descriptionFields;

  const descriptionHtml = resolution.template
    ? renderDescriptionTemplate(resolution.template, descriptionFields, branding)
    : generateHtmlDescription(descriptionFields, branding);

  return { title, descriptionHtml, descriptionFields };
}

/**
 * Re-render a description for a NEW title, through the same builder that made
 * it: the saved template when the account has one, the standard layout
 * otherwise.
 *
 * The standard layout opens with a plain-text headline that repeats the listing
 * title, so a title the owner edits and a description that still names the old
 * one would go out disagreeing with each other on the buyer's screen.
 */
export function renderDescriptionForTitle(
  fields: ListingDescriptionFields,
  title: string,
  template: string | null,
  branding: ListingBranding | null,
): string {
  const next = { ...fields, title };
  return template
    ? renderDescriptionTemplate(template, next, branding)
    : generateHtmlDescription(next, branding);
}

/**
 * Swap the title heading inside a description the owner has ALREADY
 * hand-edited, without touching anything else they wrote.
 *
 * A full re-render would throw their edits away, so this replaces exactly the
 * headline element — built by `buildListingHeadline`, the same function that
 * produced it — and only its FIRST occurrence.
 *
 * Three cases it deliberately leaves alone, each returning the html unchanged:
 *  - the old headline is not in there (they deleted or rewrote it themselves),
 *  - the title did not actually change,
 *  - the description came from a saved TEMPLATE, which has no `{title}` merge
 *    field and therefore no headline to keep in step.
 */
export function retitleDescriptionHtml(
  html: string,
  previousTitle: string,
  nextTitle: string,
): string {
  if (previousTitle === nextTitle) return html;
  const previous = buildListingHeadline(previousTitle);
  if (!previous || !html.includes(previous)) return html;
  return html.replace(previous, buildListingHeadline(nextTitle));
}

/**
 * The suggested asking price, and the line that says where it came from.
 *
 * Lifted verbatim out of `EbayListingModal`'s open effect so the InstaList tab
 * cannot show a different number from the modal it feeds. `resolveCardValue` is
 * the shared value chain every surface reads (the collection, the portfolio,
 * mobile), so all four agree by construction.
 *
 * An unpriced card resolves to an EMPTY string, not "0.00" — the seller types
 * their own, and a pre-filled zero would publish as a one-cent listing.
 */
export function seedListingPrice(card: unknown): { price: string; label: string | null } {
  const { value, source } = resolveCardValue(card as never);
  if (!(value > 0)) return { price: '', label: null };
  return {
    price: value.toFixed(2),
    label:
      source === 'ebay-median'
        ? 'Suggested from recent eBay sales'
        : 'Suggested from your portfolio value',
  };
}

/**
 * The draft a caller can hand the modal. Every field is optional, and a field
 * that is ABSENT means "I did not edit this — use your own default".
 */
export interface InitialListingDraft {
  title?: string;
  descriptionHtml?: string;
  itemSpecifics?: ItemSpecific[];
  price?: string;
}

export interface ApplyInitialDraftInput {
  defaultTitle: string;
  defaultDescriptionHtml: string;
  defaultItemSpecifics: ItemSpecific[];
  defaultPrice: string;
  defaultPriceLabel: string | null;
  initialDraft?: InitialListingDraft | null;
}

export interface ApplyInitialDraftResult {
  title: string;
  descriptionHtml: string;
  itemSpecifics: ItemSpecific[];
  price: string;
  /** `seededPriceLabel`: cleared when the caller supplied its own price. */
  priceLabel: string | null;
  /**
   * True when the description came from the caller. The modal must then treat
   * it as HAND-EDITED — i.e. leave `autoDescriptionRef` pointing at the
   * generated default, so the regeneration effect's `prev !==
   * autoDescriptionRef.current` guard declines to overwrite it.
   */
  descriptionIsUserEdited: boolean;
}

/**
 * Override precedence for the modal's seed, extracted so it can be tested
 * without rendering a 3,500-line modal.
 *
 * The rule is one line: a provided field wins, an absent field keeps the
 * default. With `initialDraft` absent (or empty) the result is the defaults,
 * unchanged object identity included — which is the additive guarantee.
 *
 * ORDERING. This runs on the SYNCHRONOUS seed, i.e. before the async defaults
 * land, and the grade-label re-render that follows is already guarded by
 * `prev === defaultTitle`. So an overridden title is never clobbered, while a
 * title that merely equals the default still picks the store's label up. The
 * tab produces its overrides from the same `resolveSeedDefaults`, so the two
 * agree either way.
 */
export function applyInitialDraft(input: ApplyInitialDraftInput): ApplyInitialDraftResult {
  const d = input.initialDraft;
  const hasTitle = typeof d?.title === 'string' && d.title.length > 0;
  const hasDescription = typeof d?.descriptionHtml === 'string' && d.descriptionHtml.length > 0;
  const hasSpecifics = Array.isArray(d?.itemSpecifics) && d!.itemSpecifics!.length > 0;
  const hasPrice = typeof d?.price === 'string' && d.price.length > 0;

  return {
    title: hasTitle ? d!.title!.slice(0, EBAY_TITLE_MAX_LENGTH) : input.defaultTitle,
    descriptionHtml: hasDescription ? d!.descriptionHtml! : input.defaultDescriptionHtml,
    itemSpecifics: hasSpecifics ? d!.itemSpecifics! : input.defaultItemSpecifics,
    price: hasPrice ? d!.price! : input.defaultPrice,
    priceLabel: hasPrice ? null : input.defaultPriceLabel,
    descriptionIsUserEdited: hasDescription,
  };
}
