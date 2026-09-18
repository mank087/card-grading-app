/** One-time import of the two public anniversary checklists. No API or login. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { mapExpansion, mapCard, writeExpansion } = require('../src/lib/scrydexPokemon.cjs');
const ROOT = path.join(__dirname, '..', 'data', 'scrydex-30th-2026-09-16');
const BUCKET = 'pokemon-catalog';
const SOURCES = [
  ['me55', 'https://scrydex.com/pokemon/expansions/30th-celebration/me55'],
  ['me55c', 'https://scrydex.com/pokemon/expansions/30th-celebration-classic-collection/me55c'],
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function pageData(html) {
  const match = html.match(/data-terminal-trigger-json-value="([^"]+)"/);
  if (!match) throw new Error('Public page no longer exposes card data; stop');
  const parsed = JSON.parse(decode(match[1]));
  return parsed.data || parsed;
}
async function get(url) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !['scrydex.com', 'images.scrydex.com'].includes(target.hostname)) throw new Error('Unexpected source host');
  await sleep(250);
  const response = await fetch(url, { signal: AbortSignal.timeout(25000), redirect: 'error', headers: { 'User-Agent': 'DCMGrading/1.0 (one-time-public-catalog-import)' } });
  if (!response.ok) throw new Error(`Public fetch HTTP ${response.status}: ${url}. Stopped; no authentication or access-control bypass.`);
  return response;
}
function save(file, value) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
  fs.renameSync(file + '.tmp', file);
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function collect() {
  fs.mkdirSync(ROOT, { recursive: true });
  for (const [id, url] of SOURCES) {
    const file = path.join(ROOT, id + '.json');
    const snapshot = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { source: url, collected_at: new Date().toISOString(), entries: [] };
    const html = await (await get(url)).text();
    const sourceSet = pageData(html);
    if (sourceSet.id !== id) throw new Error('Expansion ID mismatch');
    snapshot.set = mapExpansion(sourceSet);
    const links = new Map();
    for (const match of html.matchAll(/href="([^"]*\/pokemon\/cards\/[^\"]+)"/g)) {
      const link = new URL(decode(match[1]), url);
      const cardId = link.pathname.split('/').pop();
      if (cardId?.startsWith(id + '-')) links.set(cardId, link.href);
    }
    if (links.size !== sourceSet.total) throw new Error(`${id}: checklist has ${links.size}/${sourceSet.total} cards`);
    for (const [cardId, cardUrl] of links) {
      if (snapshot.entries.some(entry => entry.card.id === cardId)) continue;
      const sourceCard = pageData(await (await get(cardUrl)).text());
      if (sourceCard.id !== cardId) throw new Error('Card ID mismatch');
      const card = mapCard(sourceCard, sourceSet);
      if (!card.image_small || !card.image_large) throw new Error(`Missing images for ${cardId}`);
      snapshot.entries.push({ source: cardUrl, printed_number: sourceCard.printed_number, card });
      save(file, snapshot);
      if (snapshot.entries.length % 10 === 0) console.log(`${id}: collected ${snapshot.entries.length}/${links.size} cards`);
    }
    if (snapshot.entries.length !== links.size || snapshot.entries.some(entry => !links.has(entry.card.id))) throw new Error('Cached checklist does not match current public page');
    for (const [index, entry] of snapshot.entries.entries()) {
      entry.images ||= {};
      for (const size of ['small', 'large']) {
        if (entry.images[size] && fs.existsSync(path.join(ROOT, entry.images[size].file))) continue;
        const source = entry.card['image_' + size];
        const response = await get(source);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 10000000) throw new Error('Image exceeds size limit');
        const meta = await sharp(bytes).metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format) || !meta.width || !meta.height || meta.width < 100 || meta.height < 100) throw new Error(`Invalid card image: ${source}`);
        const relative = `images/${entry.card.id}/${size}.${meta.format}`;
        fs.mkdirSync(path.dirname(path.join(ROOT, relative)), { recursive: true });
        fs.writeFileSync(path.join(ROOT, relative), bytes);
        entry.images[size] = { source, file: relative, sha256: hash(bytes), width: meta.width, height: meta.height, contentType: `image/${meta.format}` };
        save(file, snapshot);
      }
      if ((index + 1) % 10 === 0) console.log(`${id}: validated images ${index + 1}/${snapshot.entries.length}`);
    }
    snapshot.complete = true;
    save(file, snapshot);
    console.log(`${id}: ready, ${snapshot.entries.length} cards and ${snapshot.entries.length * 2} validated images`);
  }
}
async function load() {
  const snapshots = SOURCES.map(([id]) => JSON.parse(fs.readFileSync(path.join(ROOT, id + '.json'), 'utf8')));
  // Validate the entire local artifact before the first storage/database mutation.
  for (const snapshot of snapshots) {
    if (!snapshot.complete || snapshot.entries.length !== snapshot.set.total || new Set(snapshot.entries.map(entry => entry.card.id)).size !== snapshot.set.total) throw new Error('Incomplete/duplicate snapshot');
    for (const entry of snapshot.entries) {
      if (entry.card.set_id !== snapshot.set.id) throw new Error('Wrong set in snapshot');
      if (!entry.images?.small || !entry.images?.large) throw new Error('Missing image snapshot');
      for (const image of Object.values(entry.images)) if (hash(fs.readFileSync(path.join(ROOT, image.file))) !== image.sha256) throw new Error('Image checksum mismatch');
    }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const backup = { captured_at: new Date().toISOString() };
  for (const table of ['pokemon_sets', 'pokemon_cards']) {
    const result = await db.from(table).select('*').in(table === 'pokemon_sets' ? 'id' : 'set_id', SOURCES.map(([id]) => id));
    if (result.error) throw new Error(result.error.message);
    backup[table] = result.data;
  }
  save(path.join(ROOT, `before-import-${Date.now()}.json`), backup);
  const buckets = await db.storage.listBuckets();
  if (buckets.error) throw new Error(buckets.error.message);
  const existing = buckets.data.find(bucket => bucket.name === BUCKET);
  if (existing && !existing.public) throw new Error('Catalog bucket exists but is not public');
  if (!existing) {
    const result = await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10000000, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    if (result.error) throw new Error(result.error.message);
  }
  for (const snapshot of snapshots) {
    const set = { ...snapshot.set };
    for (const field of ['logo_url', 'symbol_url']) {
      if (!set[field]) continue;
      const bytes = Buffer.from(await (await get(set[field])).arrayBuffer());
      const meta = await sharp(bytes).metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('Invalid expansion image');
      const key = `30th-2026/sets/${set.id}/${field}.${meta.format}`;
      const result = await db.storage.from(BUCKET).upload(key, bytes, { contentType: `image/${meta.format}`, upsert: true, cacheControl: '31536000' });
      if (result.error) throw new Error(result.error.message);
      set[field] = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
    }
    const cards = [];
    for (const [index, entry] of snapshot.entries.entries()) {
      const row = { ...entry.card };
      for (const size of ['small', 'large']) {
        const asset = entry.images[size];
        const key = `30th-2026/${asset.file}`;
        const bytes = fs.readFileSync(path.join(ROOT, asset.file));
        const result = await db.storage.from(BUCKET).upload(key, bytes, { contentType: asset.contentType, upsert: true, cacheControl: '31536000' });
        if (result.error) throw new Error(`Image upload failed: ${result.error.message}`);
        row['image_' + size] = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
      }
      cards.push(row);
      if ((index + 1) % 10 === 0) console.log(`${snapshot.set.id}: uploaded images ${index + 1}/${snapshot.entries.length}`);
    }
    const count = await writeExpansion(db, { set, cards });
    // Confirm stored image links, including anonymously accessible image content.
    const stored = await db.from('pokemon_cards').select('id,image_small,image_large').eq('set_id', snapshot.set.id);
    if (stored.error || stored.data.length !== count) throw new Error('Final stored card count mismatch');
    for (const row of stored.data) {
      const wanted = cards.find(card => card.id === row.id);
      if (!wanted || wanted.image_small !== row.image_small || wanted.image_large !== row.image_large) throw new Error('Stored image URL mismatch');
    }
    const imageChecks = [];
    for (const row of [cards[0], cards[Math.floor(cards.length / 2)], cards[cards.length - 1]]) {
      const response = await fetch(row.image_large, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Public image readback failed');
      const bytes = Buffer.from(await response.arrayBuffer());
      const expected = snapshot.entries.find(entry => entry.card.id === row.id).images.large;
      if (hash(bytes) !== expected.sha256) throw new Error('Stored image checksum mismatch');
      imageChecks.push(row.id);
    }
    save(path.join(ROOT, snapshot.set.id + '-import-result.json'), { verified_at: new Date().toISOString(), cards: count, images: count * 2, verified_image_samples: imageChecks, bucket: BUCKET });
    console.log(`${snapshot.set.id}: VERIFIED ${count} cards, ${count * 2} stored image links, ${imageChecks.length} image checksum readbacks`);
  }
}
if (require.main === module) {
  const mode = process.argv[2];
  (mode === '--collect' ? collect() : mode === '--load' ? load() : Promise.reject(new Error('Use --collect (public pages/images to local snapshot) or --load (snapshot to Supabase).')))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { pageData };
