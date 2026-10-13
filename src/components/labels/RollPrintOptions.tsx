'use client'

/**
 * Roll label-printer options (Oct 2026): roll size, black & white (thermal)
 * toggle, and the one line of print guidance that makes a roll print come out
 * at true size. Shared by the Label Studio gallery, the custom designer and the
 * batch slab modal. Choices persist in localStorage (rollLabelPrefs).
 */
import React, { useState } from 'react'
import {
  ROLL_SIZES,
  storeRollMono,
  storeRollSize,
  rollPrintGuidance,
  readStoredRollOffset,
  storeRollOffset,
  clampRollOffset,
  type RollOffsetMm,
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
      <RollOffsetControls text={text} />
      <p className="text-gray-500 leading-snug">{rollPrintGuidance(size)}</p>
    </div>
  )
}

/**
 * Print position nudge, in mm, saved in this browser. Thermal drivers often
 * have no offset setting; if the label prints too high, move it down.
 */
function RollOffsetControls({ text }: { text: string }) {
  const [offset, setOffset] = useState<RollOffsetMm>(() => readStoredRollOffset())
  const update = (next: RollOffsetMm) => {
    const clean = { x: clampRollOffset(next.x), y: clampRollOffset(next.y) }
    storeRollOffset(clean)
    setOffset(clean)
  }
  const btn = `border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700 hover:bg-gray-50 ${text}`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
      <span>Position:</span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => update({ ...offset, y: offset.y - 0.5 })} aria-label="Move label up 0.5 mm">Up</button>
        <button type="button" className={btn} onClick={() => update({ ...offset, y: offset.y + 0.5 })} aria-label="Move label down 0.5 mm">Down</button>
        <span className="tabular-nums w-14 text-center">{offset.y > 0 ? `${offset.y} mm ↓` : offset.y < 0 ? `${-offset.y} mm ↑` : '0 mm'}</span>
      </span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => update({ ...offset, x: offset.x - 0.5 })} aria-label="Move label left 0.5 mm">Left</button>
        <button type="button" className={btn} onClick={() => update({ ...offset, x: offset.x + 0.5 })} aria-label="Move label right 0.5 mm">Right</button>
        <span className="tabular-nums w-14 text-center">{offset.x > 0 ? `${offset.x} mm →` : offset.x < 0 ? `${-offset.x} mm ←` : '0 mm'}</span>
      </span>
      {(offset.x !== 0 || offset.y !== 0) && (
        <button type="button" className="underline text-gray-500" onClick={() => update({ x: 0, y: 0 })}>Reset</button>
      )}
    </div>
  )
}
