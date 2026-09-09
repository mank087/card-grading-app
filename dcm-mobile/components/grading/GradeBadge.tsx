import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, ConditionLabels } from '@/lib/constants'
import {
  HERITAGE_CHIP_BLACK,
  HERITAGE_GRADE_INKS,
  HERITAGE_FALLBACK_INK,
  GRADE_10_FOIL_STOPS,
} from '@/lib/heritage'

/**
 * The ONE interface grade chip for native screens.
 *
 * Before this, `components/ui/GradeBadge.tsx` used `GradeColors` (a 10 was
 * solid green) while the Heritage label rendered the same 10 as a rainbow
 * foil chip — one card, two contradictory appearances. This component uses
 * the Heritage ladder (`HERITAGE_GRADE_INKS`) and the rainbow-outline
 * treatment for 10, so the chip and the label always agree.
 *
 * Scope: interface chips only (collection tiles/rows, card report header,
 * binder rows, marketplace picker). The Heritage/label renderers keep their
 * own chips — they are printed artwork with their own geometry.
 *
 * Colour is never the only signal: the numeral itself, and (with
 * `showLabel`) the condition name, carry the meaning, and every badge gets
 * an accessibility label.
 */

export type GradeBadgeSize = 'sm' | 'md' | 'lg'

export interface GradeBadgeProps {
  grade: number | null | undefined
  size?: GradeBadgeSize
  /** Show the condition name (Gem Mint / Mint / …) under the chip. */
  showLabel?: boolean
  /**
   * Card is authentic but not numerically gradeable (altered, autographed
   * without verification, etc). Renders AUTH instead of a number.
   */
  isAuthentic?: boolean
  style?: ViewStyle
}

const SIZES: Record<GradeBadgeSize, {
  box: number; radius: number; num: number; cond: number; border: number
}> = {
  sm: { box: 34, radius: 8,  num: 17, cond: 8,  border: 2 },
  md: { box: 50, radius: 10, num: 25, cond: 9,  border: 2.5 },
  lg: { box: 70, radius: 14, num: 35, cond: 10, border: 3 },
}

/** Heritage numeral ink for a whole grade. */
export function gradeInk(grade: number | null | undefined): string {
  if (grade == null) return HERITAGE_FALLBACK_INK.ink
  return HERITAGE_GRADE_INKS[Math.round(grade)]?.ink ?? HERITAGE_FALLBACK_INK.ink
}

/** Condition name for a whole grade — matches web getConditionFromGrade. */
export function gradeConditionName(grade: number | null | undefined): string {
  if (grade == null) return ''
  return ConditionLabels[Math.round(grade)] ?? ''
}

export default function GradeBadge({
  grade,
  size = 'md',
  showLabel = false,
  isAuthentic = false,
  style,
}: GradeBadgeProps) {
  const s = SIZES[size]
  const whole = grade == null ? null : Math.round(grade)

  // Ungraded / pending — neutral, no grade ladder colour at all.
  if (whole == null && !isAuthentic) {
    return (
      <View style={[styles.container, style]}>
        <View
          style={[
            styles.chip,
            { width: s.box, height: s.box, borderRadius: s.radius, backgroundColor: Colors.gray[200], borderWidth: 0 },
          ]}
          accessible
          accessibilityRole="text"
          accessibilityLabel="Not graded"
        >
          <Text style={[styles.numeral, { fontSize: s.num * 0.6, color: Colors.gray[500] }]}>N/A</Text>
        </View>
        {showLabel && <Text style={[styles.condition, { fontSize: s.cond, color: Colors.gray[500] }]}>Ungraded</Text>}
      </View>
    )
  }

  const authenticOnly = whole == null && isAuthentic
  const ink = authenticOnly ? HERITAGE_FALLBACK_INK.ink : gradeInk(whole)
  const conditionName = authenticOnly
    ? 'Authentic'
    : (gradeConditionName(whole) || HERITAGE_FALLBACK_INK.label)
  const numeral = authenticOnly ? 'AUTH' : String(whole)
  const isTen = whole === 10

  const a11yLabel = authenticOnly
    ? 'Authentic, not numerically graded'
    : `Grade ${whole} out of 10, ${conditionName}`

  const chip = (
    <View
      style={[
        styles.chip,
        {
          width: s.box,
          height: s.box,
          borderRadius: isTen ? s.radius - s.border : s.radius,
          backgroundColor: HERITAGE_CHIP_BLACK,
          borderWidth: isTen ? 0 : s.border,
          borderColor: ink,
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
    >
      <Text
        style={[
          styles.numeral,
          { fontSize: numeral.length > 2 ? s.num * 0.52 : s.num, color: ink },
        ]}
        numberOfLines={1}
      >
        {numeral}
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, style]}>
      {isTen ? (
        // Gem Mint 10: rainbow foil outline, matching the Heritage chip's
        // GRADE_10_FOIL_STOPS ramp. The gradient is the border — the chip
        // sits inside it with `border` px of padding on every edge.
        <LinearGradient
          colors={GRADE_10_FOIL_STOPS as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: s.border, borderRadius: s.radius }}
        >
          {chip}
        </LinearGradient>
      ) : (
        chip
      )}
      {showLabel && conditionName ? (
        <Text style={[styles.condition, { fontSize: s.cond, color: Colors.gray[700] }]} numberOfLines={2}>
          {conditionName}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  chip: { alignItems: 'center', justifyContent: 'center' },
  numeral: { fontWeight: '900', letterSpacing: -0.5, includeFontPadding: false },
  condition: {
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
})
