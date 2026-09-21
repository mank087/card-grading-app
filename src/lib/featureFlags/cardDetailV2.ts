/**
 * Which card-detail page does this request get — the legacy client or V2?
 *
 * The redesigned card detail page (docs/PLAN_CARD_DETAIL_REDESIGN_2026-09-21.md)
 * ships beside the eight existing CardDetailClient.tsx files rather than
 * replacing them. Those files are not edited for the whole project, so the
 * rollback path is this flag and nothing else: no revert commit, no redeploy,
 * no data change.
 *
 * WHY THIS IS NOT `NEXT_PUBLIC_`
 * Next inlines NEXT_PUBLIC_* at build time. A public flag could only be turned
 * off by rebuilding and redeploying — which is exactly what you cannot afford
 * when the new page is misbehaving in production. `CARD_DETAIL_V2` is a plain
 * server env var read per request in the route's server component, so flipping
 * it in the Vercel dashboard takes effect on the next request.
 *
 * WHY THERE IS NO PER-USER ALLOWLIST
 * The plan originally proposed CARD_DETAIL_V2_USER_IDS. That is not
 * implementable here: sessions live in localStorage via src/lib/directAuth and
 * no server component in this app reads cookies, so the server cannot know who
 * is asking. Rollout is staged by CATEGORY instead, which is what the plan
 * wanted anyway (Pokemon pilot, then one category at a time). Reviewers get
 * the new page by deploying a preview with CARD_DETAIL_V2=on.
 *
 * MODES (value of CARD_DETAIL_V2)
 *   unset / 'off'        every category serves the legacy page. Kill switch.
 *   'on'                 every category serves V2.
 *   'pokemon,sports'     only the listed categories serve V2.
 *
 * The `?v=1` / `?v=2` query override lets a reviewer put both pages side by
 * side on the same card without touching config. It is deliberately powerless
 * when the mode is off: a kill switch that a URL can defeat is not a kill
 * switch.
 */

export type CardDetailVersion = 1 | 2;

/** The eight card categories that have a detail route. */
export const CARD_DETAIL_CATEGORIES = [
  'pokemon',
  'sports',
  'mtg',
  'lorcana',
  'onepiece',
  'yugioh',
  'starwars',
  'other',
] as const;

export type CardDetailCategory = (typeof CARD_DETAIL_CATEGORIES)[number];

export interface CardDetailVersionInput {
  /** Route category, e.g. 'pokemon'. */
  category: string;
  /**
   * Raw `v` search param. Next hands these over as string | string[] |
   * undefined, so all three are accepted and only an exact '1' or '2' counts.
   */
  override?: string | string[] | null;
  /** Injectable for tests. Defaults to process.env. */
  env?: Record<string, string | undefined>;
}

/** Normalise the mode string. Anything unrecognised is treated as off. */
function readMode(env: Record<string, string | undefined>): 'off' | 'on' | string[] {
  const raw = (env.CARD_DETAIL_V2 ?? '').trim().toLowerCase();
  if (!raw || raw === 'off' || raw === 'false' || raw === '0') return 'off';
  if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'all') return 'on';
  const categories = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return categories.length ? categories : 'off';
}

function readOverride(override: CardDetailVersionInput['override']): CardDetailVersion | null {
  const value = Array.isArray(override) ? override[0] : override;
  if (value === '1') return 1;
  if (value === '2') return 2;
  return null;
}

/**
 * Resolve the version for one request. Always returns 1 or 2; 1 is the safe
 * answer and is what every unrecognised configuration produces.
 */
export function resolveCardDetailVersion({
  category,
  override,
  env = process.env as Record<string, string | undefined>,
}: CardDetailVersionInput): CardDetailVersion {
  const mode = readMode(env);

  // Kill switch wins over everything, including the query override.
  if (mode === 'off') return 1;

  const forced = readOverride(override);
  if (forced) return forced;

  if (mode === 'on') return 2;

  return mode.includes(category.trim().toLowerCase()) ? 2 : 1;
}

/** Convenience for the common `version === 2` check in a server component. */
export function isCardDetailV2(input: CardDetailVersionInput): boolean {
  return resolveCardDetailVersion(input) === 2;
}
