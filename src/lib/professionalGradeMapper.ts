/**
 * Professional Grading Company Estimator (Deterministic)
 * ========================================================
 *
 * Zero-cost, instant translation of DCM grades to professional company estimates.
 * Based on Phase 3 instructions with complete mapping tables for PSA, BGS, SGC, and CGC.
 *
 * Performance:
 * - Speed: <1ms per card (vs 3-5 seconds with AI)
 * - Cost: $0 (vs $0.05-0.15 per card with AI)
 * - Consistency: Perfect (deterministic vs AI variance)
 *
 * @version 1.0.0
 * @date 2025-10-17
 */

// =============================================================================
// TypeScript Types and Interfaces
// =============================================================================

export interface CenteringRatio {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CenteringMeasurements {
  front_lr: [number, number];  // [left%, right%]
  front_tb: [number, number];  // [top%, bottom%]
  back_lr?: [number, number];
  back_tb?: [number, number];
}

export interface DcmGradingInput {
  final_grade: number;
  centering?: CenteringMeasurements;
  corners_score?: number;
  edges_score?: number;
  surface_score?: number;
  has_structural_damage?: boolean;
  has_handwriting?: boolean;
  has_alterations?: boolean;
  crease_detected?: boolean;
  bent_corner_detected?: boolean;
  // Autograph authentication - if true, handwriting is an authenticated autograph (not alteration)
  is_authenticated_autograph?: boolean;
}

export interface GradeEstimate {
  estimated_grade: string;
  numeric_score: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export interface ProfessionalGradeEstimates {
  PSA: GradeEstimate;
  BGS: GradeEstimate;
  SGC: GradeEstimate;
  CGC: GradeEstimate;
}

interface GradeMapping {
  grade: string;
  numeric: number;
  centeringReq?: string;
  notes: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse centering requirement string (e.g., "60/40") and check if actual centering meets it.
 */
function meetsCenteringRequirement(
  actual: CenteringMeasurements | undefined,
  requirement: string,
  side: 'front' | 'back' = 'front'
): boolean {
  if (!actual || !requirement) return true;

  const [reqMajor, reqMinor] = requirement.split('/').map(Number);

  const lr = side === 'front' ? actual.front_lr : (actual.back_lr || actual.front_lr);
  const tb = side === 'front' ? actual.front_tb : (actual.back_tb || actual.front_tb);

  // Check both axes - centering must be AT LEAST as good as requirement
  const lrWorst = Math.max(lr[0], lr[1]);
  const tbWorst = Math.max(tb[0], tb[1]);
  const actualWorst = Math.max(lrWorst, tbWorst);

  return actualWorst <= reqMajor;
}

/**
 * Find closest DCM grade in mapping table and interpolate if needed.
 */
function findClosestMapping(
  dcmGrade: number,
  mappingTable: Record<number, GradeMapping>
): GradeMapping {
  const grades = Object.keys(mappingTable).map(Number).sort((a, b) => b - a);

  // Exact match
  if (mappingTable[dcmGrade]) {
    return mappingTable[dcmGrade];
  }

  // Find the closest lower grade
  const lowerGrade = grades.find(g => g <= dcmGrade);
  if (lowerGrade !== undefined) {
    return mappingTable[lowerGrade];
  }

  // Fallback to lowest grade
  return mappingTable[grades[grades.length - 1]];
}

/**
 * Calculate centering from ratio (worst axis deviation from 50/50).
 */
function calculateCenteringDeviation(centering: CenteringMeasurements | undefined): number {
  if (!centering) return 0;

  const lrWorst = Math.max(centering.front_lr[0], centering.front_lr[1]);
  const tbWorst = Math.max(centering.front_tb[0], centering.front_tb[1]);

  return Math.max(lrWorst - 50, tbWorst - 50);
}

// =============================================================================
// PSA Grade Mapping and Logic
// =============================================================================

const PSA_MAPPING: Record<number, GradeMapping> = {
  10.0: {
    grade: '10 Gem Mint',
    numeric: 10,
    centeringReq: '55/45',
    notes: 'Virtually perfect card with four perfectly sharp corners, sharp focus, full original gloss, free of staining'
  },
  9.5: {
    grade: '10 Gem Mint',
    numeric: 10,
    centeringReq: '55/45',
    notes: 'Microscopic defects acceptable for PSA 10 with proper centering'
  },
  9.0: {
    grade: '9 Mint',
    numeric: 9,
    centeringReq: '60/40',
    notes: 'Superb condition with only one minor flaw allowed'
  },
  8.5: {
    grade: '8 NM-MT',
    numeric: 8,
    centeringReq: '65/35',
    notes: 'Near Mint-Mint with very slight fraying or minor imperfections'
  },
  8.0: {
    grade: '8 NM-MT',
    numeric: 8,
    centeringReq: '65/35',
    notes: 'Near Mint-Mint with slight wear visible upon close inspection'
  },
  7.5: {
    grade: '7 NM',
    numeric: 7,
    centeringReq: '70/30',
    notes: 'Near Mint with slight surface wear and minor corner fraying'
  },
  7.0: {
    grade: '7 NM',
    numeric: 7,
    centeringReq: '70/30',
    notes: 'Near Mint with slight surface wear visible upon close inspection'
  },
  6.5: {
    grade: '6 EX-MT',
    numeric: 6,
    centeringReq: '80/20',
    notes: 'Excellent-Mint with visible surface wear or minor scratches'
  },
  6.0: {
    grade: '6 EX-MT',
    numeric: 6,
    centeringReq: '80/20',
    notes: 'Excellent-Mint with visible surface wear, slight corner fraying'
  },
  5.5: {
    grade: '5 EX',
    numeric: 5,
    centeringReq: '85/15',
    notes: 'Excellent with minor rounding of corners and surface wear'
  },
  5.0: {
    grade: '5 EX',
    numeric: 5,
    centeringReq: '85/15',
    notes: 'Excellent with minor rounding of corners and surface wear'
  },
  4.5: {
    grade: '4 VG-EX',
    numeric: 4,
    centeringReq: '85/15',
    notes: 'Very Good-Excellent with slightly rounded corners, light crease may be visible'
  },
  4.0: {
    grade: '4 VG-EX',
    numeric: 4,
    centeringReq: '85/15',
    notes: 'Very Good-Excellent - structural damage detected (crease or bent corner)'
  },
  3.0: {
    grade: '3 VG',
    numeric: 3,
    centeringReq: '90/10',
    notes: 'Very Good with some rounding, surface wear, crease may be visible'
  },
  2.0: {
    grade: '2 Good',
    numeric: 2,
    centeringReq: '90/10',
    notes: 'Good with accelerated rounding, obvious wear, may have several creases'
  },
  1.5: {
    grade: '1.5 Fair',
    numeric: 1.5,
    centeringReq: '90/10',
    notes: 'Fair with extreme wear, one or more heavy creases'
  },
  1.0: {
    grade: '1 Poor',
    numeric: 1,
    centeringReq: 'any',
    notes: 'Poor with advanced defects, major creasing, eye appeal nearly vanished'
  },
};

function estimatePSA(input: DcmGradingInput): GradeEstimate {
  // Handwritten marking or alterations = AA (Authentic Altered) or PSA 1
  // BUT: Authenticated autographs are NOT alterations - they're card features
  const hasUnverifiedHandwriting = input.has_handwriting && !input.is_authenticated_autograph;
  if (hasUnverifiedHandwriting || input.has_alterations) {
    return {
      estimated_grade: 'AA Authentic Altered',
      numeric_score: 0,
      confidence: 'high',
      notes: 'Handwritten marking or alterations detected - PSA does not assign numerical grades to altered cards'
    };
  }

  // Get base mapping from DCM grade
  let mapping = findClosestMapping(input.final_grade, PSA_MAPPING);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let notes = mapping.notes;

  // Check centering requirement
  if (mapping.centeringReq && mapping.centeringReq !== 'any') {
    if (!meetsCenteringRequirement(input.centering, mapping.centeringReq, 'front')) {
      // Drop to next lower grade
      const lowerGrade = input.final_grade - 1;
      const lowerMapping = findClosestMapping(lowerGrade, PSA_MAPPING);
      mapping = lowerMapping;
      confidence = 'medium';
      notes = `${lowerMapping.notes} (dropped from higher grade due to centering)`;
    }
  }

  // PSA centering is a MAJOR factor - additional adjustments
  const centeringDev = calculateCenteringDeviation(input.centering);
  if (centeringDev > 20 && mapping.numeric >= 7) {
    // Severe centering issues drop grade further
    const adjustedGrade = Math.max(1, mapping.numeric - 1);
    mapping = PSA_MAPPING[adjustedGrade] || mapping;
    confidence = 'medium';
    notes = `${mapping.notes} (adjusted for centering - PSA weighs centering heavily)`;
  }

  return {
    estimated_grade: mapping.grade,
    numeric_score: mapping.numeric,
    confidence,
    notes
  };
}

// =============================================================================
// BGS Grade Mapping and Logic
// =============================================================================

const BGS_MAPPING: Record<number, GradeMapping> = {
  10.0: {
    grade: '10 Pristine (Black Label)',
    numeric: 10,
    centeringReq: '50/50',
    notes: 'Perfect 10 in all four subgrades - extremely rare'
  },
  9.5: {
    grade: '10 Pristine (Gold Label)',
    numeric: 10,
    centeringReq: '50/50',
    notes: 'Three 10 subgrades and one 9.5 subgrade'
  },
  9.0: {
    grade: '9.5 Gem Mint',
    numeric: 9.5,
    centeringReq: '55/45',
    notes: 'Virtually flawless with only slight imperfections under magnification'
  },
  8.5: {
    grade: '9 Mint',
    numeric: 9,
    centeringReq: '55/45',
    notes: 'Mint with slight wear allowed under normal scrutiny'
  },
  8.0: {
    grade: '8.5 Near Mint-Mint',
    numeric: 8.5,
    centeringReq: '60/40',
    notes: 'Near Mint-Mint with minor imperfections'
  },
  7.5: {
    grade: '8 Near Mint',
    numeric: 8,
    centeringReq: '60/40',
    notes: 'Near Mint with sharp corners but slight imperfections'
  },
  7.0: {
    grade: '7.5 Near Mint',
    numeric: 7.5,
    centeringReq: '65/35',
    notes: 'Near Mint with very minor wear on 2-3 corners'
  },
  6.5: {
    grade: '7 Near Mint',
    numeric: 7,
    centeringReq: '65/35',
    notes: 'Near Mint with slight roughness or minor chipping'
  },
  6.0: {
    grade: '6.5 Excellent-Mint',
    numeric: 6.5,
    centeringReq: '70/30',
    notes: 'Excellent-Mint with fuzzy corners but free of dings'
  },
  5.5: {
    grade: '6 Excellent-Mint',
    numeric: 6,
    centeringReq: '70/30',
    notes: 'Excellent-Mint with moderate roughness or chipping'
  },
  5.0: {
    grade: '5.5 Excellent',
    numeric: 5.5,
    centeringReq: '75/25',
    notes: 'Excellent with four fuzzy corners'
  },
  4.5: {
    grade: '5 Excellent',
    numeric: 5,
    centeringReq: '75/25',
    notes: 'Excellent with fuzzy corners, some gloss lost'
  },
  4.0: {
    grade: '4.5 Very Good-Excellent',
    numeric: 4.5,
    centeringReq: '80/20',
    notes: 'Very Good-Excellent - structural damage detected (hairline creases allowed)'
  },
  3.0: {
    grade: '3.5 Very Good',
    numeric: 3.5,
    centeringReq: '85/15',
    notes: 'Very Good with slightly rounded corners, very minor creases'
  },
  2.0: {
    grade: '2.5 Good',
    numeric: 2.5,
    centeringReq: '90/10',
    notes: 'Good with noticeably rounded corners, noticeable creases'
  },
  1.0: {
    grade: '1 Poor',
    numeric: 1,
    centeringReq: 'any',
    notes: 'Poor with heavily rounded corners, heavy creases, severe defects'
  },
};

function estimateBGS(input: DcmGradingInput): GradeEstimate {
  // Handwritten marking = automatic lowest grade
  // BUT: Authenticated autographs are NOT alterations - they're card features
  const hasUnverifiedHandwriting = input.has_handwriting && !input.is_authenticated_autograph;
  if (hasUnverifiedHandwriting || input.has_alterations) {
    return {
      estimated_grade: '1 Poor',
      numeric_score: 1,
      confidence: 'high',
      notes: 'Handwritten marking or alterations detected - card considered altered'
    };
  }

  // Get base mapping from DCM grade
  let mapping = findClosestMapping(input.final_grade, BGS_MAPPING);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let notes = mapping.notes;

  // Check centering requirement
  if (mapping.centeringReq && mapping.centeringReq !== 'any') {
    if (!meetsCenteringRequirement(input.centering, mapping.centeringReq, 'front')) {
      // BGS is strict on centering for high grades
      const lowerGrade = input.final_grade - 0.5;
      const lowerMapping = findClosestMapping(lowerGrade, BGS_MAPPING);
      mapping = lowerMapping;
      confidence = 'medium';
      notes = `${lowerMapping.notes} (centering does not meet BGS requirements)`;
    }
  }

  // BGS uses subgrades - if any component is weak, overall grade is capped
  // Simulate this by checking if corners, edges, surface are significantly different
  const hasWeakComponent = (
    input.corners_score && input.corners_score < input.final_grade - 1
  ) || (
    input.edges_score && input.edges_score < input.final_grade - 1
  ) || (
    input.surface_score && input.surface_score < input.final_grade - 1
  );

  if (hasWeakComponent && mapping.numeric >= 8) {
    confidence = 'medium';
    notes = `${notes} (one or more subgrades may be lower than overall grade)`;
  }

  return {
    estimated_grade: mapping.grade,
    numeric_score: mapping.numeric,
    confidence,
    notes
  };
}

// =============================================================================
// SGC Grade Mapping and Logic
// =============================================================================

const SGC_MAPPING: Record<number, GradeMapping> = {
  10.0: {
    grade: '10 PRI',
    numeric: 10,
    centeringReq: '50/50',
    notes: 'Pristine - virtually flawless, no print lines, no visible wear under magnification'
  },
  9.5: {
    grade: '10 GEM',
    numeric: 10,
    centeringReq: '55/45',
    notes: 'Gem Mint - sharp focus, four sharp corners, no gloss breaks'
  },
  9.0: {
    grade: '9.5 MINT+',
    numeric: 9.5,
    centeringReq: '60/40',
    notes: 'Mint+ - looks Gem at first glance, tiny flaw on close inspection'
  },
  8.5: {
    grade: '9 MINT',
    numeric: 9,
    centeringReq: '60/40',
    notes: 'Mint - minor flaw allowed: slight nick to one corner, small gloss break'
  },
  8.0: {
    grade: '8.5 NM/MT+',
    numeric: 8.5,
    centeringReq: '65/35',
    notes: 'Near Mint/Mint+ - few minor flaws on close examination'
  },
  7.5: {
    grade: '8 NM/MT',
    numeric: 8,
    centeringReq: '65/35',
    notes: 'Near Mint/Mint - corners sharp to naked eye, few small flaws'
  },
  7.0: {
    grade: '7.5 NM+',
    numeric: 7.5,
    centeringReq: '70/30',
    notes: 'Near Mint+ - minor wear on one corner, gloss break acceptable'
  },
  6.5: {
    grade: '7 NRMT',
    numeric: 7,
    centeringReq: '70/30',
    notes: 'Near Mint - slight wear on corners, minor scratching acceptable'
  },
  6.0: {
    grade: '6.5 EX/NM+',
    numeric: 6.5,
    centeringReq: '75/25',
    notes: 'Excellent/Near Mint+ - slight fuzzing of corners'
  },
  5.5: {
    grade: '6 EX/NM',
    numeric: 6,
    centeringReq: '75/25',
    notes: 'Excellent/Near Mint - slight fuzzing evident, slight edge notching'
  },
  5.0: {
    grade: '5.5 EX+',
    numeric: 5.5,
    centeringReq: '80/20',
    notes: 'Excellent+ - minor rounding/fuzzing'
  },
  4.5: {
    grade: '5 EX',
    numeric: 5,
    centeringReq: '80/20',
    notes: 'Excellent - one very slight surface crease allowed, gloss may be lost'
  },
  4.0: {
    grade: '4.5 VG/EX+',
    numeric: 4.5,
    centeringReq: '85/15',
    notes: 'Very Good/Excellent+ - structural damage detected (light crease allowed)'
  },
  3.5: {
    grade: '4 VG/EX',
    numeric: 4,
    centeringReq: '85/15',
    notes: 'Very Good/Excellent - slightly rounded corners, light hairline crease'
  },
  3.0: {
    grade: '3.5 VG+',
    numeric: 3.5,
    centeringReq: '90/10',
    notes: 'Very Good+ - rounded corners'
  },
  2.5: {
    grade: '3 VG',
    numeric: 3,
    centeringReq: '90/10',
    notes: 'Very Good - more rounded corners, stronger creasing'
  },
  2.0: {
    grade: '2.5 GOOD+',
    numeric: 2.5,
    centeringReq: '90/10',
    notes: 'Good+ - heavy issues'
  },
  1.5: {
    grade: '2 GOOD',
    numeric: 2,
    centeringReq: '90/10',
    notes: 'Good - heavy creases, pinholes, rounded/fraying corners'
  },
  1.0: {
    grade: '1 POOR',
    numeric: 1,
    centeringReq: 'any',
    notes: 'Poor - many major issues, heavy damage'
  },
};

function estimateSGC(input: DcmGradingInput): GradeEstimate {
  // Handwritten marking = automatic 1 POOR
  // BUT: Authenticated autographs are NOT alterations - they're card features
  const hasUnverifiedHandwriting = input.has_handwriting && !input.is_authenticated_autograph;
  if (hasUnverifiedHandwriting || input.has_alterations) {
    return {
      estimated_grade: '1 POOR',
      numeric_score: 1,
      confidence: 'high',
      notes: 'Handwritten marking or alterations detected - considered altered'
    };
  }

  // Get base mapping from DCM grade
  let mapping = findClosestMapping(input.final_grade, SGC_MAPPING);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let notes = mapping.notes;

  // Check centering requirement (SGC is strict on centering)
  if (mapping.centeringReq && mapping.centeringReq !== 'any') {
    if (!meetsCenteringRequirement(input.centering, mapping.centeringReq, 'front')) {
      const lowerGrade = input.final_grade - 0.5;
      const lowerMapping = findClosestMapping(lowerGrade, SGC_MAPPING);
      mapping = lowerMapping;
      confidence = 'medium';
      notes = `${lowerMapping.notes} (centering drops grade)`;
    }
  }

  // ANY creases detected → maximum SGC 5 EX
  if (input.crease_detected && mapping.numeric > 5.0) {
    mapping = SGC_MAPPING[5.0];
    confidence = 'high';
    notes = 'Capped at 5 EX - crease detected (SGC rule)';
  }

  // SGC emphasizes overall eye appeal - use 0.5 grades for borderline cases
  if (input.final_grade % 1 !== 0 && input.final_grade % 0.5 !== 0) {
    // DCM grade is not a clean 0.5 increment, round to nearest 0.5
    const rounded = Math.round(input.final_grade * 2) / 2;
    const roundedMapping = findClosestMapping(rounded, SGC_MAPPING);
    if (roundedMapping.numeric !== mapping.numeric) {
      confidence = 'medium';
      notes = `${notes} (borderline between grades)`;
    }
  }

  return {
    estimated_grade: mapping.grade,
    numeric_score: mapping.numeric,
    confidence,
    notes
  };
}

// =============================================================================
// CGC Grade Mapping and Logic
// =============================================================================

const CGC_MAPPING: Record<number, GradeMapping> = {
  10.0: {
    grade: '10 Gem Mint',
    numeric: 10,
    centeringReq: '60/40',
    notes: 'Gem Mint - no manufacturing or handling defects (CGC most lenient on centering)'
  },
  9.9: {
    grade: '9.9 Mint',
    numeric: 9.9,
    centeringReq: '60/40',
    notes: 'Mint - nearly indistinguishable from 10, very minor manufacturing defect'
  },
  9.8: {
    grade: '9.8 NM/M',
    numeric: 9.8,
    centeringReq: '60/40',
    notes: 'Near Mint/Mint - nearly perfect, negligible defects'
  },
  9.6: {
    grade: '9.6 NM+',
    numeric: 9.6,
    centeringReq: '60/40',
    notes: 'Near Mint+ - very well-preserved, several minor defects'
  },
  9.4: {
    grade: '9.4 NM',
    numeric: 9.4,
    centeringReq: '60/40',
    notes: 'Near Mint - minor wear and small defects'
  },
  9.2: {
    grade: '9.2 NM-',
    numeric: 9.2,
    centeringReq: '60/40',
    notes: 'Near Mint- - some wear and small defects'
  },
  9.0: {
    grade: '9.0 VF/NM',
    numeric: 9.0,
    centeringReq: '60/40',
    notes: 'Very Fine/Near Mint - good eye appeal, number of minor defects'
  },
  8.5: {
    grade: '8.5 VF+',
    numeric: 8.5,
    centeringReq: '65/35',
    notes: 'Very Fine+ - moderate defect or number of small defects'
  },
  8.0: {
    grade: '8.0 VF',
    numeric: 8.0,
    centeringReq: '65/35',
    notes: 'Very Fine - moderate defect or accumulation of small defects'
  },
  7.5: {
    grade: '7.5 VF-',
    numeric: 7.5,
    centeringReq: '70/30',
    notes: 'Very Fine- - moderate defect or accumulation of small defects'
  },
  7.0: {
    grade: '7.0 FN/VF',
    numeric: 7.0,
    centeringReq: '70/30',
    notes: 'Fine/Very Fine - major defect or accumulation of small defects'
  },
  6.5: {
    grade: '6.5 FN+',
    numeric: 6.5,
    centeringReq: '75/25',
    notes: 'Fine+ - major defect and some smaller defects'
  },
  6.0: {
    grade: '6.0 FN',
    numeric: 6.0,
    centeringReq: '75/25',
    notes: 'Fine - major defect and smaller defects, or significant accumulation'
  },
  5.5: {
    grade: '5.5 FN-',
    numeric: 5.5,
    centeringReq: '80/20',
    notes: 'Fine- - several moderate defects'
  },
  5.0: {
    grade: '5.0 VG/FN',
    numeric: 5.0,
    centeringReq: '80/20',
    notes: 'Very Good/Fine - average collectible, several moderate defects'
  },
  4.5: {
    grade: '4.5 VG+',
    numeric: 4.5,
    centeringReq: '85/15',
    notes: 'Very Good+ - slightly below-average, multiple moderate defects'
  },
  4.0: {
    grade: '4.0 VG',
    numeric: 4.0,
    centeringReq: '85/15',
    notes: 'Very Good - below-average, multiple moderate defects'
  },
  3.5: {
    grade: '3.5 VG-',
    numeric: 3.5,
    centeringReq: '90/10',
    notes: 'Very Good- - several major defects'
  },
  3.0: {
    grade: '3.0 G/VG',
    numeric: 3.0,
    centeringReq: '90/10',
    notes: 'Good/Very Good - significant handling evidence, moderate-to-major defects'
  },
  2.5: {
    grade: '2.5 G+',
    numeric: 2.5,
    centeringReq: '90/10',
    notes: 'Good+ - extensive handling evidence, multiple moderate-to-major defects'
  },
  2.0: {
    grade: '2.0 G',
    numeric: 2.0,
    centeringReq: 'any',
    notes: 'Good - extensive handling, numerous moderate-to-major defects (handwriting allowed)'
  },
  1.8: {
    grade: '1.8 G-',
    numeric: 1.8,
    centeringReq: 'any',
    notes: 'Good- - extensive handling, numerous major defects'
  },
  1.5: {
    grade: '1.5 Fa/G',
    numeric: 1.5,
    centeringReq: 'any',
    notes: 'Fair/Good - heavy accumulation of major defects'
  },
  1.0: {
    grade: '1.0 Fa',
    numeric: 1.0,
    centeringReq: 'any',
    notes: 'Fair - very poorly handled, heavy major defects'
  },
  0.5: {
    grade: '0.5 Poor',
    numeric: 0.5,
    centeringReq: 'any',
    notes: 'Poor - heavily defaced, major defects, pieces may be missing'
  },
};

function estimateCGC(input: DcmGradingInput): GradeEstimate {
  // CGC still assigns numerical grades to handwritten cards (grade 2.0)
  // BUT: Authenticated autographs are NOT alterations - they're card features
  const hasUnverifiedHandwriting = input.has_handwriting && !input.is_authenticated_autograph;
  if (hasUnverifiedHandwriting || input.has_alterations) {
    return {
      estimated_grade: '2.0 G',
      numeric_score: 2.0,
      confidence: 'high',
      notes: 'Handwritten marking or alterations detected - CGC assigns 2.0 Good (most lenient of major companies)'
    };
  }

  // Get base mapping from DCM grade
  let mapping = findClosestMapping(input.final_grade, CGC_MAPPING);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let notes = mapping.notes;

  // CGC is the most lenient - 60/40 centering acceptable for CGC 10
  if (mapping.centeringReq && mapping.centeringReq !== 'any') {
    if (!meetsCenteringRequirement(input.centering, mapping.centeringReq, 'front')) {
      const lowerGrade = input.final_grade - 0.2;
      const lowerMapping = findClosestMapping(lowerGrade, CGC_MAPPING);
      mapping = lowerMapping;
      confidence = 'medium';
      notes = `${lowerMapping.notes} (centering adjusted)`;
    }
  }

  // CGC provides more granular grading with 0.2 increments in 9.0-10.0 range
  if (input.final_grade >= 9.0 && input.final_grade <= 10.0) {
    // Try to map to precise 0.2 increment
    const preciseGrade = Math.round(input.final_grade * 5) / 5; // Round to nearest 0.2
    const preciseMapping = CGC_MAPPING[preciseGrade];
    if (preciseMapping) {
      mapping = preciseMapping;
      confidence = 'high';
      notes = preciseMapping.notes;
    }
  }

  // CGC treats manufacturing defects more leniently than handling defects at high grades
  // This is already built into the base mapping, so no additional adjustments needed

  return {
    estimated_grade: mapping.grade,
    numeric_score: mapping.numeric,
    confidence,
    notes
  };
}

// =============================================================================
// Main Estimator Function
// =============================================================================

/**
 * Estimate professional company grades from DCM grading data.
 *
 * @param input - DCM grading results
 * @returns Professional grade estimates for PSA, BGS, SGC, and CGC
 *
 * @example
 * const estimates = estimateProfessionalGrades({
 *   final_grade: 9.0,
 *   centering: {
 *     front_lr: [52, 48],
 *     front_tb: [54, 46],
 *   },
 *   has_structural_damage: false,
 *   has_handwriting: false
 * });
 *
 * console.log(estimates.PSA); // { estimated_grade: "9 Mint", numeric_score: 9, ... }
 */
export function estimateProfessionalGrades(input: DcmGradingInput): ProfessionalGradeEstimates {
  // Add disclaimer to all notes
  const disclaimer = ' | Actual professional grades may vary.';

  const psa = estimatePSA(input);
  const bgs = estimateBGS(input);
  const sgc = estimateSGC(input);
  const cgc = estimateCGC(input);

  return {
    PSA: {
      ...psa,
      notes: psa.notes + disclaimer
    },
    BGS: {
      ...bgs,
      notes: bgs.notes + disclaimer
    },
    SGC: {
      ...sgc,
      notes: sgc.notes + disclaimer
    },
    CGC: {
      ...cgc,
      notes: cgc.notes + disclaimer
    }
  };
}

/**
 * Format professional estimates as JSON matching Phase 3 output schema.
 */
export function formatAsPhase3Output(estimates: ProfessionalGradeEstimates): object {
  return {
    estimated_professional_grades: {
      PSA: estimates.PSA,
      BGS: estimates.BGS,
      SGC: estimates.SGC,
      CGC: estimates.CGC
    }
  };
}
