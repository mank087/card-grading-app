/**
 * eBay listing description HTML — single source of truth.
 *
 * Replaces the duplicated generateHtmlDescription copies in EbayListingModal
 * and ebay-image-prep. Three concerns:
 *
 * 1. BRANDING: consumer listings keep the classic DCM purple design; org
 *    (enterprise) listings theme with the store's name and brand color, with
 *    "Powered by DCM Optic™" attribution.
 * 2. TEMPLATES: a saved user/org template with {mergeField} tokens can
 *    replace the standard layout entirely (renderDescriptionTemplate).
 * 3. EBAY LINKS POLICY: listings may not contain links OR web addresses to
 *    external sites, even non-clickable ones (ebay.com/help/policies/
 *    listing-policies/links-policy?id=4248). Nothing here may emit a URL or
 *    an <a> tag. Verification is referenced by registry name + serial only.
 */

import { getGradeMeaning } from '@/lib/conditionAssessment';
import { stripBlockedGraders, stripBlockedGraderSentences } from './gradingCompanyBlocklist';
import type { ListingFields } from './listingFields';

/**
 * null = this card has no sub-grade for that area. A card with no numeric
 * grade at all (Authentic / Altered) used to render "0 0 0 0", which reads to
 * a buyer as four failing sub-grades rather than as no sub-grades.
 */
export interface ListingSubgrades {
  centering: number | null;
  corners: number | null;
  edges: number | null;
  surface: number | null;
}

export interface ListingDescriptionFields {
  primaryName: string;
  setName: string;
  cardNumber: string;
  /** null when the card genuinely has no numeric grade ("Authentic"). */
  grade: number | null;
  conditionLabel: string;
  overview: string;
  subgrades: ListingSubgrades;
  /** Display serial: org serial (APX442921) for enterprise, DCM serial else. */
  serial: string;

  /* --- v2 (all optional: older callers keep working unchanged) --- */
  /** The listing title, repeated as the plain-text headline. */
  title?: string;
  /** Grade brand for "{label} 9" — an org's storefront name, else 'DCM'. */
  gradeLabel?: string;
  /** Full resolver output; drives the details table and the merge fields. */
  fields?: ListingFields;
  /** Label/value rows for the card details table (listingDetailRows). */
  details?: Array<{ label: string; value: string }>;
  /** Prose summary of the listing's own shipping/returns form. */
  shippingSummary?: string;
  /** One natural sentence of search terms (buildKeywordSentence). */
  keywords?: string;
  /** Grade notation, e.g. "Altered - Unverified Autograph". */
  designation?: string | null;
}

export interface ListingBranding {
  name: string;
  brandColor?: string | null;
}

/** {brandName} default — unchanged from v1 so saved templates render the same. */
const DEFAULT_BRAND_NAME = 'DCM';
/** The trust block spells the company out in full. */
const DEFAULT_TRUST_BRAND_NAME = 'DCM Grading';
/** Grade brand shown beside the number, e.g. "DCM 9". */
const DEFAULT_GRADE_LABEL = 'DCM';

/** Grade color scale shared by the standard layout (matches web styling). */
export function getListingGradeColor(grade: number): string {
  if (grade >= 9) return '#10B981';
  if (grade >= 7) return '#3B82F6';
  if (grade >= 5) return '#F59E0B';
  return '#EF4444';
}

function darken(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - pct))));
  return '#' + ((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

/** Mix a hex color toward white by pct (0-1). lighten(#7C3AED, 0.4) ≈ #A78BFA-ish. */
function lighten(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * pct)));
  return '#' + ((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Merge fields available in saved description templates. Tokens are replaced
 * case-sensitively; unknown tokens are left as-is so typos are visible in
 * the preview instead of silently disappearing.
 */
export const DESCRIPTION_MERGE_FIELDS: { token: string; label: string }[] = [
  { token: '{cardName}', label: 'Card / player name' },
  { token: '{setName}', label: 'Set name' },
  { token: '{cardNumber}', label: 'Card number' },
  { token: '{grade}', label: 'Grade (whole number)' },
  { token: '{condition}', label: 'Condition label (e.g. Mint)' },
  { token: '{serial}', label: 'Certification serial' },
  { token: '{summary}', label: 'Condition overview text' },
  { token: '{centering}', label: 'Centering sub-grade' },
  { token: '{corners}', label: 'Corners sub-grade' },
  { token: '{edges}', label: 'Edges sub-grade' },
  { token: '{surface}', label: 'Surface sub-grade' },
  { token: '{brandName}', label: 'Grading brand name (your store, or DCM)' },
  { token: '{gradeLabel}', label: 'Grade brand shown beside the number' },
  { token: '{year}', label: 'Year' },
  { token: '{manufacturer}', label: 'Manufacturer / brand' },
  { token: '{parallel}', label: 'Parallel / variety' },
  { token: '{rarity}', label: 'Rarity' },
  { token: '{rookie}', label: 'Rookie card ("Yes" or blank)' },
  { token: '{autograph}', label: 'Autograph format, or blank' },
  { token: '{serialNumbering}', label: 'Serial numbering, e.g. 12/99' },
  { token: '{language}', label: 'Language' },
  { token: '{team}', label: 'Team' },
  { token: '{sport}', label: 'Sport' },
  { token: '{finish}', label: 'Finish (Holo / Foil / Regular)' },
  { token: '{shippingSummary}', label: 'Shipping & returns summary' },
  { token: '{keywords}', label: 'Keyword sentence' },
];

/**
 * Starter templates offered in Store settings → Listings. All three obey the
 * eBay links policy (no URLs, no <a>, no external images), stay single-column
 * and use inline styles only, so eBay's mobile-friendly check passes.
 */
export const DESCRIPTION_TEMPLATE_PRESETS: { id: string; name: string; blurb: string; template: string }[] = [
  {
    id: 'clean',
    name: 'Clean',
    blurb: 'Grade, card, sub-grades. Nothing else.',
    template: `<div style="font-family: Arial, sans-serif; max-width: 700px; width: 100%; margin: 0 auto; color: #1F2937;">
  <p style="font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">{cardName} &ndash; {setName} #{cardNumber}</p>
  <p style="font-size: 32px; font-weight: bold; margin: 0 0 4px 0;">{gradeLabel} {grade}</p>
  <p style="font-size: 16px; color: #4B5563; margin: 0 0 16px 0;">{condition} &middot; Serial {serial}</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 4px 0; color: #6B7280;">Centering</td><td style="padding: 4px 0; text-align: right;">{centering}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Corners</td><td style="padding: 4px 0; text-align: right;">{corners}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Edges</td><td style="padding: 4px 0; text-align: right;">{edges}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Surface</td><td style="padding: 4px 0; text-align: right;">{surface}</td></tr>
  </table>
  <p style="font-size: 12px; color: #6B7280; margin: 16px 0 0 0;">Graded and encapsulated by {brandName}, powered by DCM Optic&trade;. Look up serial {serial} on the DCM Grading registry.</p>
</div>`,
  },
  {
    id: 'detailed',
    name: 'Detailed',
    blurb: 'Every card attribute, the condition report, shipping and keywords.',
    template: `<div style="font-family: Arial, sans-serif; max-width: 700px; width: 100%; margin: 0 auto; color: #1F2937;">
  <p style="font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">{cardName} &ndash; {setName} #{cardNumber} &ndash; {gradeLabel} {grade}</p>
  <h3 style="font-size: 16px; margin: 0 0 8px 0;">Card details</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 4px 0; color: #6B7280;">Name</td><td style="padding: 4px 0; text-align: right;">{cardName}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Year</td><td style="padding: 4px 0; text-align: right;">{year}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Manufacturer</td><td style="padding: 4px 0; text-align: right;">{manufacturer}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Set</td><td style="padding: 4px 0; text-align: right;">{setName}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Card number</td><td style="padding: 4px 0; text-align: right;">{cardNumber}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Parallel</td><td style="padding: 4px 0; text-align: right;">{parallel}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Rarity</td><td style="padding: 4px 0; text-align: right;">{rarity}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Rookie</td><td style="padding: 4px 0; text-align: right;">{rookie}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Autograph</td><td style="padding: 4px 0; text-align: right;">{autograph}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Serial numbering</td><td style="padding: 4px 0; text-align: right;">{serialNumbering}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Finish</td><td style="padding: 4px 0; text-align: right;">{finish}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Team</td><td style="padding: 4px 0; text-align: right;">{team}</td></tr>
    <tr><td style="padding: 4px 0; color: #6B7280;">Language</td><td style="padding: 4px 0; text-align: right;">{language}</td></tr>
  </table>
  <h3 style="font-size: 16px; margin: 0 0 8px 0;">{gradeLabel} {grade} &middot; {condition}</h3>
  <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 8px 0;">{summary}</p>
  <p style="font-size: 14px; color: #4B5563; margin: 0 0 16px 0;">Centering {centering} &middot; Corners {corners} &middot; Edges {edges} &middot; Surface {surface}</p>
  <h3 style="font-size: 16px; margin: 0 0 8px 0;">Shipping &amp; returns</h3>
  <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">{shippingSummary}</p>
  <p style="font-size: 12px; color: #6B7280; margin: 0 0 8px 0;">Graded and encapsulated by {brandName}, powered by DCM Optic&trade;. Look up serial {serial} on the DCM Grading registry.</p>
  <p style="font-size: 11px; color: #9CA3AF; margin: 0;">{keywords}</p>
</div>`,
  },
  {
    id: 'store-branded',
    name: 'Store branded',
    blurb: 'Leads with your store name and a banner in your brand colour.',
    template: `<div style="font-family: Arial, sans-serif; max-width: 700px; width: 100%; margin: 0 auto; color: #1F2937;">
  <div style="background: #111827; color: #FFFFFF; padding: 18px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
    <div style="font-size: 22px; font-weight: bold;">{brandName}</div>
    <div style="font-size: 13px; opacity: 0.85;">Graded in-house &middot; Powered by DCM Optic&trade;</div>
  </div>
  <p style="font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">{cardName} &ndash; {setName} #{cardNumber}</p>
  <p style="font-size: 34px; font-weight: bold; margin: 0 0 4px 0;">{gradeLabel} {grade}</p>
  <p style="font-size: 15px; color: #4B5563; margin: 0 0 16px 0;">{condition} &middot; {year} &middot; {parallel} {rarity} {finish}</p>
  <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">{summary}</p>
  <p style="font-size: 14px; color: #4B5563; margin: 0 0 16px 0;">Centering {centering} &middot; Corners {corners} &middot; Edges {edges} &middot; Surface {surface}</p>
  <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">{shippingSummary}</p>
  <p style="font-size: 12px; color: #6B7280; margin: 0 0 8px 0;">Graded and encapsulated by {brandName}. Every slab carries its own serial &ndash; look up serial {serial} on the DCM Grading registry.</p>
  <p style="font-size: 11px; color: #9CA3AF; margin: 0;">{keywords}</p>
</div>`,
  },
];

/**
 * Render a saved template by substituting {mergeField} tokens.
 *
 * The rendered OUTPUT is run through the rival-grader block list: a store
 * template is user-written text, and a template that names PSA/BGS/CGC would
 * otherwise walk straight past the title builder's checks into the listing.
 */
export function renderDescriptionTemplate(
  template: string,
  fields: ListingDescriptionFields,
  branding?: ListingBranding | null
): string {
  const f = fields.fields;
  const hasNumber = typeof fields.grade === 'number' && Number.isFinite(fields.grade) && fields.grade > 0;
  const sub = (v: number | null) => (typeof v === 'number' && v > 0 ? String(v) : '');
  const values: Record<string, string> = {
    '{cardName}': escapeHtml(fields.primaryName || ''),
    '{setName}': escapeHtml(fields.setName || ''),
    '{cardNumber}': escapeHtml(fields.cardNumber || ''),
    // No number on file means "Authentic" — never a rounded 0.
    '{grade}': hasNumber ? String(Math.round(fields.grade as number)) : 'Authentic',
    '{condition}': escapeHtml(fields.conditionLabel || ''),
    '{serial}': escapeHtml(fields.serial || ''),
    '{summary}': escapeHtml(stripLinks(fields.overview || '')),
    '{centering}': sub(fields.subgrades.centering),
    '{corners}': sub(fields.subgrades.corners),
    '{edges}': sub(fields.subgrades.edges),
    '{surface}': sub(fields.subgrades.surface),
    '{brandName}': escapeHtml(branding?.name || DEFAULT_BRAND_NAME),
    '{gradeLabel}': escapeHtml(fields.gradeLabel || DEFAULT_GRADE_LABEL),
    '{year}': escapeHtml(f?.year || ''),
    '{manufacturer}': escapeHtml(f?.manufacturer || ''),
    '{parallel}': escapeHtml(f?.parallel || ''),
    '{rarity}': escapeHtml(f?.rarity || ''),
    '{rookie}': f?.rookie ? 'Yes' : '',
    '{autograph}': escapeHtml(f?.autograph ? (f.autographFormat || 'Yes') : ''),
    '{serialNumbering}': escapeHtml(f?.serialNumbering || ''),
    '{language}': escapeHtml(f?.language || ''),
    '{team}': escapeHtml(f?.team || ''),
    '{sport}': escapeHtml(f?.sport || ''),
    '{finish}': escapeHtml(f?.finish || ''),
    '{shippingSummary}': escapeHtml(stripLinks(fields.shippingSummary || '')),
    '{keywords}': escapeHtml(stripLinks(fields.keywords || '')),
  };
  const rendered = template.replace(/\{[a-zA-Z]+\}/g, token => (token in values ? values[token] : token));
  // Links policy AND the rival-grader rule, on the whole rendered output: a
  // saved template is hand-written text and can carry either.
  return stripBlockedGraderSentences(stripLinks(rendered));
}

/**
 * Standard listing description layout. Consumer: DCM purple + DCM naming.
 * Org: brand color + store naming + DCM Optic attribution. No URLs anywhere
 * (eBay links policy).
 */
export function generateHtmlDescription(
  data: ListingDescriptionFields,
  branding?: ListingBranding | null
): string {
  const { primaryName, setName, cardNumber, grade, conditionLabel, subgrades, serial } = data;

  // FREE TEXT that originates outside this module — the grader's own prose and
  // the resolved card fields — is run through the rival-grader block list AND
  // the links policy. The model happily writes "PSA would call this a 9" into a
  // grade summary, and a seller types their own store address into one; both
  // land in the listing verbatim otherwise. (The template renderer and the
  // sanitizer strip their own output the same way.)
  const overview = stripBlockedGraderSentences(stripLinks(data.overview || ''));
  const shippingSummary = stripLinks(data.shippingSummary || '').trim();

  const brandName = branding?.name || DEFAULT_BRAND_NAME;
  // The trust block names the company in full; the banner keeps the short form.
  const trustBrandName = branding?.name || DEFAULT_TRUST_BRAND_NAME;
  const gradeLabel = data.gradeLabel || DEFAULT_GRADE_LABEL;
  // The grade is the NUMBER. A v9.23 unverified-autograph card keeps its full
  // numeric grade and shows the designation beside it — "Authentic" appears
  // only for a card that genuinely has no number.
  const hasNumber = typeof grade === 'number' && Number.isFinite(grade) && grade > 0;
  const gradeDisplay = hasNumber ? String(grade) : 'Authentic';
  // No number, no colour scale — an ungraded card is not a red "1".
  const gradeColor = hasNumber ? getListingGradeColor(grade as number) : '#6B7280';
  const accent = branding?.brandColor && /^#[0-9a-f]{6}$/i.test(branding.brandColor) ? branding.brandColor : '#7C3AED';
  const accentDark = branding ? darken(accent, 0.35) : '#5B21B6';
  const accentLight = branding ? lighten(accent, 0.4) : '#A78BFA';
  const gray = '#4B5563';

  const headerSub = branding
    ? 'Professionally Graded In-House &middot; Powered by DCM Optic&trade;'
    : 'Professional AI-Powered Card Grading';
  const footerTitle = `Graded by ${escapeHtml(brandName)}`;
  const footerSub = branding
    ? 'AI-powered grading by DCM Optic&trade;'
    : 'Professional AI-Powered Card Grading';
  // Links policy: registry referenced by NAME + serial only — no web address.
  const verifyLine = `Verify this card&#39;s grade on the DCM Grading registry using serial ${escapeHtml(serial)}`;

  // v2 sections. Each is empty when the caller has nothing for it, so the
  // pre-v2 callers (which pass none of these) render the original layout plus
  // the fixed trust block.
  const detailRows = (data.details || [])
    .map(r => ({ label: r.label, value: stripBlockedGraders(stripLinks(r.value || '')).trim() }))
    .filter(r => r.value);
  const detailsTable = detailRows.length > 0
    ? detailRows
        .map(
          r =>
            `<tr><td style="padding: 6px 0; color: ${gray}; font-weight: 600;">${escapeHtml(r.label)}:</td>` +
            `<td style="padding: 6px 0; text-align: right;">${escapeHtml(r.value)}</td></tr>`
        )
        .join('\n      ')
    : [
        // Legacy three-row fallback for callers that pass no resolver output.
        primaryName ? `<tr><td style="padding: 6px 0; color: ${gray}; font-weight: 600;">Character/Player:</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(primaryName)}</td></tr>` : '',
        setName ? `<tr><td style="padding: 6px 0; color: ${gray}; font-weight: 600;">Set:</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(setName)}</td></tr>` : '',
        cardNumber ? `<tr><td style="padding: 6px 0; color: ${gray}; font-weight: 600;">Card Number:</td><td style="padding: 6px 0; text-align: right;">#${escapeHtml(cardNumber)}</td></tr>` : '',
      ].filter(Boolean).join('\n      ');

  // "What DCM 9 means" — verbatim from the published DCM Grading Standard.
  const gradeMeaning = hasNumber ? getGradeMeaning(grade as number) : '';

  const keywords = stripBlockedGraderSentences(stripLinks(data.keywords || '')).trim();
  const designation = stripBlockedGraders(stripLinks(data.designation || '')).trim();

  // Headline: the plain-text line the "search in description" index and screen
  // readers see first. Kept as text, never a heading image or a link.
  const headlineText = stripBlockedGraders(stripLinks(data.title || '')).trim();
  const headline = headlineText
    ? `<p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 16px 0; line-height: 1.4;">${escapeHtml(headlineText)}</p>`
    : '';

  // Sub-grade cells. An area with no sub-grade is OMITTED — an Authentic card
  // with no numeric grade used to print "0 0 0 0", which reads as four failing
  // sub-grades. With nothing to show, the whole block goes.
  const subgradeCells: Array<[string, number]> = ([
    ['Centering', subgrades.centering],
    ['Corners', subgrades.corners],
    ['Edges', subgrades.edges],
    ['Surface', subgrades.surface],
  ] as Array<[string, number | null]>)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0);
  const subgradesBlock = subgradeCells.length === 0 ? '' : `<div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">${escapeHtml(brandName)} Sub-Grades</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        ${subgradeCells
          .map(([label, value], i) => {
            const radius =
              subgradeCells.length === 1 ? '8px'
                : i === 0 ? '8px 0 0 8px'
                : i === subgradeCells.length - 1 ? '0 8px 8px 0'
                : '0';
            return `<td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: ${radius};">
          <div style="font-size: 24px; font-weight: bold; color: ${getListingGradeColor(value)};">${value}</div>
          <div style="font-size: 12px; color: ${gray};">${label}</div>
        </td>`;
          })
          .join('\n        ')}
      </tr>
    </table>
  </div>`;

  return `
<div style="font-family: Arial, sans-serif; max-width: 700px; width: 100%; margin: 0 auto;">
  ${headline}
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px;">${escapeHtml(brandName)} Graded Card</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">${headerSub}</p>
  </div>

  <!-- Grade Display -->
  <div style="background: #F9FAFB; border: 2px solid ${gradeColor}; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <div style="font-size: 48px; font-weight: bold; color: ${gradeColor};">${escapeHtml(gradeDisplay)}</div>
    <div style="font-size: 18px; color: ${gray}; font-weight: 600;">${escapeHtml(conditionLabel)}</div>
    ${designation ? `<div style="font-size: 13px; color: ${gray}; margin-top: 6px;">${escapeHtml(designation)}</div>` : ''}
    ${gradeMeaning ? `<p style="font-size: 13px; color: ${gray}; margin: 10px 0 0 0; line-height: 1.5;">What ${escapeHtml(gradeLabel)} ${escapeHtml(gradeDisplay)} means: ${escapeHtml(gradeMeaning)}</p>` : ''}
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">Serial: <strong>${escapeHtml(serial)}</strong></div>
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">Look up serial ${escapeHtml(serial)} on the DCM Grading registry to confirm this grade.</div>
  </div>

  <!-- Card Details -->
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">Card Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${detailsTable}
    </table>
  </div>

  <!-- Card Overview -->
  ${overview ? `
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">Condition Overview</h3>
    <p style="color: ${gray}; line-height: 1.6; margin: 0;">${escapeHtml(overview)}</p>
  </div>
  ` : ''}

  <!-- Sub-Grades -->
  ${subgradesBlock}

  <!-- About the grading (fixed copy; only the brand name is substituted, so a
       store template can never write a competitor's name into it) -->
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 12px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">About the grading</h3>
    <p style="color: ${gray}; line-height: 1.6; margin: 0;">
      Graded by ${escapeHtml(trustBrandName)} using DCM Optic&trade; computer-vision grading.
      Every grade is verifiable by serial number on the ${escapeHtml(trustBrandName)} registry.
    </p>
  </div>

  <!-- Shipping & returns, generated from this listing's own settings -->
  ${shippingSummary ? `
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 12px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">Shipping &amp; returns</h3>
    <p style="color: ${gray}; line-height: 1.6; margin: 0;">${escapeHtml(shippingSummary)}</p>
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: white; padding: 16px 20px; border-radius: 8px; text-align: center;">
    <div style="font-size: 18px; font-weight: bold;">${footerTitle}</div>
    <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">${footerSub}</p>
    <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">${verifyLine}</p>
  </div>

  <!-- Keyword footer: one natural sentence of terms that are TRUE of this card
       (eBay's keyword-spamming policy draws the line exactly there). -->
  ${keywords ? `<p style="font-size: 11px; color: #9CA3AF; margin: 12px 0 0 0; line-height: 1.5;">${escapeHtml(keywords)}</p>` : ''}
</div>
`.trim();
}

/* ------------------------------------------------------------------ */
/* Shipping summary                                                    */
/* ------------------------------------------------------------------ */

/** The subset of the listing modal's shippingForm this summary reads. */
export interface ShippingSummaryInput {
  shippingType: 'FREE' | 'FLAT_RATE' | 'CALCULATED';
  domesticShippingService?: string;
  flatRateAmount?: number;
  handlingDays?: number;
  offerInternational?: boolean;
  domesticReturnsAccepted?: boolean;
  domesticReturnPeriodDays?: number;
  domesticReturnShippingPaidBy?: 'BUYER' | 'SELLER';
}

/**
 * The same paragraph for a listing that runs on eBay BUSINESS POLICIES.
 *
 * Nothing here can be restated in detail: the cost, the service and the
 * return window live in a policy on eBay's side, and re-describing them from
 * a stale copy is worse than not describing them — a description that
 * contradicts the shipping block eBay renders directly above it is exactly
 * the kind of listing eBay pulls. So the summary NAMES the policy and leaves
 * the terms to eBay, which shows them on the same page.
 *
 * The names are passed in (from the batch settings or the modal's dropdowns)
 * rather than fetched, so building a description never needs a network call.
 */
export function buildPolicyShippingSummary(
  shippingPolicyName?: string | null,
  returnPolicyName?: string | null
): string {
  const parts: string[] = [];
  parts.push(
    shippingPolicyName
      ? `Ships via the seller's eBay shipping policy: ${shippingPolicyName}.`
      : "Ships via the seller's eBay shipping policy."
  );
  parts.push(
    returnPolicyName
      ? `Returns follow the seller's eBay return policy: ${returnPolicyName}.`
      : "Returns follow the seller's eBay return policy."
  );
  parts.push('Full shipping and return terms are shown in the listing details above.');
  parts.push('Every card ships in a protective sleeve inside a rigid, tracked package.');
  return parts.join(' ');
}

/**
 * Prose summary of the listing's own shipping/returns settings, for the
 * description. Buyers look for this before scrolling to eBay's own block.
 *
 * `serviceLabel` is the human name of the carrier service — the caller passes
 * it from DOMESTIC_SHIPPING_SERVICES so this module stays free of eBay
 * service-token tables.
 */
export function buildShippingSummary(form: ShippingSummaryInput, serviceLabel?: string): string {
  const parts: string[] = [];

  const service = serviceLabel || 'a tracked carrier service';
  if (form.shippingType === 'FREE') {
    parts.push(`Free shipping via ${service}.`);
  } else if (form.shippingType === 'FLAT_RATE') {
    const amount = typeof form.flatRateAmount === 'number' ? form.flatRateAmount.toFixed(2) : null;
    parts.push(amount ? `Flat-rate shipping of $${amount} via ${service}.` : `Flat-rate shipping via ${service}.`);
  } else {
    parts.push(`Shipping calculated at checkout via ${service}.`);
  }

  const handling = form.handlingDays;
  if (typeof handling === 'number') {
    parts.push(
      handling <= 0
        ? 'Ships the same business day.'
        : `Ships within ${handling} business day${handling === 1 ? '' : 's'} of cleared payment.`
    );
  }

  parts.push(
    form.offerInternational
      ? 'International shipping is offered.'
      : 'Domestic shipping only.'
  );

  if (form.domesticReturnsAccepted) {
    const days = form.domesticReturnPeriodDays ?? 30;
    const paidBy = form.domesticReturnShippingPaidBy === 'SELLER' ? 'seller' : 'buyer';
    parts.push(`Returns accepted within ${days} days; return shipping paid by the ${paidBy}.`);
  } else {
    parts.push('Returns are not accepted; the card ships sealed in its slab exactly as pictured.');
  }

  parts.push('Every card ships in a protective sleeve inside a rigid, tracked package.');

  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Preview sanitizer                                                   */
/* ------------------------------------------------------------------ */

/**
 * Tags the standard generated description (and reasonable templates) use.
 * Anything else — script/style/iframe/object/embed/form/svg/etc. — is
 * removed entirely (content of script/style/iframe-likes dropped too).
 */
const SANITIZE_ALLOWED_TAGS = new Set([
  'div', 'table', 'tbody', 'thead', 'tr', 'td', 'th',
  'h1', 'h2', 'h3', 'h4', 'p', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'img', 'br', 'hr', 'blockquote', 'small', 'sup', 'sub',
  'center', 'font',
]);

const SANITIZE_ALLOWED_ATTRS = new Set([
  'style', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan',
  'cellpadding', 'cellspacing', 'border', 'alt', 'title', 'color', 'size', 'face',
]);

/**
 * Bare domains, with or without a path: "dcmgrading.com/verify", "mystore.com".
 * The TLD list is an ALLOW-list on purpose — a generic `\w+\.\w+` would eat
 * "9.5", "Mr. Smith" and "front.jpg" out of ordinary description prose.
 */
const BARE_DOMAIN_PATTERN =
  /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|co|us|uk|ca|au|de|jp|shop|store|gg|tv|xyz|info|biz|dev|app|me|online|site|link)\b(?:\/[^\s"'<>]*)?/gi;

/** Email addresses are a contact route off eBay, forbidden the same way. */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** `src="…"` of an <img>, so an allowed image source can be protected. */
const IMG_SRC_PATTERN = /(<img\b[^>]*?\bsrc\s*=\s*)("[^"]*"|'[^']*')/gi;

/**
 * Hide the src of every <img> whose source `isSafeImgSrc` allows, so the URL
 * scrubbing below cannot blank a legitimate listing image. Everything else —
 * including an img src we would not have allowed anyway — stays visible to it.
 */
function maskSafeImgSrcs(html: string): { masked: string; restore: (s: string) => string } {
  const saved: string[] = [];
  const masked = html.replace(IMG_SRC_PATTERN, (full, prefix: string, quoted: string) => {
    if (!isSafeImgSrc(quoted.slice(1, -1))) return full;
    const token = `__DCM_IMG_SRC_${saved.length}__`;
    saved.push(quoted);
    return `${prefix}${token}`;
  });
  return {
    masked,
    restore: s => s.replace(/__DCM_IMG_SRC_(\d+)__/g, (m, i: string) => saved[Number(i)] ?? m),
  };
}

/**
 * eBay's links policy forbids links AND bare web addresses, even
 * non-clickable ones. Our own layouts emit neither, but store templates, the
 * grader's prose and anything a seller types are hand-written text — so
 * anchors are unwrapped (the link text survives, the link does not) and URLs,
 * "www." addresses, bare domains and email addresses are removed.
 *
 * The one thing that survives is the src of an allowed <img>: the listing's
 * own photos are https URLs, and blanking them left an empty image element.
 */
export function stripLinks(html: string): string {
  if (!html) return html;
  const { masked, restore } = maskSafeImgSrcs(html);
  const stripped = masked
    .replace(/<\/?a\b[^>]*>/gi, '')
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, '')
    .replace(/\bwww\.[^\s"'<>]+/gi, '')
    // Email first: the bare-domain pass would otherwise leave "sales@" behind.
    .replace(EMAIL_PATTERN, '')
    .replace(BARE_DOMAIN_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ');
  return restore(stripped);
}

/** Does this text carry a link or a web address the links policy forbids? */
export function containsLinkOrUrl(text: string): boolean {
  if (!text) return false;
  const { masked } = maskSafeImgSrcs(text);
  EMAIL_PATTERN.lastIndex = 0;
  BARE_DOMAIN_PATTERN.lastIndex = 0;
  return (
    /<a\b/i.test(masked) ||
    /\bhttps?:\/\//i.test(masked) ||
    /\bwww\./i.test(masked) ||
    EMAIL_PATTERN.test(masked) ||
    BARE_DOMAIN_PATTERN.test(masked)
  );
}

/** Attribute values / style values that could execute or load active content. */
function isDangerousValue(value: string): boolean {
  const v = value.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
  return v.includes('javascript:') || v.includes('vbscript:') || v.includes('expression(') || v.includes('url(');
}

function isSafeImgSrc(value: string): boolean {
  const v = value.trim();
  return /^https?:\/\//i.test(v) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v);
}

/**
 * Sanitize listing-description HTML for in-app preview rendering
 * (dangerouslySetInnerHTML). Allowlist-based: keeps the tags/attrs the
 * standard generated layout uses, drops scripts, event handlers,
 * javascript: URLs, and embedded frames/objects.
 *
 * IMPORTANT: sanitize at RENDER time only. The stored template and the HTML
 * submitted to eBay stay untouched (eBay strips active content itself); the
 * browser preview is the attack surface this defends.
 *
 * Uses the real DOM parser when available (client components); falls back to
 * a conservative regex strip during SSR so previews never render raw markup.
 */
export function sanitizeListingHtml(html: string): string {
  if (!html) return '';

  if (typeof document !== 'undefined') {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;

    const walk = (node: Element) => {
      // Snapshot children first — we mutate while iterating.
      for (const child of Array.from(node.children)) {
        const tag = child.tagName.toLowerCase();
        if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
          // Remove tag AND contents for active-content containers; unwrap
          // (keep text/children) for unknown-but-inert wrappers like <a>/<section>.
          if (['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'template', 'noscript'].includes(tag)) {
            child.remove();
          } else {
            walk(child);
            child.replaceWith(...Array.from(child.childNodes));
          }
          continue;
        }
        // Scrub attributes on kept elements.
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          if (name === 'src' && tag === 'img') {
            if (!isSafeImgSrc(value)) child.removeAttribute(attr.name);
            continue;
          }
          if (!SANITIZE_ALLOWED_ATTRS.has(name) || name.startsWith('on') || isDangerousValue(value)) {
            child.removeAttribute(attr.name);
          }
        }
        walk(child);
      }
    };
    walk(tpl.content as unknown as Element);
    // Rival grading companies are stripped here too, so a hand-edited raw-HTML
    // description can't reintroduce a name the template renderer removed.
    return stripBlockedGraderSentences(stripLinks(tpl.innerHTML));
  }

  // SSR fallback: strip active-content blocks, event handlers, and js: URLs.
  return stripBlockedGraderSentences(stripLinks(html
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|noscript|template|svg|math)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href|formaction|action)\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|javascript:[^\s>]+)/gi, '')));
}
