import { describe, expect, it } from 'vitest';
import { belongsTo, reconcileCenteringText, repairReportConsistency, reportConsistencyEnabled } from './reportConsistency';
import { buildFinalSummary } from '../gradeNarrator';

const zoom = (type: string, severity: string, location: string, description: string) =>
  ({ type, severity, location, description, source: 'zoom-inspection', evidence_path: 'zoom-evidence/x/F-COR-TL.jpg' });

const pos = (condition: string, score: number) => ({ condition, defects: [], score });

/** Shaped like the stored Goff 726955 report (Oct 8 2026). */
function goff() {
  return {
    raw_sub_scores: { centering_front: 10, corners_front: 8, edges_front: 10, surface_front: 10, centering_back: 10, corners_back: 9, edges_back: 10, surface_back: 10 },
    corners: {
      front: {
        top_left: pos('The top-left corner meets the black and silver prismatic frame with a sharp profile and no visible fiber exposure or rounding at the available image resolution.', 8),
        top_right: pos('At the upper-right blue foil frame, the corner remains pointed with no visible lift.', 8),
        score: 8,
        summary: 'The prismatic frame remains continuous to each sharp apex. Magnified zoom inspection subsequently found: moderate whitening (top-left corner) — this score reflects those findings.',
        defects: [zoom('whitening', 'moderate', 'front top-left corner', 'Multiple light exposed-fiber flecks and a slightly rough run are visible along the dark left cut edge.')],
      },
      back: { score: 9, summary: 'No confirmed corner defects are visible.' },
    },
    edges: {
      front: {
        left: pos('The left edge beside the Spectra logo and football image shows an even outline with no visible fuzzing, whitening, or material loss.', 10),
        right: pos('The right edge is straight and intact.', 10),
        score: 10,
        summary: 'No physical edge damage is confirmed.',
      },
      back: { score: 10, summary: 'No visible edge wear.' },
    },
    surface: {
      front: { condition: 'No confirmed scratches, scuffs, dents, stains, or holo disruptions are visible.', defects: [], score: 10 },
      back: { condition: 'Uniform glossy back.', defects: [], score: 10 },
    },
    centering: { front: { left_right: 'XX/XX', top_bottom: 'XX/XX', analysis: 'Foil frame; not measurable.' } },
    grading_passes: { consensus_notes: ['grade adjusted: corners 8/10 — moderate whitening (front top-left corner). The magnified photo is linked.'] },
    final_grade: { summary: 'x' },
  };
}

describe('belongsTo', () => {
  it('reads category from type and description', () => {
    expect(belongsTo('whitening', 'a slightly rough run along the dark left cut edge', 'corners')).toBe('edges');
    expect(belongsTo('whitening', 'white fleck at the corner tip', 'corners')).toBeNull();
    expect(belongsTo('scratch', 'thin curved scratch on the green card area', 'corners')).toBe('surface');
    expect(belongsTo('rough_cut', 'uneven factory cut', 'corners')).toBe('edges');
    expect(belongsTo('rounding', 'tip is rounded', 'edges')).toBe('corners');
    expect(belongsTo('whitening', 'white flecks and an uneven run along the dark left edge', 'surface')).toBe('edges');
    expect(belongsTo('scuff', 'faint streaks', 'surface')).toBe('surface');
  });
});

describe('Goff 726955: edge run charged to corners', () => {
  it('keeps the placement and every score, corrects the location everywhere, and logs the would-be grade change', () => {
    const j: any = goff();
    const scoresBefore = JSON.stringify(j.raw_sub_scores);
    const zoomAdjustments = ['corners 8/10 — moderate whitening (front top-left corner)'];
    const res = repairReportConsistency(j, { zoomAdjustments });

    expect(JSON.stringify(j.raw_sub_scores)).toBe(scoresBefore);
    expect(j.corners.front.score).toBe(8);
    expect(j.edges.front.score).toBe(10);
    expect(j.corners.front.defects).toHaveLength(1);
    expect(j.edges.front.defects).toBeUndefined();

    expect(j.corners.front.defects[0].location).toBe('front left edge, next to the top-left corner');
    expect(j.corners.front.summary).toContain('moderate whitening (left edge, next to the top-left corner)');
    expect(j.grading_passes.consensus_notes[0]).toContain('(front left edge, next to the top-left corner)');
    expect(zoomAdjustments[0]).toBe('corners 8/10 — moderate whitening (front left edge, next to the top-left corner)');

    expect(res.would_change_grade).toEqual([expect.objectContaining({ face: 'front', filed_under: 'corners', belongs_to: 'edges' })]);
    expect(j.report_consistency.would_change_grade).toHaveLength(1);
  });

  it('no longer lets the left edge or the top-left corner read as clean', () => {
    const j: any = goff();
    repairReportConsistency(j);
    expect(j.edges.front.left.condition).toMatch(/^Magnified inspection found moderate whitening on this edge: multiple light exposed-fiber flecks/);
    expect(j.edges.front.left.condition).not.toMatch(/no visible fuzzing, whitening/);
    expect(j.edges.front.left.condition_model).toContain('no visible fuzzing');
    // The corner tip itself was sharp (hand review): keep that, add the finding.
    expect(j.corners.front.top_left.condition).toContain('sharp profile');
    expect(j.corners.front.top_left.condition).toContain('Magnified inspection found moderate whitening on the left edge next to this corner, counted in the corners score');
    // Untouched positions stay as written.
    expect(j.corners.front.top_right.condition).toBe('At the upper-right blue foil frame, the corner remains pointed with no visible lift.');
    expect(j.edges.front.right.condition).toBe('The right edge is straight and intact.');
  });

  it('feeds the narrator the corrected location', () => {
    const j: any = goff();
    repairReportConsistency(j);
    const summary = buildFinalSummary({
      finalGrade: 8, conditionLabel: 'Near Mint-Mint', uncertainty: '±1',
      subgrades: { centering: 10, corners: 8, edges: 10, surface: 10 },
      structuralDetected: false, structuralFindings: [], zoomAdjustments: [], jsonData: j,
    });
    expect(summary).toContain('The grade comes down to the corners: noticeable whitening at the left edge, next to the top-left corner on the front.');
    expect(summary).not.toContain('at the top-left corner');
  });

  it('is idempotent', () => {
    const j: any = goff();
    repairReportConsistency(j);
    const strip = (x: any) => JSON.stringify({ ...x, report_consistency: undefined });
    const once = strip(j);
    const again = repairReportConsistency(j);
    expect(again.repairs).toEqual([]);
    expect(strip(j)).toBe(once);
  });
});

describe('Adams 791681: surface scratch filed under a corner', () => {
  it('relabels it as a surface mark, fixes the clean surface text, keeps the corners 9', () => {
    const j: any = {
      raw_sub_scores: { corners_front: 9, surface_front: 10 },
      corners: { front: { score: 9, summary: 'Magnified zoom inspection subsequently found: faint scratch visible only under magnification (bottom-right corner) — this score reflects those findings.',
        bottom_right: pos('The bottom-right point appears intact and flat, without visible rounding.', 9),
        defects: [zoom('scratch', 'minor', 'front bottom-right corner', 'Thin curved surface scratch visible on the green card area near the center-left.')] } },
      surface: { front: { score: 10, condition: 'The front has a reflective chrome finish. No confirmed scratch, scuff, indentation, or holo disruption is visible.' } },
    };
    const res = repairReportConsistency(j);
    expect(j.raw_sub_scores).toEqual({ corners_front: 9, surface_front: 10 });
    expect(j.corners.front.defects[0].location).toBe('front surface near the bottom-right corner');
    expect(j.corners.front.summary).toContain('(surface near the bottom-right corner)');
    expect(j.surface.front.condition).toBe('The front has a reflective chrome finish. Magnified inspection found faint scratch on the front surface, visible only under magnification: thin curved surface scratch visible on the green card area near the center-left.');
    // The corner position is not the scratch's position: left as written.
    expect(j.corners.front.bottom_right.condition).toBe('The bottom-right point appears intact and flat, without visible rounding.');
    expect(res.would_change_grade[0]).toMatchObject({ belongs_to: 'surface', reason: 'surface_front is 10; a minor finding implies 9 or lower' });
  });
});

describe('Evans 869487: one left-edge run filed three times', () => {
  it('drops the duplicate surface copy (no score rests on it) and leaves the scores', () => {
    const run = 'An uneven exposed run is visible along the dark left edge.';
    const j: any = {
      raw_sub_scores: { corners_front: 8, edges_front: 8, surface_front: 10 },
      corners: { front: { score: 8, defects: [zoom('whitening', 'moderate', 'front top-left corner', 'Exposed fibers and roughness run along the left cut edge near the corner.')] } },
      edges: { front: { score: 8, left: pos('The left edge is straight, with no visible roughness, fuzzing, or coating loss.', 8),
        defects: [zoom('whitening', 'moderate', 'front left edge', 'A continuous jagged run of exposed white cardstock along the left edge.')] } },
      surface: { front: { score: 10, condition: 'Glossy front.', defects: [zoom('whitening', 'moderate', 'front upper-left area of the surface', run)] } },
    };
    const res = repairReportConsistency(j);
    expect(j.raw_sub_scores).toEqual({ corners_front: 8, edges_front: 8, surface_front: 10 });
    expect(j.surface.front.defects).toEqual([]);
    expect(j.edges.front.defects).toHaveLength(1);
    expect(res.repairs.map(r => r.rule)).toContain('dedupe');
    // The corner copy sets corners 8: it stays, relabelled, and is logged.
    expect(j.corners.front.defects[0].location).toBe('front left edge, next to the top-left corner');
    expect(res.would_change_grade).toEqual([expect.objectContaining({ filed_under: 'corners', belongs_to: 'edges', reason: 'corners_front (8) rests on this finding' })]);
    expect(j.edges.front.left.condition).toMatch(/^Magnified inspection found moderate whitening on this edge/);
  });

  it('moves a misfiled finding when no face score rests on it and the target already reflects it', () => {
    const j: any = {
      raw_sub_scores: { corners_front: 7, edges_front: 8 },
      corners: { front: { score: 7, defects: [
        { type: 'rounding', severity: 'heavy', location: 'front top-right corner', description: 'rounded tip' },
        zoom('rough_cut', 'moderate', 'front top-left corner', 'uneven factory cut along the top edge'),
      ] } },
      edges: { front: { score: 8, defects: [] } },
    };
    const res = repairReportConsistency(j);
    expect(j.corners.front.defects).toHaveLength(1);
    expect(j.edges.front.defects).toEqual([expect.objectContaining({ type: 'rough_cut', location: 'front top edge, next to the top-left corner', refiled_from: 'corners' })]);
    expect(res.would_change_grade).toEqual([]);
    expect(j.raw_sub_scores).toEqual({ corners_front: 7, edges_front: 8 });
  });
});

describe('centering text vs stored ratios (Brady-style)', () => {
  it('rewrites a quoted ratio that disagrees with the stored ratio for its axis', () => {
    const j: any = {
      centering: {
        front: {
          left_right: '52/48', top_bottom: '60/40',
          analysis: 'Front centering is measured at approximately 52/48 left-right and 52/48 top-bottom.',
          measurements: 'Top/bottom 52/48; left/right 52/48.',
        },
        front_summary: 'Centering reads 52/48 top to bottom.',
        back: { left_right: 'XX/XX', top_bottom: 'XX/XX', analysis: 'No border to measure; 50/50 left-right by design.' },
      },
    };
    repairReportConsistency(j);
    expect(j.centering.front.analysis).toBe('Front centering is measured at approximately 52/48 left-right and 60/40 top-bottom.');
    expect(j.centering.front.measurements).toBe('Top/bottom 60/40; left/right 52/48.');
    expect(j.centering.front_summary).toBe('Centering reads 60/40 top to bottom.');
    expect(j.centering.back.analysis).toBe('No border to measure; 50/50 left-right by design.');
  });

  it('leaves text alone when the axis is unclear or the ratio already matches within a point', () => {
    expect(reconcileCenteringText('Borders look about 55/45 overall.', { left_right: '60/40', top_bottom: '60/40' })).toBe('Borders look about 55/45 overall.');
    expect(reconcileCenteringText('Left/right 47/53.', { left_right: '52/48' })).toBe('Left/right 47/53.');
    expect(reconcileCenteringText('Left/right 51/49.', { left_right: '52/48' })).toBe('Left/right 51/49.');
  });

  it('cannot catch the real Brady miss: the stored ratio itself said 52/48', () => {
    const j: any = { centering: { front: { left_right: '52/48', top_bottom: '52/48', analysis: 'Perfect front centering is measured at approximately 52/48 left-right and 52/48 top-bottom.' } } };
    expect(repairReportConsistency(j).repairs).toEqual([]);
  });
});

describe('guards', () => {
  it('ignores odd shapes and back positions, and has a kill switch', () => {
    expect(repairReportConsistency(null).repairs).toEqual([]);
    expect(repairReportConsistency({ corners: { front: { defects: 'x' } } }).repairs).toEqual([]);
    const j: any = { raw_sub_scores: { edges_back: 8 }, edges: { back: { score: 8, left: pos('Clean, sharp edge.', 8),
      defects: [zoom('whitening', 'moderate', 'back left edge', 'white run along the left edge')] } } };
    repairReportConsistency(j);
    expect(j.edges.back.left.condition).toBe('Clean, sharp edge.');
    expect(reportConsistencyEnabled({})).toBe(true);
    expect(reportConsistencyEnabled({ REPORT_CONSISTENCY_V1: 'off' })).toBe(false);
  });
});

describe('conservative edges (seen replaying 40 stored reports)', () => {
  it('leaves a position sentence that already admits wear', () => {
    const j: any = { raw_sub_scores: { corners_front: 9 }, corners: { front: { score: 9,
      bottom_left: pos('The lower-left corner at the red frame is intact but mildly softened compared with a sharp factory point.', 9),
      defects: [zoom('softening', 'minor', 'front bottom-left corner', 'tip is slightly rounded')] } } };
    repairReportConsistency(j);
    expect(j.corners.front.bottom_left.condition).toBe('The lower-left corner at the red frame is intact but mildly softened compared with a sharp factory point.');
  });

  it('does not move a finding it cannot give an honest location under the other category', () => {
    const j: any = { raw_sub_scores: { surface_back: 10, edges_back: 8 },
      surface: { back: { score: 10, defects: [zoom('whitening', 'moderate', 'back vertical center band of the surface', 'white run along the edge')] } },
      edges: { back: { score: 8, defects: [] } } };
    const res = repairReportConsistency(j);
    expect(res.repairs).toEqual([]);
    expect(j.surface.back.defects).toHaveLength(1);
  });

  it('keeps the inserted text ASCII', () => {
    const j: any = { raw_sub_scores: { surface_back: 9 }, surface: { back: { score: 9, condition: 'No confirmed scratch or stain is visible.',
      defects: [zoom('stain', 'minor', 'back upper-left area of the surface', 'upper-left corner area → pale patch → cream against tan')] } } };
    repairReportConsistency(j);
    expect(j.surface.back.condition).toBe('Magnified inspection found faint stain on the back surface (upper-left area), visible only under magnification: upper-left corner area, pale patch, cream against tan.');
  });
});
