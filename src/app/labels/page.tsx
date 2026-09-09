'use client'

/**
 * /labels — the Label Wizard (five-step flow).
 *
 * The original single-page studio is preserved unchanged at /labels/classic.
 * Data loading and the org-workspace gate are identical to the classic page:
 * signed-in users get their collection, guests get sample cards, and org-scope
 * members are pointed at Brand Setup (org labels are a locked house style).
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'
import LabelWizard from '@/components/labelWizard/LabelWizard'

function LabelStudioLoading() {
  return <section className="dcm-brand dcm-section"><div className="dcm-container">
    <p className="dcm-eyebrow">Design, print and display</p>
    <h1 className="text-3xl font-bold">Label Studio: custom card grading labels</h1>
    <p className="dcm-lead">Create Heritage, Modern and Traditional labels from your DCM grading reports. Customize a design, choose a holder format, and prepare it for printing. Guests can explore with sample cards.</p>
    <div className="dcm-actions"><Link className="dcm-button dcm-button--secondary" href="/reports-and-labels">Explore label and report formats</Link><Link className="dcm-button dcm-button--text" href="/get-started">Grade your first card</Link></div>
    <p className="dcm-fineprint" role="status">Loading the label designer…</p>
  </div></section>
}

function LabelsPageInner() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { membership, membershipLoaded, isOrgScope } = useOrgContext()

  useEffect(() => {
    async function init() {
      const session = getStoredSession()

      if (session?.user) {
        setIsAuthenticated(true)
        try {
          const res = await fetch('/api/cards/my-collection?all=1', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          })
          if (res.ok) {
            const data = await res.json()
            setCards(data.cards || [])
          }
        } catch (err) {
          console.error('Failed to load cards:', err)
        }
      } else {
        setIsAuthenticated(false)
        try {
          const res = await fetch('/api/labels/sample-cards')
          if (res.ok) {
            const data = await res.json()
            setCards(data.cards || [])
          }
        } catch (err) {
          console.error('Failed to load sample cards:', err)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  if (loading || !membershipLoaded) return <LabelStudioLoading />

  if (isOrgScope && membership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <div className="text-4xl mb-3">🏷️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Your label design lives in Brand Setup</h1>
          <p className="text-gray-600 text-sm mb-6">
            {membership.name} uses one house label design so every slab your team produces matches.
            Adjust the style, pattern, and colors, with a live preview, in Brand Setup. To design
            labels for your own personal cards, switch to your Personal workspace first.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/store/settings"
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700">
              Open Brand Setup
            </Link>
            <Link href="/collection"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:border-purple-400">
              Print labels from Collection
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <LabelWizard cards={cards} isAuthenticated={isAuthenticated} />
}

export default function LabelsPage() {
  return (
    <Suspense fallback={<LabelStudioLoading />}>
      <LabelsPageInner />
    </Suspense>
  )
}
