// DCM Brand Colors — matches web Tailwind palette
export const Colors = {
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  white: '#ffffff',
  black: '#000000',
}

// Grade-specific colors
export const GradeColors: Record<number, string> = {
  10: '#22c55e', // green
  9: '#3b82f6',  // blue
  8: '#6366f1',  // indigo
  7: '#8b5cf6',  // violet
  6: '#a855f7',  // purple
  5: '#d97706',  // amber
  4: '#ea580c',  // orange
  3: '#dc2626',  // red
  2: '#991b1b',  // dark red
  1: '#6b7280',  // gray
}

// Confidence letter colors
export const ConfidenceColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: Colors.green[50], text: Colors.green[600], border: Colors.green[500] },
  B: { bg: Colors.blue[50], text: Colors.blue[600], border: Colors.blue[500] },
  C: { bg: Colors.amber[50], text: Colors.amber[600], border: Colors.amber[500] },
  D: { bg: Colors.red[50], text: Colors.red[600], border: Colors.red[500] },
}

// Condition label mapping
export const ConditionLabels: Record<number, string> = {
  10: 'Gem Mint',
  9: 'Mint',
  8: 'Near Mint-Mint',
  7: 'Near Mint',
  6: 'Excellent-Mint',
  5: 'Excellent',
  4: 'Very Good-Excellent',
  3: 'Very Good',
  2: 'Good',
  1: 'Poor',
}

// Card categories — shortLabel for pills on small screens
export const CardCategories = [
  { key: 'Sports', label: 'Sports', icon: 'trophy' },
  { key: 'Pokemon', label: 'Pokemon', icon: 'flash' },
  { key: 'MTG', label: 'MTG', icon: 'sparkles' },
  { key: 'Lorcana', label: 'Lorcana', icon: 'star' },
  { key: 'One Piece', label: 'One Piece', icon: 'flag' },
  { key: 'Yu-Gi-Oh', label: 'Yu-Gi-Oh', icon: 'prism' },
  { key: 'Other', label: 'Other', icon: 'layers' },
] as const

// Category → web card-detail route slug (dcmgrading.com/<slug>/<id>).
// Mirrors categoryToRouteSlug in the web app's src/lib/postGradeEmailTemplates.ts.
// The mobile app is a hard fork, so this deliberately duplicates that logic —
// keep the two in sync when routes change.
export function categoryToRouteSlug(category: string | null | undefined): string {
  if (!category) return 'other'
  const c = category.toLowerCase()
  if (c === 'pokemon') return 'pokemon'
  if (c === 'mtg' || c === 'magic') return 'mtg'
  if (c === 'lorcana') return 'lorcana'
  if (c === 'one piece' || c === 'onepiece') return 'onepiece'
  if (c === 'yu-gi-oh' || c === 'yugioh') return 'yugioh'
  if (c === 'star wars' || c === 'starwars') return 'starwars'
  // Sports sub-categories all route to /sports
  if (['sports', 'football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'racing', 'boxing', 'mma', 'tennis', 'golf'].includes(c)) return 'sports'
  return 'other'
}
