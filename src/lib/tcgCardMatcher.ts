// src/lib/tcgCardMatcher.ts
// Identification matching against the generic TCG database (tcg_cards),
// covering franchises graded under "Other": Digimon, Dragon Ball Fusion
// World, Union Arena, Gundam, Riftbound. Data: apitcg GitHub repos via
// scripts/import-tcg-database.js.
//
// These games print unambiguous card codes (BT2-001, FB01-001, UA01BT-001,
// GD01-001), so matching is code-first, scoped to a game when the upload
// sub-category names one.

import { supabaseServer } from './supabaseServer';

export interface TcgCard {
  game: string;
  code: string;
  name: string | null;
  set_id: string | null;
  set_name: string | null;
  rarity: string | null;
  card_type: string | null;
  image_small: string | null;
  image_large: string | null;
}

export interface TcgMatchResult {
  card: TcgCard | null;
  confidence: 'high' | 'medium' | 'low';
  matchedBy: 'code_in_game' | 'code_unique_global' | 'name_in_game' | 'none';
  warnings: string[];
}

/** Upload sub-category → tcg_cards.game */
export const SUB_CATEGORY_TO_GAME: Record<string, string> = {
  'Digimon': 'digimon',
  'Dragon Ball': 'dragon-ball-fusion',
  'Union Arena': 'union-arena',
};

/** Human display name per game (for set_name prefixes etc.) */
export const GAME_DISPLAY: Record<string, string> = {
  digimon: 'Digimon TCG',
  'dragon-ball-fusion': 'Dragon Ball Fusion World',
  'union-arena': 'Union Arena',
  gundam: 'Gundam Card Game',
  riftbound: 'Riftbound',
};

export function normalizeTcgCode(value: string): string {
  return value.trim().toUpperCase().replace(/[·—–\s]+/g, '-').replace(/-+/g, '-');
}

/** Does the value look like one of these games' card codes? */
export function looksLikeTcgCode(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = normalizeTcgCode(value);
  // BT2-001 / ST1-05 / EX4-012 (digimon), FB01-001 / FS01-01 (dbf),
  // UA01BT/HTR-1-001 compound or HTR-1-001 series style (union arena),
  // GD01-001 (gundam), OGN-001 etc. (riftbound)
  return /^(BT|ST|EX|P|RB|FB|FS|FP|GD|EXB|OGN|OGS)\d*-\d+/i.test(v) ||
    /^UA\d{2}[A-Z]{2}[/-]/i.test(v) ||
    /^[A-Z]{2,4}-\d{1,2}-(AP)?\d{1,3}/i.test(v);
}

/**
 * Find a card from AI-extracted info.
 * game (from the upload sub-category) scopes the search when known.
 */
export async function lookupTcgCard(aiInfo: {
  card_number?: string | null;
  card_name?: string | null;
  game?: string | null;
}): Promise<TcgMatchResult> {
  const supabase = supabaseServer();
  const warnings: string[] = [];
  const none: TcgMatchResult = { card: null, confidence: 'low', matchedBy: 'none', warnings };

  const rawNumber = aiInfo.card_number || null;
  const game = aiInfo.game || null;

  if (rawNumber) {
    const code = normalizeTcgCode(rawNumber);
    // Union Arena prints compound codes ("UA01BT/HTR-1-001") while the DB
    // stores the series segment ("HTR-1-001") — try each slash segment too.
    const candidates = [code, ...(code.includes('/') ? code.split('/').map(s => s.trim()).filter(Boolean) : [])];

    for (const candidate of candidates) {
      // Code within the known game — definitive
      if (game) {
        const { data } = await supabase
          .from('tcg_cards')
          .select('*')
          .eq('game', game)
          .eq('code', candidate)
          .maybeSingle();
        if (data) {
          if (candidate !== code) warnings.push(`Matched code segment "${candidate}" of "${rawNumber}"`);
          return { card: data as TcgCard, confidence: 'high', matchedBy: 'code_in_game', warnings };
        }
      }

      // Code across all games — accept only if globally unique
      const { data: global } = await supabase
        .from('tcg_cards')
        .select('*')
        .eq('code', candidate)
        .limit(2);
      if (global && global.length === 1) {
        if (candidate !== code) warnings.push(`Matched code segment "${candidate}" of "${rawNumber}"`);
        if (game && global[0].game !== game) {
          warnings.push(`Code found in ${global[0].game}, not the selected ${game} — trusting the code`);
        }
        return { card: global[0] as TcgCard, confidence: game && global[0].game === game ? 'high' : 'medium', matchedBy: 'code_unique_global', warnings };
      }
      if (global && global.length > 1) {
        warnings.push(`Code "${candidate}" exists in multiple games — game selection required`);
      }
    }
    if (game) warnings.push(`Code "${code}" not found in ${game}`);
  }

  // Name within a known game — accept only if unique
  if (game && aiInfo.card_name && aiInfo.card_name.trim().length >= 3) {
    const sanitized = aiInfo.card_name.replace(/[\\"]/g, '');
    const { data: byName } = await supabase
      .from('tcg_cards')
      .select('*')
      .eq('game', game)
      .ilike('name', sanitized)
      .limit(2);
    if (byName && byName.length === 1) {
      warnings.push(`Matched by unique name within ${game}`);
      return { card: byName[0] as TcgCard, confidence: 'medium', matchedBy: 'name_in_game', warnings };
    }
  }

  return none;
}
