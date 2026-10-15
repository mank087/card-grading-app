import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { buildManifest } = require('../scripts/accuracy-phase0.cjs');
// Prompt deltas deleted since the Sept 16 freeze (Oct 2026: the abandoned Star Wars category).
const RETIRED_PROMPT_FILES = ['starwars_delta_v5.txt'];

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
    const { mobileGuide: frozenGuide, webPortraitCrop: frozenWebCrop, promptSizes: frozenPromptSizes, ...frozenRest } = frozen;
    const { mobileGuide, webPortraitCrop, promptSizes, ...observedRest } = manifest.probes.observed;
    expect(observedRest).toEqual(frozenRest);
    // Third deliberate change (Oct 2026, v9.30): the Other delta gained its non-sport field
    // schema and the master rubric a one-line pointer to it. Every other prompt is unchanged.
    const v930 = new Map<string, any>([
      ['master_grading_rubric_v5.txt', { file: 'master_grading_rubric_v5.txt', characters: 287562, lines: 5616, approximateTokensCharsDiv4: 71891 }],
      ['other_delta_v5.txt', { file: 'other_delta_v5.txt', characters: 15751, lines: 328, approximateTokensCharsDiv4: 3938 }],
      // Fourth deliberate change (Oct 2026, v9.31): the Pokemon delta reports printed badges
      // (30th / 25th anniversary, Trick or Trade pumpkin).
      ['pokemon_delta_v5.txt', { file: 'pokemon_delta_v5.txt', characters: 33663, lines: 656, approximateTokensCharsDiv4: 8416 }],
    ]);
    // Fifth deliberate change (Oct 2026, v9.33): the master rubric gained the PRINTED DESIGN IS
    // NOT DAMAGE rule (+1,392 characters, +16 lines) and the Other delta one sticker peel-cut line
    // (+175 characters, +1 line). These replace the v9.30 sizes above for those two files.
    v930.set('master_grading_rubric_v5.txt', { file: 'master_grading_rubric_v5.txt', characters: 288954, lines: 5632, approximateTokensCharsDiv4: 72239 });
    v930.set('other_delta_v5.txt', { file: 'other_delta_v5.txt', characters: 15926, lines: 329, approximateTokensCharsDiv4: 3982 });
    // Sixth deliberate change (Oct 2026, v9.35): the Pokemon delta names the Ancient Mew movie
    // promo (no set number; pokemonSpecialPromos.ts) in a 3-line block (+386 characters, +4 lines).
    v930.set('pokemon_delta_v5.txt', { file: 'pokemon_delta_v5.txt', characters: 34049, lines: 660, approximateTokensCharsDiv4: 8513 });
    // Seventh deliberate change (Oct 2026): starwars_delta_v5.txt was deleted with the abandoned
    // Star Wars category (Star Wars is an Other sub-category). The frozen probe list drops it; the frozen baseline is filtered to match.
    // Eighth deliberate change (Oct 2026, v9.37): master rubric contradiction pass; the Pokemon
    // delta's textured-card example now scores its two minor flaws 8; a date removed from a Sports
    // delta anecdote. Every prompt's exact text is pinned by hash in src/lib/promptHash.test.ts.
    v930.set('master_grading_rubric_v5.txt', { file: 'master_grading_rubric_v5.txt', characters: 284943, lines: 5539, approximateTokensCharsDiv4: 71236 });
    v930.set('pokemon_delta_v5.txt', { file: 'pokemon_delta_v5.txt', characters: 34067, lines: 660, approximateTokensCharsDiv4: 8517 });
    v930.set('sports_delta_v5.txt', { file: 'sports_delta_v5.txt', characters: 41906, lines: 738, approximateTokensCharsDiv4: 10477 });
    // Twelfth deliberate change (Oct 2026, v9.42): category guards in the Pokemon, MTG, One Piece
    // and Yu-Gi-Oh deltas (back swirl arcs and Trainer header divider; old-frame cracked-stone
    // frame; nautical-chart back; security seal, whose two contradicting score lines were replaced).
    v930.set('pokemon_delta_v5.txt', { file: 'pokemon_delta_v5.txt', characters: 35886, lines: 683, approximateTokensCharsDiv4: 8972 });
    v930.set('mtg_delta_v5.txt', { file: 'mtg_delta_v5.txt', characters: 22907, lines: 490, approximateTokensCharsDiv4: 5727 });
    v930.set('onepiece_delta_v5.txt', { file: 'onepiece_delta_v5.txt', characters: 20300, lines: 489, approximateTokensCharsDiv4: 5075 });
    v930.set('yugioh_delta_v5.txt', { file: 'yugioh_delta_v5.txt', characters: 22663, lines: 471, approximateTokensCharsDiv4: 5666 });
    // Thirteenth deliberate change (Oct 2026, v9.43): corner silhouette judged by card type (90-degree
    // point on square-cut cards, even factory radius on die-cut TCG cards; the radius is not softening).
    v930.set('master_grading_rubric_v5.txt', { file: 'master_grading_rubric_v5.txt', characters: 285700, lines: 5547, approximateTokensCharsDiv4: 71425 });
    // Fourteenth deliberate change (Oct 2026, v9.44): the flatness check needs a physical sign of a crease
    // or bend (ridge, gloss change, cracked ink, edge kink, same line on the other face); lighting bands
    // and factory curl are not damage.
    v930.set('master_grading_rubric_v5.txt', { file: 'master_grading_rubric_v5.txt', characters: 285788, lines: 5548, approximateTokensCharsDiv4: 71447 });
    expect(promptSizes).toEqual(frozenPromptSizes
      .filter((p: any) => !RETIRED_PROMPT_FILES.includes(p.file))
      .map((p: any) => v930.get(p.file) ?? p));
    // Second deliberate change (Sept 2026): the web camera guide shrank from 98% to 78% of the
    // screen so cards stop being clipped at the shutter. The crop is the same shape,
    // scaled by 0.78/0.98.
    const ratio = 0.78 / 0.98;
    expect(Math.abs(webPortraitCrop.cropW - frozenWebCrop.cropW * ratio)).toBeLessThanOrEqual(2);
    expect(Math.abs(webPortraitCrop.cropH - frozenWebCrop.cropH * ratio)).toBeLessThanOrEqual(2);
    expect(Math.abs((webPortraitCrop.cropX + webPortraitCrop.cropW / 2) - (frozenWebCrop.cropX + frozenWebCrop.cropW / 2))).toBeLessThanOrEqual(2);
    // Oct 2026: bottom controls reserve another 40 CSS px for Phone Camera.
    // The guide center moves up 20 CSS px, mapped into this 2160px/844px probe.
    const verticalShift = -20 * 2160 / 844;
    expect(Math.abs((webPortraitCrop.cropY + webPortraitCrop.cropH / 2) - (frozenWebCrop.cropY + frozenWebCrop.cropH / 2) - verticalShift)).toBeLessThanOrEqual(2);
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
