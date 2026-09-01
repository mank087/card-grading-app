/**
 * Label Wizard — Step 5: confirm & finish.
 *
 * Optional per-card label text edits (saved to cards.custom_label_data via the
 * existing endpoint, so corrections flow to the card page and collection),
 * then the finish line: download the print sheet for the chosen holder,
 * save the design for reuse, and set it as the account default.
 *
 * Downloads reuse the existing batch modals — the same sheet builders,
 * calibration, and position pickers the Collection page uses.
 */
'use client'

import React, { useMemo, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import { getCardLabelData } from '@/lib/useLabelData'
import type { CustomLabelConfig, SavedCustomStyle } from '@/lib/labelPresets'
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { BatchSlabLabelModal } from '@/components/reports/BatchSlabLabelModal'
import { BatchAveryLabelModal } from '@/components/reports/BatchAveryLabelModal'
import { BatchAvery8167LabelModal } from '@/components/reports/BatchAvery8167LabelModal'
import { MAX_SAVED_LABEL_STYLES } from '@/lib/labelPresets'
import { resolveCompactHeritage } from '@/lib/labels/labelStyleResolution'
import { baseConfigForStyle, sheetsNeeded, SLAB_SIZES, type HolderType, type SlabSizeId } from './wizardTypes'
import type { WizardTextEdits } from './useWizardData'
import CardSwiper from './CardSwiper'
import WizardPreview from './WizardPreview'

interface StepConfirmProps {
  holder: HolderType
  styleId: LabelStyleId
  config: CustomLabelConfig
  cards: any[]
  dataMap: Map<string, SlabLabelData>
  activeIndex: number
  onIndexChange: (index: number) => void
  isAuthenticated: boolean
  customStyles: SavedCustomStyle[]
  emblems: { showFounderEmblem: boolean; showVipEmblem: boolean; showCardLoversEmblem: boolean }
  textEdits: Record<string, WizardTextEdits>
  onTextEdit: (cardId: string, edits: WizardTextEdits) => void
  /** Save the working config — with an id, overwrites that saved slot. */
  onSaveDesign: (name: string, id?: string) => Promise<SavedCustomStyle | null>
  onDeleteDesign: (id: string) => Promise<void>
  onSetDefault: (id: LabelStyleId) => Promise<void>
  orgLogoColor?: string | null
  /** Called after text edits save so card objects refresh their overrides. */
  onTextSaved?: (cardId: string, fields: Record<string, any>) => void
  slabSize?: SlabSizeId
  toploaderVariant?: 'front-back' | 'foldover'
  /** Fired when a print sheet has been generated (drives the supplies step). */
  onDownloaded?: () => void
}

function editsFromCard(card: any): WizardTextEdits {
  const d = getCardLabelData(card)
  return {
    primaryName: d.primaryName || '',
    setName: d.setName || '',
    subset: d.subset || '',
    cardNumber: d.cardNumber || '',
    year: d.year || '',
    features: (d.features || []).join(', '),
  }
}

const HOLDER_DOWNLOAD_LABEL: Record<HolderType, string> = {
  slab: 'Download slab label sheet (PDF)',
  onetouch: 'Download One-Touch labels (Avery 6871)',
  toploader: 'Download Toploader labels (Avery 8167)',
}

export function StepConfirm({
  holder,
  styleId,
  config,
  cards,
  dataMap,
  activeIndex,
  onIndexChange,
  isAuthenticated,
  customStyles,
  emblems,
  textEdits,
  onTextEdit,
  onSaveDesign,
  onDeleteDesign,
  onSetDefault,
  orgLogoColor,
  onTextSaved,
  slabSize = 'standard',
  toploaderVariant = 'front-back',
  onDownloaded,
}: StepConfirmProps) {
  const [modal, setModal] = useState<'slab' | 'avery' | 'avery8167' | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [savingText, setSavingText] = useState(false)
  const [textSaveMsg, setTextSaveMsg] = useState<string | null>(null)
  const [designName, setDesignName] = useState('')
  const [savingDesign, setSavingDesign] = useState(false)
  const [savedDesignId, setSavedDesignId] = useState<LabelStyleId | null>(null)
  const [defaultMsg, setDefaultMsg] = useState<string | null>(null)

  const activeCard = cards[activeIndex]
  const activeEdits = activeCard
    ? textEdits[activeCard.id] ?? editsFromCard(activeCard)
    : null

  // Previews reflect the text fields LIVE (before and after saving): overlay
  // staged edits onto each card's label data the same way saved
  // custom_label_data is applied, then graft the text fields onto the built
  // SlabLabelData (QR, logos, sub-scores untouched).
  const previewDataMap = useMemo(() => {
    const editedIds = Object.keys(textEdits)
    if (editedIds.length === 0) return dataMap
    const next = new Map(dataMap)
    for (const card of cards) {
      const edits = textEdits[card.id]
      const base = dataMap.get(card.id)
      if (!edits || !base) continue
      const overlay = getCardLabelData({
        ...card,
        custom_label_data: {
          ...(edits.primaryName.trim() ? { primaryName: edits.primaryName } : {}),
          setName: edits.setName || null,
          subset: edits.subset || null,
          cardNumber: edits.cardNumber || null,
          year: edits.year || null,
          features: edits.features ? edits.features.split(',').map((f) => f.trim()).filter(Boolean) : [],
        },
      })
      next.set(card.id, {
        ...base,
        primaryName: overlay.primaryName,
        contextLine: overlay.contextLine,
        features: overlay.features,
        featuresLine: overlay.featuresLine,
      })
    }
    return next
  }, [dataMap, textEdits, cards])

  // Is the working config still exactly the base style, or customized?
  const isDirty = useMemo(() => {
    const base = { ...baseConfigForStyle(styleId, customStyles), side: config.side }
    return JSON.stringify(base) !== JSON.stringify(config)
  }, [styleId, customStyles, config])

  const isBuiltIn = styleId === 'heritage' || styleId === 'modern' || styleId === 'traditional'

  /**
   * Heritage Compact config for the small-holder sheets. Band colours stay
   * null when the design samples each card, so every label gets its own
   * palette — the same rule the slab Heritage batch uses. The working config
   * IS the selection here, so there is no style id to resolve against.
   */
  const compactHeritage = useMemo(() => resolveCompactHeritage(null, config), [config])

  const setField = (field: keyof WizardTextEdits, value: string) => {
    if (!activeCard || !activeEdits) return
    onTextEdit(activeCard.id, { ...activeEdits, [field]: value })
  }

  const handleSaveText = async () => {
    if (!isAuthenticated) {
      setTextSaveMsg('Sign in to save label edits to your own cards.')
      return
    }
    setSavingText(true)
    setTextSaveMsg(null)
    const session = getStoredSession()
    let saved = 0
    let failed = 0
    try {
      for (const card of cards) {
        const edits = textEdits[card.id]
        if (!edits) continue
        const baseline = getCardLabelData(card, { ignoreCustomOverrides: true })
        const parseFeatures = (s: string) => (s ? s.split(',').map((f) => f.trim()).filter(Boolean) : [])
        const customFields: Record<string, any> = {}
        if (edits.primaryName.trim() && edits.primaryName !== baseline.primaryName) customFields.primaryName = edits.primaryName
        if (edits.setName !== (baseline.setName || '')) customFields.setName = edits.setName || null
        if (edits.subset !== (baseline.subset || '')) customFields.subset = edits.subset || null
        if (edits.cardNumber !== (baseline.cardNumber || '')) customFields.cardNumber = edits.cardNumber || null
        if (edits.year !== (baseline.year || '')) customFields.year = edits.year || null
        const editedFeatures = parseFeatures(edits.features)
        if (JSON.stringify(editedFeatures) !== JSON.stringify(baseline.features || [])) customFields.features = editedFeatures

        // Nothing diverged from the generated baseline (and no prior override
        // to clear) — skip the round-trip.
        if (Object.keys(customFields).length === 0 && !card.custom_label_data) continue

        const res = await fetch(`/api/cards/${card.id}/custom-label`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ customFields }),
        })
        if (res.ok) {
          saved++
          onTextSaved?.(card.id, customFields)
        } else {
          failed++
        }
      }
      setTextSaveMsg(
        failed > 0
          ? `Saved ${saved}, ${failed} failed.`
          : saved > 0
            ? `Saved. These edits now appear everywhere the label${saved === 1 ? '' : 's'} show${saved === 1 ? 's' : ''} — card pages, your collection, and prints.`
            : 'Nothing to save — no fields differ from the generated label.',
      )
    } finally {
      setSavingText(false)
    }
  }

  const handleSaveDesign = async () => {
    const name = designName.trim() || 'My label design'
    setSavingDesign(true)
    try {
      const saved = await onSaveDesign(name)
      if (saved) {
        setSavedDesignId(saved.id as LabelStyleId)
        setDefaultMsg(null)
      }
    } finally {
      setSavingDesign(false)
    }
  }

  const handleOverwrite = async (style: SavedCustomStyle) => {
    if (!window.confirm(`Replace "${style.name}" with this design?`)) return
    setSavingDesign(true)
    try {
      const saved = await onSaveDesign(designName.trim() || style.name, style.id)
      if (saved) {
        setSavedDesignId(saved.id as LabelStyleId)
        setDefaultMsg(null)
      }
    } finally {
      setSavingDesign(false)
    }
  }

  const handleDelete = async (style: SavedCustomStyle) => {
    if (!window.confirm(`Delete "${style.name}"? Anything using it falls back to your default style.`)) return
    await onDeleteDesign(style.id)
    if (savedDesignId === style.id) setSavedDesignId(null)
  }

  const handleSetDefault = async () => {
    // Untouched selection (built-in OR a saved slot) targets itself; a
    // customized design must be saved to a slot first.
    const id = !isDirty ? styleId : savedDesignId
    if (!id) return
    await onSetDefault(id)
    setDefaultMsg('Done — this is now your default for slab labels and for One-Touch and Toploader labels.')
  }

  const canSetDefault = isAuthenticated && (!isDirty || savedDesignId !== null)

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Finish up</h2>
      <p className="text-sm text-gray-500 mb-5">
        {cards.length} card{cards.length === 1 ? '' : 's'} ·{' '}
        {holder === 'slab'
          ? `Graded slab (${(SLAB_SIZES.find((s) => s.id === slabSize) ?? SLAB_SIZES[0]).name})`
          : holder === 'onetouch'
            ? 'Magnetic One-Touch'
            : toploaderVariant === 'foldover'
              ? 'Toploader (Fold-over)'
              : 'Toploader (Front + Back)'}{' '}
        ·{' '}
        <span className="capitalize">{isBuiltIn ? styleId : 'Custom design'}</span>
        {isDirty && isBuiltIn ? ' (customized)' : ''}
      </p>

      <div className="lg:flex lg:gap-8">
        <div className="lg:flex-1 lg:order-2">
          <div className="lg:sticky lg:top-4">
            <CardSwiper
              count={cards.length}
              activeIndex={activeIndex}
              onIndexChange={onIndexChange}
              renderItem={(i) => (
                <WizardPreview card={cards[i]} data={previewDataMap.get(cards[i].id)} config={config} holder={holder} orgLogoColor={orgLogoColor} toploaderVariant={toploaderVariant} />
              )}
              caption={(i) => (
                <p className="text-xs text-gray-500 truncate">
                  {cards[i]?.card_name || `Card ${i + 1}`} · #{cards[i]?.serial}
                </p>
              )}
              thumbSrc={(i) => cards[i]?.front_url}
            />
          </div>
        </div>

        <div className="lg:w-[26rem] lg:shrink-0 lg:order-1 mt-6 lg:mt-0 space-y-5">
          {/* Optional text edits */}
          <section className="border border-gray-200 rounded-xl p-4">
            <button
              type="button"
              onClick={() => setEditingText((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">Check the label text</p>
                <p className="text-xs text-gray-500">Optional — edits save to the card and apply everywhere its label appears.</p>
              </div>
              <span className={`text-gray-400 transition-transform ${editingText ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {editingText && activeEdits && (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-purple-700 font-medium truncate">
                    Editing {activeIndex + 1} of {cards.length}: {activeCard?.card_name || `Card ${activeIndex + 1}`}
                  </p>
                  {cards.length > 1 && (
                    <span className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}
                        disabled={activeIndex === 0}
                        aria-label="Edit previous card"
                        className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:border-purple-400 disabled:opacity-30 text-sm"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => onIndexChange(Math.min(cards.length - 1, activeIndex + 1))}
                        disabled={activeIndex === cards.length - 1}
                        aria-label="Edit next card"
                        className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:border-purple-400 disabled:opacity-30 text-sm"
                      >
                        ›
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Tap a thumbnail under the preview to jump to any card.
                </p>
                {(
                  [
                    ['primaryName', 'Card name'],
                    ['setName', 'Set'],
                    ['subset', 'Subset'],
                    ['cardNumber', 'Card number'],
                    ['year', 'Year'],
                    ['features', 'Features (comma-separated)'],
                  ] as [keyof WizardTextEdits, string][]
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[11px] font-medium text-gray-500">{label}</span>
                    <input
                      type="text"
                      value={activeEdits[field]}
                      onChange={(e) => setField(field, e.target.value)}
                      className="mt-0.5 w-full px-3 py-1.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={handleSaveText}
                  disabled={savingText}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingText ? 'Saving…' : 'Save text edits to cards'}
                </button>
                {textSaveMsg && <p className="text-xs text-gray-600">{textSaveMsg}</p>}
              </div>
            )}
          </section>

          {/* Download */}
          <section className="border border-gray-200 rounded-xl p-4">
            <p className="font-semibold text-gray-900 text-sm mb-2">Print your labels</p>
            <button
              type="button"
              onClick={() => {
                setModal(holder === 'slab' ? 'slab' : holder === 'onetouch' ? 'avery' : 'avery8167')
                onDownloaded?.()
              }}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"
            >
              {holder === 'toploader' && toploaderVariant === 'foldover'
                ? 'Download Fold-Over Toploader labels (Avery 8167)'
                : HOLDER_DOWNLOAD_LABEL[holder]}
            </button>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {(() => {
                const n = sheetsNeeded(cards.length, holder, toploaderVariant === 'foldover')
                return `${cards.length} ${cards.length === 1 ? 'label' : 'labels'} — ${n} printed ${n === 1 ? 'sheet' : 'sheets'}. `
              })()}
              Print at 100% scale / Actual Size — the download dialog includes sheet options
              {holder !== 'slab' ? ' and label positions' : ' and fold-over format'}.
            </p>
          </section>

          {/* Save & defaults */}
          <section className="border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-gray-900 text-sm">Keep this design</p>
            {!isAuthenticated ? (
              <>
                <p className="text-xs text-gray-500">
                  {holder === 'slab'
                    ? 'Sign in to save this design for future cards and make it your default everywhere your slabs appear.'
                    : 'Sign in to save this design and reuse it next time you print these labels.'}
                </p>
                <a
                  href="/login?mode=signup"
                  className="block w-full py-2 text-center bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
                >
                  Sign in to save this design
                </a>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="Design name"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDesign}
                    disabled={savingDesign}
                    className="px-4 py-2 border-2 border-purple-600 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-50 disabled:opacity-50 shrink-0"
                  >
                    {savingDesign ? 'Saving…' : savedDesignId ? 'Saved ✓' : 'Save design'}
                  </button>
                </div>
                {slabSize === 'zion' && holder === 'slab' && (
                  <p className="text-[11px] text-gray-400">
                    Saves with Zion Mag Pro sizing (2.51&quot; × 0.76&quot;) — loading this design later restores that size.
                  </p>
                )}
                {/* Saved designs — manage the 4 slots without leaving the
                    wizard: overwrite one with the current design, or delete
                    to free a slot (the save endpoint refuses a 5th). */}
                {customStyles.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                      Your saved designs ({customStyles.length}/{MAX_SAVED_LABEL_STYLES})
                    </p>
                    {customStyles.length >= MAX_SAVED_LABEL_STYLES && !savedDesignId && (
                      <p className="text-[11px] text-amber-600 mb-1.5">
                        All {MAX_SAVED_LABEL_STYLES} slots are used — overwrite one with this design, or delete one to make room.
                      </p>
                    )}
                    <ul className="space-y-1">
                      {customStyles.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate text-gray-700">
                            {s.name}
                            {/* Sizing footnote — designs carry their own dimensions. */}
                            {Math.abs((s.config.width ?? 2.8) - 2.8) > 0.001 && (
                              <span className="ml-1.5 text-[10px] text-gray-400">
                                {s.config.width}&quot; × {s.config.height}&quot;
                                {Math.abs(s.config.width - 2.51) < 0.01 ? ' · Zion Mag Pro' : ''}
                              </span>
                            )}
                            {savedDesignId === s.id && <span className="ml-1.5 text-[10px] text-green-700 font-semibold">✓ this design</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOverwrite(s)}
                            disabled={savingDesign}
                            className="px-2 py-1 text-[11px] font-semibold text-purple-700 border border-purple-200 rounded-md hover:bg-purple-50 disabled:opacity-50"
                          >
                            Overwrite
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            aria-label={`Delete ${s.name}`}
                            className="px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-md hover:text-red-600 hover:border-red-200"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* One account-wide default, all three holders. Slab labels
                    follow it everywhere on the site — card details, My
                    Collection, the mobile apps — and the One-Touch and
                    Toploader sheets now follow it too, so a Heritage default
                    prints Heritage on the small holders without asking again. */}
                <button
                  type="button"
                  onClick={handleSetDefault}
                  disabled={!canSetDefault}
                  className="w-full py-2 border border-gray-300 text-gray-800 rounded-lg text-sm font-semibold hover:border-purple-400 disabled:opacity-50"
                >
                  Set as my default label style
                </button>
                <p className="text-[11px] text-gray-400">
                  Your default applies account-wide — slab labels and One-Touch / Toploader holder labels alike.
                </p>
                {isDirty && !savedDesignId && (
                  <p className="text-[11px] text-gray-400">
                    You customized this style — save it as a design first, then it can become your default.
                  </p>
                )}
                {defaultMsg && <p className="text-xs text-green-700">{defaultMsg}</p>}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Export modals — the same builders the Collection batch flow uses. */}
      {modal === 'slab' && (
        <BatchSlabLabelModal
          isOpen
          onClose={() => setModal(null)}
          selectedCards={cards}
          configOverride={config}
          showFounderEmblem={emblems.showFounderEmblem}
          showVipEmblem={emblems.showVipEmblem}
          showCardLoversEmblem={emblems.showCardLoversEmblem}
        />
      )}
      {modal === 'avery' && (
        <BatchAveryLabelModal isOpen onClose={() => setModal(null)} selectedCards={cards} heritage={compactHeritage} />
      )}
      {modal === 'avery8167' && (
        <BatchAvery8167LabelModal isOpen onClose={() => setModal(null)} selectedCards={cards} variant={toploaderVariant} heritage={compactHeritage} />
      )}
    </div>
  )
}

export default StepConfirm
