/**
 * WelcomeTourContext — orchestrates the post-signup welcome tour that
 * walks new users through each main tab (Grade → Collection → Labels
 * → Portfolio → Account) bookended by a Welcome intro screen and a
 * completion screen.
 *
 * State:
 *   active         — whether the tour is currently visible / running
 *   currentScreen  — which screen-tour the user is on (welcome, grade,
 *                    collection, labels, portfolio, account, complete)
 *   currentStep    — 0-indexed step within the current screen
 *
 * Actions:
 *   start          — manual trigger (Account → Replay welcome tour).
 *                    Resets the Supabase flag to false and re-starts.
 *   next           — advances within a screen, or hops to the next
 *                    screen when the current one is done. Final step
 *                    of the final screen ends the tour.
 *   skip           — exit the tour immediately + mark completed in
 *                    Supabase so it doesn't re-trigger.
 *   complete       — finish from the completion screen → mark
 *                    completed + navigate to Grade tab.
 *
 * Eligibility:
 *   Auto-starts on first authenticated app open IF:
 *     - user_credits.welcome_tour_completed is false (default for new
 *       users), AND
 *     - user has 0 graded cards (filters out existing users who
 *       re-installed the app — they've seen the app, they don't need
 *       the new-user tour)
 *
 * Persistence:
 *   user_credits.welcome_tour_completed (boolean, see migrations/
 *   add_welcome_tour_completed.sql). Stored server-side so the tour
 *   doesn't re-trigger on app reinstall.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from './AuthContext'
import { supabase, hasActiveSession } from '@/lib/supabase'
import {
  TOUR_SCREEN_ORDER,
  TOUR_SCREEN_ROUTE,
  TOUR_STEP_COUNT,
  type TourScreenId,
} from '@/components/onboarding/welcomeTourContent'

interface WelcomeTourContextValue {
  active: boolean
  currentScreen: TourScreenId | null
  currentStep: number
  totalStepsInScreen: number
  /** Manual start — called from Account → Replay welcome tour. */
  start: () => Promise<void>
  /** Advance within screen, or hop to next screen. Ends tour at final step. */
  next: () => void
  /** Exit + mark completed. Used by Skip Tour button. */
  skip: () => Promise<void>
  /** End from completion screen + navigate to Grade tab. */
  complete: () => Promise<void>
}

const WelcomeTourContext = createContext<WelcomeTourContextValue>({
  active: false,
  currentScreen: null,
  currentStep: 0,
  totalStepsInScreen: 0,
  start: async () => {},
  next: () => {},
  skip: async () => {},
  complete: async () => {},
})

export function WelcomeTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<TourScreenId | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  // Eligibility check runs once per user session.
  const [eligibilityChecked, setEligibilityChecked] = useState(false)

  // Reset when user changes (sign-out + sign-in as different user).
  useEffect(() => {
    setEligibilityChecked(false)
    setActive(false)
    setCurrentScreen(null)
    setCurrentStep(0)
  }, [user?.id])

  // Eligibility check on first auth resolve.
  useEffect(() => {
    if (!user || eligibilityChecked) return
    let cancelled = false
    ;(async () => {
      try {
        // cards/user_credits deny anon (RLS) — don't run the eligibility
        // queries until the client's token is attached (42501 otherwise).
        // Leave eligibilityChecked false so a later auth event retries.
        if (!(await hasActiveSession())) return

        // 1. Read the persisted completion flag.
        const { data: credits } = await supabase
          .from('user_credits')
          .select('welcome_tour_completed')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return
        if (credits?.welcome_tour_completed) {
          setEligibilityChecked(true)
          return
        }

        // 2. Don't ambush returning users who already have cards graded
        //    (e.g., users who imported their account from web or
        //    re-installed the app after first signing up months ago).
        const { count, error } = await supabase
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('conversational_whole_grade', 'is', null)

        if (cancelled) return
        if (!error && (count ?? 0) === 0) {
          // True new user — start the tour.
          setActive(true)
          setCurrentScreen('welcome')
          setCurrentStep(0)
        }
        setEligibilityChecked(true)
      } catch (e) {
        if (__DEV__) console.warn('[WelcomeTour] eligibility check failed:', e)
        setEligibilityChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [user, eligibilityChecked])

  /** Write welcome_tour_completed=true server-side. Best-effort; failures don't
   *  block UI — the tour is already dismissed locally. */
  const markCompletedRemote = useCallback(async () => {
    if (!user) return
    try {
      await supabase
        .from('user_credits')
        .update({ welcome_tour_completed: true })
        .eq('user_id', user.id)
    } catch (e) {
      if (__DEV__) console.warn('[WelcomeTour] mark completed failed:', e)
    }
  }, [user])

  /** Reset completion flag + start tour. Used by Account → Replay. */
  const start = useCallback(async () => {
    if (!user) return
    try {
      await supabase
        .from('user_credits')
        .update({ welcome_tour_completed: false })
        .eq('user_id', user.id)
    } catch (e) {
      if (__DEV__) console.warn('[WelcomeTour] reset flag failed:', e)
    }
    setActive(true)
    setCurrentScreen('welcome')
    setCurrentStep(0)
    router.push(TOUR_SCREEN_ROUTE.welcome as any)
  }, [user, router])

  const goToScreen = useCallback((screen: TourScreenId) => {
    setCurrentScreen(screen)
    setCurrentStep(0)
    const route = TOUR_SCREEN_ROUTE[screen]
    if (route) router.push(route as any)
  }, [router])

  const next = useCallback(() => {
    if (!currentScreen) return
    const stepsInScreen = TOUR_STEP_COUNT[currentScreen]
    if (currentStep < stepsInScreen - 1) {
      setCurrentStep(currentStep + 1)
      return
    }
    // Advance to next screen (or end tour if at the last one).
    const idx = TOUR_SCREEN_ORDER.indexOf(currentScreen)
    const nextScreen = TOUR_SCREEN_ORDER[idx + 1]
    if (nextScreen) {
      goToScreen(nextScreen)
    } else {
      setActive(false)
      setCurrentScreen(null)
      markCompletedRemote()
    }
  }, [currentScreen, currentStep, goToScreen, markCompletedRemote])

  const skip = useCallback(async () => {
    setActive(false)
    setCurrentScreen(null)
    await markCompletedRemote()
  }, [markCompletedRemote])

  const complete = useCallback(async () => {
    setActive(false)
    setCurrentScreen(null)
    await markCompletedRemote()
    router.push('/(tabs)/grade' as any)
  }, [markCompletedRemote, router])

  const value = useMemo(
    () => ({
      active,
      currentScreen,
      currentStep,
      totalStepsInScreen: currentScreen ? TOUR_STEP_COUNT[currentScreen] : 0,
      start,
      next,
      skip,
      complete,
    }),
    [active, currentScreen, currentStep, start, next, skip, complete],
  )

  return <WelcomeTourContext.Provider value={value}>{children}</WelcomeTourContext.Provider>
}

export const useWelcomeTour = () => useContext(WelcomeTourContext)
