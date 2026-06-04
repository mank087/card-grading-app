import { View, Text, StyleSheet } from 'react-native'

/**
 * eBay-styled wordmark — lowercase "ebay" in the iconic 4-color treatment
 * (red e, blue b, yellow a, green y). Used as the bottom-nav tab icon for
 * the InstaList Marketplace tab.
 *
 * When the tab is inactive, all four letters share the tint color passed
 * in, so it visually grays out alongside the other tab icons. When active,
 * the wordmark renders in its native colors as the focal element.
 *
 * Sized to fit within a standard 24x24 tab-icon container. The previous
 * implementation scaled the font to ~20px (using size * 0.85), which made
 * the wordmark ~55-60px wide and overflowed iOS' bottom-tab icon slot —
 * iOS clipped or hid the entire tab. Android was more forgiving. Now the
 * wordmark always sits inside a fixed-size box with an explicit
 * lineHeight (iOS needs that to avoid baseline drift in tiny text).
 */

interface Props {
  /** Tint applied when the tab is inactive. When active, native eBay
   *  colors are used instead. */
  color: string
  /** Tab icon size — passed from the Tabs navigator. */
  size: number
  /** True when the tab is the currently active route. */
  focused: boolean
}

const EBAY_COLORS = {
  e: '#E53238', // red
  b: '#0064D2', // blue
  a: '#F5AF02', // yellow
  y: '#86B817', // green
}

export default function EbayWordmark({ color, size, focused }: Props) {
  // Scale relative to the icon container but cap so 4 letters always fit
  // within `size` pixels of width. ~38% of the box height gives a tight
  // wordmark that reads cleanly at 24px (the default tab icon size).
  const fontSize = Math.round(size * 0.42)
  const lineHeight = Math.round(fontSize * 1.05)

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityLabel="eBay InstaList tab"
    >
      <Text
        style={[styles.letter, { fontSize, lineHeight, color: focused ? EBAY_COLORS.e : color }]}
        allowFontScaling={false}
      >
        e
      </Text>
      <Text
        style={[styles.letter, { fontSize, lineHeight, color: focused ? EBAY_COLORS.b : color }]}
        allowFontScaling={false}
      >
        b
      </Text>
      <Text
        style={[styles.letter, { fontSize, lineHeight, color: focused ? EBAY_COLORS.a : color }]}
        allowFontScaling={false}
      >
        a
      </Text>
      <Text
        style={[styles.letter, { fontSize, lineHeight, color: focused ? EBAY_COLORS.y : color }]}
        allowFontScaling={false}
      >
        y
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '900',
    // Tighter than before so 4 letters fit in the standard icon width.
    letterSpacing: -1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
})
