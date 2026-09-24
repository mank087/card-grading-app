import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
    // One of those failures is now repaired: in a wide, short viewport (800x350) the capture
    // guide used to be clamped to 60% of the width and came out 672px tall in a 350px space.
    // The historical fixture stays as it was, so the repair is asserted exactly: EVERYTHING
    // else still matches it, and the guide now fits. A blanket "differs from the baseline"
    // would let any future regression through.
    const frozen = JSON.parse(readFileSync('docs/DCM_ACCURACY_AUDIT_PROBES_2026-09-16.json', 'utf8'));
    const { mobileGuide: frozenGuide, webPortraitCrop: frozenWebCrop, ...frozenRest } = frozen;
    const { mobileGuide, webPortraitCrop, ...observedRest } = manifest.probes.observed;
    expect(observedRest).toEqual(frozenRest);
    // Second deliberate change (Sept 2026): the web camera guide shrank from 98% to 78% of the
    // screen so cards stop being clipped at the shutter. The crop is the same shape and centre,
    // scaled by 0.78/0.98.
    const ratio = 0.78 / 0.98;
    expect(Math.abs(webPortraitCrop.cropW - frozenWebCrop.cropW * ratio)).toBeLessThanOrEqual(2);
    expect(Math.abs(webPortraitCrop.cropH - frozenWebCrop.cropH * ratio)).toBeLessThanOrEqual(2);
    expect(Math.abs((webPortraitCrop.cropX + webPortraitCrop.cropW / 2) - (frozenWebCrop.cropX + frozenWebCrop.cropW / 2))).toBeLessThanOrEqual(2);
    expect(Math.abs((webPortraitCrop.cropY + webPortraitCrop.cropH / 2) - (frozenWebCrop.cropY + frozenWebCrop.cropH / 2))).toBeLessThanOrEqual(2);
    expect(frozenGuide.some((g: any) => g.exceedsViewport)).toBe(true);
    expect(mobileGuide.every((g: any) => !g.exceedsViewport)).toBe(true);
    // The portrait phone case, which is what nearly every capture uses, is unchanged.
    expect(mobileGuide[0]).toEqual(frozenGuide[0]);
  });
  it('uses the router kill switch and compatibility settings from the supplied environment', () => {
    const manifest = buildManifest({ GRADING_CANARY_PERCENT: '100', GRADING_CANARY_KILL: '1',
      GRADING_CANARY_REASONING_EFFORT: 'medium', GRADING_IMAGE_DETAIL: 'original' });
    expect(manifest.localEffective.syntheticRoutingKey).toMatchObject({ isCanary: false, killed: true, percent: 0 });
    expect(manifest.localEffective.gradingImageDetail).toBe('original');
    expect(manifest.localEffective.baselineMainRequestTemplate.config.reasoning_effort).toBe('medium');
  });
});
