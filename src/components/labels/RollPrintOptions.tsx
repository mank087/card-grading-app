'use client'

/**
 * Roll label-printer options (Oct 2026): roll size, black & white (thermal)
 * toggle, and the one line of print guidance that makes a roll print come out
 * at true size. Shared by the Label Studio gallery, the custom designer and the
 * batch slab modal. Choices persist in localStorage (rollLabelPrefs).
 */
import React from 'react'
import {
  ROLL_SIZES,
  storeRollMono,
  storeRollSize,
  rollPrintGuidance,
  type RollSize,
} from '@/lib/labels/rollLabelPrefs'

export function RollPrintOptions({
  size,
  mono,
  onSizeChange,
  onMonoChange,
  compact = false,
}: {
  size: RollSize
  mono: boolean
  onSizeChange: (size: RollSize) => void
  onMonoChange: (mono: boolean) => void
  /** Tighter type for the small gallery popover. */
  compact?: boolean
}) {
  const text = compact ? 'text-[10px]' : 'text-xs'
  return (
    <div className={`${text} space-y-1.5`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1 text-gray-600">
          Roll
          <select
            value={size}
            onChange={(e) => {
              const next = e.target.value as RollSize
              storeRollSize(next)
              onSizeChange(next)
            }}
            className={`border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-900 ${text}`}
          >
            {(Object.keys(ROLL_SIZES) as RollSize[]).map((k) => (
              <option key={k} value={k}>{ROLL_SIZES[k].label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={mono}
            onChange={(e) => {
              storeRollMono(e.target.checked)
              onMonoChange(e.target.checked)
            }}
          />
          Black &amp; white (thermal)
        </label>
      </div>
      <p className="text-gray-500 leading-snug">{rollPrintGuidance(size)}</p>
    </div>
  )
}
