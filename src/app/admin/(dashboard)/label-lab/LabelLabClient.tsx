'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  contrastRatioHex,
  pickContrastTextHex,
  sampleGradientContrast,
  printColorTweaksHex,
} from '@/lib/labelLab/contrastWCAG'

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

// ============================================================================
// Presets — small starter set, matches the most-used production options
// ============================================================================

interface GradientPreset {
  id: string
  label: string
  start: string
  end: string
}

const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'modern-dark', label: 'Modern Dark', start: '#1a1625', end: '#3a2a5c' },
  { id: 'midnight', label: 'Midnight Blue', start: '#0a0f2a', end: '#1e3a8a' },
  { id: 'emerald', label: 'Emerald', start: '#064e3b', end: '#0d9488' },
  { id: 'royal', label: 'Royal Purple', start: '#3b0764', end: '#7c3aed' },
  { id: 'sunset', label: 'Sunset', start: '#9a3412', end: '#fde047' },
  { id: 'rose', label: 'Rose Gold', start: '#831843', end: '#fb7185' },
  { id: 'paper', label: 'Paper Light', start: '#f9fafb', end: '#e5e7eb' },
  { id: 'silver', label: 'Silver', start: '#cbd5e1', end: '#94a3b8' },
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

  // --- Label design state ---
  const [presetId, setPresetId] = useState<string>('modern-dark')
  const [customStart, setCustomStart] = useState<string>('#1a1625')
  const [customEnd, setCustomEnd] = useState<string>('#3a2a5c')
  const [useCustom, setUseCustom] = useState(false)
  const [printTweakIntensity, setPrintTweakIntensity] = useState<number>(0.5)

  // --- Render state ---
  const [vectorPdfBlobUrl, setVectorPdfBlobUrl] = useState<string | null>(null)
  const [vectorPdfError, setVectorPdfError] = useState<string | null>(null)
  const [vectorBuilding, setVectorBuilding] = useState(false)

  // --- Resolved colors ---
  const gradientStart = useCustom ? customStart : (GRADIENT_PRESETS.find(p => p.id === presetId)?.start || '#1a1625')
  const gradientEnd = useCustom ? customEnd : (GRADIENT_PRESETS.find(p => p.id === presetId)?.end || '#3a2a5c')

  // Print-tuned colors for the lab vector path
  const tweakedStart = printTweakIntensity > 0 ? printColorTweaksHex(gradientStart, printTweakIntensity) : gradientStart
  const tweakedEnd = printTweakIntensity > 0 ? printColorTweaksHex(gradientEnd, printTweakIntensity) : gradientEnd

  // Pick text color based on mid-band of the TWEAKED gradient (what we'll actually paint)
  const midHex = useMemo(() => mixHex(tweakedStart, tweakedEnd, 0.5), [tweakedStart, tweakedEnd])
  const textChoice = useMemo(() => pickContrastTextHex(midHex), [midHex])

  // WCAG contrast report across 5 sample points
  const contrastReport = useMemo(() => {
    return sampleGradientContrast(tweakedStart, tweakedEnd, textChoice.hex, {
      samples: 5,
      threshold: 7, // print-grade
    })
  }, [tweakedStart, tweakedEnd, textChoice.hex])

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

  // --- Build the react-pdf vector blob whenever inputs change ---
  useEffect(() => {
    if (!selectedCard) return
    let cancelled = false
    setVectorBuilding(true)
    setVectorPdfError(null)
    ;(async () => {
      try {
        const { ModernSlabPdfDoc } = await import('@/lib/labelLab/modernSlabPdfDoc')
        const { pdf } = await import('@react-pdf/renderer')
        const inputs = labCardToPdfInputs(selectedCard, {
          gradientStart,
          gradientEnd,
          printColorTweakIntensity: printTweakIntensity,
        })
        const doc = ModernSlabPdfDoc(inputs)
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
  }, [selectedCard, gradientStart, gradientEnd, printTweakIntensity])

  // --- Download vector PDF ---
  const downloadVector = () => {
    if (!vectorPdfBlobUrl || !selectedCard) return
    const a = document.createElement('a')
    a.href = vectorPdfBlobUrl
    a.download = `lab-vector-${selectedCard.serial}.pdf`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>🧪</span>
          <div>
            <p className="text-sm font-bold text-amber-900">Label Lab — closed test environment</p>
            <p className="text-sm text-amber-800 mt-1">
              Validates a new vector PDF rendering pipeline with print-tuned colors and WCAG contrast scoring.
              Nothing here is wired to the production Label Studio or end-user downloads. v1 covers the modern slab
              only. Print the lab PDF on real paper to compare against the production raster export.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left rail — controls */}
        <div className="space-y-4 xl:col-span-1">
          <CardPicker
            cards={cards}
            search={search}
            onSearch={setSearch}
            searching={searching}
            loadingCards={loadingCards}
            selectedCard={selectedCard}
            onSelect={setSelectedCard}
          />

          <ControlsPanel
            presetId={presetId}
            useCustom={useCustom}
            customStart={customStart}
            customEnd={customEnd}
            printTweakIntensity={printTweakIntensity}
            onPreset={(id) => { setPresetId(id); setUseCustom(false) }}
            onCustomToggle={(v) => setUseCustom(v)}
            onCustomStart={setCustomStart}
            onCustomEnd={setCustomEnd}
            onPrintTweak={setPrintTweakIntensity}
          />

          <ContrastReportPanel
            report={contrastReport}
            textHex={textChoice.hex}
            textChoice={textChoice.choice}
          />
        </div>

        {/* Right panel — preview + download */}
        <div className="space-y-4 xl:col-span-2">
          <LivePreview
            card={selectedCard}
            gradientStart={tweakedStart}
            gradientEnd={tweakedEnd}
            textHex={textChoice.hex}
          />

          <VectorPdfPreview
            blobUrl={vectorPdfBlobUrl}
            building={vectorBuilding}
            error={vectorPdfError}
            onDownload={downloadVector}
          />
        </div>
      </div>
    </div>
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
// Controls
// ============================================================================

function ControlsPanel(props: {
  presetId: string
  useCustom: boolean
  customStart: string
  customEnd: string
  printTweakIntensity: number
  onPreset: (id: string) => void
  onCustomToggle: (v: boolean) => void
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
  onPrintTweak: (v: number) => void
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Background</h3>

      <div className="grid grid-cols-2 gap-2">
        {GRADIENT_PRESETS.map((p) => {
          const isActive = !props.useCustom && props.presetId === p.id
          return (
            <button
              key={p.id}
              onClick={() => props.onPreset(p.id)}
              className={`text-left text-xs rounded p-2 border transition-colors ${
                isActive ? 'border-purple-500 ring-1 ring-purple-300' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div
                className="h-6 w-full rounded mb-1"
                style={{ background: `linear-gradient(90deg, ${p.start}, ${p.end})` }}
              />
              <span className="font-medium text-gray-800">{p.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
          <input
            type="checkbox"
            checked={props.useCustom}
            onChange={(e) => props.onCustomToggle(e.target.checked)}
          />
          Use custom gradient
        </label>
        {props.useCustom && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-600">
              <span className="block mb-1">Start</span>
              <input
                type="color"
                value={props.customStart}
                onChange={(e) => props.onCustomStart(e.target.value)}
                className="w-full h-9 rounded border border-gray-200"
              />
            </label>
            <label className="text-xs text-gray-600">
              <span className="block mb-1">End</span>
              <input
                type="color"
                value={props.customEnd}
                onChange={(e) => props.onCustomEnd(e.target.value)}
                className="w-full h-9 rounded border border-gray-200"
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Print color tweak</span>
          <span className="text-xs text-gray-500">{Math.round(props.printTweakIntensity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={props.printTweakIntensity}
          onChange={(e) => props.onPrintTweak(Number(e.target.value))}
          className="w-full mt-1"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Darken-toward-black on dark colors + slight desaturation. Counters consumer-inkjet color drift.
        </p>
      </div>
    </section>
  )
}

// ============================================================================
// Contrast report
// ============================================================================

function ContrastReportPanel(props: {
  report: ReturnType<typeof sampleGradientContrast>
  textHex: string
  textChoice: 'light' | 'dark'
}) {
  const { report } = props
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
        Contrast (WCAG, print-grade 7:1)
      </h3>
      <div className="text-xs text-gray-700 mb-2">
        Chosen text color: <span className="inline-block align-middle w-4 h-4 rounded border border-gray-300" style={{ background: props.textHex }} /> <span className="font-mono">{props.textHex}</span>
        <span className="ml-2 text-gray-500">({props.textChoice})</span>
      </div>
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
          : `Min ${report.minRatio.toFixed(2)}:1 — some regions below the 7:1 print threshold. Add stroke or reconsider colors.`}
      </div>
    </section>
  )
}

// ============================================================================
// Live HTML preview — fast feedback while the user adjusts colors
// ============================================================================

function LivePreview(props: {
  card: LabCard | null
  gradientStart: string
  gradientEnd: string
  textHex: string
}) {
  if (!props.card) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Pick a card to start previewing.</p>
      </section>
    )
  }
  const inputs = labCardToPdfInputs(props.card, {
    gradientStart: props.gradientStart,
    gradientEnd: props.gradientEnd,
    printColorTweakIntensity: 0, // already applied upstream
  })
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Live preview (HTML)</h3>
      <p className="text-xs text-gray-500 mb-3">
        Fast feedback as you tweak colors. The final lab PDF below is the authoritative vector render.
      </p>
      <div
        className="w-full max-w-[600px] rounded-md shadow-md mx-auto"
        style={{
          aspectRatio: '2 / 1',
          background: `linear-gradient(90deg, ${props.gradientStart}, ${props.gradientEnd})`,
          color: props.textHex,
          display: 'grid',
          gridTemplateColumns: '32% 1fr 20%',
          padding: '12px',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div className="flex items-center justify-center">
          {inputs.frontImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inputs.frontImageUrl} alt="" style={{ maxHeight: '95%', maxWidth: '95%', objectFit: 'contain' }} />
          ) : <div className="w-full h-full bg-black/20 rounded" />}
        </div>
        <div className="flex flex-col justify-between px-2">
          <div>
            <p className="text-[10px] tracking-widest opacity-80 font-bold">DCM</p>
            <p className="text-[18px] font-bold leading-tight mt-1">{inputs.playerOrCharacter}</p>
            <p className="text-[11px] opacity-90 mt-0.5">{inputs.setName}</p>
            <p className="text-[10px] opacity-80">{[inputs.year, inputs.cardNumber].filter(Boolean).join(' • ')}</p>
          </div>
          <div className="flex gap-1 mt-2">
            {(['centering', 'corners', 'edges', 'surface'] as const).map((k) => (
              <div key={k} className="flex-1 text-center border rounded py-0.5" style={{ borderColor: props.textHex }}>
                <p className="text-[11px] font-bold">{inputs.subgrades?.[k] ?? '—'}</p>
                <p className="text-[7px] tracking-widest opacity-80">{k.slice(0, 3).toUpperCase()}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] opacity-80 mt-1 tracking-wider">DCM • {inputs.serial}</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-[48px] font-bold leading-none">{inputs.grade}</p>
          <p className="text-[8px] tracking-widest opacity-90 font-bold mt-1">{inputs.conditionLabel.toUpperCase()}</p>
        </div>
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
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Lab vector PDF</h3>
          <p className="text-xs text-gray-500 mt-1">@react-pdf/renderer. Text and gradients vector at every DPI.</p>
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
        <iframe src={props.blobUrl} title="Lab vector PDF" className="w-full h-[480px] border border-gray-200 rounded" />
      ) : (
        <div className="h-[480px] flex items-center justify-center border border-dashed border-gray-300 rounded text-sm text-gray-500">
          {props.building ? 'Building vector PDF…' : 'Pick a card and gradient to render.'}
        </div>
      )}
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

function labCardToPdfInputs(
  c: LabCard,
  overrides: { gradientStart: string; gradientEnd: string; printColorTweakIntensity?: number },
): import('@/lib/labelLab/modernSlabPdfDoc').ModernSlabPdfInputs {
  const ci = c.conversational_card_info || {}
  const ws = c.conversational_weighted_sub_scores || {}
  const ss = c.conversational_sub_scores || {}
  const sub = {
    centering: roundSub(ws.centering ?? ss.centering),
    corners: roundSub(ws.corners ?? ss.corners),
    edges: roundSub(ws.edges ?? ss.edges),
    surface: roundSub(ws.surface ?? ss.surface),
  }
  return {
    gradientStart: overrides.gradientStart,
    gradientEnd: overrides.gradientEnd,
    printColorTweakIntensity: overrides.printColorTweakIntensity ?? 0.5,
    playerOrCharacter: ci.player_or_character || c.featured || c.pokemon_featured || c.card_name || '—',
    setName: ci.set_name || c.card_set || '',
    year: String(ci.year || (c.release_date ? c.release_date.slice(0, 4) : '')),
    cardNumber: ci.card_number ? `#${ci.card_number.replace(/^#/, '')}` : (c.card_number ? `#${c.card_number}` : ''),
    grade: String(c.conversational_whole_grade ?? '?'),
    conditionLabel: c.conversational_condition_label || 'Graded',
    subgrades: sub,
    serial: c.serial,
    frontImageUrl: c.front_url,
    backImageUrl: c.back_url,
  }
}

function roundSub(v: any): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!isFinite(n)) return null
  return Math.round(n * 2) / 2
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return a
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return '#' + [r, g, bl].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')
}

function parse(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
