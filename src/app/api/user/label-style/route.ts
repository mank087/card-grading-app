/**
 * Label Style Preference API
 * GET: Retrieve user's current label style preference
 * POST: Update user's label style preference
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
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

    // Get user's label style preference
    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .select('label_style')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching label style:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preference' },
        { status: 500 }
      );
    }

    // Default to 'modern' if no record or null
    const labelStyle = data?.label_style || 'modern';

    return NextResponse.json({
      success: true,
      labelStyle,
    });
  } catch (error) {
    console.error('Get label style error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preference' },
      { status: 500 }
    );
  }
}

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
    const { labelStyle } = body;

    // Validate label style
    if (!['modern', 'traditional'].includes(labelStyle)) {
      return NextResponse.json(
        { error: 'labelStyle must be "modern" or "traditional"' },
        { status: 400 }
      );
    }

    // Update the preference
    const { error } = await supabaseAdmin
      .from('user_credits')
      .update({ label_style: labelStyle })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating label style:', error);
      return NextResponse.json(
        { error: 'Failed to update preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      labelStyle,
    });
  } catch (error) {
    console.error('Update label style error:', error);
    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    );
  }
}
