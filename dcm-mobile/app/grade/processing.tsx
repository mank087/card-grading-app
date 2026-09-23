import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Image, Animated, Easing, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/lib/constants'
import { isUuid } from '@/lib/uuid'
import { useGradingJob, refreshGradingJobs } from '@/lib/gradingJob'
import { supabase } from '@/lib/supabase'
import { incompleteInspectionMessage, incompleteInspectionFromErrorMessage } from '@/lib/inspectionMessage'
import Button from '@/components/ui/Button'
import BenefitCarousel from '@/components/BenefitCarousel'
import ResponsiveContainer from '@/components/ui/ResponsiveContainer'

const CATEGORY_ROUTES: Record<string, string> = {
  Sports: 'sports', Pokemon: 'pokemon', MTG: 'mtg',
  Lorcana: 'lorcana', 'One Piece': 'onepiece', 'Yu-Gi-Oh': 'yugioh', Other: 'other',
}

// These captions are TIME-DRIVEN illustration, not confirmed backend stages.
// The wording is deliberately neutral ("inspecting…") so the screen never
// claims a step finished that no poll has confirmed. Only the completed
// state — which requires a confirmed grade — reads as done.
const STEPS = [
  { label: 'Inspecting card boundaries', icon: 'scan-outline' },
  { label: 'Inspecting centering', icon: 'resize-outline' },
  { label: 'Inspecting corners & edges', icon: 'cube-outline' },
  { label: 'Inspecting surface', icon: 'layers-outline' },
  { label: 'Inspecting overall condition', icon: 'ribbon-outline' },
]

export default function ProcessingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ cardId: string; category: string; frontUri: string }>()
  const [currentStep, setCurrentStep] = useState(0)
  const insets = useSafeAreaInsets()
  const scanAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scrollRef = useRef<ScrollView>(null)

  // Shared job state — the same constants, poll interval and delayed/failed
  // rules the global queue + PersistentStatusBar use (lib/gradingJob.ts).
  // The anchor is fixed at first mount: this screen is entered right after
  // the upload, so "now" is the submission time.
  const uploadedAtRef = useRef(Date.now())
  const { state: jobState, grade } = useGradingJob(params.cardId, uploadedAtRef.current)
  const isComplete = jobState === 'completed'
  const gradingError = jobState === 'failed'
  useEffect(() => {
    if (!gradingError || !isUuid(params.cardId)) return
    let cancelled = false
    supabase.from('cards').select('error_message').eq('id', params.cardId).maybeSingle()
      .then(({ data }) => {
        const message = incompleteInspectionFromErrorMessage((data as any)?.error_message)
        if (!cancelled && message) setInspectionFailure(prev => prev ?? message)
      })
    return () => { cancelled = true }
  }, [gradingError, params.cardId])
  const isDelayed = jobState === 'delayed'

  // Scanning animation
  useEffect(() => {
    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    scan.start()

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    )
    pulse.start()

    return () => { scan.stop(); pulse.stop() }
  }, [])

  // Step progression (visual only — advances every 15s). Illustrative, not a
  // report of confirmed backend progress; see the STEPS comment above.
  useEffect(() => {
    if (isComplete) return
    const timer = setInterval(() => {
      setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, 15000)
    return () => clearInterval(timer)
  }, [isComplete])

  // Success haptic fires once, when the shared job state first reports a
  // confirmed grade.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (!isComplete || celebratedRef.current) return
    celebratedRef.current = true
    setCurrentStep(STEPS.length - 1)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [isComplete])

  // Tracks whether the trigger fetch failed (network OR non-OK status).
  // Polling continues in the background regardless — sometimes the backend
  // picks up the card via a separate worker — but we surface a banner so
  // the user knows something looked off and can re-fire the trigger.
  const [triggerFailed, setTriggerFailed] = useState(false)
  // Set when the server stopped the grade because the inspection could not be
  // completed (INSPECTION_INCOMPLETE). The message says whether the credit was
  // refunded, and never offers a retry: that is a support conversation.
  const [inspectionFailure, setInspectionFailure] = useState<string | null>(null)
  const [triggerNonce, setTriggerNonce] = useState(0)

  // Trigger grading API (fire-and-forget — don't await)
  useEffect(() => {
    if (!params.cardId || !params.category) return
    const endpoint = CATEGORY_ROUTES[params.category] || 'other'
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
    const url = `${API_BASE}/api/${endpoint}/${params.cardId}`
    if (__DEV__) console.log('[Processing] Triggering grading API:', url)
    setTriggerFailed(false)
    fetch(url)
      .then(async r => {
        if (__DEV__) console.log('[Processing] Grading API response:', r.status)
        if (r.ok) return
        const body = await r.json().catch(() => null)
        const message = incompleteInspectionMessage(body)
        if (message) { setInspectionFailure(message); return }
        setTriggerFailed(true)
      })
      .catch(err => {
        if (__DEV__) console.warn('[Processing] Grading API error (will poll anyway):', err?.message)
        setTriggerFailed(true)
      })
  }, [params.cardId, params.category, triggerNonce])

  // Polling itself lives in lib/gradingJob.ts: one shared 5s interval and one
  // batched Supabase query for every watcher in the app, paused while
  // backgrounded and re-polled once on foreground. `useGradingJob` above
  // subscribes this screen to it, so the full-screen view and the global
  // status bar can no longer disagree about whether a job failed.
  //
  // Route params are strings — a null id arrives as the literal "null",
  // which passes a truthy check but breaks the uuid query (22P02); the hook
  // and the registry both guard on isUuid.
  useEffect(() => {
    if (__DEV__ && !isUuid(params.cardId)) {
      console.log('[Processing] Not a uuid, no polling:', params.cardId)
    }
  }, [params.cardId])

  const handleViewResults = () => {
    const catRoute = CATEGORY_ROUTES[params.category || 'other'] || 'other'
    router.replace(`/card/${params.cardId}`)
  }

  const handleGradeAnother = () => {
    router.replace('/(tabs)/grade')
  }

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  })

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        // Keep the last button (View Full Results / Go to Collection) clear
        // of the home indicator on iOS and the gesture nav bar on Android.
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
      // When the grade reveal appears at the bottom, scroll there so the
      // "View Full Results" button is in view without manual scrolling.
      onContentSizeChange={() => {
        if (isComplete) scrollRef.current?.scrollToEnd({ animated: true })
      }}
    >
      <ResponsiveContainer maxWidth={720}>
      {/* Cycling DCM benefits — fills the dead space at the top of the
          screen during the long-running grading wait. Replaces the old
          static "Grading" Stack header. */}
      <BenefitCarousel />

      {/* Navigation Options */}
      <View style={styles.navButtons}>
        <Button title="Grade Another" variant="secondary" size="sm" onPress={handleGradeAnother} style={{ flex: 1 }} />
        <Button title="My Collection" variant="secondary" size="sm" onPress={() => router.replace('/(tabs)/collection')} style={{ flex: 1 }} />
      </View>

      {/* Card with scanning animation */}
      <View style={styles.cardSection}>
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: pulseAnim }] }]}>
          {params.frontUri ? (
            <Image source={{ uri: params.frontUri }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={[styles.cardImage, styles.cardPlaceholder]}>
              <Text style={{ color: Colors.gray[600] }}>DCM</Text>
            </View>
          )}

          {/* Scan line */}
          {!isComplete && (
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
          )}

          {/* Green border glow */}
          <View style={styles.cardGlow} />
        </Animated.View>

        {/* Status text */}
        <Text style={styles.statusTitle}>
          {isComplete ? 'Grading Complete!' : `Analyzing ${params.category || ''} Card`}
        </Text>
        <Text style={styles.statusSubtitle}>
          {isComplete ? 'Your card has been graded' : 'DCM Optic\u2122 analysis in progress'}
        </Text>
      </View>

      {/* Grade reveal */}
      {isComplete && grade && (
        <View style={styles.gradeReveal}>
          <Text style={styles.gradeNumber}>{grade}</Text>
          <Text style={styles.gradeLabel}>/ 10</Text>
          <Button title="View Full Results" onPress={handleViewResults} style={{ marginTop: 16, width: '100%' }} />
        </View>
      )}

      {/* Progress steps */}
      {!isComplete && (
        <View style={styles.stepsContainer}>
          {STEPS.map((step, i) => {
            const status = i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'
            return (
              <View key={i} style={styles.stepRow}>
                <View style={[
                  styles.stepIcon,
                  status === 'done' && styles.stepIconDone,
                  status === 'active' && styles.stepIconActive,
                ]}>
                  {/* A checkmark would assert the backend finished this
                      stage. Only show one once the grade is confirmed. */}
                  {status === 'done' ? (
                    <Ionicons name={isComplete ? 'checkmark' : 'ellipse'} size={isComplete ? 14 : 8} color={Colors.white} />
                  ) : (
                    <Ionicons name={step.icon as any} size={14} color={status === 'active' ? Colors.white : Colors.gray[400]} />
                  )}
                </View>
                <Text style={[
                  styles.stepText,
                  status === 'done' && styles.stepTextDone,
                  status === 'active' && styles.stepTextActive,
                ]}>
                  {step.label}
                </Text>
                {status === 'active' && (
                  <Text style={styles.activeIndicator}>...</Text>
                )}
              </View>
            )
          })}
        </View>
      )}

      {/* Trigger-failure banner — polling continues but warn the user
          something looked off + offer to re-fire the trigger. */}
      {!isComplete && !gradingError && !inspectionFailure && triggerFailed && (
        <View style={styles.warnContainer}>
          <Ionicons name="warning" size={20} color={Colors.amber[400]} />
          <Text style={styles.warnText}>
            We couldn{'’'}t confirm the grading job started. Still checking in case it kicked off anyway.
          </Text>
          <Button
            title="Retry"
            variant="secondary"
            size="sm"
            onPress={() => { setTriggerNonce(n => n + 1); refreshGradingJobs() }}
          />
        </View>
      )}

      {/* Delayed — still running, explicitly NOT a failure. Shown between the
          5-minute delayed mark and the shared 10-minute timeout. */}
      {!isComplete && isDelayed && (
        <View style={styles.warnContainer}>
          <Ionicons name="time-outline" size={20} color={Colors.amber[400]} />
          <Text style={styles.warnText}>
            This one is taking longer than usual — still running. You can leave this screen;
            we{'’'}ll keep checking and it will appear in My Collection.
          </Text>
        </View>
      )}

      {/* Timing info */}
      {!isComplete && !gradingError && !inspectionFailure && !isDelayed && (
        <Text style={styles.timingText}>
          This typically takes 1-2 minutes. You can grade another card or view your collection while waiting.
        </Text>
      )}

      {/* Timeout / Error state */}
      {inspectionFailure && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={32} color={Colors.amber[500]} />
          <Text style={styles.errorTitle}>Please retake your photos</Text>
          <Text style={styles.errorText}>{inspectionFailure}</Text>
          <Button title="Retake Photos" onPress={handleGradeAnother} style={{ marginTop: 12 }} />
          <Button title="Contact Support" variant="secondary" onPress={() => router.push('/pages/contact')} style={{ marginTop: 8 }} />
          <Button title="Go to Collection" variant="secondary" onPress={() => router.replace('/(tabs)/collection')} style={{ marginTop: 8 }} />
        </View>
      )}
      {gradingError && !inspectionFailure && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={32} color={Colors.amber[500]} />
          <Text style={styles.errorTitle}>Grading is taking longer than expected</Text>
          <Text style={styles.errorText}>
            Your card has been submitted and may still be processing. Check your collection in a few minutes.
          </Text>
          <Button title="Go to Collection" onPress={() => router.replace('/(tabs)/collection')} style={{ marginTop: 12 }} />
          <Button title="Grade Another Card" variant="secondary" onPress={handleGradeAnother} style={{ marginTop: 8 }} />
        </View>
      )}
      </ResponsiveContainer>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[900] },
  // ScrollView needs padding on its content container, not on the ScrollView
  // itself, otherwise the padding scrolls with the content.
  scrollContent: { padding: 16 },

  // Nav
  navButtons: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  // Card
  cardSection: { alignItems: 'center', marginBottom: 24 },
  cardWrapper: {
    width: 180,
    height: 252,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.green[500],
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { backgroundColor: Colors.gray[800], alignItems: 'center', justifyContent: 'center' },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,255,255,0.6)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  statusTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginTop: 16 },
  statusSubtitle: { fontSize: 13, color: Colors.gray[400], marginTop: 4 },

  // Grade reveal
  gradeReveal: { alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 16, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  gradeNumber: { fontSize: 64, fontWeight: '900', color: Colors.green[500] },
  gradeLabel: { fontSize: 20, fontWeight: '600', color: Colors.gray[400], marginTop: -8 },

  // Steps
  stepsContainer: { gap: 12, marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: Colors.green[500], borderColor: Colors.green[500] },
  stepIconActive: { backgroundColor: Colors.purple[600], borderColor: Colors.purple[400] },
  stepText: { fontSize: 14, color: Colors.gray[400] },
  stepTextDone: { color: Colors.green[400] },
  stepTextActive: { color: Colors.white, fontWeight: '600' },
  activeIndicator: { color: Colors.purple[300], fontSize: 16, fontWeight: '700' },

  // Timing
  timingText: { fontSize: 12, color: Colors.gray[500], textAlign: 'center', lineHeight: 18 },

  // Error/timeout
  errorContainer: { alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 16, padding: 24, marginTop: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: Colors.amber[500], marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 13, color: Colors.gray[400], textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // Trigger-failure banner (less severe than full timeout)
  warnContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  warnText: { flex: 1, fontSize: 12, color: Colors.gray[300], lineHeight: 17 },
})
