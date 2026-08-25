// Google Ads Editor import — Performance Max optimisation (Sales-Performance Max - ALL).
// Splits the single catch-all asset group into three category asset groups with
// matching landing pages, copy, search themes and audience signals, and writes the
// small campaign-fix file for the settings the Aug 25 import did not apply.
//   node scripts/google-ads-pmax-import.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || path.join('marketing', 'google-ads', '2026-08-25-import');
fs.mkdirSync(OUT, { recursive: true });
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function writeCsv(name, cols, data) { fs.writeFileSync(path.join(OUT, name), '﻿' + [cols.join(','), ...data.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n'), 'utf8'); console.log(`wrote ${name}: ${data.length} rows`); }
const BANNED = [/pre[- ]?grad/i, /pre[- ]?check/i, /second opinion/i, /know before you go/i, /guarantee/i, /more accurate/i, /riches/i, /\bPSA\b|\bBGS\b|\bSGC\b|\bCGC\b/, /Dynamic Collectibles/i];
const chk = (t, max, w) => { if (t.length > max) throw new Error(`${w}: "${t}" ${t.length}>${max}`); for (const rx of BANNED) if (rx.test(t)) throw new Error(`${w}: "${t}" banned ${rx}`); };

const CAMP = 'Sales-Performance Max - ALL';
const REMARKETING = 'Google-engaged audiences - for Account 2723302193';
const VIDEOS = ['RYB4WusEgU8', 'm8mbmR73bKU'];

const COMMON_H = ['Get 2 Free Card Grades', 'No Shipping. Cards Stay Home.', 'Graded In About A Minute', 'Subgrades & Centering Report', 'Real Sold-Listing Pricing', 'Print Your Own Slab Labels', 'List Graded Cards To eBay', 'Image Confidence A To D', 'From $0.50 Per Card Grade', 'Grade, Slab, Price & Sell'];
const COMMON_L = [
  'Photograph the card and get a grade in about a minute. The card never leaves your hands.',
  'Four subgrades and a written reason for every deduction, plus an image confidence letter.',
  'Real sold-listing pricing, printable slab labels for any holder, one-click eBay listing.',
];
const COMMON_D = [
  'Four subgrades and a written reason for every deduction. Two free grades to start.',
  'Real sold-listing pricing, printable slab labels and one-click eBay listings included.',
  'Graded by DCM Optic: same rubric for every card, no tier, no bad days. Plans from $0.50.',
];

const GROUPS = [
  {
    name: 'Pokemon', url: 'https://www.dcmgrading.com/pokemon-grading', signal: 'Pokémon Audience', custom: 'Pokemon Cards;Trading Card Games',
    h: ['Grade Pokémon Cards At Home', 'Pokémon Card Grading App', 'Grade Pokémon Cards From Photo', 'Pokémon Subgrades In A Minute', 'Is Your Pokémon Card A 10?'],
    l: ['Grade Pokémon cards from a photo in about a minute, with four subgrades and reasons.', 'Stop mailing Pokémon cards away for months. Grade, slab, price and sell from your phone.'],
    d1: 'Grade Pokémon cards from a photo in about a minute.',
    d: ['See centering, corners, edges and surface subgrades for every Pokémon card you own.'],
    themes: ['pokemon card grading', 'grade pokemon cards online', 'pokemon card grading app', 'pokemon card grader', 'pokemon centering check', 'pokemon card value', 'pokemon card worth', 'pokemon card condition', 'grade charizard', 'pokemon card subgrades', 'instant pokemon grading', 'pokemon card scanner', 'pokemon card price check', 'pokemon slab labels', 'sell pokemon cards ebay', 'pokemon card collection', 'pokemon tcg grading', 'vintage pokemon grading', 'pokemon card estimate', 'grade pokemon from photo'],
  },
  {
    name: 'Sports', url: 'https://www.dcmgrading.com/sports-grading', signal: 'Sports Audience', custom: 'Sports Memorabilia',
    h: ['Grade Sports Cards At Home', 'Sports Card Grading App', 'Grade Sports Cards From Photo', 'Rookie Card Subgrades Fast', 'Panini, Topps & Bowman Grading'],
    l: ['Grade sports cards from a photo in about a minute, with four subgrades and reasons.', 'Stop mailing rookies away for months. Grade, slab, price and list them from your phone.'],
    d1: 'Grade sports cards from a photo in about a minute.',
    d: ['Subgrades and live pricing for Panini, Topps, Bowman and every rookie card in your box.'],
    themes: ['sports card grading', 'grade sports cards online', 'sports card grading app', 'baseball card grading', 'football card grading', 'basketball card grading', 'rookie card grading', 'sports card centering', 'sports card value', 'sports card price check', 'grade panini prizm', 'grade topps chrome', 'bowman chrome grading', 'sports card subgrades', 'instant sports card grade', 'sports card scanner', 'sell sports cards ebay', 'sports card collection', 'grade michael jordan card', 'grade rookie cards fast'],
  },
  {
    name: 'TCG & Collectibles', url: 'https://www.dcmgrading.com/grade-your-first-card', signal: 'Website Audience - copy', custom: 'Trading Card Games',
    h: ['Grade Any Trading Card', 'TCG Card Grading Online', 'Yu-Gi-Oh, MTG & Lorcana', 'One Piece & Star Wars Too', 'Collectible Card Grading'],
    l: ['Grade Yu-Gi-Oh, Magic, Lorcana, One Piece and Star Wars cards from a photo in a minute.', 'Any trading card, graded at home: subgrades, market pricing, slab labels, eBay listings.'],
    d1: 'Grade any trading card from a photo in about a minute.',
    d: ['Yu-Gi-Oh, Magic, Lorcana, One Piece, Star Wars and more, with subgrades and pricing.'],
    themes: ['tcg card grading', 'trading card grading', 'yugioh card grading', 'mtg card grading', 'lorcana card grading', 'one piece card grading', 'star wars card grading', 'grade trading cards online', 'card grading app', 'trading card value', 'card centering check', 'collectible card grading', 'tcg card value', 'card condition checker', 'instant card grading', 'card grading from photo', 'trading card subgrades', 'slab labels', 'sell tcg cards ebay', 'card collection tracker'],
  },
];

const H = 15, LH = 5, DS = 5;
const cols = ['Campaign', 'Asset Group', 'Final URL', 'Business name', 'Call to action', ...Array.from({ length: H }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: LH }, (_, i) => `Long headline ${i + 1}`), ...Array.from({ length: DS }, (_, i) => `Description ${i + 1}`), 'Video ID 1', 'Video ID 2', 'Audience signal', 'Custom audience segments', 'Remarketing audience segments', 'Asset Group Status'];
const main = [], themes = [];
for (const g of GROUPS) {
  const heads = [...g.h, ...COMMON_H].slice(0, H); heads.forEach(x => chk(x, 30, `${g.name} H`));
  const longs = [...g.l, ...COMMON_L].slice(0, LH); longs.forEach(x => chk(x, 90, `${g.name} LH`));
  const descs = [g.d1, ...g.d, ...COMMON_D].slice(0, DS); chk(descs[0], 60, `${g.name} D1`); descs.forEach(x => chk(x, 90, `${g.name} D`));
  const row = { Campaign: CAMP, 'Asset Group': g.name, 'Final URL': g.url, 'Business name': 'DCM Grading', 'Call to action': 'Sign up', 'Video ID 1': VIDEOS[0], 'Video ID 2': VIDEOS[1], 'Audience signal': g.signal, 'Custom audience segments': g.custom, 'Remarketing audience segments': REMARKETING, 'Asset Group Status': 'Enabled' };
  heads.forEach((x, i) => row[`Headline ${i + 1}`] = x); longs.forEach((x, i) => row[`Long headline ${i + 1}`] = x); descs.forEach((x, i) => row[`Description ${i + 1}`] = x);
  main.push(row);
  g.themes.forEach(t => {
    if (t.length > 25) { console.warn(`  skipped theme (>25 chars): "${t}"`); return; }
    chk(t, 25, `${g.name} theme`);
    themes.push({ Campaign: CAMP, 'Asset Group': g.name, 'Search theme': t, Status: 'Enabled' });
  });
}
writeCsv('06-pmax-asset-groups.csv', cols, main);
writeCsv('06b-pmax-search-themes.csv', ['Campaign', 'Asset Group', 'Search theme', 'Status'], themes);

// Campaign fixes the first import did not apply
writeCsv('07-campaign-fixes.csv', ['Campaign', 'Networks', 'Budget', 'Budget type', 'Bid Strategy Type', 'Maximum CPC bid limit', 'Campaign Status'], [
  { Campaign: 'Search - Pokemon', Networks: 'Google search' },
  { Campaign: 'Search-sports', Networks: 'Google search' },
  { Campaign: 'Search-enterprise', Networks: 'Google search', Budget: '15.00', 'Budget type': 'Daily', 'Bid Strategy Type': 'Maximize clicks', 'Maximum CPC bid limit': '2.50', 'Campaign Status': 'Paused' },
]);
