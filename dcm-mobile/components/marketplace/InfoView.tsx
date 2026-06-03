import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/lib/constants'

export type InfoVariant = 'guest' | 'no-cards' | 'connect' | 'error'

interface Props {
  variant: InfoVariant
  /** For 'connect' variant: triggers native OAuth flow. */
  onConnect?: () => void
  /** For 'connect' variant: shown while OAuth is in flight. */
  isConnecting?: boolean
  /** For 'error' variant: failure message. */
  errorMessage?: string
  /** For 'error' variant: retry handler. */
  onRetry?: () => void
}

/**
 * Full-screen explainer view shown when the user isn't ready to see the
 * marketplace dashboard yet. Four variants:
 *   - guest: not signed in
 *   - no-cards: signed in, zero graded cards
 *   - connect: has cards but eBay isn't connected
 *   - error: data load failed
 *
 * All CTAs route through existing native screens. No purchase UI is
 * embedded — credit-related paths route to `pages/credits` which already
 * handles the iOS IAP vs Android Stripe fork.
 */
export default function InfoView({ variant, onConnect, isConnecting, errorMessage, onRetry }: Props) {
  const router = useRouter()

  const CONTENT: Record<InfoVariant, {
    icon: keyof typeof Ionicons.glyphMap
    iconBg: string
    iconColor: string
    title: string
    body: string
    ctaLabel: string
    onPress: () => void
    secondaryCtaLabel?: string
    onSecondaryPress?: () => void
  }> = {
    guest: {
      icon: 'storefront',
      iconBg: Colors.purple[50],
      iconColor: Colors.purple[600],
      title: 'List your graded cards on eBay',
      body: "Sign in to publish polished, DCM-graded listings to your eBay store in a couple of taps — front + back labels, mini grading report, and item specifics all auto-filled.",
      ctaLabel: 'Sign in to continue',
      onPress: () => router.push('/(auth)/login' as any),
    },
    'no-cards': {
      icon: 'sparkles',
      iconBg: Colors.purple[50],
      iconColor: Colors.purple[600],
      title: 'Grade your first card',
      body: "InstaList lists cards you've graded with DCM. Grade your first card and you'll be able to publish it to eBay right from here.",
      ctaLabel: 'Grade a card',
      onPress: () => router.push('/(tabs)/grade'),
    },
    connect: {
      icon: 'link',
      iconBg: Colors.blue[50],
      iconColor: Colors.blue[600],
      title: 'Connect your eBay account',
      body: "Link your eBay seller account so InstaList can publish listings on your behalf. We never store your eBay password — sign-in is handled by eBay's secure OAuth flow.",
      ctaLabel: isConnecting ? 'Opening eBay…' : 'Connect eBay',
      onPress: onConnect ?? (() => {}),
    },
    error: {
      icon: 'warning',
      iconBg: Colors.red[50],
      iconColor: Colors.red[600],
      title: "Couldn't load the marketplace",
      body: errorMessage || 'Something went wrong. Please try again in a moment.',
      ctaLabel: 'Try again',
      onPress: onRetry ?? (() => {}),
    },
  }

  const c = CONTENT[variant]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.iconCircle, { backgroundColor: c.iconBg }]}>
        <Ionicons name={c.icon} size={36} color={c.iconColor} />
      </View>
      <Text style={styles.title}>{c.title}</Text>
      <Text style={styles.body}>{c.body}</Text>

      <TouchableOpacity
        style={[styles.cta, isConnecting && styles.ctaDisabled]}
        onPress={c.onPress}
        disabled={isConnecting}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={c.ctaLabel}
      >
        {isConnecting && variant === 'connect' ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.ctaText}>{c.ctaLabel}</Text>
        )}
      </TouchableOpacity>

      {c.secondaryCtaLabel && c.onSecondaryPress && (
        <TouchableOpacity onPress={c.onSecondaryPress} style={styles.secondaryCta}>
          <Text style={styles.secondaryCtaText}>{c.secondaryCtaLabel}</Text>
        </TouchableOpacity>
      )}

      {/* Value-prop bullets — surface what InstaList does so the explainer
          isn't just a CTA wall. Skipped on the error variant. */}
      {variant !== 'error' && (
        <View style={styles.bullets}>
          <Bullet>Auto-generated graded-label images (front + back) and DCM mini grading report</Bullet>
          <Bullet>Suggested title and price seeded from the eBay market median</Bullet>
          <Bullet>Reorder images on the listing — the first one becomes your eBay main image</Bullet>
          <Bullet>Track active, sold, and ended listings all in one place</Bullet>
        </View>
      )}
    </ScrollView>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot}>
        <Ionicons name="checkmark" size={11} color={Colors.green[600]} />
      </View>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 24, paddingTop: 32, alignItems: 'center' },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: Colors.gray[900],
    textAlign: 'center', marginBottom: 10,
  },
  body: {
    fontSize: 14, color: Colors.gray[600],
    textAlign: 'center', lineHeight: 20,
    maxWidth: 360, marginBottom: 24,
  },
  cta: {
    backgroundColor: Colors.purple[600],
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 10, minWidth: 200,
    alignItems: 'center', marginBottom: 12,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  secondaryCta: { paddingVertical: 8 },
  secondaryCtaText: { color: Colors.gray[600], fontSize: 13, fontWeight: '600' },
  bullets: {
    marginTop: 24,
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.green[50],
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  bulletText: { flex: 1, fontSize: 13, color: Colors.gray[700], lineHeight: 18 },
})
