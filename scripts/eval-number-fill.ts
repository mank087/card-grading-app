/**
 * Offline replay of the first-look blank-number fill. READ-ONLY, no model calls.
 *
 *  A. Cards where the grading call left the number blank and the owner filled it
 *     (card_identity_history): would the fill have fired, and with the owner's number?
 *  B. Recent cards nobody has edited that still have no number: how many get one?
 *  C. Safety: recent cards that DO have a grading number — the fill must never fire.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '../../.env.local' });
import { createClient } from '@supabase/supabase-js';
import { fillBlankNumberFromFirstLook as rawFill } from '../src/lib/identification/firstLookNumberFill';
import { applyCardNumberGuard } from '../src/lib/cardNumberGuard';

/** Fill, then the guard the sports/other/Star Wars/Yu-Gi-Oh routes run afterwards: what a route would KEEP. */
const GUARDED = new Set(['Sports', 'Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Other', 'Star Wars', 'Yu-Gi-Oh']);
let currentCategory = '';
const quiet = <T,>(fn: () => T): T => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
function fillBlankNumberFromFirstLook(info: Record<string, any>, look: any) {
  const fill = rawFill(info, look);
  if (!fill.filled || !GUARDED.has(currentCategory)) return fill;
  quiet(() => applyCardNumberGuard(info, 'replay', { category: currentCategory }));
  return info.card_number ? fill : { filled: false };
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const blank = (v: any) => !String(v ?? '').trim() || /^(unknown|n\/a|none|null)$/i.test(String(v).trim());
const WORDS: Record<string, string> = { one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15' };
const canon = (v: unknown) => { let s = String(v ?? '').trim().toLowerCase().replace(/^(?:#|no\.?|number)\s*(?=[a-z]*\d)/, ''); if (WORDS[s]) s = WORDS[s]; s = s.replace(/\s+of\s+/g, '/'); return s.split('/').map(p => p.replace(/^[curmlstb]\s+(?=\d)/, '').replace(/[^\p{L}\p{N}]+/gu, '').replace(/(?<![0-9])0+(?=[0-9])/g, '')); };
const matches = (a: unknown, b: unknown) => { const [x, y] = [canon(a), canon(b)]; if (!x[0] || !y[0]) return false; if (x.join('/') === y.join('/')) return true; return x[0] === y[0] && (x.length === 1 || y.length === 1); };
const FL = 'photos:first_look->result->photos, printed_text:first_look->result->printed_text, identity:first_look->result->identity';
const lookOf = (r: any) => (r.identity ? { photos: r.photos, printed_text: r.printed_text, identity: r.identity } as any : null);
const pct = (n: number, d: number) => `${n}/${d} (${d ? Math.round(100 * n / d) : 0}%)`;

(async () => {
  const { data: hist, error } = await db.from('card_identity_history').select('card_id, before, after').contains('changed_fields', ['card_number']).order('created_at', { ascending: false }).limit(600);
  if (error) throw new Error(error.message);
  const truth = new Map<string, string>();
  for (const r of hist || []) if (blank((r.before as any)?.card_number) && !blank((r.after as any)?.card_number) && !truth.has(r.card_id)) truth.set(r.card_id, (r.after as any).card_number);
  const ids = [...truth.keys()];
  let fired = 0, right = 0; const wrong: string[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const { data, error: e } = await db.from('cards').select(`id, category, ${FL}`).in('id', ids.slice(i, i + 40));
    if (e) throw new Error(e.message);
    for (const c of data || []) {
      currentCategory = String((c as any).category || '');
      const info: Record<string, any> = { card_number: null };
      const fill = fillBlankNumberFromFirstLook(info, lookOf(c));
      if (!fill.filled) continue;
      fired++;
      if (matches(fill.value, truth.get((c as any).id))) right++;
      else wrong.push(`   ${String((c as any).category).padEnd(9)} fill ${JSON.stringify(fill.value)} | owner ${JSON.stringify(truth.get((c as any).id))}`);
    }
  }
  console.log(`A. grading left the number blank, owner filled it: ${ids.length} cards`);
  console.log(`   the fill would have fired on ${pct(fired, ids.length)}; matched the owner's number on ${pct(right, fired)}`);
  wrong.forEach(w => console.log(w));

  const since = new Date(Date.now() - 96 * 3600 * 1000).toISOString();
  const { data: recent, error: e2 } = await db.from('cards').select(`id, category, card_number, identity_revision, ${FL}`).gte('created_at', since).order('created_at', { ascending: false }).limit(600);
  if (e2) throw new Error(e2.message);
  const untouched = (recent || []).filter((r: any) => r.identity_revision === 0);
  const noNumber = untouched.filter((r: any) => blank(r.card_number));
  const rescued = noNumber.filter((r: any) => { currentCategory = String(r.category || ''); return fillBlankNumberFromFirstLook({ card_number: null }, lookOf(r)).filled; });
  console.log(`\nB. last 96h, cards nobody has edited: ${untouched.length}; with NO card number: ${pct(noNumber.length, untouched.length)}`);
  console.log(`   the fill gives a number to ${pct(rescued.length, noNumber.length)} of those`);
  const byCat: Record<string, number> = {}; for (const r of rescued as any[]) byCat[r.category] = (byCat[r.category] || 0) + 1;
  console.log(`   by category: ${JSON.stringify(byCat)}`);

  const hasNumber = (recent || []).filter((r: any) => !blank(r.card_number));
  const overwrote = hasNumber.filter((r: any) => fillBlankNumberFromFirstLook({ card_number: r.card_number }, lookOf(r)).filled);
  console.log(`\nC. safety: cards that already have a number: ${hasNumber.length}; fill fired on ${overwrote.length} (must be 0)`);
})().catch(e => { console.error(e.message); process.exit(1); });
