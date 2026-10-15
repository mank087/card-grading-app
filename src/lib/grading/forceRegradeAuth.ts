/**
 * Who may force a re-grade (Oct 2026).
 *
 * DCM does not sell re-grades: a customer who wants a card graded again submits
 * it again, and VIP / Card Lovers members can request a grade review. The
 * category GET routes still accept `?force_regrade=true` because the manual
 * review tooling and repair scripts re-run a card through the engine. Until
 * now any caller who knew a card id and its owner id could use it for free.
 *
 * The flag is honoured only for an admin session (the admin_token cookie) or a
 * server-side caller presenting the CRON_SECRET bearer token. Anyone else gets
 * the normal cached response.
 */
import type { NextRequest } from 'next/server';
import { verifyAdminSession } from '@/lib/admin/adminAuth';

export async function forceRegradeAllowed(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (secret && header === `Bearer ${secret}`) return true;
  const token = request.cookies.get('admin_token')?.value;
  if (token) {
    try { return !!(await verifyAdminSession(token)); } catch { return false; }
  }
  return false;
}
