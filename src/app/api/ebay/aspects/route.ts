/**
 * eBay Item Aspects/Specifics API
 *
 * Fetches the required and recommended item specifics for a category
 * from the eBay Taxonomy API.
 *
 * GET /api/ebay/aspects?category_id=183454
 *
 * Thin wrapper: auth → connection → fetchCategoryAspects(). The Taxonomy
 * call, the recommended-aspect filter and the offline defaults live in
 * src/lib/ebay/aspectsApi.ts so bulk batch creation can fetch the same
 * aspects server-side without an HTTP round trip per category.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { fetchCategoryAspects } from '@/lib/ebay/aspectsApi';

export type { EbayAspect, AspectsResponse } from '@/lib/ebay/aspectsApi';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Get category_id from query params
    const categoryId = request.nextUrl.searchParams.get('category_id');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = getAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Get eBay connection
    let connection = await getConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json(
        { error: 'No eBay account connected' },
        { status: 400 }
      );
    }

    // Refresh token if needed
    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization' },
        { status: 401 }
      );
    }

    const result = await fetchCategoryAspects(
      { access_token: connection.access_token, is_sandbox: connection.is_sandbox },
      categoryId
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({
      aspects: result.aspects,
      categoryId,
      ...(result.fromDefaults ? { fromDefaults: true } : {}),
    });
  } catch (error) {
    console.error('[eBay Aspects] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
