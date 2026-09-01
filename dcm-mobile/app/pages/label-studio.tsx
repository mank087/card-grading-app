import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, useWindowDimensions, FlatList, Alert, Share, Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors, ConditionLabels } from '@/lib/constants'
import { getContextLine } from '@/lib/labelData'
import {
  COLOR_PRESETS, LAYOUT_STYLES, CARD_COLOR_STYLES, DIMENSION_PRESETS,
  applyLayoutToColors,
  type ColorPreset, type CardColorInput, type DimensionPreset,
} from '@/lib/labelPresets'

const GEOMETRIC_PATTERNS = [
  { id: 0, name: 'Shattered' },
  { id: 1, name: 'Stripes' },
  { id: 2, name: 'Fractured' },
  { id: 3, name: 'Mosaic' },
  { id: 4, name: 'Lightning' },
] as const
import LabelWebRenderer, { type LabelConfig, type LabelCardData } from '@/components/labels/LabelWebRenderer'
import {
  HERITAGE_PATTERNS,
  HERITAGE_BRAND_COLORS,
  HERITAGE_CHIP_BLACK,
  HERITAGE_GRADE_INKS,
  GRADE_10_FOIL_STOPS,
  resolveHeritageBandColors,
} from '@/lib/heritage'
import ColorPickerModal from '@/components/labels/ColorPickerModal'
import LabelMockup, { type LabelTypeId } from '@/components/labels/LabelMockup'
import LabelBadgesPicker from '@/components/labels/LabelBadgesPicker'
import LabelPositionPicker, { type AverySheet } from '@/components/labels/LabelPositionPicker'
import MobileTabBar from '@/components/MobileTabBar'
import AppHeaderBar from '@/components/AppHeaderBar'
import ExportRunner, { type ExportSource } from '@/components/exports/ExportRunner'
import { saveToDocuments, presentSaveSuccess } from '@/lib/downloads'
import { useSegments } from 'expo-router'
import { useLabelStyle, MAX_SAVED_LABEL_STYLES } from '@/hooks/useLabelStyle'
import { useUserEmblems } from '@/hooks/useUserEmblems'
import * as WebBrowser from 'expo-web-browser'
import { productsForHolder, productUrl } from '@/lib/shopProducts'

// SCREEN_W is now read per-render via useWindowDimensions() inside the
// component so the FlatList snap interval tracks iPad rotation +
// split-screen resizing.

// Label gallery — matches LABEL_TYPES on web. Each item has a holder type
// (slab / one-touch / toploader / digital) so the mockup tile renders the
// correct frame, plus the export route ID used by the /label-export flow.
/**
 * Holder / style / format — the three decisions the gallery tiles fuse.
 *
 * Web's wizard asks them separately (holder, then style, with Toploader
 * choosing a format). Mobile keeps the tile list as its internal source of
 * truth so every downstream memo and handler is untouched, and the pickers
 * above the gallery simply resolve to a tile id. Swiping the gallery still
 * works and drives the pickers back the other way.
 */
export type HolderId = 'slab' | 'onetouch' | 'toploader' | 'digital'
export type StyleId = 'heritage' | 'modern' | 'traditional' | 'custom'
export type ToploaderFormat = 'front-back' | 'foldover'

const HOLDER_OPTIONS: Array<{ id: HolderId; name: string; blurb: string; image?: any }> = [
  { id: 'slab',      name: 'Graded Slab',  blurb: '2.8" × 0.8" label · cut and insert', image: require('@/assets/images/graded-card-slab.png') },
  { id: 'onetouch',  name: 'One-Touch',    blurb: '2.375" × 0.625" · Avery 6871', image: require('@/assets/images/mag-one-touch-DCM.png') },
  { id: 'toploader', name: 'Toploader',    blurb: '1.75" × 0.5" · Avery 8167', image: require('@/assets/images/top-loader-dcm.png') },
  { id: 'digital',   name: 'Card Image',   blurb: '800 × 1120 px · eBay and social' },
]

/**
 * Print-run cap: two full slab sheets, matching web.
 *
 * Slab is the tightest format at 10 labels per page, so 20 is exactly two
 * sheets there; 6871 fits 18 and 8167 fits 40 (80 folded). Every sheet builder
 * paginates, so this is a review limit rather than a technical one.
 */
const MAX_PRINT_RUN = 20

/** Step 6 (supplies) is optional — reachable from Finish, never required. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

const WIZARD_STEPS: Array<{ n: WizardStep; name: string; optional?: boolean }> = [
  { n: 1, name: 'Cards' },
  { n: 2, name: 'Holder' },
  { n: 3, name: 'Style' },
  { n: 4, name: 'Customize' },
  { n: 5, name: 'Finish' },
  { n: 6, name: 'Supplies', optional: true },
]

/** Cards per printed sheet, by holder — drives the sheet-count hint. */
function sheetsNeeded(count: number, holder: HolderId, foldover: boolean): number {
  const per = holder === 'slab' ? 10
    : holder === 'onetouch' ? 18
    : holder === 'toploader' ? (foldover ? 80 : 40)
    : count // digital: one image per card, no sheet
  return Math.max(1, Math.ceil(count / per))
}

/** Slab slot sizes. Zion Mag Pro's opening is smaller in both dimensions. */
const SLAB_SIZES: Array<{ id: string; name: string; width: number; height: number; note?: string }> = [
  { id: 'standard', name: 'Standard', width: 2.8, height: 0.8 },
  { id: 'zion', name: 'Zion Mag Pro', width: 2.51, height: 0.76, note: 'Prints at 2.51" × 0.76" for the smaller Zion slot.' },
]

/** Which styles a holder can actually print. Mirrors web styleOptionsForHolder. */
function stylesForHolder(holder: HolderId): StyleId[] {
  if (holder === 'slab') return ['heritage', 'modern', 'traditional', 'custom']
  if (holder === 'digital') return ['modern', 'traditional']
  // Heritage Compact fits Heritage to the small holders; Traditional has no
  // compact layout, so it is not offered there.
  return ['heritage', 'modern']
}

const LABEL_GALLERY: Array<{
  id: LabelTypeId
  name: string
  holderLabel: string
  shortName: string
  dimensions: string
  useCase: string
  description: string
  howToApply: string
  forcedStyle?: 'modern' | 'traditional' | 'heritage'
  needsFormat?: boolean
  /** Holder + style + format this tile represents, for the pickers. */
  holder: HolderId
  style: StyleId
  format?: ToploaderFormat
}> = [
  { id: 'slab-modern',         name: 'Graded Slab (Modern)',      holderLabel: 'Graded Card Slab', shortName: 'Modern Slab',      dimensions: '2.8" × 0.8"',     useCase: 'Insert into standard grading slab', description: 'Dark gradient label matching DCM modern style. Duplex printing with front grade and back QR code.', howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.', forcedStyle: 'modern', needsFormat: true , holder: 'slab', style: 'modern' },
  { id: 'slab-traditional',    name: 'Graded Slab (Traditional)', holderLabel: 'Graded Card Slab', shortName: 'Traditional Slab', dimensions: '2.8" × 0.8"',     useCase: 'Insert into standard grading slab', description: 'Light/white label with classic grading style. Clean, professional look for any slab.', howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.', forcedStyle: 'traditional', needsFormat: true , holder: 'slab', style: 'traditional' },
  { id: 'slab-heritage',       name: 'Graded Slab (Heritage)',    holderLabel: 'Graded Card Slab', shortName: 'Heritage Slab',    dimensions: '2.8" × 0.8"',     useCase: 'Insert into standard grading slab', description: 'Ivory Round 3 design — patterned side band in the card colors, grade-colored chip, rainbow-foil Gem Mint 10.', howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.', forcedStyle: 'heritage', needsFormat: true , holder: 'slab', style: 'heritage' },
  { id: 'onetouch',            name: 'Magnetic One-Touch',        holderLabel: 'Mag One Touch',    shortName: 'One-Touch',        dimensions: '1.25" × 2.375"',  useCase: 'Avery 6871 for magnetic cases',     description: 'Sized for Avery 6871 labels. Fits magnetic one-touch card holders perfectly.', howToApply: 'Print on Avery 6871 label sheets. Peel and stick to one-touch magnetic case.' , holder: 'onetouch', style: 'modern' },
  { id: 'toploader',           name: 'Toploader Front+Back',      holderLabel: 'Top Loader',       shortName: 'Toploader',        dimensions: '1.75" × 0.5"',    useCase: 'Avery 8167, front grade + back QR', description: 'Two small labels per card — grade info on front, QR code on back of toploader.', howToApply: 'Print on Avery 8167 sheets. Apply front label to toploader front, back label to rear.' , holder: 'toploader', style: 'modern', format: 'front-back' },
  { id: 'foldover',            name: 'Fold-Over Toploader',       holderLabel: 'Top Loader',       shortName: 'Fold-Over',        dimensions: '1.75" × 0.5"',    useCase: 'Single label, fold over toploader tab', description: 'One label that folds over the toploader opening. Grade visible on front, QR on back.', howToApply: 'Print on Avery 8167. Apply to toploader top edge and fold over to seal.' , holder: 'toploader', style: 'modern', format: 'foldover' },
  // Heritage Compact (Aug 2026) — the Heritage layout fitted to the small
  // holders. The ids double as the export route's `-heritage` type suffix.
  { id: 'onetouch-heritage',   name: 'One-Touch (Heritage)',      holderLabel: 'Mag One Touch',    shortName: 'Heritage One-Touch', dimensions: '2.375" × 0.625"', useCase: 'Avery 6871 for magnetic cases',     description: 'The full Heritage layout — patterned band, grade chip, DCM wordmark — fitted to the one-touch panel.', howToApply: 'Print on Avery 6871 at 100% scale. Fold at the centre line and wrap over the case edge.', forcedStyle: 'heritage', holder: 'onetouch', style: 'heritage' },
  { id: 'toploader-heritage',  name: 'Toploader (Heritage)',      holderLabel: 'Top Loader',       shortName: 'Heritage Toploader', dimensions: '1.75" × 0.5"',    useCase: 'Avery 8167, front grade + back QR', description: 'Heritage band and grade chip at toploader size — the divider and serial come off the front to keep the name readable.', howToApply: 'Print on Avery 8167 at 100% scale. Front label to the toploader front, back label to the rear.', forcedStyle: 'heritage', holder: 'toploader', style: 'heritage', format: 'front-back' },
  { id: 'foldover-heritage',   name: 'Fold-Over (Heritage)',      holderLabel: 'Top Loader',       shortName: 'Heritage Fold-Over', dimensions: '0.5" × 0.875" half', useCase: 'Single label, folds over the top edge', description: 'Heritage band across the top, grade chip and wordmark below, on the folded portrait half.', howToApply: 'Print on Avery 8167 at 100% scale. Fold on the centre line and wrap over the toploader edge.', forcedStyle: 'heritage', holder: 'toploader', style: 'heritage', format: 'foldover' },
  { id: 'card-image-modern',   name: 'Card Image (Modern)',       holderLabel: 'Digital',          shortName: 'Card Image',       dimensions: '800 × 1120 px',   useCase: 'eBay / social media sharing',       description: 'Digital card image with modern dark label overlay. Perfect for online listings.', howToApply: 'Download and upload to eBay, social media, or online marketplace listings.', forcedStyle: 'modern' , holder: 'digital', style: 'modern' },
  { id: 'card-image-traditional', name: 'Card Image (Traditional)', holderLabel: 'Digital',         shortName: 'Card Image',       dimensions: '800 × 1120 px',   useCase: 'eBay / social media sharing',       description: 'Digital card image with traditional light label overlay. Clean look for listings.', howToApply: 'Download and upload to eBay, social media, or online marketplace listings.', forcedStyle: 'traditional' , holder: 'digital', style: 'traditional' },
  { id: 'custom',              name: 'Custom Label',              holderLabel: 'Graded Card Slab', shortName: 'Custom',           dimensions: 'Any size',        useCase: 'Design your own',                   description: 'Custom dimensions, colors, borders, and editable text.', howToApply: 'Customize the colors, layout, and dimensions in the Customize section below.', needsFormat: true , holder: 'slab', style: 'custom' },
]

// ============================================================================
// Types
// ============================================================================

interface CardColors {
  primary: string
  secondary: string
  palette: string[]
  isDark: boolean
  borderColor?: string
  topEdgeColors?: string[]
}

interface DesignerConfig {
  colorPreset: string
  gradientStart: string
  gradientEnd: string
  style: 'modern' | 'traditional' | 'heritage'
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  topEdgeGradient?: string[]
  customColors?: string[]
  layoutStyle?: string
  gradientAngle?: number
  geometricPattern?: number
  /** Label text polarity (matches CustomLabelConfig.textColorMode on web). */
  textColorMode?: 'auto' | 'light' | 'dark'
  /** Grade digit color (matches web CustomLabelConfig.gradeColor). 'auto' or
      absent = historical purple-on-light / white-on-dark by polarity. */
  gradeColor?: string
  /** Typography scale for grade + card text (matches web fontScale; 1 = standard). */
  fontScale?: number
  // Dimension preset bookkeeping (matches CustomLabelConfig in src/lib/labelPresets.ts)
  preset?: 'dcm' | 'dcm-traditional' | 'dcm-heritage' | 'dcm-bordered' | 'custom'
  /** Heritage fields (mirror web CustomLabelConfig); only read when style==='heritage'. */
  heritagePattern?: string
  heritageColorSource?: 'card' | 'brand'
  heritageBandColors?: string[]
  heritageGradeColors?: Record<string, string>
  width?: number
  height?: number
}

// Baseline designer state — also the base a saved style is applied over in
// loadStyle, so optional fields absent from the saved config (layoutStyle,
// geometricPattern, customColors, …) reset instead of leaking from the
// previous design.
const DEFAULT_DESIGNER_CONFIG: DesignerConfig = {
  colorPreset: 'modern-dark',
  gradientStart: '#1a1625',
  gradientEnd: '#2d1f47',
  style: 'modern',
  borderEnabled: false,
  borderColor: '#7c3aed',
  borderWidth: 0.04,
  preset: 'dcm',
  width: 2.8,
  height: 0.8,
}

// ============================================================================
// DimensionInput — width/height field that tolerates intermediate typing
// state (empty, lone ".", partial decimals) without snapping back to the
// fallback value on every keystroke. The previous implementation parsed
// + clamped on every onChangeText, so clearing the field instantly fell
// through to the fallback default and the user could never retype. iOS
// makes this especially obvious because the decimal-pad keyboard fires
// onChangeText for each character. Commit happens on blur with clamping.
// ============================================================================

function DimensionInput({
  value,
  min,
  max,
  fallback,
  styleField,
  onCommit,
}: {
  value: number
  min: number
  max: number
  fallback: number
  styleField: any
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  // External value changes (preset taps, reset, etc.) refresh the draft
  // so the field reflects the new value while the user isn't editing it.
  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = () => {
    const parsed = parseFloat(draft)
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed))
      onCommit(clamped)
      // Reflect any clamping back into the field text on blur, so a
      // typed "10" in a 0.5-4 input visibly snaps to "4".
      if (clamped !== parsed) setDraft(String(clamped))
    } else {
      // Empty / unparseable: revert to the last committed value rather
      // than silently overwriting with the fallback.
      onCommit(fallback)
      setDraft(String(fallback))
    }
  }

  return (
    <TextInput
      style={styleField}
      value={draft}
      keyboardType="decimal-pad"
      onChangeText={setDraft}
      onBlur={commit}
      selectTextOnFocus
    />
  )
}

// ============================================================================
// Main Screen
// ============================================================================

/**
 * Field label row with an explicit "custom override" state: when the value
 * differs from the AI-generated baseline it shows an amber chip that resets
 * the field on tap (parity with web's DetailField, Jul 27).
 */
function FieldHeader({ label, value, baseline, onReset }: {
  label: string
  value: string
  baseline: string | null
  onReset: (baselineValue: string) => void
}) {
  const overridden = baseline != null && value.trim() !== baseline.trim()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {overridden && (
        <TouchableOpacity onPress={() => onReset(baseline!)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={{ fontSize: 9, color: '#b45309', backgroundColor: '#fef3c7', borderWidth: StyleSheet.hairlineWidth, borderColor: '#fcd34d', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' }}>
            custom · reset ⟲
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function LabelStudioScreen() {
  const params = useLocalSearchParams<{ cardId?: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const userEmblems = useUserEmblems()
  // Live screen width — re-renders on iPad rotation so the FlatList
  // snap interval and item width track the new viewport.
  const { width: SCREEN_W } = useWindowDimensions()
  // (tabs)/labels.tsx re-exports this screen so the Labels tab and the
  // /pages/label-studio route share one implementation. When mounted as
  // a tab, the (tabs) layout already provides the AppHeaderBar (top) +
  // tab bar (bottom), so suppress our inline chrome to avoid stacking
  // two of each.
  const segments = useSegments()
  const isTabContext = segments[0] === '(tabs)'
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /**
   * Wizard step. Step 6 (supplies) is OPTIONAL — reachable from Finish, never
   * required to print. Mirrors the web wizard's shape.
   */
  const [step, setStep] = useState<WizardStep>(1)
  const scrollRef = useRef<ScrollView>(null)
  const goToStep = useCallback((next: WizardStep) => {
    setStep(next)
    // Steps are long; landing mid-scroll makes it look like nothing happened.
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }))
  }, [])

  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  /**
   * Cards in the current print run, in pick order.
   *
   * Separate from `selectedCard`, which stays the one card the preview and the
   * label-text editor work against — the design applies to every card in the
   * run, exactly as the web wizard's swiper works. Empty means "just the
   * selected card", so the single-card flow is untouched until you add a
   * second.
   */
  const [printRunIds, setPrintRunIds] = useState<string[]>([])
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)
  const [cardColors, setCardColors] = useState<CardColors | null>(null)
  const [search, setSearch] = useState('')

  // Designer state
  const [config, setConfig] = useState<DesignerConfig>({ ...DEFAULT_DESIGNER_CONFIG })
  const [activeCardColorStyle, setActiveCardColorStyle] = useState<string | null>(null)
  const [customColorCount, setCustomColorCount] = useState(2)
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)
  const [labelPreviewType, setLabelPreviewType] = useState<string | null>(null)
  /** Surfaced under the preview — a silent console.warn is invisible on a phone. */
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')

  // Editable text fields
  const [labelName, setLabelName] = useState('')
  const [labelSet, setLabelSet] = useState('')
  const [labelSubset, setLabelSubset] = useState('')
  const [labelNumber, setLabelNumber] = useState('')
  const [labelYear, setLabelYear] = useState('')
  const [labelFeatures, setLabelFeatures] = useState('')
  const labelBaselineRef = useRef<{ name: string; set: string; subset: string; number: string; year: string; features: string } | null>(null)
  const [staleDismissed, setStaleDismissed] = useState(false)
  const [fieldsInitialized, setFieldsInitialized] = useState<string | null>(null)
  const [savingLabelFields, setSavingLabelFields] = useState(false)

  // Saved styles — synced with web via useLabelStyle hook (server source of truth).
  // Replaces the previous AsyncStorage-only flow so users see the same custom-1..4
  // slots they have on the web account.
  const { customStyles, saveCustomStyle, deleteCustomStyle, renameCustomStyle, switchStyle } = useLabelStyle()
  const [savingStyle, setSavingStyle] = useState(false)
  const [renamingStyleId, setRenamingStyleId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(
    Math.max(0, LABEL_GALLERY.findIndex(t => t.id === 'slab-heritage')),
  )
  const galleryListRef = useRef<FlatList<any>>(null)
  // Jump the swipe gallery to a tile programmatically (e.g. tapping the
  // "DCM Heritage" dimension preset) — the preview and per-tile option
  // sections key off activeGalleryIdx, which swipes alone used to control.
  const jumpToTile = useCallback((tileId: string) => {
    const idx = LABEL_GALLERY.findIndex(t => t.id === tileId)
    if (idx < 0 || idx === activeGalleryIdx) return
    setActiveGalleryIdx(idx)
  }, [activeGalleryIdx])

  // ---- Holder / style / format pickers ----
  // Derived FROM the gallery index rather than held separately, so swiping the
  // gallery and tapping a chip can never disagree.
  const activeTile = LABEL_GALLERY[activeGalleryIdx]
  const activeHolder: HolderId = activeTile?.holder ?? 'slab'
  const activeStyle: StyleId = activeTile?.style ?? 'modern'
  const activeFormat: ToploaderFormat = activeTile?.format ?? 'front-back'

  /** Resolve a holder+style+format triple to a tile, tolerating gaps. */
  const findTile = useCallback((holder: HolderId, style: StyleId, format: ToploaderFormat) => {
    const inHolder = LABEL_GALLERY.filter(t => t.holder === holder)
    const matchesFormat = (t: typeof LABEL_GALLERY[number]) =>
      holder !== 'toploader' || (t.format ?? 'front-back') === format
    return inHolder.find(t => t.style === style && matchesFormat(t))
      // Style not offered for this holder (e.g. Traditional on a toploader):
      // fall back to the holder's first tile in the requested format.
      || inHolder.find(matchesFormat)
      || inHolder[0]
  }, [])

  const goToTile = useCallback((holder: HolderId, style: StyleId, format: ToploaderFormat) => {
    const tile = findTile(holder, style, format)
    if (tile) jumpToTile(tile.id)
  }, [findTile, jumpToTile])

  const selectHolder = useCallback((h: HolderId) => {
    // Keep the current style when the new holder supports it, else take its first.
    const keep = stylesForHolder(h).includes(activeStyle) ? activeStyle : stylesForHolder(h)[0]
    goToTile(h, keep, activeFormat)
  }, [activeStyle, activeFormat, goToTile])

  const selectStyle = useCallback((st: StyleId) => goToTile(activeHolder, st, activeFormat),
    [activeHolder, activeFormat, goToTile])

  const selectFormat = useCallback((f: ToploaderFormat) => goToTile(activeHolder, activeStyle, f),
    [activeHolder, activeStyle, goToTile])

  /**
   * The web-rendered panel only belongs to the tile it was rendered for.
   *
   * Slab and digital tiles have always shown it. Small holders only have a
   * rendered panel for Heritage Compact — a Modern one-touch tile must keep
   * its native inline label, or it would display the slab artwork.
   */
  const previewUrlForTile = useCallback((tile: typeof LABEL_GALLERY[number]) => {
    if (tile.holder === 'slab' || tile.holder === 'digital') {
      return labelPreviewType && labelPreviewType.startsWith('slab-') ? labelPreviewUrl : null
    }
    // Compact panels only: the image must have been rendered for THIS tile,
    // or a slab render leaks into the small holder's slot.
    if (tile.style !== 'heritage' || tile.id !== activeTile?.id) return null
    return labelPreviewType === tile.id ? labelPreviewUrl : null
  }, [labelPreviewUrl, labelPreviewType, activeTile])

  /** The run as it will actually print: explicit picks, else the shown card. */
  const effectiveRunIds = printRunIds.length > 0
    ? printRunIds
    : (selectedCard?.id ? [selectedCard.id] : [])
  const runCardById = useCallback((id: string) => cards.find(c => c.id === id), [cards])

  /**
   * Keep the shown card inside the run.
   *
   * The step 3 swiper only renders artwork for the card that matches
   * selectedCard. Tapping a card that is NOT in the run left every slide
   * unmatched — no card image, no Heritage panel, just the bare holder with
   * the fallback Modern label. Snap back to the first card in the run.
   */
  useEffect(() => {
    if (printRunIds.length === 0 || !selectedCard) return
    if (printRunIds.includes(selectedCard.id)) return
    const first = cards.find(c => c.id === printRunIds[0])
    if (first) setSelectedCard(first)
  }, [printRunIds, selectedCard, cards])

  const toggleInRun = useCallback((cardId: string) => {
    setPrintRunIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId)
      if (prev.length >= MAX_PRINT_RUN) {
        Alert.alert('Print run full', `You can print up to ${MAX_PRINT_RUN} cards at once. Remove one to add another.`)
        return prev
      }
      // First add also captures the card already on screen, so the run matches
      // what the user thinks they are building.
      const seed = prev.length === 0 && selectedCard?.id && selectedCard.id !== cardId ? [selectedCard.id] : prev
      return [...seed, cardId]
    })
  }, [selectedCard])

  /** Why the user cannot advance yet, or null when they can. */
  const stepBlocker: string | null =
    step === 1 && !selectedCard ? 'Pick a card to continue.'
    : step === 2 && !activeTile ? 'Choose a holder to continue.'
    : null

  /** What /label-preview should draw: the compact panel, or the slab label. */
  const previewType = activeTile && activeTile.holder !== 'slab' && activeTile.holder !== 'digital'
    && activeTile.style === 'heritage'
    ? (activeTile.id as any)
    : (activeTile?.style === 'heritage' ? 'slab-heritage' : 'slab-custom')

  // Color picker modal
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerSlot, setPickerSlot] = useState<number>(0)
  const [pickerCurrentColor, setPickerCurrentColor] = useState('#7c3aed')

  const isCustomLayout = !!(config.layoutStyle) || config.colorPreset === 'custom'

  // ---- Data fetching ----
  const fetchCards = useCallback(async () => {
    if (!session?.user) return
    const { data, error } = await supabase
      .from('cards')
      .select('id, serial, front_path, back_path, card_name, featured, category, card_set, release_date, card_number, manufacturer_name, conversational_whole_grade, conversational_condition_label, conversational_card_info, conversational_weighted_sub_scores, conversational_sub_scores, card_colors, custom_label_data')
      .eq('user_id', session.user.id)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (!error && data) setCards(data)
    setIsLoading(false)
  }, [session])

  useEffect(() => { fetchCards() }, [fetchCards])

  // Auto-select card if cardId param was passed
  useEffect(() => {
    if (params.cardId && cards.length > 0 && !selectedCard) {
      const found = cards.find(c => c.id === params.cardId)
      if (found) setSelectedCard(found)
    }
  }, [params.cardId, cards, selectedCard])

  // Saved styles now live in user_credits.custom_label_styles via the hook —
  // no local hydration needed.

  // Initialize text fields when card changes — prefer existing custom_label_data
  // overrides (saved via the Save to Card button) over the AI-generated values
  // so users don't lose their edits across visits.
  useEffect(() => {
    if (!selectedCard || fieldsInitialized === selectedCard.id) return
    const ci = selectedCard.conversational_card_info
    const custom = selectedCard.custom_label_data || {}
    // Generated (AI) values — the baseline that edits are diffed against, so
    // untouched fields are never frozen as permanent overrides on save and
    // the "custom · reset" chips know what to revert to.
    const baseline = {
      name: selectedCard.card_name || ci?.card_name || selectedCard.featured || '',
      set: selectedCard.card_set || ci?.set_name || '',
      subset: ci?.subset || '',
      number: selectedCard.card_number || ci?.card_number || '',
      year: selectedCard.release_date || ci?.year || '',
      features: '',
    }
    labelBaselineRef.current = baseline
    setLabelName(custom.primaryName ?? baseline.name)
    setLabelSet(custom.setName ?? baseline.set)
    setLabelSubset(custom.subset ?? baseline.subset)
    setLabelNumber(custom.cardNumber ?? baseline.number)
    setLabelYear(custom.year ?? baseline.year)
    setLabelFeatures(Array.isArray(custom.features) ? custom.features.join(', ') : '')
    setFieldsInitialized(selectedCard.id)
    // Stale-override banner dismissal is remembered per card
    setStaleDismissed(false)
    AsyncStorage.getItem(`labelStudio_staleDismissed_${selectedCard.id}`)
      .then(v => { if (v === '1') setStaleDismissed(true) })
      .catch(() => { /* ignore */ })
  }, [selectedCard, fieldsInitialized])

  // Saved custom label text that differs from the card's CURRENT data —
  // either deliberate customization or a leftover from before the card's
  // data was corrected. Surfaced once per card (dismissal persists).
  const staleOverrideKeys = useMemo(() => {
    const b = labelBaselineRef.current
    const custom = selectedCard?.custom_label_data
    if (!b || !custom || fieldsInitialized !== selectedCard?.id) return [] as string[]
    const checks: Array<[string, unknown, string]> = [
      ['card number', custom.cardNumber, b.number],
      ['set', custom.setName, b.set],
      ['year', custom.year, b.year],
    ]
    return checks
      .filter(([, c, base]) => c != null && String(c).trim() !== '' && base && String(c).trim() !== base.trim())
      .map(([k]) => k)
  }, [selectedCard, fieldsInitialized])

  const dismissStaleBanner = useCallback(() => {
    setStaleDismissed(true)
    if (selectedCard?.id) {
      AsyncStorage.setItem(`labelStudio_staleDismissed_${selectedCard.id}`, '1').catch(() => { /* ignore */ })
    }
  }, [selectedCard?.id])

  const adoptCardData = useCallback(async () => {
    const b = labelBaselineRef.current
    if (!b || !selectedCard?.id || !session?.access_token) return
    setLabelNumber(b.number)
    setLabelSet(b.set)
    setLabelYear(b.year)
    // Persist: drop those keys from the stored override, keep other customizations
    const existing: Record<string, any> = { ...(selectedCard.custom_label_data || {}) }
    delete existing.cardNumber
    delete existing.setName
    delete existing.year
    const hasRemaining = Object.values(existing).some(v => v != null && (!Array.isArray(v) || v.length > 0))
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
      const res = await fetch(`${API_BASE}/api/cards/${selectedCard.id}/custom-label`, {
        method: hasRemaining ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        ...(hasRemaining ? { body: JSON.stringify({ customFields: existing }) } : {}),
      })
      if (!res.ok) throw new Error('Could not update the saved label')
      setSelectedCard((prev: any) => prev ? { ...prev, custom_label_data: hasRemaining ? existing : null } : prev)
      dismissStaleBanner()
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Could not update the saved label.')
    }
  }, [selectedCard, session?.access_token, dismissStaleBanner])

  // Load card image when selected — both front and back so the gallery's
  // side toggle can flip the card photo too.
  useEffect(() => {
    if (!selectedCard?.front_path) { setFrontUrl(null); setBackUrl(null); return }
    supabase.storage.from('cards').createSignedUrl(selectedCard.front_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setFrontUrl(data.signedUrl) })
    if (selectedCard?.back_path) {
      supabase.storage.from('cards').createSignedUrl(selectedCard.back_path, 3600)
        .then(({ data }) => { if (data?.signedUrl) setBackUrl(data.signedUrl) })
    } else {
      setBackUrl(null)
    }
  }, [selectedCard])

  // Load card colors. The grading pipeline kicks off extraction
  // fire-and-forget (see vision-grade etc.), so a freshly-graded card may
  // not have card_colors populated yet by the time we get here. Web's
  // LabelStudioClient falls back to client-side Canvas extraction; RN has
  // no Canvas, so hit the on-demand /extract-colors endpoint instead. The
  // endpoint is a no-op if colors are already saved.
  useEffect(() => {
    if (!selectedCard) { setCardColors(null); return }
    if (selectedCard.card_colors) { setCardColors(selectedCard.card_colors); return }
    setCardColors(null)
    if (!session?.access_token || !selectedCard.id) return
    let cancelled = false
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
    fetch(`${API_BASE}/api/cards/${selectedCard.id}/extract-colors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled || !json?.card_colors) return
        setCardColors(json.card_colors)
      })
      .catch(() => { /* leave cardColors null; UI shows disabled tile */ })
    return () => { cancelled = true }
  }, [selectedCard, session?.access_token])

  // ---- Config helpers ----
  const updateConfig = useCallback((partial: Partial<DesignerConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }, [])

  // Build label data for renderer
  const labelCardData = useMemo<LabelCardData | null>(() => {
    if (!selectedCard) return null
    const grade = selectedCard.conversational_whole_grade
    const name = labelName || 'Card'
    // Build the context line via the shared helper so ordering/formatting
    // matches web ("Set • Subset • #Number • Year"); the live edit fields
    // are passed as custom_label_data overrides so in-flight edits win.
    const contextLine = getContextLine({
      ...selectedCard,
      custom_label_data: {
        ...(selectedCard.custom_label_data || {}),
        setName: labelSet,
        subset: labelSubset,
        cardNumber: labelNumber,
        year: labelYear,
      },
    })
    const ws = selectedCard.conversational_weighted_sub_scores || {}
    const sr = selectedCard.conversational_sub_scores || {}
    const ext = (key: string): number => {
      const v = ws[key]; if (typeof v === 'number') return v
      if (v && typeof v === 'object' && typeof v.weighted === 'number') return v.weighted
      const sv = sr[key]; if (typeof sv === 'number') return sv
      if (sv && typeof sv === 'object' && typeof sv.weighted === 'number') return sv.weighted
      return 0
    }
    const hasSub = ws.centering !== undefined || sr.centering !== undefined

    return {
      primaryName: name,
      contextLine,
      featuresLine: labelFeatures || '',
      serial: selectedCard.serial || '',
      grade: grade,
      // Condition is derived from the grade (single source of truth) —
      // historical rows have stored conversational_condition_label values
      // that diverge from the grade. Fall back to the stored label only
      // when the card has no grade.
      condition: (grade != null && ConditionLabels[Math.round(Number(grade))])
        || selectedCard.conversational_condition_label
        || '',
      subScores: hasSub ? { centering: ext('centering'), corners: ext('corners'), edges: ext('edges'), surface: ext('surface') } : undefined,
      qrUrl: `https://dcmgrading.com/verify/${selectedCard.serial || ''}`,
    }
  }, [selectedCard, labelName, labelSet, labelSubset, labelYear, labelNumber, labelFeatures])

  // Inline label props for non-slab gallery tiles (toploader, one-touch, foldover).
  // These holders use compact Avery-sticker layouts that are NOT the slab label,
  // so they need the same fields web's getCardSlabProps yields. Web returns the
  // features as an array; mobile stores them as a CSV — split here.
  const inlineLabelProps = useMemo(() => {
    if (!labelCardData) return undefined
    const features = (labelCardData.featuresLine || '')
      .split(/[•,]/).map(f => f.trim()).filter(Boolean)
    return {
      displayName: labelCardData.primaryName || '',
      setLineText: labelCardData.contextLine || '',
      features,
      serial: labelCardData.serial || '',
      grade: typeof labelCardData.grade === 'number' ? labelCardData.grade : null,
      condition: labelCardData.condition || '',
      isAlteredAuthentic: false,
      subScores: labelCardData.subScores,
      qrUrl: labelCardData.qrUrl,
    }
  }, [labelCardData])

  // Emblem flags for the slab back label — useUserEmblems combines the
  // user's entitlement (founder/VIP/card-lover) with which they've selected
  // in the Label Badges picker.
  const galleryEmblems = useMemo(() => ({
    showFounderEmblem: !!userEmblems.showFounder,
    showVipEmblem: !!userEmblems.showVip,
    showCardLoversEmblem: !!userEmblems.showCardLovers,
  }), [userEmblems.showFounder, userEmblems.showVip, userEmblems.showCardLovers])

  // Custom slab color overrides — pipes the customizer's full in-flight
  // config into the slab gallery tile so the preview updates live with
  // colors AND layout style (color-gradient / card-extension / neon-outline
  // / geometric / team-colors split).
  const customOverrides = useMemo(() => {
    const baseGradient = config.customColors && config.customColors.length >= 2
      ? config.customColors
      : [config.gradientStart, config.gradientEnd, config.gradientStart]
    return {
      labelGradient: baseGradient,
      layoutStyle: config.layoutStyle || config.colorPreset,
      topEdgeGradient: config.topEdgeGradient,
      borderEnabled: config.borderEnabled,
      borderColor: config.borderColor,
      gradientAngle: config.gradientAngle,
      geometricPattern: config.geometricPattern,
      textColorMode: config.textColorMode,
    }
  }, [config.gradientStart, config.gradientEnd, config.customColors, config.layoutStyle, config.colorPreset, config.topEdgeGradient, config.borderEnabled, config.borderColor, config.gradientAngle, config.geometricPattern, config.textColorMode])

  // Derive the labelConfig sent to LabelWebRenderer. For tiles with a
  // forcedStyle (slab-modern, slab-traditional, card-image-modern,
  // card-image-traditional), override the user's customizer colors with the
  // preset values so the preview matches that tile's intended style. For the
  // custom tile (and all toploader/onetouch variants), pass the live
  // customizer config so user edits flow through.
  const labelConfig = useMemo<LabelConfig>(() => {
    const activeTile = LABEL_GALLERY[activeGalleryIdx]
    const baseDims = {
      preset: config.preset || 'dcm',
      width: config.width ?? 2.8,
      height: config.height ?? 0.8,
      borderWidth: config.borderWidth,
    }
    if (activeTile?.id === 'slab-modern' || activeTile?.id === 'card-image-modern') {
      return {
        ...baseDims,
        colorPreset: 'modern-dark',
        gradientStart: '#1a1625',
        gradientEnd: '#2d1f47',
        style: 'modern',
        borderEnabled: false,
        borderColor: '#7c3aed',
      }
    }
    if (activeTile?.style === 'heritage') {
      return {
        ...baseDims,
        colorPreset: 'traditional',
        gradientStart: '#f9fafb',
        gradientEnd: '#ffffff',
        style: 'heritage',
        heritagePattern: config.heritagePattern || 'diamond',
        heritageColorSource: config.heritageColorSource,
        heritageBandColors: config.heritageBandColors,
        heritageGradeColors: config.heritageGradeColors,
        borderEnabled: false,
        borderColor: '#7c3aed',
      }
    }
    if (activeTile?.id === 'slab-traditional' || activeTile?.id === 'card-image-traditional') {
      return {
        ...baseDims,
        colorPreset: 'traditional',
        gradientStart: '#f9fafb',
        gradientEnd: '#ffffff',
        style: 'traditional',
        borderEnabled: false,
        borderColor: '#7c3aed',
      }
    }
    // Custom + everything else — flow user's customizer state through.
    return {
      ...baseDims,
      colorPreset: config.colorPreset,
      gradientStart: config.gradientStart,
      gradientEnd: config.gradientEnd,
      style: config.style,
      borderEnabled: config.borderEnabled,
      borderColor: config.borderColor,
      topEdgeGradient: config.topEdgeGradient,
      gradientAngle: config.gradientAngle,
      geometricPattern: config.geometricPattern,
      customColors: config.customColors,
      layoutStyle: config.layoutStyle,
      textColorMode: config.textColorMode,
      gradeColor: config.gradeColor,
      fontScale: config.fontScale,
      heritagePattern: config.heritagePattern,
      heritageColorSource: config.heritageColorSource,
      heritageBandColors: config.heritageBandColors,
      heritageGradeColors: config.heritageGradeColors,
    }
  }, [config, activeGalleryIdx])

  // Heritage band palette as currently resolved (custom edits win, then the
  // brand toggle, then the card's extracted colours).
  const heritageResolvedBand = useMemo(() => {
    const custom = (config.heritageBandColors || []).filter(c => /^#[0-9a-fA-F]{6}$/.test(c))
    if (custom.length >= 2) return custom
    if (config.heritageColorSource === 'brand') return HERITAGE_BRAND_COLORS
    return resolveHeritageBandColors(cardColors)
  }, [config.heritageBandColors, config.heritageColorSource, cardColors])
  const isHeritageTile = LABEL_GALLERY[activeGalleryIdx]?.style === 'heritage'

  // ---- Handlers ----
  // Slab-modern, slab-traditional, and the matching card-image tiles render
  // with FIXED preset colors regardless of customizer state (see labelConfig
  // memo above). When the user starts customizing, hop them to the Custom
  // Label tile so their changes actually show up in the preview.
  const switchToCustomTileIfForced = useCallback(() => {
    const FORCED_TILES = ['slab-modern', 'slab-traditional', 'slab-heritage', 'card-image-modern', 'card-image-traditional', 'onetouch-heritage', 'toploader-heritage', 'foldover-heritage']
    const currentTile = LABEL_GALLERY[activeGalleryIdx]
    if (!currentTile || !FORCED_TILES.includes(currentTile.id)) return
    const customIdx = LABEL_GALLERY.findIndex(t => t.id === 'custom')
    if (customIdx >= 0 && customIdx !== activeGalleryIdx) setActiveGalleryIdx(customIdx)
  }, [activeGalleryIdx])

  const handleColorPreset = useCallback((preset: ColorPreset) => {
    switchToCustomTileIfForced()
    setActiveCardColorStyle(null)
    if (preset.id === 'custom') {
      const defaultCols = cardColors
        ? [cardColors.primary, cardColors.secondary]
        : [config.gradientStart, config.gradientEnd]
      const cols = config.customColors && config.customColors.length >= 2
        ? config.customColors : defaultCols
      setCustomColorCount(Math.max(2, cols.length))
      const layout = config.layoutStyle || 'color-gradient'
      updateConfig({ ...applyLayoutToColors(layout, cols), customColors: cols, layoutStyle: layout })
    } else if (preset.isCardColors) {
      if (!cardColors) return
      setActiveCardColorStyle('color-gradient')
      updateConfig({
        colorPreset: 'color-gradient',
        gradientStart: cardColors.primary,
        gradientEnd: cardColors.secondary,
        style: 'modern',
        customColors: undefined,
        layoutStyle: undefined,
      })
    } else if (preset.isRainbow) {
      // Rainbow needs a full 7-color palette so the LinearGradient sweeps
      // through every hue — was rendering as a 2-color red→blue strip.
      const RAINBOW_HUES = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff']
      updateConfig({
        colorPreset: 'rainbow',
        gradientStart: RAINBOW_HUES[0],
        gradientEnd: RAINBOW_HUES[RAINBOW_HUES.length - 1],
        style: 'modern',
        customColors: RAINBOW_HUES,
        layoutStyle: undefined,
      })
    } else {
      updateConfig({
        colorPreset: preset.id,
        gradientStart: preset.gradientStart,
        gradientEnd: preset.gradientEnd,
        style: preset.id === 'traditional' ? 'traditional' : 'modern',
        customColors: undefined,
        layoutStyle: undefined,
      })
    }
  }, [cardColors, config, updateConfig, switchToCustomTileIfForced])

  // Mirrors handleDimensionPreset in src/app/labels/LabelStudioClient.tsx so the
  // four DCM presets behave identically on mobile.
  const handleDimensionPreset = useCallback((preset: DimensionPreset) => {
    const base: any = {
      preset: preset.id,
      width: preset.width,
      height: preset.height,
    }
    if (preset.id === 'dcm') {
      base.colorPreset = 'modern-dark'
      base.gradientStart = '#1a1625'
      base.gradientEnd = '#2d1f47'
      base.style = 'modern'
      base.borderEnabled = false
      // Forced tiles ignore config — move the gallery so the preview follows.
      // (Same fix as dcm-heritage: clicking a preset while another forced
      // tile is active previously changed nothing visibly.)
      jumpToTile('slab-modern')
    } else if (preset.id === 'dcm-traditional') {
      base.colorPreset = 'traditional'
      base.gradientStart = '#f9fafb'
      base.gradientEnd = '#ffffff'
      base.style = 'traditional'
      base.borderEnabled = false
      jumpToTile('slab-traditional')
    } else if (preset.id === 'dcm-heritage') {
      base.colorPreset = 'traditional'
      base.gradientStart = '#f9fafb'
      base.gradientEnd = '#ffffff'
      base.style = 'heritage'
      base.heritagePattern = config.heritagePattern || 'diamond'
      base.borderEnabled = false
      // The preview + Heritage Options follow the gallery tile — bring it along.
      jumpToTile('slab-heritage')
    } else if (preset.id === 'dcm-bordered') {
      base.colorPreset = 'traditional'
      base.gradientStart = '#f9fafb'
      base.gradientEnd = '#ffffff'
      base.style = 'traditional'
      base.borderEnabled = true
      base.borderColor = '#7c3aed'
      base.borderWidth = 0.04
      // Bordered previews through the custom tile — the forced traditional
      // tile would hide the border.
      jumpToTile('custom')
    }
    setActiveCardColorStyle(null)
    updateConfig(base)
  }, [updateConfig, jumpToTile, config.heritagePattern])

  const handleCardColorStyle = useCallback((styleId: string) => {
    if (!cardColors) return
    switchToCustomTileIfForced()
    const style = CARD_COLOR_STYLES.find(s => s.id === styleId)
    if (!style) return
    const input: CardColorInput = {
      primary: cardColors.primary,
      secondary: cardColors.secondary,
      isDark: cardColors.isDark,
      borderColor: cardColors.borderColor,
      topEdgeColors: cardColors.topEdgeColors,
    }
    const colors = style.getColors(input)
    setActiveCardColorStyle(styleId)
    updateConfig({
      colorPreset: styleId,
      gradientStart: colors.gradientStart,
      gradientEnd: colors.gradientEnd,
      style: colors.style,
      borderEnabled: styleId === 'neon-outline',
      borderColor: colors.accentColor,
      borderWidth: styleId === 'neon-outline' ? 0.03 : 0.04,
      topEdgeGradient: colors.topEdgeGradient,
      customColors: cardColors.palette.slice(0, 5),
      layoutStyle: undefined,
    })
  }, [cardColors, updateConfig, switchToCustomTileIfForced])

  const handleCustomLayoutStyle = useCallback((layoutId: string) => {
    switchToCustomTileIfForced()
    const cols = config.customColors || [config.gradientStart, config.gradientEnd]
    updateConfig({
      ...applyLayoutToColors(layoutId, cols),
      customColors: cols,
      layoutStyle: layoutId,
    })
    setActiveCardColorStyle(null)
  }, [config, updateConfig, switchToCustomTileIfForced])

  const openColorPicker = useCallback((slotIndex: number) => {
    const cols = config.customColors || [config.gradientStart, config.gradientEnd]
    setPickerSlot(slotIndex)
    setPickerCurrentColor(cols[slotIndex] || '#7c3aed')
    setPickerVisible(true)
  }, [config])

  const handlePickerSelect = useCallback((hex: string) => {
    if (pickerSlot <= -100) {
      // Heritage per-grade chip colour (slot = -100 - grade)
      const grade = -(pickerSlot + 100)
      updateConfig({ heritageGradeColors: { ...(config.heritageGradeColors || {}), [String(grade)]: hex } })
      setPickerVisible(false)
      return
    }
    if (pickerSlot <= -10) {
      // Heritage band swatch (slot = -10 - index). Editing pins the palette.
      const i = -(pickerSlot + 10)
      const next = [...heritageResolvedBand]
      next[i] = hex
      updateConfig({ heritageBandColors: next })
      setPickerVisible(false)
      return
    }
    if (pickerSlot === -2) {
      // Grade digit color (July 2026 feature; slot convention: -1 border, -2 grade)
      updateConfig({ gradeColor: hex })
      setPickerVisible(false)
      return
    }
    if (pickerSlot === -1) {
      // Border color
      updateConfig({ borderColor: hex })
      setPickerVisible(false)
      return
    }
    const cols = [...(config.customColors || [config.gradientStart, config.gradientEnd])]
    while (cols.length <= pickerSlot) cols.push('#7c3aed')
    cols[pickerSlot] = hex
    if (pickerSlot + 1 > customColorCount) setCustomColorCount(pickerSlot + 1)
    const layout = config.layoutStyle || 'color-gradient'
    updateConfig({
      customColors: cols,
      ...applyLayoutToColors(layout, cols),
      layoutStyle: layout,
    })
    setPickerVisible(false)
  }, [config, pickerSlot, customColorCount, updateConfig, heritageResolvedBand])

  // ---- Saved styles (server-synced via useLabelStyle hook) ----
  // DesignerConfig is field-compatible with the CustomLabelConfig shape the
  // API stores, so save the FULL config. Spreading (rather than listing
  // fields) keeps optional designer fields (customColors, layoutStyle,
  // gradientAngle, geometricPattern, textColorMode) AND any future web-side
  // additions (e.g. gradeColor, fontScale) flowing through unchanged —
  // previously geometric/split/5-color designs corrupted on save.
  const buildSaveConfig = useCallback(() => {
    if (LABEL_GALLERY[activeGalleryIdx]?.style === 'heritage') {
      return { ...config, style: 'heritage', preset: 'dcm-heritage', heritagePattern: config.heritagePattern || 'diamond' }
    }
    return { ...config }
  }, [config, activeGalleryIdx])

  const saveStyle = useCallback(async () => {
    if (customStyles.length >= MAX_SAVED_LABEL_STYLES) {
      Alert.alert('Limit reached', `You can keep up to ${MAX_SAVED_LABEL_STYLES} saved styles. Update or delete one to save a new design.`)
      return
    }
    setSavingStyle(true)
    const slotNumber = customStyles.length + 1
    const saved = await saveCustomStyle({ name: `Custom Label ${slotNumber}`, config: buildSaveConfig() })
    if (saved) {
      // Apply across the account: saving alone only wrote the config into
      // custom_label_styles — label_style (which every surface reads, and
      // which defaults to 'heritage') stayed untouched, so the new design
      // never showed up anywhere. switchStyle persists label_style via the
      // API and updates the hook's local state + cache immediately.
      await switchStyle(saved.id as any)
    }
    setSavingStyle(false)
    if (saved) Alert.alert('Saved', `"${saved.name}" saved to slot ${saved.id} and applied across your account.`)
    else Alert.alert('Save failed', 'Could not save the style. Try again.')
  }, [customStyles.length, saveCustomStyle, buildSaveConfig, switchStyle])

  const updateExistingStyle = useCallback(async (id: string, name: string) => {
    setSavingStyle(true)
    const saved = await saveCustomStyle({ id, name, config: buildSaveConfig() })
    if (saved) await switchStyle(saved.id as any)
    setSavingStyle(false)
    if (saved) Alert.alert('Updated', `"${saved.name}" updated and applied across your account.`)
    else Alert.alert('Update failed', 'Could not update the style.')
  }, [saveCustomStyle, buildSaveConfig, switchStyle])

  const deleteStyle = useCallback(async (id: string) => {
    Alert.alert('Delete saved style?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const ok = await deleteCustomStyle(id)
        if (!ok) Alert.alert('Delete failed', 'Could not delete the style.')
      }},
    ])
  }, [deleteCustomStyle])

  const submitRename = useCallback(async () => {
    if (!renamingStyleId) return
    const trimmed = renamingValue.trim()
    if (!trimmed) { setRenamingStyleId(null); return }
    const ok = await renameCustomStyle(renamingStyleId, trimmed)
    setRenamingStyleId(null)
    setRenamingValue('')
    if (!ok) Alert.alert('Rename failed', 'Could not rename the style.')
  }, [renamingStyleId, renamingValue, renameCustomStyle])

  // Save edited label-fields back to the card row. Uses the same shape and
  // endpoint the web does (PUT /api/cards/{id}/custom-label) so edits made
  // on mobile show up identically when the card is rendered on web (slab,
  // collection grid, downloadable labels, etc.).
  const saveLabelFieldsToCard = useCallback(async () => {
    if (!selectedCard?.id || !session?.access_token) return
    setSavingLabelFields(true)
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
      // Diff against the AI-generated baseline (matches web): only edited
      // fields become overrides. Previously every field was saved wholesale,
      // freezing untouched values — so later data corrections never reached
      // the label (the Jul 27 wrong-card-number case).
      const b = labelBaselineRef.current
      const eq = (a: string, c: string | undefined) => a.trim() === (c ?? '').trim()
      const features = labelFeatures
        .split(',')
        .map(f => f.trim())
        .filter(Boolean)
        .slice(0, 10)
      const payload: Record<string, any> = {}
      if (labelName.trim() && (!b || !eq(labelName, b.name))) payload.primaryName = labelName.trim()
      if (!b || !eq(labelSet, b.set)) payload.setName = labelSet.trim() || null
      if (!b || !eq(labelSubset, b.subset)) payload.subset = labelSubset.trim() || null
      if (!b || !eq(labelNumber, b.number)) payload.cardNumber = labelNumber.trim() || null
      if (!b || !eq(labelYear, b.year)) payload.year = labelYear.trim() || null
      if (!b || labelFeatures.trim() !== b.features.trim()) payload.features = features

      const hadOverrides = !!selectedCard.custom_label_data && Object.keys(selectedCard.custom_label_data).length > 0
      const hasPayload = Object.keys(payload).length > 0
      if (!hasPayload && !hadOverrides) {
        Alert.alert('Nothing to save', 'All fields match the DCM Optic™ label.')
        return
      }
      const res = await fetch(`${API_BASE}/api/cards/${selectedCard.id}/custom-label`, {
        method: hasPayload ? 'PUT' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        ...(hasPayload ? { body: JSON.stringify({ customFields: payload }) } : {}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any))
        throw new Error(body.error || `Save failed (HTTP ${res.status})`)
      }
      // Patch the cached selectedCard so re-renders reuse the new values
      setSelectedCard((prev: any) => prev ? { ...prev, custom_label_data: hasPayload ? payload : null } : prev)
      Alert.alert('Saved', hasPayload
        ? 'Custom label text saved to this card. It will show up on slabs, collection thumbnails, and downloadable labels everywhere.'
        : 'All fields match the DCM Optic™ label — custom overrides removed.')
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not save custom label text.')
    } finally {
      setSavingLabelFields(false)
    }
  }, [selectedCard, session?.access_token, labelName, labelSet, labelSubset, labelNumber, labelYear, labelFeatures])

  // Gallery tile download — for now uses the same Share flow so the user
  // gets a PNG of the currently-visible label preview. Full per-type PDF
  // exports (Avery 6871/8167, foldover slabs, etc.) live on the card detail
  // page's Labels sheet; route the user there for those.
  // Opens the web's /label-export page in an in-app browser (Chrome custom
  // tab on Android, SFSafariViewController on iOS) with ?download=1. The page
  // generates the PDF via jsPDF and triggers a real browser download — file
  // goes straight to the device's Downloads folder. User stays in the app
  // context (browser dismisses to mobile app on close).
  const openWebDownload = useCallback(async (
    exportType: string,
    opts?: { format?: 'duplex' | 'foldover'; position?: number; position2?: number },
  ) => {
    if (!selectedCard?.id || !session?.access_token) return
    // A Heritage-based design (dcm-heritage preset / heritage tile) must go
    // through the web's HERITAGE generators. 'slab-custom' would route it to
    // customSlabLabelGenerator, which treats any non-'modern' style as the
    // flat traditional layout — the user's pattern/band colours were dropped
    // and the PDF came out traditional-styled.
    if (exportType === 'slab-custom' && config.style === 'heritage') {
      exportType = 'slab-heritage'
    }
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
    const params = new URLSearchParams()
    params.set('token', session.access_token)
    params.set('type', exportType)
    if (opts?.format) params.set('format', opts.format)
    if (opts?.position != null) params.set('position', String(opts.position))
    if (opts?.position2 != null) params.set('position2', String(opts.position2))
    // Heritage Compact types carry the style in a `-heritage` suffix that the
    // web export route understands (onetouch-heritage, toploader-heritage,
    // foldover-heritage). Treat them as Heritage everywhere below.
    const isHeritageExport = exportType === 'slab-heritage'
      || exportType === 'card-image-heritage'
      || exportType.endsWith('-heritage')
      || config.style === 'heritage'
    params.set('labelStyle', isHeritageExport ? 'heritage' : (config.style || 'modern'))
    // Heritage exports read the band pattern from the URL (web bridge
    // resolveHeritagePattern); band colours resolve per card server-side.
    if (isHeritageExport) {
      params.set('heritagePattern', config.heritagePattern || 'diamond')
    }
    params.set('download', '1')

    // For custom slab, ship the customizer's CURRENT in-flight config so the
    // generated PDF matches exactly what the user is designing — without
    // forcing them to save it to a slot first. Web /label-export reads this
    // base64-encoded JSON via ?customConfig=...
    // Compact Heritage sheets read the pinned band palette and per-grade chip
    // colours out of the same inline config the slab paths use.
    if (exportType === 'slab-custom' || isHeritageExport) {
      const inlineConfig = {
        colorPreset: config.colorPreset,
        gradientStart: config.gradientStart,
        gradientEnd: config.gradientEnd,
        style: config.style,
        borderEnabled: config.borderEnabled,
        borderColor: config.borderColor,
        borderWidth: config.borderWidth,
        topEdgeGradient: config.topEdgeGradient,
        gradientAngle: config.gradientAngle,
        geometricPattern: config.geometricPattern,
        customColors: config.customColors,
        layoutStyle: config.layoutStyle,
        textColorMode: config.textColorMode,
        gradeColor: config.gradeColor,
        fontScale: config.fontScale,
        heritagePattern: config.heritagePattern,
        heritageColorSource: config.heritageColorSource,
        heritageBandColors: config.heritageBandColors,
        heritageGradeColors: config.heritageGradeColors,
        preset: config.preset,
        width: config.width,
        height: config.height,
      }
      try {
        // base64 encoding works in modern RN via global.btoa polyfill or the
        // base64 npm; expo provides global.btoa. Fall back to manual encoding
        // if missing.
        const json = JSON.stringify(inlineConfig)
        const b64 = typeof global.btoa === 'function'
          ? global.btoa(json)
          : Buffer.from(json, 'utf-8').toString('base64')
        params.set('customConfig', b64)
      } catch (err) {
        console.warn('[label-studio] customConfig encode failed:', err)
      }
    }

    // Both iOS and Android: load /label-export/[cardId] in a hidden WebView
    // via ExportRunner. The page detects ReactNativeWebView and posts files
    // back as base64, which we save locally and surface via Sharing.shareAsync
    // / Print.printAsync. The 350ms defer covers the case where this is
    // called from a parent sheet's onPress.
    //
    // Android used to use WebBrowser.openBrowserAsync(url, ...) here, but
    // after enabling Android App Links verification (2026-05-22), Android
    // intercepts all https://dcmgrading.com/* URLs and routes them back into
    // the DCM app — which has no /label-export route, so expo-router
    // rendered +not-found ("the screen doesn't exist"). The in-app WebView
    // sidesteps that by loading the URL internally instead of asking the
    // OS to handle it externally.
    //
    // Strip download=1 — the page would otherwise try the anchor-click path
    // which doesn't work inside RN WebView. With it absent + the
    // ReactNativeWebView bridge present, the page postMessages back.
    params.delete('download')
    // A print run of more than one card goes to the batch route, which lays
    // every card onto the same sheets and paginates. One card keeps the
    // single-card route so its position picker still applies.
    const runIds = printRunIds.length > 1 ? printRunIds : null
    if (runIds) {
      params.delete('position')
      params.delete('position2')
      params.set('cardIds', runIds.join(','))
      // Batch takes GLOBAL slot indices, one per card, starting where the
      // single-card picker left off.
      if (opts?.position != null) {
        const step = exportType.startsWith('toploader') || exportType === 'toploader' ? 2 : 1
        params.set('positions', runIds.map((_, i) => opts.position! + i * step).join(','))
      }
    }
    const url = runIds
      ? `${API_BASE}/label-export/batch?${params.toString()}`
      : `${API_BASE}/label-export/${selectedCard.id}?${params.toString()}`
    const title = exportType === 'slab-heritage' ? 'Heritage Slab Label'
      : exportType === 'slab-custom' ? 'Custom Slab Label'
      : exportType === 'slab' ? 'Slab Label'
      : exportType === 'onetouch' ? 'One-Touch Label'
      : exportType === 'toploader' ? 'Toploader Label'
      : exportType === 'foldover' ? 'Fold-Over Label'
      : exportType === 'card-image' ? 'Card Image'
      : 'Label'
    setTimeout(() => setExportSource({ url, title }), 350)
  }, [selectedCard, session?.access_token, config, printRunIds])

  // Gallery's per-tile Download button — uses the in-app web browser
  // approach so the user gets the same download UX as mobile web.
  // Avery-sticker label types (onetouch / toploader / foldover) need the
  // user to pick which slot on the sheet to print into; they go through
  // LabelPositionPicker first. Slab labels prompt for duplex vs foldover.
  const [galleryPositionPicker, setGalleryPositionPicker] = useState<{ exportType: string; title: string; sheet: AverySheet } | null>(null)
  // iOS-only: drives the hidden-WebView ExportRunner. The web /label-export
  // page detects ReactNativeWebView and posts files back as base64, so we
  // sidestep SFSafariViewController's broken data-URL download behavior.
  const [exportSource, setExportSource] = useState<ExportSource | null>(null)

  const handleGalleryDownload = useCallback((labelType: typeof LABEL_GALLERY[number]) => {
    if (!selectedCard?.id) {
      Alert.alert('Select a card', 'Pick a card above before downloading a label.')
      return
    }
    // Gallery uses 'custom' for the user's custom slab tile; the export
    // pipeline expects 'slab-custom'.
    const exportType = labelType.id === 'custom' ? 'slab-custom' : labelType.id

    // Avery-sticker types — open the sheet position picker first. The
    // toploader pair claims 2 adjacent slots per card so it uses the
    // 'avery8167-pair' picker mode (40 card cells); foldover uses 1 slot
    // per card so it uses the raw 80-slot grid.
    // The Heritage ids carry the export route's `-heritage` suffix, so they
    // need the same sheet pickers as their Modern twins.
    if (labelType.holder === 'onetouch') {
      setGalleryPositionPicker({ exportType, title: labelType.name, sheet: 'avery6871' })
      return
    }
    if (labelType.holder === 'toploader') {
      setGalleryPositionPicker({
        exportType,
        title: labelType.name,
        sheet: labelType.format === 'foldover' ? 'avery8167-foldover' : 'avery8167-pair',
      })
      return
    }

    // Slab labels print in duplex (front+back separate pages) or fold-over
    // (one page that folds at the center). Prompt the user once per download.
    if (labelType.needsFormat) {
      Alert.alert(
        labelType.name,
        'Choose print format:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Duplex (front+back)', onPress: () => openWebDownload(exportType, { format: 'duplex' }) },
          { text: 'Fold-over', onPress: () => openWebDownload(exportType, { format: 'foldover' }) },
        ],
      )
      return
    }
    openWebDownload(exportType)
  }, [selectedCard, openWebDownload])

  const loadStyle = useCallback((styleConfig: any) => {
    // Replace the config WHOLESALE (saved config over defaults, not over the
    // previous state) — merging over `prev` let stale optional fields from
    // the last design (layoutStyle, geometricPattern, customColors, …) leak
    // into the applied style and corrupt it.
    setConfig({ ...DEFAULT_DESIGNER_CONFIG, ...styleConfig })
    setActiveCardColorStyle(null)
  }, [])

  // ---- Download/Share ----
  // Locally-rendered preview download. Write to cache first, then copy into
  // Documents (visible in Files app under "On My iPhone → DCM Grading" on
  // iOS) and show the standard saved-location alert. Android falls through
  // to the share sheet so users pick their own destination.
  const handleShare = useCallback(async () => {
    if (!labelPreviewUrl) return
    try {
      const base64 = labelPreviewUrl.split(',')[1]
      if (!base64) return
      const fileName = `dcm-label-${Date.now()}.png`
      const cacheUri = FileSystem.cacheDirectory + fileName
      await FileSystem.writeAsStringAsync(cacheUri, base64, { encoding: FileSystem.EncodingType.Base64 })
      const savedPath = await saveToDocuments(fileName, cacheUri)
      if (Platform.OS === 'ios') {
        presentSaveSuccess({
          fileName,
          filePath: savedPath,
          mime: 'image/png',
          onShareError: (err: any) => Alert.alert('Share failed', err?.message || 'Could not open share sheet'),
        })
        return
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(savedPath, { mimeType: 'image/png', dialogTitle: 'Download Label' })
      } else {
        Alert.alert('Saved', `File saved at ${savedPath}`)
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share label')
    }
  }, [labelPreviewUrl])

  // ---- Filter cards ----
  // Matches the collection tab's search behavior: searches across every
  // user-visible field (name, set, number, year, category, manufacturer,
  // serial, featured emblem, plus the AI-extracted card_name and player).
  // No result cap — FlatList virtualizes, so a 1000-row list is cheap.
  const filtered = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(c => {
      const ci = c.conversational_card_info
      return (c.card_name || '').toLowerCase().includes(q) ||
        (c.featured || '').toLowerCase().includes(q) ||
        (c.serial || '').toLowerCase().includes(q) ||
        (c.card_set || '').toLowerCase().includes(q) ||
        (c.card_number || '').toLowerCase().includes(q) ||
        (c.release_date || '').toLowerCase().includes(q) ||
        (c.manufacturer_name || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (ci?.card_name || '').toLowerCase().includes(q) ||
        (ci?.player_or_character || '').toLowerCase().includes(q)
    })
  }, [cards, search])

  // ---- Loading ----
  if (isLoading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.purple[600]} />
        <Text style={s.loadingText}>Loading Label Studio...</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {!isTabContext && <AppHeaderBar showBack title="Label Studio" />}
      {/* Hidden label renderer — loads /label-preview which uses the same
          renderFrontCanvas / renderBackCanvas as the download PDF, so the
          live preview matches the downloaded file exactly. */}
      <LabelWebRenderer
        config={labelConfig}
        cardData={labelCardData}
        cardId={selectedCard?.id}
        type={previewType}
        side={side}
        onRender={(url) => { setLabelPreviewUrl(url); setLabelPreviewType(previewType); setPreviewError(null) }}
        onError={(msg) => { console.warn('[label-studio] label preview error:', msg); setPreviewError(msg) }}
      />

      {/* Color picker modal */}
      <ColorPickerModal
        visible={pickerVisible}
        currentColor={pickerCurrentColor}
        onSelectColor={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
        cardImageUrl={frontUrl}
      />

      <LabelPositionPicker
        visible={!!galleryPositionPicker}
        title={galleryPositionPicker?.title || ''}
        sheet={galleryPositionPicker?.sheet || 'avery8167-pair'}
        onCancel={() => setGalleryPositionPicker(null)}
        onConfirm={(position, position2) => {
          const task = galleryPositionPicker
          setGalleryPositionPicker(null)
          if (!task) return
          // Picker has already mapped the user's "card" pick to the
          // correct front/back raw-slot indices for the toploader pair.
          // Single-slot sheets (foldover, one-touch) just pass `position`.
          openWebDownload(task.exportType, { position, position2 })
        }}
      />

      {/* iOS-only hidden-WebView export runner. The web export page detects
          ReactNativeWebView and posts files back as base64; we save to
          Documents (visible in Files app) and offer Share. */}
      <ExportRunner source={exportSource} onClose={() => setExportSource(null)} />

      {/* Wrap the main scroll in a KeyboardAvoidingView so the bottom
          form fields (Card Name, Set, Year, Card #, Features, the
          custom dimension inputs, the saved-style rename, etc.) lift
          above the soft keyboard. Android edge-to-edge layouts (the
          DCM app has edgeToEdgeEnabled: true) won't auto-shift the
          screen on focus, so without this the keyboard covers the
          focused input. automaticallyAdjustKeyboardInsets covers iOS
          via UIScrollView's native inset behavior. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* ============ Stepper ============
            Tappable, but only backwards and only as far as you have already
            reached — jumping ahead past a required choice just lands you on an
            empty screen. */}
        <View style={s.stepper}>
          {WIZARD_STEPS.map(w => {
            const done = w.n < step
            const current = w.n === step
            const reachable = w.n <= step || (w.n === 6 && step >= 5)
            return (
              <TouchableOpacity
                key={w.n}
                disabled={!reachable}
                onPress={() => goToStep(w.n)}
                style={s.stepperItem}
                accessibilityRole="button"
                accessibilityState={{ selected: current, disabled: !reachable }}
              >
                <View style={[s.stepperDot, current && s.stepperDotOn, done && s.stepperDotDone]}>
                  <Text style={[s.stepperDotText, (current || done) && { color: '#fff' }]}>{w.n}</Text>
                </View>
                <Text style={[s.stepperName, current && s.stepperNameOn, !reachable && { color: Colors.gray[300] }]} numberOfLines={1}>
                  {w.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ============ Step 1: Cards ============ */}
        {step === 1 && (<>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Select a Card</Text>
          <Text style={s.sectionHint}>
            Tap a card to design its label. Press and hold to add cards to a print run and do up to {MAX_PRINT_RUN} at once.
          </Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or serial..."
            placeholderTextColor={Colors.gray[400]}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            horizontal
            data={filtered}
            keyExtractor={c => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            renderItem={({ item }) => {
              const grade = item.conversational_whole_grade
              const isSelected = selectedCard?.id === item.id
              const inRun = printRunIds.includes(item.id)
              return (
                <TouchableOpacity
                  style={[s.cardTile, isSelected && s.cardTileSelected, inRun && s.cardTileInRun]}
                  onPress={() => setSelectedCard(item)}
                  onLongPress={() => toggleInRun(item.id)}
                  delayLongPress={250}
                  activeOpacity={0.7}
                >
                  {/* Tap shows a card; press and hold adds it to the print run. */}
                  {inRun && (
                    <View style={s.cardTileRunBadge}>
                      <Text style={s.cardTileRunBadgeText}>{printRunIds.indexOf(item.id) + 1}</Text>
                    </View>
                  )}
                  {item.front_path ? (
                    <CardThumbnail frontPath={item.front_path} />
                  ) : (
                    <View style={s.cardTilePlaceholder}>
                      <Text style={{ color: Colors.gray[400], fontSize: 10 }}>No image</Text>
                    </View>
                  )}
                  <Text style={s.cardTileName} numberOfLines={1}>
                    {item.featured || item.card_name || 'Card'}
                  </Text>
                  {grade != null && (
                    <View style={s.cardTileGrade}>
                      <Text style={s.cardTileGradeText}>{Math.round(grade)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={
              <Text style={{ color: Colors.gray[400], padding: 16, fontSize: 13 }}>
                {cards.length === 0 ? 'No graded cards yet.' : 'No cards match.'}
              </Text>
            }
          />
        </View>

        {!selectedCard && (
          <View style={s.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color={Colors.gray[300]} />
            <Text style={s.emptyText}>Select a card above to start designing labels</Text>
          </View>
        )}
        </>)}

        {selectedCard && (
          <>
            {/* ============ Label Badges ============ */}
            {/* Founder / VIP / Card Lover emblems only render on the slab
                label. The compact one-touch and toploader panels have no room
                for them, so offering the toggles there sets something the
                user will never see. */}
            {step === 4 && activeHolder === 'slab' && <LabelBadgesPicker />}

            {/* ============ Step 6: Supplies ============
                Keyed to the holder, so the label stock a sheet is actually
                laid out for leads. Affiliate links, same tag as the Shop tab. */}
            {step === 6 && (() => {
              const isZion = Math.abs((config.width ?? 2.8) - 2.51) < 0.01
              const products = productsForHolder(activeHolder, isZion)
              const cutter = products.find(pr => pr.id === 'paper-cutter')
              const cases = products.filter(pr => pr.id !== 'paper-cutter')
              const Row = ({ product, featured }: { product: any; featured?: boolean }) => (
                <TouchableOpacity
                  key={product.id}
                  style={[s.supplyRow, featured && s.supplyRowFeatured]}
                  activeOpacity={0.7}
                  onPress={() => WebBrowser.openBrowserAsync(productUrl(product))}
                  accessibilityRole="link"
                  accessibilityLabel={`${product.name} on Amazon`}
                >
                  <View style={s.supplyThumb}>
                    {product.image
                      ? <Image source={product.image} style={{ width: 44, height: 44 }} resizeMode="contain" />
                      : <Text style={{ fontSize: 20 }}>🏷️</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.supplyName} numberOfLines={1}>{product.name}</Text>
                      {!!product.badge && (
                        <View style={s.supplyBadge}><Text style={s.supplyBadgeText}>{product.badge}</Text></View>
                      )}
                    </View>
                    <Text style={s.supplyDesc} numberOfLines={2}>{product.shortDescription}</Text>
                  </View>
                  <Text style={s.supplyChevron}>›</Text>
                </TouchableOpacity>
              )
              return (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Everything else you&apos;ll need</Text>
                  <Text style={s.sectionHint}>
                    Optional — the cases and tools that pair with the labels you just designed.
                  </Text>

                  {isZion && activeHolder === 'slab' && (
                    <View style={s.zionNote}>
                      <Text style={s.zionNoteText}>
                        You designed at Zion Mag Pro size — the Zion MagPro case below is the holder those labels are cut for.
                      </Text>
                    </View>
                  )}

                  {cases.map((pr, i) => <Row key={pr.id} product={pr} featured={i === 0} />)}

                  {!!cutter && (
                    <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.gray[200] }}>
                      <Text style={s.pickerLabel}>Cut your labels cleanly</Text>
                      <Row product={cutter} />
                    </View>
                  )}

                  <Text style={s.supplyDisclosure}>
                    As an Amazon Associate, DCM Grading earns from qualifying purchases. These are affiliate
                    links — they cost you nothing extra and help support the platform.
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/shop')} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.purple[600] }}>See all recommended products →</Text>
                  </TouchableOpacity>
                </View>
              )
            })()}

            {/* ============ Print run ============
                One design, many cards. The preview and text editor stay on the
                card you tapped; everything in the run prints with the same
                design onto shared sheets. */}
            {step === 1 && (
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Print run</Text>
                <Text style={{ fontSize: 11, color: Colors.gray[400] }}>
                  {effectiveRunIds.length} of {MAX_PRINT_RUN}
                  {activeHolder !== 'digital' && ` · ${sheetsNeeded(effectiveRunIds.length, activeHolder, activeFormat === 'foldover')} sheet${sheetsNeeded(effectiveRunIds.length, activeHolder, activeFormat === 'foldover') === 1 ? '' : 's'}`}
                </Text>
              </View>
              {printRunIds.length === 0 ? (
                <Text style={{ fontSize: 12, color: Colors.gray[500] }}>
                  Printing just this card. Press and hold any card above to add it to a run and print several at once.
                </Text>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {printRunIds.map((id, i) => {
                      const c = runCardById(id)
                      return (
                        <TouchableOpacity
                          key={id}
                          onPress={() => toggleInRun(id)}
                          style={s.runChip}
                          accessibilityLabel={`Remove ${c?.card_name || 'card'} from the print run`}
                        >
                          <Text style={s.runChipText} numberOfLines={1}>
                            {i + 1}. {c?.featured || c?.card_name || 'Card'}
                          </Text>
                          <Text style={s.runChipX}>×</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <TouchableOpacity onPress={() => setPrintRunIds([])} style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.purple[600] }}>Clear run</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            )}

            {/* ============ Step 2: Holder ============
                Holder and style are separate decisions, as on web. These
                pickers resolve to a gallery tile; swiping the gallery drives
                them back, so both ways of choosing stay in sync. */}
            {step === 2 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>What are these cards going into?</Text>
              <Text style={s.sectionHint}>The holder decides the label size and the sheet it prints on.</Text>
              <View style={s.holderGrid}>
                {HOLDER_OPTIONS.map(h => {
                  const on = activeHolder === h.id
                  return (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => selectHolder(h.id)}
                      style={[s.holderCard, on && s.holderCardOn]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <View style={s.holderThumb}>
                        {h.image
                          ? <Image source={h.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          : <Ionicons name="image-outline" size={30} color={Colors.gray[300]} />}
                      </View>
                      <Text style={[s.holderName, on && { color: Colors.purple[700] }]}>{h.name}</Text>
                      <Text style={s.holderBlurb}>{h.blurb}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

            </View>
            )}

            {/* ============ Step 3: Style ============ */}
            {step === 3 && activeHolder === 'toploader' && (
            <View style={s.section}>
              <Text style={s.pickerLabel}>Label format</Text>
              <View style={s.pickerRow}>
                {([['front-back', 'Front + Back pair'], ['foldover', 'Fold-over']] as const).map(([f, name]) => {
                  const on = activeFormat === f
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => selectFormat(f)}
                      style={[s.pickerChip, on && s.pickerChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.pickerChipText, on && s.pickerChipTextOn]}>{name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
            )}

            {step === 3 && (
            <View style={s.section}>
              <Text style={s.pickerLabel}>Style</Text>
              <View style={s.pickerRow}>
                {stylesForHolder(activeHolder).map(st => {
                  const on = activeStyle === st
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => selectStyle(st)}
                      style={[s.pickerChip, on && s.pickerChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.pickerChipText, on && s.pickerChipTextOn]}>
                        {st === 'custom' ? 'Custom' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

            </View>
            )}

            {/* Slot size and label format belong with the holder. */}
            {step === 2 && (
            <View style={[s.section, { marginTop: -8 }]}>
              {activeHolder === 'slab' && (
                <>
                  <Text style={s.pickerLabel}>Slot size</Text>
                  <View style={s.pickerRow}>
                    {SLAB_SIZES.map(sz => {
                      const on = Math.abs((config.width ?? 2.8) - sz.width) < 0.01
                        && Math.abs((config.height ?? 0.8) - sz.height) < 0.01
                      return (
                        <TouchableOpacity
                          key={sz.id}
                          onPress={() => setConfig(prev => ({ ...prev, width: sz.width, height: sz.height }))}
                          style={[s.pickerChip, on && s.pickerChipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[s.pickerChipText, on && s.pickerChipTextOn]}>{sz.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.gray[400], marginTop: 6 }}>
                    {SLAB_SIZES.find(sz => Math.abs((config.width ?? 2.8) - sz.width) < 0.01)?.note || ''}
                  </Text>
                </>
              )}

              {activeHolder === 'toploader' && (
                <>
                  <Text style={s.pickerLabel}>Label format</Text>
                  <View style={s.pickerRow}>
                    {([['front-back', 'Front + Back pair'], ['foldover', 'Fold-over']] as const).map(([f, name]) => {
                      const on = activeFormat === f
                      return (
                        <TouchableOpacity
                          key={f}
                          onPress={() => selectFormat(f)}
                          style={[s.pickerChip, on && s.pickerChipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[s.pickerChipText, on && s.pickerChipTextOn]}>{name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}
            </View>
            )}

            {/* Card pager — check the style on every card in the run. */}
            {step === 3 && effectiveRunIds.length > 1 && (
              <View style={s.cardPager}>
                <TouchableOpacity
                  onPress={() => {
                    const i = effectiveRunIds.indexOf(selectedCard?.id)
                    const j = (i - 1 + effectiveRunIds.length) % effectiveRunIds.length
                    const c = runCardById(effectiveRunIds[j]); if (c) setSelectedCard(c)
                    try { galleryListRef.current?.scrollToIndex({ index: j, animated: true }) } catch { /* not mounted */ }
                  }}
                  style={s.cardPagerBtn}
                  accessibilityLabel="Previous card"
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.purple[700]} />
                </TouchableOpacity>
                <Text style={s.cardPagerText} numberOfLines={1}>
                  {Math.max(1, effectiveRunIds.indexOf(selectedCard?.id) + 1)} of {effectiveRunIds.length} · {selectedCard?.featured || selectedCard?.card_name || 'Card'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const i = effectiveRunIds.indexOf(selectedCard?.id)
                    const j = (i + 1) % effectiveRunIds.length
                    const c = runCardById(effectiveRunIds[j]); if (c) setSelectedCard(c)
                    try { galleryListRef.current?.scrollToIndex({ index: j, animated: true }) } catch { /* not mounted */ }
                  }}
                  style={s.cardPagerBtn}
                  accessibilityLabel="Next card"
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.purple[700]} />
                </TouchableOpacity>
              </View>
            )}

            {/* ============ Style preview ============
                Swipes through the CARDS in the run, not the styles — the style
                is chosen by the chips above, and paging styles here meant you
                could never compare one style across several cards. No download
                button: printing belongs on Finish, once the design is settled. */}
            {step === 3 && (
            <View style={s.section}>
              <FlatList
                ref={galleryListRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={effectiveRunIds}
                keyExtractor={id => id}
                // Every value the rows read must be in here. With a saved run
                // the data array keeps its identity, so FlatList skips
                // re-rendering rows — the Heritage panel and the card image
                // would arrive and never be drawn.
                extraData={`${activeGalleryIdx}|${selectedCard?.id}|${side}|${frontUrl}|${backUrl}|${labelPreviewUrl}|${labelPreviewType}`}
                snapToInterval={SCREEN_W - 24}
                onScrollToIndexFailed={() => { /* run shorter than the target index */ }}
                decelerationRate="fast"
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 24))
                  const c = runCardById(effectiveRunIds[idx])
                  if (c && c.id !== selectedCard?.id) setSelectedCard(c)
                }}
                renderItem={({ item: cardId }) => {
                  const card = runCardById(cardId)
                  const isShown = cardId === selectedCard?.id
                  return (
                    <View style={{ width: SCREEN_W - 24, paddingHorizontal: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.gray[900], textAlign: 'center' }} numberOfLines={1}>
                        {card?.featured || card?.card_name || 'Card'}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.purple[600], textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 8 }}>
                        {activeTile?.name}
                      </Text>

                      {/* Only the card on screen renders through the web
                          preview bridge; the others fall back to the native
                          mockup rather than racing for one renderer. */}
                      <LabelMockup
                        labelType={(activeTile?.id ?? 'slab-heritage') as any}
                        cardImageUrl={isShown ? frontUrl : null}
                        cardBackImageUrl={isShown ? backUrl : null}
                        width={260}
                        labelProps={inlineLabelProps}
                        side={side}
                        emblems={galleryEmblems}
                        customOverrides={customOverrides}
                        labelImageUrl={isShown && activeTile ? previewUrlForTile(activeTile) : null}
                      />

                      <View style={[s.sideToggle, { marginTop: 8, alignSelf: 'center' }]}>
                        <TouchableOpacity style={[s.sideBtn, side === 'front' && s.sideBtnActive]} onPress={() => setSide('front')}>
                          <Text style={[s.sideBtnText, side === 'front' && s.sideBtnTextActive]}>Front</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.sideBtn, side === 'back' && s.sideBtnActive]} onPress={() => setSide('back')}>
                          <Text style={[s.sideBtnText, side === 'back' && s.sideBtnTextActive]}>Back</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ fontSize: 11, color: Colors.gray[500], textAlign: 'center', marginTop: 8 }}>
                        {activeTile?.dimensions} — {activeTile?.useCase}
                      </Text>
                      {activeTile?.style === 'heritage' && !previewUrlForTile(activeTile) && (
                        <Text style={{ fontSize: 10, color: previewError ? '#b91c1c' : Colors.gray[400], textAlign: 'center', marginTop: 6 }}>
                          {previewError
                            ? `Heritage preview failed: ${previewError}`
                            : 'Rendering the Heritage label…'}
                        </Text>
                      )}
                    </View>
                  )
                }}
              />
              {effectiveRunIds.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 }}>
                  {effectiveRunIds.map((id, i) => (
                    <View key={id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: id === selectedCard?.id ? Colors.purple[600] : Colors.gray[300] }} />
                  ))}
                </View>
              )}
            </View>
            )}

            {/* ============ Step 4: Customize ============ */}
            {step === 4 && (<>
            {/* ============ Custom Slab Preview ============ */}
            {/* Uses LabelMockup (native inline) so the DCM logo, colors, and
                emblems exactly match what gets exported. The 'custom' labelType
                pipes customOverrides through so this updates live as the user
                edits gradient colors below. */}
            <View style={s.section}>
              {/* Follows the chosen holder. This was hardcoded to 'custom',
                  which maps to the slab holder — so customizing a one-touch or
                  toploader design showed you a graded slab. */}
              <LabelMockup
                labelType={(activeTile?.id ?? 'custom') as any}
                cardImageUrl={frontUrl}
                cardBackImageUrl={backUrl}
                width={260}
                labelProps={inlineLabelProps}
                side={side}
                emblems={galleryEmblems}
                customOverrides={customOverrides}
                labelImageUrl={activeTile ? previewUrlForTile(activeTile) : null}
              />
              <View style={s.sideToggle}>
                <TouchableOpacity
                  style={[s.sideBtn, side === 'front' && s.sideBtnActive]}
                  onPress={() => setSide('front')}
                >
                  <Text style={[s.sideBtnText, side === 'front' && s.sideBtnTextActive]}>Front</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sideBtn, side === 'back' && s.sideBtnActive]}
                  onPress={() => setSide('back')}
                >
                  <Text style={[s.sideBtnText, side === 'back' && s.sideBtnTextActive]}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ============ Heritage Options ============ */}
            {(isHeritageTile || config.style === 'heritage') && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Heritage Options</Text>

                <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginTop: 4, marginBottom: 6 }}>Band Pattern</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {HERITAGE_PATTERNS.map(pt => {
                    const active = (config.heritagePattern || 'diamond') === pt.id
                    return (
                      <TouchableOpacity
                        key={pt.id}
                        onPress={() => updateConfig({ heritagePattern: pt.id })}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? Colors.purple[500] : Colors.gray[200], backgroundColor: active ? Colors.purple[50] : '#fff' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: active ? Colors.purple[700] : Colors.gray[600] }}>{pt.name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginTop: 14, marginBottom: 6 }}>Band Colors</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['card', 'Card Colors'], ['brand', 'DCM Brand']] as const).map(([id, label]) => {
                    const active = (config.heritageColorSource || 'card') === id && !config.heritageBandColors
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => updateConfig({ heritageColorSource: id, heritageBandColors: undefined })}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', borderColor: active ? Colors.purple[500] : Colors.gray[200], backgroundColor: active ? Colors.purple[50] : '#fff' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: active ? Colors.purple[700] : Colors.gray[600] }}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {heritageResolvedBand.slice(0, 5).map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setPickerSlot(-10 - i); setPickerCurrentColor(c); setPickerVisible(true) }}
                      style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c, borderWidth: 1, borderColor: Colors.gray[200] }}
                    />
                  ))}
                  {config.heritageBandColors && (
                    <TouchableOpacity onPress={() => updateConfig({ heritageBandColors: undefined })}>
                      <Text style={{ fontSize: 11, color: Colors.purple[600], textDecorationLine: 'underline' }}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 4 }}>
                  {config.heritageBandColors ? 'Hand-edited — changing cards keeps these colors.' : 'Tap a swatch to fine-tune. Colors follow the selected source.'}
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.gray[500] }}>Grade Chip Colors</Text>
                  {config.heritageGradeColors && Object.keys(config.heritageGradeColors).length > 0 && (
                    <TouchableOpacity onPress={() => updateConfig({ heritageGradeColors: undefined })}>
                      <Text style={{ fontSize: 11, color: Colors.purple[600], textDecorationLine: 'underline' }}>Reset all</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(g => {
                    const override = config.heritageGradeColors?.[String(g)]
                    const ink = override || HERITAGE_GRADE_INKS[g]?.ink || '#E5E7EB'
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => { setPickerSlot(-100 - g); setPickerCurrentColor(ink); setPickerVisible(true) }}
                        style={{ width: 44, height: 34, borderRadius: 8, backgroundColor: HERITAGE_CHIP_BLACK, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: override ? Colors.purple[500] : 'transparent' }}
                      >
                        {g === 10 && !override ? (
                          <Text style={{ fontSize: 13, fontWeight: '800' }}>
                            <Text style={{ color: GRADE_10_FOIL_STOPS[1] }}>1</Text>
                            <Text style={{ color: GRADE_10_FOIL_STOPS[3] }}>0</Text>
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 13, fontWeight: '800', color: ink }}>{g}</Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 4 }}>
                  Tap a chip to set a custom color for that grade. 10 defaults to the rainbow foil.
                </Text>
              </View>
            )}

            {/* Heritage is a fixed ivory field with a coloured band — these
                theme, text, grade and size controls only apply to the Modern
                and Traditional layouts, exactly as on web. */}
            {!isHeritageTile && (<>
            {/* ============ Color Theme ============ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Color Theme</Text>
              <View style={s.themeGrid}>
                {COLOR_PRESETS.map(preset => {
                  if (preset.isCardColors && !cardColors) {
                    return (
                      <View key={preset.id} style={[s.themeTile, { opacity: 0.3 }]}>
                        <View style={[s.themeSwatch, { backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="color-palette-outline" size={16} color={Colors.gray[300]} />
                        </View>
                        <Text style={s.themeLabel}>{preset.name}</Text>
                      </View>
                    )
                  }

                  const isActive = preset.isCardColors
                    ? !!(activeCardColorStyle && !isCustomLayout)
                    : preset.id === 'custom'
                      ? isCustomLayout
                      : config.colorPreset === preset.id && !isCustomLayout && !activeCardColorStyle

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[s.themeTile, isActive && s.themeTileActive]}
                      onPress={() => handleColorPreset(preset)}
                      activeOpacity={0.7}
                    >
                      <ThemeSwatch preset={preset} cardColors={cardColors} />
                      <Text style={s.themeLabel}>{preset.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* ---- Card Colors layout styles ---- */}
              {selectedCard && !isCustomLayout && cardColors && activeCardColorStyle && (
                <View style={s.layoutSection}>
                  <Text style={s.subLabel}>Card Colors</Text>
                  <View style={s.paletteDots}>
                    {cardColors.palette.map((color, i) => (
                      <View key={i} style={[s.paletteDot, { backgroundColor: color }]} />
                    ))}
                    <Text style={s.paletteHint}>extracted from card</Text>
                  </View>
                  <View style={s.layoutGrid}>
                    {CARD_COLOR_STYLES.map(style => {
                      const isActive = activeCardColorStyle === style.id
                      return (
                        <TouchableOpacity
                          key={style.id}
                          style={[s.layoutTile, isActive && s.layoutTileActive]}
                          onPress={() => handleCardColorStyle(style.id)}
                          activeOpacity={0.7}
                        >
                          <LayoutSwatch styleId={style.id} cardColors={cardColors} />
                          <Text style={s.layoutLabel}>{style.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {/* Gradient direction — when Gradient is active */}
                  {activeCardColorStyle === 'color-gradient' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.subLabel}>Gradient Direction</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[
                          { label: '→', value: 0 }, { label: '↘', value: 135 },
                          { label: '↓', value: 90 }, { label: '←', value: 180 }, { label: '↑', value: 270 },
                        ].map(d => (
                          <TouchableOpacity
                            key={d.value}
                            style={[s.dirBtn, Math.abs((config.gradientAngle ?? 135) - d.value) < 10 && s.dirBtnActive]}
                            onPress={() => updateConfig({ gradientAngle: d.value })}
                          >
                            <Text style={[s.dirBtnText, Math.abs((config.gradientAngle ?? 135) - d.value) < 10 && s.dirBtnTextActive]}>{d.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Geometric pattern — when Geometric is active */}
                  {activeCardColorStyle === 'geometric' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.subLabel}>Pattern Style</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {GEOMETRIC_PATTERNS.map(p => (
                          <TouchableOpacity
                            key={p.id}
                            style={[s.dirBtn, { flex: 1 }, (config.geometricPattern ?? 0) === p.id && s.dirBtnActive]}
                            onPress={() => updateConfig({ geometricPattern: p.id })}
                          >
                            <Text style={[s.dirBtnText, { fontSize: 8 }, (config.geometricPattern ?? 0) === p.id && s.dirBtnTextActive]}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ---- Custom Colors ---- */}
              {isCustomLayout && (
                <View style={s.customSection}>
                  <View style={s.customHeader}>
                    <Text style={s.subLabel}>Your Colors</Text>
                  </View>
                  {(() => {
                    const showAllSlots = config.layoutStyle === 'card-extension' || config.layoutStyle === 'geometric'
                    const colors = config.customColors || [config.gradientStart, config.gradientEnd]
                    const visibleCount = showAllSlots ? 5 : 2
                    return (
                      <View style={s.customSwatches}>
                        {Array.from({ length: visibleCount }).map((_, i) => {
                          const color = colors[i] || null
                          const hasColor = !!color
                          return (
                            <View key={i} style={{ flex: 1, position: 'relative' }}>
                              <TouchableOpacity
                                style={[
                                  s.customSwatch,
                                  hasColor
                                    ? { backgroundColor: color, borderStyle: 'solid' as const }
                                    : { backgroundColor: Colors.gray[100], borderStyle: 'dashed' as const }
                                ]}
                                onPress={() => openColorPicker(i)}
                                activeOpacity={0.7}
                              >
                                {hasColor ? (
                                  <Text style={s.customSwatchNum}>{i + 1}</Text>
                                ) : (
                                  <Ionicons name="add" size={18} color={Colors.gray[400]} />
                                )}
                              </TouchableOpacity>
                              {i >= 2 && hasColor && (
                                <TouchableOpacity
                                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.red[500], justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
                                  onPress={() => {
                                    const cols = [...(config.customColors || [config.gradientStart, config.gradientEnd])]
                                    cols.splice(i, 1)
                                    setCustomColorCount(Math.max(2, cols.length))
                                    const layout = config.layoutStyle || 'color-gradient'
                                    updateConfig({ customColors: cols, ...applyLayoutToColors(layout, cols), layoutStyle: layout })
                                  }}
                                >
                                  <Ionicons name="close" size={12} color="#fff" />
                                </TouchableOpacity>
                              )}
                              {i < visibleCount - 1 && hasColor && colors[i + 1] && (
                                <TouchableOpacity
                                  style={{ position: 'absolute', right: -9, top: '50%' as any, marginTop: -8, zIndex: 10 }}
                                  onPress={() => {
                                    const cols = [...(config.customColors || [config.gradientStart, config.gradientEnd])]
                                    const tmp = cols[i]; cols[i] = cols[i + 1]; cols[i + 1] = tmp
                                    const layout = config.layoutStyle || 'color-gradient'
                                    updateConfig({ customColors: cols, ...applyLayoutToColors(layout, cols), layoutStyle: layout })
                                  }}
                                >
                                  <Ionicons name="swap-horizontal" size={12} color={Colors.gray[400]} />
                                </TouchableOpacity>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    )
                  })()}
                  {config.layoutStyle === 'card-extension' && (
                    <Text style={s.customHint}>Select up to 5 colors for the extension gradient</Text>
                  )}
                  <Text style={s.customHint}>Tap a color to open the picker</Text>

                  {/* Layout styles for custom */}
                  <Text style={[s.subLabel, { marginTop: 12 }]}>Layout Style</Text>
                  <View style={s.layoutGrid}>
                    {LAYOUT_STYLES.map(ls => {
                      const isActive = config.layoutStyle === ls.id
                      const previewColors = config.customColors || [config.gradientStart, config.gradientEnd]
                      return (
                        <TouchableOpacity
                          key={ls.id}
                          style={[s.layoutTile, isActive && s.layoutTileActive]}
                          onPress={() => handleCustomLayoutStyle(ls.id)}
                          activeOpacity={0.7}
                        >
                          <CustomLayoutSwatch layoutId={ls.id} colors={previewColors} />
                          <Text style={s.layoutLabel}>{ls.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {/* Gradient direction for custom */}
                  {config.layoutStyle === 'color-gradient' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.subLabel}>Gradient Direction</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[
                          { label: '→', value: 0 }, { label: '↘', value: 135 },
                          { label: '↓', value: 90 }, { label: '←', value: 180 }, { label: '↑', value: 270 },
                        ].map(d => (
                          <TouchableOpacity
                            key={d.value}
                            style={[s.dirBtn, Math.abs((config.gradientAngle ?? 135) - d.value) < 10 && s.dirBtnActive]}
                            onPress={() => updateConfig({ gradientAngle: d.value })}
                          >
                            <Text style={[s.dirBtnText, Math.abs((config.gradientAngle ?? 135) - d.value) < 10 && s.dirBtnTextActive]}>{d.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Geometric pattern for custom */}
                  {config.layoutStyle === 'geometric' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={s.subLabel}>Pattern Style</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {GEOMETRIC_PATTERNS.map(p => (
                          <TouchableOpacity
                            key={p.id}
                            style={[s.dirBtn, { flex: 1 }, (config.geometricPattern ?? 0) === p.id && s.dirBtnActive]}
                            onPress={() => updateConfig({ geometricPattern: p.id })}
                          >
                            <Text style={[s.dirBtnText, { fontSize: 8 }, (config.geometricPattern ?? 0) === p.id && s.dirBtnTextActive]}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ============ Border Controls ============ */}
            {/* Border is enabled when the user picks "DCM Bordered" in the
                Dimensions section above (handleDimensionPreset sets
                borderEnabled: true). Color/width controls below tune the
                border whenever it's active. */}
            {config.borderEnabled && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Border</Text>
                <View style={{ gap: 10 }}>
                  <View style={s.borderControls}>
                    <TouchableOpacity
                      style={[s.borderColorSwatch, { backgroundColor: config.borderColor }]}
                      onPress={() => {
                        setPickerSlot(-1)
                        setPickerCurrentColor(config.borderColor)
                        setPickerVisible(true)
                      }}
                    />
                    <Text style={s.borderLabel}>Color</Text>
                  </View>
                  <View style={s.borderControls}>
                    <Text style={[s.borderLabel, { width: 50 }]}>Width</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {[0.02, 0.03, 0.04, 0.06, 0.08].map(w => (
                        <TouchableOpacity
                          key={w}
                          style={[s.dirBtn, config.borderWidth === w && s.dirBtnActive]}
                          onPress={() => updateConfig({ borderWidth: w })}
                        >
                          <Text style={[s.dirBtnText, config.borderWidth === w && s.dirBtnTextActive]}>
                            {w}"
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ============ Text Color ============ */}
            {/* Auto picks white vs dark text by WCAG contrast against the
                background (matches web CustomLabelConfig.textColorMode);
                Light/Dark are explicit overrides. */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Text Color</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {([
                  { id: 'auto', label: 'Auto' },
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                ] as const).map(opt => {
                  const active = (config.textColorMode || 'auto') === opt.id
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.dirBtn, { flex: 1 }, active && s.dirBtnActive]}
                      onPress={() => { switchToCustomTileIfForced(); updateConfig({ textColorMode: opt.id }) }}
                    >
                      <Text style={[s.dirBtnText, active && s.dirBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <Text style={[s.subLabel, { marginTop: 6 }]}>
                Auto (recommended) keeps text readable on any background, including in print.
              </Text>
            </View>

            {/* ============ Grade Color (July 2026, client-requested) ============ */}
            {/* Auto = historical purple-on-light / white-on-dark; a swatch or
                custom hex overrides the grade digit everywhere it renders.
                Matches the web Studio control (LabelStudioClient). */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Grade Color</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[s.dirBtn, (!config.gradeColor || config.gradeColor === 'auto') && s.dirBtnActive]}
                  onPress={() => { switchToCustomTileIfForced(); updateConfig({ gradeColor: 'auto' }) }}
                >
                  <Text style={[s.dirBtnText, (!config.gradeColor || config.gradeColor === 'auto') && s.dirBtnTextActive]}>Auto</Text>
                </TouchableOpacity>
                {['#d4af37', '#dc2626', '#2563eb', '#16a34a', '#111111', '#ffffff'].map(hex => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() => { switchToCustomTileIfForced(); updateConfig({ gradeColor: hex }) }}
                    style={{
                      width: 32, height: 32, borderRadius: 16, backgroundColor: hex,
                      borderWidth: 2,
                      borderColor: config.gradeColor === hex ? Colors.purple[600] : Colors.gray[300],
                    }}
                  />
                ))}
                <TouchableOpacity
                  style={s.dirBtn}
                  onPress={() => {
                    switchToCustomTileIfForced()
                    setPickerSlot(-2)
                    setPickerCurrentColor(config.gradeColor && config.gradeColor !== 'auto' ? config.gradeColor : '#7c3aed')
                    setPickerVisible(true)
                  }}
                >
                  <Text style={s.dirBtnText}>Custom…</Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.subLabel, { marginTop: 6 }]}>
                Auto keeps the classic look — white on dark labels, purple on light.
              </Text>
            </View>

            {/* ============ Grade & Text Size (July 2026, client-requested) ============ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Grade &amp; Text Size</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {([
                  { id: 'standard', label: 'Standard', scale: 1 },
                  { id: 'large', label: 'Large', scale: 1.15 },
                  { id: 'xl', label: 'Extra Large', scale: 1.3 },
                ] as const).map(opt => {
                  const active = (config.fontScale ?? 1) === opt.scale
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.dirBtn, { flex: 1 }, active && s.dirBtnActive]}
                      onPress={() => { switchToCustomTileIfForced(); updateConfig({ fontScale: opt.scale }) }}
                    >
                      <Text style={[s.dirBtnText, active && s.dirBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <Text style={[s.subLabel, { marginTop: 6 }]}>
                Larger sizes are best-effort — long card names still shrink to fit the label.
              </Text>
            </View>

            </>)}
            </>)}

            {/* ============ Step 5: Finish ============ */}
            {step === 5 && (<>
            {/* Card pager — the text fields belong to ONE card, so a run needs
                a way to reach the others. Switching re-seeds the fields from
                the card you land on. */}
            {effectiveRunIds.length > 1 && (
              <View style={[s.cardPager, { marginBottom: 0, marginTop: 4 }]}>
                <TouchableOpacity
                  onPress={() => {
                    const i = effectiveRunIds.indexOf(selectedCard?.id)
                    const j = (i - 1 + effectiveRunIds.length) % effectiveRunIds.length
                    const c = runCardById(effectiveRunIds[j]); if (c) setSelectedCard(c)
                  }}
                  style={s.cardPagerBtn}
                  accessibilityLabel="Edit previous card"
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.purple[700]} />
                </TouchableOpacity>
                <Text style={s.cardPagerText} numberOfLines={1}>
                  Editing {Math.max(1, effectiveRunIds.indexOf(selectedCard?.id) + 1)} of {effectiveRunIds.length} · {selectedCard?.featured || selectedCard?.card_name || 'Card'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const i = effectiveRunIds.indexOf(selectedCard?.id)
                    const j = (i + 1) % effectiveRunIds.length
                    const c = runCardById(effectiveRunIds[j]); if (c) setSelectedCard(c)
                  }}
                  style={s.cardPagerBtn}
                  accessibilityLabel="Edit next card"
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.purple[700]} />
                </TouchableOpacity>
              </View>
            )}

            {/* ============ Label Text ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Label Text</Text>
                {(() => {
                  const b = labelBaselineRef.current
                  const anyOverride = !!b && (
                    labelName.trim() !== b.name.trim() || labelSet.trim() !== b.set.trim() ||
                    labelSubset.trim() !== b.subset.trim() || labelNumber.trim() !== b.number.trim() ||
                    labelYear.trim() !== b.year.trim() || labelFeatures.trim() !== b.features.trim()
                  )
                  return anyOverride ? (
                    <TouchableOpacity onPress={() => {
                      const base = labelBaselineRef.current
                      if (!base) return
                      setLabelName(base.name); setLabelSet(base.set); setLabelSubset(base.subset)
                      setLabelNumber(base.number); setLabelYear(base.year); setLabelFeatures(base.features)
                    }}>
                      <Text style={{ fontSize: 10, color: Colors.gray[500], borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.gray[300], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>Reset all ⟲</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 10, color: Colors.gray[400] }}>Edits override DCM Optic™ values</Text>
                  )
                })()}
              </View>

              {/* Saved custom text that no longer matches the card's data */}
              {staleOverrideKeys.length > 0 && !staleDismissed && (
                <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600', marginBottom: 6 }}>
                    This card&apos;s saved label text ({staleOverrideKeys.join(', ')}) no longer matches the card&apos;s current data.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={adoptCardData} style={{ backgroundColor: '#d97706', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Use card data</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={dismissStaleBanner} style={{ borderWidth: 1, borderColor: '#fcd34d', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600' }}>Keep my custom text</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={{ gap: 8 }}>
                <View>
                  <FieldHeader label="Card Name" value={labelName} baseline={labelBaselineRef.current?.name ?? null} onReset={(v) => setLabelName(v)} />
                  <TextInput style={s.fieldInput} value={labelName} onChangeText={setLabelName} placeholder="Card name" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <FieldHeader label="Set" value={labelSet} baseline={labelBaselineRef.current?.set ?? null} onReset={(v) => setLabelSet(v)} />
                    <TextInput style={s.fieldInput} value={labelSet} onChangeText={setLabelSet} placeholder="Set name" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                  </View>
                  <View style={{ flex: 0.5 }}>
                    <FieldHeader label="Year" value={labelYear} baseline={labelBaselineRef.current?.year ?? null} onReset={(v) => setLabelYear(v)} />
                    <TextInput style={s.fieldInput} value={labelYear} onChangeText={setLabelYear} placeholder="Year" placeholderTextColor={Colors.gray[400]} maxLength={20} />
                  </View>
                </View>
                <View>
                  <FieldHeader label="Subset" value={labelSubset} baseline={labelBaselineRef.current?.subset ?? null} onReset={(v) => setLabelSubset(v)} />
                  <TextInput style={s.fieldInput} value={labelSubset} onChangeText={setLabelSubset} placeholder="Insert / parallel name (e.g. Power Players)" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 0.5 }}>
                    <FieldHeader label="Card #" value={labelNumber} baseline={labelBaselineRef.current?.number ?? null} onReset={(v) => setLabelNumber(v)} />
                    <TextInput style={s.fieldInput} value={labelNumber} onChangeText={setLabelNumber} placeholder="#" placeholderTextColor={Colors.gray[400]} maxLength={50} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldHeader label="Features (comma-separated, max 10)" value={labelFeatures} baseline={labelBaselineRef.current?.features ?? null} onReset={(v) => setLabelFeatures(v)} />
                    <TextInput style={s.fieldInput} value={labelFeatures} onChangeText={setLabelFeatures} placeholder="RC, Auto, /99" placeholderTextColor={Colors.gray[400]} />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[s.downloadBtn, { marginTop: 12, backgroundColor: savingLabelFields ? Colors.gray[400] : Colors.purple[600] }]}
                onPress={saveLabelFieldsToCard}
                disabled={savingLabelFields || !selectedCard}
                activeOpacity={0.7}
              >
                {savingLabelFields
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={s.downloadBtnText}>{savingLabelFields ? 'Saving…' : 'Save to Card'}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 6, textAlign: 'center' }}>
                Saves to this card so the same text shows on slabs, collection thumbnails, and labels everywhere.
              </Text>
            </View>

            {/* ============ Download Custom Label ============ */}
            <View style={s.section}>
              <TouchableOpacity
                style={s.downloadBtn}
                onPress={() => {
                  if (!selectedCard?.id) {
                    Alert.alert('Select a card', 'Pick a card above to download its label.')
                    return
                  }
                  // Route through the same handler the gallery uses so the
                  // chosen HOLDER and STYLE both apply. This used to hardcode
                  // 'slab-custom', which ignored the holder entirely and only
                  // became Heritage if config.style happened to be 'heritage' —
                  // picking the Heritage tile does not set that, so a Heritage
                  // design printed as Modern.
                  if (activeTile) handleGalleryDownload(activeTile)
                }}
                disabled={!selectedCard?.id || !activeTile}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={s.downloadBtnText}>
                  {activeHolder === 'digital' ? 'Download Card Images' : `Download ${activeTile?.shortName ?? 'Label'} PDF`}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 6, textAlign: 'center' }}>
                {effectiveRunIds.length > 1
                  ? `${effectiveRunIds.length} cards · ${sheetsNeeded(effectiveRunIds.length, activeHolder, activeFormat === 'foldover')} sheet(s). Print at 100% scale.`
                  : 'Print at 100% scale / Actual Size.'}
              </Text>
              <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 6, textAlign: 'center' }}>
                Opens the DCM download page in your browser. PDF saves to your Downloads folder.
              </Text>
            </View>

            {/* ============ Saved Styles (server-synced custom-1..4) ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.sectionTitle}>Saved Styles {customStyles.length > 0 && <Text style={{ fontSize: 11, color: Colors.gray[400], fontWeight: '500' }}>({customStyles.length}/{MAX_SAVED_LABEL_STYLES})</Text>}</Text>
                <TouchableOpacity
                  onPress={saveStyle}
                  disabled={savingStyle || customStyles.length >= MAX_SAVED_LABEL_STYLES}
                  style={{ backgroundColor: customStyles.length >= MAX_SAVED_LABEL_STYLES ? Colors.gray[300] : Colors.purple[600], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{savingStyle ? 'Saving…' : 'Save Current'}</Text>
                </TouchableOpacity>
              </View>
              {customStyles.length === 0 && (
                <Text style={{ color: Colors.gray[400], fontSize: 12 }}>
                  No saved styles yet. Save your current design to reuse later — synced with your web account.
                </Text>
              )}
              {customStyles.map((style) => {
                const isRenaming = renamingStyleId === style.id
                const isRainbow = style.config.colorPreset === 'rainbow'
                const swatchColors = isRainbow
                  ? ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff'] as const
                  : [style.config.gradientStart, style.config.gradientEnd] as const
                return (
                  <View key={style.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.gray[100] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <LinearGradient
                        colors={swatchColors as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 32, height: 32, borderRadius: 6, borderWidth: style.config.borderEnabled ? 2 : 1, borderColor: style.config.borderEnabled ? (style.config.borderColor || '#000') : Colors.gray[200] }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {isRenaming ? (
                          <TextInput
                            value={renamingValue}
                            onChangeText={setRenamingValue}
                            onBlur={submitRename}
                            onSubmitEditing={submitRename}
                            autoFocus
                            style={{ fontSize: 13, color: Colors.gray[800], borderBottomWidth: 1, borderBottomColor: Colors.purple[400], paddingVertical: 2 }}
                          />
                        ) : (
                          <TouchableOpacity onPress={() => { setRenamingStyleId(style.id); setRenamingValue(style.name) }}>
                            <Text style={{ fontSize: 13, color: Colors.gray[800], fontWeight: '600' }} numberOfLines={1}>{style.name}</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={{ fontSize: 10, color: Colors.gray[400] }}>{style.id}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => loadStyle(style.config)}>
                        <Text style={{ fontSize: 12, color: Colors.purple[600], fontWeight: '700' }}>Apply</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateExistingStyle(style.id, style.name)}>
                        <Text style={{ fontSize: 12, color: Colors.blue[600], fontWeight: '700' }}>Update</Text>
                      </TouchableOpacity>
                      {/* The account default drives SLAB labels everywhere —
                          card details, collection, web. Nothing outside this
                          print flow renders a one-touch or toploader label, so
                          offering it there would promise a change you would
                          never see. Same rule as web. */}
                      {activeHolder === 'slab' && (
                        <TouchableOpacity onPress={() => {
                          switchStyle(style.id as any)
                          Alert.alert('Default updated', `"${style.name}" is now your default label style everywhere your slabs appear.`)
                        }}>
                          <Text style={{ fontSize: 12, color: Colors.gray[600], fontWeight: '700' }}>Default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => deleteStyle(style.id)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.red[500]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>
            </>)}
          </>
        )}

        {/* ============ Step navigation ============
            In the page flow, below the step content and above the tab bar —
            a floating bar gets covered by the chat widget on small screens. */}
        <View style={s.stepNav}>
          <TouchableOpacity
            onPress={() => goToStep(Math.max(1, step - 1) as WizardStep)}
            disabled={step === 1}
            style={[s.stepNavBack, step === 1 && { opacity: 0.4 }]}
          >
            <Text style={s.stepNavBackText}>Back</Text>
          </TouchableOpacity>
          {stepBlocker ? (
            <Text style={s.stepNavBlocker}>{stepBlocker}</Text>
          ) : null}
          {step < 5 ? (
            <TouchableOpacity
              onPress={() => goToStep((step + 1) as WizardStep)}
              disabled={!!stepBlocker}
              style={[s.stepNavNext, !!stepBlocker && { opacity: 0.4 }]}
            >
              <Text style={s.stepNavNextText}>Continue</Text>
            </TouchableOpacity>
          ) : step === 5 ? (
            <TouchableOpacity onPress={() => goToStep(6)} style={s.stepNavGhost}>
              <Text style={s.stepNavGhostText}>Supplies</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => goToStep(5)} style={s.stepNavGhost}>
              <Text style={s.stepNavGhostText}>Back to Finish</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      {!isTabContext && <MobileTabBar />}
    </View>
  )
}

// ============================================================================
// Small Components
// ============================================================================

function CardThumbnail({ frontPath }: { frontPath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    supabase.storage.from('cards').createSignedUrl(frontPath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [frontPath])

  if (!url) return <View style={s.cardTilePlaceholder}><ActivityIndicator size="small" color={Colors.purple[400]} /></View>
  return <Image source={{ uri: url }} style={s.cardTileImage} resizeMode="cover" />
}

function ThemeSwatch({ preset, cardColors }: { preset: ColorPreset; cardColors: CardColors | null }) {
  if (preset.isRainbow) {
    return (
      <LinearGradient
        colors={['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.themeSwatch}
      />
    )
  }
  if (preset.isCardColors && cardColors) {
    return (
      <LinearGradient
        colors={cardColors.palette.slice(0, 3) as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.themeSwatch}
      />
    )
  }
  return (
    <LinearGradient
      colors={[preset.gradientStart, preset.gradientEnd]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.themeSwatch}
    />
  )
}

function LayoutSwatch({ styleId, cardColors }: { styleId: string; cardColors: CardColors }) {
  const input: CardColorInput = {
    primary: cardColors.primary,
    secondary: cardColors.secondary,
    isDark: cardColors.isDark,
    topEdgeColors: cardColors.topEdgeColors,
  }
  const style = CARD_COLOR_STYLES.find(s => s.id === styleId)
  if (!style) return <View style={s.themeSwatch} />
  const colors = style.getColors(input)

  if (styleId === 'neon-outline') {
    return <View style={[s.themeSwatch, { backgroundColor: '#0a0a0a', borderWidth: 2, borderColor: cardColors.primary + '88' }]} />
  }
  if (styleId === 'team-colors') {
    return (
      <View style={[s.themeSwatch, { flexDirection: 'row', overflow: 'hidden' }]}>
        <View style={{ flex: 1, backgroundColor: colors.gradientStart }} />
        <View style={{ flex: 1, backgroundColor: colors.gradientEnd }} />
      </View>
    )
  }
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.themeSwatch}
    />
  )
}

function CustomLayoutSwatch({ layoutId, colors }: { layoutId: string; colors: string[] }) {
  const c1 = colors[0] || '#7c3aed'
  const c2 = colors[1] || c1

  if (layoutId === 'neon-outline') {
    return <View style={[s.themeSwatch, { backgroundColor: '#0a0a0a', borderWidth: 2, borderColor: c1 + '88' }]} />
  }
  if (layoutId === 'team-colors') {
    return (
      <View style={[s.themeSwatch, { flexDirection: 'row', overflow: 'hidden' }]}>
        <View style={{ flex: 1, backgroundColor: c1 }} />
        <View style={{ flex: 1, backgroundColor: c2 }} />
      </View>
    )
  }
  if (layoutId === 'card-extension' && colors.length >= 3) {
    return (
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={s.themeSwatch}
      />
    )
  }
  if (layoutId === 'geometric') {
    return (
      <View style={[s.themeSwatch, { flexDirection: 'row', overflow: 'hidden' }]}>
        <View style={{ flex: 1, backgroundColor: c1 }} />
        <View style={{ width: 2, backgroundColor: '#000' }} />
        <View style={{ flex: 1, backgroundColor: c2 }} />
      </View>
    )
  }
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.themeSwatch}
    />
  )
}

// ============================================================================
// Styles
// ============================================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.gray[500], fontSize: 14 },

  // Sections
  section: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.gray[200] },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray[800], marginBottom: 10 },
  pickerLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[300], backgroundColor: '#fff' },
  pickerChipOn: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[600] },
  pickerChipText: { fontSize: 13, fontWeight: '600', color: Colors.gray[700] },
  pickerChipTextOn: { color: '#fff' },
  cardTileInRun: { borderColor: Colors.purple[400] },
  cardTileRunBadge: { position: 'absolute', top: 4, left: 4, zIndex: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Colors.purple[600], alignItems: 'center', justifyContent: 'center' },
  cardTileRunBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  runChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 190, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50] },
  runChipText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: Colors.purple[800] },
  runChipX: { fontSize: 15, lineHeight: 15, fontWeight: '700', color: Colors.purple[500] },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.gray[200] },
  supplyThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.gray[50], alignItems: 'center', justifyContent: 'center' },
  supplyName: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  supplyDesc: { fontSize: 11, color: Colors.gray[500], marginTop: 2, lineHeight: 15 },
  supplyChevron: { fontSize: 22, color: Colors.gray[300], fontWeight: '300' },
  supplyRowFeatured: { borderRadius: 10, borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50], paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.purple[200] },
  supplyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Colors.purple[600] },
  supplyBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  zionNote: { padding: 10, borderRadius: 10, backgroundColor: Colors.purple[50], borderWidth: 1, borderColor: Colors.purple[100], marginBottom: 12 },
  zionNoteText: { fontSize: 11, color: Colors.purple[800], lineHeight: 16 },
  supplyDisclosure: { fontSize: 10, color: Colors.gray[400], marginTop: 10, lineHeight: 14 },
  cardPager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 4 },
  cardPagerBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.purple[200], backgroundColor: Colors.purple[50], alignItems: 'center', justifyContent: 'center' },
  cardPagerText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.gray[700] },
  sectionHint: { fontSize: 12, color: Colors.gray[500], marginTop: -4, marginBottom: 10, lineHeight: 17 },
  holderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  holderCard: { width: '47.5%', borderRadius: 12, borderWidth: 2, borderColor: Colors.gray[200], backgroundColor: '#fff', padding: 10 },
  holderCardOn: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  holderThumb: { height: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  holderName: { fontSize: 13, fontWeight: '700', color: Colors.gray[900] },
  holderBlurb: { fontSize: 10, color: Colors.gray[500], marginTop: 2, lineHeight: 14 },
  stepper: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 14 },
  stepperItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepperDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.gray[200], alignItems: 'center', justifyContent: 'center' },
  stepperDotOn: { backgroundColor: Colors.purple[600] },
  stepperDotDone: { backgroundColor: Colors.purple[300] },
  stepperDotText: { fontSize: 11, fontWeight: '700', color: Colors.gray[500] },
  stepperName: { fontSize: 10, fontWeight: '600', color: Colors.gray[500] },
  stepperNameOn: { color: Colors.purple[700] },
  stepNav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.gray[200] },
  stepNavBack: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[300] },
  stepNavBackText: { fontSize: 14, fontWeight: '600', color: Colors.gray[700] },
  stepNavBlocker: { flex: 1, fontSize: 11, color: Colors.gray[400], textAlign: 'right' },
  stepNavNext: { marginLeft: 'auto', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.purple[600] },
  stepNavNextText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  stepNavGhost: { marginLeft: 'auto', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, borderWidth: 2, borderColor: Colors.purple[600] },
  stepNavGhostText: { fontSize: 14, fontWeight: '700', color: Colors.purple[700] },
  subLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[500], marginBottom: 6 },

  // Card selector
  searchInput: { backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.gray[900], marginBottom: 10 },
  cardTile: { width: 80, marginRight: 10, borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[200], padding: 4, backgroundColor: '#fff' },
  cardTileSelected: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  cardTileImage: { width: '100%', aspectRatio: 2.5 / 3.5, borderRadius: 4 },
  cardTilePlaceholder: { width: '100%', aspectRatio: 2.5 / 3.5, borderRadius: 4, backgroundColor: Colors.gray[100], justifyContent: 'center', alignItems: 'center' },
  cardTileName: { fontSize: 9, fontWeight: '600', color: Colors.gray[700], marginTop: 4, textAlign: 'center' },
  cardTileGrade: { alignSelf: 'center', marginTop: 2, backgroundColor: Colors.purple[600], borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  cardTileGradeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: Colors.gray[400], fontSize: 14 },

  // Slab preview
  slabContainer: { alignSelf: 'center', width: 200, aspectRatio: 280 / 460 },
  slabImage: { position: 'absolute', width: '100%', height: '100%' },
  slabLabelSlot: { position: 'absolute', top: '4.5%', left: '13.5%', width: '73%', overflow: 'hidden' },
  slabLabel: { width: '100%', aspectRatio: 3.5 },
  slabCardSlot: { position: 'absolute', top: '20%', left: '10.7%', width: '78.6%', height: '73.9%', overflow: 'hidden' },
  slabCardImage: { width: '100%', height: '100%' },
  sideToggle: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  sideBtn: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.gray[100] },
  sideBtnActive: { backgroundColor: Colors.purple[600] },
  sideBtnText: { fontSize: 11, fontWeight: '600', color: Colors.gray[500] },
  sideBtnTextActive: { color: '#fff' },

  // Dimension presets — 2 columns × 2 rows. Each tile takes ~48% of section
  // content width (50% minus half the 6px gap). With 4 presets they wrap to
  // exactly 2 rows of 2.
  dimGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  dimTile: { width: '48.5%', borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200], paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', minHeight: 56 },
  dimTileActive: { borderColor: Colors.purple[600], backgroundColor: '#faf5ff' },
  dimTileName: { fontSize: 13, fontWeight: '600', color: Colors.gray[700] },
  dimTileNameActive: { color: Colors.purple[700] },
  dimTileSize: { fontSize: 10, color: Colors.gray[400], marginTop: 3 },

  // Theme grid — 4 columns × 2 rows (with the 7 remaining presets after
  // crimson removal: row 1 has 4, row 2 has 3).
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeTile: { width: '23.5%', borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[200], overflow: 'hidden' },
  themeTileActive: { borderColor: Colors.purple[600], borderWidth: 2 },
  themeSwatch: { width: '100%', aspectRatio: 1, borderRadius: 0 },
  themeLabel: { fontSize: 9, color: Colors.gray[600], textAlign: 'center', paddingVertical: 3, backgroundColor: '#fff' },

  // Layout styles (card colors + custom)
  layoutSection: { marginTop: 14 },
  layoutGrid: { flexDirection: 'row', gap: 6 },
  layoutTile: { flex: 1, borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[200], overflow: 'hidden' },
  layoutTileActive: { borderColor: Colors.purple[600] },
  layoutLabel: { fontSize: 8, color: Colors.gray[600], textAlign: 'center', paddingVertical: 2, backgroundColor: '#fff' },

  // Palette dots
  paletteDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  paletteDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.gray[300] },
  paletteHint: { fontSize: 9, color: Colors.gray[400], marginLeft: 4 },

  // Custom colors — swatches are square aspect-ratio tiles so each one is a
  // visible, clearly tappable color box (was 40px tall with flex:1, which
  // collapsed to thin lines when 5 colors were shown).
  customSection: { marginTop: 14 },
  customHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customSwatches: { flexDirection: 'row', gap: 10 },
  customSwatch: { flex: 1, aspectRatio: 1, minHeight: 56, maxHeight: 80, borderRadius: 10, borderWidth: 2, borderColor: Colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  customSwatchNum: { fontSize: 14, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  customHint: { fontSize: 10, color: Colors.gray[400], marginTop: 6 },

  // Style toggle
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center' },
  toggleBtnActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  toggleBtnText: { fontSize: 12, fontWeight: '600', color: Colors.gray[600] },
  toggleBtnTextActive: { color: Colors.purple[700] },

  // Border controls
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[600] },
  checkboxLabel: { fontSize: 13, color: Colors.gray[600] },
  borderControls: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  borderColorSwatch: { width: 36, height: 28, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[300] },
  borderLabel: { fontSize: 12, color: Colors.gray[500] },

  // Direction buttons
  dirBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center' as const },
  dirBtnActive: { borderColor: Colors.purple[600], backgroundColor: Colors.purple[50] },
  dirBtnText: { fontSize: 11, color: Colors.gray[400] },
  dirBtnTextActive: { color: Colors.purple[700], fontWeight: '600' as const },

  // Text fields
  fieldLabel: { fontSize: 10, fontWeight: '600' as const, color: Colors.gray[500], marginBottom: 2 },
  fieldInput: { backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: Colors.gray[900] },

  // Download
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.purple[600], borderRadius: 10, paddingVertical: 14 },
  downloadBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
