'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FeaturedCardTile from '@/components/FeaturedCardTile'
import { getCardLabelData } from '@/lib/useLabelData'

interface CollectionStats {
  totalCards: number
  avgGrade: number
  gradeDistribution: Record<string, number>
  categoryBreakdown: Record<string, number>
  highestGrade: number
  gem10Count: number
}

interface ProfileData {
  username: string
  displayName: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  Pokemon: 'Pokemon',
  MTG: 'MTG',
  Sports: 'Sports',
  Lorcana: 'Lorcana',
  'One Piece': 'One Piece',
  'Yu-Gi-Oh': 'Yu-Gi-Oh',
  Other: 'Other',
}

function getCardLink(card: any): string {
  const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']
  if (card.category && sportCategories.includes(card.category)) return `/sports/${card.id}`
  if (card.category === 'Pokemon') return `/pokemon/${card.id}`
  if (card.category === 'MTG') return `/mtg/${card.id}`
  if (card.category === 'Lorcana') return `/lorcana/${card.id}`
  if (card.category === 'One Piece') return `/onepiece/${card.id}`
  if (card.category === 'Yu-Gi-Oh') return `/yugioh/${card.id}`
  if (card.category === 'Other') return `/other/${card.id}`
  return `/card/${card.id}`
}

function getGradeColor(grade: number): string {
  if (grade >= 9.5) return 'text-amber-600'
  if (grade >= 8) return 'text-green-600'
  if (grade >= 6) return 'text-blue-600'
  return 'text-gray-600'
}

export default function SharedCollectionClient({ username }: { username: string }) {
  const [cards, setCards] = useState<any[]>([])
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [stats, setStats] = useState<CollectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/cards/public-collection?username=${encodeURIComponent(username)}`)
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setProfile(data.profile || null)
        setCards(data.cards || [])
        setStats(data.stats || null)
      } catch (err) {
        console.error('Error fetching shared collection:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCollection()
  }, [username])

  const filteredCards = selectedCategory === 'all'
    ? cards
    : cards.filter(c => c.category === selectedCategory)

  const categories = stats?.categoryBreakdown
    ? Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1])
    : []

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Collection Not Found</h2>
          <p className="text-gray-600 mb-6">This username doesn&apos;t exist or hasn&apos;t shared their collection.</p>
          <Link href="/" className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <section className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {profile?.displayName || username}&apos;s Collection
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Browse their DCM Optic&trade; graded trading card collection on DCM Grading.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          /* Loading skeleton */
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
                  <div className="flex gap-4 p-4">
                    <div className="w-1/2 aspect-[3/4] bg-gray-200 rounded-lg" />
                    <div className="w-1/2 aspect-[3/4] bg-gray-200 rounded-lg" />
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <div className="h-20 bg-gray-200 rounded-xl" />
                    <div className="h-14 bg-gray-200 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : cards.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Public Cards</h2>
            <p className="text-gray-600 mb-6">This collector hasn&apos;t shared any cards publicly yet.</p>
            <Link href="/" className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            {/* Collection Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 font-medium">Cards</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalCards}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 font-medium">Avg Grade</p>
                  <p className="text-3xl font-bold text-purple-700">{stats.avgGrade}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 font-medium">Highest</p>
                  <p className="text-3xl font-bold text-green-600">{stats.highestGrade}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 font-medium">Gem 10s</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.gem10Count}</p>
                </div>
              </div>
            )}

            {/* Category Filter + View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              {categories.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    All ({cards.length})
                  </button>
                  {categories.map(([cat, count]) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {CATEGORY_LABELS[cat] || cat} ({count})
                    </button>
                  ))}
                </div>
              ) : <div />}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              /* Card Grid */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filteredCards.map((card) => (
                  <FeaturedCardTile key={card.id} card={card} hidePricing />
                ))}
              </div>
            ) : (
              /* List View */
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Card</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Set</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Grade</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Sub-Scores</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Serial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCards.map((card) => {
                      const labelData = getCardLabelData(card)
                      const grade = card.conversational_decimal_grade ?? labelData.grade ?? 0
                      const weighted = card.conversational_weighted_sub_scores || {}
                      const subScores = card.conversational_sub_scores || {}
                      return (
                        <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={getCardLink(card)} className="flex items-center gap-3 group">
                              {card.front_url ? (
                                <Image
                                  src={card.front_url}
                                  alt={labelData.primaryName}
                                  width={40}
                                  height={56}
                                  className="rounded object-cover flex-shrink-0"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-10 h-14 bg-gray-200 rounded flex-shrink-0" />
                              )}
                              <span className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors text-sm truncate max-w-[200px]">
                                {labelData.primaryName}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell truncate max-w-[150px]">
                            {labelData.setName || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                            {CATEGORY_LABELS[card.category] || card.category || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-lg font-bold ${getGradeColor(grade)}`}>
                              {grade}
                            </span>
                            {card.conversational_condition_label && (
                              <p className="text-[10px] text-gray-400 leading-tight">{card.conversational_condition_label}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex gap-3 text-xs text-gray-500">
                              <span>C: {(weighted.centering ?? subScores.centering?.weighted ?? '-')}</span>
                              <span>Co: {(weighted.corners ?? subScores.corners?.weighted ?? '-')}</span>
                              <span>E: {(weighted.edges ?? subScores.edges?.weighted ?? '-')}</span>
                              <span>S: {(weighted.surface ?? subScores.surface?.weighted ?? '-')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono hidden sm:table-cell">
                            {card.serial || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
