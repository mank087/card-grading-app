import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthState,
  exchangeCodeForTokens,
  saveEbayConnection,
  getEbayEnvironment,
} from '@/lib/ebay';

/**
 * GET /api/ebay/callback
 *
 * Handles the OAuth callback from eBay after user authorization.
 * Exchanges the authorization code for tokens and stores the connection.
 *
 * Query Parameters (from eBay):
 * - code: Authorization code to exchange for tokens
 * - state: Our state parameter for CSRF protection and user identification
 * - error: Present if user denied access
 * - error_description: Description of the error
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dcmgrading.com';

  // Handle error from eBay (user denied access)
  if (error) {
    console.log('[eBay Callback] User denied access:', error, errorDescription);
    const errorUrl = new URL('/account', baseUrl);
    errorUrl.searchParams.set('ebay_error', 'access_denied');
    errorUrl.searchParams.set('message', errorDescription || 'You denied access to eBay');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('[eBay Callback] Missing code or state parameter');
    const errorUrl = new URL('/account', baseUrl);
    errorUrl.searchParams.set('ebay_error', 'invalid_request');
    errorUrl.searchParams.set('message', 'Invalid callback parameters');
    return NextResponse.redirect(errorUrl.toString());
  }

  // Verify state parameter (CSRF protection)
  const authState = verifyAuthState(state);
  if (!authState) {
    console.error('[eBay Callback] Invalid or expired state');
    const errorUrl = new URL('/account', baseUrl);
    errorUrl.searchParams.set('ebay_error', 'invalid_state');
    errorUrl.searchParams.set('message', 'Session expired. Please try again.');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    // Exchange authorization code for tokens
    console.log('[eBay Callback] Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code);

    // Save the connection to database
    console.log('[eBay Callback] Saving eBay connection for user:', authState.user_id);
    const connection = await saveEbayConnection(
      authState.user_id,
      tokens,
      getEbayEnvironment() === 'sandbox'
    );

    console.log('[eBay Callback] Successfully connected eBay account:', connection.ebay_username);

    // Redirect to success page
    const returnUrl = authState.return_url || '/account';
    const successUrl = new URL(returnUrl, baseUrl);
    successUrl.searchParams.set('ebay_connected', 'true');
    successUrl.searchParams.set('ebay_username', connection.ebay_username || 'eBay User');

    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error('[eBay Callback] Error:', error);

    const errorUrl = new URL('/account', baseUrl);
    errorUrl.searchParams.set('ebay_error', 'connection_failed');
    errorUrl.searchParams.set(
      'message',
      error instanceof Error ? error.message : 'Failed to connect eBay account'
    );

    return NextResponse.redirect(errorUrl.toString());
  }
}
