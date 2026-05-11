/**
 * useResponsive — single source of truth for tablet vs phone layout
 * branching. Built on useWindowDimensions so it auto-updates on rotation
 * AND on iPad split-screen / slide-over resizing without any extra
 * listeners.
 *
 * Tablet detection: we use min(width, height) >= 600 rather than
 * `Platform.isPad`. Two reasons:
 *   1. Android tablets need the same treatment as iPad and don't have a
 *      Platform.isPad equivalent.
 *   2. When the app runs in split-screen on iPad at 1/3 width (~320px
 *      wide), it should fall back to phone layouts — Platform.isPad
 *      would still report true and break that.
 *
 * The min-dimension check catches every device shape correctly:
 *   - iPad full-screen, any orientation: both dims large → tablet ✓
 *   - iPad 1/3 split: width 320 → phone ✓
 *   - iPhone 14 Pro Max landscape: 932×430 → phone ✓ (height too small)
 *   - Android tablet: both dims large → tablet ✓
 *
 * `isLargeTablet` catches iPad Air / Pro 11 / Pro 12.9 (min dim ≥ 820)
 * for screens where we want an even more spacious layout (e.g., the
 * collection grid's column count).
 */

import { useWindowDimensions } from 'react-native'

export interface Responsive {
  width: number
  height: number
  isLandscape: boolean
  isTablet: boolean
  isLargeTablet: boolean
  /** Helper for inline conditional sizing: pick(phone, tablet, large?) */
  pick: <T>(phone: T, tablet: T, large?: T) => T
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions()
  const minDim = Math.min(width, height)
  const isLandscape = width > height
  const isTablet = minDim >= 600
  const isLargeTablet = minDim >= 820
  const pick = <T>(phone: T, tablet: T, large?: T): T => {
    if (isLargeTablet && large !== undefined) return large
    if (isTablet) return tablet
    return phone
  }
  return { width, height, isLandscape, isTablet, isLargeTablet, pick }
}
