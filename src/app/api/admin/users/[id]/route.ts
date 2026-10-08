import { NextRequest, NextResponse } from 'next/server'
import { clientIp, logAdminActivity, verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'
import { stripe } from '@/lib/stripe'

// Get single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's recent cards (displayed columns only; soft-deleted excluded).
    // ai_grading is a large blob, so it is not selected here — legacy rows
    // with no conversational_card_info get just its card-info part below.
    const { data: cards } = await supabaseAdmin
      .from('cards')
      .select('id, serial, card_name, category, created_at, conversational_decimal_grade, conversational_whole_grade, conversational_condition_label, conversational_card_info, featured, pokemon_featured, card_set, release_date, manufacturer_name, card_number')
      .eq('user_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    const recentCards: Array<Record<string, any>> = (cards || []).map(c => ({ ...c, ai_grading: null }))
    const legacyIds = recentCards.filter(c => !c.conversational_card_info).map(c => c.id)
    if (legacyIds.length > 0) {
      const { data: legacyRows } = await supabaseAdmin
        .from('cards')
        .select('id, ai_grading')
        .in('id', legacyIds)
      for (const row of legacyRows || []) {
        const target = recentCards.find(c => c.id === row.id)
        const ai = row.ai_grading as Record<string, any> | null
        if (target && ai) {
          target.ai_grading = { 'Card Information': ai['Card Information'], card_info: ai.card_info }
        }
      }
    }

    // Get user statistics: exact head counts (no 1,000-row cap) and an average
    // paged over the narrow grade column in batches of 1,000.
    const [totalResult, gradedResult, authResult] = await Promise.all([
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .is('deleted_at', null),
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .is('deleted_at', null)
        .not('conversational_decimal_grade', 'is', null),
      supabaseAdmin.auth.admin.getUserById(id).catch(() => null),
    ])

    const totalCards = totalResult.count || 0
    const gradedCards = gradedResult.count || 0
    let gradeSum = 0
    let gradeRows = 0
    const PAGE = 1000
    for (let from = 0; from < gradedCards; from += PAGE) {
      const { data: gradePage, error: gradeError } = await supabaseAdmin
        .from('cards')
        .select('conversational_decimal_grade')
        .eq('user_id', id)
        .is('deleted_at', null)
        .not('conversational_decimal_grade', 'is', null)
        .order('id')
        .range(from, from + PAGE - 1)
      if (gradeError || !gradePage || gradePage.length === 0) break
      for (const row of gradePage) {
        const g = Number(row.conversational_decimal_grade)
        if (g) { gradeSum += g; gradeRows++ }
      }
      if (gradePage.length < PAGE) break
    }
    const avgGrade = gradeRows > 0 ? gradeSum / gradeRows : 0

    return NextResponse.json({
      user: {
        ...user,
        last_active: authResult?.data?.user?.last_sign_in_at ?? null,
      },
      statistics: {
        total_cards: totalCards,
        graded_cards: gradedCards,
        average_grade: Math.round(avgGrade * 10) / 10
      },
      recent_cards: recentCards
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id] (JSON body { reason }) — super-admin account
 * deletion as a SOFT delete: cards hidden, purchase history kept, account
 * disabled and anonymised.
 *
 * Why the auth user is banned + anonymised instead of deleted (FKs as defined
 * in the repo's schema files):
 *   - cards.user_id REFERENCES auth.users(id) with no ON DELETE action
 *     (database_schema_v3_1_complete.sql:20), so deleting the auth user fails
 *     while any card row exists — the old flow only worked because it
 *     hard-deleted every card first.
 *   - credit_transactions.user_id and user_credits.user_id are ON DELETE
 *     CASCADE (database/create_credits_tables.sql:23, :9), as are
 *     iap_transactions (migrations/add_iap_transactions.sql:18), public.users
 *     (database/create_users_table.sql:5) and profiles
 *     (migrations/fix_handle_new_user_trigger.sql:61). Deleting the auth user
 *     would wipe the financial history this flow must keep.
 *   - organizations.owner_user_id REFERENCES auth.users(id) with no ON DELETE
 *     action (supabase/migrations/20260805_enterprise_organizations.sql:9), so
 *     org owners are refused up front.
 * So the auth row stays (every FK keeps its linkage for reporting), is banned
 * for ~100 years, and its email/metadata are replaced; public.users and
 * profiles are anonymised to match. The real email is freed, so the person
 * can register again with email/password (an OAuth identity stays linked to
 * the banned row).
 *
 * Steps run in order and stop at the first failure (500 names the step).
 * The audit row is written first; nothing changes if it cannot be written.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super_admin can delete users
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Only super admins can delete users' }, { status: 403 })
    }

    if (!isUuid(id)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Reason comes in the JSON body (kept out of URLs/access logs); the query
    // param is still read for older clients.
    const body = await request.json().catch(() => null)
    const bodyReason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const reason = bodyReason || request.nextUrl.searchParams.get('reason') || 'No reason provided'

    const failed = (step: string, err: unknown) => {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      console.error(`[admin delete user ${id}] step "${step}" failed:`, message)
      return NextResponse.json(
        { error: `User deletion stopped at step "${step}": ${message}. Earlier steps were applied; later steps were not.`, failed_step: step },
        { status: 500 }
      )
    }

    // The account must exist in auth.
    const { data: authData, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(id)
    if (authLookupError || !authData?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const anonEmail = `deleted+${id}@deleted.dcmgrading.com`
    if (authData.user.email === anonEmail) {
      return NextResponse.json({ message: 'User was already deleted', already_deleted: true }, { status: 200 })
    }
    const originalEmail = authData.user.email ?? null

    // Org owners first: their organization would be left without an owner.
    const { data: ownedOrgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('owner_user_id', id)
    if (orgError) return failed('check organizations', orgError)
    if (ownedOrgs && ownedOrgs.length > 0) {
      return NextResponse.json({
        error: `This user owns ${ownedOrgs.length === 1 ? `the organization "${ownedOrgs[0].name}"` : `${ownedOrgs.length} organizations`}. Transfer or close their organization first.`,
        organizations: ownedOrgs,
      }, { status: 409 })
    }

    // Counts for the audit row.
    const [cardsCount, txCount, creditsRow] = await Promise.all([
      supabaseAdmin.from('cards').select('id', { count: 'exact', head: true }).eq('user_id', id).is('deleted_at', null),
      supabaseAdmin.from('credit_transactions').select('id', { count: 'exact', head: true }).eq('user_id', id),
      supabaseAdmin.from('user_credits').select('balance, card_lover_subscription_id').eq('user_id', id).maybeSingle(),
    ])
    if (cardsCount.error) return failed('count cards', cardsCount.error)
    if (txCount.error) return failed('count credit transactions', txCount.error)
    if (creditsRow.error) return failed('read credit balance', creditsRow.error)

    // 1. Audit row first.
    const audited = await logAdminActivity(admin.id, admin.email, 'delete_user', 'user', id, {
      reason,
      soft_delete: true,
      email: originalEmail,
      cards_hidden: cardsCount.count ?? 0,
      credit_transactions_kept: txCount.count ?? 0,
      credit_balance: creditsRow.data?.balance ?? null,
    }, clientIp(request))
    if (!audited) return failed('write audit log', 'admin_activity_log insert failed')

    // 1b. Stop billing: cancel an active Card Lovers Stripe subscription so a
    // deleted customer is never charged again. Already-cancelled or missing
    // subscriptions are fine; any other Stripe error stops the delete. App
    // Store / Play subscriptions can only be cancelled by the customer.
    const subId = creditsRow.data?.card_lover_subscription_id as string | null | undefined
    if (subId && subId.startsWith('sub_')) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId)
        if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
          await stripe.subscriptions.cancel(subId)
        }
      } catch (err: any) {
        if (err?.code !== 'resource_missing') return failed('cancel Card Lovers subscription', err)
      }
    }

    // 2. Soft-delete the cards: same write as the admin card delete
    // (deleted_at + forced private visibility; images and rows kept).
    const { error: cardsError } = await supabaseAdmin
      .from('cards')
      .update({ deleted_at: new Date().toISOString(), visibility: 'private' })
      .eq('user_id', id)
      .is('deleted_at', null)
    if (cardsError) return failed('soft-delete cards', cardsError)

    // credit_transactions and user_credits are intentionally left untouched.

    // 3. Disable and anonymise the auth account (ban ~100 years).
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
      email: anonEmail,
      email_confirm: true,
      user_metadata: {},
    })
    if (authError) return failed('disable auth account', authError)

    // 4. Anonymise the public.users mirror.
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .update({ email: anonEmail, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (usersError) return failed('anonymise users row', usersError)

    // 5. Anonymise the profile and stop marketing email (the scheduled-email
    // cron skips users whose marketing_emails_enabled is false).
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: anonEmail,
        display_name: null,
        username: null,
        ad_click_ids: null,
        ad_click_captured_at: null,
        marketing_emails_enabled: false,
        marketing_unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (profileError) return failed('anonymise profile', profileError)

    return NextResponse.json({
      message: 'User deleted: cards hidden, purchase history kept, account disabled',
      cards_hidden: cardsCount.count ?? 0,
      credit_transactions_kept: txCount.count ?? 0,
    }, { status: 200 })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
