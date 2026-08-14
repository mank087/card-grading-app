'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { useOrgContext } from '@/contexts/OrgContext'
import LabelStudioClient from './LabelStudioClient'

export default function LabelsPage() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // Org workspace: label design is locked to the house style chosen in Brand
  // Setup. Members keep Label Studio for their PERSONAL workspace/cards.
  const { membership, membershipLoaded, isOrgScope } = useOrgContext()

  useEffect(() => {
    async function init() {
      const session = getStoredSession()

      if (session?.user) {
        // Logged-in: fetch user's collection
        setIsAuthenticated(true)
        try {
          const res = await fetch('/api/cards/my-collection', {
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
        // Not logged in: fetch sample cards
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

  if (loading || !membershipLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading Label Studio...</p>
        </div>
      </div>
    )
  }

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

  return <LabelStudioClient cards={cards} isAuthenticated={isAuthenticated} />
}
