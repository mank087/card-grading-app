/**
 * Twin-drift check.
 *
 * Several constants/algorithms are deliberately duplicated between the web app
 * (src/) and the React Native app (dcm-mobile/) — mobile's Metro bundler can't
 * reach across the project boundary into src/lib, so the mobile copies are
 * hand-maintained twins. That's fine right up until one side changes and the
 * other doesn't: mobile once shipped a bogus 'USPSPriorityExpress' shipping
 * token that eBay rejected at AddItem time, and the condition-label ladder has
 * drifted before too.
 *
 * This script extracts the comparable CORE of each declared twin pair (values
 * only — comments, formatting and import syntax are ignored) and fails with a
 * diff summary when a pair no longer matches.
 *
 * Usage:
 *   npm run check:twin-drift
 *   npx tsx scripts/check-twin-drift.ts
 *
 * Dependency-free on purpose (string/regex extraction, no TS compiler API) so
 * it can run in CI without installing anything.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

function read(rel: string): string {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch (err: any) {
    throw new Error(`Cannot read ${rel}: ${err?.message || err}`)
  }
}

/** Strip // line comments and block comments (string-literal aware enough for our files). */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += next ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && next === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    out += c
    i++
  }
  return out
}

/** Text of the bracketed block that starts at the first `open` after `fromIndex`. */
function balancedBlock(src: string, fromIndex: number, open: '[' | '{'): string {
  const close = open === '[' ? ']' : '}'
  const start = src.indexOf(open, fromIndex)
  if (start === -1) return ''
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++
    else if (src[i] === close) {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return ''
}

/** The literal block assigned to `name` (array or object), comments stripped. */
function declarationBlock(src: string, name: string, open: '[' | '{'): string {
  const clean = stripComments(src)
  // Anchored on the declaration keyword so a later USE of the name (e.g.
  // `SHIPPING_SERVICES.some(s => s.value === x)`) can't be mistaken for it.
  const decl = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=\\n]*=`).exec(clean)
  if (!decl) return ''
  return balancedBlock(clean, decl.index + decl[0].length, open)
}

/** `value: 'x'` tokens, in order, from an array-of-objects declaration. */
function extractObjectValues(src: string, name: string): string[] {
  const block = declarationBlock(src, name, '[')
  return [...block.matchAll(/value:\s*['"]([^'"]+)['"]/g)].map(m => m[1])
}

/** Plain string entries, in order, from an array declaration. */
function extractStringArray(src: string, name: string): string[] {
  const block = declarationBlock(src, name, '[')
  return [...block.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
}

// ─── Pair definitions ───

type Pair = {
  name: string
  a: { label: string; get: () => string[] }
  b: { label: string; get: () => string[] }
}

const MOBILE_EBAY_API = 'dcm-mobile/lib/ebayApi.ts'
const WEB_TRADING_API = 'src/lib/ebay/tradingApi.ts'
const MOBILE_TITLE = 'dcm-mobile/lib/ebayTitleBuilder.ts'
const WEB_TITLE = 'src/lib/ebay/titleBuilder.ts'
const MOBILE_CONSTANTS = 'dcm-mobile/lib/constants.ts'
const WEB_CONDITION = 'src/lib/conditionAssessment.ts'
const MOBILE_RESOLVE = 'dcm-mobile/lib/resolveCardValue.ts'
const WEB_RESOLVE = 'src/lib/pricing/resolveCardValue.ts'

/**
 * Mobile's display order lives inside buildEbayTitle's assemble(), as a run of
 * `include.has('key') ? …` ternaries — read the keys in source order.
 */
function mobileDisplayOrder(): string[] {
  const src = stripComments(read(MOBILE_TITLE))
  const assembleIdx = src.indexOf('const assemble')
  if (assembleIdx === -1) return []
  const block = balancedBlock(src, assembleIdx, '[')
  return [...block.matchAll(/include\.has\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1])
}

/** Mobile ConditionLabels — `10: 'Gem Mint'` — as "grade=label", high to low. */
function mobileConditionLadder(): string[] {
  const block = declarationBlock(read(MOBILE_CONSTANTS), 'ConditionLabels', '{')
  return [...block.matchAll(/(\d+):\s*['"]([^'"]+)['"]/g)]
    .map(m => ({ grade: Number(m[1]), label: m[2] }))
    .sort((x, y) => y.grade - x.grade)
    .map(e => `${e.grade}=${e.label}`)
}

/**
 * Web getConditionFromGrade — `if (grade >= N) return 'X';` thresholds plus the
 * trailing bare `return 'Poor'`, which stands for the lowest whole grade (1).
 */
function webConditionLadder(): string[] {
  const src = stripComments(read(WEB_CONDITION))
  const fnIdx = src.indexOf('function getConditionFromGrade')
  if (fnIdx === -1) return []
  const body = balancedBlock(src, fnIdx, '{')
  const entries = [...body.matchAll(/grade\s*>=\s*(\d+)\s*\)\s*return\s*['"]([^'"]+)['"]/g)].map(m => ({
    grade: Number(m[1]),
    label: m[2],
  }))
  // The final unconditional return covers everything below the lowest threshold.
  const tail = /return\s*['"]([^'"]+)['"]\s*;?\s*\}\s*$/.exec(body.trimEnd())
  const lowest = entries.length ? Math.min(...entries.map(e => e.grade)) : 2
  if (tail) entries.push({ grade: lowest - 1, label: tail[1] })
  return entries.sort((x, y) => y.grade - x.grade).map(e => `${e.grade}=${e.label}`)
}

/**
 * resolveCardValue is a declared VERBATIM copy, so compare normalized source:
 * comments, whitespace and trailing semicolons dropped, and the leading
 * header/interface prose differs by design — we compare the executable core
 * (exported function bodies + the type union) only.
 */
function normalizedResolveCore(rel: string): string[] {
  const src = stripComments(read(rel))
  const parts: string[] = []
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/;/g, '')
  // Every function declaration body, in order.
  const fnRe = /function\s+(\w+)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = fnRe.exec(src))) {
    const body = balancedBlock(src, m.index, '{')
    if (body) parts.push(`${m[1]}${norm(body)}`)
  }
  return parts
}

const PAIRS: Pair[] = [
  {
    name: 'eBay domestic shipping services',
    a: { label: `${MOBILE_EBAY_API} SHIPPING_SERVICES`, get: () => extractObjectValues(read(MOBILE_EBAY_API), 'SHIPPING_SERVICES') },
    b: { label: `${WEB_TRADING_API} DOMESTIC_SHIPPING_SERVICES`, get: () => extractObjectValues(read(WEB_TRADING_API), 'DOMESTIC_SHIPPING_SERVICES') },
  },
  {
    name: 'eBay title builder — optional priority order',
    a: { label: `${MOBILE_TITLE} PRIORITY_ORDER`, get: () => extractStringArray(read(MOBILE_TITLE), 'PRIORITY_ORDER') },
    b: { label: `${WEB_TITLE} optionalPriority`, get: () => extractStringArray(read(WEB_TITLE), 'optionalPriority') },
  },
  {
    name: 'eBay title builder — display order',
    a: { label: `${MOBILE_TITLE} assemble() order`, get: mobileDisplayOrder },
    b: { label: `${WEB_TITLE} displayOrder`, get: () => extractStringArray(read(WEB_TITLE), 'displayOrder') },
  },
  {
    name: 'Grade → condition label ladder',
    a: { label: `${MOBILE_CONSTANTS} ConditionLabels`, get: mobileConditionLadder },
    b: { label: `${WEB_CONDITION} getConditionFromGrade`, get: webConditionLadder },
  },
  {
    name: 'resolveCardValue (verbatim copy)',
    a: { label: MOBILE_RESOLVE, get: () => normalizedResolveCore(MOBILE_RESOLVE) },
    b: { label: WEB_RESOLVE, get: () => normalizedResolveCore(WEB_RESOLVE) },
  },
]

// ─── Runner ───

function summarize(pair: Pair, aVals: string[], bVals: string[]): string[] {
  const lines: string[] = []
  const onlyA = aVals.filter(v => !bVals.includes(v))
  const onlyB = bVals.filter(v => !aVals.includes(v))
  if (onlyA.length) lines.push(`    only in ${pair.a.label}: ${onlyA.join(', ')}`)
  if (onlyB.length) lines.push(`    only in ${pair.b.label}: ${onlyB.join(', ')}`)
  if (!onlyA.length && !onlyB.length) {
    // Same members, different order (or different length) — show both sequences.
    const max = Math.max(aVals.length, bVals.length)
    for (let i = 0; i < max; i++) {
      if (aVals[i] !== bVals[i]) {
        lines.push(`    index ${i}: ${JSON.stringify(aVals[i] ?? null)} vs ${JSON.stringify(bVals[i] ?? null)}`)
      }
    }
  }
  return lines
}

function main() {
  let failures = 0
  for (const pair of PAIRS) {
    let aVals: string[] = []
    let bVals: string[] = []
    try {
      aVals = pair.a.get()
      bVals = pair.b.get()
    } catch (err: any) {
      failures++
      console.log(`FAIL  ${pair.name}\n    ${err?.message || err}`)
      continue
    }
    if (!aVals.length || !bVals.length) {
      failures++
      console.log(
        `FAIL  ${pair.name}\n` +
          `    extraction returned nothing — the declaration was probably renamed or reshaped\n` +
          `    ${pair.a.label}: ${aVals.length} item(s)\n    ${pair.b.label}: ${bVals.length} item(s)`
      )
      continue
    }
    if (aVals.length === bVals.length && aVals.every((v, i) => v === bVals[i])) {
      console.log(`ok    ${pair.name} (${aVals.length} item${aVals.length === 1 ? '' : 's'})`)
      continue
    }
    failures++
    console.log(`FAIL  ${pair.name}`)
    console.log(`    ${pair.a.label}`)
    console.log(`    ${pair.b.label}`)
    summarize(pair, aVals, bVals).forEach(l => console.log(l))
  }

  if (failures > 0) {
    console.log(`\n${failures} twin pair(s) have drifted. Update BOTH sides, then re-run.`)
    process.exit(1)
  }
  console.log(`\nAll ${PAIRS.length} twin pairs are in sync.`)
}

main()
