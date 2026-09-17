/**
 * FIRST LOOK — the identification contract.
 *
 * One vision call that PROPOSES a card identity for the catalog and the owner
 * to confirm. It is never the final answer (Sept 17 2026 evals: an open
 * question recovered ~40% of owner-corrected set/year errors, but the model's
 * own "high" confidence was right on only 21 of 37 fields, and true parallels
 * were named correctly ~40% of the time whatever the prompt said).
 *
 * The contract exists to stop three shortcuts:
 *   1. CONCLUSION BEFORE EVIDENCE — the schema is ordered observe → transcribe
 *      → identify → parallel, and strict structured output generates in that
 *      order, so every conclusion is written after the evidence it rests on.
 *   2. RECOGNITION PASSED OFF AS READING — every identity field carries a
 *      `source`. "printed" is checked server-side against the transcription;
 *      a value that was not transcribed is downgraded to "recognized".
 *   3. INCONSISTENT SHAPES — every field is required, enums are closed, unknown
 *      is an explicit `null` + source "unknown". No free-form confidence score:
 *      it was measured to be uninformative, so it is not asked for.
 */

export const FIRST_LOOK_VERSION = 'first-look-v1';

const nullableString = { type: ['string', 'null'] } as const;
const SOURCE = ['printed', 'recognized', 'inferred', 'unknown'] as const;
export type FieldSource = (typeof SOURCE)[number];

const field = (description: string) => ({
  type: 'object',
  additionalProperties: false,
  required: ['value', 'source'],
  properties: {
    value: { ...nullableString, description },
    source: {
      type: 'string',
      enum: SOURCE,
      description:
        'printed = these exact characters are in printed_text below. recognized = you know it from the design/artwork/hobby knowledge, it is not printed. inferred = worked out from other printed facts (e.g. last stat year + 1). unknown = value must be null.',
    },
  },
});

/** Strict structured-output schema. Property ORDER is deliberate — do not reorder. */
export const FIRST_LOOK_SCHEMA = {
  name: 'card_first_look',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['photos', 'printed_text', 'identity', 'parallel', 'design_features', 'alternatives'],
    properties: {
      // 1 — what the photos actually show, before anything is concluded from them.
      photos: {
        type: 'object',
        additionalProperties: false,
        required: ['front_shows', 'back_shows', 'card_orientation', 'in_holder', 'text_legibility'],
        properties: {
          front_shows: { type: 'string', enum: ['card_front', 'card_back', 'not_a_card', 'unclear'] },
          back_shows: { type: 'string', enum: ['card_back', 'card_front', 'not_a_card', 'unclear', 'not_supplied'] },
          card_orientation: { type: 'string', enum: ['portrait', 'landscape'] },
          in_holder: { type: 'string', enum: ['none', 'sleeve', 'toploader', 'magnetic_case', 'graded_slab', 'other'] },
          text_legibility: { type: 'string', enum: ['all_readable', 'small_text_unreadable', 'mostly_unreadable'] },
        },
      },
      // 2 — verbatim transcription. No normalising, no completing partial words.
      printed_text: {
        type: 'object',
        additionalProperties: false,
        required: ['front_title_or_name', 'front_other', 'back_header', 'card_number_as_printed', 'copyright_line', 'serial_stamp', 'back_parallel_or_product_text'],
        properties: {
          front_title_or_name: { ...nullableString, description: 'The name/title/caption exactly as printed on the front.' },
          front_other: { ...nullableString, description: 'Other front text: team, position, logos as words, insert name, set logo text. Verbatim, separated by " | ".' },
          back_header: { ...nullableString, description: 'Name/title line on the back, verbatim. null when the back has no text (e.g. a puzzle or art back).' },
          card_number_as_printed: { ...nullableString, description: 'Card/collector number exactly as printed including prefix and set total, e.g. "#7", "116/086", "RA-CS", "OP11-001". NOT a serial stamp.' },
          copyright_line: { ...nullableString, description: 'The copyright / legal line verbatim, e.g. "© 1977 20TH CENTURY-FOX FILM CORP."' },
          serial_stamp: { ...nullableString, description: 'Stamped or foil print-run numbering exactly as it appears, e.g. "23/99", "1/1". null when there is none.' },
          back_parallel_or_product_text: { ...nullableString, description: 'Any back text naming the product line or parallel, e.g. "PRIZM", "REFRACTOR", "1st Edition". Verbatim.' },
        },
      },
      // 3 — normalised identity, one source per field.
      identity: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'subject', 'card_title', 'year', 'manufacturer', 'set_name', 'insert_or_subset', 'card_number', 'language', 'licensed_product'],
        properties: {
          category: { type: 'string', enum: ['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other_tcg', 'entertainment_non_sport', 'custom_or_unlicensed', 'unknown'] },
          subject: field('Player, character or subject name in standard catalog form, e.g. "Michael Jordan", "Darth Vader", "Charizard ex".'),
          card_title: field('The card\'s own title when it differs from the subject, e.g. "The villainous Darth Vader". null when the card is simply the subject\'s name.'),
          year: field('The year in the catalog name of the product: "1977", or a season "1995-96" for basketball/hockey. When the only evidence is a copyright date, use that copyright year and source "inferred" — do not shift it by one.'),
          manufacturer: field('The card maker (Topps, Panini, Fleer, Upper Deck, The Pokémon Company, Wizards of the Coast, Bandai, Konami…). NOT a licensor such as a film studio or league.'),
          set_name: field('The PRODUCT LINE only, in one fixed form: NO year, NO sport, and NO manufacturer unless the manufacturer name is itself the product (flagship "Topps", "Fleer", "Donruss", "Bowman"). Correct: "Flair", "Prizm", "Chrome Black", "Resurgence", "Star Wars Series 1", "Scarlet & Violet 151", "Topps". Wrong: "1995-96 Fleer Flair", "Panini Prizm Basketball", "2018-19 Prizm".'),
          insert_or_subset: field('Insert or subset name, e.g. "Hardwood Leaders", "Downtown". null for a base-set card.'),
          card_number: field('Catalog card number without decoration, e.g. "7", "4", "116", "RA-CS".'),
          language: { type: 'string', enum: ['english', 'japanese', 'korean', 'chinese', 'german', 'french', 'italian', 'spanish', 'portuguese', 'other', 'unknown'] },
          licensed_product: { type: 'string', enum: ['licensed', 'custom_or_unlicensed', 'cannot_tell'] },
        },
      },
      // 4 — the parallel is decided from OBSERVED attributes first, named last.
      parallel: {
        type: 'object',
        additionalProperties: false,
        required: ['finish_observed', 'dominant_color_vs_base', 'pattern_observed', 'autograph', 'relic_or_patch', 'serial_denominator', 'is_base', 'parallel_name', 'decided_by'],
        properties: {
          finish_observed: { type: 'string', enum: ['plain_paper_or_gloss', 'chrome_or_refractor_sheen', 'prizm_pattern', 'foil_or_holo', 'textured_or_embossed', 'die_cut', 'cannot_tell'] },
          dominant_color_vs_base: { ...nullableString, description: 'Border/background colour ONLY when it differs from that set\'s base design, e.g. "green", "gold". null when it matches base or you cannot tell.' },
          pattern_observed: { ...nullableString, description: 'The visible refractive pattern in plain words (e.g. "wavy horizontal lines", "cracked ice shards", "small dots"). Describe what is seen; do not name the parallel here. null if none.' },
          autograph: { type: 'string', enum: ['none', 'on_card', 'sticker', 'printed_facsimile', 'cannot_tell'] },
          relic_or_patch: { type: 'boolean' },
          serial_denominator: { type: ['integer', 'null'], description: 'The print run from serial_stamp (99 for "23/99"). null when there is no stamp.' },
          is_base: { type: 'boolean', description: 'true when nothing observed above distinguishes it from the base card. Ordinary glare is not a parallel.' },
          parallel_name: { ...nullableString, description: 'Catalog name of the parallel/variation, e.g. "Silver Prizm", "Green Refractor". "Base" when is_base. null when it is clearly not base but you cannot name it.' },
          decided_by: { type: 'string', enum: ['printed_on_card', 'serial_stamp', 'observed_color_or_pattern', 'recognized_design', 'cannot_tell'] },
        },
      },
      // 5 — printed features a condition inspector could mistake for damage.
      design_features: {
        type: 'array',
        maxItems: 6,
        description: 'USUALLY EMPTY. List a feature only when it genuinely LOOKS LIKE damage or a bad photo: printed lines/cracks/wrinkles/wood grain/chart lines (look like creases or scratches), printed specks/stars/snow in a border (look like chipping), text-free puzzle or art backs (look like a cropped photo), deliberately distressed or aged printing. An ordinary coloured border, stat table, photo background or refractor shine is NOT a feature. Never list wear, and never use this to explain away something that might be damage.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['face', 'feature', 'could_be_mistaken_for'],
          properties: {
            face: { type: 'string', enum: ['front', 'back', 'both'] },
            feature: { type: 'string', description: 'e.g. "puzzle-piece artwork fills the entire back, no text", "white stars and specks printed in the blue border", "hardwood-floor photographic background".' },
            could_be_mistaken_for: { type: 'string', enum: ['crease_or_line', 'scratches', 'edge_chipping_or_whitening', 'stain_or_discoloration', 'cropped_or_partial_photo', 'print_defect', 'other'] },
          },
        },
      },
      // 6 — what else it could be. Forces the near-miss into the open instead of a silent pick.
      alternatives: {
        type: 'array',
        maxItems: 3,
        description: 'Other printings this could be when the photos do not settle it (same art in another set/year, a sibling parallel). Empty when nothing else is plausible.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['differs_in', 'value', 'what_would_settle_it'],
          properties: {
            differs_in: { type: 'string', enum: ['set_name', 'year', 'parallel', 'card_number', 'language', 'insert_or_subset'] },
            value: { type: 'string' },
            what_would_settle_it: { type: 'string', description: 'The specific thing to look at, e.g. "set symbol under the art", "pattern under angled light".' },
          },
        },
      },
    },
  },
} as const;

export const FIRST_LOOK_PROMPT = `You are identifying one trading card from photos of its front and back, for a catalog lookup and for the owner to confirm. Fill every field of the required JSON, in order.

HOW TO WORK
1. photos — say what each photo shows. Many card backs carry NO text (puzzle pieces, artwork, team logos): that is still a complete card back, not a cropped photo.
2. printed_text — transcribe exactly what is printed. Character for character. Do not normalise, translate, complete a partly hidden word, or add anything you merely know. If you cannot read it, use null.
3. identity — now use everything you know about the hobby. For each field give the catalog-standard value and its source:
   - "printed": the value's characters are in your printed_text transcription.
   - "recognized": you know it from the design, artwork, layout or hobby knowledge; it is not printed on the card. (A 1977 Topps Star Wars card never says "Topps" on the front — the manufacturer is still Topps, source "recognized".)
   - "inferred": derived from another printed fact.
   - "unknown": value null. Use this rather than a guess you would not defend.
   A licensor (film studio, league, players' association) is not the manufacturer.
4. parallel — record the observed attributes FIRST (finish, colour, pattern, autograph, relic, serial), then decide is_base and parallel_name from them. Most cards are base: ordinary glare or a glossy surface is not a parallel. If the card is clearly not base but you cannot tell which sibling parallel it is, set parallel_name to null and put the candidates in alternatives.
5. design_features — leave EMPTY for most cards. Only printed features of this product that genuinely look like damage or a bad photo (printed wrinkles, wood grain, chart lines, specks in a border, a text-free puzzle/art back). Ordinary borders, stat tables and refractor shine do not belong here.
6. alternatives — the other printings it could be, and what would settle it. Before finishing, CHECK YOUR SET AGAINST THE PHOTOS: does the border colour, layout, back design and numbering style you see actually match the set you named? The same subject and year usually exist in several products — the flagship set, stickers, food and retail premiums (bread, cereal, candy, fast-food issues), regional and international issues, reprints and anniversary sets. If any visible trait does not fit the set you named (e.g. a number spelled out as a word, an actor's name under the character, a different border), say so here and name the product it fits better; if that product fits better overall, put IT in identity.

Never state a serial number, card number or year text you did not read. Never leave a field out.`;

export type FirstLookField = { value: string | null; source: FieldSource };
export interface FirstLook {
  photos: { front_shows: string; back_shows: string; card_orientation: string; in_holder: string; text_legibility: string };
  printed_text: Record<'front_title_or_name' | 'front_other' | 'back_header' | 'card_number_as_printed' | 'copyright_line' | 'serial_stamp' | 'back_parallel_or_product_text', string | null>;
  identity: {
    category: string;
    subject: FirstLookField; card_title: FirstLookField; year: FirstLookField; manufacturer: FirstLookField;
    set_name: FirstLookField; insert_or_subset: FirstLookField; card_number: FirstLookField;
    language: string; licensed_product: string;
  };
  parallel: {
    finish_observed: string; dominant_color_vs_base: string | null; pattern_observed: string | null;
    autograph: string; relic_or_patch: boolean; serial_denominator: number | null;
    is_base: boolean; parallel_name: string | null; decided_by: string;
  };
  design_features: Array<{ face: string; feature: string; could_be_mistaken_for: string }>;
  alternatives: Array<{ differs_in: string; value: string; what_would_settle_it: string }>;
}

const IDENTITY_FIELDS = ['subject', 'card_title', 'year', 'manufacturer', 'set_name', 'insert_or_subset', 'card_number'] as const;
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Server-side consistency pass. The model's claims about its OWN evidence are
 * checkable, so check them — and repair rather than reject, recording each repair.
 */
export function normalizeFirstLook(raw: FirstLook): { value: FirstLook; repairs: string[] } {
  const v: FirstLook = JSON.parse(JSON.stringify(raw));
  const repairs: string[] = [];
  const transcript = squash(Object.values(v.printed_text).filter(Boolean).join(' '));

  for (const key of IDENTITY_FIELDS) {
    const f = v.identity[key];
    if (f.value !== null && !String(f.value).trim()) f.value = null;
    if (f.value === null && f.source !== 'unknown') { repairs.push(`${key}: null value → source unknown`); f.source = 'unknown'; }
    if (f.value !== null && f.source === 'unknown') { repairs.push(`${key}: value given with source unknown → recognized`); f.source = 'recognized'; }
    // "printed" must be backed by the transcription.
    if (f.value !== null && f.source === 'printed' && !transcript.includes(squash(f.value))) {
      repairs.push(`${key}: "${f.value}" claimed printed but not in transcription → recognized`);
      f.source = 'recognized';
    }
  }

  // One fixed set_name form: no leading year/season, no trailing sport.
  const sn = v.identity.set_name.value;
  if (sn) {
    const cleaned = sn.replace(/^s*(19|20)d{2}(-d{2})?s+/, '').replace(/s+(baseball|basketball|football|hockey|soccer|racing|golf|wrestling)s*$/i, '').trim();
    if (cleaned && cleaned !== sn) { repairs.push(`set_name "${sn}" → "${cleaned}" (year/sport stripped)`); v.identity.set_name.value = cleaned; }
  }

  // Serial: the denominator must come from the stamp that was read.
  const stamp = v.printed_text.serial_stamp;
  const denom = stamp ? Number((/\/\s*(\d{1,5})\b/.exec(stamp) || [])[1]) : NaN;
  if (!stamp && v.parallel.serial_denominator !== null) { repairs.push('serial_denominator without a serial_stamp → null'); v.parallel.serial_denominator = null; }
  if (stamp && Number.isFinite(denom) && v.parallel.serial_denominator !== denom) { repairs.push(`serial_denominator ${v.parallel.serial_denominator} ≠ stamp "${stamp}" → ${denom}`); v.parallel.serial_denominator = denom; }

  // Base ↔ name must agree, and a serial-numbered / autographed / relic card is not "base".
  const notBaseEvidence = v.parallel.serial_denominator !== null || v.parallel.relic_or_patch || ['on_card', 'sticker'].includes(v.parallel.autograph);
  if (v.parallel.is_base && notBaseEvidence) { repairs.push('is_base true despite serial/autograph/relic → false'); v.parallel.is_base = false; if (/^base$/i.test(v.parallel.parallel_name || '')) v.parallel.parallel_name = null; }
  if (v.parallel.is_base && !/^base$/i.test(v.parallel.parallel_name || '')) { repairs.push(`is_base true but parallel_name "${v.parallel.parallel_name}" → "Base"`); v.parallel.parallel_name = 'Base'; }
  if (!v.parallel.is_base && /^base$/i.test(v.parallel.parallel_name || '')) { repairs.push('parallel_name "Base" with is_base false → null'); v.parallel.parallel_name = null; }
  if (v.parallel.decided_by === 'serial_stamp' && !stamp) { repairs.push('decided_by serial_stamp without a stamp → cannot_tell'); v.parallel.decided_by = 'cannot_tell'; }

  // Year shape: "1977" or "1995-96".
  const y = v.identity.year.value;
  if (y !== null && !/^(19|20)\d{2}(-\d{2})?$/.test(y.trim())) { repairs.push(`year "${y}" is not YYYY or YYYY-YY → null`); v.identity.year = { value: null, source: 'unknown' }; }

  return { value: v, repairs };
}
