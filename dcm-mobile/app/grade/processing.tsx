import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'

const CATEGORY_ROUTES: Record<string, string> = {
  Sports: 'sports', Pokemon: 'pokemon', MTG: 'mtg',
  Lorcana: 'lorcana', 'One Piece': 'onepiece', 'Yu-Gi-Oh': 'yugioh', Other: 'other',
}

const STEPS = [
  { label: 'Detecting card boundaries', icon: 'scan-outline' },
  { label: 'Measuring centering ratios', icon: 'resize-outline' },
  { label: 'Evaluating corners & edges', icon: 'cube-outline' },
  { label: 'Assessing surface condition', icon: 'layers-outline' },
  { label: 'Generating final grade', icon: 'ribbon-outline' },
]

export default function ProcessingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ cardId: string; category: string; frontUri: string }>()
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const insets = useSafeAreaInsets()
  const [grade, setGrade] = useState<number | null>(null)
  const scanAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Step progression (visual only — advances every 15s)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < STEPS.length - 1) return prev + 1
        return prev
      })
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const [pollCount, setPollCount] = useState(0)
  const [gradingError, setGradingError] = useState(false)

  // Trigger grading API (fire-and-forget — don't await)
  useEffect(() => {
    if (!params.cardId || !params.category) return
    const endpoint = CATEGORY_ROUTES[params.category] || 'other'
    const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'
    const url = `${API_BASE}/api/${endpoint}/${params.cardId}`
    console.log('[Processing] Triggering grading API:', url)
    fetch(url).then(r => {
      console.log('[Processing] Grading API response:', r.status)
    }).catch(err => {
      console.warn('[Processing] Grading API error (will poll anyway):', err.message)
    })
  }, [params.cardId, params.category])

  // Poll for grading completion
  useEffect(() => {
    if (!params.cardId || isComplete) return

    console.log('[Processing] Starting poll for card:', params.cardId)

    pollRef.current = setInterval(async () => {
      try {
        setPollCount(prev => prev + 1)
        const { data, error } = await supabase
          .from('cards')
          .select('conversational_whole_grade, conversational_condition_label, conversational_grading')
          .eq('id', params.cardId)
          .single()

        if (error) {
          console.log('[Processing] Poll error:', error.message)
          return
        }

        // Check if grade is set
        if (data?.conversational_whole_grade) {
          console.log('[Processing] Grade found:', data.conversational_whole_grade)
          setIsComplete(true)
          setGrade(data.conversational_whole_grade)
          setCurrentStep(STEPS.length - 1)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          if (pollRef.current) clearInterval(pollRef.current)
          return
        }

        // Check if grading data exists but grade column not set (extraction issue)
        if (data?.conversational_grading && !data?.conversational_whole_grade) {
          try {
            const json = JSON.parse(data.conversational_grading)
            const extractedGrade = json.final_grade?.whole_grade || json.grading_passes?.averaged_rounded?.final
            if (extractedGrade) {
              console.log('[Processing] Grade found in JSON but not in column:', extractedGrade)
              setIsComplete(true)
              setGrade(Math.round(extractedGrade))
              setCurrentStep(STEPS.length - 1)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              if (pollRef.current) clearInterval(pollRef.current)
              return
            }
          } catch { /* JSON parse failed, continue polling */ }
        }

        console.log('[Processing] Poll #' + (pollCount + 1) + ' — no grade yet')
      } catch (err) {
        console.log('[Processing] Poll exception:', err)
      }
    }, 5000)

    // Timeout after 5 minutes — show error state
    const timeout = setTimeout(() => {
      if (!isComplete) {
        console.log('[Processing] Timeout reached — grading may have failed')
        setGradingError(true)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 300000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      clearTimeout(timeout)
    }
  }, [params.cardId, isComplete])

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
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
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
                  {status === 'done' ? (
                    <Ionicons name="checkmark" size={14} color={Colors.white} />
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

      {/* Timing info */}
      {!isComplete && !gradingError && (
        <Text style={styles.timingText}>
          This typically takes 1-2 minutes. You can grade another card or view your collection while waiting.
          {pollCount > 0 && `\n\nChecking... (${pollCount})`}
        </Text>
      )}

      {/* Timeout / Error state */}
      {gradingError && (
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[900], padding: 16 },

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
})
