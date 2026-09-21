import { describe, it, expect } from 'vitest';
import {
  holderStyleSupport,
  HOLDER_FORMATS,
  HOLDER_SHOP_LINKS,
} from './holderSupport';
import { PRODUCTS } from '@/lib/shopProducts';

describe('holderStyleSupport', () => {
  describe('the slab insert', () => {
    it('honours every built-in style', () => {
      for (const style of ['heritage', 'modern', 'traditional']) {
        expect(holderStyleSupport('slab', style)).toEqual({ status: 'supported', note: null });
      }
    });

    it('honours a saved custom config, including one with grade colours', () => {
      expect(
        holderStyleSupport('slab', 'custom-1', {
          style: 'heritage',
          heritageGradeColors: { '10': '#ff0000' },
        } as never),
      ).toEqual({ status: 'supported', note: null });
    });

    it('honours a non-standard (Zion) custom size', () => {
      expect(
        holderStyleSupport('slab', 'custom-2', {
          style: 'modern',
          width: 2.51,
          height: 0.76,
        } as never),
      ).toEqual({ status: 'supported', note: null });
    });
  });

  describe('the compact Avery holders', () => {
    it('fully supports built-in Heritage, which has no per-grade chip colours', () => {
      for (const holder of ['toploader', 'onetouch'] as const) {
        expect(holderStyleSupport(holder, 'heritage')).toEqual({
          status: 'supported',
          note: null,
        });
      }
    });

    it('adapts a Heritage config that sets per-grade chip colours', () => {
      const config = {
        style: 'heritage',
        heritagePattern: 'diamond',
        heritageGradeColors: { '10': '#123456' },
      } as never;
      for (const holder of ['toploader', 'onetouch'] as const) {
        const support = holderStyleSupport(holder, 'custom-1', config);
        expect(support.status).toBe('adapted');
        expect(support.note).toMatch(/per-grade chip colours/i);
      }
    });

    it('adapts Modern and Traditional, which the Avery generators do not read', () => {
      for (const holder of ['toploader', 'onetouch'] as const) {
        for (const style of ['modern', 'traditional']) {
          const support = holderStyleSupport(holder, style);
          expect(support.status).toBe('adapted');
          expect(support.note).toMatch(/standard compact label/i);
        }
      }
    });

    it('adapts a saved custom design and names the size loss when it is non-standard', () => {
      const support = holderStyleSupport('onetouch', 'custom-3', {
        style: 'modern',
        width: 2.51,
        height: 0.76,
      } as never);
      expect(support.status).toBe('adapted');
      expect(support.note).toMatch(/standard compact label/i);
      expect(support.note).toMatch(/own Avery label size/i);
    });

    it('never returns a status without a reader-facing note', () => {
      const cases: Array<[string, unknown]> = [
        ['modern', null],
        ['traditional', null],
        ['custom-1', { style: 'traditional' }],
      ];
      for (const [style, config] of cases) {
        const support = holderStyleSupport('toploader', style, config as never);
        if (support.status !== 'supported') expect(support.note).toBeTruthy();
      }
    });
  });
});

describe('holder metadata', () => {
  it('names a real physical format for each holder', () => {
    expect(HOLDER_FORMATS.slab).toContain('2.8');
    expect(HOLDER_FORMATS.toploader).toContain('8167');
    expect(HOLDER_FORMATS.onetouch).toContain('6871');
  });

  it('points every shop link at a product that exists', () => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    for (const links of Object.values(HOLDER_SHOP_LINKS)) {
      for (const link of links) {
        const id = link.href.split('#')[1];
        expect(ids.has(id)).toBe(true);
      }
    }
  });
});
