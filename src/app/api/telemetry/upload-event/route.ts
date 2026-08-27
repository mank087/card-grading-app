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
  // CAPTURE-GATE P0 — attempt lifecycle. These exist to make abandonment
  // measurable: an attempt_id with preflight_rejected and no later
  // grade_started was abandoned, and no card row would ever record that,
  // because a user who quits never creates one.
  'capture_attempted',
  'local_quality_warning',
  'photo_replaced',
  'preflight_passed',
  'preflight_rejected',
  'retake_started',
  'grade_started',
]);

const clip = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;

const UUID_RE = /^[0-9a-f-]{36}$/i;
const uuid = (v: unknown): string | null =>
  typeof v === 'string' && UUID_RE.test(v) ? v : null;

/**
 * Cap the free-form metadata blob. It is deliberately unvalidated beyond size
 * — it holds measurements whose shape will change as the gate is tuned — but
 * anything worth filtering or grouping on belongs in its own column instead.
 */
const clipJson = (v: unknown, maxChars: number): unknown => {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  try {
    const s = JSON.stringify(v);
    return s.length <= maxChars ? v : null;
  } catch {
    return null;
  }
};

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
      // CAPTURE-GATE P0 fields. All nullable: pre-existing events send none of
      // them, and the columns may not exist yet if the migration has not run.
      attempt_id: uuid(body.attempt_id),
      submission_id: uuid(body.submission_id),
      rule_code: clip(body.rule_code, 60),
      client_surface: clip(body.client_surface, 40),
      capture_source: clip(body.capture_source, 40),
      capture_method: clip(body.capture_method, 40),
      gate_version: clip(body.gate_version, 40),
      metadata: clipJson(body.metadata, 4000),
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
