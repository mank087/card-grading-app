import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Grading stages for progress tracking
 */
export type GradingStage =
  | 'uploading'    // 0-15%: Images being uploaded
  | 'queued'       // 15-20%: In queue, waiting
  | 'identifying'  // 20-35%: Card identification
  | 'grading'      // 35-80%: DCM Optic™ analyzing
  | 'calculating'  // 80-95%: Computing final grade
  | 'saving'       // 95-99%: Saving to database
  | 'completed'    // 100%: Done
  | 'error'        // Error state

/**
 * GET /api/cards/[id]/status
 * Get current grading status/stage of a card
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Card ID is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Get card data to determine stage
    const { data: card, error } = await supabase
      .from('cards')
      .select(`
        id,
        created_at,
        updated_at,
        category,
        featured,
        card_name,
        conversational_decimal_grade,
        conversational_whole_grade,
        conversational_grading,
        conversational_card_info,
        grading_status,
        grading_started_at,
        grading_completed_at
      `)
      .eq('id', id)
      .single();

    if (error || !card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Determine stage based on card data
    let stage: GradingStage;
    let progress: number;
    let estimatedTimeRemaining: number | null = null;

    const createdAt = new Date(card.created_at).getTime();
    const now = Date.now();
    const elapsed = now - createdAt;

    // Check if grading is complete
    if (card.conversational_decimal_grade !== null && card.conversational_decimal_grade !== undefined) {
      stage = 'completed';
      progress = 100;
    }
    // Check for error status
    else if (card.grading_status === 'error') {
      stage = 'error';
      progress = 0;
    }
    // Determine stage based on elapsed time and available data
    else {
      // Stage timing (approximate):
      // 0-5s: uploading (0-15%)
      // 5-10s: queued (15-20%)
      // 10-20s: identifying (20-35%)
      // 20-50s: grading (35-80%)
      // 50-55s: calculating (80-95%)
      // 55-60s: saving (95-99%)

      if (elapsed < 5000) {
        stage = 'uploading';
        progress = Math.min(15, Math.floor((elapsed / 5000) * 15));
        estimatedTimeRemaining = 55;
      } else if (elapsed < 10000) {
        stage = 'queued';
        progress = 15 + Math.floor(((elapsed - 5000) / 5000) * 5);
        estimatedTimeRemaining = 50;
      } else if (elapsed < 20000) {
        // Check if we have card identification data
        if (card.featured || card.card_name || card.conversational_card_info) {
          stage = 'grading';
          progress = 35 + Math.floor(((elapsed - 20000) / 30000) * 45);
        } else {
          stage = 'identifying';
          progress = 20 + Math.floor(((elapsed - 10000) / 10000) * 15);
        }
        estimatedTimeRemaining = 40;
      } else if (elapsed < 50000) {
        stage = 'grading';
        progress = 35 + Math.floor(((elapsed - 20000) / 30000) * 45);
        estimatedTimeRemaining = Math.max(10, Math.ceil((60000 - elapsed) / 1000));
      } else if (elapsed < 55000) {
        stage = 'calculating';
        progress = 80 + Math.floor(((elapsed - 50000) / 5000) * 15);
        estimatedTimeRemaining = Math.max(5, Math.ceil((60000 - elapsed) / 1000));
      } else if (elapsed < 90000) {
        // Extended processing - keep at saving stage
        stage = 'saving';
        progress = Math.min(98, 95 + Math.floor(((elapsed - 55000) / 35000) * 3));
        estimatedTimeRemaining = Math.max(1, Math.ceil((90000 - elapsed) / 1000));
      } else {
        // Very long processing - likely stuck
        stage = 'grading';
        progress = 98;
        estimatedTimeRemaining = null;
      }
    }

    // Get card name for display
    const cardName = card.featured || card.card_name || card.category || 'Card';

    return NextResponse.json({
      id: card.id,
      stage,
      progress: Math.min(100, Math.max(0, progress)),
      estimatedTimeRemaining,
      cardName,
      category: card.category,
      hasGrade: card.conversational_decimal_grade !== null,
      grade: card.conversational_decimal_grade,
      createdAt: card.created_at,
      updatedAt: card.updated_at
    });

  } catch (error) {
    console.error('Error getting card status:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
