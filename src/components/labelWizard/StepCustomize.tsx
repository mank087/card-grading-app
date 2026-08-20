/**
 * Label Wizard — Step 4: customize the design.
 *
 * The preview pager stays pinned while every control edits the live config.
 * Modern/Traditional carry the classic studio's full color system: theme
 * presets, your-colors palette (add/remove up to 5), layout styles (gradient,
 * extension, neon, geometric, split) surfaced by default, geometric pattern
 * variants (shattered glass, mosaic grid, ...), gradient angle, text
 * polarity, grade color with the contrast warning, size, and border.
 * Heritage gets band source + pattern. Eyedropper/card-sampled themes and
 * per-grade chip colors remain Classic-mode power tools.
 */
'use client'

import React, { useMemo } from 'react'
import {
  COLOR_PRESETS,
  LAYOUT_STYLES,
  GEOMETRIC_PATTERNS,
  FONT_SCALE_PRESETS,
  applyLayoutToColors,
  configBackgroundStops,
  resolveConfigTextPolarity,
  type CustomLabelConfig,
} from '@/lib/labelPresets'
import { contrastRatioHex } from '@/lib/contrastWCAG'
import { BAND_PATTERNS } from '@/lib/labelLab/bandGeometry'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { HolderType } from './wizardTypes'
import CardSwiper from './CardSwiper'
import WizardPreview, { heritageBandColorsForCard } from './WizardPreview'

const GRADE_COLOR_SWATCHES = ['#c8a02c', '#dc2626', '#2563eb', '#16a34a', '#101014', '#7c3aed', '#ffffff']

/** Layout ids double as colorPreset ids once applied (applyLayoutToColors). */
const LAYOUT_IDS = LAYOUT_STYLES.map((l) => l.id) as string[]

interface StepCustomizeProps {
  holder: HolderType
  cards: any[]
  dataMap: Map<string, SlabLabelData>
  config: CustomLabelConfig
  onPatch: (patch: Partial<CustomLabelConfig>) => void
  activeIndex: number
  onIndexChange: (index: number) => void
  side: 'front' | 'back'
  onSideChange: (side: 'front' | 'back') => void
  orgLogoColor?: string | null
  toploaderVariant?: 'front-back' | 'foldover'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{children}</p>
}

function Chip({
  active,
  onClick,
  children,
  title,
  small,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg border font-medium transition-colors ${
        active ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300 text-gray-700 hover:border-purple-400 bg-white'
      }`}
    >
      {children}
    </button>
  )
}

export function StepCustomize({
  holder,
  cards,
  dataMap,
  config,
  onPatch,
  activeIndex,
  onIndexChange,
  side,
  onSideChange,
  orgLogoColor,
  toploaderVariant = 'front-back',
}: StepCustomizeProps) {
  const isHeritage = config.style === 'heritage'
  const activeCard = cards[activeIndex]

  // ------------------------------------------------------------------ shared
  const pager = (
    <CardSwiper
      count={cards.length}
      activeIndex={activeIndex}
      onIndexChange={onIndexChange}
      renderItem={(i) => (
        <WizardPreview card={cards[i]} data={dataMap.get(cards[i].id)} config={config} holder={holder} orgLogoColor={orgLogoColor} toploaderVariant={toploaderVariant} />
      )}
      caption={(i) => (
        <p className="text-xs text-gray-500 truncate">
          {cards[i]?.card_name || `Card ${i + 1}`} · #{cards[i]?.serial}
        </p>
      )}
      thumbSrc={(i) => cards[i]?.front_url}
    />
  )

  const sideToggle = (
    <div className="flex justify-center mb-2.5">
      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
        {(['front', 'back'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSideChange(s)}
            aria-pressed={side === s}
            className={`px-4 py-1.5 font-medium capitalize ${side === s ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )

  // --------------------------------------------------------------- heritage
  const bandMode: 'card' | 'brand' | 'custom' =
    config.heritageBandColors && config.heritageBandColors.length >= 2
      ? 'custom'
      : config.heritageColorSource === 'brand'
        ? 'brand'
        : 'card'

  const setBandMode = (mode: 'card' | 'brand' | 'custom') => {
    if (mode === 'custom') {
      const seed = heritageBandColorsForCard(activeCard, { ...config, heritageBandColors: undefined })
      onPatch({ heritageBandColors: seed.slice(0, 5), heritageColorSource: 'card' })
    } else {
      onPatch({ heritageBandColors: undefined, heritageColorSource: mode })
    }
  }

  // ------------------------------------------------------- modern/traditional
  /** The palette the layout system operates on. Presets contribute their two
      gradient stops until the user picks their own colors. */
  const paletteColors = useMemo(
    () => (config.customColors && config.customColors.length > 0 ? config.customColors : [config.gradientStart, config.gradientEnd]),
    [config.customColors, config.gradientStart, config.gradientEnd],
  )

  const activeLayout = LAYOUT_IDS.includes(config.colorPreset)
    ? config.colorPreset
    : config.layoutStyle && LAYOUT_IDS.includes(config.layoutStyle)
      ? config.layoutStyle
      : 'color-gradient'

  const applyColors = (colors: string[], layout: string = activeLayout) => {
    onPatch({ customColors: colors, layoutStyle: layout, ...applyLayoutToColors(layout, colors) })
  }

  const setPaletteColor = (i: number, hex: string) => {
    const next = [...paletteColors]
    next[i] = hex
    applyColors(next)
  }

  const addPaletteColor = () => {
    if (paletteColors.length >= 5) return
    applyColors([...paletteColors, paletteColors[paletteColors.length - 1] || '#7c3aed'])
  }

  const removePaletteColor = (i: number) => {
    if (paletteColors.length <= 1) return
    applyColors(paletteColors.filter((_, idx) => idx !== i))
  }

  const gradeContrast = useMemo(() => {
    const c = config.gradeColor
    if (!c || c === 'auto' || isHeritage) return null
    const { stops } = configBackgroundStops(config)
    const worst = Math.min(...stops.map((s) => contrastRatioHex(c, s)))
    return worst < 3 ? worst : null
  }, [config, isHeritage])

  const showAngle = activeLayout === 'color-gradient' || config.colorPreset === 'custom' || config.colorPreset === 'color-gradient'

  const controls = (
    <div className="space-y-6">
      {isHeritage ? (
        <>
          <div>
            <SectionLabel>Band colors</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <Chip active={bandMode === 'card'} onClick={() => setBandMode('card')}>
                Each card&apos;s own colors
              </Chip>
              <Chip active={bandMode === 'brand'} onClick={() => setBandMode('brand')}>
                DCM brand purples
              </Chip>
              <Chip active={bandMode === 'custom'} onClick={() => setBandMode('custom')}>
                Custom palette
              </Chip>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {bandMode === 'card'
                ? 'Every card gets a band sampled from its own artwork — flip through the preview to see each one.'
                : bandMode === 'brand'
                  ? 'All cards share the DCM purple band.'
                  : 'All cards share this palette. Tap a swatch to edit, ✕ to remove.'}
            </p>
            {bandMode === 'custom' && (
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {(config.heritageBandColors || []).map((c, i) => (
                  <span key={i} className="relative">
                    <label className="relative block cursor-pointer" title={`Band color ${i + 1}`}>
                      <span className="block w-9 h-9 rounded-lg border border-gray-300 shadow-sm" style={{ background: c }} />
                      <input
                        type="color"
                        value={c}
                        onChange={(e) => {
                          const next = [...(config.heritageBandColors || [])]
                          next[i] = e.target.value
                          onPatch({ heritageBandColors: next })
                        }}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        aria-label={`Band color ${i + 1}`}
                      />
                    </label>
                    {(config.heritageBandColors || []).length > 2 && (
                      <button
                        type="button"
                        onClick={() => onPatch({ heritageBandColors: (config.heritageBandColors || []).filter((_, idx) => idx !== i) })}
                        aria-label={`Remove band color ${i + 1}`}
                        className="absolute -top-1.5 -right-1.5 min-w-[20px] min-h-[20px] rounded-full bg-gray-700 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 after:content-[''] after:absolute after:-inset-2"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                {(config.heritageBandColors || []).length < 5 && (
                  <button
                    type="button"
                    onClick={() =>
                      onPatch({ heritageBandColors: [...(config.heritageBandColors || []), '#7c3aed'] })
                    }
                    aria-label="Add band color"
                    className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-600 text-lg leading-none"
                  >
                    +
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Band pattern</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {BAND_PATTERNS.map((p) => (
                <Chip
                  key={p.id}
                  small
                  active={(config.heritagePattern || 'diamond') === p.id}
                  onClick={() => onPatch({ heritagePattern: p.id })}
                  title={p.note}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Per-grade chip colors and more live in{' '}
            <a href="/labels/classic" className="underline hover:text-purple-600">
              Classic design mode
            </a>
            .
          </p>
        </>
      ) : (
        <>
          <div>
            <SectionLabel>Color theme</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.filter((p) => !p.isCardColors && !p.isCustom).map((p) => (
                <Chip
                  key={p.id}
                  small
                  active={config.colorPreset === p.id}
                  onClick={() =>
                    onPatch({
                      colorPreset: p.id,
                      gradientStart: p.gradientStart,
                      gradientEnd: p.gradientEnd,
                      topEdgeGradient: undefined,
                      customColors: undefined,
                      borderEnabled: config.borderEnabled,
                    })
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10"
                      style={{
                        background: p.isRainbow
                          ? 'linear-gradient(90deg,#ff0000,#ffff00,#00cc00,#0066ff,#ff00ff)'
                          : `linear-gradient(135deg, ${p.gradientStart}, ${p.gradientEnd})`,
                      }}
                    />
                    {p.name}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Your colors</SectionLabel>
            <div className="flex gap-2 flex-wrap items-center">
              {paletteColors.map((c, i) => (
                <span key={i} className="relative">
                  <label className="relative block cursor-pointer" title={`Color ${i + 1}`}>
                    <span className="block w-9 h-9 rounded-lg border border-gray-300 shadow-sm" style={{ background: c }} />
                    <input
                      type="color"
                      value={c || '#7c3aed'}
                      onChange={(e) => setPaletteColor(i, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      aria-label={`Custom color ${i + 1}`}
                    />
                  </label>
                  {paletteColors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePaletteColor(i)}
                      aria-label={`Remove color ${i + 1}`}
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] min-h-[20px] rounded-full bg-gray-700 text-white text-[10px] leading-none flex items-center justify-center hover:bg-red-600 after:content-[''] after:absolute after:-inset-2"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {paletteColors.length < 5 && (
                <button
                  type="button"
                  onClick={addPaletteColor}
                  aria-label="Add color"
                  className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-600 text-lg leading-none"
                >
                  +
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Up to 5 colors. Tap to edit, ✕ to remove — the layout below decides how they combine.
            </p>
          </div>

          <div>
            <SectionLabel>Layout style</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {LAYOUT_STYLES.map((l) => (
                <Chip key={l.id} small active={activeLayout === l.id && LAYOUT_IDS.includes(config.colorPreset)} onClick={() => applyColors(paletteColors, l.id)}>
                  {l.icon} {l.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Pattern style</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {GEOMETRIC_PATTERNS.map((g) => (
                <Chip
                  key={g.id}
                  small
                  active={config.colorPreset === 'geometric' && (config.geometricPattern ?? 0) === g.id}
                  onClick={() => {
                    // Picking a pattern implies the Geometric layout.
                    onPatch({ geometricPattern: g.id, layoutStyle: 'geometric', ...applyLayoutToColors('geometric', paletteColors), customColors: paletteColors })
                  }}
                >
                  {g.name}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Patterns use the Geometric layout with your colors.</p>
          </div>

          {showAngle && (
            <div>
              <SectionLabel>Gradient angle</SectionLabel>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={config.gradientAngle ?? 135}
                  onChange={(e) => onPatch({ gradientAngle: Number(e.target.value) })}
                  className="flex-1 accent-purple-600"
                  aria-label="Gradient angle"
                />
                <span className="text-xs text-gray-500 w-10 text-right tabular-nums">{config.gradientAngle ?? 135}°</span>
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Text color</SectionLabel>
            <div className="flex gap-2">
              {(['auto', 'light', 'dark'] as const).map((m) => (
                <Chip key={m} active={(config.textColorMode || 'auto') === m} onClick={() => onPatch({ textColorMode: m })}>
                  <span className="capitalize">{m}</span>
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Auto picks the most readable text for your colors — resolved:{' '}
              <span className="font-medium">{resolveConfigTextPolarity(config)}</span>.
            </p>
          </div>

          <div>
            <SectionLabel>Grade color</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              <Chip active={!config.gradeColor || config.gradeColor === 'auto'} onClick={() => onPatch({ gradeColor: undefined })}>
                Auto
              </Chip>
              {GRADE_COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onPatch({ gradeColor: c })}
                  aria-label={`Grade color ${c}`}
                  className={`w-8 h-8 rounded-full border-2 ${config.gradeColor === c ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-300'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            {gradeContrast !== null && (
              <p className="text-xs text-amber-600 mt-1.5">
                ⚠ Low contrast ({gradeContrast.toFixed(1)}:1) — this grade color may be hard to read on your background.
              </p>
            )}
          </div>

          <div>
            <SectionLabel>Grade & text size</SectionLabel>
            <div className="flex gap-2">
              {FONT_SCALE_PRESETS.map((f) => (
                <Chip key={f.id} active={(config.fontScale || 1) === f.scale} onClick={() => onPatch({ fontScale: f.scale })}>
                  {f.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Border</SectionLabel>
            <div className="flex items-center gap-3">
              <Chip active={config.borderEnabled} onClick={() => onPatch({ borderEnabled: !config.borderEnabled })}>
                {config.borderEnabled ? 'On' : 'Off'}
              </Chip>
              {config.borderEnabled && (
                <label className="relative cursor-pointer" title="Border color">
                  <span className="block w-9 h-9 rounded-lg border border-gray-300 shadow-sm" style={{ background: config.borderColor }} />
                  <input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => onPatch({ borderColor: e.target.value })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    aria-label="Border color"
                  />
                </label>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Eyedropper, card-sampled themes, and custom dimensions live in{' '}
            <a href="/labels/classic" className="underline hover:text-purple-600">
              Classic design mode
            </a>
            .
          </p>
        </>
      )}
    </div>
  )

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Make it yours</h2>
      <p className="text-sm text-gray-500 mb-5">Every change updates the preview live — flip through your cards to check each one.</p>

      {holder !== 'slab' && !isHeritage ? (
        <div>
          <div className="mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            The {holder === 'onetouch' ? 'One-Touch' : 'Toploader'} label prints in the Modern layout shown below.
            Pick Heritage in the previous step for band colors and patterns on this holder.
          </div>
          {pager}
        </div>
      ) : (
        <div className="lg:flex lg:gap-8">
          {/* Pinned preview — top on mobile, right on desktop */}
          <div className="lg:order-2 lg:flex-1 lg:min-w-0">
            <div className="lg:sticky lg:top-4">
              {/* Small holders get their front/back toggle from LabelMockup
                  itself, so only the slab composite needs one here. */}
              {holder === 'slab' && sideToggle}
              {pager}
            </div>
          </div>
          <div className="lg:order-1 lg:w-[24rem] lg:shrink-0 mt-6 lg:mt-0 min-w-0">{controls}</div>
        </div>
      )}
    </div>
  )
}

export default StepCustomize
