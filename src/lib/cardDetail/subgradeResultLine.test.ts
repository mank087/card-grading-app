import { describe, it, expect } from 'vitest';
import { subgradeResultLine } from './subgradeResultLine';

/** A card whose `conversational_corners_edges_surface` is exactly `details`. */
const withDetails = (details: Record<string, unknown>) => ({
  conversational_corners_edges_surface: details,
});

describe('subgradeResultLine — corners / edges / surface', () => {
  it('counts defects across BOTH faces (nested shape)', () => {
    const card = withDetails({
      corners: {
        front: { sub_score: 9, defects: [{ type: 'whitening' }] },
        back: { sub_score: 8, defects: [{ type: 'ding' }, { type: 'fray' }] },
      },
    });
    expect(subgradeResultLine(card, 'corners')).toBe('3 findings');
  });

  it('counts defects in the flat legacy shape too', () => {
    const card = withDetails({ front_edges: { defects: [{ type: 'chip' }] } });
    expect(subgradeResultLine(card, 'edges')).toBe('1 finding');
  });

  it('says "1 finding" in the singular', () => {
    const card = withDetails({ surface: { front: { sub_score: 9, defects: [{}] } } });
    expect(subgradeResultLine(card, 'surface')).toBe('1 finding');
  });

  it('reports no defects only when the category has a saved sub-score', () => {
    const card = withDetails({ corners: { front: { sub_score: 10, defects: [] } } });
    expect(subgradeResultLine(card, 'corners')).toBe('No corner defects detected');
  });

  it('reports no defects when only a summary was saved, on either face', () => {
    const card = withDetails({ edges: { back: { summary: 'Clean edges all round.' } } });
    expect(subgradeResultLine(card, 'edges')).toBe('No edge defects detected');
    const surface = withDetails({ surface: { front: { front_summary: 'Clean.' } } });
    expect(subgradeResultLine(surface, 'surface')).toBe('No surface defects detected');
  });

  it('treats a zero sub-score as data (it was saved), never as missing', () => {
    const card = withDetails({ corners: { front: { sub_score: 0 } } });
    expect(subgradeResultLine(card, 'corners')).toBe('No corner defects detected');
  });

  it('returns null when the category has no condition data at all', () => {
    expect(subgradeResultLine({}, 'corners')).toBeNull();
    expect(subgradeResultLine(null, 'edges')).toBeNull();
    // Another category's data says nothing about this one.
    const card = withDetails({ corners: { front: { sub_score: 9 } } });
    expect(subgradeResultLine(card, 'surface')).toBeNull();
  });

  it('returns null for blank summaries and an empty defect list', () => {
    const card = withDetails({ edges: { front: { summary: '   ', sub_score: '', defects: [] } } });
    expect(subgradeResultLine(card, 'edges')).toBeNull();
  });

  it('ignores a defects value that is not a list', () => {
    const card = withDetails({ corners: { front: { defects: 'none' } } });
    expect(subgradeResultLine(card, 'corners')).toBeNull();
  });
});

describe('subgradeResultLine — centering', () => {
  const ratios = (r: Record<string, unknown>) => ({
    conversational_sub_scores: { centering: { front: 9 } },
    conversational_centering_ratios: r,
  });

  it('uses the front face line as stored', () => {
    expect(subgradeResultLine(ratios({ front_lr: '52/48', front_tb: '50/50' }), 'centering')).toBe(
      'Front 52/48 · 50/50',
    );
  });

  it('says not measurable when the grader stored an unmeasurable ratio', () => {
    const line = subgradeResultLine(ratios({ front_lr: 'XX/XX', front_tb: 'XX/XX' }), 'centering');
    expect(line).toBe('Front: not measurable');
  });

  it('says there is no border for an R0 full-art face', () => {
    const card = ratios({ front_lr: 'XX/XX', front_tb: 'XX/XX', front_quality_tier: 'Centered' });
    expect(subgradeResultLine(card, 'centering')).toBe('Front: no border to measure');
  });

  it('never prints NaN or a made-up 50/50', () => {
    const line = subgradeResultLine(ratios({ front_lr: 'n/a', front_tb: 'borderless' }), 'centering');
    expect(line).not.toContain('NaN');
    expect(line).not.toContain('50/50');
  });

  it('returns null when the card has no centering data at all', () => {
    expect(subgradeResultLine({}, 'centering')).toBeNull();
  });

  it('returns null when nothing was stored for the front face', () => {
    expect(subgradeResultLine(ratios({ back_lr: '60/40', back_tb: '55/45' }), 'centering')).toBeNull();
  });
});
