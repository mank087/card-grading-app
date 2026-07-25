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

export interface UploadTelemetryPayload {
  event: UploadTelemetryEvent
  side?: 'front' | 'back'
  reason?: string
  image_width?: number
  image_height?: number
  file_type?: string
  file_size_bytes?: number
}

export function reportUploadEvent(payload: UploadTelemetryPayload, accessToken?: string | null): void {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    void fetch('/api/telemetry/upload-event', {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({ ...payload, page: typeof window !== 'undefined' ? window.location.pathname : undefined }),
    }).catch(() => { /* telemetry must never surface errors */ })
  } catch { /* never throw from telemetry */ }
}
