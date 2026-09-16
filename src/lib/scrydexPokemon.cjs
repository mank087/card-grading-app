// Server/CLI only. Keep Scrydex credentials out of browser bundles.
const BASE = 'https://api.scrydex.com/pokemon/v1/en';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function createScrydexClient({ apiKey = process.env.SCRYDEX_API_KEY, teamId = process.env.SCRYDEX_TEAM_ID, fetchImpl = fetch, sleep = pause } = {}) {
  if (!apiKey || !teamId) throw new Error('Configure SCRYDEX_API_KEY and SCRYDEX_TEAM_ID before using Scrydex.');
  async function request(endpoint, params = {}) {
    if (!/^\/expansions(?:\/[a-zA-Z0-9_.-]+(?:\/cards)?)?$/.test(endpoint)) throw new Error('Invalid Scrydex endpoint');
    const url = new URL(BASE + endpoint);
    url.search = new URLSearchParams({ casing: 'snake', ...params }).toString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchImpl(url, {
        headers: { 'X-Api-Key': apiKey, 'X-Team-ID': teamId, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000), redirect: 'error',
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          const retry = Number(res.headers.get('retry-after'));
          await sleep(Math.min(30000, Math.max(1000 * (attempt + 1), Number.isFinite(retry) ? retry * 1000 : 0)));
          continue;
        }
        // Do not log response bodies or headers that could contain credentials.
        throw new Error(`Scrydex ${endpoint}: HTTP ${res.status}`);
      }
      const body = await res.json();
      if (!body || body.error || body.status === 'error' || !('data' in body)) throw new Error(`Invalid Scrydex response for ${endpoint}`);
      return body;
    }
  }
  async function list(endpoint) {
    const rows = [];
    const ids = new Set();
    let expected;
    for (let page = 1; page <= 1000; page++) {
      const result = await request(endpoint, { page: String(page), page_size: '100' });
      if (!Array.isArray(result.data)) throw new Error('Scrydex list response is not an array');
      const total = result.total_count ?? result.totalCount;
      if (!Number.isInteger(total) || total < 0) throw new Error('Scrydex response is missing a valid total count');
      if (expected !== undefined && total !== expected) throw new Error('Scrydex catalog changed during pagination; retry the import');
      expected = total;
      for (const row of result.data) {
        if (!row.id || ids.has(row.id)) throw new Error('Scrydex returned a missing or repeated ID');
        ids.add(row.id);
        rows.push(row);
      }
      if (rows.length === expected) return rows;
      if (!result.data.length || rows.length > expected) throw new Error('Incomplete Scrydex pagination');
      await sleep(150);
    }
    throw new Error('Scrydex pagination limit exceeded');
  }
  return { request, list };
}

function date(value) {
  if (!value) return null;
  const normalized = value.replaceAll('/', '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || !Number.isFinite(Date.parse(normalized))) throw new Error('Invalid Scrydex release date');
  return normalized;
}

function validateExpansion(set) {
  if (!set?.id || !set.name || set.language_code?.toUpperCase() !== 'EN' || set.is_online_only !== false || !Number.isInteger(set.total) || set.total < 1) {
    throw new Error('Expected a physical English Scrydex expansion with a positive card total');
  }
  date(set.release_date);
}

// Omit absent optional fields so refreshes preserve existing metadata/market URLs.
const compact = row => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined));
function mapExpansion(set) {
  validateExpansion(set);
  return compact({ id: set.id, name: set.name, series: set.series,
    total: set.total, printed_total: set.printed_total, release_date: date(set.release_date),
    symbol_url: set.symbol, logo_url: set.logo, ptcgo_code: set.code, updated_at: new Date().toISOString() });
}
function mapCard(card, set) {
  if (!card.id || !card.name || card.number == null || card.expansion?.id !== set.id || card.language_code?.toUpperCase() !== 'EN') {
    throw new Error(`Invalid card or expansion/language mismatch: ${card.id || '(missing ID)'}`);
  }
  const front = card.images?.find(image => image.type === 'front');
  return compact({ id: card.id, name: card.name, number: String(card.number), set_id: set.id,
    supertype: card.supertype, subtypes: card.subtypes, types: card.types,
    hp: card.hp == null ? undefined : String(card.hp),
    evolves_from: Array.isArray(card.evolves_from) ? card.evolves_from.join(', ') || undefined : card.evolves_from,
    evolves_to: card.evolves_to, rarity: card.rarity, artist: card.artist, flavor_text: card.flavor_text,
    image_small: front?.small, image_large: front?.large,
    set_name: set.name, set_series: set.series, set_printed_total: set.printed_total,
    set_release_date: date(set.release_date), updated_at: new Date().toISOString() });
}

async function prepareExpansion(client, id) {
  const { data: set } = await client.request(`/expansions/${id}`);
  validateExpansion(set);
  if (set.id !== id) throw new Error('Scrydex expansion ID mismatch');
  const cards = await client.list(`/expansions/${id}/cards`);
  if (cards.length !== set.total) throw new Error(`${id}: received ${cards.length}/${set.total} cards; refusing an incomplete import`);
  return { set: mapExpansion(set), cards: cards.map(card => mapCard(card, set)) };
}

async function writeExpansion(db, prepared) {
  const { set, cards } = prepared;
  const setResult = await db.from('pokemon_sets').upsert(set, { onConflict: 'id', defaultToNull: false });
  if (setResult.error) throw new Error(`Set write failed: ${setResult.error.message}`);
  // Group identical column shapes: absent optional columns must not erase old values
  // when PostgREST constructs a bulk insert from heterogeneous JSON objects.
  const groups = new Map();
  for (const card of cards) {
    const key = Object.keys(card).sort().join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  for (const group of groups.values()) {
    for (let offset = 0; offset < group.length; offset += 100) {
      const batch = group.slice(offset, offset + 100);
      const result = await db.from('pokemon_cards').upsert(batch, { onConflict: 'id', defaultToNull: false });
      if (result.error) throw new Error(`Card write failed for ${set.id}: ${result.error.message}. Rerun this set to resume.`);
      const read = await db.from('pokemon_cards').select('id,set_id,name,number').in('id', batch.map(card => card.id));
      if (read.error) throw new Error(`Readback failed: ${read.error.message}`);
      const stored = new Map((read.data || []).map(card => [card.id, card]));
      if (batch.some(card => { const row = stored.get(card.id); return !row || row.set_id !== card.set_id || row.name !== card.name || row.number !== card.number; })) {
        throw new Error(`Card readback mismatch for ${set.id}`);
      }
    }
  }
  return cards.length;
}

module.exports = { createScrydexClient, mapExpansion, mapCard, prepareExpansion, writeExpansion, date };
