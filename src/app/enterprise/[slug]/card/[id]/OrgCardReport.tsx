'use client';

/**
 * OrgCardReport — the public, org-branded grading report shown when a visitor
 * scans a slab QR or opens a storefront card page. A de-branded recreation of
 * the main card detail page: label-over-image slabs (org logo), grade summary,
 * and the collapsible analysis sections, all themed with the org's brand color
 * instead of DCM purple. Everything here must be safe for a logged-out
 * visitor: no auth, no owner tools, no client Supabase calls.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ModernFrontLabel } from '@/components/labels/ModernFrontLabel';
import { ModernBackLabel } from '@/components/labels/ModernBackLabel';
import { HeritageLabelPreview } from '@/components/labels/HeritageLabelPreview';
import type { BandPattern } from '@/lib/labelLab/bandGeometry';
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout';
import type { SlabLabelData } from '@/lib/slabLabelGenerator';
import { CollapsibleSection } from '@/components/grading/CollapsibleSection';
import { DefectOverlay } from '@/components/grading/DefectOverlay';
import { DefectLegend } from '@/components/grading/DefectLegend';
import { CornerZoomCrops } from '@/components/grading/CornerZoomCrops';
import SectionDefects from '@/components/reports/SectionDefects';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { ConditionReportDisplay } from '@/components/UserConditionReport';
import type { UserConditionReportInput } from '@/types/conditionReport';
import { extractOverlayDefects, type OverlayDefect } from '@/lib/defectOverlayData';
import OrgMarketValueDetails, { type CachedPricePayload } from '@/components/pricing/OrgMarketValueDetails';
import { getSlabWrapperStyle } from '@/lib/labelPresets';
import type { LabelColorOverrides } from '@/lib/labelPresets';
import type { LabelData } from '@/lib/labelDataGenerator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrgCardReportProps {
  slug: string;
  orgName: string;
  brand: string;
  logos: { color: string | null; white: string | null; mark: string | null };
  /** Mark size multiplier from Brand Setup; clamped per card by the renderer. */
  logoScale?: number;
  frontUrl: string | null;
  backUrl: string | null;
  label: LabelData;
  /** Structured as a prop so the org-serial stream can swap what's displayed. */
  displaySerial: string;
  gradedOn: string | null;
  card: OrgReportCard;
  /** Org house label style (StorefrontContent.slab.label_style). Default modern. */
  labelStyle?: 'modern' | 'heritage';
  /** Heritage band design — pattern + resolved colors (>= 2 stops). */
  heritagePattern?: string;
  heritageBandColors?: string[];
}

/** The public slice of the cards row the report reads. Everything optional —
 *  older cards are missing most of it. */
export interface OrgReportCard {
  id: string;
  category?: string | null;
  // Fields the download builders consume (public-safe)
  serial?: string | null;
  org_id?: string | null;
  org_serial?: number | null;
  org_serial_display?: string | null;
  created_at?: string | null;
  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
  conversational_final_grade_summary?: string | null;
  conversational_grade_uncertainty?: string | null;
  estimated_professional_grades?: Record<string, any> | null;
  dvg_decimal_grade?: number | null;
  pokemon_featured?: string | null;
  sport?: string | null;
  rookie_card?: boolean | null;
  autograph_type?: string | null;
  serial_numbering?: string | null;
  is_foil?: boolean | null;
  foil_type?: string | null;
  is_double_faced?: boolean | null;
  mtg_rarity?: string | null;
  conversational_card_info?: Record<string, any> | null;
  conversational_sub_scores?: Record<string, any> | null;
  conversational_weighted_sub_scores?: Record<string, any> | null;
  conversational_corners_edges_surface?: Record<string, any> | null;
  conversational_centering_ratios?: Record<string, any> | null;
  conversational_grading?: string | null;
  conversational_image_confidence?: string | null;
  conversational_case_detection?: Record<string, any> | null;
  conversational_slab_detection?: Record<string, any> | null;
  slab_detected?: boolean | null;
  // Legacy top-level fallbacks (pre-conversational cards)
  card_name?: string | null;
  card_set?: string | null;
  featured?: string | null;
  release_date?: string | null;
  manufacturer_name?: string | null;
  card_number?: string | null;
  subset?: string | null;
  // Saved market pricing (same pipeline the main page persists into)
  dcm_price_estimate?: number | null;
  dcm_price_raw?: number | null;
  dcm_price_graded_high?: number | null;
  dcm_price_median?: number | null;
  dcm_price_average?: number | null;
  dcm_price_match_confidence?: string | null;
  dcm_price_product_name?: string | null;
  dcm_price_updated_at?: string | null;
  dcm_cached_prices?: unknown;
  dcm_prices_cached_at?: string | null;
  scryfall_id?: string | null;
  // Owner-submitted condition report (two incompatible schema shapes)
  has_user_condition_report?: boolean | null;
  user_condition_report?: any;
  user_condition_ai_response?: { hints_confirmed?: string[]; hints_not_visible?: string[] } | null;
  user_report_influenced_grade?: boolean | null;
}

// ---------------------------------------------------------------------------
// Brand color helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return [124, 58, 237]; // fallback purple
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a hex color toward black (amount 0..1 = how much black). */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(v * (1 - amount)).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function num(v: any): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

/** flat number or { weighted } / { front, back, weighted } nesting */
function subScore(card: OrgReportCard, key: string): number | null {
  for (const src of [card.conversational_weighted_sub_scores, card.conversational_sub_scores]) {
    const v = src?.[key];
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && typeof v.weighted === 'number') return v.weighted;
  }
  return null;
}

function stripMarkdown(text: any): string | null {
  if (text === null || text === undefined) return null;
  const str = typeof text === 'string' ? text : String(text);
  if (!str.trim()) return null;
  return str.replace(/\*\*/g, '').trim();
}

function prettifyKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Centering helpers (adapted from the main detail page, neutral styling)
// ---------------------------------------------------------------------------

function parseRatio(ratioStr: string | null | undefined): { left: number; right: number } | null {
  if (!ratioStr || typeof ratioStr !== 'string') return null;
  const parts = ratioStr.split('/').map(p => parseInt(p.trim(), 10));
  if (parts.length !== 2 || parts.some(p => Number.isNaN(p))) return null;
  return { left: parts[0], right: parts[1] };
}

const TIER_COLORS: Record<string, string> = {
  Perfect: 'text-green-600',
  Excellent: 'text-green-600',
  Good: 'text-blue-600',
  Fair: 'text-yellow-600',
  'Off-Center': 'text-orange-600',
};

function qualityTier(lr: { left: number; right: number } | null, tb: { left: number; right: number } | null, aiTier?: string | null): { text: string; colorClass: string } | null {
  if (aiTier && TIER_COLORS[aiTier]) return { text: aiTier, colorClass: TIER_COLORS[aiTier] };
  if (!lr && !tb) return null;
  const worst = Math.max(lr ? Math.abs(lr.left - 50) : 0, tb ? Math.abs(tb.left - 50) : 0);
  if (worst <= 1) return { text: 'Perfect', colorClass: TIER_COLORS.Perfect };
  if (worst <= 3) return { text: 'Excellent', colorClass: TIER_COLORS.Excellent };
  if (worst <= 5) return { text: 'Good', colorClass: TIER_COLORS.Good };
  if (worst <= 10) return { text: 'Fair', colorClass: TIER_COLORS.Fair };
  return { text: 'Off-Center', colorClass: TIER_COLORS['Off-Center'] };
}

// ---------------------------------------------------------------------------
// Card Information field mapping — one generic implementation for all 8
// categories: render the conversational_card_info fields that exist rather
// than forking per category.
// ---------------------------------------------------------------------------

/** Ordered, labeled scalar fields. First matching key wins per row. */
const INFO_FIELDS: { label: string; keys: string[] }[] = [
  { label: 'Featured', keys: ['player_or_character'] },
  { label: 'Card Name', keys: ['card_name'] },
  { label: 'Set', keys: ['set_name'] },
  { label: 'Subset / Insert', keys: ['subset', 'subset_insert_name'] },
  { label: 'Card Number', keys: ['card_number_raw', 'card_number', 'collector_number', 'card_id'] },
  { label: 'Year', keys: ['year', 'set_year'] },
  { label: 'Manufacturer', keys: ['manufacturer'] },
  { label: 'Sport / Category', keys: ['sport', 'sport_or_category', 'game_type'] },
  { label: 'Team', keys: ['team'] },
  { label: 'Parallel', keys: ['parallel_type'] },
  { label: 'Rarity / Variant', keys: ['rarity_or_variant', 'rarity', 'rarity_tier'] },
  { label: 'Set Code', keys: ['expansion_code'] },
  { label: 'Language', keys: ['language'] },
  { label: 'Illustrator', keys: ['illustrator', 'artist'] },
];

/** Boolean feature chips (rendered when truthy). */
const FEATURE_FLAGS: { label: string; key: string }[] = [
  { label: 'Rookie / First Print', key: 'rookie_or_first' },
  { label: 'Autographed', key: 'autographed' },
  { label: 'On-Card Auto', key: 'is_on_card_auto' },
  { label: 'Sticker Auto', key: 'is_sticker_auto' },
  { label: 'Memorabilia', key: 'memorabilia' },
  { label: 'Patch', key: 'is_patch' },
  { label: 'Jersey', key: 'is_jersey' },
  { label: 'Game Used', key: 'is_game_used' },
  { label: 'Refractor / Prizm', key: 'is_refractor' },
  { label: 'Numbered', key: 'is_numbered' },
  { label: 'Short Print', key: 'is_short_print' },
  { label: 'Variation', key: 'is_variation' },
  { label: 'Case Hit', key: 'is_case_hit' },
  { label: '1st Bowman', key: 'first_print_rookie' },
  { label: 'Holofoil', key: 'holofoil' },
  { label: 'Reverse Holo', key: 'reverse_holo' },
  { label: '1st Edition', key: 'first_edition' },
  { label: 'Foil', key: 'is_foil' },
  { label: 'Facsimile Autograph', key: 'facsimile_autograph' },
  { label: 'Official Reprint', key: 'official_reprint' },
];

const isTruthyFlag = (v: any) => v === true || v === 'true' || v === 'Yes' || v === 'yes';

function isNoiseValue(v: string): boolean {
  const lower = v.toLowerCase().trim();
  return (
    lower === '' || lower === 'n/a' || lower === 'na' || lower === 'unknown' ||
    lower === 'none' || lower.includes('not present') || lower.includes('none visible')
  );
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export default function OrgCardReport({
  slug, orgName, brand, logos, logoScale = 1, frontUrl, backUrl, label, displaySerial, gradedOn, card,
  labelStyle = 'modern', heritagePattern = 'diamond', heritageBandColors,
}: OrgCardReportProps) {
  // QR code target — this page's own URL (set client-side to avoid hydration mismatch)
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setPageUrl(window.location.href);
  }, []);

  // Heritage back label consumes the QR as a data URL (data.qrCodeDataUrl) —
  // generated the same way the main detail pages do for heritage.
  const heritageActive = labelStyle === 'heritage';
  const [heritageQrDataUrl, setHeritageQrDataUrl] = useState('');
  useEffect(() => {
    if (!heritageActive || !pageUrl) return;
    let cancelled = false;
    import('qrcode')
      .then(q => q.default.toDataURL(pageUrl, { errorCorrectionLevel: 'H', margin: 1, width: 300, color: { dark: '#141414', light: '#ffffff' } }))
      .then(url => { if (!cancelled) setHeritageQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [heritageActive, pageUrl]);

  // Defect overlay state
  const [showOverlays, setShowOverlays] = useState(true);
  const [hoveredDefect, setHoveredDefect] = useState<OverlayDefect | null>(null);
  const frontDefects = useMemo(() => extractOverlayDefects(card.conversational_grading ?? null, 'front'), [card.conversational_grading]);
  const backDefects = useMemo(() => extractOverlayDefects(card.conversational_grading ?? null, 'back'), [card.conversational_grading]);

  // Brand-themed label + section colors
  const labelOverrides: LabelColorOverrides = useMemo(() => ({
    gradientStart: darken(brand, 0.78),
    gradientEnd: darken(brand, 0.5),
    borderEnabled: false,
    borderColor: brand,
    borderWidth: 0,
    textPolarity: 'light',
    gradeColor: '#ffffff',
  }), [brand]);
  const slabStyle = useMemo(() => getSlabWrapperStyle(labelOverrides), [labelOverrides]);
  const sectionFrom = darken(brand, 0.35);
  const sectionTo = brand;

  const info = card.conversational_card_info || {};
  const cs = card.conversational_corners_edges_surface || {};
  const subs = card.conversational_sub_scores || {};
  const slabDetected = !!card.slab_detected || !!card.conversational_slab_detection?.detected;

  // Heritage label data — feeds the shared SVG preview when heritage is the
  // org's house style. Band colors come resolved from the server (>= 2 stops).
  const bandColors = heritageBandColors && heritageBandColors.length >= 2
    ? heritageBandColors
    : resolveHeritageBandColors(null);
  const heritageData: SlabLabelData | null = heritageActive ? {
    primaryName: label.primaryName,
    contextLine: label.contextLine || '',
    features: label.features || [],
    featuresLine: label.featuresLine ?? null,
    serial: displaySerial,
    grade: label.grade,
    gradeFormatted: label.gradeFormatted,
    condition: label.condition,
    isAlteredAuthentic: label.isAlteredAuthentic,
    qrCodeDataUrl: heritageQrDataUrl,
    subScores: subs && Object.keys(subs).length > 0 ? {
      centering: subs.centering?.weighted ?? 0,
      corners: subs.corners?.weighted ?? 0,
      edges: subs.edges?.weighted ?? 0,
      surface: subs.surface?.weighted ?? 0,
    } : undefined,
  } : null;
  // Established org-branding rule for heritage: the org COLOR logo serves both
  // the front mark and the QR disc; no logo -> suppress the marks entirely
  // (never fall back to a DCM asset).
  const heritageLogoProps = {
    blackLogoHref: logos.mark ?? undefined,
    colorLogoHref: logos.mark ?? undefined,
    suppressImages: !logos.mark,
    logoScale,
  };

  // ---- Card Information rows -------------------------------------------------
  const infoRows: { label: string; value: string }[] = [];
  for (const field of INFO_FIELDS) {
    for (const key of field.keys) {
      const v = stripMarkdown(info?.[key]);
      if (v && !isNoiseValue(v)) {
        infoRows.push({ label: field.label, value: v });
        break;
      }
    }
  }
  // Legacy fallbacks for pre-conversational cards
  if (infoRows.length === 0) {
    const legacy: [string, any][] = [
      ['Card Name', card.card_name],
      ['Featured', card.featured],
      ['Set', card.card_set],
      ['Card Number', card.card_number],
      ['Year', card.release_date],
      ['Manufacturer', card.manufacturer_name],
      ['Subset / Insert', card.subset],
    ];
    for (const [labelText, v] of legacy) {
      const s = stripMarkdown(v);
      if (s && !isNoiseValue(s)) infoRows.push({ label: labelText, value: s });
    }
  }

  const featureChips = FEATURE_FLAGS.filter(f => isTruthyFlag(info?.[f.key])).map(f => f.label);
  const serialNumbering = (() => {
    const s = stripMarkdown(info?.serial_number);
    return s && !isNoiseValue(s) ? s : null;
  })();
  const cardBackText = stripMarkdown(info?.card_back_text);
  const specialFeatures = stripMarkdown(info?.special_features);
  const authentic = typeof info?.authentic === 'boolean' ? info.authentic : null;

  // ---- Centering data ----------------------------------------------------------
  const ratios = card.conversational_centering_ratios || {};
  const frontLR = parseRatio(ratios.front_lr);
  const frontTB = parseRatio(ratios.front_tb);
  const backLR = parseRatio(ratios.back_lr);
  const backTB = parseRatio(ratios.back_tb);
  const centeringScore = subScore(card, 'centering');
  const hasCentering = !!(frontLR || frontTB || backLR || backTB || num(subs.centering?.front) !== null || centeringScore !== null);

  // ---- Corners/Edges/Surface data ---------------------------------------------
  const hasStructure = ['front_corners', 'back_corners', 'front_edges', 'back_edges', 'front_surface', 'back_surface']
    .some(k => cs?.[k] && Object.keys(cs[k]).length > 0);
  const hasCesSection = hasStructure || frontDefects.length > 0 || backDefects.length > 0;

  // ---- Confidence data ----------------------------------------------------------
  const imageGrade = card.conversational_image_confidence || null;
  const caseDetection = card.conversational_case_detection || null;

  // ---- Market value -------------------------------------------------------------
  const price = {
    estimate: num(card.dcm_price_estimate),
    raw: num(card.dcm_price_raw),
    gradedHigh: num(card.dcm_price_graded_high),
    median: num(card.dcm_price_median),
    average: num(card.dcm_price_average),
    confidence: card.dcm_price_match_confidence || null,
    productName: card.dcm_price_product_name || null,
    updatedAt: card.dcm_price_updated_at || null,
  };
  // Sports cards price on SportsCardsPro, everything else on PriceCharting.
  const categoryKey = (card.category || '').toLowerCase().replace(/\s+/g, '');
  const isSportsCard = categoryKey.includes('sport') ||
    ['football', 'baseball', 'basketball', 'hockey', 'soccer', 'golf', 'tennis', 'wrestling', 'boxing', 'racing', 'ufc', 'mma'].includes(categoryKey);

  // Full cached pricing payload (per-grade tables, range, chart, product URL).
  const cachedPrices = (card.dcm_cached_prices || null) as CachedPricePayload | null;

  // Fallback target for the "View on …" link when the cached payload has no
  // set/product name to build an exact product URL from.
  const marketQuery = [
    infoValue(infoRows, 'Featured') || card.featured || infoValue(infoRows, 'Card Name') || card.card_name,
    infoValue(infoRows, 'Set') || card.card_set,
    infoValue(infoRows, 'Year') || card.release_date,
  ].filter(Boolean).join(' ');
  const marketSearchUrl = isSportsCard
    ? `https://www.sportscardspro.com/search?q=${encodeURIComponent(marketQuery)}`
    : `https://www.pricecharting.com/search-products?q=${encodeURIComponent(marketQuery)}`;

  // No pricing data → no Market Value section at all (the marketplace search
  // tiles that used to justify an otherwise-empty section are gone).
  const hasMarketSection = price.estimate !== null || price.raw !== null || !!cachedPrices?.prices;

  // ---- Condition report ---------------------------------------------------------
  const hasConditionReport = !!(card.has_user_condition_report && card.user_condition_report);

  const usd = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <p className="text-sm mb-6">
        <Link href={`/enterprise/${slug}`} className="text-gray-500 hover:underline">← Back to {orgName}</Link>
      </p>

      {/* ================= 1. Slabs: label over image ================= */}
      <div className="flex justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {/* Front */}
          {frontUrl && (
            <div className="rounded-xl p-1 overflow-hidden" style={slabStyle}>
              <div className="rounded-lg overflow-hidden">
                {heritageActive && heritageData ? (
                  <HeritageLabelPreview
                    data={heritageData}
                    side="front"
                    pattern={heritagePattern as BandPattern}
                    bandColors={bandColors}
                    {...heritageLogoProps}
                  />
                ) : (
                  // Standard DCM modern formatting (no color overrides) —
                  // matches the consumer detail pages; org identity comes
                  // from the logo slot.
                  <ModernFrontLabel
                    displayName={label.primaryName}
                    setLineText={label.contextLine || 'Card Details'}
                    features={label.features}
                    serial={displaySerial}
                    grade={label.grade}
                    condition={label.condition}
                    isAlteredAuthentic={label.isAlteredAuthentic}
                    logoColorSrc={logos.mark}
                    logoWhiteSrc={logos.mark}
                    logoScale={logoScale}
                    size="lg"
                  />
                )}
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${brand}4d 0%, ${brand}99 50%, ${brand}4d 100%)` }} />
                <a href={frontUrl} target="_blank" rel="noopener noreferrer" className="block transition-transform hover:scale-[1.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frontUrl} alt={`${label.primaryName} — front`} className="w-full" />
                </a>
              </div>
              <p className="text-xs text-white/80 mt-1 text-center">Tap to view full size</p>
            </div>
          )}

          {/* Back */}
          {backUrl && (
            <div className="rounded-xl p-1 overflow-hidden" style={slabStyle}>
              <div className="rounded-lg overflow-hidden">
                {heritageActive && heritageData ? (
                  <HeritageLabelPreview
                    data={heritageData}
                    side="back"
                    pattern={heritagePattern as BandPattern}
                    bandColors={bandColors}
                    {...heritageLogoProps}
                  />
                ) : (
                  <ModernBackLabel
                    serial={displaySerial}
                    grade={label.grade}
                    condition={label.condition}
                    qrCodeUrl={pageUrl || undefined}
                    qrLogoSrc={logos.color}
                    subScores={subs && Object.keys(subs).length > 0 ? {
                      centering: subs.centering?.weighted ?? 0,
                      corners: subs.corners?.weighted ?? 0,
                      edges: subs.edges?.weighted ?? 0,
                      surface: subs.surface?.weighted ?? 0,
                    } : undefined}
                    isAlteredAuthentic={label.isAlteredAuthentic}
                    size="lg"
                  />
                )}
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${brand}4d 0%, ${brand}99 50%, ${brand}4d 100%)` }} />
                <a href={backUrl} target="_blank" rel="noopener noreferrer" className="block transition-transform hover:scale-[1.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backUrl} alt={`${label.primaryName} — back`} className="w-full" />
                </a>
              </div>
              <p className="text-xs text-white/80 mt-1 text-center">Tap to view full size</p>
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. Grade summary ================= */}
      <div className="mt-10 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white px-3 py-1 rounded-full mb-4" style={{ backgroundColor: brand }}>
              ✓ Verified — graded by {orgName}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{label.primaryName}</h1>
            {label.contextLine && <p className="text-gray-500 mt-1">{label.contextLine}</p>}
            {label.featuresLine && <p className="text-gray-500 text-sm mt-1">{label.featuresLine}</p>}
            <div className="text-sm text-gray-600 mt-4">
              <p>Serial <span className="font-mono font-semibold text-gray-900">{displaySerial}</span></p>
              {gradedOn && <p className="mt-1">Graded {gradedOn}</p>}
            </div>
          </div>

          <div className="flex items-start gap-4 shrink-0">
            <div className="text-center rounded-2xl border-2 px-6 py-4" style={{ borderColor: brand }}>
              <div className="text-5xl font-bold" style={{ color: brand }}>{label.gradeFormatted}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 mt-1">{label.condition}</div>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        {(['centering', 'corners', 'edges', 'surface'] as const).some(k => subScore(card, k) !== null) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {(['centering', 'corners', 'edges', 'surface'] as const).map(key => {
              const v = subScore(card, key);
              if (v === null) return null;
              return (
                <div key={key} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500">{key}</div>
                  <div className="text-2xl font-bold mt-0.5" style={{ color: brand }}>{Math.round(v * 2) / 2}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= 3. Collapsible sections ================= */}
      <div className="mt-10 space-y-2">

        {/* --- Card Information --- */}
        {(infoRows.length > 0 || featureChips.length > 0 || cardBackText || hasConditionReport) && (
          <CollapsibleSection title="Card Information" gradientFrom={sectionFrom} gradientTo={sectionTo}>
            {infoRows.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {infoRows.map(row => (
                  <div key={row.label} className="space-y-0.5">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">{row.label}</p>
                    <p className="font-semibold text-gray-900 break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            )}

            {(featureChips.length > 0 || serialNumbering || authentic !== null || specialFeatures) && (
              <div className={`${infoRows.length > 0 ? 'border-t mt-5 pt-5' : ''}`}>
                <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wide">Special Features</h3>
                <div className="flex flex-wrap gap-2">
                  {serialNumbering && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ color: brand, borderColor: brand, backgroundColor: `${brand}14` }}>
                      Serial # {serialNumbering}
                    </span>
                  )}
                  {featureChips.map(chip => (
                    <span key={chip} className="px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ color: brand, borderColor: brand, backgroundColor: `${brand}14` }}>
                      {chip}
                    </span>
                  ))}
                  {authentic !== null && (
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${authentic ? 'text-green-700 border-green-300 bg-green-50' : 'text-red-700 border-red-300 bg-red-50'}`}>
                      {authentic ? '✓ Licensed / Authentic' : 'Unlicensed'}
                    </span>
                  )}
                </div>
                {specialFeatures && <p className="text-sm text-gray-600 mt-3">{specialFeatures}</p>}
              </div>
            )}

            {cardBackText && (
              <div className="border-t mt-5 pt-5">
                <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">Card Description</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-800 text-sm leading-relaxed italic">&ldquo;{cardBackText}&rdquo;</p>
                  <p className="text-xs text-gray-500 mt-2">— From card back</p>
                </div>
              </div>
            )}

            {hasConditionReport && (
              <div className="border-t mt-5 pt-5">
                <ConditionReportDisplay
                  report={card.user_condition_report as UserConditionReportInput}
                  aiResponse={card.user_condition_ai_response ? {
                    hints_confirmed: card.user_condition_ai_response?.hints_confirmed || [],
                    hints_not_visible: card.user_condition_ai_response?.hints_not_visible || [],
                    influenced_grade: card.user_report_influenced_grade || false,
                  } : undefined}
                />
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* --- Centering Analysis --- */}
        {hasCentering && (
          <CollapsibleSection
            title="Centering Analysis"
            badge={centeringScore !== null ? `${Math.round(centeringScore)}/10` : undefined}
            gradientFrom={sectionFrom}
            gradientTo={sectionTo}
          >
            <div className="flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-8">
              {([
                { side: 'Front', url: frontUrl, lr: frontLR, tb: frontTB, tier: ratios.front_quality_tier, score: num(subs.centering?.front), summary: stripMarkdown(cs.front_centering?.summary) },
                { side: 'Back', url: backUrl, lr: backLR, tb: backTB, tier: ratios.back_quality_tier, score: num(subs.centering?.back), summary: stripMarkdown(cs.back_centering?.summary) },
              ] as const).map(s => {
                const tier = qualityTier(s.lr, s.tb, s.tier);
                if (!s.url && !s.lr && !s.tb && s.score === null && !s.summary) return null;
                return (
                  <div key={s.side} className="flex flex-col items-center gap-4 w-full lg:w-auto lg:max-w-md">
                    <div className="rounded-lg px-6 py-2 shadow-md" style={{ background: `linear-gradient(90deg, ${sectionFrom}, ${sectionTo})` }}>
                      <p className="text-white font-bold text-base uppercase tracking-wider">{s.side}</p>
                    </div>
                    {s.score !== null && (
                      <div className="text-center">
                        <span className="text-sm text-gray-600 font-semibold">Centering Score</span>
                        <div className="text-4xl font-bold" style={{ color: brand }}>{s.score}/10</div>
                      </div>
                    )}
                    {s.url && (
                      <div className="relative overflow-hidden rounded-lg border-4 shadow-xl max-w-xs" style={{ borderColor: `${brand}66` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.url} alt={`Card ${s.side.toLowerCase()}`} className="w-full h-auto" />
                      </div>
                    )}
                    {(s.lr || s.tb || s.summary) && (
                      <div className="w-full max-w-xs">
                        <div className="bg-gray-50 rounded-xl p-4 border-2 shadow-sm" style={{ borderColor: `${brand}4d` }}>
                          <p className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: darken(brand, 0.25) }}>
                            Centering Measurements
                          </p>
                          <div className="space-y-2 mb-3 bg-white rounded-lg p-3 border border-gray-200">
                            {s.lr && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700 font-medium">Horizontal (L/R):</span>
                                <span className="font-bold" style={{ color: brand }}>{s.lr.left}/{s.lr.right}</span>
                              </div>
                            )}
                            {s.tb && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700 font-medium">Vertical (T/B):</span>
                                <span className="font-bold" style={{ color: brand }}>{s.tb.left}/{s.tb.right}</span>
                              </div>
                            )}
                            {tier && (
                              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                <span className="text-gray-700 font-medium">Quality:</span>
                                <span className={`font-bold capitalize ${tier.colorClass}`}>{tier.text}</span>
                              </div>
                            )}
                          </div>
                          {s.summary && <p className="text-xs text-gray-700 leading-relaxed">{s.summary}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* --- Corners, Edges & Surface --- */}
        {hasCesSection && (
          <CollapsibleSection title="Corners, Edges & Surface Analysis" gradientFrom={sectionFrom} gradientTo={sectionTo}>
            {/* Defect map */}
            {(frontDefects.length > 0 || backDefects.length > 0) && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">Defect Map</h3>
                  <button
                    onClick={() => setShowOverlays(!showOverlays)}
                    className="text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-1 px-3 py-1 rounded-full border border-gray-300 hover:border-gray-400"
                  >
                    <span className={`w-2 h-2 rounded-full ${showOverlays ? 'bg-green-400' : 'bg-gray-400'}`} />
                    {showOverlays ? 'Hide' : 'Show'} Markers
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    { side: 'front' as const, url: frontUrl, defects: frontDefects, title: 'Front' },
                    { side: 'back' as const, url: backUrl, defects: backDefects, title: 'Back' },
                  ]).map(s => s.url && (
                    <div key={s.side}>
                      <p className="text-sm font-semibold text-gray-700 mb-2 text-center">{s.title}</p>
                      <div className="relative rounded-lg border-2 border-gray-200 max-w-xs mx-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.url} alt={`Card ${s.side}`} className="w-full h-auto rounded-lg" />
                        <DefectOverlay defects={s.defects} visible={showOverlays} onDefectHover={setHoveredDefect} />
                      </div>
                      {showOverlays && s.defects.length > 0 && (
                        <div className="mt-2">
                          <DefectLegend
                            defects={s.defects}
                            activeDefectId={hoveredDefect?.side === s.side ? hoveredDefect.id : null}
                            onDefectHover={setHoveredDefect}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {([
                { side: 'Front', url: frontUrl, cropSide: 'front' as const, corners: cs.front_corners || {}, edges: cs.front_edges || {}, surface: cs.front_surface || {} },
                { side: 'Back', url: backUrl, cropSide: 'back' as const, corners: cs.back_corners || {}, edges: cs.back_edges || {}, surface: cs.back_surface || {} },
              ]).map(col => (
                <div key={col.side} className="space-y-4">
                  <div className="text-white rounded-lg px-4 py-2 shadow-md" style={{ background: `linear-gradient(90deg, ${sectionFrom}, ${sectionTo})` }}>
                    <h3 className="text-lg font-bold">{col.side} Side</h3>
                  </div>

                  {col.url && <CornerZoomCrops imageUrl={col.url} side={col.cropSide} slabDetected={slabDetected} />}

                  {/* Corners */}
                  {Object.keys(col.corners).length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-bold text-gray-900">Corners</h4>
                        {col.corners.sub_score !== undefined && (
                          <span className="text-xl font-bold" style={{ color: brand }}>{col.corners.sub_score}/10</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {(['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const).map(k => col.corners[k] && (
                          <div key={k} className="p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="text-xs font-semibold text-gray-900 mb-1">{prettifyKey(k)}</div>
                            <p className="text-xs text-gray-700">{col.corners[k]}</p>
                          </div>
                        ))}
                      </div>
                      <SectionDefects defects={col.corners.defects} />
                      {col.corners.summary && (
                        <div className="pt-3 mt-auto border-t border-gray-200">
                          <p className="text-sm text-gray-800">
                            <span className="font-bold" style={{ color: brand }}>Analysis:</span> {col.corners.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edges */}
                  {Object.keys(col.edges).length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-bold text-gray-900">Edges</h4>
                        {col.edges.sub_score !== undefined && (
                          <span className="text-xl font-bold" style={{ color: brand }}>{col.edges.sub_score}/10</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {(['top', 'bottom', 'left', 'right'] as const).map(k => col.edges[k] && (
                          <div key={k} className="p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="text-xs font-semibold text-gray-900 mb-1">{prettifyKey(k)}</div>
                            <p className="text-xs text-gray-700">{col.edges[k]}</p>
                          </div>
                        ))}
                      </div>
                      <SectionDefects defects={col.edges.defects} />
                      {col.edges.summary && (
                        <div className="pt-3 mt-auto border-t border-gray-200">
                          <p className="text-sm text-gray-800">
                            <span className="font-bold" style={{ color: brand }}>Analysis:</span> {col.edges.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Surface */}
                  {Object.keys(col.surface).length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-bold text-gray-900">Surface</h4>
                        {col.surface.sub_score !== undefined && (
                          <span className="text-xl font-bold" style={{ color: brand }}>{col.surface.sub_score}/10</span>
                        )}
                      </div>
                      {(col.surface.condition || col.surface.analysis) && (
                        <p className="text-xs text-gray-700 mb-3">{col.surface.condition || col.surface.analysis}</p>
                      )}
                      <SectionDefects defects={col.surface.defects} />
                      {col.surface.summary && (
                        <div className="pt-3 mt-auto border-t border-gray-200">
                          <p className="text-sm text-gray-800">
                            <span className="font-bold" style={{ color: brand }}>Analysis:</span> {col.surface.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* --- Grading Confidence Score --- */}
        {imageGrade && (
          <CollapsibleSection title="Grading Confidence Score" badge={imageGrade} gradientFrom={sectionFrom} gradientTo={sectionTo}>
            {(() => {
              const levels: Record<string, { level: string; width: string; color: string; textColor: string; bgColor: string; borderColor: string; uncertainty: string; name: string; description: string }> = {
                A: { level: 'Very High', width: '95%', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', uncertainty: '±0', name: 'Grade A — Excellent', description: 'Clear, well-lit images with no obstructions. Optimal for accurate grading with no uncertainty.' },
                B: { level: 'High', width: '80%', color: 'bg-green-400', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', uncertainty: '±1', name: 'Grade B — Good', description: 'Minor issues with lighting or focus. Reliable grading with minimal uncertainty in fine details.' },
                C: { level: 'Moderate', width: '55%', color: 'bg-yellow-400', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', uncertainty: '±2', name: 'Grade C — Fair', description: 'Moderate issues with glare, blur, or lighting during capture. Fine-detail assessment carries some uncertainty.' },
                D: { level: 'Low', width: '35%', color: 'bg-red-400', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', uncertainty: '±3', name: 'Grade D — Poor', description: 'Significant image quality issues limited assessment accuracy for this card.' },
              };
              const c = levels[imageGrade.toUpperCase().trim()] || levels.B;
              return (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                  <div className="mb-6">
                    <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden shadow-inner">
                      <div className={`h-6 rounded-full ${c.color} flex items-center justify-center transition-all duration-500`} style={{ width: c.width }}>
                        <span className="text-xs font-bold text-white">{c.level}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm font-semibold text-gray-700">Confidence Level: {c.level}</p>
                      <p className="text-sm font-semibold text-gray-600">Grade Uncertainty: {c.uncertainty}</p>
                    </div>
                  </div>

                  <div className={`${c.bgColor} ${c.borderColor} border-2 rounded-lg p-4`}>
                    <h3 className={`text-lg font-bold ${c.textColor} mb-2`}>{c.name}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
                  </div>

                  {/* Protective case detection */}
                  {caseDetection && (() => {
                    const caseType = caseDetection.case_type || 'none';
                    const caseVisible = caseType !== 'none';
                    return caseVisible ? (
                      <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                        <h3 className="text-base font-bold text-blue-800 mb-2">
                          Protective Case Detected: {String(caseType).replace(/_/g, ' ').toUpperCase()}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          {caseDetection.case_visibility && (
                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Visibility</p>
                              <p className="font-semibold text-blue-700 capitalize">{caseDetection.case_visibility}</p>
                            </div>
                          )}
                          {caseDetection.impact_level && (
                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Impact Level</p>
                              <p className="font-semibold text-blue-700 capitalize">{caseDetection.impact_level}</p>
                            </div>
                          )}
                          {caseDetection.adjusted_uncertainty && (
                            <div className="bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Uncertainty Adjustment</p>
                              <p className="font-semibold text-blue-700">{caseDetection.adjusted_uncertainty}</p>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-blue-700 mt-2 italic">
                          Protective cases may limit visibility of minor defects and can increase grade uncertainty.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 bg-green-50 border-2 border-green-200 rounded-lg p-4">
                        <h3 className="text-base font-bold text-green-800 mb-1">Raw Card — No Protective Case</h3>
                        <p className="text-sm text-green-700">
                          Card photographed without protective covering. All features and defects fully visible for optimal assessment accuracy.
                        </p>
                      </div>
                    );
                  })()}

                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Grading confidence based on image clarity, protective case impact, defect detection certainty, and grade uncertainty.
                  </p>
                </div>
              );
            })()}
          </CollapsibleSection>
        )}

        {/* --- Market Value --- */}
        {hasMarketSection && (
          <CollapsibleSection
            title="Market Value"
            badge={price.estimate !== null ? `~$${Math.round(price.estimate)}` : undefined}
            gradientFrom={sectionFrom}
            gradientTo={sectionTo}
          >
            {price.estimate !== null ? (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-sm p-5 border-2 border-emerald-200 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-emerald-700">Estimated Market Value</span>
                    <p className="text-3xl font-bold text-emerald-800 mt-1">{usd(price.estimate)}</p>
                    {price.productName && (
                      <p className="text-xs text-gray-600 mt-1">Matched listing: {price.productName}</p>
                    )}
                  </div>
                  {price.confidence && (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      price.confidence === 'high' ? 'bg-green-100 text-green-700' :
                      price.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {price.confidence === 'high' ? 'Best Match' : price.confidence === 'medium' ? 'Good Match' : 'Partial Match'}
                    </span>
                  )}
                </div>

                {(price.raw !== null || price.median !== null || price.average !== null || price.gradedHigh !== null) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {([
                      ['Raw / Ungraded', price.raw],
                      ['Median Sale', price.median],
                      ['Average Sale', price.average],
                      ['Graded High', price.gradedHigh],
                    ] as const).map(([lbl, v]) => v !== null && (
                      <div key={lbl} className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                        <p className="text-xs text-gray-500">{lbl}</p>
                        <p className="font-bold text-gray-800">{usd(v)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                  Value is estimated conservatively from live sold pricing for raw and graded copies of the matched listing.
                  The exact parallel or version may differ. Actual sale prices vary with condition and demand.
                  {price.updatedAt && (
                    <> Last updated {new Date(price.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.</>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-6">No saved price estimate is available for this card yet.</p>
            )}

            {/* Full market detail from the card's saved pricing payload:
                price range, price-by-grade chart, PSA/BGS/SGC tables,
                source attribution, confidence glossary. */}
            {cachedPrices?.prices && (
              <div className="mb-6">
                <OrgMarketValueDetails
                  cached={cachedPrices}
                  dcmGrade={label.grade}
                  dcmEstimate={price.estimate}
                  brand={brand}
                  isSportsCard={isSportsCard}
                  searchFallbackUrl={marketSearchUrl}
                  graderName={orgName}
                />
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ================= Downloads ================= */}
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Downloads</h2>
          <p className="text-sm text-gray-600 mb-4">
            Card images and grading reports for this card, branded for {orgName}.
          </p>
          <div className="flex justify-center">
            <DownloadReportButton
              card={{ ...card, front_url: frontUrl, back_url: backUrl }}
              cardType={(['pokemon', 'sports', 'mtg', 'lorcana'].includes(card.category || '')
                ? card.category
                : 'other') as 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'other'}
              publicMenu
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Read a value already resolved into the Card Information rows. */
function infoValue(rows: { label: string; value: string }[], label: string): string | undefined {
  return rows.find(r => r.label === label)?.value;
}
