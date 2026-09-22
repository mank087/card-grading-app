import { readFileSync } from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import {
  holderStyleSupport,
  HOLDER_FORMATS,
  HOLDER_SHOP_LINKS,
} from './holderSupport';

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

    /**
     * Owner review item 4: the Avery generators draw the DCM STANDARD compact
     * label, and Modern and Traditional share that one compact design. Nothing
     * the reader chose is dropped, so there is nothing to warn them about.
     */
    it('fully supports Modern and Traditional — the compact sheet is their design', () => {
      for (const holder of ['toploader', 'onetouch'] as const) {
        for (const style of ['modern', 'traditional', 'classic', null, undefined]) {
          expect(holderStyleSupport(holder, style)).toEqual({
            status: 'supported',
            note: null,
          });
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
      expect(support.note).toMatch(/standard DCM compact label/i);
      expect(support.note).toMatch(/own Avery label size/i);
    });

    it('adapts a saved custom design at the standard size, without a size note', () => {
      const support = holderStyleSupport('toploader', 'custom-1', {
        style: 'modern',
      } as never);
      expect(support.status).toBe('adapted');
      expect(support.note).toMatch(/standard DCM compact label/i);
      expect(support.note).not.toMatch(/own Avery label size/i);
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

  /**
   * Owner review items 2 and 3: the wording is the owner's, exactly, and one
   * link per holder — the slab goes to the shop's slabs-and-cases area, the
   * two compact holders go to its label stock.
   */
  it('uses the owner’s wording, one shop link per holder', () => {
    expect(HOLDER_SHOP_LINKS.slab).toEqual([
      { label: 'See Recommended Slabs and Cases', href: '/shop#holders' },
    ]);
    expect(HOLDER_SHOP_LINKS.toploader).toEqual([
      { label: 'Shop Labels', href: '/shop#labels' },
    ]);
    expect(HOLDER_SHOP_LINKS.onetouch).toEqual([
      { label: 'Shop Labels', href: '/shop#labels' },
    ]);
  });

  it('points every shop link at an anchor the shop page actually renders', () => {
    const shop = readFileSync(
      path.resolve(__dirname, '../../app/shop/page.tsx'),
      'utf8',
    );
    for (const links of Object.values(HOLDER_SHOP_LINKS)) {
      for (const link of links) {
        const anchor = link.href.split('#')[1];
        // Either a section id / aliasId in the `sections` table, or a product
        // id, which the page renders as `<article id={product.id}>`.
        expect(
          shop.includes(`id: '${anchor}'`) || shop.includes(`aliasId: '${anchor}'`),
          `${link.href} has no anchor on /shop`,
        ).toBe(true);
      }
    }
  });
});
