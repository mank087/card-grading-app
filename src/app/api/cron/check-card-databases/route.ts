/**
 * GET /api/cron/check-card-databases  (Vercel cron, weekly Monday 04:00 UTC)
 *
 * Card-database freshness watchdog. The internal card databases (mtg_cards,
 * lorcana_cards, onepiece_cards, yugioh_cards, pokemon_cards) are populated by
 * one-shot import scripts (scripts/import-*-database.js) with nothing keeping
 * them current — a new set release silently degrades card identification until
 * someone remembers to re-import.
 *
 * This cron compares each database against its external source at SET level
 * (cheap: a handful of HEAD-count queries per game) and emails the admin when
 * a set is missing or partial, naming the exact import script to run. The
 * import scripts are all upserts (onConflict: 'id'), so re-running them is
 * always safe.
 *
 * It deliberately does NOT auto-import: schema drift in an external API should
 * fail loudly in a supervised script run, not silently corrupt production data.
 *
 * Auth: Vercel cron sends Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;

const UA = { 'User-Agent': 'DCMGrading/1.0 (db-freshness-cron)', Accept: 'application/json' };

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function internalCount(
  table: string,
  filter?: (q: any) => any
): Promise<number> {
  const supabase = serviceClient();
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function fetchJson(url: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { ...UA, ...extraHeaders } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** MTG: newest 10 released, non-digital Scryfall sets must exist with full counts */
async function checkMtg(issues: string[], summary: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const sets = await fetchJson('https://api.scryfall.com/sets');
  const released = (sets.data || [])
    .filter((s: any) => s.released_at <= today && !s.digital && s.card_count > 0)
    .sort((a: any, b: any) => b.released_at.localeCompare(a.released_at))
    .slice(0, 10);
  for (const s of released) {
    const count = await internalCount('mtg_cards', q => q.eq('set_code', s.code));
    if (count === 0) {
      issues.push(`MTG: set "${s.name}" (${s.code}, ${s.released_at}, ${s.card_count} cards) is MISSING → run: node scripts/import-mtg-database.js`);
    } else if (count < s.card_count) {
      issues.push(`MTG: set "${s.name}" (${s.code}) is PARTIAL — ${count}/${s.card_count} cards → run: node scripts/import-mtg-database.js`);
    }
  }
  summary.push(`MTG: checked ${released.length} newest Scryfall sets`);
}

/** Lorcana: newest 6 released Lorcast sets must have cards internally */
async function checkLorcana(issues: string[], summary: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const sets = await fetchJson('https://api.lorcast.com/v0/sets');
  const released = (sets.results || sets.data || [])
    .filter((s: any) => (s.released_at || '9999') <= today)
    .sort((a: any, b: any) => (b.released_at || '').localeCompare(a.released_at || ''))
    .slice(0, 6);
  for (const s of released) {
    const count = await internalCount('lorcana_cards', q => q.ilike('set_name', `%${s.name}%`));
    if (count === 0) {
      issues.push(`Lorcana: set "${s.name}" (${s.released_at}) is MISSING → run: node scripts/import-lorcana-database.js`);
    }
  }
  summary.push(`Lorcana: checked ${released.length} newest Lorcast sets`);
}

/** One Piece: every optcgapi set code must have cards internally (ids are like OP10-092) */
async function checkOnePiece(issues: string[], summary: string[]) {
  const sets = await fetchJson('https://optcgapi.com/api/allSets/');
  const list = Array.isArray(sets) ? sets : sets.data || [];
  const codes = new Set<string>();
  for (const s of list) {
    const raw = String(s.set_id ?? s.id ?? s.code ?? '');
    // "OP-01" → OP01; composite ids like "OP14-EB04" name two sets — check both
    for (const m of raw.matchAll(/(OP|EB|PRB|ST)-?(\d+)/gi)) {
      codes.add(`${m[1].toUpperCase()}${m[2].padStart(2, '0')}`);
    }
  }
  for (const code of codes) {
    const count = await internalCount('onepiece_cards', q => q.ilike('id', `${code}-%`));
    if (count === 0) {
      issues.push(`One Piece: set ${code} is MISSING → run: node scripts/import-onepiece-database.js`);
    }
  }
  summary.push(`One Piece: checked ${codes.size} optcgapi set codes`);
}

/** Yu-Gi-Oh: YGOPRODeck publishes a total card count — internal must not lag it */
async function checkYugioh(issues: string[], summary: string[]) {
  const all = await fetchJson('https://db.ygoprodeck.com/api/v7/cardinfo.php?num=1&offset=0&misc=yes');
  const externalTotal = all?.meta?.total_rows;
  if (typeof externalTotal !== 'number') {
    summary.push('Yu-Gi-Oh: external count unavailable, skipped');
    return;
  }
  const internal = await internalCount('yugioh_cards');
  if (internal < externalTotal) {
    issues.push(`Yu-Gi-Oh: internal has ${internal} cards, YGOPRODeck has ${externalTotal} (${externalTotal - internal} behind) → run: node scripts/import-yugioh-database.js`);
  }
  summary.push(`Yu-Gi-Oh: internal ${internal} vs external ${externalTotal}`);
}

/** Pokemon EN: newest 6 pokemontcg.io sets must have cards internally */
async function checkPokemon(issues: string[], summary: string[]) {
  const apiKey = process.env.POKEMON_TCG_API_KEY || '';
  const sets = await fetchJson(
    'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=6',
    apiKey ? { 'X-Api-Key': apiKey } : {}
  );
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  for (const s of sets.data || []) {
    if ((s.releaseDate || '9999') > today) continue; // unreleased
    const count = await internalCount('pokemon_cards', q => q.ilike('set_name', `%${s.name}%`));
    if (count === 0) {
      issues.push(`Pokemon: set "${s.name}" (${s.releaseDate}, ${s.total} cards) is MISSING → run: node scripts/import-pokemon-database.js`);
    }
  }
  summary.push(`Pokemon: checked ${(sets.data || []).length} newest pokemontcg.io sets`);
}

async function sendAlert(issues: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[cron/check-card-databases] issues found but RESEND_API_KEY missing — skipping email');
    return false;
  }
  const body = {
    from: 'DCM Grading <admin@dcmgrading.com>',
    to: ['admin@dcmgrading.com'],
    subject: `⚠️ Card database out of date — ${issues.length} issue${issues.length === 1 ? '' : 's'} found`,
    html: `
      <h2>Card database freshness check failed</h2>
      <p>The weekly watchdog found internal card databases lagging their external sources.
      Card identification quality degrades for the affected sets until re-imported.
      All import scripts are upserts and safe to re-run.</p>
      <ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
    `,
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issues: string[] = [];
  const summary: string[] = [];
  const checkErrors: string[] = [];

  // Each check is independent — one source being down must not hide the others
  const checks: [string, (i: string[], s: string[]) => Promise<void>][] = [
    ['mtg', checkMtg],
    ['lorcana', checkLorcana],
    ['onepiece', checkOnePiece],
    ['yugioh', checkYugioh],
    ['pokemon', checkPokemon],
  ];
  for (const [name, fn] of checks) {
    try {
      await fn(issues, summary);
    } catch (e: any) {
      checkErrors.push(`${name}: check failed (${e.message})`);
      console.error(`[cron/check-card-databases] ${name} check failed:`, e.message);
    }
  }

  let emailed = false;
  if (issues.length > 0) {
    console.warn(`[cron/check-card-databases] ${issues.length} issue(s):`, issues);
    emailed = await sendAlert(issues);
  } else {
    console.log('[cron/check-card-databases] ✅ All card databases current.', summary.join(' | '));
  }

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    check_errors: checkErrors,
    summary,
    emailed,
    checked_at: new Date().toISOString(),
  });
}
