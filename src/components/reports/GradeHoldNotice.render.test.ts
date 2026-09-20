import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GradeHoldNotice } from './ThreePassSummary';
import type { GradeHold } from '@/types/card';

const hold = (over: Partial<GradeHold> = {}): GradeHold => ({
  held: true, from: 10, to: 9, cause: 'image_quality', reason: 'the photos are not clear enough to confirm a 10',
  advice: 'Retake the photos in even light with the card in sharp focus and no glare across the surface.',
  evaluations: { pass_1: 10, pass_2: 10, pass_3: 10 }, scored: { centering: 10, corners: 10, edges: 10, surface: 10 }, ...over,
});
const html = (h?: GradeHold) => renderToStaticMarkup(React.createElement(GradeHoldNotice, { hold: h }));

describe('held-grade notice', () => {
  it('renders nothing for a card that was not held', () => {
    expect(html(undefined)).toBe('');
  });

  it('says the evaluations all scored 10 and that no condition flaw lowered the card', () => {
    const out = html(hold());
    expect(out).toContain('All three evaluations scored this card 10');
    expect(out).toContain('No condition flaw lowered it');
    expect(out).toContain('held at 9 because the photos are not clear enough to confirm a 10');
    expect(out).toContain('They are not four separate deductions');
  });

  it('names the real cause instead of blaming the photos', () => {
    const out = html(hold({ cause: 'holder', reason: 'it was photographed inside a sleeve or holder, which limits how closely the surface and edges can be inspected', advice: 'For Gem Mint consideration, re-submit with the card photographed outside the sleeve or holder.' }));
    expect(out).toContain('photographed in a sleeve or holder');
    expect(out).toContain('outside the sleeve or holder');
    expect(out).not.toContain('not clear enough');
  });

  it('shows the actual scores when the evaluations were not unanimous', () => {
    const out = html(hold({ cause: 'evaluations_disagree', advice: null, evaluations: { pass_1: 10, pass_2: 10, pass_3: 8 } }));
    expect(out).toContain('scored this card 10, 10 and 8');
    expect(out).not.toContain('All three evaluations');
  });

  it('uses no em dashes and never says AI', () => {
    expect(html(hold())).not.toMatch(/—|–|\bAI\b/);
  });
});
