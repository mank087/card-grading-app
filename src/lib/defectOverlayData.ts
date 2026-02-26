/**
 * Defect Overlay Data Extraction Utility
 *
 * Parses raw conversational_grading JSON and produces normalized
 * defect arrays with x/y coordinates for overlay rendering.
 */

export interface OverlayDefect {
  id: number;
  type: string;
  severity: 'minor' | 'moderate' | 'heavy';
  description: string;
  source: 'corner' | 'edge' | 'surface';
  structural_key: string;
  side: 'front' | 'back';
  x_percent: number;
  y_percent: number;
  confidence: 'high' | 'medium' | 'low' | 'inferred';
}

// Deterministic corner positions (percentage from top-left)
const CORNER_POSITIONS: Record<string, { x: number; y: number }> = {
  top_left: { x: 8, y: 8 },
  top_right: { x: 92, y: 8 },
  bottom_left: { x: 8, y: 92 },
  bottom_right: { x: 92, y: 92 },
};

// Deterministic edge positions
const EDGE_POSITIONS: Record<string, { x: number; y: number }> = {
  top: { x: 50, y: 3 },
  bottom: { x: 50, y: 97 },
  left: { x: 3, y: 50 },
  right: { x: 97, y: 50 },
};

// Location text to approximate position mapping for surface defects
const LOCATION_KEYWORDS: { pattern: RegExp; x: number; y: number }[] = [
  { pattern: /upper[\s-]?left|top[\s-]?left/i, x: 25, y: 25 },
  { pattern: /upper[\s-]?right|top[\s-]?right/i, x: 75, y: 25 },
  { pattern: /lower[\s-]?left|bottom[\s-]?left/i, x: 25, y: 75 },
  { pattern: /lower[\s-]?right|bottom[\s-]?right/i, x: 75, y: 75 },
  { pattern: /upper[\s-]?center|top[\s-]?center/i, x: 50, y: 25 },
  { pattern: /lower[\s-]?center|bottom[\s-]?center/i, x: 50, y: 75 },
  { pattern: /center[\s-]?left|left[\s-]?center|middle[\s-]?left/i, x: 25, y: 50 },
  { pattern: /center[\s-]?right|right[\s-]?center|middle[\s-]?right/i, x: 75, y: 50 },
  { pattern: /\bcenter\b|\bcentral\b|\bmiddle\b/i, x: 50, y: 50 },
  { pattern: /\bupper\b|\btop\b/i, x: 50, y: 25 },
  { pattern: /\blower\b|\bbottom\b/i, x: 50, y: 75 },
  { pattern: /\bleft\b/i, x: 25, y: 50 },
  { pattern: /\bright\b/i, x: 75, y: 50 },
];

function parseLocationText(location: string): { x: number; y: number; confidence: 'medium' | 'low' } {
  for (const entry of LOCATION_KEYWORDS) {
    if (entry.pattern.test(location)) {
      return { x: entry.x, y: entry.y, confidence: 'medium' };
    }
  }
  return { x: 50, y: 50, confidence: 'low' };
}

const SEVERITY_ORDER: Record<string, number> = { heavy: 0, moderate: 1, minor: 2 };

function isValidSeverity(s: string): s is 'minor' | 'moderate' | 'heavy' {
  return s === 'minor' || s === 'moderate' || s === 'heavy';
}

export function extractOverlayDefects(
  rawGradingJson: string | null,
  side: 'front' | 'back'
): OverlayDefect[] {
  if (!rawGradingJson) return [];

  let jsonData: any;
  try {
    jsonData = typeof rawGradingJson === 'string' ? JSON.parse(rawGradingJson) : rawGradingJson;
  } catch {
    return [];
  }

  const defects: Omit<OverlayDefect, 'id'>[] = [];

  // Extract corner defects
  const corners = jsonData.corners?.[side];
  if (corners) {
    for (const [key, cornerData] of Object.entries(corners)) {
      if (!CORNER_POSITIONS[key]) continue;
      const corner = cornerData as any;
      const cornerDefects = corner?.defects;
      if (!Array.isArray(cornerDefects)) continue;

      for (const d of cornerDefects) {
        const severity = d.severity?.toLowerCase();
        if (!severity || severity === 'none' || !isValidSeverity(severity)) continue;

        const pos = CORNER_POSITIONS[key];
        defects.push({
          type: d.type || 'unknown',
          severity,
          description: d.description || '',
          source: 'corner',
          structural_key: key,
          side,
          x_percent: d.coordinates?.x_percent ?? pos.x,
          y_percent: d.coordinates?.y_percent ?? pos.y,
          confidence: d.coordinates?.x_percent != null ? (d.coordinates.confidence || 'high') : 'inferred',
        });
      }
    }
  }

  // Extract edge defects
  const edges = jsonData.edges?.[side];
  if (edges) {
    for (const [key, edgeData] of Object.entries(edges)) {
      if (!EDGE_POSITIONS[key]) continue;
      const edge = edgeData as any;
      const edgeDefects = edge?.defects;
      if (!Array.isArray(edgeDefects)) continue;

      for (const d of edgeDefects) {
        const severity = d.severity?.toLowerCase();
        if (!severity || severity === 'none' || !isValidSeverity(severity)) continue;

        const pos = EDGE_POSITIONS[key];
        defects.push({
          type: d.type || 'unknown',
          severity,
          description: d.description || '',
          source: 'edge',
          structural_key: key,
          side,
          x_percent: d.coordinates?.x_percent ?? pos.x,
          y_percent: d.coordinates?.y_percent ?? pos.y,
          confidence: d.coordinates?.x_percent != null ? (d.coordinates.confidence || 'high') : 'inferred',
        });
      }
    }
  }

  // Extract surface defects
  const surface = jsonData.surface?.[side];
  if (surface) {
    const surfaceDefects = surface.defects;
    if (Array.isArray(surfaceDefects)) {
      for (const d of surfaceDefects) {
        const severity = d.severity?.toLowerCase();
        if (!severity || severity === 'none' || !isValidSeverity(severity)) continue;

        let x: number;
        let y: number;
        let confidence: OverlayDefect['confidence'];

        if (d.coordinates?.x_percent != null && d.coordinates?.y_percent != null) {
          x = d.coordinates.x_percent;
          y = d.coordinates.y_percent;
          confidence = d.coordinates.confidence || 'high';
        } else if (d.location) {
          const parsed = parseLocationText(d.location);
          x = parsed.x;
          y = parsed.y;
          confidence = parsed.confidence;
        } else {
          x = 50;
          y = 50;
          confidence = 'low';
        }

        defects.push({
          type: d.type || 'unknown',
          severity,
          description: d.description || '',
          source: 'surface',
          structural_key: 'surface',
          side,
          x_percent: x,
          y_percent: y,
          confidence,
        });
      }
    }
  }

  // Sort by severity (heavy first) then assign sequential IDs
  defects.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));

  return defects.map((d, i) => ({ ...d, id: i + 1 }));
}
