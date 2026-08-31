'use client'

// /submissions — history list for the signed-in owner.
// Nav integration is a noted follow-up (SOW WS7); reached today via the
// progress page's "All submissions" link and directly by URL.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

interface SubmissionListRow {
  id: string
  name: string | null
  category: string
  status: string
  card_count: number | null
  binder_id: string | null
  created_at: string
  committed_at: string | null
  completed_at: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  ready: 'Ready',
  running: 'Grading…',
  blocked_insufficient_credits: 'Needs credits',
  paused: 'Paused',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  ready: 'bg-gray-100 text-gray-700',
  running: 'bg-indigo-100 text-indigo-800',
  blocked_insufficient_credits: 'bg-red-100 text-red-800',
  paused: 'bg-amber-100 text-amber-800',
  complete: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function SubmissionsHistoryPage() {
  const [rows, setRows] = useState<SubmissionListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = getStoredSession()
    if (!session?.access_token) {
      setError('You must be logged in to see your submissions.')
      return
    }
    fetch('/api/submissions', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setRows(data.submissions ?? [])
        else setError(data?.message || data?.error || 'Could not load submissions.')
      })
      .catch(() => setError('Could not load submissions.'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/upload" className="text-sm text-indigo-600 hover:text-indigo-800">← Grade a card</Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">Your submissions</h1>
          </div>
          <Link
            href="/submissions/new"
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700"
          >
            + New submission
          </Link>
        </div>

        {error && <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">{error}</div>}

        {rows && rows.length === 0 && !error && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No bulk submissions yet. Use &quot;Submit more than one card&quot; from the upload page to start one.
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/submissions/${row.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {row.name?.trim() || `${row.category} submission`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(row.created_at).toLocaleDateString()} · {row.category} · {row.card_count ?? 0} card{row.card_count === 1 ? '' : 's'}
                    {row.binder_id ? ' · has a binder' : ''}
                  </p>
                </div>
                <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[row.status] || 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
