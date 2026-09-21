import { describe, it, expect } from 'vitest';
import { resolveEffectiveLabelSize } from './labelSize';
import type { CustomLabelConfig } from '@/lib/labelPresets';

const cfg = (over: Record<string, unknown>) => over as unknown as CustomLabelConfig;

describe('resolveEffectiveLabelSize', () => {
  it('a built-in style prints the standard slab insert', () => {
    expect(resolveEffectiveLabelSize('slab', 'modern', null)).toMatchObject({
      widthIn: 2.8,
      heightIn: 0.8,
      formatted: '2.8″ × 0.8″',
      isStandard: true,
      status: 'supported',
      note: null,
      source: 'standard-slab',
    });
    expect(resolveEffectiveLabelSize('slab', 'traditional', null).status).toBe('supported');
  });

  it('a saved non-standard custom size reports its real dimensions and adapts', () => {
    // Zion Mag Pro: smaller than the standard well in both axes.
    const size = resolveEffectiveLabelSize(
      'slab',
      'custom-2',
      cfg({ style: 'modern', width: 2.51, height: 0.76 }),
    );
    expect(size).toMatchObject({
      widthIn: 2.51,
      heightIn: 0.76,
      formatted: '2.51″ × 0.76″',
      isStandard: false,
      status: 'adapted',
      source: 'custom-config',
    });
    expect(size.note).toContain('2.51″ × 0.76″');
    expect(size.note).toContain('illustrative');
  });

  it('a custom size larger than the standard well is unsupported, not adapted', () => {
    const size = resolveEffectiveLabelSize(
      'slab',
      'custom-3',
      cfg({ style: 'traditional', width: 3.2, height: 1 }),
    );
    expect(size.status).toBe('unsupported');
    expect(size.note).toContain('will not fit a standard slab');
  });

  it('a custom slot saved at exactly standard dimensions is standard', () => {
    expect(
      resolveEffectiveLabelSize('slab', 'custom-1', cfg({ style: 'modern', width: 2.8, height: 0.8 })),
    ).toMatchObject({ isStandard: true, status: 'supported', note: null, source: 'custom-config' });
  });

  it('a config-backed heritage slot prints standard, and says its saved size is not applied', () => {
    const size = resolveEffectiveLabelSize(
      'slab',
      'custom-4',
      cfg({ style: 'heritage', heritagePattern: 'diamond', width: 2.51, height: 0.76 }),
    );
    // The heritage export is called with no `dims`, so it uses STD_DIMS.
    expect(size).toMatchObject({
      widthIn: 2.8,
      heightIn: 0.8,
      isStandard: true,
      status: 'supported',
      source: 'heritage-standard',
    });
    expect(size.note).toContain('2.51″ × 0.76″');
    expect(size.note).toContain('not applied');
  });

  it('the built-in heritage id is plain standard with nothing to say', () => {
    expect(resolveEffectiveLabelSize('slab', 'heritage', null)).toMatchObject({
      source: 'heritage-standard',
      status: 'supported',
      note: null,
    });
  });

  it('the compact holders keep their own Avery stock whatever the style', () => {
    const custom = cfg({ style: 'modern', width: 2.51, height: 0.76 });
    expect(resolveEffectiveLabelSize('toploader', 'custom-2', custom)).toMatchObject({
      widthIn: 1.75,
      heightIn: 0.5,
      source: 'avery-8167',
      status: 'supported',
    });
    expect(resolveEffectiveLabelSize('onetouch', 'heritage', null)).toMatchObject({
      widthIn: 2.375,
      heightIn: 1.25,
      source: 'avery-6871',
      status: 'supported',
    });
  });
});
