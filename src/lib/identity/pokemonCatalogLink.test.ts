import { beforeEach, describe, expect, it, vi } from 'vitest';

const v = vi.hoisted(() => ({ verify: vi.fn(), byPrinted: vi.fn(), net: vi.fn() }));
vi.mock('./anniversaryBadgeNet', async importOriginal => {
  const actual = await importOriginal<typeof import('./anniversaryBadgeNet')>();
  return { ...actual, runBadgeNet: v.net };
});
vi.mock('@/lib/pokemonApiVerification', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/pokemonApiVerification')>();
  return { ...actual, verifyPokemonCard: v.verify, verifyPokemonCardByPrintedNumber: v.byPrinted };
});
import { catalogRelinkNeeded, reconcileFirstLookNumber, samePrintedNumber, verifyAndSavePokemonCard } from './pokemonCatalogLink';

const cardId = 'a9eca6ef-0000-4000-8000-000000000001';
const espeon140 = {
  id: 'sm1-140', name: 'Espeon-GX', number: '140', printedNumber: '140/149', supertype: 'Pokémon', subtypes: [], rarity: 'Rare Holo GX',
  images: { small: 'https://images.pokemontcg.io/sm1/140.png', large: '' },
  set: { id: 'sm1', name: 'Sun & Moon', printedTotal: 149, total: 149, series: 'Sun & Moon', releaseDate: '2017/02/03', images: { logo: '', symbol: '' } },
};
const candidates = [
  { id: 'sm1-140', name: 'Espeon-GX', number: '140', set_name: 'Sun & Moon', set_id: 'sm1', rarity: 'Rare Holo GX', printed_total: 149, image_small: null },
  { id: 'sm1-152', name: 'Espeon-GX', number: '152', set_name: 'Sun & Moon', set_id: 'sm1', rarity: 'Rare Rainbow', printed_total: 149, image_small: null },
];
const miss = (extra: Record<string, unknown> = {}) => ({ success: false, verified: false, pokemon_api_id: null, pokemon_api_data: null,
  verification_method: 'none', confidence: 'low', corrections: [], error: 'No matching card found in local database', ...extra });
const hit = (extra: Record<string, unknown> = {}) => ({ success: true, verified: true, pokemon_api_id: 'sm1-140', pokemon_api_data: espeon140,
  verification_method: 'set_id_number', confidence: 'high', corrections: [{ field: 'card_number', original: '150/149', corrected: '140/149' }],
  name_agreement: { agrees: true, similarity: 1, reason: 'species match', aiKey: 'espeon', dbKey: 'espeon' }, ...extra });

const firstLook = (printed: string) => ({ version: 'first-look-v1', pass: 'contract', measured_at: 't1', result: {
  printed_text: { card_number_as_printed: printed },
  identity: { card_number: { value: printed, source: 'printed' }, subject: { value: 'Espeon GX', source: 'printed' } },
} });

function fakeDb(row: Record<string, any>) {
  const updates: Record<string, any>[] = [];
  const client: any = {
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: row, error: null }),
        update: (payload: Record<string, any>) => { updates.push(payload); return { eq: async () => ({ error: null }) }; },
      };
      return chain;
    },
  };
  return { client, updates };
}

const graded = (over: Record<string, any> = {}) => ({
  id: cardId, category: 'Pokemon', card_name: 'Espeon GX', featured: 'Espeon GX', card_set: 'Sun & Moon', card_number: '150/149',
  release_date: '2017', pokemon_api_verified: false, grade_status: 'complete', identity_revision: 0, identity_confirmed_revision: null,
  conversational_card_info: { card_name: 'Espeon GX', player_or_character: 'Espeon GX', set_name: 'Sun & Moon', card_number: '150/149', year: '2017' },
  first_look: null, ...over,
});

beforeEach(() => { vi.clearAllMocks(); v.net.mockResolvedValue(null); });

describe('verifyAndSavePokemonCard', () => {
  it('stores catalog candidates for the owner when the lookup is ambiguous, without touching identity', async () => {
    v.verify.mockResolvedValue(miss({ candidates }));
    const { client, updates } = fakeDb(graded());
    const out = await verifyAndSavePokemonCard(client, cardId, { force: true });
    expect(out.body.candidates).toHaveLength(2);
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0])).toEqual(['conversational_card_info']);
    expect(updates[0].conversational_card_info).toMatchObject({ card_name: 'Espeon GX', card_number: '150/149', catalog_candidates: candidates });
  });

  it("uses first look's printed number when the grading number matched nothing, and clears the candidates", async () => {
    v.verify.mockResolvedValue(miss({ candidates }));
    v.byPrinted.mockResolvedValue(hit());
    const { client, updates } = fakeDb(graded({ first_look: firstLook('140/149'),
      conversational_card_info: { ...graded().conversational_card_info, catalog_candidates: candidates } }));
    const out = await verifyAndSavePokemonCard(client, cardId, { force: true });
    expect(v.byPrinted).toHaveBeenCalledWith(expect.objectContaining({ card_number: '150/149' }), '140/149');
    expect(out.body).toMatchObject({ success: true, pokemon_api_id: 'sm1-140', used_first_look_number: true });
    const saved = updates[0];
    expect(saved).toMatchObject({ pokemon_api_id: 'sm1-140', card_number: '140/149' });
    expect(saved.conversational_card_info.catalog_candidates).toBeUndefined();
    expect(saved.conversational_card_info).toMatchObject({ card_number: '140/149', card_number_raw: '140/149',
      _number_from_first_look: { original: '150/149', corrected: '140/149' } });
    expect(saved.label_data).toBeTruthy();
  });

  it('never rewrites an owner-confirmed identity: link only, and a stale link is cleared', async () => {
    v.verify.mockResolvedValue(miss());
    const { client, updates } = fakeDb(graded({ pokemon_api_verified: true, identity_revision: 2, identity_confirmed_revision: 2,
      first_look: firstLook('140/149') }));
    const out = await verifyAndSavePokemonCard(client, cardId, { force: true, overrideCardInfo: { card_number: '999/149' } });
    expect(out.body.link_only).toBe(true);
    expect(v.byPrinted).not.toHaveBeenCalled();
    expect(v.verify).toHaveBeenCalledWith(expect.objectContaining({ card_number: '150/149' }));
    expect(updates[0]).toMatchObject({ pokemon_api_id: null, pokemon_api_verified: false, pokemon_api_data: null });
    expect(updates[0].card_number).toBeUndefined();
    expect(updates[0].card_name).toBeUndefined();
  });

  it('link-only success writes the pokemon_api_* link and nothing of the identity', async () => {
    v.verify.mockResolvedValue(hit({ corrections: [{ field: 'set_name', original: 'sun & moon', corrected: 'Sun & Moon' }] }));
    const { client, updates } = fakeDb(graded({ card_number: '140/149' }));
    await verifyAndSavePokemonCard(client, cardId, { force: true, linkOnly: true });
    expect(updates[0]).toMatchObject({ pokemon_api_id: 'sm1-140', pokemon_api_verified: true });
    for (const key of ['card_name', 'card_set', 'card_number', 'release_date', 'label_data']) expect(updates[0][key]).toBeUndefined();
  });
});

describe('reconcileFirstLookNumber', () => {
  it('re-verifies an unresolved card when first look read a different number', async () => {
    v.verify.mockResolvedValue(miss());
    v.byPrinted.mockResolvedValue(hit());
    const { client, updates } = fakeDb(graded({ first_look: firstLook('140/149') }));
    expect(await reconcileFirstLookNumber(client, cardId)).toBe('verified');
    expect(updates[0]).toMatchObject({ card_number: '140/149' });
  });

  it.each([
    ['the numbers agree', { first_look: firstLook('150/149') }],
    ['the owner confirmed', { first_look: firstLook('140/149'), identity_confirmed_revision: 0 }],
    ['the card is still grading', { first_look: firstLook('140/149'), grade_status: 'processing' }],
    ['the card is not graded yet', { first_look: firstLook('140/149'), card_number: null, conversational_card_info: {} }],
    ['the stored number already has a single catalog card', { first_look: firstLook('140/149'), pokemon_api_verified: true }],
    ['it is not a Pokémon card', { first_look: firstLook('140/149'), category: 'MTG' }],
  ])('skips when %s', async (_label, over) => {
    const { client, updates } = fakeDb(graded(over));
    expect(await reconcileFirstLookNumber(client, cardId)).toBe('skipped');
    expect(v.verify).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('compares printed numbers ignoring zero padding', () => {
    expect(samePrintedNumber('066/196', '66/196')).toBe(true);
    expect(samePrintedNumber('140/149', '150/149')).toBe(false);
  });
  it('relinks only Pokémon cards, and only for name / number / set changes', () => {
    expect(catalogRelinkNeeded('Pokemon', ['card_number'])).toBe(true);
    expect(catalogRelinkNeeded('Pokemon', ['holofoil'])).toBe(false);
    expect(catalogRelinkNeeded('MTG', ['card_number'])).toBe(false);
  });
});

const catalogCard = (id: string, name: string, number: string, printed: string, set: { id: string; name: string; total: number; date: string }) => ({
  id, name, number, printedNumber: printed, supertype: 'Pokémon', subtypes: [], rarity: 'Common', images: { small: '', large: '' },
  set: { id: set.id, name: set.name, printedTotal: set.total, total: set.total, series: '', releaseDate: set.date, images: { logo: '', symbol: '' } },
});
const base58 = catalogCard('base1-58', 'Pikachu', '58', '58/102', { id: 'base1', name: 'Base', total: 102, date: '1999/01/09' });
const classic58 = catalogCard('me55c-58', 'Pikachu', '58', '58/102', { id: 'me55c', name: '30th Celebration: Classic Collection', total: 0, date: '2026-09-16' });
const pikachuRow = (over: Record<string, any> = {}) => graded({
  card_name: 'Pikachu', featured: 'Pikachu', card_set: 'Base', card_number: '58/102', release_date: '1999',
  conversational_card_info: { card_name: 'Pikachu', player_or_character: 'Pikachu', set_name: 'Base', card_number: '58', card_number_raw: '58/102', year: '1999' },
  ...over,
});
const pikachuHit = (card: any, extra: Record<string, unknown> = {}) => hit({ pokemon_api_id: card.id, pokemon_api_data: card, corrections: [],
  name_agreement: { agrees: true, similarity: 1, reason: 'species match', aiKey: 'pikachu', dbKey: 'pikachu' }, ...extra });
const verdict = (answer: string, badge: string | null) => ({ answer, badge, where: null, for_number: '58/102', at: 't' });

describe('anniversary badge safety net (Oct 2026)', () => {
  it('a "yes" re-scopes to the Classic Collection and saves that identity with the verdict', async () => {
    v.verify.mockResolvedValueOnce(pikachuHit(base58))
      .mockResolvedValueOnce(pikachuHit(classic58, { corrections: [{ field: 'set_name', original: 'Base', corrected: classic58.set.name }, { field: 'year', original: '1999', corrected: '2026' }] }));
    v.net.mockResolvedValue({ outcome: { action: 'rescope', badge: '30', certain: true }, twins: [], stored: verdict('yes', '30'), fresh: true });
    const { client, updates } = fakeDb(pikachuRow());
    const out = await verifyAndSavePokemonCard(client, cardId, { force: true });
    expect(v.net).toHaveBeenCalledWith(client, cardId, expect.objectContaining({ name: 'Pikachu', printed: '58/102', matchedSetId: 'base1', ownerConfirmed: false }));
    expect(v.verify).toHaveBeenLastCalledWith(expect.objectContaining({ printed_badge: '30' }));
    expect(out.body.pokemon_api_id).toBe('me55c-58');
    expect(updates[0]).toMatchObject({ pokemon_api_id: 'me55c-58', card_set: '30th Celebration: Classic Collection', release_date: '2026' });
    expect(updates[0].conversational_card_info.anniversary_badge_check).toMatchObject({ answer: 'yes', badge: '30' });
  });

  it('"unclear" keeps the original printing at low confidence, without rewriting the set', async () => {
    v.verify.mockResolvedValue(pikachuHit(base58, { corrections: [{ field: 'set_name', original: 'Base Set', corrected: 'Base' }] }));
    v.net.mockResolvedValue({ outcome: { action: 'keep_low' }, twins: [], stored: verdict('unclear', null), fresh: true });
    const { client, updates } = fakeDb(pikachuRow());
    await verifyAndSavePokemonCard(client, cardId, { force: true });
    expect(updates[0]).toMatchObject({ pokemon_api_id: 'base1-58', pokemon_api_confidence: 'low' });
    expect(updates[0].card_set).toBeUndefined();
  });

  it('link-only (owner edit): a "yes" never rewrites the owner identity, it offers both printings', async () => {
    v.verify.mockResolvedValueOnce(pikachuHit(base58)).mockResolvedValueOnce(pikachuHit(classic58));
    v.net.mockResolvedValue({ outcome: { action: 'rescope', badge: '30', certain: true }, twins: [], stored: verdict('yes', '30'), fresh: true });
    const { client, updates } = fakeDb(pikachuRow());
    await verifyAndSavePokemonCard(client, cardId, { force: true, linkOnly: true });
    expect(updates[0]).toMatchObject({ pokemon_api_id: null, pokemon_api_verified: false });
    expect(updates[0].conversational_card_info.catalog_candidates.map((c: any) => c.id)).toEqual(['me55c-58', 'base1-58']);
    expect(updates[0].card_set).toBeUndefined();
  });
});

describe('Trick or Trade stamp (Oct 2026)', () => {
  const gengar = catalogCard('swsh11-66', 'Gengar', '66', '066/196', { id: 'swsh11', name: 'Lost Origin', total: 196, date: '2022/09/09' });
  it('keeps the original catalog link but saves the canonical Trick or Trade set and year', async () => {
    v.verify.mockResolvedValue(hit({ pokemon_api_id: 'swsh11-66', pokemon_api_data: gengar,
      corrections: [{ field: 'set_name', original: 'Trick or Trade', corrected: 'Lost Origin' }],
      name_agreement: { agrees: true, similarity: 1, reason: 'species match', aiKey: 'gengar', dbKey: 'gengar' } }));
    const { client, updates } = fakeDb(graded({ card_name: 'Gengar', featured: 'Gengar', card_set: 'Trick or Trade', card_number: '066/196', release_date: '2022',
      conversational_card_info: { card_name: 'Gengar', player_or_character: 'Gengar', set_name: 'Lost Origin', card_number: '066/196', year: '2022', printed_badge: 'pumpkin' } }));
    await verifyAndSavePokemonCard(client, cardId, { force: true });
    expect(updates[0]).toMatchObject({ pokemon_api_id: 'swsh11-66', card_set: 'Trick or Trade 2023', release_date: '2023' });
    expect(updates[0].conversational_card_info).toMatchObject({ set_name: 'Trick or Trade 2023', year: '2023', printed_badge: 'pumpkin' });
  });
});
