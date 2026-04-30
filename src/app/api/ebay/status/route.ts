import { NextRequest, NextResponse } from 'next/server';
import {
  getEbayConnection,
  hasActiveEbayConnection,
  isEbayConfigured,
  getEbayEnvironment,
} from '@/lib/ebay';
import { verifyAuth } from '@/lib/serverAuth';

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
    const connection = await getEbayConnection(user.id);

    if (!connection) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        environment: getEbayEnvironment(),
      });
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
