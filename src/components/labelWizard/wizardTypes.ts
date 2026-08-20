/**
 * Label Wizard — shared state, reducer, and holder/style metadata.
 *
 * One state object drives all five steps (the classic studio's config lived in
 * localStorage + component state + saved slots simultaneously; the wizard
 * deliberately has a single source of truth). The working design is a full
 * CustomLabelConfig, so everything downstream (previews, the batch export
 * modals, saved styles) speaks the existing config language — no new format.
 */
import {
  DEFAULT_CUSTOM_CONFIG,
  type CustomLabelConfig,
  type SavedCustomStyle,
} from '@/lib/labelPresets'
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle'

// ---------------------------------------------------------------------------
// Holders
// ---------------------------------------------------------------------------
export type HolderType = 'slab' | 'onetouch' | 'toploader'

export interface HolderInfo {
  id: HolderType
  name: string
  dimensions: string
  stock: string
  image: string
  blurb: string
}

export const HOLDERS: HolderInfo[] = [
  {
    id: 'slab',
    name: 'Graded Slab',
    dimensions: '2.8" × 0.8" label',
    stock: 'Plain paper, cut & insert',
    image: '/labels/graded-card-slab.png',
    blurb: 'The full label slot in a standard grading slab. Front grade, back QR, duplex or fold-over printing.',
  },
  {
    id: 'onetouch',
    name: 'Magnetic One-Touch',
    dimensions: '1.25" × 2.375" label',
    stock: 'Avery 6871 sheets',
    image: '/labels/mag-one-touch-DCM.png',
    blurb: 'A peel-and-stick label sized for the back of a magnetic one-touch case.',
  },
  {
    id: 'toploader',
    name: 'Toploader',
    dimensions: '1.75" × 0.5" labels',
    stock: 'Avery 8167 sheets',
    image: '/labels/top-loader-dcm.png',
    blurb: 'Two small labels per card: grade info on the front, QR on the back. Fold-over option included.',
  },
]

/**
 * Selection cap: two full slab sheets.
 *
 * The slab sheet is the tightest format at 2 x 5 = 10 labels per page, so 20 is
 * exactly two sheets there. Every other format needs fewer pages for the same
 * 20 cards — One-Touch (Avery 6871) fits 18 per sheet, Toploader front+back
 * fits 40, and Toploader fold-over fits 80. All the sheet builders paginate, so
 * this is a UX limit rather than a technical one: past a couple of sheets,
 * swiping every card to check its design stops being reviewable, and the
 * per-card QR and 600 dpi canvas renders start to bite on phones.
 */
export const MAX_WIZARD_CARDS = 20

/** Labels per printed sheet, by holder — drives the "how many sheets" hint. */
export const CARDS_PER_SHEET: Record<HolderType, number> = {
  slab: 10,
  onetouch: 18,
  toploader: 40,
}

/** Sheets needed for a selection. Fold-over toploaders double their capacity. */
export function sheetsNeeded(count: number, holder: HolderType, foldover = false): number {
  const per = holder === 'toploader' && foldover ? 80 : CARDS_PER_SHEET[holder]
  return Math.max(1, Math.ceil(count / per))
}

// ---------------------------------------------------------------------------
// Slab label sizes
// ---------------------------------------------------------------------------
export type SlabSizeId = 'standard' | 'zion'

export interface SlabSizeInfo {
  id: SlabSizeId
  name: string
  width: number // inches
  height: number // inches
}

export const SLAB_SIZES: SlabSizeInfo[] = [
  { id: 'standard', name: 'Standard', width: 2.8, height: 0.8 },
  { id: 'zion', name: 'Zion Mag Pro', width: 2.51, height: 0.76 },
]

/**
 * Apply the chosen slab size to a working config. Zion uses the 'custom'
 * dimension preset so every generator honors the explicit width/height.
 * NOTE: the Heritage print documents are fixed at 2.8" × 0.8" today — the
 * wizard surfaces that when Zion + Heritage are combined (see StepStyle).
 */
export function applySlabSize(config: CustomLabelConfig, size: SlabSizeId): CustomLabelConfig {
  const s = SLAB_SIZES.find((x) => x.id === size) ?? SLAB_SIZES[0]
  if (size === 'standard') return { ...config, width: s.width, height: s.height }
  return { ...config, preset: 'custom', width: s.width, height: s.height }
}

// ---------------------------------------------------------------------------
// Styles per holder
// ---------------------------------------------------------------------------
export type BuiltInStyleId = 'heritage' | 'modern' | 'traditional'

export interface StyleOption {
  id: LabelStyleId
  name: string
  blurb: string
  /** Present but not selectable yet (Heritage Compact for small holders). */
  comingSoon?: boolean
}

export function styleOptionsForHolder(
  holder: HolderType,
  customStyles: SavedCustomStyle[],
): StyleOption[] {
  if (holder === 'slab') {
    return [
      { id: 'heritage', name: 'Heritage', blurb: 'Ivory field, patterned color band, grade chip. The DCM signature label.' },
      { id: 'modern', name: 'Modern', blurb: 'Dark gradient with bold type. The original DCM look.' },
      { id: 'traditional', name: 'Traditional', blurb: 'Clean light label in the classic grading style.' },
      ...customStyles.map((s) => ({
        id: s.id as LabelStyleId,
        name: s.name,
        blurb: 'One of your saved designs.',
      })),
    ]
  }
  // Heritage Compact (Aug 2026) fits Heritage to these two formats — see
  // lib/labels/heritageCompact.ts for what survives at each size.
  return [
    { id: 'heritage', name: 'Heritage', blurb: 'Ivory field, patterned band, grade chip — fitted to this holder.' },
    { id: 'modern', name: 'Modern', blurb: 'Dark gradient label sized for this holder.' },
  ]
}

/** Fresh working config for a chosen base style. */
export function baseConfigForStyle(
  styleId: LabelStyleId,
  customStyles: SavedCustomStyle[],
): CustomLabelConfig {
  if (styleId === 'heritage') {
    return {
      ...DEFAULT_CUSTOM_CONFIG,
      preset: 'dcm-heritage',
      style: 'heritage',
      heritagePattern: 'diamond',
      heritageColorSource: 'card',
    }
  }
  if (styleId === 'traditional') {
    return {
      ...DEFAULT_CUSTOM_CONFIG,
      preset: 'dcm-traditional',
      style: 'traditional',
      colorPreset: 'traditional',
      gradientStart: '#f9fafb',
      gradientEnd: '#ffffff',
    }
  }
  if (styleId === 'modern') {
    return { ...DEFAULT_CUSTOM_CONFIG }
  }
  const saved = customStyles.find((s) => s.id === styleId)
  return saved ? { ...DEFAULT_CUSTOM_CONFIG, ...saved.config, side: 'front' } : { ...DEFAULT_CUSTOM_CONFIG }
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------
/** Step 6 (supplies) is OPTIONAL — reachable from step 5, never required. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface WizardState {
  step: WizardStep
  /** Selected card objects, in pick order. Capped at MAX_WIZARD_CARDS. */
  cards: any[]
  /** Which selected card the preview swiper is showing. */
  activeIndex: number
  holder: HolderType | null
  /** Slab label slot size — only meaningful for holder 'slab'. */
  slabSize: SlabSizeId
  /** Toploader label variation — only meaningful for holder 'toploader'. */
  toploaderVariant: 'front-back' | 'foldover'
  styleId: LabelStyleId | null
  /** The working design. Only meaningful once styleId is set. */
  config: CustomLabelConfig
  side: 'front' | 'back'
}

export const initialWizardState: WizardState = {
  step: 1,
  cards: [],
  activeIndex: 0,
  holder: null,
  slabSize: 'standard',
  toploaderVariant: 'front-back',
  styleId: null,
  config: { ...DEFAULT_CUSTOM_CONFIG },
  side: 'front',
}

export type WizardAction =
  | { type: 'TOGGLE_CARD'; card: any }
  | { type: 'REMOVE_CARD'; cardId: string }
  | { type: 'CLEAR_CARDS' }
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_HOLDER'; holder: HolderType }
  | { type: 'SET_SLAB_SIZE'; size: SlabSizeId }
  | { type: 'SET_TOPLOADER_VARIANT'; variant: 'front-back' | 'foldover' }
  | { type: 'SET_STYLE'; styleId: LabelStyleId; customStyles: SavedCustomStyle[] }
  | { type: 'PATCH_CONFIG'; patch: Partial<CustomLabelConfig> }
  | { type: 'SET_ACTIVE_INDEX'; index: number }
  | { type: 'SET_SIDE'; side: 'front' | 'back' }

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'TOGGLE_CARD': {
      const exists = state.cards.some((c) => c.id === action.card.id)
      if (exists) {
        const cards = state.cards.filter((c) => c.id !== action.card.id)
        return { ...state, cards, activeIndex: Math.min(state.activeIndex, Math.max(0, cards.length - 1)) }
      }
      if (state.cards.length >= MAX_WIZARD_CARDS) return state
      return { ...state, cards: [...state.cards, action.card] }
    }
    case 'REMOVE_CARD': {
      const cards = state.cards.filter((c) => c.id !== action.cardId)
      return { ...state, cards, activeIndex: Math.min(state.activeIndex, Math.max(0, cards.length - 1)) }
    }
    case 'CLEAR_CARDS':
      return { ...state, cards: [], activeIndex: 0 }
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_HOLDER': {
      if (action.holder === state.holder) return { ...state, step: 3 }
      // Changing holder invalidates a style the new holder doesn't offer.
      const stillValid =
        state.styleId !== null &&
        styleOptionsForHolder(action.holder, []).some((o) => o.id === state.styleId && !o.comingSoon)
      return {
        ...state,
        holder: action.holder,
        styleId: stillValid ? state.styleId : null,
        step: 3,
      }
    }
    case 'SET_TOPLOADER_VARIANT':
      return { ...state, toploaderVariant: action.variant }
    case 'SET_SLAB_SIZE':
      return {
        ...state,
        slabSize: action.size,
        config: applySlabSize(state.config, action.size),
      }
    case 'SET_STYLE': {
      const base = { ...baseConfigForStyle(action.styleId, action.customStyles), side: state.side }
      // A saved design carries its OWN dimensions — loading it adopts them
      // (and syncs the size checkbox) instead of overwriting them with the
      // current selection. Built-ins take the currently chosen size.
      const isSavedDesign = action.styleId.startsWith('custom-')
      if (isSavedDesign) {
        const zion = Math.abs(base.width - 2.51) < 0.01 && Math.abs(base.height - 0.76) < 0.01
        return { ...state, styleId: action.styleId, slabSize: zion ? 'zion' : 'standard', config: base }
      }
      return {
        ...state,
        styleId: action.styleId,
        config: applySlabSize(base, state.slabSize),
      }
    }
    case 'PATCH_CONFIG':
      return { ...state, config: { ...state.config, ...action.patch } }
    case 'SET_ACTIVE_INDEX':
      return { ...state, activeIndex: Math.max(0, Math.min(action.index, state.cards.length - 1)) }
    case 'SET_SIDE':
      return { ...state, side: action.side, config: { ...state.config, side: action.side } }
    default:
      return state
  }
}

/** Can the user advance past this step? Returns null when OK, else a reason. */
export function stepBlocker(state: WizardState): string | null {
  switch (state.step) {
    case 1:
      return state.cards.length === 0 ? 'Pick at least one card to continue.' : null
    case 2:
      return state.holder === null ? 'Choose a holder type to continue.' : null
    case 3:
      return state.styleId === null ? 'Choose a label style to continue.' : null
    default:
      return null
  }
}
