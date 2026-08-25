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

// Owner possessives ("Misty's Determination", "Team Rocket's Mewtwo") are kept as
// tokens: the model often reads just the owner ("Misty"), and the owner token is
// exactly what must agree. Possessive 's collapses to a 1-char token and is dropped.

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
    .replace(/[’`']/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Meaningful tokens: variant/owner-suffix noise and 1-char fragments removed. */
function tokens(name: string): string[] {
  return normalise(name).split(' ').filter(t => t.length > 1 && !VARIANT_TOKENS.has(t));
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
  return tokens(name).join(' ');
}

/**
 * Does the database card's name agree with what the model read?
 * - Empty / too-short AI name → agrees (nothing to check against).
 * - Same species key → agrees. One key's tokens a subset of the other's → agrees:
 *   the model often reads the short form ("Pikachu" for "Flying Pikachu V",
 *   "Misty" for "Misty's Determination", "Charizard" for "Special Delivery
 *   Charizard"); the set + number then decides the exact printing. Subset is
 *   token-level, so "Mew" ⊄ "Mewtwo" and "Alolan Raichu" ⊄ "Alolan Rattata".
 * - Levenshtein ≤ 1 on keys of 6+ chars (OCR slips like "Charizrd").
 * - Otherwise full-name similarity ≥ 0.8 (odd formats).
 */
export function namesAgree(aiName: string | null | undefined, dbName: string | null | undefined): NameAgreement {
  const ai = normalise(aiName || '');
  const db = normalise(dbName || '');
  if (!ai || ai.replace(/\s/g, '').length < 3) return { agrees: true, similarity: 1, reason: 'no AI name to check', aiKey: ai, dbKey: db };
  if (!db) return { agrees: true, similarity: 1, reason: 'no DB name to check', aiKey: ai, dbKey: db };

  const aiTok = tokens(ai);
  const dbTok = tokens(db);
  const aiKey = aiTok.join(' ');
  const dbKey = dbTok.join(' ');

  if (aiKey && dbKey) {
    if (aiKey === dbKey) return { agrees: true, similarity: 1, reason: 'species match', aiKey, dbKey };
    const aiSet = new Set(aiTok), dbSet = new Set(dbTok);
    const aiInDb = aiTok.every(t => dbSet.has(t));
    const dbInAi = dbTok.every(t => aiSet.has(t));
    if (aiInDb || dbInAi) {
      return { agrees: true, similarity: Math.min(aiTok.length, dbTok.length) / Math.max(aiTok.length, dbTok.length), reason: aiInDb ? 'read is a short form of the DB name' : 'DB name is a short form of the read', aiKey, dbKey };
    }
    const d = levenshtein(aiKey, dbKey);
    const maxLen = Math.max(aiKey.length, dbKey.length);
    if (maxLen >= 6 && d <= 1) return { agrees: true, similarity: 1 - d / maxLen, reason: 'species match (1 edit)', aiKey, dbKey };
    // Single-token OCR slip inside a multi-token name ("Charizrd VMAX" vs "Charizard VMAX")
    if (aiTok.length === dbTok.length && aiTok.length > 1) {
      const slips = aiTok.filter((t, i) => t !== dbTok[i]);
      if (slips.length === 1) {
        const i = aiTok.indexOf(slips[0]);
        if (aiTok[i].length >= 6 && levenshtein(aiTok[i], dbTok[i]) <= 1) return { agrees: true, similarity: 0.9, reason: 'species match (1 edit in one token)', aiKey, dbKey };
      }
    }
    // Both names have real tokens and none of the rules matched: that is a
    // different card. Do NOT fall through to whole-string similarity — a long
    // shared prefix ("Team Rocket's Mewtwo" / "Team Rocket's Meowth") scores
    // 0.8 there and would pass.
    const sim = 1 - levenshtein(ai, db) / Math.max(ai.length, db.length);
    return { agrees: false, similarity: sim, reason: `name mismatch ("${aiKey}" vs "${dbKey}")`, aiKey, dbKey };
  }

  // Full-name similarity fallback (Trainer / Energy cards, or names that collapsed to empty keys)
  const full = 1 - levenshtein(ai, db) / Math.max(ai.length, db.length);
  if (full >= 0.8) return { agrees: true, similarity: full, reason: 'full-name similarity', aiKey, dbKey };
  return { agrees: false, similarity: full, reason: `name mismatch ("${ai}" vs "${db}")`, aiKey, dbKey };
}
