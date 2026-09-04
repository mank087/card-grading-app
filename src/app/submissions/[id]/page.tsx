'use client'

// /submissions/[id] — bulk-grading progress page (owner only).
// Polls GET /api/submissions/[id]/status; the drain (cron + this page's own
// kicks) is what actually moves the queue. See docs/SOW_submissions_bulk_grading_2026-08-31.md.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'
import { useToast } from '@/hooks/useToast'
import { useCredits } from '@/contexts/CreditsContext'

const POLL_FAST_MS = 4000
const POLL_SLOW_MS = 15000
const SLOWDOWN_AFTER_MS = 10 * 60 * 1000
const HANDOFF_DELAY_MS = 3000

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
  const { refreshCredits } = useCredits()
  const submissionId = params?.id

  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [retrying, setRetrying] = useState(false)
  // Stop control: two-step confirm inline, then the request.
  const [confirmStop, setConfirmStop] = useState(false)
  const [stopping, setStopping] = useState(false)

  // 🔒 Auth gate. The status API already enforces ownership, so another user's
  // submission was never readable here — but a logged-out visitor still got the
  // page shell and a silent 401 instead of being asked to sign in. ?redirect=
  // carries them back to this submission afterwards.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  useEffect(() => {
    const session = getStoredSession()
    if (!session?.user) {
      setIsAuthenticated(false)
      router.push(`/login?redirect=${encodeURIComponent(`/submissions/${submissionId ?? ''}`)}`)
    } else {
      setIsAuthenticated(true)
    }
  }, [router, submissionId])

  const startedAtRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestStatusRef = useRef<string | null>(null)
  // In-flight count from the last poll. A stopped submission stays
  // `cancelled` while its last cards land, so status alone cannot say
  // whether polling and drain kicks are still needed.
  const latestActiveRef = useRef<number>(0)
  const stillSettling = () =>
    latestStatusRef.current === 'running' ||
    (latestStatusRef.current === 'cancelled' && latestActiveRef.current > 0)

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
  // Waits for the auth gate: polling before it resolves just fires 401s at the
  // status route while the redirect to /login is already on its way.
  useEffect(() => {
    if (isAuthenticated !== true) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      await fetchStatus()
      if (cancelled) return
      const status = latestStatusRef.current
      if (status && TERMINAL_STATUSES.has(status) && !stillSettling()) return // stop polling
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
  }, [submissionId, isAuthenticated])

  useEffect(() => {
    latestStatusRef.current = data?.submission?.status ?? null
    latestActiveRef.current = (data?.counts?.dispatched ?? 0) + (data?.counts?.grading ?? 0)
  }, [data])

  // Keep the header's credit balance honest while a batch runs.
  //
  // The drain charges each card server-side as it dispatches, so nothing on
  // the client knows a credit was spent — the intake page's refresh happens at
  // commit, BEFORE the first charge. Without this the header sits at its
  // pre-submission number for the whole run and bulk grading looks free.
  const gradedCount = data?.counts?.done ?? 0
  useEffect(() => {
    if (gradedCount > 0) refreshCredits()
  }, [gradedCount, refreshCredits])

  // Drain kick loop: while the submission is running and this page is open,
  // kick the drain every 30s. In production the per-minute cron does this
  // anyway ("fast while watching, completes while not") — locally there is no
  // cron, so without this a submission stalls after the commit-time kick's
  // first batch of 4. The drain is idempotent and lease-guarded, so an extra
  // kick can never double-grade.
  useEffect(() => {
    if (!submissionId) return
    const kick = () => {
      // Also while stopping: the drain reconciles the in-flight cards and
      // stamps the submission finished, it just never dispatches new ones.
      if (stillSettling()) {
        fetch(`/api/submissions/drain?submission_id=${submissionId}`, { method: 'POST', headers: authHeaders() }).catch(() => null)
      }
    }
    const interval = setInterval(kick, 30_000)
    kick()
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])

  // Stop grading (Sep 4). Queued cards are skipped and never charged; cards
  // already in flight finish and are filed. The submission reads `cancelled`
  // with completed_at NULL until the last in-flight card lands, and the poll
  // loop above keeps running for exactly that window.
  const stopGrading = async () => {
    if (!submissionId || stopping) return
    setStopping(true)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/cancel`, { method: 'POST', headers: authHeaders() })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast.error(json?.message || 'Could not stop grading.')
        return
      }
      const skipped = Number(json.cancelled_items ?? 0)
      toast.success(skipped > 0 ? `Stopped. ${skipped} card${skipped === 1 ? '' : 's'} will not be graded or charged.` : 'Stopping after the cards already grading.')
      setConfirmStop(false)
      await fetchStatus()
    } catch {
      toast.error('Could not stop grading.')
    } finally {
      setStopping(false)
    }
  }

  // Hand off when the batch finishes. This page is a transient grading screen,
  // not a destination: once everything is graded, the binder (or the
  // collection) is where the cards live. Held for HANDOFF_DELAY_MS so the
  // summary is readable, and skipped entirely when something failed — that
  // user needs the failure tiles and the Retry button, not a redirect.
  const [handingOff, setHandingOff] = useState(false)
  useEffect(() => {
    const s = data?.submission
    const c = data?.counts
    if (!s || !c) return
    if (s.status !== 'complete' || c.failed > 0) return
    setHandingOff(true)
    const t = setTimeout(() => {
      router.push(s.binder_id ? `/collection?binder=${s.binder_id}` : '/collection')
    }, HANDOFF_DELAY_MS)
    return () => clearTimeout(t)
  }, [data, router])

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
          <Link href="/collection" className="text-indigo-600 hover:text-indigo-800 text-sm mt-2 inline-block">Back to my collection</Link>
        </div>
      </div>
    )
  }

  const submission = data?.submission
  const counts = data?.counts
  const items = data?.items ?? []
  const isRunning = submission?.status === 'running'
  const isTerminal = submission ? TERMINAL_STATUSES.has(submission.status) : false
  const inFlight = (counts?.dispatched ?? 0) + (counts?.grading ?? 0)
  const isStopping = submission?.status === 'cancelled' && inFlight > 0
  const isStopped = submission?.status === 'cancelled' && inFlight === 0
  // Stop is offered whenever there is still work that a stop would change:
  // queued cards to skip, or in-flight cards to wait for.
  const canStop =
    !!submission &&
    ['running', 'blocked_insufficient_credits', 'paused'].includes(submission.status) &&
    ((counts?.queued ?? 0) > 0 || inFlight > 0)

  // 🔒 Session not resolved yet, or the redirect to /login is in flight.
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  if (isAuthenticated === false) return null

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

        /* In-progress tile: the front thumbnail exists from intake, so show it
           dimmed and desaturated under a single shared scanning sweep, and let
           it come up to full colour when the grade lands. */
        .dcm-tile-pending-img {
          opacity: 0.5;
          filter: saturate(0.35);
          transition: opacity 0.4s ease, filter 0.4s ease;
        }
        @keyframes dcm-scan {
          0% { transform: translateY(-110%); }
          100% { transform: translateY(210%); }
        }
        .dcm-scan-sweep {
          position: absolute;
          left: 0;
          right: 0;
          height: 55%;
          background: linear-gradient(180deg, rgba(99,102,241,0) 0%, rgba(129,140,248,0.55) 50%, rgba(99,102,241,0) 100%);
          animation: dcm-scan 1.8s linear infinite;
          pointer-events: none;
        }
        .dcm-scan-label { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .dcm-scan-sweep { display: none; }
          .dcm-scan-label {
            display: flex;
            background: rgba(255,255,255,0.7);
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/collection" className="text-sm text-indigo-600 hover:text-indigo-800">← My Collection</Link>
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
                    Status: <span className="font-medium">{isStopping ? 'stopping' : isStopped ? 'stopped' : submission?.status}</span>
                    {isRunning && ' · grading continues if you close this page'}
                    {isStopping && ` · finishing ${inFlight} card${inFlight === 1 ? '' : 's'} already grading`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {counts && counts.failed > 0 && submission?.status !== 'cancelled' && (
                    <button
                      onClick={retryFailed}
                      disabled={retrying}
                      className="px-3 py-1.5 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {retrying ? 'Retrying…' : 'Retry failed'}
                    </button>
                  )}
                  {/* Same two actions as the single-card grading screen. No
                      Cancel button: grading continues in the background and a
                      Cancel next to a running queue reads as "stop grading".
                      The cancel endpoint still exists. */}
                  <Link
                    href="/upload"
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow flex items-center justify-center gap-1.5 text-sm"
                  >
                    <span className="text-lg">📸</span>
                    <span>Grade Another Card</span>
                  </Link>
                  <Link
                    href="/collection"
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 text-sm"
                  >
                    <span className="text-lg">📚</span>
                    <span>My Collection</span>
                  </Link>
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
                  <Link href={`/collection?binder=${submission.binder_id}`} className="text-indigo-600 hover:text-indigo-800">View the destination binder →</Link>
                </p>
              )}

              {submission?.status === 'complete' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-green-800 font-medium">
                    Done — {counts?.graded ?? 0} graded{counts && counts.failed > 0 ? `, ${counts.failed} failed` : ''}.
                    {handingOff && (
                      <span className="block text-xs font-normal text-green-700 mt-0.5">
                        Taking you to {submission?.binder_id ? 'your binder' : 'your collection'}…
                      </span>
                    )}
                  </p>
                  {/* "Print labels" pointed at /label-export/batch, which is the
                      mobile WebView bridge and needs a token — it errored on
                      web. With no binder, the My Collection button above is
                      the only destination needed. */}
                  <Link
                    href={submission?.binder_id ? `/collection?binder=${submission.binder_id}` : '/collection'}
                    className="px-3 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {submission?.binder_id ? 'View Binder' : 'My Collection'}
                  </Link>
                </div>
              )}
            </div>

            {/* Round 2 (Sep 1): the single-card grading screen explains what is
                happening while you wait; the bulk screen showed a silent grid.
                Same content, same tone as CardAnalysisAnimation — plus the
                thing only bulk needs said: it is long, and leaving is safe. */}
            {isRunning && (
              <div className="bg-white rounded-xl shadow p-4 mb-6 space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-indigo-900">
                    DCM Optic™ is grading this submission right now.
                  </p>
                  <p className="text-sm text-indigo-800 mt-1">
                    Budget roughly a minute per card — several grade at the same time, so a
                    big batch finishes faster than that suggests, but it is not instant.
                  </p>
                  <p className="text-sm text-indigo-800 mt-1">
                    <strong>You can close this page.</strong> Grading keeps running on our
                    servers, every card files into
                    {submission?.binder_id ? ' your binder' : ' your collection'} automatically
                    as it finishes, and we email you when the batch is done.
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">What DCM Optic examines</h2>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    <li className="flex gap-2"><span aria-hidden="true">📐</span><span><strong>Centering</strong> — border ratios measured left/right and top/bottom, on the front and the back.</span></li>
                    <li className="flex gap-2"><span aria-hidden="true">📎</span><span><strong>Corners</strong> — all four corners of both faces, checked for wear, blunting and colour break.</span></li>
                    <li className="flex gap-2"><span aria-hidden="true">📏</span><span><strong>Edges</strong> — every edge of both faces, for chipping, nicks and rough cuts.</span></li>
                    <li className="flex gap-2"><span aria-hidden="true">✨</span><span><strong>Surface</strong> — print lines, scratches, dents, gloss and staining, front and back.</span></li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">How each card is graded</h2>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    <li className="flex gap-2"><span aria-hidden="true">🔬</span><span>Every card is graded <strong>three independent times</strong> and the results reconciled, so one odd read cannot decide your grade.</span></li>
                    <li className="flex gap-2"><span aria-hidden="true">🔍</span><span>A <strong>magnified inspection pass</strong> then re-checks the corners, edges and surface up close on crops the full-card view is too small to resolve.</span></li>
                    <li className="flex gap-2"><span aria-hidden="true">🧮</span><span>The final grade is the <strong>weakest of the sub-grades</strong> — the same weakest-link rule the graders use, applied consistently to every card in this batch.</span></li>
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {items.map((item) => {
                const route = ROUTE_BY_CATEGORY[item.category] || '/other'
                const isDone = item.status === 'graded'
                const isFailed = item.status === 'failed'
                const isPending = !isDone && !isFailed
                const tile = (
                  <div className={`relative aspect-[5/7] rounded-lg overflow-hidden border ${isFailed ? 'border-red-400' : 'border-gray-200'}`}>
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={`Card ${item.position + 1}`}
                        className={`w-full h-full object-cover ${isPending ? 'dcm-tile-pending-img' : 'dcm-submission-fade'}`}
                      />
                    ) : (
                      <div className={`w-full h-full ${isPending ? 'dcm-submission-shimmer' : 'bg-gray-100'} flex items-center justify-center text-[10px] text-gray-400`}>
                        {isFailed ? 'failed' : '#' + (item.position + 1)}
                      </div>
                    )}
                    {isPending && item.thumbnail_url && (
                      <>
                        <div className="dcm-scan-sweep" aria-hidden="true" />
                        <div className="dcm-scan-label absolute inset-0 items-center justify-center text-[9px] font-semibold text-gray-700">
                          Grading…
                        </div>
                      </>
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

            {/* Stop control — below the grid so it is a deliberate reach, not
                something beside "Retry". Queued cards are never charged; the
                ones already grading finish and file. */}
            {canStop && (
              <div className="mt-6 bg-white rounded-xl shadow p-4">
                {!confirmStop ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-600">
                      Need to stop? Cards already grading will finish. The {counts?.queued ?? 0} still
                      queued will not be graded or charged.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmStop(true)}
                      className="px-4 py-2 text-sm font-semibold bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                    >
                      Stop grading
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-800 font-medium">
                      Stop after the {inFlight} card{inFlight === 1 ? '' : 's'} already grading?
                      {(counts?.queued ?? 0) > 0 && ` ${counts?.queued} queued card${counts?.queued === 1 ? '' : 's'} will be skipped and not charged.`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmStop(false)}
                        disabled={stopping}
                        className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Keep grading
                      </button>
                      <button
                        type="button"
                        onClick={stopGrading}
                        disabled={stopping}
                        className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {stopping ? 'Stopping…' : 'Yes, stop'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isStopping && (
              <div className="mt-6 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                Stopping — finishing {inFlight} card{inFlight === 1 ? '' : 's'} already in progress.
                {(counts?.skipped ?? 0) > 0 && ` ${counts?.skipped} card${counts?.skipped === 1 ? '' : 's'} skipped and not charged.`}
              </div>
            )}
            {isStopped && (
              <div className="mt-6 bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-800">
                Stopped. {counts?.graded ?? 0} graded
                {(counts?.failed ?? 0) > 0 && `, ${counts?.failed} failed`}
                {(counts?.skipped ?? 0) > 0 && `, ${counts?.skipped} not graded (not charged)`}.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
