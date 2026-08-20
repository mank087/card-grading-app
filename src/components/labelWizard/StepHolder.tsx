/**
 * Label Wizard — Step 2: choose the holder.
 *
 * Three large cards with the real product photography, each stating physical
 * label size and the paper stock it prints on. Holder type constrains every
 * later step, which is why it comes before style.
 *
 * The Graded Slab card carries a size option below it: Standard (2.8" × 0.8",
 * the default) or Zion Mag Pro (2.51" × 0.76") for the smaller slot in those
 * cases. It's a sibling of the card button — not nested — so toggling it never
 * triggers the card's auto-advance.
 */
'use client'

import React from 'react'
import { HOLDERS, SLAB_SIZES, type HolderType, type SlabSizeId } from './wizardTypes'

interface StepHolderProps {
  holder: HolderType | null
  onSelect: (holder: HolderType) => void
  slabSize: SlabSizeId
  onSlabSizeChange: (size: SlabSizeId) => void
  toploaderVariant: 'front-back' | 'foldover'
  onToploaderVariantChange: (variant: 'front-back' | 'foldover') => void
}

export function StepHolder({
  holder,
  onSelect,
  slabSize,
  onSlabSizeChange,
  toploaderVariant,
  onToploaderVariantChange,
}: StepHolderProps) {
  const zion = SLAB_SIZES.find((s) => s.id === 'zion')!
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">What are these cards going into?</h2>
      <p className="text-sm text-gray-500 mb-5">The holder decides the label size and the sheet it prints on.</p>

      <div className="grid sm:grid-cols-3 gap-4 items-start">
        {HOLDERS.map((h) => {
          const active = holder === h.id
          return (
            <div key={h.id}>
              <button
                type="button"
                onClick={() => onSelect(h.id)}
                aria-pressed={active}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  active ? 'border-purple-600 bg-purple-50 shadow-sm' : 'border-gray-200 hover:border-purple-300 bg-white'
                }`}
              >
                <div className="h-40 flex items-center justify-center mb-3 bg-gray-50 rounded-lg overflow-hidden">
                  <img src={h.image} alt={h.name} className="max-h-36 w-auto object-contain" loading="lazy" />
                </div>
                <p className="font-bold text-gray-900">{h.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {h.id === 'slab'
                    ? `${(SLAB_SIZES.find((s) => s.id === slabSize) ?? SLAB_SIZES[0]).width}" × ${(SLAB_SIZES.find((s) => s.id === slabSize) ?? SLAB_SIZES[0]).height}" label · ${h.stock}`
                    : `${h.dimensions} · ${h.stock}`}
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-snug">{h.blurb}</p>
              </button>

              {h.id === 'toploader' && (
                <div className="mt-2 flex gap-1.5">
                  {([
                    ['front-back', 'Front + Back pair'],
                    ['foldover', 'Fold-over'],
                  ] as const).map(([v, name]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onToploaderVariantChange(v)}
                      aria-pressed={toploaderVariant === v}
                      className={`flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        toploaderVariant === v
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-purple-400 bg-white'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {h.id === 'slab' && (
                <label className="mt-2 flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 cursor-pointer hover:border-purple-300">
                  <input
                    type="checkbox"
                    checked={slabSize === 'zion'}
                    onChange={(e) => onSlabSizeChange(e.target.checked ? 'zion' : 'standard')}
                    className="mt-0.5 w-4 h-4 accent-purple-600"
                  />
                  <span className="text-xs text-gray-700 leading-snug">
                    <span className="font-semibold">Zion Mag Pro size</span> — {zion.width}&quot; × {zion.height}&quot; for the
                    smaller Zion slot. Leave unchecked for the standard 2.8&quot; × 0.8&quot; label.
                  </span>
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StepHolder
