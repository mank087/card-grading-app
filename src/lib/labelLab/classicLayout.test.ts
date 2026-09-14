/**
 * The Classic label's whole promise is spatial: FOUR fixed baselines, nothing
 * wraps, and no left-column text may ever run under the right-hand grade
 * column or under the DCM plate at the bottom centre. That promise is only as
 * good as classicLeftMaxWidths + fitClassicFront, so this file pins both:
 *
 *   1. the context-line parser (the only source of set/number/year/variety for
 *      every stored label_data blob), across the real category shapes;
 *   2. the fitter, against the measured worst cases from ~8,000 graded cards
 *      (119-char name, 128-char context) plus a 60-char parallel, with and
 *      without the designation line, and with a long serial widening the right
 *      column underneath them.
 */
import { describe, it, expect } from 'vitest'
import {
  CLASSIC_PX,
  CLASSIC_PURPLE,
  classicLines,
  parseClassicContext,
  classicLeftMaxWidths,
  classicRightMetrics,
  fitClassicFront,
  fitClassicBack,
  classicBoldFactor,
  classicBaselineTop,
  classicQrPlate,
  classicWavePaths,
} from './classicLayout'
import { widthOf } from './textFit'
import { HERITAGE_BRAND_COLORS } from './heritageLayout'
import { UNVERIFIED_AUTOGRAPH_DESIGNATION } from '@/lib/grading/autographPolicy'

const base = {
  serial: '657840',
  grade: 10 as number | null,
  condition: 'Gem Mint',
}

describe('parseClassicContext', () => {
  it('splits a Pokemon line with a trailing feature', () => {
    expect(parseClassicContext('Base Set • #4/102 • 1999 • Holo')).toEqual({
      setParts: ['Base Set'], number: '#4/102', year: '1999', features: ['Holo'],
    })
  })

  it('splits a sports line with no year-trailing features', () => {
    expect(parseClassicContext('Bowman Chrome • #ROY-3 • 2024')).toEqual({
      setParts: ['Bowman Chrome'], number: '#ROY-3', year: '2024', features: [],
    })
  })

  it('keeps a subset as a second set part', () => {
    const p = parseClassicContext('Sword & Shield • Champion\'s Path • #074/073 • 2020')
    expect(p.setParts).toEqual(['Sword & Shield', "Champion's Path"])
    expect(p.number).toBe('#074/073')
    expect(p.year).toBe('2020')
  })

  it('tolerates a missing year and a missing number', () => {
    expect(parseClassicContext('Promo')).toEqual({
      setParts: ['Promo'], number: '', year: '', features: [],
    })
  })

  it('accepts a hyphenated season year', () => {
    expect(parseClassicContext('Topps • #1 • 1999-00').year).toBe('1999-00')
  })
})

describe('classicLines', () => {
  it('builds the mockup Pokemon label', () => {
    const l = classicLines({
      ...base,
      primaryName: 'Charizard',
      contextLine: 'Base Set • #4/102 • 1999 • Holo',
    })
    // The mockup's "1999 POKEMON BASE SET" spells the category out by hand;
    // the context line only carries the set, so line 1 is "1999 BASE SET".
    expect(l.left).toEqual(['1999 BASE SET', 'CHARIZARD', 'HOLO', ''])
    expect(l.right).toEqual({ number: '#4/102', descriptor: 'GEM MINT', grade: '10', serial: '657840' })
  })

  it('builds a sports label from structured fields', () => {
    const l = classicLines({
      ...base,
      primaryName: 'Shohei Ohtani',
      contextLine: 'Topps Chrome • #150 • 2024',
      features: ['Refractor', 'Auto'],
      autographType: 'on-card',
      serial: '812077',
    })
    expect(l.left[0]).toBe('2024 TOPPS CHROME')
    expect(l.left[1]).toBe('SHOHEI OHTANI')
    // "Auto" is dropped from line 3 because line 4 already states it.
    expect(l.left[2]).toBe('REFRACTOR')
    expect(l.left[3]).toBe('ON-CARD AUTOGRAPH')
    expect(l.right.number).toBe('#150')
  })

  it('uses the v9.23 designation verbatim when present', () => {
    const l = classicLines({
      ...base,
      primaryName: 'Bob Feller',
      contextLine: 'Topps • #30 • 1955',
      designation: UNVERIFIED_AUTOGRAPH_DESIGNATION,
      features: ['Auto'],
    })
    expect(l.left[3]).toBe(UNVERIFIED_AUTOGRAPH_DESIGNATION.toUpperCase())
    expect(l.left[2]).toBe('')
  })

  it('renders an MTG line', () => {
    const l = classicLines({
      ...base,
      primaryName: 'Black Lotus',
      contextLine: 'Limited Edition Alpha • #232 • 1993',
      grade: 8,
      condition: 'Near Mint-Mint',
    })
    expect(l.left[0]).toBe('1993 LIMITED EDITION ALPHA')
    expect(l.left[1]).toBe('BLACK LOTUS')
    expect(l.right.descriptor).toBe('NEAR MINT-MINT')
    expect(l.right.grade).toBe('8')
  })

  it('passes a Japanese name through untouched', () => {
    const l = classicLines({
      ...base,
      primaryName: 'リザードン',
      contextLine: 'ポケモンカード 拡張パック • #006 • 1996',
    })
    expect(l.left[1]).toBe('リザードン')
    expect(l.left[0]).toBe('1996 ポケモンカード 拡張パック')
  })

  it('falls back to AUTHENTIC and A when there is no grade', () => {
    const l = classicLines({
      ...base,
      grade: null,
      condition: '',
      isAlteredAuthentic: true,
      primaryName: 'Mickey Mantle',
      contextLine: 'Topps • #311 • 1952',
    })
    expect(l.right.descriptor).toBe('AUTHENTIC')
    expect(l.right.grade).toBe('A')
  })

  it('falls back to N/A when there is no grade and no authentic flag', () => {
    expect(classicLines({ ...base, grade: null, primaryName: 'X' }).right.grade).toBe('N/A')
  })

  it('prefers gradeFormatted when the caller supplies it', () => {
    expect(classicLines({ ...base, gradeFormatted: '9', primaryName: 'X' }).right.grade).toBe('9')
  })
})

// ---------------------------------------------------------------------------

const LONG_NAME_119 = 'Ted Williams Stan Musial Mickey Mantle Willie Mays Hank Aaron Duke Snider Yogi Berra Roy Campanella Trinity Cut Relic'
const LONG_CTX_128 = "Sword & Shield Champion's Path Special Collection Premium Figure Box Japanese Exclusive Reprint (English name not printed) • #074/073 • 2020"
const LONG_PARALLEL_60 = 'Gold Vapor Refractor Superfractor 1st Edition Reverse Holo /25'

/** Every row the fitter returns must measure within its own maximum. */
function assertNoOverflow(rows: readonly string[], sizes: readonly number[], maxes: readonly number[]) {
  rows.forEach((r, i) => {
    if (!r) return
    const w = widthOf(r, sizes[i], CLASSIC_PX.LEFT_TRACK) * classicBoldFactor(r)
    expect(w, `row ${i} "${r.slice(0, 40)}" width ${w.toFixed(1)} > max ${maxes[i].toFixed(1)}`)
      .toBeLessThanOrEqual(maxes[i] + 0.001)
  })
}

describe('fitClassicFront', () => {
  const right = { number: '#4/102', descriptor: 'GEM MINT', grade: '10', serial: '657840' }

  it('keeps the mockup label at full size', () => {
    const fit = fitClassicFront(['1999 POKEMON BASE SET', 'CHARIZARD', 'HOLO', ''], { right })
    expect(fit.size).toBe(CLASSIC_PX.LEFT_SIZE_MAX)
    expect(fit.truncated).toEqual([false, false, false, false])
  })

  it('caps only the fourth baseline against the logo plate', () => {
    const maxes = classicLeftMaxWidths(right)
    // Baseline 290 sits below the plate's top edge (275) and is capped.
    expect(maxes[3]).toBeLessThanOrEqual(CLASSIC_PX.PLATE_KEEPOUT_LEFT - CLASSIC_PX.LEFT_X)
    expect(CLASSIC_PX.LEFT_BASELINES[3]).toBeGreaterThan(CLASSIC_PX.PLATE_Y)
    // Baseline 225 clears the plate, so slot 2 keeps the full run.
    expect(CLASSIC_PX.LEFT_BASELINES[2]).toBeLessThan(CLASSIC_PX.PLATE_Y)
    expect(maxes[2]).toBe(maxes[0])
    expect(maxes[2]).toBeGreaterThan(CLASSIC_PX.PLATE_KEEPOUT_LEFT - CLASSIC_PX.LEFT_X)
  })

  it('compacts non-empty lines upward into the baseline slots', () => {
    // Set + name + designation, no variety: draws on baselines 95/160/225.
    const fit = fitClassicFront(
      ['1952 TOPPS', 'MICKEY MANTLE', '', UNVERIFIED_AUTOGRAPH_DESIGNATION.toUpperCase()],
      { right },
    )
    expect(fit.rows[2]).toBe(UNVERIFIED_AUTOGRAPH_DESIGNATION.toUpperCase())
    expect(fit.rows[3]).toBe('')
    expect(fit.sources).toEqual([0, 1, 3, -1])
    // The whole point of the change: it now fits, untruncated and readable.
    expect(fit.truncated).toEqual([false, false, false, false])
    expect(fit.size).toBeGreaterThanOrEqual(40)
  })

  it('uses the fourth baseline only when all four lines are present', () => {
    const fit = fitClassicFront(
      ['2024 TOPPS CHROME', 'SHOHEI OHTANI', 'REFRACTOR', 'ON-CARD AUTOGRAPH'],
      { right },
    )
    expect(fit.sources).toEqual([0, 1, 2, 3])
    expect(fit.rows[3]).toBe('ON-CARD AUTOGRAPH')
    expect(fit.sizes[3]).toBeLessThanOrEqual(CLASSIC_PX.LEFT_SIZE_MAX_L4)
  })

  it('compacts a card with only a set line and a name', () => {
    const fit = fitClassicFront(['1999 BASE SET', 'CHARIZARD', '', ''], { right })
    expect(fit.sources).toEqual([0, 1, -1, -1])
    expect(fit.rows).toEqual(['1999 BASE SET', 'CHARIZARD', '', ''])
  })

  it('keeps lines 1 and 2 clear of the right column', () => {
    const { colLeft } = classicRightMetrics(right)
    const maxes = classicLeftMaxWidths(right)
    expect(CLASSIC_PX.LEFT_X + maxes[0]).toBeLessThanOrEqual(colLeft - CLASSIC_PX.LEFT_RIGHT_GAP + 0.001)
  })

  const cases: Array<[string, [string, string, string, string]]> = [
    ['119-char name', [LONG_CTX_128, LONG_NAME_119, '', '']],
    ['128-char context', [LONG_CTX_128, 'CHARIZARD', '', '']],
    ['60-char parallel', ['1999 POKEMON BASE SET', 'CHARIZARD', LONG_PARALLEL_60, '']],
    ['everything long', [LONG_CTX_128, LONG_NAME_119, LONG_PARALLEL_60, '']],
  ]

  for (const [label, lines] of cases) {
    for (const designation of ['', UNVERIFIED_AUTOGRAPH_DESIGNATION.toUpperCase()]) {
      it(`fits ${label}${designation ? ' + designation' : ''} without overflowing`, () => {
        const r = { ...right, serial: '81207740' }   // 8-digit serial widens the column
        const maxes = classicLeftMaxWidths(r)
        const fit = fitClassicFront([lines[0], lines[1], lines[2], designation], { right: r })
        expect(fit.size).toBeGreaterThanOrEqual(CLASSIC_PX.LEFT_SIZE_MIN)
        expect(fit.size).toBeLessThanOrEqual(CLASSIC_PX.LEFT_SIZE_MAX)
        expect(fit.sizes[3]).toBeLessThanOrEqual(CLASSIC_PX.LEFT_SIZE_MAX_L4)
        assertNoOverflow(fit.rows, fit.sizes, maxes)
        // Nothing wraps: four rows, always.
        expect(fit.rows).toHaveLength(4)
      })
    }
  }

  it('widens the right column for an 8-digit serial, narrowing lines 1 and 2', () => {
    const short = classicLeftMaxWidths({ ...right, serial: '657840' })
    const long = classicLeftMaxWidths({ ...right, serial: '81207740' })
    expect(long[0]).toBeLessThan(short[0])
  })

  it('truncates with an ellipsis rather than wrapping at the floor', () => {
    const fit = fitClassicFront([LONG_CTX_128, LONG_NAME_119, '', ''], { right })
    expect(fit.size).toBe(CLASSIC_PX.LEFT_SIZE_MIN)
    expect(fit.truncated[0] || fit.truncated[1]).toBe(true)
    const trimmed = fit.rows.filter((r, i) => fit.truncated[i])
    for (const r of trimmed) expect(r.endsWith('…')).toBe(true)
  })

  it('a blank line costs nothing', () => {
    const withBlank = fitClassicFront(['1999 TOPPS', 'AARON JUDGE', '', ''], { right })
    const withLine = fitClassicFront(['1999 TOPPS', 'AARON JUDGE', 'REFRACTOR', ''], { right })
    expect(withBlank.size).toBe(withLine.size)
    expect(withBlank.rows[2]).toBe('')
    expect(withBlank.rows[3]).toBe('')
  })

  /**
   * Documents what the SHARED size actually costs. One very long line drags
   * every other row down with it — that is the deliberate trade (an even block
   * beats one row reading a third smaller than its neighbours) — so this pins
   * the real number rather than asserting a comfortable one.
   */
  it('lets one 128-char set line drag the whole block to the floor', () => {
    const fit = fitClassicFront([LONG_CTX_128, 'CHARIZARD', '', ''], { right })
    expect(fit.size).toBe(CLASSIC_PX.LEFT_SIZE_MIN)   // 34: it truly must
    expect(fit.truncated[0]).toBe(true)               // still too wide at 34
    expect(fit.truncated[1]).toBe(false)              // the short name is intact
    expect(fit.rows[1]).toBe('CHARIZARD')
  })

  it('keeps a realistic long set line well above the floor', () => {
    // p90 territory (~40 chars), not the p99 pathological case.
    const fit = fitClassicFront(["2020 SWORD & SHIELD CHAMPION'S PATH", 'CHARIZARD V', 'HOLO', ''], { right })
    // 40 exactly — comfortably above the 34 floor, nothing dropped.
    expect(fit.size).toBe(40)
    expect(fit.truncated).toEqual([false, false, false, false])
  })

  it('fits a Japanese name', () => {
    const r = { ...right, serial: 'DCM12345' }
    const maxes = classicLeftMaxWidths(r)
    const fit = fitClassicFront(['1996 ポケモンカード 拡張パック', 'リザードン', 'ホロ', ''], { right: r })
    assertNoOverflow(fit.rows, fit.sizes, maxes)
  })
})

describe('geometry constants', () => {
  it('uses the heritage brand purple', () => {
    expect(CLASSIC_PURPLE).toBe(HERITAGE_BRAND_COLORS[0])
  })

  it('is authored at the heritage design size', () => {
    expect([CLASSIC_PX.W, CLASSIC_PX.H]).toEqual([1400, 400])
  })

  it('puts the logo plate inside the keep-out and straddling the frame', () => {
    expect(CLASSIC_PX.PLATE_X).toBeGreaterThanOrEqual(CLASSIC_PX.PLATE_KEEPOUT_LEFT)
    expect(CLASSIC_PX.PLATE_X + CLASSIC_PX.PLATE_W).toBeLessThanOrEqual(CLASSIC_PX.PLATE_KEEPOUT_RIGHT)
    expect(CLASSIC_PX.PLATE_Y + CLASSIC_PX.PLATE_H).toBe(CLASSIC_PX.H)
    expect(CLASSIC_PX.PLATE_Y).toBeGreaterThan(CLASSIC_PX.H - CLASSIC_PX.FRAME - CLASSIC_PX.PLATE_H)
  })

  it('keeps the QR plate inside the field', () => {
    const p = classicQrPlate()
    expect(p.x).toBeGreaterThanOrEqual(CLASSIC_PX.FRAME)
    expect(p.x + p.w).toBeLessThanOrEqual(CLASSIC_PX.W - CLASSIC_PX.FRAME)
    expect(p.y).toBeGreaterThanOrEqual(CLASSIC_PX.FRAME)
    expect(p.y + p.h).toBeLessThanOrEqual(CLASSIC_PX.H - CLASSIC_PX.FRAME)
  })

  it('draws five waves', () => {
    expect(classicWavePaths()).toHaveLength(CLASSIC_PX.WAVE_COUNT)
  })

  it('converts a baseline to a react-pdf top', () => {
    expect(classicBaselineTop(95, 50, false)).toBeCloseTo(95 - 45, 6)
    expect(classicBaselineTop(95, 50, true)).toBeCloseTo(95 - 58, 6)
  })
})

describe('fitClassicBack', () => {
  it('leaves a normal serial at full size', () => {
    const f = fitClassicBack('657840', 'dcmgrading.com/verify/657840')
    expect(f.serialSize).toBe(CLASSIC_PX.BACK_SERIAL_SIZE)
    expect(f.urlSize).toBe(CLASSIC_PX.VERIFY_SIZE)
  })

  it('shrinks a long org serial instead of running it under the QR', () => {
    const serial = 'KK-000123456'
    const f = fitClassicBack(serial, `dcmgrading.com/verify/${serial}`)
    expect(f.serialSize).toBeLessThan(CLASSIC_PX.BACK_SERIAL_SIZE)
    expect(widthOf(serial, f.serialSize, 0) * classicBoldFactor(serial)).toBeLessThanOrEqual(f.half * 2 + 0.001)
  })
})
