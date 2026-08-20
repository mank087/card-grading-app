/**
 * Label Wizard — Step 3: choose the style.
 *
 * Only styles the chosen holder actually supports are selectable; Heritage
 * shows as "on the way" for One-Touch/Toploader until Heritage Compact ships.
 * Tapping a style previews it live on card 1, and the swiper walks the whole
 * selection so the user sees the design on every card before committing.
 */
'use client'

import React from 'react'
import type { SavedCustomStyle } from '@/lib/labelPresets'
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { CustomLabelConfig } from '@/lib/labelPresets'
import { styleOptionsForHolder, type HolderType, type SlabSizeId } from './wizardTypes'
import CardSwiper from './CardSwiper'
import WizardPreview from './WizardPreview'

interface StepStyleProps {
  holder: HolderType
  styleId: LabelStyleId | null
  customStyles: SavedCustomStyle[]
  onSelect: (styleId: LabelStyleId) => void
  cards: any[]
  dataMap: Map<string, SlabLabelData>
  config: CustomLabelConfig
  activeIndex: number
  onIndexChange: (index: number) => void
  side: 'front' | 'back'
  onSideChange: (side: 'front' | 'back') => void
  orgLogoColor?: string | null
  slabSize?: SlabSizeId
  toploaderVariant?: 'front-back' | 'foldover'
  onToploaderVariantChange?: (variant: 'front-back' | 'foldover') => void
}

export function StepStyle({
  holder,
  styleId,
  customStyles,
  onSelect,
  cards,
  dataMap,
  config,
  activeIndex,
  onIndexChange,
  side,
  onSideChange,
  orgLogoColor,
  slabSize = 'standard',
  toploaderVariant = 'front-back',
  onToploaderVariantChange,
}: StepStyleProps) {
  const options = styleOptionsForHolder(holder, customStyles)

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Pick a label style</h2>
      <p className="text-sm text-gray-500 mb-1">
        Tap a style to see it on your {cards.length === 1 ? 'card' : `${cards.length} cards`} — swipe to check every one.
      </p>
      <p className="text-xs text-gray-400 mb-5">
        Just pick the base look here — colors, patterns, and everything else get customized in the next step.
      </p>

      <div className="flex flex-wrap gap-2.5 mb-6">
        {options.map((o) => {
          const active = styleId === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => !o.comingSoon && onSelect(o.id)}
              disabled={o.comingSoon}
              aria-pressed={active}
              title={o.blurb}
              className={`px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                active
                  ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                  : o.comingSoon
                    ? 'border-dashed border-gray-300 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:border-purple-400 bg-white'
              }`}
            >
              {o.name}
              {o.comingSoon && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide">soon</span>}
            </button>
          )
        })}
      </div>

      {/* Toploader label format — repeated from step 2 so the two layouts can
          be compared against a style without stepping back. */}
      {holder === 'toploader' && onToploaderVariantChange && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Label format</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['front-back', 'Front + Back pair', 'Two labels per card'],
              ['foldover', 'Fold-over', 'One label folded over the top edge'],
            ] as const).map(([v, name, hint]) => (
              <button
                key={v}
                type="button"
                onClick={() => onToploaderVariantChange(v)}
                aria-pressed={toploaderVariant === v}
                title={hint}
                className={`px-3.5 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                  toploaderVariant === v
                    ? 'border-purple-600 bg-purple-50 text-purple-800'
                    : 'border-gray-300 text-gray-700 hover:border-purple-400 bg-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {slabSize === 'zion' && holder === 'slab' && (
        <p className="mb-4 px-3.5 py-2.5 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
          Zion Mag Pro sizing is on — every style previews and prints at 2.51&quot; × 0.76&quot;.
        </p>
      )}

      {styleId ? (
        <>
          {holder === 'slab' && (
            <div className="flex justify-center mb-3">
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {(['front', 'back'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSideChange(s)}
                    aria-pressed={side === s}
                    className={`px-4 py-1.5 font-medium capitalize ${
                      side === s ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <CardSwiper
            count={cards.length}
            activeIndex={activeIndex}
            onIndexChange={onIndexChange}
            renderItem={(i) => (
              <WizardPreview
                card={cards[i]}
                data={dataMap.get(cards[i].id)}
                config={config}
                holder={holder}
                orgLogoColor={orgLogoColor} toploaderVariant={toploaderVariant}
              />
            )}
            caption={(i) => (
              <p className="text-xs text-gray-500 truncate">
                {cards[i]?.card_name || cards[i]?.conversational_card_info?.card_name || `Card ${i + 1}`} · #{cards[i]?.serial}
              </p>
            )}
            thumbSrc={(i) => cards[i]?.front_url}
          />
        </>
      ) : (
        <div className="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-300 rounded-xl">
          Choose a style above to preview it on your cards.
        </div>
      )}
    </div>
  )
}

export default StepStyle
