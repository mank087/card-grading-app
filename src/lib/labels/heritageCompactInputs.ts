/**
 * Build HeritageCompactInputs from a card row.
 *
 * Shared by the Avery batch modals so the One-Touch and Toploader Heritage
 * sheets read the same fields (and the same custom_label_data overrides) the
 * slab Heritage labels do.
 */
import { getCardLabelData } from '@/lib/useLabelData'
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout'
import type { BandPattern } from '@/lib/labelLab/bandGeometry'
import type { HeritageCompactInputs } from './heritageCompact'

function roundSub(v: any): number | null {
  const n = Number(v)
  if (v == null || !isFinite(n)) return null
  return Math.round(n * 2) / 2
}

/** Extract a weighted sub-score, tolerating both flat and nested shapes. */
function sub(card: any, key: string): number | null {
  const w = card?.conversational_weighted_sub_scores?.[key]
  if (typeof w === 'number') return roundSub(w)
  if (w && typeof w === 'object' && typeof w.weighted === 'number') return roundSub(w.weighted)
  const s = card?.conversational_sub_scores?.[key]
  if (typeof s === 'number') return roundSub(s)
  if (s && typeof s === 'object' && typeof s.weighted === 'number') return roundSub(s.weighted)
  return null
}

/**
 * The Toploader front carries a SHORT context (set + year) — the full line
 * would land under the size an inkjet can hold at 0.5" tall.
 */
function shortContext(d: any): string {
  const parts = [d.setName, d.year].filter(Boolean)
  return parts.join(' • ').toUpperCase()
}

export function buildHeritageCompactInputs(
  card: any,
  opts: {
    qrDataUrl?: string | null
    qrUrl?: string
    bandColors?: string[] | null
    pattern: BandPattern
    wordmarkDataUrl?: string | null
    showFounderEmblem?: boolean
    showVipEmblem?: boolean
    showCardLoversEmblem?: boolean
  },
): HeritageCompactInputs {
  const d = getCardLabelData(card)
  const grade = d.grade !== null && d.grade !== undefined
    ? Math.round(d.grade).toString()
    : (d.isAlteredAuthentic ? 'A' : '—')
  return {
    primaryName: d.primaryName || 'Card',
    contextLine: (d.contextLine || '').toUpperCase(),
    contextShort: shortContext(d),
    serial: d.serial,
    grade,
    condition: d.isAlteredAuthentic && d.grade === null ? 'Authentic' : (d.condition || ''),
    subgrades: {
      centering: sub(card, 'centering'),
      corners: sub(card, 'corners'),
      edges: sub(card, 'edges'),
      surface: sub(card, 'surface'),
    },
    bandColors: opts.bandColors ?? resolveHeritageBandColors(card?.card_colors),
    pattern: opts.pattern,
    wordmarkDataUrl: opts.wordmarkDataUrl ?? null,
    qrDataUrl: opts.qrDataUrl ?? null,
    showFounderEmblem: opts.showFounderEmblem,
    showVipEmblem: opts.showVipEmblem,
    showCardLoversEmblem: opts.showCardLoversEmblem,
  }
}
