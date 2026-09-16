const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScrydexClient, mapExpansion, mapCard, prepareExpansion, writeExpansion } = require('../src/lib/scrydexPokemon.cjs');
const set = { id: 'me55', name: '30th Celebration', total: 1, printed_total: 128, release_date: '2026/09/16', language_code: 'EN', is_online_only: false };
const card = { id: 'me55-001', name: 'Pikachu', number: '001', language_code: 'EN', expansion: { id: 'me55' }, evolves_from: ['Pichu'], images: [{ type: 'back', large: 'back' }, { type: 'front', large: 'front' }] };
const response = body => new Response(JSON.stringify(body), { status: 200 });
test('mapping retains IDs/leading zeros, selects front image and preserves absent market fields', () => {
  assert.equal(mapExpansion(set).release_date, '2026-09-16');
  const row = mapCard(card, set);
  assert.equal(row.id, 'me55-001'); assert.equal(row.number, '001');
  assert.equal(row.image_large, 'front'); assert.equal(row.evolves_from, 'Pichu');
  assert.ok(!('tcgplayer_url' in row)); assert.ok(!('image_small' in row));
  assert.throws(() => mapCard({ ...card, language_code: 'JA' }, set));
  assert.throws(() => mapExpansion({ ...set, is_online_only: true }));
});
test('auth, snake-case and multi-page reads with a short intermediate page', async () => {
  const calls = [];
  const client = createScrydexClient({ apiKey: 'test', teamId: 'team', sleep: async () => {}, fetchImpl: async (url, init) => {
    calls.push(String(url)); assert.equal(init.headers['X-Team-ID'], 'team');
    return response({ data: [{ id: calls.length === 1 ? 'a' : 'b' }], total_count: 2 });
  } });
  assert.equal((await client.list('/expansions')).length, 2);
  assert.match(calls[1], /page=2/); assert.match(calls[0], /casing=snake/);
});
test('rejects duplicate pages, premature empty pages and missing counts', async () => {
  for (const body of [{ data: [{ id: 'a' }], total_count: 2 }, { data: [], total_count: 2 }, { data: [] }]) {
    const client = createScrydexClient({ apiKey: 'test', teamId: 'team', sleep: async () => {}, fetchImpl: async () => response(body) });
    await assert.rejects(client.list('/expansions'));
  }
});
test('authentication failures are not retried; rate limits retry', async () => {
  let calls = 0;
  const client = createScrydexClient({ apiKey: 'test', teamId: 'team', fetchImpl: async () => { calls++; return new Response('', { status: 401 }); } });
  await assert.rejects(client.list('/expansions'), /401/); assert.equal(calls, 1);
  calls = 0;
  const retry = createScrydexClient({ apiKey: 'test', teamId: 'team', sleep: async () => {}, fetchImpl: async () => ++calls === 1 ? new Response('', { status: 429 }) : response({ data: [], totalCount: 0 }) });
  assert.deepEqual(await retry.list('/expansions'), []); assert.equal(calls, 2);
});
test('preparation refuses incomplete sets and foreign cards before writes', async () => {
  await assert.rejects(prepareExpansion({ request: async () => ({ data: set }), list: async () => [] }, set.id), /incomplete/);
  await assert.rejects(prepareExpansion({ request: async () => ({ data: set }), list: async () => [{ ...card, expansion: { id: 'other' } }] }, set.id), /mismatch/);
});
test('write verifies IDs instead of trusting a matching aggregate count', async () => {
  const db = { from: () => ({ upsert: async () => ({ error: null }), select: () => ({ in: async () => ({ data: [{ id: 'wrong' }], error: null }) }) }) };
  await assert.rejects(writeExpansion(db, { set: mapExpansion(set), cards: [mapCard(card, set)] }), /readback mismatch/);
});
test('repeat imports upsert the same IDs and preserve omitted market links', async () => {
  const stored = new Map([[card.id, { tcgplayer_url: 'existing-market-link' }]]);
  const db = { from: table => ({
    upsert: async rows => { if (table === 'pokemon_cards') for (const row of rows) stored.set(row.id, { ...stored.get(row.id), ...row }); return { error: null }; },
    select: () => ({ in: async (_, ids) => ({ data: ids.map(id => stored.get(id)), error: null }) }),
  }) };
  const prepared = { set: mapExpansion(set), cards: [mapCard(card, set)] };
  assert.equal(await writeExpansion(db, prepared), 1);
  assert.equal(await writeExpansion(db, prepared), 1);
  assert.equal(stored.size, 1);
  assert.equal(stored.get(card.id).tcgplayer_url, 'existing-market-link');
});
