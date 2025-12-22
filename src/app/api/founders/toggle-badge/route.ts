/**
 * Toggle Founder Badge API
 * Allows founders to enable/disable the founder emblem on their card labels
 */

import { NextRequest, NextResponse } from 'next/server';
import { toggleFounderBadge, getUserCredits } from '@/lib/credits';
import { verifyAuth } from '@/lib/serverAuth';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Get request body
    const body = await request.json();
    const { showBadge } = body;

    if (typeof showBadge !== 'boolean') {
      return NextResponse.json(
        { error: 'showBadge must be a boolean' },
        { status: 400 }
      );
    }

    // Check if user is a founder
    const credits = await getUserCredits(userId);
    if (!credits?.is_founder) {
      return NextResponse.json(
        { error: 'Only founders can modify this setting' },
        { status: 403 }
      );
    }

    // Toggle the badge
    const result = await toggleFounderBadge(userId, showBadge);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update setting' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      showFounderBadge: showBadge,
    });
  } catch (error) {
    console.error('Toggle founder badge error:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
