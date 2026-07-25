/**
 * Client-side upload telemetry ingest.
 *
 * Upload rejections/failures happen entirely in the browser and were invisible
 * server-side — two customer-blocking bugs in Jul 2026 were only discovered via
 * support email. The upload pages beacon failure events here (fire-and-forget,
 * keepalive). Deliberately forgiving: never errors back to the client, caps all
 * field sizes, and tolerates the table not existing yet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAuth } from '@/lib/serverAuth';

const ALLOWED_EVENTS = new Set([
  'heic_convert_error',
  'identical_images_reject',
  'min_res_reject',
  'small_image_advisory',
  'compress_error',
  'quality_advisory_cd',
  'submit_error',
]);

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.event !== 'string' || !ALLOWED_EVENTS.has(body.event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Attach the user when a valid token is present; failures before/without
    // auth still get recorded anonymously.
    let userId: string | null = null;
    try {
      const auth = await verifyAuth(request);
      if (auth.authenticated && auth.user) userId = auth.user.id;
    } catch { /* anonymous event */ }

    const { error } = await supabaseAdmin.from('upload_telemetry').insert({
      user_id: userId,
      event: body.event,
      side: body.side === 'front' || body.side === 'back' ? body.side : null,
      reason: clip(body.reason, 500),
      image_width: Number.isFinite(body.image_width) ? Math.round(body.image_width) : null,
      image_height: Number.isFinite(body.image_height) ? Math.round(body.image_height) : null,
      file_type: clip(body.file_type, 100),
      file_size_bytes: Number.isFinite(body.file_size_bytes) ? Math.round(body.file_size_bytes) : null,
      user_agent: clip(request.headers.get('user-agent'), 300),
      page: clip(body.page, 200),
    });
    if (error) {
      // Table may not exist yet (manual migration) — log server-side only.
      console.warn('[UploadTelemetry] insert failed (non-fatal):', error.message);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // telemetry must never bother the client
  }
}
