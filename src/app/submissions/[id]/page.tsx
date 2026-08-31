'use client'

// /submissions/[id] — bulk-grading progress page (owner only).
// Polls GET /api/submissions/[id]/status; the drain (cron + this page's own
// kicks) is what actually moves the queue. See docs/SOW_submissions_bulk_grading_2026-08-31.md.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { useToast } from '@/hooks/useToast'

const POLL_FAST_MS = 4000
const POLL_SLOW_MS = 15000
const SLOWDOWN_AFTER_MS = 10 * 60 * 1000

const TERMINAL_STATUSES = new Set(['complete', 'cancelled', 'failed'])

const ROUTE_BY_CATEGORY: Record<string, string> = {
  Sports: '/sports',
  Pokemon: '/pokemon',
  MTG: '/mtg',
  Lorcana: '/lorcana',
  'One Piece': '/onepiece',
  'Yu-Gi-Oh': '/yugioh',
  Other: '/other',
}

interface StatusItem {
  position: number
  status: string
  attempts: number
  error: string | null
  card_id: string | null
  grade_status: string | null
  grade: number | null
  category: string
  front_path: string | null
  thumbnail_url: string | null
}

interface StatusResponse {
  success: boolean
  submission: {
    id: string
    name: string | null
    category: string
    status: string
    binder_id: string | null
    card_count: number | null
    created_at: string
    committed_at: string | null
    completed_at: string | null
  }
  counts: {
    queued: number
    dispatched: number
    grading: number
    graded: number
    failed: number
    skipped: number
    total: number
    active: number
    done: number
  }
  items: StatusItem[]
}

function authHeaders(): Record<string, string> {
  const session = getStoredSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function SubmissionStatusPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const submissionId = params?.id

  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const startedAtRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestStatusRef = useRef<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!submissionId) return
    try {
      const res = await fetch(`/api/submissions/${submissionId}/status`, { headers: authHeaders() })
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setData(json)
      }
    } catch (e) {
      console.warn('[submissions status] poll failed', e)
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  // Poll loop: single request per tick, 4s fast then 15s after 10 minutes,
  // stops entirely once the submission reaches a terminal state.
  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      await fetchStatus()
      if (cancelled) return
      const status = latestStatusRef.current
      if (status && TERMINAL_STATUSES.has(status)) return // stop polling
      const elapsed = Date.now() - startedAtRef.current
      const delay = elapsed > SLOWDOWN_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS
      timerRef.current = setTimeout(tick, delay)
    }

    tick()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])

  useEffect(() => {
    latestStatusRef.current = data?.submission?.status ?? null
  }, [data])

  const cancel = async () => {
    if (!submissionId) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/cancel`, { method: 'POST', headers: authHeaders() })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.message || 'Could not cancel.')
        return
      }
      toast.success('Cancelled. Anything already grading will still finish.')
      fetchStatus()
    } finally {
      setCancelling(false)
    }
  }

  // POST /api/submissions/[id]/retry requeues every failed item (attempts=0,
  // error=null) and flips a stopped submission back to running; the drain
  // kick right after means the first tick doesn't wait for the cron.
  const retryFailed = async () => {
    if (!submissionId) return
    setRetrying(true)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/retry`, { method: 'POST', headers: authHeaders() })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.message || 'Could not retry.')
        return
      }
      await fetch(`/api/submissions/drain?submission_id=${submissionId}`, { method: 'POST', headers: authHeaders() }).catch(() => null)
      toast.success(json.requeued > 0 ? `Retrying ${json.requeued} card${json.requeued === 1 ? '' : 's'}.` : 'Nothing to retry.')
      fetchStatus()
    } finally {
      setRetrying(false)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-700 font-medium">This submission doesn&apos;t exist, or isn&apos;t yours.</p>
          <Link href="/submissions" className="text-indigo-600 hover:text-indigo-800 text-sm mt-2 inline-block">Back to submissions</Link>
        </div>
      </div>
    )
  }

  const submission = data?.submission
  const counts = data?.counts
  const items = data?.items ?? []
  const isRunning = submission?.status === 'running'
  const isTerminal = submission ? TERMINAL_STATUSES.has(submission.status) : false

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <style jsx global>{`
        @keyframes dcm-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .dcm-submission-shimmer {
          background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
          background-size: 800px 100%;
          animation: dcm-shimmer 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dcm-submission-shimmer { animation: none; background: #eee; }
        }
        .dcm-submission-fade { animation: dcm-fade-in 0.4s ease-in; }
        @keyframes dcm-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .dcm-submission-fade { animation: none; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/submissions" className="text-sm text-indigo-600 hover:text-indigo-800">← All submissions</Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
            {submission?.name?.trim() || `${submission?.category ?? ''} submission`}
          </h1>
        </div>

        {loading && !data && (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[5/7] rounded-lg dcm-submission-shimmer" />
            ))}
          </div>
        )}

        {data && (
          <>
            <div className="bg-white rounded-xl shadow p-4 mb-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {counts?.graded ?? 0} of {counts?.total ?? 0} graded
                    {counts && counts.failed > 0 ? ` · ${counts.failed} need retry` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Status: <span className="font-medium">{submission?.status}</span>
                    {isRunning && ' · grading continues if you close this page'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {counts && counts.failed > 0 && (
                    <button
                      onClick={retryFailed}
                      disabled={retrying}
                      className="px-3 py-1.5 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {retrying ? 'Retrying…' : 'Retry failed'}
                    </button>
                  )}
                  {isRunning && (
                    <button
                      onClick={cancel}
                      disabled={cancelling}
                      className="px-3 py-1.5 text-sm font-semibold bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              {(submission?.status === 'blocked_insufficient_credits') && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800">
                  Paused — not enough credits to keep grading.{' '}
                  <Link href="/credits" className="underline font-semibold">Buy credits</Link>, then use Retry above.
                </div>
              )}
              {(submission?.status === 'paused') && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                  Paused for review. Use Retry above to resume.
                </div>
              )}

              {submission?.binder_id && (
                <p className="text-sm">
                  <Link href="/collection" className="text-indigo-600 hover:text-indigo-800">View the destination binder →</Link>
                </p>
              )}

              {submission?.status === 'complete' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-green-800 font-medium">
                    Done — {counts?.graded ?? 0} graded{counts && counts.failed > 0 ? `, ${counts.failed} failed` : ''}.
                  </p>
                  <div className="flex gap-2">
                    {submission?.binder_id && (
                      <Link href="/collection" className="px-3 py-1.5 text-sm font-semibold bg-white border border-green-300 text-green-800 rounded-lg hover:bg-green-100">
                        Open binder
                      </Link>
                    )}
                    <Link
                      href={`/label-export/batch?cardIds=${items.filter((i) => i.card_id).map((i) => i.card_id).join(',')}`}
                      className="px-3 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Print labels
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {items.map((item) => {
                const route = ROUTE_BY_CATEGORY[item.category] || '/other'
                const isDone = item.status === 'graded'
                const isFailed = item.status === 'failed'
                const isPending = !isDone && !isFailed
                const tile = (
                  <div className={`relative aspect-[5/7] rounded-lg overflow-hidden border ${isFailed ? 'border-red-400' : 'border-gray-200'}`}>
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={`Card ${item.position + 1}`} className="w-full h-full object-cover dcm-submission-fade" />
                    ) : (
                      <div className={`w-full h-full ${isPending ? 'dcm-submission-shimmer' : 'bg-gray-100'} flex items-center justify-center text-[10px] text-gray-400`}>
                        {isFailed ? 'failed' : '#' + (item.position + 1)}
                      </div>
                    )}
                    {isDone && item.grade != null && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-center text-xs font-bold py-0.5">
                        Grade {item.grade}
                      </div>
                    )}
                    {isFailed && (
                      <div className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-center text-[10px] py-0.5">
                        needs retry
                      </div>
                    )}
                  </div>
                )
                return item.card_id && (isDone || isFailed) ? (
                  <Link key={item.position} href={`${route}/${item.card_id}`}>{tile}</Link>
                ) : (
                  <div key={item.position}>{tile}</div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
