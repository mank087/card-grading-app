/**
 * The seller's eBay business policies.
 *
 * GET  /api/ebay/policies — { shipping: [{id,name,summary}], returns, payment }
 *      straight off the seller's EBAY_US account. Read on demand by the
 *      listing modal and the bulk settings panel when the seller has opted in.
 * POST /api/ebay/policies — create ONE shipping or return policy from the
 *      minimal inline form, and return it so the caller can select it without
 *      a second round trip.
 *
 * Payment policies are list-only: under managed payments there is nothing a
 * card seller meaningfully chooses, and every account already has a usable
 * default. See createPolicy() for the reasoning.
 *
 * Auth is the bearer JWT every other InstaList route uses. The eBay call
 * itself goes through the shared connection + refresh helpers, so an expired
 * token reports the same 401 ("reconnect your account") the listing path does.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { DOMESTIC_SHIPPING_SERVICES, DEFAULT_DOMESTIC_SHIPPING_SERVICE } from '@/lib/ebay/tradingApi';
import {
  fetchAllPolicies,
  createPolicy,
  PolicyApiError,
  type CreatePolicyInput,
} from '@/lib/ebay/businessPolicies';

export const runtime = 'nodejs';

type ConnectResult =
  | { ok: true; connection: NonNullable<Awaited<ReturnType<typeof getConnectionForUser>>> }
  | { ok: false; response: NextResponse };

/**
 * The connection + a fresh token, or the response to send instead. Same two
 * codes (`no_connection`, `token_refresh_failed`) the publish path reports, so
 * a client can handle "reconnect eBay" in one place.
 */
async function connect(userId: string): Promise<ConnectResult> {
  let connection = await getConnectionForUser(userId);
  if (!connection) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'no_connection', message: 'No eBay account connected' },
        { status: 400 }
      ),
    };
  }
  connection = await refreshTokenIfNeeded(connection);
  if (!connection) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'token_refresh_failed',
          message: 'Failed to refresh eBay authorization. Please reconnect your account.',
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, connection };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const conn = await connect(auth.user.id);
  if (!conn.ok) return conn.response;

  try {
    const policies = await fetchAllPolicies(conn.connection.access_token, conn.connection.is_sandbox);
    return NextResponse.json(policies);
  } catch (err) {
    if (err instanceof PolicyApiError) {
      // 403 from the Account API is what an account outside the
      // SELLING_POLICY_MANAGEMENT program gets — say so, rather than
      // reporting "no policies" and sending the seller to create duplicates.
      console.warn('[ebay/policies] eBay refused the policy list:', err.status, err.message);
      return NextResponse.json(
        { error: 'ebay_error', message: err.message },
        { status: err.status === 403 ? 403 : 502 }
      );
    }
    console.error('[ebay/policies] unexpected error:', err);
    return NextResponse.json({ error: 'Failed to load your eBay policies' }, { status: 500 });
  }
}

const SERVICE_VALUES = new Set(DOMESTIC_SHIPPING_SERVICES.map(s => s.value));
const RETURN_WINDOWS = new Set([14, 30, 60]);

/**
 * Validate the create form. Returns the typed input or the message to show —
 * everything the browser can send is re-checked here, because the Account API
 * reports a bad field as a schema error nobody can act on.
 */
function parseCreateBody(body: any): CreatePolicyInput | { error: string } {
  const name = typeof body?.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (name.length < 3 || name.length > 64) {
    return { error: 'Give the policy a name between 3 and 64 characters' };
  }

  if (body?.kind === 'shipping') {
    const service =
      typeof body.service === 'string' && SERVICE_VALUES.has(body.service)
        ? body.service
        : DEFAULT_DOMESTIC_SHIPPING_SERVICE;
    const freeShipping = body.freeShipping === true;
    const cost = Number(body.cost);
    if (!freeShipping && (!Number.isFinite(cost) || cost < 0 || cost > 1000)) {
      return { error: 'Shipping cost must be between $0 and $1000' };
    }
    const handlingDays = Number(body.handlingDays);
    if (!Number.isInteger(handlingDays) || handlingDays < 0 || handlingDays > 30) {
      return { error: 'Handling time must be a whole number of days between 0 and 30' };
    }
    return { kind: 'shipping', name, service, cost: freeShipping ? 0 : cost, handlingDays, freeShipping };
  }

  if (body?.kind === 'returns') {
    const returnsAccepted = body.returnsAccepted !== false;
    const days = Number(body.days);
    if (returnsAccepted && !RETURN_WINDOWS.has(days)) {
      return { error: 'Return window must be 14, 30 or 60 days' };
    }
    const paidBy = body.paidBy === 'SELLER' ? 'SELLER' : 'BUYER';
    return { kind: 'returns', name, returnsAccepted, days: returnsAccepted ? days : 30, paidBy };
  }

  return { error: 'kind must be "shipping" or "returns"' };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseCreateBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const conn = await connect(auth.user.id);
  if (!conn.ok) return conn.response;

  try {
    const policy = await createPolicy(parsed, conn.connection.access_token, conn.connection.is_sandbox);
    return NextResponse.json({ success: true, kind: parsed.kind, policy });
  } catch (err) {
    if (err instanceof PolicyApiError) {
      console.warn('[ebay/policies] create refused:', err.status, err.message);
      return NextResponse.json({ error: 'ebay_error', message: err.message }, { status: 400 });
    }
    console.error('[ebay/policies] create failed:', err);
    return NextResponse.json({ error: 'Failed to create the policy' }, { status: 500 });
  }
}
