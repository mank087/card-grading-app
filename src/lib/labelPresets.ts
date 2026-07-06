/**
 * Label Studio — Presets & Configuration
 *
 * Dimension presets for various slab brands, color themes,
 * and label type metadata for the gallery view.
 */

import { resolveTextPolarity } from './contrastWCAG';

// ============================================================================
// DIMENSION PRESETS
// ============================================================================

export interface DimensionPreset {
  id: string;
  name: string;
  width: number;  // inches
  height: number; // inches
  description: string;
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  { id: 'dcm', name: 'DCM Modern', width: 2.8, height: 0.8, description: 'Modern dark gradient style' },
  { id: 'dcm-traditional', name: 'DCM Traditional', width: 2.8, height: 0.8, description: 'Classic light style' },
  { id: 'dcm-bordered', name: 'DCM Bordered', width: 2.8, height: 0.8, description: 'Traditional with purple border' },
  { id: 'custom', name: 'Custom', width: 2.8, height: 0.8, description: 'Custom dimensions & border' },
];

// ============================================================================
// COLOR THEMES
// ============================================================================

export interface ColorPreset {
  id: string;
  name: string;
  gradientStart: string;
  gradientEnd: string;
  isCustom?: boolean;
  isRainbow?: boolean;
  isCardColors?: boolean;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'midnight', name: 'Midnight Black', gradientStart: '#0a0a0a', gradientEnd: '#0a0a0a' },
  { id: 'modern-dark', name: 'Modern Dark', gradientStart: '#1a1625', gradientEnd: '#2d1f47' },
  { id: 'traditional', name: 'Traditional Light', gradientStart: '#f9fafb', gradientEnd: '#ffffff' },
  { id: 'royal-blue', name: 'Royal Blue', gradientStart: '#1e3a5f', gradientEnd: '#0f2347' },
  { id: 'crimson', name: 'Crimson Red', gradientStart: '#3c1a1a', gradientEnd: '#241010' },
  { id: 'rainbow', name: 'Rainbow Gradient', gradientStart: '#ff0000', gradientEnd: '#0000ff', isRainbow: true },
  { id: 'card-colors', name: 'Card Colors', gradientStart: '#7c3aed', gradientEnd: '#4c1d95', isCardColors: true },
  { id: 'custom', name: 'Custom', gradientStart: '#1a1625', gradientEnd: '#2d1f47', isCustom: true },
];

// ============================================================================
// CARD COLOR LABEL STYLES
// ============================================================================

/**
 * Card-color-aware label styles that use colors extracted from the card image.
 * These are computed dynamically from CardColors data, not static presets.
 */

export interface CardColorInput {
  primary: string;
  secondary: string;
  isDark: boolean;
  borderColor?: string;
  topEdgeColors?: string[];
}

export interface CardColorResult {
  gradientStart: string;
  gradientEnd: string;
  accentColor: string;
  textColor: string;
  style: 'modern' | 'traditional';
  /** Multi-stop gradient colors for Card Extension (left-to-right across label) */
  topEdgeGradient?: string[];
}

export interface CardColorStyle {
  id: string;
  name: string;
  description: string;
  getColors: (colors: CardColorInput) => CardColorResult;
}

/**
 * Text colors per WCAG polarity. June 2026 (Style Gauntlet paper test):
 * polarity is now picked by worst-case contrast against the style's REAL
 * background stops instead of the Rec.601 isDark flag, which chose
 * illegible white text on mid-tone cards (e.g. 1.4:1 on light blue/gold).
 */
function polarityTextColors(polarity: 'light' | 'dark'): { textColor: string; accentColor: string } {
  return polarity === 'light'
    ? { textColor: '#ffffff', accentColor: '#ffffff' }
    : { textColor: '#1f2937', accentColor: '#1a1625' };
}

export const CARD_COLOR_STYLES: CardColorStyle[] = [
  {
    id: 'color-gradient',
    name: 'Color Gradient',
    description: 'Smooth gradient from card\'s primary to secondary color',
    getColors: ({ primary, secondary }) => {
      const polarity = resolveTextPolarity([primary, secondary]);
      return {
        gradientStart: primary,
        gradientEnd: secondary,
        ...polarityTextColors(polarity),
        style: 'modern',
      };
    },
  },
  {
    id: 'card-extension',
    name: 'Card Extension',
    description: 'Label continues the card\'s top edge colors as a gradient',
    getColors: ({ primary, secondary, topEdgeColors }) => {
      // Use actual top-edge pixel samples for a multi-color gradient
      // that seamlessly continues from the card image
      const topGradient = topEdgeColors && topEdgeColors.length >= 4
        ? topEdgeColors
        : [primary, mixHex(primary, secondary, 0.5), secondary];
      const polarity = resolveTextPolarity(topGradient);

      return {
        gradientStart: topGradient[0],
        gradientEnd: topGradient[topGradient.length - 1],
        accentColor: polarity === 'light' ? '#ffffff' : '#1a1625',
        textColor: polarityTextColors(polarity).textColor,
        style: 'modern',
        topEdgeGradient: topGradient,
      };
    },
  },
  {
    id: 'neon-outline',
    name: 'Neon Outline',
    description: 'Dark background with glowing neon border in card color',
    getColors: ({ primary }) => ({
      // Fixed near-black background — white text always wins here.
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
    getColors: ({ primary, secondary }) => {
      // Hard-edged regions + the canvas's 10% darken overlay
      const regions = [primary, secondary].map(c => mixHex(c, '#000000', 0.1));
      const polarity = resolveTextPolarity(regions, { discrete: true });
      return {
        gradientStart: primary,
        gradientEnd: secondary,
        ...polarityTextColors(polarity),
        style: 'modern',
      };
    },
  },
  {
    id: 'team-colors',
    name: 'Split',
    description: 'Bold split design using two dominant colors',
    getColors: ({ primary, secondary }) => {
      const start = mixHex(primary, '#000000', 0.2);
      const end = mixHex(secondary, '#000000', 0.2);
      const polarity = resolveTextPolarity([start, end], { discrete: true });
      return {
        gradientStart: start,
        gradientEnd: end,
        ...polarityTextColors(polarity),
        style: 'modern',
      };
    },
  },
];

/** Helper: mix two hex colors */
function mixHex(hex1: string, hex2: string, ratio: number): string {
  const parse = (h: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
  };
  const c1 = parse(hex1), c2 = parse(hex2);
  const mix = (i: number) => Math.round(c1[i] * (1 - ratio) + c2[i] * ratio).toString(16).padStart(2, '0');
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

/**
 * Apply a layout style to user-chosen custom colors.
 * Returns partial config values to merge into CustomLabelConfig.
 */
export function applyLayoutToColors(
  layoutId: string,
  colors: string[]
): Partial<CustomLabelConfig> {
  const c1 = colors[0] || '#7c3aed';
  const c2 = colors[1] || colors[0] || '#4c1d95';
  const c3 = colors[2];
  const c4 = colors[3];
  const c5 = colors[4];

  switch (layoutId) {
    case 'color-gradient':
      return {
        colorPreset: 'color-gradient',
        gradientStart: c1,
        gradientEnd: c2,
        style: 'modern',
        borderEnabled: false,
      };
    case 'card-extension': {
      // Build multi-stop gradient from all available colors
      const gradient = colors.length >= 3
        ? colors
        : [c1, mixHex(c1, c2, 0.5), c2];
      return {
        colorPreset: 'card-extension',
        gradientStart: gradient[0],
        gradientEnd: gradient[gradient.length - 1],
        topEdgeGradient: gradient,
        style: 'modern',
        borderEnabled: false,
      };
    }
    case 'neon-outline':
      return {
        colorPreset: 'neon-outline',
        gradientStart: '#0a0a0a',
        gradientEnd: '#1a1a2e',
        borderEnabled: true,
        borderColor: c1,
        borderWidth: 0.03,
        style: 'modern',
      };
    case 'geometric':
      return {
        colorPreset: 'geometric',
        gradientStart: c1,
        gradientEnd: c2,
        style: 'modern',
        borderEnabled: false,
      };
    case 'team-colors':
      return {
        colorPreset: 'team-colors',
        gradientStart: mixHex(c1, '#000000', 0.2),
        gradientEnd: mixHex(c2, '#000000', 0.2),
        style: 'modern',
        borderEnabled: false,
      };
    default: // simple gradient fallback
      return {
        colorPreset: 'custom',
        gradientStart: c1,
        gradientEnd: c2,
        style: 'modern',
      };
  }
}

/** Layout style definitions for the UI (labels + ids for buttons) */
export const LAYOUT_STYLES = [
  { id: 'color-gradient', name: 'Gradient', icon: '↗' },
  { id: 'card-extension', name: 'Extension', icon: '═' },
  { id: 'neon-outline', name: 'Neon', icon: '◇' },
  { id: 'geometric', name: 'Geometric', icon: '◆' },
  { id: 'team-colors', name: 'Split', icon: '◧' },
] as const;

/** Simple gradient — used when 'custom' is selected without a layout style */
export const DEFAULT_LAYOUT = 'color-gradient';

/** Geometric pattern variations */
export const GEOMETRIC_PATTERNS = [
  { id: 0, name: 'Shattered Glass' },
  { id: 1, name: 'Diagonal Stripes' },
  { id: 2, name: 'Fractured' },
  { id: 3, name: 'Mosaic Grid' },
  { id: 4, name: 'Lightning Bolt' },
] as const;

// ============================================================================
// CUSTOM LABEL CONFIG
// ============================================================================

export interface CustomLabelConfig {
  preset: string;          // dimension preset id
  width: number;           // inches
  height: number;          // inches
  colorPreset: string;     // color preset id
  gradientStart: string;
  gradientEnd: string;
  style: 'modern' | 'traditional';
  side: 'front' | 'back';
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;     // inches (e.g. 0.04)
  topEdgeGradient?: string[];  // Multi-stop gradient for Card Extension style
  customColors?: string[];     // Up to 5 user-picked colors for custom layouts
  layoutStyle?: string;        // Layout style id applied to custom colors
  gradientAngle?: number;      // Gradient direction in degrees (0-360, default 135)
  geometricPattern?: number;   // Geometric pattern index (0-4)
  /**
   * Label text polarity. 'auto' (default) picks white vs near-black text by
   * WCAG contrast against the actual background stops (resolveTextPolarity);
   * 'light'/'dark' are explicit user overrides from the Studio toggle.
   */
  textColorMode?: 'auto' | 'light' | 'dark';
  /**
   * Grade number color (July 2026, client-requested). Absent or 'auto' keeps
   * the historical behavior: white on dark themes, brand purple #7c3aed on
   * light. A hex value overrides it everywhere the grade digit renders
   * (canvas, vector PDF, HTML labels). Resolve via resolveGradeColor() —
   * never read this field directly, so validation stays in one place.
   */
  gradeColor?: string;
  /**
   * Typography scale for the grade digit and card-text block (July 2026,
   * client-requested). 1 = historical sizes; UI offers FONT_SCALE_PRESETS.
   * Consumers multiply their base font sizes by resolveFontScale() — the
   * existing fit-to-width/height loops still shrink oversized text, so a
   * larger scale is a request, not a guarantee, on crowded labels.
   */
  fontScale?: number;
}

export const DEFAULT_CUSTOM_CONFIG: CustomLabelConfig = {
  preset: 'dcm',
  width: 2.8,
  height: 0.8,
  colorPreset: 'modern-dark',
  gradientStart: '#1a1625',
  gradientEnd: '#2d1f47',
  style: 'modern',
  side: 'front',
  borderEnabled: false,
  borderColor: '#7c3aed',
  borderWidth: 0.04,
  textColorMode: 'auto',
};

// ============================================================================
// TEXT POLARITY (WCAG — promoted from the Label Lab, June 2026)
// ============================================================================

/**
 * The background colors text actually sits on for a config, mirroring
 * customSlabLabelGenerator.drawCustomBackground() semantics. `discrete`
 * means hard-edged regions (split/geometric) — evaluate exact colors, no
 * interpolation.
 */
export function configBackgroundStops(config: CustomLabelConfig): { stops: string[]; discrete: boolean } {
  if (config.colorPreset === 'rainbow') {
    return { stops: ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff'], discrete: false };
  }
  if (config.colorPreset === 'card-extension') {
    const stops = config.topEdgeGradient && config.topEdgeGradient.length >= 3
      ? config.topEdgeGradient
      : [config.gradientStart, config.gradientEnd];
    return { stops, discrete: false };
  }
  if (config.colorPreset === 'team-colors') {
    return { stops: [config.gradientStart, config.gradientEnd], discrete: true };
  }
  if (config.colorPreset === 'geometric') {
    const colors = config.customColors && config.customColors.length >= 2
      ? config.customColors
      : [config.gradientStart, config.gradientEnd];
    // The canvas darkens geometric regions 10% for readability
    return { stops: colors.map(c => mixHex(c, '#000000', 0.1)), discrete: true };
  }
  return { stops: [config.gradientStart, config.gradientEnd], discrete: false };
}

/**
 * Resolve whether a config's label text should be LIGHT (white) or DARK
 * (near-black). Honors the user's explicit textColorMode override; 'auto'
 * (and absent, for configs saved before the field existed) uses the WCAG
 * polarity pick against the real background stops.
 */
export function resolveConfigTextPolarity(config: CustomLabelConfig): 'light' | 'dark' {
  if (config.textColorMode === 'light') return 'light';
  if (config.textColorMode === 'dark') return 'dark';
  const { stops, discrete } = configBackgroundStops(config);
  return resolveTextPolarity(stops, { discrete });
}

// ============================================================================
// GRADE COLOR + FONT SCALE (July 2026 — client-requested customization)
// ============================================================================

/** Historical grade-digit colors, kept as the 'auto' behavior. */
export const GRADE_PURPLE = '#7c3aed';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Single source of truth for the grade digit color. `lightTheme` is the
 * generator's resolved theme lightness (isLightTheme / polarity === 'dark'):
 * historically the grade renders purple on light backgrounds and white on
 * dark ones. An explicit user gradeColor (valid 6-digit hex) wins over both.
 */
export function resolveGradeColor(
  config: Pick<CustomLabelConfig, 'gradeColor'> | null | undefined,
  lightTheme: boolean
): string {
  const c = config?.gradeColor;
  if (c && c !== 'auto' && HEX_COLOR_RE.test(c)) return c;
  return lightTheme ? GRADE_PURPLE : '#ffffff';
}

export interface FontScalePreset {
  id: string;
  name: string;
  scale: number;
}

export const FONT_SCALE_PRESETS: FontScalePreset[] = [
  { id: 'standard', name: 'Standard', scale: 1 },
  { id: 'large', name: 'Large', scale: 1.15 },
  { id: 'xl', name: 'Extra Large', scale: 1.3 },
];

/** Clamped typography scale; absent/invalid → 1 (historical sizes). */
export function resolveFontScale(
  config: Pick<CustomLabelConfig, 'fontScale'> | null | undefined
): number {
  const s = config?.fontScale;
  if (typeof s !== 'number' || !Number.isFinite(s)) return 1;
  return Math.min(1.5, Math.max(0.8, s));
}

// ============================================================================
// SAVED CUSTOM STYLES (persisted to DB)
// ============================================================================

export interface SavedCustomStyle {
  id: string;           // 'custom-1' through 'custom-4'
  name: string;         // Default "Custom Label 1", user-editable
  config: CustomLabelConfig;
}

export interface LabelColorOverrides {
  gradientStart: string;
  gradientEnd: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;  // inches, converted to px by consumer
  isRainbow?: boolean;  // true when colorPreset === 'rainbow'
  isNeonOutline?: boolean;  // true when using neon-outline card color style
  isCardExtension?: boolean;  // true when using card-extension style
  topEdgeGradient?: string[];  // Multi-stop gradient for card-extension slab wrapper
  /** Resolved label text polarity (WCAG auto or user override). HTML label
      components use this to pick light vs dark text sets. */
  textPolarity?: 'light' | 'dark';
  /** Resolved grade digit color (user override or the polarity default). */
  gradeColor?: string;
  /** Resolved typography scale (1 = historical sizes). */
  fontScale?: number;
}

/** Rainbow CSS gradient string for reuse across components */
export const RAINBOW_GRADIENT = 'linear-gradient(90deg, #ff0000 0%, #ff8800 17%, #ffff00 33%, #00cc00 50%, #0066ff 67%, #8800ff 83%, #ff00ff 100%)';

/**
 * Build slab wrapper styles (the metallic border around the card) from colorOverrides.
 * Returns modern slab styles if overrides are provided, else returns default purple modern styles.
 */
export function getSlabWrapperStyle(overrides: LabelColorOverrides | undefined): React.CSSProperties {
  if (overrides?.isRainbow) {
    return {
      background: 'linear-gradient(145deg, #ff0000 0%, #ff8800 17%, #ffff00 33%, #00cc00 50%, #0066ff 67%, #8800ff 83%, #ff00ff 100%)',
      boxShadow: '0 0 20px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    };
  }
  if (overrides?.isCardExtension && overrides.topEdgeGradient && overrides.topEdgeGradient.length >= 3) {
    const stops = overrides.topEdgeGradient.map((c, i, arr) =>
      `${c} ${Math.round((i / (arr.length - 1)) * 100)}%`
    ).join(', ');
    return {
      background: `linear-gradient(90deg, ${stops})`,
      boxShadow: `0 0 20px ${overrides.gradientStart}66, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)`,
      border: `1px solid ${overrides.gradientStart}66`,
    };
  }
  if (overrides?.isNeonOutline) {
    return {
      background: `linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)`,
      boxShadow: `0 0 15px ${overrides.borderColor}66, 0 0 30px ${overrides.borderColor}33, inset 0 1px 0 ${overrides.borderColor}33, inset 0 -1px 0 rgba(0,0,0,0.3)`,
      border: `2px solid ${overrides.borderColor}88`,
    };
  }
  if (overrides) {
    return {
      background: `linear-gradient(145deg, ${overrides.gradientStart} 0%, ${overrides.gradientEnd} 50%, ${overrides.gradientStart} 100%)`,
      boxShadow: `0 0 20px ${overrides.gradientEnd}66, inset 0 1px 0 ${overrides.gradientEnd}4d, inset 0 -1px 0 rgba(0,0,0,0.3)`,
      border: `1px solid ${overrides.gradientEnd}66`,
    };
  }
  // Default modern purple
  return {
    background: 'linear-gradient(145deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(139, 92, 246, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
    border: '1px solid rgba(139, 92, 246, 0.4)',
  };
}

/**
 * Extract color overrides from a CustomLabelConfig.
 * Returns undefined if config is null/undefined (i.e. built-in style).
 */
export function extractColorOverrides(config: CustomLabelConfig | null | undefined): LabelColorOverrides | undefined {
  if (!config) return undefined;
  return {
    gradientStart: config.gradientStart,
    gradientEnd: config.gradientEnd,
    borderEnabled: config.borderEnabled,
    borderColor: config.borderColor,
    borderWidth: config.borderWidth,
    isRainbow: config.colorPreset === 'rainbow',
    isNeonOutline: config.colorPreset === 'neon-outline',
    isCardExtension: config.colorPreset === 'card-extension',
    topEdgeGradient: config.topEdgeGradient,
    textPolarity: resolveConfigTextPolarity(config),
    // Resolved here (not raw config.gradeColor) so HTML consumers inherit the
    // same validation + auto fallback as the canvas/vector generators.
    gradeColor: resolveGradeColor(config, resolveConfigTextPolarity(config) === 'dark'),
    fontScale: resolveFontScale(config),
  };
}

// ============================================================================
// LABEL GALLERY TYPES
// ============================================================================

export interface LabelTypeInfo {
  id: string;
  name: string;
  dimensions: string;
  useCase: string;
  description: string;
  howToApply: string;
  category: 'slab' | 'toploader' | 'onetouch' | 'digital';
  style?: 'modern' | 'traditional';
  downloadType: 'slab' | 'avery' | 'avery8167' | 'foldover' | 'card-images';
}

export const LABEL_TYPES: LabelTypeInfo[] = [
  {
    id: 'slab-modern',
    name: 'Graded Slab (Modern)',
    dimensions: '2.8" × 0.8"',
    useCase: 'Insert into standard grading slab',
    description: 'Dark gradient label matching DCM modern style. Duplex printing with front grade and back QR code.',
    howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.',
    category: 'slab',
    style: 'modern',
    downloadType: 'slab',
  },
  {
    id: 'slab-traditional',
    name: 'Graded Slab (Traditional)',
    dimensions: '2.8" × 0.8"',
    useCase: 'Insert into standard grading slab',
    description: 'Light/white label with classic grading style. Clean, professional look for any slab.',
    howToApply: 'Print on standard paper at 100% scale. Cut along dotted lines. Insert into slab label slot.',
    category: 'slab',
    style: 'traditional',
    downloadType: 'slab',
  },
  {
    id: 'onetouch',
    name: 'Magnetic One-Touch',
    dimensions: '1.25" × 2.375"',
    useCase: 'Avery 6871 for magnetic cases',
    description: 'Sized for Avery 6871 labels. Fits magnetic one-touch card holders perfectly.',
    howToApply: 'Print on Avery 6871 label sheets. Peel and stick to one-touch magnetic case.',
    category: 'onetouch',
    downloadType: 'avery',
  },
  {
    id: 'toploader',
    name: 'Toploader Front+Back',
    dimensions: '1.75" × 0.5"',
    useCase: 'Avery 8167, front grade + back QR',
    description: 'Two small labels per card — grade info on front, QR code on back of toploader.',
    howToApply: 'Print on Avery 8167 sheets. Apply front label to toploader front, back label to rear.',
    category: 'toploader',
    downloadType: 'avery8167',
  },
  {
    id: 'foldover',
    name: 'Fold-Over Toploader',
    dimensions: '1.75" × 0.5"',
    useCase: 'Single label, fold over toploader tab',
    description: 'One label that folds over the toploader opening. Grade visible on front, QR on back.',
    howToApply: 'Print on Avery 8167. Apply to toploader top edge and fold over to seal.',
    category: 'toploader',
    downloadType: 'foldover',
  },
  {
    id: 'card-image-modern',
    name: 'Card Image (Modern)',
    dimensions: '800×1120px',
    useCase: 'eBay/social media sharing',
    description: 'Digital card image with modern dark label overlay. Perfect for online listings.',
    howToApply: 'Download and upload to eBay, social media, or online marketplace listings.',
    category: 'digital',
    style: 'modern',
    downloadType: 'card-images',
  },
  {
    id: 'card-image-traditional',
    name: 'Card Image (Traditional)',
    dimensions: '800×1120px',
    useCase: 'eBay/social media sharing',
    description: 'Digital card image with traditional light label overlay. Clean look for listings.',
    howToApply: 'Download and upload to eBay, social media, or online marketplace listings.',
    category: 'digital',
    style: 'traditional',
    downloadType: 'card-images',
  },
];
