/**
 * Anniversary badge safety net (Oct 2026).
 *
 * The Classic Collection reprints (30th Celebration me55c, Celebrations cel25c)
 * keep the original printed number and copyright line, so a catalog match by
 * name + number lands on the ORIGINAL printing (Pikachu 58/102 → base1-58,
 * Lugia 149/147 → ecard2-149) unless a read reported the printed badge. When a
 * match (or an unmatched read) has such a "twin" and no read reported a badge,
 * one targeted vision check on the front photo decides:
 *
 *   yes     → re-scope the catalog search to the anniversary set
 *   no      → keep the original printing
 *   unclear → keep it, at LOW confidence, so the owner's identity notice shows
 *
 * The verdict is stored in conversational_card_info.anniversary_badge_check so a
 * re-verification does not pay for the same question twice. Never throws.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { namesAgree } from './nameAgreement';
import {
  ANNIVERSARY_SET_IDS, CLASSIC_SET_IDS, badgeOfSetId, pokemonPrintedNumber, reportedAnniversaryBadge,
  type AnniversaryBadge, type AnniversaryEvidence,
} from '@/lib/pokemonAnniversary';
import { checkAnniversaryBadge, type BadgeAnswer, type BadgeCheckResult } from '@/lib/identification/anniversaryBadgeCheck';
import { displayImagePath } from '@/lib/images/displayPath';

export interface ClassicTwin {
  id: string;
  name: string;
  set_id: string;
  /** As printed on the reprint: the original fraction ("58/102"). */
  printed: string;
  badge: AnniversaryBadge;
}

/** The stored verdict (conversational_card_info.anniversary_badge_check). */
export interface StoredBadgeCheck {
  answer: BadgeAnswer;
  badge: AnniversaryBadge | null;
  where: string | null;
  sparkle_border?: boolean | null;
  /** The printed number the question was asked for; a new number asks again. */
  for_number: string;
  model?: string;
  at: string;
}

function splitPrinted(value: unknown): { number: string; total: string | null } | null {
  const raw = String(value ?? '').trim().replace(/^#\s*/, '');
  if (!raw) return null;
  const [num, total] = raw.split('/').map(s => s?.trim());
  const strip = (s: string) => s.toUpperCase().replace(/^0+(?=\d)/, '');
  if (!num) return null;
  return { number: strip(num), total: total ? strip(total) : null };
}

/** Same printed number: numerators equal, and denominators equal when both are known. */
export function samePrintedFraction(a: unknown, b: unknown): boolean {
  const pa = splitPrinted(a);
  const pb = splitPrinted(b);
  if (!pa || !pb || pa.number !== pb.number) return false;
  return !pa.total || !pb.total || pa.total === pb.total;
}

/** Classic Collection cards with this name and printed number. Pure. */
export function findClassicTwins(name: unknown, printed: unknown, twins: ClassicTwin[]): ClassicTwin[] {
  const n = String(name ?? '').trim();
  if (!n || !String(printed ?? '').trim()) return [];
  // A twin printed without a total (Birthday Pikachu "24") only matches a bare number.
  const bare = (v: unknown) => !String(v ?? '').includes('/');
  return twins.filter(t => samePrintedFraction(printed, t.printed) && (!bare(t.printed) || bare(printed)) && namesAgree(n, t.name).agrees);
}

export type BadgeNetOutcome =
  | { action: 'rescope'; badge: AnniversaryBadge; certain: boolean }
  | { action: 'keep' }
  | { action: 'keep_low' };

type CheckLike = { answer: BadgeAnswer; badge: AnniversaryBadge | null; sparkle_border?: boolean | null };

/**
 * WHICH anniversary a seen badge is. Pure. The badge's two red digits are tiny
 * and the model's read of them flipped between runs on known cards (Oct 12:
 * Lugia 149/147, Uxie, N, Mew VMAX, all 30th-only, were read "25" about half
 * the time), while the badge's PRESENCE was stable. So:
 *   - one possible kind among the candidates → that kind, whatever the digits;
 *   - both (only Charizard 4/102 is in both Classic Collections) → certain only
 *     when the border (2026 reprint: sparkle foil over the whole card; 2021: a
 *     plain yellow border) and the digits agree; otherwise a guess, uncertain.
 */
export function resolveBadgeKind(check: CheckLike, kinds: AnniversaryBadge[]): { badge: AnniversaryBadge; certain: boolean } | null {
  if (check.answer !== 'yes') return null;
  const unique = [...new Set(kinds)];
  if (unique.length === 1) return { badge: unique[0], certain: true };
  // Both kinds: the border and the digits must agree. Each alone was wrong at
  // times in the Oct 12 dry run (a plain-bordered 2021 Charizard called "sparkle").
  const byBorder: AnniversaryBadge | null = check.sparkle_border === true ? '30' : check.sparkle_border === false ? '25' : null;
  if (unique.length > 1 && byBorder && byBorder === check.badge) return { badge: byBorder, certain: true };
  const guess = check.badge ?? byBorder;
  return guess ? { badge: guess, certain: false } : null;
}

/**
 * What a verdict means for the match. Pure. A failed check (null) keeps the
 * match untouched (and is not stored, so the next verification asks again).
 * "yes" whose kind cannot be settled, or "unclear": keep at low confidence.
 */
export function badgeNetOutcome(check: CheckLike | null, twins: ClassicTwin[]): BadgeNetOutcome {
  if (!check || check.answer === 'no') return { action: 'keep' };
  const kind = resolveBadgeKind(check, twins.map(t => t.badge));
  if (kind && twins.some(t => t.badge === kind.badge)) return { action: 'rescope', ...kind };
  return { action: 'keep_low' };
}

/**
 * Should the vision question be asked at all? Pure. Only when there is a twin,
 * no read reported a badge, the match is not already an anniversary card, and
 * the owner has not confirmed the identity.
 */
export function needsBadgeCheck(input: {
  info: AnniversaryEvidence | null | undefined;
  matchedSetId: string | null | undefined;
  twins: ClassicTwin[];
  ownerConfirmed: boolean;
}): boolean {
  if (input.ownerConfirmed || !input.twins.length) return false;
  if (reportedAnniversaryBadge(input.info)) return false;
  // A Trick or Trade pumpkin stamp is a different printing of the ORIGINAL card.
  if (input.info?.printed_badge === 'pumpkin' || input.info?.first_look_printed_badge === 'pumpkin') return false;
  if (input.matchedSetId && ANNIVERSARY_SET_IDS.includes(input.matchedSetId)) return false;
  return true;
}

/** A stored verdict still answers the question for this printed number. */
export function reusableCheck(stored: unknown, printed: unknown): StoredBadgeCheck | null {
  const s = stored as StoredBadgeCheck | null | undefined;
  if (!s || typeof s !== 'object' || !['yes', 'no', 'unclear'].includes(s.answer)) return null;
  return samePrintedFraction(s.for_number, printed) ? s : null;
}

let twinCache: { at: number; twins: ClassicTwin[] } | null = null;
const TWIN_CACHE_MS = 6 * 60 * 60 * 1000;

/** The Classic Collection cards from the catalog (55 rows), cached in memory. */
export async function loadClassicTwins(supabase: SupabaseClient<any, any, any>): Promise<ClassicTwin[]> {
  if (twinCache && Date.now() - twinCache.at < TWIN_CACHE_MS) return twinCache.twins;
  try {
    const { data, error } = await supabase.from('pokemon_cards').select('id, name, number, set_id').in('set_id', [...CLASSIC_SET_IDS]).limit(500);
    if (error || !data) return twinCache?.twins ?? [];
    const twins = (data as Array<{ id: string; name: string; number: string; set_id: string }>)
      .map(r => ({ id: r.id, name: r.name, set_id: r.set_id, printed: pokemonPrintedNumber(r.id, String(r.number), 0), badge: badgeOfSetId(r.set_id) }))
      .filter((t): t is ClassicTwin => !!t.badge);
    twinCache = { at: Date.now(), twins };
    return twins;
  } catch {
    return twinCache?.twins ?? [];
  }
}

/** Test hook. */
export function resetClassicTwinCache(): void { twinCache = null; }

/** The card's front photo (the trimmed display copy when there is one, which is smaller). Never throws. */
export async function loadFrontPhoto(supabase: SupabaseClient<any, any, any>, cardId: string): Promise<Buffer | null> {
  try {
    const { data: row } = await supabase.from('cards').select('front_path, display_crop:capture_quality->display').eq('id', cardId).maybeSingle();
    const path = displayImagePath(row as any, 'front');
    if (!path) return null;
    const { data: blob, error } = await supabase.storage.from('cards').download(path);
    if (error || !blob) return null;
    return Buffer.from(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

export function toStoredCheck(result: BadgeCheckResult, printed: string): StoredBadgeCheck {
  return { answer: result.answer, badge: result.badge, where: result.where, sparkle_border: result.sparkle_border, for_number: printed, model: result.model, at: new Date().toISOString() };
}

/**
 * Run the net for one card: twins → stored verdict or one vision check →
 * outcome. Returns null when the net does not apply. Never throws.
 */
export async function runBadgeNet(
  supabase: SupabaseClient<any, any, any>,
  cardId: string,
  input: {
    info: AnniversaryEvidence | null | undefined;
    name: string | null | undefined;
    printed: string | null | undefined;
    matchedSetId: string | null | undefined;
    ownerConfirmed: boolean;
    stored: unknown;
  },
  deps: { check?: typeof checkAnniversaryBadge; loadFront?: typeof loadFrontPhoto; loadTwins?: typeof loadClassicTwins } = {},
): Promise<{ outcome: BadgeNetOutcome; twins: ClassicTwin[]; stored: StoredBadgeCheck | null; fresh: boolean } | null> {
  try {
    const twins = findClassicTwins(input.name, input.printed, await (deps.loadTwins ?? loadClassicTwins)(supabase));
    if (!needsBadgeCheck({ info: input.info, matchedSetId: input.matchedSetId, twins, ownerConfirmed: input.ownerConfirmed })) return null;
    const printed = String(input.printed);
    const reused = reusableCheck(input.stored, printed);
    if (reused) return { outcome: badgeNetOutcome(reused, twins), twins, stored: reused, fresh: false };
    const front = await (deps.loadFront ?? loadFrontPhoto)(supabase, cardId);
    const result = front ? await (deps.check ?? checkAnniversaryBadge)(front, { cardId }) : null;
    const stored = result ? toStoredCheck(result, printed) : null;
    return { outcome: badgeNetOutcome(result, twins), twins, stored, fresh: !!result };
  } catch (err: any) {
    console.warn(`[badge-net] ${cardId}: ${err?.message || err}`);
    return null;
  }
}
