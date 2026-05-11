/**
 * Account Deletion API
 *
 * Permanently deletes a user's account and all associated personal data.
 * Required for App Store + Play Store compliance — both stores reject
 * apps with in-app account creation that don't also offer in-app account
 * deletion (Apple guideline 5.1.1(v), Google effective May 2024).
 *
 * Deletion order matters (foreign keys):
 *   1. Card images in Supabase storage   (cards bucket)
 *   2. Card rows                          (cards table)
 *   3. Credit transactions                (financial trail — see note)
 *   4. User credits balance               (user_credits)
 *   5. Affiliate links + clicks           (if any)
 *   6. Auth user                          (auth.users)
 *
 * Authentication:
 *   - Requires a valid Supabase JWT in Authorization: Bearer header.
 *   - For password users, an optional `password` body field
 *     re-authenticates the request as a second factor. For OAuth
 *     (Apple, Google) users — who have no password — the JWT proof of
 *     active sign-in is sufficient. Mobile UI provides a typed
 *     "DELETE" confirmation as the additional protection.
 *
 * NOTE on financial records: credit_transactions are hard-deleted
 * here per the original implementation. For more conservative
 * compliance (IRS / tax / chargeback audit retention), an alternative
 * is to anonymize user_id rather than delete. Decision left at status
 * quo; revisit if a finance/legal review prefers anonymization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/serverAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = authResult.userId;
    const userEmail = authResult.user?.email || '';

    // Optional password re-auth — supports password users without
    // requiring it for OAuth users (Apple Sign In + Google have no
    // password). Mobile UI provides a typed "DELETE" confirmation
    // as the second factor regardless of auth method.
    const body = await request.json().catch(() => ({}));
    const { password } = body as { password?: string };

    if (password) {
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (signInError) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
      }
    }

    console.log(`[Account Delete] Starting deletion for user: ${userId}`);

    // ─── Step 1: Storage cleanup — card images ──────────────────────
    // Fetch the user's card image paths BEFORE deleting the rows so we
    // know which storage objects to remove. Missing this step orphans
    // all the user's card images in the bucket forever.
    try {
      const { data: userCards, error: cardsListError } = await supabaseAdmin
        .from('cards')
        .select('front_path, back_path')
        .eq('user_id', userId);

      if (!cardsListError && userCards && userCards.length > 0) {
        const paths: string[] = [];
        for (const c of userCards) {
          if (c.front_path) paths.push(c.front_path);
          if (c.back_path) paths.push(c.back_path);
        }
        if (paths.length > 0) {
          const { error: storageError } = await supabaseAdmin.storage
            .from('cards')
            .remove(paths);
          if (storageError) {
            // Non-fatal — log and continue. Better to complete the rest
            // of the deletion than refuse over orphaned blobs.
            console.error('[Account Delete] Storage cleanup error:', storageError);
          } else {
            console.log(`[Account Delete] Removed ${paths.length} card images from storage`);
          }
        }
      }
    } catch (e) {
      console.error('[Account Delete] Storage cleanup exception (non-fatal):', e);
    }

    // ─── Step 2: Delete card rows ───────────────────────────────────
    const { error: cardsError } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('user_id', userId);
    if (cardsError) {
      console.error('[Account Delete] Error deleting cards:', cardsError);
    } else {
      console.log('[Account Delete] Cards rows deleted');
    }

    // ─── Step 3: Delete credit transactions ─────────────────────────
    const { error: transactionsError } = await supabaseAdmin
      .from('credit_transactions')
      .delete()
      .eq('user_id', userId);
    if (transactionsError) {
      console.error('[Account Delete] Error deleting credit transactions:', transactionsError);
    } else {
      console.log('[Account Delete] Credit transactions deleted');
    }

    // ─── Step 4: Delete user_credits balance ────────────────────────
    const { error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .delete()
      .eq('user_id', userId);
    if (creditsError) {
      console.error('[Account Delete] Error deleting user credits:', creditsError);
    } else {
      console.log('[Account Delete] User credits deleted');
    }

    // ─── Step 5: Affiliate cleanup (best-effort) ────────────────────
    // Tables may or may not exist depending on env. Wrap each in try
    // so missing tables don't block the deletion.
    try {
      await supabaseAdmin.from('affiliate_commissions').delete().eq('user_id', userId);
      await supabaseAdmin.from('affiliate_clicks').delete().eq('user_id', userId);
      await supabaseAdmin.from('affiliates').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('[Account Delete] Affiliate cleanup skipped (table may not exist):', e);
    }

    // ─── Step 6: Delete the auth user ───────────────────────────────
    // Must come last — once this succeeds the JWT becomes invalid and
    // any remaining cleanup queries would fail.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('[Account Delete] Error deleting auth user:', authError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    console.log(`[Account Delete] Successfully deleted user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error: any) {
    console.error('[Account Delete] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}
