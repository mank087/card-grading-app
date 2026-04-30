import { View, Text, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { LinearGradient } from 'expo-linear-gradient'
import type { LabelColorOverrides, LabelStyleId } from '@/hooks/useLabelStyle'

/**
 * SlabCard — Renders a card inside a graded slab frame
 * with the DCM label above the card image. Supports modern (default) and
 * traditional layouts plus user color overrides from saved custom styles.
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
  labelStyle?: LabelStyleId
  colorOverrides?: LabelColorOverrides
  qrUrl?: string
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
}

const EMBLEMS = {
  founder: { icon: 'star', label: 'Founder', iconColor: '#FFD700', textColor: '#FFFFFF' },
  vip: { icon: 'diamond', label: 'VIP', iconColor: '#6366f1', textColor: '#FFFFFF' },
  cardLovers: { icon: 'heart', label: 'Card Lover', iconColor: '#f43f5e', textColor: '#FFFFFF' },
} as const

const TRADITIONAL_EMBLEMS = {
  founder: { ...EMBLEMS.founder, iconColor: '#d97706', textColor: '#7c3aed' },
  vip: { ...EMBLEMS.vip, iconColor: '#6366f1', textColor: '#6366f1' },
  cardLovers: { ...EMBLEMS.cardLovers, iconColor: '#f43f5e', textColor: '#ec4899' },
} as const

// Build a QR-code image URL from a target URL using a free public QR-as-an-image service.
// We render this via <Image>, mirroring the visual fidelity of the web QRCodeCanvas.
function buildQrImageUrl(target: string, sizePx: number): string {
  const px = Math.max(40, Math.min(480, Math.round(sizePx)))
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(target)}&size=${px}x${px}&format=png&ecc=H&margin=0`
}

const RAINBOW_COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff'] as const
const DEFAULT_MODERN_COLORS = ['#1a1625', '#2d1f47', '#1a1625'] as const

function getWrapperColors(overrides?: LabelColorOverrides): readonly string[] {
  if (!overrides) return DEFAULT_MODERN_COLORS
  if (overrides.isRainbow) return RAINBOW_COLORS
  if (overrides.isCardExtension && overrides.topEdgeGradient && overrides.topEdgeGradient.length >= 2) {
    return overrides.topEdgeGradient
  }
  if (overrides.isNeonOutline) return ['#0a0a0a', '#1a1a2e', '#0a0a0a']
  return [overrides.gradientStart, overrides.gradientEnd, overrides.gradientStart]
}

function dynamicNameFontSize(name: string, base: number): number {
  if (!name) return base
  if (name.length > 30) return base * 0.75
  if (name.length > 22) return base * 0.85
  if (name.length > 16) return base * 0.92
  return base
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
  labelStyle = 'modern',
  colorOverrides,
  qrUrl,
  showFounderEmblem = false,
  showVipEmblem = false,
  showCardLoversEmblem = false,
}: SlabCardProps) {
  const gradeText = grade !== null ? Math.round(grade).toString() : 'N/A'
  const conditionText = condition?.toUpperCase() || ''
  // Front and back labels share the same height so they line up across the slab —
  // matches the web (ModernFrontLabel heights match ModernBackLabel by design).
  // The taller dimension wins so the back label still fits the full sub-grade names.
  const labelHeight = size === 'sm' ? 70 : size === 'md' ? 84 : 110
  const fontScale = size === 'sm' ? 0.85 : size === 'md' ? 1 : 1.15
  const isTraditional = labelStyle === 'traditional'
  const qrSize = size === 'sm' ? 44 : size === 'md' ? 56 : 70
  // Allow the context line (Set • #Num • Year) to wrap to 2 lines on the card detail
  // page (size=lg) where there's enough vertical room. Keep 1 line on sm/md.
  const contextLines = size === 'lg' ? 2 : 1

  const wrapperColors = isTraditional ? ['#e5e7eb', '#f3f4f6', '#e5e7eb'] : getWrapperColors(colorOverrides)
  const labelColors = isTraditional ? ['#f9fafb', '#ffffff', '#f9fafb'] : (colorOverrides?.isCardExtension ? wrapperColors : (colorOverrides?.isRainbow ? ['#1a1625', '#2d1f47', '#1a1625'] : (colorOverrides ? [colorOverrides.gradientStart, colorOverrides.gradientEnd, colorOverrides.gradientStart] : DEFAULT_MODERN_COLORS)))

  // Text colors: traditional = dark on light, modern = white on dark
  const nameColor = isTraditional ? Colors.gray[900] : 'rgba(255,255,255,0.95)'
  const contextColor = isTraditional ? Colors.gray[600] : 'rgba(255,255,255,0.7)'
  const featureColor = isTraditional ? Colors.blue[600] : 'rgba(96,165,250,0.95)'
  const serialColor = isTraditional ? Colors.gray[500] : 'rgba(255,255,255,0.65)'
  const gradeColor = isTraditional ? Colors.purple[700] : Colors.white
  const conditionColor = isTraditional ? Colors.purple[600] : 'rgba(255,255,255,0.85)'
  const logoTint = isTraditional ? undefined : 'rgba(255,255,255,0.9)'

  const nameFontSize = dynamicNameFontSize(displayName, 12 * fontScale)

  return (
    <View style={styles.slabWrapper}>
      <LinearGradient
        colors={wrapperColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slabGradient}
      >
        {/* Label */}
        <LinearGradient
          colors={labelColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.label,
            { height: labelHeight },
            isTraditional && { borderWidth: 1, borderColor: Colors.gray[200] },
          ]}
        >
          {isBack ? (
            <View style={styles.backLabelContent}>
              {/* QR code + emblems clustered on the left */}
              <View style={styles.backLeftCluster}>
                {qrUrl ? (
                  <View style={[styles.backQrBox, { padding: 4, backgroundColor: '#fff', borderRadius: 4 }]}>
                    <Image
                      source={{ uri: buildQrImageUrl(qrUrl, qrSize * 2) }}
                      style={{ width: qrSize, height: qrSize }}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
                {([
                  showFounderEmblem ? 'founder' : null,
                  showCardLoversEmblem ? 'cardLovers' : null,
                  showVipEmblem ? 'vip' : null,
                ].filter(Boolean) as Array<keyof typeof EMBLEMS>).map(key => {
                  const e = isTraditional ? TRADITIONAL_EMBLEMS[key] : EMBLEMS[key]
                  const iconSize = size === 'sm' ? 11 : size === 'md' ? 13 : 15
                  // Vertical box height = the label's available height minus icon + paddings.
                  // Sized so even the longest label ("CARD LOVER", 10 chars) fits without truncating.
                  const verticalBoxHeight = labelHeight - iconSize - 14
                  // Font size tuned so 10 uppercase chars fit within verticalBoxHeight.
                  const textFontSize = size === 'sm' ? 5 : size === 'md' ? 6 : 7
                  return (
                    <View key={key} style={styles.emblemColumn}>
                      <Ionicons name={e.icon as any} size={iconSize} color={e.iconColor} />
                      <View style={[styles.verticalLabelBox, { width: 10, height: verticalBoxHeight }]}>
                        <Text
                          style={{
                            fontSize: textFontSize,
                            fontWeight: '700',
                            color: e.textColor,
                            textTransform: 'uppercase',
                            position: 'absolute',
                            width: verticalBoxHeight,
                            textAlign: 'center',
                            transform: [{ rotate: '-90deg' }],
                          }}
                          numberOfLines={1}
                        >
                          {e.label}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
              {/* Center: large grade + condition */}
              <View style={styles.backGradeSection}>
                <Text style={[styles.backGradeText, { fontSize: 32 * fontScale, color: gradeColor }]}>{gradeText}</Text>
                {conditionText ? (
                  <Text style={[styles.backConditionText, { fontSize: 9 * fontScale, color: conditionColor }]}>{conditionText}</Text>
                ) : null}
              </View>
              {/* Right: full sub-grade names */}
              {subScores && (
                <View style={styles.backSubScores}>
                  {[
                    ['Centering', subScores.centering],
                    ['Corners', subScores.corners],
                    ['Edges', subScores.edges],
                    ['Surface', subScores.surface],
                  ].map(([label, val]) => {
                    const v = typeof val === 'number' ? Math.round(val) : (val && typeof val === 'object' && (val as any).weighted != null ? Math.round((val as any).weighted) : null)
                    return v != null
                      ? <Text key={label as string} style={[styles.subScoreText, { fontSize: 9 * fontScale, color: contextColor }]}>{label}: {v}</Text>
                      : null
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.frontLabelContent}>
              <Image
                source={require('@/assets/images/dcm-logo.png')}
                style={[styles.labelLogo, { width: 22 * fontScale, height: 22 * fontScale }]}
                resizeMode="contain"
                tintColor={logoTint}
              />

              <View style={styles.labelInfo}>
                <Text style={[styles.labelName, { fontSize: nameFontSize, color: nameColor }]} numberOfLines={1}>
                  {displayName}
                </Text>
                {contextLine ? (
                  <Text
                    style={[styles.labelContext, { fontSize: (size === 'lg' ? 9 : 8) * fontScale, color: contextColor, lineHeight: (size === 'lg' ? 11 : 10) }]}
                    numberOfLines={contextLines}
                  >
                    {contextLine}
                  </Text>
                ) : null}
                {features.length > 0 && (
                  <Text style={[styles.labelFeatures, { fontSize: 7.5 * fontScale, color: featureColor }]} numberOfLines={1}>
                    {features.join(' • ')}
                  </Text>
                )}
                <Text style={[styles.labelSerial, { fontSize: 7 * fontScale, color: serialColor }]} numberOfLines={1}>{serial}</Text>
              </View>

              <View style={styles.labelGradeSection}>
                <Text style={[styles.labelGrade, { fontSize: 26 * fontScale, color: gradeColor }]}>{gradeText}</Text>
                {conditionText ? (
                  <>
                    <View style={[styles.gradeUnderline, { backgroundColor: isTraditional ? Colors.purple[600] : 'rgba(255,255,255,0.5)' }]} />
                    <Text style={[styles.labelCondition, { fontSize: 7 * fontScale, color: conditionColor }]} numberOfLines={1}>{conditionText}</Text>
                  </>
                ) : null}
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Separator */}
        <LinearGradient
          colors={isTraditional
            ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.05)']
            : ['rgba(139,92,246,0.1)', 'rgba(139,92,246,0.4)', 'rgba(139,92,246,0.1)']}
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
  slabGradient: { padding: 4, borderRadius: 14 },
  label: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },

  frontLabelContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  labelLogo: { opacity: 0.95 },
  labelInfo: { flex: 1, minWidth: 0 },
  labelName: { fontWeight: '700' },
  labelContext: { marginTop: 1 },
  labelFeatures: { fontWeight: '700', marginTop: 1 },
  labelSerial: { fontFamily: 'SpaceMono', marginTop: 2 },
  labelGradeSection: { alignItems: 'center', marginLeft: 4, minWidth: 38 },
  labelGrade: { fontWeight: '800' },
  gradeUnderline: { height: 1.5, width: 24, marginTop: 2, marginBottom: 2 },
  labelCondition: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  backLabelContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 8 },
  backLeftCluster: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backQrBox: { justifyContent: 'center', alignItems: 'center' },
  emblemColumn: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2, paddingHorizontal: 1 },
  verticalLabelBox: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', marginTop: 2 },
  backGradeSection: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  backGradeText: { fontWeight: '800', textAlign: 'center' },
  backConditionText: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  backSubScores: { gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
  subScoreText: { fontWeight: '500' },

  separator: { height: 1 },

  imageContainer: {
    backgroundColor: '#0a0a12',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    aspectRatio: 0.714,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[600], fontSize: 12 },
})
