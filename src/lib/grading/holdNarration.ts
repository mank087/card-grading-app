/**
 * HOLD NARRATION (Sept 29 2026) - narration only, never moves a grade.
 *
 * Customer-disputed grades reviewed by hand showed two ways a held grade explained
 * itself badly:
 *
 *  1. The per-face prose said "Magnified inspection adjusted this face to 9/10" when
 *     the magnified inspection had found nothing. That line is written wherever a face
 *     score is clamped after the fact, and every zoom-capped face already carries its
 *     own findings sentence, so the bare line only ever appeared when something ELSE
 *     moved the face: a Gem Mint hold dragging the tiles, a dissenting evaluation, the
 *     structural cap, or the consensus of the three evaluations. It blamed the wrong
 *     stage and named no defect. describeFaceAdjustment() says what actually happened.
 *
 *  2. "The three independent evaluations did not agree closely enough to confirm a 10"
 *     names no category and no finding, even though the dissenting evaluation's scores
 *     and cited defects are on hand. describeDissent() names them.
 *
 * A third, finish-specific wording: when a 10 is held for photo confidence on a
 * chrome / refractor / prizm card, say so in those words (finishHoldReason()).
 */

export type HoldCategory = 'centering' | 'corners' | 'edges' | 'surface';
const CATS: HoldCategory[] = ['centering', 'corners', 'edges', 'surface'];

export interface FaceAdjustmentInput {
  cat: HoldCategory;
  face: 'front' | 'back';
  /** The face score now displayed. */
  cap: number;
  /** Customer-language zoom findings behind an applied zoom cap on this face, if any. */
  zoomPhrases?: string | null;
  /** A zoom cap was applied to this face (even without phrases). */
  zoomCapApplied?: boolean;
  /** Plain-language reason clause of a Gem Mint hold (grade_hold.reason), if one fired. */
  holdReason?: string | null;
  /** The grade the hold set (grade_hold.to). The hold only explains a face at that score. */
  heldGrade?: number | null;
  /** Confirmed structural damage capped the surface. */
  structural?: boolean;
  /** The low-score check or a dissenting evaluation put this value in the tile. */
  dissentScore?: number | null;
}

/**
 * The sentence appended to a face's prose when its displayed score was lowered after
 * the evaluation that wrote the prose. Every branch names the real cause.
 */
export function describeFaceAdjustment(input: FaceAdjustmentInput): string {
  const { cat, cap } = input;
  if (input.zoomPhrases) {
    return `Magnified inspection found ${input.zoomPhrases} and set this face to ${cap}/10 — see the magnified evidence photo for this section.`;
  }
  if (input.structural && cat === 'surface') {
    return `This face shows ${cap}/10 because confirmed structural damage (a crease or bend) caps the surface.`;
  }
  if (input.holdReason && input.heldGrade === cap) {
    return `This face shows ${cap}/10 because the overall grade is held at ${input.heldGrade}: ${stripTrailingPeriod(input.holdReason)}.`;
  }
  if (typeof input.dissentScore === 'number') {
    return `This face shows ${cap}/10 because one of the three independent evaluations scored the ${cat} at ${input.dissentScore}.`;
  }
  if (input.zoomCapApplied) {
    return `Magnified inspection set this face to ${cap}/10.`;
  }
  return `This face shows ${cap}/10 to match the ${cat} score the three independent evaluations agreed on.`;
}

function stripTrailingPeriod(s: string): string {
  return s.trim().replace(/[.\s]+$/, '');
}

export interface PassRecord {
  final?: number | null;
  centering?: number | null;
  corners?: number | null;
  edges?: number | null;
  surface?: number | null;
  defects_noted?: unknown;
}

/** "corners front top left whitening (minor, ...): Light fiber..." -> "light whitening (front top-left)". */
const POSITION_WORDS = new Set(['front', 'back', 'top', 'bottom', 'left', 'right', 'upper', 'lower', 'center', 'centre', 'middle']);
const SEV_WORDS: Record<string, string> = { minor: 'light', slight: 'light', light: 'light', moderate: 'noticeable', heavy: 'heavy', severe: 'heavy', major: 'heavy' };

export function friendlyCitation(line: string, cat: HoldCategory): string {
  const rest = line.trim().slice(cat.length).trim();
  const m = rest.match(/^(.*?)\s*\(([^,)]+)(?:,\s*([^)]*))?\)\s*:?\s*(.*)$/);
  if (m) {
    const words = m[1].toLowerCase().split(/\s+/).filter(Boolean);
    const face = words.find(w => w === 'front' || w === 'back');
    const type = words.filter(w => !POSITION_WORDS.has(w)).join(' ').replace(/_/g, ' ').trim();
    const sev = SEV_WORDS[m[2].trim().toLowerCase()] ?? '';
    const where = [face, (m[3] || '').trim()].filter(Boolean).join(' ');
    const what = [sev, type || 'a flaw'].filter(Boolean).join(' ');
    return where ? `${what} (${where})` : what;
  }
  const text = (rest.includes(':') ? rest.slice(rest.indexOf(':') + 1) : rest).replace(/^(front|back)\s*/i, '').replace(/\s+/g, ' ').trim();
  return text.length > 90 ? `${text.slice(0, 87).trim()}...` : text;
}

/**
 * Names what the lowest evaluation actually scored and cited, as a reason clause that
 * completes "The card presents at Gem Mint level, but ___ - the grade is held at 9."
 * Returns null when no evaluation scored below 10 (nothing to name).
 */
export function describeDissent(passes: PassRecord[]): string | null {
  const valid = passes.filter(p => typeof p?.final === 'number');
  if (valid.length < 2) return null;
  const low = valid.reduce((a, b) => ((b.final as number) < (a.final as number) ? b : a));
  if ((low.final as number) >= 10) return null;
  const others = valid.filter(p => p !== low);
  const dissentCats = CATS.filter(c => {
    const v = low[c];
    if (typeof v !== 'number' || v >= 10) return false;
    const otherMin = Math.min(...others.map(o => (typeof o[c] === 'number' ? (o[c] as number) : 10)));
    return v < otherMin || otherMin >= 10;
  });
  const cats = dissentCats.length ? dissentCats : CATS.filter(c => typeof low[c] === 'number' && (low[c] as number) < 10);
  const count = valid.length === 3 ? 'three' : String(valid.length);
  const lowCount = valid.filter(p => p.final === low.final).length;
  const who = lowCount > 1 ? `${lowCount === 2 ? 'two' : lowCount} of the ${count} independent evaluations` : `one of the ${count} independent evaluations`;
  const othersAtTen = others.filter(o => o.final === 10).length;
  if (cats.length === 0) {
    return `${who} scored the card ${low.final} overall without scoring any single category lower, so the evaluations did not confirm a 10`;
  }
  const scored = cats.map(c => `the ${c} at ${low[c]}`);
  const scoredText = scored.length > 1 ? `${scored.slice(0, -1).join(', ')} and ${scored[scored.length - 1]}` : scored[0];
  const lines: string[] = Array.isArray(low.defects_noted) ? (low.defects_noted as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const citations = cats.flatMap(c => lines.filter(l => l.trim().toLowerCase().startsWith(c)).slice(0, 1).map(l => friendlyCitation(l.trim(), c)))
    .filter(Boolean).slice(0, 2);
  const cited = citations.length ? `, noting ${citations.join(' and ')}` : ' without naming a specific defect';
  const rest = othersAtTen === others.length && others.length > 0
    ? `, while the other${others.length > 1 ? 's' : ''} scored it a 10`
    : '';
  return `${who} scored ${scoredText}${cited}${rest}, and Gem Mint needs the evaluations to confirm each other`;
}

const FINISH_RX = /\b(chrome|refractor|x-?fractor|prizm|mojo|mirror)\b/i;

/** The reflective finish named on the card, if any ("chrome", "refractor", "prizm"). */
export function reflectiveFinish(cardInfo: any): string | null {
  if (!cardInfo || typeof cardInfo !== 'object') return null;
  const fields = [cardInfo.print_finish, cardInfo.finish, cardInfo.parallel_type, cardInfo.subset, cardInfo.set_name, cardInfo.card_set, cardInfo.brand]
    .filter((x: unknown) => typeof x === 'string').join(' ');
  const m = fields.match(FINISH_RX);
  if (!m) return null;
  const w = m[1].toLowerCase();
  return w.startsWith('x') ? 'refractor' : w === 'mirror' ? 'mirror-finish' : w;
}

/**
 * Photo-confidence hold on a reflective card: say what the finish does to the photos
 * instead of the generic "the photos are not clear enough".
 */
export function finishHoldReason(finish: string): string {
  return `a 10 on a ${finish} finish can't be confirmed from photos - its mirror-like surface throws glare that can hide fine scratches and edge wear`;
}
