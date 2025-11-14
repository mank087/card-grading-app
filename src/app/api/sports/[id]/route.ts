import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
// PRIMARY: Conversational grading system (matches other card type flows)
import { gradeCardConversational } from "@/lib/visionGrader";

// Track sports cards currently being processed with timestamps
const processingSportsCards = new Map<string, number>();

// Clean up stuck processing cards (older than 5 minutes)
const cleanupStuckCards = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);

  for (const [cardId, timestamp] of processingSportsCards.entries()) {
    if (timestamp < fiveMinutesAgo) {
      console.log(`[CLEANUP] Removing stuck card ${cardId} from processing set`);
      processingSportsCards.delete(cardId);
    }
  }
};

// Types
type SportsCardGradingRequest = {
  params: Promise<{ id: string }>;
};

// Signed URL generation
async function createSignedUrl(supabase: any, bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) {
      console.error(`Failed to create signed URL for ${path}:`, error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`Error creating signed URL for ${path}:`, error);
    return null;
  }
}

// Removed old Sports-specific functions:
// - getSportsInstructions() - prompts now loaded by gradeCardConversational
// - gradeSportsCardWithAI() - replaced with unified gradeCardConversational
// This matches the Pokemon/MTG/Lorcana/Other card grading flow for consistency and efficiency


// Main GET handler for sports cards
export async function GET(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  console.log(`[GET /api/sports/${cardId}] Starting sports card grading request`);

  // Clean up any stuck processing cards first
  cleanupStuckCards();

  // Check if already processing this sports card
  if (processingSportsCards.has(cardId)) {
    console.log(`[GET /api/sports/${cardId}] Sports card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Sports card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingSportsCards.set(cardId, Date.now());
    const supabase = supabaseServer();

    // Get sports card from database
    // Sports cards can have categories: Football, Baseball, Basketball, Hockey, Soccer, Wrestling, Sports
    const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    // Verify it's a sports card
    if (card && !sportCategories.includes(card.category)) {
      console.error(`[GET /api/sports/${cardId}] Card is not a sports card, category: ${card.category}`);
      return NextResponse.json({ error: "Not a sports card" }, { status: 404 });
    }

    if (cardError || !card) {
      console.error(`[GET /api/sports/${cardId}] Card lookup error:`, cardError);
      console.log(`[GET /api/sports/${cardId}] Card data:`, card);
      return NextResponse.json({ error: "Sports card not found" }, { status: 404 });
    }

    console.log(`[GET /api/sports/${cardId}] Sports card found`);

    // 🔒 VISIBILITY CHECK: Verify user has permission to view this card
    const cardVisibility = card.visibility || 'private'; // Default to private if not set

    if (cardVisibility === 'private') {
      // Private card - only owner can view
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.log(`[GET /api/sports/${cardId}] 🔒 Private card access denied - not authenticated`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card. Please log in if this is your card.",
          visibility: "private"
        }, { status: 403 });
      }

      if (card.user_id !== user.id) {
        console.log(`[GET /api/sports/${cardId}] 🔒 Private card access denied - user ${user.id} is not owner ${card.user_id}`);
        return NextResponse.json({
          error: "This card is private",
          message: "Only the owner can view this card.",
          visibility: "private"
        }, { status: 403 });
      }

      console.log(`[GET /api/sports/${cardId}] ✅ Private card access granted to owner ${user.id}`);
    } else {
      // Public card - anyone can view
      console.log(`[GET /api/sports/${cardId}] 🌐 Public card - access granted`);
    }

    // Create signed URLs for sports card images
    console.log(`[GET /api/sports/${cardId}] Creating signed URLs for front: ${card.front_path}, back: ${card.back_path}`);
    const frontUrl = await createSignedUrl(supabase, "cards", card.front_path);
    const backUrl = await createSignedUrl(supabase, "cards", card.back_path);

    if (!frontUrl || !backUrl) {
      console.error(`[GET /api/sports/${cardId}] Failed to create signed URLs. Front: ${frontUrl}, Back: ${backUrl}`);
      return NextResponse.json({ error: "Failed to access sports card images" }, { status: 500 });
    }
    console.log(`[GET /api/sports/${cardId}] Signed URLs created successfully`);

    // Check if sports card already has complete grading data
    const hasCompleteGrading = card.conversational_decimal_grade && card.conversational_whole_grade;

    if (hasCompleteGrading) {
      console.log(`[GET /api/sports/${cardId}] Sports card already fully processed, returning existing result`);
      return NextResponse.json({
        ...card,
        front_url: frontUrl,
        back_url: backUrl,
        processing_time: card.processing_time  // Use stored value, not recalculated
      });
    }

    // If incomplete grading, process it
    console.log(`[GET /api/sports/${cardId}] Sports card needs grading analysis`);

    // 🎯 PRIMARY: Run conversational grading v4.2 (single API call)
    let conversationalGradingResult = null;
    let conversationalResultV3_3: any = null;
    let conversationalGradingData: any = null;
    let isJSONMode = false;
    let gradingResult = null; // Legacy field for backward compatibility

    if (frontUrl && backUrl) {
      try {
        console.log(`[SPORTS CONVERSATIONAL AI v4.2] 🎯 Starting PRIMARY grading with Sports-specific prompt...`);
        const conversationalResult = await gradeCardConversational(frontUrl, backUrl, 'sports');
        conversationalGradingResult = conversationalResult.markdown_report;
        conversationalResultV3_3 = conversationalResult; // Store full result

        console.log(`[GET /api/sports/${cardId}] ✅ Conversational grading completed: ${conversationalResult.extracted_grade.decimal_grade}`);
        console.log(`[GET /api/sports/${cardId}] 🏆 Rarity: ${conversationalResult.rarity_classification?.rarity_tier || 'Not detected'}`);
        console.log(`[GET /api/sports/${cardId}] 📍 Defects: Front=${conversationalResult.defect_coordinates_front.length}, Back=${conversationalResult.defect_coordinates_back.length}`);

        // Detect if we're using JSON format (v4.x) or markdown format (v3.x)
        isJSONMode = conversationalResult.meta?.version === 'conversational-v4.2-json' ||
                     conversationalResult.meta?.version === 'conversational-v4.0-json';
        console.log(`[GET /api/sports/${cardId}] Output format detected: ${isJSONMode ? 'JSON (v4.2)' : 'Markdown (v3.x)'}`);

        // Create legacy gradingResult structure for backward compatibility
        // This ensures old frontend code paths still work while we transition fully to conversational
        if (conversationalGradingResult) {
          try {
            const jsonData = JSON.parse(conversationalGradingResult);
            gradingResult = {
              "Card Information": jsonData.card_info || {},
              "Grading (DCM Master Scale)": {
                "Raw Decimal Grade (Before Rounding)": jsonData.final_grade?.decimal_grade || 0,
                "DCM Grade (Final Whole Number)": jsonData.final_grade?.whole_grade || 0
              }
            };
          } catch (e) {
            console.error(`[GET /api/sports/${cardId}] Failed to create legacy gradingResult:`, e);
          }
        }

        // Parse JSON format and extract fields for database
        if (isJSONMode && conversationalGradingResult) {
          try {
            const parsedJSONData = JSON.parse(conversationalGradingResult);
            console.log(`[GET /api/sports/${cardId}] ✅ Successfully parsed JSON response`);

            // Build conversationalGradingData from JSON
            conversationalGradingData = {
              decimal_grade: parsedJSONData.final_grade?.decimal_grade ?? null,
              whole_grade: parsedJSONData.final_grade?.whole_grade ?? null,
              grade_uncertainty: parsedJSONData.final_grade?.grade_range || '±0.5',
              condition_label: parsedJSONData.final_grade?.condition_label || null,
              final_grade_summary: parsedJSONData.final_grade?.summary || null,
              image_confidence: parsedJSONData.image_quality?.confidence_letter || null,
              sub_scores: {
                centering: {
                  front: parsedJSONData.raw_sub_scores?.centering_front || 0,
                  back: parsedJSONData.raw_sub_scores?.centering_back || 0,
                  weighted: parsedJSONData.weighted_scores?.centering_weighted || 0
                },
                corners: {
                  front: parsedJSONData.raw_sub_scores?.corners_front || 0,
                  back: parsedJSONData.raw_sub_scores?.corners_back || 0,
                  weighted: parsedJSONData.weighted_scores?.corners_weighted || 0
                },
                edges: {
                  front: parsedJSONData.raw_sub_scores?.edges_front || 0,
                  back: parsedJSONData.raw_sub_scores?.edges_back || 0,
                  weighted: parsedJSONData.weighted_scores?.edges_weighted || 0
                },
                surface: {
                  front: parsedJSONData.raw_sub_scores?.surface_front || 0,
                  back: parsedJSONData.raw_sub_scores?.surface_back || 0,
                  weighted: parsedJSONData.weighted_scores?.surface_weighted || 0
                }
              },
              centering_ratios: {
                front_lr: parsedJSONData.centering?.front?.left_right || 'N/A',
                front_tb: parsedJSONData.centering?.front?.top_bottom || 'N/A',
                back_lr: parsedJSONData.centering?.back?.left_right || 'N/A',
                back_tb: parsedJSONData.centering?.back?.top_bottom || 'N/A'
              },
              card_info: parsedJSONData.card_info || null,
              case_detection: parsedJSONData.case_detection || null,
              weighted_sub_scores: {
                centering: parsedJSONData.weighted_scores?.centering_weighted || null,
                corners: parsedJSONData.weighted_scores?.corners_weighted || null,
                edges: parsedJSONData.weighted_scores?.edges_weighted || null,
                surface: parsedJSONData.weighted_scores?.surface_weighted || null
              },
              limiting_factor: parsedJSONData.weighted_scores?.limiting_factor || null,
              preliminary_grade: parsedJSONData.weighted_scores?.preliminary_grade || null,
              slab_detection: parsedJSONData.professional_slab?.detected ? {
                detected: true,
                company: parsedJSONData.professional_slab.company || null,
                grade: parsedJSONData.professional_slab.grade || null,
                grade_description: parsedJSONData.professional_slab.grade_description || null,
                cert_number: parsedJSONData.professional_slab.cert_number || null
              } : null,
              meta: {
                version: 'conversational-v4.0-json',
                prompt_version: parsedJSONData.metadata?.prompt_version || 'Conversational_Grading_v4.2_ENHANCED_STRICTNESS',
                evaluated_at_utc: parsedJSONData.metadata?.timestamp || new Date().toISOString()
              },
              professional_grade_estimates: parsedJSONData.professional_grade_estimates || null
            };

            console.log(`[GET /api/sports/${cardId}] ✅ Extracted conversational data from JSON`);
            console.log(`[GET /api/sports/${cardId}] Grade: ${conversationalGradingData.decimal_grade}, Confidence: ${conversationalGradingData.image_confidence}`);
          } catch (jsonParseError) {
            console.error(`[GET /api/sports/${cardId}] ⚠️ Failed to parse JSON, continuing without detailed fields:`, jsonParseError);
          }
        }

      } catch (error: any) {
        console.error(`[GET /api/sports/${cardId}] ⚠️ Conversational grading failed:`, error.message);
        // Return error response - we can't grade without conversational grading
        return NextResponse.json(
          { error: "Failed to grade sports card: " + error.message },
          { status: 500 }
        );
      }
    }


    // Update database with comprehensive sports card data
    const updateData = {
      // Legacy AI grading for backward compatibility with frontend
      ai_grading: gradingResult,

      // 🎯 PRIMARY: Conversational grading markdown/JSON (full report)
      conversational_grading: conversationalGradingResult,

      // 🎯 PRIMARY: Conversational AI grading v4.2 (extracted fields)
      conversational_decimal_grade: conversationalGradingData?.decimal_grade || null,
      conversational_whole_grade: conversationalGradingData?.whole_grade || null,
      conversational_grade_uncertainty: conversationalGradingData?.grade_uncertainty || null,
      conversational_sub_scores: conversationalGradingData?.sub_scores || null,
      conversational_condition_label: conversationalGradingData?.condition_label || null,
      conversational_final_grade_summary: conversationalGradingData?.final_grade_summary || null,
      conversational_image_confidence: conversationalGradingData?.image_confidence || null,
      conversational_case_detection: conversationalGradingData?.case_detection || null,
      conversational_slab_detection: conversationalGradingData?.slab_detection || null,
      conversational_weighted_sub_scores: conversationalGradingData?.weighted_sub_scores || null,
      conversational_limiting_factor: conversationalGradingData?.limiting_factor || null,
      conversational_preliminary_grade: conversationalGradingData?.preliminary_grade || null,
      conversational_card_info: conversationalGradingData?.card_info || null,
      conversational_prompt_version: conversationalGradingData?.meta?.prompt_version || 'v4.2',
      conversational_evaluated_at: conversationalGradingData?.meta?.evaluated_at_utc ? new Date(conversationalGradingData.meta.evaluated_at_utc) : new Date(),

      // 🆕 Professional grade estimates (PSA, BGS, SGC, etc.)
      estimated_professional_grades: conversationalGradingData?.professional_grade_estimates || null,

      // 🆕 v3.3: Enhanced conversational grading fields
      ...(conversationalResultV3_3 && {
        // Rarity classification
        rarity_tier: conversationalResultV3_3.rarity_classification?.rarity_tier || null,
        serial_number_fraction: conversationalResultV3_3.rarity_classification?.serial_number_fraction || null,
        autograph_type: conversationalResultV3_3.rarity_classification?.autograph_type || null,
        memorabilia_type: conversationalResultV3_3.rarity_classification?.memorabilia_type || null,
        finish_material: conversationalResultV3_3.rarity_classification?.finish_material || null,
        rookie_flag: conversationalResultV3_3.rarity_classification?.rookie_flag || null,
        subset_insert_name: conversationalResultV3_3.rarity_classification?.subset_insert_name || null,
        special_attributes: conversationalResultV3_3.rarity_classification?.special_attributes?.join(', ') || null,
        rarity_notes: conversationalResultV3_3.rarity_classification?.rarity_notes || null,

        // Enhanced grading metadata
        weighted_total_pre_cap: conversationalResultV3_3.grading_metadata?.weighted_total_pre_cap || null,
        capped_grade_reason: conversationalResultV3_3.grading_metadata?.capped_grade_reason || null,
        conservative_rounding_applied: conversationalResultV3_3.grading_metadata?.conservative_rounding_applied || false,
        lighting_conditions_notes: conversationalResultV3_3.grading_metadata?.lighting_conditions_notes || null,
        cross_side_verification_result: conversationalResultV3_3.grading_metadata?.cross_side_verification_result || null,

        // Defect coordinates (JSONB)
        defect_coordinates_front: conversationalResultV3_3.defect_coordinates_front || [],
        defect_coordinates_back: conversationalResultV3_3.defect_coordinates_back || [],
      }),

      // 🎯 Card info from Conversational AI
      card_name: conversationalGradingData?.card_info?.card_name || null,
      featured: conversationalGradingData?.card_info?.player_or_character || null,
      card_set: conversationalGradingData?.card_info?.set_name || null,
      manufacturer_name: conversationalGradingData?.card_info?.manufacturer || null,
      release_date: conversationalGradingData?.card_info?.year || null,
      card_number: conversationalGradingData?.card_info?.card_number || null,
      serial_numbering: conversationalGradingData?.card_info?.serial_number || null,
      authentic: conversationalGradingData?.card_info?.authentic !== false,  // Default to true
      rookie_or_first_print: conversationalGradingData?.card_info?.rookie_or_first || null,
      rarity_description: conversationalGradingData?.card_info?.rarity_or_variant || null,
      autographed: conversationalGradingData?.card_info?.autographed || false,

      // Legacy grade fields (for backward compatibility)
      raw_decimal_grade: conversationalGradingData?.decimal_grade || null,
      dcm_grade_whole: conversationalGradingData?.whole_grade || null,
      ai_confidence_score: conversationalGradingData?.image_confidence || null,
      final_dcm_score: conversationalGradingData?.whole_grade?.toString() || null,

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    console.log(`[GET /api/sports/${cardId}] Updating database with conversational grading:`, {
      card_name: conversationalGradingData?.card_info?.card_name,
      card_set: conversationalGradingData?.card_info?.set_name,
      featured: conversationalGradingData?.card_info?.player_or_character,
      decimal_grade: conversationalGradingData?.decimal_grade,
      whole_grade: conversationalGradingData?.whole_grade
    });

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[GET /api/sports/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save sports card grading results" }, { status: 500 });
    }

    console.log(`[GET /api/sports/${cardId}] Sports card request completed in ${Date.now() - startTime}ms`);

    // Return updated sports card data with conversational grading
    return NextResponse.json({
      ...card,
      ...updateData,  // Include all the conversational grading fields
      front_url: frontUrl,
      back_url: backUrl
    });

  } catch (error: any) {
    console.error(`[GET /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process sports card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingSportsCards.delete(cardId);
    console.log(`[GET /api/sports/${cardId}] Removed from processing set`);
  }
}

// PATCH handler for updating card data (e.g., clearing cached grading)
export async function PATCH(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[PATCH /api/sports/${cardId}] Starting card update request`);

  try {
    const supabase = supabaseServer();
    const body = await request.json();

    console.log(`[PATCH /api/sports/${cardId}] Update data:`, body);

    // Update the card
    const { data, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", cardId)
      .select()
      .single();

    if (error) {
      console.error(`[PATCH /api/sports/${cardId}] Update failed:`, error);
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
    }

    console.log(`[PATCH /api/sports/${cardId}] Card updated successfully`);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[PATCH /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to update card: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE handler for removing cards
export async function DELETE(request: NextRequest, { params }: SportsCardGradingRequest) {
  const { id: cardId } = await params;

  console.log(`[DELETE /api/sports/${cardId}] Starting card deletion request`);

  try {
    const supabase = supabaseServer();

    // Delete the card and its associated images
    const { data: card, error: fetchError } = await supabase
      .from("cards")
      .select("front_path, back_path")
      .eq("id", cardId)
      .single();

    if (fetchError || !card) {
      console.error(`[DELETE /api/sports/${cardId}] Card not found:`, fetchError);
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Delete images from storage
    if (card.front_path) {
      await supabase.storage.from("cards").remove([card.front_path]);
    }
    if (card.back_path) {
      await supabase.storage.from("cards").remove([card.back_path]);
    }

    // Delete card record
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error(`[DELETE /api/sports/${cardId}] Deletion failed:`, deleteError);
      return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
    }

    console.log(`[DELETE /api/sports/${cardId}] Card deleted successfully`);
    return NextResponse.json({ success: true, message: "Card deleted successfully" });

  } catch (error: any) {
    console.error(`[DELETE /api/sports/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to delete card: " + error.message },
      { status: 500 }
    );
  }
}