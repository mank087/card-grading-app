/**
 * Shared authorization for Vercel cron routes.
 *
 * The pattern this replaces was:
 *
 *   if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) return 401
 *
 * which fails OPEN. If CRON_SECRET is ever unset in production — a missed env
 * var on a new deploy target, a typo'd name, a variable scoped to the wrong
 * environment — the guard evaluates to false and the endpoint becomes public.
 * These routes spend money: they call OpenAI, hit paid pricing APIs and send
 * email. A public one is an unmetered bill, not just an information leak.
 *
 * Two of the six cron routes already got this right (sync-costs and
 * check-card-databases lead with `!cronSecret ||`). This makes it uniform.
 */
import { NextRequest, NextResponse } from 'next/server';

export type CronAuthResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * Verify a request came from Vercel cron. Returns `{ ok: true }` to proceed, or
 * `{ ok: false, response }` to return immediately.
 *
 * In production a missing secret is a 500 (misconfiguration — loud, and never a
 * silent pass). A mismatch is a 401. Outside production a missing secret is
 * allowed so local runs and `npm run dev` still work.
 */
export function requireCron(request: NextRequest, label: string): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[${label}] CRON_SECRET is not set in production — refusing to run. ` +
        `This endpoint would otherwise be publicly callable and it costs money.`
      );
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Cron authorization is not configured' },
          { status: 500 }
        ),
      };
    }
    console.warn(`[${label}] CRON_SECRET unset — allowed outside production only`);
    return { ok: true };
  }

  if (authHeader !== `Bearer ${secret}`) {
    console.warn(`[${label}] Unauthorized cron request`);
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true };
}
