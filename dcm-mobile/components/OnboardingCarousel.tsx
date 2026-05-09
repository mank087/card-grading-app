import { useRef, useEffect, useState } from 'react'
import {
  View, Text, Image, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Animated, Easing,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
const SLAB_JUDGE = require('@/assets/images/onboarding/slab-judge.png')
const SLAB_PIKACHU = require('@/assets/images/onboarding/slab-pikachu.png')
const SLAB_LUFFY = require('@/assets/images/onboarding/slab-luffy.png')
const SLAB_STARWARS = require('@/assets/images/onboarding/slab-starwars.png')
const SLAB_DRAKE = require('@/assets/images/onboarding/slab-drake.png')

// ─── Label Studio images for Panel 3 ───
const LABEL_STUDIO_IMG = require('@/assets/images/onboarding/label-studio.png')
const LABEL_SLAB_IMG = require('@/assets/images/onboarding/label-slab.png')

// ─── eBay sold-listing screenshots for Panel 5 (in numbered order) ───
const EBAY_LISTINGS = [
  require('@/assets/images/onboarding/ebay/ebay-1.png'),
  require('@/assets/images/onboarding/ebay/ebay-2.png'),
  require('@/assets/images/onboarding/ebay/ebay-3.png'),
  require('@/assets/images/onboarding/ebay/ebay-4.png'),
  require('@/assets/images/onboarding/ebay/ebay-5.png'),
  require('@/assets/images/onboarding/ebay/ebay-6.png'),
  require('@/assets/images/onboarding/ebay/ebay-7.png'),
  require('@/assets/images/onboarding/ebay/ebay-8.png'),
  require('@/assets/images/onboarding/ebay/ebay-9.png'),
  require('@/assets/images/onboarding/ebay/ebay-10.png'),
]

// ─── Panel definitions ───
const PANELS = [
  {
    // Panel 1 renders the DCM logo (image) instead of an Ionicon —
    // see special case in renderPanel. The icon name here is unused
    // but kept non-null to satisfy the shared type.
    id: '1',
    icon: 'diamond' as const,
    headline: 'The Power of Card Grading\nin Your Hands',
    subtitle: 'Grade any trading card in seconds with DCM Optic™ Technology and receive full subgrade reports for Centering, Corners, Edges and Surface condition.',
  },
  {
    id: '2',
    icon: 'diamond' as const,
    headline: 'Grade Any Card Type',
    subtitle: 'Sports, Pokemon, Magic, Yu-Gi-Oh, One Piece, Star Wars, Lorcana and more — all supported.',
  },
  {
    id: '3',
    icon: 'color-palette' as const,
    headline: 'Custom Label Studio',
    subtitle: 'Design unique labels with custom colors, geometric patterns, and card-matched themes. Print-ready PDFs for slabs, toploaders, and one-touch holders.',
  },
  {
    id: '4',
    icon: 'trending-up' as const,
    headline: "Track Your Collection's Value",
    subtitle: 'Real-time market pricing, eBay integration, and portfolio tracking for every card you grade.',
  },
  {
    id: '5',
    icon: 'cart' as const,
    headline: 'Insta-List to eBay',
    subtitle: 'List graded cards to eBay in seconds — graded labels on the images, optimized titles + descriptions with grade and subgrades, and a full condition report sent to the winning bidder. All included with every grade.',
  },
]

interface Props {
  onGetStarted: () => void
  onSignIn: () => void
}

export default function OnboardingCarousel({ onGetStarted, onSignIn }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const flatListRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()

  // Auto-scroll animations for Panel 1
  const row1Anim = useRef(new Animated.Value(0)).current
  const row2Anim = useRef(new Animated.Value(0)).current
  // Vertical auto-scroll for Panel 5 (eBay listings feed)
  const ebayAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Each card slot = 100px width + 8px marginRight = 108px (must match
    // the styling in ScrollingCardsVisual). One "set" is the width of
    // ROW*_CARDS.length cards. Content is tripled in the visual, so when
    // translateX wraps from end-of-loop back to start, the next copy of
    // the array is already in the same visible position → no visible jump.
    const cardSlot = 108
    const setW = ROW1_CARDS.length * cardSlot

    // Row 1 (leftward): 0 → -setW, then loop snaps back to 0. At -setW the
    // second copy is at the left edge; at 0 the first copy is at the left
    // edge. Both are identical → seamless.
    row1Anim.setValue(0)
    Animated.loop(
      Animated.timing(row1Anim, { toValue: -setW, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start()

    // Row 2 (rightward): start at -setW (second copy visible), animate
    // to 0 (first copy visible). On loop, snaps 0 → -setW — identical
    // visually because every copy of the array is identical content.
    row2Anim.setValue(-setW)
    Animated.loop(
      Animated.timing(row2Anim, { toValue: 0, duration: 25000, easing: Easing.linear, useNativeDriver: true })
    ).start()

    // EBAY_LISTINGS_TOTAL_H is computed inside the visual component (kept
    // colocated there so card sizing tweaks live in one place); we just
    // need to drive an unbounded translateY upward and let the inner
    // component apply modulo wrap. Run from 0 → -1 over 28s and the
    // visual component scales it by its own measured content height.
    Animated.loop(
      Animated.timing(ebayAnim, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true })
    ).start()
  }, [])

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index || 0)
  }).current

  const renderPanel = ({ item, index }: { item: typeof PANELS[0]; index: number }) => {
    return (
      <View style={st.panel}>
        {/* Visual area — top ~55% */}
        <View style={st.visualArea}>
          {index === 0 && <ScrollingCardsVisual row1Anim={row1Anim} row2Anim={row2Anim} />}
          {index === 1 && <SlabCollageVisual />}
          {index === 2 && <LabelStudioVisual />}
          {index === 3 && <ChartVisual />}
          {index === 4 && <EbayInstaListVisual scrollAnim={ebayAnim} />}

          {/* Gradient fade to dark */}
          <LinearGradient colors={['transparent', '#0f0a1a']} style={st.gradientFade} />
        </View>

        {/* Content — bottom */}
        <View style={st.contentArea}>
          <View style={st.iconCircle}>
            {item.id === '1' ? (
              <Image
                source={require('@/assets/images/dcm-logo.png')}
                style={{ width: 32, height: 32 }}
                resizeMode="contain"
                tintColor="#fff"
              />
            ) : (
              <Ionicons name={item.icon} size={28} color={Colors.purple[600]} />
            )}
          </View>
          <Text style={st.headline}>{item.headline}</Text>
          <Text style={st.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={st.container}>
      {/* Logo + Name at top */}
      <View style={st.logoContainer}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={st.logo} resizeMode="contain" tintColor="#fff" />
        <Text style={st.logoText}>Dynamic Collectibles Management</Text>
      </View>

      {/* Swipe hint arrows */}
      {activeIndex > 0 && (
        <TouchableOpacity
          style={[st.arrowBtn, st.arrowLeft]}
          onPress={() => flatListRef.current?.scrollToIndex({ index: activeIndex - 1, animated: true })}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.purple[400]} />
        </TouchableOpacity>
      )}
      {activeIndex < PANELS.length - 1 && (
        <TouchableOpacity
          style={[st.arrowBtn, st.arrowRight]}
          onPress={() => flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })}
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.purple[400]} />
        </TouchableOpacity>
      )}

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

      {/* Bottom: dots + buttons. paddingBottom uses the device's safe-area
          inset so the Sign In link doesn't sit underneath the home
          indicator / Android nav buttons. */}
      <View style={[st.bottomArea, { paddingBottom: Math.max(insets.bottom + 8, 32) }]}>
        <View style={st.dots}>
          {PANELS.map((_, i) => (
            <View key={i} style={[st.dot, i === activeIndex && st.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={st.getStartedBtn} onPress={onGetStarted} activeOpacity={0.8}>
          <Text style={st.getStartedText}>Get Started</Text>
        </TouchableOpacity>

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
  const tripled1 = [...ROW1_CARDS, ...ROW1_CARDS, ...ROW1_CARDS]
  const tripled2 = [...ROW2_CARDS, ...ROW2_CARDS, ...ROW2_CARDS]

  return (
    <View style={{ flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: row1Anim }], marginBottom: 8 }}>
        {tripled1.map((src, i) => (
          <Image key={`r1-${i}`} source={src} style={{ width: cardW, height: cardH, borderRadius: 8, marginRight: 8 }} resizeMode="cover" />
        ))}
      </Animated.View>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: row2Anim }] }}>
        {tripled2.map((src, i) => (
          <Image key={`r2-${i}`} source={src} style={{ width: cardW, height: cardH, borderRadius: 8, marginRight: 8 }} resizeMode="cover" />
        ))}
      </Animated.View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 2: Slab collage — Judge center, Pikachu bottom-right
// ════════════════════════════════════════════════

function SlabCollageVisual() {
  // Positions: Judge center-front, others around it
  const slabs = [
    { src: SLAB_DRAKE,    left: '2%',  top: '8%',  rotate: '-10deg', zIndex: 1 },
    { src: SLAB_STARWARS, left: '58%', top: '5%',  rotate: '8deg',   zIndex: 2 },
    { src: SLAB_LUFFY,    left: '0%',  top: '42%', rotate: '6deg',   zIndex: 3 },
    { src: SLAB_JUDGE,    left: '22%', top: '18%', rotate: '-1deg',  zIndex: 5 },
    { src: SLAB_PIKACHU,  left: '52%', top: '40%', rotate: '-6deg',  zIndex: 4 },
  ]

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {slabs.map((s, i) => (
        <Image
          key={i}
          source={s.src}
          style={{
            position: 'absolute',
            width: W * 0.38,
            height: W * 0.52,
            borderRadius: 8,
            left: s.left as any,
            top: s.top as any,
            zIndex: s.zIndex,
            transform: [{ rotate: s.rotate }],
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
          resizeMode="contain"
        />
      ))}
    </View>
  )
}

// ════════════════════════════════════════════════
// Panel 3: Label Studio — real screenshots
// ════════════════════════════════════════════════

function LabelStudioVisual() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {/* Label studio UI screenshot */}
        <View style={{ flex: 1, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
          <Image
            source={LABEL_STUDIO_IMG}
            style={{ width: '100%', height: H * 0.38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            resizeMode="contain"
          />
        </View>
        {/* Custom designed label / slab screenshot */}
        <View style={{ flex: 1, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
          <Image
            source={LABEL_SLAB_IMG}
            style={{ width: '100%', height: H * 0.38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            resizeMode="contain"
          />
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

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      {/* Value card */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, width: W * 0.7, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
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

      {/* Trend line */}
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
// Panel 5: eBay Insta-List — auto-scrolling sold-listings feed
// ════════════════════════════════════════════════

function EbayInstaListVisual({ scrollAnim }: { scrollAnim: Animated.Value }) {
  // Each listing screenshot is ~333x195 (1.7:1). We render the column
  // at 88% of screen width so it reads like a real eBay feed card.
  const cardW = W * 0.88
  const cardH = cardW * (195 / 333)
  const gap = 10
  const itemH = cardH + gap

  // Duplicate the array so when translateY hits -(setH) the second
  // copy is already in the same visual position as the first → seamless loop.
  const setH = EBAY_LISTINGS.length * itemH
  const doubled = [...EBAY_LISTINGS, ...EBAY_LISTINGS]

  // scrollAnim drives 0 → 1 over 28s (from parent). Map it to 0 → -setH
  // so one full pass through the 10 listings = one loop iteration.
  const translateY = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -setH],
  })

  return (
    <View style={{ flex: 1, alignItems: 'center', overflow: 'hidden', paddingTop: 8 }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {doubled.map((src, i) => (
          <View
            key={i}
            style={{
              width: cardW,
              height: cardH,
              marginBottom: gap,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: '#fff',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Image source={src} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        ))}
      </Animated.View>
    </View>
  )
}

// ════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1a' },

  logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16, zIndex: 10 },
  logo: { width: 28, height: 28 },
  logoText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // Swipe arrows
  arrowBtn: { position: 'absolute', top: '45%', zIndex: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.2)', justifyContent: 'center', alignItems: 'center' },
  arrowLeft: { left: 6 },
  arrowRight: { right: 6 },

  panel: { width: W, flex: 1 },
  visualArea: { flex: 0.55, overflow: 'hidden', position: 'relative' },
  gradientFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  contentArea: { flex: 0.45, alignItems: 'center', paddingHorizontal: 28, paddingTop: 4 },

  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(124,58,237,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  headline: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 30, marginBottom: 10 },
  subtitle: { fontSize: 13, color: Colors.gray[400], textAlign: 'center', lineHeight: 19 },

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
