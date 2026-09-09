/**
 * Welcome tour completion flag
 * POST { completed: boolean }
 *
 * The mobile app used to write user_credits.welcome_tour_completed directly
 * from the client. user_credits only grants SELECT to users (RLS), so that
 * update matched zero rows and silently succeeded: no account has ever had the
 * flag set, and returning users saw the tour again. This route writes it with
 * the service role after verifying the caller's session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const completed = body?.completed !== false;

    const { error } = await supabaseAdmin
      .from('user_credits')
      .update({ welcome_tour_completed: completed })
      .eq('user_id', authResult.user.id);

    if (error) {
      console.error('[WelcomeTour] flag update failed:', error);
      return NextResponse.json({ error: 'Failed to update welcome tour flag' }, { status: 500 });
    }

    return NextResponse.json({ success: true, completed });
  } catch (error) {
    console.error('[WelcomeTour] Unexpected error:', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
