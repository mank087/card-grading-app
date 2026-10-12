/**
 * The card_info a cached (already graded) card GET should return.
 *
 * `conversational_grading` is the grader's ORIGINAL output and no identity save
 * ever rewrites it; the `conversational_card_info` column is what owner edits and
 * identity confirmations update. Returning the blob's card_info showed owners
 * their pre-correction values, and the edit form then wrote those stale values
 * back over their own earlier fixes (card 489119, Oct 2026).
 *
 * The stored column wins key by key; the blob only fills keys the column never
 * had. Same rule the Pokemon, MTG and Sports routes already used.
 */
export function cachedCardInfo(
  parsedCardInfo: Record<string, any> | null | undefined,
  storedCardInfo: unknown,
): Record<string, any> | null {
  const stored = storedCardInfo && typeof storedCardInfo === 'object' && !Array.isArray(storedCardInfo)
    ? storedCardInfo as Record<string, any>
    : null;
  if (!parsedCardInfo) return stored;
  return { ...parsedCardInfo, ...(stored || {}) };
}
