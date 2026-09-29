/**
 * ZOOM CORROBORATION + ATTRIBUTION (ZOOM_CORROBORATION_V1, default OFF)
 *
 * THE PROBLEM (hand review of 14 customer-disputed grades, Sept 29 2026). In about half
 * of the live cards the defect that set the grade came from the magnified (zoom) pass
 * while the whole-card evaluations of the same face said there was nothing there, and
 * the zoom was wrong: glare, a printed foil stripe, a marbled printed border, chrome
 * sheen. Other zoom findings were real but filed in the wrong place: edge roughness
 * counted against a corner, a surface scratch counted against the corner crop it
 * happened to sit in.
 *
 * WHAT THIS DOES WHEN ON (pure functions, no model calls):
 *  (b) attribution - applied inside runZoomInspection, before any cap is computed:
 *      - a finding's category is the crop's category (corner crop -> corners, edge strip
 *        -> edges, surface crop -> surface). Structural types keep their own path.
 *      - a surface-only mark (scratch, scuff, stain, print line...) seen in a corner or
 *        edge crop does not count against that corner or edge. The surface crops own
 *        surface marks, exactly as the surface cap already ignores border-wear types.
 *      - edge wear described in a corner crop ("a run along the left cut edge near the
 *        corner") is EDGE wear: it is re-filed to the adjoining edge it names (or, if it
 *        names none, the adjoining edge strip that also reports wear). It then counts
 *        once, against edges - the edge cap dedups by physical side. (First version
 *        dropped it outright, so when rule (a) later removed the edge strip's own
 *        finding the wear vanished from both categories; measured on the Score Adams.)
 *      - a finding whose text names a card location the crop cannot contain ("top-left
 *        corner" in the bottom-right corner crop) is dropped.
 *  (a) corroboration - applied in the grader, where the whole-card evaluations exist:
 *      a zoom-only MODERATE or HEAVY finding lowers a face only when a whole-card
 *      evaluation also noted a defect (or scored below 10) for that face and category, OR
 *      a clear majority of the zoom samples that inspected the region reported it.
 *      MINOR findings are exempt: they already need 3 of 5 votes, cap no lower than 9,
 *      and are what correctly holds a clean-looking chrome card at 9 (measured Sept 29:
 *      gating them let a true-9 Topps Chrome Adams reach 10 in 2 of 4 runs).
 *
 * Every dropped finding is returned with its reason; nothing is silently discarded.
 */

export function zoomCorroborationEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.ZOOM_CORROBORATION_V1 || '').trim().toLowerCase();
  return v === 'on' || v === '1' || v === 'true';
}

/**
 * Share of the samples that inspected a region which must report a zoom-only finding
 * for it to stand without a whole-card evaluation agreeing. The zoom already needs 2 of
 * 5 (moderate/heavy) or 3 of 5 (minor) votes to report anything; 4 of 5 is the "clear
 * majority" bar. Judgement call, tunable: ZOOM_CORROBORATION_MAJORITY=0.6 means 3 of 5.
 */
export const DEFAULT_MAJORITY_SHARE = 0.8;
export function majorityShare(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.ZOOM_CORROBORATION_MAJORITY);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_MAJORITY_SHARE;
}

export interface CorroborationDefect {
  region: string;
  face: 'front' | 'back';
  category: 'corners' | 'edges' | 'surface' | 'structural';
  type: string;
  severity: string;
  description: string;
  /** Samples that reported this (region, type). Present only when the flag is on. */
  votes?: number;
  /** Samples that returned a verdict for the region. */
  samples?: number;
}

export interface DroppedFinding {
  region: string;
  face: string;
  category: string;
  type: string;
  severity: string;
  votes?: number;
  samples?: number;
  reason: string;
}

// ── crop geometry ────────────────────────────────────────────────────────────

type Kind = 'corner' | 'edge' | 'surface';
type V = 'top' | 'bottom';
type H = 'left' | 'right';

export function cropKind(region: string): Kind | null {
  if (/-COR-/.test(region)) return 'corner';
  if (/-EDG-/.test(region)) return 'edge';
  if (/-SUR-/.test(region)) return 'surface';
  return null;
}

const KIND_CATEGORY: Record<Kind, 'corners' | 'edges' | 'surface'> = { corner: 'corners', edge: 'edges', surface: 'surface' };

/** Card corners ("top-left") and sides ("left") a crop can physically contain. */
function cropReach(region: string): { corners: Set<string>; sides: Set<string> } | null {
  const id = region.replace(/^[FB]-/, '').replace(/-\d+$/, '');
  const corner = (v: V, h: H) => ({ corners: new Set([`${v}-${h}`]), sides: new Set<string>([v, h]) });
  const edge = (side: string) => {
    const corners = side === 'top' || side === 'bottom' ? [`${side}-left`, `${side}-right`] : [`top-${side}`, `bottom-${side}`];
    // An edge strip runs the full side, so its ends reach the two adjacent sides too.
    const sides = side === 'top' || side === 'bottom' ? [side, 'left', 'right'] : [side, 'top', 'bottom'];
    return { corners: new Set(corners), sides: new Set(sides) };
  };
  switch (id) {
    case 'COR-TL': return corner('top', 'left');
    case 'COR-TR': return corner('top', 'right');
    case 'COR-BL': return corner('bottom', 'left');
    case 'COR-BR': return corner('bottom', 'right');
    case 'EDG-T': return edge('top');
    case 'EDG-B': return edge('bottom');
    case 'EDG-L': return edge('left');
    case 'EDG-R': return edge('right');
    case 'SUR-Q1': return corner('top', 'left');
    case 'SUR-Q2': return corner('top', 'right');
    case 'SUR-Q3': return corner('bottom', 'left');
    case 'SUR-Q4': return corner('bottom', 'right');
    default: return null; // centre bands reach everything
  }
}

const V_WORD = '(top|upper|bottom|lower)';
const H_WORD = '(left|right)';
const normV = (w: string): V => (w === 'upper' || w === 'top' ? 'top' : 'bottom');

/**
 * Card-level locations named in a finding: "<v>-<h> corner" and "<side> edge/border".
 * Positions inside the crop ("near the centre-left", "lower-right area") are NOT card
 * locations - the zoom prompt asks for the location within the region - so they are
 * never treated as a contradiction.
 */
export function namedCardLocations(description: string): { corners: string[]; sides: string[] } {
  const text = String(description || '').toLowerCase();
  const corners: string[] = [];
  const sides: string[] = [];
  for (const m of text.matchAll(new RegExp(`\\b${V_WORD}[\\s-]*${H_WORD}\\s+corner`, 'g'))) corners.push(`${normV(m[1])}-${m[2]}`);
  for (const m of text.matchAll(new RegExp(`\\b${H_WORD}[\\s-]*${V_WORD}\\s+corner`, 'g'))) corners.push(`${normV(m[2])}-${m[1]}`);
  for (const m of text.matchAll(/\b(top|upper|bottom|lower|left|right)\s+(?:cut\s+|outer\s+|card\s+|dark\s+|white\s+|light\s+)?(?:edge|border)\b/g)) {
    const w = m[1];
    sides.push(w === 'upper' ? 'top' : w === 'lower' ? 'bottom' : w);
  }
  return { corners, sides };
}

/** Why a finding's text cannot belong to its crop, or null when it can. */
export function locationContradiction(region: string, description: string): string | null {
  const reach = cropReach(region);
  if (!reach) return null;
  const named = namedCardLocations(description);
  const badCorner = named.corners.find(c => !reach.corners.has(c));
  if (badCorner) return `text names the ${badCorner} corner, which this crop does not contain`;
  const badSide = named.sides.find(s => !reach.sides.has(s));
  if (badSide) return `text names the ${badSide} edge, which this crop does not contain`;
  return null;
}

const STRUCTURAL = new Set(['crease', 'bend', 'fold', 'warp', 'tear']);
/** Marks that live on the printed face, not on a cut corner or edge. */
const SURFACE_ONLY = /^(scratch|scuff|stain|print_?line|speck|spot|discolou?ration|toning|fingerprint|residue|smudge|print_?defect|ink)/i;
/** Wording that describes a run along an edge rather than the corner tip itself. */
const EDGE_RUN = /\b(along|runs?|running|continues?)\b[^.]*\b(edge|border)\b/i;
const CORNER_TIP = /\b(tip|point|apex)\b/i;

function adjoiningEdges(region: string): string[] {
  const m = region.match(/^([FB])-COR-(T|B)(L|R)$/);
  if (!m) return [];
  return [`${m[1]}-EDG-${m[2]}`, `${m[1]}-EDG-${m[3]}`];
}

/**
 * (b) Attribution. Returns the findings that keep counting (category forced from the
 * crop) and the ones dropped, each with a reason.
 */
export interface RefiledFinding { from: string; to: string; type: string; severity: string; reason: string }

export function attributeZoomDefects<T extends CorroborationDefect>(defects: T[]): { kept: T[]; dropped: DroppedFinding[]; refiled: RefiledFinding[] } {
  const kept: T[] = [];
  const dropped: DroppedFinding[] = [];
  const refiled: RefiledFinding[] = [];
  const drop = (d: T, reason: string) => dropped.push({ region: d.region, face: d.face, category: d.category, type: d.type,
    severity: d.severity, votes: d.votes, samples: d.samples, reason });
  const physicalEdge = (region: string) => region.replace(/^([FB]-EDG-[TBLR])-\d+$/, '$1');
  const edgeRegionsWithWear = new Set(
    defects.filter(d => cropKind(d.region) === 'edge' && !STRUCTURAL.has(d.type.toLowerCase()) && !SURFACE_ONLY.test(d.type))
      .map(d => physicalEdge(d.region)),
  );
  for (const d of defects) {
    const type = d.type.toLowerCase();
    if (STRUCTURAL.has(type) || d.category === 'structural') { kept.push(d); continue; }
    const kind = cropKind(d.region);
    if (!kind) { kept.push(d); continue; }
    const forced = { ...d, category: KIND_CATEGORY[kind] } as T;
    if (kind !== 'surface' && SURFACE_ONLY.test(type)) {
      drop(forced, `surface mark (${type}) seen in a ${kind} crop - surface marks are judged from the surface crops`);
      continue;
    }
    const contradiction = locationContradiction(d.region, d.description);
    if (contradiction) { drop(forced, contradiction); continue; }
    if (kind === 'corner' && EDGE_RUN.test(d.description) && !CORNER_TIP.test(d.description)) {
      const adjoining = adjoiningEdges(d.region);
      const named = namedCardLocations(d.description).sides
        .map(side => adjoining.find(e => e.endsWith(`-${side[0].toUpperCase()}`)))
        .find((e): e is string => !!e);
      const target = named ?? adjoining.find(e => edgeRegionsWithWear.has(e));
      if (target) {
        const reason = `edge wear described in a corner crop is filed under the ${target.slice(-1) === 'T' ? 'top' : target.slice(-1) === 'B' ? 'bottom' : target.slice(-1) === 'L' ? 'left' : 'right'} edge`;
        refiled.push({ from: d.region, to: target, type: d.type, severity: d.severity, reason });
        kept.push({ ...forced, region: target, category: 'edges' } as T);
        continue;
      }
    }
    kept.push(forced);
  }
  return { kept, dropped, refiled };
}

// ── (a) whole-card corroboration ─────────────────────────────────────────────

function sectionNotesDefect(node: any, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 4) return false;
  if (Array.isArray(node.defects) && node.defects.some((d: any) =>
    (typeof d === 'string' && d.trim()) ||
    (d && typeof d === 'object' && String(d.severity || '').toLowerCase() !== 'none' && d.source !== 'zoom-inspection'))) return true;
  return Object.entries(node).some(([k, v]) => k !== 'defects' && sectionNotesDefect(v, depth + 1));
}

/**
 * For each `${category}_${face}`: did ANY whole-card evaluation note a defect there or
 * score it below 10? Read from the raw completions, before any zoom merge.
 */
export function wholeCardEvidence(completions: any[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const cat of ['corners', 'edges', 'surface'] as const) {
    for (const face of ['front', 'back'] as const) {
      out[`${cat}_${face}`] = completions.some(j => {
        const s = j?.raw_sub_scores?.[`${cat}_${face}`];
        if (typeof s === 'number' && s < 10) return true;
        const fs = j?.[cat]?.[face]?.score;
        if (typeof fs === 'number' && fs < 10) return true;
        return sectionNotesDefect(j?.[cat]?.[face]);
      });
    }
  }
  return out;
}

export function corroborateZoomDefects<T extends CorroborationDefect>(
  defects: T[],
  evidence: Record<string, boolean>,
  share: number = DEFAULT_MAJORITY_SHARE,
): { kept: T[]; dropped: DroppedFinding[] } {
  const kept: T[] = [];
  const dropped: DroppedFinding[] = [];
  for (const d of defects) {
    if (d.category === 'structural') { kept.push(d); continue; } // structural has its own corroboration gate
    if (String(d.severity).toLowerCase() === 'minor') { kept.push(d); continue; } // minor: exempt, caps at 9 at most
    if (evidence[`${d.category}_${d.face}`]) { kept.push(d); continue; }
    const votes = d.votes ?? 0;
    const samples = d.samples ?? 0;
    if (samples > 0 && votes / samples >= share) { kept.push(d); continue; }
    dropped.push({ region: d.region, face: d.face, category: d.category, type: d.type, severity: d.severity, votes: d.votes, samples: d.samples,
      reason: `magnified-only: no whole-card evaluation noted a ${d.category} defect on the ${d.face}, and ${votes} of ${samples} zoom samples is below the ${Math.round(share * 100)}% majority` });
  }
  return { kept, dropped };
}

// ── (c) prompt addendum ─────────────────────────────────────────────────────

/** Appended to the zoom system prompt ONLY when the flag is on. */
export const ZOOM_DESIGN_ARTIFACT_EXCLUSIONS = `
PRINTED DESIGN AND PHOTO ARTIFACTS ARE NOT DEFECTS (do NOT report any of these):
- printed FOIL stripes, foil borders, foil name bars and foil logos (e.g. a silver or gold stripe along a dark border). Their bright, broken, speckled look at crop resolution is ink and foil, not whitening, chips or flecks of exposed cardstock.
- MARBLED, ANTIQUED, "AGED", stone, parchment, sepia, speckled or mottled PRINTED textures and borders, and the natural mottling or print speckle of vintage cardstock. A pattern that repeats across the design, or matches the printing on the rest of the card, is printed - it is not staining, toning or spotting.
- CHROME, REFRACTOR, PRIZM, LASER and other mirror-like finishes: their sheen, rainbow bands, bright streaks and soft dark swirls are reflections, not scratches or scuffs.
- GLOSSY-EDGE REFLECTIONS: a thin bright line of light along a glossy cut edge or corner is a reflection of the light source, not whitening or softening. Whitening is exposed fibrous cardstock with texture; a reflection is smooth, even, and follows the light.
When a crop could be either design/photo artifact or damage and you cannot tell, do not report it.`;
