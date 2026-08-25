// src/lib/narutoCardMatcher.ts
// Identification matching against the local Kayou Naruto database
// (naruto_cards / naruto_sets, imported from narutodb.com by
// scripts/import-naruto-database.js).
//
// Kayou card numbers are highly structured, e.g. "NRSA01-SE-001L5":
//   set NRSA01 · rarity SE · slot 001 · tier L5
// Customers' photos usually show the full code, so number-first matching is
// far more reliable here than name-based matching.

import { supabaseServer } from './supabaseServer';
import { findUniqueDigitVariant } from './cardNumberUtils';

export interface NarutoCard {
  card_number: string;
  set_id: string | null;
  rarity_code: string | null;
  slot_number: number | null;
  l_tier: string | null;
  serial_text: string | null;
  character_name: string | null;
  character_title: string | null;
  featured_characters: string[] | null;
  is_promo: boolean;
  image_thumb_url: string | null;
  image_front_url: string | null;
  image_is_stand_in: boolean;
}

export interface NarutoSet {
  id: string;
  name: string;
  subtitle: string | null;
  story_arc: string | null;
  release_instore: string | null;
  total_cards: number;
}

export interface NarutoMatchResult {
  card: NarutoCard | null;
  set: NarutoSet | null;
  confidence: 'high' | 'medium' | 'low';
  matchedBy: 'exact_number' | 'number_no_tier' | 'set_slot' | 'character' | 'none';
  warnings: string[];
}

/**
 * Does this look like a Kayou Naruto card number?
 * Matches NA codes (NRSA01-SE-001L5) and Chinese-line codes (NR-BP-016,
 * NRZ06-SSR-135L3, T4W6-...), tolerating ·/–/space separators.
 */
export function looksLikeKayouNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(NR[A-Z]{0,2}\d*|T\d+W\d+|QR)[-·—–\s]/i.test(value.trim());
}

/**
 * Normalize a Kayou card number for matching:
 * - unify separators (· — – space) to "-"
 * - uppercase
 * e.g. "nrsa01·se·001l5" → "NRSA01-SE-001L5"
 */
export function normalizeKayouNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[·—–\s]+/g, '-').replace(/-+/g, '-');
}

async function getSet(setId: string | null): Promise<NarutoSet | null> {
  if (!setId) return null;
  const supabase = supabaseServer();
  const { data } = await supabase.from('naruto_sets').select('*').eq('id', setId).maybeSingle();
  return (data as NarutoSet) || null;
}

/**
 * Main lookup: find a Kayou Naruto card from AI-extracted info.
 * Strategy order mirrors reliability: exact number → number without the
 * L-tier suffix → set+rarity+slot decomposition → character name.
 */
export async function lookupNarutoCard(aiInfo: {
  card_number?: string | null;
  card_name?: string | null;
  character_name?: string | null;
}): Promise<NarutoMatchResult> {
  const supabase = supabaseServer();
  const warnings: string[] = [];
  const none: NarutoMatchResult = { card: null, set: null, confidence: 'low', matchedBy: 'none', warnings };

  const rawNumber = aiInfo.card_number || null;
  // Aug 25 2026: a number hit must agree with the character the model READ.
  // A misread Kayou number lands on a real but different card; before this the
  // exact/prefix strategies returned it at 'high' with no name check and the
  // route renamed the card (no pre-override snapshot to recover from).
  const aiName = String(aiInfo.character_name || aiInfo.card_name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const nameAgrees = (row: any): boolean => {
    if (!aiName) return true; // nothing to check against
    const rowName = String(row?.character_name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!rowName) return true;
    if (rowName.includes(aiName) || aiName.includes(rowName)) return true;
    const a = new Set(aiName.split(' ')), b = rowName.split(' ');
    return b.some(w => w.length >= 3 && a.has(w));
  };
  const rejectNumberHit = (row: any, how: string) => {
    warnings.push(`Number ${rawNumber} (${how}) found "${row?.character_name}" but AI identified "${aiInfo.character_name || aiInfo.card_name}" — name mismatch, number hit rejected`);
  };

  if (rawNumber) {
    const normalized = normalizeKayouNumber(rawNumber);

    // Strategy 1: exact card number
    const { data: exact } = await supabase
      .from('naruto_cards')
      .select('*')
      .eq('card_number', normalized)
      .maybeSingle();
    if (exact && !nameAgrees(exact)) rejectNumberHit(exact, 'exact');
    if (exact && nameAgrees(exact)) {
      return {
        card: exact as NarutoCard,
        set: await getSet(exact.set_id),
        confidence: 'high',
        matchedBy: 'exact_number',
        warnings,
      };
    }

    // Strategy 2: number without the L-tier suffix (AI often misses "L5")
    const noTier = normalized.replace(/L\d+$/i, '');
    if (noTier && noTier !== normalized) {
      const { data: tierless } = await supabase
        .from('naruto_cards')
        .select('*')
        .ilike('card_number', `${noTier}%`)
        .limit(2);
      if (tierless && tierless.length === 1 && !nameAgrees(tierless[0])) rejectNumberHit(tierless[0], 'tier-stripped');
      if (tierless && tierless.length === 1 && nameAgrees(tierless[0])) {
        warnings.push(`Matched ignoring tier suffix: "${rawNumber}" → "${tierless[0].card_number}"`);
        return {
          card: tierless[0] as NarutoCard,
          set: await getSet(tierless[0].set_id),
          confidence: 'high',
          matchedBy: 'number_no_tier',
          warnings,
        };
      }
    } else {
      // AI may have dropped the tier entirely — prefix search
      const { data: prefixed } = await supabase
        .from('naruto_cards')
        .select('*')
        .ilike('card_number', `${normalized}%`)
        .limit(2);
      if (prefixed && prefixed.length === 1 && !nameAgrees(prefixed[0])) rejectNumberHit(prefixed[0], 'prefix');
      if (prefixed && prefixed.length === 1 && nameAgrees(prefixed[0])) {
        warnings.push(`Matched by number prefix: "${rawNumber}" → "${prefixed[0].card_number}"`);
        return {
          card: prefixed[0] as NarutoCard,
          set: await getSet(prefixed[0].set_id),
          confidence: 'high',
          matchedBy: 'number_no_tier',
          warnings,
        };
      }
    }

    // Strategy 3: decompose SET-RARITY-SLOT and match components
    const m = normalized.match(/^([A-Z0-9]+)-([A-Z]+)-0*(\d+)/);
    if (m) {
      const [, setCode, rarity, slot] = m;
      const { data: bySlot } = await supabase
        .from('naruto_cards')
        .select('*')
        .eq('set_id', setCode)
        .eq('rarity_code', rarity)
        .eq('slot_number', parseInt(slot, 10))
        .limit(2);
      if (bySlot && bySlot.length === 1) {
        warnings.push(`Matched by set/rarity/slot decomposition of "${rawNumber}"`);
        return {
          card: bySlot[0] as NarutoCard,
          set: await getSet(bySlot[0].set_id),
          confidence: 'medium',
          matchedBy: 'set_slot',
          warnings,
        };
      }
    }

    // Single-digit misread rescue: if the character name matches cards and
    // EXACTLY ONE has a card number one character off from the AI's number,
    // correct to it (OCR-class misread).
    const rescueName = aiInfo.character_name || aiInfo.card_name;
    if (rescueName && rescueName.trim().length >= 3) {
      const { data: charCards } = await supabase
        .from('naruto_cards')
        .select('*')
        .ilike('character_name', `%${rescueName.replace(/[\\"]/g, '')}%`)
        .limit(25);
      const variant = findUniqueDigitVariant(
        (charCards || []) as NarutoCard[],
        c => normalizeKayouNumber(c.card_number),
        normalizeKayouNumber(rawNumber)
      );
      if (variant) {
        warnings.push(`Card number corrected from "${rawNumber}" to "${variant.card_number}" (single-digit misread; character matched)`);
        return {
          card: variant,
          set: await getSet(variant.set_id),
          confidence: 'high',
          matchedBy: 'number_no_tier',
          warnings,
        };
      }
    }

    warnings.push(`Card number "${rawNumber}" not found in naruto_cards (may be a Chinese-line set not yet imported)`);
  }

  // Strategy 4: character name (low confidence — many cards per character)
  const name = aiInfo.character_name || aiInfo.card_name;
  if (name && name.trim().length >= 3) {
    const sanitized = name.replace(/[\\"]/g, '');
    const { data: byChar } = await supabase
      .from('naruto_cards')
      .select('*')
      .ilike('character_name', `%${sanitized}%`)
      .limit(5);
    if (byChar && byChar.length === 1) {
      warnings.push(`Single character-name match for "${name}"`);
      return {
        card: byChar[0] as NarutoCard,
        set: await getSet(byChar[0].set_id),
        confidence: 'medium',
        matchedBy: 'character',
        warnings,
      };
    }
    if (byChar && byChar.length > 1) {
      warnings.push(`Character "${name}" matches ${byChar.length}+ cards — number required to pin down`);
    }
  }

  return none;
}
