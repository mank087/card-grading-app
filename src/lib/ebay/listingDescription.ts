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

export interface ListingSubgrades {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}

export interface ListingDescriptionFields {
  primaryName: string;
  setName: string;
  cardNumber: string;
  grade: number;
  conditionLabel: string;
  overview: string;
  subgrades: ListingSubgrades;
  /** Display serial: org serial (APX442921) for enterprise, DCM serial else. */
  serial: string;
}

export interface ListingBranding {
  name: string;
  brandColor?: string | null;
}

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
];

/** Render a saved template by substituting {mergeField} tokens. */
export function renderDescriptionTemplate(
  template: string,
  fields: ListingDescriptionFields,
  branding?: ListingBranding | null
): string {
  const values: Record<string, string> = {
    '{cardName}': escapeHtml(fields.primaryName || ''),
    '{setName}': escapeHtml(fields.setName || ''),
    '{cardNumber}': escapeHtml(fields.cardNumber || ''),
    '{grade}': String(Math.round(fields.grade)),
    '{condition}': escapeHtml(fields.conditionLabel || ''),
    '{serial}': escapeHtml(fields.serial || ''),
    '{summary}': escapeHtml(fields.overview || ''),
    '{centering}': String(fields.subgrades.centering),
    '{corners}': String(fields.subgrades.corners),
    '{edges}': String(fields.subgrades.edges),
    '{surface}': String(fields.subgrades.surface),
    '{brandName}': escapeHtml(branding?.name || 'DCM'),
  };
  return template.replace(/\{[a-zA-Z]+\}/g, token => (token in values ? values[token] : token));
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
  const { primaryName, setName, cardNumber, grade, conditionLabel, overview, subgrades, serial } = data;
  const gradeColor = getListingGradeColor(grade);

  const brandName = branding?.name || 'DCM';
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

  return `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  <!-- Header Banner -->
  <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
    <h2 style="margin: 0 0 8px 0; font-size: 24px;">${escapeHtml(brandName)} Graded Card</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">${headerSub}</p>
  </div>

  <!-- Grade Display -->
  <div style="background: #F9FAFB; border: 2px solid ${gradeColor}; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <div style="font-size: 48px; font-weight: bold; color: ${gradeColor};">${grade}</div>
    <div style="font-size: 18px; color: ${gray}; font-weight: 600;">${escapeHtml(conditionLabel)}</div>
    <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px;">Serial: <strong>${escapeHtml(serial)}</strong></div>
  </div>

  <!-- Card Details -->
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">Card Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${primaryName ? `<tr><td style="padding: 8px 0; color: ${gray}; font-weight: 600;">Character/Player:</td><td style="padding: 8px 0; text-align: right;">${escapeHtml(primaryName)}</td></tr>` : ''}
      ${setName ? `<tr><td style="padding: 8px 0; color: ${gray}; font-weight: 600;">Set:</td><td style="padding: 8px 0; text-align: right;">${escapeHtml(setName)}</td></tr>` : ''}
      ${cardNumber ? `<tr><td style="padding: 8px 0; color: ${gray}; font-weight: 600;">Card Number:</td><td style="padding: 8px 0; text-align: right;">#${escapeHtml(cardNumber)}</td></tr>` : ''}
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
  <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="color: ${accent}; margin: 0 0 16px 0; font-size: 18px; border-bottom: 2px solid ${accentLight}; padding-bottom: 8px;">${escapeHtml(brandName)} Sub-Grades</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 8px 0 0 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${getListingGradeColor(subgrades.centering)};">${subgrades.centering}</div>
          <div style="font-size: 12px; color: ${gray};">Centering</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getListingGradeColor(subgrades.corners)};">${subgrades.corners}</div>
          <div style="font-size: 12px; color: ${gray};">Corners</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB;">
          <div style="font-size: 24px; font-weight: bold; color: ${getListingGradeColor(subgrades.edges)};">${subgrades.edges}</div>
          <div style="font-size: 12px; color: ${gray};">Edges</div>
        </td>
        <td style="padding: 12px 8px; text-align: center; background: #F9FAFB; border-radius: 0 8px 8px 0;">
          <div style="font-size: 24px; font-weight: bold; color: ${getListingGradeColor(subgrades.surface)};">${subgrades.surface}</div>
          <div style="font-size: 12px; color: ${gray};">Surface</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: white; padding: 16px 20px; border-radius: 8px; text-align: center;">
    <div style="font-size: 18px; font-weight: bold;">${footerTitle}</div>
    <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">${footerSub}</p>
    <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.7;">${verifyLine}</p>
  </div>
</div>
`.trim();
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

/** Attribute values / style values that could execute or load active content. */
function isDangerousValue(value: string): boolean {
  const v = value.replace(/[\s -]+/g, '').toLowerCase();
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
    return tpl.innerHTML;
  }

  // SSR fallback: strip active-content blocks, event handlers, and js: URLs.
  return html
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|noscript|template|svg|math)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href|formaction|action)\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|javascript:[^\s>]+)/gi, '');
}
