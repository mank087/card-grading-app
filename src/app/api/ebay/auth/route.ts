import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  isEbayConfigured,
  getAuthorizationUrl,
  createAuthState,
  EBAY_OAUTH_SCOPES,
} from '@/lib/ebay';

/**
 * GET /api/ebay/auth
 *
 * Initiates the eBay OAuth flow by redirecting the user to eBay's authorization page.
 * Requires the user to be authenticated.
 *
 * Query Parameters:
 * - return_url: Optional URL to redirect to after successful connection
 */
export async function GET(request: NextRequest) {
  try {
    // Check if eBay is configured
    if (!isEbayConfigured()) {
      return NextResponse.json(
        { error: 'eBay integration is not configured' },
        { status: 503 }
      );
    }

    // Get the authenticated user
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('cookie');

    // Try to get token from Authorization header or cookies
    let accessToken: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7);
    } else if (cookieHeader) {
      // Parse cookies to find Supabase token
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      accessToken = cookies['sb-access-token'] || cookies['supabase-auth-token'];
    }

    // Create Supabase client to verify user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    // Get optional return URL from query params
    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get('return_url') || '/account';

    // Create state parameter with user ID and return URL
    const state = createAuthState(user.id, returnUrl);

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(state, [...EBAY_OAUTH_SCOPES]);

    // Redirect to eBay authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[eBay Auth] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate eBay authorization' },
      { status: 500 }
    );
  }
}
