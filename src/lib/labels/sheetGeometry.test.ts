import { describe, it, expect } from 'vitest'
import {
  resolveSheetGeometry,
  labelPos,
  parseSheetDensity,
  STANDARD_SLAB_GEOMETRY,
  MIN_EDGE_MARGIN_IN,
  INCH,
  PAGE_W_PT,
  PAGE_H_PT,
  UP30_PRESET,
  geometryFromPreset,
  withPrintOptions,
  backPageRotated,
  backPlacement,
} from './sheetGeometry'

describe('resolveSheetGeometry — standard (10 per sheet)', () => {
  const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'standard' })

  it('reproduces the pre-existing module constants exactly', () => {
    // The numbers vectorSlabGenerator.tsx / slabLabelGenerator.ts hard-coded:
    //   LABEL_W 201.6, LABEL_H 57.6, CUT_MARGIN 18,
    //   CELL_W 237.6, CELL_H 93.6, GRID_START_X 68.4, GRID_START_Y 162
    expect(g.labelW).toBe(201.6)
    expect(g.labelH).toBeCloseTo(57.6, 10)
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(5)
    expect(g.labelsPerPage).toBe(10)
    expect(g.cellW).toBe(237.6)
    expect(g.cellH).toBeCloseTo(93.6, 10)
    expect(g.gapX).toBe(36)
    expect(g.gapY).toBe(36)
    expect(g.gridStartX).toBeCloseTo(68.4, 10)
    expect(g.gridStartY).toBeCloseTo(162, 10)
  })

  it('places labels exactly where the old gridPos() did', () => {
    // old: x = GRID_START_X + useCol * CELL_W + CUT_MARGIN
    //      y = GRID_START_Y + row * CELL_H + CUT_MARGIN
    for (let i = 0; i < 10; i++) {
      for (const mirrored of [false, true]) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const useCol = mirrored ? 1 - col : col
        const expected = {
          x: 68.4 + useCol * 237.6 + 18,
          y: 162 + row * 93.6 + 18,
        }
        const got = labelPos(g, i, mirrored)
        expect(got.x).toBeCloseTo(expected.x, 10)
        expect(got.y).toBeCloseTo(expected.y, 10)
      }
    }
  })

  it('is the exported STANDARD_SLAB_GEOMETRY', () => {
    expect(STANDARD_SLAB_GEOMETRY).toEqual(g)
  })
})

describe('resolveSheetGeometry — dense (20 per sheet)', () => {
  it('2.8" × 0.8" → 10 rows, 3/8" top and bottom margin', () => {
    const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'dense' })
    expect(g.rows).toBe(10)
    expect(g.labelsPerPage).toBe(20)
    expect(g.gapY).toBe(0.25 * INCH)
    expect(g.firstLabelY).toBeCloseTo(0.375 * INCH, 10)
    expect(g.marginTopIn).toBeCloseTo(0.375, 10)
    expect(g.marginBottomIn).toBeCloseTo(0.375, 10)

    const last = labelPos(g, 19, false)
    expect(last.y + g.labelH).toBeCloseTo(11 * INCH - 0.375 * INCH, 10)

    // Horizontal geometry is untouched by density.
    const std = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'standard' })
    expect(g.gridStartX).toBeCloseTo(std.gridStartX, 10)
    expect(g.cellW).toBeCloseTo(std.cellW, 10)
    expect(labelPos(g, 0, false).x).toBeCloseTo(labelPos(std, 0, false).x, 10)

    expect(g.summary).toBe('20 per sheet · 2.8" × 0.8" · 3/8" top and bottom margin')
  })

  it('Zion Mag Pro 2.51" × 0.76" → 10 rows, 0.575" margins', () => {
    const g = resolveSheetGeometry({ labelWIn: 2.51, labelHIn: 0.76, density: 'dense' })
    expect(g.rows).toBe(10)
    expect(g.labelsPerPage).toBe(20)
    expect(g.marginTopIn).toBeCloseTo(0.575, 10)
    expect(g.marginBottomIn).toBeCloseTo(0.575, 10)
    expect(g.firstLabelY).toBeCloseTo(0.575 * INCH, 10)
    const last = labelPos(g, 19, false)
    expect(last.y + g.labelH).toBeCloseTo(11 * INCH - 0.575 * INCH, 10)
  })

  it('gap between two stacked labels is exactly 0.25"', () => {
    for (const h of [0.8, 0.76]) {
      const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: h, density: 'dense' })
      const a = labelPos(g, 0, false)
      const b = labelPos(g, 2, false)
      expect(b.y - (a.y + g.labelH)).toBeCloseTo(0.25 * INCH, 10)
    }
  })

  it('a 0.9" label falls back to fewer rows and says so', () => {
    const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.9, density: 'dense' })
    expect(g.rows).toBe(9)
    expect(g.labelsPerPage).toBe(18)
    expect(g.marginTopIn).toBeGreaterThanOrEqual(MIN_EDGE_MARGIN_IN)
    expect(g.summary).toContain('9 rows')
  })

  it('every dense layout keeps at least a 0.3" top and bottom margin', () => {
    for (let h = 0.4; h <= 1.6; h += 0.01) {
      const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: Math.round(h * 100) / 100, density: 'dense' })
      expect(g.marginTopIn).toBeGreaterThanOrEqual(MIN_EDGE_MARGIN_IN - 1e-9)
      expect(g.marginBottomIn).toBeGreaterThanOrEqual(MIN_EDGE_MARGIN_IN - 1e-9)
      expect(g.labelsPerPage).toBe(g.cols * g.rows)
      expect(g.rows).toBeLessThanOrEqual(10)
      expect(g.rows).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('parseSheetDensity', () => {
  it('accepts dense and 20, defaults to standard', () => {
    expect(parseSheetDensity('dense')).toBe('dense')
    expect(parseSheetDensity('20')).toBe('dense')
    expect(parseSheetDensity('DENSE')).toBe('dense')
    expect(parseSheetDensity('10')).toBe('standard')
    expect(parseSheetDensity(null)).toBe('standard')
    expect(parseSheetDensity(undefined)).toBe('standard')
    expect(parseSheetDensity('nonsense')).toBe('standard')
  })
})

// ---------------------------------------------------------------------------
// Regression pin: every label position of the historic 10-up and 20-up sheets
// (front + mirrored back) must stay exactly where it printed before the
// layout presets / duplex options existed. Values in points.
// ---------------------------------------------------------------------------
describe('regression — standard and dense positions are unchanged', () => {
  const cases: Array<[string, number, number, 'standard' | 'dense', number[][]]> = [
    ['standard 2.8x0.8', 2.8, 0.8, 'standard', [
      [86.4, 180], [324, 180], [86.4, 273.6], [324, 273.6], [86.4, 367.2],
      [324, 367.2], [86.4, 460.8], [324, 460.8], [86.4, 554.4], [324, 554.4],
    ]],
    ['dense 2.8x0.8', 2.8, 0.8, 'dense', Array.from({ length: 20 }, (_, i) => [
      i % 2 === 0 ? 86.4 : 324, 27 + Math.floor(i / 2) * 75.6,
    ])],
    ['dense zion 2.51x0.76', 2.51, 0.76, 'dense', Array.from({ length: 20 }, (_, i) => [
      i % 2 === 0 ? 107.28 : 324, 41.4 + Math.floor(i / 2) * 72.72,
    ])],
  ]
  for (const [name, w, h, density, expected] of cases) {
    it(name, () => {
      const g = resolveSheetGeometry({ labelWIn: w, labelHIn: h, density })
      expected.forEach(([ex, ey], i) => {
        const p = labelPos(g, i, false)
        expect(p.x).toBeCloseTo(ex, 9)
        expect(p.y).toBeCloseTo(ey, 9)
        const m = labelPos(g, i, true)
        const mex = expected[i % 2 === 0 ? i + 1 : i - 1][0]
        expect(m.x).toBeCloseTo(mex, 9)
        expect(m.y).toBeCloseTo(ey, 9)
      })
      // Default print options are a no-op.
      expect(g.duplexFlip).toBe('long')
      expect(g.offsets).toEqual({ frontX: 0, frontY: 0, backX: 0, backY: 0 })
      expect(g.perforated).toBe(false)
      expect(withPrintOptions(g, density)).toBe(g)
    })
  }
})

describe('up30 — 30 per sheet (Avery 5160 geometry)', () => {
  const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30' })

  it('is 3 × 10 of 2.625" × 1" with 0.5" top, 0.1875" left, 0.125" column gap, no row gap', () => {
    expect(g.cols).toBe(3)
    expect(g.rows).toBe(10)
    expect(g.labelsPerPage).toBe(30)
    expect(g.labelW).toBeCloseTo(2.625 * INCH, 10)
    expect(g.labelH).toBeCloseTo(1 * INCH, 10)
    expect(g.gapX).toBeCloseTo(0.125 * INCH, 10)
    expect(g.gapY).toBe(0)
    expect(g.firstLabelX).toBeCloseTo(0.1875 * INCH, 10)
    expect(g.firstLabelY).toBeCloseTo(0.5 * INCH, 10)
    expect(g.marginTopIn).toBe(0.5)
    expect(g.marginBottomIn).toBe(0.5)
    expect(g.perforated).toBe(true)
    expect(g.maxBleedY).toBe(0)
    expect(g.maxBleedX).toBeCloseTo(0.0625 * INCH, 10)
    expect(parseSheetDensity('30')).toBe('up30')
    expect(parseSheetDensity('up30')).toBe('up30')
    expect(parseSheetDensity('avery5160')).toBe('up30')
  })

  it('places every label on the 5160 grid, ignoring the design size', () => {
    const other = resolveSheetGeometry({ labelWIn: 2.51, labelHIn: 0.76, density: 'up30' })
    for (let i = 0; i < 30; i++) {
      const col = i % 3
      const row = Math.floor(i / 3)
      const p = labelPos(g, i, false)
      expect(p.x).toBeCloseTo((0.1875 + col * 2.75) * INCH, 9)
      expect(p.y).toBeCloseTo((0.5 + row) * INCH, 9)
      expect(labelPos(other, i, false)).toEqual(p)
    }
    const last = labelPos(g, 29, false)
    expect((last.x + g.labelW) / INCH).toBeCloseTo(8.5 - 0.1875, 9)
    expect((last.y + g.labelH) / INCH).toBeCloseTo(10.5, 9)
  })

  it('long-edge backs mirror the 3 columns (col 0 <-> col 2, middle stays)', () => {
    for (let i = 0; i < 30; i++) {
      const f = labelPos(g, i, false)
      const b = labelPos(g, i, true)
      // Behind the front once the sheet is flipped over its long (vertical) edge.
      expect(b.x).toBeCloseTo(PAGE_W_PT - f.x - g.labelW, 9)
      expect(b.y).toBeCloseTo(f.y, 9)
    }
  })

  it('short-edge backs land behind the front after the page turn', () => {
    const s = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30', duplexFlip: 'short' })
    expect(backPageRotated(s)).toBe(true)
    for (let i = 0; i < 30; i++) {
      const f = labelPos(s, i, false)
      const b = backPlacement(s, i, s.labelW, s.labelH)
      // Flipped over the short (horizontal) edge: same x, y reflected.
      expect(b.rotate180).toBe(true)
      expect(b.x).toBeCloseTo(f.x, 9)
      expect(b.y).toBeCloseTo(PAGE_H_PT - f.y - s.labelH, 9)
    }
  })

  it('calibration: global shifts both pages, back shifts backs only, in printed coordinates', () => {
    const offsetsIn = { globalX: 0.02, globalY: -0.03, backX: 0.05, backY: 0.01 }
    for (const duplexFlip of ['long', 'short'] as const) {
      const base = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30', duplexFlip })
      const cal = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30', duplexFlip, offsetsIn })
      for (const i of [0, 4, 29]) {
        const f0 = labelPos(base, i, false)
        const f1 = labelPos(cal, i, false)
        expect(f1.x - f0.x).toBeCloseTo(0.02 * INCH, 9)
        expect(f1.y - f0.y).toBeCloseTo(-0.03 * INCH, 9)
        const b0 = backPlacement(base, i, base.labelW, base.labelH)
        const b1 = backPlacement(cal, i, cal.labelW, cal.labelH)
        expect(b1.x - b0.x).toBeCloseTo(0.07 * INCH, 9)
        expect(b1.y - b0.y).toBeCloseTo(-0.02 * INCH, 9)
      }
    }
  })

  it('geometryFromPreset rejects a grid that does not fit on Letter', () => {
    expect(() => geometryFromPreset({ ...UP30_PRESET, cols: 4 })).toThrow()
  })
})
