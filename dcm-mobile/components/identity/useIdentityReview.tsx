/**
 * The card screen's side of "Confirm your card details": decides popup, banner
 * or nothing, and owns the sheet's open state.
 *
 * Mirrors src/components/cards/IdentityReview.tsx on the web:
 *   - the review state is loaded for the owner of an unsold card only, and the
 *     server decides the rest (graded, confirmed, dismissed, kill switch);
 *   - it is re-read when the card's grade lands (grade_status | grade), because
 *     a card opened while grading answers mode 'none' until then;
 *   - the popup opens by itself at most once per screen visit, only after the
 *     review state has loaded, and never while something else has the screen
 *     (the onboarding tour, another sheet, a pushed screen). The screen reports
 *     that as `blocked`. After ~15 s of being blocked the popup gives up and the
 *     banner is the owner's way in, as on the web;
 *   - closing an AUTO-opened sheet is recorded as "Review later"
 *     (PATCH { dismiss: true }), so the popup is first-visit-only and the banner
 *     takes over. A sheet the owner opened themselves just closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'
import {
  loadIdentityReview,
  recordFirstVisitDismissal,
  type IdentityReviewState,
} from '@/lib/identityReviewApi'

/** How long the popup waits for the tour or another sheet to finish, as on the web. */
const POPUP_PATIENCE_MS = 15_000
/** A short settle before the popup, so it does not land mid-transition. */
const POPUP_DELAY_MS = 600

interface Options {
  cardId: string | null | undefined
  /** Owner of a card that is not sold and not deleted. */
  eligible: boolean
  /** Changes when the grade lands: `${grade_status}|${conversational_whole_grade}`. */
  gradeKey: string
  /** True while the onboarding tour, another modal or another screen has the screen. */
  blocked: boolean
}

export function useIdentityReview({ cardId, eligible, gradeKey, blocked }: Options) {
  const [state, setState] = useState<IdentityReviewState | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const popupUsedRef = useRef(false)
  // True while the sheet on screen opened by itself (first visit) rather than by a tap.
  const autoOpenedRef = useRef(false)
  // When a popup-eligible state first arrived, for the patience window.
  const popupReadyAtRef = useRef<number | null>(null)

  const load = useCallback(async (): Promise<IdentityReviewState | null> => {
    if (!cardId) return null
    const data = await loadIdentityReview(cardId)
    if (data) {
      setState(data)
      if (data.mode === 'popup' && popupReadyAtRef.current === null) popupReadyAtRef.current = Date.now()
    }
    return data
  }, [cardId])

  useEffect(() => {
    if (!eligible) return
    let cancelled = false
    load().then(data => { if (!cancelled && data) setDismissed(data.dismissed) })
    return () => { cancelled = true }
  }, [eligible, load, gradeKey])

  /* The popup, at most once per visit and never over something else. */
  useEffect(() => {
    if (!eligible || !state || state.mode !== 'popup' || popupUsedRef.current || open) return
    if (blocked) return
    const readyAt = popupReadyAtRef.current ?? Date.now()
    if (Date.now() - readyAt > POPUP_PATIENCE_MS) {
      popupUsedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      if (popupUsedRef.current) return
      popupUsedRef.current = true
      autoOpenedRef.current = true
      setOpen(true)
    }, POPUP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eligible, state, blocked, open])

  /** The banner, the value callout and anything else that wants the sheet. */
  const openSheet = useCallback(() => {
    popupUsedRef.current = true
    autoOpenedRef.current = false
    setOpen(true)
    if (!state) void load()
  }, [state, load])

  /** Close button, backdrop or Android back. First visit only: counts as "Review later". */
  const handleClose = useCallback(() => {
    setOpen(false)
    if (autoOpenedRef.current && cardId) {
      autoOpenedRef.current = false
      setDismissed(true)
      recordFirstVisitDismissal(cardId)
    }
  }, [cardId])

  const handleDismissed = useCallback(() => {
    autoOpenedRef.current = false
    setDismissed(true)
    setOpen(false)
    void load()
  }, [load])

  /** After a save. The caller refreshes the card; the review state is re-read so the banner goes. */
  const handleSaved = useCallback(() => {
    autoOpenedRef.current = false
    setOpen(false)
    void load()
  }, [load])

  /** "More details": the sheet closes and the full editor opens. Not a dismissal, as on the web. */
  const closeForMoreDetails = useCallback(() => {
    autoOpenedRef.current = false
    setOpen(false)
  }, [])

  const available = eligible && !!state && state.reason !== 'disabled' && !state.locked
  const needsReview = eligible && !!state && state.mode !== 'none'

  return {
    state,
    open: open && !!state,
    dismissed,
    /** Show the compact banner. */
    showBanner: needsReview && !open,
    /** The value callout may open the sheet (the kill switch is off and the card is not locked). */
    canOpen: available,
    openSheet,
    reload: load,
    handleClose,
    handleDismissed,
    handleSaved,
    closeForMoreDetails,
  }
}

/** "Confirm your card details", the quieter way in once the popup has been seen. */
export function IdentityReviewBanner({ dismissed, onPress }: { dismissed: boolean; onPress: () => void }) {
  return (
    <View style={st.banner}>
      <View style={{ flex: 1 }}>
        <Text style={st.title}>Confirm your card details</Text>
        <Text style={st.text}>
          {dismissed
            ? 'You can still check what we have on file for this card.'
            : 'Check the set, year and number against your photos so the value and the label match the card.'}
        </Text>
      </View>
      <TouchableOpacity style={st.button} onPress={onPress} accessibilityRole="button">
        <Text style={st.buttonText}>Review details</Text>
      </TouchableOpacity>
    </View>
  )
}

const st = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 10, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50],
  },
  title: { fontSize: 13, fontWeight: '700', color: Colors.gray[800] },
  text: { fontSize: 12, color: Colors.gray[600], marginTop: 2 },
  button: { backgroundColor: Colors.purple[600], borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
})
