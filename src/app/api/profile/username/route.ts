import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'dcm', 'support', 'help', 'api', 'www', 'app', 'mail',
  'featured', 'collection', 'account', 'login', 'signup', 'settings',
  'upload', 'search', 'blog', 'about', 'privacy', 'terms',
]);

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('username, display_name')
      .eq('id', authResult.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Profile Username] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({
      username: data?.username || null,
      displayName: data?.display_name || null,
    });
  } catch (error) {
    console.error('[Profile Username] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const rawInput = (body.username || '').trim();
    // Display name preserves user's original formatting
    const displayName = rawInput.slice(0, 50);
    // URL slug: lowercase, replace spaces/underscores with hyphens, strip invalid chars
    const username = rawInput
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Validate username format
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only.' },
        { status: 400 }
      );
    }

    // Check reserved words
    if (RESERVED_USERNAMES.has(username)) {
      return NextResponse.json(
        { error: 'This username is reserved. Please choose another.' },
        { status: 400 }
      );
    }

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', authResult.user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This username is already taken.' },
        { status: 409 }
      );
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        username,
        display_name: displayName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', authResult.user.id);

    if (updateError) {
      console.error('[Profile Username] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update username' }, { status: 500 });
    }

    return NextResponse.json({ success: true, username, displayName });
  } catch (error) {
    console.error('[Profile Username] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
