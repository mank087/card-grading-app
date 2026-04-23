import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { Colors, CardCategories } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'
import Button from '@/components/ui/Button'

export default function GradeScreen() {
  const router = useRouter()
  const { balance } = useCredits()

  const openPurchaseCredits = () => {
    Linking.openURL('https://dcmgrading.com/credits')
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
                // TODO: Navigate to camera capture with category
                console.log('Grade', cat.key)
              }}
              disabled={balance < 1}
            />
          </View>
        ))}
      </View>

      {balance < 1 && (
        <View style={styles.noCredits}>
          <Text style={styles.noCreditsText}>You need credits to grade cards.</Text>
          <Button
            title="Purchase Credits"
            variant="primary"
            onPress={openPurchaseCredits}
          />
        </View>
      )}
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
    gap: 12,
  },
  noCreditsText: { color: Colors.amber[600], fontSize: 14, fontWeight: '500' },
})
