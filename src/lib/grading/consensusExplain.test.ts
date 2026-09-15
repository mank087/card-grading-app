/**
 * The cards behind these cases are real: the centering example is serial 676561
 * (front classified "Foil-Frame", ratios XX/XX, face score 9 under three passes
 * that each scored the whole card's centering 10), and the tile-drag example is
 * serial 626654 (averaged 9/10/10/10 displayed as averaged_rounded 9/9/9/9).
 */

import { describe, it, expect } from 'vitest';
import {
  buildClampNote,
  buildGateDragNote,
  firstSentence,
  isAlreadyExplained,
  MAX_QUOTED_CHARS,
} from './consensusExplain';

describe('firstSentence', () => {
  it('takes only the first sentence', () => {
    expect(firstSentence('The left border is wider. The top is even.')).toBe(
      'The left border is wider.',
    );
  });

  it('collapses whitespace and newlines', () => {
    expect(firstSentence('  The left\n  border  is wider. More text.')).toBe(
      'The left border is wider.',
    );
  });

  it('does not split on a decimal point inside a score', () => {
    expect(firstSentence('This face scores 9.5/10 overall. Next.')).toBe(
      'This face scores 9.5/10 overall.',
    );
  });

  it('adds a period to a fragment that has none', () => {
    expect(firstSentence('no punctuation here')).toBe('no punctuation here.');
  });

  it('returns empty for missing, blank or non-string input', () => {
    expect(firstSentence(undefined)).toBe('');
    expect(firstSentence(null)).toBe('');
    expect(firstSentence('   ')).toBe('');
    expect(firstSentence(42 as unknown as string)).toBe('');
  });

  it('truncates at 200 characters by default, on a word boundary, ending in a period', () => {
    const long = `${'word '.repeat(80)}end.`;
    const out = firstSentence(long);
    expect(out.length).toBeLessThanOrEqual(MAX_QUOTED_CHARS + 1);
    expect(out.endsWith('.')).toBe(true);
    expect(out).not.toMatch(/ \.$/);
    expect(out.includes('word word')).toBe(true);
  });

  it('honours a custom limit', () => {
    expect(firstSentence('abcdefghij klmnopqrst uvwxyz.', 12)).toBe('abcdefghij.');
  });
});

describe('buildClampNote', () => {
  const clamp = {
    cat: 'centering' as const,
    face: 'front' as const,
    faceScore: 9,
    consensus: 9,
    passScores: [10, 10, 10],
  };

  it('names the category, the consensus, the passes and the face', () => {
    expect(buildClampNote({ ...clamp, detail: 'The foil frame has no even printed border to measure.' })).toBe(
      'Centering consensus is 9 although each whole-card evaluation scored it 10: ' +
        'the detailed front assessment scored 9. The foil frame has no even printed border to measure.',
    );
  });

  it('lists the pass scores when they disagree', () => {
    expect(buildClampNote({ ...clamp, passScores: [10, 10, 9], detail: null })).toBe(
      'Centering consensus is 9 although the whole-card evaluations scored it 10, 10, 9: ' +
        'the detailed front assessment scored 9.',
    );
  });

  it('omits the quote entirely when there is no usable prose', () => {
    const note = buildClampNote({ ...clamp, detail: '   ' });
    expect(note.endsWith('the detailed front assessment scored 9.')).toBe(true);
  });

  it('works for the back and for the summary-bearing categories', () => {
    expect(
      buildClampNote({
        cat: 'corners',
        face: 'back',
        faceScore: 8,
        consensus: 8,
        passScores: [9, 9, 9],
        detail: 'Light whitening on the lower-left corner. It is visible under magnification.',
      }),
    ).toBe(
      'Corners consensus is 8 although each whole-card evaluation scored it 9: ' +
        'the detailed back assessment scored 8. Light whitening on the lower-left corner.',
    );
  });

  it('truncates the quoted sentence at 200 characters', () => {
    const note = buildClampNote({ ...clamp, detail: `${'a'.repeat(400)}.` });
    const quoted = note.split('scored 9. ')[1];
    expect(quoted.length).toBeLessThanOrEqual(MAX_QUOTED_CHARS + 1);
  });
});

describe('isAlreadyExplained', () => {
  it('is false when nothing else accounts for the drop', () => {
    expect(isAlreadyExplained({ consensus: 8 })).toBe(false);
    expect(
      isAlreadyExplained({
        consensus: 8,
        zoomCaps: [],
        structuralCap: null,
        dissentValue: null,
        dragValue: null,
      }),
    ).toBe(false);
  });

  it.each([
    ['a zoom cap at the consensus', { consensus: 9, zoomCaps: [9] }],
    ['a zoom cap below the consensus', { consensus: 9, zoomCaps: [8] }],
    ['the lower of two zoom caps at the consensus', { consensus: 9, zoomCaps: [10, 9] }],
    ['a structural cap at the consensus', { consensus: 7, structuralCap: 7 }],
    ['a structural cap below the consensus', { consensus: 7, structuralCap: 6 }],
    ['a dissent reflection equal to the consensus', { consensus: 9, dissentValue: 9 }],
    ['a gate drag equal to the consensus', { consensus: 9, dragValue: 9 }],
  ])('is true with %s', (_label, input) => {
    expect(isAlreadyExplained(input)).toBe(true);
  });

  it.each([
    ['a zoom cap ABOVE the consensus', { consensus: 8, zoomCaps: [9] }],
    ['both zoom caps above the consensus', { consensus: 8, zoomCaps: [9, 10] }],
    ['a structural cap above the consensus', { consensus: 6, structuralCap: 7 }],
    ['a dissent reflection above the consensus', { consensus: 8, dissentValue: 9 }],
    ['a dissent reflection below the consensus', { consensus: 9, dissentValue: 8 }],
    ['a gate drag above the consensus', { consensus: 8, dragValue: 9 }],
  ])('is false with %s', (_label, input) => {
    expect(isAlreadyExplained(input)).toBe(false);
  });

  it('ignores absent caps rather than treating them as zero', () => {
    expect(
      isAlreadyExplained({ consensus: 8, zoomCaps: [undefined, null] }),
    ).toBe(false);
  });

  it('the production miss: back zoom cap 9 does not explain a front clamp to 8', () => {
    // corners 10/10/10 whole-card, front face section 8, zoom capped the BACK to 9.
    expect(
      isAlreadyExplained({ consensus: 8, zoomCaps: [undefined, 9] }),
    ).toBe(false);
  });
});

describe('buildGateDragNote', () => {
  it('reuses the gate reason verbatim as a subordinate clause', () => {
    expect(
      buildGateDragNote({
        moved: [
          { cat: 'corners', from: 10 },
          { cat: 'edges', from: 10 },
          { cat: 'surface', from: 10 },
        ],
        shown: 9,
        reason: 'the photos are not clear enough to confirm a 10',
      }),
    ).toBe(
      'Subgrades shown at 9 to match the held grade: the evaluations scored corners, ' +
        'edges and surface at 10, but the grade is held at 9 because the photos are not ' +
        'clear enough to confirm a 10.',
    );
  });

  it('groups categories that moved from different scores', () => {
    expect(
      buildGateDragNote({
        moved: [
          { cat: 'corners', from: 10 },
          { cat: 'edges', from: 9 },
        ],
        shown: 8,
        reason: 'it was photographed inside a rigid holder',
      }),
    ).toBe(
      'Subgrades shown at 8 to match the held grade: the evaluations scored corners at 10 ' +
        'and edges at 9, but the grade is held at 8 because it was photographed inside a rigid holder.',
    );
  });

  it('does not double the reason’s trailing period', () => {
    const note = buildGateDragNote({
      moved: [{ cat: 'surface', from: 10 }],
      shown: 9,
      reason: 'the photos are not clear enough to confirm a 10.  ',
    })!;
    expect(note.endsWith('a 10.')).toBe(true);
    expect(note.endsWith('..')).toBe(false);
  });

  it('returns null when no tile moved', () => {
    expect(buildGateDragNote({ moved: [], shown: 9, reason: 'anything' })).toBeNull();
  });
});
