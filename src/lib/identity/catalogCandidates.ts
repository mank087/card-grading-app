/**
 * Pokémon catalog candidates (Sept 24 2026): the catalog cards a verification
 * could not choose between, stored in conversational_card_info.catalog_candidates
 * by identity/pokemonCatalogLink.ts and offered to the owner as a
 * "Which card is it?" picker in the confirm dialog.
 *
 * Pure and dependency-free so the dialog can import it. Kept OUT of
 * reviewClient.ts on purpose: that file is copied byte for byte to the mobile
 * app, and the mobile picker is not built yet.
 */

/** One catalog card offered by the picker. */
export interface CatalogCandidate {
  id: string;
  name: string;
  number: string;
  set_name: string;
  set_id: string;
  rarity: string | null;
  printed_total: number | null;
  image_small: string | null;
}

/** "140/149" for a candidate: its number over the set's printed total, when known. */
export function catalogCandidateNumber(candidate: Pick<CatalogCandidate, 'number' | 'printed_total'>): string {
  const number = String(candidate.number || '').trim();
  return candidate.printed_total && /^\d+$/.test(number) ? `${number}/${candidate.printed_total}` : number;
}

/** The stored candidates, cleaned: anything malformed is dropped, at most six. */
export function catalogCandidatesOf(cardInfo: unknown): CatalogCandidate[] {
  const info = cardInfo && typeof cardInfo === 'object' ? cardInfo as Record<string, any> : {};
  const list: any[] = Array.isArray(info.catalog_candidates) ? info.catalog_candidates : [];
  return list
    .filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && c.number != null)
    .slice(0, 6)
    .map(c => ({
      id: c.id,
      name: c.name,
      number: String(c.number),
      set_name: String(c.set_name || ''),
      set_id: String(c.set_id || ''),
      rarity: c.rarity ? String(c.rarity) : null,
      printed_total: Number.isFinite(Number(c.printed_total)) && Number(c.printed_total) > 0 ? Number(c.printed_total) : null,
      image_small: typeof c.image_small === 'string' && /^https:\/\//.test(c.image_small) ? c.image_small : null,
    }));
}

/** The form values choosing a candidate fills: name, number and set. */
export function catalogCandidateValues(candidate: CatalogCandidate): Record<'card_name' | 'featured' | 'card_number' | 'card_set', string> {
  return {
    card_name: candidate.name,
    featured: candidate.name,
    card_number: catalogCandidateNumber(candidate),
    card_set: candidate.set_name,
  };
}
