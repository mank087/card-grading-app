import { useEffect, useState } from 'react'
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'

/**
 * First-visit intro modal for InstaList Marketplace. Mirrors the marketing
 * panel from the web marketplace page so mobile users get the same value-
 * prop on first open.
 *
 * Dismissal is persisted to AsyncStorage keyed by user id. Bumping
 * STORAGE_KEY_VERSION re-shows the modal to existing users if we ever
 * meaningfully change the copy or feature scope.
 */

const STORAGE_KEY_VERSION = 'v1'
const storageKey = (userId: string | null | undefined) =>
  `dcm_instalist_intro_seen_${STORAGE_KEY_VERSION}_${userId ?? 'anon'}`

interface Props {
  userId: string | null | undefined
}

const BENEFITS = [
  {
    icon: 'images' as const,
    title: 'Auto-generated photos',
    body: 'Front + back graded labels and a DCM mini grading report — assembled in seconds, no photo-editing required.',
  },
  {
    icon: 'pricetag' as const,
    title: 'Smart pricing',
    body: 'We seed your listing title and price from live eBay market data so you start at the right number.',
  },
  {
    icon: 'swap-horizontal' as const,
    title: 'Reorder your gallery',
    body: 'Drag any image into position 1 — the first picture is the one buyers see in eBay search results.',
  },
  {
    icon: 'analytics' as const,
    title: 'Track everything',
    body: 'Active, sold, and ended listings all in one place — pull-to-refresh and tap any row to jump to eBay.',
  },
]

export default function IntroModal({ userId }: Props) {
  // Start as 'unknown' so we don't flash the modal before AsyncStorage
  // hydrates. Only flip to true if storage confirms it's the first visit.
  const [visible, setVisible] = useState<boolean | 'pending'>('pending')
  const insets = useSafeAreaInsets()

  useEffect(() => {
    let mounted = true
    AsyncStorage.getItem(storageKey(userId))
      .then(seen => {
        if (!mounted) return
        setVisible(seen ? false : true)
      })
      .catch(() => mounted && setVisible(false))
    return () => { mounted = false }
  }, [userId])

  const handleDismiss = async () => {
    setVisible(false)
    try { await AsyncStorage.setItem(storageKey(userId), '1') } catch { /* best effort */ }
  }

  if (visible !== true) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <LinearGradient
              colors={[Colors.purple[600], Colors.purple[800]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconRing}
            >
              <Ionicons name="storefront" size={32} color="#fff" />
            </LinearGradient>

            <Text style={styles.title}>Welcome to InstaList Marketplace</Text>
            <Text style={styles.subtitle}>
              The fastest way to list your DCM-graded cards on eBay — and track everything that comes after.
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map(b => (
                <View key={b.title} style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name={b.icon} size={18} color={Colors.purple[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitBody}>{b.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.fineprint}>
              Listings go live on your eBay seller account. Payments are processed by eBay — DCM
              never sees buyer funds.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.cta}
            onPress={handleDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it, take me to the marketplace"
          >
            <Text style={styles.ctaText}>Got it — let&rsquo;s list a card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.gray[300],
    alignSelf: 'center', marginBottom: 12,
  },
  body: { paddingHorizontal: 24, paddingBottom: 12 },
  iconRing: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: Colors.gray[900],
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: Colors.gray[600],
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  benefits: { gap: 16, marginBottom: 16 },
  benefit: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.purple[50],
    alignItems: 'center', justifyContent: 'center',
  },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray[900], marginBottom: 2 },
  benefitBody: { fontSize: 13, color: Colors.gray[600], lineHeight: 18 },
  fineprint: {
    fontSize: 11, color: Colors.gray[500],
    textAlign: 'center', lineHeight: 16, marginTop: 8,
  },
  cta: {
    marginHorizontal: 24, marginTop: 12,
    backgroundColor: Colors.purple[600],
    paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
})
