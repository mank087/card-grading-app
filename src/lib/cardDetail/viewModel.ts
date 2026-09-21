/**
 * The normalised card-detail view model.
 *
 * Every shared V2 component reads this instead of the raw card row, so the
 * per-category adapters stay thin (plan §5). Pure: no fetching, no React, no
 * date-of-render assumptions.
 *
 * DERIVED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` as of 2026-09-21,
 * cross-checked against `src/app/sports/[id]/CardDetailClient.tsx`. The legacy
 * clients are frozen (docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md §4); mirror
 * any fix made there. Where each rule comes from:
 *
 *   identity                  getCardLabelData (2629) — the canonical label
 *                             text, shared with the print PDF. Legacy ALSO
 *                             builds a separate `cardInfo` object (2564-2626)
 *                             whose precedence differs between pokemon and
 *                             sports; that divergence is exactly why identity
 *                             here comes from the label data instead.
 *   images                    front_url / back_url (3219, 3222, 5045)
 *   grade + condition         labelData.grade / .condition (3176-3181)
 *   altered-authentic         labelData.isAlteredAuthentic (2915, 3176-3181)
 *   subgrades                 3399-3450 (weighted > weighted > weighted_score)
 *   non-gradable              3369-3371 (conversational_decimal_grade null +
 *                             conversational_weighted_summary.grade_cap_reason)
 *                             and 3343-3346 (dvg_grading.grading_status, with
 *                             'disabled' / 'N/A' statuses excluded)
 *   third-party slab          3238-3261 (slab_detected && slab_company)
 *   sold / ownership          2872-2882, 7066 (ownership_status, sold_at)
 *   org-branded               2869 (org_id)
 *   value                     resolveCardValue — NOTE: the legacy page does
 *                             not call it (it renders the PriceCharting lookup
 *                             result through assessValueTrust at 3498-3520).
 *                             Using the shared resolver here is a deliberate
 *                             decision of this plan, not a copy of legacy.
 */

import { getCardLabelData } from '@/lib/useLabelData';
import type { LabelData } from '@/lib/labelDataGenerator';
import { resolveCardValue, type PriceSource, type CardForPricing } from '@/lib/pricing/resolveCardValue';
import type { ValueTrustReason } from '@/lib/pricing/valueGuard';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';

/** The row as the detail page receives it. Selected with `*`, so it is wide. */
export interface CardDetailSource extends CardForPricing {
  id: string;
  user_id?: string | null;
  serial?: string | null;
  front_url?: string | null;
  back_url?: string | null;
  visibility?: 'public' | 'private' | null;
  org_id?: string | null;
  ownership_status?: 'owned' | 'sold' | 'archived' | null;
  sold_at?: string | null;
  sold_price?: number | null;
  sold_channel?: string | null;
  sold_note?: string | null;
  dcm_price_updated_at?: string | null;

  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
  conversational_sub_scores?: any;
  conversational_weighted_sub_scores?: any;
  conversational_limiting_factor?: string | null;
  conversational_weighted_summary?: { grade_cap_reason?: string | null } | null;
  conversational_final_grade_summary?: string | null;
  conversational_card_info?: any;

  dvg_grading?: any;

  slab_detected?: boolean | null;
  slab_company?: string | null;
  slab_grade?: string | null;
  slab_grade_description?: string | null;
  slab_cert_number?: string | null;

  [key: string]: any;
}

export type GradeStatus =
  /** A numeric DCM grade is on the record. */
  | 'graded'
  /** No numeric grade because the card cannot receive one. */
  | 'not-gradable'
  /** Authenticated but deliberately ungraded — the "A" label. */
  | 'altered-authentic'
  /** The grade is still being produced (the API's 429/poll state). */
  | 'in-progress'
  /** The inspection terminated without a reliable grade. */
  | 'incomplete-inspection'
  /** Nothing on the record says anything either way. */
  | 'ungraded';

export interface SubgradeSet {
  centering: number | null;
  corners: number | null;
  edges: number | null;
  surface: number | null;
}

export interface CardDetailGrade {
  status: GradeStatus;
  /** Whole-number DCM grade, or null in every non-'graded' status. */
  grade: number | null;
  /** Grade as the label prints it ("10", "A", "N/A"). */
  gradeFormatted: string;
  /** Condition label ("Gem Mint"), or "Authentic" for altered-authentic. */
  condition: string | null;
  /** "Altered - Unverified Autograph" and friends. Never replaces the grade. */
  designation: string | null;
  subgrades: SubgradeSet;
  /** The category that held the grade down, when the report named one. */
  limitingFactor: string | null;
  /** Why the card cannot be graded; only set when status is 'not-gradable'. */
  notGradableReason: string | null;
  /** The message from readIncompleteInspectionMessage, passed in by the hook. */
  incompleteInspectionMessage: string | null;
  summary: string | null;
}

/** A grade from PSA/BGS/SGC read off the holder. Never the DCM grade. */
export interface DetectedSlabGrade {
  company: string;
  grade: string | null;
  description: string | null;
  certNumber: string | null;
}

export interface CardDetailImage {
  url: string | null;
  /** False when the row has no URL for this side. */
  present: boolean;
}

export interface CardDetailIdentity {
  /** Player or character, or the card name — whatever the label prints big. */
  displayName: string;
  setName: string | null;
  subset: string | null;
  year: string | null;
  cardNumber: string | null;
  /** Number as the label prints it ("#94/102"). */
  cardNumberFormatted: string | null;
  rarityOrVariant: string | null;
  /** "EN", "JA", … when the row says; null when it does not. */
  language: string | null;
  /** DCM certification serial. */
  serial: string;
  /** Pre-formatted "Set • Subset • #123 • 2023". */
  contextLine: string;
  features: string[];
  featuresLine: string | null;
}

export type ValueStatus = 'priced' | 'withheld' | 'unavailable';

export interface CardDetailValue {
  status: ValueStatus;
  /** The number to show. Null unless status is 'priced' — never 0-as-unknown. */
  amount: number | null;
  source: PriceSource;
  /** The suppressed number, present only when status is 'withheld'. */
  withheldAmount: number | null;
  withheldReason: ValueTrustReason | null;
  /** cards.dcm_price_updated_at. The legacy page shows no freshness at all. */
  updatedAt: string | null;
}

export interface CardDetailPermissions {
  isOwner: boolean;
  isPublic: boolean;
  isSold: boolean;
  soldAt: string | null;
  isOrgBranded: boolean;
}

export interface CardDetailViewModel {
  id: string;
  category: CardDetailCategory;
  identity: CardDetailIdentity;
  images: { front: CardDetailImage; back: CardDetailImage };
  grade: CardDetailGrade;
  detectedSlabGrade: DetectedSlabGrade | null;
  value: CardDetailValue;
  permissions: CardDetailPermissions;
  /** Category-specific fields. Nothing shared may read from here. */
  extras: Record<string, unknown>;
  /** The label data the print PDF is built from, for the holder showcase. */
  labelData: LabelData;
}

export interface BuildCardDetailViewModelInput {
  card: CardDetailSource;
  category: CardDetailCategory;
  /** Viewer's session user id, or null when signed out. Legacy compares this to card.user_id. */
  sessionUserId?: string | null;
  /** The hook's isProcessing — the API is answering 429 and the poll is running. */
  isProcessing?: boolean;
  /** readIncompleteInspectionMessage's result, when the fetch produced one. */
  incompleteInspectionMessage?: string | null;
  /** Category-specific fields the adapter wants to carry through. */
  extras?: Record<string, unknown>;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

/**
 * One subgrade, in legacy's order: the explicit weighted column, then the
 * sub-score's own `weighted`, then the older `weighted_score`. Legacy renders
 * a missing score as 0 (safeToFixed(… ?? 0)); here it is null, so a component
 * can tell "scored zero" from "never scored" instead of printing a 0 nobody
 * produced. Nothing else about the chain changed.
 */
function readSubgrade(weighted: any, subScores: any, key: string): number | null {
  const raw = weighted?.[key] ?? subScores?.[key]?.weighted ?? subScores?.[key]?.weighted_score;
  const num = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof num !== 'number' || !Number.isFinite(num)) return null;
  return Math.round(num);
}

function buildGrade(
  card: CardDetailSource,
  labelData: LabelData,
  isProcessing: boolean,
  incompleteInspectionMessage: string | null
): CardDetailGrade {
  const subScores = card.conversational_sub_scores || card.dvg_grading?.sub_scores;
  const weighted = card.conversational_weighted_sub_scores;
  const subgrades: SubgradeSet = {
    centering: readSubgrade(weighted, subScores, 'centering'),
    corners: readSubgrade(weighted, subScores, 'corners'),
    edges: readSubgrade(weighted, subScores, 'edges'),
    surface: readSubgrade(weighted, subScores, 'surface'),
  };

  const capReason = firstString(card.conversational_weighted_summary?.grade_cap_reason);
  // Legacy hides a grading_status that only says the engine was disabled or
  // that the grade is N/A; those are not a reason to show the owner a banner.
  const statusRaw = firstString(card.dvg_grading?.grading_status);
  const gradingStatus = statusRaw && !statusRaw.includes('disabled') && !statusRaw.includes('N/A')
    ? statusRaw
    : null;

  const base = {
    subgrades,
    limitingFactor: firstString(card.conversational_limiting_factor),
    summary: firstString(card.conversational_final_grade_summary),
    designation: labelData.designation ?? null,
  };

  if (incompleteInspectionMessage) {
    return {
      ...base,
      status: 'incomplete-inspection',
      grade: null,
      gradeFormatted: 'N/A',
      condition: null,
      notGradableReason: null,
      incompleteInspectionMessage,
    };
  }

  if (labelData.grade !== null) {
    return {
      ...base,
      status: 'graded',
      grade: Math.round(labelData.grade),
      gradeFormatted: Math.round(labelData.grade).toString(),
      condition: firstString(labelData.condition),
      notGradableReason: null,
      incompleteInspectionMessage: null,
    };
  }

  // No numeric grade from here on.
  if (labelData.isAlteredAuthentic) {
    return {
      ...base,
      status: 'altered-authentic',
      grade: null,
      gradeFormatted: 'A',
      condition: 'Authentic',
      notGradableReason: null,
      incompleteInspectionMessage: null,
    };
  }

  if (capReason || gradingStatus) {
    return {
      ...base,
      status: 'not-gradable',
      grade: null,
      gradeFormatted: 'N/A',
      condition: firstString(labelData.condition),
      notGradableReason: capReason ?? gradingStatus,
      incompleteInspectionMessage: null,
    };
  }

  if (isProcessing) {
    return {
      ...base,
      status: 'in-progress',
      grade: null,
      gradeFormatted: 'N/A',
      condition: null,
      notGradableReason: null,
      incompleteInspectionMessage: null,
    };
  }

  return {
    ...base,
    status: 'ungraded',
    grade: null,
    gradeFormatted: 'N/A',
    condition: firstString(labelData.condition),
    notGradableReason: null,
    incompleteInspectionMessage: null,
  };
}

function buildValue(card: CardDetailSource): CardDetailValue {
  const resolved = resolveCardValue(card);
  const updatedAt = firstString(card.dcm_price_updated_at);

  if (resolved.source === 'withheld') {
    return {
      status: 'withheld',
      amount: null,
      source: resolved.source,
      withheldAmount: resolved.withheldValue ?? null,
      withheldReason: resolved.withheldReason ?? null,
      updatedAt,
    };
  }

  if (resolved.source === 'none' || resolved.value <= 0) {
    return {
      status: 'unavailable',
      amount: null,
      source: resolved.source,
      withheldAmount: null,
      withheldReason: null,
      updatedAt,
    };
  }

  return {
    status: 'priced',
    amount: resolved.value,
    source: resolved.source,
    withheldAmount: null,
    withheldReason: null,
    updatedAt,
  };
}

function buildDetectedSlabGrade(card: CardDetailSource): DetectedSlabGrade | null {
  // Legacy shows the professional-grading panel only when the holder was
  // detected AND a company was read off it.
  const detected = !!card.slab_detected || !!card.conversational_slab_detection?.detected;
  const company = firstString(card.slab_company);
  if (!detected || !company) return null;
  return {
    company,
    grade: firstString(card.slab_grade),
    description: firstString(card.slab_grade_description),
    certNumber: firstString(card.slab_cert_number),
  };
}

export function buildCardDetailViewModel({
  card,
  category,
  sessionUserId = null,
  isProcessing = false,
  incompleteInspectionMessage = null,
  extras = {},
}: BuildCardDetailViewModelInput): CardDetailViewModel {
  const labelData = getCardLabelData(card);

  const identity: CardDetailIdentity = {
    displayName: labelData.primaryName,
    setName: labelData.setName,
    subset: labelData.subset,
    year: labelData.year,
    cardNumber: labelData.cardNumber,
    cardNumberFormatted: labelData.formattedCardNumber ?? null,
    rarityOrVariant: firstString(
      card.rarity_tier,
      card.rarity_description,
      card.conversational_card_info?.rarity_tier,
      card.dvg_grading?.card_info?.rarity_tier
    ),
    language: firstString(card.language, card.card_language, card.conversational_card_info?.language),
    serial: labelData.serial,
    contextLine: labelData.contextLine,
    features: labelData.features,
    featuresLine: labelData.featuresLine,
  };

  const front = firstString(card.front_url);
  const back = firstString(card.back_url);

  return {
    id: card.id,
    category,
    identity,
    images: {
      front: { url: front, present: front !== null },
      back: { url: back, present: back !== null },
    },
    grade: buildGrade(card, labelData, isProcessing, incompleteInspectionMessage),
    detectedSlabGrade: buildDetectedSlabGrade(card),
    value: buildValue(card),
    permissions: {
      isOwner: !!(sessionUserId && card.user_id && sessionUserId === card.user_id),
      // Legacy initialises its toggle with `data.visibility || 'private'`, so a
      // row with no visibility column reads as private, not public.
      isPublic: (card.visibility || 'private') === 'public',
      isSold: card.ownership_status === 'sold',
      soldAt: firstString(card.sold_at),
      isOrgBranded: !!card.org_id,
    },
    extras,
    labelData,
  };
}
