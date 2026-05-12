import { View, Text, ScrollView, StyleSheet, Alert, Linking, TouchableOpacity, Image, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUserEmblems } from '@/hooks/useUserEmblems'
import { useCredits } from '@/contexts/CreditsContext'
import { useWelcomeTour } from '@/contexts/WelcomeTourContext'
import { purchaseCredits } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.dcmgrading.com'

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  color?: string
  badge?: string
  showArrow?: boolean
}

function MenuItem({ icon, label, onPress, color = Colors.gray[700], badge, showArrow = true }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityRole="button"
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.menuItemLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        )}
        {showArrow && <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} />}
      </View>
    </TouchableOpacity>
  )
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{title}</Text>
      <View style={styles.menuSectionContent}>{children}</View>
    </View>
  )
}

export default function AccountScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { balance } = useCredits()
  const { start: startWelcomeTour } = useWelcomeTour()
  const { isCardLover } = useUserEmblems()
  // Apple App Store Reader-app compliance: iOS users cannot see a path
  // that promotes / leads to a non-IAP subscription purchase. Members
  // who already subscribed via web still get to see their member status;
  // non-members on iOS get no entry point.
  const showCardLoversMenuItem = Platform.OS !== 'ios' || isCardLover

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  /**
   * In-app account deletion — Apple + Google both require apps with
   * account creation to also offer in-app deletion. Two-step
   * confirmation: scary alert + an actual confirmation. Once confirmed
   * the endpoint hard-deletes cards (rows + storage objects), user
   * credits, transactions, affiliate data, and the auth user.
   *
   * Note: doesn't ask for a password — supports OAuth users (Apple/
   * Google Sign In) who don't have one. The endpoint accepts password
   * optionally and falls back to JWT-only auth, with the typed-
   * confirmation alert as the second factor.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      "This permanently deletes your account and all of your graded cards, card images, credits, and history. This cannot be undone.\n\nYou will lose access to:\n• All graded cards in your collection\n• Any remaining grading credits\n• Subscription benefits (Card Lovers / VIP)\n• Affiliate earnings and links\n\nAre you sure?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — required by best-practice for any
            // destructive irreversible action.
            Alert.alert(
              'Final confirmation',
              'Tap "Yes, delete forever" to permanently remove your account. We cannot recover it after this.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (!session?.access_token) {
                        Alert.alert('Not signed in', 'Please sign in again and retry.')
                        return
                      }
                      const res = await fetch(`${API_BASE}/api/account/delete`, {
                        method: 'DELETE',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({}),
                      })
                      const json = await res.json().catch(() => ({} as any))
                      if (!res.ok || !json.success) {
                        throw new Error(json.error || `Delete failed (HTTP ${res.status})`)
                      }
                      // Auth user is gone server-side — sign out locally
                      // clears the cached session and routes back to the
                      // welcome carousel via AuthGate.
                      await signOut()
                      Alert.alert(
                        'Account deleted',
                        'Your account and data have been permanently removed. Thanks for trying DCM.',
                      )
                    } catch (err: any) {
                      Alert.alert(
                        'Delete failed',
                        err?.message || 'Something went wrong. Please contact support@dcmgrading.com to delete your account manually.',
                      )
                    }
                  },
                },
              ],
            )
          },
        },
      ],
    )
  }

  const nav = (page: string) => router.push(`/pages/${page}` as any)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.email?.[0] || 'D').toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
            <View style={styles.creditRow}>
              <Ionicons name="diamond" size={14} color={Colors.purple[600]} />
              <Text style={styles.creditText}>{balance} credits</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Welcome tour — visible at the top so users can revisit anytime
          they want a refresher on what each tab does. */}
      <MenuSection title="Getting Started">
        <MenuItem
          icon="play"
          label="Replay Welcome Tour"
          onPress={startWelcomeTour}
          color={Colors.purple[600]}
        />
      </MenuSection>

      {/* Grading */}
      <MenuSection title="Grading">
        <MenuItem icon="camera" label="Grade a Card" onPress={() => router.push('/(tabs)/grade')} />
        <MenuItem icon="grid" label="My Collection" onPress={() => router.push('/(tabs)/collection')} />
        <MenuItem icon="trending-up" label="Pop Report" onPress={() => nav('pop-report')} />
        <MenuItem icon="star" label="Featured Cards" onPress={() => nav('featured')} />
        <MenuItem icon="search" label="Search by Serial" onPress={() => nav('search')} />
      </MenuSection>

      {/* Tools */}
      <MenuSection title="Tools">
        <MenuItem icon="pricetags" label="Label Studio" onPress={() => nav('label-studio')} />
        <MenuItem icon="cash" label="Market Pricing" onPress={() => nav('market-pricing')} color={Colors.green[600]} />
        <MenuItem icon="bag" label="Shop" onPress={() => router.push('/(tabs)/shop')} />
      </MenuSection>

      {/* Pricing & Plans */}
      <MenuSection title="Pricing & Plans">
        <MenuItem
          icon="diamond"
          label="Purchase Credits"
          onPress={() => nav('credits')}
          badge={`${balance}`}
          color={Colors.purple[600]}
        />
        {showCardLoversMenuItem && (
          <MenuItem
            icon="heart"
            label={Platform.OS === 'ios' && isCardLover ? 'Card Lovers Member' : 'Card Lovers Subscription'}
            onPress={() => nav('card-lovers')}
            color={Colors.purple[600]}
          />
        )}
        {Platform.OS !== 'ios' && (
          <MenuItem icon="ribbon" label="VIP Package" onPress={() => nav('vip')} color={Colors.amber[600]} />
        )}
      </MenuSection>

      {/* Information */}
      <MenuSection title="Information">
        <MenuItem icon="book" label="Grading Rubric" onPress={() => nav('grading-rubric')} />
        <MenuItem icon="document-text" label="Reports & Labels" onPress={() => nav('reports-labels')} />
        <MenuItem icon="help-circle" label="FAQ" onPress={() => nav('faq')} />
        <MenuItem icon="information-circle" label="About Us" onPress={() => nav('about')} />
        <MenuItem icon="shield-checkmark" label="Why DCM?" onPress={() => nav('why-dcm')} />
        <MenuItem icon="newspaper" label="Blog" onPress={() => nav('blog')} />
        <MenuItem icon="warning" label="Grading Limitations" onPress={() => nav('grading-limitations')} />
        <MenuItem icon="calendar" label="Card Shows" onPress={() => nav('card-shows')} />
      </MenuSection>

      {/* Account */}
      <MenuSection title="Account">
        <MenuItem icon="person" label="My Account" onPress={() => nav('my-account')} />
        <MenuItem icon="lock-closed" label="Change Password" onPress={() => nav('my-account')} />
        <MenuItem icon="mail" label="Contact Us" onPress={() => nav('contact')} color={Colors.blue[600]} />
        <MenuItem icon="document" label="Terms & Conditions" onPress={() => nav('terms')} />
        <MenuItem icon="shield" label="Privacy Policy" onPress={() => nav('privacy')} />
        {/* In-app account deletion — required by both App Store
            (guideline 5.1.1(v)) and Play Store (effective May 2024) for
            apps that offer account creation. */}
        <MenuItem
          icon="trash"
          label="Delete My Account"
          onPress={handleDeleteAccount}
          color={Colors.red[600]}
        />
      </MenuSection>

      {/* Sign Out */}
      <View style={styles.signOutSection}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
          accessibilityLabel="Sign out of DCM Grading"
          accessibilityRole="button"
        >
          <Ionicons name="log-out" size={20} color={Colors.red[600]} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={styles.footerLogo} resizeMode="contain" />
        <Text style={styles.footerText}>DCM Grading v{APP_VERSION}</Text>
        <Text style={styles.footerCopy}>Dynamic Collectibles Management LLC</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.purple[600], margin: 12, borderRadius: 16, padding: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileEmail: { fontSize: 15, fontWeight: '600', color: Colors.white },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  creditText: { fontSize: 13, color: Colors.purple[200] },
  menuSection: { marginTop: 16, marginHorizontal: 12 },
  menuSectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 4 },
  menuSectionContent: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.gray[200], overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuItemLabel: { fontSize: 15, fontWeight: '500' },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBadge: { backgroundColor: Colors.purple[100], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  menuBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },
  signOutSection: { marginTop: 20, marginHorizontal: 12 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.red[50], borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.red[100] },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.red[600] },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerLogo: { width: 40, height: 40, marginBottom: 8, opacity: 0.4 },
  footerText: { fontSize: 12, color: Colors.gray[400] },
  footerCopy: { fontSize: 11, color: Colors.gray[300], marginTop: 2 },
})
