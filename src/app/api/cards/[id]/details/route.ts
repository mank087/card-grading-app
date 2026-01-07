import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { generateLabelData } from "@/lib/labelDataGenerator";

// Fields that are protected and cannot be edited
const PROTECTED_FIELDS = [
  'id', 'user_id', 'created_at', 'updated_at',
  'raw_decimal_grade', 'dcm_grade_whole', 'dvg_decimal_grade', 'dvg_whole_grade',
  'conversational_decimal_grade', 'conversational_whole_grade',
  'conversational_condition_label', 'conversational_grading',
  'conversational_sub_scores', 'conversational_weighted_sub_scores',
  'conversational_centering_ratios', 'conversational_image_confidence',
  'ai_grading', 'ai_confidence_score',
  'front_path', 'back_path', 'front_url', 'back_url',
  'estimated_professional_grades', 'grade_numeric'
];

// Validation rules for editable fields
function validateField(field: string, value: any, category?: string): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true }; // Allow empty values for optional fields
  }

  switch (field) {
    case 'card_name':
      if (typeof value !== 'string') return { valid: false, error: 'Card name must be a string' };
      if (value.length > 200) return { valid: false, error: 'Card name must be 200 characters or less' };
      return { valid: true };

    case 'featured':
    case 'card_set':
    case 'manufacturer_name':
      if (typeof value !== 'string') return { valid: false, error: `${field} must be a string` };
      if (value.length > 200) return { valid: false, error: `${field} must be 200 characters or less` };
      return { valid: true };

    case 'card_number':
      if (typeof value !== 'string') return { valid: false, error: 'Card number must be a string' };
      if (value.length > 50) return { valid: false, error: 'Card number must be 50 characters or less' };
      return { valid: true };

    case 'release_date':
      if (typeof value !== 'string') return { valid: false, error: 'Year must be a string' };
      if (value && !/^\d{4}$/.test(value)) return { valid: false, error: 'Year must be a 4-digit number' };
      const year = parseInt(value);
      if (year < 1900 || year > new Date().getFullYear() + 1) {
        return { valid: false, error: 'Year must be between 1900 and next year' };
      }
      return { valid: true };

    case 'serial_numbering':
      if (typeof value !== 'string') return { valid: false, error: 'Serial numbering must be a string' };
      if (value.length > 20) return { valid: false, error: 'Serial numbering must be 20 characters or less' };
      return { valid: true };

    case 'autographed':
    case 'rookie_card':
    case 'first_print_rookie':
    case 'is_foil':
    case 'is_double_faced':
    case 'inkwell':
    case 'is_enchanted':
    // Pokemon special features
    case 'is_first_edition':
    case 'is_shadowless':
    case 'is_reverse_holo':
    case 'is_full_art':
    case 'is_secret_rare':
    case 'is_promo':
    case 'is_error_card':
    case 'is_illustration_rare':
    case 'is_special_art_rare':
    case 'is_hyper_rare':
    case 'is_gold_rare':
    // Sports special features
    case 'is_refractor':
    case 'is_numbered':
    case 'is_patch':
    case 'is_jersey':
    case 'is_game_used':
    case 'is_on_card_auto':
    case 'is_sticker_auto':
    case 'is_variation':
    case 'is_short_print':
    case 'is_case_hit':
      if (typeof value !== 'boolean') return { valid: false, error: `${field} must be a boolean` };
      return { valid: true };

    case 'sport':
    case 'team':
    case 'parallel_type':
      if (typeof value !== 'string') return { valid: false, error: `${field} must be a string` };
      if (value.length > 100) return { valid: false, error: `${field} must be 100 characters or less` };
      return { valid: true };

    case 'hp':
      if (value !== '' && value !== null) {
        const hpNum = parseInt(value);
        if (isNaN(hpNum) || hpNum < 0 || hpNum > 500) {
          return { valid: false, error: 'HP must be a number between 0 and 500' };
        }
      }
      return { valid: true };

    case 'pokemon_type':
    case 'pokemon_stage':
    case 'subset_variant':
      if (typeof value !== 'string') return { valid: false, error: `${field} must be a string` };
      if (value.length > 100) return { valid: false, error: `${field} must be 100 characters or less` };
      return { valid: true };

    case 'holofoil':
      if (!['Yes', 'No', 'Reverse', 'yes', 'no', 'reverse', null, ''].includes(value)) {
        return { valid: false, error: 'Holofoil must be Yes, No, or Reverse' };
      }
      return { valid: true };

    case 'memorabilia_type':
      if (!['none', 'patch', 'jersey', 'bat', 'ticket', 'other', null, ''].includes(value)) {
        return { valid: false, error: 'Invalid memorabilia type' };
      }
      return { valid: true };

    case 'ink_cost':
      if (typeof value === 'number' && (value < 1 || value > 10)) {
        return { valid: false, error: 'Ink cost must be between 1 and 10' };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

// Build the database column updates
function buildColumnUpdates(body: Record<string, any>): Record<string, any> {
  const columnUpdates: Record<string, any> = {};

  // Map request fields to database columns
  const fieldMapping: Record<string, string> = {
    card_name: 'card_name',
    featured: 'featured',
    card_set: 'card_set',
    card_number: 'card_number',
    release_date: 'release_date',
    manufacturer_name: 'manufacturer_name',
    serial_numbering: 'serial_numbering',
    autographed: 'autographed',
    autograph_type: 'autograph_type',
    rookie_card: 'rookie_card',
    first_print_rookie: 'first_print_rookie',
    memorabilia_type: 'memorabilia_type',
    holofoil: 'holofoil',
    is_foil: 'is_foil',
    foil_type: 'foil_type',
    mtg_rarity: 'mtg_rarity',
    is_double_faced: 'is_double_faced',
    mtg_set_code: 'mtg_set_code',
    rarity_tier: 'rarity_tier',
    rarity_description: 'rarity_description',
    // Pokemon-specific columns
    pokemon_type: 'pokemon_type',
    pokemon_stage: 'pokemon_stage',
    hp: 'hp',
  };

  for (const [requestField, dbColumn] of Object.entries(fieldMapping)) {
    if (requestField in body) {
      columnUpdates[dbColumn] = body[requestField] === '' ? null : body[requestField];
    }
  }

  return columnUpdates;
}

// Build the JSONB updates for conversational_card_info
function buildJsonbUpdates(body: Record<string, any>, existingInfo: Record<string, any> | null): Record<string, any> {
  const merged = { ...(existingInfo || {}) };

  // Map request fields to JSONB paths
  const jsonbMapping: Record<string, string> = {
    card_name: 'card_name',
    featured: 'player_or_character',
    card_set: 'set_name',
    card_number: 'card_number_raw',
    release_date: 'year',
    manufacturer_name: 'manufacturer',
    serial_numbering: 'serial_number',
    autographed: 'autographed',
    rookie_card: 'rookie_or_first',
    memorabilia_type: 'memorabilia',
    memorabilia_other: 'memorabilia_other',
    facsimile_autograph: 'facsimile_autograph',
    official_reprint: 'official_reprint',
    holofoil: 'holofoil',
    pokemon_type: 'pokemon_type',
    pokemon_stage: 'pokemon_stage',
    hp: 'hp',
    card_type: 'card_type',
    subset_variant: 'rarity_or_variant',
    is_foil: 'is_foil',
    foil_type: 'foil_type',
    mtg_rarity: 'mtg_rarity',
    is_double_faced: 'is_double_faced',
    mtg_set_code: 'expansion_code',
    ink_color: 'ink_color',
    lorcana_card_type: 'lorcana_card_type',
    character_version: 'character_version',
    inkwell: 'inkwell',
    ink_cost: 'ink_cost',
    is_enchanted: 'is_enchanted',
    rarity_tier: 'rarity_tier',
    rarity_description: 'rarity_description',
    // MTG-specific fields
    mana_cost: 'mana_cost',
    mtg_card_type: 'mtg_card_type',
    creature_type: 'creature_type',
    power_toughness: 'power_toughness',
    color_identity: 'color_identity',
    artist_name: 'artist_name',
    border_color: 'border_color',
    frame_version: 'frame_version',
    language: 'language',
    is_extended_art: 'is_extended_art',
    is_showcase: 'is_showcase',
    is_borderless: 'is_borderless',
    is_retro_frame: 'is_retro_frame',
    is_full_art_mtg: 'is_full_art_mtg',
    // Pokemon special features (stored in JSONB for flexibility)
    is_first_edition: 'is_first_edition',
    is_shadowless: 'is_shadowless',
    is_reverse_holo: 'is_reverse_holo',
    is_full_art: 'is_full_art',
    is_secret_rare: 'is_secret_rare',
    is_promo: 'is_promo',
    is_error_card: 'is_error_card',
    is_illustration_rare: 'is_illustration_rare',
    is_special_art_rare: 'is_special_art_rare',
    is_hyper_rare: 'is_hyper_rare',
    is_gold_rare: 'is_gold_rare',
    // Sports-specific fields (stored in JSONB for flexibility)
    sport: 'sport',
    team: 'team',
    parallel_type: 'parallel_type',
    first_print_rookie: 'first_print_rookie',
    is_refractor: 'is_refractor',
    is_numbered: 'is_numbered',
    is_patch: 'is_patch',
    is_jersey: 'is_jersey',
    is_game_used: 'is_game_used',
    is_on_card_auto: 'is_on_card_auto',
    is_sticker_auto: 'is_sticker_auto',
    is_variation: 'is_variation',
    is_short_print: 'is_short_print',
    is_case_hit: 'is_case_hit',
  };

  for (const [requestField, jsonPath] of Object.entries(jsonbMapping)) {
    if (requestField in body) {
      merged[jsonPath] = body[requestField] === '' ? null : body[requestField];
    }
  }

  // Special handling: subset_variant should also update 'subset' field (used by card detail page)
  if ('subset_variant' in body) {
    merged['subset'] = body.subset_variant === '' ? null : body.subset_variant;
  }

  return merged;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params;

    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // 2. Fetch card and verify ownership
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchError || !card) {
      console.error('[Edit Card Details] Card not found:', fetchError);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: "You do not own this card" }, { status: 403 });
    }

    // 3. Parse request body
    const body = await request.json();

    // 4. Check for protected fields
    for (const field of PROTECTED_FIELDS) {
      if (field in body) {
        return NextResponse.json({
          error: `Field '${field}' cannot be edited`
        }, { status: 400 });
      }
    }

    // 5. Validate all fields
    for (const [field, value] of Object.entries(body)) {
      const validation = validateField(field, value, card.category);
      if (!validation.valid) {
        return NextResponse.json({
          error: validation.error,
          field
        }, { status: 400 });
      }
    }

    // 6. Build updates
    const columnUpdates = buildColumnUpdates(body);
    const jsonbUpdates = buildJsonbUpdates(body, card.conversational_card_info);

    console.log('[Edit Card Details] Request body:', body);
    console.log('[Edit Card Details] Column updates:', columnUpdates);
    console.log('[Edit Card Details] Card ID:', cardId);

    // 7. Update database
    const updatePayload: Record<string, any> = {
      ...columnUpdates,
      conversational_card_info: jsonbUpdates,
    };

    // Only include updates if there are actual changes
    if (Object.keys(columnUpdates).length === 0 && Object.keys(jsonbUpdates).length === 0) {
      return NextResponse.json({
        error: "No changes to save"
      }, { status: 400 });
    }

    console.log('[Edit Card Details] Update payload:', JSON.stringify(updatePayload, null, 2));

    const { error: updateError } = await supabase
      .from('cards')
      .update(updatePayload)
      .eq('id', cardId);

    if (updateError) {
      console.error('[Edit Card Details] Update error:', updateError);
      console.error('[Edit Card Details] Column updates:', columnUpdates);
      console.error('[Edit Card Details] JSONB updates:', jsonbUpdates);
      return NextResponse.json({
        error: "Failed to update card",
        details: updateError.message || updateError.code || JSON.stringify(updateError)
      }, { status: 500 });
    }

    // 8. Fetch updated card
    const { data: updatedCard, error: refetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (refetchError || !updatedCard) {
      console.error('[Edit Card Details] Refetch error:', refetchError);
      return NextResponse.json({ error: "Failed to fetch updated card" }, { status: 500 });
    }

    // 9. Regenerate label data
    let labelData = null;
    try {
      labelData = generateLabelData(updatedCard);

      // Save label data to database
      await supabase
        .from('cards')
        .update({ label_data: labelData })
        .eq('id', cardId);
    } catch (labelError) {
      console.error('[Edit Card Details] Label generation error:', labelError);
      // Continue even if label generation fails
    }

    // 10. Return success response
    return NextResponse.json({
      success: true,
      card: updatedCard,
      label_data: labelData,
      message: "Card details updated successfully"
    });

  } catch (error: any) {
    console.error('[Edit Card Details] Unexpected error:', error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
