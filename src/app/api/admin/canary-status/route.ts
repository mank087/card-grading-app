import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveGradingModel, BASELINE_MODEL, CANARY_MODEL } from '@/lib/grading/modelRouter';

/**
 * GET /api/admin/canary-status
 *
 * Answers "is the grading canary actually live?" without waiting for a
 * customer to grade a card.
 *
 * This exists because Vercel bakes environment variables in at build time: a
 * variable set AFTER a deployment does not apply to it, so the canary can look
 * configured in the dashboard while every request quietly runs on baseline.
 * The only other way to tell was to wait for a real grade and check whether
 * cards.grading_model came back null, which is a slow and easily-misread
 * signal — one card graded mid-build reads identically to a canary that never
 * turned on.
 *
 * Reports what THIS running deployment sees, plus recent attribution so a
 * mismatch between "configured" and "actually happening" is obvious.
 *
 * Admin-gated: exposes deployment configuration, not customer data.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = await verifyAdminSession(token);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Probe the router the same way a grade would, using fixed sample keys so
  // the answer is stable between calls.
  const probes = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
    .map((k) => {
      const d = resolveGradingModel(k);
      return { key: k.slice(-1), bucket: d.bucket, model: d.model, isCanary: d.isCanary };
    });
  const decision = resolveGradingModel('probe');

  const rawPercent = process.env.GRADING_CANARY_PERCENT;
  const killed = process.env.GRADING_CANARY_KILL === '1';

  // Recent attribution: what is actually landing in the DB.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let recent: Record<string, number> = {};
  let unattributed = 0;
  try {
    const { data } = await supabaseAdmin
      .from('cards')
      .select('grading_model')
      .gte('created_at', since)
      .not('conversational_whole_grade', 'is', null)
      .limit(1000);
    for (const r of data ?? []) {
      if (!r.grading_model) unattributed++;
      else recent[r.grading_model] = (recent[r.grading_model] ?? 0) + 1;
    }
  } catch {
    /* column may not exist yet */
  }

  const attributed = Object.values(recent).reduce((a, b) => a + b, 0);
  const configured = !killed && Number(rawPercent) > 0;

  return NextResponse.json({
    live: configured,
    // The headline. If GRADING_CANARY_PERCENT is set in the Vercel dashboard
    // but reads null here, this deployment predates the variable — redeploy.
    env_visible_to_this_deployment: {
      GRADING_CANARY_PERCENT: rawPercent ?? null,
      GRADING_CANARY_KILL: process.env.GRADING_CANARY_KILL ?? null,
      GRADING_CANARY_MODEL: process.env.GRADING_CANARY_MODEL ?? null,
      GRADING_CANARY_REASONING_EFFORT: process.env.GRADING_CANARY_REASONING_EFFORT ?? null,
    },
    resolved: {
      baselineModel: BASELINE_MODEL,
      canaryModel: CANARY_MODEL,
      effectivePercent: decision.percent,
      killSwitchEngaged: killed,
    },
    routerProbes: probes,
    last24h: {
      attributed,
      unattributed,
      byModel: recent,
      note: unattributed > 0 && attributed === 0
        ? 'Grades are landing with no model recorded. Either this deployment predates the env var (redeploy), or the migration has not been applied.'
        : attributed === 0
          ? 'No grades in the last 24h to attribute.'
          : 'Attribution is working.',
    },
    diagnosis: !configured
      ? (rawPercent == null
        ? 'GRADING_CANARY_PERCENT is not visible to this deployment. If it is set in Vercel, REDEPLOY — env vars only apply to deployments built after they are set.'
        : killed
          ? 'Kill switch engaged: everything is on baseline.'
          : 'Canary percent resolves to 0: everything is on baseline.')
      : `Canary is live at ${decision.percent}% on ${CANARY_MODEL}.`,
  });
}
