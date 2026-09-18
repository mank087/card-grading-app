/**
 * Did first look propose what the owner ended up confirming?
 *
 * READ-ONLY. The question this answers is the one that decides whether first look
 * should ever take identity over from the grading call: on cards an owner has
 * confirmed, compare THREE identities field by field:
 *
 *   owner   — what the card says now, after the owner confirmed or corrected it
 *   grading — what the grading call stored (cards.original_card_info when the
 *             owner edited, else the current value, which the owner confirmed
 *             unchanged)
 *   first   — what first look proposed (cards.first_look)
 *
 * A field counts only when the owner's value is non-blank. "Grading was right"
 * and "first look was right" are then directly comparable on the same field.
 *
 * Usage:
 *   npx tsx scripts/first-look-vs-owners.ts [--days 30] [--limit 500] [--json out.json]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const DAYS = Number(arg('days', '30'));
const LIMIT = Number(arg('limit', '500'));
const OUT = process.argv.includes('--json') ? arg('json', 'first-look-vs-owners.json') : null;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Owner-facing field → where to read it on the card, in the card JSON, and in first look. */
const FIELDS = [
  { key: 'card_name', column: 'card_name', json: ['card_name'], first: 'card_title_or_subject' },
  { key: 'featured', column: 'featured', json: ['player_or_character', 'featured'], first: 'subject' },
  { key: 'set', column: 'card_set', json: ['set_name'], first: 'set_name' },
  { key: 'year', column: 'release_date', json: ['year'], first: 'year' },
  { key: 'card_number', column: 'card_number', json: ['card_number', 'card_number_raw'], first: 'card_number' },
  { key: 'manufacturer', column: 'manufacturer_name', json: ['manufacturer'], first: 'manufacturer' },
  { key: 'parallel', column: null, json: ['parallel_type'], first: 'parallel_name' },
] as const;

const BLANK = new Set(['', 'unknown', 'n/a', 'na', 'none', 'null', 'undefined']);
const clean = (v: unknown): string => {
  const s = String(v ?? '').trim();
  return BLANK.has(s.toLowerCase()) ? '' : s;
};
/** Loose equality: owners type loosely. Case, punctuation and spacing are ignored. */
const same = (a: string, b: string): boolean => {
  const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (!a || !b) return false;
  const [x, y] = [squash(a), squash(b)];
  if (!x || !y) return false;
  // A year may be stored as "1995" against a season "1995-96".
  return x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)));
};

const fromJson = (info: any, keys: readonly string[]): string => {
  for (const key of keys) { const v = clean(info?.[key]); if (v) return v; }
  return '';
};

function firstLookValue(look: any, which: string): string {
  const identity = look?.result?.identity;
  if (!identity) return '';
  if (which === 'card_title_or_subject') return clean(identity.card_title?.value) || clean(identity.subject?.value);
  if (which === 'parallel_name') return clean(look?.result?.parallel?.parallel_name);
  return clean(identity[which]?.value);
}

interface Tally { owner: number; grading: number; first: number; firstOnly: number; gradingOnly: number; neither: number }
const blankTally = (): Tally => ({ owner: 0, grading: 0, first: 0, firstOnly: 0, gradingOnly: 0, neither: 0 });

(async () => {
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('cards')
    .select('id, category, created_at, identity_confirmed_at, card_name, featured, card_set, release_date, card_number, manufacturer_name, conversational_card_info, original_card_info, first_look')
    .not('identity_confirmed_at', 'is', null)
    .gte('identity_confirmed_at', since)
    .order('identity_confirmed_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(error.message);

  const withFirstLook = (data || []).filter(c => (c as any).first_look?.result);
  const byField: Record<string, Tally> = {};
  const byCategory: Record<string, Tally> = {};
  const examples: any[] = [];

  for (const card of withFirstLook) {
    const row = card as any;
    const current = row.conversational_card_info || {};
    // What grading stored: the pre-edit snapshot when the owner changed something,
    // otherwise the current value, which the owner confirmed as correct.
    const gradingInfo = row.original_card_info || current;
    const category = row.category || 'Unknown';
    byCategory[category] ??= blankTally();

    for (const field of FIELDS) {
      const owner = clean(field.column ? row[field.column] : '') || fromJson(current, field.json);
      if (!owner) continue;
      const grading = fromJson(gradingInfo, field.json);
      const first = firstLookValue(row.first_look, field.first);

      byField[field.key] ??= blankTally();
      const gradingRight = same(grading, owner);
      const firstRight = same(first, owner);
      for (const t of [byField[field.key], byCategory[category]]) {
        t.owner++;
        if (gradingRight) t.grading++;
        if (firstRight) t.first++;
        if (firstRight && !gradingRight) t.firstOnly++;
        if (gradingRight && !firstRight) t.gradingOnly++;
        if (!firstRight && !gradingRight) t.neither++;
      }
      if (firstRight !== gradingRight) {
        examples.push({ id: row.id, category, field: field.key, owner, grading: grading || '(blank)', first: first || '(blank)', winner: firstRight ? 'first look' : 'grading' });
      }
    }
  }

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
  console.log(`Owner-confirmed cards in the last ${DAYS} days: ${(data || []).length}; with a first look on file: ${withFirstLook.length}`);
  if (!withFirstLook.length) {
    console.log('Nothing to compare yet. Cards need to be graded with first look on and then confirmed by their owner.');
    return;
  }

  console.log('\nPer field, out of the fields the owner left non-blank:');
  console.table(Object.fromEntries(Object.entries(byField).map(([key, t]) => [key, {
    fields: t.owner,
    'grading right': `${t.grading} (${pct(t.grading, t.owner)})`,
    'first look right': `${t.first} (${pct(t.first, t.owner)})`,
    'first look only': t.firstOnly,
    'grading only': t.gradingOnly,
    'neither': t.neither,
  }])));

  console.log('\nPer category:');
  console.table(Object.fromEntries(Object.entries(byCategory).map(([key, t]) => [key, {
    fields: t.owner, 'grading right': pct(t.grading, t.owner), 'first look right': pct(t.first, t.owner),
    'first look only': t.firstOnly, 'grading only': t.gradingOnly,
  }])));

  console.log('\nWhere they disagreed (first 15):');
  examples.slice(0, 15).forEach(e => console.log(`  ${e.winner === 'first look' ? 'FIRST' : 'GRAD '} ${e.category.padEnd(9)} ${e.field.padEnd(13)} owner "${e.owner}" | grading "${e.grading}" | first look "${e.first}"`));

  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ days: DAYS, confirmedCards: (data || []).length, comparedCards: withFirstLook.length, byField, byCategory, examples }, null, 1));
    console.log(`\nWritten to ${OUT}`);
  }
  console.log('\nHow to read this: "first look only" is what it would have saved the owner correcting by hand.');
  console.log('"grading only" is what it would have cost them. First look should take identity over only when');
  console.log('the first column is clearly larger than the second, per field.');
})().catch(e => { console.error(e.message); process.exit(1); });
