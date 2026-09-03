/**
 * One card → the seed of an eBay listing.
 *
 * Pure field assembly, lifted out of EbayListingModal's open effect: resolver →
 * per-category title → description fields + HTML → item specifics + category.
 * The modal seeds its form from this; the bulk review list (Part 2 Phase 1)
 * calls it once per row to render N drafts without mounting N modals.
 *
 * Nothing here touches the network or React — the caller supplies the saved
 * defaults and the org branding it has already fetched.
 */

import { getCardLabelData } from '@/lib/useLabelData';
import { getConditionFromGrade as getConditionLabel } from '@/lib/conditionAssessment';
import { buildEbayTitle, type EbayTitleInput } from '@/lib/ebay/titleBuilder';
import {
  resolveListingFields,
  listingDetailRows,
  buildKeywordSentence,
  type ListingFields,
} from '@/lib/ebay/listingFields';
import {
  generateHtmlDescription,
  renderDescriptionTemplate,
  type ListingDescriptionFields,
  type ListingBranding,
} from '@/lib/ebay/listingDescription';
import {
  mapCardToItemSpecifics,
  getCategoryForCardType,
  prefillAspectValue,
  type ItemSpecific,
} from '@/lib/ebay/itemSpecifics';

/** One row of GET /api/ebay/listing-defaults (personal or org scope). */
export interface ListingDefaultsRow {
  descriptionTemplate: string | null;
  shippingDefaults: Record<string, unknown> | null;
  titleGradeLabel?: string | null;
  /** eBay business policies: opt-in flag + the seller's three defaults. */
  useBusinessPolicies?: boolean;
  defaultShippingPolicyId?: string | null;
  defaultReturnPolicyId?: string | null;
  defaultPaymentPolicyId?: string | null;
}

/** The whole GET /api/ebay/listing-defaults payload. */
export interface ListingDefaultsPayload {
  personal: ListingDefaultsRow | null;
  org: ListingDefaultsRow | null;
  orgRole: 'owner' | 'member' | null;
  orgId: string | null;
}

/** An aspect as returned by GET /api/ebay/aspects. */
export interface EbayAspect {
  localizedAspectName: string;
  aspectConstraint?: { aspectRequired?: boolean };
}

export interface BuildListingDraftOptions {
  cardType?: string;
  /**
   * Saved defaults payload. Only the description template and the title grade
   * label are read here; the shipping defaults belong to the form, not the
   * draft. Pass the whole payload and the cross-org guard is applied for you.
   */
  listingDefaults?: ListingDefaultsPayload | null;
  /** Org name/colour for the description banner (enterprise cards). */
  branding?: ListingBranding | null;
  /** eBay's required + recommended aspects, when already fetched. */
  aspects?: EbayAspect[] | null;
  /** Rendered shipping summary, when the shipping form is already known. */
  shippingSummary?: string;
}

export interface ListingDraft {
  title: string;
  descriptionFields: ListingDescriptionFields;
  descriptionHtml: string;
  itemSpecifics: ItemSpecific[];
  categoryId: string;
  /**
   * The token bag the title was built from. Kept so a caller that learns the
   * org grade label late (the modal's async defaults fetch) can re-render just
   * the title without rebuilding — and without clobbering — the rest.
   */
  titleInput: EbayTitleInput;
  /** The shared resolver output every surface above was built from. */
  fields: ListingFields;
}

/**
 * Which saved-defaults row applies to a card: the org row only when the
 * CALLER's org is the same org that graded the card (a member of org A opening
 * a card graded by org B gets personal defaults, not A's template on B's card).
 */
export function resolveActiveDefaults(
  card: any,
  defaults: ListingDefaultsPayload | null | undefined
): ListingDefaultsRow | null {
  if (!defaults) return null;
  return card?.org_id && defaults.orgId === card.org_id && defaults.org
    ? defaults.org
    : defaults.personal ?? null;
}

/**
 * Append eBay's fetched aspects that we haven't already pre-filled, seeded from
 * the resolver. These used to arrive BLANK for the seller to type, which is how
 * Parallel/Variety ended up empty on nearly every card — fill anything the
 * resolver holds a real value for, and leave the row editable.
 */
export function mergeAspectsIntoSpecifics(
  existing: ItemSpecific[],
  aspects: EbayAspect[],
  fields: ListingFields
): ItemSpecific[] {
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
  const additional: ItemSpecific[] = [];
  for (const aspect of aspects) {
    const aspectName = aspect.localizedAspectName;
    if (!existingNames.has(aspectName.toLowerCase())) {
      additional.push({
        name: aspectName,
        value: prefillAspectValue(aspectName, fields),
        required: aspect.aspectConstraint?.aspectRequired || false,
        editable: true,
      });
    }
  }
  return additional;
}

/** A sub-grade, or null when the card carries none for that area. */
function subgradeValue(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function buildListingDraft(card: any, opts: BuildListingDraftOptions = {}): ListingDraft {
  const cardType = opts.cardType || 'sports';

  // Default title: per-category token order (see titleBuilder.ts), fed by the
  // shared field resolver so the title, the item specifics and the description
  // can never disagree about the card. buildEbayTitle keeps the grade tail
  // intact within eBay's 80-char limit and dedupes tokens.
  const labelData = getCardLabelData(card);
  const fields = resolveListingFields(card, cardType);
  // null means the card genuinely has no numeric grade (Authentic / Altered).
  // It used to fall back to 0, which published as the title "DCM 0" and a
  // description reading "Authentic Poor" over four zero sub-grades.
  const gradeCandidate = Number(labelData.grade ?? fields.grade);
  const grade: number | null =
    Number.isFinite(gradeCandidate) && gradeCandidate > 0 ? Math.round(gradeCandidate) : null;
  const cardInfo = card.conversational_card_info || {};

  // Get condition label. With no number there is no ladder to read it off, so
  // only the card's own label (if any) is used — never getConditionLabel(0).
  const conditionLabel = labelData.condition || (grade !== null ? getConditionLabel(grade) : '');

  // Primary subject (player/character/featured)
  const primaryName = labelData.primaryName || card.featured || card.pokemon_featured || card.card_name || '';

  // Set/Subset name
  const setName = labelData.setName || cardInfo.set_name || card.card_set;

  // Card number if available
  const cardNumber = labelData.cardNumber || cardInfo.card_number || card.card_number;

  const activeDefaults = resolveActiveDefaults(card, opts.listingDefaults);
  const gradeLabel = activeDefaults?.titleGradeLabel || null;
  const template = activeDefaults?.descriptionTemplate || null;
  const branding = opts.branding ?? null;

  // Title inputs come from the resolver, except the label-data overrides
  // (name / set / number / year), which are the seller's own corrections
  // and must win over the raw card row.
  const titleInput: EbayTitleInput = {
    name: primaryName,
    setName: setName || fields.setName,
    subset: labelData.subset || fields.subset,
    cardNumber: cardNumber ? `#${cardNumber}` : (fields.cardNumber ? `#${fields.cardNumber}` : ''),
    year: labelData.year || fields.year,
    serialNumbering: fields.serialDenominator,
    // '' makes buildEbayTitle emit the "{label} Authentic" tail.
    grade: grade ?? '',
    condition: conditionLabel,
    category: fields.category,
    manufacturer: fields.manufacturer,
    parallel: fields.parallel,
    rarity: fields.rarity,
    finish: fields.finish,
    rookie: fields.rookie,
    autograph: fields.autograph,
    team: fields.team,
    sport: fields.sport,
    gameWord: fields.gameWord,
    language: fields.language,
  };
  const title = buildEbayTitle(gradeLabel ? { ...titleInput, gradeLabel } : titleInput);

  const weightedScores = card.conversational_weighted_sub_scores || {};
  const subScores = card.conversational_sub_scores || {};
  const overview = card.conversational_final_grade_summary || card.conversational_summary || '';

  const descriptionFields: ListingDescriptionFields = {
    primaryName,
    setName: setName || '',
    cardNumber: cardNumber || '',
    grade,
    conditionLabel,
    overview,
    subgrades: {
      centering: subgradeValue(weightedScores.centering ?? subScores.centering?.weighted),
      corners: subgradeValue(weightedScores.corners ?? subScores.corners?.weighted),
      edges: subgradeValue(weightedScores.edges ?? subScores.edges?.weighted),
      surface: subgradeValue(weightedScores.surface ?? subScores.surface?.weighted),
    },
    serial: card.org_serial_display || card.serial || 'N/A',
    // v2: the same resolver the title and the item specifics read, so the
    // three surfaces can never disagree about the card.
    title,
    fields,
    details: listingDetailRows(fields),
    keywords: buildKeywordSentence(fields, gradeLabel || 'DCM', fields.grade),
    designation: fields.designation,
    shippingSummary: opts.shippingSummary ?? '',
    ...(gradeLabel ? { gradeLabel } : {}),
  };

  const descriptionHtml = template
    ? renderDescriptionTemplate(template, descriptionFields, branding)
    : generateHtmlDescription(descriptionFields, branding);

  // Item specifics, pre-filled from card data
  const categoryId = getCategoryForCardType(cardType);
  const itemSpecifics = mapCardToItemSpecifics(card, cardType);
  if (opts.aspects?.length) {
    itemSpecifics.push(...mergeAspectsIntoSpecifics(itemSpecifics, opts.aspects, fields));
  }

  return { title, descriptionFields, descriptionHtml, itemSpecifics, categoryId, titleInput, fields };
}
