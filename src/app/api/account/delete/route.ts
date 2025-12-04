/**
 * Account Deletion API
 * Permanently deletes a user's account and all associated data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/serverAuth';

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest) {
  try {
    // Verify user is authenticated
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.userId;
    console.log(`[Account Delete] Starting deletion for user: ${userId}`);

    // Step 1: Delete all user's cards
    const { error: cardsError } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('user_id', userId);

    if (cardsError) {
      console.error('[Account Delete] Error deleting cards:', cardsError);
      // Continue anyway - some users might not have cards
    } else {
      console.log('[Account Delete] Cards deleted successfully');
    }

    // Step 2: Delete user's credit transactions
    const { error: transactionsError } = await supabaseAdmin
      .from('credit_transactions')
      .delete()
      .eq('user_id', userId);

    if (transactionsError) {
      console.error('[Account Delete] Error deleting credit transactions:', transactionsError);
      // Continue anyway
    } else {
      console.log('[Account Delete] Credit transactions deleted successfully');
    }

    // Step 3: Delete user's credits record
    const { error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .delete()
      .eq('user_id', userId);

    if (creditsError) {
      console.error('[Account Delete] Error deleting user credits:', creditsError);
      // Continue anyway
    } else {
      console.log('[Account Delete] User credits deleted successfully');
    }

    // Step 4: Delete the user from Supabase Auth
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
      message: 'Account deleted successfully'
    });

  } catch (error: any) {
    console.error('[Account Delete] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}
