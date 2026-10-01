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
  UP26_PRESET,
  UP30_PRESET,
  up26Preset,
  geometryFromPreset,
  withPrintOptions,
  slotPlacement,
  backCellBehind,
  backRotationDeg,
  designToPage,
  perforationLinesIn,
  type SheetGeometry,
  type DuplexFlip,
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


// ---------------------------------------------------------------------------
// True-size pre-perforated layouts (Sept 30 2026): slab labels are ALWAYS
// 2.8" × 0.8" — the Sept 28 Avery-5160-geometry 30-up (2.625" × 1", design
// scaled to 93.75%) is gone.
// ---------------------------------------------------------------------------
const DW = 2.8 * INCH
const DH = 0.8 * INCH
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('up26 — 26 per sheet, true size, upright', () => {
  const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up26' })

  it('is 2 × 13 of exactly 2.8" × 0.8", 1.45" left/right, 0.3" top/bottom, no gaps', () => {
    expect(g.cols).toBe(2)
    expect(g.rows).toBe(13)
    expect(g.labelsPerPage).toBe(26)
    expect(g.labelW).toBeCloseTo(DW, 10)
    expect(g.labelH).toBeCloseTo(DH, 10)
    expect(g.designW).toBeCloseTo(DW, 10)
    expect(g.designH).toBeCloseTo(DH, 10)
    expect(g.labelRotation).toBe(0)
    expect(g.gapX).toBe(0)
    expect(g.gapY).toBe(0)
    expect(g.firstLabelX / INCH).toBeCloseTo(1.45, 10)
    expect(g.firstLabelY / INCH).toBeCloseTo(0.3, 10)
    expect(g.marginBottomIn).toBeCloseTo(0.3, 10)
    expect(g.perforated).toBe(true)
    for (let i = 0; i < 26; i++) {
      const p = slotPlacement(g, i, 'front')
      expect(p.x / INCH).toBeCloseTo(1.45 + (i % 2) * 2.8, 9)
      expect(p.y / INCH).toBeCloseTo(0.3 + Math.floor(i / 2) * 0.8, 9)
      expect(p.w).toBeCloseTo(DW, 10)
      expect(p.h).toBeCloseTo(DH, 10)
      expect(p.rotation).toBe(0)
    }
    const last = slotPlacement(g, 25, 'front')
    expect((last.x + last.w) / INCH).toBeCloseTo(8.5 - 1.45, 9)
    expect((last.y + last.h) / INCH).toBeCloseTo(11 - 0.3, 9)
    expect(UP26_PRESET.colGapIn).toBe(0)
  })

  it('a configurable column gap keeps the block centred', () => {
    const p = up26Preset(0.125)
    expect(p.marginLeftIn).toBeCloseTo((8.5 - 5.6 - 0.125) / 2, 9)
    const gg = geometryFromPreset(p, { density: 'up26' })
    const right = slotPlacement(gg, 1, 'front')
    expect((PAGE_W_PT - right.x - right.w) / INCH).toBeCloseTo(p.marginLeftIn, 9)
    // Long-edge backs still land on a slot of the same grid.
    const b = slotPlacement(gg, 0, 'back')
    expect(b.x).toBeCloseTo(right.x, 9)
  })
})

describe('up30 — 30 per sheet, true size, SIDEWAYS', () => {
  const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30' })

  it('is 10 × 3 of 2.8" × 0.8" turned 90° (0.8" × 2.8" footprints), 0.25" sides, 1.3" top/bottom', () => {
    expect(g.cols).toBe(10)
    expect(g.rows).toBe(3)
    expect(g.labelsPerPage).toBe(30)
    expect(g.labelW).toBeCloseTo(DH, 10) // footprint width = label height
    expect(g.labelH).toBeCloseTo(DW, 10)
    expect(g.designW).toBeCloseTo(DW, 10) // the design itself is never scaled
    expect(g.designH).toBeCloseTo(DH, 10)
    expect(g.labelRotation).toBe(90)
    expect(g.gapX).toBe(0)
    expect(g.gapY).toBe(0)
    expect(g.maxBleedX).toBe(0)
    expect(g.maxBleedY).toBe(0)
    for (let i = 0; i < 30; i++) {
      const p = slotPlacement(g, i, 'front')
      expect(p.x / INCH).toBeCloseTo(0.25 + (i % 10) * 0.8, 9)
      expect(p.y / INCH).toBeCloseTo(1.3 + Math.floor(i / 10) * 2.8, 9)
      expect(p.rotation).toBe(90)
    }
    const last = slotPlacement(g, 29, 'front')
    expect((last.x + last.w) / INCH).toBeCloseTo(8.25, 9)
    expect((last.y + last.h) / INCH).toBeCloseTo(9.7, 9)
    expect(g.marginTopIn).toBeCloseTo(1.3, 10)
    expect(g.marginBottomIn).toBeCloseTo(1.3, 10)
    expect(g.summary).toBe('30 per sheet · 2.8" × 0.8" true size, sideways')
  })

  it('a rotated 2.8" × 0.8" design exactly fills the footprint (corners land on its corners)', () => {
    for (const side of ['front', 'back'] as const) {
      for (const flip of ['long', 'short'] as const) {
        const gg = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30', duplexFlip: flip })
        const p = slotPlacement(gg, 13, side)
        const xs = [[0, 0], [DW, 0], [0, DH], [DW, DH]].map(([u, v]) => designToPage(gg, p, u, v))
        expect(Math.min(...xs.map(q => q.x))).toBeCloseTo(p.x, 9)
        expect(Math.max(...xs.map(q => q.x))).toBeCloseTo(p.x + p.w, 9)
        expect(Math.min(...xs.map(q => q.y))).toBeCloseTo(p.y, 9)
        expect(Math.max(...xs.map(q => q.y))).toBeCloseTo(p.y + p.h, 9)
      }
    }
  })

  it('front reads top-to-bottom with the label top toward the sheet RIGHT edge', () => {
    const p = slotPlacement(g, 0, 'front')
    const left = designToPage(g, p, 0, DH / 2)
    const right = designToPage(g, p, DW, DH / 2)
    const top = designToPage(g, p, DW / 2, 0)
    expect(right.y).toBeGreaterThan(left.y) // reading direction = down the sheet
    expect(top.x).toBeCloseTo(p.x + p.w, 9) // top edge on the right of the footprint
  })
})

describe('parseSheetDensity — true-size values', () => {
  it('26 / 30 (and the old 30-up aliases, so bookmarks keep working)', () => {
    expect(parseSheetDensity('26')).toBe('up26')
    expect(parseSheetDensity('up26')).toBe('up26')
    expect(parseSheetDensity('30')).toBe('up30')
    expect(parseSheetDensity('up30')).toBe('up30')
    expect(parseSheetDensity('30up')).toBe('up30')
    expect(parseSheetDensity('avery5160')).toBe('up30')
  })
})

describe('true-size duplex — which slot, which rotation', () => {
  it('back rotation: long = -front, short = 180 - front', () => {
    expect(backRotationDeg(0, 'long')).toBe(0)
    expect(backRotationDeg(0, 'short')).toBe(180)
    expect(backRotationDeg(90, 'long')).toBe(270)
    expect(backRotationDeg(90, 'short')).toBe(90)
  })

  const layouts = [
    ['up26', 2, 13] as const,
    ['up30', 10, 3] as const,
  ]
  for (const [density, cols, rows] of layouts) {
    for (const flip of ['long', 'short'] as const) {
      it(`${density} ${flip}-edge: each back sits on the mirrored grid cell`, () => {
        const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density, duplexFlip: flip })
        const seen = new Set<number>()
        for (let i = 0; i < cols * rows; i++) {
          const r = Math.floor(i / cols)
          const c = i % cols
          const expected = flip === 'long' ? { row: r, col: cols - 1 - c } : { row: rows - 1 - r, col: c }
          expect(backCellBehind(g, r, c)).toEqual(expected)
          const b = slotPlacement(g, i, 'back')
          expect({ row: b.row, col: b.col }).toEqual(expected)
          expect(b.slot).toBe(expected.row * cols + expected.col)
          // ...and the back rectangle IS that cell of the grid (grid is page-centred).
          const cell = slotPlacement(g, b.slot, 'front')
          expect(b.x).toBeCloseTo(cell.x, 9)
          expect(b.y).toBeCloseTo(cell.y, 9)
          expect(b.w).toBeCloseTo(cell.w, 9)
          expect(b.h).toBeCloseTo(cell.h, 9)
          seen.add(b.slot)
        }
        expect(seen.size).toBe(cols * rows) // a permutation: every back slot used once
      })
    }
  }
})

/**
 * Physical simulation, independent of the rotation formula: a point printed
 * at design coords (u, v) on the FRONT is, after the cut label is turned
 * over about its own vertical axis, seen at back design coords (DW - u, v).
 * That back point must be printed exactly behind the front point, i.e. at
 * the sheet-flip image of the front point: long edge (x, y) -> (W - x, y),
 * short edge (x, y) -> (x, H - y).
 */
function sheetFlip(flip: DuplexFlip, q: { x: number; y: number }) {
  return flip === 'short' ? { x: q.x, y: PAGE_H_PT - q.y } : { x: PAGE_W_PT - q.x, y: q.y }
}

describe('true-size duplex — a cut label turned over left-to-right reads upright', () => {
  const samples: Array<[number, number]> = [
    [0, 0], [DW, 0], [0, DH], [DW, DH], [12.5, 7], [150, 40], [DW / 2, DH / 2],
  ]
  for (const density of ['up26', 'up30'] as const) {
    for (const flip of ['long', 'short'] as const) {
      it(`${density} ${flip}-edge`, () => {
        const g: SheetGeometry = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density, duplexFlip: flip })
        for (let i = 0; i < g.labelsPerPage; i++) {
          const f = slotPlacement(g, i, 'front')
          const b = slotPlacement(g, i, 'back')
          for (const [u, v] of samples) {
            const behind = sheetFlip(flip, designToPage(g, f, u, v))
            const printed = designToPage(g, b, DW - u, v)
            expect(near(printed.x, behind.x) && near(printed.y, behind.y)).toBe(true)
          }
        }
      })
    }
  }

  it('the WRONG flip setting would put the back upside down (the test can fail)', () => {
    // Backs computed for long edge, sheet actually flipped on the short edge.
    const g = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30', duplexFlip: 'long' })
    const f = slotPlacement(g, 0, 'front')
    const b = slotPlacement(g, 0, 'back')
    const behind = sheetFlip('short', designToPage(g, f, 10, 10))
    const printed = designToPage(g, b, DW - 10, 10)
    expect(near(printed.x, behind.x) && near(printed.y, behind.y)).toBe(false)
  })
})

describe('true-size calibration offsets', () => {
  const offsetsIn = { globalX: 0.02, globalY: -0.03, backX: 0.05, backY: 0.01 }
  for (const density of ['up26', 'up30'] as const) {
    for (const duplexFlip of ['long', 'short'] as const) {
      it(`${density} ${duplexFlip}: global moves both sides, back moves backs, in printed coordinates`, () => {
        const base = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density, duplexFlip })
        const cal = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density, duplexFlip, offsetsIn })
        for (const i of [0, 7, base.labelsPerPage - 1]) {
          const f0 = slotPlacement(base, i, 'front')
          const f1 = slotPlacement(cal, i, 'front')
          expect(f1.x - f0.x).toBeCloseTo(0.02 * INCH, 9)
          expect(f1.y - f0.y).toBeCloseTo(-0.03 * INCH, 9)
          const b0 = slotPlacement(base, i, 'back')
          const b1 = slotPlacement(cal, i, 'back')
          expect(b1.x - b0.x).toBeCloseTo(0.07 * INCH, 9)
          expect(b1.y - b0.y).toBeCloseTo(-0.02 * INCH, 9)
          expect(b1.rotation).toBe(b0.rotation)
        }
      })
    }
  }
})

describe('true-size perforation lines', () => {
  it('up30: 11 vertical (0.25" to 8.25", 0.8" apart), 4 horizontal (1.3, 4.1, 6.9, 9.7)', () => {
    const l = perforationLinesIn(resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up30' }))
    expect(l.verticalIn).toEqual(Array.from({ length: 11 }, (_, i) => Math.round((0.25 + i * 0.8) * 1e4) / 1e4))
    expect(l.horizontalIn).toEqual([1.3, 4.1, 6.9, 9.7])
  })
  it('up26: 3 vertical (1.45, 4.25, 7.05), 14 horizontal (0.3" to 10.7", 0.8" apart)', () => {
    const l = perforationLinesIn(resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density: 'up26' }))
    expect(l.verticalIn).toEqual([1.45, 4.25, 7.05])
    expect(l.horizontalIn).toEqual(Array.from({ length: 14 }, (_, i) => Math.round((0.3 + i * 0.8) * 1e4) / 1e4))
  })
  it('geometryFromPreset rejects a grid that does not fit on Letter', () => {
    expect(() => geometryFromPreset({ ...UP30_PRESET, cols: 11 })).toThrow()
    expect(() => geometryFromPreset({ ...UP26_PRESET, rows: 14 })).toThrow()
  })
})
