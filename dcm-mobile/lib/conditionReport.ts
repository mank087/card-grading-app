// Condition Report Types & Data — matches web's UserConditionReport

export interface SideDefectReport {
  surface: {
    scratches: boolean; print_lines: boolean; fingerprints: boolean; holo_scratches: boolean
    dents: boolean; white_dots: boolean; fish_eyes: boolean; staining: boolean
  }
  corners: {
    whitening: boolean; soft_rounded: boolean; dings: boolean; creases: boolean
  }
  edges: {
    whitening: boolean; chipping: boolean; rough_cut: boolean; peeling: boolean
    silvering: boolean; white_dots: boolean
  }
}

export interface ConditionReportData {
  front: SideDefectReport
  back: SideDefectReport
  structural: {
    crease: boolean; bend: boolean; warping: boolean; water_damage: boolean
  }
  factory: {
    crimping: boolean; miscut: boolean; ink_error: boolean
  }
  notes: string
}

export const EMPTY_REPORT: ConditionReportData = {
  front: {
    surface: { scratches: false, print_lines: false, fingerprints: false, holo_scratches: false, dents: false, white_dots: false, fish_eyes: false, staining: false },
    corners: { whitening: false, soft_rounded: false, dings: false, creases: false },
    edges: { whitening: false, chipping: false, rough_cut: false, peeling: false, silvering: false, white_dots: false },
  },
  back: {
    surface: { scratches: false, print_lines: false, fingerprints: false, holo_scratches: false, dents: false, white_dots: false, fish_eyes: false, staining: false },
    corners: { whitening: false, soft_rounded: false, dings: false, creases: false },
    edges: { whitening: false, chipping: false, rough_cut: false, peeling: false, silvering: false, white_dots: false },
  },
  structural: { crease: false, bend: false, warping: false, water_damage: false },
  factory: { crimping: false, miscut: false, ink_error: false },
  notes: '',
}

export const SURFACE_LABELS: Record<string, string> = {
  scratches: 'Scratches or scuffs',
  print_lines: 'Print lines or roller marks',
  fingerprints: 'Fingerprints or residue',
  holo_scratches: 'Holofoil scratches',
  dents: 'Dents or pressure marks',
  white_dots: 'White dots or specks',
  fish_eyes: 'Fish eyes (print voids)',
  staining: 'Staining or discoloration',
}

export const CORNER_LABELS: Record<string, string> = {
  whitening: 'Corner whitening',
  soft_rounded: 'Soft or rounded corners',
  dings: 'Corner dings or nicks',
  creases: 'Corner creases',
}

export const EDGE_LABELS: Record<string, string> = {
  whitening: 'Edge whitening',
  chipping: 'Edge chipping',
  rough_cut: 'Rough or uneven cut',
  peeling: 'Edge peeling or separation',
  silvering: 'Silvering (foil showing)',
  white_dots: 'Edge white dots',
}

export const STRUCTURAL_LABELS: Record<string, string> = {
  crease: 'Crease or fold line',
  bend: 'Bend (no crease)',
  warping: 'Warping',
  water_damage: 'Water damage',
}

export const FACTORY_LABELS: Record<string, string> = {
  crimping: 'Crimping (pack seal marks)',
  miscut: 'Miscut or off-center cut',
  ink_error: 'Ink/print error',
}

export function countDefects(report: ConditionReportData): number {
  let count = 0
  const check = (obj: Record<string, boolean>) => { for (const v of Object.values(obj)) if (v) count++ }
  check(report.front.surface); check(report.front.corners); check(report.front.edges)
  check(report.back.surface); check(report.back.corners); check(report.back.edges)
  check(report.structural); check(report.factory)
  return count
}
