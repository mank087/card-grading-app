/**
 * Saved card-notes profiles.
 * GET:  { success, profiles, available }
 * POST: { action: 'save', profile: { id?, name, text } } | { action: 'delete', id }
 *
 * Stored in user_credits.grading_notes_profiles (jsonb), same place and auth
 * pattern as custom_label_styles (/api/user/label-style). The user id always
 * comes from the verified JWT, never from the request body.
 *
 * Until migration 20260928_grading_notes_profiles.sql is applied the column is
 * missing: GET answers `available: false` with no profiles (the UI hides the
 * save controls) and POST answers 503, so deploying first breaks nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  deleteNotesProfile,
  normalizeNotesProfiles,
  upsertNotesProfile,
} from '@/lib/notesProfiles';

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' ||
    /grading_notes_profiles/.test(error.message || '');
}

async function loadProfiles(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_credits')
    .select('grading_notes_profiles')
    .eq('user_id', userId)
    .maybeSingle();
  return { data, error };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data, error } = await loadProfiles(auth.userId);
  if (error) {
    if (isMissingColumn(error)) {
      return NextResponse.json({ success: true, profiles: [], available: false });
    }
    console.error('[notes-profiles] load failed:', error.message);
    return NextResponse.json({ error: 'Failed to load notes profiles' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    profiles: normalizeNotesProfiles((data as { grading_notes_profiles?: unknown } | null)?.grading_notes_profiles),
    available: true,
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = auth.userId;

  let body: { action?: string; profile?: Record<string, unknown>; id?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data, error } = await loadProfiles(userId);
  if (error) {
    if (isMissingColumn(error)) {
      return NextResponse.json({ error: 'Saved notes profiles are not available yet.' }, { status: 503 });
    }
    console.error('[notes-profiles] load failed:', error.message);
    return NextResponse.json({ error: 'Failed to load notes profiles' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'No account record found for this user.' }, { status: 404 });
  }

  const current = normalizeNotesProfiles((data as { grading_notes_profiles?: unknown }).grading_notes_profiles);
  let next = current;
  let saved: unknown = undefined;

  if (body?.action === 'save') {
    const result = upsertNotesProfile(current, body.profile ?? {}, () => crypto.randomUUID());
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    next = result.profiles;
    saved = result.saved;
  } else if (body?.action === 'delete') {
    next = deleteNotesProfile(current, body.id);
  } else {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { error: writeError } = await supabaseAdmin
    .from('user_credits')
    .update({ grading_notes_profiles: next })
    .eq('user_id', userId);

  if (writeError) {
    console.error('[notes-profiles] write failed:', writeError.message);
    return NextResponse.json({ error: 'Failed to save notes profiles' }, { status: 500 });
  }

  return NextResponse.json({ success: true, profiles: next, ...(saved ? { saved } : {}) });
}
