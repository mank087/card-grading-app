import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { generateLabelData } from "@/lib/labelDataGenerator";
import { isUuid } from "@/lib/uuid";
import { isRecordLocked, LOCKED_RECORD_ERROR } from "@/lib/cards/ownership";
import { saveCardIdentity, IDENTITY_CONTROL_KEYS } from "@/lib/identity/saveCardIdentity";
import { catalogRelinkNeeded, verifyAndSavePokemonCard } from "@/lib/identity/pokemonCatalogLink";

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
      if (!['none', 'patch', 'jersey', 'bat', 'ball', 'glove', 'helmet', 'shoe', 'ticket', 'other', null, ''].includes(value)) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params;

    if (!isUuid(cardId)) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

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

    // 2b. A sold card's identity is frozen. The buyer is holding a slab whose
    // QR resolves to this page — editing the name/set/number after the sale
    // would show them details that don't match what they bought.
    if (isRecordLocked(card)) {
      return NextResponse.json(LOCKED_RECORD_ERROR, { status: 423 });
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

    // 5. Validate all fields. The control keys steer the save and are never
    // card data, so they are held out of validation and of the card-info JSON.
    const confirm = body.confirm === true;
    const dismiss = body.dismiss === true;
    const expectedRevision = body.expected_identity_revision;
    if (expectedRevision !== undefined && expectedRevision !== null
      && (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision))) {
      return NextResponse.json({
        error: 'expected_identity_revision must be an integer',
        field: 'expected_identity_revision'
      }, { status: 400 });
    }

    for (const [field, value] of Object.entries(body)) {
      if ((IDENTITY_CONTROL_KEYS as readonly string[]).includes(field)) continue;
      const validation = validateField(field, value, card.category);
      if (!validation.valid) {
        return NextResponse.json({
          error: validation.error,
          field
        }, { status: 400 });
      }
    }

    // 6-8. One authoritative save: identity, the original-AI snapshot, the
    // confirmation state and the pricing invalidation commit together under a
    // row lock that re-checks ownership and the sold lock at write time.
    console.log('[Edit Card Details] Request body:', body);
    console.log('[Edit Card Details] Card ID:', cardId);

    const saved = await saveCardIdentity(supabase, {
      cardId,
      card,
      body,
      actorId: auth.userId,
      actorRole: 'owner',
      confirm,
      dismiss,
      expectedRevision: expectedRevision ?? null,
    });

    if (saved.status !== 'saved') {
      switch (saved.status) {
        case 'stale':
          return NextResponse.json({
            error: "Someone else updated this card while you were editing. Reload and try again.",
            code: 'identity_revision_conflict',
            identity_revision: saved.currentRevision,
          }, { status: 409 });
        case 'locked':
          return NextResponse.json(LOCKED_RECORD_ERROR, { status: 423 });
        case 'forbidden':
          return NextResponse.json({ error: "You do not own this card" }, { status: 403 });
        case 'not_found':
          return NextResponse.json({ error: "Card not found" }, { status: 404 });
        case 'unavailable':
          return NextResponse.json({
            error: saved.error || "That action is not available yet",
          }, { status: 503 });
        default:
          console.error('[Edit Card Details] Save failed:', saved);
          if (saved.serverError) {
            return NextResponse.json({
              error: "Failed to update card",
              details: saved.error,
            }, { status: 500 });
          }
          return NextResponse.json({
            error: saved.error || "Failed to update card",
            ...(saved.field ? { field: saved.field } : {}),
          }, { status: 400 });
      }
    }

    // 8b. Pokémon catalog link. pokemon_api_* describes the card the grading read
    // named; after the owner changes the name, number or set it may describe a
    // different card (Espeon-GX stayed linked to sm1-152 after the owner's fix).
    // Re-verify from the owner's identity: link-only, it never rewrites what the
    // owner saved, and it clears the link when the new identity has no single
    // catalog card. Other categories' catalog links are left alone for now.
    if (catalogRelinkNeeded(card.category, saved.changedFields)) {
      try {
        const relink = await verifyAndSavePokemonCard(supabase, cardId, { force: true, linkOnly: true, trigger: 'owner-edit' });
        console.log(`[Edit Card Details] Pokemon catalog relink: ${relink.body?.success ? relink.body.pokemon_api_id : 'no single match — link cleared'}`);
      } catch (relinkError: any) {
        console.error('[Edit Card Details] Pokemon catalog relink failed (identity saved):', relinkError?.message);
      }
    }

    // 9. Fetch updated card
    const { data: updatedCard, error: refetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (refetchError || !updatedCard) {
      console.error('[Edit Card Details] Refetch error:', refetchError);
      return NextResponse.json({ error: "Failed to fetch updated card" }, { status: 500 });
    }

    // 10. Regenerate label data
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

    // 10b. Sync identity fields into an existing custom-label override.
    // Custom labels win over label_data at render time, so a customer who
    // customized their label and LATER corrects a wrong field kept printing
    // the old value (customer-reported Jul 27: corrected card number showed
    // everywhere except the label, which had a pre-correction custom label).
    // Only the fields this edit actually changed are synced; the customer's
    // other customizations are preserved. primaryName is synced only when it
    // still matched the pre-edit card name (i.e., was never hand-customized).
    try {
      if (card.custom_label_data && typeof card.custom_label_data === 'object') {
        const custom: Record<string, any> = { ...card.custom_label_data };
        let customChanged = false;
        if ('card_number' in body && custom.cardNumber != null) {
          custom.cardNumber = body.card_number === '' ? null : body.card_number;
          customChanged = true;
        }
        if ('card_set' in body && custom.setName != null) {
          custom.setName = body.card_set === '' ? null : body.card_set;
          customChanged = true;
        }
        if ('release_date' in body && custom.year != null) {
          custom.year = body.release_date === '' ? null : body.release_date;
          customChanged = true;
        }
        if ('card_name' in body && custom.primaryName != null && custom.primaryName === card.card_name) {
          custom.primaryName = body.card_name === '' ? null : body.card_name;
          customChanged = true;
        }
        if (customChanged) {
          await supabase.from('cards').update({ custom_label_data: custom }).eq('id', cardId);
          console.log('[Edit Card Details] Synced edited identity fields into custom_label_data');
        }
      }
    } catch (customSyncError) {
      console.error('[Edit Card Details] Custom label sync error:', customSyncError);
      // Non-fatal
    }

    // 11. Return success response
    return NextResponse.json({
      success: true,
      card: updatedCard,
      label_data: labelData,
      identity_revision: saved.identityRevision ?? null,
      identity_confirmed: saved.confirmed === true,
      pricing_invalidated: saved.pricingInvalidated === true,
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
