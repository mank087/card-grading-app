/**
 * eBay Disclaimer Acceptance API
 *
 * GET /api/ebay/disclaimer - Check if user has accepted the disclaimer
 * POST /api/ebay/disclaimer - Record user's acceptance of the disclaimer
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Current disclaimer version - increment this when terms change significantly
// to require users to re-accept
export const CURRENT_DISCLAIMER_VERSION = '1.0';

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Check if user has accepted the current disclaimer version
 */
export async function GET(request: NextRequest) {
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

    // Check if user has an eBay connection with accepted disclaimer
    const { data: connection, error: connError } = await supabase
      .from('ebay_connections')
      .select('disclaimer_accepted_at, disclaimer_version')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return NextResponse.json({
        accepted: false,
        reason: 'no_connection',
      });
    }

    // Check if they've accepted the current version
    const hasAccepted = connection.disclaimer_accepted_at &&
      connection.disclaimer_version === CURRENT_DISCLAIMER_VERSION;

    return NextResponse.json({
      accepted: hasAccepted,
      acceptedAt: connection.disclaimer_accepted_at,
      acceptedVersion: connection.disclaimer_version,
      currentVersion: CURRENT_DISCLAIMER_VERSION,
      needsReaccept: connection.disclaimer_accepted_at &&
        connection.disclaimer_version !== CURRENT_DISCLAIMER_VERSION,
    });
  } catch (error) {
    console.error('[eBay Disclaimer] GET error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Record user's acceptance of the disclaimer
 */
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

    // Verify user has an eBay connection
    const { data: connection, error: connError } = await supabase
      .from('ebay_connections')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No eBay account connected. Please connect your eBay account first.' },
        { status: 400 }
      );
    }

    // Update the connection with disclaimer acceptance
    const { error: updateError } = await supabase
      .from('ebay_connections')
      .update({
        disclaimer_accepted_at: new Date().toISOString(),
        disclaimer_version: CURRENT_DISCLAIMER_VERSION,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[eBay Disclaimer] Failed to update acceptance:', updateError);
      return NextResponse.json(
        { error: 'Failed to record acceptance' },
        { status: 500 }
      );
    }

    console.log('[eBay Disclaimer] User accepted disclaimer:', user.id, 'Version:', CURRENT_DISCLAIMER_VERSION);

    return NextResponse.json({
      success: true,
      acceptedAt: new Date().toISOString(),
      version: CURRENT_DISCLAIMER_VERSION,
    });
  } catch (error) {
    console.error('[eBay Disclaimer] POST error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
