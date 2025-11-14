'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getStoredSession, getAuthenticatedClient } from '../lib/directAuth'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [recentCards, setRecentCards] = useState<any[]>([])

  useEffect(() => {
    const getUser = async () => {
      // Use direct auth session instead of Supabase client
      const session = getStoredSession()
      const sessionUser = session?.user

      setUser(sessionUser)

      if (sessionUser) {
        try {
          // Use authenticated client for database queries
          const authClient = getAuthenticatedClient()
          const { data } = await authClient
            .from('cards')
            .select('id, card_name, category, grade_numeric, ai_confidence_score, created_at')
            .eq('user_id', sessionUser.id)
            .order('created_at', { ascending: false })
            .limit(4)

          setRecentCards(data || [])
        } catch (err) {
          console.error('Error fetching recent cards:', err)
        }
      }
    }

    getUser()
  }, [])

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/DCM-logo.png"
              alt="DCM Logo"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
          <h1 className="text-5xl font-bold mb-4">Dynamic Collectibles Management</h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Professional AI-powered card grading and authentication service.
            Get accurate condition assessments for your Sports and Pokémon cards.
          </p>

          {user ? (
            <div className="space-x-4">
              <Link
                href="/upload"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
              >
                Grade a Card
              </Link>
              <Link
                href="/collection"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors inline-block"
              >
                View Collection
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Get Started
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Dynamic Collectibles Management?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Accuracy</h3>
              <p className="text-gray-600">Advanced AI technology provides consistent and detailed condition assessments.</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Multiple Categories</h3>
              <p className="text-gray-600">Support for Sports cards, Pokémon, and other trading card categories.</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Reliable</h3>
              <p className="text-gray-600">Your collection data is safely stored and easily accessible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Cards Section */}
      {user && recentCards.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold">Recent Grades</h2>
              <Link
                href="/collection"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {recentCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/card/${card.id}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4"
                >
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${
                    card.category === 'Pokemon'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {card.category || 'Sports'}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">
                    {card.card_name || 'Untitled Card'}
                  </h3>
                  {card.grade_numeric && (
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      Grade: {card.grade_numeric}/{card.ai_confidence_score}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
