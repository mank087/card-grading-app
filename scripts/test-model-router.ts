/**
 * Unit tests for the grading model router. No network, no DB.
 *   npx tsx scripts/test-model-router.ts
 */
import { randomUUID } from 'crypto';

function reload() {
  delete require.cache[require.resolve('../src/lib/grading/modelRouter')];
  return require('../src/lib/grading/modelRouter');
}

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
};

// --- 0% means nothing is routed to the canary -------------------------------
process.env.GRADING_CANARY_PERCENT = '0';
delete process.env.GRADING_CANARY_KILL;
{
  const { resolveGradingModel, BASELINE_MODEL } = reload();
  const ids = Array.from({ length: 500 }, () => randomUUID());
  const canaries = ids.filter((i) => resolveGradingModel(i).isCanary).length;
  check('0% routes nothing to canary', canaries === 0, `got ${canaries}`);
  check('0% returns baseline', resolveGradingModel(ids[0]).model === BASELINE_MODEL);
}

// --- 10% lands near 10% over a large sample ---------------------------------
process.env.GRADING_CANARY_PERCENT = '10';
{
  const { resolveGradingModel } = reload();
  const ids = Array.from({ length: 20000 }, () => randomUUID());
  const c = ids.filter((i) => resolveGradingModel(i).isCanary).length;
  const pct = (c / ids.length) * 100;
  check('10% split within 9-11% over 20k ids', pct > 9 && pct < 11, `got ${pct.toFixed(2)}%`);
}

// --- determinism: same key always same answer -------------------------------
{
  const { resolveGradingModel } = reload();
  const id = randomUUID();
  const first = resolveGradingModel(id);
  const stable = Array.from({ length: 1000 }, () => resolveGradingModel(id));
  check('same key is deterministic', stable.every((s) => s.model === first.model && s.bucket === first.bucket));
}

// --- kill switch overrides percent ------------------------------------------
process.env.GRADING_CANARY_KILL = '1';
{
  const { resolveGradingModel, BASELINE_MODEL } = reload();
  const ids = Array.from({ length: 2000 }, () => randomUUID());
  const c = ids.filter((i) => resolveGradingModel(i).isCanary).length;
  check('kill switch forces 0 canary at 10%', c === 0, `got ${c}`);
  check('kill switch reports killed', resolveGradingModel(ids[0]).killed === true);
  check('kill switch returns baseline', resolveGradingModel(ids[0]).model === BASELINE_MODEL);
}
delete process.env.GRADING_CANARY_KILL;

// --- missing routing key falls back to baseline, never random ---------------
process.env.GRADING_CANARY_PERCENT = '100';
{
  const { resolveGradingModel, BASELINE_MODEL } = reload();
  check('no key -> baseline even at 100%', resolveGradingModel(undefined).model === BASELINE_MODEL);
  check('empty key -> baseline even at 100%', resolveGradingModel('').model === BASELINE_MODEL);
  check('100% with key -> canary', resolveGradingModel(randomUUID()).isCanary === true);
}

// --- percent is clamped, never throws ---------------------------------------
{
  for (const [v, expect] of [['-5', 0], ['999', 100], ['abc', 0], ['', 0]] as const) {
    process.env.GRADING_CANARY_PERCENT = v;
    const { resolveGradingModel } = reload();
    check(`percent "${v}" clamps to ${expect}`, resolveGradingModel(randomUUID()).percent === expect);
  }
}

// --- compat layer strips exactly what luna rejects --------------------------
process.env.GRADING_CANARY_PERCENT = '10';
{
  const { applyModelCompat } = reload();
  const body = { model: 'x', temperature: 0.3, top_p: 0.9, seed: 7, n: 3, max_completion_tokens: 16000 };

  const base = applyModelCompat(body, 'gpt-5.1');
  check('gpt-5.1 keeps temperature', base.config.temperature === 0.3);
  check('gpt-5.1 keeps top_p', base.config.top_p === 0.9);
  check('gpt-5.1 strips nothing', base.stripped.length === 0);

  const luna = applyModelCompat(body, 'gpt-5.6-luna');
  check('luna drops temperature', !('temperature' in luna.config));
  check('luna drops top_p', !('top_p' in luna.config));
  check('luna KEEPS n (ensemble intact)', luna.config.n === 3);
  check('luna KEEPS seed', luna.config.seed === 7);
  check('luna reports stripped params', luna.stripped.sort().join(',') === 'temperature,top_p');
  check('luna sets reasoning_effort low', luna.config.reasoning_effort === 'low');
  check('luna sets model', luna.config.model === 'gpt-5.6-luna');

  check('original body not mutated', body.temperature === 0.3 && body.top_p === 0.9);
}

// --- reasoning effort override ---------------------------------------------
{
  process.env.GRADING_CANARY_REASONING_EFFORT = 'medium';
  const { applyModelCompat } = reload();
  check('effort override honoured', applyModelCompat({ temperature: 1 }, 'gpt-5.6-luna').config.reasoning_effort === 'medium');
  process.env.GRADING_CANARY_REASONING_EFFORT = 'default';
  const m2 = reload();
  check('effort "default" omits the param', !('reasoning_effort' in m2.applyModelCompat({}, 'gpt-5.6-luna').config));
  delete process.env.GRADING_CANARY_REASONING_EFFORT;
}

// --- bucket stability across "processes" ------------------------------------
{
  const a = reload();
  const b = reload();
  const id = randomUUID();
  check('hash stable across module reloads', a.resolveGradingModel(id).bucket === b.resolveGradingModel(id).bucket);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
