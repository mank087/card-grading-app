import { describe, expect, it } from 'vitest';
import { formatCardNumberForContext, pokemonPrintedTotalForLabel } from './labelDataGenerator';

describe('Pokemon label card number', () => {
  it('never appends a set total to a Black Star promo (SVP 173 is not 173/150)', () => {
    const svp = { id: 'svp', printedTotal: 150 };
    expect(pokemonPrintedTotalForLabel(svp)).toBeNull();
    expect(formatCardNumberForContext('173', 'Pokemon', pokemonPrintedTotalForLabel(svp))).toBe('#173');
    for (const id of ['swshp', 'smp', 'xyp', 'basep', 'mep']) expect(pokemonPrintedTotalForLabel({ id, printedTotal: 200 })).toBeNull();
  });

  it('keeps the printed total for a numbered set', () => {
    const base = { id: 'base1', printedTotal: 102 };
    expect(formatCardNumberForContext('4', 'Pokemon', pokemonPrintedTotalForLabel(base))).toBe('#4/102');
    expect(pokemonPrintedTotalForLabel(null)).toBeNull();
  });
});
