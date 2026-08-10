/**
 * CV centering shadow persistence.
 *
 * Every grade stores its deterministic centering measurement NEXT TO the
 * model's visual estimate in cards.cv_centering (jsonb) — the production
 * dataset that decides whether/where the measurement can be trusted. Until
 * v9.13 these readings only went to console logs and evaporated.
 *
 * Fire-and-forget, exactly like recordGradingModel: persistence must never
 * fail or slow a grade, and the missing-column case (migration not applied
 * yet) is swallowed so this is safe to deploy first.
 */

import type { CenteringMeasurement } from '../zoomInspection';

export interface CvCenteringRecord {
  measured_at: string;
  /** 'advisory' = measurement was shown to the grading ensemble; 'shadow' = logged only */
  mode: 'advisory' | 'shadow';
  grading_model: string;
  front: CenteringMeasurement | null;
  back: CenteringMeasurement | null;
  /** The ensemble's own visual estimate, for offline agreement analysis */
  model_front: { left_right: string | null; top_bottom: string | null } | null;
  model_back: { left_right: string | null; top_bottom: string | null } | null;
}

export function recordCvCentering(cardId: string | null | undefined, record: CvCenteringRecord): void {
  if (!cardId || !/^[0-9a-f-]{36}$/i.test(cardId)) return;
  void (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return;
      const { createClient } = await import('@supabase/supabase-js');
      const { error } = await createClient(url, key)
        .from('cards')
        .update({ cv_centering: record })
        .eq('id', cardId);
      // 42703 = column does not exist (migration not applied yet).
      if (error && (error as any).code !== '42703') {
        console.warn('[cvCenteringLog] could not record cv_centering:', error.message);
      }
    } catch {
      /* never surface */
    }
  })();
}
