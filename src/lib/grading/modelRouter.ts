/**
 * Grading model router — canary rollout with a kill switch.
 *
 * Every grading completion used to hardcode 'gpt-5.1' at 11 separate call
 * sites. That made a model change impossible to do safely: you either edited
 * all eleven and hoped, or you got a half-migrated pipeline where the ensemble
 * ran on one model and the zoom passes on another, and no way to tell which
 * result came from what. This is the single place that decision now lives.
 *
 * ── Routing ────────────────────────────────────────────────────────────────
 * Deterministic on a per-card routing key, NOT random. The same card always
 * resolves to the same model, so every call in one grade (ensemble, zoom
 * batch, geometry gate, structural verify) stays on one model. A card graded
 * half on luna and half on gpt-5.1 would be uninterpretable, and worse, would
 * silently corrupt the A/B it exists to measure.
 *
 * ── Env ────────────────────────────────────────────────────────────────────
 *   GRADING_CANARY_PERCENT  0-100, default 0 (everything on baseline)
 *   GRADING_CANARY_MODEL    default 'gpt-5.6-luna'
 *   GRADING_BASELINE_MODEL  default 'gpt-5.1'
 *   GRADING_CANARY_KILL     '1' forces 100% baseline, ignoring percent.
 *
 * The kill switch is a separate variable rather than "set percent to 0" on
 * purpose: flipping one flag to '1' in Vercel is a smaller, less error-prone
 * action at 2am than editing a number, and it leaves the configured percentage
 * intact so you can see what you rolled back FROM.
 *
 * ── Model compatibility ────────────────────────────────────────────────────
 * gpt-5.6-luna REJECTS `temperature` and `top_p` (measured Aug 1 2026 — the
 * API 400s rather than ignoring them). Our ensemble deliberately sets
 * temperature 0.3 / top_p 0.9 for inter-completion diversity, so those params
 * MUST be stripped for luna or every grading call fails. `n` and `seed`
 * survive. applyModelCompat() is the only correct way to build a request body.
 */

export const BASELINE_MODEL = process.env.GRADING_BASELINE_MODEL || 'gpt-5.1';
export const CANARY_MODEL = process.env.GRADING_CANARY_MODEL || 'gpt-5.6-luna';

/** Models that reject sampling params and need reasoning-effort control. */
const REASONING_MODELS = new Set(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol']);

function canaryPercent(): number {
  if (process.env.GRADING_CANARY_KILL === '1') return 0;
  const raw = Number(process.env.GRADING_CANARY_PERCENT);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.floor(raw)));
}

/** FNV-1a. Cheap, stable across processes and deploys — Math.random() is not. */
function hashToBucket(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export interface ModelDecision {
  model: string;
  isCanary: boolean;
  /** 0-99, or null when no routing key was supplied. */
  bucket: number | null;
  percent: number;
  killed: boolean;
}

/**
 * Resolve which model grades this card.
 *
 * `routingKey` should be stable per card — the card id, or the front image
 * path before a card row exists. Without one we deliberately fall back to
 * BASELINE rather than routing randomly: an un-attributable canary grade is
 * worse than no canary grade, because it pollutes the comparison without
 * being identifiable afterwards.
 */
export function resolveGradingModel(routingKey?: string | null): ModelDecision {
  const percent = canaryPercent();
  const killed = process.env.GRADING_CANARY_KILL === '1';

  if (!routingKey || percent === 0) {
    return { model: BASELINE_MODEL, isCanary: false, bucket: null, percent, killed };
  }
  const bucket = hashToBucket(routingKey);
  const isCanary = bucket < percent;
  return { model: isCanary ? CANARY_MODEL : BASELINE_MODEL, isCanary, bucket, percent, killed };
}

/**
 * Adapt an OpenAI request body to the target model.
 *
 * Returns a NEW object; never mutates the caller's config. Also reports what
 * it removed so the usage log records the fact — a silently-stripped
 * temperature is exactly the kind of thing that makes an A/B unexplainable
 * six weeks later.
 */
export function applyModelCompat<T extends Record<string, any>>(
  config: T,
  model: string
): { config: T; stripped: string[]; reasoningEffort?: string } {
  if (!REASONING_MODELS.has(model)) return { config, stripped: [] };

  const next: Record<string, any> = { ...config, model };
  const stripped: string[] = [];
  for (const p of ['temperature', 'top_p']) {
    if (p in next) { delete next[p]; stripped.push(p); }
  }

  // Luna defaults to HIGH reasoning. Measured Aug 1: 56% of its output tokens
  // were reasoning, and reasoning bills as output — which is 69% of our spend.
  // Overridable so the effort level can itself be tuned without a code change.
  const effort = process.env.GRADING_CANARY_REASONING_EFFORT || 'low';
  if (effort !== 'default') next.reasoning_effort = effort;

  // Aug 17: production evicts the low-traffic model's cache entries within
  // minutes (0% hit across ALL luna ops at 40% share, while identical probes
  // hit at +5min off-peak — load-dependent eviction on OpenAI's side).
  // Extended retention persists the entry 24h. Writes bill at 1.25x input
  // (~$0.02 for the whole rubric on luna); reads then actually hit.
  // 'off' disables without a code change.
  const retention = process.env.GRADING_CANARY_CACHE_RETENTION || '24h';
  if (retention !== 'off') next.prompt_cache_retention = retention;

  return { config: next as T, stripped, reasoningEffort: effort };
}

/** One-line summary for logs. */
export function describeDecision(d: ModelDecision): string {
  return `${d.model}${d.isCanary ? ' [CANARY]' : ''} (bucket=${d.bucket ?? 'n/a'}, percent=${d.percent}${d.killed ? ', KILLED' : ''})`;
}

/**
 * Stamp cards.grading_model so a finished grade can be attributed to the model
 * that produced it.
 *
 * Fire-and-forget, exactly like logOpenAIUsage: tracking must never fail or
 * slow a grade. Swallows the missing-column case too, so the code is safe to
 * deploy before the migration is applied — it simply records nothing until the
 * column exists.
 */
export function recordGradingModel(cardId: string | null | undefined, model: string): void {
  if (!cardId || !/^[0-9a-f-]{36}$/i.test(cardId)) return;
  void (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return;
      const { createClient } = await import('@supabase/supabase-js');
      const { error } = await createClient(url, key)
        .from('cards')
        .update({ grading_model: model })
        .eq('id', cardId);
      // 42703 = column does not exist (migration not applied yet). Expected,
      // not worth logging on every grade.
      if (error && (error as any).code !== '42703') {
        console.warn('[modelRouter] could not record grading_model:', error.message);
      }
    } catch {
      /* never surface */
    }
  })();
}
