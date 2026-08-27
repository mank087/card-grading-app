/**
 * Capture-quality persistence.
 *
 * Every grade already measures how much of the frame the card occupies and
 * where its corners are — see zoomInspection.detectCardGeometry. Until now
 * that answer was written to a console.log and discarded, so nothing could
 * report how often a card was photographed too far away to inspect, which is
 * the top customer complaint. This writes it to cards.capture_quality.
 *
 * ── Why this one is AWAITED, unlike recordCvCentering/recordGradingModel ────
 * Those are fire-and-forget on purpose: tracking must never fail or slow a
 * grade. This is not tracking — it is the dataset every threshold in the
 * capture gate gets calibrated against, and a dropped row is invisible
 * (indistinguishable from a card that was never measured).
 *
 * Fire-and-forget on a serverless runtime can lose the write when the
 * invocation ends, and it would lose it NON-RANDOMLY: the grades most likely
 * to be cut short are the slow, degraded, poor-quality ones — exactly the
 * submissions the gate exists to study. The shadow data would then look
 * systematically better than reality, and thresholds tuned on it would
 * under-reject. So this awaits, and callers await it.
 *
 * It still never throws. A failed write must not fail a grade the customer
 * has already paid for.
 */

import type { ZoomResult } from '../zoomInspection';

/** Bump when the measurement's meaning changes, so thresholds stay attributable. */
export const CAPTURE_QUALITY_VERSION = 'cq-1';

export interface CaptureQualityRecord {
  measured_at: string;
  gate_version: string;
  /**
   * The model that produced the geometry reading. Recorded separately from
   * cards.grading_model because the gate's model is what moves rejection
   * rates — see the note in the capture-gate scope about pinning it
   * independently rather than inheriting whatever is grading.
   */
  gate_model: string | null;
  front: { fill_percent: number | null; quad: Array<{ x: number; y: number }> | null };
  back: { fill_percent: number | null; quad: Array<{ x: number; y: number }> | null };
  /** full | card_relative | abandoned — the headline metric for the gate. */
  zoom_outcome: 'full' | 'card_relative' | 'abandoned';
  /** Present when the zoom pass was skipped or failed, verbatim. */
  zoom_error?: string;
}

/** Build the record from a zoom result. Returns null when nothing was measured. */
export function buildCaptureQualityRecord(zoom: ZoomResult | null): CaptureQualityRecord | null {
  if (!zoom?.capture) return null;
  const c = zoom.capture;
  return {
    measured_at: new Date().toISOString(),
    gate_version: CAPTURE_QUALITY_VERSION,
    gate_model: c.gateModel,
    front: { fill_percent: c.frontFill, quad: c.frontQuad },
    back: { fill_percent: c.backFill, quad: c.backQuad },
    zoom_outcome: c.outcome,
    ...(zoom.error ? { zoom_error: String(zoom.error).slice(0, 300) } : {}),
  };
}

/**
 * Persist the record. Awaited by design (see the header note); never throws.
 * Returns whether the row was actually written, so a caller can log the miss.
 */
export async function recordCaptureQuality(
  cardId: string | null | undefined,
  record: CaptureQualityRecord | null
): Promise<boolean> {
  if (!cardId || !record || !/^[0-9a-f-]{36}$/i.test(cardId)) return false;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return false;
    const { createClient } = await import('@supabase/supabase-js');
    const { error } = await createClient(url, key)
      .from('cards')
      .update({ capture_quality: record })
      .eq('id', cardId);
    if (error) {
      // 42703 = column does not exist. Expected until the migration is applied,
      // which is what makes this safe to deploy first.
      if ((error as any).code !== '42703') {
        console.warn('[captureQualityLog] could not record capture_quality:', error.message);
      }
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[captureQualityLog] unexpected failure:', e?.message || e);
    return false;
  }
}
