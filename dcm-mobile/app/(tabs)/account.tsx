import { View, Text, ScrollView, StyleSheet, Alert, Linking, TouchableOpacity, Image, Platform } from 'react-native'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useUserEmblems } from '@/hooks/useUserEmblems'
import { useCredits } from '@/contexts/CreditsContext'
import { useWelcomeTour } from '@/contexts/WelcomeTourContext'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

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

/**
 * Native mirror of the web "Referral partner" card
 * (src/components/account/ReferralPartnerCard.tsx).
 *
 * Renders only for approved partners: GET /api/affiliate/me returns
 * `{ affiliate: null }` for everyone else, and any error keeps the card
 * hidden rather than showing an empty shell.
 */
type PartnerAffiliate = {
  code: string
  status: string
  discountPercent: number
  rewardCredits: number
  link: string
}

type PartnerStats = {
  clicks30d: number
  referrals: number
  creditsEarned: number
  pendingCredits: number
  lastReferralAt: string | null
}

function ReferralPartnerCard() {
  const [affiliate, setAffiliate] = useState<PartnerAffiliate | null>(null)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`${API_BASE}/api/affiliate/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (cancelled || !json?.affiliate) return
        setAffiliate(json.affiliate as PartnerAffiliate)
        setStats((json.stats as PartnerStats) ?? null)
      } catch {
        // Not a partner, or the program is unavailable: stay hidden.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const copy = async (value: string, which: 'code' | 'link') => {
    try {
      await Clipboard.setStringAsync(value)
      setCopied(which)
      setTimeout(() => setCopied(current => (current === which ? null : current)), 2000)
    } catch {
      // Clipboard unavailable: no-op, the value is still selectable on screen.
    }
  }

  if (!affiliate) return null

  const tiles: { label: string; value: number; color: string }[] = [
    { label: 'Clicks last 30 days', value: stats?.clicks30d ?? 0, color: Colors.blue[600] },
    { label: 'New customers', value: stats?.referrals ?? 0, color: Colors.green[600] },
    { label: 'Credits earned', value: stats?.creditsEarned ?? 0, color: Colors.purple[600] },
    { label: 'Pending', value: stats?.pendingCredits ?? 0, color: Colors.gray[600] },
  ]

  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>Referral partner</Text>
      <View style={[styles.menuSectionContent, styles.partnerCard]}>
        {affiliate.status === 'paused' && (
          <Text style={styles.partnerPaused}>Your partner code is paused</Text>
        )}

        <Text style={styles.partnerIntro}>
          Share your code or link. New customers get {affiliate.discountPercent}% off their first
          purchase and you get {affiliate.rewardCredits} credits when they buy.
        </Text>

        <Text style={styles.partnerLabel}>Your code</Text>
        <View style={styles.partnerRow}>
          <View style={styles.partnerCodeChip}>
            <Text style={styles.partnerCodeText}>{affiliate.code}</Text>
          </View>
          <TouchableOpacity
            style={styles.partnerCopyPrimary}
            onPress={() => copy(affiliate.code, 'code')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Copy your referral code"
          >
            <Text style={styles.partnerCopyPrimaryText}>
              {copied === 'code' ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.partnerLabel}>Your link</Text>
        <View style={styles.partnerRow}>
          <Text style={styles.partnerLink} numberOfLines={1}>{affiliate.link}</Text>
          <TouchableOpacity
            style={styles.partnerCopySecondary}
            onPress={() => copy(affiliate.link, 'link')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Copy your referral link"
          >
            <Text style={styles.partnerCopySecondaryText}>
              {copied === 'link' ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.partnerTiles}>
          {tiles.map(tile => (
            <View key={tile.label} style={styles.partnerTile}>
              <Text style={styles.partnerTileLabel}>{tile.label}</Text>
              <Text style={[styles.partnerTileValue, { color: tile.color }]}>{tile.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default function AccountScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { balance } = useCredits()
  const { start: startWelcomeTour } = useWelcomeTour()
  const { isCardLover, loading: emblemsLoading } = useUserEmblems()
  // Apple App Store Reader-app compliance: iOS users cannot see a path
  // that promotes / leads to a non-IAP subscription purchase. Members
  // who already subscribed via web still get to see their member status;
  // non-members on iOS get no entry point.
  //
  // Membership is only known once the emblems provider resolves — until
  // then `isCardLover` is false because nothing loaded, not because the
  // user is a non-member. Show neither the entry nor the note while
  // unresolved, so a member never sees "not available" flash first.
  const membershipResolved = !emblemsLoading
  const isIos = Platform.OS === 'ios'
  const showCardLoversMenuItem = !isIos || (membershipResolved && isCardLover)
  const showIosMembershipNote = isIos && membershipResolved && !isCardLover

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
                        err?.message || 'Something went wrong. Please contact admin@dcmgrading.com to delete your account manually.',
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
      {/* Profile Card — tap for account settings */}
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => nav('my-account')}
        activeOpacity={0.85}
        accessibilityLabel="My account settings"
        accessibilityRole="button"
      >
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
              <Text style={styles.creditText}>{balance} credit{balance === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.purple[200]} />
        </View>
      </TouchableOpacity>

      {/* Tools — things the tabs do not already cover. Label Studio is a
          tab, so it switches tabs rather than pushing a second copy of the
          screen with different chrome. */}
      <MenuSection title="Tools">
        <MenuItem icon="pricetags" label="Label Studio" onPress={() => router.push('/(tabs)/labels')} />
        <MenuItem icon="trending-up" label="Pop Report" onPress={() => nav('pop-report')} />
        <MenuItem icon="star" label="Featured Cards" onPress={() => nav('featured')} />
        <MenuItem icon="search" label="Find a Graded Card" onPress={() => nav('search')} />
        <MenuItem icon="bag" label="Recommended Products" onPress={() => router.push('/(tabs)/shop')} />
      </MenuSection>

      {/* Plans */}
      <MenuSection title="Credits & Plans">
        <MenuItem
          icon="diamond"
          label="Buy Credits"
          onPress={() => nav('credits')}
          badge={`${balance}`}
          color={Colors.purple[600]}
        />
        {showCardLoversMenuItem && (
          <MenuItem
            icon="heart"
            label={Platform.OS === 'ios' && isCardLover ? 'Card Lovers Member' : 'Card Lovers Membership'}
            onPress={() => nav('card-lovers')}
            color={Colors.purple[600]}
          />
        )}
        {/* iOS: no Card Lovers plan card, no pricing, no steering. One
            neutral availability line so the absence isn't mysterious. */}
        {showIosMembershipNote && (
          <Text style={styles.platformNote}>
            Card Lovers membership is not available in this app.
          </Text>
        )}
        {Platform.OS !== 'ios' && (
          <MenuItem icon="ribbon" label="VIP Package" onPress={() => nav('vip')} color={Colors.amber[600]} />
        )}
      </MenuSection>

      {/* Referral partner — renders only for approved affiliate partners. */}
      <ReferralPartnerCard />

      {/* Help */}
      <MenuSection title="Help & Info">
        <MenuItem icon="play" label="Welcome Tour" onPress={startWelcomeTour} />
        <MenuItem icon="book" label="Grading Standards" onPress={() => nav('grading-rubric')} />
        <MenuItem icon="document-text" label="Reports & Labels" onPress={() => nav('reports-labels')} />
        <MenuItem icon="help-circle" label="FAQ" onPress={() => nav('faq')} />
        <MenuItem icon="warning" label="Grading Limitations" onPress={() => nav('grading-limitations')} />
        <MenuItem icon="calendar" label="Card Shows" onPress={() => nav('card-shows')} />
        <MenuItem icon="newspaper" label="Blog" onPress={() => nav('blog')} />
        <MenuItem icon="shield-checkmark" label="Why DCM?" onPress={() => nav('why-dcm')} />
        <MenuItem icon="information-circle" label="About Us" onPress={() => nav('about')} />
        <MenuItem icon="people" label="Affiliates" onPress={() => nav('affiliates')} />
        <MenuItem icon="mail" label="Contact Us" onPress={() => nav('contact')} />
      </MenuSection>

      {/* Account */}
      <MenuSection title="Account">
        <MenuItem icon="person" label="My Account & Password" onPress={() => nav('my-account')} />
        <MenuItem icon="document" label="Terms & Conditions" onPress={() => nav('terms')} />
        <MenuItem icon="shield" label="Privacy Policy" onPress={() => nav('privacy')} />
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
        {/* In-app account deletion — required by both App Store
            (guideline 5.1.1(v)) and Play Store (effective May 2024) for
            apps that offer account creation. Kept in-app, but as a quiet
            link under Sign Out rather than a row beside Contact Us. */}
        <TouchableOpacity
          style={styles.deleteLink}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          accessibilityLabel="Delete my account"
          accessibilityRole="button"
        >
          <Text style={styles.deleteLinkText}>Delete my account</Text>
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
  platformNote: { fontSize: 12, color: Colors.gray[500], paddingHorizontal: 16, paddingVertical: 12 },
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
  partnerCard: { padding: 16, gap: 4 },
  partnerPaused: { fontSize: 12, color: Colors.gray[500], marginBottom: 6 },
  partnerIntro: { fontSize: 13, color: Colors.gray[600], lineHeight: 19, marginBottom: 12 },
  partnerLabel: { fontSize: 12, fontWeight: '700', color: Colors.gray[700], marginBottom: 6 },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  partnerCodeChip: {
    backgroundColor: Colors.purple[50],
    borderWidth: 2,
    borderColor: Colors.purple[300],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  partnerCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.purple[900],
  },
  partnerLink: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray[800],
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  partnerCopyPrimary: { backgroundColor: Colors.purple[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  partnerCopyPrimaryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  partnerCopySecondary: { backgroundColor: Colors.gray[100], borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  partnerCopySecondaryText: { color: Colors.gray[700], fontSize: 13, fontWeight: '600' },
  partnerTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  partnerTile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: 10,
    padding: 12,
  },
  partnerTileLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray[600], marginBottom: 2 },
  partnerTileValue: { fontSize: 24, fontWeight: '800' },
  signOutSection: { marginTop: 20, marginHorizontal: 12 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.red[50], borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.red[100] },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.red[600] },
  deleteLink: { alignItems: 'center', paddingVertical: 14 },
  deleteLinkText: { fontSize: 13, color: Colors.gray[500], textDecorationLine: 'underline' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerLogo: { width: 40, height: 40, marginBottom: 8, opacity: 0.4 },
  footerText: { fontSize: 12, color: Colors.gray[400] },
  footerCopy: { fontSize: 11, color: Colors.gray[300], marginTop: 2 },
})
