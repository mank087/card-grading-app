/**
 * eBay Business Policies Opt-In API
 *
 * Opts the seller into the SELLING_POLICY_MANAGEMENT program,
 * which is required before creating business policies.
 *
 * POST /api/ebay/opt-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { EBAY_API_URLS } from '@/lib/ebay/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    connection = await refreshTokenIfNeeded(connection);
    if (!connection) {
      return NextResponse.json(
        { error: 'Failed to refresh eBay authorization' },
        { status: 401 }
      );
    }

    const baseUrl = connection.is_sandbox
      ? EBAY_API_URLS.sandbox.api
      : EBAY_API_URLS.production.api;

    // First, check if already opted in
    console.log('[eBay Opt-In] Checking current program status...');
    const checkResponse = await fetch(`${baseUrl}/sell/account/v1/program/get_opted_in_programs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (checkResponse.ok) {
      const programs = await checkResponse.json();
      console.log('[eBay Opt-In] Current programs:', programs);

      const isOptedIn = programs.programs?.some(
        (p: any) => p.programType === 'SELLING_POLICY_MANAGEMENT'
      );

      if (isOptedIn) {
        return NextResponse.json({
          success: true,
          message: 'Already opted into Business Policies',
          alreadyOptedIn: true,
        });
      }
    }

    // Opt into SELLING_POLICY_MANAGEMENT program
    console.log('[eBay Opt-In] Opting into SELLING_POLICY_MANAGEMENT...');
    const optInResponse = await fetch(`${baseUrl}/sell/account/v1/program/opt_in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        programType: 'SELLING_POLICY_MANAGEMENT',
      }),
    });

    if (optInResponse.ok || optInResponse.status === 204) {
      console.log('[eBay Opt-In] Successfully opted in');
      return NextResponse.json({
        success: true,
        message: 'Successfully opted into Business Policies. It may take up to 24 hours for eBay to fully process this.',
      });
    }

    // Handle error
    const errorText = await optInResponse.text();
    console.error('[eBay Opt-In] Failed:', optInResponse.status, errorText);

    let errorMessage = 'Failed to opt into Business Policies';
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.errors?.[0]?.longMessage) {
        errorMessage = errorJson.errors[0].longMessage;
      } else if (errorJson.errors?.[0]?.message) {
        errorMessage = errorJson.errors[0].message;
      }
    } catch {
      // Use default message
    }

    return NextResponse.json(
      { error: errorMessage, details: errorText },
      { status: optInResponse.status }
    );
  } catch (error) {
    console.error('[eBay Opt-In] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
