import { View, Text, StyleSheet } from 'react-native'
import { Colors, GradeColors } from '@/lib/constants'

interface SubgradeBarProps {
  label: string
  score: number | null
  isLimiting?: boolean
}

export default function SubgradeBar({ label, score, isLimiting = false }: SubgradeBarProps) {
  const displayScore = score ?? 0
  const barWidth = `${(displayScore / 10) * 100}%`
  const color = displayScore >= 9 ? Colors.green[500]
    : displayScore >= 7 ? Colors.blue[500]
    : displayScore >= 5 ? Colors.amber[500]
    : Colors.red[500]

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, isLimiting && styles.limitingLabel]}>{label}</Text>
        {isLimiting && <Text style={styles.limitingBadge}>Limiting</Text>}
      </View>
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: barWidth as any, backgroundColor: color }]} />
        </View>
        <Text style={[styles.score, { color }]}>{score ?? 'N/A'}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray[600],
  },
  limitingLabel: {
    color: Colors.amber[600],
  },
  limitingBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.amber[600],
    backgroundColor: Colors.amber[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.gray[200],
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  score: {
    fontSize: 16,
    fontWeight: '800',
    width: 32,
    textAlign: 'right',
  },
})
