import { useEffect, useRef, useState } from 'react'
import { View, Image, StyleSheet, Animated, Dimensions, Easing, TouchableOpacity, Text } from 'react-native'
import { Colors } from '@/lib/constants'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// Card images — graded slabs from why-dcm
const CARD_IMAGES = [
  require('@/assets/images/slab-pokemon.png'),
  require('@/assets/images/slab-football.png'),
  require('@/assets/images/slab-baseball.png'),
  require('@/assets/images/slab-lorcana.png'),
  require('@/assets/images/slab-mtg.png'),
  require('@/assets/images/slab-onepiece.png'),
  require('@/assets/images/slab-starwars.png'),
  require('@/assets/images/slab-yugioh.png'),
]

// Destinations for each card — spread to top-left and top-right corners
const CARD_DESTINATIONS = [
  { x: -SCREEN_W * 0.35, y: -SCREEN_H * 0.42, rotate: '-25deg' },  // top-left far
  { x: SCREEN_W * 0.32, y: -SCREEN_H * 0.44, rotate: '20deg' },   // top-right far
  { x: -SCREEN_W * 0.28, y: -SCREEN_H * 0.30, rotate: '-15deg' },  // top-left mid
  { x: SCREEN_W * 0.25, y: -SCREEN_H * 0.32, rotate: '18deg' },   // top-right mid
  { x: -SCREEN_W * 0.15, y: -SCREEN_H * 0.38, rotate: '-8deg' },   // top-left near
  { x: SCREEN_W * 0.18, y: -SCREEN_H * 0.36, rotate: '12deg' },   // top-right near
  { x: -SCREEN_W * 0.40, y: -SCREEN_H * 0.25, rotate: '-30deg' },  // left
  { x: SCREEN_W * 0.38, y: -SCREEN_H * 0.28, rotate: '28deg' },   // right
]

interface WelcomeAnimationProps {
  onComplete: () => void
}

export default function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const [showLogo, setShowLogo] = useState(false)
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.3)).current

  // Create animated values for each card
  const cardAnims = useRef(
    CARD_IMAGES.map(() => ({
      translateY: new Animated.Value(SCREEN_H * 0.6),  // Start below screen
      translateX: new Animated.Value(0),                 // Start centered
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8),
      rotate: new Animated.Value(0),
    }))
  ).current

  useEffect(() => {
    // Phase 1: Cards fly up from bottom center, staggered
    const cardAnimations = cardAnims.map((anim, index) => {
      const dest = CARD_DESTINATIONS[index]
      const delay = index * 80  // Stagger by 80ms

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          // Fade in quickly
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          // Scale up slightly
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
          // Fly upward to destination Y
          Animated.timing(anim.translateY, {
            toValue: dest.y,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Spread to destination X
          Animated.timing(anim.translateX, {
            toValue: dest.x,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Rotate to final angle
          Animated.timing(anim.rotate, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ])
    })

    // Phase 2: After cards settle, show DCM logo
    Animated.sequence([
      // All cards animate simultaneously (with stagger built in)
      Animated.parallel(cardAnimations),
      // Brief pause
      Animated.delay(200),
      // Fade cards slightly and show logo
      Animated.parallel([
        // Dim cards a bit
        ...cardAnims.map(anim =>
          Animated.timing(anim.opacity, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          })
        ),
        // Logo fade + scale in
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(logoOpacity, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
              toValue: 1,
              friction: 4,
              tension: 80,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      // Hold briefly
      Animated.delay(800),
    ]).start(() => {
      // Animation complete — transition to login
      onComplete()
    })

    setShowLogo(true)
  }, [])

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={styles.background} />

      {/* Animated cards */}
      {CARD_IMAGES.map((img, index) => {
        const anim = cardAnims[index]
        const dest = CARD_DESTINATIONS[index]
        const rotateInterpolated = anim.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', dest.rotate],
        })

        return (
          <Animated.View
            key={index}
            style={[
              styles.cardContainer,
              {
                opacity: anim.opacity,
                transform: [
                  { translateX: anim.translateX },
                  { translateY: anim.translateY },
                  { scale: anim.scale },
                  { rotate: rotateInterpolated },
                ],
              },
            ]}
          >
            <Image source={img} style={styles.cardImage} resizeMode="contain" />
          </Animated.View>
        )
      })}

      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={onComplete} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* DCM Logo — appears after cards */}
      {showLogo && (
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/dcm-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Animated.Text style={[styles.logoText, { opacity: logoOpacity }]}>
            DCM Grading
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0a1a',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0a1a',
  },
  cardContainer: {
    position: 'absolute',
    width: 100,
    height: 150,
    // Cards start at bottom center
    bottom: -80,
    alignSelf: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  logoContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 8,
    letterSpacing: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
})
