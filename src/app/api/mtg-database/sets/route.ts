import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/mtg-database/sets
 *
 * Get all MTG sets for the dropdown filter
 * Ordered by release date (newest first)
 * Grouped by set type for better UX
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServer();

    const { data, error } = await supabase
      .from('mtg_sets')
      .select('id, code, name, set_type, released_at, card_count, icon_svg_uri')
      .order('released_at', { ascending: false });

    if (error) {
      console.error('[MTG Database API] Sets fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sets', details: error.message },
        { status: 500 }
      );
    }

    const sets = data || [];

    // Group sets by type for better UX
    // MTG set types from Scryfall: expansion, core, masters, draft_innovation,
    // commander, planechase, archenemy, vanguard, funny, starter, box, promo,
    // token, memorabilia, alchemy, arsenal, minigame, spellbook, etc.
    const setsByType: Record<string, any[]> = {
      'Standard Legal': [],
      'Modern/Pioneer': [],
      'Commander Products': [],
      'Masters/Reprint Sets': [],
      'Supplemental': [],
      'Promo': [],
      'Other': []
    };

    // Standard-legal set types
    const standardTypes = ['expansion', 'core'];
    // Modern/Pioneer-eligible (older expansions, modern-era sets)
    const modernTypes = ['expansion', 'core'];
    // Commander products
    const commanderTypes = ['commander'];
    // Reprint/Masters sets
    const mastersTypes = ['masters', 'from_the_vault', 'spellbook', 'premium_deck'];
    // Supplemental/fun products
    const supplementalTypes = ['draft_innovation', 'funny', 'starter', 'box', 'minigame', 'arsenal'];
    // Promo types
    const promoTypes = ['promo', 'token', 'memorabilia'];

    // Determine if a set is Standard-legal (released within ~2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    for (const set of sets) {
      const setType = set.set_type || 'other';
      const releasedAt = set.released_at ? new Date(set.released_at) : null;

      // Categorize by type
      if (standardTypes.includes(setType) && releasedAt && releasedAt >= twoYearsAgo) {
        setsByType['Standard Legal'].push(set);
      } else if (commanderTypes.includes(setType)) {
        setsByType['Commander Products'].push(set);
      } else if (mastersTypes.includes(setType)) {
        setsByType['Masters/Reprint Sets'].push(set);
      } else if (supplementalTypes.includes(setType)) {
        setsByType['Supplemental'].push(set);
      } else if (promoTypes.includes(setType)) {
        setsByType['Promo'].push(set);
      } else if (modernTypes.includes(setType)) {
        // Older expansions/core sets go to Modern/Pioneer
        setsByType['Modern/Pioneer'].push(set);
      } else {
        setsByType['Other'].push(set);
      }
    }

    // Remove empty categories
    Object.keys(setsByType).forEach(key => {
      if (setsByType[key].length === 0) {
        delete setsByType[key];
      }
    });

    return NextResponse.json({
      sets,
      setsByType,
      total: sets.length
    });

  } catch (error: any) {
    console.error('[MTG Database API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
