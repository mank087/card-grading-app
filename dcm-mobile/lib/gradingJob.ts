import { useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { supabase, hasActiveSession } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'

/**
 * ONE source of truth for grading-job timing and state.
 *
 * Before this module the processing screen timed out at 5 min while the
 * global queue/status bar only gave up at 10 min, so the full-screen view
 * could declare failure while the top bar still showed the job running.
 * Both now read the constants and the observation stream below, and both
 * share a single poll interval.
 */

/** Poll cadence for every grading watcher in the app (was 4s global / 5s screen). */
export const GRADING_POLL_INTERVAL_MS = 5_000

/**
 * After this long with no grade we call the job `delayed` — still running,
 * just slower than usual. This is NOT a failure.
 */
export const GRADING_DELAYED_MS = 5 * 60 * 1000

/**
 * Only after this long (or an explicit backend failure) do we call the job
 * `failed`. Matches the queue context's historical 10-minute rule.
 */
export const GRADING_TIMEOUT_MS = 10 * 60 * 1000

export type GradingJobState = 'processing' | 'delayed' | 'completed' | 'failed'

/** What a poll actually observed for one card. */
export interface GradingObservation {
  cardId: string
  /** Confirmed by the backend: a grade exists. */
  graded: boolean
  grade: number | null
  conditionLabel: string | null
  category: string | null
  /** Backend explicitly reported a failed grading run (`grading_status = 'error'`). */
  backendFailed: boolean
  /** Timestamp of the poll that produced this observation. */
  polledAt: number
  /** True once at least one poll has returned for this card. */
  confirmed: boolean
}

function emptyObservation(cardId: string): GradingObservation {
  return {
    cardId,
    graded: false,
    grade: null,
    conditionLabel: null,
    category: null,
    backendFailed: false,
    polledAt: 0,
    confirmed: false,
  }
}

/**
 * Resolve the single job state from evidence + elapsed time.
 *
 * `delayed` and `failed` are the only time-driven verdicts; everything else
 * requires a confirmed observation, so the UI can never claim a backend step
 * happened just because a timer fired.
 */
export function deriveJobState(args: {
  uploadedAt: number
  now?: number
  observation?: GradingObservation | null
}): GradingJobState {
  const now = args.now ?? Date.now()
  const obs = args.observation
  if (obs?.graded) return 'completed'
  if (obs?.backendFailed) return 'failed'
  const elapsed = now - args.uploadedAt
  if (elapsed >= GRADING_TIMEOUT_MS) return 'failed'
  if (elapsed >= GRADING_DELAYED_MS) return 'delayed'
  return 'processing'
}

// ---------------------------------------------------------------------------
// Shared poller — one interval, one query, many subscribers.
// ---------------------------------------------------------------------------

type Listener = (obs: GradingObservation) => void

const watchers = new Map<string, Set<Listener>>()
const latest = new Map<string, GradingObservation>()
let timer: ReturnType<typeof setInterval> | null = null
let appStateSub: { remove: () => void } | null = null
let ticking = false

export function getLatestObservation(cardId: string): GradingObservation | null {
  return latest.get(cardId) ?? null
}

function emit(obs: GradingObservation) {
  latest.set(obs.cardId, obs)
  const set = watchers.get(obs.cardId)
  if (set) set.forEach(fn => { try { fn(obs) } catch {} })
}

/** Extract a grade from the raw grading JSON when the column lags behind. */
function gradeFromJson(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const json = JSON.parse(raw)
    const g = json?.final_grade?.whole_grade ?? json?.grading_passes?.averaged_rounded?.final
    return typeof g === 'number' ? Math.round(g) : null
  } catch {
    return null
  }
}

async function tick() {
  if (ticking) return
  const ids = Array.from(watchers.keys()).filter(isUuid)
  if (ids.length === 0) return
  // `cards` denies anon (RLS). Skip the tick rather than 42501.
  if (!(await hasActiveSession())) return

  ticking = true
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('id, category, conversational_whole_grade, conversational_condition_label, conversational_grading, grading_status')
      .in('id', ids)
    if (error) return

    const now = Date.now()
    const byId = new Map<string, any>()
    ;(data || []).forEach((r: any) => byId.set(r.id, r))

    for (const cardId of ids) {
      const row = byId.get(cardId)
      if (!row) {
        // Row not visible yet (or not ours). Still emit, so subscribers get a
        // heartbeat and the time-driven half of the verdict keeps advancing.
        emit({ ...emptyObservation(cardId), polledAt: now })
        continue
      }
      const grade =
        typeof row.conversational_whole_grade === 'number'
          ? row.conversational_whole_grade
          : gradeFromJson(row.conversational_grading)
      emit({
        cardId,
        graded: grade != null,
        grade,
        conditionLabel: row.conversational_condition_label ?? null,
        category: row.category ?? null,
        backendFailed: row.grading_status === 'error',
        polledAt: now,
        confirmed: true,
      })
    }
  } catch (err) {
    if (__DEV__) console.warn('[gradingJob] poll error:', err)
  } finally {
    ticking = false
  }
}

function startTimer() {
  if (timer) return
  if (watchers.size === 0) return
  if (AppState.currentState !== 'active') return
  void tick()
  timer = setInterval(() => { void tick() }, GRADING_POLL_INTERVAL_MS)
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

function handleAppState(next: AppStateStatus) {
  if (next === 'active') {
    // Coming back from background: re-poll once immediately so the UI
    // reconciles with whatever finished while we were suspended, then
    // resume the shared interval.
    startTimer()
  } else {
    // Apple rejects unnecessary background network activity, and it drains
    // battery on Android. Pause; foreground re-polls.
    stopTimer()
  }
}

function ensureAppStateSub() {
  if (appStateSub) return
  appStateSub = AppState.addEventListener('change', handleAppState)
}

/**
 * Subscribe to poll results for a card. Returns an unsubscribe function.
 * All subscribers across the app share one interval and one Supabase query.
 */
export function watchGradingJob(cardId: string, listener: Listener): () => void {
  if (!isUuid(cardId)) return () => {}
  let set = watchers.get(cardId)
  if (!set) { set = new Set(); watchers.set(cardId, set) }
  set.add(listener)
  ensureAppStateSub()
  startTimer()
  const cached = latest.get(cardId)
  if (cached) { try { listener(cached) } catch {} }

  return () => {
    const s = watchers.get(cardId)
    if (!s) return
    s.delete(listener)
    if (s.size === 0) {
      watchers.delete(cardId)
      latest.delete(cardId)
    }
    if (watchers.size === 0) stopTimer()
  }
}

/** Force one immediate poll (e.g. after a manual retry). */
export function refreshGradingJobs() {
  void tick()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGradingJobResult {
  state: GradingJobState
  observation: GradingObservation
  /** Convenience: confirmed grade, or null while still running. */
  grade: number | null
}

/**
 * Watch one grading job. `uploadedAt` anchors the delayed/failed timers; pass
 * the moment the card was submitted (defaults to first mount).
 */
export function useGradingJob(cardId: string | undefined, uploadedAt?: number): UseGradingJobResult {
  const anchorRef = useRef(uploadedAt ?? Date.now())
  if (uploadedAt != null && uploadedAt !== anchorRef.current) anchorRef.current = uploadedAt

  const [observation, setObservation] = useState<GradingObservation>(() =>
    (cardId && getLatestObservation(cardId)) || emptyObservation(cardId || ''),
  )
  const [, setNow] = useState(Date.now())

  useEffect(() => {
    if (!cardId || !isUuid(cardId)) return
    setObservation(getLatestObservation(cardId) || emptyObservation(cardId))
    return watchGradingJob(cardId, setObservation)
  }, [cardId])

  // Re-evaluate the time-driven part of the verdict on the same cadence as
  // the poll (no extra network work) and only while the job is unresolved.
  useEffect(() => {
    if (observation.graded || observation.backendFailed) return
    const id = setInterval(() => setNow(Date.now()), GRADING_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [observation.graded, observation.backendFailed])

  const state = deriveJobState({ uploadedAt: anchorRef.current, observation })
  return { state, observation, grade: observation.graded ? observation.grade : null }
}
