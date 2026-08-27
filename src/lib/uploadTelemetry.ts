'use client'

/**
 * Fire-and-forget beacon for client-side upload failures.
 *
 * Rejections and errors in the upload flow happen entirely in the browser —
 * without this, they are invisible server-side (two customer-blocking bugs in
 * Jul 2026 were discovered only via support email). Never throws, never
 * blocks; uses keepalive so events survive navigation.
 */

export type UploadTelemetryEvent =
  | 'heic_convert_error'
  | 'identical_images_reject'
  | 'min_res_reject'
  | 'small_image_advisory'
  | 'compress_error'
  | 'quality_advisory_cd'
  | 'submit_error'
  // CAPTURE-GATE P0 — attempt lifecycle, for measuring abandonment.
  | 'capture_attempted'
  | 'local_quality_warning'
  | 'photo_replaced'
  | 'preflight_passed'
  | 'preflight_rejected'
  | 'retake_started'
  | 'grade_started'

export interface UploadTelemetryPayload {
  event: UploadTelemetryEvent
  side?: 'front' | 'back'
  reason?: string
  image_width?: number
  image_height?: number
  file_type?: string
  file_size_bytes?: number
  /** Groups every event in one capture attempt — the abandonment join key. */
  attempt_id?: string
  submission_id?: string
  /** From the shared contract in lib/grading/captureReasonCodes.ts. */
  rule_code?: string
  client_surface?: string
  capture_source?: string
  capture_method?: string
  gate_version?: string
  metadata?: Record<string, unknown>
}

/**
 * Stable id for one capture attempt, from first photo through grade start.
 *
 * Session-scoped rather than persisted: it needs to survive navigating between
 * capture and review, not to be durable across app restarts. An abandoned
 * attempt is one that never emits grade_started, which is exactly what we want
 * a page reload to look like.
 */
let currentAttemptId: string | null = null

export function beginCaptureAttempt(): string {
  currentAttemptId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return currentAttemptId
}

export function getCaptureAttemptId(): string | null {
  return currentAttemptId
}

export function endCaptureAttempt(): void {
  currentAttemptId = null
}

export function reportUploadEvent(payload: UploadTelemetryPayload, accessToken?: string | null): void {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    void fetch('/api/telemetry/upload-event', {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        // Attach the current attempt automatically so no call site has to
        // remember — a missing attempt_id silently drops that event out of the
        // abandonment funnel rather than erroring.
        attempt_id: currentAttemptId ?? undefined,
        ...payload,
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      }),
    }).catch(() => { /* telemetry must never surface errors */ })
  } catch { /* never throw from telemetry */ }
}
