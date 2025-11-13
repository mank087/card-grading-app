// Schema validation utilities for DVG v1
// Validates vision grading results against JSON schema

import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import type { VisionGradeResult } from './visionGrader';

// Initialize Ajv validator
const ajv = new Ajv({
  allErrors: true,
  verbose: true
});

// Load and cache schema
let visionGradeSchema: any = null;

function loadVisionGradeSchema() {
  if (visionGradeSchema) {
    return visionGradeSchema;
  }

  try {
    const schemaPath = path.join(process.cwd(), 'schemas', 'vision_grade_v1.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    visionGradeSchema = JSON.parse(schemaContent);
    console.log('[VALIDATOR] Loaded vision_grade_v1.json schema successfully');
    return visionGradeSchema;
  } catch (error) {
    console.error('[VALIDATOR] Failed to load vision_grade_v1.json schema:', error);
    throw new Error('Failed to load vision grading schema');
  }
}

// Compile schema once
let validateVisionGrade: any = null;

function getValidator() {
  if (validateVisionGrade) {
    return validateVisionGrade;
  }

  const schema = loadVisionGradeSchema();
  validateVisionGrade = ajv.compile(schema);
  console.log('[VALIDATOR] Compiled vision_grade_v1.json schema successfully');
  return validateVisionGrade;
}

/**
 * Validate vision grade result against schema
 *
 * @param result - Vision grading result to validate
 * @returns Validation result with errors if invalid
 */
export function validateVisionGradeResult(result: any): {
  valid: boolean;
  errors?: string[];
  result?: VisionGradeResult;
} {
  try {
    const validate = getValidator();
    const valid = validate(result);

    if (!valid) {
      const errors = validate.errors?.map((err: any) => {
        return `${err.instancePath || 'root'}: ${err.message}`;
      }) || ['Unknown validation error'];

      console.error('[VALIDATOR] Validation failed:', errors);

      return {
        valid: false,
        errors
      };
    }

    console.log('[VALIDATOR] Validation passed successfully');

    return {
      valid: true,
      result: result as VisionGradeResult
    };

  } catch (error) {
    console.error('[VALIDATOR] Validation error:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error']
    };
  }
}

/**
 * Validate and sanitize vision grade result
 * Fixes common issues and validates
 *
 * @param result - Raw vision grading result
 * @returns Sanitized and validated result
 */
export function sanitizeAndValidate(result: any): {
  valid: boolean;
  errors?: string[];
  result?: VisionGradeResult;
} {
  try {
    // Create a copy to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(result));

    // Fix common issues
    if (sanitized.meta) {
      // Ensure version is exactly "dvg-v1"
      if (sanitized.meta.version !== 'dvg-v1') {
        console.log('[VALIDATOR] Fixing meta.version to "dvg-v1"');
        sanitized.meta.version = 'dvg-v1';
      }

      // Ensure provider is "openai"
      if (sanitized.meta.provider !== 'openai') {
        console.log('[VALIDATOR] Fixing meta.provider to "openai"');
        sanitized.meta.provider = 'openai';
      }
    }

    // Ensure recommended_grade values are correct types
    if (sanitized.recommended_grade) {
      const decimalGrade = parseFloat(sanitized.recommended_grade.recommended_decimal_grade);
      const wholeGrade = parseInt(sanitized.recommended_grade.recommended_whole_grade);

      if (!isNaN(decimalGrade)) {
        sanitized.recommended_grade.recommended_decimal_grade = decimalGrade;
      }

      if (!isNaN(wholeGrade)) {
        sanitized.recommended_grade.recommended_whole_grade = wholeGrade;
      }

      // Ensure uncertainty is valid enum value
      const uncertainty = sanitized.recommended_grade.grade_uncertainty;
      if (uncertainty !== '±0.0' && uncertainty !== '±0.5' && uncertainty !== '±1.0') {
        console.log('[VALIDATOR] Invalid uncertainty, defaulting to ±0.5');
        sanitized.recommended_grade.grade_uncertainty = '±0.5';
      }
    }

    // Validate centering ratios format (XX/XX)
    if (sanitized.centering) {
      const ratioPattern = /^\d{2}\/\d{2}$/;

      ['front_left_right_ratio_text', 'front_top_bottom_ratio_text',
       'back_left_right_ratio_text', 'back_top_bottom_ratio_text'].forEach(key => {
        if (sanitized.centering[key] && !ratioPattern.test(sanitized.centering[key])) {
          console.log(`[VALIDATOR] Invalid centering ratio format for ${key}, defaulting to 50/50`);
          sanitized.centering[key] = '50/50';
        }
      });

      // Ensure method is valid enum
      ['method_front', 'method_back'].forEach(key => {
        const method = sanitized.centering[key];
        if (method !== 'border-present' && method !== 'design-anchor') {
          console.log(`[VALIDATOR] Invalid centering method for ${key}, defaulting to design-anchor`);
          sanitized.centering[key] = 'design-anchor';
        }
      });
    }

    // Validate image quality grade
    if (sanitized.image_quality) {
      const grade = sanitized.image_quality.grade;
      if (grade !== 'A' && grade !== 'B' && grade !== 'C' && grade !== 'D') {
        console.log('[VALIDATOR] Invalid image quality grade, defaulting to B');
        sanitized.image_quality.grade = 'B';
      }
    }

    // Now validate the sanitized result
    return validateVisionGradeResult(sanitized);

  } catch (error) {
    console.error('[VALIDATOR] Sanitization error:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Sanitization failed']
    };
  }
}

/**
 * Quick validation - checks only essential fields
 * Use this for fast pre-validation before full schema check
 */
export function quickValidate(result: any): boolean {
  try {
    return !!(
      result &&
      result.meta?.version === 'dvg-v1' &&
      result.card_info?.card_name &&
      result.centering?.front_left_right_ratio_text &&
      result.defects?.front &&
      result.defects?.back &&
      result.recommended_grade?.recommended_decimal_grade &&
      typeof result.recommended_grade.recommended_decimal_grade === 'number' &&
      result.recommended_grade.recommended_decimal_grade >= 1 &&
      result.recommended_grade.recommended_decimal_grade <= 10
    );
  } catch {
    return false;
  }
}

/**
 * Get human-readable validation errors
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return 'No errors';
  }

  if (errors.length === 1) {
    return errors[0];
  }

  return `${errors.length} validation errors:\n- ${errors.join('\n- ')}`;
}
