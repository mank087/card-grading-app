/**
 * Pure readers for the Grade details section.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` as of
 * 2026-09-21 [sports 2483-2700 / 4703-5130, same shapes]:
 *
 *   readDvgGrading                2488-2527 (reduced — see the note there)
 *   readCentering                 2657
 *   readCenteringMeasurements     2707-2765
 *   readFaceCentering             4524-4527, 4541-4571, 4610-4640
 *   readConditionDetails          4814-4880
 *   readStructuralNote            2708-2722
 *   readImageGrade                5200-5208
 *   confidenceLevelFor            5210-5220
 *   imageQualityInfoFor           5222-5250
 *   readCaseDetection             5357-5362, 5419-5421
 *   readSlabDetection             5315-5317
 *
 * Every precedence chain is the legacy one. The only changes are mechanical:
 * values legacy read off the component closure are arguments here, and the
 * console.log debug lines (2459-2476, 2682-2687, 2767-2775, 4818-4820) are
 * dropped — they are developer noise, not behaviour a visitor can see.
 */

import { isCenteringMeasurable } from '@/lib/centeringDisplay';
import { extractCenteringAnalysis } from './parsers';

export type CardSideKey = 'front' | 'back';

/**
 * The legacy `dvgGrading` object, reduced to the keys the report actually
 * reads. Legacy also folds the parsed defect structures into it for the tab
 * navigation it no longer renders; those keys have no reader left, so they are
 * not rebuilt here.
 */
export function readDvgGrading(card: any): any {
  const base =
    card?.dvg_grading && Object.keys(card.dvg_grading).length > 0 ? card.dvg_grading : {};
  return {
    ...base,
    ...(card?.conversational_sub_scores ? { sub_scores: card.conversational_sub_scores } : {}),
    ...(card?.conversational_case_detection
      ? { case_detection: card.conversational_case_detection }
      : {}),
  };
}

/** Legacy 2657. */
export function readCentering(card: any): any {
  return card?.conversational_centering_ratios || readDvgGrading(card).centering || {};
}

/** Legacy 2724-2744 — centering pulled straight out of the JSON report. */
export function readCenteringFromReport(card: any): any {
  const raw = card?.conversational_grading;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.centering) return null;
    return {
      front_lr: parsed.centering.front?.left_right || null,
      front_tb: parsed.centering.front?.top_bottom || null,
      front_quality_tier: parsed.centering.front?.quality_tier || null,
      back_lr: parsed.centering.back?.left_right || null,
      back_tb: parsed.centering.back?.top_bottom || null,
      back_quality_tier: parsed.centering.back?.quality_tier || null,
    };
  } catch {
    return null;
  }
}

/** Legacy 2746-2765. */
export function readCenteringMeasurements(card: any): any {
  const gradingScaleMeasurements = card?.conversational_sub_scores
    ? card?.conversational_centering_ratios || {}
    : card?.ai_grading?.['Grading (DCM Master Scale)']?.['Centering_Measurements'] || {};

  const centeringData =
    readCenteringFromReport(card) ||
    card?.conversational_centering_ratios ||
    card?.ai_grading?.['Centering_Measurements'] ||
    card?.ai_grading?.centerings_used ||
    card?.stage0_detection ||
    gradingScaleMeasurements ||
    {};

  return {
    front_x_axis_ratio: centeringData.front_x_axis_ratio || centeringData.front_lr || 'N/A',
    front_y_axis_ratio: centeringData.front_y_axis_ratio || centeringData.front_tb || 'N/A',
    front_quality_tier: centeringData.front_quality_tier || null,
    back_x_axis_ratio: centeringData.back_x_axis_ratio || centeringData.back_lr || 'N/A',
    back_y_axis_ratio: centeringData.back_y_axis_ratio || centeringData.back_tb || 'N/A',
    back_quality_tier: centeringData.back_quality_tier || null,
    front_centering_method:
      centeringData.front_centering_method || centeringData.front_type || 'N/A',
    back_centering_method: centeringData.back_centering_method || centeringData.back_type || 'N/A',
    ...centeringData,
  };
}

export interface FaceCentering {
  /**
   * The ratio exactly as the grader stored it ("53/47", or "XX/XX" / "n/a" /
   * "borderless" when it could not measure), or null when nothing was stored.
   * NEVER parsed or defaulted here: `@/lib/centeringDisplay` is the one place
   * that decides what a ratio string means, and every consumer must go through
   * `displayCenteringRatio` / `isCenteringMeasurable` / `centeringQuality`.
   */
  lrText: string | null;
  tbText: string | null;
  /** True when at least one axis carries a real measurement. */
  measurable: boolean;
  /** The grader's own tier for this face, when it gave one. */
  qualityTier: string | null;
  /** The face's own centering score, raw off the sub-scores. */
  score: number | string | null;
  /** The prose. Null when no source had any. */
  analysis: string | null;
}


/** The first non-empty stored ratio string, trimmed; null when there is none. */
function firstRatioText(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

/** Legacy 4524-4527 + 4541-4571 (front) / 4610-4640 (back). */
export function readFaceCentering(card: any, side: CardSideKey): FaceCentering {
  const centering = readCentering(card);
  const ratios = card?.conversational_centering_ratios;
  const measurements = readCenteringMeasurements(card);
  const analysisText = extractCenteringAnalysis(card?.conversational_grading, {
    conversational_front_summary: card?.conversational_front_summary,
    conversational_back_summary: card?.conversational_back_summary,
  });

  // Raw stored text, first source that has one. This used to go through a
  // parseInt-and-rejoin copied from the legacy page, which turned "XX/XX" and
  // "n/a" into the string "NaN/NaN" (printed as-is in the Overview tiles), and
  // defaulted a missing or slash-less value ("borderless") to "50/50" — a
  // perfect-centering measurement that was never taken.
  const lrText = firstRatioText(ratios?.[`${side}_lr`], centering[`${side}_left_right_ratio_text`]);
  const tbText = firstRatioText(ratios?.[`${side}_tb`], centering[`${side}_top_bottom_ratio_text`]);

  const analysis =
    card?.conversational_corners_edges_surface?.[`${side}_centering`]?.summary ||
    analysisText[side] ||
    centering[`${side}_centering_analysis`] ||
    null;

  const scoreRaw = card?.conversational_sub_scores?.centering?.[side];

  return {
    lrText,
    tbText,
    measurable: isCenteringMeasurable(lrText, tbText),
    qualityTier: measurements[`${side}_quality_tier`] || ratios?.[`${side}_quality_tier`] || null,
    score: scoreRaw === undefined ? null : scoreRaw,
    analysis,
  };
}

/** True when legacy would render the centering panel at all (4400). */
export function hasCenteringData(card: any): boolean {
  const centering = readCentering(card);
  return !!(
    card?.conversational_sub_scores ||
    centering.front_left_right_ratio_text ||
    centering.back_left_right_ratio_text
  );
}

export interface CornersDetail {
  top_left?: string;
  top_right?: string;
  bottom_left?: string;
  bottom_right?: string;
  summary?: string;
  sub_score?: number | string;
  defects?: any[];
}

export interface EdgesDetail {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  summary?: string;
  sub_score?: number | string;
  defects?: any[];
}

export interface SurfaceDetail {
  analysis?: string;
  defects?: any[];
  summary?: string;
  sub_score?: number | string;
}

export interface SideConditionDetail {
  corners: CornersDetail;
  edges: EdgesDetail;
  surface: SurfaceDetail;
}

/**
 * Legacy 4814-4880 — the nested-then-flat read of
 * `conversational_corners_edges_surface`, including the `condition`-or-raw and
 * `sub_score`-or-`score` fallbacks.
 *
 * NOTE the summary key is side-specific (`front_summary` on the front block,
 * `back_summary` on the back) with a plain `summary` fallback; that asymmetry
 * is legacy's and is preserved.
 */
export function readConditionDetails(card: any, side: CardSideKey): SideConditionDetail {
  const details = card?.conversational_corners_edges_surface || {};
  const rawCorners = details.corners?.[side] || details[`${side}_corners`] || {};
  const rawEdges = details.edges?.[side] || details[`${side}_edges`] || {};
  const rawSurface = details.surface?.[side] || details[`${side}_surface`] || {};
  const summaryKey = `${side}_summary`;

  return {
    corners: {
      top_left: rawCorners.top_left?.condition || rawCorners.top_left,
      top_right: rawCorners.top_right?.condition || rawCorners.top_right,
      bottom_left: rawCorners.bottom_left?.condition || rawCorners.bottom_left,
      bottom_right: rawCorners.bottom_right?.condition || rawCorners.bottom_right,
      summary: rawCorners[summaryKey] || rawCorners.summary,
      sub_score: rawCorners.sub_score ?? rawCorners.score,
      defects: rawCorners.defects,
    },
    edges: {
      top: rawEdges.top?.condition || rawEdges.top,
      bottom: rawEdges.bottom?.condition || rawEdges.bottom,
      left: rawEdges.left?.condition || rawEdges.left,
      right: rawEdges.right?.condition || rawEdges.right,
      summary: rawEdges[summaryKey] || rawEdges.summary,
      sub_score: rawEdges.sub_score ?? rawEdges.score,
      defects: rawEdges.defects,
    },
    surface: {
      // v5.0+ writes `condition`; older rows wrote `analysis`.
      analysis: rawSurface.condition || rawSurface.analysis,
      defects: rawSurface.defects,
      summary: rawSurface[summaryKey] || rawSurface.summary,
      sub_score: rawSurface.sub_score ?? rawSurface.score,
    },
  };
}

/** Legacy 2708-2722 — a flagged crease the grader reviewed and dismissed. */
export function readStructuralUnconfirmedNote(card: any): string | null {
  const raw = card?.conversational_grading;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const sd = parsed?.structural_damage;
    if (sd?.unconfirmed === true && typeof sd?.unconfirmed_note === 'string' && sd.unconfirmed_note.trim()) {
      return sd.unconfirmed_note;
    }
  } catch {
    /* Markdown report — no structural note to surface. */
  }
  return null;
}

/** Legacy 5200/5208 — the image-quality letter, defaulting to B. */
export function readImageGrade(card: any): string {
  const imageQuality = card?.conversational_image_confidence
    ? { grade: card.conversational_image_confidence }
    : readDvgGrading(card).image_quality || {};
  return (
    card?.conversational_image_confidence ||
    card?.dvg_image_quality ||
    imageQuality?.grade ||
    card?.ai_confidence_score ||
    'B'
  );
}

export interface ConfidenceLevel {
  level: string;
  /** The filled width of the bar, as legacy sets it. */
  width: string;
  /** A token for the CSS to colour from — legacy used Tailwind class names. */
  tone: 'strong' | 'good' | 'moderate' | 'low';
}

/** Legacy 5210-5220. Level derives ONLY from the image-quality letter. */
export function confidenceLevelFor(grade: string): ConfidenceLevel {
  if (grade === 'A') return { level: 'Very High', width: '95%', tone: 'strong' };
  if (grade === 'C') return { level: 'Moderate', width: '55%', tone: 'moderate' };
  if (grade === 'D') return { level: 'Low', width: '35%', tone: 'low' };
  // B, and anything unrecognised, default to High.
  return { level: 'High', width: '80%', tone: 'good' };
}

export interface ImageQualityInfo {
  name: string;
  description: string;
  icon: string;
  recommendNewPhotos: boolean;
}

/** Legacy 5222-5250. An unrecognised letter falls through to Grade D. */
export function imageQualityInfoFor(grade: string): ImageQualityInfo {
  const definitions: Record<string, ImageQualityInfo> = {
    A: {
      name: 'Grade A - Excellent',
      description:
        'Clear, well-lit images with no obstructions. Optimal for accurate grading with no uncertainty.',
      icon: '✨',
      recommendNewPhotos: false,
    },
    B: {
      name: 'Grade B - Good',
      description:
        'Minor issues with lighting or focus. Reliable grading with minimal uncertainty in fine details.',
      icon: '👍',
      recommendNewPhotos: false,
    },
    C: {
      name: 'Grade C - Fair',
      description:
        'Moderate issues with glare, blur, or lighting. Consider submitting new photos for improved accuracy.',
      icon: '⚠️',
      recommendNewPhotos: true,
    },
    D: {
      name: 'Grade D - Poor',
      description:
        'Significant image quality issues limiting assessment accuracy. We recommend submitting new photos for accurate grading.',
      icon: '❌',
      recommendNewPhotos: true,
    },
  };
  return definitions[grade] || definitions.D;
}

/** Legacy 5357-5358 / 5420 — conversational first, dvg second. */
export function readCaseDetection(card: any): any | null {
  return card?.conversational_case_detection || readDvgGrading(card).case_detection || null;
}

/** Legacy 5316 — the JSON-mode slab block inside the confidence section. */
export function readSlabDetection(card: any): any | null {
  const detection = card?.conversational_slab_detection;
  return detection && detection.detected ? detection : null;
}

/** Legacy 4892/5046 — the crops are told whether the card is in a holder. */
export function isSlabbed(card: any): boolean {
  return !!card?.slab_detected || !!card?.conversational_slab_detection?.detected;
}
