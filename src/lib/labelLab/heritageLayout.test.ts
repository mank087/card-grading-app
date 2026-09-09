/**
 * heritageGeometry is the enterprise Label Designer's whole safety story: the
 * document is a set of bounded choices, and this is where they become rects.
 * Two things are worth pinning down here.
 *
 * 1. ISOLATION. With no document — every consumer card, every org that never
 *    opened the designer — the output must be the historic HERITAGE_PX numbers
 *    exactly. The literals below were captured from the code BEFORE the
 *    band-'none' / big-logo / serial-placement work landed, so this test fails
 *    if any of that leaked into the stock path. (scripts/label-design-snapshot
 *    holds the RENDERERS to the same line, byte for byte.)
 *
 * 2. The new options can't print over each other: the mark must stay inside
 *    the content rect and clear of the chip, the text column and the serial.
 */
import { describe, it, expect } from 'vitest'
import {
  heritageGeometry,
  heritageMarkBox,
  heritageLogoScaleMax,
  fitHeritageFront,
  HERITAGE_PX,
} from './heritageLayout'
import { defaultOrgLabelDesign, normalizeOrgLabelDesign, type OrgLabelDesign } from '@/lib/labels/orgLabelDesign'

/** Captured from the pre-change implementation — do not "update to match". */
const STOCK = {
  outer: { x: 0, y: 0, w: 1400, h: 400 },
  border: null,
  band: { x: 0, y: 0, w: 90, h: 400, position: 'left', horizontal: false },
  rule: { x: 90, y: 0, w: 6, h: 400 },
  content: { x: 96, y: 0, w: 1304, h: 400 },
  text: { x: 150, y: 50, w: 940, maxBottom: 388, scale: 1 },
  chip: { x: 1130, y: 64, w: 240, h: 252, r: 28, bw: 6, scale: 1 },
  barTop: 341,
  barLeft: 438,
}

const design = (edit: (d: OrgLabelDesign) => void): OrgLabelDesign => {
  const d = defaultOrgLabelDesign()
  edit(d)
  return normalizeOrgLabelDesign(d)
}

const SAMPLE = { name: 'Aaron Judge', ctx: 'Bowman Chrome • #99 • 2023', serial: 'KK442921' }
const fitFor = (g: ReturnType<typeof heritageGeometry>) => fitHeritageFront(SAMPLE.name, SAMPLE.ctx, SAMPLE.serial, g)

describe('stock geometry is frozen', () => {
  for (const [label, d] of [['no document', null], ['default document', defaultOrgLabelDesign()]] as const) {
    it(`${label} produces the historic rects`, () => {
      const g = heritageGeometry(d)
      expect(g.W).toBe(1400)
      expect(g.H).toBe(400)
      expect(g.outer).toEqual(STOCK.outer)
      expect(g.border).toBe(STOCK.border)
      expect(g.band).toEqual(STOCK.band)
      expect(g.rule).toEqual(STOCK.rule)
      expect(g.content).toEqual(STOCK.content)
      expect(g.text).toEqual(STOCK.text)
      expect(g.chip).toEqual(STOCK.chip)
      expect(g.barTop).toBe(STOCK.barTop)
      expect(g.barLeft).toBe(STOCK.barLeft)
      expect(g.logo).toEqual({ zone: 'bottom', column: null, scale: 1, offset: { x: 0, y: 0 }, accentRules: true })
      // New field, and the stock label must never have one.
      expect(g.serial).toBeNull()
      expect(g.stock).toBe(true)
    })
  }

  it('a side-column design with the band ON keeps the historic square column', () => {
    // The band-off widening must not have touched this path.
    const g = heritageGeometry(design(d => { d.logo.zone = 'left'; d.logo.scale = 1.5 }))
    expect(g.logo.column).toEqual({ x: 126, y: 24, w: 352, h: 352 })
    const box = heritageMarkBox(1.5, fitFor(g), g)
    expect(box.w).toBe(352)
    expect(box.h).toBe(352)
  })
})

describe('band position "none"', () => {
  it('gives the content the whole outer box and no rule', () => {
    const g = heritageGeometry(design(d => { d.band.position = 'none' }))
    expect(g.content.x).toBe(g.outer.x)
    expect(g.content.y).toBe(g.outer.y)
    expect(g.content.w).toBe(g.outer.w)
    expect(g.content.h).toBe(g.outer.h)
    expect(g.band.w).toBe(0)
    expect(g.rule.w).toBe(0)
    expect(g.rule.h).toBe(0)
    expect(g.stock).toBe(false)
  })

  it('respects the border inset when a border is on', () => {
    const g = heritageGeometry(design(d => {
      d.band.position = 'none'
      d.border = { enabled: true, color: '#101014', width: 0.02, inset: 0.05 }
    }))
    // outer = label minus (inset + stroke) on every side; content === outer.
    expect(g.outer.x).toBeGreaterThan(0)
    expect(g.content).toEqual(g.outer)
    expect(g.rule.w).toBe(0)
  })

  it('keeps the pattern, colours and width in the document for switching back', () => {
    const d = design(x => {
      x.band.pattern = 'chevron'
      x.band.colorSource = 'custom'
      x.band.colors = ['#112233', '#445566']
      x.band.width = 1.4
      x.band.position = 'none'
    })
    expect(d.band).toEqual({ position: 'none', pattern: 'chevron', colorSource: 'custom', colors: ['#112233', '#445566'], width: 1.4 })
  })
})

describe('a big side logo with the band off', () => {
  for (const zone of ['left', 'right'] as const) {
    it(`${zone} column at 2.2x stays inside the content and clear of everything`, () => {
      const d = design(x => { x.band.position = 'none'; x.logo.zone = zone; x.logo.scale = 2.2 })
      expect(d.logo.scale).toBe(2.2)   // the wider cap is actually reachable
      const g = heritageGeometry(d)
      const col = g.logo.column!
      const box = heritageMarkBox(g.logo.scale, fitFor(g), g)

      // Inside the content rect.
      expect(box.x).toBeGreaterThanOrEqual(g.content.x)
      expect(box.y).toBeGreaterThanOrEqual(g.content.y)
      expect(box.x + box.w).toBeLessThanOrEqual(g.content.x + g.content.w)
      expect(box.y + box.h).toBeLessThanOrEqual(g.content.y + g.content.h)

      // Genuinely bigger than the banded ceiling (352px square).
      expect(box.w).toBeGreaterThan(352)
      expect(box.h).toBeGreaterThan(352 * 0.9)

      // Clear of the chip, and of the text column on both sides.
      expect(box.x + box.w).toBeLessThanOrEqual(g.chip.x)
      if (zone === 'left') expect(g.text.x).toBeGreaterThanOrEqual(col.x + col.w)
      else expect(g.text.x + g.text.w).toBeLessThanOrEqual(col.x)
      // The text column keeps a readable width.
      expect(g.text.w).toBeGreaterThanOrEqual(400)
    })
  }

  it('the slider ceiling rises only when the band is off', () => {
    const off = heritageGeometry(design(x => { x.band.position = 'none'; x.logo.zone = 'left'; x.logo.scale = 1 }))
    const on = heritageGeometry(design(x => { x.logo.zone = 'left'; x.logo.scale = 1 }))
    expect(heritageLogoScaleMax(on, fitFor(on))).toBeLessThanOrEqual(1.5)
    expect(heritageLogoScaleMax(off, fitFor(off))).toBeGreaterThan(1.5)
  })

  it('a banded document cannot store a side scale above 1.5', () => {
    expect(design(x => { x.logo.zone = 'left'; x.logo.scale = 2.2 }).logo.scale).toBe(1.5)
  })
})

describe('serial under the grade chip', () => {
  const d = design(x => { x.text.serialPlacement = 'chip' })
  const g = heritageGeometry(d)

  it('produces a serial rect below the chip and above the content bottom', () => {
    expect(g.serial).not.toBeNull()
    const s = g.serial!
    expect(s.y).toBeGreaterThanOrEqual(g.chip.y + g.chip.h)
    expect(s.y + s.h).toBeLessThanOrEqual(g.content.y + g.content.h)
    // Centred on the chip, and never wider than the content can hold.
    expect(s.x + s.w / 2).toBeCloseTo(g.chip.x + g.chip.w / 2, 6)
    expect(s.w).toBeGreaterThanOrEqual(g.chip.w)
    expect(s.x).toBeGreaterThanOrEqual(g.content.x)
    expect(s.x + s.w).toBeLessThanOrEqual(g.content.x + g.content.w)
  })

  it('keeps the chip inside the content box, never past the top margin', () => {
    expect(g.chip.y).toBeGreaterThanOrEqual(g.content.y)
    expect(g.chip.y + g.chip.h).toBeLessThanOrEqual(g.content.y + g.content.h)
  })

  it('caps the chip scale rather than clipping the serial', () => {
    const big = heritageGeometry(design(x => { x.text.serialPlacement = 'chip'; x.chip.scale = 1.1 }))
    const s = big.serial!
    expect(s.y + s.h).toBeLessThanOrEqual(big.content.y + big.content.h)
    expect(big.chip.h).toBeLessThanOrEqual(big.content.h - 32 - (s.h + 14))
  })

  it('hands the freed row back to the text stack', () => {
    const stack = heritageGeometry(defaultOrgLabelDesign())
    const withSerial = fitHeritageFront(SAMPLE.name, SAMPLE.ctx, SAMPLE.serial, stack)
    const without = fitHeritageFront(SAMPLE.name, SAMPLE.ctx, SAMPLE.serial, g)
    // One fewer row in the stack: the divider is now the last thing in it.
    expect(without.textBottom).toBeLessThan(withSerial.textBottom)
    expect(withSerial.textBottom - without.textBottom).toBeCloseTo(18 + 34 * 1.2, 5)
    // Nothing on the left for the accent bars to run into any more.
    expect(without.serialRight).toBe(Number.NEGATIVE_INFINITY)
    expect(without.serialTop).toBe(without.textBottom)
  })
})

describe("the customer's design (no band, big left logo, serial under the chip)", () => {
  it('lays out without a collision', () => {
    const g = heritageGeometry(design(x => {
      x.band.position = 'none'
      x.logo.zone = 'left'
      x.logo.scale = 2.2
      x.text.serialPlacement = 'chip'
    }))
    const box = heritageMarkBox(g.logo.scale, fitFor(g), g)
    const s = g.serial!
    expect(g.content).toEqual({ x: 0, y: 0, w: HERITAGE_PX.W, h: HERITAGE_PX.H })
    expect(box.x + box.w).toBeLessThanOrEqual(g.text.x)
    expect(box.x + box.w).toBeLessThanOrEqual(s.x)
    expect(s.x).toBeGreaterThanOrEqual(g.text.x + g.text.w)
    expect(s.y + s.h).toBeLessThanOrEqual(HERITAGE_PX.H)
  })
})
