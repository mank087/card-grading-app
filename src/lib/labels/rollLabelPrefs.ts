/**
 * Roll label-printer sizes, page geometry and remembered preferences.
 *
 * Kept free of @react-pdf so UI code can import it statically; the PDF
 * documents live in rollLabelGenerator.tsx (dynamic-imported on download).
 */
import { SLAB_LABEL_W_IN, SLAB_LABEL_H_IN } from '@/lib/labels/sheetGeometry'

const INCH = 72
/** True slab-label size in points — never scaled. */
export const ROLL_LABEL_W_PT = SLAB_LABEL_W_IN * INCH // 201.6
export const ROLL_LABEL_H_PT = SLAB_LABEL_H_IN * INCH // 57.6

// ---------------------------------------------------------------------------
// Roll sizes + preferences
// ---------------------------------------------------------------------------

export type RollSize = '3x1' | '2.8x0.8'

export const ROLL_SIZES: Record<RollSize, { widthIn: number; heightIn: number; label: string; paperHint: string }> = {
  '3x1': { widthIn: 3, heightIn: 1, label: '3 × 1 in roll', paperHint: '3 × 1 in (76 × 25 mm)' },
  '2.8x0.8': { widthIn: 2.8, heightIn: 0.8, label: '2.8 × 0.8 in roll', paperHint: '2.8 × 0.8 in (71 × 20 mm)' },
}

export const DEFAULT_ROLL_SIZE: RollSize = '3x1'

/** localStorage keys — shared by Label Studio and the batch modal. */
export const ROLL_SIZE_KEY = 'labelStudio_rollSize'
export const ROLL_MONO_KEY = 'labelStudio_rollMono'

export function parseRollSize(v: string | null | undefined): RollSize {
  return v === '2.8x0.8' ? '2.8x0.8' : DEFAULT_ROLL_SIZE
}

/** Remembered roll size (default 3 × 1). Safe outside the browser. */
export function readStoredRollSize(): RollSize {
  try { return parseRollSize(typeof window === 'undefined' ? null : localStorage.getItem(ROLL_SIZE_KEY)) } catch { return DEFAULT_ROLL_SIZE }
}
export function storeRollSize(size: RollSize): void {
  try { localStorage.setItem(ROLL_SIZE_KEY, size) } catch { /* ignore */ }
}
/** Remembered black & white toggle — ON unless the user turned it off. */
export function readStoredRollMono(): boolean {
  try { return typeof window === 'undefined' ? true : localStorage.getItem(ROLL_MONO_KEY) !== '0' } catch { return true }
}
export function storeRollMono(mono: boolean): void {
  try { localStorage.setItem(ROLL_MONO_KEY, mono ? '1' : '0') } catch { /* ignore */ }
}

export interface RollOptions {
  /** Default '3x1'. */
  size?: RollSize
  /** Black & white (thermal). Default true. */
  mono?: boolean
}

export interface RollPageGeometry {
  pageW: number
  pageH: number
  /** Top-left of the true-size label on the page. */
  labelX: number
  labelY: number
  labelW: number
  labelH: number
}

export function rollPageGeometry(size: RollSize = DEFAULT_ROLL_SIZE): RollPageGeometry {
  const s = ROLL_SIZES[size]
  const pageW = s.widthIn * INCH
  const pageH = s.heightIn * INCH
  return {
    pageW,
    pageH,
    labelX: (pageW - ROLL_LABEL_W_PT) / 2,
    labelY: (pageH - ROLL_LABEL_H_PT) / 2,
    labelW: ROLL_LABEL_W_PT,
    labelH: ROLL_LABEL_H_PT,
  }
}

/** Print guidance shown next to every roll option. */
export function rollPrintGuidance(size: RollSize = DEFAULT_ROLL_SIZE): string {
  return `Print at Actual size / 100% (not Fit). In the printer's paper size, choose ${ROLL_SIZES[size].paperHint}.`
}
