import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/blog/view  body: { slug }
 *
 * Counts one blog post view. Fired by <BlogViewBeacon> once per browser
 * session per post (sendBeacon, so the body may arrive as text/plain).
 * Calls increment_blog_view(), an atomic +1 that only touches published,
 * already-live posts (migrations/20261008b_blog_views_and_iap_fee.sql).
 *
 * Always answers 204 and never throws: a lost view is not worth an error.
 */

export const dynamic = 'force-dynamic';

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview|lighthouse|headless/i;
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,199}$/i;

// Log a missing RPC (migration not applied yet) once per server instance.
let missingRpcLogged = false;

function noContent() {
  return new Response(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BOT_UA.test(ua)) return noContent();

    const raw = await request.text().catch(() => '');
    let slug: unknown = null;
    try {
      slug = (JSON.parse(raw) as { slug?: unknown })?.slug;
    } catch {
      return noContent();
    }
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return noContent();

    const { error } = await supabaseAdmin.rpc('increment_blog_view', { p_slug: slug });
    if (error) {
      const missing = error.code === 'PGRST202' || /could not find the function/i.test(error.message);
      if (!missing) {
        console.error('[blog view] increment failed:', error.message);
      } else if (!missingRpcLogged) {
        missingRpcLogged = true;
        console.warn('[blog view] increment_blog_view RPC missing; apply migrations/20261008b_blog_views_and_iap_fee.sql');
      }
    }
  } catch (error) {
    console.error('[blog view] unexpected error:', error);
  }
  return noContent();
}
