// Google Ads Editor import builder — DCM Grading, Aug 25 2026 review.
// Reads the Editor whole-account export, regroups existing keywords into themed
// ad groups, writes new RSAs, campaign settings, negatives, campaign-level assets
// and a new Enterprise Search campaign as Editor-importable CSVs.
//
//   node scripts/google-ads-editor-import.mjs "<path to Editor export csv>" [outDir]
//
// Copy rules enforced here (marketing/BENEFITS_MESSAGING.md, PLATFORM_ADS_COPY.md,
// DCM_SOCIAL_STRATEGY_2026.md §9): no "pre-grade / pre-check / second opinion /
// know before you go" in ad copy, no accuracy or outcome claims, no resale
// multipliers, no disparaging competitor frames, DCM Optic on first mention,
// never the legal entity name. Headlines <= 30 chars, descriptions <= 90.
import fs from 'node:fs';
import path from 'node:path';

const [,, exportPath, outArg] = process.argv;
if (!exportPath) { console.error('usage: node scripts/google-ads-editor-import.mjs <export.csv> [outDir]'); process.exit(1); }
const OUT = outArg || path.join('marketing', 'google-ads', '2026-08-25-import');
fs.mkdirSync(OUT, { recursive: true });

// ---------- read export ----------
let txt = fs.readFileSync(exportPath);
txt = txt.slice(0, 2).equals(Buffer.from([0xff, 0xfe])) ? txt.toString('utf16le').replace(/^﻿/, '') : txt.toString('utf8').replace(/^﻿/, '');
const lines = txt.split(/\r?\n/).filter(l => l.length);
const hdr = lines[0].split('\t');
const rows = lines.slice(1).map(l => { const c = l.split('\t'); const o = {}; hdr.forEach((h, i) => { if (c[i] !== undefined && c[i] !== '' && c[i] !== ' ') o[h] = c[i]; }); return o; });
const keywordRows = rows.filter(r => r.Keyword && r['Ad Group'] && !/Negative/i.test(r['Criterion Type'] || ''));
const campNegRows = rows.filter(r => r.Keyword && /Campaign Negative/i.test(r['Criterion Type'] || ''));

const C = { pokemon: 'Search - Pokemon', sports: 'Search-sports', general: 'Search-general audience', pmax: 'Sales-Performance Max - ALL', ent: 'Enterprise-PMAX', entSearch: 'Search-enterprise' };
const URL = { pokemon: 'https://www.dcmgrading.com/pokemon-grading', sports: 'https://www.dcmgrading.com/sports-grading', first: 'https://www.dcmgrading.com/grade-your-first-card', why: 'https://www.dcmgrading.com/why-dcm', credits: 'https://www.dcmgrading.com/credits', labels: 'https://www.dcmgrading.com/reports-and-labels', pricing: 'https://www.dcmgrading.com/market-pricing', lovers: 'https://www.dcmgrading.com/card-lovers', rubric: 'https://www.dcmgrading.com/grading-rubric', enterprise: 'https://www.dcmgrading.com/enterprise', apex: 'https://www.dcmgrading.com/enterprise/apex', start: 'https://www.dcmgrading.com/get-started' };
const TRACKING = '{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}';

// ---------- helpers ----------
const BANNED = [/pre[- ]?grad/i, /pre[- ]?check/i, /second opinion/i, /know before you go/i, /before you submit/i, /guarantee/i, /more accurate/i, /\bx raw\b/i, /riches/i, /d\/b\/a/i, /Dynamic Collectibles/i, /\bPSA\b|\bBGS\b|\bSGC\b|\bCGC\b/];
function checkCopy(text, max, where) {
  if (text.length > max) throw new Error(`${where}: "${text}" is ${text.length} chars (max ${max})`);
  for (const rx of BANNED) if (rx.test(text)) throw new Error(`${where}: "${text}" hits banned phrase ${rx}`);
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function writeCsv(name, cols, data) {
  const out = [cols.join(','), ...data.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\r\n');
  fs.writeFileSync(path.join(OUT, name), '﻿' + out, 'utf8');
  console.log(`wrote ${name}: ${data.length} rows`);
}

// ---------- 1. campaign settings ----------
const settingsCols = ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Bid Strategy Type', 'Maximum CPC bid limit', 'Target ROAS', 'Final URL expansion', 'Tracking template', 'Languages', 'Campaign Status'];
const settings = [
  { Campaign: C.pokemon, Networks: 'Google search', 'Maximum CPC bid limit': '0.75', 'Tracking template': TRACKING },
  { Campaign: C.sports, Networks: 'Google search', 'Maximum CPC bid limit': '0.75', 'Tracking template': TRACKING },
  { Campaign: C.general, Networks: 'Google search', 'Maximum CPC bid limit': '1.00', 'Tracking template': TRACKING },
  { Campaign: C.pmax, 'Target ROAS': '250%', 'Final URL expansion': 'Disabled', 'Tracking template': TRACKING },
  { Campaign: C.entSearch, 'Campaign Type': 'Search', Networks: 'Google search', Budget: '15.00', 'Budget type': 'Daily', 'Bid Strategy Type': 'Maximize clicks', 'Maximum CPC bid limit': '2.50', 'Tracking template': TRACKING, Languages: 'en', 'Campaign Status': 'Paused' },
];
writeCsv('01-campaign-settings.csv', settingsCols, settings);
writeCsv('01b-campaign-locations.csv', ['Campaign', 'Location', 'ID', 'Location type'], [{ Campaign: C.entSearch, Location: 'United States', ID: '2840', 'Location type': 'Country' }]);

// ---------- 2. negatives ----------
const negByCamp = {};
for (const r of campNegRows) (negByCamp[r.Campaign] = negByCamp[r.Campaign] || new Set()).add(r.Keyword.toLowerCase());
const shared = [...(negByCamp[C.pokemon] || [])].filter(k => (negByCamp[C.sports] || new Set()).has(k) && k !== 'free');
const sportsTerms = ['baseball', 'football', 'basketball', 'hockey', 'soccer', 'nfl', 'nba', 'mlb', 'nhl', 'topps', 'panini', 'bowman', 'prizm', 'select', 'upper deck', 'rookie card', 'sports card', 'sports cards', 'wembanyama', 'ohtani', 'jordan', 'lebron', 'brady'];
const pokemonTerms = ['pokemon', 'pokémon', 'pikachu', 'charizard', 'tcg pocket'];
const negatives = [];
const addNeg = (camp, kw, type = 'Campaign Negative Phrase') => negatives.push({ Campaign: camp, Keyword: kw, 'Criterion Type': type, Status: 'Enabled' });
// General: shared hygiene list + routing (category terms + the specific campaigns' exact keywords)
for (const k of shared) addNeg(C.general, k);
for (const k of [...sportsTerms, ...pokemonTerms]) addNeg(C.general, k);
const specificExact = new Set(keywordRows.filter(r => r.Campaign === C.pokemon || r.Campaign === C.sports).map(r => r.Keyword.toLowerCase()));
for (const k of specificExact) addNeg(C.general, k, 'Campaign Negative Exact');
// Pokemon: sports routing terms it lacks; Sports: pokemon routing it lacks
for (const k of sportsTerms) if (!(negByCamp[C.pokemon] || new Set()).has(k)) addNeg(C.pokemon, k);
for (const k of pokemonTerms) if (!(negByCamp[C.sports] || new Set()).has(k)) addNeg(C.sports, k);
// narrower "free" replacements (after removing the bare "free" negative by hand)
for (const camp of [C.pokemon, C.sports]) for (const k of ['free printable', 'free download', 'free pokemon cards', 'free cards', 'giveaway']) addNeg(camp, k);
// Enterprise search hygiene
for (const k of ['jobs', 'job', 'salary', 'salaries', 'career', 'careers', 'hiring', 'franchise', 'app', 'free', 'my card', 'how to grade', 'psa', 'bgs', 'sgc', 'cgc', 'ebay', 'reddit', 'course', 'certification']) addNeg(C.entSearch, k);
writeCsv('02-negative-keywords.csv', ['Campaign', 'Keyword', 'Criterion Type', 'Status'], negatives);

// ---------- 3. campaign-level assets ----------
const consumerSitelinks = [
  ['Grade Your First Card', 'Two free grades to start', 'Results in about a minute', URL.first],
  ['Pricing', 'Credits from $0.50 per grade', 'Card Lovers monthly & annual', URL.credits],
  ['How It Works', 'Centering, corners, edges, surface', 'Weakest-link grading, explained', URL.rubric],
  ['Reports & Slab Labels', 'Print labels for any holder', 'Heritage, Modern, custom', URL.labels],
  ['Market Pricing', 'Real sold listings, not asking', 'Graded and raw estimates', URL.pricing],
  ['Card Lovers Plan', '70 grades a month for $49.99', 'Or 900 a year for $449', URL.lovers],
];
const enterpriseSitelinks = [
  ['See A Live Storefront', 'A card shop grading under its brand', 'Your logo on every slab', URL.apex],
  ['Plans From $199/mo', '400 grades a month, $0.50 each', 'Enterprise 1,000 at $0.40', URL.enterprise + '#pricing'],
  ['Apply Now', 'Shops, dealers, breakers', 'Set up in a day', URL.enterprise + '#apply'],
  ['Branded Labels & Reports', 'Design your slab label once', 'It prints on every card', URL.enterprise + '#labels'],
];
const consumerCallouts = ['Instant Card Grading', 'No Mailing Required', 'Grade Cards at Home', 'Printable Slab Labels', 'Downloadable Reports', 'Real Sold-Listing Pricing', '2 Free Grades To Start', 'List To eBay In One Click'];
const enterpriseCallouts = ['Your Logo On The Slab', 'In-Store Grading', 'From $0.40/Card', 'Branded Card Pages', 'Grade Live At Card Shows', 'Monthly Plans For Shops'];
const assets = [];
for (const camp of [C.pokemon, C.sports, C.general]) {
  for (const [t, d1, d2, u] of consumerSitelinks) { checkCopy(t, 25, 'sitelink'); checkCopy(d1, 35, 'sitelink d1'); checkCopy(d2, 35, 'sitelink d2'); assets.push({ Campaign: camp, 'Link Text': t, 'Description Line 1': d1, 'Description Line 2': d2, 'Final URL': u }); }
  for (const c of consumerCallouts) { checkCopy(c, 25, 'callout'); assets.push({ Campaign: camp, 'Callout text': c }); }
}
for (const camp of [C.entSearch, C.ent]) {
  for (const [t, d1, d2, u] of enterpriseSitelinks) { checkCopy(t, 25, 'sitelink'); checkCopy(d1, 35, 'sitelink d1'); checkCopy(d2, 35, 'sitelink d2'); assets.push({ Campaign: camp, 'Link Text': t, 'Description Line 1': d1, 'Description Line 2': d2, 'Final URL': u }); }
  for (const c of enterpriseCallouts) { checkCopy(c, 25, 'callout'); assets.push({ Campaign: camp, 'Callout text': c }); }
}
writeCsv('03a-sitelinks-campaign-level.csv', ['Campaign', 'Link Text', 'Description Line 1', 'Description Line 2', 'Final URL'], assets.filter(a => a['Link Text']));
writeCsv('03b-callouts-campaign-level.csv', ['Campaign', 'Callout text'], assets.filter(a => a['Callout text']));

// ---------- 4. themed ad groups ----------
// Order matters: first matching theme wins.
const THEMES = {
  [C.pokemon]: [
    ['Pokemon - Centering & Subgrades', /centering|subgrade|condition/],
    ['Pokemon - Grading App', /\bapp\b|scan|scanner|digital/],
    ['Pokemon - Estimate & Worth Grading', /estimate|worth|should i|before grading|pre grad|check .*grade|grade scanner/],
    ['Pokemon - Service & Price', /service|cheapest|grader\b|grade raw|ai pokemon/],
    ['Pokemon - Online & From Photo', /.*/],
  ],
  [C.sports]: [
    ['Sports - Players', /jordan|brady|ohtani|wembanyama|lebron/],
    ['Sports - Brands', /panini|topps|bowman|prizm|upper deck/],
    ['Sports - Centering & Subgrades', /centering|subgrade|condition/],
    ['Sports - Grading App', /\bapp\b|scan|digital/],
    ['Sports - Estimate & Worth Grading', /estimate|before grading|pre grad|check .*grade|find my|how to grade/],
    ['Sports - Service & Price', /service|cheapest|grade raw|ai sports/],
    ['Sports - Online & From Photo', /.*/],
  ],
  [C.general]: [
    ['General - Centering & Subgrades', /centering|subgrade|condition/],
    ['General - TCG Grading', /\btcg\b/],
    ['General - Collectible & Non-Sport', /collectible|non sport|entertainment/],
    ['General - Grading App', /\bapp\b|scan|digital/],
    ['General - Estimate & Checker', /estimate|checker|check .*grade|pre grad/],
    ['General - AI Card Grader', /\bai\b|grader\b/],
    ['General - Online & From Photo', /.*/],
  ],
};
const groupKw = [];
const seen = new Set();
for (const r of keywordRows) {
  const camp = r.Campaign; if (!THEMES[camp]) continue;
  const kw = r.Keyword.trim(); const mt = r['Criterion Type'];
  const key = `${camp}|${kw.toLowerCase()}|${mt}`; if (seen.has(key)) continue; seen.add(key);
  const theme = THEMES[camp].find(([, rx]) => rx.test(kw.toLowerCase()))[0];
  groupKw.push({ Campaign: camp, 'Ad Group': theme, Keyword: kw, 'Criterion Type': mt, Status: r.Status === 'Paused' ? 'Paused' : 'Enabled' });
}
// Enterprise search keywords (new)
const entKw = {
  'Enterprise - Wholesale & In-Store': ['wholesale card grading', 'in store card grading', 'card grading for card shops', 'card shop grading service', 'lcs card grading', 'card grading kiosk', 'white label card grading', 'private label card grading', 'card grading platform for shops', 'b2b card grading service', 'card grading wholesale pricing', 'bulk card grading service'],
  'Enterprise - Dealers & Card Shows': ['card show grading', 'grade cards at card shows', 'on site card grading', 'card dealer grading service', 'card grading for dealers', 'card grading for resellers', 'grading service for card resellers', 'card grading subscription for business'],
  'Enterprise - Breakers & Streamers': ['card grading for breakers', 'live break card grading', 'slab cards on stream', 'whatnot seller card grading', 'card grading for whatnot sellers', 'grading for card streamers', 'card grading for ebay sellers', 'start a card grading business', 'how to start a card grading company', 'launch card grading brand'],
};
for (const [g, list] of Object.entries(entKw)) for (const kw of list) for (const mt of ['Exact', 'Phrase']) groupKw.push({ Campaign: C.entSearch, 'Ad Group': g, Keyword: kw, 'Criterion Type': mt, Status: 'Enabled' });
writeCsv('04-ad-groups-and-keywords.csv', ['Campaign', 'Ad Group', 'Keyword', 'Criterion Type', 'Status'], groupKw);
const adGroupRows = [...new Set(groupKw.map(r => `${r.Campaign}\t${r['Ad Group']}`))].map(s => { const [Campaign, AdGroup] = s.split('\t'); return { Campaign, 'Ad Group': AdGroup, 'Max CPC': Campaign === C.entSearch ? '2.00' : '0.60', 'Ad Group Type': 'Standard', 'Ad Group Status': 'Enabled' }; });
writeCsv('04a-ad-group-settings.csv', ['Campaign', 'Ad Group', 'Max CPC', 'Ad Group Type', 'Ad Group Status'], adGroupRows);
writeCsv('04b-pause-old-ad-groups.csv', ['Campaign', 'Ad Group', 'Ad Group Status'], [C.pokemon, C.sports, C.general].map(c => ({ Campaign: c, 'Ad Group': 'Ad group 1', 'Ad Group Status': 'Paused' })));

// ---------- 5. RSAs ----------
const COMMON_H = ['Get 2 Free Card Grades Today', 'No Shipping. Cards Stay Home.', 'Graded In About A Minute', 'Subgrades & Centering Report', 'Real Sold-Listing Pricing', 'Print Your Own Slab Labels', 'List Graded Cards To eBay', 'Image Confidence A To D', 'From $0.50 Per Card Grade'];
const COMMON_D = [
  'Photograph the card, get a grade in about a minute. The card never leaves your hands.',
  'Four subgrades and a written reason for every deduction. Two free grades to start.',
  'Real sold-listing pricing, printable slab labels and one-click eBay listings included.',
  'Graded by DCM Optic: same rubric for every card, no tier, no bad days. Plans from $0.50.',
];
function rsa(camp, group, url, themeH, descOverride, pins = {}) {
  const H = [...themeH, ...COMMON_H].slice(0, 15);
  const D = (descOverride || COMMON_D).slice(0, 4);
  H.forEach(h => checkCopy(h, 30, `${group} H`)); D.forEach(d => checkCopy(d, 90, `${group} D`));
  const row = { Campaign: camp, 'Ad Group': group, 'Ad type': 'Responsive search ad', 'Final URL': url, Status: 'Enabled' };
  H.forEach((h, i) => { row[`Headline ${i + 1}`] = h; if (pins[i + 1]) row[`Headline ${i + 1} position`] = pins[i + 1]; });
  D.forEach((d, i) => { row[`Description ${i + 1}`] = d; });
  return row;
}
const P1 = { 1: '1', 2: '1' }; // pin the two theme headlines to position 1
const ads = [
  rsa(C.pokemon, 'Pokemon - Centering & Subgrades', URL.pokemon, ['Pokémon Card Centering Check', 'Pokémon Card Subgrades', 'Measure Centering From A Photo', 'See Every Deduction Explained', 'Corners, Edges & Surface'], null, P1),
  rsa(C.pokemon, 'Pokemon - Grading App', URL.pokemon, ['Pokémon Card Grading App', 'Scan & Grade Pokémon Cards', 'Grade From Your Phone', 'DCM Optic Grades Every Card', 'iPhone & Android App'], null, P1),
  rsa(C.pokemon, 'Pokemon - Estimate & Worth Grading', URL.pokemon, ['Pokémon Card Grade Estimate', 'Is Your Pokémon Card A 10?', 'Grade It Yourself In A Minute', 'See The Grade And The Reason', 'Full Grading, Not A Guess'], null, P1),
  rsa(C.pokemon, 'Pokemon - Service & Price', URL.pokemon, ['Pokémon Card Grading Service', 'Grade Pokémon Cards From $0.50', 'Grade Raw Pokémon Cards Fast', 'Slab, Label & Sell At Home', 'A Full Grading Platform'], null, P1),
  rsa(C.pokemon, 'Pokemon - Online & From Photo', URL.pokemon, ['Grade Pokémon Cards From Photo', 'Online Pokémon Card Grading', 'Instant Pokémon Card Grading', 'Pokémon Grades In A Minute', 'Digital Pokémon Card Grading'], null, P1),
  rsa(C.sports, 'Sports - Players', URL.sports, ['Grade Your Rookie Card Today', 'Sports Card Grading From Photo', 'Jordan, Brady, Ohtani & More', 'Subgrades For Any Player Card', 'Grade Raw Rookies At Home'], null, { 2: '1' }),
  rsa(C.sports, 'Sports - Brands', URL.sports, ['Panini, Topps & Bowman Grading', 'Grade Prizm & Chrome At Home', 'Sports Card Grading From Photo', 'Subgrades On Every Parallel', 'Live Sports Card Pricing'], null, P1),
  rsa(C.sports, 'Sports - Centering & Subgrades', URL.sports, ['Sports Card Centering Check', 'Sports Card Subgrades', 'Measure Centering From A Photo', 'See Every Deduction Explained', 'Corners, Edges & Surface'], null, P1),
  rsa(C.sports, 'Sports - Grading App', URL.sports, ['Sports Card Grading App', 'Scan & Grade Sports Cards', 'Grade From Your Phone', 'DCM Optic Grades Every Card', 'iPhone & Android App'], null, P1),
  rsa(C.sports, 'Sports - Estimate & Worth Grading', URL.sports, ['Sports Card Grade Estimate', 'Is Your Card A 10? Find Out', 'Grade It Yourself In A Minute', 'See The Grade And The Reason', 'Full Grading, Not A Guess'], null, P1),
  rsa(C.sports, 'Sports - Service & Price', URL.sports, ['Sports Card Grading Service', 'Grade Sports Cards From $0.50', 'Grade Raw Sports Cards Fast', 'Slab, Label & Sell At Home', 'A Full Grading Platform'], null, P1),
  rsa(C.sports, 'Sports - Online & From Photo', URL.sports, ['Grade Sports Cards From Photo', 'Online Sports Card Grading', 'Instant Sports Card Grading', 'Grade Sports Cards In A Minute', 'Digital Sports Card Grading'], null, P1),
  rsa(C.general, 'General - Centering & Subgrades', URL.first, ['Card Centering Checker', 'Trading Card Subgrades', 'Measure Centering From A Photo', 'See Every Deduction Explained', 'Corners, Edges & Surface'], null, P1),
  rsa(C.general, 'General - TCG Grading', URL.first, ['TCG Card Grading Online', 'Grade TCG Cards From A Photo', 'Yu-Gi-Oh, MTG, Lorcana & More', 'One Piece & Star Wars Too', 'Subgrades For Any TCG'], null, P1),
  rsa(C.general, 'General - Collectible & Non-Sport', URL.first, ['Collectible Card Grading', 'Grade Non-Sport Cards Online', 'Any Trading Card, Graded', 'Subgrades And Market Pricing', 'Grade Cards From A Photo'], null, P1),
  rsa(C.general, 'General - Grading App', URL.first, ['Card Grading App', 'Scan & Grade Trading Cards', 'Grade From Your Phone', 'DCM Optic Grades Every Card', 'iPhone & Android App'], null, P1),
  rsa(C.general, 'General - Estimate & Checker', URL.first, ['Card Grade Checker', 'Estimate Your Card Grade', 'Grade It Yourself In A Minute', 'See The Grade And The Reason', 'Full Grading, Not A Guess'], null, P1),
  rsa(C.general, 'General - AI Card Grader', URL.first, ['AI Card Grader: DCM Optic', 'Consistent Grading, Every Card', 'No Tier. No Bad Days.', 'Published Subgrades & Doubt', 'Machine Consistent Grading'], null, P1),
  rsa(C.general, 'General - Online & From Photo', URL.first, ['Grade Trading Cards Online', 'Grade Cards From A Photo', 'Instant Card Grading At Home', 'Grade Cards In About A Minute', 'Trading Card Grading'], null, P1),
];
const ENT_D = [
  'Your logo on the slab, the report and the card page. Plans from $199/mo for 400 grades.',
  'Wholesale grading from $0.40 a card. Grade at the counter, the show table or on stream.',
  'Every slab carries a serial and a branded verification page your buyers can scan.',
  'Built for card shops, show dealers, breakers and streamers. Apply in minutes.',
];
const ENT_H = ['Your Logo On Every Slab', 'Wholesale Grading $0.40/Card', 'Plans From $199 A Month', 'Results In About A Minute', 'Branded Reports & Registry', 'No Mail-In. No Waiting.', 'Design Your Slab Label Once', 'Apply Now, Set Up In A Day'];
function entRsa(group, themeH) { const r = rsa(C.entSearch, group, URL.enterprise, [...themeH, ...ENT_H].slice(0, 15), ENT_D, P1); return r; }
ads.push(entRsa('Enterprise - Wholesale & In-Store', ['Wholesale Card Grading', 'In-Store Card Grading', 'Grade Cards Under Your Brand', 'Card Grading For Card Shops', 'Your Own Grading Storefront']));
ads.push(entRsa('Enterprise - Dealers & Card Shows', ['Grade Cards At Card Shows', 'Card Grading For Dealers', 'Grade At The Show Table', 'Slab And Sell The Same Day', 'Grading For Card Resellers']));
ads.push(entRsa('Enterprise - Breakers & Streamers', ['Card Grading For Breakers', 'Slab Your Breaks On Stream', 'Grading For Whatnot Sellers', 'Grade Live, Sell Live', 'Your Brand On Every Break']));
const adCols = ['Campaign', 'Ad Group', 'Ad type', 'Final URL', 'Status', ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1} position`), ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`)];
writeCsv('05-responsive-search-ads.csv', adCols, ads);

// ---------- summary ----------
const summary = {};
for (const r of groupKw) { const k = `${r.Campaign} > ${r['Ad Group']}`; summary[k] = (summary[k] || 0) + 1; }
console.log('\nKeywords per ad group:'); for (const [k, n] of Object.entries(summary)) console.log(`  ${n.toString().padStart(3)}  ${k}`);
console.log(`\nNegatives: ${negatives.length} | assets: ${assets.length} | ads: ${ads.length}`);
fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify({ groups: summary, negatives: negatives.length, assets: assets.length, ads: ads.length }, null, 2));
