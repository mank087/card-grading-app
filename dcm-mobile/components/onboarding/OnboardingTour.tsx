/**
 * OnboardingTour (mobile)
 *
 * Mirrors src/components/onboarding/OnboardingTour.tsx (web) for the card
 * detail page. Walks a new user through the 12 sections of their first
 * graded card with a dimmed overlay + spotlight cutout around each target
 * and a tour card at the top of the screen.
 *
 * Implementation notes:
 *  - The "cutout" effect is built from 4 absolute Views forming a frame
 *    around the target rect (top/left/right/bottom). RN doesn't support
 *    CSS-style box-shadow inset cutouts, so this is the simplest way to
 *    leave a transparent hole over the target.
 *  - Targets are passed in as a Map<targetId, ref>. The parent (card
 *    detail page) creates refs and tags each tour section with one.
 *  - For collapsible targets, the parent passes an `onSectionToggle`
 *    callback that controls the section's open state. The tour expands
 *    the section, waits a frame for layout, then measures + scrolls.
 *  - `parentScrollRef` is the ScrollView wrapping all sections. Tour
 *    scrolls it so the target ends up below the tour card.
 *
 * Persistence keys live in AsyncStorage and are exported so the parent
 * can decide when to auto-trigger the tour.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

export const TOUR_STARTED_KEY = 'dcm_onboarding_tour_started'
export const TOUR_COMPLETED_KEY = 'dcm_onboarding_tour_completed'

export interface TourStep {
  id: string
  title: string
  description: string
  /** Optional collapsible section id this step's target lives inside.
   *  When set, the tour will call onSectionToggle(sectionId, true) before
   *  measuring so the content is laid out and reachable. */
  sectionId?: string
}

interface OnboardingTourProps {
  isActive: boolean
  steps: TourStep[]
  /** Map of step.id → React ref pointing at the target View. */
  targets: Record<string, React.RefObject<any>>
  /** Outer scroll container so the tour can bring targets into view. */
  parentScrollRef: React.RefObject<ScrollView | null>
  /** Imperative open/close for collapsible sections. Tour calls
   *  toggle(sectionId, true) before measuring; on tour end it closes any
   *  section it expanded. */
  onSectionToggle?: (sectionId: string, open: boolean) => void
  onComplete: () => void
}

const TOUR_CARD_HEIGHT = 200 // approximate; card sits at top
const HIGHLIGHT_PADDING = 6

export function OnboardingTour({
  isActive,
  steps,
  targets,
  parentScrollRef,
  onSectionToggle,
  onComplete,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [showFinalModal, setShowFinalModal] = useState(false)
  const expandedSectionRef = useRef<string | null>(null)
  const measureRetryRef = useRef(0)

  const step = steps[currentStep]

  // Pulse animation for the highlight border
  const pulseAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!isActive || showFinalModal) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isActive, showFinalModal, pulseAnim])

  const collapseExpandedSection = useCallback(() => {
    if (expandedSectionRef.current && onSectionToggle) {
      onSectionToggle(expandedSectionRef.current, false)
      expandedSectionRef.current = null
    }
  }, [onSectionToggle])

  // Measure target and scroll it into view. Called whenever currentStep
  // changes. If target ref isn't mounted yet (collapsed section just
  // expanding), retry up to 6× with a 200ms gap before skipping.
  const focusTarget = useCallback(() => {
    if (!step) return
    const targetRef = targets[step.id]
    if (!targetRef?.current) {
      if (measureRetryRef.current < 6) {
        measureRetryRef.current++
        setTimeout(focusTarget, 200)
        return
      }
      // Target genuinely missing — skip ahead
      measureRetryRef.current = 0
      if (currentStep < steps.length - 1) {
        setCurrentStep(s => s + 1)
      } else {
        setShowFinalModal(true)
      }
      return
    }

    measureRetryRef.current = 0

    // Expand collapsible section if needed (and remember to close it later)
    if (step.sectionId && onSectionToggle && expandedSectionRef.current !== step.sectionId) {
      if (expandedSectionRef.current) {
        onSectionToggle(expandedSectionRef.current, false)
      }
      onSectionToggle(step.sectionId, true)
      expandedSectionRef.current = step.sectionId
    }

    // Wait one frame for layout to settle after expand, then measure
    requestAnimationFrame(() => {
      targetRef.current?.measure?.((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
        setHighlightRect({ x: pageX, y: pageY, w, h })

        // Scroll so target ends up below the tour card.
        // measure gives us the page-relative position; the ScrollView's
        // current scroll offset is implicit. We want target's pageY to be
        // around (TOUR_CARD_HEIGHT + 16) on screen, so we scroll by
        // (currentY - desiredY).
        const desiredOnScreenY = TOUR_CARD_HEIGHT + 24
        const delta = pageY - desiredOnScreenY
        parentScrollRef.current?.scrollTo({ y: Math.max(0, delta), animated: true })

        // Re-measure after scroll completes (crude; 350ms covers smooth scroll)
        setTimeout(() => {
          targetRef.current?.measure?.((__x: number, __y: number, w2: number, h2: number, pageX2: number, pageY2: number) => {
            setHighlightRect({ x: pageX2, y: pageY2, w: w2, h: h2 })
          })
        }, 380)
      })
    })
  }, [step, targets, parentScrollRef, onSectionToggle, currentStep, steps.length])

  // Reset state when tour is (re-)activated
  useEffect(() => {
    if (isActive) {
      setCurrentStep(0)
      setShowFinalModal(false)
      setHighlightRect(null)
      measureRetryRef.current = 0
      expandedSectionRef.current = null
      // Small delay to let ScrollView mount before first focus
      const t = setTimeout(focusTarget, 400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  // Re-focus target on step change
  useEffect(() => {
    if (isActive && !showFinalModal) {
      focusTarget()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  const handleNext = () => {
    measureRetryRef.current = 0
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      collapseExpandedSection()
      setShowFinalModal(true)
      parentScrollRef.current?.scrollTo({ y: 0, animated: true })
    }
  }

  const handleBack = () => {
    measureRetryRef.current = 0
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  const handleSkip = () => {
    collapseExpandedSection()
    onComplete()
  }

  const handleFinalClose = () => {
    collapseExpandedSection()
    setShowFinalModal(false)
    onComplete()
  }

  if (!isActive) return null

  // ---------- Final completion modal ----------
  if (showFinalModal) {
    return (
      <Modal transparent visible animationType="fade" onRequestClose={handleFinalClose}>
      <View style={styles.finalBackdrop} pointerEvents="auto">
        <View style={styles.finalCard}>
          <View style={styles.finalHeader}>
            <Text style={styles.finalEmoji}>🎊</Text>
            <Text style={styles.finalTitle}>Welcome to the DCM Family!</Text>
            <Text style={styles.finalSubtitle}>You're all set to grade like a pro</Text>
          </View>
          <View style={styles.finalBody}>
            <Text style={styles.finalBlurb}>
              You've completed the tour! Now you know everything about your graded card. Ready to grow your collection?
            </Text>
            <View style={styles.achievementBox}>
              <View style={styles.achievementIcon}>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.achievementTitle}>First Card Graded!</Text>
                <Text style={styles.achievementSub}>Achievement unlocked</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.finalPrimaryBtn} onPress={handleFinalClose}>
              <Text style={styles.finalPrimaryBtnText}>Return to Card Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </Modal>
    )
  }

  // ---------- Active tour overlay ----------
  // Build the 4-rect frame around the highlight rect.
  const haveRect = !!highlightRect && highlightRect.h > 0 && highlightRect.w > 0
  const r = haveRect && highlightRect ? {
    top: Math.max(0, highlightRect.y - HIGHLIGHT_PADDING),
    left: Math.max(0, highlightRect.x - HIGHLIGHT_PADDING),
    width: highlightRect.w + HIGHLIGHT_PADDING * 2,
    height: highlightRect.h + HIGHLIGHT_PADDING * 2,
  } : null

  const borderOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleSkip} statusBarTranslucent>
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim overlay — 4 rects framing the target, OR a single full-screen
          rect if we don't have a measured rect yet. */}
      {r ? (
        <>
          <View pointerEvents="none" style={[styles.dim, { top: 0, left: 0, right: 0, height: r.top }]} />
          <View pointerEvents="none" style={[styles.dim, { top: r.top, left: 0, width: r.left, height: r.height }]} />
          <View
            pointerEvents="none"
            style={[styles.dim, { top: r.top, left: r.left + r.width, right: 0, height: r.height }]}
          />
          <View
            pointerEvents="none"
            style={[styles.dim, { top: r.top + r.height, left: 0, right: 0, bottom: 0 }]}
          />
          {/* Animated purple ring around the target */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
                opacity: borderOpacity,
              },
            ]}
          />
        </>
      ) : (
        <View pointerEvents="none" style={[styles.dim, StyleSheet.absoluteFill]} />
      )}

      {/* Tour card — pinned at top, above the dim layers */}
      <View pointerEvents="box-none" style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardStep}>Step {currentStep + 1} of {steps.length}</Text>
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.cardSkip}>Skip tour</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{step?.title}</Text>
            <Text style={styles.cardDescription}>{step?.description}</Text>
            <View style={styles.cardActions}>
              {currentStep > 0 ? (
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Ionicons name="chevron-back" size={16} color={Colors.purple[600]} />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Text style={styles.exitText}>Exit tour</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
                <Text style={styles.nextBtnText}>
                  {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  ring: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.purple[500],
    backgroundColor: 'transparent',
  },
  cardWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    // Clears the expo-router Stack header (~44pt nav + ~44pt status on iOS).
    // The dim overlay covers everything below — header stays visible.
    paddingTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.purple[600],
  },
  cardStep: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardSkip: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 3, backgroundColor: Colors.gray[100] },
  progressFill: { height: '100%', backgroundColor: Colors.purple[400] },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.gray[900], marginBottom: 4 },
  cardDescription: { fontSize: 13, color: Colors.gray[600], lineHeight: 18, marginBottom: 14 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBtnText: { color: Colors.purple[600], fontSize: 13, fontWeight: '600' },
  exitText: { color: Colors.gray[500], fontSize: 13, fontWeight: '500' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.purple[600],
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Final modal
  finalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  finalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  finalHeader: {
    backgroundColor: Colors.purple[600],
    padding: 24,
    alignItems: 'center',
  },
  finalEmoji: { fontSize: 36, marginBottom: 6 },
  finalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 2, textAlign: 'center' },
  finalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  finalBody: { padding: 18 },
  finalBlurb: { fontSize: 13, color: Colors.gray[700], textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  achievementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.purple[50],
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.purple[100],
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.purple[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementTitle: { fontSize: 14, fontWeight: '800', color: Colors.purple[700] },
  achievementSub: { fontSize: 11, color: Colors.purple[600] },
  finalPrimaryBtn: {
    backgroundColor: Colors.purple[600],
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  finalPrimaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
