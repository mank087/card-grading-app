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
