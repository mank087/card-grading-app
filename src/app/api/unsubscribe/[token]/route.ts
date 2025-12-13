/**
 * Unsubscribe API Endpoint
 * Handles email unsubscribe requests (both one-click POST and manual GET)
 *
 * GET: Display unsubscribe confirmation page
 * POST: Process one-click unsubscribe (RFC 8058 compliant)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/unsubscribe/[token]
 * Redirects to unsubscribe confirmation page
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return NextResponse.redirect(new URL('/unsubscribe?error=invalid', request.url));
  }

  // Redirect to the unsubscribe page with token
  return NextResponse.redirect(new URL(`/unsubscribe?token=${token}`, request.url));
}

/**
 * POST /api/unsubscribe/[token]
 * One-click unsubscribe handler (RFC 8058)
 * Email clients send POST request directly to unsubscribe
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  try {
    if (!token || token.length < 32) {
      // RFC 8058 requires 200/202 response even for invalid tokens
      return new NextResponse(null, { status: 200 });
    }

    // Find user by unsubscribe token
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, marketing_emails_enabled')
      .eq('unsubscribe_token', token)
      .single();

    if (findError || !profile) {
      console.log('[Unsubscribe] Token not found:', token.substring(0, 8) + '...');
      // Still return 200 per RFC 8058
      return new NextResponse(null, { status: 200 });
    }

    // Already unsubscribed
    if (!profile.marketing_emails_enabled) {
      console.log('[Unsubscribe] User already unsubscribed:', profile.email);
      return new NextResponse(null, { status: 200 });
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
      console.error('[Unsubscribe] Update error:', updateError);
      // Still return 200 per RFC 8058
      return new NextResponse(null, { status: 200 });
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

    console.log('[Unsubscribe] Successfully unsubscribed:', profile.email);

    // RFC 8058: Return 200 OK with empty body
    return new NextResponse(null, { status: 200 });

  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    // Always return 200 for one-click unsubscribe per RFC 8058
    return new NextResponse(null, { status: 200 });
  }
}
