// Color theme presets
export interface ColorPreset {
  id: string
  name: string
  gradientStart: string
  gradientEnd: string
  isCustom?: boolean
  isRainbow?: boolean
  isCardColors?: boolean
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'midnight', name: 'Midnight Black', gradientStart: '#0a0a0a', gradientEnd: '#0a0a0a' },
  { id: 'modern-dark', name: 'Modern Dark', gradientStart: '#1a1625', gradientEnd: '#2d1f47' },
  { id: 'traditional', name: 'Traditional Light', gradientStart: '#f9fafb', gradientEnd: '#ffffff' },
  { id: 'royal-blue', name: 'Royal Blue', gradientStart: '#1e3a5f', gradientEnd: '#0f2347' },
  { id: 'crimson', name: 'Crimson Red', gradientStart: '#3c1a1a', gradientEnd: '#241010' },
  { id: 'rainbow', name: 'Rainbow', gradientStart: '#ff0000', gradientEnd: '#0000ff', isRainbow: true },
  { id: 'card-colors', name: 'Card Colors', gradientStart: '#7c3aed', gradientEnd: '#4c1d95', isCardColors: true },
  { id: 'custom', name: 'Custom', gradientStart: '#1a1625', gradientEnd: '#2d1f47', isCustom: true },
]

// Dimension presets — 1:1 with src/lib/labelPresets.ts so saved configs round-trip with web.
export interface DimensionPreset {
  id: 'dcm' | 'dcm-traditional' | 'dcm-bordered' | 'custom'
  name: string
  width: number
  height: number
  description: string
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  { id: 'dcm',             name: 'DCM Modern',      width: 2.8, height: 0.8, description: 'Modern dark gradient style' },
  { id: 'dcm-traditional', name: 'DCM Traditional', width: 2.8, height: 0.8, description: 'Classic light style' },
  { id: 'dcm-bordered',    name: 'DCM Bordered',    width: 2.8, height: 0.8, description: 'Traditional with purple border' },
  { id: 'custom',          name: 'Custom',          width: 2.8, height: 0.8, description: 'Custom dimensions & border' },
]

// Layout styles for card color and custom modes
export const LAYOUT_STYLES = [
  { id: 'color-gradient', name: 'Gradient' },
  { id: 'card-extension', name: 'Extension' },
  { id: 'neon-outline', name: 'Neon' },
  { id: 'geometric', name: 'Geometric' },
  { id: 'team-colors', name: 'Split' },
] as const

// Card color style interface
export interface CardColorStyle {
  id: string
  name: string
  description: string
  getColors: (colors: CardColorInput) => CardColorResult
}

export interface CardColorInput {
  primary: string
  secondary: string
  isDark: boolean
  borderColor?: string
  topEdgeColors?: string[]
}

export interface CardColorResult {
  gradientStart: string
  gradientEnd: string
  accentColor: string
  textColor: string
  style: 'modern' | 'traditional'
  topEdgeGradient?: string[]
}

// Helper to mix two hex colors
function mixHex(hex1: string, hex2: string, ratio: number): string {
  const parse = (h: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
  }
  const c1 = parse(hex1), c2 = parse(hex2)
  const mix = (i: number) => Math.round(c1[i] * (1 - ratio) + c2[i] * ratio).toString(16).padStart(2, '0')
  return `#${mix(0)}${mix(1)}${mix(2)}`
}

// The 5 card color styles with their getColors functions (same as web)
export const CARD_COLOR_STYLES: CardColorStyle[] = [
  {
    id: 'color-gradient',
    name: 'Color Gradient',
    description: 'Smooth gradient from primary to secondary',
    getColors: ({ primary, secondary, isDark }) => ({
      gradientStart: primary,
      gradientEnd: secondary,
      accentColor: isDark ? '#ffffff' : '#1a1625',
      textColor: isDark ? '#ffffff' : '#1f2937',
      style: 'modern',
    }),
  },
  {
    id: 'card-extension',
    name: 'Card Extension',
    description: 'Label continues the card top edge colors',
    getColors: ({ primary, secondary, topEdgeColors }) => {
      const topGradient = topEdgeColors && topEdgeColors.length >= 4
        ? topEdgeColors
        : [primary, mixHex(primary, secondary, 0.5), secondary]
      return {
        gradientStart: topGradient[0],
        gradientEnd: topGradient[topGradient.length - 1],
        accentColor: secondary,
        textColor: '#ffffff',
        style: 'modern',
        topEdgeGradient: topGradient,
      }
    },
  },
  {
    id: 'neon-outline',
    name: 'Neon Outline',
    description: 'Dark background with glowing neon border',
    getColors: ({ primary }) => ({
      gradientStart: '#0a0a0a',
      gradientEnd: '#1a1a2e',
      accentColor: primary,
      textColor: '#ffffff',
      style: 'modern',
    }),
  },
  {
    id: 'geometric',
    name: 'Geometric',
    description: 'Hard-line geometric dividers between colors',
    getColors: ({ primary, secondary, isDark }) => ({
      gradientStart: primary,
      gradientEnd: secondary,
      accentColor: isDark ? '#ffffff' : '#1a1625',
      textColor: '#ffffff',
      style: 'modern',
    }),
  },
  {
    id: 'team-colors',
    name: 'Split',
    description: 'Bold split of two dominant colors',
    getColors: ({ primary, secondary, isDark }) => ({
      gradientStart: mixHex(primary, '#000000', 0.2),
      gradientEnd: mixHex(secondary, '#000000', 0.2),
      accentColor: isDark ? '#ffffff' : '#1a1625',
      textColor: '#ffffff',
      style: 'modern',
    }),
  },
]

// Apply a layout style to user-chosen custom colors
export function applyLayoutToColors(layoutId: string, colors: string[]): {
  colorPreset: string
  gradientStart: string
  gradientEnd: string
  style: 'modern' | 'traditional'
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  topEdgeGradient?: string[]
} {
  const c1 = colors[0] || '#7c3aed'
  const c2 = colors[1] || colors[0] || '#4c1d95'

  switch (layoutId) {
    case 'color-gradient':
      return { colorPreset: 'color-gradient', gradientStart: c1, gradientEnd: c2, style: 'modern', borderEnabled: false, borderColor: '#7c3aed', borderWidth: 0.04 }
    case 'card-extension': {
      const gradient = colors.length >= 3 ? colors : [c1, mixHex(c1, c2, 0.5), c2]
      return { colorPreset: 'card-extension', gradientStart: gradient[0], gradientEnd: gradient[gradient.length - 1], topEdgeGradient: gradient, style: 'modern', borderEnabled: false, borderColor: '#7c3aed', borderWidth: 0.04 }
    }
    case 'neon-outline':
      return { colorPreset: 'neon-outline', gradientStart: '#0a0a0a', gradientEnd: '#1a1a2e', borderEnabled: true, borderColor: c1, borderWidth: 0.03, style: 'modern' }
    case 'geometric':
      return { colorPreset: 'geometric', gradientStart: c1, gradientEnd: c2, style: 'modern', borderEnabled: false, borderColor: '#7c3aed', borderWidth: 0.04 }
    case 'team-colors':
      return { colorPreset: 'team-colors', gradientStart: mixHex(c1, '#000000', 0.2), gradientEnd: mixHex(c2, '#000000', 0.2), style: 'modern', borderEnabled: false, borderColor: '#7c3aed', borderWidth: 0.04 }
    default:
      return { colorPreset: 'custom', gradientStart: c1, gradientEnd: c2, style: 'modern', borderEnabled: false, borderColor: '#7c3aed', borderWidth: 0.04 }
  }
}
