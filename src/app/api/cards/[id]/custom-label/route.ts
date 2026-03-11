import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyAuth } from "@/lib/serverAuth";
import { generateLabelData } from "@/lib/labelDataGenerator";

/**
 * Custom Label Data API
 *
 * PUT  - Save custom label overrides
 * DELETE - Revert to original AI-generated label
 */

// Fields users can customize on the label
const ALLOWED_LABEL_FIELDS = [
  'primaryName',
  'setName',
  'subset',
  'cardNumber',
  'year',
  'features',
];

function validateCustomLabel(data: Record<string, any>): { valid: boolean; error?: string } {
  for (const [key, value] of Object.entries(data)) {
    if (!ALLOWED_LABEL_FIELDS.includes(key)) {
      return { valid: false, error: `Field '${key}' is not editable on labels` };
    }

    if (key === 'features') {
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Features must be an array of strings' };
      }
      if (value.some((f: any) => typeof f !== 'string')) {
        return { valid: false, error: 'Each feature must be a string' };
      }
      if (value.length > 10) {
        return { valid: false, error: 'Maximum 10 features allowed' };
      }
    } else {
      if (value !== null && typeof value !== 'string') {
        return { valid: false, error: `${key} must be a string or null` };
      }
      if (typeof value === 'string' && value.length > 200) {
        return { valid: false, error: `${key} must be 200 characters or less` };
      }
    }
  }

  return { valid: true };
}

// PUT: Save custom label overrides
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params;
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Fetch card + verify ownership
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (fetchError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: "You do not own this card" }, { status: 403 });
    }

    const body = await request.json();
    const { customFields } = body;

    if (!customFields || typeof customFields !== 'object') {
      return NextResponse.json({ error: "customFields object is required" }, { status: 400 });
    }

    // Validate
    const validation = validateCustomLabel(customFields);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // If no original_label_data stored yet, generate and store it now
    let originalLabelData = card.original_label_data;
    if (!originalLabelData) {
      try {
        originalLabelData = generateLabelData(card);
      } catch {
        // Fallback: store current label_data if generation fails
        originalLabelData = card.label_data || {};
      }
    }

    // Save custom overrides + original (if first time)
    const updatePayload: Record<string, any> = {
      custom_label_data: customFields,
    };
    if (!card.original_label_data) {
      updatePayload.original_label_data = originalLabelData;
    }

    const { error: updateError } = await supabase
      .from('cards')
      .update(updatePayload)
      .eq('id', cardId);

    if (updateError) {
      console.error('[Custom Label] Update error:', updateError);
      return NextResponse.json({ error: "Failed to save custom label" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      custom_label_data: customFields,
      original_label_data: originalLabelData,
      message: "Custom label saved successfully",
    });

  } catch (error: any) {
    console.error('[Custom Label] Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Revert to original label
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params;
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || "Authentication required" }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Fetch card + verify ownership
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, user_id')
      .eq('id', cardId)
      .single();

    if (fetchError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: "You do not own this card" }, { status: 403 });
    }

    // Clear custom label (keep original_label_data for reference)
    const { error: updateError } = await supabase
      .from('cards')
      .update({ custom_label_data: null })
      .eq('id', cardId);

    if (updateError) {
      console.error('[Custom Label] Revert error:', updateError);
      return NextResponse.json({ error: "Failed to revert label" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Label reverted to original",
    });

  } catch (error: any) {
    console.error('[Custom Label] Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
