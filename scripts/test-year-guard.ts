import { checkYearEvidence } from '../src/lib/yearGuard';

const cases: Array<[string, any, string, string | null]> = [
  // [name, card_info, expected outcome, expected year]
  ['back copyright verified',
    { year: '2019', year_source: 'back_copyright', year_text_seen: '© 2019 Panini America, Inc.' },
    'kept', '2019'],
  ['season indicator, first year convention',
    { year: '2023', year_source: 'season_indicator', year_text_seen: '2023-24 SEASON' },
    'kept', '2023'],
  ['model admits it could not read it but guessed anyway',
    { year: '1990', year_source: 'not_visible', year_text_seen: null },
    'dropped_not_visible', null],
  ['claims a source but transcribed nothing',
    { year: '1989', year_source: 'set_logo', year_text_seen: null },
    'dropped_no_evidence', null],
  ['transcription does not contain the reported year',
    { year: '1991', year_source: 'back_copyright', year_text_seen: '© 1989 Topps Inc.' },
    'dropped_mismatch', null],
  ['invented source value',
    { year: '2015', year_source: 'player_era', year_text_seen: 'Kobe Bryant, Lakers' },
    'dropped_no_evidence', null],
  ['implausible year',
    { year: '20233', year_source: 'set_logo', year_text_seen: '20233 Topps' },
    'dropped_implausible', null],
  ['no year at all',
    { year: null, year_source: 'not_visible', year_text_seen: null },
    'already_null', null],
  ['legacy response with no evidence fields (lenient default)',
    { year: '2021' },
    'kept_unverified', '2021'],
];

let failed = 0;
for (const [name, info, expectedOutcome, expectedYear] of cases) {
  const r = checkYearEvidence(info);
  const ok = r.outcome === expectedOutcome && r.year === expectedYear;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`      expected ${expectedOutcome}/${expectedYear}, got ${r.outcome}/${r.year} (${r.reason})`);
}

// strict mode
process.env.YEAR_EVIDENCE_REQUIRED = '1';
const strict = checkYearEvidence({ year: '2021' });
const strictOk = strict.outcome === 'dropped_no_evidence' && strict.year === null;
if (!strictOk) failed++;
console.log(`${strictOk ? 'PASS' : 'FAIL'}  strict mode drops evidence-less year`);

console.log(failed === 0 ? '\nAll year-guard cases passed.' : `\n${failed} case(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
