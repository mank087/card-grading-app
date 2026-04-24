import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
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

  // Poll for grading completion
  useEffect(() => {
    if (!params.cardId || isComplete) return

    pollRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('cards')
          .select('conversational_whole_grade, conversational_condition_label')
          .eq('id', params.cardId)
          .single()

        if (!error && data?.conversational_whole_grade) {
          setIsComplete(true)
          setGrade(data.conversational_whole_grade)
          setCurrentStep(STEPS.length - 1)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch { /* continue polling */ }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
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
    <View style={styles.container}>
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
      {!isComplete && (
        <Text style={styles.timingText}>
          This typically takes 1-2 minutes. You can grade another card or view your collection while waiting.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[900], padding: 16, paddingTop: 56 },

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
  stepIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gray[700], alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: Colors.green[500] },
  stepIconActive: { backgroundColor: Colors.purple[600] },
  stepText: { fontSize: 14, color: Colors.gray[500] },
  stepTextDone: { color: Colors.green[400] },
  stepTextActive: { color: Colors.white, fontWeight: '600' },
  activeIndicator: { color: Colors.purple[400], fontSize: 16, fontWeight: '700' },

  // Timing
  timingText: { fontSize: 12, color: Colors.gray[500], textAlign: 'center', lineHeight: 18 },
})
