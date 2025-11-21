import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Track cards currently being processed to prevent duplicate API calls
const processingCards = new Set<string>();

// Types
type CardGradingRequest = {
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

// Helper functions for data validation
function validateValue(value: any): any {
  if (value === undefined || value === null || value === "" || value === "N/A") {
    return null;
  }
  return value;
}

// Get AI assistant instructions based on card category
function getAssistantInstructions(category: string): string {
  const instructionFiles: { [key: string]: string } = {
    'pokemon': 'pokemon_assistant_instructions_master.txt',
    'magic': 'magic_assistant_instructions.txt',
    'yugioh': 'yugioh_assistant_instructions.txt',
    'sports': 'sports_assistant_instructions.txt',
    'onepiece': 'onepiece_assistant_instructions.txt',
    'lorcana': 'lorcana_assistant_instructions.txt',
    'other': 'other_assistant_instructions.txt'
  };

  const instructionFile = instructionFiles[category.toLowerCase()] || instructionFiles['other'];
  const instructionPath = path.join(process.cwd(), instructionFile);

  try {
    return fs.readFileSync(instructionPath, 'utf8');
  } catch (error) {
    console.error(`Failed to read instruction file ${instructionFile}:`, error);
    return fs.readFileSync(path.join(process.cwd(), instructionFiles['other']), 'utf8');
  }
}

// Grade card with AI
async function gradeCardWithAI(frontUrl: string, backUrl: string, category: string): Promise<any> {
  try {
    const instructions = getAssistantInstructions(category);
    console.log(`Using ${category} grading instructions`);

    // Create thread with images
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: instructions
            },
            {
              type: "image_url",
              image_url: { url: frontUrl }
            },
            {
              type: "image_url",
              image_url: { url: backUrl }
            }
          ]
        }
      ]
    });

    console.log(`Created OpenAI thread: ${thread.id}`);

    // Create and run assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!
    });

    console.log(`Started OpenAI run: ${run.id}`);

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, {
      thread_id: thread.id
    });
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes timeout

    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      attempts++;
      console.log(`Run status check ${attempts}: ${runStatus.status}`);

      if (attempts >= maxAttempts) {
        throw new Error('AI grading timed out');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id
      });
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`AI grading failed with status: ${runStatus.status}`);
    }

    // Get messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

    if (!assistantMessage || !assistantMessage.content[0] || assistantMessage.content[0].type !== 'text') {
      throw new Error('No valid response from AI assistant');
    }

    const responseText = assistantMessage.content[0].text.value;
    console.log('Raw AI Response:', responseText.substring(0, 200) + '...');

    // Parse JSON response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    return JSON.parse(jsonMatch[1]);

  } catch (error: any) {
    console.error('AI grading error:', error.message);
    throw error;
  }
}

// Extract grade information from AI response
function extractGradeInfo(gradingResult: any) {
  const finalGrade = gradingResult["Final DCM Grade"] || gradingResult["Final Score"] || {};
  const gradingScale = gradingResult["Grading (DCM Master Scale)"] || {};
  const dcmSystem = gradingResult["DCM Score System"] || {};

  const rawGrade = gradingScale["Raw Decimal Grade (Before Rounding)"] || finalGrade["Raw Grade"] || 0;
  const wholeGrade = gradingScale["DCM Grade (Final Whole Number)"] || dcmSystem["Condition Grade (Base)"] || Math.round(Number(rawGrade)) || 0;
  const confidence = dcmSystem["AI Confidence Score"] || finalGrade["Confidence Level"] || "Medium";

  return {
    rawGrade: Number(rawGrade),
    wholeGrade: Number(wholeGrade),
    confidence
  };
}

// Extract key fields for database columns (universal)
function extractCardFields(gradingResult: any, category: string) {
  const cardInfo = gradingResult["Card Information"] || {};
  const cardDetails = gradingResult["Card Details"] || {};
  const estimatedValue = gradingResult["DCM Estimated Value"] || {};

  // Base fields for all card types
  const baseFields = {
    card_name: cardInfo["Card Name"] || null,
    card_set: cardInfo["Card Set"] || null,
    card_number: cardInfo["Card Number"] || null,
    serial_numbering: cardInfo["Serial Numbering"] || null,
    manufacturer_name: cardInfo["Manufacturer Name"] || null,
    release_date: cardInfo["Release Date"] || null,
    authentic: cardInfo["Authentic"] || null,
    rarity_description: cardDetails["Rarity"] || null,
    estimated_market_value: estimatedValue["Estimated Market Value"] || null,
    estimated_range: estimatedValue["Estimated Range"] || null,
    estimate_confidence: estimatedValue["Estimate Confidence"] || null
  };

  // Category-specific fields
  if (category.toLowerCase() === 'sports') {
    return {
      ...baseFields,
      featured: cardDetails["Player(s)/Character(s) Featured"] || null,
      rookie_or_first_print: cardDetails["Rookie/First Print"] || null,
      autographed: cardDetails["Autographed"] || null
    };
  } else if (category.toLowerCase() === 'pokemon') {
    return {
      ...baseFields,
      pokemon_featured: cardDetails["Pokémon Featured"] || null,
      pokemon_stage: cardDetails["Pokémon Stage"] || null,
      pokemon_type: cardDetails["Pokémon Type"] || null,
      hp: cardDetails["HP"] || null
    };
  }

  return baseFields;
}

// Main GET handler
export async function GET(request: NextRequest, { params }: CardGradingRequest) {
  const { id: cardId } = await params;
  const startTime = Date.now();

  console.log(`[GET /api/card/${cardId}] Starting request`);

  // Check if already processing
  if (processingCards.has(cardId)) {
    console.log(`[GET /api/card/${cardId}] Card already being processed, returning 429`);
    return NextResponse.json(
      { error: "Card is being processed by another request. Please wait and refresh." },
      { status: 429 }
    );
  }

  try {
    processingCards.add(cardId);
    const supabase = supabaseServer();

    // Get card from database
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    console.log(`[GET /api/card/${cardId}] Card found`);

    // Create signed URLs for images (handle both front_path and front_image_path)
    const frontPath = card.front_path || card.front_image_path;
    const backPath = card.back_path || card.back_image_path;

    if (!frontPath || !backPath) {
      console.error(`[GET /api/card/${cardId}] Missing image paths:`, { frontPath, backPath });
      return NextResponse.json({ error: "Card image paths not found" }, { status: 500 });
    }

    const frontUrl = await createSignedUrl(supabase, "cards", frontPath);
    const backUrl = await createSignedUrl(supabase, "cards", backPath);

    if (!frontUrl || !backUrl) {
      return NextResponse.json({ error: "Failed to access card images" }, { status: 500 });
    }

    // Perform AI grading
    console.log(`[GET /api/card/${cardId}] Starting AI grading`);
    const gradingResult = await gradeCardWithAI(frontUrl, backUrl, card.category || 'other');

    console.log(`[GET /api/card/${cardId}] AI grading completed`);

    // Extract grade information
    const { rawGrade, wholeGrade, confidence } = extractGradeInfo(gradingResult);

    // Extract key fields for database columns
    const cardFields = extractCardFields(gradingResult, card.category || 'other');

    // Update database with comprehensive card data
    const updateData = {
      // Full AI grading JSON for comprehensive display
      ai_grading: gradingResult,

      // Grade information
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),

      // Individual searchable/sortable columns
      ...cardFields,

      // Processing metadata
      processing_time: Date.now() - startTime
    };

    console.log(`[GET /api/card/${cardId}] Updating database with extracted fields:`, {
      card_name: cardFields.card_name,
      card_set: cardFields.card_set,
      category: card.category,
      grade: wholeGrade
    });

    const { error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId);

    if (updateError) {
      console.error(`[GET /api/card/${cardId}] Database update failed:`, updateError);
      return NextResponse.json({ error: "Failed to save grading results" }, { status: 500 });
    }

    console.log(`[GET /api/card/${cardId}] Request completed in ${Date.now() - startTime}ms`);

    // Return updated card data (including conversational_card_info from database)
    return NextResponse.json({
      ...card,
      ai_grading: gradingResult,
      raw_decimal_grade: rawGrade,
      dcm_grade_whole: wholeGrade,
      ai_confidence_score: confidence,
      final_dcm_score: wholeGrade.toString(),
      ...cardFields,
      front_url: frontUrl,
      back_url: backUrl,
      processing_time: Date.now() - startTime,
      conversational_card_info: card.conversational_card_info // Include from database
    });

  } catch (error: any) {
    console.error(`[GET /api/card/${cardId}] Error:`, error.message);
    return NextResponse.json(
      { error: "Failed to process card: " + error.message },
      { status: 500 }
    );
  } finally {
    processingCards.delete(cardId);
    console.log(`[GET /api/card/${cardId}] Removed from processing set`);
  }
}