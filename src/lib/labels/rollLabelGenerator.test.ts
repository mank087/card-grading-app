import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument } from 'pdf-lib'
import {
  rollPageGeometry,
  parseRollSize,
  rollPrintGuidance,
  RollLabelDoc,
  buildRollSlabLabelsDoc,
  buildRollCustomSlabLabelsDoc,
  buildRollHeritageLabelsDoc,
  ROLL_LABEL_W_PT,
  ROLL_LABEL_H_PT,
  type RollSize,
} from './rollLabelGenerator'
import { CustomSlabLabelBlock, CustomSlabBackBlock } from '@/lib/labelLab/customSlabPdfBlock'
import { ClassicFront, ClassicBack } from '@/lib/labelLab/classicSlabPdfDoc'
import { HeritageFront, HeritageBack } from '@/lib/labelLab/heritageSlabPdfDoc'
import { DEFAULT_CUSTOM_CONFIG } from '@/lib/labelPresets'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'

function card(n: number, grade = 9): SlabLabelData {
  return {
    primaryName: `Charizard ${n}`,
    contextLine: 'Pokemon • Base Set • #4/102 • 1999',
    featuresLine: 'Holo',
    features: ['Holo'],
    serial: `DCM-00012${n}`,
    grade,
    condition: grade === 10 ? 'Gem Mint' : 'Mint',
    qrCodeUrl: `https://dcmgrading.com/verify/DCM-00012${n}`,
    subScores: { centering: 9, corners: 9, edges: 10, surface: 9 },
    isAlteredAuthentic: false,
  } as SlabLabelData
}

type El = React.ReactElement<any>

/** RollLabelDoc element -> its RollPage elements (one per printed label). */
function rollPages(doc: El): El[] {
  expect(doc.type).toBe(RollLabelDoc)
  const document = (RollLabelDoc as any)(doc.props) as El
  return React.Children.toArray(document.props.children) as El[]
}

/** RollPage element -> the <Page> it renders (size + label wrapper). */
function pageOf(rollPage: El): { page: El; wrapper: El } {
  const page = (rollPage.type as any)(rollPage.props) as El
  const kids = React.Children.toArray(page.props.children) as El[]
  return { page, wrapper: kids[0] }
}

async function pdfPageBoxes(doc: El): Promise<Array<{ w: number; h: number }>> {
  const buf = await renderToBuffer(doc as any)
  const pdf = await PDFDocument.load(buf)
  return pdf.getPages().map(p => {
    const { width, height } = p.getSize()
    return { w: width, h: height }
  })
}

describe('rollPageGeometry', () => {
  it('3 × 1 roll: 216 × 72 pt page, true-size 2.8" × 0.8" label centred with 0.1" margins', () => {
    const g = rollPageGeometry('3x1')
    expect(g.pageW).toBeCloseTo(216, 6)
    expect(g.pageH).toBeCloseTo(72, 6)
    expect(g.labelW).toBeCloseTo(201.6, 6)
    expect(g.labelH).toBeCloseTo(57.6, 6)
    expect(g.labelX).toBeCloseTo(7.2, 6)
    expect(g.labelY).toBeCloseTo(7.2, 6)
  })

  it('2.8 × 0.8 roll: the page is exactly the label, no margin', () => {
    const g = rollPageGeometry('2.8x0.8')
    expect(g.pageW).toBeCloseTo(201.6, 6)
    expect(g.pageH).toBeCloseTo(57.6, 6)
    expect(g.labelX).toBeCloseTo(0, 6)
    expect(g.labelY).toBeCloseTo(0, 6)
  })

  it('defaults to 3 × 1 and parses stored values defensively', () => {
    expect(rollPageGeometry().pageW).toBeCloseTo(216, 6)
    expect(parseRollSize(null)).toBe('3x1')
    expect(parseRollSize('junk')).toBe('3x1')
    expect(parseRollSize('2.8x0.8')).toBe('2.8x0.8')
  })

  it('guidance names actual size and the paper size', () => {
    expect(rollPrintGuidance('3x1')).toContain('Actual size / 100%')
    expect(rollPrintGuidance('3x1')).toContain('3 × 1 in (76 × 25 mm)')
  })
})

describe('RollLabelDoc element tree', () => {
  it('one label per page, front then back per card, at true size', async () => {
    const doc = await buildRollSlabLabelsDoc([card(1), card(2)], 'modern', { logoBlack: null }) as El
    const pages = rollPages(doc)
    expect(pages).toHaveLength(4)
    const kinds = pages.map(p => (p.props.children as El).type)
    expect(kinds).toEqual([CustomSlabLabelBlock, CustomSlabBackBlock, CustomSlabLabelBlock, CustomSlabBackBlock])
    // card order: card 1 front/back, then card 2
    expect((pages[0].props.children as El).props.inputs.serial).toBe('DCM-000121')
    expect((pages[1].props.children as El).props.inputs.serial).toBe('DCM-000121')
    expect((pages[2].props.children as El).props.inputs.serial).toBe('DCM-000122')
    for (const p of pages) {
      const { page, wrapper } = pageOf(p)
      expect(page.props.size).toEqual({ width: 216, height: 72 })
      expect(page.props.orientation).toBeUndefined()
      expect(wrapper.props.style.width).toBeCloseTo(ROLL_LABEL_W_PT, 6)
      expect(wrapper.props.style.height).toBeCloseTo(ROLL_LABEL_H_PT, 6)
      expect(wrapper.props.style.left).toBeCloseTo(7.2, 6)
      expect(wrapper.props.style.top).toBeCloseTo(7.2, 6)
      // never scaled
      expect(wrapper.props.style.transform).toBeUndefined()
    }
  })

  it('a style with no back emits only the front page', () => {
    const doc = React.createElement(RollLabelDoc, {
      labels: [{ key: 'a', front: React.createElement('X'), back: null }, { key: 'b', front: React.createElement('Y') }],
    }) as El
    expect(rollPages(doc)).toHaveLength(2)
  })

  it('black & white is on by default and can be turned off', async () => {
    const on = rollPages(await buildRollSlabLabelsDoc([card(1)], 'modern', { logoBlack: null }) as El)
    expect((on[0].props.children as El).props.mono).toBe(true)
    expect((on[1].props.children as El).props.mono).toBe(true)
    const off = rollPages(await buildRollSlabLabelsDoc([card(1)], 'modern', { mono: false, logoBlack: null }) as El)
    expect((off[0].props.children as El).props.mono).toBe(false)
  })

  it('mono swaps the front mark for the supplied black mark', async () => {
    const pages = rollPages(await buildRollSlabLabelsDoc([{ ...card(1), logoDataUrl: 'data:purple' } as SlabLabelData], 'modern', { logoBlack: 'data:black' }) as El)
    expect((pages[0].props.children as El).props.inputs.colorLogoDataUrl).toBe('data:black')
  })

  it('traditional uses the Classic blocks', async () => {
    const pages = rollPages(await buildRollSlabLabelsDoc([card(1)], 'traditional', { logoBlack: null }) as El)
    expect(pages.map(p => (p.props.children as El).type)).toEqual([ClassicFront, ClassicBack])
    expect((pages[0].props.children as El).props.mono).toBe(true)
  })

  it('heritage uses the Heritage blocks with mono inputs', async () => {
    const pages = rollPages(await buildRollHeritageLabelsDoc(
      [{ data: card(1, 10), bandColors: ['#ff0000', '#00ff00'] }], 'diamond', null,
    ) as El)
    expect(pages.map(p => (p.props.children as El).type)).toEqual([HeritageFront, HeritageBack])
    const i = (pages[0].props.children as El).props.i
    expect(i.mono).toBe(true)
    // thermal chip: black with a white numeral
    expect((pages[0].props.children as El).props.chip.fill).toBe('#000000')
    expect((pages[0].props.children as El).props.chip.ink).toBe('#FFFFFF')
  })

  it('2.8 × 0.8 size puts the label flush at the page origin', async () => {
    const pages = rollPages(await buildRollSlabLabelsDoc([card(1)], 'modern', { size: '2.8x0.8', logoBlack: null }) as El)
    const { page, wrapper } = pageOf(pages[0])
    expect(page.props.size.width).toBeCloseTo(201.6, 6)
    expect(page.props.size.height).toBeCloseTo(57.6, 6)
    expect(wrapper.props.style.left).toBeCloseTo(0, 6)
    expect(wrapper.props.style.top).toBeCloseTo(0, 6)
  })
})

describe('rendered PDF page boxes', () => {
  const cases: Array<[string, () => Promise<El>]> = [
    ['modern', async () => await buildRollSlabLabelsDoc([card(1), card(2)], 'modern', { logoBlack: null }) as El],
    ['traditional', async () => await buildRollSlabLabelsDoc([card(1), card(2)], 'traditional', { logoBlack: null }) as El],
    ['custom', async () => await buildRollCustomSlabLabelsDoc([card(1), card(2)], DEFAULT_CUSTOM_CONFIG, { logoBlack: null }) as El],
    ['heritage', async () => await buildRollHeritageLabelsDoc(
      [{ data: card(1, 10), bandColors: ['#7c3aed', '#4c1d95'] }, { data: card(2, 8), bandColors: ['#7c3aed', '#4c1d95'] }],
      'diamond', null,
    ) as El],
  ]
  for (const [name, build] of cases) {
    it(`${name}: 4 pages, every page exactly 216 × 72 pt (landscape)`, async () => {
      const boxes = await pdfPageBoxes(await build())
      expect(boxes).toHaveLength(4)
      for (const b of boxes) {
        expect(b.w).toBeCloseTo(216, 3)
        expect(b.h).toBeCloseTo(72, 3)
      }
    }, 30_000)
  }

  it.each<[RollSize, number, number]>([['3x1', 216, 72], ['2.8x0.8', 201.6, 57.6]])(
    '%s roll renders %d × %d pt pages', async (size, w, h) => {
      const boxes = await pdfPageBoxes(await buildRollSlabLabelsDoc([card(1)], 'modern', { size, logoBlack: null, mono: false }) as El)
      expect(boxes).toHaveLength(2)
      for (const b of boxes) {
        expect(b.w).toBeCloseTo(w, 3)
        expect(b.h).toBeCloseTo(h, 3)
      }
    }, 30_000,
  )
})
