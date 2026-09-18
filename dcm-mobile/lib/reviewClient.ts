/**
 * The small, pure part of the "Confirm your card details" flow that both the web
 * dialog and the mobile sheet run on the device.
 *
 * Dependency-free on purpose: this file is copied byte for byte to
 * dcm-mobile/lib/reviewClient.ts, and a web test fails if the two drift
 * (src/lib/identity/reviewClient.test.ts). Change it here, then copy it.
 *
 * Nothing here decides what a card is. The server builds the review state
 * (src/lib/identity/reviewPrefill.ts, GET /api/cards/[id]/identity-review); these
 * helpers only compare, merge and label what it sent.
 */

/** Where the value in the box came from. */
export type ReviewFieldOrigin =
  /** First look transcribed it from the photo. */
  | 'read_from_card'
  /** First look recognized or inferred it and it filled a blank. Needs checking. */
  | 'suggested'
  /** The value the grading run already stored on the card. */
  | 'from_grading'
  /** Nothing is known. The box is empty and stays empty unless the owner types. */
  | 'empty';

/** First look's own source for a value. Same union as FieldSource in firstLook.ts. */
export type ReviewFieldSource = 'printed' | 'recognized' | 'inferred' | 'unknown';

export interface ReviewSuggestion {
  value: string;
  origin: ReviewFieldOrigin;
  /** First look's own source for this value. */
  source: ReviewFieldSource;
  /** Text to show when it differs from `value`, e.g. the season "1995-96". */
  displayValue?: string;
}

export interface ReviewField {
  key: string;
  label: string;
  /** What the box is pre-filled with. '' when there is nothing to show. */
  value: string;
  /** What the card currently has stored. The save sends only fields that differ from this. */
  storedValue: string;
  origin: ReviewFieldOrigin;
  /** Show "Please check" and never treat this as confirmed-by-default evidence. */
  needsCheck: boolean;
  /** True when `value` is already a change to the card, before the owner types anything. */
  differsFromStored: boolean;
  /** Friendlier text for display only, e.g. "1995-96" behind the stored year "1995". */
  displayValue?: string;
  /** Set when DCM's own catalog confirms the value in the box, e.g. "Matches the Pokémon catalog (Lost Origin)". */
  catalogNote?: string;
  /** First look's competing value, offered as one tap. */
  suggestion?: ReviewSuggestion;
}

export interface ReviewAlternative {
  differs_in: string;
  value: string;
  what_would_settle_it: string;
}

export interface ReviewCandidate {
  id: string;
  name: string;
  setName: string;
  hasPrice: boolean;
  /** True for the plainest product in the family, the picker's "Base" row. */
  isBase?: boolean;
  /** Print run of a serial-numbered version (249 for "/249"), when the catalog knows it. */
  serialDenominator?: number | null;
  /** Ungraded market price, for telling versions apart in the picker. */
  rawPrice?: number | null;
}

/** GET /api/cards/[id]/identity-review, as the dialog and the mobile sheet read it. */
export interface IdentityReviewState {
  card_id: string;
  mode: 'popup' | 'banner' | 'none';
  /** 'disabled' when the server kill switch (IDENTITY_CONFIRM_DISABLED=1) is on. */
  reason: string;
  locked: boolean;
  identity_revision: number | null;
  identity_confirmed: boolean;
  dismissed: boolean;
  category: string | null;
  is_sports: boolean;
  fields: ReviewField[];
  alternatives: ReviewAlternative[];
  first_look_present: boolean;
  candidates: ReviewCandidate[];
  candidates_available: boolean;
  candidates_error: boolean;
  suggested_candidate_id: string;
  /** The product the owner already picked, if any. Re-saving the same pick is skipped. */
  current_product_id?: string | null;
  /** The product Market Pricing is matched to right now, any category. null = no match. */
  pricing_match?: { product_name: string; picked_by_owner: boolean } | null;
}

/** Sentinel for "None of these / not sure". Never sent to the pricing API. */
export const NO_CANDIDATE = '__none__';

/** Which field an alternative from first look would change. */
export const REVIEW_ALTERNATIVE_FIELD: Record<string, string> = {
  set_name: 'card_set',
  year: 'release_date',
  parallel: 'parallel_type',
  card_number: 'card_number',
  insert_or_subset: 'subset_variant',
};

export const REVIEW_ALTERNATIVE_LABEL: Record<string, string> = {
  set_name: 'Set',
  year: 'Year',
  parallel: 'Parallel',
  card_number: 'Card number',
  insert_or_subset: 'Insert or subset',
  language: 'Language',
};

/** Matches the details route's per-field validation so a save cannot 400 on length. */
export const REVIEW_MAX_LENGTH: Record<string, number> = {
  release_date: 4,
  serial_numbering: 20,
  card_number: 50,
  parallel_type: 100,
  subset_variant: 100,
};

/**
 * "Did this actually change?" Trimmed and case-folded, exactly what the save
 * service does. Punctuation is NOT ignored: correcting "116086" to "116/086" is
 * a real correction the owner wants written.
 */
export function sameIdentityValue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The changed fields a confirmation should PATCH: the value in the box vs the stored value. */
export function changedFieldPayload(
  fields: ReviewField[],
  values: Record<string, string>,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    const next = (values[field.key] ?? field.value ?? '').trim();
    if (!sameIdentityValue(next, field.storedValue)) payload[field.key] = next;
  }
  return payload;
}

/**
 * The parallel a catalog listing names, for filling the Parallel box when the
 * owner picks a version: "Joe Mixon [Autograph Jersey Mirror Red] #214" gives
 * "Autograph Jersey Mirror Red", and a listing with no bracket is the base card.
 */
export function parallelFromListingName(name: string): string {
  const bracket = /\[([^\]]+)\]/.exec(name || '');
  return bracket ? bracket[1].trim() : 'Base';
}

/**
 * Adopt a later answer's field metadata (a background first look, or a reload
 * after a conflict). The incoming list decides which fields exist and in what
 * order; its metadata wins.
 */
export function mergeReviewFields(previous: ReviewField[], incoming: ReviewField[]): ReviewField[] {
  const byKey = new Map(previous.map(f => [f.key, f]));
  return incoming.map(next => ({ ...(byKey.get(next.key) || next), ...next }));
}

/**
 * Take the incoming values for every box the owner has NOT typed in. A
 * background answer arriving mid-edit must never eat their work.
 */
export function mergeReviewValues(
  previous: Record<string, string>,
  incoming: ReviewField[],
  touched: Record<string, true | undefined>,
): Record<string, string> {
  const merged = { ...previous };
  for (const next of incoming) {
    if (!touched[next.key]) merged[next.key] = next.value;
  }
  return merged;
}

/** True when the owner has moved anything away from what the dialog opened with. */
export function reviewOwnerEdited(
  fields: ReviewField[],
  values: Record<string, string>,
  candidateId: string,
  defaultCandidateId: string,
): boolean {
  return fields.some(f => (values[f.key] ?? '') !== (f.value ?? '')) || candidateId !== defaultCandidateId;
}

/**
 * Whether a saved confirmation must also POST the version pick to
 * /api/pricing/dcm-select. Re-posting the pick the card already has would only
 * clear and refetch its prices, so it is skipped unless this save changed the
 * identity (which clears the pick on the server).
 */
export function versionPickNeedsSaving(opts: {
  isSports: boolean;
  candidateId: string;
  currentProductId?: string | null;
  pricingInvalidated?: boolean;
}): boolean {
  if (!opts.isSports || !opts.candidateId || opts.candidateId === NO_CANDIDATE) return false;
  const unchanged = opts.candidateId === opts.currentProductId && opts.pricingInvalidated !== true;
  return !unchanged;
}

/**
 * The collection's "Confirm details" rule, minus the item-type check (each app
 * adds that from its own copy of itemType.ts): graded, not sold, and never
 * confirmed or confirmed at an older identity revision.
 */
export function identityConfirmationPending(row: {
  ownership_status?: string | null;
  conversational_whole_grade?: number | null;
  conversational_decimal_grade?: number | null;
  identity_confirmed_revision?: number | null;
  identity_revision?: number | null;
}): boolean {
  if (row.ownership_status === 'sold') return false;
  if (!(Number(row.conversational_whole_grade ?? row.conversational_decimal_grade ?? 0) > 0)) return false;
  const confirmed = row.identity_confirmed_revision;
  return confirmed === null || confirmed === undefined || Number(confirmed) < Number(row.identity_revision ?? 0);
}
