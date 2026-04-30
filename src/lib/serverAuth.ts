// Server-side authentication helper
// Validates user sessions for API routes

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  user?: {
    id: string;
    email?: string;
  } | null;
  error?: string;
}

/**
 * Verify user authentication from request headers
 * Returns the authenticated user's ID or null if not authenticated
 *
 * Usage in API routes:
 * const auth = await verifyAuth(request);
 * if (!auth.authenticated) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * // Use auth.userId for database queries
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Try both casings explicitly. Headers should be case-insensitive but we
    // want to be defensive against any runtime quirk.
    const authHeader =
      request.headers.get('authorization') ||
      request.headers.get('Authorization');

    if (!authHeader) {
      // Diagnostic: dump every header name we did receive so we can confirm
      // whether Authorization is being stripped en route.
      const seenHeaders: string[] = [];
      request.headers.forEach((_v, k) => seenHeaders.push(k));
      console.warn('[ServerAuth] No authorization header. Received:', seenHeaders.join(', '));
      return { authenticated: false, userId: null, user: null, error: 'Missing authorization header' };
    }

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return { authenticated: false, userId: null, user: null, error: 'Authorization header is not a Bearer token' };
    }

    const token = authHeader.slice(authHeader.indexOf(' ') + 1).trim();

    if (!token) {
      return { authenticated: false, userId: null, user: null, error: 'No token provided' };
    }

    // Create a Supabase client and verify the token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Use getUser with the token to verify it
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[ServerAuth] getUser failed:', error?.message, '| Token length:', token.length, '| Token prefix:', token.substring(0, 30));
      return { authenticated: false, userId: null, user: null, error: error?.message || 'Invalid token' };
    }

    return {
      authenticated: true,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email
      }
    };
  } catch (error: any) {
    console.error('[ServerAuth] Exception:', error);
    return { authenticated: false, userId: null, user: null, error: 'Server error during authentication' };
  }
}

/**
 * Verify that the requested user_id matches the authenticated user
 * This prevents users from accessing other users' data
 *
 * @param request - The incoming request
 * @param requestedUserId - The user_id from query params or body
 * @returns AuthResult with authentication status
 */
export async function verifyUserAccess(request: NextRequest, requestedUserId: string): Promise<AuthResult> {
  const auth = await verifyAuth(request);

  if (!auth.authenticated) {
    return auth;
  }

  // Check if the requested user_id matches the authenticated user
  if (auth.userId !== requestedUserId) {
    return {
      authenticated: false,
      userId: null,
      error: 'Access denied: You can only access your own data'
    };
  }

  return auth;
}
