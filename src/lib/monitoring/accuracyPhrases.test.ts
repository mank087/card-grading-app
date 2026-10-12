/**
 * Couples scripts/accuracy-monitor.ts to the engine's wording. Each case runs the
 * REAL engine function that writes a customer sentence and checks the monitor's
 * phrase list still recognises it. If one of these fails, the engine was reworded:
 * update src/lib/monitoring/accuracyPhrases.ts (and expect a discontinuity in the
 * report for grades written before and after the rewording).
 */
import { describe, it, expect } from 'vitest';
import { explainUncertaintyHold } from '@/lib/grading/evidenceHold';
import { describeDissent, finishHoldReason } from '@/lib/grading/holdNarration';
import { structuralV2Note, structuralUnsureCap } from '@/lib/grading/structuralV2';
import { buildFinalSummary } from '@/lib/gradeNarrator';
import {
  holdBucket, isGemMintHold, isStructuralCap, STRUCTURAL_UNSURE_PHRASE, type HoldBucket,
} from './accuracyPhrases';

/** The sentence shape visionGrader.ts wraps every hold reason in. */
const holdNote = (reason: string) => `The card presents at Gem Mint level, but ${reason} - the grade is held at 9.`;

const base = { letter: 'B', zoomComplete: true, clippedCorners: [] as string[], caseType: 'none', structuralUncertainty: 0, passSpread: 0 };

describe('accuracy monitor phrases match the engine', () => {
  const cases: Array<[string, Parameters<typeof explainUncertaintyHold>[0], HoldBucket]> = [
    ['clipped corner', { ...base, clippedCorners: ['front top-left'] }, 'clipped_corner'],
    ['possible crease', { ...base, structuralUncertainty: 2 }, 'possible_crease'],
    ['evaluations disagree', { ...base, passSpread: 2 }, 'evaluations_disagree'],
    ['holder', { ...base, caseType: 'top_loader' }, 'holder'],
    ['photos not clear', { ...base }, 'photos_not_clear'],
  ];
  for (const [name, input, bucket] of cases) {
    it(`explainUncertaintyHold: ${name}`, () => {
      expect(holdBucket(holdNote(explainUncertaintyHold(input).reason))).toBe(bucket);
    });
  }

  it('reflective-finish hold reads as photos not clear', () => {
    expect(holdBucket(holdNote(finishHoldReason('chrome')))).toBe('photos_not_clear');
  });

  it('named dissent reads as evaluation dissent', () => {
    const ten = { final: 10, centering: 10, corners: 10, edges: 10, surface: 10 };
    const low = { final: 9, centering: 10, corners: 9, edges: 10, surface: 10, defects_noted: ['corners: front top-left minor softening'] };
    const reason = describeDissent([ten, ten, low] as any);
    expect(reason).toBeTruthy();
    expect(holdBucket(holdNote(reason as string))).toBe('evaluation_dissent');
  });

  it('dissent with no category lower still reads as dissent', () => {
    const ten = { final: 10, centering: 10, corners: 10, edges: 10, surface: 10 };
    const low = { final: 9, centering: 10, corners: 10, edges: 10, surface: 10 };
    expect(holdBucket(holdNote(describeDissent([ten, ten, low] as any) as string))).toBe('evaluation_dissent');
  });

  it('structural v2 unsure note carries the monitored phrase', () => {
    expect(structuralV2Note('uncertain', structuralUnsureCap({}))).toContain(STRUCTURAL_UNSURE_PHRASE);
    expect(structuralV2Note('refuted', 6)).not.toContain(STRUCTURAL_UNSURE_PHRASE);
  });

  it('structural cap summary opener is recognised', () => {
    const summary = buildFinalSummary({
      finalGrade: 4, conditionLabel: 'Very Good - Excellent', uncertainty: '±0',
      subgrades: { centering: 9, corners: 9, edges: 9, surface: 4 },
      structuralDetected: true,
      structuralFindings: [{ type: 'crease', location: 'front center' }],
      zoomAdjustments: [], gradeCapNote: null, jsonData: {},
    });
    expect(isStructuralCap(summary)).toBe(true);
  });

  it('a Gem Mint hold note survives buildFinalSummary', () => {
    const note = holdNote(explainUncertaintyHold({ ...base, passSpread: 2 }).reason);
    const summary = buildFinalSummary({
      finalGrade: 9, conditionLabel: 'Mint', uncertainty: '±0',
      subgrades: { centering: 10, corners: 10, edges: 10, surface: 9 },
      structuralDetected: false, structuralFindings: [], zoomAdjustments: [], gradeCapNote: note, jsonData: {},
    });
    expect(isGemMintHold(summary)).toBe(true);
    expect(holdBucket(summary)).toBe('evaluations_disagree');
  });

  it('no hold, no bucket', () => {
    expect(holdBucket('Final grade: 9 (Mint).')).toBeNull();
  });
});
