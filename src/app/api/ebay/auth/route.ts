import { NextRequest, NextResponse } from 'next/server';
import {
  isEbayConfigured,
  getAuthorizationUrl,
  createAuthState,
  EBAY_OAUTH_SCOPES,
} from '@/lib/ebay';
import { verifyAuth } from '@/lib/serverAuth';

/**
 * GET /api/ebay/auth
 *
 * Initiates the eBay OAuth flow by returning the authorization URL.
 * Requires the user to be authenticated.
 *
 * Query Parameters:
 * - return_url: Optional URL to redirect to after successful connection
 * - redirect: If 'true', redirect directly instead of returning JSON
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

    // Verify auth via the standard helper that handles Bearer tokens correctly
    // (the previous in-line createClient + global.headers + getUser() approach
    // didn't work for mobile Bearer-token clients).
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      // Diagnostic: include the list of headers the route actually received so we can
      // pinpoint whether something is stripping Authorization en route to the server.
      const seenHeaders: string[] = [];
      request.headers.forEach((_v, k) => seenHeaders.push(k));
      return NextResponse.json(
        {
          error: auth.error || 'Unauthorized. Please log in first.',
          debug: {
            received_headers: seenHeaders,
            url: request.url,
          },
        },
        { status: 401 }
      );
    }
    const user = auth.user;

    // Get optional return URL from query params
    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get('return_url') || '/account';
    const shouldRedirect = searchParams.get('redirect') === 'true';

    // Create state parameter with user ID and return URL
    const state = createAuthState(user.id, returnUrl);

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(state, [...EBAY_OAUTH_SCOPES]);

    // If redirect=true, redirect directly (for direct browser navigation)
    if (shouldRedirect) {
      return NextResponse.redirect(authUrl);
    }

    // Otherwise return the URL as JSON (for client-side handling)
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[eBay Auth] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate eBay authorization' },
      { status: 500 }
    );
  }
}
