import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
// The app's copy is compared as TEXT below. Importing from dcm-mobile pulls in
// its Expo tsconfig, which CI does not install (this broke CI on Sept 18 2026).
import { computeGuideWidthFraction } from './captureGeometry';
import { rotateCaptureCanvas } from '../../utils/rotateCaptureCanvas';

afterEach(() => vi.unstubAllGlobals());
describe('capture framing and saved rotation', () => {
  it('keeps the web and app copies of the guide geometry identical', () => {
    const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(read('dcm-mobile/lib/captureGeometry.ts')).toBe(read('src/lib/images/captureGeometry.ts'));
  });

  it.each([[800,350], [350,800], [1024,768], [320,240]])('fits the guide inside %s x %s in either card orientation', (w,h) => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const width = w * computeGuideWidthFraction(w,h,orientation);
      const height = width / (orientation === 'portrait' ? 2.5/3.5 : 3.5/2.5);
      expect(width).toBeLessThanOrEqual(w * .88 + 1e-8);
      expect(height).toBeLessThanOrEqual(h * .78 + 1e-8);
    }
  });
  it('rotates saved pixels, preserves the source, and returns to original dimensions after four turns', () => {
    const context = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width:0,height:0,getContext:()=>context }) });
    const source = { width:1200,height:1800 } as HTMLCanvasElement;
    for (let turns = 0; turns <= 4; turns++) {
      const canvas = rotateCaptureCanvas(source, turns);
      expect([canvas.width,canvas.height]).toEqual(turns % 2 ? [1800,1200] : [1200,1800]);
      expect(context.drawImage).toHaveBeenLastCalledWith(source,-600,-900);
    }
    expect([source.width,source.height]).toEqual([1200,1800]);
  });
});
