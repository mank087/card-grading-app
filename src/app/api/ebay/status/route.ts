import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getEbayConnection,
  hasActiveEbayConnection,
  isEbayConfigured,
  getEbayEnvironment,
} from '@/lib/ebay';

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

    // Get the authenticated user from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        error: 'Not authenticated',
      });
    }

    const accessToken = authHeader.slice(7);

    // Verify the user with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        configured: ebayConfigured,
        connected: false,
        error: 'Invalid authentication',
      });
    }

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
