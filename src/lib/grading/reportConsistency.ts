/**
 * REPORT CONSISTENCY (Oct 2026) - deterministic text/placement repairs after consensus.
 *
 * WHY. Of 34 disputed reports reviewed in October, 4 contradicted themselves:
 *  - Goff (726955): a rough cut on the front LEFT EDGE, seen in the top-left corner
 *    crop, was charged to corners and written up as "corner whitening, front top-left",
 *    while the same report's top-left corner text said "sharp, no fiber exposure" and
 *    edges scored 10.
 *  - Evans (869487): the same left-edge run filed three times (corners, edges, surface).
 *  - Adams (791681): a surface scratch seen in a corner crop was filed under corners.
 *  - Brady (885655): centering text said 52/48; it measured about 60/40 by hand.
 *
 * WHAT THIS DOES. Runs on the grading JSON after every score is final and before the
 * narrator builds the summary. It NEVER changes a score.
 *  (i)   Misfiled magnified (zoom) findings: a finding's type and description decide
 *        the category it belongs to (rough cut / edge run -> edges; rounding,
 *        softening -> corners; scratch, scuff, stain, print -> surface). When the
 *        finding is filed elsewhere:
 *          - if moving it would not change any face score (the target face is already
 *            at or below what the finding implies, and the source face's score does
 *            not rest on it) it is MOVED (or dropped as a duplicate of the same
 *            finding already filed there);
 *          - otherwise it stays where it is, because the score was computed from it,
 *            but its location text is corrected ("front left edge, next to the
 *            top-left corner") everywhere the report quotes it, and the case is
 *            logged in would_change_grade for the owner.
 *  (ii)  Per-position prose (front corners and edges; surface condition on both faces)
 *        that claims a position is clean while a finding is recorded there gets the
 *        clean claim replaced by the finding. Back positions are left alone: the model
 *        names them card-relative (mirrored) and the zoom crops are photo-relative, so
 *        the mapping is ambiguous.
 *  (iii) Centering ratios quoted in the centering text must equal the stored
 *        left_right / top_bottom the score was computed from; a mismatched ratio in
 *        the text is rewritten from the numbers. (This cannot catch Brady: there every
 *        reading, and the stored ratio, said 52/48. That is a measurement miss.)
 *
 * Every repair is recorded in jsonData.report_consistency and returned.
 * Env REPORT_CONSISTENCY_V1: default ON; 'off' | '0' | 'false' disables.
 */

import { namedCardLocations } from './zoomCorroboration';

export const REPORT_CONSISTENCY_VERSION = 'rc-1';

export function reportConsistencyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.REPORT_CONSISTENCY_V1 || '').trim().toLowerCase();
  return !(v === 'off' || v === '0' || v === 'false');
}

type Cat = 'corners' | 'edges' | 'surface';
type Face = 'front' | 'back';
type Side = 'top' | 'bottom' | 'left' | 'right';
type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ConsistencyRepair {
  rule: 'refile' | 'dedupe' | 'relabel' | 'position_prose' | 'surface_prose' | 'centering_text';
  path: string;
  before?: string;
  after?: string;
  note: string;
}

export interface WouldChangeGrade {
  face: Face;
  type: string;
  severity: string;
  filed_under: Cat;
  belongs_to: Cat;
  location: string;
  reason: string;
}

export interface ConsistencyResult {
  repairs: ConsistencyRepair[];
  would_change_grade: WouldChangeGrade[];
}

/** Same ladder as zoomInspection SEVERITY_CAP: the face score a finding implies. */
const SEVERITY_CAP: Record<string, number> = { minor: 9, moderate: 8, heavy: 6 };
const capOf = (severity: unknown) => SEVERITY_CAP[String(severity || '').toLowerCase()] ?? 9;

const SURFACE_ONLY = /^(scratch|scuff|stain|print[_ ]?line|speck|spot|discolou?ration|toning|fingerprint|residue|smudge|print[_ ]?defect|ink|dent|indentation|gloss)/i;
const EDGE_ONLY = /^(rough[_ ]?cut|roughness|rough[_ ]?edge|fray|fraying|edge[_ ]?wear|chipping|nick|delamination)/i;
const CORNER_ONLY = /^(rounding|rounded|softening|blunt|ding|corner[_ ]?wear|bent[_ ]?corner)/i;
/** Types the surface cap already ignores (computeZoomFaceCaps BORDER_WEAR_TYPES). */
const BORDER_WEAR = new Set(['whitening', 'softening', 'chip', 'nick', 'fray', 'fraying']);
/** A run along an edge rather than the corner tip itself (zoomCorroboration EDGE_RUN). */
const EDGE_RUN = /\b(along|runs?|running|continues?)\b[^.]*\b(edge|border)\b/i;
const CORNER_TIP = /\b(tip|point|apex)\b/i;

const CORNER_KEYS: Record<CornerName, string> = {
  'top-left': 'top_left', 'top-right': 'top_right', 'bottom-left': 'bottom_left', 'bottom-right': 'bottom_right',
};

interface Placement {
  corner?: CornerName;
  side?: Side;
  quadrant?: CornerName;
}

/** Where a recorded finding sits, from its humanized location ("front top-left corner"). */
function placementOf(location: string): Placement {
  const text = String(location || '').toLowerCase();
  const corner = /\b(top|upper|bottom|lower)[\s-]*(left|right)\s+corner\b/.exec(text);
  if (corner && !/\bnext to\b|\bnear\b/.test(text.slice(0, corner.index))) {
    return { corner: `${/top|upper/.test(corner[1]) ? 'top' : 'bottom'}-${corner[2]}` as CornerName };
  }
  const side = /\b(top|bottom|left|right)\s+edge\b/.exec(text);
  if (side) return { side: side[1] as Side, ...(corner ? { corner: `${/top|upper/.test(corner[1]) ? 'top' : 'bottom'}-${corner[2]}` as CornerName } : {}) };
  const quad = /\b(upper|lower)-(left|right)\s+area\b/.exec(text);
  if (quad) return { quadrant: `${quad[1] === 'upper' ? 'top' : 'bottom'}-${quad[2]}` as CornerName };
  return {};
}

function stripFace(location: string): string {
  return String(location || '').replace(/^\s*(front|back)\s+/i, '').trim();
}

/** Which category a finding belongs to, from its type and description. null = cannot tell. */
export function belongsTo(type: string, description: string, filed: Cat): Cat | null {
  const t = String(type || '').toLowerCase().trim();
  const desc = String(description || '');
  if (SURFACE_ONLY.test(t)) return 'surface';
  if (EDGE_ONLY.test(t)) return 'edges';
  if (CORNER_ONLY.test(t)) return filed === 'surface' ? null : 'corners';
  // Border wear (whitening, chip, fiber exposure, wear): the description decides.
  const edgeRun = EDGE_RUN.test(desc) && !CORNER_TIP.test(desc);
  const named = namedCardLocations(desc);
  if (filed === 'corners') return edgeRun ? 'edges' : null;
  if (filed === 'surface') {
    if (/\b(edge|border)\b/i.test(desc) && (edgeRun || named.sides.length)) return 'edges';
    if (named.corners.length || /\bcorner\b/i.test(desc)) return 'corners';
    return null;
  }
  // filed === 'edges': a finding that names a corner and is not an edge run.
  if (!edgeRun && named.corners.length && CORNER_TIP.test(desc)) return 'corners';
  return null;
}

function rel(face: Face, text: string) { return `${face} ${text}`; }

/** Accurate location text for a finding being described under another category. */
function relocate(face: Face, from: Placement, target: Cat, description: string): string | null {
  const named = namedCardLocations(description);
  if (target === 'edges') {
    const side = (named.sides[0] as Side | undefined)
      ?? (from.quadrant ? undefined : from.side);
    if (from.corner) return side ? rel(face, `${side} edge, next to the ${from.corner} corner`) : rel(face, `edge next to the ${from.corner} corner`);
    if (side) return rel(face, `${side} edge`);
    return null;
  }
  if (target === 'surface') {
    if (from.corner) return rel(face, `surface near the ${from.corner} corner`);
    if (from.side) return rel(face, `surface near the ${from.side} edge`);
    return null;
  }
  // corners
  const corner = (named.corners[0] as CornerName | undefined) ?? from.corner;
  return corner ? rel(face, `${corner} corner`) : null;
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Rewrite "<type> ... (<old loc>)" to the new location inside one string. */
function relabelText(text: string, type: string, oldLoc: string, newLoc: string): string {
  const typeRx = esc(String(type).replace(/_/g, ' ')).replace(/\\ /g, '[ _]');
  return text.replace(new RegExp(`(${typeRx}[^()]{0,60})\\(${esc(oldLoc)}\\)`, 'gi'), `$1(${newLoc})`);
}

const SEV_WORD: Record<string, string> = { minor: 'faint ', moderate: 'moderate ', heavy: 'heavy ' };
function findingSentence(d: any, where: string): string {
  const type = String(d.type || 'wear').replace(/_/g, ' ');
  const sev = SEV_WORD[String(d.severity || '').toLowerCase()] ?? '';
  // ASCII only: the mini-report renderer strips non-ASCII (model text uses arrows).
  const text = typeof d.description === 'string'
    ? d.description.trim().replace(/\s*[\u2192\u2014\u2013]\s*/g, ', ').replace(/[^\x20-\x7E]/g, '').replace(/\.$/, '').slice(0, 180)
    : '';
  const desc = text ? `: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : '';
  const tail = String(d.severity).toLowerCase() === 'minor' ? ', visible only under magnification' : '';
  return `Magnified inspection found ${sev}${type} ${where}${tail}${desc}.`;
}

/** A sentence that already admits wear ("mildly softened", "appears slightly uneven") is not a clean claim. */
const ADMITS_WEAR = /\b(?:slight(?:ly)?|mild(?:ly)?|minor|light)\s+(?:\w+\s+)?(?:wear|whiten\w*|soft\w*|round\w*|uneven|rough\w*|fray\w*|chip\w*)|\b(?:is|are|appears?|shows?|looks?)\s+(?:slightly\s+|mildly\s+)?(?:soft\w*|rounded|uneven|worn|rough)\b/i;

/** Sentences that say a corner/edge/surface is clean. */
const CLEAN_CLAIM = /\b(no|without|free of)\b[^.]{0,80}\b(whiten\w*|fib(?:er|re)s?|wear|rounding|chip\w*|fuzz\w*|rough\w*|defects?|damage|material loss|flecks?|exposure|softening|scratch\w*|scuffs?|stains?|lift|compression|breaks?)\b|\b(sharp(?:ly)?|crisp|clean(?:ly)?|intact|undamaged|pristine|pointed|well defined|unbroken|smooth)\b/i;

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
}

/** Replace the clean-claim sentences of `text` with `finding`. null when nothing to change. */
function reconcileClean(text: string, finding: string): string | null {
  if (typeof text !== 'string' || !text.trim()) return finding;
  if (text.includes('Magnified inspection found')) return null; // already reconciled
  const sentences = splitSentences(text);
  const kept = sentences.filter(s => !CLEAN_CLAIM.test(s) || ADMITS_WEAR.test(s));
  if (kept.length === sentences.length) return null;
  return [...kept, finding].join(' ');
}

function ratioParts(r: unknown): [number, number] | null {
  const m = typeof r === 'string' ? /^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/.exec(r) : null;
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  return a + b >= 90 && a + b <= 110 ? [a, b] : null;
}

const LR_WORD = /left[\s/-]*(?:to[\s-]*)?right|\bL\/R\b|horizontal/gi;
const TB_WORD = /top[\s/-]*(?:to[\s-]*)?bottom|\bT\/B\b|vertical/gi;

/** Rewrite ratios in centering text whose axis is clear and whose value disagrees with the stored ratio. */
export function reconcileCenteringText(text: string, stored: { left_right?: unknown; top_bottom?: unknown }): string {
  if (typeof text !== 'string') return text;
  const lr = ratioParts(stored.left_right), tb = ratioParts(stored.top_bottom);
  if (!lr && !tb) return text;
  const axisWords: Array<{ at: number; end: number; axis: 'lr' | 'tb' }> = [];
  for (const m of text.matchAll(LR_WORD)) axisWords.push({ at: m.index!, end: m.index! + m[0].length, axis: 'lr' });
  for (const m of text.matchAll(TB_WORD)) axisWords.push({ at: m.index!, end: m.index! + m[0].length, axis: 'tb' });
  if (!axisWords.length) return text;
  return text.replace(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/g, (tok, a, b, offset: number) => {
    const x = Number(a), y = Number(b);
    if (x + y < 95 || x + y > 105) return tok;
    const end = offset + tok.length;
    // A grading threshold ("within the 55/45 threshold") is not a measurement.
    if (/^\s*(?:threshold|tolerance|standard|cutoff|limit|or better)/i.test(text.slice(end, end + 20))
      || /\bwithin (?:the |a )?$/i.test(text.slice(Math.max(0, offset - 12), offset))) return tok;
    // 1) An axis word right after the ratio: "52/48 left-right", "52/48 top to bottom".
    let axis: 'lr' | 'tb' | null = null;
    for (const w of axisWords) {
      if (w.at >= end && /^[\s,(]*$/.test(text.slice(end, w.at))) { axis = w.axis; break; }
    }
    // 2) Otherwise the closest axis word BEFORE it in the same clause, with no
    //    other ratio in between: "left/right is approximately 50/50 and ...".
    if (!axis) {
      let bestEnd = -1;
      for (const w of axisWords) {
        if (w.end > offset || offset - w.end > 50) continue;
        const between = text.slice(w.end, offset);
        if (/[.;]/.test(between) || /\d{1,2}\s*\/\s*\d{1,2}/.test(between)) continue;
        if (w.end > bestEnd) { bestEnd = w.end; axis = w.axis; }
      }
    }
    if (!axis) return tok;
    const s = axis === 'lr' ? lr : tb;
    if (!s) return tok;
    if (Math.abs(Math.max(x, y) - Math.max(s[0], s[1])) <= 1) return tok;
    return `${s[0]}/${s[1]}`;
  });
}

/**
 * Apply all repairs in place. `zoomAdjustments` (the narrator's input lines) is
 * relabelled too when given. Never throws on odd shapes; never changes a score.
 */
export function repairReportConsistency(jsonData: any, opts: { zoomAdjustments?: string[] } = {}): ConsistencyResult {
  const repairs: ConsistencyRepair[] = [];
  const wouldChange: WouldChangeGrade[] = [];
  if (!jsonData || typeof jsonData !== 'object') return { repairs, would_change_grade: wouldChange };
  const raw = jsonData.raw_sub_scores || {};
  const faceScore = (cat: Cat, face: Face): number | null => {
    const v = raw[`${cat}_${face}`] ?? jsonData[cat]?.[face]?.score;
    return typeof v === 'number' ? v : null;
  };
  const defectsOf = (cat: Cat, face: Face): any[] | null => {
    const sec = jsonData[cat]?.[face];
    return sec && typeof sec === 'object' && Array.isArray(sec.defects) ? sec.defects : null;
  };

  // Every string the report shows that quotes a finding's location.
  const relabelEverywhere = (face: Face, type: string, oldLoc: string, newLoc: string) => {
    const oldShort = stripFace(oldLoc), newShort = stripFace(newLoc);
    for (const cat of ['corners', 'edges', 'surface'] as const) {
      for (const f of ['front', 'back'] as const) {
        const sec = jsonData[cat]?.[f];
        if (!sec || typeof sec !== 'object') continue;
        for (const key of ['summary', 'condition']) {
          if (typeof sec[key] !== 'string') continue;
          const next = f === face ? relabelText(sec[key], type, oldShort, newShort) : sec[key];
          if (next !== sec[key]) {
            repairs.push({ rule: 'relabel', path: `${cat}.${f}.${key}`, before: sec[key], after: next, note: `finding location ${oldLoc} -> ${newLoc}` });
            sec[key] = next;
          }
        }
      }
      for (const key of [`front_summary`, `back_summary`]) {
        const sec = jsonData[cat];
        if (!sec || typeof sec[key] !== 'string' || !key.startsWith(face)) continue;
        const next = relabelText(sec[key], type, oldShort, newShort);
        if (next !== sec[key]) { repairs.push({ rule: 'relabel', path: `${cat}.${key}`, before: sec[key], after: next, note: `finding location ${oldLoc} -> ${newLoc}` }); sec[key] = next; }
      }
    }
    const notes = jsonData.grading_passes?.consensus_notes;
    if (Array.isArray(notes)) {
      notes.forEach((n: unknown, i: number) => {
        if (typeof n !== 'string') return;
        const next = relabelText(n, type, oldLoc, newLoc);
        if (next !== n) { repairs.push({ rule: 'relabel', path: `grading_passes.consensus_notes[${i}]`, before: n, after: next, note: `finding location ${oldLoc} -> ${newLoc}` }); notes[i] = next; }
      });
    }
    if (Array.isArray(opts.zoomAdjustments)) {
      opts.zoomAdjustments.forEach((n, i) => {
        const next = relabelText(n, type, oldLoc, newLoc);
        if (next !== n) opts.zoomAdjustments![i] = next;
      });
    }
  };

  // ── (i) misfiled zoom findings ──────────────────────────────────────────────
  for (const filed of ['corners', 'edges', 'surface'] as const) {
    for (const face of ['front', 'back'] as const) {
      const list = defectsOf(filed, face);
      if (!list) continue;
      for (const d of [...list]) {
        if (!d || typeof d !== 'object' || d.source !== 'zoom-inspection' || typeof d.type !== 'string') continue;
        const target = belongsTo(d.type, d.description, filed);
        if (!target || target === filed) continue;
        const from = placementOf(stripFace(d.location));
        const relocated = relocate(face, from, target, d.description);
        // No honest location to give it under the other category (e.g. a centre-band
        // crop): leave it exactly as filed rather than invent one.
        if (!relocated) continue;
        const newLoc = relocated;
        const type = d.type.toLowerCase();

        const cap = capOf(d.severity);
        const src = faceScore(filed, face), tgt = faceScore(target, face);
        const others = list.filter(o => o !== d && o && typeof o === 'object');
        const sourceDoesNotRestOnIt = src == null || src >= 10 || src < cap
          || (filed === 'surface' && BORDER_WEAR.has(type))
          || others.some(o => capOf(o.severity) <= src);
        const targetAlreadyThere = tgt == null || tgt <= cap;

        if (sourceDoesNotRestOnIt && targetAlreadyThere) {
          const dest = jsonData[target]?.[face];
          if (!dest || typeof dest !== 'object') continue;
          if (!Array.isArray(dest.defects)) dest.defects = [];
          const destPlace = placementOf(stripFace(newLoc));
          const samePlace = (o: Placement) => target === 'edges' ? !!destPlace.side && o.side === destPlace.side
            : target === 'corners' ? !!destPlace.corner && o.corner === destPlace.corner
            : !!destPlace.quadrant && o.quadrant === destPlace.quadrant;
          const duplicate = dest.defects.some((o: any) => o && typeof o === 'object'
            && String(o.type).toLowerCase() === type && samePlace(placementOf(stripFace(o.location))));
          list.splice(list.indexOf(d), 1);
          if (duplicate) {
            repairs.push({ rule: 'dedupe', path: `${filed}.${face}.defects`, before: `${d.severity} ${d.type} (${d.location})`, note: `same finding already filed under ${target} (${newLoc}); removed the copy under ${filed}` });
          } else {
            dest.defects.push({ ...d, location: newLoc, refiled_from: filed });
            repairs.push({ rule: 'refile', path: `${filed}.${face}.defects -> ${target}.${face}.defects`, before: `${d.severity} ${d.type} (${d.location})`, after: `${d.severity} ${d.type} (${newLoc})`, note: `${d.type} belongs to ${target}; no face score changes` });
          }
          if (newLoc !== d.location) relabelEverywhere(face, d.type, d.location, newLoc);
          continue;
        }

        // Moving it would change a face score: keep the placement, correct the words.
        wouldChange.push({
          face, type: d.type, severity: d.severity, filed_under: filed, belongs_to: target, location: d.location,
          reason: !targetAlreadyThere
            ? `${target}_${face} is ${tgt}; a ${d.severity} finding implies ${cap} or lower`
            : `${filed}_${face} (${src}) rests on this finding`,
        });
        if (newLoc !== d.location) {
          const oldLoc = d.location;
          d.location = newLoc;
          d.counted_under = filed;
          repairs.push({ rule: 'relabel', path: `${filed}.${face}.defects`, before: `${d.severity} ${d.type} (${oldLoc})`, after: `${d.severity} ${d.type} (${newLoc})`, note: `belongs to ${target} but the ${filed} score was computed from it; location corrected, placement kept (grade unchanged)` });
          relabelEverywhere(face, d.type, oldLoc, newLoc);
        }
      }
    }
  }

  // ── (ii) position prose that calls a flagged position clean ─────────────────
  for (const cat of ['corners', 'edges', 'surface'] as const) {
    for (const face of ['front', 'back'] as const) {
      const list = defectsOf(cat, face) ?? [];
      for (const d of list) {
        if (!d || typeof d !== 'object' || typeof d.type !== 'string') continue;
        const place = placementOf(stripFace(d.location));
        // A surface mark kept under corners/edges (its score rests on it) still sits on the surface.
        if (cat === 'surface' || /^surface\b/i.test(stripFace(d.location))) {
          const sec = jsonData.surface?.[face];
          if (!sec || typeof sec.condition !== 'string' || !SURFACE_ONLY.test(d.type)) continue;
          const next = reconcileClean(sec.condition, findingSentence(d, `on the ${face} surface${place.quadrant ? ` (${place.quadrant.replace('top', 'upper').replace('bottom', 'lower')} area)` : ''}`));
          if (next && next !== sec.condition) {
            sec.condition_model ??= sec.condition;
            repairs.push({ rule: 'surface_prose', path: `surface.${face}.condition`, before: sec.condition, after: next, note: 'surface described as clean while a surface finding is recorded' });
            sec.condition = next;
          }
          continue;
        }
        if (face !== 'front') continue; // back positions are mirrored; see header
        const targets: Array<{ cat: Cat; key: string; where: string; adjacent: boolean }> = [];
        if (place.side) {
          targets.push({ cat: 'edges', key: place.side, where: `on this edge`, adjacent: false });
          if (place.corner) targets.push({ cat: 'corners', key: CORNER_KEYS[place.corner], where: `on the ${place.side} edge next to this corner, counted in the corners score`, adjacent: true });
        } else if (place.corner) {
          targets.push({ cat: 'corners', key: CORNER_KEYS[place.corner], where: 'at this corner', adjacent: false });
        }
        for (const t of targets) {
          const pos = jsonData[t.cat]?.front?.[t.key];
          if (!pos || typeof pos !== 'object' || typeof pos.condition !== 'string') continue;
          const finding = findingSentence(d, t.where);
          let next: string | null;
          if (t.adjacent) {
            // The tip itself may well be sharp (Goff, by hand): keep the text, add the finding.
            next = pos.condition.includes('Magnified inspection found') || !CLEAN_CLAIM.test(pos.condition) ? null : `${pos.condition.trim()} ${finding}`;
          } else {
            next = reconcileClean(pos.condition, finding);
          }
          if (next && next !== pos.condition) {
            pos.condition_model ??= pos.condition;
            repairs.push({ rule: 'position_prose', path: `${t.cat}.front.${t.key}.condition`, before: pos.condition, after: next, note: `position text called it clean while ${d.severity} ${d.type} is recorded at ${d.location}` });
            pos.condition = next;
          }
        }
      }
    }
  }

  // ── (iii) centering ratios in the text vs the stored ratios ────────────────
  const cen = jsonData.centering;
  if (cen && typeof cen === 'object') {
    for (const face of ['front', 'back'] as const) {
      const sec = cen[face];
      if (!sec || typeof sec !== 'object') continue;
      const fields: Array<[any, string, string]> = [
        [sec, 'analysis', `centering.${face}.analysis`],
        [sec, 'measurements', `centering.${face}.measurements`],
        [sec, 'summary', `centering.${face}.summary`],
        [cen, `${face}_summary`, `centering.${face}_summary`],
      ];
      for (const [obj, key, path] of fields) {
        if (typeof obj[key] !== 'string') continue;
        const next = reconcileCenteringText(obj[key], sec);
        if (next !== obj[key]) {
          repairs.push({ rule: 'centering_text', path, before: obj[key], after: next, note: `text ratios rewritten from stored ${sec.left_right} L/R, ${sec.top_bottom} T/B` });
          obj[key] = next;
        }
      }
    }
  }

  if (repairs.length || wouldChange.length) {
    jsonData.report_consistency = {
      version: REPORT_CONSISTENCY_VERSION,
      repairs: repairs.map(r => ({ rule: r.rule, path: r.path, note: r.note })),
      would_change_grade: wouldChange,
    };
  }
  return { repairs, would_change_grade: wouldChange };
}
