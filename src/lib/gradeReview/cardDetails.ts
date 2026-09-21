import { z } from 'zod';
import { generateLabelData, type CardForLabel } from '@/lib/labelDataGenerator';

/** What an owner may claim is wrong. Free text; the admin decides what to apply. */
export const detailsClaimSchema = z.object({
  card_name: z.string().trim().max(200).optional(),
  set_name: z.string().trim().max(200).optional(),
  year: z.string().trim().max(200).optional(),
  card_number: z.string().trim().max(200).optional(),
  serial_number: z.string().trim().max(200).optional(),
  other: z.string().trim().max(200).optional(),
}).strict();
export type DetailsClaim = z.infer<typeof detailsClaimSchema>;

/** What an admin applies. Every field optional; blank/omitted means "leave as is". */
export const detailsCorrectionSchema = z.object({
  card_name: z.string().trim().min(1).max(120).optional(),
  set_name: z.string().trim().min(1).max(120).optional(),
  year: z.string().trim().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Year must be YYYY').optional(),
  card_number: z.string().trim().min(1).max(40).optional(),
  manufacturer: z.string().trim().min(1).max(120).optional(),
  /** Print-run serial ("32/325"). "none" (and its synonyms) clears a serial the grader invented. */
  serial_number: z.string().trim().min(1).max(40).optional(),
}).strict();
export type DetailsCorrection = z.infer<typeof detailsCorrectionSchema>;

export const DETAILS_FIELDS = ['card_name', 'set_name', 'year', 'card_number', 'manufacturer', 'serial_number'] as const;
export interface DetailsChange { field: typeof DETAILS_FIELDS[number]; from: string | null; to: string | null }

/** Admin input meaning "this card is not serialized"; stored as null, not as text. */
const NO_SERIAL = /^(none|no|n\/a|na|-|--|no serial|not serialized|not numbered|not present)$/i;

export const DETAILS_COLUMNS = ['card_name', 'card_set', 'card_number', 'release_date', 'featured', 'manufacturer_name',
  'serial_numbering', 'conversational_card_info', 'conversational_grading', 'ai_grading', 'label_data', 'original_label_data'] as const;

const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
const parseMaybe = (v: unknown): Record<string, unknown> | null => {
  if (v == null) return null;
  if (typeof v === 'string') { try { return obj(JSON.parse(v)); } catch { return null; } }
  return obj(v);
};
const str = (v: unknown) => (v == null || v === '' ? null : String(v));

/** Current identification as the admin page shows it, read from the live row. */
export function currentDetails(card: Record<string, unknown>) {
  const info = parseMaybe(card.conversational_card_info) ?? {};
  return {
    card_name: str(card.card_name) ?? str(info.card_name),
    set_name: str(card.card_set) ?? str(info.set_name),
    year: str(card.release_date) ?? str(info.year),
    card_number: str(card.card_number) ?? str(info.card_number),
    manufacturer: str(card.manufacturer_name) ?? str(info.manufacturer),
    serial_number: str(card.serial_numbering) ?? str(info.serial_number),
  };
}

/**
 * Build the column patch for an identification correction. Mirrors every place
 * the grading routes write identity (columns, card-info JSON, the report's
 * card_info block, the legacy ai_grading blob, both label-data columns) so no
 * surface keeps the old identity. Throws 'stale_review' if the card's report no
 * longer matches the run snapshot, 'no_change' if nothing differs.
 */
export function buildDetailsPatch(card: Record<string, unknown>, snapshotReport: string, correction: DetailsCorrection, reviewId: string) {
  const input = detailsCorrectionSchema.parse(correction);
  if (card.conversational_grading !== snapshotReport) throw Error('stale_review');
  const before = currentDetails(card);
  const changes: DetailsChange[] = [];
  for (const field of DETAILS_FIELDS) {
    const raw = input[field];
    if (raw === undefined) continue;
    const to = field === 'serial_number' && NO_SERIAL.test(raw) ? null : raw;
    if (to !== before[field]) changes.push({ field, from: before[field], to });
  }
  if (changes.length === 0) throw Error('no_change');
  const applied = Object.fromEntries(changes.map(c => [c.field, c.to])) as Partial<Record<DetailsChange['field'], string | null>>;

  const columns: Record<string, unknown> = {};
  if (applied.card_name !== undefined) {
    columns.card_name = applied.card_name;
    // Player / character name tracks the card name where they were the same thing.
    if (card.featured == null || card.featured === card.card_name) columns.featured = applied.card_name;
  }
  if (applied.set_name !== undefined) columns.card_set = applied.set_name;
  if (applied.year !== undefined) columns.release_date = applied.year;
  if (applied.card_number !== undefined) columns.card_number = applied.card_number;
  if (applied.manufacturer !== undefined) columns.manufacturer_name = applied.manufacturer;
  if (applied.serial_number !== undefined) columns.serial_numbering = applied.serial_number;

  const note = `Manual correction by the DCM team (review ${reviewId}).`;
  const fixInfo = (raw: Record<string, unknown> | null) => {
    if (!raw) return raw;
    const info: Record<string, unknown> = { ...raw };
    if (applied.card_name !== undefined) { info.card_name = applied.card_name; if (raw.player_or_character == null || raw.player_or_character === raw.card_name) info.player_or_character = applied.card_name; }
    if (applied.set_name !== undefined) info.set_name = applied.set_name;
    if (applied.year !== undefined) { info.year = applied.year; info.year_source = 'manual_correction'; info.year_text_seen = null;
      info._year_guard = { ...obj(raw._year_guard), outcome: 'manually_corrected', source: 'manual_correction', text_seen: null, original_year: str(raw.year), reason: note }; }
    if (applied.card_number !== undefined) { info.card_number = applied.card_number; info.card_number_raw = applied.card_number; info.card_number_text_seen = applied.card_number; info.card_number_source = 'manual_correction'; }
    if (applied.manufacturer !== undefined) info.manufacturer = applied.manufacturer;
    if (applied.serial_number !== undefined) {
      info.serial_number = applied.serial_number;
      // Some older blobs carry the title-cased key instead; correct it wherever it exists.
      if ('Serial Numbering' in info) info['Serial Numbering'] = applied.serial_number;
      info.serial_number_source = 'manual_correction';
    }
    info.manual_details_correction = { review_id: reviewId, changes };
    return info;
  };
  const info = fixInfo(parseMaybe(card.conversational_card_info));
  if (info) columns.conversational_card_info = info;

  const report = parseMaybe(snapshotReport);
  if (!report) throw Error('unsupported_report');
  report.card_info = fixInfo(parseMaybe(report.card_info) ?? {});
  columns.conversational_grading = JSON.stringify(report);

  const ai = parseMaybe(card.ai_grading);
  if (ai && ai['Card Information']) { ai['Card Information'] = fixInfo(parseMaybe(ai['Card Information'])); columns.ai_grading = ai; }

  // Regenerate both label-data blobs from the corrected row, exactly as a grading run would.
  const corrected = { ...card, ...columns } as Record<string, unknown>;
  const label = generateLabelData(corrected as unknown as CardForLabel);
  if (card.label_data != null) columns.label_data = label;
  if (card.original_label_data != null) columns.original_label_data = label;

  const patch = Object.fromEntries(DETAILS_COLUMNS.filter(key => key in columns && key in card).map(key => [key, columns[key]]));
  const expected = Object.fromEntries(Object.keys(patch).map(key => [key, card[key]]));
  return { patch, expected, changes };
}

export const detailsFieldLabels: Record<DetailsChange['field'], string> = {
  card_name: 'Card name', set_name: 'Set', year: 'Year', card_number: 'Card number', manufacturer: 'Manufacturer',
  serial_number: 'Serial number',
};
export const detailsClaimLabels: Record<keyof DetailsClaim, string> = {
  card_name: 'Card name', set_name: 'Set', year: 'Year', card_number: 'Card number', serial_number: 'Serial number', other: 'Other',
};
