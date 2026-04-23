import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { Colors } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import Button from '@/components/ui/Button'

export default function AccountScreen() {
  const { user, signOut } = useAuth()
  const { balance } = useCredits()

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.email?.[0] || 'D').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Credits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credits</Text>
        <View style={styles.creditRow}>
          <Text style={styles.creditLabel}>Available Balance</Text>
          <Text style={styles.creditValue}>{balance}</Text>
        </View>
        <Button
          title="Purchase Credits"
          variant="primary"
          onPress={() => {
            // TODO: Navigate to credit purchase or open web
          }}
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        <View style={styles.linkList}>
          {[
            { label: 'Label Studio', icon: 'tag' },
            { label: 'Pop Report', icon: 'stats-chart' },
            { label: 'FAQ', icon: 'help-circle' },
            { label: 'Grading Rubric', icon: 'book' },
          ].map((link) => (
            <View key={link.label} style={styles.linkItem}>
              <Text style={styles.linkText}>{link.label}</Text>
              <Text style={styles.linkArrow}>{'>'}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <Button title="Sign Out" variant="danger" onPress={handleSignOut} />
      </View>

      {/* Version */}
      <Text style={styles.version}>DCM Grading v1.0.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.purple[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: Colors.white, fontSize: 24, fontWeight: '800' },
  email: { fontSize: 15, color: Colors.gray[600] },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.gray[900], marginBottom: 12 },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditLabel: { fontSize: 14, color: Colors.gray[600] },
  creditValue: { fontSize: 28, fontWeight: '800', color: Colors.purple[600] },
  linkList: { gap: 1 },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  linkText: { fontSize: 15, color: Colors.gray[800] },
  linkArrow: { color: Colors.gray[400], fontSize: 16 },
  version: { textAlign: 'center', color: Colors.gray[400], fontSize: 12, marginTop: 24 },
})
