/**
 * Catalog links for MTG, Lorcana and One Piece outside the grading route (Sept 2026).
 *
 * 1. After an owner saves identity. The identity_catalog_invalidation trigger
 *    (live in production since Sept 19) clears every catalog link whenever
 *    identity_revision moves, and nothing linked the card again except, since
 *    Sept 24, for Pokemon. Measured Sept 25: of owner-edited cards, 0 of 19 MTG
 *    and 0 of 1 One Piece still had a link, against 67 of 128 and 5 of 8 for
 *    cards nobody edited. The MTG cards had matched at grading; the save wiped it.
 *    relinkCatalog() looks the card up again from the owner's saved identity.
 *
 * 2. After first look lands. The grading route matches from the grading call's
 *    own read; first look reads the card separately and often better (Tim's
 *    1977 Topps: year/set/maker right on 20 of 20). linkFromFirstLook() tries its
 *    read when the graded card is still unlinked and the owner has not confirmed.
 *
 * Link only: neither rewrites a name, set or number that is already stored
 * (first look may fill a BLANK set or number from the catalog card it matched).
 * No single confident match leaves the card as it was. Star Wars has no live
 * catalog (retired Sept 20); Yu-Gi-Oh has no link columns.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { lookupMtgCard } from '@/lib/mtgCardMatcher';
import { lookupLorcanaCard } from '@/lib/lorcanaCardMatcher';
import { lookupOnePieceCard } from '@/lib/onepieceCardMatcher';

export const RELINK_CATEGORIES = ['MTG', 'Lorcana', 'One Piece'] as const;
// Lorcana: cards.lorcana_card_id is a uuid column, but Lorcast ids are text
// ("crd_04d9..."), so the id cannot be stored there (the grading route leaves it
// out too). The reference image and card_info.lorcana_database_id carry the link.
const LINK_COLUMN: Record<string, string> = { MTG: 'mtg_card_id', Lorcana: 'lorcana_reference_image', 'One Piece': 'onepiece_card_id' };

export type RelinkOutcome =
  | { status: 'linked'; catalogId: string; name: string; confidence: string }
  | { status: 'no_match'; reason: string }
  | { status: 'skipped'; reason: string };

const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Same guard the grading routes use: a catalog name must share a 5-character stem with the owner's. */
export function namesCompatible(ownerName: string | null | undefined, ...catalogNames: Array<string | null | undefined>): boolean {
  const a = squash(ownerName);
  if (!a) return false;
  return catalogNames.some(n => {
    const b = squash(n);
    return !!b && (b.includes(a.slice(0, 5)) || a.includes(b.slice(0, 5)));
  });
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/**
 * A saved set, when there is one, must name the catalog printing's set.
 * Tolerates spelling ("Judgement"/"Judgment") and containment ("Final Fantasy" /
 * "Final Fantasy Commander"). Sept 25 dry run: an owner-saved "Teenage Mutant
 * Ninja Turtles" Cytoplast Manipulator matched the Dissension printing.
 */
export function setsAgree(savedSet: string | null | undefined, catalogSet: string | null | undefined): boolean {
  const a = squash(savedSet), b = squash(catalogSet);
  if (!a) return true;
  if (!b) return false;
  return a.includes(b) || b.includes(a) || editDistance(a, b) <= 2;
}

interface Identity { name: string; set: string | null; number: string | null; setCode?: string | null }
interface CatalogHit { id: string; name: string; set: string | null; number: string | null; confidence: string; columns: Record<string, any>; info: Record<string, any> }

/** Look an identity up in the category's catalog and apply every guard. Pure of writes. */
async function matchCatalog(category: string, who: Identity, info: Record<string, any>): Promise<CatalogHit | { reason: string }> {
  if (category === 'MTG') {
    const r = await lookupMtgCard({ card_name: who.name, expansion_code: who.setCode || undefined, card_number: who.number || undefined, set_name: who.set || undefined });
    const db = r.card;
    if (!db || r.confidence.overallConfidence === 'low') return { reason: 'no confident MTG catalog match' };
    if (!namesCompatible(who.name, db.name, db.flavor_name)) return { reason: `catalog name "${db.name}" does not match "${who.name}"` };
    if (!setsAgree(who.set, db.set_name)) return { reason: `catalog set "${db.set_name}" does not match "${who.set}"` };
    const reference = db.image_normal || db.image_large || null;
    return { id: db.id, name: db.name, set: db.set_name ?? null, number: db.collector_number ?? null, confidence: r.confidence.overallConfidence,
      columns: { mtg_card_id: db.id, mtg_reference_image: reference, validated_source: 'mtg_cards', validation_tier: 'exact', validation_confidence: r.confidence.overallConfidence },
      info: { mtg_database_id: db.id, mtg_database_oracle_id: db.oracle_id ?? null, mtg_database_match_confidence: r.confidence.overallConfidence, mtg_reference_image: reference, expansion_code: db.set_code } };
  }
  if (category === 'Lorcana') {
    const r = await lookupLorcanaCard({ setCode: who.setCode || undefined, collectorNumber: who.number || undefined, name: who.name, set: who.set || undefined });
    const db: any = r.card;
    if (!db || r.confidence.overallConfidence === 'low') return { reason: 'no confident Lorcana catalog match' };
    if (!namesCompatible(who.name, db.name, db.full_name)) return { reason: `catalog name "${db.name}" does not match "${who.name}"` };
    if (!setsAgree(who.set, db.set_name)) return { reason: `catalog set "${db.set_name}" does not match "${who.set}"` };
    return { id: String(db.id), name: db.full_name || db.name, set: db.set_name ?? null, number: db.collector_number ?? null, confidence: r.confidence.overallConfidence,
      columns: { lorcana_reference_image: db.image_normal || db.image_large || null, validated_source: 'lorcana_cards', validation_tier: 'exact', validation_confidence: r.confidence.overallConfidence },
      info: { lorcana_database_id: db.id } };
  }
  // One Piece: the printed card id (e.g. OP05-119) is its collector number.
  const r = await lookupOnePieceCard({ cardId: who.number || info.card_id || undefined, name: who.name, set: who.set || undefined });
  const db: any = r.card;
  if (!db || r.confidence.overallConfidence === 'low') return { reason: 'no confident One Piece catalog match' };
  if (!namesCompatible(who.name, db.card_name ?? db.name)) return { reason: `catalog name "${db.card_name ?? db.name}" does not match "${who.name}"` };
  return { id: String(db.id), name: db.card_name ?? db.name, set: db.set_name ?? null, number: db.card_id ?? db.card_number ?? null, confidence: r.confidence.overallConfidence,
    columns: { onepiece_card_id: db.id, onepiece_reference_image: db.card_image || null, validated_source: 'onepiece_cards', validation_tier: 'exact', validation_confidence: r.confidence.overallConfidence },
    info: {} };
}

function parseInfo(raw: unknown): Record<string, any> {
  let info: any = raw;
  if (typeof info === 'string') { try { info = JSON.parse(info); } catch { info = {}; } }
  return info && typeof info === 'object' ? info : {};
}

const CARD_FIELDS = 'id, category, card_name, featured, card_set, card_number, mtg_set_code, conversational_card_info, conversational_whole_grade, grade_status, identity_confirmed_revision, first_look, mtg_card_id, lorcana_reference_image, onepiece_card_id';

/** After an owner save: link from the owner's saved identity. */
export async function relinkCatalog(supabase: SupabaseClient<any, any, any>, cardId: string): Promise<RelinkOutcome> {
  const { data: card, error } = await supabase.from('cards').select(CARD_FIELDS).eq('id', cardId).maybeSingle();
  if (error || !card) return { status: 'skipped', reason: error?.message || 'card not found' };
  if (!(RELINK_CATEGORIES as readonly string[]).includes(card.category)) return { status: 'skipped', reason: `no live catalog link for ${card.category}` };
  const info = parseInfo(card.conversational_card_info);
  const name: string | null = card.card_name || card.featured || info.card_name || null;
  if (!name) return { status: 'no_match', reason: 'no card name to look up' };
  // A set code read at grading still applies only while the owner kept that set.
  const setUnchanged = squash(info.set_name) !== '' && squash(info.set_name) === squash(card.card_set);
  const setCode = card.category === 'MTG' ? (card.mtg_set_code || (setUnchanged ? info.expansion_code : null)) : (setUnchanged ? info.set_code : null);
  const hit = await matchCatalog(card.category, { name, set: card.card_set || null, number: card.card_number || null, setCode }, info);
  if ('reason' in hit) return { status: 'no_match', reason: hit.reason };
  const { error: writeError } = await supabase.from('cards').update({ ...hit.columns, conversational_card_info: { ...info, ...hit.info } }).eq('id', cardId);
  if (writeError) return { status: 'skipped', reason: `link write failed: ${writeError.message}` };
  return { status: 'linked', catalogId: hit.id, name: hit.name, confidence: hit.confidence };
}

/** Does this identity name exactly one catalog card (all the link guards applied)? */
export async function catalogConfirmsIdentity(category: string, who: { name: string; set: string | null; number: string | null }): Promise<boolean> {
  if (!LINK_COLUMN[category]) return false;
  const hit = await matchCatalog(category, who, {});
  return !('reason' in hit);
}

/** First look's read of the card, as an identity to look up. */
export function firstLookIdentity(firstLook: unknown): Identity | null {
  const rec: any = typeof firstLook === 'string' ? (() => { try { return JSON.parse(firstLook); } catch { return null; } })() : firstLook;
  const id = rec?.result?.identity;
  if (!id) return null;
  const v = (k: string) => { const x = id[k]?.value; return typeof x === 'string' && x.trim() ? x.trim() : null; };
  const name = v('card_title') || v('subject');
  return name ? { name, set: v('set_name'), number: v('card_number') } : null;
}

/**
 * After first look lands: link an unlinked, graded, owner-unconfirmed card from
 * first look's read. The stored name must agree (first look must be reading the
 * same card); a blank stored set or number is filled from the matched catalog
 * card. Never throws.
 */
export async function linkFromFirstLook(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  /** Called by the grading route right after its own save, while its lock is still held. */
  opts: { afterGradeSave?: boolean } = {},
): Promise<RelinkOutcome> {
  try {
    const { data: card, error } = await supabase.from('cards').select(CARD_FIELDS).eq('id', cardId).maybeSingle();
    if (error || !card) return { status: 'skipped', reason: error?.message || 'card not found' };
    const linkColumn = LINK_COLUMN[card.category];
    if (!linkColumn) return { status: 'skipped', reason: `no live catalog link for ${card.category}` };
    if ((card as Record<string, any>)[linkColumn]) return { status: 'skipped', reason: 'already linked' };
    if (card.identity_confirmed_revision != null) return { status: 'skipped', reason: 'owner confirmed' };
    if (card.conversational_whole_grade == null || (!opts.afterGradeSave && String(card.grade_status || '').startsWith('processing'))) return { status: 'skipped', reason: 'not graded yet' };
    const read = firstLookIdentity(card.first_look);
    if (!read) return { status: 'skipped', reason: 'no first-look identity' };
    const stored = card.card_name || card.featured;
    if (stored && !namesCompatible(stored, read.name)) return { status: 'no_match', reason: `first look read "${read.name}", stored "${stored}"` };
    const info = parseInfo(card.conversational_card_info);
    const hit = await matchCatalog(card.category, read, info);
    if ('reason' in hit) return { status: 'no_match', reason: hit.reason };
    // A stored set is not overwritten, so the link must agree with it; otherwise the
    // card would name one set and point at another printing (Sept 25 dry run:
    // stored Tales of Middle-earth, first look read The Hobbit).
    if (!setsAgree(card.card_set, hit.set)) return { status: 'no_match', reason: `first look's printing is from "${hit.set}", stored set is "${card.card_set}"` };
    const fills: Record<string, any> = {};
    if (!card.card_set && hit.set) fills.card_set = hit.set;
    if (!card.card_number && hit.number) fills.card_number = hit.number;
    const { error: writeError } = await supabase.from('cards').update({ ...hit.columns, ...fills,
      conversational_card_info: { ...info, ...hit.info, catalog_link_source: 'first_look' } }).eq('id', cardId);
    if (writeError) return { status: 'skipped', reason: `link write failed: ${writeError.message}` };
    return { status: 'linked', catalogId: hit.id, name: hit.name, confidence: hit.confidence };
  } catch (e: any) {
    return { status: 'skipped', reason: `first-look link failed: ${e?.message || e}` };
  }
}
