import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'
import { CardShow, getShowStatus, getDaysUntil, formatDateRange, getCurrentOrNextShow } from '@/types/cardShow'

export const metadata: Metadata = {
  title: 'Card Shows 2026 | Grade Cards Instantly | DCM Grading',
  description: 'Attending a card show in 2026? Grade your sports cards, Pokemon, and TCG cards instantly with DCM. Pre-screen before buying, verify seller claims, know what\'s worth submitting to PSA.',
  openGraph: {
    title: 'Card Shows 2026 | DCM Grading',
    description: 'Grade your cards instantly at any card show. No shipping, no waiting.',
    type: 'website',
  },
}

// Revalidate every hour
export const revalidate = 3600

async function getCardShows(): Promise<CardShow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('card_shows')
    .select('*')
    .eq('is_active', true)
    .gte('end_date', new Date().toISOString().split('T')[0])
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Error fetching card shows:', error)
    return []
  }

  return data || []
}

function ShowStatusBadge({ show }: { show: CardShow }) {
  const status = getShowStatus(show)
  const daysUntil = getDaysUntil(show)

  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white animate-pulse">
        <span className="w-2 h-2 bg-white rounded-full"></span>
        HAPPENING NOW
      </span>
    )
  }

  if (status === 'upcoming' && daysUntil <= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500 text-gray-900">
        {daysUntil === 0 ? 'STARTS TODAY' : daysUntil === 1 ? 'STARTS TOMORROW' : `${daysUntil} DAYS AWAY`}
      </span>
    )
  }

  return null
}

function ShowCard({ show }: { show: CardShow }) {
  const status = getShowStatus(show)

  return (
    <Link
      href={`/card-shows/${show.slug}`}
      className={`group block bg-gray-800 rounded-xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
        status === 'active' ? 'border-green-500 ring-2 ring-green-500/30' : 'border-gray-700 hover:border-emerald-500/50'
      }`}
    >
      {/* Header with show type badge */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-medium text-emerald-200 uppercase tracking-wider">{show.show_type}</span>
        <ShowStatusBadge show={show} />
      </div>

      <div className="p-5">
        {/* Show Name */}
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
          {show.name}
        </h3>

        {/* Date & Location */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-gray-300">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">{formatDateRange(show.start_date, show.end_date)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm">{show.city}, {show.state}</span>
          </div>
          {show.venue_name && (
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs truncate">{show.venue_name}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {show.estimated_tables && (
            <span>{show.estimated_tables}+ tables</span>
          )}
          {show.estimated_attendance && (
            <span>{show.estimated_attendance} expected</span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <span className="text-emerald-400 text-sm font-semibold group-hover:text-emerald-300 transition-colors flex items-center gap-1">
            Grade cards at this show
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

function FeaturedShow({ show }: { show: CardShow }) {
  const status = getShowStatus(show)
  const daysUntil = getDaysUntil(show)

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-900 to-blue-900 rounded-2xl border border-emerald-500/30">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-60 h-60 bg-teal-400 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 p-8 md:p-12">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Content */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {status === 'active' ? (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  HAPPENING NOW
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-yellow-500 text-gray-900">
                  {daysUntil <= 7 ? `${daysUntil} days away` : 'Coming Up'}
                </span>
              )}
              <span className="text-emerald-300 text-sm font-medium uppercase tracking-wider">{show.show_type}</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {show.headline || `Attending ${show.name}?`}
            </h2>

            <p className="text-xl text-gray-300 mb-6">
              {show.subheadline || 'Grade your cards instantly with DCM. Pre-screen before buying, verify seller claims.'}
            </p>

            <div className="flex flex-wrap gap-4 mb-6 text-gray-300">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDateRange(show.start_date, show.end_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{show.city}, {show.state}</span>
              </div>
            </div>

            {show.special_offer && (
              <div className="inline-block bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-2 mb-6">
                <span className="text-yellow-300 font-semibold">{show.special_offer}</span>
              </div>
            )}

            <Link
              href={`/card-shows/${show.slug}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/30"
            >
              Get Started - Grade Cards Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-row lg:flex-col gap-4 lg:gap-6">
            {show.estimated_tables && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center min-w-[120px]">
                <div className="text-3xl font-bold text-white">{show.estimated_tables}+</div>
                <div className="text-emerald-300 text-sm">Vendor Tables</div>
              </div>
            )}
            {show.estimated_attendance && (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center min-w-[120px]">
                <div className="text-3xl font-bold text-white">{show.estimated_attendance}</div>
                <div className="text-emerald-300 text-sm">Expected</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function CardShowsPage() {
  const shows = await getCardShows()
  const featuredShow = getCurrentOrNextShow(shows)

  // Group shows by month
  const showsByMonth: Record<string, CardShow[]> = {}
  shows.forEach(show => {
    const monthKey = new Date(show.start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!showsByMonth[monthKey]) {
      showsByMonth[monthKey] = []
    }
    showsByMonth[monthKey].push(show)
  })

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-transparent"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image src="/DCM Logo white.png" alt="DCM" width={50} height={50} />
              <span className="text-white/80 text-sm font-medium tracking-wider uppercase">Card Show Grading</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Card Shows 2026
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Grade your cards instantly at any show. Pre-screen before buying, verify seller claims, know what's worth submitting to PSA.
            </p>
          </div>

          {/* Featured Show */}
          {featuredShow && (
            <div className="mb-16">
              <FeaturedShow show={featuredShow} />
            </div>
          )}
        </div>
      </section>

      {/* All Shows Grid */}
      <section className="py-12 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-white mb-8">All Upcoming Shows</h2>

          {Object.entries(showsByMonth).map(([month, monthShows]) => (
            <div key={month} className="mb-12">
              <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {month}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthShows.map(show => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            </div>
          ))}

          {shows.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No upcoming shows found. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Why Grade at Shows Section */}
      <section className="py-16 bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Grade Cards at Shows?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Pre-Screen Purchases</h3>
              <p className="text-gray-400 text-sm">Grade cards before buying to avoid overpaying for damaged cards</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Verify Seller Claims</h3>
              <p className="text-gray-400 text-sm">Confirm condition claims from vendors with instant AI analysis</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Know PSA Potential</h3>
              <p className="text-gray-400 text-sm">See estimated PSA/BGS grades before submitting</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">Instant Results</h3>
              <p className="text-gray-400 text-sm">Get grades in 60 seconds, right at the show</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-emerald-900 to-teal-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Grade at Your Next Show?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Sign up now and get 1 free credit to try DCM Grading at any card show.
          </p>
          <Link
            href="/login?mode=signup&redirect=/credits"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/30"
          >
            Sign Up Free
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  )
}
