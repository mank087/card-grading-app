/**
 * Unit Tests for Professional Grade Mapper
 * ==========================================
 *
 * Comprehensive tests for deterministic grade estimation.
 * Run with: npm test professionalGradeMapper.test.ts
 */

import { estimateProfessionalGrades, formatAsPhase3Output } from './professionalGradeMapper';
import type { DcmGradingInput, ProfessionalGradeEstimates } from './professionalGradeMapper';

describe('Professional Grade Mapper', () => {
  // =============================================================================
  // Perfect Card Tests (DCM 10.0)
  // =============================================================================

  describe('Perfect Card (DCM 10.0)', () => {
    const perfectCard: DcmGradingInput = {
      final_grade: 10.0,
      centering: {
        front_lr: [50, 50],
        front_tb: [50, 50],
      },
      has_structural_damage: false,
      has_handwriting: false,
    };

    test('should assign highest grades to perfect card', () => {
      const result = estimateProfessionalGrades(perfectCard);

      expect(result.PSA.numeric_score).toBe(10);
      expect(result.PSA.estimated_grade).toContain('10');

      expect(result.BGS.numeric_score).toBe(10);
      expect(result.BGS.estimated_grade).toContain('Pristine');

      expect(result.SGC.numeric_score).toBe(10);
      expect(result.SGC.estimated_grade).toContain('PRI');

      expect(result.CGC.numeric_score).toBe(10);
      expect(result.CGC.estimated_grade).toContain('10');
    });

    test('should have high confidence for perfect card', () => {
      const result = estimateProfessionalGrades(perfectCard);

      expect(result.PSA.confidence).toBe('high');
      expect(result.BGS.confidence).toBe('high');
      expect(result.SGC.confidence).toBe('high');
      expect(result.CGC.confidence).toBe('high');
    });

    test('should include disclaimer in notes', () => {
      const result = estimateProfessionalGrades(perfectCard);

      expect(result.PSA.notes).toContain('AI-generated estimate');
      expect(result.BGS.notes).toContain('may vary');
      expect(result.SGC.notes).toContain('AI-generated estimate');
      expect(result.CGC.notes).toContain('may vary');
    });
  });

  // =============================================================================
  // Gem Mint Tests (DCM 9.5)
  // =============================================================================

  describe('Gem Mint Card (DCM 9.5)', () => {
    const gemMintCard: DcmGradingInput = {
      final_grade: 9.5,
      centering: {
        front_lr: [52, 48],
        front_tb: [53, 47],
      },
      has_structural_damage: false,
      has_handwriting: false,
    };

    test('should map to appropriate grades', () => {
      const result = estimateProfessionalGrades(gemMintCard);

      expect(result.PSA.numeric_score).toBe(10);
      expect(result.BGS.numeric_score).toBe(10);
      expect(result.SGC.numeric_score).toBe(10);
      expect(result.CGC.numeric_score).toBeGreaterThanOrEqual(9.8);
    });

    test('should accept microscopic defects for PSA 10', () => {
      const result = estimateProfessionalGrades(gemMintCard);

      expect(result.PSA.notes).toContain('Microscopic defects acceptable');
    });
  });

  // =============================================================================
  // Mint Tests (DCM 9.0)
  // =============================================================================

  describe('Mint Card (DCM 9.0)', () => {
    const mintCard: DcmGradingInput = {
      final_grade: 9.0,
      centering: {
        front_lr: [54, 46],
        front_tb: [56, 44],
      },
      has_structural_damage: false,
      has_handwriting: false,
    };

    test('should map to grade 9 range', () => {
      const result = estimateProfessionalGrades(mintCard);

      expect(result.PSA.numeric_score).toBe(9);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(9);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(9);
      expect(result.CGC.numeric_score).toBe(9.0);
    });

    test('should note minor flaws allowed', () => {
      const result = estimateProfessionalGrades(mintCard);

      expect(result.PSA.notes).toContain('minor flaw');
    });
  });

  // =============================================================================
  // Centering Tests
  // =============================================================================

  describe('Centering Impact', () => {
    test('poor centering should drop PSA grade', () => {
      const poorCentering: DcmGradingInput = {
        final_grade: 9.5,
        centering: {
          front_lr: [70, 30],  // Poor centering
          front_tb: [52, 48],
        },
      };

      const result = estimateProfessionalGrades(poorCentering);

      expect(result.PSA.numeric_score).toBeLessThan(10);
      expect(result.PSA.confidence).toBe('medium');
      expect(result.PSA.notes).toContain('centering');
    });

    test('CGC should be most lenient on centering', () => {
      const moderateCentering: DcmGradingInput = {
        final_grade: 10.0,
        centering: {
          front_lr: [58, 42],  // 58/42 centering
          front_tb: [60, 40],
        },
      };

      const result = estimateProfessionalGrades(moderateCentering);

      // CGC accepts 60/40 for grade 10
      expect(result.CGC.numeric_score).toBe(10);

      // Others should drop grade
      expect(result.PSA.numeric_score).toBeLessThan(10);
      expect(result.BGS.numeric_score).toBeLessThan(10);
      expect(result.SGC.numeric_score).toBeLessThan(10);
    });

    test('perfect centering should maintain high grades', () => {
      const perfectCentering: DcmGradingInput = {
        final_grade: 9.5,
        centering: {
          front_lr: [50, 50],
          front_tb: [50, 50],
        },
      };

      const result = estimateProfessionalGrades(perfectCentering);

      expect(result.PSA.numeric_score).toBe(10);
      expect(result.BGS.numeric_score).toBe(10);
      expect(result.SGC.numeric_score).toBe(10);
      expect(result.CGC.numeric_score).toBe(10);
    });
  });

  // =============================================================================
  // Structural Damage Tests
  // =============================================================================

  describe('Structural Damage', () => {
    test('crease should cap grades appropriately', () => {
      const creasedCard: DcmGradingInput = {
        final_grade: 4.0,
        has_structural_damage: true,
        crease_detected: true,
      };

      const result = estimateProfessionalGrades(creasedCard);

      expect(result.PSA.numeric_score).toBeLessThanOrEqual(4);
      expect(result.BGS.numeric_score).toBeLessThanOrEqual(4.5);
      expect(result.SGC.numeric_score).toBeLessThanOrEqual(5); // SGC allows one slight crease at 5
      expect(result.CGC.numeric_score).toBeLessThanOrEqual(4);
    });

    test('SGC should cap at 5 EX for any crease', () => {
      const slightCrease: DcmGradingInput = {
        final_grade: 8.0,
        crease_detected: true,
      };

      const result = estimateProfessionalGrades(slightCrease);

      expect(result.SGC.numeric_score).toBe(5);
      expect(result.SGC.notes).toContain('Capped at 5 EX');
    });

    test('bent corner should trigger structural damage cap', () => {
      const bentCorner: DcmGradingInput = {
        final_grade: 4.0,
        has_structural_damage: true,
        bent_corner_detected: true,
      };

      const result = estimateProfessionalGrades(bentCorner);

      expect(result.PSA.numeric_score).toBeLessThanOrEqual(4);
      expect(result.BGS.numeric_score).toBeLessThanOrEqual(4.5);
      expect(result.SGC.numeric_score).toBeLessThanOrEqual(5);
      expect(result.CGC.numeric_score).toBeLessThanOrEqual(4);
    });
  });

  // =============================================================================
  // Handwriting / Alterations Tests
  // =============================================================================

  describe('Handwriting and Alterations', () => {
    test('PSA should assign AA (Authentic Altered)', () => {
      const handwritten: DcmGradingInput = {
        final_grade: 9.0,
        has_handwriting: true,
      };

      const result = estimateProfessionalGrades(handwritten);

      expect(result.PSA.estimated_grade).toBe('AA Authentic Altered');
      expect(result.PSA.numeric_score).toBe(0);
      expect(result.PSA.confidence).toBe('high');
    });

    test('BGS should assign grade 1 for handwriting', () => {
      const handwritten: DcmGradingInput = {
        final_grade: 9.0,
        has_handwriting: true,
      };

      const result = estimateProfessionalGrades(handwritten);

      expect(result.BGS.numeric_score).toBe(1);
      expect(result.BGS.estimated_grade).toContain('Poor');
    });

    test('SGC should assign grade 1 POOR for handwriting', () => {
      const handwritten: DcmGradingInput = {
        final_grade: 9.0,
        has_handwriting: true,
      };

      const result = estimateProfessionalGrades(handwritten);

      expect(result.SGC.numeric_score).toBe(1);
      expect(result.SGC.estimated_grade).toContain('POOR');
    });

    test('CGC should be most lenient with grade 2.0', () => {
      const handwritten: DcmGradingInput = {
        final_grade: 9.0,
        has_handwriting: true,
      };

      const result = estimateProfessionalGrades(handwritten);

      expect(result.CGC.numeric_score).toBe(2.0);
      expect(result.CGC.estimated_grade).toContain('2.0');
      expect(result.CGC.notes).toContain('most lenient');
    });

    test('alterations should be treated same as handwriting', () => {
      const altered: DcmGradingInput = {
        final_grade: 8.5,
        has_alterations: true,
      };

      const result = estimateProfessionalGrades(altered);

      expect(result.PSA.estimated_grade).toContain('Altered');
      expect(result.BGS.numeric_score).toBe(1);
      expect(result.SGC.numeric_score).toBe(1);
      expect(result.CGC.numeric_score).toBe(2.0);
    });
  });

  // =============================================================================
  // Lower Grade Tests
  // =============================================================================

  describe('Lower Grades (5.0-7.0)', () => {
    test('DCM 7.0 should map to Near Mint range', () => {
      const nearMint: DcmGradingInput = {
        final_grade: 7.0,
        centering: {
          front_lr: [66, 34],
          front_tb: [68, 32],
        },
      };

      const result = estimateProfessionalGrades(nearMint);

      expect(result.PSA.numeric_score).toBe(7);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(7);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(7);
      expect(result.CGC.numeric_score).toBe(7.0);
    });

    test('DCM 5.0 should map to Excellent range', () => {
      const excellent: DcmGradingInput = {
        final_grade: 5.0,
        centering: {
          front_lr: [78, 22],
          front_tb: [75, 25],
        },
      };

      const result = estimateProfessionalGrades(excellent);

      expect(result.PSA.numeric_score).toBe(5);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(5);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(5);
      expect(result.CGC.numeric_score).toBe(5.0);
    });
  });

  // =============================================================================
  // Very Poor Grade Tests (1.0-3.0)
  // =============================================================================

  describe('Very Poor Grades', () => {
    test('DCM 1.0 should map to Poor across all companies', () => {
      const poorCard: DcmGradingInput = {
        final_grade: 1.0,
      };

      const result = estimateProfessionalGrades(poorCard);

      expect(result.PSA.numeric_score).toBe(1);
      expect(result.BGS.numeric_score).toBe(1);
      expect(result.SGC.numeric_score).toBe(1);
      expect(result.CGC.numeric_score).toBeLessThanOrEqual(1.0);
    });

    test('DCM 2.0 should map to Good range', () => {
      const goodCard: DcmGradingInput = {
        final_grade: 2.0,
      };

      const result = estimateProfessionalGrades(goodCard);

      expect(result.PSA.numeric_score).toBe(2);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(2);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(2);
      expect(result.CGC.numeric_score).toBeGreaterThanOrEqual(2.0);
    });
  });

  // =============================================================================
  // Output Format Tests
  // =============================================================================

  describe('Output Formatting', () => {
    test('formatAsPhase3Output should match Phase 3 schema', () => {
      const estimates = estimateProfessionalGrades({
        final_grade: 9.0,
        centering: {
          front_lr: [52, 48],
          front_tb: [54, 46],
        },
      });

      const formatted = formatAsPhase3Output(estimates);

      expect(formatted).toHaveProperty('estimated_professional_grades');
      expect(formatted.estimated_professional_grades).toHaveProperty('PSA');
      expect(formatted.estimated_professional_grades).toHaveProperty('BGS');
      expect(formatted.estimated_professional_grades).toHaveProperty('SGC');
      expect(formatted.estimated_professional_grades).toHaveProperty('CGC');

      expect(formatted.estimated_professional_grades.PSA).toHaveProperty('estimated_grade');
      expect(formatted.estimated_professional_grades.PSA).toHaveProperty('numeric_score');
      expect(formatted.estimated_professional_grades.PSA).toHaveProperty('confidence');
      expect(formatted.estimated_professional_grades.PSA).toHaveProperty('notes');
    });
  });

  // =============================================================================
  // Edge Case Tests
  // =============================================================================

  describe('Edge Cases', () => {
    test('should handle missing centering data gracefully', () => {
      const noCentering: DcmGradingInput = {
        final_grade: 9.0,
        // No centering data
      };

      const result = estimateProfessionalGrades(noCentering);

      expect(result.PSA.numeric_score).toBe(9);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(9);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(9);
      expect(result.CGC.numeric_score).toBe(9.0);
    });

    test('should handle non-standard DCM grades', () => {
      const oddGrade: DcmGradingInput = {
        final_grade: 8.7,  // Not a standard 0.5 increment
      };

      const result = estimateProfessionalGrades(oddGrade);

      // Should find closest mapping
      expect(result.PSA.numeric_score).toBeGreaterThanOrEqual(8);
      expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(8);
      expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(8);
      expect(result.CGC.numeric_score).toBeGreaterThanOrEqual(8);
    });

    test('should handle extreme centering (90/10)', () => {
      const extremeCentering: DcmGradingInput = {
        final_grade: 8.0,
        centering: {
          front_lr: [90, 10],
          front_tb: [52, 48],
        },
      };

      const result = estimateProfessionalGrades(extremeCentering);

      // All companies should drop grade significantly
      expect(result.PSA.numeric_score).toBeLessThan(8);
      expect(result.BGS.numeric_score).toBeLessThan(8);
      expect(result.SGC.numeric_score).toBeLessThan(8);
      expect(result.CGC.numeric_score).toBeLessThan(8);
    });

    test('should handle back centering when provided', () => {
      const backCentering: DcmGradingInput = {
        final_grade: 9.0,
        centering: {
          front_lr: [52, 48],
          front_tb: [54, 46],
          back_lr: [70, 30],   // Poor back centering
          back_tb: [55, 45],
        },
      };

      const result = estimateProfessionalGrades(backCentering);

      // Front centering is good, back is poor
      // Most companies weight front more heavily, but back matters too
      expect(result).toBeDefined();
      expect(result.PSA.confidence).toBeDefined();
    });
  });

  // =============================================================================
  // Confidence Level Tests
  // =============================================================================

  describe('Confidence Levels', () => {
    test('should report high confidence for clear cases', () => {
      const clear: DcmGradingInput = {
        final_grade: 9.0,
        centering: {
          front_lr: [52, 48],
          front_tb: [54, 46],
        },
        has_structural_damage: false,
        has_handwriting: false,
      };

      const result = estimateProfessionalGrades(clear);

      expect(result.PSA.confidence).toBe('high');
      expect(result.BGS.confidence).toBe('high');
      expect(result.SGC.confidence).toBe('high');
      expect(result.CGC.confidence).toBe('high');
    });

    test('should report medium confidence for borderline cases', () => {
      const borderline: DcmGradingInput = {
        final_grade: 9.3,  // Between grades
        centering: {
          front_lr: [64, 36],  // Borderline centering
          front_tb: [52, 48],
        },
      };

      const result = estimateProfessionalGrades(borderline);

      // At least some companies should be medium confidence
      const confidences = [
        result.PSA.confidence,
        result.BGS.confidence,
        result.SGC.confidence,
        result.CGC.confidence
      ];

      expect(confidences).toContain('medium');
    });
  });
});

// =============================================================================
// Integration Test Examples
// =============================================================================

describe('Integration Examples', () => {
  test('Example 1: Perfect modern card pull', () => {
    const modernPull: DcmGradingInput = {
      final_grade: 9.8,
      centering: {
        front_lr: [51, 49],
        front_tb: [52, 48],
      },
      corners_score: 10.0,
      edges_score: 9.5,
      surface_score: 10.0,
      has_structural_damage: false,
      has_handwriting: false,
    };

    const result = estimateProfessionalGrades(modernPull);

    // Should get high grades across all companies
    expect(result.PSA.numeric_score).toBeGreaterThanOrEqual(9);
    expect(result.BGS.numeric_score).toBeGreaterThanOrEqual(9.5);
    expect(result.SGC.numeric_score).toBeGreaterThanOrEqual(9.5);
    expect(result.CGC.numeric_score).toBeGreaterThanOrEqual(9.6);
  });

  test('Example 2: Vintage card with slight wear', () => {
    const vintageWear: DcmGradingInput = {
      final_grade: 7.5,
      centering: {
        front_lr: [65, 35],
        front_tb: [68, 32],
      },
      corners_score: 7.0,
      edges_score: 7.5,
      surface_score: 8.0,
      has_structural_damage: false,
      has_handwriting: false,
    };

    const result = estimateProfessionalGrades(vintageWear);

    // Should get Near Mint range
    expect(result.PSA.numeric_score).toBeGreaterThanOrEqual(7);
    expect(result.PSA.numeric_score).toBeLessThanOrEqual(8);
  });

  test('Example 3: Signed card (autograph)', () => {
    const signed: DcmGradingInput = {
      final_grade: 8.5,
      has_handwriting: true,  // Autograph is handwriting
    };

    const result = estimateProfessionalGrades(signed);

    // PSA: AA, BGS/SGC: 1, CGC: 2.0
    expect(result.PSA.estimated_grade).toContain('Altered');
    expect(result.BGS.numeric_score).toBe(1);
    expect(result.SGC.numeric_score).toBe(1);
    expect(result.CGC.numeric_score).toBe(2.0);
  });
});
