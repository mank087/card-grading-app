import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildManifest } = require('../scripts/accuracy-phase0.cjs');

describe('offline Phase 0 baseline', () => {
  it('records actual router defaults, source hashes and frozen observations without unrelated environment values', () => {
    const manifest = buildManifest({ OPENAI_API_KEY: 'secret-sentinel', DATABASE_URL: 'private-sentinel' });
    expect(JSON.stringify(manifest)).not.toContain('secret-sentinel');
    expect(JSON.stringify(manifest)).not.toContain('private-sentinel');
    expect(manifest.localEffective.noRoutingKey.model).toBe('gpt-5.6-luna');
    expect(manifest.localEffective.baselineMainRequestTemplate.config).toMatchObject({ reasoning_effort: 'low', n: 3 });
    expect(manifest.localEffective.baselineMainRequestTemplate.config).not.toHaveProperty('temperature');
    expect(manifest.sourceHashes['src/lib/visionGrader.ts']).toMatch(/^[a-f0-9]{64}$/);
    // The fixture records known failures, not desired behavior. Do not silently regenerate it.
    expect(manifest.probes.matchesFrozenBaseline).toBe(true);
  });
  it('uses the router kill switch and compatibility settings from the supplied environment', () => {
    const manifest = buildManifest({ GRADING_CANARY_PERCENT: '100', GRADING_CANARY_KILL: '1',
      GRADING_CANARY_REASONING_EFFORT: 'medium', GRADING_IMAGE_DETAIL: 'original' });
    expect(manifest.localEffective.syntheticRoutingKey).toMatchObject({ isCanary: false, killed: true, percent: 0 });
    expect(manifest.localEffective.gradingImageDetail).toBe('original');
    expect(manifest.localEffective.baselineMainRequestTemplate.config.reasoning_effort).toBe('medium');
  });
});
