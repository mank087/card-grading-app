'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import FeaturedCardTile from '@/components/FeaturedCardTile'

export default function FeaturedPageClient() {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await fetch('/api/cards/featured?limit=30')
        const data = await res.json()
        setCards(data.cards || [])
      } catch (err) {
        console.error('Error fetching featured cards:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCards()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Dark header banner */}
      <section className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Featured Cards</h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            A curated showcase of recently graded cards from our community. View details below or view their full grade reports.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          /* Loading skeleton */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
                <div className="flex gap-4 p-4">
                  <div className="w-1/2 aspect-[3/4] bg-gray-200 rounded-lg" />
                  <div className="w-1/2 aspect-[3/4] bg-gray-200 rounded-lg" />
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <div className="h-20 bg-gray-200 rounded-xl" />
                  <div className="h-14 bg-gray-200 rounded-xl" />
                  <div className="h-10 bg-gray-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Featured Cards Yet</h2>
            <p className="text-gray-600 mb-6">Check back soon for our curated showcase of graded cards.</p>
            <Link
              href="/"
              className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* Card grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {cards.map((card) => (
              <FeaturedCardTile key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
