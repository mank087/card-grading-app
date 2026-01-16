/**
 * eBay Policies API
 *
 * Fetches the user's eBay business policies (fulfillment, payment, return).
 * These are required when creating eBay listings.
 *
 * GET /api/ebay/policies
 * Returns: { fulfillment: Policy[], payment: Policy[], return: Policy[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { EBAY_API_URLS, MARKETPLACES } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

interface EbayPolicy {
  policyId: string;
  name: string;
  description?: string;
  marketplaceId?: string;
}

interface PoliciesResponse {
  fulfillment: EbayPolicy[];
  payment: EbayPolicy[];
  return: EbayPolicy[];
  cached?: boolean;
}

/**
 * Make authenticated request to eBay API
 */
async function ebayRequest(
  endpoint: string,
  accessToken: string,
  sandbox: boolean = true
): Promise<Response> {
  const baseUrl = sandbox
    ? EBAY_API_URLS.sandbox.api
    : EBAY_API_URLS.production.api;

  return fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Fetch policies of a specific type from eBay
 */
async function fetchPolicies(
  accessToken: string,
  policyType: 'fulfillment' | 'payment' | 'return',
  sandbox: boolean
): Promise<EbayPolicy[]> {
  const marketplaceId = MARKETPLACES.US;
  const endpoint = `/sell/account/v1/${policyType}_policy?marketplace_id=${marketplaceId}`;

  try {
    const response = await ebayRequest(endpoint, accessToken, sandbox);

    if (!response.ok) {
      console.error(`[eBay Policies] Failed to fetch ${policyType} policies:`, response.status);
      return [];
    }

    const data = await response.json();

    // The response structure varies by policy type
    // fulfillment: fulfillmentPolicies, payment: paymentPolicies, return: returnPolicies
    const policyKey = `${policyType}Policies`;
    const policies = data[policyKey] || [];

    return policies.map((p: any) => ({
      policyId: p[`${policyType}PolicyId`] || p.policyId,
      name: p.name,
      description: p.description,
      marketplaceId: p.marketplaceId,
    }));
  } catch (error) {
    console.error(`[eBay Policies] Error fetching ${policyType} policies:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
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

    // Get eBay connection and refresh token if needed
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
        { error: 'Failed to refresh eBay authorization. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Check URL param for forcing refresh
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Check for cached policies (if not forcing refresh)
    if (!forceRefresh) {
      const { data: cachedPolicies } = await supabase
        .from('ebay_user_policies')
        .select('*')
        .eq('user_id', user.id)
        .gte('cached_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24 hour cache

      if (cachedPolicies && cachedPolicies.length > 0) {
        const response: PoliciesResponse = {
          fulfillment: [],
          payment: [],
          return: [],
          cached: true,
        };

        for (const policy of cachedPolicies) {
          const item: EbayPolicy = {
            policyId: policy.policy_id,
            name: policy.name,
            description: policy.description,
          };

          if (policy.policy_type === 'fulfillment') {
            response.fulfillment.push(item);
          } else if (policy.policy_type === 'payment') {
            response.payment.push(item);
          } else if (policy.policy_type === 'return') {
            response.return.push(item);
          }
        }

        // Only return cached if we have all policy types
        if (response.fulfillment.length && response.payment.length && response.return.length) {
          return NextResponse.json(response);
        }
      }
    }

    // Fetch fresh policies from eBay
    console.log('[eBay Policies] Fetching fresh policies from eBay');

    const [fulfillment, payment, returnPolicies] = await Promise.all([
      fetchPolicies(connection.access_token, 'fulfillment', connection.is_sandbox),
      fetchPolicies(connection.access_token, 'payment', connection.is_sandbox),
      fetchPolicies(connection.access_token, 'return', connection.is_sandbox),
    ]);

    // Cache the policies
    const now = new Date().toISOString();
    const policiesToCache = [
      ...fulfillment.map(p => ({
        user_id: user.id,
        policy_type: 'fulfillment' as const,
        policy_id: p.policyId,
        name: p.name,
        description: p.description || null,
        cached_at: now,
      })),
      ...payment.map(p => ({
        user_id: user.id,
        policy_type: 'payment' as const,
        policy_id: p.policyId,
        name: p.name,
        description: p.description || null,
        cached_at: now,
      })),
      ...returnPolicies.map(p => ({
        user_id: user.id,
        policy_type: 'return' as const,
        policy_id: p.policyId,
        name: p.name,
        description: p.description || null,
        cached_at: now,
      })),
    ];

    if (policiesToCache.length > 0) {
      // Delete old cached policies for this user
      await supabase
        .from('ebay_user_policies')
        .delete()
        .eq('user_id', user.id);

      // Insert new policies
      const { error: cacheError } = await supabase
        .from('ebay_user_policies')
        .insert(policiesToCache);

      if (cacheError) {
        console.error('[eBay Policies] Failed to cache policies:', cacheError);
      }
    }

    const response: PoliciesResponse = {
      fulfillment,
      payment,
      return: returnPolicies,
      cached: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[eBay Policies] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
