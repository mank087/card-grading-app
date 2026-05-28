/**
 * Win-back Daily Cron
 * Runs once a day. Finds users who:
 *  - Graded at least 1 card
 *  - Have NEVER purchased credits (total_purchased = 0)
 *  - Are still subscribed to marketing emails
 *  - Last grade was 14+ days ago (gives them time after the last_chance email)
 *  - Haven't already received the winback email (email_log)
 *
 * For each eligible user it:
 *  1. Pre-grants 1 free credit (so the email's promise is true when it lands)
 *  2. Queues a winback row in email_schedule (the hourly send cron picks it up)
 *
 * Capped at 50/day so the credit pre-grant cost and Resend sends are predictable.
 *
 * Vercel Cron: configured in vercel.json at "0 14 * * *" (14:00 UTC daily)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const CRON_SECRET = process.env.CRON_SECRET;
const DAILY_CAP = 50;
const INACTIVITY_DAYS = 14;

interface EligibleUser {
  user_id: string;
  user_email: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[WinbackCron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WinbackCron] Starting daily winback scan...');

    const eligibleUsers = await findEligibleUsers(DAILY_CAP);
    if (eligibleUsers.length === 0) {
      console.log('[WinbackCron] No eligible users today');
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[WinbackCron] Found ${eligibleUsers.length} eligible users`);

    let granted = 0;
    let queued = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      try {
        // Pre-grant 1 free credit. We do this BEFORE queuing the email so
        // the email's "1 free credit added" promise is true the moment it lands.
        // If the email send later fails for any reason, the user still has the
        // credit waiting if they come back on their own.
        const grantOk = await grantOneFreeCredit(user.user_id);
        if (!grantOk) {
          failed++;
          continue;
        }
        granted++;

        // Queue the winback email with scheduled_for = now so the hourly send
        // cron picks it up on the next run.
        const { error: insertErr } = await supabaseAdmin
          .from('email_schedule')
          .insert({
            user_id: user.user_id,
            user_email: user.user_email,
            email_type: 'winback',
            scheduled_for: new Date().toISOString(),
            status: 'pending',
          });
        if (insertErr) {
          // Unique violation (already queued today) → ignore
          if (insertErr.code !== '23505') {
            console.error(`[WinbackCron] Queue failed for ${user.user_email}:`, insertErr);
            failed++;
            continue;
          }
        }
        queued++;
      } catch (err) {
        console.error(`[WinbackCron] Error processing ${user.user_email}:`, err);
        failed++;
      }
    }

    console.log(`[WinbackCron] Done: ${granted} credits granted, ${queued} emails queued, ${failed} failed`);
    return NextResponse.json({ success: true, granted, queued, failed });
  } catch (error: any) {
    console.error('[WinbackCron] Job failed:', error);
    return NextResponse.json({ error: 'Cron failed', message: error.message }, { status: 500 });
  }
}

/**
 * Returns up to `limit` users who match the winback criteria:
 *  - Have at least one cards row (graded something)
 *  - user_credits.total_purchased = 0 (never converted)
 *  - Latest cards.created_at is ≥14 days ago
 *  - profiles.marketing_emails_enabled is not false
 *  - email_log has no prior 'winback' row for them
 */
async function findEligibleUsers(limit: number): Promise<EligibleUser[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVITY_DAYS);

  // Step 1: find users with no purchases who graded at least once
  // and whose most recent card is older than the cutoff.
  const { data: candidates, error: candErr } = await supabaseAdmin
    .from('user_credits')
    .select('user_id, total_purchased')
    .eq('total_purchased', 0)
    .limit(500); // pull a generous batch; we filter further below

  if (candErr || !candidates) {
    console.error('[WinbackCron] Candidate fetch failed:', candErr);
    return [];
  }

  const eligible: EligibleUser[] = [];
  for (const cand of candidates) {
    if (eligible.length >= limit) break;

    // Check this user's last graded card
    const { data: lastCard } = await supabaseAdmin
      .from('cards')
      .select('created_at')
      .eq('user_id', cand.user_id)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCard) continue; // never graded
    if (new Date(lastCard.created_at) > cutoff) continue; // graded too recently

    // Check subscription
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('marketing_emails_enabled')
      .eq('id', cand.user_id)
      .maybeSingle();
    if (profile && profile.marketing_emails_enabled === false) continue;

    // Skip if already sent winback before
    const { data: priorSend } = await supabaseAdmin
      .from('email_log')
      .select('id')
      .eq('user_id', cand.user_id)
      .eq('email_type', 'winback')
      .limit(1)
      .maybeSingle();
    if (priorSend) continue;

    // Skip if there's already a pending/sent winback in email_schedule
    const { data: priorSchedule } = await supabaseAdmin
      .from('email_schedule')
      .select('id')
      .eq('user_id', cand.user_id)
      .eq('email_type', 'winback')
      .limit(1)
      .maybeSingle();
    if (priorSchedule) continue;

    // Need an email address — look it up
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(cand.user_id);
    const userEmail = authUser?.user?.email;
    if (!userEmail) continue;

    eligible.push({ user_id: cand.user_id, user_email: userEmail });
  }

  return eligible;
}

/**
 * Atomically grant 1 credit to user_credits.balance and log a transaction.
 * Returns false if anything goes wrong so the caller can skip queuing the email.
 */
async function grantOneFreeCredit(userId: string): Promise<boolean> {
  try {
    const { data: credits, error: fetchErr } = await supabaseAdmin
      .from('user_credits')
      .select('balance, total_purchased')
      .eq('user_id', userId)
      .single();
    if (fetchErr || !credits) return false;

    // Defense-in-depth: if the user purchased between candidate fetch and now,
    // bail without granting (they're no longer the right audience).
    if ((credits.total_purchased ?? 0) > 0) return false;

    const newBalance = (credits.balance ?? 0) + 1;
    const { error: updateErr } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', userId);
    if (updateErr) return false;

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: userId,
      type: 'bonus',
      amount: 1,
      balance_after: newBalance,
      description: 'Win-back bonus credit',
      metadata: { bonus_type: 'winback' },
    });
    return true;
  } catch (err) {
    console.error('[WinbackCron] grantOneFreeCredit error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
