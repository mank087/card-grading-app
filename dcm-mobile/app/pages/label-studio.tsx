import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Dimensions, FlatList, Alert, Share,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import {
  COLOR_PRESETS, LAYOUT_STYLES, CARD_COLOR_STYLES,
  applyLayoutToColors,
  type ColorPreset, type CardColorInput,
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

const { width: SCREEN_W } = Dimensions.get('window')

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
}

// ============================================================================
// Main Screen
// ============================================================================

export default function LabelStudioScreen() {
  const params = useLocalSearchParams<{ cardId?: string }>()
  const { session } = useAuth()
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [frontUrl, setFrontUrl] = useState<string | null>(null)
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
  })
  const [activeCardColorStyle, setActiveCardColorStyle] = useState<string | null>(null)
  const [customColorCount, setCustomColorCount] = useState(2)
  const [labelPreviewUrl, setLabelPreviewUrl] = useState<string | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')

  // Editable text fields
  const [labelName, setLabelName] = useState('')
  const [labelSet, setLabelSet] = useState('')
  const [labelNumber, setLabelNumber] = useState('')
  const [labelYear, setLabelYear] = useState('')
  const [labelFeatures, setLabelFeatures] = useState('')
  const [fieldsInitialized, setFieldsInitialized] = useState<string | null>(null)

  // Saved styles
  const [savedStyles, setSavedStyles] = useState<{ id: string; name: string; config: DesignerConfig }[]>([])

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
      .select('id, serial, front_path, card_name, featured, category, card_set, release_date, card_number, conversational_whole_grade, conversational_condition_label, conversational_card_info, card_colors, custom_label_data')
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

  // Load saved styles from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('dcm_saved_label_styles').then(raw => {
      if (raw) try { setSavedStyles(JSON.parse(raw)) } catch {}
    })
  }, [])

  // Initialize text fields when card changes
  useEffect(() => {
    if (!selectedCard || fieldsInitialized === selectedCard.id) return
    const ci = selectedCard.conversational_card_info
    setLabelName(selectedCard.card_name || ci?.card_name || selectedCard.featured || '')
    setLabelSet(selectedCard.card_set || ci?.set_name || '')
    setLabelNumber(selectedCard.card_number || ci?.card_number || '')
    setLabelYear(selectedCard.release_date || ci?.year || '')
    setLabelFeatures('')
    setFieldsInitialized(selectedCard.id)
  }, [selectedCard, fieldsInitialized])

  // Load card image when selected
  useEffect(() => {
    if (!selectedCard?.front_path) { setFrontUrl(null); return }
    supabase.storage.from('cards').createSignedUrl(selectedCard.front_path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setFrontUrl(data.signedUrl) })
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
    return {
      primaryName: name,
      contextLine: contextParts.join(' • '),
      featuresLine: labelFeatures || '',
      serial: selectedCard.serial || '',
      grade: grade,
      condition: selectedCard.conversational_condition_label || '',
    }
  }, [selectedCard, labelName, labelSet, labelYear, labelNumber, labelFeatures])

  const labelConfig = useMemo<LabelConfig>(() => ({
    width: 2.8,
    height: 0.8,
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

  // ---- Saved styles ----
  const saveStyle = useCallback(async () => {
    const id = `custom-${Date.now()}`
    const name = `Style ${savedStyles.length + 1}`
    const updated = [...savedStyles, { id, name, config: { ...config } }].slice(-4)
    setSavedStyles(updated)
    await AsyncStorage.setItem('dcm_saved_label_styles', JSON.stringify(updated))
    Alert.alert('Saved', `"${name}" has been saved.`)
  }, [config, savedStyles])

  const deleteStyle = useCallback(async (id: string) => {
    const updated = savedStyles.filter(s => s.id !== id)
    setSavedStyles(updated)
    await AsyncStorage.setItem('dcm_saved_label_styles', JSON.stringify(updated))
  }, [savedStyles])

  const loadStyle = useCallback((styleConfig: DesignerConfig) => {
    setConfig(styleConfig)
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
        await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Share Label' })
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
            {/* ============ Slab Preview ============ */}
            <View style={s.section}>
              <View style={s.slabContainer}>
                <Image
                  source={require('@/assets/images/graded-card-slab.png')}
                  style={s.slabImage}
                  resizeMode="contain"
                />
                {/* Label in slab slot */}
                <View style={s.slabLabelSlot}>
                  {labelPreviewUrl ? (
                    <Image source={{ uri: labelPreviewUrl }} style={s.slabLabel} resizeMode="contain" />
                  ) : (
                    <View style={[s.slabLabel, { backgroundColor: Colors.gray[200] }]} />
                  )}
                </View>
                {/* Card image */}
                <View style={s.slabCardSlot}>
                  {frontUrl ? (
                    <Image source={{ uri: frontUrl }} style={s.slabCardImage} resizeMode="contain" />
                  ) : (
                    <View style={s.slabCardImage} />
                  )}
                </View>
              </View>
              {/* Side toggle */}
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

            {/* ============ Style Toggle ============ */}
            {!isCustomLayout && !activeCardColorStyle && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Style</Text>
                <View style={s.toggleRow}>
                  <TouchableOpacity
                    style={[s.toggleBtn, config.style === 'modern' && s.toggleBtnActive]}
                    onPress={() => updateConfig({ style: 'modern' })}
                  >
                    <Text style={[s.toggleBtnText, config.style === 'modern' && s.toggleBtnTextActive]}>Modern</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.toggleBtn, config.style === 'traditional' && s.toggleBtnActive]}
                    onPress={() => updateConfig({ style: 'traditional' })}
                  >
                    <Text style={[s.toggleBtnText, config.style === 'traditional' && s.toggleBtnTextActive]}>Traditional</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ============ Border Controls ============ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Border</Text>
              <TouchableOpacity
                style={s.checkboxRow}
                onPress={() => updateConfig({ borderEnabled: !config.borderEnabled })}
              >
                <View style={[s.checkbox, config.borderEnabled && s.checkboxChecked]}>
                  {config.borderEnabled && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={s.checkboxLabel}>Enable border</Text>
              </TouchableOpacity>
              {config.borderEnabled && (
                <View style={{ gap: 10, marginTop: 10 }}>
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
              )}
            </View>

            {/* ============ Label Text ============ */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Label Text</Text>
              <View style={{ gap: 8 }}>
                <View>
                  <Text style={s.fieldLabel}>Card Name</Text>
                  <TextInput style={s.fieldInput} value={labelName} onChangeText={setLabelName} placeholder="Card name" placeholderTextColor={Colors.gray[400]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Set</Text>
                    <TextInput style={s.fieldInput} value={labelSet} onChangeText={setLabelSet} placeholder="Set name" placeholderTextColor={Colors.gray[400]} />
                  </View>
                  <View style={{ flex: 0.5 }}>
                    <Text style={s.fieldLabel}>Year</Text>
                    <TextInput style={s.fieldInput} value={labelYear} onChangeText={setLabelYear} placeholder="Year" placeholderTextColor={Colors.gray[400]} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 0.5 }}>
                    <Text style={s.fieldLabel}>Card #</Text>
                    <TextInput style={s.fieldInput} value={labelNumber} onChangeText={setLabelNumber} placeholder="#" placeholderTextColor={Colors.gray[400]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Features</Text>
                    <TextInput style={s.fieldInput} value={labelFeatures} onChangeText={setLabelFeatures} placeholder="RC, Holo, etc." placeholderTextColor={Colors.gray[400]} />
                  </View>
                </View>
              </View>
            </View>

            {/* ============ Download / Share ============ */}
            <View style={s.section}>
              <TouchableOpacity
                style={s.downloadBtn}
                onPress={handleShare}
                disabled={!labelPreviewUrl}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={s.downloadBtnText}>Share Label</Text>
              </TouchableOpacity>
            </View>

            {/* ============ Saved Styles ============ */}
            <View style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.sectionTitle}>Saved Styles</Text>
                <TouchableOpacity
                  onPress={saveStyle}
                  style={{ backgroundColor: Colors.purple[600], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Save Current</Text>
                </TouchableOpacity>
              </View>
              {savedStyles.length === 0 && (
                <Text style={{ color: Colors.gray[400], fontSize: 12 }}>No saved styles yet. Save your current design to reuse later.</Text>
              )}
              {savedStyles.map((style) => (
                <View key={style.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.gray[100] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <LinearGradient
                      colors={[style.config.gradientStart, style.config.gradientEnd]}
                      style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: Colors.gray[200] }}
                    />
                    <Text style={{ fontSize: 13, color: Colors.gray[700], fontWeight: '500' }}>{style.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => loadStyle(style.config)}>
                      <Text style={{ fontSize: 12, color: Colors.purple[600], fontWeight: '600' }}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteStyle(style.id)}>
                      <Ionicons name="trash-outline" size={16} color={Colors.red[500]} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
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

  // Theme grid
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeTile: { width: (SCREEN_W - 24 - 32 - 24) / 4, borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[200], overflow: 'hidden' },
  themeTileActive: { borderColor: Colors.purple[600], borderWidth: 2 },
  themeSwatch: { width: '100%', aspectRatio: 1, borderRadius: 0 },
  themeLabel: { fontSize: 8, color: Colors.gray[600], textAlign: 'center', paddingVertical: 2, backgroundColor: '#fff' },

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

  // Custom colors
  customSection: { marginTop: 14 },
  customHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customSwatches: { flexDirection: 'row', gap: 8 },
  customSwatch: { flex: 1, height: 40, borderRadius: 8, borderWidth: 2, borderColor: Colors.gray[300], justifyContent: 'center', alignItems: 'center' },
  customSwatchNum: { fontSize: 10, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  customHint: { fontSize: 9, color: Colors.gray[400], marginTop: 4 },

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
