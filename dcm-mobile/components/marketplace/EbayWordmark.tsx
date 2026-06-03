import { View, Text, StyleSheet } from 'react-native'

/**
 * eBay-styled wordmark — lowercase "ebay" in the iconic 4-color treatment
 * (red e, blue b, yellow a, green y). Used as the bottom-nav tab icon for
 * the InstaList Marketplace tab.
 *
 * When the tab is inactive, all four letters share the tint color passed
 * in, so it visually grays out alongside the other tab icons. When active,
 * the wordmark renders in its native colors as the focal element.
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

// Approximate eBay brand colors (not the exact licensed wordmark but a
// well-known visual approximation — same palette every UI dev uses for
// "eBay-style" representation).
const EBAY_COLORS = {
  e: '#E53238', // red
  b: '#0064D2', // blue
  a: '#F5AF02', // yellow
  y: '#86B817', // green
}

export default function EbayWordmark({ color, size, focused }: Props) {
  const fontSize = Math.max(13, size * 0.85)
  return (
    <View style={styles.row} accessibilityLabel="eBay InstaList tab">
      <Text style={[styles.letter, { fontSize, color: focused ? EBAY_COLORS.e : color }]}>e</Text>
      <Text style={[styles.letter, { fontSize, color: focused ? EBAY_COLORS.b : color }]}>b</Text>
      <Text style={[styles.letter, { fontSize, color: focused ? EBAY_COLORS.a : color }]}>a</Text>
      <Text style={[styles.letter, { fontSize, color: focused ? EBAY_COLORS.y : color }]}>y</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontWeight: '900',
    // Slight negative letter-spacing tightens the wordmark to feel like
    // the eBay logo rather than four loose letters.
    letterSpacing: -0.5,
    // Force a consistent baseline across the four glyphs.
    lineHeight: undefined,
  },
})
