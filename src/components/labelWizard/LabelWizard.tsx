/**
 * Label Wizard — the five-step flow that replaced the single-page studio at
 * /labels (the original lives on at /labels/classic).
 *
 *   1 Cards → 2 Holder → 3 Style → 4 Customize → 5 Finish
 *
 * One reducer owns the whole design (wizardTypes.ts); per-card label data is
 * assembled once (useWizardData); previews render through the same pipelines
 * the exports use, so what you swipe through is what prints.
 */
'use client'

import React, { useEffect, useMemo, useReducer, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCustomLabelStyle, type LabelStyleId } from '@/hooks/useCustomLabelStyle'
import {
  initialWizardState,
  wizardReducer,
  stepBlocker,
  MAX_WIZARD_CARDS,
  type WizardStep,
} from './wizardTypes'
import { useWizardData, type WizardTextEdits } from './useWizardData'
import StepCards from './StepCards'
import StepHolder from './StepHolder'
import StepStyle from './StepStyle'
import StepCustomize from './StepCustomize'
import StepConfirm from './StepConfirm'
import StepSupplies from './StepSupplies'

const STEPS: { n: WizardStep; name: string; optional?: boolean }[] = [
  { n: 1, name: 'Cards' },
  { n: 2, name: 'Holder' },
  { n: 3, name: 'Style' },
  { n: 4, name: 'Customize' },
  { n: 5, name: 'Finish' },
  { n: 6, name: 'Supplies', optional: true },
]

interface LabelWizardProps {
  cards: any[]
  isAuthenticated: boolean
}

export default function LabelWizard({ cards, isAuthenticated }: LabelWizardProps) {
  const searchParams = useSearchParams()
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState)
  const { customStyles, saveCustomStyle, deleteCustomStyle, switchStyle } = useCustomLabelStyle()
  const wizardData = useWizardData(state.cards, isAuthenticated)
  const [textEdits, setTextEdits] = useState<Record<string, WizardTextEdits>>({})
  // Local copy of card objects so saved text edits reflect immediately in
  // previews without a refetch.
  const [cardPatches, setCardPatches] = useState<Record<string, Record<string, any>>>({})
  // Set once a label sheet has been generated — tunes the step 5 → 6 CTA and
  // the supplies-step intro copy.
  const [hasDownloaded, setHasDownloaded] = useState(false)

  // Deep link: /labels?card=<serial> preselects that card.
  useEffect(() => {
    const serial = searchParams.get('card')
    if (!serial) return
    const card = cards.find((c) => String(c.serial) === serial)
    if (card && !state.cards.some((c) => c.id === card.id)) {
      dispatch({ type: 'TOGGLE_CARD', card })
    }
    // Run once per mount — cards arrive with the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards])

  // Mobile: Continue sits at the bottom of the page, so a step change would
  // otherwise land the user mid-scroll on the next step. Always start each
  // step at the top (covers Continue, Back, stepper jumps, and the holder
  // auto-advance alike).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [state.step])

  const patchedSelected = useMemo(
    () =>
      state.cards.map((c) =>
        cardPatches[c.id] ? { ...c, custom_label_data: cardPatches[c.id] } : c,
      ),
    [state.cards, cardPatches],
  )

  const blocker = stepBlocker(state)
  const orgLogoColor = wizardData.orgLogos?.color ?? null

  const goTo = (step: WizardStep) => dispatch({ type: 'SET_STEP', step })
  const next = () => {
    if (blocker) return
    // Step 2 auto-advances on holder pick; the button still works as expected.
    goTo(Math.min(6, state.step + 1) as WizardStep)
  }
  const back = () => goTo(Math.max(1, state.step - 1) as WizardStep)

  /** Highest step the user can jump to from the header. Step 6 (supplies) is
   *  optional but always reachable once a design exists. */
  const maxReachable: WizardStep = state.styleId
    ? 6
    : state.holder
      ? 3
      : state.cards.length > 0
        ? 2
        : 1

  return (
    // touch-action: manipulation removes the double-tap-to-zoom delay on all
    // the wizard's chips and buttons without disabling pinch-zoom.
    <div className="min-h-screen bg-gray-50" style={{ touchAction: 'manipulation' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Label Studio: Custom Slab Labels for Your Cards</h1>
            <p className="text-sm text-gray-500">Design labels for up to {MAX_WIZARD_CARDS} cards in five quick steps.</p>
          </div>
          <Link
            href="/labels/classic"
            className="text-sm text-gray-500 hover:text-purple-700 underline underline-offset-2"
          >
            Classic design mode
          </Link>
        </div>

        {/* Stepper */}
        <nav aria-label="Wizard steps" className="mb-6">
          <ol className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((s, i) => {
              const status = s.n === state.step ? 'current' : s.n <= maxReachable ? 'done' : 'todo'
              return (
                <li key={s.n} className="flex items-center gap-1 sm:gap-2">
                  {i > 0 && <span className="w-4 sm:w-8 h-px bg-gray-300" aria-hidden />}
                  <button
                    type="button"
                    onClick={() => s.n <= maxReachable && goTo(s.n)}
                    disabled={s.n > maxReachable}
                    aria-current={status === 'current' ? 'step' : undefined}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      status === 'current'
                        ? 'text-purple-700'
                        : status === 'done'
                          ? 'text-gray-600 hover:text-purple-600'
                          : 'text-gray-300 cursor-default'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs ${
                        status === 'current'
                          ? 'bg-purple-600 text-white'
                          : status === 'done'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {s.n}
                    </span>
                    <span className="hidden sm:inline">
                      {s.name}
                      {s.optional && <span className="ml-1 font-normal text-[10px] text-gray-400">optional</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Step body */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          {state.step === 1 && (
            <StepCards
              cards={cards}
              selected={state.cards}
              onToggle={(card) => dispatch({ type: 'TOGGLE_CARD', card })}
              onRemove={(cardId) => dispatch({ type: 'REMOVE_CARD', cardId })}
              isAuthenticated={isAuthenticated}
            />
          )}
          {state.step === 2 && (
            <StepHolder
              holder={state.holder}
              onSelect={(holder) => dispatch({ type: 'SET_HOLDER', holder })}
              slabSize={state.slabSize}
              onSlabSizeChange={(size) => dispatch({ type: 'SET_SLAB_SIZE', size })}
              toploaderVariant={state.toploaderVariant}
              onToploaderVariantChange={(variant) => dispatch({ type: 'SET_TOPLOADER_VARIANT', variant })}
            />
          )}
          {state.step === 3 && state.holder && (
            <StepStyle
              holder={state.holder}
              styleId={state.styleId}
              customStyles={customStyles}
              onSelect={(styleId) => dispatch({ type: 'SET_STYLE', styleId, customStyles })}
              cards={patchedSelected}
              dataMap={wizardData.dataMap}
              config={state.config}
              activeIndex={state.activeIndex}
              onIndexChange={(index) => dispatch({ type: 'SET_ACTIVE_INDEX', index })}
              side={state.side}
              onSideChange={(side) => dispatch({ type: 'SET_SIDE', side })}
              orgLogoColor={orgLogoColor}
              slabSize={state.slabSize}
              toploaderVariant={state.toploaderVariant}
              onToploaderVariantChange={(variant) => dispatch({ type: 'SET_TOPLOADER_VARIANT', variant })}
            />
          )}
          {state.step === 4 && state.holder && (
            <StepCustomize
              holder={state.holder}
              cards={patchedSelected}
              dataMap={wizardData.dataMap}
              config={state.config}
              onPatch={(patch) => dispatch({ type: 'PATCH_CONFIG', patch })}
              activeIndex={state.activeIndex}
              onIndexChange={(index) => dispatch({ type: 'SET_ACTIVE_INDEX', index })}
              side={state.side}
              onSideChange={(side) => dispatch({ type: 'SET_SIDE', side })}
              orgLogoColor={orgLogoColor}
              toploaderVariant={state.toploaderVariant}
            />
          )}
          {state.step === 5 && state.holder && state.styleId && (
            <StepConfirm
              holder={state.holder}
              styleId={state.styleId}
              config={state.config}
              cards={patchedSelected}
              dataMap={wizardData.dataMap}
              activeIndex={state.activeIndex}
              onIndexChange={(index) => dispatch({ type: 'SET_ACTIVE_INDEX', index })}
              isAuthenticated={isAuthenticated}
              customStyles={customStyles}
              emblems={wizardData.emblems}
              textEdits={textEdits}
              onTextEdit={(cardId, edits) => setTextEdits((prev) => ({ ...prev, [cardId]: edits }))}
              onSaveDesign={(name, id) => saveCustomStyle({ id, name, config: state.config })}
              onDeleteDesign={deleteCustomStyle}
              onSetDefault={(id: LabelStyleId) => switchStyle(id)}
              orgLogoColor={orgLogoColor}
              onTextSaved={(cardId, fields) => setCardPatches((prev) => ({ ...prev, [cardId]: fields }))}
              slabSize={state.slabSize}
              toploaderVariant={state.toploaderVariant}
              onDownloaded={() => setHasDownloaded(true)}
            />
          )}
          {state.step === 6 && (
            <StepSupplies holder={state.holder} slabSize={state.slabSize} hasDownloaded={hasDownloaded} />
          )}
        </div>
        {/* Step nav — in the page flow: below the step content, above the
            site footer. No floating chrome to fight the chat bubble. */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={state.step === 1}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-purple-400 disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {blocker ? (
              <p className="text-xs text-gray-400 truncate">{blocker}</p>
            ) : state.step === 1 ? (
              <p className="text-xs text-gray-400">
                {state.cards.length} card{state.cards.length === 1 ? '' : 's'} selected
              </p>
            ) : null}
            {state.step < 5 && (
              <button
                type="button"
                onClick={next}
                disabled={Boolean(blocker)}
                className="px-6 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-40"
              >
                Continue
              </button>
            )}
            {/* Step 6 is opt-in: a quiet secondary action, not the primary
                path — the user's job is done once the labels download. */}
            {state.step === 5 && (
              <button
                type="button"
                onClick={next}
                className="px-5 py-2.5 rounded-lg border border-purple-300 text-purple-700 text-sm font-semibold hover:bg-purple-50"
              >
                {hasDownloaded ? 'What else do I need?' : 'Slabs & supplies'}
              </button>
            )}
            {state.step === 6 && (
              <Link
                href="/collection"
                className="px-6 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700"
              >
                Done
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
