'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  pickContrastTextHex,
  sampleGradientContrast,
  printColorTweaksHex,
  type BackgroundContrastReport,
} from '@/lib/labelLab/contrastWCAG'
import {
  presetSpec,
  cardColorSpecs,
  customSpec,
  evaluateSpec,
  PRESET_IDS,
  type LabStyleSpec,
} from '@/lib/labelLab/labStyleSpecs'
import {
  COLOR_PRESETS,
  CARD_COLOR_STYLES,
  LAYOUT_STYLES,
  GEOMETRIC_PATTERNS,
  GRADE_CHIPS,
  resolveGradeChip,
  type CardColorInput,
} from '@/lib/labelPresets'
import { BAND_PATTERNS, LOGO_TREATMENTS, type BandPattern, type LogoTreatment } from '@/lib/labelLab/heritageSlabPdfDoc'

// ============================================================================
// Types
// ============================================================================

interface LabCard {
  id: string
  serial: string
  category: string | null
  card_name: string | null
  featured: string | null
  pokemon_featured: string | null
  card_set: string | null
  card_number: string | null
  release_date: string | null
  conversational_whole_grade: number | null
  conversational_condition_label: string | null
  conversational_card_info: any
  conversational_sub_scores: any
  conversational_weighted_sub_scores: any
  card_colors: any
  front_url: string | null
  back_url: string | null
}

type LabFormat =
  | 'heritage'
  | 'calibration'
  | 'custom-style'
  | 'style-gauntlet'
  | 'slab-modern'
  | 'slab-traditional'
  | 'foldable'
  | 'avery-6871'
  | 'avery-8167'
  | 'card-image'

const LAB_FORMATS: { id: LabFormat; label: string; live: boolean; description: string }[] = [
  { id: 'heritage', label: 'Heritage — Round 3 redesign (front + back)', live: true, description: '2.8" × 0.8" — ivory field, patterned left band, grade-coloured chip, mark bottom-centre. NOT in production: reads GRADE_CHIPS, which the live generators do not yet use.' },
  { id: 'calibration', label: 'Print Calibration Sheet', live: true, description: 'One-page test matrix — raster vs vector A/B, knockout size ladder, tweak strip, halo test, scale ruler. Print at 100%.' },
  { id: 'custom-style', label: 'Custom Style (single label)', live: true, description: 'Any Studio style — presets, card-color styles, custom designer — with a live WCAG legibility verdict.' },
  { id: 'style-gauntlet', label: 'Style Gauntlet (all styles)', live: true, description: 'Every Studio style for the selected card on one sheet, each with its verdict, plus guard tests for the worst failure.' },
  { id: 'slab-modern', label: 'Modern Slab (front + back)', live: true, description: '2.8" × 0.8" insert — dark gradient. Production: src/lib/slabLabelGenerator.ts' },
  { id: 'slab-traditional', label: 'Traditional Slab (front + back)', live: true, description: '2.8" × 0.8" insert — light theme. Production: src/lib/slabLabelGenerator.ts' },
  { id: 'foldable', label: 'Foldable 2.5" × 3.5"', live: false, description: 'Full trading-card insert with QR + summary. Production: src/lib/foldableLabelGenerator.ts. Next iteration.' },
  { id: 'avery-6871', label: 'Avery 6871 One-Touch (18/sheet)', live: false, description: 'One-Touch case foldover, 2.375" × 1.25". Production: src/lib/averyLabelGenerator.ts. Next iteration.' },
  { id: 'avery-8167', label: 'Avery 8167 Toploader (80/sheet)', live: false, description: 'Toploader sticker, 1.75" × 0.5". Production: src/lib/avery8167LabelGenerator.ts. Next iteration.' },
  { id: 'card-image', label: 'Card Image (eBay / social)', live: false, description: '800 × 1328 PNG composite. Production: src/lib/cardImageGenerator.ts. Next iteration.' },
]

// ============================================================================
// Main client
// ============================================================================

export default function LabelLabClient() {
  // --- Card source ---
  const [cards, setCards] = useState<LabCard[]>([])
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedCard, setSelectedCard] = useState<LabCard | null>(null)
  const [loadingCards, setLoadingCards] = useState(true)

  // --- Format ---
  const [format, setFormat] = useState<LabFormat>('slab-modern')

  // --- Print color tweak ---
  const [printTweakIntensity, setPrintTweakIntensity] = useState<number>(0.5)

  // --- Custom style designer ---
  const [styleMode, setStyleMode] = useState<'preset' | 'card-style' | 'custom'>('preset')
  const [presetId, setPresetId] = useState<string>('modern-dark')
  const [cardStyleId, setCardStyleId] = useState<string>('color-gradient')
  const [customColors, setCustomColors] = useState<string[]>(['#7c3aed', '#4c1d95'])
  const [layoutId, setLayoutId] = useState<string>('color-gradient')
  const [angleDeg, setAngleDeg] = useState<number>(135)
  const [geomPattern, setGeomPattern] = useState<number>(0)
  // --- Heritage (Round 3) ---
  const [heritagePattern, setHeritagePattern] = useState<BandPattern>('diamond')
  const [heritagePaletteSource, setHeritagePaletteSource] = useState<'card' | 'brand'>('card')
  // Editable band colours. The source buttons LOAD into this; every swatch is
  // then independently editable, because a sampled palette is a starting point
  // rather than an answer — extraction routinely returns two near-identical
  // darks that need pulling apart by hand.
  const [heritageColors, setHeritageColors] = useState<string[]>(['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd'])
  const [heritageColorsTouched, setHeritageColorsTouched] = useState(false)
  const [heritageLogo, setHeritageLogo] = useState<LogoTreatment>('plate')
  const [heritageFounder, setHeritageFounder] = useState(false)
  const [heritageCardLover, setHeritageCardLover] = useState(false)
  const [heritageVip, setHeritageVip] = useState(false)

  const [borderEnabled, setBorderEnabled] = useState<boolean>(false)
  const [borderColor, setBorderColor] = useState<string>('#7c3aed')

  // --- Logos (fetched once and cached as base64) ---
  const [whiteLogoDataUrl, setWhiteLogoDataUrl] = useState<string | null>(null)
  const [colorLogoDataUrl, setColorLogoDataUrl] = useState<string | null>(null)

  // --- Render state ---
  const [vectorPdfBlobUrl, setVectorPdfBlobUrl] = useState<string | null>(null)
  const [vectorPdfError, setVectorPdfError] = useState<string | null>(null)
  const [vectorBuilding, setVectorBuilding] = useState(false)

  // --- Load recent cards on mount ---
  useEffect(() => {
    let cancelled = false
    setLoadingCards(true)
    fetch('/api/admin/label-lab/cards', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const list = (d.cards || []) as LabCard[]
        setCards(list)
        if (list[0]) setSelectedCard(list[0])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingCards(false) })
    return () => { cancelled = true }
  }, [])

  // --- Fetch logos as base64 (once) ---
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchAsDataUrl('/DCM%20Logo%20white.png').catch(() => null),
      fetchAsDataUrl('/DCM-logo.png').catch(() => null),
    ]).then(([whiteUrl, colorUrl]) => {
      if (cancelled) return
      setWhiteLogoDataUrl(whiteUrl)
      setColorLogoDataUrl(colorUrl)
    })
    return () => { cancelled = true }
  }, [])

  // --- Search debounce ---
  useEffect(() => {
    if (search.trim().length === 0) return
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/admin/label-lab/cards?search=${encodeURIComponent(search.trim())}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          setCards(d.cards || [])
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search])

  // --- Resolve slab inputs from the selected card ---
  const slabInputs = useMemo(() => {
    if (!selectedCard) return null
    return cardToSlabInputs(selectedCard)
  }, [selectedCard])

  // --- Card extracted colors (drives card-color styles + gauntlet) ---
  const cardColorInput = useMemo<(CardColorInput & { palette?: string[] }) | null>(() => {
    const cc = selectedCard?.card_colors
    if (!cc || !cc.primary) return null
    return {
      primary: cc.primary,
      secondary: cc.secondary || cc.primary,
      isDark: !!cc.isDark,
      borderColor: cc.borderColor,
      topEdgeColors: Array.isArray(cc.topEdgeColors) ? cc.topEdgeColors : undefined,
      palette: Array.isArray(cc.palette) ? cc.palette : undefined,
    }
  }, [selectedCard])

  // --- Active custom-style spec + verdict ---
  // Heritage band palette. Prefers the card's extracted palette so the band
  // genuinely samples the card; falls back to primary/secondary, then brand.
  const HERITAGE_BRAND = ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd']
  const cardDerivedColors = useMemo<string[] | null>(() => {
    const cc = cardColorInput
    if (!cc) return null
    if (cc.palette && cc.palette.length >= 2) return cc.palette.slice(0, 5)
    if (cc.topEdgeColors && cc.topEdgeColors.length >= 2) return cc.topEdgeColors.slice(0, 5)
    if (cc.primary) return [cc.primary, cc.secondary || cc.primary]
    return null
  }, [cardColorInput])
  const heritageBandColors = heritageColors

  // Auto-load the card's palette when the selection changes, but never clobber
  // hand-edited swatches — losing a tuned palette because you clicked the next
  // card is the kind of thing that makes a design tool annoying to use.
  useEffect(() => {
    if (heritageColorsTouched) return
    if (heritagePaletteSource !== 'card') return
    if (cardDerivedColors && cardDerivedColors.length >= 2) setHeritageColors(cardDerivedColors)
  }, [cardDerivedColors, heritagePaletteSource, heritageColorsTouched])

  const loadHeritagePalette = (src: 'card' | 'brand') => {
    setHeritagePaletteSource(src)
    setHeritageColorsTouched(false)
    if (src === 'brand') setHeritageColors(HERITAGE_BRAND)
    else if (cardDerivedColors && cardDerivedColors.length >= 2) setHeritageColors(cardDerivedColors)
  }

  const setHeritageColorAt = (i: number, hex: string) => {
    setHeritageColorsTouched(true)
    setHeritageColors(prev => prev.map((c, idx) => (idx === i ? hex : c)))
  }

  const activeStyleSpec = useMemo<LabStyleSpec | null>(() => {
    if (styleMode === 'preset') return presetSpec(presetId)
    if (styleMode === 'card-style') {
      if (!cardColorInput) return null
      return cardColorSpecs(cardColorInput).find(s => s.id === cardStyleId) || null
    }
    return customSpec({
      colors: customColors,
      layoutId,
      angleDeg,
      geometricPattern: geomPattern,
      borderEnabled,
      borderColor,
      borderWidthIn: 0.03,
    })
  }, [styleMode, presetId, cardStyleId, cardColorInput, customColors, layoutId, angleDeg, geomPattern, borderEnabled, borderColor])

  const styleVerdict = useMemo<BackgroundContrastReport | null>(
    () => (activeStyleSpec ? evaluateSpec(activeStyleSpec) : null),
    [activeStyleSpec],
  )

  // --- Gauntlet spec list: all presets + the card's five color styles ---
  const gauntletSpecs = useMemo<LabStyleSpec[]>(() => {
    const specs: LabStyleSpec[] = []
    for (const id of PRESET_IDS) {
      const s = presetSpec(id)
      if (s) specs.push(s)
    }
    if (cardColorInput) specs.push(...cardColorSpecs(cardColorInput))
    return specs
  }, [cardColorInput])

  // --- WCAG contrast report (Modern slab dark gradient is the worst case) ---
  const contrastReport = useMemo(() => {
    if (format !== 'slab-modern') {
      // Traditional is light text on white; passes trivially. Skip noise.
      return null
    }
    const tweakedStart = printTweakIntensity > 0 ? printColorTweaksHex('#1a1625', printTweakIntensity) : '#1a1625'
    const tweakedEnd = printTweakIntensity > 0 ? printColorTweaksHex('#2d1f47', printTweakIntensity) : '#2d1f47'
    return sampleGradientContrast(tweakedStart, tweakedEnd, '#FFFFFF', {
      samples: 5,
      threshold: 7,
    })
  }, [format, printTweakIntensity])

  // --- Build the react-pdf vector blob whenever inputs change ---
  useEffect(() => {
    if (!selectedCard || !slabInputs) return
    const liveFormat = LAB_FORMATS.find(f => f.id === format)?.live
    if (!liveFormat) {
      // Stub format selected — clear the PDF panel
      setVectorPdfBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
      return
    }
    let cancelled = false
    setVectorBuilding(true)
    setVectorPdfError(null)
    ;(async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer')
        let doc: any
        if (format === 'calibration') {
          // The calibration sheet embeds the REAL production raster (canvas
          // JPEG) next to the vector replica, so render both rasters first
          // via the exported production renderer.
          const [{ CalibrationSheetPdfDoc }, prod] = await Promise.all([
            import('@/lib/labelLab/calibrationSheetPdfDoc'),
            import('@/lib/slabLabelGenerator'),
          ])
          const prodData = {
            primaryName: slabInputs.primaryName,
            contextLine: slabInputs.contextLine,
            features: slabInputs.featuresLine ? slabInputs.featuresLine.split(' • ') : [],
            featuresLine: slabInputs.featuresLine || null,
            serial: slabInputs.serial,
            grade: selectedCard.conversational_whole_grade,
            condition: slabInputs.condition,
            qrCodeDataUrl: '',
            logoDataUrl: colorLogoDataUrl || undefined,
            whiteLogoDataUrl: whiteLogoDataUrl || undefined,
          }
          const [rasterModern, rasterTraditional] = await Promise.all([
            prod.renderFrontLabelCanvas(prodData, 'modern').catch(() => null),
            prod.renderFrontLabelCanvas(prodData, 'traditional').catch(() => null),
          ])
          doc = CalibrationSheetPdfDoc({
            slabInputs: { ...slabInputs, whiteLogoDataUrl, colorLogoDataUrl },
            rasterModernDataUrl: rasterModern,
            rasterTraditionalDataUrl: rasterTraditional,
          })
        } else if (format === 'heritage') {
          const [{ HeritageSlabPdfDoc }, QRCode] = await Promise.all([
            import('@/lib/labelLab/heritageSlabPdfDoc'),
            import('qrcode'),
          ])
          // Error-correction H is what allows the mark to punch out the centre
          // without breaking the scan.
          const qrDataUrl = await QRCode.toDataURL(
            `https://dcmgrading.com/verify/${selectedCard.serial}`,
            { errorCorrectionLevel: 'H', margin: 1, width: 560, color: { dark: '#141414', light: '#ffffff' } }
          )
          doc = HeritageSlabPdfDoc({
            inputs: {
              ...slabInputs,
              bandColors: heritageBandColors,
              pattern: heritagePattern,
              colorLogoDataUrl,
              whiteLogoDataUrl,
              logoTreatment: heritageLogo,
              qrDataUrl,
              showFounder: heritageFounder,
              showCardLover: heritageCardLover,
              showVip: heritageVip,
            },
            note: heritagePaletteSource === 'card' && !cardDerivedColors
              ? 'This card has no extracted colours — falling back to the brand palette.'
              : undefined,
          })
        } else if (format === 'custom-style') {
          if (!activeStyleSpec) {
            throw new Error('This card has no extracted colors — card-color styles need card_colors. Pick a preset or custom style, or run the color backfill for this card.')
          }
          const { CustomSlabPdfDoc } = await import('@/lib/labelLab/customSlabPdfBlock')
          doc = CustomSlabPdfDoc({
            inputs: { ...slabInputs, whiteLogoDataUrl, colorLogoDataUrl },
            spec: activeStyleSpec,
            verdictLine: styleVerdict
              ? `Verdict: ${styleVerdict.verdict.toUpperCase()} — chosen text min ${styleVerdict.minChosen.toFixed(1)}:1 · best alternative (${styleVerdict.altChoice}) min ${styleVerdict.minAlt.toFixed(1)}:1 · print threshold 7:1`
              : undefined,
          })
        } else if (format === 'style-gauntlet') {
          const { StyleGauntletPdfDoc } = await import('@/lib/labelLab/styleGauntletPdfDoc')
          const specs = [...gauntletSpecs]
          // Include the designer's current custom spec so one print can
          // also validate work-in-progress designs.
          if (styleMode === 'custom' && activeStyleSpec) specs.push(activeStyleSpec)
          doc = StyleGauntletPdfDoc({
            slabInputs: { ...slabInputs, whiteLogoDataUrl, colorLogoDataUrl },
            specs,
            cardLabel: displayLabel(selectedCard),
          })
        } else {
          const { SlabLabelPdfDoc } = await import('@/lib/labelLab/slabLabelPdfDoc')
          const theme = format === 'slab-traditional' ? 'traditional' : 'modern'
          doc = SlabLabelPdfDoc({
            ...slabInputs,
            theme,
            whiteLogoDataUrl,
            colorLogoDataUrl,
            printColorTweakIntensity: printTweakIntensity,
          })
        }
        const instance = pdf(doc as any)
        const blob = await instance.toBlob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setVectorPdfBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } catch (e: any) {
        if (!cancelled) setVectorPdfError(e?.message || 'Failed to build vector PDF')
      } finally {
        if (!cancelled) setVectorBuilding(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedCard, slabInputs, format, printTweakIntensity, whiteLogoDataUrl, colorLogoDataUrl, activeStyleSpec, styleVerdict, gauntletSpecs, styleMode, heritagePattern, heritageBandColors, heritagePaletteSource, heritageLogo, heritageFounder, heritageCardLover, heritageVip])

  // --- Download vector PDF ---
  const downloadVector = () => {
    if (!vectorPdfBlobUrl || !selectedCard) return
    const a = document.createElement('a')
    a.href = vectorPdfBlobUrl
    a.download = `lab-${format}-${selectedCard.serial}.pdf`
    a.click()
  }

  const activeFormat = LAB_FORMATS.find(f => f.id === format)!

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>🧪</span>
          <div>
            <p className="text-sm font-bold text-amber-900">Label Lab — closed test environment</p>
            <p className="text-sm text-amber-800 mt-1">
              Vector PDF replicas of production label formats. Nothing here is wired to the production
              Label Studio or end-user downloads. Modern + Traditional slab are live in v2; the other
              formats are stubbed and will land in the next iteration once paper-test feedback comes in.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left rail */}
        <div className="space-y-4 xl:col-span-1">
          <FormatPicker format={format} onChange={setFormat} />

          <CardPicker
            cards={cards}
            search={search}
            onSearch={setSearch}
            searching={searching}
            loadingCards={loadingCards}
            selectedCard={selectedCard}
            onSelect={setSelectedCard}
          />

          {format === 'heritage' ? (
            <HeritagePanel
              pattern={heritagePattern}
              onPattern={setHeritagePattern}
              paletteSource={heritagePaletteSource}
              onLoadPalette={loadHeritagePalette}
              onColorAt={setHeritageColorAt}
              touched={heritageColorsTouched}
              cardPalette={cardDerivedColors}
              logo={heritageLogo}
              onLogo={setHeritageLogo}
              bandColors={heritageBandColors}
              hasCardColors={!!cardDerivedColors}
              grade={slabInputs?.grade ?? null}
              founder={heritageFounder}
              onFounder={setHeritageFounder}
              cardLover={heritageCardLover}
              onCardLover={setHeritageCardLover}
              vip={heritageVip}
              onVip={setHeritageVip}
            />
          ) : null}

          {format === 'custom-style' ? (
            <StyleDesignerPanel
              styleMode={styleMode}
              onStyleMode={setStyleMode}
              presetId={presetId}
              onPresetId={setPresetId}
              cardStyleId={cardStyleId}
              onCardStyleId={setCardStyleId}
              hasCardColors={!!cardColorInput}
              customColors={customColors}
              onCustomColors={setCustomColors}
              layoutId={layoutId}
              onLayoutId={setLayoutId}
              angleDeg={angleDeg}
              onAngleDeg={setAngleDeg}
              geomPattern={geomPattern}
              onGeomPattern={setGeomPattern}
              borderEnabled={borderEnabled}
              onBorderEnabled={setBorderEnabled}
              borderColor={borderColor}
              onBorderColor={setBorderColor}
            />
          ) : null}

          {format === 'custom-style' && styleVerdict ? (
            <StyleVerdictPanel report={styleVerdict} />
          ) : null}

          {(format === 'slab-modern' || format === 'slab-traditional') ? (
            <PrintTweakSlider
              value={printTweakIntensity}
              onChange={setPrintTweakIntensity}
            />
          ) : null}

          {contrastReport ? (
            <ContrastReportPanel report={contrastReport} />
          ) : null}
        </div>

        {/* Right panel */}
        <div className="space-y-4 xl:col-span-2">
          {activeFormat.live ? (
            <VectorPdfPreview
              blobUrl={vectorPdfBlobUrl}
              building={vectorBuilding}
              error={vectorPdfError}
              onDownload={downloadVector}
              formatLabel={activeFormat.label}
              description={
                format === 'calibration'
                  ? 'Single page. Print at 100% ("Actual size") — the footer ruler verifies scale. One pass yields the raster-vs-vector A/B verdict, knockout size floor, tweak direction, and halo necessity. Tweak slider does not apply; the sheet sweeps all intensities.'
                  : format === 'custom-style'
                  ? 'Single label at exact print size with neutral cut guides. The verdict panel on the left scores the current style live; the verdict is also printed on the sheet.'
                  : format === 'style-gauntlet'
                  ? `Every Studio style for this card, exact print size, WCAG verdict per row, guard tests for the worst failure. Print at 100%.${cardColorInput ? '' : ' NOTE: this card has no extracted colors — card-color style rows are skipped (presets only). Run the color backfill to include them.'}`
                  : '@react-pdf/renderer. Letter portrait, 2 pages (front + back), cut guides + L-corner marks. Print to compare.'
              }
            />
          ) : (
            <StubFormatPanel format={activeFormat} />
          )}

          <ProductionReferencePanel format={activeFormat} card={selectedCard} />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Format picker
// ============================================================================

function FormatPicker(props: { format: LabFormat; onChange: (f: LabFormat) => void }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Label format</h3>
      <div className="space-y-1">
        {LAB_FORMATS.map(f => (
          <button
            key={f.id}
            onClick={() => props.onChange(f.id)}
            className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${
              props.format === f.id
                ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div>
              <p className="font-semibold">{f.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{f.description}</p>
            </div>
            <span
              className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                f.live ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {f.live ? 'Live' : 'Soon'}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ============================================================================
// Card picker
// ============================================================================

function CardPicker(props: {
  cards: LabCard[]
  search: string
  onSearch: (s: string) => void
  searching: boolean
  loadingCards: boolean
  selectedCard: LabCard | null
  onSelect: (c: LabCard) => void
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Test Card</h3>
      <input
        type="text"
        placeholder="Search recent or any card by name, set, or serial"
        value={props.search}
        onChange={(e) => props.onSearch(e.target.value)}
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
        {props.loadingCards && <p className="text-xs text-gray-500 py-2">Loading...</p>}
        {props.searching && <p className="text-xs text-gray-500 py-2">Searching...</p>}
        {!props.loadingCards && !props.searching && props.cards.length === 0 && (
          <p className="text-xs text-gray-500 py-2">No cards found.</p>
        )}
        {props.cards.map((c) => {
          const label = displayLabel(c)
          const isSel = props.selectedCard?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => props.onSelect(c)}
              className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center gap-2 ${
                isSel ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {c.front_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.front_url} alt="" className="w-8 h-10 object-cover rounded" />
              ) : <div className="w-8 h-10 bg-gray-200 rounded" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{label}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {c.card_set || c.category} • DCM Grade {c.conversational_whole_grade ?? '?'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ============================================================================
// Print tweak slider
// ============================================================================

function PrintTweakSlider(props: { value: number; onChange: (v: number) => void }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Print color tweak</h3>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-700">Intensity</span>
        <span className="text-xs text-gray-500">{Math.round(props.value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full mt-1"
      />
      <p className="text-[11px] text-gray-500 mt-1">
        Darken-toward-black on dark colors + slight desaturation. Counters consumer-inkjet color drift.
        Recommended starting point: 50%. Set to 0% to compare against the untweaked production palette.
      </p>
    </section>
  )
}

// ============================================================================
// Contrast report
// ============================================================================

function ContrastReportPanel(props: {
  report: ReturnType<typeof sampleGradientContrast>
}) {
  const { report } = props
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Contrast (WCAG, print-grade 7:1)
      </h3>
      <div className="space-y-1">
        {report.samples.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-10 h-5 rounded border border-gray-300" style={{ background: `rgb(${s.bg.r},${s.bg.g},${s.bg.b})` }} />
            <span className="font-mono text-gray-600 w-10">t={s.t.toFixed(2)}</span>
            <span className={`font-mono font-bold w-14 ${s.pass ? 'text-green-700' : 'text-red-700'}`}>
              {s.ratio.toFixed(2)}:1
            </span>
            <span className={`text-[10px] font-semibold uppercase ${s.pass ? 'text-green-700' : 'text-red-700'}`}>
              {s.pass ? 'pass' : 'fail'}
            </span>
          </div>
        ))}
      </div>
      <div className={`mt-3 text-xs font-semibold ${report.allPass ? 'text-green-700' : 'text-amber-700'}`}>
        {report.allPass
          ? `Min ${report.minRatio.toFixed(2)}:1 across the gradient. Should print clean.`
          : `Min ${report.minRatio.toFixed(2)}:1 — below the 7:1 print threshold in places. Consider raising tweak intensity or switching to traditional.`}
      </div>
    </section>
  )
}

// ============================================================================
// Custom style designer
// ============================================================================

function HeritagePanel(props: {
  pattern: BandPattern
  onPattern: (p: BandPattern) => void
  paletteSource: 'card' | 'brand'
  onLoadPalette: (s: 'card' | 'brand') => void
  onColorAt: (i: number, hex: string) => void
  touched: boolean
  cardPalette: string[] | null
  logo: LogoTreatment
  onLogo: (t: LogoTreatment) => void
  bandColors: string[]
  hasCardColors: boolean
  grade: string | null
  founder: boolean; onFounder: (v: boolean) => void
  cardLover: boolean; onCardLover: (v: boolean) => void
  vip: boolean; onVip: (v: boolean) => void
}) {
  const chip = resolveGradeChip(props.grade)
  const active = BAND_PATTERNS.find(p => p.id === props.pattern)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Heritage — Round 3</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Lab only. The band pattern and the grade chip are independent, so a busy band can never
          make the grade unreadable.
        </p>
      </div>

      {/* Band pattern */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Band pattern</p>
        <div className="grid grid-cols-2 gap-1.5">
          {BAND_PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => props.onPattern(p.id)}
              className={`text-left px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                props.pattern === p.id
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {active ? <p className="text-[11px] text-gray-500 mt-2">{active.note}</p> : null}
      </div>

      {/* Palette — loaders, then per-swatch editing */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Band colours</p>
        <div className="flex gap-1.5">
          {(['card', 'brand'] as const).map(s => (
            <button
              key={s}
              onClick={() => props.onLoadPalette(s)}
              disabled={s === 'card' && !props.hasCardColors}
              className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40 ${
                props.paletteSource === s && !props.touched
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {s === 'card' ? 'Load from card' : 'Load DCM brand'}
            </button>
          ))}
        </div>

        {/* Each swatch independently editable. */}
        <div className="mt-2 space-y-1.5">
          {props.bandColors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-400 w-3">{i + 1}</span>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#7c3aed'}
                onChange={e => props.onColorAt(i, e.target.value)}
                className="w-8 h-7 rounded border border-gray-200 cursor-pointer p-0"
                title={`Band colour ${i + 1}`}
              />
              <input
                type="text"
                value={c}
                onChange={e => props.onColorAt(i, e.target.value)}
                spellCheck={false}
                className="flex-1 px-2 py-1 rounded border border-gray-200 text-[11px] font-mono uppercase"
              />
              <div className="w-10 h-7 rounded border border-gray-200" style={{ background: c }} />
            </div>
          ))}
        </div>

        {/* Click a card-extracted colour to drop it into the first slot. */}
        {props.cardPalette && props.cardPalette.length > 0 && (
          <div className="mt-2.5">
            <p className="text-[10px] text-gray-500 mb-1">
              Picked from this card — click to send to slot 1, shift-click for slot 2
            </p>
            <div className="flex gap-1 flex-wrap">
              {props.cardPalette.map((c, i) => (
                <button
                  key={i}
                  onClick={e => props.onColorAt(e.shiftKey ? 1 : 0, c)}
                  className="w-7 h-7 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}

        {!props.hasCardColors && (
          <p className="text-[11px] text-amber-600 mt-1.5">
            This card has no extracted colours — edit the swatches by hand or load the brand palette.
          </p>
        )}
        {props.touched && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            Hand-edited — changing card will no longer reload the palette.
          </p>
        )}
      </div>

      {/* Logo treatment */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Logo treatment <span className="normal-case font-normal text-gray-400">— bottom centre</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LOGO_TREATMENTS.map(t => (
            <button
              key={t.id}
              onClick={() => props.onLogo(t.id)}
              className={`text-left px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                props.logo === t.id
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          {LOGO_TREATMENTS.find(t => t.id === props.logo)?.note}
        </p>
      </div>

      {/* Grade chip — read-only: it is derived, not chosen */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Grade chip <span className="normal-case font-normal text-gray-400">— derived from the grade</span>
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-11 rounded-lg flex flex-col items-center justify-center font-extrabold leading-none"
            style={{ background: chip.fill, color: chip.ink }}
          >
            <span className="text-lg">{chip.grade === 0 ? 'A' : chip.grade}</span>
          </div>
          <div className="text-xs text-gray-600">
            <div className="font-semibold">{chip.label}</div>
            <div className="font-mono text-[11px] text-gray-400">{chip.fill} / ink {chip.ink}</div>
          </div>
        </div>
        <div className="flex gap-0.5 mt-2">
          {GRADE_CHIPS.map(c => (
            <div
              key={c.grade}
              className="flex-1 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold"
              style={{
                background: c.fill,
                color: c.ink,
                outline: c.grade === chip.grade ? '2px solid #111' : 'none',
                outlineOffset: 1,
              }}
              title={`${c.grade} ${c.label} ${c.fill}`}
            >
              {c.grade}
            </div>
          ))}
        </div>
      </div>

      {/* Emblems */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Back emblems <span className="normal-case font-normal text-gray-400">— rotated 90&deg; CCW</span>
        </p>
        <div className="flex gap-1.5">
          {([
            ['Founder', props.founder, props.onFounder],
            ['Card Lover', props.cardLover, props.onCardLover],
            ['VIP', props.vip, props.onVip],
          ] as const).map(([label, on, set]) => (
            <button
              key={label}
              onClick={() => set(!on)}
              className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium ${
                on ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
        Not in production. The live generators still hardcode the grade colour; this reads{' '}
        <code className="font-mono">GRADE_CHIPS</code> from labelPresets.
      </p>
    </div>
  )
}

function StyleDesignerPanel(props: {
  styleMode: 'preset' | 'card-style' | 'custom'
  onStyleMode: (m: 'preset' | 'card-style' | 'custom') => void
  presetId: string
  onPresetId: (id: string) => void
  cardStyleId: string
  onCardStyleId: (id: string) => void
  hasCardColors: boolean
  customColors: string[]
  onCustomColors: (c: string[]) => void
  layoutId: string
  onLayoutId: (id: string) => void
  angleDeg: number
  onAngleDeg: (a: number) => void
  geomPattern: number
  onGeomPattern: (p: number) => void
  borderEnabled: boolean
  onBorderEnabled: (b: boolean) => void
  borderColor: string
  onBorderColor: (c: string) => void
}) {
  const modeTab = (id: 'preset' | 'card-style' | 'custom', label: string) => (
    <button
      key={id}
      onClick={() => props.onStyleMode(id)}
      className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
        props.styleMode === id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )

  const presets = PRESET_IDS.map(id => COLOR_PRESETS.find(p => p.id === id)!).filter(Boolean)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Style designer</h3>
      <div className="flex gap-1 mb-3">
        {modeTab('preset', 'Presets')}
        {modeTab('card-style', 'Card Styles')}
        {modeTab('custom', 'Custom')}
      </div>

      {props.styleMode === 'preset' && (
        <div className="grid grid-cols-2 gap-1">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => props.onPresetId(p.id)}
              className={`px-2 py-1.5 rounded text-xs text-left transition-colors flex items-center gap-2 ${
                props.presetId === p.id ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span
                className="inline-block w-4 h-4 rounded border border-gray-300 shrink-0"
                style={{
                  background: p.isRainbow
                    ? 'linear-gradient(90deg, #ff0000, #ffff00, #00cc00, #0066ff, #ff00ff)'
                    : `linear-gradient(135deg, ${p.gradientStart}, ${p.gradientEnd})`,
                }}
              />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {props.styleMode === 'card-style' && (
        <div className="space-y-1">
          {!props.hasCardColors && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              This card has no extracted colors (card_colors is empty). Pick another card or run the color
              backfill: <code className="font-mono text-[10px]">npx tsx scripts/backfill-card-colors.ts</code>
            </p>
          )}
          {CARD_COLOR_STYLES.map(s => (
            <button
              key={s.id}
              disabled={!props.hasCardColors}
              onClick={() => props.onCardStyleId(s.id)}
              className={`w-full px-2 py-1.5 rounded text-xs text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                props.cardStyleId === s.id ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="block text-[10px] text-gray-500">{s.description}</span>
            </button>
          ))}
        </div>
      )}

      {props.styleMode === 'custom' && (
        <div className="space-y-3">
          {/* Colors */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Colors ({props.customColors.length}/5)</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {props.customColors.map((c, i) => (
                <span key={i} className="relative inline-flex">
                  <input
                    type="color"
                    value={c}
                    onChange={e => {
                      const next = [...props.customColors]
                      next[i] = e.target.value
                      props.onCustomColors(next)
                    }}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
                  />
                  {props.customColors.length > 1 && (
                    <button
                      onClick={() => props.onCustomColors(props.customColors.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[9px] leading-none hover:bg-red-100 hover:text-red-700"
                      title="Remove color"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {props.customColors.length < 5 && (
                <button
                  onClick={() => props.onCustomColors([...props.customColors, '#888888'])}
                  className="w-8 h-8 rounded border border-dashed border-gray-400 text-gray-500 text-sm hover:bg-gray-100"
                  title="Add color"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Layout */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Layout</p>
            <div className="flex gap-1 flex-wrap">
              {LAYOUT_STYLES.map(l => (
                <button
                  key={l.id}
                  onClick={() => props.onLayoutId(l.id)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    props.layoutId === l.id ? 'bg-purple-100 text-purple-900 ring-1 ring-purple-300' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {l.icon} {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Geometric pattern picker */}
          {props.layoutId === 'geometric' && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Pattern</p>
              <select
                value={props.geomPattern}
                onChange={e => props.onGeomPattern(Number(e.target.value))}
                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md"
              >
                {GEOMETRIC_PATTERNS.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Angle */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Gradient angle</span>
              <span className="text-xs text-gray-500">{props.angleDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={props.angleDeg}
              onChange={e => props.onAngleDeg(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>

          {/* Border */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={props.borderEnabled}
                onChange={e => props.onBorderEnabled(e.target.checked)}
              />
              Border
            </label>
            {props.borderEnabled && (
              <input
                type="color"
                value={props.borderColor}
                onChange={e => props.onBorderColor(e.target.value)}
                className="w-7 h-7 rounded border border-gray-300 cursor-pointer p-0"
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ============================================================================
// Style verdict panel
// ============================================================================

function StyleVerdictPanel(props: { report: BackgroundContrastReport }) {
  const { report } = props
  const tone =
    report.verdict === 'pass'
      ? { badge: 'bg-emerald-100 text-emerald-800', label: 'PASS' }
      : report.verdict === 'flip-text'
      ? { badge: 'bg-amber-100 text-amber-800', label: 'FLIP TEXT' }
      : { badge: 'bg-red-100 text-red-800', label: 'GUARD NEEDED' }
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Legibility verdict</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${tone.badge}`}>
          {tone.label}
        </span>
      </div>
      <div className="space-y-1 text-xs text-gray-700">
        <p>
          Chosen text: <span className="font-mono font-bold">{report.minChosen.toFixed(2)}:1</span> worst-case
          (print target {report.threshold}:1)
        </p>
        <p>
          Best alternative ({report.altChoice === 'light' ? 'white' : 'near-black'}):{' '}
          <span className="font-mono font-bold">{report.minAlt.toFixed(2)}:1</span>
        </p>
        {report.verdict === 'flip-text' && (
          <p className="text-amber-700">
            Production would pick the wrong text color here — switching to{' '}
            {report.altChoice === 'light' ? 'white' : 'near-black'} passes. This is the auto-text-color fix
            the gauntlet's Guard A tests.
          </p>
        )}
        {report.verdict === 'guard-needed' && (
          <p className="text-red-700">
            Mid-tone background — no single text color reaches {report.threshold}:1. Print the Style
            Gauntlet to compare the three guards (flip text / adjust background / halo) on paper.
          </p>
        )}
      </div>
    </section>
  )
}

// ============================================================================
// Vector PDF preview
// ============================================================================

function VectorPdfPreview(props: {
  blobUrl: string | null
  building: boolean
  error: string | null
  onDownload: () => void
  formatLabel: string
  description: string
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{props.formatLabel} — vector PDF</h3>
          <p className="text-xs text-gray-500 mt-1">
            {props.description}
          </p>
        </div>
        <button
          onClick={props.onDownload}
          disabled={!props.blobUrl || props.building}
          className="px-4 py-2 text-sm font-semibold rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {props.building ? 'Building…' : 'Download for print test'}
        </button>
      </div>
      {props.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
          {props.error}
        </p>
      )}
      {props.blobUrl ? (
        <iframe src={props.blobUrl} title="Lab vector PDF" className="w-full h-[640px] border border-gray-200 rounded" />
      ) : (
        <div className="h-[640px] flex items-center justify-center border border-dashed border-gray-300 rounded text-sm text-gray-500">
          {props.building ? 'Building vector PDF…' : 'Pick a card to render.'}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// Stub format panel — for formats not yet implemented
// ============================================================================

function StubFormatPanel(props: { format: typeof LAB_FORMATS[number] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <span className="inline-block text-5xl mb-3" aria-hidden>🚧</span>
      <h3 className="text-lg font-bold text-gray-900">{props.format.label}</h3>
      <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">{props.format.description}</p>
      <p className="text-xs text-gray-500 mt-4">
        Switch to <strong>Modern Slab</strong> or <strong>Traditional Slab</strong> in the format
        list to render and download. The other formats land once paper-test feedback on the slab
        comes in.
      </p>
    </section>
  )
}

// ============================================================================
// Production reference panel — links to the existing canvas file
// ============================================================================

function ProductionReferencePanel(props: { format: typeof LAB_FORMATS[number]; card: LabCard | null }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Production reference</h3>
      <p className="text-xs text-gray-600">{props.format.description}</p>
      {props.card ? (
        <p className="text-xs text-gray-500 mt-2">
          Current card: <span className="font-mono">{props.card.serial}</span>{' '}
          • Grade <span className="font-bold">{props.card.conversational_whole_grade ?? '—'}</span>
          {' '}({props.card.conversational_condition_label || 'Graded'})
        </p>
      ) : null}
    </section>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function displayLabel(c: LabCard): string {
  const ci = c.conversational_card_info || {}
  return (
    ci.player_or_character ||
    ci.card_name ||
    c.featured ||
    c.pokemon_featured ||
    c.card_name ||
    c.serial ||
    'Card'
  )
}

function cardToSlabInputs(c: LabCard): {
  primaryName: string
  contextLine: string
  featuresLine: string
  serial: string
  grade: string
  condition: string
  subgrades: { centering: number | null; corners: number | null; edges: number | null; surface: number | null }
} {
  const ci = c.conversational_card_info || {}
  const ws = c.conversational_weighted_sub_scores || {}
  const ss = c.conversational_sub_scores || {}
  const setName = ci.set_name || c.card_set || ''
  const cardNumber = ci.card_number ? `#${ci.card_number.replace(/^#/, '')}` : (c.card_number ? `#${c.card_number}` : '')
  const year = String(ci.year || (c.release_date ? c.release_date.slice(0, 4) : ''))
  const contextParts = [setName, cardNumber, year].filter(Boolean)
  // Production builds the features line from a few flags. For the lab we
  // synthesize a simple version since we don't carry the full label-data
  // resolver into the browser.
  const features: string[] = []
  if (ci.rookie_or_first === true || ci.rookie_or_first === 'true') features.push('RC')
  if (ci.autographed === true) features.push('Auto')
  if (ci.holofoil && ci.holofoil !== 'None') features.push(String(ci.holofoil))
  const sub = {
    centering: roundSub(ws.centering ?? ss.centering),
    corners: roundSub(ws.corners ?? ss.corners),
    edges: roundSub(ws.edges ?? ss.edges),
    surface: roundSub(ws.surface ?? ss.surface),
  }
  return {
    primaryName: ci.player_or_character || c.featured || c.pokemon_featured || c.card_name || 'Card',
    contextLine: contextParts.join(' • '),
    featuresLine: features.join(' • '),
    serial: c.serial,
    grade: c.conversational_whole_grade != null ? String(c.conversational_whole_grade) : '—',
    condition: c.conversational_condition_label || 'Graded',
    subgrades: sub,
  }
}

function roundSub(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!isFinite(n)) return null
  return Math.round(n * 2) / 2
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}
