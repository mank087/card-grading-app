import { NextRequest, NextResponse } from 'next/server';
import {
  getEbayConnection,
  hasActiveEbayConnection,
  isEbayConfigured,
  getEbayEnvironment,
  getValidAccessToken,
  getEbayUserInfo,
} from '@/lib/ebay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth } from '@/lib/serverAuth';

const PLACEHOLDER_USERNAME = 'eBay User';

/**
 * GET /api/ebay/status
 *
 * Returns the eBay connection status for the authenticated user.
 * Includes connection details if connected.
 */
export async function GET(request: NextRequest) {
  try {
    // Check if eBay integration is configured
    const ebayConfigured = isEbayConfigured();

    // Verify auth via the standard helper (works for both web cookie auth and
    // mobile Bearer-token auth — the previous in-line approach broke mobile).
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        error: auth.error || 'Not authenticated',
      });
    }
    const user = auth.user;

    // Check for active eBay connection
    const isConnected = await hasActiveEbayConnection(user.id);

    if (!isConnected) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        environment: getEbayEnvironment(),
      });
    }

    // Get connection details
    let connection = await getEbayConnection(user.id);

    if (!connection) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        environment: getEbayEnvironment(),
      });
    }

    // If the stored username is the "eBay User" placeholder (i.e. the original
    // OAuth flow couldn't read it from the Identity API at connect time),
    // try once now to refresh it. Older connections made before the
    // commerce.identity.readonly scope was granted commonly hit this path.
    // We swallow failures and fall through to whatever we had cached.
    if (connection.ebay_username === PLACEHOLDER_USERNAME || !connection.ebay_username) {
      try {
        const accessToken = await getValidAccessToken(user.id);
        const fresh = await getEbayUserInfo(accessToken);
        if (fresh.username && fresh.username !== PLACEHOLDER_USERNAME) {
          await supabaseAdmin
            .from('ebay_connections')
            .update({
              ebay_username: fresh.username,
              ebay_user_id: fresh.userId || connection.ebay_user_id,
            })
            .eq('user_id', user.id);
          connection = { ...connection, ebay_username: fresh.username, ebay_user_id: fresh.userId || connection.ebay_user_id };
          console.log('[eBay Status] Refreshed placeholder username for', user.id, '→', fresh.username);
        }
      } catch (refreshErr) {
        // Non-fatal — keep the placeholder. The UI degrades gracefully.
        console.warn('[eBay Status] Username refresh failed:', refreshErr);
      }
    }

    // Return connection status (without sensitive token data)
    return NextResponse.json({
      configured: ebayConfigured,
      connected: true,
      environment: getEbayEnvironment(),
      connection: {
        ebay_username: connection.ebay_username,
        ebay_user_id: connection.ebay_user_id,
        marketplace_id: connection.marketplace_id,
        is_sandbox: connection.is_sandbox,
        connected_at: connection.connected_at,
        last_used_at: connection.last_used_at,
        token_expires_at: connection.token_expires_at,
        scopes: connection.scopes,
      },
    });
  } catch (error) {
    console.error('[eBay Status] Error:', error);
    return NextResponse.json(
      {
        configured: isEbayConfigured(),
        connected: false,
        error: 'Failed to check eBay status',
      },
      { status: 500 }
    );
  }
}
