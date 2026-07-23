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
 * Uniqueness: each candidate is checked with a targeted query (the previous
 * fetch-all-serials approach silently capped at supabase-js's default 1000
 * rows, so serials beyond the first 1000 cards were invisible to the dedup
 * check — the source of production `cards_serial_key` violations). A
 * check-then-insert race is still possible across concurrent uploads, so
 * callers MUST retry their insert with a fresh serial on a 23505 conflict.
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
 * Returns true if a card already uses this serial.
 * Throws on database error so the caller can fall back.
 */
async function serialExists(serial: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('serial', serial);

  if (error) {
    console.error('[SerialGenerator] Database error checking serial:', error);
    throw error;
  }
  return (count ?? 0) > 0;
}

function randomSerial(min: number, max: number, length: number): string {
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  return n.toString().padStart(length, '0');
}

/**
 * Generates a random 6-digit DCM serial number.
 * Checks database to ensure uniqueness - no duplicates allowed.
 *
 * @returns Promise<string> - 6-digit zero-padded random serial number
 */
export async function generateNextSerial(): Promise<string> {
  try {
    for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
      const candidate = randomSerial(MIN_SERIAL, MAX_SERIAL, SERIAL_LENGTH);

      if (!(await serialExists(candidate))) {
        console.log(`[SerialGenerator] Generated unique serial: ${candidate} (attempt ${attempts + 1})`);
        return candidate;
      }
      console.log(`[SerialGenerator] Serial ${candidate} already exists, retrying...`);
    }

    // If we couldn't find a unique 6-digit serial after MAX_RETRIES,
    // expand to 7 digits (this means we're approaching capacity)
    console.warn(`[SerialGenerator] 6-digit space congested, expanding to 7 digits`);
    return await generateExpandedSerial();
  } catch (error) {
    console.error('[SerialGenerator] Failed to generate serial:', error);
    // Fallback if database checks fail: timestamp tail + random suffix.
    // (A plain timestamp tail collided under concurrent uploads.)
    const timestamp = Date.now().toString().slice(-SERIAL_LENGTH);
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const fallbackSerial = `${timestamp}${suffix}`;
    console.warn(`[SerialGenerator] Using fallback serial: ${fallbackSerial}`);
    return fallbackSerial;
  }
}

/**
 * Generates an expanded (7+ digit) serial when 6-digit space is congested.
 */
async function generateExpandedSerial(): Promise<string> {
  const EXPANDED_LENGTH = 7;
  const EXPANDED_MAX = 9999999;
  const EXPANDED_MIN = 1000000; // Start at 1M to distinguish from 6-digit

  for (let i = 0; i < MAX_RETRIES; i++) {
    const candidate = randomSerial(EXPANDED_MIN, EXPANDED_MAX, EXPANDED_LENGTH);

    if (!(await serialExists(candidate))) {
      console.log(`[SerialGenerator] Generated expanded serial: ${candidate}`);
      return candidate;
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
