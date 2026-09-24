/** Opt-in development diagnostics. No images, identifiers, URLs or network writes. */
export const CAPTURE_AUDIT_KEY = 'dcm.captureAudit.v1';
export const CAPTURE_AUDIT_ENABLED_KEY = 'dcm.captureAudit.enabled';
const MAX_EVENTS = 100;

export interface CaptureAuditEvent {
  captureId: string;
  stage: 'shutter' | 'frame' | 'crop' | 'fallback' | 'failed' | 'accepted' | 'retake';
  side: 'front' | 'back';
  orientation: 'portrait' | 'landscape';
  viewport?: { width: number; height: number };
  frame?: { width: number; height: number };
  stream?: { width: number; height: number };
  transform?: { scale: number; scaleY?: number; offsetX: number; offsetY: number };
  alignment?: { model: string; error: number };
  guide?: { width: number; height: number; centerOffsetY: number };
  crop?: { x: number; y: number; width: number; height: number };
  output?: { width: number; height: number };
  source?: 'photo' | 'frame';
  geometry?: 'viewport' | 'legacy';
}

export function recordLocalCaptureAudit(event: CaptureAuditEvent): void {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
  // Diagnostics must never block a capture, including when storage is unavailable.
  try {
    if (window.sessionStorage.getItem(CAPTURE_AUDIT_ENABLED_KEY) !== '1') return;
    const previous: unknown = JSON.parse(window.sessionStorage.getItem(CAPTURE_AUDIT_KEY) || '[]');
    const events = Array.isArray(previous) ? previous.slice(-(MAX_EVENTS - 1)) : [];
    events.push({ ...event, schemaVersion: 1, timestamp: new Date().toISOString() });
    window.sessionStorage.setItem(CAPTURE_AUDIT_KEY, JSON.stringify(events));
  } catch { /* local storage is optional */ }
}
