/**
 * Admin Approve Commissions API
 * POST: Batch approve all pending commissions past hold period
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';
import { approveCommissions } from '@/lib/affiliates';

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

    const result = await approveCommissions();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      message: `${result.approvedCount} commissions approved`,
      approvedCount: result.approvedCount,
    });
  } catch (error) {
    console.error('Error approving commissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
