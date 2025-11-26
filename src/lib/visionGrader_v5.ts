/**
 * Vision Grader v5.0
 * Supports new master rubric + delta architecture with OpenAI Structured Outputs
 *
 * Features:
 * - Master rubric + card-type delta loading
 * - OpenAI json_schema response format with Zod validation
 * - Evidence-based protocol enforcement
 * - Backward compatibility with v4.2
 * - A/B testing support
 */

import OpenAI from 'openai';
import {
  loadGradingPrompt,
  loadPromptWithFallback,
  type CardType
} from './promptLoader_v5';
import {
  getCardGradingResponseFormat,
  validateGradingResponse,
  validateEvidenceBasedRules,
  type CardGradingResponseV5
} from './cardGradingSchema_v5';
import {
  gradeCardConversational as gradeCardConversationalV4,
  type ConversationalGradeResultV3_3
} from './visionGrader';

/**
 * Grading options for v5.0
 */
export interface GradeCardOptionsV5 {
  frontImageUrl: string;
  backImageUrl: string;
  cardType: CardType;

  // API parameters
  model?: 'gpt-4o' | 'gpt-4o-mini';
  temperature?: number;
  max_tokens?: number;
  seed?: number;
  top_p?: number;

  // v5.0 specific options
  useV5Architecture?: boolean;  // Use v5.0 master+delta (default: check env var)
  strictValidation?: boolean;   // Enforce evidence-based validation (default: true)
  fallbackToV4?: boolean;       // Fall back to v4.2 if v5.0 fails (default: true)
}

/**
 * Grading result for v5.0
 */
export interface GradeResultV5 {
  success: boolean;
  version: 'v5.0' | 'v4.2';
  data?: CardGradingResponseV5;
  legacyData?: ConversationalGradeResultV3_3;  // If fallback to v4.2
  validation?: {
    schema_valid: boolean;
    evidence_based_warnings: string[];
  };
  error?: string;
  metadata: {
    card_type: CardType;
    prompt_tokens_estimated?: number;
    processing_time_ms?: number;
    model_used: string;
  };
}

/**
 * Grade card using v5.0 architecture (master rubric + delta)
 *
 * @param options - Grading options
 * @returns Grading result with validation
 */
export async function gradeCardV5(options: GradeCardOptionsV5): Promise<GradeResultV5> {
  const startTime = Date.now();

  const {
    frontImageUrl,
    backImageUrl,
    cardType,
    model = 'gpt-4o',
    temperature = 0.2,
    max_tokens = 6000,  // Slightly higher for structured outputs
    seed = 42,
    top_p = 1.0,
    useV5Architecture = process.env.USE_V5_ARCHITECTURE === 'true',
    strictValidation = true,
    fallbackToV4 = true
  } = options;

  console.log(`[Vision Grader v5.0] Starting grading for ${cardType} card`);
  console.log(`[Vision Grader v5.0] Architecture: ${useV5Architecture ? 'v5.0 (master+delta)' : 'v4.2 (legacy)'}`);

  // If not using v5.0, delegate to v4.2
  if (!useV5Architecture) {
    console.log('[Vision Grader v5.0] Using legacy v4.2 architecture');
    try {
      const legacyResult = await gradeCardConversationalV4(
        frontImageUrl,
        backImageUrl,
        cardType,
        { model, temperature, max_tokens, seed, top_p }
      );

      return {
        success: true,
        version: 'v4.2',
        legacyData: legacyResult,
        metadata: {
          card_type: cardType,
          processing_time_ms: Date.now() - startTime,
          model_used: model
        }
      };
    } catch (error) {
      console.error('[Vision Grader v5.0] Legacy v4.2 grading failed:', error);
      return {
        success: false,
        version: 'v4.2',
        error: `Legacy v4.2 grading failed: ${error}`,
        metadata: {
          card_type: cardType,
          processing_time_ms: Date.now() - startTime,
          model_used: model
        }
      };
    }
  }

  // Load v5.0 prompt (master + delta)
  console.log('[Vision Grader v5.0] Loading master rubric + delta...');
  const promptResult = loadGradingPrompt(cardType);

  if (!promptResult.success || !promptResult.prompt) {
    console.error('[Vision Grader v5.0] Failed to load v5.0 prompts:', promptResult.error);

    if (fallbackToV4) {
      console.log('[Vision Grader v5.0] Falling back to v4.2...');
      try {
        const legacyResult = await gradeCardConversationalV4(
          frontImageUrl,
          backImageUrl,
          cardType,
          { model, temperature, max_tokens, seed, top_p }
        );

        return {
          success: true,
          version: 'v4.2',
          legacyData: legacyResult,
          metadata: {
            card_type: cardType,
            processing_time_ms: Date.now() - startTime,
            model_used: model
          }
        };
      } catch (error) {
        return {
          success: false,
          version: 'v4.2',
          error: `Both v5.0 and v4.2 failed. v5.0 error: ${promptResult.error}. v4.2 error: ${error}`,
          metadata: {
            card_type: cardType,
            processing_time_ms: Date.now() - startTime,
            model_used: model
          }
        };
      }
    }

    return {
      success: false,
      version: 'v5.0',
      error: promptResult.error || 'Failed to load v5.0 prompts',
      metadata: {
        card_type: cardType,
        processing_time_ms: Date.now() - startTime,
        model_used: model
      }
    };
  }

  console.log('[Vision Grader v5.0] ✅ Prompts loaded successfully');
  console.log(`[Vision Grader v5.0] 📊 Estimated tokens: ${promptResult.metadata.estimated_tokens}`);

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log('[Vision Grader v5.0] Calling OpenAI API with structured outputs...');

    // Build API call with json_schema response format
    const response = await openai.chat.completions.create({
      model: model,
      temperature: temperature,
      top_p: top_p,
      max_tokens: max_tokens,
      seed: seed,
      response_format: getCardGradingResponseFormat(),  // 🆕 OpenAI Structured Outputs
      messages: [
        {
          role: 'system',
          content: promptResult.prompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: frontImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'image_url',
              image_url: {
                url: backImageUrl,
                detail: 'auto'
              }
            },
            {
              type: 'text',
              text: `Grade these card images following the master grading rubric and ${cardType} delta rules.

🔍 CRITICAL REQUIREMENTS (Evidence-Based Grading Protocol - Section 7):

**BURDEN OF PROOF (Universal):**
- Every defect claim requires: LOCATION, SIZE, VISUAL CHARACTERISTICS, OBSERVABLE COLORS, DETECTION METHOD
- Every "no defect" claim requires: INSPECTION DOCUMENTATION, NEGATIVE FINDINGS, OBSERVABLE FEATURES
- Descriptions must be UNIQUE for each corner/edge - no template language or copy-paste

**DESCRIPTION-SCORE CONSISTENCY (Two-Directional):**
- IF defect described → MUST deduct points AND add to defects array
- IF score < 10.0 → MUST describe why in narrative
- Defects array MUST match narrative descriptions (count and content)

**MANDATORY VERIFICATION BEFORE SUBMISSION:**
□ Every defect in narrative appears in defects array
□ Every defect array entry mentioned in narrative
□ Scores match descriptions logically
□ If score = 10.0, description states "zero defects" with evidence
□ If score < 10.0, description explains what caused deduction

Return complete JSON response following the schema.`
            }
          ]
        }
      ]
    });

    console.log('[Vision Grader v5.0] ✅ Received API response');

    const responseMessage = response.choices[0]?.message;
    if (!responseMessage || !responseMessage.content) {
      throw new Error('No response content from API');
    }

    // Parse and validate JSON response
    let jsonData: any;
    try {
      jsonData = JSON.parse(responseMessage.content);
      console.log('[Vision Grader v5.0] ✅ Valid JSON received');
    } catch (parseError) {
      console.error('[Vision Grader v5.0] ❌ JSON parse error:', parseError);
      throw new Error('Failed to parse JSON response from AI');
    }

    // Validate against Zod schema
    const validationResult = validateGradingResponse(jsonData);
    if (!validationResult.success) {
      console.error('[Vision Grader v5.0] ❌ Schema validation failed:', validationResult.errors);

      if (strictValidation) {
        throw new Error(`Schema validation failed: ${validationResult.errors?.message}`);
      } else {
        console.warn('[Vision Grader v5.0] ⚠️ Schema validation failed but continuing (strict validation disabled)');
      }
    }

    console.log('[Vision Grader v5.0] ✅ Schema validation passed');

    // Run evidence-based protocol validation
    const evidenceWarnings = strictValidation && validationResult.data
      ? validateEvidenceBasedRules(validationResult.data)
      : [];

    if (evidenceWarnings.length > 0) {
      console.warn('[Vision Grader v5.0] ⚠️ Evidence-based validation warnings:');
      evidenceWarnings.forEach(warning => console.warn(`  - ${warning}`));
    } else {
      console.log('[Vision Grader v5.0] ✅ Evidence-based validation passed');
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Vision Grader v5.0] ✅ Grading complete (${processingTime}ms)`);

    return {
      success: true,
      version: 'v5.0',
      data: validationResult.data,
      validation: {
        schema_valid: validationResult.success,
        evidence_based_warnings: evidenceWarnings
      },
      metadata: {
        card_type: cardType,
        prompt_tokens_estimated: promptResult.metadata.estimated_tokens,
        processing_time_ms: processingTime,
        model_used: model
      }
    };

  } catch (error) {
    console.error('[Vision Grader v5.0] ❌ Grading failed:', error);

    // Fall back to v4.2 if enabled
    if (fallbackToV4) {
      console.log('[Vision Grader v5.0] Attempting v4.2 fallback...');
      try {
        const legacyResult = await gradeCardConversationalV4(
          frontImageUrl,
          backImageUrl,
          cardType,
          { model, temperature, max_tokens, seed, top_p }
        );

        return {
          success: true,
          version: 'v4.2',
          legacyData: legacyResult,
          metadata: {
            card_type: cardType,
            processing_time_ms: Date.now() - startTime,
            model_used: model
          }
        };
      } catch (fallbackError) {
        return {
          success: false,
          version: 'v4.2',
          error: `Both v5.0 and v4.2 failed. v5.0 error: ${error}. v4.2 error: ${fallbackError}`,
          metadata: {
            card_type: cardType,
            processing_time_ms: Date.now() - startTime,
            model_used: model
          }
        };
      }
    }

    return {
      success: false,
      version: 'v5.0',
      error: `v5.0 grading failed: ${error}`,
      metadata: {
        card_type: cardType,
        prompt_tokens_estimated: promptResult.metadata.estimated_tokens,
        processing_time_ms: Date.now() - startTime,
        model_used: model
      }
    };
  }
}

/**
 * Smart grader: Automatically selects best architecture based on environment
 *
 * @param options - Grading options
 * @returns Grading result
 */
export async function gradeCardSmart(options: GradeCardOptionsV5): Promise<GradeResultV5> {
  // Check environment variable for architecture preference
  const preferV5 = process.env.USE_V5_ARCHITECTURE === 'true';

  return gradeCardV5({
    ...options,
    useV5Architecture: preferV5,
    fallbackToV4: true,  // Always enable fallback in smart mode
    strictValidation: true
  });
}

/**
 * A/B test grader: Run both v5.0 and v4.2, compare results
 *
 * This is useful for:
 * - Validating v5.0 produces equivalent or better results
 * - Measuring token/cost reduction
 * - Identifying any regressions
 *
 * @param options - Grading options
 * @returns Results from both versions
 */
export async function gradeCardABTest(options: GradeCardOptionsV5): Promise<{
  v5: GradeResultV5;
  v4: GradeResultV5;
  comparison: {
    both_succeeded: boolean;
    v5_faster: boolean;
    v5_token_savings_percent?: number;
    grades_match?: boolean;
    grade_diff?: number;
  };
}> {
  console.log('[A/B Test] Running both v5.0 and v4.2 for comparison...');

  // Run v5.0
  const v5Result = await gradeCardV5({
    ...options,
    useV5Architecture: true,
    fallbackToV4: false,  // Don't fallback during A/B test
    strictValidation: true
  });

  // Run v4.2
  const v4Result = await gradeCardV5({
    ...options,
    useV5Architecture: false,
    fallbackToV4: false,
    strictValidation: false
  });

  // Compare results
  const bothSucceeded = v5Result.success && v4Result.success;
  const v5Faster = v5Result.metadata.processing_time_ms! < v4Result.metadata.processing_time_ms!;

  let gradesMatch: boolean | undefined;
  let gradeDiff: number | undefined;

  if (bothSucceeded && v5Result.data && v4Result.legacyData) {
    const v5Grade = v5Result.data.final_grade.decimal_grade;
    const v4Grade = v4Result.legacyData.grade?.decimal_grade;

    if (v5Grade !== null && v4Grade !== null) {
      gradeDiff = Math.abs(v5Grade - v4Grade);
      gradesMatch = gradeDiff < 0.1;  // Consider grades matching if within 0.1
    }
  }

  // Calculate token savings (v5.0 should use ~40% fewer tokens)
  let tokenSavingsPercent: number | undefined;
  if (v5Result.metadata.prompt_tokens_estimated && v4Result.metadata.prompt_tokens_estimated) {
    const reduction = v4Result.metadata.prompt_tokens_estimated - v5Result.metadata.prompt_tokens_estimated;
    tokenSavingsPercent = (reduction / v4Result.metadata.prompt_tokens_estimated) * 100;
  }

  console.log('[A/B Test] Comparison results:');
  console.log(`  - Both succeeded: ${bothSucceeded}`);
  console.log(`  - v5.0 faster: ${v5Faster} (v5: ${v5Result.metadata.processing_time_ms}ms, v4: ${v4Result.metadata.processing_time_ms}ms)`);
  console.log(`  - Token savings: ${tokenSavingsPercent?.toFixed(1)}%`);
  console.log(`  - Grades match: ${gradesMatch} (diff: ${gradeDiff})`);

  return {
    v5: v5Result,
    v4: v4Result,
    comparison: {
      both_succeeded: bothSucceeded,
      v5_faster: v5Faster,
      v5_token_savings_percent: tokenSavingsPercent,
      grades_match: gradesMatch,
      grade_diff: gradeDiff
    }
  };
}
