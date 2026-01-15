import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteEbayConnection, getEbayConnection } from '@/lib/ebay';

/**
 * POST /api/ebay/disconnect
 *
 * Disconnects the user's eBay account by removing the stored connection.
 * Requires the user to be authenticated.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Missing authentication token.' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: 'Unauthorized. Invalid authentication token.' },
        { status: 401 }
      );
    }

    // Check if user has an eBay connection
    const connection = await getEbayConnection(user.id);

    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay connection found' },
        { status: 404 }
      );
    }

    // Delete the connection
    await deleteEbayConnection(user.id);

    console.log('[eBay Disconnect] Successfully disconnected user:', user.id);

    return NextResponse.json({
      success: true,
      message: 'eBay account disconnected successfully',
    });
  } catch (error) {
    console.error('[eBay Disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect eBay account' },
      { status: 500 }
    );
  }
}
