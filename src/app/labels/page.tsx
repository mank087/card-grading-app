'use client'

import { useEffect, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'
import LabelStudioClient from './LabelStudioClient'

export default function LabelsPage() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading Label Studio...</p>
        </div>
      </div>
    )
  }

  return <LabelStudioClient cards={cards} isAuthenticated={isAuthenticated} />
}
