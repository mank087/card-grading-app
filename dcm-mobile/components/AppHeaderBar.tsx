/**
 * AppHeaderBar — shared top header used on tab screens AND detail/WebView
 * screens so the chrome feels consistent throughout the app.
 *
 * Tab screens render with showGrade=true (purple Grade CTA on the right).
 * Detail/WebView screens render with showBack=true (back button on the left)
 * and no Grade CTA. Credits badge is always shown.
 *
 * Replaces the inline AppHeader previously defined in (tabs)/_layout.tsx
 * and the custom top bars in InAppPage / native /pages screens — one
 * source of truth for the DCM logo, credit balance display, and Grade CTA.
 */

import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'

interface AppHeaderBarProps {
  /** When true, renders a back button on the left and optionally a title.
   *  Use on detail/WebView screens. */
  showBack?: boolean
  /** Custom back handler — defaults to router.back(). Useful for screens
   *  with internal history (WebView pages walking through SPA routes). */
  onBack?: () => void
  /** Optional title shown next to the logo — gives the user context on
   *  detail/WebView pages. */
  title?: string
  /** When true, renders the primary purple "Grade" CTA on the right.
   *  Use on tab screens (where the user is browsing) — not on detail
   *  screens where the user already drilled down. */
  showGrade?: boolean
}

export default function AppHeaderBar({ showBack, onBack, title, showGrade }: AppHeaderBarProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { balance } = useCredits()

  // Credit badge color: green if 3+, amber if 1-2, red if 0
  const creditColor = balance >= 3 ? Colors.green[600] : balance >= 1 ? Colors.amber[600] : Colors.red[600]
  const creditBg = balance >= 3 ? Colors.green[50] : balance >= 1 ? Colors.amber[50] : Colors.red[50]

  const handleBack = () => {
    if (onBack) onBack()
    else router.back()
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.purple[600]} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.logoContainer}
          onPress={() => router.push('/(tabs)/grade')}
          activeOpacity={0.8}
          accessibilityLabel="DCM Grading home"
          accessibilityRole="button"
        >
          <Image source={require('@/assets/images/dcm-logo.png')} style={styles.logo} resizeMode="contain" />
        </TouchableOpacity>
        {title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
      </View>

      <View style={styles.right}>
        {showGrade && (
          <TouchableOpacity
            style={styles.gradeBtn}
            onPress={() => router.push('/(tabs)/grade')}
            activeOpacity={0.85}
            accessibilityLabel="Grade a card"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.gradeBtnText}>Grade</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.creditBadge, { backgroundColor: creditBg }]}
          onPress={() => router.push('/pages/credits' as any)}
          activeOpacity={0.7}
          accessibilityLabel={`${balance} grading credits remaining. Tap to purchase more.`}
          accessibilityRole="button"
        >
          <Ionicons name="diamond" size={13} color={creditColor} />
          <Text style={[styles.creditBadgeText, { color: creditColor }]}>{balance}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    minWidth: 32,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gray[900],
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.purple[600],
  },
  gradeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  creditBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
})
