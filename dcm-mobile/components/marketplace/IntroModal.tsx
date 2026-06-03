import { useEffect, useState } from 'react'
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity,
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

// Bumped from v1 → v2 when the benefit copy was rewritten to match the
// web marketplace's feature list. Users who already dismissed v1 will see
// v2 on their next visit so they catch the updated value-prop.
const STORAGE_KEY_VERSION = 'v2'
const storageKey = (userId: string | null | undefined) =>
  `dcm_instalist_intro_seen_${STORAGE_KEY_VERSION}_${userId ?? 'anon'}`

interface Props {
  userId: string | null | undefined
}

// Mirrors the benefit list shown on the web /instalist-marketplace
// marketing section, so mobile + web tell the same story.
const BENEFITS = [
  {
    emoji: '🖼️',
    title: 'Auto-generated listing images',
    body: 'Front + back graded label images, your mini grading report, and the raw photos of your card. Add gallery uploads if you want more.',
  },
  {
    emoji: '🏷️',
    title: 'Grade baked into eBay specifics',
    body: "DCM grader certification, grade, and certification number populate eBay's required graded-card fields for you.",
  },
  {
    emoji: '📊',
    title: 'Live performance dashboard',
    body: 'Active listings, sold history, ended (unsold), revenue, view counts, watchers. All in one view, refreshed every 15 minutes.',
  },
  {
    emoji: '🔄',
    title: 'One-click relist',
    body: 'When a listing ends without selling, relist it with the same details and updated price in one click.',
  },
  {
    emoji: '🎁',
    title: 'Complimentary for DCM users',
    body: 'No referral fees, no markup, no commission. InstaList is part of your DCM account. You list, you keep all the proceeds.',
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
              The fastest way to list your DCM-graded cards on eBay. Track every active and sold listing in one place.
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map(b => (
                <View key={b.title} style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Text style={styles.benefitEmoji}>{b.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitBody}>{b.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.fineprint}>
              Listings go live on your eBay seller account. Payments are processed by eBay,
              and DCM never sees buyer funds.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.cta}
            onPress={handleDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it, take me to the marketplace"
          >
            <Text style={styles.ctaText}>Got it, let&rsquo;s list a card</Text>
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
  benefitEmoji: { fontSize: 22, lineHeight: 26 },
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
