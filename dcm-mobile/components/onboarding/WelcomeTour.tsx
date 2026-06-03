/**
 * WelcomeTour — the visual layer for the post-signup welcome tour.
 * Three modes based on which step/screen the WelcomeTourContext is on:
 *
 *   1. Welcome intro (currentScreen='welcome'): full-screen panel with
 *      4 benefit cards, "Take the 1-minute tour" + "Skip tour" buttons.
 *      Visual style matches OnboardingCarousel (dark gradient bg, white
 *      text) for continuity from the pre-signup carousel.
 *
 *   2. Per-step tooltip (currentScreen='grade'|'collection'|'labels'|
 *      'portfolio'|'account'): bottom-aligned card with title + body,
 *      step indicator dots, Next + Skip buttons. The underlying tab is
 *      already visible (the context navigated there) so the user sees
 *      the actual screen while reading the tooltip.
 *
 *   3. Completion (currentScreen='complete'): full-screen "You're all
 *      set!" card with "Grade my first card" primary + "Done" secondary.
 *
 * Mount once at the root layout. Tour visibility is driven entirely by
 * WelcomeTourContext.active — when false, this returns null.
 */

import { useMemo } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { useWelcomeTour } from '@/contexts/WelcomeTourContext'
import { TOUR_STEPS, TOUR_SCREEN_ORDER, type TourScreenId } from './welcomeTourContent'

const WELCOME_BENEFITS = [
  { icon: '🔬', title: 'Triple-pass AI grading', body: 'Every card is analyzed 3 independent times and averaged for maximum accuracy. PSA-aligned scoring.' },
  { icon: '💰', title: 'Real market pricing', body: "See what your card is worth based on its grade — pulled from live eBay sales + PriceCharting data." },
  { icon: '🏷️', title: 'Custom slab labels', body: 'Design and print labels for your slabs, magnetic one-touch holders, and toploaders.' },
  { icon: '🛒', title: 'List to eBay from the InstaList tab', body: 'Publish graded cards to your eBay store in seconds — auto-generated labels, mini grading report, and smart pricing. Track active and sold listings without leaving DCM.' },
] as const

export default function WelcomeTour() {
  const tour = useWelcomeTour()
  const insets = useSafeAreaInsets()

  if (!tour.active || !tour.currentScreen) return null

  const steps = TOUR_STEPS[tour.currentScreen]
  const step = steps[tour.currentStep]
  if (!step) return null

  if (tour.currentScreen === 'welcome') {
    return <WelcomeIntro onStart={tour.next} onSkip={tour.skip} />
  }

  if (tour.currentScreen === 'complete') {
    return <CompletionPanel onGradeNow={tour.complete} onDone={tour.skip} />
  }

  // currentScreen is narrowed above (welcome/complete are handled by
  // dedicated panels) — assert here so the prop type matches.
  return (
    <TooltipOverlay
      title={step.title}
      body={step.body}
      currentScreen={tour.currentScreen as Exclude<TourScreenId, 'welcome' | 'complete'>}
      currentStep={tour.currentStep}
      totalSteps={tour.totalStepsInScreen}
      onNext={tour.next}
      onSkip={tour.skip}
      bottomInset={insets.bottom}
    />
  )
}

// ════════════════════════════════════════════════
// Welcome intro — first screen, full-bleed dark panel with benefits
// ════════════════════════════════════════════════

function WelcomeIntro({ onStart, onSkip }: { onStart: () => void; onSkip: () => Promise<void> }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      <View style={[st.introContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={st.introScroll} showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={st.introLogoRow}>
            <Image
              source={require('@/assets/images/dcm-logo.png')}
              style={st.introLogo}
              resizeMode="contain"
              tintColor="#fff"
            />
            <Text style={st.introLogoText}>DCM Grading</Text>
          </View>

          {/* Headline */}
          <Text style={st.introHeadline}>Welcome to DCM Grading</Text>
          <Text style={st.introSubhead}>Professional card grading in seconds — powered by DCM Optic™</Text>

          {/* 4 benefit cards */}
          <View style={st.benefitsList}>
            {WELCOME_BENEFITS.map(b => (
              <View key={b.title} style={st.benefitCard}>
                <Text style={st.benefitIcon}>{b.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.benefitTitle}>{b.title}</Text>
                  <Text style={st.benefitBody}>{b.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTAs */}
        <View style={st.introCtas}>
          <TouchableOpacity style={st.primaryBtn} onPress={onStart} activeOpacity={0.85}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={st.primaryBtnText}>Take the 1-minute tour</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={st.skipLink} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={st.skipLinkText}>Skip tour</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ════════════════════════════════════════════════
// Per-step tooltip — bottom-aligned card
// ════════════════════════════════════════════════

function TooltipOverlay({
  title,
  body,
  currentScreen,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  bottomInset,
}: {
  title: string
  body: string
  // TooltipOverlay is only rendered for the per-tab steps. Welcome +
  // Complete are handled by separate full-screen panels above.
  currentScreen: Exclude<TourScreenId, 'welcome' | 'complete'>
  currentStep: number
  totalSteps: number
  onNext: () => void
  onSkip: () => Promise<void>
  bottomInset: number
}) {
  // The MobileTabBar (~64-72px tall incl. inset) sits at the bottom of
  // the tab screens. Lift the tooltip card above it so it doesn't get
  // obscured. The card is positioned absolutely so the user can still
  // see the actual screen behind it.
  const tabBarApproxHeight = 56 + Math.max(bottomInset, 8)

  // Index across the entire tour (used for the screen indicator dots).
  const screenIdx = TOUR_SCREEN_ORDER.indexOf(currentScreen)
  const tourableScreens = TOUR_SCREEN_ORDER.filter(
    s => s !== 'welcome' && s !== 'complete',
  )
  const totalScreens = tourableScreens.length
  const screenDotIdx = tourableScreens.indexOf(currentScreen)

  return (
    <View
      pointerEvents="box-none"
      style={[st.tooltipPositioner, { bottom: tabBarApproxHeight + 12 }]}
    >
      <View style={st.tooltipCard}>
        {/* Header: screen indicator + skip button */}
        <View style={st.tooltipHeader}>
          <View style={st.screenDots}>
            {tourableScreens.map((_, i) => (
              <View
                key={i}
                style={[
                  st.screenDot,
                  i === screenDotIdx && st.screenDotActive,
                  i < screenDotIdx && st.screenDotPast,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={st.skipInline}>Skip tour</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Text style={st.tooltipTitle}>{title}</Text>
        <Text style={st.tooltipBody}>{body}</Text>

        {/* Step + Next */}
        <View style={st.tooltipFooter}>
          <Text style={st.stepLabel}>
            {currentStep + 1} of {totalSteps}
          </Text>
          <TouchableOpacity style={st.nextBtn} onPress={onNext} activeOpacity={0.85}>
            <Text style={st.nextBtnText}>Next</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Completion — full-screen wrap-up
// ════════════════════════════════════════════════

function CompletionPanel({ onGradeNow, onDone }: { onGradeNow: () => Promise<void>; onDone: () => Promise<void> }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={[st.completeContainer, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
        <View style={st.completeBody}>
          <View style={st.completeCheck}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={st.completeTitle}>You’re all set! 🎉</Text>
          <Text style={st.completeText}>
            You know the layout — let’s grade your first card. Each grade builds your verified
            collection and unlocks DCM’s full toolkit.
          </Text>
        </View>
        <View style={st.completeCtas}>
          <TouchableOpacity style={st.primaryBtn} onPress={onGradeNow} activeOpacity={0.85}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={st.primaryBtnText}>Grade my first card</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDone} style={st.skipLink} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={st.skipLinkText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ════════════════════════════════════════════════
// Styles — mirror OnboardingCarousel palette for visual continuity
// ════════════════════════════════════════════════

const st = StyleSheet.create({
  // Intro
  introContainer: { flex: 1, backgroundColor: '#0f0a1a', paddingHorizontal: 24 },
  introScroll: { paddingVertical: 16, flexGrow: 1 },
  introLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  introLogo: { width: 32, height: 32 },
  introLogoText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  introHeadline: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  introSubhead: { fontSize: 14, color: Colors.gray[400], textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  benefitsList: { gap: 12 },
  benefitCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    borderRadius: 14,
    padding: 14,
  },
  benefitIcon: { fontSize: 28 },
  benefitTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 3 },
  benefitBody: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },

  introCtas: { gap: 8, paddingTop: 12 },
  primaryBtn: {
    backgroundColor: Colors.purple[600],
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  skipLink: { alignItems: 'center', paddingVertical: 8 },
  skipLinkText: { color: Colors.gray[400], fontSize: 13, fontWeight: '600' },

  // Tooltip overlay
  tooltipPositioner: {
    position: 'absolute',
    left: 12,
    right: 12,
    // bottom set inline (above tab bar + inset)
  },
  tooltipCard: {
    backgroundColor: '#1a1024',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  screenDots: { flexDirection: 'row', gap: 4 },
  screenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  screenDotActive: { backgroundColor: Colors.purple[400], width: 18 },
  screenDotPast: { backgroundColor: 'rgba(168,85,247,0.5)' },
  skipInline: { fontSize: 12, color: Colors.gray[400], fontWeight: '600' },
  tooltipTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tooltipBody: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  tooltipFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  stepLabel: { fontSize: 11, color: Colors.gray[400], fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.purple[600],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Completion
  completeContainer: {
    flex: 1,
    backgroundColor: '#0f0a1a',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  completeBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  completeCheck: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.green[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completeTitle: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  completeText: { fontSize: 14, color: Colors.gray[400], textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  completeCtas: { gap: 8 },
})
