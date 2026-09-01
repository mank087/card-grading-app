/**
 * Capture/upload telemetry for the native app.
 *
 * The web has had this since Jul 2026; native has never sent anything, so
 * every client-side rejection and abandonment on iOS and Android has been
 * invisible. That is a problem for the capture gate specifically: abandonment
 * is measured from attempt events, and half the traffic could not emit them.
 *
 * Differences from the web helper (src/lib/uploadTelemetry.ts), all forced by
 * the platform:
 *   - absolute URL — there is no same-origin '/api' in a native bundle
 *   - explicit bearer token — no cookies
 *   - no `keepalive` — not supported by React Native's fetch, and less useful
 *     here since the process is not about to be replaced by a navigation
 *
 * The event names and reason codes are shared with the server. Reason codes
 * live in ./captureReasonCodes.ts, which a test in the web project keeps in
 * sync with its source of truth.
 */

import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'

export type UploadTelemetryEvent =
  | 'heic_convert_error'
  | 'identical_images_reject'
  | 'min_res_reject'
  | 'small_image_advisory'
  | 'compress_error'
  | 'quality_advisory_cd'
  | 'submit_error'
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
  rule_code?: string
  capture_source?: string
  capture_method?: string
  gate_version?: string
  submission_id?: string
  metadata?: Record<string, unknown>
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

/** See the web helper: session-scoped, deliberately not durable. */
let currentAttemptId: string | null = null

export function beginCaptureAttempt(): string {
  currentAttemptId = Crypto.randomUUID()
  return currentAttemptId
}

export function getCaptureAttemptId(): string | null {
  return currentAttemptId
}

export function endCaptureAttempt(): void {
  currentAttemptId = null
}

/**
 * Fire-and-forget. Never throws, never blocks, never surfaces an error —
 * telemetry that can break a capture is worse than no telemetry.
 */
export function reportUploadEvent(
  payload: UploadTelemetryPayload,
  accessToken?: string | null
): void {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    void fetch(`${API_BASE}/api/telemetry/upload-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        attempt_id: currentAttemptId ?? undefined,
        client_surface: Platform.OS === 'ios' ? 'native_ios' : 'native_android',
        ...payload,
        page: 'native',
      }),
    }).catch(() => { /* never surface */ })
  } catch { /* never throw from telemetry */ }
}
