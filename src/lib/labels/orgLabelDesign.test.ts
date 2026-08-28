/**
 * normalizeOrgLabelDesign is the trust boundary: whatever an org's browser
 * posts arrives here before it becomes print dimensions on a PDF. Custom sizing
 * is the one place client numbers survive at all, so the clamping is the part
 * worth pinning down.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeOrgLabelDesign,
  defaultOrgLabelDesign,
  designDims,
  designAspect,
  isCustomSize,
  DESIGN_LIMITS,
  LABEL_SIZE_PRESETS,
} from './orgLabelDesign';

const withSize = (size: any) => normalizeOrgLabelDesign({ ...defaultOrgLabelDesign(), size } as any);

describe('named size presets', () => {
  it('standard and zion keep their own fixed dims, ignoring supplied numbers', () => {
    const std = withSize({ preset: 'standard', widthIn: 99, heightIn: 99 });
    expect(std.size).toEqual({ preset: 'standard', widthIn: 2.8, heightIn: 0.8 });

    const zion = withSize({ preset: 'zion', widthIn: 99, heightIn: 99 });
    expect(zion.size).toEqual({ preset: 'zion', widthIn: 2.51, heightIn: 0.76 });
  });

  it('Zion matches the consumer wizard exactly', () => {
    // Consumer SLAB_SIZES (src/components/labelWizard/wizardTypes.ts):
    //   standard 2.8 x 0.8, zion 2.51 x 0.76
    const zion = LABEL_SIZE_PRESETS.find(p => p.id === 'zion')!;
    expect([zion.widthIn, zion.heightIn]).toEqual([2.51, 0.76]);
    const std = LABEL_SIZE_PRESETS.find(p => p.id === 'standard')!;
    expect([std.widthIn, std.heightIn]).toEqual([2.8, 0.8]);
  });

  it('an unknown preset falls back rather than throwing', () => {
    expect(withSize({ preset: 'not-a-slot' }).size.preset).toBe('standard');
  });
});

describe('custom sizing', () => {
  it('keeps dimensions the org actually typed', () => {
    const d = withSize({ preset: 'custom', widthIn: 3.1, heightIn: 0.95 });
    expect(d.size).toEqual({ preset: 'custom', widthIn: 3.1, heightIn: 0.95 });
  });

  it('clamps to the same envelope the consumer studio offers', () => {
    const big = withSize({ preset: 'custom', widthIn: 999, heightIn: 999 });
    expect(big.size.widthIn).toBe(DESIGN_LIMITS.customWidth.max);
    expect(big.size.heightIn).toBe(DESIGN_LIMITS.customHeight.max);

    const small = withSize({ preset: 'custom', widthIn: -5, heightIn: 0 });
    expect(small.size.widthIn).toBe(DESIGN_LIMITS.customWidth.min);
    expect(small.size.heightIn).toBe(DESIGN_LIMITS.customHeight.min);
  });

  it('falls back to the seed dims when the numbers are junk', () => {
    const d = withSize({ preset: 'custom', widthIn: 'wide', heightIn: null });
    expect(d.size.widthIn).toBe(2.8);
    expect(d.size.heightIn).toBe(0.8);
  });

  it('rounds to hundredths — these become print dimensions', () => {
    expect(withSize({ preset: 'custom', widthIn: 2.86666, heightIn: 0.81111 }).size)
      .toEqual({ preset: 'custom', widthIn: 2.87, heightIn: 0.81 });
  });

  it('isCustomSize identifies only the custom preset', () => {
    expect(isCustomSize('custom')).toBe(true);
    expect(isCustomSize('standard')).toBe(false);
    expect(isCustomSize('zion')).toBe(false);
  });
});

describe('what the renderers receive', () => {
  it('standard sends undefined so renderers draw stock', () => {
    expect(designDims(withSize({ preset: 'standard' }))).toBeUndefined();
  });

  it('custom sends the typed dims through, same path zion uses', () => {
    expect(designDims(withSize({ preset: 'custom', widthIn: 3.1, heightIn: 0.95 })))
      .toEqual({ widthIn: 3.1, heightIn: 0.95 });
    expect(designDims(withSize({ preset: 'zion' })))
      .toEqual({ widthIn: 2.51, heightIn: 0.76 });
  });

  it('the preview aspect follows the custom slot', () => {
    expect(designAspect(withSize({ preset: 'custom', widthIn: 3, heightIn: 1 }))).toBeCloseTo(3, 5);
    expect(designAspect(withSize({ preset: 'standard' }))).toBeUndefined();
  });
});
