'use client'

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getCardLabelData, getCardSlabProps } from '@/lib/useLabelData'
import { buildContextLine, buildFeaturesLine } from '@/lib/labelDataGenerator'
import { DIMENSION_PRESETS, COLOR_PRESETS, LABEL_TYPES, DEFAULT_CUSTOM_CONFIG } from '@/lib/labelPresets'
import type { CustomLabelConfig, DimensionPreset, ColorPreset } from '@/lib/labelPresets'
import { LabelMockup } from '@/components/labels/LabelMockup'
import { useLabelPreview } from '@/hooks/useLabelPreview'
import { downloadCustomSlabLabel } from '@/lib/customSlabLabelGenerator'
import { downloadSlabLabel } from '@/lib/slabLabelGenerator'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { generateQRCodePlain, generateQRCodeWithLogo, loadLogoAsBase64, loadWhiteLogoAsBase64 } from '@/lib/foldableLabelGenerator'
import type { FoldableLabelData } from '@/lib/foldableLabelGenerator'
import { downloadAveryLabel } from '@/lib/averyLabelGenerator'
import { generateToploaderLabelPair, generateFoldOverLabel8167 } from '@/lib/avery8167LabelGenerator'
import { downloadCardImages } from '@/lib/cardImageGenerator'
import type { CardImageData } from '@/lib/cardImageGenerator'
import { BatchSlabLabelModal } from '@/components/reports/BatchSlabLabelModal'
import { BatchAveryLabelModal } from '@/components/reports/BatchAveryLabelModal'
import { BatchAvery8167LabelModal } from '@/components/reports/BatchAvery8167LabelModal'
import { useCustomLabelStyle } from '@/hooks/useCustomLabelStyle'
import type { SavedCustomStyle } from '@/lib/labelPresets'

interface Props {
  cards: any[]
  isAuthenticated: boolean
}

// ============================================================================
// CARD SELECTOR
// ============================================================================

function CardSelector({
  cards,
  selectedId,
  onSelect,
  batchSelectedIds,
  onToggleBatch,
  onSelectAllBatch,
  onDeselectAllBatch,
  isAuthenticated,
}: {
  cards: any[]
  selectedId: string | null
  onSelect: (card: any) => void
  batchSelectedIds: Set<string>
  onToggleBatch: (cardId: string) => void
  onSelectAllBatch: () => void
  onDeselectAllBatch: () => void
  isAuthenticated: boolean
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!isAuthenticated) return cards // Show all sample cards
    if (!search.trim()) return cards.slice(0, 10)
    const q = search.toLowerCase()
    return cards.filter(
      (c) =>
        (c.card_name || '').toLowerCase().includes(q) ||
        (c.serial || '').toLowerCase().includes(q) ||
        (c.featured || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [cards, search, isAuthenticated])

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isAuthenticated ? 'Select a Card' : 'Sample Cards'}
          </h2>
          {!isAuthenticated && (
            <p className="text-xs text-gray-500">Browse sample graded cards to preview labels</p>
          )}
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {batchSelectedIds.size > 0 && (
              <span className="text-xs text-purple-600 font-medium">{batchSelectedIds.size} selected for batch</span>
            )}
            <button
              onClick={batchSelectedIds.size === cards.length ? onDeselectAllBatch : onSelectAllBatch}
              className="text-[10px] text-gray-500 hover:text-purple-600 underline"
            >
              {batchSelectedIds.size === cards.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}
      </div>

      {/* Search — authenticated users only */}
      {isAuthenticated && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
        </div>
      )}

      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {filtered.length === 0 && (
          <p className="text-gray-400 text-sm py-4">
            {cards.length === 0 ? 'No graded cards yet. Grade a card first!' : 'No cards match your search.'}
          </p>
        )}
        {filtered.map((card) => {
          const grade = card.conversational_whole_grade ?? card.dcm_grade_whole
          const isSelected = selectedId === card.id
          const isBatchSelected = batchSelectedIds.has(card.id)
          return (
            <div key={card.id} className="flex-shrink-0 w-[100px] relative">
              {/* Batch checkbox — authenticated only */}
              {isAuthenticated && (
                <label
                  className="absolute top-0.5 left-0.5 z-10 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isBatchSelected}
                    onChange={() => onToggleBatch(card.id)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </label>
              )}
              <button
                onClick={() => onSelect(card)}
                className={`w-full rounded-lg border-2 transition-all p-1.5 ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50 shadow-md'
                    : isBatchSelected
                      ? 'border-purple-300 bg-purple-50/50'
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-sm bg-white'
                }`}
              >
                {card.front_url ? (
                  <img
                    src={card.front_url}
                    alt={card.card_name || 'Card'}
                    className="w-full aspect-[2.5/3.5] object-cover rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-[2.5/3.5] bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-400 text-xs">No image</span>
                  </div>
                )}
                <div className="mt-1.5 text-center">
                  <div className="text-[10px] font-medium text-gray-700 truncate">
                    {card.featured || card.card_name || 'Card'}
                  </div>
                  {grade != null && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                      {Math.round(grade)}
                    </span>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ============================================================================
// CUSTOM LABEL TILE (shown in gallery grid)
// ============================================================================

function CustomLabelTile({
  selectedCard,
  slabData,
  customConfig,
  customPreviewData,
}: {
  selectedCard: any | null
  slabData: SlabLabelData | null
  customConfig: CustomLabelConfig
  customPreviewData: SlabLabelData | null
}) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardImage = side === 'front' ? selectedCard?.front_url : selectedCard?.back_url

  // Use the shared config with the current side toggle
  const tileConfig = useMemo<CustomLabelConfig>(() => ({
    ...customConfig,
    side,
  }), [customConfig, side])

  // Use customPreviewData if it matches the current card (same serial),
  // otherwise fall back to slabData directly to avoid stale data
  const tileData = useMemo(() => {
    if (customPreviewData && slabData && customPreviewData.serial === slabData.serial) {
      return customPreviewData
    }
    return slabData
  }, [customPreviewData, slabData])

  // Clear canvas when card changes to prevent showing stale label
  const prevSerialRef = useRef<string | null>(null)
  useEffect(() => {
    const currentSerial = slabData?.serial || null
    if (prevSerialRef.current !== null && prevSerialRef.current !== currentSerial) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    prevSerialRef.current = currentSerial
  }, [slabData?.serial])

  const { isRendering } = useLabelPreview({
    config: tileConfig,
    data: tileData,
    canvasRef,
  })

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col">
      {/* Headline */}
      <div className="mb-2 text-center">
        <h3 className="font-bold text-sm text-gray-900">Custom Label</h3>
        <p className="text-[10px] text-purple-600 font-medium tracking-wide uppercase">Graded Card Slab</p>
      </div>

      {/* Slab mockup — same layout as GradedSlabMockup */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-full max-w-[200px] relative mx-auto" style={{ aspectRatio: '280 / 460' }}>
          {/* Slab case photo background */}
          <img
            src="/labels/graded-card-slab.png"
            alt="Graded Card Slab"
            className="absolute inset-0 w-full h-full object-contain"
          />

          {/* Custom label canvas in the label slot */}
          <div className="absolute overflow-hidden" style={{ top: '4.5%', left: '13.5%', width: '73%' }}>
            {isRendering && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ display: slabData ? 'block' : 'none' }}
            />
            {!slabData && (
              <div className="w-full bg-gray-200 rounded" style={{ aspectRatio: '3.5 / 1' }} />
            )}
          </div>

          {/* Card image in the lower window */}
          <div className="absolute overflow-hidden" style={{ top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }}>
            {cardImage ? (
              <img src={cardImage} alt={selectedCard?.card_name || 'Card'}
                className="w-full h-full object-contain" loading="lazy" />
            ) : (
              <div className="w-full h-full" />
            )}
          </div>

          {/* Gloss overlay */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.03) 100%)' }} />
        </div>

        {/* Front/Back toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setSide('front')}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              side === 'front' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setSide('back')}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              side === 'back' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 flex-1 flex flex-col">
        <p className="text-xs text-gray-500">Any size — Design your own</p>
        <p className="text-xs text-gray-400 mt-1 flex-1">Custom dimensions, colors, borders, and editable text.</p>

        <button
          onClick={() => document.getElementById('custom-designer')?.scrollIntoView({ behavior: 'smooth' })}
          className="mt-2 w-full text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
        >
          Design Custom Label
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// LABEL GALLERY
// ============================================================================

function LabelGallery({
  selectedCard,
  slabData,
  customConfig,
  customPreviewData,
  showFounderEmblem,
  showVipEmblem,
  showCardLoversEmblem,
}: {
  selectedCard: any | null
  slabData: SlabLabelData | null
  customConfig: CustomLabelConfig
  customPreviewData: SlabLabelData | null
  showFounderEmblem: boolean
  showVipEmblem: boolean
  showCardLoversEmblem: boolean
}) {
  const [expandedTip, setExpandedTip] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const labelProps = useMemo(() => {
    if (!selectedCard) return null
    return getCardSlabProps(selectedCard)
  }, [selectedCard])

  const backLabelProps = useMemo(() => {
    if (!selectedCard || !slabData) return undefined
    const grade = selectedCard.conversational_whole_grade ?? selectedCard.dcm_grade_whole ?? null
    const subScores = selectedCard.conversational_weighted_sub_scores || selectedCard.conversational_sub_scores
    return {
      serial: selectedCard.serial || '',
      grade,
      condition: selectedCard.conversational_condition_label || '',
      qrCodeUrl: `https://dcmgrading.com/verify/${selectedCard.serial}`,
      subScores: subScores ? {
        centering: subScores.centering ?? 0,
        corners: subScores.corners ?? 0,
        edges: subScores.edges ?? 0,
        surface: subScores.surface ?? 0,
      } : undefined,
      isAlteredAuthentic: false,
      showFounderEmblem,
      showVipEmblem,
      showCardLoversEmblem,
    }
  }, [selectedCard, slabData, showFounderEmblem, showVipEmblem, showCardLoversEmblem])

  const handleQuickDownload = async (labelType: typeof LABEL_TYPES[0]) => {
    if (!slabData || !selectedCard) return
    setDownloading(labelType.id)
    try {
      const labelData = getCardLabelData(selectedCard)
      const style = labelType.style || 'modern'

      if (labelType.downloadType === 'slab') {
        await downloadSlabLabel(slabData, style)

      } else if (labelType.downloadType === 'avery') {
        // One-Touch (Avery 6871) — needs FoldableLabelData
        const weightedScores = selectedCard.conversational_weighted_sub_scores || {}
        const subScoresRaw = selectedCard.conversational_sub_scores || {}
        const qrCodeDataUrl = await generateQRCodeWithLogo(
          `https://dcmgrading.com/verify/${selectedCard.serial}`
        ).catch(() => '')
        const logoDataUrl = await loadLogoAsBase64().catch(() => '')
        const foldableData: FoldableLabelData = {
          cardName: labelData.primaryName,
          setName: labelData.setName || '',
          cardNumber: labelData.cardNumber || undefined,
          year: labelData.year || undefined,
          specialFeatures: labelData.featuresLine || undefined,
          serial: labelData.serial,
          englishName: selectedCard.featured || selectedCard.pokemon_featured || undefined,
          grade: labelData.grade ?? 0,
          conditionLabel: labelData.condition,
          subgrades: {
            centering: weightedScores.centering ?? subScoresRaw.centering?.weighted ?? 0,
            corners: weightedScores.corners ?? subScoresRaw.corners?.weighted ?? 0,
            edges: weightedScores.edges ?? subScoresRaw.edges?.weighted ?? 0,
            surface: weightedScores.surface ?? subScoresRaw.surface?.weighted ?? 0,
          },
          overallSummary: selectedCard.conversational_final_grade_summary || '',
          qrCodeDataUrl,
          cardUrl: `https://dcmgrading.com/verify/${selectedCard.serial}`,
          logoDataUrl,
        }
        const sanitize = (t: string) => t.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
        await downloadAveryLabel(foldableData, 0, `DCM-OneTouch-${sanitize(labelData.primaryName)}.pdf`)

      } else if (labelType.downloadType === 'avery8167' || labelType.downloadType === 'foldover') {
        // Toploader (Avery 8167) — needs ToploaderLabelData
        const grade = selectedCard.conversational_whole_grade ?? selectedCard.dcm_grade_whole ?? 0
        const toploaderData = {
          grade,
          conditionLabel: selectedCard.conversational_condition_label || labelData.condition,
          qrCodeUrl: `https://dcmgrading.com/verify/${selectedCard.serial}`,
          cardName: labelData.primaryName,
        }
        let blob: Blob
        if (labelType.downloadType === 'foldover') {
          blob = await generateFoldOverLabel8167(toploaderData, 0)
        } else {
          blob = await generateToploaderLabelPair(toploaderData, 0, 1)
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const sanitize = (t: string) => t.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
        a.download = `DCM-Toploader-${sanitize(labelData.primaryName)}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

      } else if (labelType.downloadType === 'card-images') {
        // Card images — needs CardImageData
        const weightedScores = selectedCard.conversational_weighted_sub_scores || {}
        const subScoresRaw = selectedCard.conversational_sub_scores || {}
        const cardImageData: CardImageData = {
          cardName: labelData.primaryName,
          contextLine: labelData.contextLine,
          specialFeatures: labelData.featuresLine || undefined,
          serial: labelData.serial,
          englishName: selectedCard.featured || selectedCard.pokemon_featured || undefined,
          grade: labelData.grade ?? 0,
          conditionLabel: labelData.condition,
          cardUrl: `https://dcmgrading.com/verify/${selectedCard.serial}`,
          frontImageUrl: selectedCard.front_url || '',
          backImageUrl: selectedCard.back_url || '',
          labelStyle: style as 'modern' | 'traditional',
          subScores: {
            centering: weightedScores.centering ?? subScoresRaw.centering?.weighted ?? 0,
            corners: weightedScores.corners ?? subScoresRaw.corners?.weighted ?? 0,
            edges: weightedScores.edges ?? subScoresRaw.edges?.weighted ?? 0,
            surface: weightedScores.surface ?? subScoresRaw.surface?.weighted ?? 0,
          },
          showFounderEmblem,
          showVipEmblem,
          showCardLoversEmblem,
        }
        const sanitize = (t: string) => t.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
        await downloadCardImages(cardImageData, `DCM-Card-${sanitize(labelData.primaryName)}`)
      }
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Label Gallery</h2>
        <span className="text-xs text-gray-400">{LABEL_TYPES.length} label types</span>
      </div>

      {!selectedCard && (
        <p className="text-gray-400 text-sm py-8 text-center">
          Select a card above to preview labels
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {LABEL_TYPES.map((lt) => {
          const holderName = lt.category === 'slab' ? 'Graded Card Slab'
            : lt.category === 'onetouch' ? 'Mag One Touch'
            : lt.category === 'toploader' ? 'Top Loader'
            : 'Digital'
          return (
          <div
            key={lt.id}
            className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow flex flex-col"
          >
            {/* Headline */}
            <div className="mb-2 text-center">
              <h3 className="font-bold text-sm text-gray-900">{lt.name}</h3>
              <p className="text-[10px] text-purple-600 font-medium tracking-wide uppercase">{holderName}</p>
            </div>

            {/* Mockup preview */}
            {selectedCard && labelProps && (
              <LabelMockup
                card={selectedCard}
                labelType={lt}
                labelProps={labelProps}
                backLabelProps={backLabelProps}
              />
            )}

            {/* Info */}
            <div className="mt-3 flex-1 flex flex-col">
              <p className="text-xs text-gray-500">{lt.dimensions} — {lt.useCase}</p>
              <p className="text-xs text-gray-400 mt-1 flex-1">{lt.description}</p>

              {/* How to apply tip */}
              <button
                onClick={() => setExpandedTip(expandedTip === lt.id ? null : lt.id)}
                className="text-xs text-purple-600 hover:text-purple-800 mt-2 text-left font-medium"
              >
                {expandedTip === lt.id ? 'Hide tip' : 'How to apply'}
              </button>
              {expandedTip === lt.id && (
                <p className="text-xs text-gray-500 mt-1 bg-purple-50 rounded p-2">
                  {lt.howToApply}
                </p>
              )}

              {/* Quick download */}
              {selectedCard && (
                <button
                  onClick={() => handleQuickDownload(lt)}
                  disabled={downloading === lt.id}
                  className="mt-2 w-full text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {downloading === lt.id ? 'Generating...' : (
                    lt.downloadType === 'card-images' ? 'Download Images' : 'Download PDF'
                  )}
                </button>
              )}
            </div>
          </div>
          )
        })}

        {/* Custom Label Preview tile */}
        <CustomLabelTile selectedCard={selectedCard} slabData={slabData} customConfig={customConfig} customPreviewData={customPreviewData} />
      </div>
    </section>
  )
}

// ============================================================================
// CUSTOM DESIGNER
// ============================================================================

function CustomDesigner({
  selectedCard,
  slabData,
  config,
  setConfig,
  onPreviewDataChange,
}: {
  selectedCard: any | null
  slabData: SlabLabelData | null
  config: CustomLabelConfig
  setConfig: React.Dispatch<React.SetStateAction<CustomLabelConfig>>
  onPreviewDataChange: (data: SlabLabelData | null) => void
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null)

  // Label text fields — initialized from slabData, editable directly
  interface LabelFields {
    primaryName: string
    setName: string
    subset: string
    cardNumber: string
    year: string
    features: string
  }
  const [labelFields, setLabelFields] = useState<LabelFields>({
    primaryName: '', setName: '', subset: '', cardNumber: '', year: '', features: '',
  })
  const [fieldsInitialized, setFieldsInitialized] = useState<string | null>(null)

  // Reset fieldsInitialized and clear canvas when card changes
  const prevCardIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (selectedCard?.id !== prevCardIdRef.current) {
      prevCardIdRef.current = selectedCard?.id || null
      setFieldsInitialized(null)
      setMobilePreviewUrl(null)
      // Clear canvas so old card label doesn't linger
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [selectedCard])

  // Populate fields from slabData when card changes
  useEffect(() => {
    if (!slabData || !selectedCard) return
    if (fieldsInitialized === selectedCard.id) return
    const parts = slabData.contextLine.split(' \u2022 ')
    setLabelFields({
      primaryName: slabData.primaryName || '',
      setName: parts[0] || '',
      subset: parts[1] || '',
      cardNumber: parts[2] || '',
      year: parts[3] || '',
      features: slabData.features?.join(', ') || '',
    })
    setFieldsInitialized(selectedCard.id)
  }, [slabData, selectedCard, fieldsInitialized])

  // Build previewData from current field values
  // Only merge label fields when they've been initialized for the current card
  const previewData = useMemo(() => {
    if (!slabData) return null
    // If fields haven't been initialized for this card yet, use slabData as-is
    if (fieldsInitialized !== selectedCard?.id) return slabData
    const featuresList = labelFields.features
      ? labelFields.features.split(',').map((f) => f.trim()).filter(Boolean)
      : []
    return {
      ...slabData,
      primaryName: labelFields.primaryName,
      contextLine: buildContextLine(
        labelFields.setName, labelFields.subset,
        labelFields.cardNumber, labelFields.year
      ),
      features: featuresList,
      featuresLine: buildFeaturesLine(featuresList),
    }
  }, [slabData, labelFields, fieldsInitialized, selectedCard])

  // Report previewData to parent so gallery tile stays in sync
  useEffect(() => {
    onPreviewDataChange(previewData)
  }, [previewData, onPreviewDataChange])

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('labelStudio_customConfig', JSON.stringify(config))
    } catch { /* ignore */ }
  }, [config])

  const { isRendering } = useLabelPreview({
    config,
    data: previewData,
    canvasRef,
  })

  // Capture canvas to data URL for mobile preview mirrors
  useEffect(() => {
    if (isRendering) return
    const canvas = canvasRef.current
    if (!canvas || !canvas.width || !canvas.height) return
    try {
      setMobilePreviewUrl(canvas.toDataURL('image/png'))
    } catch { /* ignore tainted canvas */ }
  }, [isRendering])

  const updateConfig = useCallback((partial: Partial<CustomLabelConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [setConfig])

  const handleDimensionPreset = (preset: DimensionPreset) => {
    const base: Partial<CustomLabelConfig> = {
      preset: preset.id,
      width: preset.width,
      height: preset.height,
    }
    if (preset.id === 'dcm') {
      // DCM Modern: dark gradient, no border
      Object.assign(base, {
        colorPreset: 'modern-dark',
        gradientStart: '#1a1625',
        gradientEnd: '#2d1f47',
        style: 'modern' as const,
        borderEnabled: false,
      })
    } else if (preset.id === 'dcm-traditional') {
      // DCM Traditional: light, no border
      Object.assign(base, {
        colorPreset: 'traditional',
        gradientStart: '#f9fafb',
        gradientEnd: '#ffffff',
        style: 'traditional' as const,
        borderEnabled: false,
      })
    } else if (preset.id === 'dcm-bordered') {
      // DCM Bordered: traditional + purple border
      Object.assign(base, {
        colorPreset: 'traditional',
        gradientStart: '#f9fafb',
        gradientEnd: '#ffffff',
        style: 'traditional' as const,
        borderEnabled: true,
        borderColor: '#7c3aed',
        borderWidth: 0.04,
      })
    }
    updateConfig(base)
  }

  const handleColorPreset = (color: ColorPreset) => {
    updateConfig({
      colorPreset: color.id,
      gradientStart: color.gradientStart,
      gradientEnd: color.gradientEnd,
      // Switch style based on color
      style: color.id === 'traditional' ? 'traditional' : 'modern',
    })
  }

  const handleDownload = async () => {
    if (!previewData) return
    setIsDownloading(true)
    try {
      await downloadCustomSlabLabel(previewData, config)
    } catch (err) {
      console.error('Custom label download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSaveToCard = async () => {
    if (!selectedCard) return
    setIsSaving(true)
    try {
      const customFields: Record<string, any> = {
        primaryName: labelFields.primaryName || null,
        setName: labelFields.setName || null,
        subset: labelFields.subset || null,
        cardNumber: labelFields.cardNumber || null,
        year: labelFields.year || null,
        features: labelFields.features
          ? labelFields.features.split(',').map((f: string) => f.trim()).filter(Boolean)
          : [],
      }

      const session = (await import('@/lib/directAuth')).getStoredSession()
      const res = await fetch(`/api/cards/${selectedCard.id}/custom-label`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ customFields }),
      })
      if (!res.ok) throw new Error('Save failed')
    } catch (err) {
      console.error('Save label edits failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const currentDimPreset = DIMENSION_PRESETS.find((p) => p.id === config.preset)

  return (
    <section id="custom-designer" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Custom Label Designer</h2>

      {!selectedCard && (
        <p className="text-gray-400 text-sm py-8 text-center">
          Select a card above to start designing
        </p>
      )}

      {selectedCard && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Mobile top preview */}
          {mobilePreviewUrl && (
            <div className="lg:hidden flex flex-col items-center">
              <div className="relative bg-gray-100 rounded-lg p-3 w-full flex items-center justify-center">
                {isRendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg z-10">
                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <img src={mobilePreviewUrl} alt="Label preview" className="max-w-full h-auto shadow-lg rounded" />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {config.width}" × {config.height}"
                {currentDimPreset && config.preset !== 'custom' && ` — ${currentDimPreset.name}`}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="lg:w-[340px] flex-shrink-0 space-y-5">
            {/* Dimension Presets */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Dimensions</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {DIMENSION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleDimensionPreset(p)}
                    className={`text-xs px-2 py-1.5 rounded border transition-colors text-left ${
                      config.preset === p.id
                        ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}
                  >
                    {p.name}
                    {p.id !== 'custom' ? (
                      <span className="block text-[10px] text-gray-400">{p.width}" × {p.height}"</span>
                    ) : (
                      <span className="block text-[10px] text-gray-400">Adjust height &amp; width</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom dimensions */}
              {config.preset === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Width (in)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="4.0"
                      step="0.1"
                      value={config.width}
                      onChange={(e) => updateConfig({ width: parseFloat(e.target.value) || 2.8 })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Height (in)</label>
                    <input
                      type="number"
                      min="0.3"
                      max="4.0"
                      step="0.1"
                      value={config.height}
                      onChange={(e) => updateConfig({ height: parseFloat(e.target.value) || 0.8 })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Color Theme */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Color Theme</h3>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleColorPreset(c)}
                    className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                      config.colorPreset === c.id
                        ? 'border-purple-600 ring-2 ring-purple-300'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    title={c.name}
                  >
                    <div
                      className="w-full aspect-square"
                      style={
                        c.isRainbow
                          ? { background: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00cc00, #0066ff, #8800ff)' }
                          : { background: `linear-gradient(135deg, ${c.gradientStart}, ${c.gradientEnd})` }
                      }
                    />
                    <div className="text-[9px] text-gray-600 text-center py-0.5 bg-white truncate px-0.5">
                      {c.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom color pickers */}
              {config.colorPreset === 'custom' && (
                <div className="flex gap-3 mt-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Start</label>
                    <input
                      type="color"
                      value={config.gradientStart}
                      onChange={(e) => updateConfig({ gradientStart: e.target.value })}
                      className="w-full h-7 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">End</label>
                    <input
                      type="color"
                      value={config.gradientEnd}
                      onChange={(e) => updateConfig({ gradientEnd: e.target.value })}
                      className="w-full h-7 rounded border border-gray-300 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Style Toggle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Style</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => updateConfig({ style: 'modern' })}
                  className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                    config.style === 'modern'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  Modern
                </button>
                <button
                  onClick={() => updateConfig({ style: 'traditional' })}
                  className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                    config.style === 'traditional'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  Traditional
                </button>
              </div>
            </div>

            {/* Border Controls — shown for Custom and DCM Bordered presets */}
            {(config.preset === 'custom' || config.preset === 'dcm-bordered') && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Border</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.borderEnabled ?? false}
                      onChange={(e) => updateConfig({ borderEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs text-gray-600">Enable border</span>
                  </label>
                  {config.borderEnabled && (
                    <div className="flex gap-3 items-end">
                      <div>
                        <label className="text-[10px] text-gray-500">Color</label>
                        <div className="flex gap-1 items-center">
                          <input
                            type="color"
                            value={config.borderColor}
                            onChange={(e) => updateConfig({ borderColor: e.target.value })}
                            className="w-10 h-7 rounded border border-gray-300 cursor-pointer"
                          />
                          {config.borderColor !== '#7c3aed' && (
                            <button
                              onClick={() => updateConfig({ borderColor: '#7c3aed' })}
                              className="text-[9px] text-purple-600 hover:text-purple-800 whitespace-nowrap underline"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Width (in)</label>
                        <input
                          type="number"
                          min="0.01"
                          max="0.15"
                          step="0.01"
                          value={config.borderWidth}
                          onChange={(e) => updateConfig({ borderWidth: parseFloat(e.target.value) || 0.04 })}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Front / Back toggle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview Side</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => updateConfig({ side: 'front' })}
                  className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                    config.side === 'front'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  Front
                </button>
                <button
                  onClick={() => updateConfig({ side: 'back' })}
                  className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                    config.side === 'back'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {/* Label Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Label Details</h3>
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] text-gray-500">Card Name</label>
                  <input
                    type="text"
                    value={labelFields.primaryName}
                    onChange={(e) => setLabelFields((prev) => ({ ...prev, primaryName: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-gray-500">Set</label>
                    <input
                      type="text"
                      value={labelFields.setName}
                      onChange={(e) => setLabelFields((prev) => ({ ...prev, setName: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Subset</label>
                    <input
                      type="text"
                      value={labelFields.subset}
                      onChange={(e) => setLabelFields((prev) => ({ ...prev, subset: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-gray-500">Card Number</label>
                    <input
                      type="text"
                      value={labelFields.cardNumber}
                      onChange={(e) => setLabelFields((prev) => ({ ...prev, cardNumber: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Year</label>
                    <input
                      type="text"
                      value={labelFields.year}
                      onChange={(e) => setLabelFields((prev) => ({ ...prev, year: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Features (comma-separated)</label>
                  <input
                    type="text"
                    value={labelFields.features}
                    onChange={(e) => setLabelFields((prev) => ({ ...prev, features: e.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                </div>
                <button
                  onClick={handleSaveToCard}
                  disabled={isSaving}
                  className="w-full text-[10px] py-1 text-purple-600 hover:text-purple-800 border border-purple-300 rounded font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save to Card'}
                </button>
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || !previewData}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow"
            >
              {isDownloading ? 'Generating PDF...' : 'Download Custom Label (PDF)'}
            </button>

            {/* Mobile bottom preview */}
            {mobilePreviewUrl && (
              <div className="lg:hidden flex flex-col items-center mt-2">
                <div className="relative bg-gray-100 rounded-lg p-3 w-full flex items-center justify-center">
                  {isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg z-10">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <img src={mobilePreviewUrl} alt="Label preview" className="max-w-full h-auto shadow-lg rounded" />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {config.width}" × {config.height}"
                  {currentDimPreset && config.preset !== 'custom' && ` — ${currentDimPreset.name}`}
                </p>
              </div>
            )}
          </div>

          {/* Desktop Preview (canvas) — visually hidden on mobile, img mirrors shown instead */}
          <div className="flex-1 flex-col items-center hidden lg:flex">
            <div className="relative bg-gray-100 rounded-lg p-4 w-full flex items-center justify-center min-h-[200px]">
              {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg z-10">
                  <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto shadow-lg rounded"
                style={{ imageRendering: 'auto' }}
              />
            </div>

            {/* Dimension annotation */}
            <p className="text-xs text-gray-500 mt-2 text-center">
              {config.width}" × {config.height}"
              {currentDimPreset && config.preset !== 'custom' && ` — ${currentDimPreset.name}`}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

// ============================================================================
// SAVED STYLES MANAGER
// ============================================================================

function SavedStylesManager({
  customConfig,
  setConfig,
  customStyles,
  onSave,
  onDelete,
  onRename,
  onApplyToAll,
}: {
  customConfig: CustomLabelConfig
  setConfig: React.Dispatch<React.SetStateAction<CustomLabelConfig>>
  customStyles: SavedCustomStyle[]
  onSave: (style: { id?: string; name: string; config: CustomLabelConfig }) => Promise<SavedCustomStyle | null>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onApplyToAll: (id: string) => Promise<void>
}) {
  const [saveName, setSaveName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSaveNew = async () => {
    if (customStyles.length >= 4) {
      alert('Maximum 4 custom styles. Delete one first.')
      return
    }
    setIsSaving(true)
    const name = saveName.trim() || `Custom Label ${customStyles.length + 1}`
    await onSave({ name, config: customConfig })
    setSaveName('')
    setIsSaving(false)
  }

  const handleUpdate = async (style: SavedCustomStyle) => {
    setIsSaving(true)
    await onSave({ id: style.id, name: style.name, config: customConfig })
    setIsSaving(false)
  }

  const handleRename = async (id: string) => {
    if (editingName.trim()) {
      await onRename(id, editingName.trim())
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setConfirmDeleteId(null)
  }

  const handleLoadIntoDesigner = (style: SavedCustomStyle) => {
    setConfig(style.config)
    // Also persist to localStorage so it survives page refresh
    try {
      localStorage.setItem('labelStudio_customConfig', JSON.stringify(style.config))
    } catch { /* ignore */ }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <h2 className="text-lg font-bold text-gray-900">Saved Custom Styles</h2>
        <span className="text-xs text-gray-400">{customStyles.length}/4 slots used</span>
      </div>

      {/* Save current design as new custom style */}
      {customStyles.length < 4 && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={`Custom Label ${customStyles.length + 1}`}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
          <button
            onClick={handleSaveNew}
            disabled={isSaving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Current Design'}
          </button>
        </div>
      )}

      {customStyles.length === 4 && (
        <p className="text-xs text-amber-600 mb-4">All 4 custom style slots are used. Delete one to save a new design.</p>
      )}

      {/* List of saved styles */}
      {customStyles.length === 0 ? (
        <p className="text-sm text-gray-400">No saved custom styles yet. Design a label above and save it here.</p>
      ) : (
        <div className="space-y-3">
          {customStyles.map((style) => (
            <div
              key={style.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-200 transition-colors"
            >
              {/* Color swatch preview */}
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0"
                style={{
                  background: style.config.colorPreset === 'rainbow'
                    ? 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00cc00, #0066ff, #8800ff, #ff00ff)'
                    : `linear-gradient(135deg, ${style.config.gradientStart}, ${style.config.gradientEnd})`,
                  border: style.config.borderEnabled ? `2px solid ${style.config.borderColor}` : '1px solid rgba(0,0,0,0.1)',
                }}
              />

              {/* Name (editable) */}
              <div className="flex-1 min-w-0">
                {editingId === style.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(style.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(style.id) }}
                    autoFocus
                    className="w-full px-2 py-1 text-sm border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingId(style.id); setEditingName(style.name) }}
                    className="text-sm font-medium text-gray-900 hover:text-purple-600 truncate block text-left"
                    title="Click to rename"
                  >
                    {style.name}
                  </button>
                )}
                <p className="text-xs text-gray-400">{style.id} &middot; {style.config.style} style</p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => handleLoadIntoDesigner(style)}
                  className="px-2 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
                  title="Load into designer for editing"
                >
                  Load
                </button>
                <button
                  onClick={async () => {
                    await onApplyToAll(style.id)
                  }}
                  className="px-2 py-1 text-xs text-green-600 border border-green-300 rounded hover:bg-green-50 transition-colors"
                  title="Apply this style to all labels across the site"
                >
                  Apply to All
                </button>
                <button
                  onClick={() => handleUpdate(style)}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                  title="Update with current designer settings"
                >
                  Update
                </button>
                {confirmDeleteId === style.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(style.id)}
                      className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(style.id)}
                    className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                    title="Delete this saved style"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LabelStudioClient({ cards, isAuthenticated }: Props) {
  const searchParams = useSearchParams()
  const preselectedSerial = searchParams.get('card')

  const [selectedCard, setSelectedCardRaw] = useState<any | null>(() => {
    if (preselectedSerial) {
      return cards.find((c) => c.serial === preselectedSerial) || cards[0] || null
    }
    return cards[0] || null
  })

  const [slabData, setSlabData] = useState<SlabLabelData | null>(null)

  // Emblem/badge state
  const [isFounder, setIsFounder] = useState(false)
  const [isVip, setIsVip] = useState(false)
  const [isCardLover, setIsCardLover] = useState(false)
  const [showFounderEmblem, setShowFounderEmblem] = useState(false)
  const [showVipEmblem, setShowVipEmblem] = useState(false)
  const [showCardLoversEmblem, setShowCardLoversEmblem] = useState(false)
  const [emblemsLoaded, setEmblemsLoaded] = useState(false)

  // Fetch emblem status for authenticated users
  useEffect(() => {
    if (!isAuthenticated) return
    import('@/lib/directAuth').then(({ getStoredSession }) => {
      const sess = getStoredSession()
      if (!sess?.access_token) return
      Promise.all([
        fetch('/api/founders/status', {
          headers: { 'Authorization': `Bearer ${sess.access_token}` }
        }).then(res => res.ok ? res.json() : null),
        fetch('/api/user/label-emblem-preference', {
          headers: { 'Authorization': `Bearer ${sess.access_token}` }
        }).then(res => res.ok ? res.json() : null),
      ]).then(([statusData, emblemData]) => {
        if (statusData?.isFounder) setIsFounder(true)
        if (statusData?.isVip) setIsVip(true)
        if (statusData?.isCardLover) setIsCardLover(true)
        if (emblemData) {
          if (emblemData.isFounder) setIsFounder(true)
          if (emblemData.isVip) setIsVip(true)
          if (emblemData.isCardLover) setIsCardLover(true)
          // Set initial toggle state from preferences
          const emblems: string[] = emblemData.selectedEmblems || []
          if (emblems.length === 0) {
            // No preference = show all owned badges by default
            setShowFounderEmblem(statusData?.isFounder || emblemData.isFounder || false)
            setShowVipEmblem(statusData?.isVip || emblemData.isVip || false)
            setShowCardLoversEmblem(statusData?.isCardLover || emblemData.isCardLover || false)
          } else {
            setShowFounderEmblem(emblems.includes('founder') && (statusData?.isFounder || emblemData.isFounder))
            setShowVipEmblem(emblems.includes('vip') && (statusData?.isVip || emblemData.isVip))
            setShowCardLoversEmblem(emblems.includes('card_lover') && (statusData?.isCardLover || emblemData.isCardLover))
          }
        }
        setEmblemsLoaded(true)
      }).catch(() => setEmblemsLoaded(true))
    })
  }, [isAuthenticated])

  // Custom label config — shared between gallery tile and designer
  const [customConfig, setCustomConfig] = useState<CustomLabelConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('labelStudio_customConfig')
        if (saved) return { ...DEFAULT_CUSTOM_CONFIG, ...JSON.parse(saved) }
      } catch { /* use default */ }
    }
    return { ...DEFAULT_CUSTOM_CONFIG }
  })

  // Custom label preview data (with text overrides from designer)
  const [customPreviewData, setCustomPreviewData] = useState<SlabLabelData | null>(null)

  // Custom label styles hook (save/load/manage from DB)
  const { customStyles, saveCustomStyle, deleteCustomStyle, renameCustomStyle, switchStyle } = useCustomLabelStyle()

  // Wrap setSelectedCard to clear stale data SYNCHRONOUSLY in the same batch.
  // This is critical — if we clear in a useEffect, children render one cycle
  // with the new selectedCard but OLD slabData, causing stale label previews.
  const setSelectedCard = useCallback((card: any) => {
    setSelectedCardRaw(card)
    setSlabData(null)
    setCustomPreviewData(null)
  }, [])

  // Batch selection state
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchSlabModalOpen, setIsBatchSlabModalOpen] = useState(false)
  const [isBatchAveryModalOpen, setIsBatchAveryModalOpen] = useState(false)
  const [isBatchAvery8167ModalOpen, setIsBatchAvery8167ModalOpen] = useState(false)

  const toggleCardSelection = useCallback((cardId: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }, [])

  const selectAllDisplayed = useCallback(() => {
    setBatchSelectedIds(new Set(cards.map((c) => c.id)))
  }, [cards])

  const deselectAll = useCallback(() => {
    setBatchSelectedIds(new Set())
  }, [])

  const batchSelectedCards = useMemo(
    () => cards.filter((c) => batchSelectedIds.has(c.id)),
    [cards, batchSelectedIds]
  )

  // Generate SlabLabelData whenever selectedCard changes
  // Note: slabData/customPreviewData are already cleared synchronously in setSelectedCard
  useEffect(() => {
    if (!selectedCard) {
      return
    }

    let cancelled = false

    async function buildSlabData() {
      const labelData = getCardLabelData(selectedCard)
      const verifyUrl = `https://dcmgrading.com/verify/${selectedCard.serial}`

      // Load QR code and logos in parallel
      const [qrCodeDataUrl, logoDataUrl, whiteLogoDataUrl] = await Promise.all([
        generateQRCodePlain(verifyUrl).catch(() => ''),
        loadLogoAsBase64().catch(() => ''),
        loadWhiteLogoAsBase64().catch(() => ''),
      ])

      if (cancelled) return

      const subScores = selectedCard.conversational_weighted_sub_scores || selectedCard.conversational_sub_scores

      const data: SlabLabelData = {
        primaryName: labelData.primaryName,
        contextLine: labelData.contextLine,
        features: labelData.features,
        featuresLine: labelData.featuresLine,
        serial: labelData.serial,
        grade: labelData.grade,
        gradeFormatted: labelData.gradeFormatted,
        condition: labelData.condition,
        isAlteredAuthentic: labelData.isAlteredAuthentic,
        englishName: (labelData as any).englishName,
        qrCodeDataUrl,
        subScores: subScores ? {
          centering: subScores.centering ?? 0,
          corners: subScores.corners ?? 0,
          edges: subScores.edges ?? 0,
          surface: subScores.surface ?? 0,
        } : undefined,
        showFounderEmblem,
        showVipEmblem,
        showCardLoversEmblem,
        logoDataUrl,
        whiteLogoDataUrl,
      }

      setSlabData(data)
    }

    buildSlabData()
    return () => { cancelled = true }
  }, [selectedCard, showFounderEmblem, showVipEmblem, showCardLoversEmblem])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Label Studio</h1>
              <p className="text-sm text-gray-500">Design, preview, and download labels for any case</p>
            </div>
            {isAuthenticated && (
              <Link
                href="/collection"
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Back to Collection
              </Link>
            )}
          </div>

          {/* Guest banner */}
          {!isAuthenticated && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-purple-900">Previewing with sample cards</p>
                <p className="text-xs text-purple-600">Sign in or grade your own cards to generate custom labels</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/login?redirect=/labels"
                  className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/register?redirect=/labels"
                  className="text-xs px-3 py-1.5 bg-white text-purple-600 border border-purple-300 rounded hover:bg-purple-50 transition-colors font-medium"
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}

          {/* Authenticated but no cards */}
          {isAuthenticated && cards.length === 0 && (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-purple-900">No graded cards yet</p>
                <p className="text-xs text-purple-600">Grade your first card to start creating labels</p>
              </div>
              <Link
                href="/"
                className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
              >
                Grade a Card Now
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Section 1: Card Selector */}
        <CardSelector
          cards={cards}
          selectedId={selectedCard?.id || null}
          onSelect={setSelectedCard}
          batchSelectedIds={batchSelectedIds}
          onToggleBatch={toggleCardSelection}
          onSelectAllBatch={selectAllDisplayed}
          onDeselectAllBatch={deselectAll}
          isAuthenticated={isAuthenticated}
        />

        {/* Batch Download Bar — only for authenticated users */}
        {isAuthenticated && batchSelectedIds.size > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-purple-900">
                {batchSelectedIds.size} card{batchSelectedIds.size !== 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-purple-600">Download labels for all selected cards at once</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsBatchSlabModalOpen(true)}
                className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
              >
                Slab Labels
              </button>
              <button
                onClick={() => setIsBatchAveryModalOpen(true)}
                className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
              >
                One-Touch (Avery 6871)
              </button>
              <button
                onClick={() => setIsBatchAvery8167ModalOpen(true)}
                className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors font-medium"
              >
                Toploader (Avery 8167)
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Emblem Badge Toggles — only for authenticated users */}
        {isAuthenticated && emblemsLoaded && (() => {
          const activeBadgeCount = (showFounderEmblem ? 1 : 0) + (showVipEmblem ? 1 : 0) + (showCardLoversEmblem ? 1 : 0)
          const atLimit = activeBadgeCount >= 2

          const handleToggle = (badge: 'founder' | 'vip' | 'cardLover', checked: boolean) => {
            // Allow unchecking always, but block checking if already at 2
            if (checked && atLimit) return
            if (badge === 'founder') setShowFounderEmblem(checked)
            else if (badge === 'vip') setShowVipEmblem(checked)
            else setShowCardLoversEmblem(checked)
          }

          return (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">Label Badges</h3>
              <span className="text-xs text-gray-400">Show on back of labels (max 2)</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Founder Badge */}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isFounder
                  ? showFounderEmblem
                    ? 'bg-yellow-50 border-yellow-300'
                    : atLimit
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-yellow-300'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={showFounderEmblem}
                  onChange={(e) => isFounder && handleToggle('founder', e.target.checked)}
                  disabled={!isFounder || (atLimit && !showFounderEmblem)}
                  className="sr-only"
                />
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                  showFounderEmblem && isFounder
                    ? 'bg-yellow-500 border-yellow-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}>
                  {showFounderEmblem && isFounder && '\u2713'}
                </span>
                <span className="text-lg">&#9733;</span>
                <span className="text-xs font-medium text-gray-700">Founder</span>
                {!isFounder && <span className="text-[10px] text-gray-400 italic">Founders only</span>}
              </label>

              {/* VIP Badge */}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isVip
                  ? showVipEmblem
                    ? 'bg-indigo-50 border-indigo-300'
                    : atLimit
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-indigo-300'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={showVipEmblem}
                  onChange={(e) => isVip && handleToggle('vip', e.target.checked)}
                  disabled={!isVip || (atLimit && !showVipEmblem)}
                  className="sr-only"
                />
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                  showVipEmblem && isVip
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}>
                  {showVipEmblem && isVip && '\u2713'}
                </span>
                <span className="text-lg">&#9670;</span>
                <span className="text-xs font-medium text-gray-700">VIP</span>
                {!isVip && <span className="text-[10px] text-gray-400 italic">VIP package only</span>}
              </label>

              {/* Card Lovers Badge */}
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isCardLover
                  ? showCardLoversEmblem
                    ? 'bg-rose-50 border-rose-300'
                    : atLimit
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-rose-300'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              }`}>
                <input
                  type="checkbox"
                  checked={showCardLoversEmblem}
                  onChange={(e) => isCardLover && handleToggle('cardLover', e.target.checked)}
                  disabled={!isCardLover || (atLimit && !showCardLoversEmblem)}
                  className="sr-only"
                />
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                  showCardLoversEmblem && isCardLover
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}>
                  {showCardLoversEmblem && isCardLover && '\u2713'}
                </span>
                <span className="text-lg">&#9829;</span>
                <span className="text-xs font-medium text-gray-700">Card Lovers</span>
                {!isCardLover && <span className="text-[10px] text-gray-400 italic">Subscribers only</span>}
              </label>
            </div>
            {atLimit && (
              <p className="mt-2 text-xs text-amber-600">
                Maximum of 2 badges can be applied to labels. Deselect one to choose a different badge.
              </p>
            )}
            {!isFounder && !isVip && !isCardLover && (
              <p className="mt-2 text-xs text-gray-400">
                Badge emblems are available for Founder, VIP, and Card Lovers subscribers.{' '}
                <Link href="/pricing" className="text-purple-500 hover:text-purple-700 underline">View plans</Link>
              </p>
            )}
          </div>
          )
        })()}

        {/* Section 2: Label Gallery */}
        <LabelGallery selectedCard={selectedCard} slabData={slabData} customConfig={customConfig} customPreviewData={customPreviewData ?? slabData} showFounderEmblem={showFounderEmblem} showVipEmblem={showVipEmblem} showCardLoversEmblem={showCardLoversEmblem} />

        {/* Section 3: Custom Designer */}
        <CustomDesigner selectedCard={selectedCard} slabData={slabData} config={customConfig} setConfig={setCustomConfig} onPreviewDataChange={setCustomPreviewData} />

        {/* Section 4: Save & Manage Custom Styles */}
        {isAuthenticated && (
          <SavedStylesManager
            customConfig={customConfig}
            setConfig={setCustomConfig}
            customStyles={customStyles}
            onSave={saveCustomStyle}
            onDelete={deleteCustomStyle}
            onRename={renameCustomStyle}
            onApplyToAll={async (id: string) => {
              await switchStyle(id as any)
              alert('Style applied! This custom label style will now be used across all pages.')
            }}
          />
        )}
      </div>

      {/* Batch Modals */}
      {isBatchSlabModalOpen && (
        <BatchSlabLabelModal
          selectedCards={batchSelectedCards}
          isOpen={isBatchSlabModalOpen}
          onClose={() => setIsBatchSlabModalOpen(false)}
          showFounderEmblem={showFounderEmblem}
          showVipEmblem={showVipEmblem}
          showCardLoversEmblem={showCardLoversEmblem}
        />
      )}
      {isBatchAveryModalOpen && (
        <BatchAveryLabelModal
          selectedCards={batchSelectedCards}
          isOpen={isBatchAveryModalOpen}
          onClose={() => setIsBatchAveryModalOpen(false)}
        />
      )}
      {isBatchAvery8167ModalOpen && (
        <BatchAvery8167LabelModal
          selectedCards={batchSelectedCards}
          isOpen={isBatchAvery8167ModalOpen}
          onClose={() => setIsBatchAvery8167ModalOpen(false)}
        />
      )}
    </div>
  )
}
