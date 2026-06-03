import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import type { MarketplaceStats } from '@/lib/marketplaceApi'

interface Props {
  stats: MarketplaceStats | null
  loading: boolean
}

/**
 * Four-card metrics strip. Mirrors the web StatsStrip with mobile-tuned
 * sizing — two columns, two rows on phones; one row on tablets.
 */
export default function StatsStrip({ stats, loading }: Props) {
  const fmtCurrency = (n: number) => `$${(n || 0).toFixed(2)}`
  const fmtCount = (n: number) => String(n ?? 0)

  return (
    <View style={styles.grid}>
      <Card
        icon="pricetag"
        iconColor={Colors.purple[600]}
        label="Active"
        value={fmtCount(stats?.activeCount ?? 0)}
        loading={loading && !stats}
      />
      <Card
        icon="cart"
        iconColor={Colors.green[600]}
        label="Sold"
        value={fmtCount(stats?.soldCount ?? 0)}
        loading={loading && !stats}
      />
      <Card
        icon="cash"
        iconColor={Colors.green[600]}
        label="Lifetime gross"
        value={fmtCurrency(stats?.grossRevenue ?? 0)}
        loading={loading && !stats}
      />
      <Card
        icon="time"
        iconColor={Colors.gray[500]}
        label="Ended"
        value={fmtCount(stats?.endedCount ?? 0)}
        loading={loading && !stats}
      />
    </View>
  )
}

function Card({
  icon,
  iconColor,
  label,
  value,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label: string
  value: string
  loading: boolean
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Text style={styles.cardValue}>{loading ? '—' : value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.4 },
  cardValue: { fontSize: 20, fontWeight: '800', color: Colors.gray[900] },
})
