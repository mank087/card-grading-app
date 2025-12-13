/**
 * User Condition Report Types (v3 - Full Enhancement)
 *
 * Allows users to optionally report defects that may not be visible in photos.
 * Comprehensive defect-type checkboxes based on PSA/BGS/CGC grading standards.
 */

// ═══════════════════════════════════════════════════════════════════════
// DEFECT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Surface defects - issues on the card face (8 types)
 */
export interface SurfaceDefects {
  scratches: boolean;        // Scratches or scuffs on the surface
  print_lines: boolean;      // Print lines, roller marks, or ink streaks
  fingerprints: boolean;     // Fingerprints, smudges, or residue
  holo_scratches: boolean;   // Scratches specifically on holofoil area
  indentations: boolean;     // Dents, pressure marks, or indentations
  white_spots: boolean;      // White dots/specks from incomplete ink ("snowing")
  fish_eyes: boolean;        // Small circular print voids from dust on plate
  staining: boolean;         // Wax, gum, water, or ink stains
}

/**
 * Corner defects - issues at the four corners (4 types)
 */
export interface CornerDefects {
  whitening: boolean;        // White cardstock showing through at corners
  soft_rounded: boolean;     // Corners not sharp, rounded or soft
  dings: boolean;            // Small dents, nicks, or impact damage
  creasing: boolean;         // Corner creases or folds
}

/**
 * Edge defects - issues along the four edges (6 types)
 */
export interface EdgeDefects {
  whitening: boolean;        // White cardstock showing along edges
  chipping: boolean;         // Small chips or pieces missing from edge
  rough_cut: boolean;        // Uneven, jagged, or rough factory cut
  peeling: boolean;          // Edge separation or layer peeling
  silvering: boolean;        // Silver foil layer visible on holo card edges
  white_dots: boolean;       // Small white specks/dots along edges (factory dotting)
}

/**
 * Structural defects - issues affecting the whole card (4 types)
 */
export interface StructuralDefects {
  crease: boolean;           // Visible crease or fold line
  bend: boolean;             // Card is bent (but no crease line)
  warp: boolean;             // Card is warped or bowed
  water_damage: boolean;     // Water damage, staining, or moisture marks
}

/**
 * Factory defects - manufacturing/printing errors (3 types)
 */
export interface FactoryDefects {
  crimping: boolean;         // Crimp marks from pack sealing machine
  miscut: boolean;           // Card cut significantly off-center or at angle
  ink_error: boolean;        // Missing ink, extra ink, color bleeding
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT TYPES (from frontend)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Defects for one side of the card (front or back)
 */
export interface SideDefects {
  surface: SurfaceDefects;
  corners: CornerDefects;
  edges: EdgeDefects;
}

/**
 * Complete user condition report input from frontend
 */
export interface UserConditionReportInput {
  front: SideDefects;
  back: SideDefects;
  structural: StructuralDefects;  // Affects whole card
  factory: FactoryDefects;        // Factory/manufacturing defects
  notes: string;                   // Single consolidated notes field (500 chars max)
}

// ═══════════════════════════════════════════════════════════════════════
// TOOLTIP/HELP TEXT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export interface DefectTooltip {
  label: string;
  description: string;
  examples?: string;
}

export const SURFACE_TOOLTIPS: Record<keyof SurfaceDefects, DefectTooltip> = {
  scratches: {
    label: 'Scratches or scuffs',
    description: 'Lines or marks from physical contact that catch light or are visible on the surface.',
    examples: 'Hairline scratches, scuff marks, handling wear'
  },
  print_lines: {
    label: 'Print lines or roller marks',
    description: 'Factory printing defects that appear as lines running across the card surface.',
    examples: 'Horizontal lines, ink streaks, roller marks from printing press'
  },
  fingerprints: {
    label: 'Fingerprints or residue',
    description: 'Oils, smudges, or sticky residue left on the card surface.',
    examples: 'Fingerprint smudges, sticky residue, food/drink marks'
  },
  holo_scratches: {
    label: 'Holofoil scratches',
    description: 'Scratches specifically on the holographic or foil area that disrupt the pattern.',
    examples: 'Scratches on holo pattern, foil wear, rainbow scratch marks'
  },
  indentations: {
    label: 'Dents or pressure marks',
    description: 'Small depressions in the card surface from pressure or impact.',
    examples: 'Thumbnail indents, pressure marks, small dents'
  },
  white_spots: {
    label: 'White dots or specks',
    description: 'Small white spots on surface from incomplete ink coverage during printing ("snowing").',
    examples: 'White specks on dark areas, snow effect, ink voids'
  },
  fish_eyes: {
    label: 'Fish eyes (print voids)',
    description: 'Small circular voids in the print caused by dust or debris on the printing plate.',
    examples: 'Circular blank spots, small print bubbles, ink circles'
  },
  staining: {
    label: 'Staining or discoloration',
    description: 'Marks from foreign substances like wax, gum, water, or ink that discolor the surface.',
    examples: 'Wax stains, water marks, yellowing, ink blots'
  }
};

export const CORNER_TOOLTIPS: Record<keyof CornerDefects, DefectTooltip> = {
  whitening: {
    label: 'Corner whitening',
    description: 'White cardstock showing through at corners where the color layer has worn away.',
    examples: 'White dots at corner tips, fuzzy white corners, color worn off'
  },
  soft_rounded: {
    label: 'Soft or rounded corners',
    description: 'Corners that are not crisp and sharp, appearing rounded or blunted.',
    examples: 'Rounded corner tips, not sharp to touch, worn down corners'
  },
  dings: {
    label: 'Corner dings or nicks',
    description: 'Small impact damage, dents, or chips at the corner points.',
    examples: 'Small chips, impact marks, dinged corners from drops'
  },
  creasing: {
    label: 'Corner creases',
    description: 'Fold lines or creases specifically at or near the corners.',
    examples: 'Corner fold, bent corner tip, crease near corner'
  }
};

export const EDGE_TOOLTIPS: Record<keyof EdgeDefects, DefectTooltip> = {
  whitening: {
    label: 'Edge whitening',
    description: 'White cardstock showing along the edges where color has worn away.',
    examples: 'White line along edge, fuzzy white edges, color worn at borders'
  },
  chipping: {
    label: 'Edge chipping',
    description: 'Small pieces of the edge missing or chipped away.',
    examples: 'Small chips along edge, pieces missing, jagged spots'
  },
  rough_cut: {
    label: 'Rough or uneven cut',
    description: 'Factory cutting that left edges uneven, jagged, or rough.',
    examples: 'Jagged edge, uneven factory cut, rough to touch'
  },
  peeling: {
    label: 'Edge peeling or separation',
    description: 'Card layers separating at the edges, showing the inner cardstock.',
    examples: 'Layer separation, peeling at edges, delamination starting'
  },
  silvering: {
    label: 'Silvering (foil showing)',
    description: 'Silver foil layer visible on edges of holographic cards from wear or factory cutting.',
    examples: 'Shiny silver edges on holos, foil exposed at edges, twinkling edges'
  },
  white_dots: {
    label: 'Edge white dots',
    description: 'Small white specks or dots along the edges, often from factory cutting or handling.',
    examples: 'Pinpoint white dots, factory dotting, specks along edge'
  }
};

export const STRUCTURAL_TOOLTIPS: Record<keyof StructuralDefects, DefectTooltip> = {
  crease: {
    label: 'Crease or fold line',
    description: 'A visible line where the card has been folded or creased.',
    examples: 'Horizontal crease, diagonal fold line, visible crease mark'
  },
  bend: {
    label: 'Bend (no crease)',
    description: 'Card is bent but has no visible crease line - may spring back.',
    examples: 'Curved card, bent from storage, slight bow'
  },
  warp: {
    label: 'Warping',
    description: 'Card is bowed, curved, or warped from humidity or storage.',
    examples: 'Bowed card, humidity warp, curved from sleeve/toploader'
  },
  water_damage: {
    label: 'Water damage',
    description: 'Damage from moisture including staining, warping, or texture changes.',
    examples: 'Water stains, moisture marks, wavy texture from water'
  }
};

export const FACTORY_TOOLTIPS: Record<keyof FactoryDefects, DefectTooltip> = {
  crimping: {
    label: 'Crimping (pack seal marks)',
    description: 'Crimp marks on the card from the pack sealing machine during manufacturing.',
    examples: 'Seal line imprints, pack crimp marks, machine indentations'
  },
  miscut: {
    label: 'Miscut or off-center cut',
    description: 'Card was cut significantly off-center or at an angle during manufacturing.',
    examples: 'Visible border on one side only, angled cut, shifted print'
  },
  ink_error: {
    label: 'Ink/print error',
    description: 'Manufacturing defects with missing ink, extra ink, or color bleeding.',
    examples: 'Missing colors, ink blobs, color bleeding outside lines'
  }
};

// ═══════════════════════════════════════════════════════════════════════
// DEFAULT/EMPTY VALUES
// ═══════════════════════════════════════════════════════════════════════

export const EMPTY_SURFACE_DEFECTS: SurfaceDefects = {
  scratches: false,
  print_lines: false,
  fingerprints: false,
  holo_scratches: false,
  indentations: false,
  white_spots: false,
  fish_eyes: false,
  staining: false,
};

export const EMPTY_CORNER_DEFECTS: CornerDefects = {
  whitening: false,
  soft_rounded: false,
  dings: false,
  creasing: false,
};

export const EMPTY_EDGE_DEFECTS: EdgeDefects = {
  whitening: false,
  chipping: false,
  rough_cut: false,
  peeling: false,
  silvering: false,
  white_dots: false,
};

export const EMPTY_STRUCTURAL_DEFECTS: StructuralDefects = {
  crease: false,
  bend: false,
  warp: false,
  water_damage: false,
};

export const EMPTY_FACTORY_DEFECTS: FactoryDefects = {
  crimping: false,
  miscut: false,
  ink_error: false,
};

export const EMPTY_SIDE_DEFECTS: SideDefects = {
  surface: { ...EMPTY_SURFACE_DEFECTS },
  corners: { ...EMPTY_CORNER_DEFECTS },
  edges: { ...EMPTY_EDGE_DEFECTS },
};

export const EMPTY_CONDITION_REPORT: UserConditionReportInput = {
  front: { ...EMPTY_SIDE_DEFECTS },
  back: { ...EMPTY_SIDE_DEFECTS },
  structural: { ...EMPTY_STRUCTURAL_DEFECTS },
  factory: { ...EMPTY_FACTORY_DEFECTS },
  notes: '',
};

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if a condition report has any data
 */
export function hasAnyConditionData(report: UserConditionReportInput): boolean {
  // Check front defects
  const hasFrontSurface = Object.values(report.front.surface).some(v => v);
  const hasFrontCorners = Object.values(report.front.corners).some(v => v);
  const hasFrontEdges = Object.values(report.front.edges).some(v => v);

  // Check back defects
  const hasBackSurface = Object.values(report.back.surface).some(v => v);
  const hasBackCorners = Object.values(report.back.corners).some(v => v);
  const hasBackEdges = Object.values(report.back.edges).some(v => v);

  // Check structural
  const hasStructural = Object.values(report.structural).some(v => v);

  // Check factory
  const hasFactory = Object.values(report.factory).some(v => v);

  // Check notes
  const hasNotes = report.notes.trim().length > 0;

  return hasFrontSurface || hasFrontCorners || hasFrontEdges ||
         hasBackSurface || hasBackCorners || hasBackEdges ||
         hasStructural || hasFactory || hasNotes;
}

/**
 * Count total defects reported
 */
export function countDefects(report: UserConditionReportInput): number {
  let count = 0;

  count += Object.values(report.front.surface).filter(v => v).length;
  count += Object.values(report.front.corners).filter(v => v).length;
  count += Object.values(report.front.edges).filter(v => v).length;
  count += Object.values(report.back.surface).filter(v => v).length;
  count += Object.values(report.back.corners).filter(v => v).length;
  count += Object.values(report.back.edges).filter(v => v).length;
  count += Object.values(report.structural).filter(v => v).length;
  count += Object.values(report.factory).filter(v => v).length;

  return count;
}

// ═══════════════════════════════════════════════════════════════════════
// PROCESSED TYPES (after sanitization)
// ═══════════════════════════════════════════════════════════════════════

/**
 * A single parsed defect extracted from user notes
 */
export interface ParsedDefect {
  category: 'surface' | 'corners' | 'edges' | 'structural' | 'factory' | 'other';
  type: string;
  side: 'front' | 'back' | 'both';
  severity?: 'minor' | 'moderate' | 'heavy' | 'unknown';
  raw_text: string;
  confidence: number;
}

/**
 * Result of suspicious pattern detection
 */
export interface SuspiciousPatternResult {
  is_suspicious: boolean;
  patterns_found: string[];
  should_ignore_notes: boolean;
  warning_message?: string;
}

/**
 * Complete processed condition report ready for AI consumption
 */
export interface ProcessedConditionReport {
  front: SideDefects;
  back: SideDefects;
  structural: StructuralDefects;
  factory: FactoryDefects;
  notes_raw: string;
  notes_sanitized: string;
  notes_parsed: ParsedDefect[];

  has_any_reports: boolean;
  total_defects_reported: number;
  suspicious_input: SuspiciousPatternResult;

  processor_version: string;
  processed_at: string;
}

/**
 * Format for injecting into AI prompt
 */
export interface ConditionReportPromptSection {
  has_user_hints: boolean;
  front_section: string;
  back_section: string;
  structural_section: string;
  factory_section?: string;
  full_prompt_text: string;
}
