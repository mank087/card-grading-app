/**
 * Prompt Loader v5.0
 * Loads master grading rubric + card-type-specific delta files
 *
 * Architecture:
 * - master_grading_rubric_v5.txt: Universal grading rules (~18,000-20,000 tokens)
 * - [card_type]_delta_v5.txt: Card-specific extraction and patterns (~1,800-5,500 tokens)
 *
 * Benefits:
 * - Eliminates 70-80% redundancy across card types
 * - Reduces token usage by ~40% average
 * - Reduces API costs by 40-60%
 * - Consistent grading standards across all card types
 */

import fs from 'fs';
import path from 'path';

// Card types supported by v5.0 architecture
export type CardType = 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'onepiece' | 'other';

/**
 * Prompt loading result
 */
export interface PromptLoadResult {
  success: boolean;
  prompt?: string;
  error?: string;
  metadata: {
    card_type: CardType;
    master_rubric_loaded: boolean;
    delta_loaded: boolean;
    master_rubric_length?: number;
    delta_length?: number;
    combined_length?: number;
    estimated_tokens?: number;
  };
}

/**
 * Load master grading rubric (universal)
 *
 * @returns Master rubric text or null if error
 */
function loadMasterRubric(): { text: string | null; error?: string } {
  try {
    const masterRubricPath = path.join(
      process.cwd(),
      'prompts',
      'master_grading_rubric_v5.txt'
    );

    if (!fs.existsSync(masterRubricPath)) {
      return {
        text: null,
        error: `Master rubric not found at: ${masterRubricPath}`
      };
    }

    const text = fs.readFileSync(masterRubricPath, 'utf-8');

    if (!text || text.trim().length === 0) {
      return {
        text: null,
        error: 'Master rubric file is empty'
      };
    }

    console.log(`[Prompt Loader v5] ✅ Loaded master rubric (${text.length} chars)`);
    return { text };
  } catch (error) {
    console.error('[Prompt Loader v5] ❌ Error loading master rubric:', error);
    return {
      text: null,
      error: `Failed to load master rubric: ${error}`
    };
  }
}

/**
 * Load card-type-specific delta file
 *
 * @param cardType - Card type (sports, pokemon, mtg, lorcana, other)
 * @returns Delta file text or null if error
 */
function loadDelta(cardType: CardType): { text: string | null; error?: string } {
  try {
    const deltaFileName = `${cardType}_delta_v5.txt`;
    const deltaPath = path.join(
      process.cwd(),
      'prompts',
      deltaFileName
    );

    if (!fs.existsSync(deltaPath)) {
      return {
        text: null,
        error: `Delta file not found for ${cardType} at: ${deltaPath}`
      };
    }

    const text = fs.readFileSync(deltaPath, 'utf-8');

    if (!text || text.trim().length === 0) {
      return {
        text: null,
        error: `Delta file for ${cardType} is empty`
      };
    }

    console.log(`[Prompt Loader v5] ✅ Loaded ${cardType} delta (${text.length} chars)`);
    return { text };
  } catch (error) {
    console.error(`[Prompt Loader v5] ❌ Error loading ${cardType} delta:`, error);
    return {
      text: null,
      error: `Failed to load ${cardType} delta: ${error}`
    };
  }
}

/**
 * Load complete grading prompt: master rubric + card-type delta
 *
 * @param cardType - Card type to load prompt for
 * @returns Complete grading prompt or error
 */
export function loadGradingPrompt(cardType: CardType): PromptLoadResult {
  console.log(`[Prompt Loader v5] 📋 Loading grading prompt for: ${cardType}`);

  // Load master rubric
  const masterResult = loadMasterRubric();
  if (!masterResult.text) {
    return {
      success: false,
      error: masterResult.error || 'Failed to load master rubric',
      metadata: {
        card_type: cardType,
        master_rubric_loaded: false,
        delta_loaded: false
      }
    };
  }

  // Load card-type delta
  const deltaResult = loadDelta(cardType);
  if (!deltaResult.text) {
    return {
      success: false,
      error: deltaResult.error || `Failed to load ${cardType} delta`,
      metadata: {
        card_type: cardType,
        master_rubric_loaded: true,
        delta_loaded: false,
        master_rubric_length: masterResult.text.length
      }
    };
  }

  // Combine prompts with clear separator
  const combinedPrompt = `${masterResult.text}

═══════════════════════════════════════════════════════════════════════
CARD TYPE: ${cardType.toUpperCase()}
APPLYING CARD-SPECIFIC DELTA RULES
═══════════════════════════════════════════════════════════════════════

${deltaResult.text}

═══════════════════════════════════════════════════════════════════════
END OF COMBINED GRADING INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════

You have now loaded:
1. Master Grading Rubric v5.0 (universal grading rules)
2. ${cardType.charAt(0).toUpperCase() + cardType.slice(1)} Card Delta v5.0 (card-specific rules)

Apply ALL instructions from BOTH files to complete your grading analysis.

CRITICAL REMINDERS:
- Follow Evidence-Based Grading Protocol (Section 7) for ALL assessments
- Every claim (defect OR pristine) requires observable evidence
- Description-score consistency is MANDATORY
- No template language - each corner/edge must be unique
- Validate your response before submission using the verification checklist
`;

  const combinedLength = combinedPrompt.length;
  const estimatedTokens = Math.ceil(combinedLength / 4); // Rough estimate: 4 chars per token

  console.log(`[Prompt Loader v5] ✅ Combined prompt ready`);
  console.log(`[Prompt Loader v5] 📊 Master: ${masterResult.text.length} chars, Delta: ${deltaResult.text.length} chars, Total: ${combinedLength} chars (~${estimatedTokens} tokens)`);

  return {
    success: true,
    prompt: combinedPrompt,
    metadata: {
      card_type: cardType,
      master_rubric_loaded: true,
      delta_loaded: true,
      master_rubric_length: masterResult.text.length,
      delta_length: deltaResult.text.length,
      combined_length: combinedLength,
      estimated_tokens: estimatedTokens
    }
  };
}

/**
 * Get estimated token counts for each card type (for cost analysis)
 *
 * @returns Token estimates for all card types
 */
export function getTokenEstimates(): Record<CardType, number> {
  const cardTypes: CardType[] = ['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'other'];
  const estimates: Record<CardType, number> = {} as any;

  for (const cardType of cardTypes) {
    const result = loadGradingPrompt(cardType);
    if (result.success && result.metadata.estimated_tokens) {
      estimates[cardType] = result.metadata.estimated_tokens;
    } else {
      estimates[cardType] = 0;
    }
  }

  return estimates;
}

/**
 * Validate that all required prompt files exist
 *
 * @returns Validation results
 */
export function validatePromptFiles(): {
  valid: boolean;
  missing: string[];
  found: string[];
} {
  const requiredFiles = [
    'master_grading_rubric_v5.txt',
    'sports_delta_v5.txt',
    'pokemon_delta_v5.txt',
    'mtg_delta_v5.txt',
    'lorcana_delta_v5.txt',
    'onepiece_delta_v5.txt',
    'other_delta_v5.txt',
    'evidence_based_grading_protocol.txt' // Not directly loaded but should exist
  ];

  const promptsDir = path.join(process.cwd(), 'prompts');
  const missing: string[] = [];
  const found: string[] = [];

  for (const file of requiredFiles) {
    const filePath = path.join(promptsDir, file);
    if (fs.existsSync(filePath)) {
      found.push(file);
    } else {
      missing.push(file);
    }
  }

  const valid = missing.length === 0;

  if (valid) {
    console.log('[Prompt Loader v5] ✅ All required prompt files found');
  } else {
    console.error('[Prompt Loader v5] ❌ Missing prompt files:', missing);
  }

  return { valid, missing, found };
}

/**
 * Legacy fallback: Load old v4.2 prompt if v5.0 files not available
 *
 * @param cardType - Card type
 * @returns Legacy prompt or null
 */
export function loadLegacyPrompt(cardType: CardType): string | null {
  try {
    // Map v5 card types to v4.2 file names
    const legacyFileMap: Record<CardType, string> = {
      'sports': 'card_grader_v4_2_sports.txt',
      'pokemon': 'card_grader_v4_2_pokemon.txt',
      'mtg': 'card_grader_v4_2_mtg.txt',
      'lorcana': 'card_grader_v4_2_lorcana.txt',
      'onepiece': 'card_grader_v4_2_other.txt', // Falls back to 'other' for legacy
      'other': 'card_grader_v4_2_other.txt'
    };

    const legacyFileName = legacyFileMap[cardType];
    const legacyPath = path.join(
      process.cwd(),
      'prompts',
      legacyFileName
    );

    if (!fs.existsSync(legacyPath)) {
      console.warn(`[Prompt Loader v5] ⚠️ Legacy prompt not found: ${legacyFileName}`);
      return null;
    }

    const text = fs.readFileSync(legacyPath, 'utf-8');
    console.log(`[Prompt Loader v5] 📄 Loaded legacy v4.2 prompt for ${cardType}`);
    return text;
  } catch (error) {
    console.error(`[Prompt Loader v5] ❌ Error loading legacy prompt:`, error);
    return null;
  }
}

/**
 * Smart prompt loader: Try v5.0 first, fall back to v4.2 if needed
 *
 * @param cardType - Card type
 * @param preferV5 - Prefer v5.0 architecture (default: true)
 * @returns Prompt loading result with fallback handling
 */
export function loadPromptWithFallback(
  cardType: CardType,
  preferV5: boolean = true
): PromptLoadResult & { version: 'v5.0' | 'v4.2' } {
  if (preferV5) {
    // Try v5.0 first
    const v5Result = loadGradingPrompt(cardType);
    if (v5Result.success) {
      console.log(`[Prompt Loader v5] ✅ Using v5.0 architecture for ${cardType}`);
      return { ...v5Result, version: 'v5.0' };
    }

    // Fall back to v4.2
    console.warn(`[Prompt Loader v5] ⚠️ v5.0 load failed, attempting v4.2 fallback...`);
    const legacyPrompt = loadLegacyPrompt(cardType);
    if (legacyPrompt) {
      console.log(`[Prompt Loader v5] 📄 Using legacy v4.2 prompt for ${cardType}`);
      return {
        success: true,
        prompt: legacyPrompt,
        version: 'v4.2',
        metadata: {
          card_type: cardType,
          master_rubric_loaded: false,
          delta_loaded: false,
          combined_length: legacyPrompt.length,
          estimated_tokens: Math.ceil(legacyPrompt.length / 4)
        }
      };
    }

    // Both failed
    return {
      success: false,
      error: 'Failed to load v5.0 or v4.2 prompts',
      version: 'v4.2',
      metadata: {
        card_type: cardType,
        master_rubric_loaded: false,
        delta_loaded: false
      }
    };
  } else {
    // Load v4.2 directly
    const legacyPrompt = loadLegacyPrompt(cardType);
    if (legacyPrompt) {
      console.log(`[Prompt Loader v5] 📄 Using legacy v4.2 prompt for ${cardType} (by preference)`);
      return {
        success: true,
        prompt: legacyPrompt,
        version: 'v4.2',
        metadata: {
          card_type: cardType,
          master_rubric_loaded: false,
          delta_loaded: false,
          combined_length: legacyPrompt.length,
          estimated_tokens: Math.ceil(legacyPrompt.length / 4)
        }
      };
    }

    return {
      success: false,
      error: 'Failed to load v4.2 prompt',
      version: 'v4.2',
      metadata: {
        card_type: cardType,
        master_rubric_loaded: false,
        delta_loaded: false
      }
    };
  }
}
