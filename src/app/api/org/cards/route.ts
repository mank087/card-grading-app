/**
 * Store inventory: every card graded under the caller's organization,
 * regardless of which staff account graded it. Client RLS can't read across
 * users, so this goes through the service role after a membership check.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { getOrgForUser } from '@/lib/organizations'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createSignedUrlMap } from '@/lib/signedUrlBatch'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const membership = await getOrgForUser(authResult.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Not an organization member' }, { status: 403 })
  }

  const { data: cards, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('org_id', membership.org.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) {
    console.error('[org/cards] query error:', error)
    return NextResponse.json({ error: 'Failed to load store cards' }, { status: 500 })
  }

  // Signed image URLs, same as the personal collection API — raw storage
  // paths render as "No image" on the client.
  let cardsWithUrls = cards || []
  try {
    const allPaths = cardsWithUrls.flatMap(c => [c.front_path, c.back_path])
    const urlMap = await createSignedUrlMap(supabaseAdmin.storage, 'cards', allPaths, 60 * 60)
    cardsWithUrls = cardsWithUrls.map(c => ({
      ...c,
      front_url: urlMap.get(c.front_path) || null,
      back_url: urlMap.get(c.back_path) || null,
    }))
  } catch (signError) {
    console.error('[org/cards] Error creating signed URLs:', signError)
    cardsWithUrls = cardsWithUrls.map(c => ({ ...c, front_url: null, back_url: null }))
  }

  // Resolve grader emails for the "graded by" column
  const graderIds = Array.from(new Set((cards || []).map(c => c.user_id).filter(Boolean)))
  const graders: Record<string, string> = {}
  if (graderIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', graderIds)
    for (const u of users || []) graders[u.id] = u.email
  }

  return NextResponse.json({
    org: {
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      gradeCredits: membership.org.grade_credits,
    },
    role: membership.role,
    currentUserId: authResult.user.id,
    cards: cardsWithUrls,
    graders,
  })
}
