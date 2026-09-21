/**
 * Japanese/English splitting for card identity text.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` (pokemon
 * 3897-4090 and 4093-4222; the sports client has no bilingual rendering at
 * all, so nothing here is shared with it yet). The legacy page repeats the
 * same five-line detection-and-split inline once per field; this is that logic
 * written once.
 *
 * The character class is the legacy one, verbatim: hiragana, katakana and CJK
 * unified ideographs. The split characters are the legacy set too — `/`, both
 * ASCII and full-width parentheses — which is why "Mewtwo/Mew" splits on the
 * slash exactly as the current page does.
 */

/** Legacy's `/[぀-ゟ゠-ヿ一-龯]/` test. */
export function hasJapanese(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[぀-ゟ゠-ヿ一-龯]/.test(text);
}

export interface BilingualText {
  /** True when the source string contains any Japanese character. */
  japanese: boolean;
  /** The Japanese half, or null when the string did not split into two. */
  jp: string | null;
  /** The English half, or null when the string did not split into two. */
  en: string | null;
  /** The whole string, always present — what legacy prints when it cannot split. */
  full: string;
}

/**
 * Split "ミュウツー (Mewtwo)" into its two halves.
 *
 * Returns `jp`/`en` only when BOTH halves were found, which is legacy's
 * condition for the two-line layout. A Japanese-only string comes back with
 * `japanese: true` and both halves null, and legacy prints `full` in the
 * Japanese face; an English-only string comes back with `japanese: false`.
 */
export function splitBilingual(text: string | null | undefined): BilingualText | null {
  if (text === null || text === undefined) return null;
  const full = typeof text === 'string' ? text : String(text);
  if (!full) return null;

  if (!hasJapanese(full)) {
    return { japanese: false, jp: null, en: null, full };
  }

  const parts = full.split(/[/()（）]/);
  const jp = parts.find((p) => hasJapanese(p)) ?? null;
  const en = parts.find((p) => p.trim() && !hasJapanese(p)) ?? null;

  if (jp && en) {
    return { japanese: true, jp: jp.trim(), en: en.trim(), full };
  }
  return { japanese: true, jp: null, en: null, full };
}

export interface BilingualLines {
  japanese: boolean;
  /** Lines carrying Japanese characters, in source order. */
  jpLines: string[];
  /** Non-blank lines carrying none, in source order. */
  enLines: string[];
}

/**
 * The line-wise variant legacy uses for the card-text blocks (4116-4169 and
 * 4179-4217): every line that carries a Japanese character is Japanese, every
 * other non-blank line is the translation. Blank lines are dropped from both,
 * exactly as legacy drops them.
 */
export function splitBilingualLines(text: string | null | undefined): BilingualLines | null {
  if (!text) return null;
  const str = typeof text === 'string' ? text : String(text);
  if (!hasJapanese(str)) {
    return { japanese: false, jpLines: [], enLines: [] };
  }
  const jpLines: string[] = [];
  const enLines: string[] = [];
  for (const line of str.split('\n')) {
    if (hasJapanese(line)) jpLines.push(line);
    else if (line.trim()) enLines.push(line);
  }
  return { japanese: true, jpLines, enLines };
}
