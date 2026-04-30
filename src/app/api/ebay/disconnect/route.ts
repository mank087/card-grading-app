import { NextRequest, NextResponse } from 'next/server';
import { deleteEbayConnection, getEbayConnection } from '@/lib/ebay';
import { verifyAuth } from '@/lib/serverAuth';

/**
 * POST /api/ebay/disconnect
 *
 * Disconnects the user's eBay account by removing the stored connection.
 * Requires the user to be authenticated.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth via the standard helper (works for Bearer + cookie clients).
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized. Invalid authentication token.' },
        { status: 401 }
      );
    }
    const user = auth.user;

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
