/**
 * Pokemon catalog-number witness (Oct 2026).
 *
 * When the grading call and the independent read disagree on a Pokemon card's
 * NAME, the printed card number settles it before any name override: a number
 * such as "025/198" names at most a handful of catalog cards, and exactly one
 * of the two candidate names will match that row. The witness is deterministic
 * (local pokemon_cards catalog, no model call) and is consulted by
 * reconcile.ts decideName ahead of the first look and the grader's own
 * transcription. It never invents a name: it only says which of the two
 * candidates the catalog backs.
 *
 * Background: the Spewpa -> Mimikyu class of miss (Sept 29) came from an
 * independent read overriding the name with a caption or a hallucinated name;
 * the Oct 8 second-witness gate reduced it, but the printed number was never
 * asked. 13.3% of real identifications still needed a correction (Oct 12).
 *
 * POKEMON_NUMBER_WITNESS_V1=0 switches it off (reconcile falls back to the
 * existing corroboration rules).
 */
import { splitPrintedPokemonNumber } from '../pokemonApiVerification';
import { searchLocalByNameNumberTotal } from '../pokemonTcgApi';
import { namesAgree } from '../identity/nameAgreement';
import type { IdentificationResult } from './identifyCard';

export interface CatalogWitness {
  /** The printed number the catalog was asked about ("025/198"). */
  printed: string;
  /** Which candidate name the catalog row at that number agrees with. */
  backs: 'independent' | 'grading' | 'both' | 'neither';
  /** The catalog card name(s) found at that number, for the audit record. */
  catalog_names: string[];
}

export function numberWitnessEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.POKEMON_NUMBER_WITNESS_V1 ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false');
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Printed-number candidates in the order they are trusted: the first look's
 * printed read (full resolution, witnessed characters), then the grading
 * call's raw/number fields, then the independent read's. Only forms with a
 * set total ("25/198", "TG12/TG30", "SV045/SV122") are usable; a bare number
 * matches too many catalog rows to witness anything.
 */
export function printedNumberCandidates(
  gradingCardInfo: Record<string, unknown> | null | undefined,
  independent: IdentificationResult | null | undefined,
  firstLookNumber?: string | null
): string[] {
  const ci = gradingCardInfo || {};
  const gradingNumber = str(ci.card_number);
  const gradingTotal = str(ci.set_total);
  const raw: Array<string | null> = [
    str(firstLookNumber),
    str(ci.card_number_raw),
    gradingNumber && gradingNumber.includes('/') ? gradingNumber : gradingNumber && gradingTotal ? `${gradingNumber}/${gradingTotal}` : null,
    str(independent?.card_number_text_seen),
    str(independent?.card_number),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    const parsed = splitPrintedPokemonNumber(r);
    if (!parsed) continue;
    const key = `${parsed.number}/${parsed.total}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export interface WitnessInput {
  gradingName: string | null;
  independentName: string | null;
  printedCandidates: string[];
}

/** Catalog rows printed with this number and set total; injectable for tests. */
export type RowsAtNumberFn = (printed: string) => Promise<Array<{ name: string }>>;

async function rowsAtPrintedNumber(printed: string): Promise<Array<{ name: string }>> {
  const parsed = splitPrintedPokemonNumber(printed);
  if (!parsed) return [];
  return searchLocalByNameNumberTotal('', parsed.number, parsed.total);
}

/**
 * Ask the catalog which name the printed number backs. The first printed
 * candidate that names any catalog card decides; later candidates are only
 * tried when the earlier ones name no card at all. A name is "backed" when at
 * least one row at that number agrees with it (reprints share a name). Returns
 * null when there is nothing to ask (no usable number, or both names missing).
 */
export async function pokemonCatalogWitness(
  input: WitnessInput,
  rowsAt: RowsAtNumberFn = rowsAtPrintedNumber
): Promise<CatalogWitness | null> {
  const { gradingName, independentName, printedCandidates } = input;
  if (!printedCandidates.length || (!gradingName && !independentName)) return null;
  for (const printed of printedCandidates) {
    const rows = (await rowsAt(printed)).filter(r => typeof r?.name === 'string' && r.name.trim());
    if (rows.length === 0) continue; // number named nothing; try the next form
    const backed = (name: string | null) => !!name && rows.some(r => namesAgree(name, r.name).agrees);
    const gradingBacked = backed(gradingName);
    const independentBacked = backed(independentName);
    return {
      printed,
      backs: gradingBacked && independentBacked ? 'both' : gradingBacked ? 'grading' : independentBacked ? 'independent' : 'neither',
      catalog_names: [...new Set(rows.map(r => r.name))],
    };
  }
  return null;
}
