/**
 * Duplex printer calibration for slab label SHEETS (10 / 20 / 30 per sheet),
 * saved in the browser like the Avery calibration (BatchAveryLabelModal,
 * 'dcm_avery_calibration').
 *
 * Values are INCHES (the UI may show mm). Positive X = right, positive Y =
 * down, measured on the side they apply to while looking at that side:
 *  - globalX/Y shift BOTH pages (the printer's own placement error),
 *  - backX/Y shift the backs page only (front-to-back registration).
 * Default (all zero, long-edge flip) leaves every sheet exactly as before.
 */
import {
  ZERO_SHEET_OFFSETS,
  type DuplexFlip,
  type SheetDensity,
  type SheetLayoutArg,
  type SheetOffsetsIn,
} from './sheetGeometry'

export const SHEET_CALIBRATION_STORAGE_KEY = 'dcm_slab_sheet_calibration'
/** No printer is off by more than this; larger input is a typo. */
export const MAX_SHEET_OFFSET_IN = 0.25
export const MM_PER_IN = 25.4

export interface SheetCalibration {
  duplexFlip: DuplexFlip
  offsetsIn: SheetOffsetsIn
  /** Display unit only; storage is always inches. */
  unit: 'in' | 'mm'
}

export const DEFAULT_SHEET_CALIBRATION: SheetCalibration = {
  duplexFlip: 'long',
  offsetsIn: { ...ZERO_SHEET_OFFSETS },
  unit: 'in',
}

const clampOffset = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return 0
  return Math.max(-MAX_SHEET_OFFSET_IN, Math.min(MAX_SHEET_OFFSET_IN, Math.round(n * 10000) / 10000))
}

export function normalizeSheetCalibration(raw: unknown): SheetCalibration {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SheetCalibration> & { offsetsIn?: Partial<SheetOffsetsIn> }
  const o: Partial<SheetOffsetsIn> = r.offsetsIn || {}
  return {
    duplexFlip: r.duplexFlip === 'short' ? 'short' : 'long',
    offsetsIn: {
      globalX: clampOffset(o.globalX),
      globalY: clampOffset(o.globalY),
      backX: clampOffset(o.backX),
      backY: clampOffset(o.backY),
    },
    unit: r.unit === 'mm' ? 'mm' : 'in',
  }
}

export function readSheetCalibration(): SheetCalibration {
  if (typeof window === 'undefined') return { ...DEFAULT_SHEET_CALIBRATION, offsetsIn: { ...ZERO_SHEET_OFFSETS } }
  try {
    const raw = window.localStorage.getItem(SHEET_CALIBRATION_STORAGE_KEY)
    return normalizeSheetCalibration(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULT_SHEET_CALIBRATION, offsetsIn: { ...ZERO_SHEET_OFFSETS } }
  }
}

export function saveSheetCalibration(cal: SheetCalibration): SheetCalibration {
  const n = normalizeSheetCalibration(cal)
  try { window.localStorage.setItem(SHEET_CALIBRATION_STORAGE_KEY, JSON.stringify(n)) } catch { /* private mode */ }
  return n
}

export function isDefaultSheetCalibration(cal: SheetCalibration): boolean {
  const o = cal.offsetsIn
  return cal.duplexFlip === 'long' && !o.globalX && !o.globalY && !o.backX && !o.backY
}

/**
 * The generator layout argument for a density + calibration. Returns the bare
 * density when calibration is the default, so those sheets stay byte-identical.
 */
export function sheetLayoutFor(density: SheetDensity, cal: SheetCalibration | null | undefined): SheetLayoutArg {
  if (!cal || isDefaultSheetCalibration(cal)) return density
  return { density, duplexFlip: cal.duplexFlip, offsetsIn: cal.offsetsIn }
}

/** Inches → display value in the chosen unit. */
export function toDisplayUnit(inches: number, unit: 'in' | 'mm'): number {
  return unit === 'mm' ? Math.round(inches * MM_PER_IN * 100) / 100 : Math.round(inches * 10000) / 10000
}

/** Display value → inches. */
export function fromDisplayUnit(value: number, unit: 'in' | 'mm'): number {
  return unit === 'mm' ? value / MM_PER_IN : value
}
