'use client'

import { CARD_TYPES } from '@/lib/cardTypeConfig'
import type { RunCategoryLock } from '@/lib/gradingRun'

/** Label for a locked card type: "Sports", "Other — Star Wars". */
export function runCategoryLabel(lock: RunCategoryLock): string {
  const base = (CARD_TYPES as Record<string, { label: string }>)[lock.type]?.label ?? lock.type
  const short = base.replace(/ Card$/, '')
  return lock.type === 'Other' && lock.subCategory ? `${short} — ${lock.subCategory}` : short
}

/** "🔒 Locked: Sports ✕" — the visible sign a run has pinned the card type. */
export default function RunLockChip({
  lock,
  onUnlock,
  disabled = false,
}: {
  lock: RunCategoryLock
  onUnlock: () => void
  disabled?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-full text-sm font-semibold">
      <span aria-hidden="true">🔒</span>
      Locked: {runCategoryLabel(lock)}
      <button
        type="button"
        onClick={onUnlock}
        disabled={disabled}
        aria-label="Unlock card type"
        title="Unlock card type"
        className="ml-1 text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
      >
        ✕
      </button>
    </span>
  )
}
