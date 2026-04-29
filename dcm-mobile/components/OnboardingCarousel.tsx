import { useRef, useEffect, useState } from 'react'
import {
  View, Text, Image, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Animated, Easing,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'

const { width: W, height: H } = Dimensions.get('window')

// ─── Card images for scrolling strip (Panel 1) ───
const ROW1_CARDS = [
  require('@/assets/images/onboarding/card1.png'),
  require('@/assets/images/onboarding/card2.png'),
  require('@/assets/images/onboarding/card3.png'),
  require('@/assets/images/onboarding/card4.png'),
  require('@/assets/images/onboarding/card5.png'),
  require('@/assets/images/onboarding/card6.png'),
]
const ROW2_CARDS = [
  require('@/assets/images/onboarding/card7.png'),
  require('@/assets/images/onboarding/card8.png'),
  require('@/assets/images/onboarding/card9.png'),
  require('@/assets/images/onboarding/card10.png'),
  require('@/assets/images/onboarding/card11.png'),
  require('@/assets/images/onboarding/card12.png'),
]

// ─── Slab images for Panel 2 ───
const SLABS = [
  require('@/assets/images/onboarding/slab-judge.png'),
  require('@/assets/images/onboarding/slab-pikachu.png'),
  require('@/assets/images/onboarding/slab-luffy.png'),
  require('@/assets/images/onboarding/slab-starwars.png'),
  require('@/assets/images/onboarding/slab-drake.png'),
]

// ─── Panel definitions ───
const PANELS = [
  {
    id: '1',
    icon: 'diamond' as const,
    headline: 'AI-Powered Card Grading',
    subtitle: 'Grade any trading card in seconds with DCM Optic™ AI — Pokemon, Sports, MTG & more.',
  },
  {
    id: '2',
    icon: 'layers' as const,
    headline: 'Grade Any Card Type',
    subtitle: 'Sports, Pokemon, Magic, Yu-Gi-Oh, One Piece, Star Wars, Lorcana and more — all supported.',
  },
  {
    id: '3',
    icon: 'color-palette' as const,
    headline: 'Custom Label Studio',
    subtitle: 'Design unique labels with custom colors, geometric patterns, and card-matched themes. Print-ready PDFs.',
  },
  {
    id: '4',
    icon: 'trending-up' as const,
    headline: "Track Your Collection's Value",
    subtitle: 'Real-time market pricing, eBay integration, and portfolio tracking for every card you grade.',
  },
]

interface Props {
  onGetStarted: () => void
  onSignIn: () => void
}

export default function OnboardingCarousel({ onGetStarted, onSignIn }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)

  // Auto-scroll animations for Panel 1
  const row1Anim = useRef(new Animated.Value(0)).current
  const row2Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const cardW = 120
    const totalW = ROW1_CARDS.length * cardW
    Animated.loop(
      Animated.timing(row1Anim, { toValue: -totalW, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start()
    Animated.loop(
      Animated.timing(row2Anim, { toValue: totalW / 2, duration: 25000, easing: Easing.linear, useNativeDriver: true })
    ).start()
  }, [])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index || 0)
  }).current

  const renderPanel = ({ item, index }: { item: typeof PANELS[0]; index: number }) => {
    return (
      <View style={st.panel}>
        {/* Visual area — top 55% */}
        <View style={st.visualArea}>
          {index === 0 && <ScrollingCardsVisual row1Anim={row1Anim} row2Anim={row2Anim} />}
          {index === 1 && <SlabCollageVisual />}
          {index === 2 && <LabelStudioVisual />}
          {index === 3 && <ChartVisual />}

          {/* Gradient fade to dark */}
          <LinearGradient
            colors={['transparent', '#0f0a1a']}
            style={st.gradientFade}
          />
        </View>

        {/* Content — bottom 45% */}
        <View style={st.contentArea}>
          <View style={st.iconCircle}>
            <Ionicons name={item.icon} size={28} color={Colors.purple[600]} />
          </View>
          <Text style={st.headline}>{item.headline}</Text>
          <Text style={st.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={st.container}>
      {/* DCM Logo at top */}
      <View style={st.logoContainer}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={st.logo} resizeMode="contain" tintColor="#fff" />
        <Text style={st.logoText}>DCM Grading</Text>
      </View>

      {/* Panels */}
      <FlatList
        ref={flatListRef}
        data={PANELS}
        renderItem={renderPanel}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={W}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Bottom: dots + buttons */}
      <View style={st.bottomArea}>
        {/* Pagination dots */}
        <View style={st.dots}>
          {PANELS.map((_, i) => (
            <View key={i} style={[st.dot, i === activeIndex && st.dotActive]} />
          ))}
        </View>

        {/* Get Started button */}
        <TouchableOpacity style={st.getStartedBtn} onPress={onGetStarted} activeOpacity={0.8}>
          <Text style={st.getStartedText}>Get Started</Text>
        </TouchableOpacity>

        {/* Sign In link */}
        <TouchableOpacity onPress={onSignIn} style={st.signInLink}>
          <Text style={st.signInText}>Already have an account? <Text style={st.signInBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 1: Scrolling card strips
// ════════════════════════════════════════════════

function ScrollingCardsVisual({ row1Anim, row2Anim }: { row1Anim: Animated.Value; row2Anim: Animated.Value }) {
  const cardW = 100
  const cardH = 140
  const doubled1 = [...ROW1_CARDS, ...ROW1_CARDS, ...ROW1_CARDS]
  const doubled2 = [...ROW2_CARDS, ...ROW2_CARDS, ...ROW2_CARDS]

  return (
    <View style={{ flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: row1Anim }], marginBottom: 8 }}>
        {doubled1.map((src, i) => (
          <Image key={`r1-${i}`} source={src} style={{ width: cardW, height: cardH, borderRadius: 8, marginRight: 8 }} resizeMode="cover" />
        ))}
      </Animated.View>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: row2Anim }], marginLeft: -200 }}>
        {doubled2.map((src, i) => (
          <Image key={`r2-${i}`} source={src} style={{ width: cardW, height: cardH, borderRadius: 8, marginRight: 8 }} resizeMode="cover" />
        ))}
      </Animated.View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 2: Overlapping slab collage
// ════════════════════════════════════════════════

function SlabCollageVisual() {
  const positions = [
    { left: '5%', top: '15%', rotate: '-8deg', zIndex: 1 },
    { left: '55%', top: '5%', rotate: '6deg', zIndex: 2 },
    { left: '25%', top: '25%', rotate: '-2deg', zIndex: 5 },
    { left: '0%', top: '40%', rotate: '10deg', zIndex: 3 },
    { left: '50%', top: '35%', rotate: '-5deg', zIndex: 4 },
  ]
  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {SLABS.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={{
            position: 'absolute',
            width: W * 0.38,
            height: W * 0.52,
            borderRadius: 8,
            ...(positions[i] as any),
            transform: [{ rotate: positions[i].rotate }],
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}
          resizeMode="contain"
        />
      ))}
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 3: Label Studio showcase
// ════════════════════════════════════════════════

function LabelStudioVisual() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      {/* Mockup of label studio features */}
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, width: W * 0.75, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
        {/* Color theme grid */}
        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.gray[700], marginBottom: 6 }}>Color Theme</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {['#0a0a0a', '#1a1625', '#f9fafb', '#1e3a5f', '#3c1a1a', '#ff0000', '#7c3aed', '#2d1f47'].map((c, i) => (
            <View key={i} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: c, borderWidth: i === 6 ? 2 : 1, borderColor: i === 6 ? Colors.purple[600] : Colors.gray[200] }} />
          ))}
        </View>
        {/* Layout style row */}
        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.gray[700], marginBottom: 4 }}>Layout Style</Text>
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
          {['Gradient', 'Extension', 'Neon', 'Geometric', 'Split'].map((l, i) => (
            <View key={l} style={{ flex: 1, backgroundColor: i === 3 ? Colors.purple[50] : Colors.gray[50], borderRadius: 6, paddingVertical: 4, borderWidth: i === 3 ? 1 : 0, borderColor: Colors.purple[600] }}>
              <Text style={{ fontSize: 7, textAlign: 'center', color: i === 3 ? Colors.purple[700] : Colors.gray[500], fontWeight: '600' }}>{l}</Text>
            </View>
          ))}
        </View>
        {/* Mini slab preview */}
        <View style={{ alignItems: 'center' }}>
          <LinearGradient
            colors={['#7c3aed', '#4c1d95']}
            style={{ width: W * 0.55, height: 24, borderRadius: 4, justifyContent: 'center', paddingHorizontal: 8 }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 7, fontWeight: '700' }}>DCM</Text>
              <Text style={{ color: '#fff', fontSize: 6 }}>Card Name • Set</Text>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>10</Text>
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 4: Chart/value visualization
// ════════════════════════════════════════════════

function ChartVisual() {
  const barHeights = [40, 65, 50, 80, 55, 90, 70, 100, 85, 95, 75, 110]
  const linePoints = [60, 55, 70, 65, 80, 75, 90, 85, 95, 100, 90, 105]

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      {/* Value card */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, width: W * 0.7, marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.green[500] }}>$4,827</Text>
        <Text style={{ fontSize: 12, color: Colors.gray[400] }}>Collection Value</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Ionicons name="arrow-up" size={14} color={Colors.green[500]} />
          <Text style={{ fontSize: 12, color: Colors.green[500], fontWeight: '600' }}>+12.3% this month</Text>
        </View>
      </View>

      {/* Bar chart */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 120, width: W * 0.7 }}>
        {barHeights.map((h, i) => (
          <View key={i} style={{ flex: 1 }}>
            <LinearGradient
              colors={[Colors.purple[400], Colors.purple[700]]}
              style={{ height: h, borderRadius: 3 }}
            />
          </View>
        ))}
      </View>

      {/* Line overlay hint */}
      <View style={{ position: 'absolute', top: '55%', left: 30, right: 30, height: 2, borderRadius: 1 }}>
        <LinearGradient
          colors={[Colors.green[500], Colors.green[500]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 2, borderRadius: 1, opacity: 0.5 }}
        />
      </View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1a' },

  logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 50, paddingBottom: 8, zIndex: 10 },
  logo: { width: 32, height: 32 },
  logoText: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  panel: { width: W, flex: 1 },
  visualArea: { flex: 0.55, overflow: 'hidden', position: 'relative' },
  gradientFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  contentArea: { flex: 0.45, alignItems: 'center', paddingHorizontal: 32, paddingTop: 8 },

  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  headline: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 32, marginBottom: 10 },
  subtitle: { fontSize: 14, color: Colors.gray[400], textAlign: 'center', lineHeight: 20 },

  bottomArea: { paddingHorizontal: 24, paddingBottom: 32 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gray[600] },
  dotActive: { width: 24, borderRadius: 4, backgroundColor: Colors.purple[600] },

  getStartedBtn: { backgroundColor: Colors.purple[600], borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  getStartedText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  signInLink: { alignItems: 'center', paddingVertical: 8 },
  signInText: { fontSize: 13, color: Colors.gray[500] },
  signInBold: { color: Colors.purple[400], fontWeight: '700' },
})
