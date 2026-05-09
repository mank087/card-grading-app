/**
 * BenefitCarousel — auto-rotating "did you know" tip slides shown during
 * the grading wait. Mirrors src/app/upload/pokemon/CardAnalysisAnimation
 * BENEFIT_SLIDES on web; same eight cards, same 8-second cadence, same
 * 400ms cross-fade. Last slide is a CTA tied to the credits page.
 *
 * Reusable — drop on any "loading" screen where the user is waiting
 * 30+ seconds and there's nothing else for them to do.
 */

import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Colors } from '@/lib/constants'

interface Slide {
  icon: string
  title: string
  description: string
  cta?: { label: string; href: string }
}

const SLIDES: Slide[] = [
  {
    icon: '🔬',
    title: 'Multi-Pass Grading',
    description: 'Your card is graded 3 independent times and averaged for maximum accuracy.',
  },
  {
    icon: '📊',
    title: 'Sub-Grade Breakdown',
    description: "You'll get Centering, Corners, Edges & Surface scores for both front and back.",
  },
  {
    icon: '💰',
    title: 'Market Pricing',
    description: "We'll show you what your card is worth based on its grade — powered by eBay, PriceCharting & more.",
  },
  {
    icon: '🏷️',
    title: 'Label Studio',
    description: 'Design & print custom labels for your slabs, magnetic one-touch holders, and toploaders.',
  },
  {
    icon: '🛒',
    title: 'eBay InstaList',
    description: 'List graded cards to eBay in seconds with auto-generated photos and descriptions.',
  },
  {
    icon: '📚',
    title: 'Collection Tracking',
    description: 'Build and track your graded card portfolio — watch your collection value grow over time.',
  },
  {
    icon: '🃏',
    title: '8 Card Types Supported',
    description: 'We grade Pokemon, MTG, Sports, Lorcana, One Piece, Yu-Gi-Oh, Star Wars & more.',
  },
  {
    icon: '🔥',
    title: 'Get Bonus Credits',
    description: 'Get up to 5 bonus credits on your first purchase — grades start at just $0.50/card.',
    cta: { label: 'View Credit Packs', href: '/pages/credits' },
  },
]

const ROTATE_MS = 8000
const FADE_MS = 400

export default function BenefitCarousel() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % SLIDES.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(t)
  }, [])

  const jumpTo = (i: number) => {
    if (i === idx) return
    setVisible(false)
    setTimeout(() => { setIdx(i); setVisible(true) }, FADE_MS)
  }

  const slide = SLIDES[idx]

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { opacity: visible ? 1 : 0 }]}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
        {slide.cta && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push(slide.cta!.href as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>{slide.cta.label}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => jumpTo(i)}
            hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}
          >
            <View style={[styles.dot, i === idx && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 110,
  },
  icon: { fontSize: 22, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '800', color: Colors.white, marginBottom: 3 },
  description: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 16 },
  ctaBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: Colors.purple[600],
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 14,
    backgroundColor: Colors.amber[500],
  },
})
