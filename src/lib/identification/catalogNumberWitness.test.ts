import { describe, it, expect } from 'vitest';
import { numberWitnessEnabled, printedNumberCandidates, pokemonCatalogWitness, type RowsAtNumberFn } from './catalogNumberWitness';
import { reconcileIdentity } from './reconcile';
import type { IdentificationResult } from './identifyCard';

function ident(over: Partial<IdentificationResult> = {}): IdentificationResult {
  return {
    printed_name_seen: null, player_or_character: null, card_name: null, set_name: null,
    card_number: null, card_number_text_seen: null, year_hint: null, language: 'en', variant: null,
    confidence: 'high', model: 'gpt-5.6-luna', tokens: { in: 300, out: 90 }, ms: 1200, ...over,
  };
}

/** A tiny catalog: number/total -> card names printed with that number. */
function catalog(rows: Record<string, string[]>): RowsAtNumberFn {
  return async (printed) => {
    const m = printed.match(/(\w+)\s*\/\s*(\d+)/);
    return ((m && rows[`${m[1].replace(/^0+/, '')}/${m[2]}`]) || []).map(name => ({ name }));
  };
}

describe('numberWitnessEnabled', () => {
  it('is on by default and off only when told', () => {
    expect(numberWitnessEnabled({})).toBe(true);
    expect(numberWitnessEnabled({ POKEMON_NUMBER_WITNESS_V1: '0' })).toBe(false);
    expect(numberWitnessEnabled({ POKEMON_NUMBER_WITNESS_V1: 'off' })).toBe(false);
  });
});

describe('printedNumberCandidates', () => {
  it('prefers the first look, then the grading read, then the independent read, deduplicated', () => {
    const c = printedNumberCandidates({ card_number: '25', set_total: '198', card_number_raw: '025/198' }, ident({ card_number_text_seen: '25/198', card_number: '9/204' }), '025/198');
    expect(c).toEqual(['025/198', '9/204']);
  });
  it('drops bare numbers (no set total) - they witness nothing', () => {
    expect(printedNumberCandidates({ card_number: '25' }, ident({ card_number: '25' }), null)).toEqual([]);
  });
});

describe('pokemonCatalogWitness', () => {
  const lookup = catalog({ '25/198': ['Pikachu'], '77/203': ['Spewpa'], '97/198': ['Mimikyu', 'Mimikyu ex'] });

  it('backs the independent read when the printed number names its card', async () => {
    const w = await pokemonCatalogWitness({ gradingName: 'Mimikyu', independentName: 'Spewpa', printedCandidates: ['77/203'] }, lookup);
    expect(w).toMatchObject({ printed: '77/203', backs: 'independent', catalog_names: ['Spewpa'] });
  });
  it('backs the grading name when the number is its card (refuses the override)', async () => {
    const w = await pokemonCatalogWitness({ gradingName: 'Spewpa', independentName: 'Mimikyu', printedCandidates: ['77/203'] }, lookup);
    expect(w?.backs).toBe('grading');
  });
  it('says neither when the number names a third card, and tries later number forms when the first names nothing', async () => {
    expect((await pokemonCatalogWitness({ gradingName: 'Spewpa', independentName: 'Mimikyu', printedCandidates: ['25/198'] }, lookup))?.backs).toBe('neither');
    const w = await pokemonCatalogWitness({ gradingName: 'Spewpa', independentName: 'Mimikyu', printedCandidates: ['1/999', '77/203'] }, lookup);
    expect(w).toMatchObject({ printed: '77/203', backs: 'grading' });
  });
  it('returns null with nothing to ask', async () => {
    expect(await pokemonCatalogWitness({ gradingName: 'Spewpa', independentName: 'Mimikyu', printedCandidates: [] }, lookup)).toBeNull();
    expect(await pokemonCatalogWitness({ gradingName: null, independentName: null, printedCandidates: ['77/203'] }, lookup)).toBeNull();
    expect(await pokemonCatalogWitness({ gradingName: 'Spewpa', independentName: 'Mimikyu', printedCandidates: ['1/999'] }, lookup)).toBeNull();
  });
});

describe('reconcileIdentity with a catalog witness', () => {
  const grading = { card_name: 'Mimikyu', player_or_character: 'Mimikyu', card_number: '77/203', identification_confidence: 'high' };
  const read = ident({ printed_name_seen: 'SPEWPA', player_or_character: 'Spewpa', card_name: 'Spewpa', card_number: '77/203' });

  it('overrides on catalog_agrees even when the first look sides with the grader', () => {
    const r = reconcileIdentity(grading, read, 'pokemon', { firstLookSubject: 'Mimikyu', catalogWitness: { printed: '77/203', backs: 'independent', catalog_names: ['Spewpa'] } });
    expect(r.cardInfo.card_name).toBe('Spewpa');
    expect((r.cardInfo.identification_check as any).name_decision).toMatchObject({ action: 'override', reason: 'catalog_agrees', catalog: { backs: 'independent' } });
  });
  it('keeps the grading name on catalog_disagrees even when the first look sides with the read', () => {
    const r = reconcileIdentity({ ...grading, card_name: 'Spewpa', player_or_character: 'Spewpa' }, ident({ printed_name_seen: 'MIMIKYU', player_or_character: 'Mimikyu', card_name: 'Mimikyu' }), 'pokemon',
      { firstLookSubject: 'Mimikyu', catalogWitness: { printed: '77/203', backs: 'grading', catalog_names: ['Spewpa'] } });
    expect(r.cardInfo.card_name).toBe('Spewpa');
    expect((r.cardInfo.identification_check as any).name_decision).toMatchObject({ action: 'kept_grading', reason: 'catalog_disagrees' });
    expect(r.confidence).toBe('low'); // still a contested card
  });
  it('falls through to the first look when the catalog says both or neither', () => {
    const both = reconcileIdentity(grading, read, 'pokemon', { firstLookSubject: 'Spewpa', catalogWitness: { printed: '77/203', backs: 'both', catalog_names: ['Spewpa', 'Mimikyu'] } });
    expect((both.cardInfo.identification_check as any).name_decision.reason).toBe('first_look_agrees');
    const neither = reconcileIdentity(grading, read, 'pokemon', { firstLookSubject: 'Mimikyu', catalogWitness: { printed: '77/203', backs: 'neither', catalog_names: ['Pikachu'] } });
    expect((neither.cardInfo.identification_check as any).name_decision.reason).toBe('first_look_disagrees');
  });
});
