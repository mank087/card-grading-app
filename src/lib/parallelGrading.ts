// Parallel Front/Back Card Grading Implementation
// This module handles parallel processing of card front and back images for faster grading

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface FrontAnalysis {
  stage: string;
  version: string;
  side: "front";
  visual_geometry: any;
  image_quality: any;
  text_transcription: {
    all_visible_text: string[];
    text_locations: Array<{ text: string; location: string }>;
    special_markings: string[];
    transcription_confidence: string;
    transcription_notes: string;
  };
  centering: {
    left_right_ratio: string;
    top_bottom_ratio: string;
    worst_ratio: string;
    measurement_proof: string;
    confidence: string;
    notes: string;
  };
  observations: Array<{
    id: string;
    category: string;
    location: string;
    type: string;
    description: string;
    estimated_size_mm: number;
    visibility: string;
    confidence: string;
  }>;
  autograph: any;
  card_information: any;
  pristine_observations: any[];
  uncertainty_notes: string[];
}

export interface BackAnalysis {
  stage: string;
  version: string;
  side: "back";
  visual_geometry: any;
  image_quality: any;
  text_transcription: {
    all_visible_text: string[];
    text_locations: Array<{ text: string; location: string }>;
    special_markings: string[];
    transcription_confidence: string;
    transcription_notes: string;
  };
  centering: {
    left_right_ratio: string;
    top_bottom_ratio: string;
    worst_ratio: string;
    measurement_proof: string;
    confidence: string;
    notes: string;
  };
  observations: Array<{
    id: string;
    category: string;
    location: string;
    type: string;
    description: string;
    estimated_size_mm: number;
    visibility: string;
    confidence: string;
  }>;
  autograph: any;
  manufacturer_authentication: {
    authentication_present: boolean;
    authentication_type: string;
    authentication_text_found: string[];
    authentication_description: string;
    hologram_present: boolean;
    confidence: string;
    notes: string;
  };
  pristine_observations: any[];
  uncertainty_notes: string[];
}

export interface MergedAnalysis {
  front_analysis: FrontAnalysis;
  back_analysis: BackAnalysis;
  card_information: any;
  combined_observations: any[];
  combined_centering: {
    front_lr: string;
    front_tb: string;
    back_lr: string;
    back_tb: string;
    worst_ratio: string;
  };
  combined_text_transcription: {
    front_text: string[];
    back_text: string[];
    all_text: string[];
  };
}

/**
 * Run Stage 1 Front and Back analysis in parallel
 * @param frontUrl - Signed URL for front image
 * @param backUrl - Signed URL for back image
 * @param cardId - Card identifier for logging
 * @returns Merged analysis from both sides
 */
export async function runParallelStage1Analysis(
  frontUrl: string,
  backUrl: string,
  cardId: string
): Promise<MergedAnalysis> {
  console.log(`[PARALLEL] Starting parallel front/back analysis for card ${cardId}`);

  const startTime = Date.now();

  // Create both threads and run assistants in parallel
  const [frontResult, backResult] = await Promise.all([
    runFrontAnalysis(frontUrl, cardId),
    runBackAnalysis(backUrl, cardId),
  ]);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  console.log(`[PARALLEL] ✅ Both analyses complete in ${duration}s`);

  // Merge the results
  const merged = mergeAnalyses(frontResult, backResult);

  console.log(`[PARALLEL] Merged data:`, {
    totalObservations: merged.combined_observations.length,
    frontText: merged.combined_text_transcription.front_text.length,
    backText: merged.combined_text_transcription.back_text.length,
    authenticationPresent: merged.back_analysis.manufacturer_authentication?.authentication_present,
  });

  return merged;
}

/**
 * Run Front Analysis (Stage 1 Front Assistant)
 */
async function runFrontAnalysis(frontUrl: string, cardId: string): Promise<FrontAnalysis> {
  console.log(`[FRONT] Starting front analysis for card ${cardId}`);

  try {
    // Create thread for front analysis
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the FRONT of this sports card. Provide detailed observations WITHOUT scoring.\n\n🚨 CRITICAL:\n1. Observe FRONT ONLY - do not analyze back\n2. Transcribe ALL visible text on front\n3. Check for signatures on front\n4. Measure centering for front (L/R and T/B)\n5. Describe defects with specific locations and MM estimates\n6. Provide unique descriptions - no templated phrases`,
            },
            {
              type: "image_url",
              image_url: {
                url: frontUrl,
                detail: "auto"  // Auto-select detail level for 3-5x faster processing
              },
            },
          ],
        },
      ],
    });

    console.log(`[FRONT] Thread created: ${thread.id}`);

    // Run Stage 1 Front Assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_STAGE1_FRONT_ASSISTANT_ID || "",
      temperature: 0.3,
    });

    // Poll for completion
    let status = await openai.beta.threads.runs.retrieve(run.id, {
      thread_id: thread.id,
    });

    let attempts = 0;
    const maxAttempts = 90; // 3 minutes timeout

    while (status.status === "in_progress" || status.status === "queued") {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error("Front analysis timed out after 3 minutes");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      status = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
    }

    if (status.status !== "completed") {
      throw new Error(`Front analysis failed with status: ${status.status}`);
    }

    // Get response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const message = messages.data.find((msg) => msg.role === "assistant");

    if (!message) {
      throw new Error("No response from Front analysis assistant");
    }

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected Front response format");
    }

    const rawText = content.text.value;
    console.log("[FRONT] Raw response (first 500 chars):", rawText.substring(0, 500));

    // Extract JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Front response");
    }

    const frontData: FrontAnalysis = JSON.parse(jsonMatch[0]);
    console.log("[FRONT] ✅ Front analysis complete");
    console.log(`[FRONT] Observations: ${frontData.observations?.length || 0}`);
    console.log(`[FRONT] Text items: ${frontData.text_transcription?.all_visible_text?.length || 0}`);

    return frontData;
  } catch (error) {
    console.error("[FRONT] Error in front analysis:", error);
    throw error;
  }
}

/**
 * Run Back Analysis (Stage 1 Back Assistant)
 */
async function runBackAnalysis(backUrl: string, cardId: string): Promise<BackAnalysis> {
  console.log(`[BACK] Starting back analysis for card ${cardId}`);

  try {
    // Create thread for back analysis
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the BACK of this sports card. Provide detailed observations WITHOUT scoring.\n\n🚨 CRITICAL:\n1. Observe BACK ONLY - do not analyze front\n2. Transcribe ALL visible text on back (especially authentication text!)\n3. Check for manufacturer authentication markers\n4. Check for signatures on back\n5. Measure centering for back (L/R and T/B)\n6. Describe defects with specific locations and MM estimates\n7. Provide unique descriptions - no templated phrases`,
            },
            {
              type: "image_url",
              image_url: {
                url: backUrl,
                detail: "auto"  // Auto-select detail level for 3-5x faster processing
              },
            },
          ],
        },
      ],
    });

    console.log(`[BACK] Thread created: ${thread.id}`);

    // Run Stage 1 Back Assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_STAGE1_BACK_ASSISTANT_ID || "",
      temperature: 0.3,
    });

    // Poll for completion
    let status = await openai.beta.threads.runs.retrieve(run.id, {
      thread_id: thread.id,
    });

    let attempts = 0;
    const maxAttempts = 90; // 3 minutes timeout

    while (status.status === "in_progress" || status.status === "queued") {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error("Back analysis timed out after 3 minutes");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      status = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
    }

    if (status.status !== "completed") {
      throw new Error(`Back analysis failed with status: ${status.status}`);
    }

    // Get response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const message = messages.data.find((msg) => msg.role === "assistant");

    if (!message) {
      throw new Error("No response from Back analysis assistant");
    }

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected Back response format");
    }

    const rawText = content.text.value;
    console.log("[BACK] Raw response (first 500 chars):", rawText.substring(0, 500));

    // Extract JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Back response");
    }

    const backData: BackAnalysis = JSON.parse(jsonMatch[0]);
    console.log("[BACK] ✅ Back analysis complete");
    console.log(`[BACK] Observations: ${backData.observations?.length || 0}`);
    console.log(`[BACK] Text items: ${backData.text_transcription?.all_visible_text?.length || 0}`);
    console.log(`[BACK] Authentication present: ${backData.manufacturer_authentication?.authentication_present}`);

    return backData;
  } catch (error) {
    console.error("[BACK] Error in back analysis:", error);
    throw error;
  }
}

/**
 * Merge front and back analyses into unified format for Stage 2
 */
function mergeAnalyses(front: FrontAnalysis, back: BackAnalysis): MergedAnalysis {
  console.log("[MERGE] Combining front and back analyses...");

  // Combine observations (front + back = 16 total)
  const combinedObservations = [
    ...(front.observations || []),
    ...(back.observations || []),
  ];

  // Combine text transcription
  const combinedText = {
    front_text: front.text_transcription?.all_visible_text || [],
    back_text: back.text_transcription?.all_visible_text || [],
    all_text: [
      ...(front.text_transcription?.all_visible_text || []),
      ...(back.text_transcription?.all_visible_text || []),
    ],
  };

  // Combine centering measurements
  const combinedCentering = {
    front_lr: front.centering?.left_right_ratio || "50/50",
    front_tb: front.centering?.top_bottom_ratio || "50/50",
    back_lr: back.centering?.left_right_ratio || "50/50",
    back_tb: back.centering?.top_bottom_ratio || "50/50",
    worst_ratio: determineWorstCenteringRatio(
      front.centering?.worst_ratio,
      back.centering?.worst_ratio
    ),
  };

  console.log(`[MERGE] Combined ${combinedObservations.length} observations`);
  console.log(`[MERGE] Combined ${combinedText.all_text.length} text items`);

  return {
    front_analysis: front,
    back_analysis: back,
    card_information: front.card_information, // Card info comes from front
    combined_observations: combinedObservations,
    combined_centering: combinedCentering,
    combined_text_transcription: combinedText,
  };
}

/**
 * Determine worst centering ratio from front and back
 */
function determineWorstCenteringRatio(
  frontWorst: string | undefined,
  backWorst: string | undefined
): string {
  if (!frontWorst && !backWorst) return "50/50";
  if (!frontWorst) return backWorst!;
  if (!backWorst) return frontWorst!;

  // Parse ratios (e.g., "60/40" → 60)
  const parseFront = parseInt(frontWorst.split("/")[0]);
  const parseBack = parseInt(backWorst.split("/")[0]);

  // Return the one further from 50/50
  const frontDeviation = Math.abs(parseFront - 50);
  const backDeviation = Math.abs(parseBack - 50);

  return frontDeviation >= backDeviation ? frontWorst! : backWorst!;
}

/**
 * Complete parallel grading pipeline: Stage 1 Front/Back → Merge → Stage 2
 * This is the main entry point for parallel processing from the API route
 * @returns {gradingResult, stage1Data} - Same format as legacy gradeSportsCardTwoStageV2
 */
export async function gradeCardParallelPipeline(
  frontUrl: string,
  backUrl: string,
  cardId: string,
  openai: any
): Promise<{ gradingResult: any; stage1Data: any }> {
  console.log(`[PARALLEL PIPELINE] Starting complete pipeline for card ${cardId}`);

  // Step 1: Run parallel Stage 1 analysis (front + back)
  const mergedAnalysis = await runParallelStage1Analysis(frontUrl, backUrl, cardId);

  // Step 2: Send merged data to Stage 2 for scoring
  console.log("[PARALLEL PIPELINE] Sending merged data to Stage 2...");

  const stage2Thread = await openai.beta.threads.create({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Apply scoring rules to this parallel observation data and calculate final grade.\n\nParallel Stage 1 Data:\n\n${JSON.stringify(mergedAnalysis, null, 2)}\n\n🚨 CRITICAL:\n1. This is PARALLEL FORMAT - use parallel processing addendum instructions\n2. Check authentication from back_analysis.manufacturer_authentication\n3. Use combined_observations (${mergedAnalysis.combined_observations.length} total observations)\n4. Use combined_centering.worst_ratio for centering deduction\n5. Provide front_specific_feedback and back_specific_feedback\n6. Include text_transcription_summary in output`,
          },
        ],
      },
    ],
  });

  console.log(`[PARALLEL PIPELINE] Stage 2 thread created: ${stage2Thread.id}`);

  // Run Stage 2 assistant
  const stage2Run = await openai.beta.threads.runs.create(stage2Thread.id, {
    assistant_id: process.env.OPENAI_STAGE2_SCORING_ASSISTANT_ID || "",
    temperature: 0.0, // Deterministic scoring
  });

  // Poll for Stage 2 completion
  let stage2Status = await openai.beta.threads.runs.retrieve(stage2Run.id, {
    thread_id: stage2Thread.id,
  });

  let attempts = 0;
  const maxAttempts = 90; // 3 minutes timeout

  while (stage2Status.status === "in_progress" || stage2Status.status === "queued") {
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error("Stage 2 scoring timed out after 3 minutes");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    stage2Status = await openai.beta.threads.runs.retrieve(stage2Run.id, {
      thread_id: stage2Thread.id,
    });
  }

  if (stage2Status.status !== "completed") {
    throw new Error(`Stage 2 scoring failed with status: ${stage2Status.status}`);
  }

  // Get Stage 2 response
  const stage2Messages = await openai.beta.threads.messages.list(stage2Thread.id);
  const stage2Message = stage2Messages.data.find((msg) => msg.role === "assistant");

  if (!stage2Message) {
    throw new Error("No response from Stage 2 scoring assistant");
  }

  const stage2Content = stage2Message.content[0];
  if (stage2Content.type !== "text") {
    throw new Error("Unexpected Stage 2 response format");
  }

  const stage2RawText = stage2Content.text.value;
  console.log("[PARALLEL PIPELINE] Raw Stage 2 response (first 500 chars):", stage2RawText.substring(0, 500));

  // Extract JSON from Stage 2
  const stage2JsonMatch = stage2RawText.match(/\{[\s\S]*\}/);
  if (!stage2JsonMatch) {
    throw new Error("No JSON found in Stage 2 response");
  }

  const gradingResult = JSON.parse(stage2JsonMatch[0]);
  console.log("[PARALLEL PIPELINE] ✅ Stage 2 scoring complete");

  // Log the complete Stage 2 structure for debugging
  console.log("[PARALLEL PIPELINE] Stage 2 top-level keys:", Object.keys(gradingResult));
  console.log("[PARALLEL PIPELINE] Stage 2 full output:", JSON.stringify(gradingResult, null, 2).substring(0, 2000));

  // Log key fields for debugging
  console.log("[PARALLEL PIPELINE] Grade info:", {
    decimal_final_grade: gradingResult.final_grade_calculation?.decimal_final_grade,
    whole_number_grade: gradingResult.final_grade_calculation?.whole_number_grade,
    has_front_feedback: !!gradingResult.front_specific_feedback,
    has_back_feedback: !!gradingResult.back_specific_feedback,
    has_text_summary: !!gradingResult.text_transcription_summary,
    centering_quality_score: gradingResult.centering_quality?.final_category_score
  });

  // Return in same format as legacy function for compatibility
  return {
    gradingResult: gradingResult,
    stage1Data: mergedAnalysis, // Return merged analysis as stage1Data
  };
}
