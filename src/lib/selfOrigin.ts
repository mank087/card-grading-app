import type { NextRequest } from 'next/server';

/**
 * Origin to use when a route fetches another route on this same app.
 *
 * Never `request.nextUrl.origin` from a cron. Vercel invokes crons on the
 * generated deployment URL (`*-dougs-projects-*.vercel.app`), and that host is
 * behind Deployment Protection: the request is redirected to vercel.com/sso-api,
 * then to the login page, which answers HTTP 200 with HTML. `fetch` follows the
 * redirects, so `res.ok` is true and the route we meant to call is never run.
 * Found 2026-09-02: it left a customer's submission batch charged with two cards
 * ungraded, and had silently killed api/cron/sync-costs since 2026-05-19
 * (no `openai_daily_costs` row written in that whole window).
 *
 * Crons only ever run on production, so the public site URL is always the right
 * target there. Localhost is the one case where the request origin must win, so
 * local dev can call itself.
 */
export function resolveSelfOrigin(request: NextRequest): string {
  const fromRequest = request.nextUrl?.origin;
  if (fromRequest && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(fromRequest)) {
    return fromRequest;
  }
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://dcmgrading.com';
  return base.replace(/\/+$/, '');
}
