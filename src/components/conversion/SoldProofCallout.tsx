'use client'

import type { SoldProofStat } from '@/data/soldProof'

const pct = (r: number) => `+${Math.round(r * 100)}%`

/**
 * One sold-vs-raw stat for the post-grade moments (congrats modal, offer
 * panel). Callers pick the stat with soldProofFor() so the claim matches the
 * card's grade; pass nothing and nothing renders.
 */
export function SoldProofCallout({ stat, className = '' }: { stat: SoldProofStat | null; className?: string }) {
  if (!stat) return null
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <strong style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
        {pct(stat.premium)}
      </strong>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dcm-ink, #14233b)' }}>
        {stat.claim} through eBay InstaList.
        <span style={{ display: 'block', fontSize: 11, color: 'var(--dcm-muted, #596579)', marginTop: 2 }}>
          Compared with ungraded sales of the same cards. Results vary.
        </span>
      </span>
    </div>
  )
}
