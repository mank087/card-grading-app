/**
 * API to get/set user's preferred label emblem
 * Options: 'founder', 'card_lover', 'both', 'none'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for auth
function getSupabaseClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Service client for database updates
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type LabelEmblemPreference = 'founder' | 'card_lover' | 'both' | 'none';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.substring(7);
    const supabase = getSupabaseClient(accessToken);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's preference from user_credits
    const serviceClient = getServiceClient();
    const { data: credits, error } = await serviceClient
      .from('user_credits')
      .select('preferred_label_emblem, is_founder, is_card_lover, show_founder_badge, show_card_lover_badge')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching label emblem preference:', error);
      return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 });
    }

    return NextResponse.json({
      preferredLabelEmblem: credits?.preferred_label_emblem || 'both',
      isFounder: credits?.is_founder || false,
      isCardLover: credits?.is_card_lover || false,
      showFounderBadge: credits?.show_founder_badge ?? true,
      showCardLoverBadge: credits?.show_card_lover_badge ?? true,
    });
  } catch (error) {
    console.error('Error in label emblem preference GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = authHeader.substring(7);
    const supabase = getSupabaseClient(accessToken);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { preferredLabelEmblem } = body as { preferredLabelEmblem: LabelEmblemPreference };

    // Validate preference
    const validPreferences: LabelEmblemPreference[] = ['founder', 'card_lover', 'both', 'none'];
    if (!preferredLabelEmblem || !validPreferences.includes(preferredLabelEmblem)) {
      return NextResponse.json(
        { error: 'Invalid preference. Must be one of: founder, card_lover, both, none' },
        { status: 400 }
      );
    }

    // Update user's preference
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from('user_credits')
      .update({ preferred_label_emblem: preferredLabelEmblem })
      .eq('user_id', user.id)
      .select('preferred_label_emblem')
      .single();

    if (error) {
      console.error('Error updating label emblem preference:', error);
      return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferredLabelEmblem: data.preferred_label_emblem,
    });
  } catch (error) {
    console.error('Error in label emblem preference POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
