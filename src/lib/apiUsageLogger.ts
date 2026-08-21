/**
 * OpenAI usage logging → api_usage_log.
 *
 * The table has existed since the admin panel shipped but nothing ever wrote
 * to it, so the cost dashboard and scripts/audit-prompt-cache.ts had no data
 * (the Jul 2026 cost work had to pull numbers from OpenAI's admin API by
 * hand). Every grading-path completion call now records its real token usage
 * including the cached-input split, which is what makes cache-hit rate and
 * output-cost tuning measurable per call type.
 *
 * Fire-and-forget by design: logging must NEVER fail or slow a grade.
 */

import { createClient } from '@supabase/supabase-js';
import { BASELINE_MODEL } from './grading/modelRouter';

// Pricing per million tokens, per model. cacheWrite applies only to models
// with extended prompt-cache retention (gpt-5.6 bills writes at 1.25x input).
// Keep this table in sync with scripts/canary-report.ts when models change.
//
// Unknown models fall back to the rates of whatever BASELINE_MODEL currently
// is, rather than a hardcoded one. This used to pin to gpt-5.1 and overstated
// luna's cost ~4x whenever a model string fell through; tying it to the
// baseline means the fallback follows the engine instead of rotting behind it.
const MODEL_RATES: Record<string, { inputUncached: number; inputCached: number; output: number; cacheWrite?: number }> = {
  'gpt-5.1': { inputUncached: 1.25, inputCached: 0.125, output: 10.0 },
  'gpt-5.6-luna': { inputUncached: 0.20, inputCached: 0.02, output: 1.20, cacheWrite: 0.25 },
  'gpt-5.6-terra': { inputUncached: 2.00, inputCached: 0.20, output: 12.0, cacheWrite: 2.50 },
};
const DEFAULT_RATES = MODEL_RATES[BASELINE_MODEL] ?? MODEL_RATES['gpt-5.1'];

export interface OpenAIUsageEntry {
  /** e.g. 'grade_ensemble', 'zoom_batch', 'zoom_geometry_gate', 'zoom_structural_verify' */
  operation: string;
  model: string;
  /** response.usage from the OpenAI SDK (undefined on errors) */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  } | null;
  durationMs?: number;
  status?: 'success' | 'error';
  errorMessage?: string;
  cardId?: string | null;
  userId?: string | null;
  /** anything else worth keeping (n, attempt, batch index, …) */
  metadata?: Record<string, unknown>;
}

export function logOpenAIUsage(entry: OpenAIUsageEntry): void {
  // Intentionally not awaited by callers; all failures are swallowed.
  void (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return;
      const supabase = createClient(url, key);

      const prompt = entry.usage?.prompt_tokens ?? null;
      const completion = entry.usage?.completion_tokens ?? null;
      const cached = entry.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const cacheWrites = entry.usage?.prompt_tokens_details?.cache_write_tokens ?? 0;

      const rates = MODEL_RATES[entry.model] ?? DEFAULT_RATES;
      let costUsd: number | null = null;
      if (typeof prompt === 'number' && typeof completion === 'number') {
        // Cache-write tokens are prompt tokens billed at the write rate (models
        // without extended retention report 0, so this is a no-op for them).
        const uncached = Math.max(0, prompt - cached - cacheWrites);
        costUsd =
          (uncached / 1e6) * rates.inputUncached +
          (cached / 1e6) * rates.inputCached +
          (cacheWrites / 1e6) * (rates.cacheWrite ?? rates.inputUncached) +
          (completion / 1e6) * rates.output;
      }

      await supabase.from('api_usage_log').insert({
        service: 'openai',
        endpoint: entry.model,
        operation: entry.operation,
        user_id: entry.userId ?? null,
        card_id: entry.cardId ?? null,
        input_tokens: prompt,
        output_tokens: completion,
        total_tokens: entry.usage?.total_tokens ?? (prompt !== null && completion !== null ? prompt + completion : null),
        cost_usd: costUsd !== null ? Number(costUsd.toFixed(6)) : null,
        duration_ms: entry.durationMs ?? null,
        status: entry.status ?? 'success',
        error_message: entry.errorMessage ?? null,
        request_metadata: {
          cached_input_tokens: cached,
          cache_write_tokens: cacheWrites,
          ...(entry.metadata ?? {}),
        },
      });
    } catch (err) {
      // Never let usage logging affect the grading path.
      console.warn('[apiUsageLogger] failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  })();
}
