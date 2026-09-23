import { describe, it, expect } from 'vitest';
import {
  confidenceLevelFor,
  hasCenteringData,
  imageQualityInfoFor,
  isSlabbed,
  readCaseDetection,
  readConditionDetails,
  readFaceCentering,
  readImageGrade,
  readSlabDetection,
  readStructuralUnconfirmedNote,
} from './gradeDetails';

describe('readFaceCentering', () => {
  const card = {
    conversational_centering_ratios: {
      front_lr: '52/48',
      front_tb: '50/50',
      front_quality_tier: 'Excellent',
      back_lr: '60/40',
      back_tb: '55/45',
    },
    conversational_sub_scores: { centering: { front: 9, back: 7 } },
    conversational_corners_edges_surface: {
      front_centering: { summary: 'Front sits slightly left.' },
    },
  };

  it('reads the front ratios, tier, score and prose', () => {
    expect(readFaceCentering(card, 'front')).toEqual({
      lrText: '52/48',
      tbText: '50/50',
      measurable: true,
      qualityTier: 'Excellent',
      score: 9,
      analysis: 'Front sits slightly left.',
    });
  });

  it('reads the back and reports no tier when the grader gave none', () => {
    const back = readFaceCentering(card, 'back');
    expect(back.lrText).toBe('60/40');
    expect(back.score).toBe(7);
    expect(back.qualityTier).toBeNull();
    expect(back.analysis).toBeNull();
  });

  it('reports a face with no stored ratio as unmeasured, never a made-up 50/50', () => {
    const bare = readFaceCentering({}, 'front');
    expect(bare.lrText).toBeNull();
    expect(bare.tbText).toBeNull();
    expect(bare.measurable).toBe(false);
    expect(bare.score).toBeNull();
  });

  // The grader stores these when a face has nothing to measure (full-art,
  // borderless, die-cut). Each used to reach the page as "NaN/NaN" or "50/50".
  it.each(['XX/XX', 'n/a', 'N/A', 'borderless'])(
    'passes the stored %s through untouched and marks the face unmeasured',
    (raw) => {
      const face = readFaceCentering(
        { conversational_centering_ratios: { front_lr: raw, front_tb: raw } },
        'front',
      );
      expect(face.lrText).toBe(raw);
      expect(face.lrText).not.toContain('NaN');
      expect(face.lrText).not.toBe('50/50');
      expect(face.measurable).toBe(false);
    },
  );

  it('is measurable when only one axis was measured', () => {
    const face = readFaceCentering(
      { conversational_centering_ratios: { front_lr: '55/45', front_tb: 'XX/XX' } },
      'front',
    );
    expect(face.measurable).toBe(true);
  });
});

describe('hasCenteringData', () => {
  it('is true when sub-scores exist', () => {
    expect(hasCenteringData({ conversational_sub_scores: {} })).toBe(true);
  });

  it('is true when only a legacy ratio text exists', () => {
    expect(
      hasCenteringData({ dvg_grading: { centering: { front_left_right_ratio_text: '55/45' } } })
    ).toBe(true);
  });

  it('is false for a bare row', () => {
    expect(hasCenteringData({})).toBe(false);
  });
});

describe('readConditionDetails', () => {
  it('reads the nested v5 shape, preferring `condition` and `sub_score`', () => {
    const detail = readConditionDetails(
      {
        conversational_corners_edges_surface: {
          corners: {
            front: {
              top_left: { condition: 'Sharp' },
              front_summary: 'All four are clean.',
              sub_score: 9,
              score: 4,
            },
          },
          surface: { front: { condition: 'Glossy', score: 8 } },
        },
      },
      'front'
    );
    expect(detail.corners.top_left).toBe('Sharp');
    expect(detail.corners.summary).toBe('All four are clean.');
    expect(detail.corners.sub_score).toBe(9);
    expect(detail.surface.analysis).toBe('Glossy');
    expect(detail.surface.sub_score).toBe(8);
  });

  it('falls back to the flat shape and the plain string form', () => {
    const detail = readConditionDetails(
      {
        conversational_corners_edges_surface: {
          back_edges: { top: 'Clean', summary: 'No whitening.', score: 10 },
        },
      },
      'back'
    );
    expect(detail.edges.top).toBe('Clean');
    expect(detail.edges.summary).toBe('No whitening.');
    expect(detail.edges.sub_score).toBe(10);
  });

  it('returns empty blocks for a row with nothing saved', () => {
    const detail = readConditionDetails({}, 'front');
    expect(detail.corners.top_left).toBeUndefined();
    expect(detail.surface.defects).toBeUndefined();
  });
});

describe('readStructuralUnconfirmedNote', () => {
  it('returns the note only when the flag is set and the text is non-empty', () => {
    expect(
      readStructuralUnconfirmedNote({
        conversational_grading: JSON.stringify({
          structural_damage: { unconfirmed: true, unconfirmed_note: 'Lighting reflection.' },
        }),
      })
    ).toBe('Lighting reflection.');
    expect(
      readStructuralUnconfirmedNote({
        conversational_grading: JSON.stringify({
          structural_damage: { unconfirmed: true, unconfirmed_note: '   ' },
        }),
      })
    ).toBeNull();
    expect(
      readStructuralUnconfirmedNote({
        conversational_grading: JSON.stringify({ structural_damage: { unconfirmed: false } }),
      })
    ).toBeNull();
  });

  it('is null for a markdown report', () => {
    expect(readStructuralUnconfirmedNote({ conversational_grading: '## [STEP 1]' })).toBeNull();
  });
});

describe('readImageGrade', () => {
  it('prefers the conversational letter', () => {
    expect(readImageGrade({ conversational_image_confidence: 'A', dvg_image_quality: 'C' })).toBe('A');
  });

  it('falls through to the dvg column and then to B', () => {
    expect(readImageGrade({ dvg_image_quality: 'C' })).toBe('C');
    expect(readImageGrade({})).toBe('B');
  });
});

describe('confidenceLevelFor / imageQualityInfoFor', () => {
  it('maps each letter', () => {
    expect(confidenceLevelFor('A').level).toBe('Very High');
    expect(confidenceLevelFor('B').level).toBe('High');
    expect(confidenceLevelFor('C').level).toBe('Moderate');
    expect(confidenceLevelFor('D').level).toBe('Low');
  });

  it('defaults an unrecognised letter to High for the bar and to D for the copy', () => {
    expect(confidenceLevelFor('Z').level).toBe('High');
    expect(imageQualityInfoFor('Z').name).toBe('Grade D - Poor');
  });

  it('recommends new photos only for C and D', () => {
    expect(imageQualityInfoFor('A').recommendNewPhotos).toBe(false);
    expect(imageQualityInfoFor('B').recommendNewPhotos).toBe(false);
    expect(imageQualityInfoFor('C').recommendNewPhotos).toBe(true);
    expect(imageQualityInfoFor('D').recommendNewPhotos).toBe(true);
  });
});

describe('case and slab detection', () => {
  it('prefers the conversational case detection', () => {
    expect(
      readCaseDetection({
        conversational_case_detection: { case_type: 'toploader' },
        dvg_grading: { case_detection: { case_type: 'none' } },
      })
    ).toEqual({ case_type: 'toploader' });
  });

  it('returns null when nothing recorded a case', () => {
    expect(readCaseDetection({})).toBeNull();
  });

  it('only returns a slab detection that actually detected one', () => {
    expect(readSlabDetection({ conversational_slab_detection: { detected: false } })).toBeNull();
    expect(
      readSlabDetection({ conversational_slab_detection: { detected: true, company: 'psa' } })
    ).toEqual({ detected: true, company: 'psa' });
  });

  it('treats either slab signal as slabbed', () => {
    expect(isSlabbed({ slab_detected: true })).toBe(true);
    expect(isSlabbed({ conversational_slab_detection: { detected: true } })).toBe(true);
    expect(isSlabbed({})).toBe(false);
  });
});
