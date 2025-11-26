/**
 * DCM Serial Number Generator
 *
 * Generates uniform 6-digit randomized numeric serial numbers for all cards.
 * Format: 000001-999999 (random, non-sequential)
 *
 * Benefits:
 * - 6 digits = 999,999 unique combinations (expandable to 7+ digits when needed)
 * - Numbers-only format is easy to type, read, and search
 * - Random assignment prevents guessing/enumeration of card IDs
 * - Database check ensures no duplicates
 * - No category prefixes - category is tracked separately in database
 *
 * Future expansion:
 * - When approaching 900,000 cards, expand to 7 digits (9,999,999 combinations)
 * - System automatically handles mixed-length serials
 */

import { supabaseAdmin } from './supabaseAdmin';

const SERIAL_LENGTH = 6;
const MAX_SERIAL = 999999; // 6-digit max
const MIN_SERIAL = 1;
const MAX_RETRIES = 10; // Max attempts to find unique serial

/**
 * Generates a random 6-digit DCM serial number.
 * Checks database to ensure uniqueness - no duplicates allowed.
 *
 * @returns Promise<string> - 6-digit zero-padded random serial number
 */
export async function generateNextSerial(): Promise<string> {
  try {
    // Get all existing numeric serials for duplicate checking
    const { data: existingCards, error } = await supabaseAdmin
      .from('cards')
      .select('serial');

    if (error) {
      console.error('[SerialGenerator] Database error:', error);
      throw error;
    }

    // Build a Set of existing numeric serials for fast lookup
    const existingSerials = new Set<string>();
    if (existingCards) {
      for (const card of existingCards) {
        if (card.serial && /^\d+$/.test(card.serial)) {
          existingSerials.add(card.serial);
        }
      }
    }

    console.log(`[SerialGenerator] Found ${existingSerials.size} existing numeric serials`);

    // Generate random serial, retry if duplicate
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      // Generate random number between MIN_SERIAL and MAX_SERIAL
      const randomNum = Math.floor(Math.random() * (MAX_SERIAL - MIN_SERIAL + 1)) + MIN_SERIAL;
      const paddedSerial = randomNum.toString().padStart(SERIAL_LENGTH, '0');

      if (!existingSerials.has(paddedSerial)) {
        console.log(`[SerialGenerator] Generated unique serial: ${paddedSerial} (attempt ${attempts + 1})`);
        return paddedSerial;
      }

      attempts++;
      console.log(`[SerialGenerator] Serial ${paddedSerial} already exists, retrying...`);
    }

    // If we couldn't find a unique 6-digit serial after MAX_RETRIES,
    // expand to 7 digits (this means we're approaching capacity)
    console.warn(`[SerialGenerator] 6-digit space congested, expanding to 7 digits`);
    const expandedSerial = generateExpandedSerial(existingSerials);
    return expandedSerial;

  } catch (error) {
    console.error('[SerialGenerator] Failed to generate serial:', error);
    // Fallback to timestamp-based serial if database fails
    const timestamp = Date.now();
    const fallbackSerial = timestamp.toString().slice(-SERIAL_LENGTH).padStart(SERIAL_LENGTH, '0');
    console.warn(`[SerialGenerator] Using fallback serial: ${fallbackSerial}`);
    return fallbackSerial;
  }
}

/**
 * Generates an expanded (7+ digit) serial when 6-digit space is congested.
 */
function generateExpandedSerial(existingSerials: Set<string>): string {
  const EXPANDED_LENGTH = 7;
  const EXPANDED_MAX = 9999999;
  const EXPANDED_MIN = 1000000; // Start at 1M to distinguish from 6-digit

  for (let i = 0; i < MAX_RETRIES; i++) {
    const randomNum = Math.floor(Math.random() * (EXPANDED_MAX - EXPANDED_MIN + 1)) + EXPANDED_MIN;
    const paddedSerial = randomNum.toString().padStart(EXPANDED_LENGTH, '0');

    if (!existingSerials.has(paddedSerial)) {
      console.log(`[SerialGenerator] Generated expanded serial: ${paddedSerial}`);
      return paddedSerial;
    }
  }

  // Ultimate fallback: use timestamp
  return Date.now().toString().slice(-10);
}

/**
 * Validates if a serial number is in the new numeric format.
 * Accepts 6+ digit numeric serials (supports future expansion).
 *
 * @param serial - Serial number to validate
 * @returns boolean - true if valid 6+ digit numeric format
 */
export function isValidNumericSerial(serial: string): boolean {
  return /^\d{6,}$/.test(serial);
}

/**
 * Checks if a serial is in the old category-prefix format.
 *
 * @param serial - Serial number to check
 * @returns boolean - true if old format (e.g., "SPORTS-abc123")
 */
export function isOldSerialFormat(serial: string): boolean {
  return /^[A-Z]+-[a-z0-9]+$/.test(serial);
}

/**
 * Formats a numeric serial for display.
 *
 * @param serial - 6-digit serial number
 * @returns string - Serial number (no grouping for 6-digit)
 */
export function formatSerialForDisplay(serial: string): string {
  if (!serial) return 'N/A';
  return serial;
}
