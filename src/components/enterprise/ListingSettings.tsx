'use client'

/**
 * Store settings → Listings (owners only).
 *
 * The store-wide eBay listing defaults that used to be reachable only from
 * inside the single-card listing modal:
 *   - the grade label that ends every title ("… Kings Kards 9")
 *   - the description template, with a live preview rendered against one of
 *     the store's own graded cards, and three starter presets
 *
 * Saves go to PUT /api/ebay/listing-defaults with scope 'org', the same
 * endpoint (and the same validation) the in-modal "Save as store template"
 * shortcut uses — that shortcut stays; this is the place to work on it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getValidSession } from '@/lib/directAuth'
import { getCardLabelData } from '@/lib/useLabelData'
import { getConditionFromGrade } from '@/lib/conditionAssessment'
import {
  resolveListingFields,
  listingDetailRows,
  buildKeywordSentence,
} from '@/lib/ebay/listingFields'
import {
  generateHtmlDescription,
  renderDescriptionTemplate,
  sanitizeListingHtml,
  buildShippingSummary,
  DESCRIPTION_MERGE_FIELDS,
  DESCRIPTION_TEMPLATE_PRESETS,
  type ListingDescriptionFields,
  type ListingBranding,
} from '@/lib/ebay/listingDescription'
import { buildEbayTitle } from '@/lib/ebay/titleBuilder'

interface Props {
  /** The org's brand name — the grade label has to match it. */
  orgName: string
  brandColor?: string | null
}

const TEMPLATE_MAX = 20000

export default function ListingSettings({ orgName, brandColor }: Props) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState<null | 'label' | 'template'>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [labelDraft, setLabelDraft] = useState('')
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const [templateDraft, setTemplateDraft] = useState('')
  const [savedTemplate, setSavedTemplate] = useState<string | null>(null)
  const [previewCard, setPreviewCard] = useState<any | null>(null)

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const session = await getValidSession()
    if (!session?.access_token) return null
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${session.access_token}` },
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [defaultsRes, cardRes] = await Promise.all([
        authedFetch('/api/ebay/listing-defaults'),
        authedFetch('/api/ebay/preview-card'),
      ])
      if (cancelled) return
      if (defaultsRes?.ok) {
        const data = await defaultsRes.json()
        // Owners only: the endpoint refuses org writes from anyone else, so
        // showing the section to a member would just be a dead form.
        setAvailable(data.orgRole === 'owner')
        setSavedLabel(data.org?.titleGradeLabel ?? null)
        setLabelDraft(data.org?.titleGradeLabel ?? '')
        setSavedTemplate(data.org?.descriptionTemplate ?? null)
        setTemplateDraft(data.org?.descriptionTemplate ?? '')
      }
      if (cardRes?.ok) {
        const data = await cardRes.json()
        setPreviewCard(data.card ?? null)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [authedFetch])

  const branding: ListingBranding = useMemo(
    () => ({ name: orgName, brandColor: brandColor || null }),
    [orgName, brandColor]
  )

  /** The preview card's fields, resolved exactly as the listing modal does. */
  const previewFields: ListingDescriptionFields | null = useMemo(() => {
    if (!previewCard) return null
    const labelData = getCardLabelData(previewCard)
    const grade = Math.round(labelData.grade ?? 0)
    const fields = resolveListingFields(previewCard)
    const weighted = previewCard.conversational_weighted_sub_scores || {}
    const sub = previewCard.conversational_sub_scores || {}
    const gradeLabel = labelDraft.trim() || savedLabel || 'DCM'

    // The preview's headline is the real title for this card, built the way the
    // listing surfaces build it. Without it the description's first line — the
    // one eBay's "search in description" indexes — rendered blank here.
    const previewTitle = buildEbayTitle({
      name: labelData.primaryName || fields.name,
      setName: labelData.setName || fields.setName,
      subset: fields.subset,
      cardNumber: fields.cardNumber ? `#${fields.cardNumber}` : '',
      year: labelData.year || fields.year,
      serialNumbering: fields.serialDenominator,
      grade: fields.grade ?? '',
      condition: labelData.condition || '',
      category: fields.category,
      gradeLabel,
      manufacturer: fields.manufacturer,
      parallel: fields.parallel,
      rarity: fields.rarity,
      finish: fields.finish,
      rookie: fields.rookie,
      autograph: fields.autograph,
      team: fields.team,
      sport: fields.sport,
      gameWord: fields.gameWord,
      language: fields.language,
    })

    return {
      title: previewTitle,
      primaryName: labelData.primaryName || fields.name,
      setName: labelData.setName || fields.setName,
      cardNumber: labelData.cardNumber || fields.cardNumber,
      grade,
      conditionLabel: labelData.condition || getConditionFromGrade(grade),
      overview: previewCard.conversational_final_grade_summary || '',
      subgrades: {
        centering: Math.round(weighted.centering ?? sub.centering?.weighted ?? 0),
        corners: Math.round(weighted.corners ?? sub.corners?.weighted ?? 0),
        edges: Math.round(weighted.edges ?? sub.edges?.weighted ?? 0),
        surface: Math.round(weighted.surface ?? sub.surface?.weighted ?? 0),
      },
      serial: previewCard.org_serial_display || previewCard.serial || 'N/A',
      gradeLabel: gradeLabel,
      fields,
      details: listingDetailRows(fields),
      keywords: buildKeywordSentence(fields, gradeLabel, fields.grade),
      designation: fields.designation,
      // The real summary comes from the listing's own shipping form; this is a
      // representative one so the {shippingSummary} token isn't blank here.
      shippingSummary: buildShippingSummary(
        { shippingType: 'CALCULATED', handlingDays: 1, domesticReturnsAccepted: false },
        'USPS Ground Advantage'
      ),
    }
  }, [previewCard, labelDraft, savedLabel])

  const previewHtml = useMemo(() => {
    if (!previewFields) return ''
    const raw = templateDraft.trim()
      ? renderDescriptionTemplate(templateDraft, previewFields, branding)
      : generateHtmlDescription(previewFields, branding)
    return sanitizeListingHtml(raw)
  }, [previewFields, templateDraft, branding])

  const save = async (payload: Record<string, unknown>, which: 'label' | 'template', message: string) => {
    setBusy(which)
    setError(null)
    try {
      const res = await authedFetch('/api/ebay/listing-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'org', ...payload }),
      })
      const data = await res?.json().catch(() => ({}))
      if (!res?.ok) {
        setError(data?.error || 'Could not save. Please try again.')
        return false
      }
      setFlash(message)
      setTimeout(() => setFlash(null), 2500)
      return true
    } finally {
      setBusy(null)
    }
  }

  if (loading || !available) return null

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
  const labelDirty = labelDraft.trim() !== (savedLabel ?? '')
  const templateDirty = templateDraft !== (savedTemplate ?? '')

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Listings</h2>
        <p className="text-xs text-gray-400 mt-1">
          Applies to every eBay listing your store creates through InstaList. Staff inherit these;
          cards graded outside your store are unaffected.
        </p>
      </div>

      {flash && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">{flash}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {/* Title grade label */}
      <div>
        <label className={labelCls}>Grade label in listing titles</label>
        <div className="flex gap-2">
          <input
            value={labelDraft}
            maxLength={20}
            placeholder="DCM"
            className={inputCls}
            onChange={e => setLabelDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={!labelDirty || busy !== null}
            onClick={async () => {
              const value = labelDraft.trim()
              const ok = await save({ titleGradeLabel: value || null }, 'label', 'Grade label saved')
              if (ok) setSavedLabel(value || null)
            }}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 whitespace-nowrap"
          >
            {busy === 'label' ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Ends every title, e.g. &ldquo;… {labelDraft.trim() || 'DCM'} 9&rdquo;. It must match your brand
          name ({orgName}), because that is the name printed on the slab in your listing photos. Leave
          blank to use DCM. Another grading company&rsquo;s name is never allowed.
        </p>
      </div>

      {/* Description template */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <label className={labelCls}>Description template</label>
          <div className="flex items-center gap-1 flex-wrap">
            {DESCRIPTION_TEMPLATE_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                title={preset.blurb}
                onClick={() => setTemplateDraft(preset.template)}
                className="text-xs px-2.5 py-1 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg hover:border-purple-400"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={templateDraft}
          maxLength={TEMPLATE_MAX}
          rows={10}
          spellCheck={false}
          placeholder="Leave blank to use the standard DCM layout with your brand applied."
          className={`${inputCls} font-mono text-xs`}
          onChange={e => setTemplateDraft(e.target.value)}
        />
        <details className="text-xs text-gray-500 mt-2">
          <summary className="cursor-pointer select-none">Merge fields</summary>
          <div className="mt-1 grid grid-cols-2 gap-x-4">
            {DESCRIPTION_MERGE_FIELDS.map(f => (
              <div key={f.token}><code className="text-purple-700">{f.token}</code> {f.label}</div>
            ))}
          </div>
        </details>
        <p className="text-xs text-gray-400 mt-2">
          No links, web addresses or external images — eBay removes listings that carry them. Other
          grading companies are stripped from the rendered description automatically.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={!templateDirty || busy !== null}
            onClick={async () => {
              const value = templateDraft.trim()
              const ok = await save({ descriptionTemplate: value || null }, 'template', 'Template saved')
              if (ok) setSavedTemplate(value || null)
            }}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-40"
          >
            {busy === 'template' ? 'Saving…' : 'Save template'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setTemplateDraft(savedTemplate ?? '')}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Discard changes
          </button>
          <button
            type="button"
            disabled={busy !== null || (!savedTemplate && !templateDraft)}
            onClick={async () => {
              setTemplateDraft('')
              const ok = await save({ descriptionTemplate: null }, 'template', 'Back to the standard layout')
              if (ok) setSavedTemplate(null)
            }}
            className="text-xs px-2 py-1.5 text-gray-500 hover:text-purple-600"
          >
            Use standard layout
          </button>
        </div>
      </div>

      {/* Live preview against a real card */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="text-sm font-medium text-gray-700">Preview</h3>
          {previewCard && (
            <span className="text-xs text-gray-400">
              Rendered against {getCardLabelData(previewCard).primaryName || 'your most recent card'}
            </span>
          )}
        </div>
        {previewCard ? (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 overflow-x-auto">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Grade a card to see your template rendered against real data.
          </p>
        )}
      </div>
    </div>
  )
}
