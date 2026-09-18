/**
 * Pokémon card numbers: let the catalog settle a disagreement.
 *
 * Owner test, Sept 18 2026: a Lost Origin Gengar printed "066/196". The grading
 * call stored "086" (raw "086/106"); first look read "066/196". The review
 * dialog kept the stored value in the box, as it does for every field, so the
 * owner saw a wrong number and had to type the right one. The pokemon_cards
 * table has Gengar #66 in a set with 196 printed cards and no Gengar #86 in a
 * set of 106, so the catalog knows which read is real.
 *
 * Rule: when exactly one of the two candidate numbers (the box and the
 * suggestion) matches a catalog card with the same name, number and printed set
 * total, that one goes in the box, marked as catalog-matched, and the other
 * becomes the "possible alternative". The value is kept exactly as it was read,
 * leading zeros included. Nothing is invented and no other field is touched.
 */
import { supabaseServer } from '@/lib/supabaseServer';
import type { ReviewField } from './reviewPrefill';

export interface ParsedPokemonNumber { number: string; total: number | null }

/** "066/196" → { number: "66", total: 196 }; "SWSH039" → { number: "SWSH039", total: null }. */
export function parsePokemonNumber(text: string | null | undefined): ParsedPokemonNumber | null {
  const raw = String(text || '').trim().replace(/^#\s*/, '');
  if (!raw) return null;
  const fraction = /^([A-Za-z]{0,6})0*(\d+)([A-Za-z]?)\s*\/\s*([A-Za-z]{0,6})(\d+)$/.exec(raw);
  if (fraction) return { number: `${fraction[1]}${fraction[2]}${fraction[3]}`, total: Number(fraction[5]) };
  const single = /^([A-Za-z]{0,6})0*(\d+)([A-Za-z]?)$/.exec(raw);
  if (single) return { number: `${single[1]}${single[2]}${single[3]}`, total: null };
  return null;
}

type Lookup = (name: string, number: string, total: number | null) => Promise<{ setName: string } | null>;

async function catalogLookup(name: string, number: string, total: number | null): Promise<{ setName: string } | null> {
  let query = supabaseServer()
    .from('pokemon_cards')
    .select('set_name, set_printed_total')
    .ilike('name', name)
    .eq('number', number)
    .limit(5);
  if (total !== null) query = query.eq('set_printed_total', total);
  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;
  return { setName: String(data[0].set_name || '') };
}

/**
 * Returns the fields with the card number settled by the catalog when it can be.
 * `lookup` is injectable for tests; production uses the pokemon_cards table.
 */
export async function settlePokemonNumber(
  fields: ReviewField[],
  category: string | null | undefined,
  lookup: Lookup = catalogLookup,
): Promise<ReviewField[]> {
  if (String(category || '').toLowerCase() !== 'pokemon') return fields;
  const index = fields.findIndex(f => f.key === 'card_number');
  if (index < 0) return fields;
  const field = fields[index];
  const name = (fields.find(f => f.key === 'featured')?.value || fields.find(f => f.key === 'card_name')?.value || '').trim();
  if (!name) return fields;

  const boxText = field.value;
  const altText = field.suggestion?.value || '';
  const [box, alt] = [parsePokemonNumber(boxText), parsePokemonNumber(altText)];
  if (!box && !alt) return fields;

  let boxHit: { setName: string } | null = null;
  let altHit: { setName: string } | null = null;
  try {
    boxHit = box ? await lookup(name, box.number, box.total) : null;
    altHit = alt ? await lookup(name, alt.number, alt.total) : null;
  } catch {
    return fields; // the catalog is a tie-breaker, never a reason to fail the dialog
  }

  const out = [...fields];
  if (boxHit && !altHit) {
    out[index] = { ...field, catalogNote: `Matches the Pokémon catalog${boxHit.setName ? ` (${boxHit.setName})` : ''}` };
  } else if (altHit && !boxHit && field.suggestion) {
    // The read that the catalog confirms goes in the box; what was on file stays one tap away.
    out[index] = {
      ...field,
      value: altText,
      origin: field.suggestion.source === 'printed' ? 'read_from_card' : 'suggested',
      needsCheck: false,
      differsFromStored: altText.trim().toLowerCase() !== field.storedValue.trim().toLowerCase(),
      catalogNote: `Matches the Pokémon catalog${altHit.setName ? ` (${altHit.setName})` : ''}`,
      suggestion: boxText ? { value: boxText, origin: 'from_grading', source: 'inferred' } : undefined,
    };
  }
  return out;
}
