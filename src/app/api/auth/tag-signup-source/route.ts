/**
 * POST /api/auth/tag-signup-source
 *
 * Called once by the mobile app after a successful sign-in/sign-up to tag
 * the user's signup_source on public.users. Needed for OAuth flows (Apple
 * Sign-In, Google, Facebook) where the supabase.auth call doesn't accept
 * raw_user_meta_data, so the handle_new_user trigger defaults the source
 * to 'web' even when the user actually came from the mobile app.
 *
 * Safety: this endpoint will ONLY upgrade signup_source from 'web' to
 * 'ios_app'/'android_app' if the user was created within the last 60
 * minutes. A real web user who later signs into the mobile app cannot
 * have their attribution flipped after the fact.
 *
 * Idempotent: subsequent calls no-op because signup_source is no longer 'web'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const ALLOWED_PLATFORMS = new Set(['ios_app', 'android_app'])
const TAG_WINDOW_MINUTES = 60

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromAuthHeader(request.headers.get('authorization'))
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const platform = request.headers.get('x-client-platform') || ''
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'Invalid or missing X-Client-Platform header' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('id, signup_source, created_at')
    .eq('id', userId)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Only upgrade if currently null or 'web' AND user is freshly created.
  // Anything else is a no-op — we never overwrite a non-web tag, and we
  // never re-attribute a user who's been around a while.
  if (existing.signup_source && existing.signup_source !== 'web') {
    return NextResponse.json({ tagged: false, reason: 'already_tagged', current: existing.signup_source })
  }

  const ageMinutes = (Date.now() - new Date(existing.created_at).getTime()) / 60_000
  if (ageMinutes > TAG_WINDOW_MINUTES) {
    return NextResponse.json({ tagged: false, reason: 'window_expired', age_minutes: Math.round(ageMinutes) })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ signup_source: platform })
    .eq('id', userId)

  if (updateErr) {
    return NextResponse.json({ error: 'Update failed', details: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ tagged: true, signup_source: platform })
}
