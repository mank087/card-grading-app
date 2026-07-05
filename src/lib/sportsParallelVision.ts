/**
 * Sports Parallel Visual Disambiguation (WS2c)
 *
 * When the local DB matcher (sportsCardMatcher.ts) confirms a card's family
 * (set + number + player) but the parallel is ambiguous and we defaulted to
 * base (tier==='family' && defaultedToBase && family.length>1), this module
 * runs ONE small follow-up vision call on the front image, constrained to the
 * family's real parallel list, described via visual attributes from a static
 * glossary rather than name guessing (plan WS2c.1/2c.2).
 *
 * Adoption is confidence-gated and base-biased (WS2c.3):
 * - pattern/color parallels: adopt on high OR medium model confidence
 * - foil-only distinctions (Silver Prizm vs base, refractor vs non): adopt
 *   ONLY on high confidence — unreliable from flat photos
 * - unknown vocabulary (no glossary hit): treated like foil (high only)
 * - picking Base (index 0) is always accepted (it IS the current default)
 * - any error / parse failure / timeout => null (caller keeps base default)
 *
 * Never throws.
 */

import OpenAI from 'openai';

// ============================================================================
// Parallel-features glossary (WS2c.2)
// Known Prizm/Optic/Select/Mosaic/Chrome parallel vocabulary → visual signature.
// Keys are lowercase, hyphenless (matching normalizes '-'/'_'/'/' to spaces).
// ============================================================================

export type ParallelKind = 'pattern' | 'color' | 'foil';

export interface GlossaryEntry {
  descriptor: string;
  kind: ParallelKind;
}

export const PARALLEL_GLOSSARY: Record<string, GlossaryEntry> = {
  // --- Patterns (visually distinctive, reliable from flat photos) ---
  'cracked ice':   { descriptor: 'shattered-glass foil pattern of angular ice-like facets', kind: 'pattern' },
  'zebra':         { descriptor: 'bold black-and-white zebra stripes', kind: 'pattern' },
  'tiger':         { descriptor: 'orange-and-black tiger-stripe animal print', kind: 'pattern' },
  'giraffe':       { descriptor: 'tan-and-brown giraffe-patch animal print', kind: 'pattern' },
  'elephant':      { descriptor: 'gray wrinkled elephant-skin animal print', kind: 'pattern' },
  'snakeskin':     { descriptor: 'scaled snakeskin animal print', kind: 'pattern' },
  'dragon':        { descriptor: 'dragon-scale pattern', kind: 'pattern' },
  'dragon scale':  { descriptor: 'overlapping dragon-scale pattern', kind: 'pattern' },
  'peacock':       { descriptor: 'iridescent peacock-feather pattern', kind: 'pattern' },
  'butterfly':     { descriptor: 'butterfly-wing pattern', kind: 'pattern' },
  'wave':          { descriptor: 'wavy flowing refractor lines across the surface', kind: 'pattern' },
  'shimmer':       { descriptor: 'dense glittery shimmer speckle over the whole card', kind: 'pattern' },
  'sparkle':       { descriptor: 'sparkling glitter flecks embedded in the foil', kind: 'pattern' },
  'disco':         { descriptor: 'dotted disco-ball mirror speckle', kind: 'pattern' },
  'pulsar':        { descriptor: 'radiating pulsar dot-burst pattern', kind: 'pattern' },
  'camo':          { descriptor: 'camouflage print background', kind: 'pattern' },
  'mojo':          { descriptor: 'elongated hexagonal mojo refractor pattern', kind: 'pattern' },
  'velocity':      { descriptor: 'diagonal speed-streak lines', kind: 'pattern' },
  'hyper':         { descriptor: 'swirling marbled hyper streaks', kind: 'pattern' },
  'nebula':        { descriptor: 'cosmic nebula cloud speckle', kind: 'pattern' },
  'stained glass': { descriptor: 'stained-glass segmented panes of color', kind: 'pattern' },
  'vinyl':         { descriptor: 'glossy dark record-like vinyl sheen', kind: 'pattern' },
  'ice':           { descriptor: 'frosted translucent ice texture', kind: 'pattern' },
  'scope':         { descriptor: 'concentric circular scope rings', kind: 'pattern' },
  'flash':         { descriptor: 'radial flash burst lines from the center', kind: 'pattern' },
  'laser':         { descriptor: 'fine etched laser lines', kind: 'pattern' },
  'x fractor':     { descriptor: 'crosshatch X-pattern grid in the foil', kind: 'pattern' },
  'xfractor':      { descriptor: 'crosshatch X-pattern grid in the foil', kind: 'pattern' },
  'atomic':        { descriptor: 'atomic starburst/orbit-ring facet pattern', kind: 'pattern' },
  'choice':        { descriptor: 'prismatic choice swirl pattern (Select Choice)', kind: 'pattern' },
  'fast break':    { descriptor: 'US-flag style streaks and stars (Fast Break)', kind: 'pattern' },
  'no huddle':     { descriptor: 'diagonal streak pattern (No Huddle)', kind: 'pattern' },
  'genesis':       { descriptor: 'cellular geometric genesis pattern', kind: 'pattern' },
  'reactive':      { descriptor: 'color-shifting reactive foil swirl', kind: 'pattern' },
  'holo':          { descriptor: 'holographic rainbow foil', kind: 'pattern' },
  'rainbow':       { descriptor: 'full multicolor rainbow foil wash', kind: 'pattern' },
  'checkerboard':  { descriptor: 'checkerboard grid of squares', kind: 'pattern' },
  'tie dye':       { descriptor: 'swirled multicolor tie-dye', kind: 'pattern' },
  'marble':        { descriptor: 'marbled swirl pattern', kind: 'pattern' },
  'lava':          { descriptor: 'molten lava swirl pattern', kind: 'pattern' },
  'galactic':      { descriptor: 'starry galactic field pattern', kind: 'pattern' },
  'cosmic':        { descriptor: 'cosmic starfield sparkle pattern', kind: 'pattern' },
  'honeycomb':     { descriptor: 'hexagonal honeycomb grid', kind: 'pattern' },
  'diamond':       { descriptor: 'diamond-faceted texture', kind: 'pattern' },
  'prism':         { descriptor: 'prismatic geometric facets', kind: 'pattern' },
  'superfractor':  { descriptor: 'gold swirl superfractor pattern', kind: 'pattern' },
  'negative':      { descriptor: 'inverted negative-image dark foil', kind: 'pattern' },
  'lazer':         { descriptor: 'fine etched laser lines', kind: 'pattern' },

  // --- Colors (dominant border/background color, fairly reliable) ---
  'gold':          { descriptor: 'gold color', kind: 'color' },
  'black':         { descriptor: 'black color', kind: 'color' },
  'red':           { descriptor: 'red color', kind: 'color' },
  'blue':          { descriptor: 'blue color', kind: 'color' },
  'green':         { descriptor: 'green color', kind: 'color' },
  'purple':        { descriptor: 'purple color', kind: 'color' },
  'orange':        { descriptor: 'orange color', kind: 'color' },
  'pink':          { descriptor: 'pink color', kind: 'color' },
  'yellow':        { descriptor: 'yellow color', kind: 'color' },
  'white':         { descriptor: 'white color', kind: 'color' },
  'white sparkle': { descriptor: 'white background with sparkle flecks', kind: 'color' },
  'ruby':          { descriptor: 'deep ruby-red color', kind: 'color' },
  'sapphire':      { descriptor: 'deep sapphire-blue color', kind: 'color' },
  'emerald':       { descriptor: 'deep emerald-green color', kind: 'color' },
  'teal':          { descriptor: 'teal blue-green color', kind: 'color' },
  'aqua':          { descriptor: 'aqua light-blue color', kind: 'color' },
  'bronze':        { descriptor: 'bronze metallic color', kind: 'color' },
  'copper':        { descriptor: 'copper metallic color', kind: 'color' },
  'platinum':      { descriptor: 'bright platinum metallic color', kind: 'color' },
  'rose gold':     { descriptor: 'pinkish rose-gold metallic color', kind: 'color' },
  'magenta':       { descriptor: 'magenta color', kind: 'color' },
  'maroon':        { descriptor: 'dark maroon-red color', kind: 'color' },
  'navy':          { descriptor: 'dark navy-blue color', kind: 'color' },
  'lime':          { descriptor: 'bright lime-green color', kind: 'color' },
  'neon':          { descriptor: 'bright neon color', kind: 'color' },
  'sepia':         { descriptor: 'brown sepia-toned finish', kind: 'color' },

  // --- Foil-only (unreliable from flat photos — high confidence required) ---
  'silver':        { descriptor: 'plain silver foil (base Prizm-style foil, no added color)', kind: 'foil' },
  'refractor':     { descriptor: 'refractor foil sheen (rainbow gleam under light)', kind: 'foil' },
  'prizm':         { descriptor: 'base prizm foil treatment', kind: 'foil' },
  'foil':          { descriptor: 'generic foil treatment', kind: 'foil' },
  'foilboard':     { descriptor: 'foilboard stock finish', kind: 'foil' },
};

// Longest keys first so multi-word phrases ("cracked ice", "white sparkle",
// "rose gold") win before their single-word components.
const GLOSSARY_KEYS_BY_LENGTH = Object.keys(PARALLEL_GLOSSARY).sort(
  (a, b) => b.length - a.length
);

// ============================================================================
// Glossary matching — compose multi-word variants from their parts
// (e.g. "Blue Wave" = blue color + wave pattern)
// ============================================================================

interface GlossaryPart extends GlossaryEntry {
  term: string;
}

function glossaryPartsFor(variantText: string): GlossaryPart[] {
  // Normalize: lowercase, hyphens/underscores/slashes -> spaces, pad with
  // spaces so we can do whole-word matching via ' key ' inclusion.
  let remaining =
    ' ' +
    variantText
      .toLowerCase()
      .replace(/[-_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() +
    ' ';

  const parts: GlossaryPart[] = [];
  for (const key of GLOSSARY_KEYS_BY_LENGTH) {
    const needle = ' ' + key + ' ';
    if (remaining.includes(needle)) {
      parts.push({ term: key, ...PARALLEL_GLOSSARY[key] });
      // Consume so components of a matched phrase aren't re-matched
      remaining = remaining.split(needle).join(' ');
    }
  }
  return parts;
}

/**
 * Effective kind for confidence gating. Multi-part variants take the most
 * visually reliable kind present (pattern > color); a variant whose ONLY
 * glossary components are 'foil' (or with no glossary match at all) is
 * treated as foil — the unreliable class.
 */
function effectiveKind(parts: GlossaryPart[]): ParallelKind {
  if (parts.some((p) => p.kind === 'pattern')) return 'pattern';
  if (parts.some((p) => p.kind === 'color')) return 'color';
  return 'foil'; // foil-only components OR unknown vocabulary
}

// ============================================================================
// Public API
// ============================================================================

export interface ParallelVisionFamilyRow {
  id: string;
  variantText: string | null;
  serialDenominator: number | null;
}

export interface ParallelVisionResult {
  productId: string;
  variantText: string | null; // null = model picked Base
  confidence: 'high' | 'medium' | 'low';
  observed: string;
}

const MAX_CANDIDATES = 40; // incl. the Base entry
const MODEL = 'gpt-5.1';

export async function disambiguateParallelVisually(opts: {
  frontImageUrl: string;
  playerName: string;
  family: ParallelVisionFamilyRow[];
}): Promise<ParallelVisionResult | null> {
  try {
    const { frontImageUrl, playerName, family } = opts;

    const baseRow = family.find((r) => r.variantText === null) || null;
    const variantRows = family.filter(
      (r): r is ParallelVisionFamilyRow & { variantText: string } =>
        typeof r.variantText === 'string' && r.variantText.trim().length > 0
    );
    if (variantRows.length === 0) {
      console.log('[ParallelVision] Skipped: family has no named variants');
      return null;
    }

    // Annotate every variant with its composed glossary description
    const annotated = variantRows.map((row) => {
      const parts = glossaryPartsFor(row.variantText);
      return { row, parts };
    });

    // Cap at MAX_CANDIDATES total (index 0 = Base). Prefer variants that
    // have glossary descriptors — those are the ones vision can actually
    // discriminate. Stable order within each group.
    const described = annotated.filter((a) => a.parts.length > 0);
    const undescribed = annotated.filter((a) => a.parts.length === 0);
    const kept = [...described, ...undescribed].slice(0, MAX_CANDIDATES - 1);
    const truncated = annotated.length > kept.length;

    // Numbered candidate list. Entry 0 is always Base.
    const candidateLines: string[] = [
      '0. Base — no special color, pattern, or foil treatment',
    ];
    kept.forEach((a, i) => {
      const desc =
        a.parts.length > 0
          ? a.parts.map((p) => p.descriptor).join('; ')
          : 'no known visual signature on file';
      const serial = a.row.serialDenominator
        ? ` (serial numbered /${a.row.serialDenominator})`
        : '';
      candidateLines.push(`${i + 1}. ${a.row.variantText}${serial} — ${desc}`);
    });

    const promptText = [
      `You are identifying which printed parallel/variant of a sports trading card is shown in this photo. The card features ${playerName || 'the pictured player'}.`,
      '',
      'Step 1 — describe to yourself what you can actually SEE:',
      '(a) background/border pattern: none, shattered glass, stripes, wavy lines, camo, animal print, dots, crosshatch, etc.',
      '(b) the dominant border/background color of the card design',
      '(c) whether foil/mirror shine is clearly present',
      '(d) any serial number stamp visible (e.g. "12/99")',
      '',
      'Step 2 — pick the ONE candidate below that best matches what you saw. If the card shows no special color, pattern, or foil treatment — or you cannot tell from this photo — choose 0 (Base). Do not guess a premium parallel you cannot actually see.',
      truncated
        ? `(Note: this set has more parallels than listed; only the ${candidateLines.length} most visually identifiable candidates are shown. If none match, choose 0.)`
        : '',
      '',
      'Candidates:',
      ...candidateLines,
      '',
      'Respond ONLY with JSON, no other text:',
      '{"choiceIndex": <number>, "confidence": "high|medium|low", "observed": "<one sentence: the pattern/color/foil/serial you observed>"}',
    ]
      .filter((l) => l !== '')
      .join('\n');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            {
              type: 'image_url',
              image_url: { url: frontImageUrl, detail: 'low' },
            },
          ],
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || '';
    const parsed = parseVisionJson(raw);
    if (!parsed) {
      console.log('[ParallelVision] Rejected: unparseable model response');
      return null;
    }

    const { choiceIndex, confidence, observed } = parsed;
    if (
      !Number.isInteger(choiceIndex) ||
      choiceIndex < 0 ||
      choiceIndex > kept.length
    ) {
      console.log(`[ParallelVision] Rejected: choiceIndex ${choiceIndex} out of range (0-${kept.length})`);
      return null;
    }

    // Base pick (index 0) is always accepted — it IS the current default.
    if (choiceIndex === 0) {
      console.log(`[ParallelVision] Base confirmed (confidence=${confidence}): ${observed}`);
      return {
        productId: baseRow ? baseRow.id : family[0].id,
        variantText: null,
        confidence,
        observed,
      };
    }

    const picked = kept[choiceIndex - 1];
    const kind = effectiveKind(picked.parts);

    // Confidence gating (base-biased, WS2c.3):
    // pattern/color -> accept on high|medium; foil (or unknown) -> high only.
    const accepted =
      kind === 'foil'
        ? confidence === 'high'
        : confidence === 'high' || confidence === 'medium';

    if (!accepted) {
      console.log(`[ParallelVision] Rejected pick "${picked.row.variantText}" (kind=${kind}, confidence=${confidence}) — keeping base default. Observed: ${observed}`);
      return null;
    }

    console.log(`[ParallelVision] Adopted "${picked.row.variantText}" (kind=${kind}, confidence=${confidence}). Observed: ${observed}`);
    return {
      productId: picked.row.id,
      variantText: picked.row.variantText,
      confidence,
      observed,
    };
  } catch (error: any) {
    console.log(`[ParallelVision] Error (non-fatal, keeping base default): ${error?.message || error}`);
    return null;
  }
}

// ============================================================================
// Defensive JSON parsing
// ============================================================================

function parseVisionJson(raw: string): {
  choiceIndex: number;
  confidence: 'high' | 'medium' | 'low';
  observed: string;
} | null {
  try {
    // Strip markdown code fences if present
    let text = raw.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    // If there's surrounding prose, grab the first {...} block
    if (!text.startsWith('{')) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      text = match[0];
    }
    const obj = JSON.parse(text);
    const choiceIndex = Number(obj.choiceIndex);
    const confidence =
      obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low'
        ? obj.confidence
        : 'low';
    const observed = typeof obj.observed === 'string' ? obj.observed : '';
    if (!Number.isFinite(choiceIndex)) return null;
    return { choiceIndex, confidence, observed };
  } catch {
    return null;
  }
}
