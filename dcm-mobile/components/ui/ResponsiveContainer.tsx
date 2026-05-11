/**
 * ResponsiveContainer — caps content width on tablet and centers it
 * horizontally. On phone, renders children unchanged (phone width is
 * already narrow enough). On tablet, content is constrained to
 * `maxWidth` and centered against the screen.
 *
 * Used across auth screens, the welcome carousel inner content, the
 * grade flow, and other forms / single-column screens that would
 * otherwise stretch to 1024+ pixels on iPad and look broken.
 *
 * Default maxWidth is 720 (a reasonable "form / single column" target
 * that matches web's typical content column on tablet breakpoints).
 * Pass a smaller value (e.g., 480) for compact auth forms, or a
 * larger value (e.g., 1024) for wide single-column screens like the
 * card detail when not in two-pane mode.
 */

import { ReactNode } from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { useResponsive } from '@/hooks/useResponsive'

interface Props {
  children: ReactNode
  maxWidth?: number
  style?: StyleProp<ViewStyle>
  /**
   * Pass `true` to apply max-width even on phones (e.g., for centered
   * modals that look the same on every device). Default: only constrain
   * on tablet+, since phone widths are already below the threshold.
   */
  always?: boolean
}

export default function ResponsiveContainer({
  children,
  maxWidth = 720,
  style,
  always = false,
}: Props) {
  const { isTablet } = useResponsive()
  const shouldConstrain = always || isTablet

  if (!shouldConstrain) {
    // On phone, render children unchanged — no extra View wrapper,
    // no layout intercept. Important: many parent layouts have
    // flex-1 children that fail if we wrap them in a non-flex View.
    return <>{children}</>
  }

  return (
    <View style={[styles.constrained, { maxWidth }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  constrained: {
    width: '100%',
    alignSelf: 'center',
    // Deliberately no flex: 1 here — it breaks ScrollView contentContainer
    // centering and forces full-height layouts even when the screen wants
    // to size to content. Callers that need flex behavior can pass
    // `style={{ flex: 1 }}` to opt in.
  },
})
