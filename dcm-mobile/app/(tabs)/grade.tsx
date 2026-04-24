import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, CardCategories } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'
import { purchaseCredits, CREDIT_TIERS } from '@/lib/stripe'
import Button from '@/components/ui/Button'

export default function GradeScreen() {
  const router = useRouter()
  const { balance, refresh } = useCredits()

  const handlePurchase = async (tierId: string) => {
    const { error } = await purchaseCredits(tierId)
    if (error) {
      Alert.alert('Error', error)
    } else {
      // Refresh credits after returning from checkout
      setTimeout(() => refresh(), 2000)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Credit Balance */}
      <View style={styles.creditBar}>
        <Text style={styles.creditLabel}>Credits Available</Text>
        <Text style={styles.creditBalance}>{balance}</Text>
      </View>

      {/* Category Selection */}
      <Text style={styles.sectionTitle}>Select Card Category</Text>
      <Text style={styles.sectionSubtitle}>Choose the type of card you want to grade</Text>

      <View style={styles.categoryGrid}>
        {CardCategories.map((cat) => (
          <View key={cat.key} style={styles.categoryCard}>
            <Text style={styles.categoryLabel}>{cat.label}</Text>
            <Button
              title="Grade"
              variant="primary"
              size="sm"
              onPress={() => {
                router.push({ pathname: '/grade/capture', params: { category: cat.key } })
              }}
              disabled={balance < 1}
            />
          </View>
        ))}
      </View>

      {/* Credit Packages */}
      {balance < 1 && (
        <View style={styles.noCredits}>
          <Text style={styles.noCreditsTitle}>You need credits to grade cards</Text>
          <Text style={styles.noCreditsText}>Purchase a credit package to get started</Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Credit Packages</Text>
      <View style={styles.tierGrid}>
        {CREDIT_TIERS.map((tier) => (
          <TouchableOpacity
            key={tier.id}
            style={[styles.tierCard, tier.popular && styles.tierCardPopular]}
            onPress={() => handlePurchase(tier.id)}
            activeOpacity={0.7}
          >
            {tier.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            <Text style={styles.tierCredits}>{tier.credits}</Text>
            <Text style={styles.tierCreditsLabel}>credit{tier.credits > 1 ? 's' : ''}</Text>
            <Text style={styles.tierPrice}>${tier.price.toFixed(2)}</Text>
            <Text style={styles.tierPerCredit}>{tier.perCredit}/grade</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 16 },
  creditBar: {
    backgroundColor: Colors.purple[600],
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  creditLabel: { color: Colors.purple[100], fontSize: 14 },
  creditBalance: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900], marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: Colors.gray[500], marginBottom: 16 },
  categoryGrid: { gap: 10 },
  categoryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  categoryLabel: { fontSize: 16, fontWeight: '600', color: Colors.gray[800] },
  noCredits: {
    marginTop: 24,
    backgroundColor: Colors.amber[50],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.amber[100],
  },
  noCreditsTitle: { color: Colors.amber[600], fontSize: 16, fontWeight: '700', marginBottom: 4 },
  noCreditsText: { color: Colors.amber[500], fontSize: 13 },

  // Credit tiers
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tierCard: {
    width: '48%' as any,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.gray[200],
  },
  tierCardPopular: {
    borderColor: Colors.purple[500],
    backgroundColor: Colors.purple[50],
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: Colors.purple[600],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  tierCredits: { fontSize: 28, fontWeight: '800', color: Colors.purple[600], marginTop: 4 },
  tierCreditsLabel: { fontSize: 12, color: Colors.gray[500], marginBottom: 8 },
  tierPrice: { fontSize: 18, fontWeight: '700', color: Colors.gray[900] },
  tierPerCredit: { fontSize: 11, color: Colors.gray[500], marginTop: 2 },
})
