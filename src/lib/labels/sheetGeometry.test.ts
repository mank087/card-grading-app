import { describe, it, expect } from 'vitest'
import {
  resolveSheetGeometry,
  labelPos,
  parseSheetDensity,
  STANDARD_SLAB_GEOMETRY,
  MIN_EDGE_MARGIN_IN,
  INCH,
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
