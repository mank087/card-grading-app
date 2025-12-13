/**
 * Unsubscribe Action API
 * Handles manual unsubscribe form submission from the confirmation page
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/unsubscribe/action
 * Process manual unsubscribe from confirmation page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || token.length < 32) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 400 }
      );
    }

    // Find user by unsubscribe token
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, marketing_emails_enabled')
      .eq('unsubscribe_token', token)
      .single();

    if (findError || !profile) {
      return NextResponse.json(
        { error: 'Invalid or expired unsubscribe link' },
        { status: 404 }
      );
    }

    // Already unsubscribed
    if (!profile.marketing_emails_enabled) {
      return NextResponse.json({
        success: true,
        message: 'You are already unsubscribed from marketing emails.',
        alreadyUnsubscribed: true
      });
    }

    // Update user preferences
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        marketing_emails_enabled: false,
        marketing_unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[Unsubscribe Action] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update preferences. Please try again.' },
        { status: 500 }
      );
    }

    // Cancel any pending marketing emails for this user
    await supabaseAdmin
      .from('email_schedule')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', profile.id)
      .eq('status', 'pending');

    console.log('[Unsubscribe Action] Successfully unsubscribed:', profile.email);

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from marketing emails.'
    });

  } catch (error) {
    console.error('[Unsubscribe Action] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
