/**
 * eBay Title Builder
 *
 * Deterministic construction of eBay listing titles within the 80-character
 * limit. Shared algorithm with the mobile app — keep changes in sync.
 *
 * Rules:
 * - Required segments always present: name, `DCM ${grade}`, condition
 *   (condition skipped when empty).
 * - Optional segments are ADDED in priority order (setName, cardNumber,
 *   year, subset, serialNumbering) while the joined title stays <= 80 chars,
 *   but EMITTED in display order (name, subset, setName, cardNumber, year,
 *   serialNumbering, grade, condition).
 * - Duplicate-ish optionals are skipped (lowercase alphanumeric
 *   normalization already contained in the included segments) to prevent
 *   titles like "Pikachu - Pikachu Promo".
 * - If the required segments alone exceed 80 chars, the NAME is truncated at
 *   a word boundary (no ellipsis — eBay characters are precious) so the full
 *   required tail always fits, and optionals are skipped entirely.
 */

export interface EbayTitleInput {
  name: string;
  setName?: string;
  subset?: string;
  cardNumber?: string;
  year?: string;
  serialNumbering?: string;
  grade: number | string;
  condition?: string;
}

const MAX_TITLE_LENGTH = 80;
const SEPARATOR = ' - ';

/** Collapse internal whitespace and trim; null/undefined become ''. */
function cleanSegment(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/** Lowercase alphanumeric normalization used for duplicate detection. */
function normalizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildEbayTitle(input: EbayTitleInput): string {
  const name = cleanSegment(input.name);
  const gradeSegment = `DCM ${cleanSegment(input.grade)}`;
  const condition = cleanSegment(input.condition);

  // Required tail: grade always, condition only when present.
  const requiredTail = condition ? [gradeSegment, condition] : [gradeSegment];

  // If the required segments alone exceed the limit, truncate the NAME at a
  // word boundary so the full required tail always fits. No optionals.
  const requiredOnly = [name, ...requiredTail].filter(Boolean).join(SEPARATOR);
  if (requiredOnly.length > MAX_TITLE_LENGTH) {
    const tail = requiredTail.join(SEPARATOR);
    const available = MAX_TITLE_LENGTH - tail.length - SEPARATOR.length;
    if (available < 1) {
      // Degenerate case: even the tail alone doesn't fit — hard-cap it.
      return tail.slice(0, MAX_TITLE_LENGTH).trim();
    }
    let truncatedName = name.slice(0, available);
    if (name.charAt(available) !== ' ') {
      // Cut mid-word — back up to the previous word boundary if one exists.
      const lastSpace = truncatedName.lastIndexOf(' ');
      if (lastSpace > 0) truncatedName = truncatedName.slice(0, lastSpace);
    }
    truncatedName = truncatedName.trim();
    return [truncatedName, ...requiredTail].filter(Boolean).join(SEPARATOR);
  }

  // Optional segments: try in PRIORITY order, emit in DISPLAY order.
  // serialNumbering has no explicit display slot in the spec — it sits after
  // year (matching the pre-builder web title layout).
  const optionalPriority: Array<keyof EbayTitleInput> = [
    'setName',
    'cardNumber',
    'year',
    'subset',
    'serialNumbering',
  ];
  const displayOrder: Array<keyof EbayTitleInput> = [
    'subset',
    'setName',
    'cardNumber',
    'year',
    'serialNumbering',
  ];

  const included: Partial<Record<keyof EbayTitleInput, string>> = {};

  const assemble = (): string[] => {
    const parts: string[] = [name];
    for (const key of displayOrder) {
      const value = included[key];
      if (value) parts.push(value);
    }
    parts.push(...requiredTail);
    return parts.filter(Boolean);
  };

  for (const key of optionalPriority) {
    const value = cleanSegment(input[key]);
    if (!value) continue;

    // Dedupe: skip if this segment's normalization is already contained in
    // the normalization of the segments included so far.
    const normalized = normalizeSegment(value);
    const includedNormalization = assemble().map(normalizeSegment).join('');
    if (!normalized || includedNormalization.includes(normalized)) continue;

    // Tentatively include; roll back if the joined title no longer fits.
    included[key] = value;
    if (assemble().join(SEPARATOR).length > MAX_TITLE_LENGTH) {
      delete included[key];
    }
  }

  return assemble().join(SEPARATOR);
}
