import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@/lib/constants'
import { LinearGradient } from 'expo-linear-gradient'

/**
 * SlabCard — Renders a card inside a graded slab frame
 * with the DCM label above the card image.
 * Matches the web's CardSlab/CardSlabGrid component.
 *
 * Layout:
 * ┌─────────────────────┐  ← Slab wrapper (gradient border)
 * │ [Logo] Name   Grade │  ← Label
 * │ Set • #Num • Year   │
 * │ Serial        MINT  │
 * ├─────────────────────┤  ← Separator
 * │                     │
 * │    [Card Image]     │  ← Card image
 * │                     │
 * └─────────────────────┘
 */

interface SlabCardProps {
  imageUrl: string | null
  displayName: string
  contextLine: string
  serial: string
  grade: number | null
  condition: string
  features?: string[]
  size?: 'sm' | 'md' | 'lg'
  isBack?: boolean
  subScores?: { centering: number; corners: number; edges: number; surface: number } | null
}

export default function SlabCard({
  imageUrl,
  displayName,
  contextLine,
  serial,
  grade,
  condition,
  features = [],
  size = 'md',
  isBack = false,
  subScores,
}: SlabCardProps) {
  const gradeText = grade !== null ? Math.round(grade).toString() : 'N/A'
  const conditionText = condition?.toUpperCase() || ''
  const labelHeight = size === 'sm' ? 60 : size === 'md' ? 72 : 85
  const fontSize = size === 'sm' ? 0.85 : size === 'md' ? 1 : 1.15

  return (
    <View style={styles.slabWrapper}>
      <LinearGradient
        colors={['#1a1625', '#2d1f47', '#1a1625']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slabGradient}
      >
        {/* Label */}
        <LinearGradient
          colors={['#1a1625', '#2d1f47', '#1a1625']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.label, { height: labelHeight }]}
        >
          {isBack ? (
            /* Back label — QR left + grade center + sub-scores right */
            <View style={styles.backLabelContent}>
              {/* QR code placeholder */}
              <View style={styles.backQrBox}>
                <View style={styles.qrPattern}>
                  {[0,1,2,3,4,5,6].map(r => (
                    <View key={r} style={{ flexDirection: 'row' }}>
                      {[0,1,2,3,4,5,6].map(c => (
                        <View key={c} style={{
                          width: size === 'sm' ? 3 : size === 'md' ? 4 : 5,
                          height: size === 'sm' ? 3 : size === 'md' ? 4 : 5,
                          backgroundColor: ((r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3) || (r === 3 && c === 3)) ? '#000' : '#fff',
                        }} />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
              {/* Grade + condition */}
              <View style={styles.backGradeSection}>
                <Text style={[styles.backGradeText, { fontSize: 28 * fontSize }]}>{gradeText}</Text>
                <Text style={[styles.backConditionText, { fontSize: 8 * fontSize }]}>{conditionText}</Text>
              </View>
              {/* Sub-scores */}
              {subScores && (
                <View style={styles.backSubScores}>
                  {[
                    ['C', subScores.centering],
                    ['Co', subScores.corners],
                    ['E', subScores.edges],
                    ['S', subScores.surface],
                  ].map(([label, val]) => {
                    const v = typeof val === 'number' ? Math.round(val) : (val && typeof val === 'object' && (val as any).weighted != null ? Math.round((val as any).weighted) : null)
                    return v != null ? <Text key={label as string} style={styles.subScoreText}>{label}: {v}</Text> : null
                  })}
                </View>
              )}
            </View>
          ) : (
            /* Front label — logo + info + grade */
            <View style={styles.frontLabelContent}>
              {/* Left: Logo */}
              <Image
                source={require('@/assets/images/dcm-logo.png')}
                style={[styles.labelLogo, { width: 24 * fontSize, height: 24 * fontSize }]}
                resizeMode="contain"
                tintColor="rgba(255,255,255,0.9)"
              />

              {/* Center: Card info */}
              <View style={styles.labelInfo}>
                <Text style={[styles.labelName, { fontSize: 10 * fontSize }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.labelContext, { fontSize: 7 * fontSize }]} numberOfLines={1}>
                  {contextLine}
                </Text>
                {features.length > 0 && (
                  <Text style={[styles.labelFeatures, { fontSize: 6.5 * fontSize }]} numberOfLines={1}>
                    {features.join(' \u2022 ')}
                  </Text>
                )}
                <Text style={[styles.labelSerial, { fontSize: 7 * fontSize }]}>{serial}</Text>
              </View>

              {/* Right: Grade */}
              <View style={styles.labelGradeSection}>
                <Text style={[styles.labelGrade, { fontSize: 22 * fontSize }]}>{gradeText}</Text>
                <Text style={[styles.labelCondition, { fontSize: 6 * fontSize }]}>{conditionText}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Separator line */}
        <LinearGradient
          colors={['rgba(139,92,246,0.1)', 'rgba(139,92,246,0.4)', 'rgba(139,92,246,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.separator}
        />

        {/* Card image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  slabWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  slabGradient: {
    padding: 4,
    borderRadius: 14,
  },
  label: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },

  // Front label
  frontLabelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  labelLogo: { opacity: 0.9 },
  labelInfo: { flex: 1 },
  labelName: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
  },
  labelContext: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  labelFeatures: {
    color: 'rgba(34,197,94,0.9)',
    fontWeight: '700',
    marginTop: 1,
  },
  labelSerial: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  labelGradeSection: { alignItems: 'center', marginLeft: 4 },
  labelGrade: {
    color: Colors.white,
    fontWeight: '800',
  },
  labelCondition: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Back label
  backLabelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 16,
  },
  backQrBox: { backgroundColor: '#fff', borderRadius: 4, padding: 3, justifyContent: 'center' as const, alignItems: 'center' as const },
  qrPattern: { gap: 0 },
  backGradeSection: { alignItems: 'center' as const, flex: 1 },
  backGradeText: { color: Colors.white, fontWeight: '800' },
  backConditionText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  backSubScores: { gap: 2 },
  subScoreText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'SpaceMono' },

  // Separator
  separator: { height: 1 },

  // Image
  imageContainer: {
    backgroundColor: '#0a0a12',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    aspectRatio: 0.714,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: Colors.gray[600], fontSize: 12 },
})
