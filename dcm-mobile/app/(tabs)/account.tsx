import { View, Text, ScrollView, StyleSheet, Alert, Linking, TouchableOpacity, Image } from 'react-native'
import { purchaseCredits } from '@/lib/stripe'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'

const WEB_URL = 'https://dcmgrading.com'

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
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
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
  const { user, signOut } = useAuth()
  const { balance } = useCredits()

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const openWeb = (path: string) => Linking.openURL(`${WEB_URL}${path}`)

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

      {/* Grading */}
      <MenuSection title="Grading">
        <MenuItem icon="camera" label="Grade a Card" onPress={() => {}} />
        <MenuItem icon="grid" label="My Collection" onPress={() => {}} />
        <MenuItem icon="trending-up" label="Pop Report" onPress={() => openWeb('/pop')} />
        <MenuItem icon="star" label="Featured Cards" onPress={() => openWeb('/featured')} />
        <MenuItem icon="search" label="Search by Serial" onPress={() => openWeb('/search')} />
      </MenuSection>

      {/* Tools */}
      <MenuSection title="Tools">
        <MenuItem icon="pricetags" label="Label Studio" onPress={() => openWeb('/labels')} />
        <MenuItem icon="cash" label="Market Pricing" onPress={() => openWeb('/market-pricing')} color={Colors.green[600]} />
        <MenuItem icon="bag" label="Recommended Products" onPress={() => openWeb('/shop')} />
      </MenuSection>

      {/* Pricing & Plans */}
      <MenuSection title="Pricing & Plans">
        <MenuItem
          icon="diamond"
          label="Purchase Credits"
          onPress={() => purchaseCredits('pro')}
          badge={`${balance}`}
          color={Colors.purple[600]}
        />
        <MenuItem icon="heart" label="Card Lovers Subscription" onPress={() => openWeb('/card-lovers')} color={Colors.purple[600]} />
        <MenuItem icon="ribbon" label="VIP Package" onPress={() => openWeb('/vip')} color={Colors.amber[600]} />
      </MenuSection>

      {/* Information */}
      <MenuSection title="Information">
        <MenuItem icon="book" label="Grading Rubric" onPress={() => openWeb('/grading-rubric')} />
        <MenuItem icon="document-text" label="Reports & Labels" onPress={() => openWeb('/reports-and-labels')} />
        <MenuItem icon="help-circle" label="FAQ" onPress={() => openWeb('/faq')} />
        <MenuItem icon="information-circle" label="About Us" onPress={() => openWeb('/about')} />
        <MenuItem icon="shield-checkmark" label="Why DCM?" onPress={() => openWeb('/why-dcm')} />
        <MenuItem icon="newspaper" label="Blog" onPress={() => openWeb('/blog')} />
        <MenuItem icon="warning" label="Grading Limitations" onPress={() => openWeb('/grading-limitations')} />
        <MenuItem icon="calendar" label="Card Shows" onPress={() => openWeb('/card-shows')} />
      </MenuSection>

      {/* Account */}
      <MenuSection title="Account">
        <MenuItem icon="person" label="My Account" onPress={() => openWeb('/account')} />
        <MenuItem icon="lock-closed" label="Change Password" onPress={() => openWeb('/account')} />
        <MenuItem icon="document" label="Terms & Conditions" onPress={() => openWeb('/terms')} />
        <MenuItem icon="shield" label="Privacy Policy" onPress={() => openWeb('/privacy')} />
      </MenuSection>

      {/* Sign Out */}
      <View style={styles.signOutSection}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out" size={20} color={Colors.red[600]} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Image source={require('@/assets/images/dcm-logo.png')} style={styles.footerLogo} resizeMode="contain" />
        <Text style={styles.footerText}>DCM Grading v1.0.0</Text>
        <Text style={styles.footerCopy}>Dynamic Collectibles Management LLC</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { paddingBottom: 40 },

  // Profile
  profileCard: {
    backgroundColor: Colors.purple[600],
    margin: 12,
    borderRadius: 16,
    padding: 20,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileEmail: { fontSize: 15, fontWeight: '600', color: Colors.white },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  creditText: { fontSize: 13, color: Colors.purple[200] },

  // Menu sections
  menuSection: { marginTop: 16, marginHorizontal: 12 },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingLeft: 4,
  },
  menuSectionContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: 'hidden',
  },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuItemLabel: { fontSize: 15, fontWeight: '500' },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBadge: {
    backgroundColor: Colors.purple[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  menuBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.purple[700] },

  // Sign out
  signOutSection: { marginTop: 20, marginHorizontal: 12 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.red[50],
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.red[100],
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.red[600] },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerLogo: { width: 40, height: 40, marginBottom: 8, opacity: 0.4 },
  footerText: { fontSize: 12, color: Colors.gray[400] },
  footerCopy: { fontSize: 11, color: Colors.gray[300], marginTop: 2 },
})
