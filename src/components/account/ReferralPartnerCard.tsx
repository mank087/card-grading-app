'use client'

import { useEffect, useState } from 'react'
import { getStoredSession } from '@/lib/directAuth'

type PartnerAffiliate = {
  code: string
  status: 'active' | 'paused' | 'deactivated' | string
  discountPercent: number
  rewardCredits: number
  link: string
}

type PartnerStats = {
  clicks30d: number
  referrals: number
  creditsEarned: number
  pendingCredits: number
  lastReferralAt: string | null
}

type PartnerReward = {
  createdAt: string | null
  rewardCredits: number
  status: string | null
}

type PartnerResponse = {
  affiliate: PartnerAffiliate | null
  stats?: PartnerStats
  recent?: PartnerReward[]
}

const STATUS_LABELS: { [key: string]: string } = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Credited',
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReferralPartnerCard() {
  const [data, setData] = useState<PartnerResponse | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) return

    let cancelled = false
    fetch('/api/affiliate/me', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
      .then(res => (res.ok ? res.json() : null))
      .then((json: PartnerResponse | null) => {
        if (!cancelled && json?.affiliate) setData(json)
      })
      .catch(() => {}) // Not a partner, or the program is unavailable: stay hidden
    return () => { cancelled = true }
  }, [])

  const handleCopy = async (value: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard unavailable (older browser or denied permission): no-op
    }
  }

  if (!data?.affiliate) return null

  const { affiliate } = data
  const stats = data.stats
  const recent = data.recent || []
  const isPaused = affiliate.status === 'paused'

  const tiles = [
    { label: 'Clicks last 30 days', value: stats?.clicks30d ?? 0, tone: 'blue' },
    { label: 'New customers', value: stats?.referrals ?? 0, tone: 'green' },
    { label: 'Credits earned', value: stats?.creditsEarned ?? 0, tone: 'purple' },
    { label: 'Pending', value: stats?.pendingCredits ?? 0, tone: 'gray' },
  ]

  const toneClasses: { [key: string]: { wrap: string; label: string; value: string } } = {
    blue: { wrap: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300', label: 'text-blue-700', value: 'text-blue-900' },
    green: { wrap: 'bg-gradient-to-br from-green-50 to-green-100 border-green-300', label: 'text-green-700', value: 'text-green-900' },
    purple: { wrap: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300', label: 'text-purple-700', value: 'text-purple-900' },
    gray: { wrap: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300', label: 'text-gray-700', value: 'text-gray-900' },
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
        <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Referral partner
      </h2>

      {isPaused && (
        <p className="text-sm text-gray-500 mb-4">Your partner code is paused</p>
      )}

      <p className="text-sm text-gray-600 mb-4">
        Share your code or link. New customers get {affiliate.discountPercent}% off their first purchase and you get {affiliate.rewardCredits} credits when they buy.
      </p>

      {/* Code */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Your code</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-purple-900 bg-purple-50 border-2 border-purple-300 rounded-lg px-5 py-3">
            {affiliate.code}
          </span>
          <button
            onClick={() => handleCopy(affiliate.code, 'code')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </div>

      {/* Link */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Your link</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 min-w-0 truncate text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {affiliate.link}
          </span>
          <button
            onClick={() => handleCopy(affiliate.link, 'link')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tiles.map(tile => {
          const tone = toneClasses[tile.tone]
          return (
            <div key={tile.label} className={`rounded-lg p-4 border-2 ${tone.wrap}`}>
              <p className={`text-sm font-medium mb-1 ${tone.label}`}>{tile.label}</p>
              <p className={`text-3xl font-bold ${tone.value}`}>{tile.value}</p>
            </div>
          )
        })}
      </div>

      {/* Recent rewards */}
      {recent.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent referrals</h3>
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
            {recent.map((row, index) => (
              <li key={`${row.createdAt || 'row'}-${index}`} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-600">{formatDate(row.createdAt) || 'Recent'}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">+{row.rewardCredits} credits</span>
                  <span className="text-xs text-gray-500">{STATUS_LABELS[row.status || ''] || row.status}</span>
                </span>
              </li>
            ))}
          </ul>
          {stats?.lastReferralAt && (
            <p className="text-xs text-gray-500 mt-2">Last referral {formatDate(stats.lastReferralAt)}</p>
          )}
        </div>
      )}
    </div>
  )
}
