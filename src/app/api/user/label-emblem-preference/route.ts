/**
 * API to get/set user's preferred label emblems
 * Users can select 0, 1, or 2 emblems to display on their card labels
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

export type EmblemType = 'founder' | 'vip' | 'card_lover';

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
      .select('preferred_label_emblem, is_founder, is_vip, is_card_lover, show_founder_badge, show_vip_badge, show_card_lover_badge')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching label emblem preference:', error);
      return NextResponse.json({ error: 'Failed to fetch preference' }, { status: 500 });
    }

    // Parse the stored preference (comma-separated string) into an array
    const storedPref = credits?.preferred_label_emblem || '';
    let selectedEmblems: EmblemType[] = [];

    if (storedPref && storedPref !== 'none' && storedPref !== 'auto') {
      // Handle new format (comma-separated) and legacy single values
      selectedEmblems = storedPref.split(',').filter((e: string) =>
        ['founder', 'vip', 'card_lover'].includes(e)
      ) as EmblemType[];
    } else if (storedPref === 'auto') {
      // Legacy 'auto' - convert to showing all available emblems (max 2)
      const available: EmblemType[] = [];
      if (credits?.is_founder) available.push('founder');
      if (credits?.is_vip) available.push('vip');
      if (credits?.is_card_lover) available.push('card_lover');
      selectedEmblems = available.slice(0, 2);
    }

    return NextResponse.json({
      selectedEmblems,
      // Legacy field for backward compatibility
      preferredLabelEmblem: storedPref || 'none',
      isFounder: credits?.is_founder || false,
      isVip: credits?.is_vip || false,
      isCardLover: credits?.is_card_lover || false,
      showFounderBadge: credits?.show_founder_badge ?? true,
      showVipBadge: credits?.show_vip_badge ?? true,
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
    const { selectedEmblems } = body as { selectedEmblems: EmblemType[] };

    // Validate selectedEmblems
    if (!Array.isArray(selectedEmblems)) {
      return NextResponse.json(
        { error: 'selectedEmblems must be an array' },
        { status: 400 }
      );
    }

    // Validate max 2 selections
    if (selectedEmblems.length > 2) {
      return NextResponse.json(
        { error: 'Maximum 2 emblems can be selected' },
        { status: 400 }
      );
    }

    // Validate each emblem type
    const validTypes: EmblemType[] = ['founder', 'vip', 'card_lover'];
    for (const emblem of selectedEmblems) {
      if (!validTypes.includes(emblem)) {
        return NextResponse.json(
          { error: `Invalid emblem type: ${emblem}. Must be one of: founder, vip, card_lover` },
          { status: 400 }
        );
      }
    }

    // Remove duplicates
    const uniqueEmblems = [...new Set(selectedEmblems)];

    // Store as comma-separated string, or 'none' if empty
    const preferenceValue = uniqueEmblems.length > 0 ? uniqueEmblems.join(',') : 'none';

    // Set individual badge flags based on selection
    const showFounderBadge = uniqueEmblems.includes('founder');
    const showVipBadge = uniqueEmblems.includes('vip');
    const showCardLoverBadge = uniqueEmblems.includes('card_lover');

    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient
      .from('user_credits')
      .update({
        preferred_label_emblem: preferenceValue,
        show_founder_badge: showFounderBadge,
        show_vip_badge: showVipBadge,
        show_card_lover_badge: showCardLoverBadge,
      })
      .eq('user_id', user.id)
      .select('preferred_label_emblem, show_founder_badge, show_vip_badge, show_card_lover_badge')
      .single();

    if (error) {
      console.error('Error updating label emblem preference:', error);
      return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      selectedEmblems: uniqueEmblems,
      preferredLabelEmblem: data.preferred_label_emblem,
    });
  } catch (error) {
    console.error('Error in label emblem preference POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
