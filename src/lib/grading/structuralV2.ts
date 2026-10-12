/**
 * Structural detector v2 (Oct 2026, behind STRUCTURAL_V2, default OFF).
 *
 * A confirmed crease/bend caps a grade at 4. A by-eye audit of 21 random capped
 * cards (Oct 12) found 11 false, 7 real, 3 unclear, and the v9.1 verifier had
 * voted 3/3 "physical damage" on every one: its question ("physical damage or a
 * lighting band?") left printed artwork and factory features nowhere to go, and
 * its evidence menu ("matching_line_opposite_face") was satisfied by a printed
 * line on the other face. The false caps were:
 *   - sticker backing split lines (1986 Fleer stickers), "bend and peel" corner
 *     scores, Garbage Pail Kids die-cut / peel outlines (factory features);
 *   - printed lines that follow the artwork: Flair Spider-Man web strands,
 *     painted lightning and rain, a light streak, jersey wrinkles, waistband
 *     stripes on a Flair Jordan back (printed design);
 *   - a factory-rounded TCG corner, and a card with nothing visible.
 *
 * v2 changes three things:
 *   1. The grading ensemble and the zoom pass are told that factory features and
 *      lines that follow the printed artwork are never structural damage
 *      (STRUCTURAL_V2_GRADING_RULE / STRUCTURAL_V2_ZOOM_RULE).
 *   2. The verifier CLASSIFIES each flagged line (real crease or bend, printed
 *      design, factory cut or score, photo/sleeve artifact, cannot tell) with a
 *      stated observation, sees both whole faces plus enlarged quarters of both
 *      faces, and is told what the card is (a sticker product in particular).
 *      Only a majority "real_crease_or_bend" with physical evidence confirms.
 *   3. The evaluations' scores carry the crease they saw (corners, edges and
 *      surface of a "creased" card come back 4), so refuting the line alone
 *      would not release the grade. A refuted or unresolved claim re-runs the
 *      ensemble once, told what the close inspection found, the same way the
 *      added-marking recheck does. An unresolved claim ("cannot_tell") is then
 *      held at STRUCTURAL_V2_UNSURE_CAP (default 6) instead of the full cap.
 *
 * Everything except verifyStructuralClaimV2 is pure.
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import { logOpenAIUsage } from '../apiUsageLogger';
import { applyModelCompat, BASELINE_MODEL } from './modelRouter';
import { completedChoice } from './inspectionCompleteness';
import { fetchCardOriginals, type CardOriginals } from '../images/originalImages';

export function structuralV2Enabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.STRUCTURAL_V2 || '').trim().toLowerCase();
  return v === 'on' || v === '1' || v === 'true';
}

/** The grade an unresolved ("cannot_tell") structural claim is held at. */
export function structuralUnsureCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.STRUCTURAL_V2_UNSURE_CAP);
  return Number.isInteger(n) && n >= 4 && n <= 9 ? n : 6;
}

export const V2_CLASSES = ['real_crease_or_bend', 'printed_design_element', 'factory_cut_or_score', 'photo_artifact_or_sleeve', 'cannot_tell'] as const;
export type V2Class = typeof V2_CLASSES[number];
const NOT_DAMAGE = new Set<V2Class>(['printed_design_element', 'factory_cut_or_score', 'photo_artifact_or_sleeve']);
export const V2_EVIDENCE = ['surface_break', 'fiber_or_ink_crack', 'outline_deformation', 'opposite_face_line'] as const;

export interface CardContext {
  category?: string | null;
  name?: string | null;
  set?: string | null;
  subset?: string | null;
  year?: string | null;
  manufacturer?: string | null;
  /** Free text from every evaluation's card_info, read only for the sticker check. */
  extra?: string | null;
}

const STICKER = /sticker|garbage pail|wacky pack|\bdecal\b|peel/i;
/** True when the card is identified as a peel-off sticker product. */
export function isStickerProduct(ctx: CardContext | null | undefined): boolean {
  if (!ctx) return false;
  return STICKER.test([ctx.name, ctx.set, ctx.subset, ctx.manufacturer, ctx.extra].filter(Boolean).join(' '));
}

/** Card context from a grading completion's card_info. */
export function cardContextOf(cardInfo: any, category?: string | null, allCardInfo: unknown[] = []): CardContext {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
  const info = cardInfo && typeof cardInfo === 'object' ? cardInfo : {};
  return {
    category: category ?? null,
    name: s(info.card_name) ?? s(info.player_or_character),
    set: s(info.set_name),
    subset: s(info.subset),
    year: s(info.year) ?? (typeof info.year === 'number' ? String(info.year) : null),
    manufacturer: s(info.manufacturer),
    extra: allCardInfo.length ? allCardInfo.map(c => { try { return JSON.stringify(c ?? ''); } catch { return ''; } }).join(' ').slice(0, 4000) : null,
  };
}

// ── prompt text (only sent with STRUCTURAL_V2 on) ────────────────────────────

/** Added to the grading ensemble's request. */
export const STRUCTURAL_V2_GRADING_RULE = `- STRUCTURAL DAMAGE IS A BREAK IN THE CARD STOCK, NOT A LINE IN THE PRINT. These are NEVER structural damage (do not report them in structural_damage, do not lower corners, edges or surface for them): factory features - the split or slit line(s) across the backing paper of a sticker, the die-cut / kiss-cut outline around a peel-off sticker image (Garbage Pail Kids, Wacky Packages, Fleer/Topps/Panini stickers), "bend and peel" corner scores, perforations, the ridged texture of a lenticular (3-D) card, factory-rounded corners on TCG cards; and printed lines that FOLLOW the artwork - wrinkles and folds in a player's jersey, web strands, uniform or waistband stripes, lightning, rain, light streaks, speed lines, swirls, crumpled-paper or stone textures (including the cracked-stone frame of old Magic: The Gathering cards), panel dividers and borders; a line that starts and stops at a printed panel's border is printed. A real crease breaks the print: it crosses design elements at an angle unrelated to them, and shows a surface break (a ridge, a change in gloss along the line), whitening, paper fibres or cracked ink along the line, a kink where it meets the card's edge, or the same line at the same physical spot on the other face. If a line follows the artwork or is a factory feature, it is not a crease. This rule removes printed and factory lines only - it never excuses a DIFFERENT line: ruling out one printed line does not end the search. Check both faces for any other line that cuts across the artwork independently of it (old cards often have a printed jersey fold AND a real crease near it), and report every such line in structural_damage with its own location; every reported crease or bend is re-inspected up close before it affects the grade.`;

/** Appended to the zoom system prompt. */
export const STRUCTURAL_V2_ZOOM_RULE = `
CREASE / BEND / FOLD ARE BREAKS IN THE CARD STOCK, NOT LINES IN THE PRINT (do NOT report any of these as crease, bend, fold or warp):
- factory features: the split or slit line across the backing paper of a sticker, the die-cut outline around a peel-off sticker image, "bend and peel" corner scores, perforations, lenticular (3-D) ridged texture, factory-rounded TCG corners;
- printed lines that FOLLOW the artwork: clothing/jersey wrinkles, web strands, uniform or waistband stripes, lightning, rain, light streaks, speed lines, swirls, printed paper/stone textures, panel dividers, borders.
Report a crease only when the line cuts across the artwork independently of it AND shows a physical sign along it: a ridge or gloss change, whitening or paper fibres, cracked ink, or a kink in the card's edge.`;

// ── verifier ─────────────────────────────────────────────────────────────────

export interface StructuralFinding { type?: string; location?: string; description?: string }

/** Neutral claims: type + location only (descriptions carry the conclusion and prime the verifier). Deduped, max 6. */
export function neutralStructuralClaims(findings: StructuralFinding[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of findings || []) {
    const type = String(f?.type || 'crease').toLowerCase().trim().slice(0, 20);
    const loc = String(f?.location || 'location not recorded').replace(/\s+/g, ' ').trim().slice(0, 140);
    const key = `${type}|${loc.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${type} - ${loc}`);
    if (out.length === 6) break;
  }
  return out;
}

export function structuralV2Prompt(claims: string[], ctx: CardContext | null): string {
  const card = ctx ? [ctx.category, ctx.name, [ctx.year, ctx.manufacturer, ctx.set, ctx.subset].filter(Boolean).join(' ')].filter(Boolean).join(' - ') : '';
  const sticker = isStickerProduct(ctx)
    ? `\nTHIS CARD IS A STICKER PRODUCT. Its back is (or carries) peel-off backing paper. The straight split/slit line(s) across the backing, the die-cut outline around the sticker image on the front, and "bend and peel" corner scores are cut at the factory on every copy: they are factory_cut_or_score, not damage, unless the card stock itself visibly kinks or folds.\n`
    : '';
  return `A card-grading system flagged the line(s) below as possible STRUCTURAL damage (crease, fold, bend) on this trading card. A structural finding caps the grade at 4, so a wrong call is very costly either way: missing a real crease, or capping a card for a line that is printed or made at the factory. The flag came from an automated reading that is often wrong. Decide what each flagged line actually is.
${card ? `\nCARD: ${card}\n` : ''}${sticker}
FLAGGED LINE(S):
${claims.map((c, i) => `C${i + 1}. ${c}`).join('\n')}

CLASSES (one per flagged line):
- "real_crease_or_bend": the card stock itself was folded or bent. It breaks the print: it runs across design elements at an angle unrelated to them (through faces, text, borders and background alike), and along it you can see a physical sign: a ridge or surface break (a highlight/shadow pair, a change in gloss or reflection along the line), whitening, paper fibres or cracked ink along the line, a kink in the card's outline where the line reaches an edge, a corner folded or lifted out of plane, or the same line at the same physical spot on the other face.
- "printed_design_element": part of the printed image. Printed lines FOLLOW the artwork: wrinkles and folds in clothing or a jersey, web strands, uniform or waistband stripes, lightning, rain, light streaks, speed lines, swirls and waves, printed crumpled-paper / stone / marble textures, panel dividers, borders, frame patterns. They are as sharp as the print around them and do not disturb the gloss.
- "factory_cut_or_score": made in manufacturing: the split/slit line across a sticker's backing paper, the die-cut (kiss-cut) outline around a peel-off sticker image (Garbage Pail Kids, Wacky Packages, Fleer/Topps/Panini stickers), "bend and peel" corner scores, perforations, the ridged texture of a lenticular (3-D) card, factory-rounded corners on TCG cards (Pokemon, Magic, Yu-Gi-Oh, One Piece), the card's normal cut edge.
- "photo_artifact_or_sleeve": made by the photo or a holder: glare or a reflection band (one whole side brighter than the other), a scratch, seam or edge of a sleeve, top loader or case, a shadow, the background, blur or compression noise.
- "cannot_tell": the photos do not let you decide.

For each line also report what you OBSERVE:
- "follows_artwork": true if the line traces shapes of the printed image (a fold in a jersey, a web strand, a stripe, a lightning bolt, a border), false if it cuts across the design independently of it.
- "evidence": for real_crease_or_bend only, the physical signs you actually see, from: "surface_break" (ridge, gloss or reflection change along the line), "fiber_or_ink_crack" (whitening, paper fibre or cracked ink along the line), "outline_deformation" (the edge kinks or a corner folds/lifts where the line meets it), "opposite_face_line" (a line at the mirrored spot on the other face that is not itself printing or a factory cut). Use [] for every other class.
- "justification": one sentence naming what you see that decides it.

RULES:
- A line that follows the artwork is printed_design_element, however long, bright or continuous it is.
- A line CONFINED to one printed panel or frame - it starts and stops at that panel's printed border instead of continuing into the next panel, the art box or the card edge - is printed texture. Known case: pre-2003 Magic: The Gathering cards print a cracked-stone texture in the frame (the RED frame especially): dark branching crack lines with light edges that look like cracked ink. They are ink on every copy. A line in such a frame is printed_design_element unless it continues out of the frame into the art or text box along the same path, or kinks the card's outline.
- Other known printed lines: the faint wavy arcs in the swirl of the standard Pokemon card back, and the curved divider in the header of Pokemon Trainer cards.
- A perfectly straight line running edge to edge, parallel to the card's sides, on a plain or blank back (no printing), with no kink in the outline and nothing at the mirrored spot on the front, is the slit in a sticker's backing paper: factory_cut_or_score.
- Printed words such as "BEND AND PEEL", "PEEL HERE" or "STICKER" anywhere on the card mark a sticker product: the corner or line they point to is a factory score (factory_cut_or_score), even if it looks lifted.
- A "warp" (the whole card bowed) is real_crease_or_bend only when the card's outline visibly curves against the background (outline_deformation); otherwise cannot_tell.
- Left and right are mirrored between the faces: a line at the front's left edge sits behind the back's right edge.
- Decide from the enlarged quarters, not only the whole-card views. Do not treat the flag itself as evidence.

THEN LOOK FOR A DIFFERENT LINE. The automated reading sometimes describes a printed line (a jersey fold, a web strand) while a real crease sits elsewhere on the card, often on worn vintage cards. Scan BOTH faces, every quarter, for any OTHER line - not one of the flagged lines - that cuts across the artwork independently of it and shows a physical sign (cracked ink or white paper along it, a ridge, a kink where it meets the edge, or the same line on the other face). Report it in "other_crease" only if you can see such a sign; printed lines, texture, glare and the card's normal edges do not count.

Reply ONLY JSON: {"lines":[{"id":"C1","follows_artwork":true|false,"evidence":[],"class":"real_crease_or_bend|printed_design_element|factory_cut_or_score|photo_artifact_or_sleeve|cannot_tell","justification":"<one sentence>"}],"other_crease":{"present":true|false,"location":"<face and where, or empty>","follows_artwork":true|false,"evidence":[],"justification":"<one sentence, or empty>"}} with exactly one "lines" entry per flagged line.`;
}

export interface V2Line { id: number; cls: V2Class; evidence: string[]; followsArtwork: boolean; justification: string; coerced?: boolean }

/**
 * One sample's answer, or null when it is incomplete or malformed. A "real"
 * call with no stated physical sign, or one on a line the same sample says
 * follows the artwork, contradicts itself and is read as cannot_tell. Pure.
 */
export function parseStructuralV2Sample(content: string, claimCount: number, claimTypes: string[] = []): V2Line[] | null {
  let v: any;
  try { v = JSON.parse(content); } catch { return null; }
  const lines = Array.isArray(v?.lines) ? v.lines : null;
  if (!lines || lines.length !== claimCount) return null;
  const out: V2Line[] = [];
  for (const x of lines) {
    const id = Number(/^C?(\d+)$/i.exec(String(x?.id ?? '').trim())?.[1]);
    if (!Number.isInteger(id) || id < 1 || id > claimCount || out.some(o => o.id === id)) return null;
    if (!V2_CLASSES.includes(x?.class)) return null;
    if (typeof x?.justification !== 'string' || !x.justification.trim()) return null;
    const evidence = Array.isArray(x?.evidence) ? x.evidence.filter((e: unknown) => (V2_EVIDENCE as readonly string[]).includes(String(e))) : [];
    const followsArtwork = x?.follows_artwork === true;
    let cls: V2Class = x.class;
    let coerced = false;
    if (cls === 'real_crease_or_bend' && (evidence.length === 0 || followsArtwork)) { cls = 'cannot_tell'; coerced = true; }
    // A whole-card warp has no line to inspect; only a visibly bowed outline shows it.
    if (cls === 'real_crease_or_bend' && claimTypes[id - 1] === 'warp' && !evidence.includes('outline_deformation')) { cls = 'cannot_tell'; coerced = true; }
    out.push({ id, cls, evidence, followsArtwork, justification: x.justification.trim().slice(0, 300), ...(coerced ? { coerced } : {}) });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** A real crease the sample found somewhere OTHER than the flagged line(s). */
export interface V2OtherCrease { location: string; evidence: string[]; justification: string }

/**
 * The sample's answer to "is there a DIFFERENT line on the card that is a real
 * crease?" (Yastrzemski anchor: the evaluation described the printed jersey fold
 * and the real crease beside it was never claimed). Counts only with a location,
 * a justification and at least one physical sign. Pure.
 */
export function parseOtherCrease(content: string): V2OtherCrease | null {
  let v: any;
  try { v = JSON.parse(content); } catch { return null; }
  const o = v?.other_crease;
  if (!o || o.present !== true) return null;
  const evidence = Array.isArray(o.evidence) ? o.evidence.filter((e: unknown) => (V2_EVIDENCE as readonly string[]).includes(String(e))) : [];
  const location = typeof o.location === 'string' ? o.location.trim() : '';
  const justification = typeof o.justification === 'string' ? o.justification.trim() : '';
  if (!evidence.length || !location || !justification || o.follows_artwork === true) return null;
  return { location: location.slice(0, 160), evidence, justification: justification.slice(0, 300) };
}

export type V2Outcome = 'confirmed' | 'refuted' | 'uncertain';
export interface StructuralV2Verdict {
  ok: boolean;
  outcome: V2Outcome | null;
  reason: string;
  /** Per-sample verdict: real / not_damage / cannot_tell. */
  votes: string[];
  /** Majority class per flagged line (ties -> cannot_tell). */
  lines: Array<{ claim: string; cls: V2Class; justification: string; evidence: string[] }>;
  claims: string[];
  /** Set when the cap rests on a line nobody claimed (the claimed ones were ruled out). */
  otherCrease?: V2OtherCrease;
  /** Samples that reported a real crease on a line nobody claimed (diagnostic). */
  otherVotes?: number;
}

/** A sample's overall reading: any real line -> real; every line non-damage -> not_damage. Pure. */
export function sampleVote(lines: V2Line[], claimTypes: string[] = []): 'real' | 'not_damage' | 'cannot_tell' {
  if (lines.some(l => l.cls === 'real_crease_or_bend')) return 'real';
  // An unresolvable whole-card "warp" beside lines that were all ruled out does not
  // hold the card: it has no line of its own to inspect (Flair Spider-Man anchor).
  const lineClaims = lines.filter(l => !(claimTypes[l.id - 1] === 'warp' && l.cls === 'cannot_tell'));
  if (lineClaims.length > 0 && lineClaims.every(l => NOT_DAMAGE.has(l.cls))) return 'not_damage';
  return 'cannot_tell';
}

/**
 * Three complete samples decide. confirmed: a majority (all three when
 * requireUnanimous) read a real crease or bend; refuted: a majority read every
 * line as not damage and none read a real one; anything else is uncertain. Pure.
 */
export function tallyStructuralV2(samples: Array<V2Line[] | null>, claims: string[], opts?: { requireUnanimous?: boolean; others?: Array<V2OtherCrease | null> }): StructuralV2Verdict {
  const complete = samples.map((s, i) => ({ s, other: opts?.others?.[i] ?? null })).filter((x): x is { s: V2Line[]; other: V2OtherCrease | null } => x.s !== null);
  const parsed = complete.map(x => x.s);
  if (parsed.length !== 3) return { ok: false, outcome: null, reason: 'verification incomplete - three complete answers required', votes: [], lines: [], claims };
  const types = claims.map(c => c.split(' - ')[0]);
  const votes = parsed.map(s => sampleVote(s, types));
  const real = votes.filter(v => v === 'real').length;
  const notDamage = votes.filter(v => v === 'not_damage').length;
  const outcome: V2Outcome = real >= (opts?.requireUnanimous ? 3 : 2) ? 'confirmed'
    : notDamage >= 2 && real === 0 ? 'refuted' : 'uncertain';
  // A crease nobody claimed, found while ruling the claimed line out. It has no
  // evaluation's vote behind it, so all three samples must find it.
  const others = complete.map(x => x.other).filter((o): o is V2OtherCrease => o !== null);
  if (outcome !== 'confirmed' && others.length === 3) {
    const o = others[0];
    return {
      ok: true, outcome: 'confirmed', votes,
      reason: `confirmed (claimed line ${outcome}; a different line is a real crease 3/3): ${o.location} - ${o.justification}`,
      lines: [...claims.map(claim => ({ claim, cls: 'cannot_tell' as V2Class, justification: 'see the other line', evidence: [] as string[] })),
        { claim: `crease - ${o.location}`, cls: 'real_crease_or_bend', justification: o.justification, evidence: [...new Set(others.flatMap(x => x.evidence))] }],
      claims,
      otherCrease: o,
    };
  }
  const lines = claims.map((claim, i) => {
    const calls = parsed.map(s => s[i]);
    const counts = new Map<V2Class, number>();
    for (const c of calls) counts.set(c.cls, (counts.get(c.cls) ?? 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const cls: V2Class = n >= 2 ? top : 'cannot_tell';
    const pick = calls.find(c => c.cls === cls) ?? calls[0];
    return { claim, cls, justification: pick.justification, evidence: [...new Set(calls.filter(c => c.cls === 'real_crease_or_bend').flatMap(c => c.evidence))] };
  });
  const won = outcome === 'confirmed' ? 'real' : outcome === 'refuted' ? 'not_damage' : null;
  const sampleIdx = won ? votes.indexOf(won) : -1;
  const decisive = sampleIdx >= 0 ? parsed[sampleIdx].find(l => won === 'real' ? l.cls === 'real_crease_or_bend' : NOT_DAMAGE.has(l.cls)) : null;
  const reason = `${outcome} (${votes.join(', ')}${opts?.requireUnanimous ? '; unanimity required' : ''})${decisive ? `: ${decisive.cls.replace(/_/g, ' ')} - ${decisive.justification}` : ''}`;
  return { ok: true, outcome, reason, votes, lines, claims, otherVotes: others.length };
}

const VERIFY_EDGE = 1600;
const QUADRANT_EDGE = 1024;

/** Classify the flagged lines. n=3; anything short of three complete answers is ok:false. */
export async function verifyStructuralClaimV2(
  frontImageUrl: string,
  backImageUrl: string,
  findings: StructuralFinding[],
  opts?: { model?: string; images?: CardOriginals; context?: CardContext | null; requireUnanimous?: boolean; reasoningEffort?: string },
): Promise<StructuralV2Verdict> {
  const claims = neutralStructuralClaims(findings);
  try {
    if (claims.length === 0) return { ok: false, outcome: null, reason: 'no structural claim to verify', votes: [], lines: [], claims };
    let bufs: { front: Buffer; back: Buffer };
    try {
      const originals = opts?.images ?? (await fetchCardOriginals(frontImageUrl, backImageUrl));
      bufs = { front: originals.front, back: originals.back };
    } catch {
      return { ok: false, outcome: null, reason: 'verification image fetch failed', votes: [], lines: [], claims };
    }
    const whole = (b: Buffer) => sharp(b, { failOn: 'none' })
      .resize({ width: VERIFY_EDGE, height: VERIFY_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 }).toBuffer();
    const quarters = async (b: Buffer): Promise<Buffer[]> => {
      const meta = await sharp(b, { failOn: 'none' }).metadata();
      const w = meta.width!, h = meta.height!, hw = Math.floor(w / 2), hh = Math.floor(h / 2);
      const boxes = [[0, 0, hw, hh], [w - hw, 0, hw, hh], [0, h - hh, hw, hh], [w - hw, h - hh, hw, hh]];
      return Promise.all(boxes.map(([left, top, width, height]) => sharp(b, { failOn: 'none' })
        .extract({ left, top, width, height })
        .resize({ width: QUADRANT_EDGE, height: QUADRANT_EDGE, fit: 'inside' })
        .jpeg({ quality: 90 }).toBuffer()));
    };
    const [front, back, frontQ, backQ] = await Promise.all([whole(bufs.front), whole(bufs.back), quarters(bufs.front), quarters(bufs.back)]);
    const img = (b: Buffer) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b.toString('base64')}`, detail: 'high' } });
    const QUARTERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const content: any[] = [
      { type: 'text', text: structuralV2Prompt(claims, opts?.context ?? null) },
      { type: 'text', text: 'FRONT (whole card):' }, img(front),
      { type: 'text', text: 'BACK (whole card):' }, img(back),
    ];
    frontQ.forEach((q, i) => content.push({ type: 'text', text: `FRONT, enlarged ${QUARTERS[i]} quarter:` }, img(q)));
    backQ.forEach((q, i) => content.push({ type: 'text', text: `BACK, enlarged ${QUARTERS[i]} quarter (as photographed; left/right mirrored relative to the front):` }, img(q)));

    const model = opts?.model || BASELINE_MODEL;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const started = Date.now();
    const { config } = applyModelCompat({
      model,
      temperature: 0,
      seed: 7,
      n: 3,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }, model, { reasoningEffort: opts?.reasoningEffort || process.env.STRUCTURAL_V2_REASONING_EFFORT || 'medium' });
    const response = await openai.chat.completions.create(config as any, { timeout: 90_000, maxRetries: 0 });
    logOpenAIUsage({
      operation: 'structural_verify_v2',
      model,
      usage: (response as any).usage,
      durationMs: Date.now() - started,
      metadata: { n: 3, claims: claims.length, sticker: isStickerProduct(opts?.context) },
    });
    const samples = response.choices.map(choice => completedChoice(choice) ? parseStructuralV2Sample(choice.message?.content || '', claims.length, claims.map(c => c.split(' - ')[0])) : null);
    const others = response.choices.map(choice => completedChoice(choice) ? parseOtherCrease(choice.message?.content || '') : null);
    const verdict = tallyStructuralV2(samples, claims, { requireUnanimous: opts?.requireUnanimous, others });
    console.log(`[STRUCTURAL V2] ${verdict.reason}`);
    return verdict;
  } catch (e: any) {
    return { ok: false, outcome: null, reason: `structural verification failed: ${e?.message || e}`, votes: [], lines: [], claims };
  }
}

// ── what the re-grade is told ────────────────────────────────────────────────

const CLASS_PHRASE: Record<V2Class, string> = {
  real_crease_or_bend: 'a real crease or bend',
  printed_design_element: 'printed design that follows the artwork',
  factory_cut_or_score: 'a factory cut or score line',
  photo_artifact_or_sleeve: 'a photo, glare or holder artifact',
  cannot_tell: 'not confirmable from the photos',
};

/** The instruction added to the one re-grade after a refuted or uncertain verdict. Pure. */
export function structuralRecheckNote(verdict: StructuralV2Verdict): string | null {
  if (!verdict.ok || (verdict.outcome !== 'refuted' && verdict.outcome !== 'uncertain')) return null;
  const lines = verdict.lines.map(l => `${l.claim}: ${CLASS_PHRASE[l.cls]} (${l.justification})`).join('; ').slice(0, 900);
  if (verdict.outcome === 'refuted') {
    return `- VERIFIED BEFORE THIS EVALUATION: the line(s) an earlier evaluation reported as structural damage were inspected up close and are NOT a crease or bend - ${lines}. Do not report them in structural_damage and do not lower corners, edges or surface for them; grade the card on its actual condition. Report structural damage only for a DIFFERENT line that clearly breaks the card stock.`;
  }
  return `- CHECKED BEFORE THIS EVALUATION: the line(s) an earlier evaluation reported as structural damage were inspected up close and could NOT be confirmed as a crease or bend - ${lines}. Do not report them in structural_damage and do not apply a structural cap for them; grade the card on its actual condition otherwise. (The system holds the final grade for this unresolved line separately.) Report structural damage only for a DIFFERENT line that clearly breaks the card stock.`;
}

type LiftCat = 'corners' | 'edges' | 'surface';
/**
 * Fallback when the evaluations that scored the card still carry a line that
 * was not confirmed (no re-grade was possible, or the re-grade reported it
 * again). A category at or below the structural cap takes the clean reading:
 * the highest score among evaluations that did not report structural damage,
 * or 9 when every evaluation did and the magnified inspection ran, bounded by
 * any magnified-inspection cap on that category. Faces below the new score are
 * raised to it. Same rule as the low-score check (severeScoreCheck.ts). Pure.
 */
export function liftRefutedStructural(input: {
  scores: Record<LiftCat, number>;
  faces: Record<string, unknown>;
  cleanPassScores: Record<LiftCat, Array<number | null>>;
  zoomOk: boolean;
  zoomCaps: Record<string, number>;
  structCap: number;
}): { scores: Record<LiftCat, number>; faces: Record<string, number>; changed: string[] } {
  const scores = { ...input.scores };
  const faces: Record<string, number> = {};
  const changed: string[] = [];
  for (const cat of ['corners', 'edges', 'surface'] as const) {
    const score = scores[cat];
    if (typeof score !== 'number' || score > input.structCap) continue;
    const clean = input.cleanPassScores[cat].filter((n): n is number => typeof n === 'number' && n > input.structCap);
    const reading = clean.length ? Math.max(...clean) : input.zoomOk ? 9 : null;
    if (reading == null) continue;
    const caps = ['front', 'back'].map(f => input.zoomCaps[`${cat}_${f}`]).filter((n): n is number => typeof n === 'number');
    const next = Math.max(score, caps.length ? Math.min(reading, ...caps) : reading);
    if (next <= score) continue;
    scores[cat] = next;
    for (const f of ['front', 'back']) {
      const key = `${cat}_${f}`;
      const v = input.faces[key];
      if (typeof v === 'number' && v < next) faces[key] = next;
    }
    changed.push(`${cat} ${score}→${next}`);
  }
  return { scores, faces, changed };
}

/** Customer-facing note recorded on structural_damage when v2 does not cap. Pure. */
export function structuralV2Note(outcome: V2Outcome, unsureCap: number): string {
  return outcome === 'refuted'
    ? 'A line was flagged as a possible crease or bend. A close inspection found it is part of the printed design, a factory cut, or a photo artifact, not damage. Grade not capped.'
    : `A line was flagged as a possible crease or bend that a close inspection could not confirm or rule out from the photos. Instead of the structural cap of 4, the grade is held at no more than ${unsureCap}.`;
}
