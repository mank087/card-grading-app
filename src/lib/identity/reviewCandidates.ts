/**
 * Catalog candidates for the "Which version is it?" picker.
 *
 * Source order:
 *   1. The local sports_card_products family — the SAME list the Market Pricing
 *      section's "See other card variants" shows. It is the complete family for
 *      the card number, serial-numbered parallels included, with prices. Owner
 *      test, Sept 18 2026: the live-API search below did not list the
 *      serial-numbered versions of a /249 autograph jersey card.
 *   2. The live PriceCharting search (getAvailableParallels) when the local
 *      database is not available or finds no family.
 */
import { getAvailableParallels, isPriceChartingEnabled } from '@/lib/priceCharting';
import { isSportsLocalDbAvailable, getLocalSportsFamily, matchSportsCardLocal, type SportsProductRow } from '@/lib/sportsCardMatcher';
import { markBaseCandidate, type ReviewCandidate, type ReviewPrefill } from './reviewPrefill';

function valueOf(prefill: ReviewPrefill, key: string): string {
  return prefill.fields.find(f => f.key === key)?.value || '';
}

function fromLocalRow(row: SportsProductRow): ReviewCandidate {
  const raw = row.loose_price != null ? Number(row.loose_price) : null;
  return {
    id: String(row.id),
    name: row.product_name,
    setName: row.console_name || '',
    hasPrice: !!(row.loose_price || row.graded_price || row.manual_only_price || row.new_price),
    isBase: !row.variant_text,
    serialDenominator: row.serial_denominator != null ? Number(row.serial_denominator) : null,
    rawPrice: raw !== null && Number.isFinite(raw) && raw > 0 ? raw : null,
  };
}

export interface CandidateLookup {
  candidates: ReviewCandidate[];
  available: boolean;
  error: boolean;
}

export async function loadReviewCandidates(
  prefill: ReviewPrefill,
  card: { category?: string | null; dcm_selected_product_id?: string | null; dcm_price_product_id?: string | null },
): Promise<CandidateLookup> {
  const playerName = valueOf(prefill, 'featured') || valueOf(prefill, 'card_name');
  if (!playerName) return { candidates: [], available: false, error: false };

  // 1. Local family, exactly as the Market Pricing picker resolves it.
  try {
    if (await isSportsLocalDbAvailable()) {
      let family: SportsProductRow[] = [];
      for (const productId of [card.dcm_selected_product_id, card.dcm_price_product_id]) {
        if (productId && family.length === 0) family = await getLocalSportsFamily(String(productId));
      }
      if (family.length === 0) {
        const match = await matchSportsCardLocal({
          playerName,
          year: valueOf(prefill, 'release_date') || undefined,
          setName: valueOf(prefill, 'card_set') || undefined,
          cardNumber: valueOf(prefill, 'card_number') || undefined,
          variant: valueOf(prefill, 'parallel_type') || undefined,
          subset: valueOf(prefill, 'subset_variant') || undefined,
          serialNumbering: valueOf(prefill, 'serial_numbering') || undefined,
          sport: card.category || undefined,
        } as any);
        family = match.family || [];
      }
      if (family.length > 0) return { candidates: family.map(fromLocalRow), available: true, error: false };
    }
  } catch (err) {
    console.warn('[identity-review] local family lookup failed:', err instanceof Error ? err.message : err);
  }

  // 2. Live catalog search.
  if (!isPriceChartingEnabled()) return { candidates: [], available: false, error: false };
  try {
    const found = await getAvailableParallels({
      playerName,
      year: valueOf(prefill, 'release_date') || undefined,
      setName: valueOf(prefill, 'card_set') || undefined,
      cardNumber: valueOf(prefill, 'card_number') || undefined,
      subset: valueOf(prefill, 'subset_variant') || undefined,
      serialNumbering: valueOf(prefill, 'serial_numbering') || undefined,
      sport: card.category || undefined,
    });
    return { candidates: markBaseCandidate(found), available: true, error: false };
  } catch (err) {
    console.warn('[identity-review] candidate lookup failed:', err instanceof Error ? err.message : err);
    return { candidates: [], available: false, error: true };
  }
}

/** Serial run from "047/249" → 249. */
export function serialDenominatorOf(serial: string | null | undefined): number | null {
  const m = /\/\s*(\d{1,5})\b/.exec(String(serial || ''));
  return m ? Number(m[1]) : null;
}
