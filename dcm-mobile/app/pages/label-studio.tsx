import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Dimensions, FlatList, Alert, Share,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import * as WebBrowser from 'expo-web-browser'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
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
import ColorPickerModal from '@/components/labels/ColorPickerModal'
import LabelMockup, { type LabelTypeId } from '@/components/labels/LabelMockup'
import LabelBadgesPicker from '@/components/labels/LabelBadgesPicker'
import { useLabelStyle } from '@/hooks/useLabelStyle'
import { useUserEmblems } from '@/hooks/useUserEmblems'

const { width: SCREEN_W } = Dimensions.get('window')

// Label gallery — matches LABEL_TYPES on web. Each item has a holder type
// (slab / one-touch / toploader / digital) so the mockup tile renders the
// correct frame, plus the export route ID used by the /label-export flow.
const LABEL_GALLERY: Array<{
  id: LabelTypeId
  name: string
  holderLabel: string
  shortName: string
  dimensions: string
  useCase: string
  description: string
  howToApply: string
  forcedStyle?: 'modern' | 'traditional'
  needsFormat?: boolean
}> = [
  { id: 'slab-modern',         name: 'Graded Slab (Modern)',      holderLabel: 'Graded Card Slab', shortName: 'Modern Slab',      dimensions: '2.8" × 0.8"',     useCase: 'Insert into standard grading slab', description: 'Dark gradient label matching DCM modern style. Duplex printing with front grade and back QR code.', howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.', forcedStyle: 'modern', needsFormat: true },
  { id: 'slab-traditional',    name: 'Graded Slab (Traditional)', holderLabel: 'Graded Card Slab', shortName: 'Traditional Slab', dimensions: '2.8" × 0.8"',     useCase: 'Insert into standard grading slab', description: 'Light/white label with classic grading style. Clean, professional look for any slab.', howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.', forcedStyle: 'traditional', needsFormat: true },
  { id: 'onetouch',            name: 'Magnetic One-Touch',        holderLabel: 'Mag One Touch',    shortName: 'One-Touch',        dimensions: '1.25" × 2.375"',  useCase: 'Avery 6871 for magnetic cases',     description: 'Sized for Avery 6871 labels. Fits magnetic one-touch card holders perfectly.', howToApply: 'Print on Avery 6871 label sheets. Peel and stick to one-touch magnetic case.' },
  { id: 'toploader',           name: 'Toploader Front+Back',      holderLabel: 'Top Loader',       shortName: 'Toploader',        dimensions: '1.75" × 0.5"',    useCase: 'Avery 8167, front grade + back QR', description: 'Two small labels per card — grade info on front, QR code on back of toploader.', howToApply: 'Print on Avery 8167 sheets. Apply front label to toploader front, back label to rear.' },
  { id: 'foldover',            name: 'Fold-Over Toploader',       holderLabel: 'Top Loader',       shortName: 'Fold-Over',        dimensions: '1.75" × 0.5"',    useCase: 'Single label, fold over toploader tab', description: 'One label that folds over the toploader opening. Grade visible on front, QR on back.', howToApply: 'Print on Avery 8167. Apply to toploader top edge and fold over to seal.' },
  { id: 'card-image-modern',   name: 'Card Image (Modern)',       holderLabel: 'Digital',          shortName: 'Card Image',       dimensions: '800 × 1120 px',   useCase: 'eBay / social media sharing',       description: 'Digital card image with modern dark label overlay. Perfect for online listings.', howToApply: 'Download and upload to eBay, social media, or online marketplace listings.', forcedStyle: 'modern' },
  { id: 'card-image-traditional', name: 'Card Image (Traditional)', holderLabel: 'Digital',         shortName: 'Card Image',       dimensions: '800 × 1120 px',   useCase: 'eBay / social media sharing',       description: 'Digital card image with traditional light label overlay. Clean look for listings.', howToApply: 'Download and upload to eBay, social media, or online marketplace listings.', forcedStyle: 'traditional' },
  { id: 'custom',              name: 'Custom Label',              holderLabel: 'Graded Card Slab', shortName: 'Custom',           dimensions: 'Any size',        useCase: 'Design your own',                   description: 'Custom dimensions, colors, borders, and editable text.', howToApply: 'Customize the colors, layout, and dimensions in the Customize section below.', needsFormat: true },
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
  style: 'modern' | 'traditional'
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  topEdgeGradient?: string[]
  customColors?: string[]
  layoutStyle?: string
  gradientAngle?: number
  geometricPattern?: number
  // Dimension preset bookkeeping (matches CustomLabelConfig in src/lib/labelPresets.ts)
  preset?: 'dcm' | 'dcm-traditional' | 'dcm-bordered' | 'custom'
  width?: number
  height?: number
}

// ============================================================================
// Main Screen
// ============================================================================

export default function LabelStudioScreen() {
  const params = useLocalSearchParams<{ cardId?: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const userEmblems = useUserEmblems()
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
  const [backUrl, setBackUrl] = useState<string | null>(null)
  const [cardColors, setCardColors] = useState<CardColors | null>(null)
  const [search, setSearch] = useState('')

  // Designer state
  const [config, setConfig] = useState<DesignerConfig>({
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
  })
  const [activeCardColorStyle, setActiveCardColorStyle] = useState<string | null>(null)
  const [customColorCount, setCustomColorCount] = useState(2)
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')

  // Editable text fields
  const [labelName, setLabelName] = useState('')
  const [labelSet, setLabelSet] = useState('')
  const [labelSubset, setLabelSubset] = useState('')
  const [labelNumber, setLabelNumber] = useState('')
  const [labelYear, setLabelYear] = useState('')
  const [labelFeatures, setLabelFeatures] = useState('')
  const [fieldsInitialized, setFieldsInitialized] = useState<string | null>(null)
  const [savingLabelFields, setSavingLabelFields] = useState(false)

  // Saved styles — synced with web via useLabelStyle hook (server source of truth).
  // Replaces the previous AsyncStorage-only flow so users see the same custom-1..4
  // slots they have on the web account.
  const { customStyles, saveCustomStyle, deleteCustomStyle, renameCustomStyle } = useLabelStyle()
  const [savingStyle, setSavingStyle] = useState(false)
  const [renamingStyleId, setRenamingStyleId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(0)

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
      .select('id, serial, front_path, card_name, featured, category, card_set, release_date, card_number, conversational_whole_grade, conversational_condition_label, conversational_card_info, conversational_weighted_sub_scores, conversational_sub_scores, card_colors, custom_label_data')
      .eq('user_id', session.user.id)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

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
    setLabelName(custom.primaryName ?? (selectedCard.card_name || ci?.card_name || selectedCard.featured || ''))
    setLabelSet(custom.setName ?? (selectedCard.card_set || ci?.set_name || ''))
    setLabelSubset(custom.subset ?? (ci?.subset || ''))
    setLabelNumber(custom.cardNumber ?? (selectedCard.card_number || ci?.card_number || ''))
    setLabelYear(custom.year ?? (selectedCard.release_date || ci?.year || ''))
    setLabelFeatures(Array.isArray(custom.features) ? custom.features.join(', ') : '')
    setFieldsInitialized(selectedCard.id)
  }, [selectedCard, fieldsInitialized])

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

  // Load card colors
  useEffect(() => {
    if (!selectedCard) { setCardColors(null); return }
    if (selectedCard.card_colors) { setCardColors(selectedCard.card_colors); return }
    setCardColors(null)
  }, [selectedCard])

  // ---- Config helpers ----
  const updateConfig = useCallback((partial: Partial<DesignerConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }, [])

  // Build label data for renderer
  const labelCardData = useMemo<LabelCardData | null>(() => {
    if (!selectedCard) return null
    const grade = selectedCard.conversational_whole_grade
    const name = labelName || 'Card'
    const contextParts = [labelSet, labelYear, labelNumber].filter(Boolean)
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
      contextLine: contextParts.join(' • '),
      featuresLine: labelFeatures || '',
      serial: selectedCard.serial || '',
      grade: grade,
      condition: selectedCard.conversational_condition_label || '',
      subScores: hasSub ? { centering: ext('centering'), corners: ext('corners'), edges: ext('edges'), surface: ext('surface') } : undefined,
      qrUrl: `https://dcmgrading.com/verify/${selectedCard.serial || ''}`,
    }
  }, [selectedCard, labelName, labelSet, labelYear, labelNumber, labelFeatures])

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
    }
  }, [config.gradientStart, config.gradientEnd, config.customColors, config.layoutStyle, config.colorPreset, config.topEdgeGradient, config.borderEnabled, config.borderColor, config.gradientAngle, config.geometricPattern])

  const labelConfig = useMemo<LabelConfig>(() => ({
    width: config.width ?? 2.8,
    height: config.height ?? 0.8,
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
  }), [config])

  // ---- Handlers ----
  const handleColorPreset = useCallback((preset: ColorPreset) => {
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
  }, [cardColors, config, updateConfig])

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
    } else if (preset.id === 'dcm-traditional') {
      base.colorPreset = 'traditional'
      base.gradientStart = '#f9fafb'
      base.gradientEnd = '#ffffff'
      base.style = 'traditional'
      base.borderEnabled = false
    } else if (preset.id === 'dcm-bordered') {
      base.colorPreset = 'traditional'
      base.gradientStart = '#f9fafb'
      base.gradientEnd = '#ffffff'
      base.style = 'traditional'
      base.borderEnabled = true
      base.borderColor = '#7c3aed'
      base.borderWidth = 0.04
    }
    setActiveCardColorStyle(null)
    updateConfig(base)
  }, [updateConfig])

  const handleCardColorStyle = useCallback((styleId: string) => {
    if (!cardColors) return
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
  }, [cardColors, updateConfig])

  const handleCustomLayoutStyle = useCallback((layoutId: string) => {
    const cols = config.customColors || [config.gradientStart, config.gradientEnd]
    updateConfig({
      ...applyLayoutToColors(layoutId, cols),
      customColors: cols,
      layoutStyle: layoutId,
    })
    setActiveCardColorStyle(null)
  }, [config, updateConfig])

  const openColorPicker = useCallback((slotIndex: number) => {
    const cols = config.customColors || [config.gradientStart, config.gradientEnd]
    setPickerSlot(slotIndex)
    setPickerCurrentColor(cols[slotIndex] || '#7c3aed')
    setPickerVisible(true)
  }, [config])

  const handlePickerSelect = useCallback((hex: string) => {
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
  }, [config, pickerSlot, customColorCount, updateConfig])

  // ---- Saved styles (server-synced via useLabelStyle hook) ----
  // Convert the in-app DesignerConfig to the CustomLabelConfig shape the API stores.
  const buildSaveConfig = useCallback(() => ({
    colorPreset: config.colorPreset,
    gradientStart: config.gradientStart,
    gradientEnd: config.gradientEnd,
    style: config.style,
    borderEnabled: config.borderEnabled,
    borderColor: config.borderColor,
    borderWidth: config.borderWidth,
    topEdgeGradient: config.topEdgeGradient,
    preset: config.preset,
    width: config.width,
    height: config.height,
  }), [config])

  const saveStyle = useCallback(async () => {
    if (customStyles.length >= 4) {
      Alert.alert('Limit reached', 'You can keep up to 4 saved styles. Update or delete one to save a new design.')
      return
    }
    setSavingStyle(true)
    const slotNumber = customStyles.length + 1
    const saved = await saveCustomStyle({ name: `Custom Label ${slotNumber}`, config: buildSaveConfig() })
    setSavingStyle(false)
    if (saved) Alert.alert('Saved', `"${saved.name}" saved to slot ${saved.id}.`)
    else Alert.alert('Save failed', 'Could not save the style. Try again.')
  }, [customStyles.length, saveCustomStyle, buildSaveConfig])

  const updateExistingStyle = useCallback(async (id: string, name: string) => {
    setSavingStyle(true)
    const saved = await saveCustomStyle({ id, name, config: buildSaveConfig() })
    setSavingStyle(false)
    if (saved) Alert.alert('Updated', `"${saved.name}" updated with current design.`)
    else Alert.alert('Update failed', 'Could not update the style.')
  }, [saveCustomStyle, buildSaveConfig])

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
      const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
      const features = labelFeatures
        .split(',')
        .map(f => f.trim())
        .filter(Boolean)
        .slice(0, 10)
      const payload = {
        primaryName: labelName.trim() || null,
        setName: labelSet.trim() || null,
        subset: labelSubset.trim() || null,
        cardNumber: labelNumber.trim() || null,
        year: labelYear.trim() || null,
        features,
      }
      const res = await fetch(`${API_BASE}/api/cards/${selectedCard.id}/custom-label`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any))
        throw new Error(body.error || `Save failed (HTTP ${res.status})`)
      }
      // Patch the cached selectedCard so re-renders reuse the new values
      setSelectedCard((prev: any) => prev ? { ...prev, custom_label_data: payload } : prev)
      Alert.alert('Saved', 'Custom label text saved to this card. It will show up on slabs, collection thumbnails, and downloadable labels everywhere.')
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
  const openWebDownload = useCallback(async (exportType: string, format?: 'duplex' | 'foldover') => {
    if (!selectedCard?.id || !session?.access_token) return
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'
    const params = new URLSearchParams()
    params.set('token', session.access_token)
    params.set('type', exportType)
    if (format) params.set('format', format)
    params.set('labelStyle', config.style || 'modern')
    params.set('download', '1')

    // For custom slab, ship the customizer's CURRENT in-flight config so the
    // generated PDF matches exactly what the user is designing — without
    // forcing them to save it to a slot first. Web /label-export reads this
    // base64-encoded JSON via ?customConfig=...
    if (exportType === 'slab-custom') {
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

    const url = `${API_BASE}/label-export/${selectedCard.id}?${params.toString()}`
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: Colors.purple[600],
        toolbarColor: '#ffffff',
      })
    } catch (err: any) {
      Alert.alert('Could not open download', err?.message || 'Try again.')
    }
  }, [selectedCard, session?.access_token, config])

  // Gallery's per-tile Download button — uses the in-app web browser
  // approach so the user gets the same download UX as mobile web.
  const handleGalleryDownload = useCallback((labelType: typeof LABEL_GALLERY[number]) => {
    if (!selectedCard?.id) {
      Alert.alert('Select a card', 'Pick a card above before downloading a label.')
      return
    }
    // Gallery uses 'custom' for the user's custom slab tile; the export
    // pipeline expects 'slab-custom'.
    const exportType = labelType.id === 'custom' ? 'slab-custom' : labelType.id

    // Slab labels print in duplex (front+back separate pages) or fold-over
    // (one page that folds at the center). Prompt the user once per download.
    if (labelType.needsFormat) {
      Alert.alert(
        labelType.name,
        'Choose print format:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Duplex (front+back)', onPress: () => openWebDownload(exportType, 'duplex') },
          { text: 'Fold-over', onPress: () => openWebDownload(exportType, 'foldover') },
        ],
      )
      return
    }
    openWebDownload(exportType)
  }, [selectedCard, openWebDownload])

  const loadStyle = useCallback((styleConfig: any) => {
    setConfig(prev => ({
      ...prev,
      colorPreset: styleConfig.colorPreset || prev.colorPreset,
      gradientStart: styleConfig.gradientStart || prev.gradientStart,
      gradientEnd: styleConfig.gradientEnd || prev.gradientEnd,
      style: styleConfig.style || prev.style,
      borderEnabled: !!styleConfig.borderEnabled,
      borderColor: styleConfig.borderColor || prev.borderColor,
      borderWidth: styleConfig.borderWidth ?? prev.borderWidth,
      topEdgeGradient: styleConfig.topEdgeGradient,
      preset: styleConfig.preset ?? prev.preset,
      width: styleConfig.width ?? prev.width,
      height: styleConfig.height ?? prev.height,
    }))
    setActiveCardColorStyle(null)
  }, [])

  // ---- Download/Share ----
  const handleShare = useCallback(async () => {
    if (!labelPreviewUrl) return
    try {
      const base64 = labelPreviewUrl.split(',')[1]
      if (!base64) return
      const fileUri = FileSystem.cacheDirectory + `dcm-label-${Date.now()}.png`
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Download Label' })
      } else {
        Alert.alert('Sharing not available on this device')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share label')
    }
  }, [labelPreviewUrl])

  // ---- Filter cards ----
  const filtered = useMemo(() => {
    if (!search.trim()) return cards.slice(0, 20)
    const q = search.toLowerCase()
    return cards.filter(c =>
      (c.card_name || '').toLowerCase().includes(q) ||
      (c.serial || '').toLowerCase().includes(q) ||
      (c.featured || '').toLowerCase().includes(q)
    ).slice(0, 20)
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
      {/* Hidden label renderer */}
      <LabelWebRenderer
        config={labelConfig}
        cardData={labelCardData}
        side={side}
        onRender={setLabelPreviewUrl}
      />

      {/* Color picker modal */}
      <ColorPickerModal
        visible={pickerVisible}
        currentColor={pickerCurrentColor}
        onSelectColor={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
        cardImageUrl={frontUrl}
      />

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* ============ Card Selector ============ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Select a Card</Text>
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
              return (
                <TouchableOpacity
                  style={[s.cardTile, isSelected && s.cardTileSelected]}
                  onPress={() => setSelectedCard(item)}
                  activeOpacity={0.7}
                >
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

        {selectedCard && (
          <>
            {/* ============ Label Badges ============ */}
            <LabelBadgesPicker />

            {/* ============ Label Gallery (Swipeable) ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Label Gallery</Text>
                <Text style={{ fontSize: 11, color: Colors.gray[400] }}>{LABEL_GALLERY.length} label types</Text>
              </View>
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={LABEL_GALLERY}
                keyExtractor={item => item.id}
                contentContainerStyle={{ gap: 0 }}
                snapToAlignment="center"
                decelerationRate="fast"
                snapToInterval={SCREEN_W - 24}
                // Negate the section's horizontal padding (16px each side) so
                // the FlatList viewport equals the panel width (SCREEN_W-24).
                // Without this, panels are wider than the viewport and the
                // holder PNG bleeds into the neighboring slide.
                style={{ marginHorizontal: -16 }}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 24))
                  setActiveGalleryIdx(idx)
                  // Keep the user's customizer style in sync with the visible tile so
                  // the rendered preview reflects the type they're swiping through.
                  const t = LABEL_GALLERY[idx]
                  if (t?.forcedStyle && config.style !== t.forcedStyle) {
                    setConfig(prev => ({ ...prev, style: t.forcedStyle! }))
                  }
                }}
                renderItem={({ item: labelType, index }) => (
                  <View style={{ width: SCREEN_W - 24, paddingHorizontal: 12 }}>
                    {/* Type label header */}
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.gray[900], textAlign: 'center' }}>{labelType.name}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.purple[600], textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 8 }}>{labelType.holderLabel}</Text>

                    {/* Holder mockup */}
                    <LabelMockup
                      labelType={labelType.id}
                      cardImageUrl={frontUrl}
                      cardBackImageUrl={backUrl}
                      width={260}
                      labelProps={inlineLabelProps}
                      side={side}
                      emblems={galleryEmblems}
                      customOverrides={customOverrides}
                    />

                    {/* Side toggle (front/back) — same as designer below */}
                    <View style={[s.sideToggle, { marginTop: 8, alignSelf: 'center' }]}>
                      <TouchableOpacity style={[s.sideBtn, side === 'front' && s.sideBtnActive]} onPress={() => setSide('front')}>
                        <Text style={[s.sideBtnText, side === 'front' && s.sideBtnTextActive]}>Front</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.sideBtn, side === 'back' && s.sideBtnActive]} onPress={() => setSide('back')}>
                        <Text style={[s.sideBtnText, side === 'back' && s.sideBtnTextActive]}>Back</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 11, color: Colors.gray[500], textAlign: 'center', marginTop: 8 }}>
                      {labelType.dimensions} — {labelType.useCase}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.gray[400], textAlign: 'center', marginTop: 4 }} numberOfLines={3}>
                      {labelType.description}
                    </Text>
                    <TouchableOpacity
                      style={[s.downloadBtn, { marginTop: 12, marginHorizontal: 20 }]}
                      onPress={() => handleGalleryDownload(labelType)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="download-outline" size={16} color="#fff" />
                      <Text style={s.downloadBtnText}>
                        {labelType.holderLabel === 'Digital' ? 'Download Images' : 'Download PDF'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 4 }}>
                {LABEL_GALLERY.map((_, i) => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === activeGalleryIdx ? Colors.purple[600] : Colors.gray[300] }} />
                ))}
              </View>
            </View>

            {/* ============ Custom Slab Preview ============ */}
            {/* Uses LabelMockup (native inline) so the DCM logo, colors, and
                emblems exactly match what gets exported. The 'custom' labelType
                pipes customOverrides through so this updates live as the user
                edits gradient colors below. */}
            <View style={s.section}>
              <LabelMockup
                labelType="custom"
                cardImageUrl={frontUrl}
                cardBackImageUrl={backUrl}
                width={260}
                labelProps={inlineLabelProps}
                side={side}
                emblems={galleryEmblems}
                customOverrides={customOverrides}
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

            {/* ============ Dimensions ============ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Dimensions</Text>
              <View style={s.dimGrid}>
                {DIMENSION_PRESETS.map(p => {
                  const isActive = (config.preset ?? 'dcm') === p.id
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.dimTile, isActive && s.dimTileActive]}
                      onPress={() => handleDimensionPreset(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dimTileName, isActive && s.dimTileNameActive]}>{p.name}</Text>
                      <Text style={s.dimTileSize}>
                        {p.id === 'custom' ? 'Adjust width & height' : `${p.width}" × ${p.height}"`}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {(config.preset === 'custom') && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Width (in)</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={String(config.width ?? 2.8)}
                      keyboardType="decimal-pad"
                      onChangeText={(t) => {
                        const v = parseFloat(t)
                        updateConfig({ width: Number.isFinite(v) ? Math.min(4, Math.max(0.5, v)) : 2.8 })
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Height (in)</Text>
                    <TextInput
                      style={s.fieldInput}
                      value={String(config.height ?? 0.8)}
                      keyboardType="decimal-pad"
                      onChangeText={(t) => {
                        const v = parseFloat(t)
                        updateConfig({ height: Number.isFinite(v) ? Math.min(4, Math.max(0.3, v)) : 0.8 })
                      }}
                    />
                  </View>
                </View>
              )}
            </View>

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

            {/* ============ Custom Slab Preview (duplicate) ============ */}
            {/* Second preview below border so users can edit colors/border and
                see the result without scrolling back to the top. */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Live Preview</Text>
              <LabelMockup
                labelType="custom"
                cardImageUrl={frontUrl}
                cardBackImageUrl={backUrl}
                width={260}
                labelProps={inlineLabelProps}
                side={side}
                emblems={galleryEmblems}
                customOverrides={customOverrides}
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

            {/* ============ Label Text ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.sectionTitle}>Label Text</Text>
                <Text style={{ fontSize: 10, color: Colors.gray[400] }}>Edits override AI values</Text>
              </View>
              <View style={{ gap: 8 }}>
                <View>
                  <Text style={s.fieldLabel}>Card Name</Text>
                  <TextInput style={s.fieldInput} value={labelName} onChangeText={setLabelName} placeholder="Card name" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Set</Text>
                    <TextInput style={s.fieldInput} value={labelSet} onChangeText={setLabelSet} placeholder="Set name" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                  </View>
                  <View style={{ flex: 0.5 }}>
                    <Text style={s.fieldLabel}>Year</Text>
                    <TextInput style={s.fieldInput} value={labelYear} onChangeText={setLabelYear} placeholder="Year" placeholderTextColor={Colors.gray[400]} maxLength={20} />
                  </View>
                </View>
                <View>
                  <Text style={s.fieldLabel}>Subset</Text>
                  <TextInput style={s.fieldInput} value={labelSubset} onChangeText={setLabelSubset} placeholder="Insert / parallel name (e.g. Power Players)" placeholderTextColor={Colors.gray[400]} maxLength={200} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 0.5 }}>
                    <Text style={s.fieldLabel}>Card #</Text>
                    <TextInput style={s.fieldInput} value={labelNumber} onChangeText={setLabelNumber} placeholder="#" placeholderTextColor={Colors.gray[400]} maxLength={50} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Features (comma-separated, max 10)</Text>
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
                    Alert.alert('Select a card', 'Pick a card above to download its custom label.')
                    return
                  }
                  Alert.alert(
                    'Download Custom Label',
                    'Choose print format:',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Duplex (front+back)', onPress: () => openWebDownload('slab-custom', 'duplex') },
                      { text: 'Fold-over', onPress: () => openWebDownload('slab-custom', 'foldover') },
                    ],
                  )
                }}
                disabled={!selectedCard?.id}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={s.downloadBtnText}>Download Custom Label</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: Colors.gray[400], marginTop: 6, textAlign: 'center' }}>
                Opens the DCM download page in your browser. PDF saves to your Downloads folder.
              </Text>
            </View>

            {/* ============ Saved Styles (server-synced custom-1..4) ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.sectionTitle}>Saved Styles {customStyles.length > 0 && <Text style={{ fontSize: 11, color: Colors.gray[400], fontWeight: '500' }}>({customStyles.length}/4)</Text>}</Text>
                <TouchableOpacity
                  onPress={saveStyle}
                  disabled={savingStyle || customStyles.length >= 4}
                  style={{ backgroundColor: customStyles.length >= 4 ? Colors.gray[300] : Colors.purple[600], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
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
                      <TouchableOpacity onPress={() => deleteStyle(style.id)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.red[500]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}
      </ScrollView>
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
        colors={cardColors.palette.slice(0, 3) as [string, ...string[]]}
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
        colors={colors as [string, ...string[]]}
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
