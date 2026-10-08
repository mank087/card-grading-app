/**
 * Admin Affiliate Commissions API
 * GET: List commissions (filterable by status, affiliate, date range)
 * POST: Batch mark commissions as paid
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { getPayableCommissions, listCommissions, markCommissionsPaid } from '@/lib/affiliates';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get('affiliate_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { commissions, total } = await listCommissions({
      affiliateId,
      status,
      limit,
      offset,
    });

    return NextResponse.json({ commissions, total });
  } catch (error) {
    console.error('Error listing commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { payout_reference, affiliate_id, all_approved } = body;
    let commission_ids: unknown = body.commission_ids;

    // Pay out every approved commission for an affiliate, resolved server-side
    // (the page only loads the latest 50 commissions).
    if (all_approved === true && typeof affiliate_id === 'string' && affiliate_id) {
      const payable = await getPayableCommissions(affiliate_id);
      commission_ids = payable.map((c) => c.id);
      if ((commission_ids as string[]).length === 0) {
        return NextResponse.json(
          { error: 'No approved commissions to pay for this affiliate' },
          { status: 400 }
        );
      }
    }

    if (!commission_ids || !Array.isArray(commission_ids) || commission_ids.length === 0) {
      return NextResponse.json(
        { error: 'commission_ids array (or affiliate_id with all_approved) is required' },
        { status: 400 }
      );
    }

    if (!payout_reference) {
      return NextResponse.json(
        { error: 'payout_reference is required' },
        { status: 400 }
      );
    }

    const result = await markCommissionsPaid(commission_ids as string[], payout_reference);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      message: `${result.paidCount} commissions marked as paid`,
      paidCount: result.paidCount,
    });
  } catch (error) {
    console.error('Error processing payout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
