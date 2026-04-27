/**
 * Label Studio — Presets & Configuration
 *
 * Dimension presets for various slab brands, color themes,
 * and label type metadata for the gallery view.
 */

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
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'modern-dark', name: 'Modern Dark', gradientStart: '#1a1625', gradientEnd: '#2d1f47' },
  { id: 'traditional', name: 'Traditional Light', gradientStart: '#f9fafb', gradientEnd: '#ffffff' },
  { id: 'midnight', name: 'Midnight Black', gradientStart: '#0a0a0a', gradientEnd: '#1a1a2e' },
  { id: 'royal-blue', name: 'Royal Blue', gradientStart: '#1e3a5f', gradientEnd: '#0f2347' },
  { id: 'forest-green', name: 'Forest Green', gradientStart: '#1a3c2a', gradientEnd: '#0f2418' },
  { id: 'crimson', name: 'Crimson Red', gradientStart: '#3c1a1a', gradientEnd: '#241010' },
  { id: 'rainbow', name: 'Rainbow Gradient', gradientStart: '#ff0000', gradientEnd: '#0000ff', isRainbow: true },
  { id: 'custom', name: 'Custom', gradientStart: '#1a1625', gradientEnd: '#2d1f47', isCustom: true },
];

// ============================================================================
// CARD COLOR LABEL STYLES
// ============================================================================

/**
 * Card-color-aware label styles that use colors extracted from the card image.
 * These are computed dynamically from CardColors data, not static presets.
 */

export interface CardColorStyle {
  id: string;
  name: string;
  description: string;
  /** Generate gradient colors from extracted card colors */
  getColors: (primary: string, secondary: string, isDark: boolean) => {
    gradientStart: string;
    gradientEnd: string;
    accentColor: string;
    textColor: string;
    style: 'modern' | 'traditional';
  };
}

export const CARD_COLOR_STYLES: CardColorStyle[] = [
  {
    id: 'color-gradient',
    name: 'Color Gradient',
    description: 'Smooth gradient from card\'s primary to secondary color',
    getColors: (primary, secondary, isDark) => ({
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
    description: 'Label seamlessly continues the card\'s top edge colors',
    getColors: (primary, secondary, isDark) => ({
      gradientStart: primary,
      gradientEnd: mixHex(primary, '#000000', 0.4),
      accentColor: secondary,
      textColor: '#ffffff',
      style: 'modern',
    }),
  },
  {
    id: 'neon-outline',
    name: 'Neon Outline',
    description: 'Dark background with glowing neon border in card color',
    getColors: (primary, _secondary, _isDark) => ({
      gradientStart: '#0a0a0a',
      gradientEnd: '#1a1a2e',
      accentColor: primary,
      textColor: '#ffffff',
      style: 'modern',
    }),
  },
  {
    id: 'frosted-glass',
    name: 'Frosted Glass',
    description: 'Light translucent label tinted with card colors',
    getColors: (primary, secondary, _isDark) => ({
      gradientStart: mixHex(primary, '#ffffff', 0.85),
      gradientEnd: mixHex(secondary, '#ffffff', 0.85),
      accentColor: primary,
      textColor: '#1f2937',
      style: 'traditional',
    }),
  },
  {
    id: 'team-colors',
    name: 'Team Colors',
    description: 'Bold split design using card\'s two dominant colors',
    getColors: (primary, secondary, isDark) => ({
      gradientStart: mixHex(primary, '#000000', 0.2),
      gradientEnd: mixHex(secondary, '#000000', 0.2),
      accentColor: isDark ? '#ffffff' : '#1a1625',
      textColor: '#ffffff',
      style: 'modern',
    }),
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
};

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
