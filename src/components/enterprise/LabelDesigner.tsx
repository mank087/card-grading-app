'use client'

/**
 * Enterprise Label Designer — the interactive editor behind Brand Setup's
 * "Slab label design" section and the admin org console.
 *
 * ENTERPRISE ONLY. Edits an OrgLabelDesign document (src/lib/labels/
 * orgLabelDesign.ts); nothing here touches Label Studio or consumer labels.
 *
 * Canvas: the real HeritageLabelPreview SVG (so the editor shows exactly
 * what prints) with a transparent SVG overlay in the same 1400x400 space
 * carrying the hit targets and handles. Every drag maps back to a BOUNDED
 * field of the document — the geometry engine (heritageGeometry) and the
 * per-card fitter still decide the final rects, which is what keeps a
 * dragged layout printable on every card name length.
 *
 * Sample cards: short / typical / worst-case. The worst case always renders
 * in the background and drives the collision notes under the canvas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HeritageLabelPreview from '@/components/labels/HeritageLabelPreview'
import ModernFrontLabel from '@/components/labels/ModernFrontLabel'
import ModernBackLabel from '@/components/labels/ModernBackLabel'
import { BAND_PATTERNS, type BandPattern } from '@/lib/labelLab/bandGeometry'
import {
  heritageGeometry, fitHeritageFront, heritageMarkBox, HERITAGE_PX,
} from '@/lib/labelLab/heritageLayout'
import {
  DESIGN_LIMITS, defaultOrgLabelDesign, designEquals, normalizeOrgLabelDesign,
  type OrgLabelDesign, type BandPosition, type LogoZone,
} from '@/lib/labels/orgLabelDesign'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'

export interface LabelDesignerProps {
  design: OrgLabelDesign
  /** Fires on every change, including mid-drag. */
  onChange: (design: OrgLabelDesign) => void
  /** Fires when a change is final (pointer up / control change) — save here. */
  onCommit?: (design: OrgLabelDesign) => void
  orgName: string
  serialPrefix: string
  /** Org brand palette ([0] = primary); the band's 'brand' colour source. */
  brandColors: string[]
  logos: { color: string | null; white: string | null; black?: string | null }
  disabled?: boolean
  className?: string
}

type Selection = 'logo' | 'chip' | 'text' | 'band' | 'border' | null

interface SampleCard { id: string; label: string; primaryName: string; contextLine: string; grade: number | null; condition: string }

const SAMPLES: SampleCard[] = [
  { id: 'short', label: 'Short name', primaryName: 'Pikachu', contextLine: 'Base Set • #58 • 1999', grade: 10, condition: 'Gem Mint' },
  { id: 'typical', label: 'Typical', primaryName: 'Aaron Judge', contextLine: 'Bowman Chrome • #99 • 2023', grade: 9, condition: 'Mint' },
  { id: 'worst', label: 'Longest', primaryName: 'Charizard VMAX Rainbow Rare Secret Alternate Art Champion', contextLine: "Sword & Shield Champion's Path Special Collection • #074/073 • 2020", grade: 8, condition: 'NM-Mint' },
]
const WORST = SAMPLES[2]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round2 = (v: number) => Math.round(v * 100) / 100

const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50'
const HANDLE_R = 14

interface RangeProps {
  value: number; min: number; max: number; step: number; label: string; suffix?: string; disabled?: boolean
  onChange: (v: number) => void; onStart: () => void; onEnd: () => void
}

/** Defined outside the editor so a re-render mid-drag never remounts the input. */
function RangeControl({ value, min, max, step, label, suffix = '%', disabled, onChange, onStart, onEnd }: RangeProps) {
  return (
    <div>
      <label className={labelCls}>{label} <span className="font-normal text-gray-400">{suffix === '%' ? `${Math.round(value * 100)}%` : `${value}${suffix}`}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        className="w-full accent-purple-600"
        onChange={e => onChange(Number(e.target.value))}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
      />
    </div>
  )
}

function Handle({ x, y, onDown, cursor = 'nwse-resize', title }: { x: number; y: number; onDown: (e: React.PointerEvent) => void; cursor?: string; title: string }) {
  return (
    <g style={{ cursor }} onPointerDown={onDown}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={HANDLE_R} fill="#FFFFFF" stroke="#7C3AED" strokeWidth={4} />
    </g>
  )
}

/** Deep-set helper for the small document — returns a new normalized doc. */
function patch(d: OrgLabelDesign, fn: (draft: OrgLabelDesign) => void): OrgLabelDesign {
  const draft = JSON.parse(JSON.stringify(d)) as OrgLabelDesign
  fn(draft)
  return normalizeOrgLabelDesign(draft)
}

function useHistory(initial: OrgLabelDesign) {
  const [past, setPast] = useState<OrgLabelDesign[]>([])
  const [future, setFuture] = useState<OrgLabelDesign[]>([])
  const push = useCallback((prev: OrgLabelDesign) => {
    setPast(p => [...p.slice(-19), prev])
    setFuture([])
  }, [])
  const undo = useCallback((current: OrgLabelDesign): OrgLabelDesign | null => {
    if (!past.length) return null
    const prev = past[past.length - 1]
    setPast(p => p.slice(0, -1))
    setFuture(f => [current, ...f])
    return prev
  }, [past])
  const redo = useCallback((current: OrgLabelDesign): OrgLabelDesign | null => {
    if (!future.length) return null
    const next = future[0]
    setFuture(f => f.slice(1))
    setPast(p => [...p, current])
    return next
  }, [future])
  void initial
  return { push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}

export default function LabelDesigner({
  design, onChange, onCommit, orgName, serialPrefix, brandColors, logos, disabled = false, className = '',
}: LabelDesignerProps) {
  const [selection, setSelection] = useState<Selection>(null)
  const [sampleId, setSampleId] = useState<string>('typical')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const history = useHistory(design)
  const canvasRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{
    kind: 'logo-move' | 'logo-size' | 'chip-size' | 'text-size' | 'band-width'
    startX: number; startY: number; start: OrgLabelDesign
  } | null>(null)

  const sample = SAMPLES.find(s => s.id === sampleId) ?? SAMPLES[1]
  const serial = `${serialPrefix || 'ORG'}442921`
  const heritage = design.base === 'heritage'

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then(q => q.default.toDataURL(`https://dcmgrading.com/verify/${serial}`, { errorCorrectionLevel: 'M', margin: 1, width: 200, color: { dark: '#141414', light: '#ffffff' } }))
      .then(url => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [serial])

  // ---- Colours --------------------------------------------------------------
  const brandSet = useMemo(() => (brandColors.length ? brandColors : ['#7C3AED', '#4C1D95']), [brandColors])
  const bandColors = useMemo(() => {
    const src = design.band.colorSource === 'custom' && design.band.colors.length ? design.band.colors : brandSet
    return src.length >= 2 ? src : [src[0], src[0]]
  }, [design.band.colorSource, design.band.colors, brandSet])
  const mark = (design.logo.variant === 'white' ? logos.white : design.logo.variant === 'black' ? logos.black : logos.color) || logos.color

  // ---- Geometry for the overlay --------------------------------------------
  const geom = useMemo(() => heritageGeometry(design), [design])
  const fit = useMemo(() => fitHeritageFront(sample.primaryName, sample.contextLine, serial, geom), [sample, serial, geom])
  const markBox = useMemo(() => heritageMarkBox(design.logo.scale, fit, geom), [design.logo.scale, fit, geom])
  const worstFit = useMemo(() => fitHeritageFront(WORST.primaryName, WORST.contextLine, serial, geom), [serial, geom])
  const worstMark = useMemo(() => heritageMarkBox(design.logo.scale, worstFit, geom), [design.logo.scale, worstFit, geom])

  const notes = useMemo(() => {
    if (!heritage) return []
    const out: string[] = []
    if (worstMark.clamped) out.push('Long card names shrink the logo to keep it clear of the serial.')
    if (worstFit.name.rows.length >= 3 && worstFit.name.size <= 30) out.push('The longest names wrap to 3 lines at the smallest type size.')
    if (worstFit.textBottom > geom.text.maxBottom - 1) out.push('Text runs close to the label edge on the longest names.')
    if (geom.chip.scale < (design.chip.scale - 0.001)) out.push('The grade chip was capped to fit the label height.')
    if (design.border.enabled && design.band.position !== 'left') out.push('Bordered labels print the band inside the border — the colour no longer bleeds to the cut.')
    return out
  }, [heritage, worstMark, worstFit, geom, design])

  // ---- Commit helpers -------------------------------------------------------
  const commit = useCallback((next: OrgLabelDesign, record = true) => {
    if (designEquals(next, design)) return
    if (record) history.push(design)
    onChange(next)
    onCommit?.(next)
  }, [design, history, onChange, onCommit])

  const set = useCallback((fn: (draft: OrgLabelDesign) => void) => commit(patch(design, fn)), [commit, design])

  const doUndo = () => { const d = history.undo(design); if (d) { onChange(d); onCommit?.(d) } }
  const doRedo = () => { const d = history.redo(design); if (d) { onChange(d); onCommit?.(d) } }
  const reset = () => commit(normalizeOrgLabelDesign({ ...defaultOrgLabelDesign(), base: design.base }))

  // ---- Pointer handling (canvas space = 1400 x 400) --------------------------
  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const svg = canvasRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * HERITAGE_PX.W, y: ((e.clientY - r.top) / r.height) * HERITAGE_PX.H }
  }

  const beginDrag = (kind: NonNullable<typeof dragRef.current>['kind']) => (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const p = toCanvas(e)
    dragRef.current = { kind, startX: p.x, startY: p.y, start: design }
    history.push(design)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const p = toCanvas(e)
    const dx = p.x - d.startX
    const dy = p.y - d.startY
    const g = heritageGeometry(d.start)
    let next = d.start
    switch (d.kind) {
      case 'logo-move': {
        if (g.logo.column) {
          const col = g.logo.column
          const half = Math.max(1, (col.h - col.w) / 2)
          const centre = col.y + col.h / 2
          const startCentre = centre + d.start.logo.offset.y * half
          next = patch(d.start, x => { x.logo.offset.y = round2(clamp((startCentre + dy - centre) / half, -1, 1)) })
        } else {
          const startBox = heritageMarkBox(d.start.logo.scale, fit, g)
          const centre0 = g.outer.x + g.outer.w / 2
          const leftLimit = g.content.x + 24 + startBox.w / 2
          const rightLimit = g.chip.x - 16 - startBox.w / 2
          const startCentre = startBox.x + startBox.w / 2
          const px = startCentre + dx
          const off = px >= centre0
            ? (px - centre0) / Math.max(1, rightLimit - centre0)
            : (px - centre0) / Math.max(1, centre0 - leftLimit)
          next = patch(d.start, x => { x.logo.offset.x = round2(clamp(off, -1, 1)) })
        }
        break
      }
      case 'logo-size': {
        const lim = d.start.logo.zone === 'bottom' ? DESIGN_LIMITS.logoScaleBottom : DESIGN_LIMITS.logoScaleSide
        next = patch(d.start, x => { x.logo.scale = round2(clamp(d.start.logo.scale + (dx + dy) / 260, lim.min, lim.max)) })
        break
      }
      case 'chip-size': {
        next = patch(d.start, x => { x.chip.scale = round2(clamp(d.start.chip.scale + (dx + dy) / 600, DESIGN_LIMITS.chipScale.min, DESIGN_LIMITS.chipScale.max)) })
        break
      }
      case 'text-size': {
        next = patch(d.start, x => { x.text.scale = round2(clamp(d.start.text.scale + (dx + dy) / 700, DESIGN_LIMITS.textScale.min, DESIGN_LIMITS.textScale.max)) })
        break
      }
      case 'band-width': {
        const pos = d.start.band.position
        const delta = pos === 'left' ? dx : pos === 'right' ? -dx : pos === 'top' ? dy : -dy
        next = patch(d.start, x => { x.band.width = round2(clamp(d.start.band.width + delta / HERITAGE_PX.BAND_W, DESIGN_LIMITS.bandWidth.min, DESIGN_LIMITS.bandWidth.max)) })
        break
      }
    }
    onChange(next)
  }

  const endDrag = () => {
    if (!dragRef.current) return
    dragRef.current = null
    onCommit?.(design)
  }

  // Keyboard: undo/redo + nudge the selected element.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return }
    if (selection === 'logo' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const step = 0.05 * (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)
      set(x => { if (x.logo.zone === 'bottom') x.logo.offset.x = round2(clamp(x.logo.offset.x + step, -1, 1)); else x.logo.offset.y = round2(clamp(x.logo.offset.y + step, -1, 1)) })
    }
  }

  // ---- Sample data for the preview -----------------------------------------
  const previewData = useMemo(() => ({
    primaryName: sample.primaryName,
    contextLine: sample.contextLine,
    features: [],
    featuresLine: null,
    serial,
    grade: sample.grade,
    gradeFormatted: sample.grade == null ? 'A' : String(sample.grade),
    condition: sample.condition,
    isAlteredAuthentic: sample.grade == null,
    qrCodeDataUrl: qrDataUrl,
    subScores: { centering: 9.5, corners: 9, edges: 9.5, surface: 9 },
  }) as unknown as SlabLabelData, [sample, serial, qrDataUrl])

  // ---- Overlay pieces --------------------------------------------------------
  const textRect = { x: geom.text.x, y: geom.text.y, w: geom.text.w, h: Math.max(60, fit.textBottom - geom.text.y) }
  const sel = (k: Selection) => selection === k
  const outline = (k: Selection) => sel(k) ? '#7C3AED' : 'transparent'

  const bandEdgeTargets: { pos: BandPosition; cx: number; cy: number }[] = [
    { pos: 'left', cx: geom.outer.x + 45, cy: geom.outer.y + geom.outer.h / 2 },
    { pos: 'right', cx: geom.outer.x + geom.outer.w - 45, cy: geom.outer.y + geom.outer.h / 2 },
    { pos: 'top', cx: geom.outer.x + geom.outer.w / 2, cy: geom.outer.y + 45 },
    { pos: 'bottom', cx: geom.outer.x + geom.outer.w / 2, cy: geom.outer.y + geom.outer.h - 45 },
  ]
  const bandInnerMid = (() => {
    const b = geom.band
    switch (b.position) {
      case 'right': return { x: b.x, y: b.y + b.h / 2, cursor: 'ew-resize' }
      case 'top': return { x: b.x + b.w / 2, y: b.y + b.h, cursor: 'ns-resize' }
      case 'bottom': return { x: b.x + b.w / 2, y: b.y, cursor: 'ns-resize' }
      default: return { x: b.x + b.w, y: b.y + b.h / 2, cursor: 'ew-resize' }
    }
  })()

  const panelCls = 'space-y-3'
  const sectionCls = (k: Selection) => `rounded-xl border p-3 transition-colors ${sel(k) ? 'border-purple-400 bg-purple-50/40' : 'border-gray-200'}`
  // Sliders update the preview live and record/commit on press/release, so a
  // drag is one undo step and one save.
  const Range = (p: Omit<RangeProps, 'disabled' | 'onStart' | 'onEnd'>) => (
    <RangeControl {...p} disabled={disabled} onStart={() => history.push(design)} onEnd={() => onCommit?.(design)} />
  )

  return (
    <div className={`grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] ${className}`} onKeyDown={onKeyDown} tabIndex={0}>
      {/* ------------------------------------------------------------ canvas */}
      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs">
            {SAMPLES.map(s => (
              <button key={s.id} type="button" onClick={() => setSampleId(s.id)}
                className={`px-2.5 py-1 rounded-full border ${sampleId === s.id ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600 hover:border-purple-400'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button type="button" onClick={() => setSide('front')} className={`px-2.5 py-1 rounded-l-lg border ${side === 'front' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`}>Front</button>
            <button type="button" onClick={() => setSide('back')} className={`px-2.5 py-1 rounded-r-lg border -ml-px ${side === 'back' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`}>Back</button>
            <span className="w-2" />
            <button type="button" onClick={doUndo} disabled={!history.canUndo || disabled} title="Undo (Ctrl+Z)" className="px-2 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-40">↶</button>
            <button type="button" onClick={doRedo} disabled={!history.canRedo || disabled} title="Redo (Ctrl+Y)" className="px-2 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-40">↷</button>
            <button type="button" onClick={reset} disabled={disabled} className="px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:text-red-600">Reset to default</button>
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden shadow-sm border border-gray-200 bg-white select-none" style={{ touchAction: 'none' }}>
          {heritage ? (
            <HeritageLabelPreview
              data={previewData}
              side={side}
              pattern={design.band.pattern as BandPattern}
              bandColors={bandColors}
              blackLogoHref={mark ?? undefined}
              colorLogoHref={mark ?? undefined}
              suppressImages={!mark}
              logoScale={design.logo.scale}
              design={design}
            />
          ) : side === 'front' ? (
            <ModernFrontLabel
              displayName={sample.primaryName}
              setLineText={sample.contextLine}
              serial={serial}
              grade={sample.grade}
              condition={sample.condition}
              isAlteredAuthentic={sample.grade == null}
              size="lg"
              logoColorSrc={mark}
              logoWhiteSrc={mark}
              logoScale={design.logo.scale}
              design={design}
              designBandColors={bandColors}
            />
          ) : (
            <ModernBackLabel
              serial={serial}
              grade={sample.grade}
              condition={sample.condition}
              qrCodeUrl={`https://dcmgrading.com/verify/${serial}`}
              qrLogoSrc={logos.color}
              subScores={{ centering: 9.5, corners: 9, edges: 9.5, surface: 9 }}
              size="lg"
            />
          )}

          {/* Interaction overlay — Heritage front only */}
          {heritage && side === 'front' && (
            <svg
              ref={canvasRef}
              viewBox={`0 0 ${HERITAGE_PX.W} ${HERITAGE_PX.H}`}
              className="absolute inset-0 w-full h-full"
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerDown={() => setSelection(null)}
            >
              {/* band */}
              <rect x={geom.band.x} y={geom.band.y} width={geom.band.w} height={geom.band.h} fill="transparent"
                stroke={outline('band')} strokeWidth={5} strokeDasharray="14 10" style={{ cursor: 'pointer' }}
                onPointerDown={e => { e.stopPropagation(); setSelection('band') }} />
              {/* border */}
              {geom.border && (
                <rect x={geom.border.x} y={geom.border.y} width={geom.border.w} height={geom.border.h} fill="none"
                  stroke={outline('border')} strokeWidth={Math.max(geom.border.width + 6, 10)} strokeOpacity={0.5} style={{ cursor: 'pointer' }}
                  pointerEvents="stroke"
                  onPointerDown={e => { e.stopPropagation(); setSelection('border') }} />
              )}
              {/* text */}
              <rect x={textRect.x - 8} y={textRect.y - 8} width={textRect.w + 16} height={textRect.h + 16} fill="transparent"
                stroke={outline('text')} strokeWidth={5} strokeDasharray="14 10" style={{ cursor: 'pointer' }}
                onPointerDown={e => { e.stopPropagation(); setSelection('text') }} />
              {/* chip */}
              <rect x={geom.chip.x - 6} y={geom.chip.y - 6} width={geom.chip.w + 12} height={geom.chip.h + 12} rx={geom.chip.r} fill="transparent"
                stroke={outline('chip')} strokeWidth={5} strokeDasharray="14 10" style={{ cursor: 'pointer' }}
                onPointerDown={e => { e.stopPropagation(); setSelection('chip') }} />
              {/* logo zone + mark */}
              {sel('logo') && geom.logo.column && (
                <rect x={geom.logo.column.x} y={geom.logo.column.y} width={geom.logo.column.w} height={geom.logo.column.h} fill="#7C3AED" fillOpacity={0.06} stroke="#7C3AED" strokeOpacity={0.4} strokeWidth={3} strokeDasharray="8 8" />
              )}
              <rect x={markBox.x - 6} y={markBox.y - 6} width={markBox.w + 12} height={markBox.h + 12} fill={sel('logo') ? '#7C3AED' : 'transparent'} fillOpacity={0.06}
                stroke={outline('logo')} strokeWidth={5} strokeDasharray="14 10"
                style={{ cursor: disabled ? 'default' : geom.logo.column ? 'ns-resize' : 'ew-resize' }}
                onPointerDown={e => { setSelection('logo'); beginDrag('logo-move')(e) }} />

              {/* handles */}
              {sel('logo') && <Handle x={markBox.x + markBox.w + 6} y={markBox.y + markBox.h + 6} onDown={beginDrag('logo-size')} title="Drag to resize the logo" />}
              {sel('chip') && <Handle x={geom.chip.x + geom.chip.w + 6} y={geom.chip.y + geom.chip.h + 6} onDown={beginDrag('chip-size')} title="Drag to resize the grade chip" />}
              {sel('text') && <Handle x={textRect.x + textRect.w + 8} y={textRect.y + textRect.h + 8} onDown={beginDrag('text-size')} title="Drag to scale the text" />}
              {sel('band') && (
                <>
                  <Handle x={bandInnerMid.x} y={bandInnerMid.y} cursor={bandInnerMid.cursor} onDown={beginDrag('band-width')} title="Drag to change the band width" />
                  {bandEdgeTargets.filter(t => t.pos !== design.band.position).map(t => (
                    <g key={t.pos} style={{ cursor: 'pointer' }} onPointerDown={e => { e.stopPropagation(); set(x => { x.band.position = t.pos }) }}>
                      <title>Move the band to the {t.pos} edge</title>
                      <circle cx={t.cx} cy={t.cy} r={22} fill="#FFFFFF" fillOpacity={0.9} stroke="#7C3AED" strokeWidth={4} />
                      <text x={t.cx} y={t.cy + 9} textAnchor="middle" fontSize={26} fill="#7C3AED" fontFamily="system-ui, sans-serif">
                        {t.pos === 'left' ? '←' : t.pos === 'right' ? '→' : t.pos === 'top' ? '↑' : '↓'}
                      </text>
                    </g>
                  ))}
                </>
              )}
            </svg>
          )}
        </div>

        {heritage ? (
          <p className="text-[11px] text-gray-400">
            Click an element to select it. Drag the logo to move it, drag a handle to resize. Ctrl+Z undoes. {side === 'back' && 'The back follows the front’s band, chip colour and border.'}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400">
            Modern labels are edited with the controls on the right; drag editing is available on the Heritage label.
          </p>
        )}

        {notes.length > 0 && (
          <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
            {notes.map(n => <li key={n}>• {n}</li>)}
          </ul>
        )}
        <p className="text-[11px] text-gray-400 text-center">Sample card shown. Every {orgName} label uses this design, front and back.</p>
      </div>

      {/* ------------------------------------------------------------ panel */}
      <div className={panelCls}>
        <div className={sectionCls(null)}>
          <label className={labelCls}>Label style</label>
          <select value={design.base} className={inputCls} disabled={disabled}
            onChange={e => {
              const base = e.target.value as 'heritage' | 'modern'
              // Modern's print renderers only know the logo version + size,
              // so switching to it drops the Heritage-only choices rather
              // than carrying them invisibly.
              commit(base === 'modern'
                ? normalizeOrgLabelDesign({ ...defaultOrgLabelDesign(), base, band: { ...design.band, position: 'left', width: 1 }, logo: { ...defaultOrgLabelDesign().logo, variant: design.logo.variant, scale: Math.min(design.logo.scale, DESIGN_LIMITS.logoScaleSide.max) } })
                : patch(design, x => { x.base = base }))
            }}>
            <option value="heritage">Heritage (default)</option>
            <option value="modern">Modern</option>
          </select>
          {!heritage && (
            <p className="text-[11px] text-amber-700 mt-2">
              The Modern label currently takes your logo version and size. Band placement, border, chip colour and text size are Heritage features for now — switch to Heritage for the full designer.
            </p>
          )}
        </div>

        <div className={`${sectionCls('band')} ${heritage ? '' : 'opacity-50 pointer-events-none'}`} onClick={() => setSelection('band')}>
          <div className="text-xs font-semibold text-gray-800 mb-2">Color band</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Edge</label>
              <select value={design.band.position} className={inputCls} disabled={disabled}
                onChange={e => set(x => { x.band.position = e.target.value as BandPosition })}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Pattern</label>
              <select value={design.band.pattern} className={inputCls} disabled={disabled}
                onChange={e => set(x => { x.band.pattern = e.target.value as BandPattern })}>
                {BAND_PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2">
            <label className={labelCls}>Colors</label>
            <select value={design.band.colorSource} className={inputCls} disabled={disabled}
              onChange={e => set(x => {
                const v = e.target.value as 'brand' | 'card' | 'custom'
                x.band.colorSource = v
                x.band.colors = v === 'custom' ? (x.band.colors.length ? x.band.colors : brandSet.slice(0, 5)) : []
              })}>
              <option value="brand">Your brand colors</option>
              <option value="card">Each card&apos;s own colors</option>
              <option value="custom">Custom colors</option>
            </select>
            {design.band.colorSource === 'custom' && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {design.band.colors.map((c, i) => (
                  <input key={`${i}-${c}`} type="color" defaultValue={c} disabled={disabled}
                    onBlur={e => { if (e.target.value !== c) set(x => { x.band.colors[i] = e.target.value }) }}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer" />
                ))}
                {design.band.colors.length < 5 && (
                  <button type="button" disabled={disabled} onClick={() => set(x => { x.band.colors.push(brandSet[0]) })}
                    className="w-8 h-8 border border-dashed border-gray-300 rounded text-gray-400 hover:border-purple-400">+</button>
                )}
                {design.band.colors.length > 1 && (
                  <button type="button" disabled={disabled} onClick={() => set(x => { x.band.colors.pop() })}
                    className="px-1.5 h-8 text-[11px] text-gray-400 hover:text-red-500">remove last</button>
                )}
              </div>
            )}
            {design.band.colorSource === 'card' && (
              <p className="text-[11px] text-gray-400 mt-1">The band picks up each graded card&apos;s artwork colors. The preview shows your brand palette as a stand-in.</p>
            )}
          </div>
          <div className="mt-2">
            <Range label="Band width" value={design.band.width} min={DESIGN_LIMITS.bandWidth.min} max={DESIGN_LIMITS.bandWidth.max} step={DESIGN_LIMITS.bandWidth.step}
              onChange={v => onChange(patch(design, x => { x.band.width = v }))} />
          </div>
        </div>

        <div className={sectionCls('logo')} onClick={() => setSelection('logo')}>
          <div className="text-xs font-semibold text-gray-800 mb-2">Logo</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Version</label>
              <select value={design.logo.variant} className={inputCls} disabled={disabled}
                onChange={e => set(x => { x.logo.variant = e.target.value as 'color' | 'black' | 'white' })}>
                <option value="color">Full color</option>
                <option value="black">Black</option>
                <option value="white">White</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Placement</label>
              <select value={design.logo.zone} className={inputCls} disabled={disabled || !heritage}
                onChange={e => set(x => {
                  const zone = e.target.value as LogoZone
                  x.logo.zone = zone
                  x.logo.offset = { x: 0, y: 0 }
                  // Side columns run 0.7–1.5; a bottom-strip value above that clamps.
                  if (zone !== 'bottom') x.logo.scale = Math.min(x.logo.scale, DESIGN_LIMITS.logoScaleSide.max)
                })}>
                <option value="bottom">Bottom centre (wordmark)</option>
                <option value="left">Left column (emblem)</option>
                <option value="right">Beside the grade (emblem)</option>
              </select>
            </div>
          </div>
          <div className="mt-2">
            <Range label="Logo size" value={design.logo.scale}
              min={design.logo.zone === 'bottom' ? DESIGN_LIMITS.logoScaleBottom.min : DESIGN_LIMITS.logoScaleSide.min}
              max={design.logo.zone === 'bottom' ? DESIGN_LIMITS.logoScaleBottom.max : DESIGN_LIMITS.logoScaleSide.max}
              step={DESIGN_LIMITS.logoScaleBottom.step}
              onChange={v => onChange(patch(design, x => { x.logo.scale = v }))} />
          </div>
          {heritage && (
            <div className="mt-2">
              <Range label={design.logo.zone === 'bottom' ? 'Slide left / right' : 'Slide up / down'} suffix=""
                value={design.logo.zone === 'bottom' ? design.logo.offset.x : design.logo.offset.y}
                min={-1} max={1} step={DESIGN_LIMITS.logoOffset.step}
                onChange={v => onChange(patch(design, x => { if (x.logo.zone === 'bottom') x.logo.offset.x = v; else x.logo.offset.y = v }))} />
            </div>
          )}
          {heritage && design.logo.zone === 'bottom' && (
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={design.logo.accentRules} disabled={disabled}
                onChange={e => set(x => { x.logo.accentRules = e.target.checked })} className="accent-purple-600" />
              Accent bars beside the logo
            </label>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            Square or stacked logos look best in a column; wide wordmarks in the bottom strip. The label keeps your logo clear of the card name and serial automatically.
          </p>
        </div>

        <div className={`${sectionCls('chip')} ${heritage ? '' : 'opacity-50 pointer-events-none'}`} onClick={() => setSelection('chip')}>
          <div className="text-xs font-semibold text-gray-800 mb-2">Grade chip</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Style</label>
              <select value={design.chip.theme} className={inputCls} disabled={disabled}
                onChange={e => set(x => { x.chip.theme = e.target.value as 'black' | 'white' })}>
                <option value="black">Black chip</option>
                <option value="white">White chip with border</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Gem Mint 10 colour</label>
              <div className="flex items-center gap-1.5">
                <input type="color" value={design.chip.grade10Color ?? '#FFDA2B'} disabled={disabled}
                  onChange={e => onChange(patch(design, x => { x.chip.grade10Color = e.target.value }))}
                  onBlur={() => onCommit?.(design)}
                  className="w-9 h-8 border border-gray-300 rounded cursor-pointer" />
                <button type="button" disabled={disabled || !design.chip.grade10Color} onClick={() => set(x => { x.chip.grade10Color = null })}
                  className="text-[11px] text-gray-400 hover:text-purple-600 disabled:opacity-40">foil</button>
              </div>
            </div>
          </div>
          {heritage && (
            <div className="mt-2">
              <Range label="Chip size" value={design.chip.scale} min={DESIGN_LIMITS.chipScale.min} max={DESIGN_LIMITS.chipScale.max} step={DESIGN_LIMITS.chipScale.step}
                onChange={v => onChange(patch(design, x => { x.chip.scale = v }))} />
            </div>
          )}
        </div>

        <div className={`${sectionCls('text')} ${heritage ? '' : 'opacity-50 pointer-events-none'}`} onClick={() => setSelection('text')}>
          <div className="text-xs font-semibold text-gray-800 mb-2">Text</div>
          <Range label="Text size" value={design.text.scale} min={DESIGN_LIMITS.textScale.min} max={DESIGN_LIMITS.textScale.max} step={DESIGN_LIMITS.textScale.step}
            onChange={v => onChange(patch(design, x => { x.text.scale = v }))} />
          <p className="text-[11px] text-gray-400 mt-1">A request, not a guarantee: long names still shrink to fit.</p>
        </div>

        <div className={`${sectionCls('border')} ${heritage ? '' : 'opacity-50 pointer-events-none'}`} onClick={() => setSelection('border')}>
          <label className="flex items-center justify-between text-xs font-semibold text-gray-800">
            Border
            <input type="checkbox" checked={design.border.enabled} disabled={disabled}
              onChange={e => set(x => { x.border.enabled = e.target.checked })} className="accent-purple-600" />
          </label>
          {design.border.enabled && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className={labelCls + ' mb-0'}>Colour</label>
                <input type="color" value={design.border.color} disabled={disabled}
                  onChange={e => onChange(patch(design, x => { x.border.color = e.target.value }))}
                  onBlur={() => onCommit?.(design)}
                  className="w-9 h-8 border border-gray-300 rounded cursor-pointer" />
              </div>
              <Range label="Thickness" suffix='"' value={design.border.width} min={DESIGN_LIMITS.borderWidth.min} max={DESIGN_LIMITS.borderWidth.max} step={DESIGN_LIMITS.borderWidth.step}
                onChange={v => onChange(patch(design, x => { x.border.width = v }))} />
              <Range label="Inset from edge" suffix='"' value={design.border.inset} min={DESIGN_LIMITS.borderInset.min} max={DESIGN_LIMITS.borderInset.max} step={DESIGN_LIMITS.borderInset.step}
                onChange={v => onChange(patch(design, x => { x.border.inset = v }))} />
              <p className="text-[11px] text-gray-400">Label sheets cut with up to 0.5&nbsp;mm of drift — keep the inset at 0.05&quot; or more so the border prints evenly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
