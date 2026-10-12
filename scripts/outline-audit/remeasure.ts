/**
 * Card-outline audit: run the PRODUCTION geometry gate (zoomInspection.detectCardGeometry)
 * on the manifest set and save the quads, for scoring against the hand-checked
 * reference (score.ts). No DB writes: the service key is removed before the gate
 * runs, so logOpenAIUsage is a no-op; each call's estimated cost is appended to SPEND.
 *
 *   MANIFEST=… OUT=quads.json SPEND=spend.jsonl npx tsx --env-file=../../.env.local scripts/outline-audit/remeasure.ts
 */
import fs from 'fs';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const RATES = { in: 0.20, cached: 0.02, out: 1.20 }; // gpt-5.6-luna $/M tokens

async function main() {
  // Meter at the fetch layer (the OpenAI SDK's prototype is not reliably the
  // instance zoomInspection uses under tsx); same approach as run-zoom-calibration.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const res = await realFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url;
    if (String(url).includes('api.openai.com')) {
      try {
        const body: any = await res.clone().json();
        const u = body?.usage || {};
        const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
        const cost = ((u.prompt_tokens - cached) / 1e6) * RATES.in + (cached / 1e6) * RATES.cached + (u.completion_tokens / 1e6) * RATES.out;
        fs.appendFileSync(process.env.SPEND!, JSON.stringify({ at: new Date().toISOString(), op: 'outline_remeasure_gate', model: body?.model, prompt: u.prompt_tokens, completion: u.completion_tokens, cost_usd: +cost.toFixed(6) }) + '\n');
      } catch { /* not JSON */ }
    }
    return res;
  }) as typeof fetch;
  const { detectCardGeometry } = await import('../../src/lib/zoomInspection');
  const man = JSON.parse(fs.readFileSync(process.env.MANIFEST!, 'utf8'));
  const out: Record<string, any> = fs.existsSync(process.env.OUT!) ? JSON.parse(fs.readFileSync(process.env.OUT!, 'utf8')) : {};
  const queue = man.filter((c: any) => c.faces.front && c.faces.back && !out[c.id]);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        const g = await detectCardGeometry(fs.readFileSync(c.faces.front.file), fs.readFileSync(c.faces.back.file));
        out[c.id] = g;
        console.log(c.id.slice(0, 8), 'fill', g.frontFill, g.backFill, 'shaped', g.frontCardShaped, g.backCardShaped);
      } catch (e: any) { console.warn(c.id.slice(0, 8), 'failed', e.message); }
    }
  }));
  fs.writeFileSync(process.env.OUT!, JSON.stringify(out, null, 1));
  const spent = fs.readFileSync(process.env.SPEND!, 'utf8').trim().split('\n').map(l => JSON.parse(l).cost_usd).reduce((a: number, b: number) => a + b, 0);
  console.log('total spend so far $' + spent.toFixed(4));
}
main().catch(e => { console.error(e); process.exit(1); });
