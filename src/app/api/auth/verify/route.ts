import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables - NO HARDCODED FALLBACKS
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side auth verification endpoint
 * Verifies that an access token is valid and returns user info
 *
 * Usage:
 * GET /api/auth/verify
 * Headers: Authorization: Bearer <access_token>
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { authenticated: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    // Create a Supabase client and verify the token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Use getUser with the token to verify it
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('[Auth Verify] Token verification failed:', error?.message);
      return NextResponse.json(
        { authenticated: false, error: error?.message || 'Invalid token' },
        { status: 401 }
      );
    }

    // Token is valid, return user info
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        provider: user.app_metadata?.provider || 'email'
      }
    });

  } catch (error: any) {
    console.error('[Auth Verify] Exception:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Server error during verification' },
      { status: 500 }
    );
  }
}
