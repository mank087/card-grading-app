import { View, Text, StyleSheet } from 'react-native'
import { GradeColors, ConditionLabels, Colors } from '@/lib/constants'

interface GradeBadgeProps {
  grade: number | null
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function GradeBadge({ grade, size = 'md', showLabel = false }: GradeBadgeProps) {
  if (grade === null || grade === undefined || grade === 0) {
    return (
      <View style={[styles.badge, styles[size], { backgroundColor: Colors.gray[200] }]}>
        <Text style={[styles.gradeText, styles[`${size}Text`], { color: Colors.gray[500] }]}>N/A</Text>
      </View>
    )
  }

  const color = GradeColors[grade] || Colors.gray[500]
  const label = ConditionLabels[grade] || ''

  return (
    <View style={styles.container}>
      <View style={[styles.badge, styles[size], { backgroundColor: color }]}>
        <Text style={[styles.gradeText, styles[`${size}Text`]]}>{grade}</Text>
      </View>
      {showLabel && label && (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  badge: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { width: 32, height: 32, borderRadius: 6 },
  md: { width: 48, height: 48, borderRadius: 8 },
  lg: { width: 64, height: 64, borderRadius: 12 },
  gradeText: {
    color: '#fff',
    fontWeight: '800',
  },
  smText: { fontSize: 14 },
  mdText: { fontSize: 22 },
  lgText: { fontSize: 32 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
