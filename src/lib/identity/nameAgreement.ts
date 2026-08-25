/**
 * Species / name agreement for TCG card identification (Aug 25 2026).
 *
 * A number-first database lookup (set + collector number, or a printed code)
 * can land on a REAL but WRONG card when the model misreads a digit. The name
 * the model read is the check against that. The old check was
 * `dbName.includes(aiName.slice(0, 5))`, which passes "Alolan Raichu" for
 * "Alolan Rattata", "Double Colorless Energy" for "Double Turbo Energy", and
 * "Team Rocket's Mewtwo" for "Team Rocket's Meowth" — same-prefix names that
 * sit in the same sets with nearby numbers, i.e. exactly the misread case.
 *
 * This helper compares the SPECIES (or the full name for Trainer / Energy
 * cards) after stripping variant and owner tokens, so "Pikachu" vs
 * "Pikachu ex" agrees (same species, the number decides the variant) while
 * "Alolan Raichu" vs "Alolan Rattata" does not.
 */

const VARIANT_TOKENS = new Set([
  'ex', 'gx', 'v', 'vmax', 'vstar', 'v-union', 'vunion', 'mega', 'm', 'lv', 'lvx', 'x',
  'prime', 'legend', 'break', 'tag', 'team', 'radiant', 'shining', 'shiny', 'dark', 'light',
  'delta', 'species', 'star', 'holo', 'holofoil', 'reverse', 'full', 'art', 'alt', 'sr', 'ur',
  'rainbow', 'gold', 'secret', 'promo', 'the', 'of', 'and', 'level', 'up',
]);

/** Possessive owner prefixes: "Team Rocket's", "Erika's", "Brock's", "Blaine's" … */
const OWNER_RX = /\b[a-z][a-z .]*'s\b/g;
/** Regional / form prefixes that describe the SAME species line: keep species, drop the prefix? No —
 *  "Alolan Raichu" and "Raichu" are different cards; we keep these tokens so they must both agree. */

export interface NameAgreement {
  agrees: boolean;
  /** 0..1 similarity of the compared tokens */
  similarity: number;
  reason: string;
  /** Normalised comparison keys (for logs) */
  aiKey: string;
  dbKey: string;
}

function normalise(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(OWNER_RX, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Species key: the name with variant/owner tokens removed. Empty for Trainer/Energy-style names. */
export function speciesKey(name: string): string {
  const tokens = normalise(name).split(' ').filter(Boolean).filter(t => !VARIANT_TOKENS.has(t));
  return tokens.join(' ');
}

/**
 * Does the database card's name agree with what the model read?
 * - Empty / too-short AI name → agrees (nothing to check against).
 * - Same species key (exact, or Levenshtein ≤ 1 for keys of 6+ chars) → agrees.
 * - Otherwise fall back to full-name similarity ≥ 0.8 (Trainer / Energy / odd formats).
 */
export function namesAgree(aiName: string | null | undefined, dbName: string | null | undefined): NameAgreement {
  const ai = normalise(aiName || '');
  const db = normalise(dbName || '');
  if (!ai || ai.replace(/\s/g, '').length < 3) return { agrees: true, similarity: 1, reason: 'no AI name to check', aiKey: ai, dbKey: db };
  if (!db) return { agrees: true, similarity: 1, reason: 'no DB name to check', aiKey: ai, dbKey: db };

  const aiKey = speciesKey(ai);
  const dbKey = speciesKey(db);

  if (aiKey && dbKey) {
    if (aiKey === dbKey) return { agrees: true, similarity: 1, reason: 'species match', aiKey, dbKey };
    const d = levenshtein(aiKey, dbKey);
    const maxLen = Math.max(aiKey.length, dbKey.length);
    if (maxLen >= 6 && d <= 1) return { agrees: true, similarity: 1 - d / maxLen, reason: 'species match (1 edit)', aiKey, dbKey };
    // One key contained in the other as a whole token sequence ("charizard" in "charizard ex"
    // is already handled by stripping; this catches "mr mime" vs "mr mime jr" style extensions
    // only when the shorter key is the whole of the longer key's start and the extra is a suffix word).
    const shorter = aiKey.length <= dbKey.length ? aiKey : dbKey;
    const longer = shorter === aiKey ? dbKey : aiKey;
    if (longer.startsWith(shorter + ' ') && longer.slice(shorter.length + 1).split(' ').length === 1 && shorter.split(' ').length >= 2) {
      return { agrees: true, similarity: 0.85, reason: 'species match (suffix word)', aiKey, dbKey };
    }
  }

  // Full-name similarity fallback (Trainer / Energy cards, or names that collapsed to empty keys)
  const full = 1 - levenshtein(ai, db) / Math.max(ai.length, db.length);
  if (full >= 0.8) return { agrees: true, similarity: full, reason: 'full-name similarity', aiKey, dbKey };
  return { agrees: false, similarity: full, reason: `name mismatch ("${ai}" vs "${db}")`, aiKey, dbKey };
}
