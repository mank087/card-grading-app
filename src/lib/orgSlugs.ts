/**
 * Canonical org-slug rules shared by every surface that creates or routes
 * org slugs: the self-serve apply API, the admin create API, and the Edge
 * subdomain-routing middleware.
 *
 * EDGE-SAFE: this module must stay dependency-free (pure constants and
 * RegExps only) — src/middleware.ts imports it on the Edge runtime.
 */

/**
 * One canonical slug shape: 1 or 3–32 lowercase letters/numbers/hyphens,
 * no leading/trailing hyphen. (Matches what the middleware and admin route
 * already accepted, so every existing slug keeps routing.)
 */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

/**
 * Slugs that must never resolve to (or be claimed by) a storefront:
 * app routes, DCM itself, infrastructure subdomains, major grader brands,
 * and the static children of /enterprise/* (org pages live at
 * /enterprise/{slug}, so a slug equal to a static child would shadow it).
 *
 * Union of the previously diverged lists in org/apply and middleware —
 * applies to BOTH subdomain routing and slug creation, admin included.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // DCM + app routes
  'dcm', 'dcmgrading', 'admin', 'api', 'app', 'www', 'store', 'storefront',
  'verify', 'pop', 'enterprise', 'account', 'collection', 'credits', 'labels',
  'support', 'help', 'mail', 'blog', 'shop', 'grading', 'official',
  // infrastructure subdomains
  'staging', 'dev', 'cdn', 'assets',
  // major grader brands
  'psa', 'bgs', 'cgc', 'sgc', 'beckett', 'tag', 'ace', 'hga',
  // /enterprise/* static children
  'apply', 'terms', 'launch-kit', 'welcome', 'billing', 'settings', 'card',
])

/**
 * Grader-brand tokens an org NAME may not contain (word-boundary,
 * case-insensitive) — blocks "PSA Grading"-style impersonation renames.
 */
export const GRADER_BRAND_TOKENS = [
  'psa', 'bgs', 'beckett', 'cgc', 'sgc', 'tag', 'dcm', 'ace', 'ark',
  'gma', 'hga', 'isa', 'ksa', 'mnt', 'rcg',
] as const

const GRADER_BRAND_RE = new RegExp(`\\b(?:${GRADER_BRAND_TOKENS.join('|')})\\b`, 'i')

/** The grader-brand token found in a proposed org name, or null if clean. */
export function findGraderBrandToken(name: string): string | null {
  const m = name.match(GRADER_BRAND_RE)
  return m ? m[0] : null
}

/**
 * Minimal HTML escaper for user-supplied values interpolated into email
 * HTML (Resend admin/owner notifications). Lives here so both org routes
 * share one implementation without a new module.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape %, _ and \ so a user-supplied string is matched literally by
 * Postgres ILIKE (Supabase .ilike) instead of as wildcards.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, m => '\\' + m)
}
