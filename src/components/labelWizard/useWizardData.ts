/**
 * Label Wizard — per-card SlabLabelData assembly.
 *
 * Mirrors the classic studio's single-card buildSlabData (QR per card, DCM or
 * store logos, emblem preferences, weighted sub-scores) but for the whole
 * wizard selection. Data is keyed by card id; the map only grows — swapping
 * one card in a ten-card selection doesn't rebuild the other nine.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import { getCardLabelData } from '@/lib/useLabelData'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import {
  generateQRCodePlain,
  loadLogoAsBase64,
  loadWhiteLogoAsBase64,
} from '@/lib/foldableLabelGenerator'

interface OrgLogos {
  orgId: string | null
  color: string | null
  white: string | null
  mark: string | null
}

interface EmblemFlags {
  showFounderEmblem: boolean
  showVipEmblem: boolean
  showCardLoversEmblem: boolean
}

export interface WizardData {
  /** SlabLabelData per selected card id. Missing entry = still building. */
  dataMap: Map<string, SlabLabelData>
  emblems: EmblemFlags
  orgLogos: OrgLogos | null
  /** True once every currently-selected card has data. */
  ready: boolean
}

export function useWizardData(cards: any[], isAuthenticated: boolean): WizardData {
  const [emblems, setEmblems] = useState<EmblemFlags>({
    showFounderEmblem: false,
    showVipEmblem: false,
    showCardLoversEmblem: false,
  })
  const [orgLogos, setOrgLogos] = useState<OrgLogos | null>(null)
  const [dcmLogos, setDcmLogos] = useState<{ color: string; white: string } | null>(null)
  const [dataMap, setDataMap] = useState<Map<string, SlabLabelData>>(new Map())
  const buildingRef = useRef<Set<string>>(new Set())
  // What each entry was built FROM: card id + its custom_label_data. Saving
  // text edits patches custom_label_data on the card object, and the changed
  // key triggers a rebuild — otherwise previews keep the pre-edit text.
  const builtKeysRef = useRef<Map<string, string>>(new Map())

  // Emblem preferences — same resolution order as the classic studio.
  useEffect(() => {
    if (!isAuthenticated) return
    const sess = getStoredSession()
    if (!sess?.access_token) return
    let cancelled = false
    Promise.all([
      fetch('/api/founders/status', {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/user/label-emblem-preference', {
        headers: { Authorization: `Bearer ${sess.access_token}` },
      }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([statusData, emblemData]) => {
        if (cancelled) return
        const isFounder = Boolean(statusData?.isFounder || emblemData?.isFounder)
        const isVip = Boolean(statusData?.isVip || emblemData?.isVip)
        const isCardLover = Boolean(statusData?.isCardLover || emblemData?.isCardLover)
        const selected: string[] = emblemData?.selectedEmblems || []
        if (selected.length === 0) {
          setEmblems({
            showFounderEmblem: isFounder,
            showVipEmblem: isVip,
            showCardLoversEmblem: isCardLover,
          })
        } else {
          setEmblems({
            showFounderEmblem: selected.includes('founder') && isFounder,
            showVipEmblem: selected.includes('vip') && isVip,
            showCardLoversEmblem: selected.includes('card_lover') && isCardLover,
          })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // Store logos, converted to data URLs (the currency every renderer consumes).
  useEffect(() => {
    if (!isAuthenticated) return
    const sess = getStoredSession()
    if (!sess?.access_token) return
    let cancelled = false
    const toDataUrl = async (url: string | null): Promise<string | null> => {
      if (!url) return null
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    }
    fetch('/api/org/branding', {
      headers: { Authorization: `Bearer ${sess.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        const b = data?.branding
        if (!b) return
        const [color, white, black] = await Promise.all([
          toDataUrl(b.logoUrl),
          toDataUrl(b.logoWhiteUrl),
          toDataUrl(b.logoBlackUrl),
        ])
        const mark = (b.logoVariant === 'white' ? white : b.logoVariant === 'black' ? black : color) ?? color
        if (!cancelled && (color || white)) {
          setOrgLogos({ orgId: typeof b.orgId === 'string' ? b.orgId : null, color, white, mark })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // DCM logos once.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadLogoAsBase64().catch(() => ''), loadWhiteLogoAsBase64().catch(() => '')]).then(
      ([color, white]) => {
        if (!cancelled) setDcmLogos({ color, white })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Build data for any selected card that doesn't have it yet. Emblem or logo
  // changes rebuild everything (rare, cheap: QR is the only real async work).
  const emblemKey = `${emblems.showFounderEmblem}|${emblems.showVipEmblem}|${emblems.showCardLoversEmblem}`
  const logoKey = `${orgLogos?.orgId ?? ''}|${dcmLogos ? 'dcm' : ''}`
  useEffect(() => {
    if (!dcmLogos) return
    setDataMap(new Map())
    buildingRef.current = new Set()
    builtKeysRef.current = new Map()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emblemKey, logoKey])

  useEffect(() => {
    if (!dcmLogos) return
    let cancelled = false

    const extractScore = (card: any, key: string): number => {
      const ws = card.conversational_weighted_sub_scores?.[key]
      if (typeof ws === 'number') return ws
      if (ws && typeof ws === 'object' && typeof ws.weighted === 'number') return ws.weighted
      const sr = card.conversational_sub_scores?.[key]
      if (typeof sr === 'number') return sr
      if (sr && typeof sr === 'object' && typeof sr.weighted === 'number') return sr.weighted
      return 0
    }

    async function build(card: any) {
      const labelData = getCardLabelData(card)
      const qrCodeDataUrl = await generateQRCodePlain(`https://dcmgrading.com/verify/${card.serial}`).catch(() => '')
      if (cancelled) return

      const hasSubScores =
        card.conversational_weighted_sub_scores?.centering !== undefined ||
        card.conversational_sub_scores?.centering !== undefined
      const cardOrg = orgLogos && card.org_id && card.org_id === orgLogos.orgId ? orgLogos : null

      const data: SlabLabelData = {
        primaryName: labelData.primaryName,
        contextLine: labelData.contextLine,
        features: labelData.features,
        featuresLine: labelData.featuresLine,
        serial: labelData.serial,
        grade: labelData.grade,
        gradeFormatted: labelData.gradeFormatted,
        condition: labelData.condition,
        isAlteredAuthentic: labelData.isAlteredAuthentic,
        englishName: (labelData as any).englishName,
        qrCodeDataUrl,
        subScores: hasSubScores
          ? {
              centering: extractScore(card, 'centering'),
              corners: extractScore(card, 'corners'),
              edges: extractScore(card, 'edges'),
              surface: extractScore(card, 'surface'),
            }
          : undefined,
        showFounderEmblem: emblems.showFounderEmblem,
        showVipEmblem: emblems.showVipEmblem,
        showCardLoversEmblem: emblems.showCardLoversEmblem,
        logoDataUrl: cardOrg?.mark || dcmLogos!.color,
        whiteLogoDataUrl: cardOrg?.white || dcmLogos!.white,
      }
      if (!cancelled) {
        setDataMap((prev) => {
          const next = new Map(prev)
          next.set(card.id, data)
          return next
        })
      }
    }

    for (const card of cards) {
      const buildKey = `${card.id}|${JSON.stringify(card.custom_label_data ?? null)}`
      if (buildingRef.current.has(buildKey)) continue
      if (dataMap.has(card.id) && builtKeysRef.current.get(card.id) === buildKey) continue
      buildingRef.current.add(buildKey)
      builtKeysRef.current.set(card.id, buildKey)
      build(card)
    }

    return () => {
      cancelled = true
    }
    // dataMap intentionally read, not depended on — the buildingRef guard
    // prevents duplicate builds and we only ever ADD entries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, dcmLogos, orgLogos, emblemKey])

  const ready = useMemo(
    () => cards.length > 0 && cards.every((c) => dataMap.has(c.id)),
    [cards, dataMap],
  )

  return { dataMap, emblems, orgLogos, ready }
}

/**
 * Per-card text overrides staged in Step 5. Applied on top of the generated
 * baseline before preview/download; saved to cards.custom_label_data on
 * confirm via the existing /api/cards/[id]/custom-label endpoint.
 */
export interface WizardTextEdits {
  primaryName: string
  setName: string
  subset: string
  cardNumber: string
  year: string
  features: string
}
