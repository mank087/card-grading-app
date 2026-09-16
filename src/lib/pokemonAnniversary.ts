import printedNumbers from './pokemonAnniversaryPrintedNumbers.json';

// Public Scrydex card-page printed_number values, captured 2026-09-16.
// Classic reprints keep their original fractions; RGB cards have no numeric total.
// This small exception catalog avoids inventing fractions from expansion size.
export function pokemonPrintedNumber(id: string, number: string, total: number): string {
  return (printedNumbers as Record<string, string>)[id] || (total ? `${number}/${total}` : number);
}

export function anniversaryNumber(value: string): string | null {
  const rgb = value.trim().match(/^([RGB])(?:\s*\/\s*RGB)?$/i);
  return rgb ? rgb[1].toUpperCase() : null;
}

export function anniversarySetIds(info: { set_name?: string; set_code?: string; card_number_raw?: string; card_number?: string }): string[] | null {
  const name = (info.set_name || '').toLowerCase();
  const named = /\b30th\s+(?:celebration|anniversary)\b/.test(name);
  const code = (info.set_code || '').trim().toUpperCase() === '30C';
  const rgb = /^[RGB]\s*\/\s*RGB$/i.test((info.card_number_raw || info.card_number || '').trim());
  if (!named && !code && !rgb) return null;
  if (/classic\s+collection/.test(name) && (named || code)) return ['me55c'];
  if (rgb) return ['me55'];
  // 30C is shared by BOTH expansions, and the main name can be an umbrella read.
  return ['me55', 'me55c'];
}

export function printedDenominatorMatches(printed: string, observed?: string): boolean {
  if (!observed) return true;
  const expected = printed.split('/')[1];
  if (!expected) return false;
  const normalize = (value: string) => value.trim().toUpperCase().replace(/^0+(?=\d)/, '');
  return normalize(expected) === normalize(observed);
}
