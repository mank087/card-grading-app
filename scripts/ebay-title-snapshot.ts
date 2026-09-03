/**
 * eBay title snapshot.
 *
 * Runs ~40 fixture cards — one per category, times the edge cases that have
 * actually bitten us — through the real resolver + title builder and prints
 * the title it would produce, with its length. Two invariants are ASSERTED and
 * fail the run:
 *
 *   1. every title is <= 80 characters (eBay rejects longer at AddItem time)
 *   2. no title names a rival grading company (eBay keyword-spamming policy)
 *
 * Everything else is eyeball review: run it after any change to the token
 * tables and read the diff in the printed titles.
 *
 * Usage:
 *   npm run check:ebay-titles
 *   npx tsx scripts/ebay-title-snapshot.ts
 */

import { resolveListingFields } from '../src/lib/ebay/listingFields'
import { buildEbayTitle } from '../src/lib/ebay/titleBuilder'
import { findBlockedGrader } from '../src/lib/ebay/gradingCompanyBlocklist'
import { buildListingDraft } from '../src/lib/ebay/listingDraft'
import { CardGradingReport, type ReportCardData } from '../src/components/reports/CardGradingReport'

const MAX = 80

type Fixture = {
  label: string
  /** Raw `cards` row shape, exactly as the listing surfaces receive it. */
  card: Record<string, any>
  /** Grade label override — an enterprise store's brand. */
  gradeLabel?: string
}

/** Shorthand for a card row: category + grade + conversational_card_info. */
function card(
  category: string,
  grade: number | null,
  info: Record<string, any>,
  extra: Record<string, any> = {}
): Record<string, any> {
  return {
    category,
    conversational_whole_grade: grade,
    conversational_card_info: info,
    ...extra,
  }
}

const FIXTURES: Fixture[] = [
  // ─── Sports ───
  {
    label: 'sports · modern rookie parallel',
    card: card('football', 9, {
      player_or_character: 'C.J. Stroud',
      year: '2023',
      manufacturer: 'Panini',
      set_name: 'Prizm Football',
      card_number: '341',
      parallel: 'Silver',
      team: 'Houston Texans',
      rookie: true,
    }),
  },
  {
    label: 'sports · numbered auto rookie',
    card: card('basketball', 10, {
      player_or_character: 'Victor Wembanyama',
      year: '2023',
      manufacturer: 'Panini',
      set_name: 'National Treasures',
      subset: 'Rookie Patch Autograph',
      card_number: '101',
      parallel: 'Gold',
      serial_number: '05/10',
      team: 'San Antonio Spurs',
      rookie: true,
    }, { autographed: true, autograph_type: 'on-card' }),
  },
  {
    label: 'sports · vintage, no parallel',
    card: card('baseball', 5, {
      player_or_character: 'Hank Aaron',
      year: '1968',
      manufacturer: 'Topps',
      set_name: 'Topps',
      card_number: '110',
      team: 'Atlanta Braves',
    }),
  },
  {
    label: 'sports · very long player + set (truncation pressure)',
    card: card('football', 8, {
      player_or_character: 'Christian Anderson-Wentworth III',
      year: '2022',
      manufacturer: 'Panini',
      set_name: 'Contenders Optic Championship Ticket Football',
      subset: 'Rookie Ticket Autograph',
      card_number: '221',
      parallel: 'Cracked Ice Purple',
      serial_number: '12/25',
      team: 'Tampa Bay Buccaneers',
      rookie: true,
    }, { autographed: true }),
  },
  {
    label: 'sports · hockey split season',
    card: card('hockey', 9, {
      player_or_character: 'Connor Bedard',
      year: '2023',
      manufacturer: 'Upper Deck',
      set_name: 'Young Guns',
      card_number: '451',
      team: 'Chicago Blackhawks',
      rookie: true,
    }),
  },
  {
    label: 'sports · soccer, no team',
    card: card('soccer', 7, {
      player_or_character: 'Lamine Yamal',
      year: '2024',
      manufacturer: 'Topps',
      set_name: 'Chrome UCL',
      card_number: '88',
    }),
  },
  {
    label: 'sports · set name already contains the year',
    card: card('baseball', 9, {
      player_or_character: 'Shohei Ohtani',
      year: '2018',
      set_name: '2018 Topps Chrome Update',
      card_number: 'HMT30',
      rookie: true,
      team: 'Los Angeles Angels',
    }),
  },
  {
    label: 'sports · racing, unknown league',
    card: card('racing', 6, {
      player_or_character: 'Dale Earnhardt',
      year: '1995',
      manufacturer: 'Action Packed',
      set_name: 'Winston Cup',
      card_number: '3',
    }),
  },
  {
    label: 'sports · player name contains "rc" substring (Marcus)',
    card: card('basketball', 8, {
      player_or_character: 'Marcus Smart',
      year: '2014',
      manufacturer: 'Panini',
      set_name: 'Prizm',
      card_number: '256',
      rookie: true,
      team: 'Boston Celtics',
    }),
  },
  {
    label: 'sports · unverified autograph (keeps its number)',
    card: card('football', 9, {
      player_or_character: 'Bo Jackson',
      year: '1987',
      manufacturer: 'Topps',
      set_name: 'Topps',
      card_number: '170',
      team: 'Los Angeles Raiders',
    }, { autograph_type: 'unverified', conversational_condition_label: 'Mint' }),
  },
  {
    label: 'sports · memorabilia set with a blocked word in it',
    card: card('baseball', 8, {
      player_or_character: 'Mike Trout',
      year: '2011',
      manufacturer: 'Topps',
      set_name: 'Topps Update PSA Collection',
      card_number: 'US175',
      rookie: true,
      team: 'Los Angeles Angels',
    }),
  },
  {
    label: 'sports · no set name at all',
    card: card('wrestling', 7, { player_or_character: 'The Rock', year: '1999' }),
  },

  // ─── Pokemon ───
  {
    label: 'pokemon · modern ultra rare holo',
    card: card('pokemon', 10, {
      player_or_character: 'Charizard ex',
      set_name: 'Obsidian Flames',
      card_number: '125/197',
      rarity: 'Ultra Rare',
      year: '2023',
      holofoil: 'Holo',
    }),
  },
  {
    label: 'pokemon · reverse holo common',
    card: card('pokemon', 8, {
      player_or_character: 'Pikachu',
      set_name: 'Paldea Evolved',
      card_number: '25/193',
      rarity: 'Common',
      year: '2023',
      finish: 'Reverse Holo',
    }),
  },
  {
    label: 'pokemon · Japanese',
    card: card('pokemon', 9, {
      player_or_character: 'Mew ex',
      set_name: 'Pokemon Card 151',
      card_number: '205/165',
      rarity: 'Special Art Rare',
      year: '2023',
      language: 'Japanese',
    }),
  },
  {
    label: 'pokemon · vintage base set',
    card: card('pokemon', 7, {
      player_or_character: 'Charizard',
      set_name: 'Base Set',
      card_number: '4/102',
      rarity: 'Holo Rare',
      year: '1999',
      holofoil: 'Holo',
    }),
  },
  {
    label: 'pokemon · name already contains the set word',
    card: card('pokemon', 9, {
      player_or_character: 'Pikachu Promo',
      set_name: 'Promo',
      card_number: 'SWSH039',
      year: '2021',
    }),
  },
  {
    label: 'pokemon · very long card name',
    card: card('pokemon', 10, {
      player_or_character: 'Iono\'s Bellibolt ex Special Illustration Rare',
      set_name: 'Journey Together',
      card_number: '183/159',
      rarity: 'Special Illustration Rare',
      year: '2025',
      holofoil: 'Holo',
    }),
  },
  {
    label: 'pokemon · no card number',
    card: card('pokemon', 6, { player_or_character: 'Snorlax', set_name: 'Jungle', year: '1999' }),
  },
  {
    label: 'pokemon · autographed',
    card: card('pokemon', 9, {
      player_or_character: 'Lugia',
      set_name: 'Neo Genesis',
      card_number: '9/111',
      rarity: 'Holo Rare',
      year: '2000',
    }, { autographed: true, autograph_type: 'on-card' }),
  },

  // ─── MTG ───
  {
    label: 'mtg · mythic foil',
    card: card('mtg', 9, {
      card_name: 'Sheoldred, the Apocalypse',
      set_name: 'Dominaria United',
      card_number: '107',
      rarity: 'Mythic',
      year: '2022',
    }, { is_foil: true }),
  },
  {
    label: 'mtg · non-foil rare',
    card: card('mtg', 8, {
      card_name: 'Ragavan, Nimble Pilferer',
      set_name: 'Modern Horizons 2',
      card_number: '138',
      rarity: 'Rare',
      year: '2021',
    }),
  },
  {
    label: 'mtg · reserved-list vintage',
    card: card('mtg', 5, {
      card_name: 'Underground Sea',
      set_name: 'Revised',
      card_number: '286',
      rarity: 'Dual Land',
      year: '1994',
    }),
  },
  {
    label: 'mtg · Japanese alt art',
    card: card('mtg', 10, {
      card_name: 'Ragavan, Nimble Pilferer',
      set_name: 'Modern Horizons 2',
      card_number: '422',
      rarity: 'Mythic',
      year: '2021',
      language: 'Japanese',
    }, { is_foil: true }),
  },
  {
    label: 'mtg · extremely long card name',
    card: card('mtg', 9, {
      card_name: 'Kroxa and Kunoros, Hound of Athreos Emblem of the Underworld',
      set_name: 'March of the Machine Multiverse Legends',
      card_number: '0031',
      rarity: 'Mythic',
      year: '2023',
    }, { is_foil: true }),
  },

  // ─── Lorcana ───
  {
    label: 'lorcana · enchanted',
    card: card('lorcana', 10, {
      player_or_character: 'Elsa - Spirit of Winter',
      set_name: 'Rise of the Floodborn',
      card_number: '221/204',
      rarity: 'Enchanted',
      year: '2023',
    }, { is_enchanted: true }),
  },
  {
    label: 'lorcana · legendary foil',
    card: card('lorcana', 9, {
      player_or_character: 'Mickey Mouse - Brave Little Tailor',
      set_name: 'The First Chapter',
      card_number: '115/204',
      rarity: 'Legendary',
      year: '2023',
    }, { is_foil: true }),
  },
  {
    label: 'lorcana · common, no finish',
    card: card('lorcana', 7, {
      player_or_character: 'Stitch - Rock Star',
      set_name: 'Into the Inklands',
      card_number: '46/204',
      rarity: 'Common',
      year: '2024',
    }),
  },

  // ─── One Piece / Yu-Gi-Oh / Star Wars (generic CCG) ───
  {
    label: 'onepiece · alt art secret rare',
    card: card('onepiece', 10, {
      player_or_character: 'Monkey D. Luffy',
      set_name: 'OP05',
      card_number: 'OP05-119',
      rarity: 'Secret Rare',
      op_variant_type: 'Alt Art Manga',
      year: '2023',
    }),
  },
  {
    label: 'onepiece · Japanese leader',
    card: card('onepiece', 9, {
      player_or_character: 'Roronoa Zoro',
      set_name: 'OP01',
      card_number: 'OP01-001',
      rarity: 'Leader',
      year: '2022',
      language: 'Japanese',
    }),
  },
  {
    label: 'yugioh · 1st edition ultra rare',
    card: card('yugioh', 9, {
      card_name: 'Blue-Eyes White Dragon',
      set_name: 'Legend of Blue Eyes White Dragon',
      card_number: 'LOB-001',
      rarity: 'Ultra Rare',
      year: '2002',
    }),
  },
  {
    label: 'yugioh · Japanese secret rare',
    card: card('yugioh', 10, {
      card_name: 'Dark Magician Girl',
      set_name: 'Magic Ruler',
      card_number: 'MR-62',
      rarity: 'Secret Rare',
      year: '2000',
      language: 'Japanese',
    }),
  },
  {
    label: 'starwars · showcase hyperspace',
    card: card('starwars', 9, {
      player_or_character: 'Darth Vader',
      set_name: 'Spark of Rebellion',
      card_number: 'SOR-010',
      rarity: 'Legendary',
      variety: 'Hyperspace Foil',
      year: '2024',
    }, { is_foil: true }),
  },
  {
    label: 'starwars · showcase, autographed',
    card: card('starwars', 8, {
      player_or_character: 'Luke Skywalker',
      set_name: 'Shadows of the Galaxy',
      card_number: 'SHD-233',
      rarity: 'Showcase',
      year: '2024',
    }, { autographed: true, autograph_type: 'sticker' }),
  },

  // ─── Other / non-sport ───
  {
    label: 'other · non-sport entertainment',
    card: card('other', 8, {
      player_or_character: 'Freddy Krueger',
      set_name: 'Fright Flicks',
      card_number: '12',
      year: '1988',
    }),
  },
  {
    label: 'other · minimal data (name + grade only)',
    card: card('other', 9, { card_name: 'Unknown Card' }),
  },

  // ─── Edge cases ───
  {
    label: 'edge · no grade at all',
    card: card('pokemon', null, {
      player_or_character: 'Eevee',
      set_name: 'Evolving Skies',
      card_number: '64/203',
      year: '2021',
    }, { conversational_condition_label: 'Mint' }),
  },
  {
    label: 'edge · "unknown"/"N/A" junk values everywhere',
    card: card('sports', 7, {
      player_or_character: 'Derek Jeter',
      set_name: 'Unknown',
      card_number: 'N/A',
      parallel: 'none',
      serial_number: 'no',
      team: '--',
      year: '1996',
    }),
  },
  {
    label: 'edge · Authentic-Altered label, but a number on file',
    card: card('pokemon', 4, {
      player_or_character: 'Blastoise',
      set_name: 'Base Set',
      card_number: '2/102',
      year: '1999',
    }, { conversational_condition_label: 'Authentic Altered' }),
  },
  {
    // The ONLY shape that earns "Authentic": no numeric grade at all.
    label: 'edge · unverified autograph AND no grade -> Authentic',
    card: card('pokemon', null, {
      player_or_character: 'Blastoise',
      set_name: 'Base Set',
      card_number: '2/102',
      year: '1999',
    }, { autograph_type: 'unverified', conversational_condition_label: 'Mint' }),
  },
  {
    label: 'edge · enterprise grade label',
    gradeLabel: 'Kings Kards',
    card: card('football', 9, {
      player_or_character: 'Patrick Mahomes',
      year: '2017',
      manufacturer: 'Panini',
      set_name: 'Prizm',
      card_number: '269',
      rookie: true,
      team: 'Kansas City Chiefs',
    }),
  },
  {
    label: 'edge · enterprise label on a long Pokemon card',
    gradeLabel: 'Apex Collectibles',
    card: card('pokemon', 10, {
      player_or_character: 'Umbreon VMAX Alternate Art Secret',
      set_name: 'Evolving Skies',
      card_number: '215/203',
      rarity: 'Secret Rare',
      year: '2021',
      holofoil: 'Holo',
    }),
  },
  {
    label: 'edge · card info that names a rival grader',
    card: card('basketball', 10, {
      player_or_character: 'LeBron James',
      year: '2003',
      manufacturer: 'Upper Deck',
      set_name: 'Topps Chrome',
      subset: 'BGS Gem Collection',
      card_number: '111',
      rookie: true,
      team: 'Cleveland Cavaliers',
    }),
  },
]

/**
 * Fixtures run through buildListingDraft — the whole seed path (label data →
 * resolver → title → description), not just the title builder.
 *
 * The no-grade card is here rather than above because the bug it guards was in
 * the DRAFT: `labelData.grade ?? 0` produced the title "DCM 0" and a
 * description reading "Authentic Poor" over four zero sub-grades. Calling
 * buildEbayTitle directly would have missed all of it.
 */
const DRAFT_FIXTURES: Array<{
  label: string
  card: Record<string, any>
  cardType: string
  /** Substrings the title must end with / the description must not contain. */
  expectTitleEndsWith: string
  forbiddenInDescription: string[]
}> = [
  {
    label: 'draft · altered card, no numeric grade -> Authentic, no zero sub-grades',
    cardType: 'pokemon',
    card: card('pokemon', null, {
      player_or_character: 'Blastoise',
      set_name: 'Base Set',
      card_number: '2/102',
      year: '1999',
    }, {
      autograph_type: 'unverified',
      conversational_condition_label: 'Authentic',
      conversational_final_grade_summary: 'Signature present on the front of the card.',
      serial: 'DCM-2026-000404',
    }),
    expectTitleEndsWith: 'DCM Authentic',
    // '>0<' is a zero sub-grade cell; the heading only renders when there is
    // at least one cell to head (the HTML comment before it always survives).
    forbiddenInDescription: ['DCM 0', '>0<', 'Sub-Grades</h3>', 'Authentic Poor'],
  },
]

/* ------------------------------------------------------------------ */
/* Marketplace-safe CoA                                                */
/* ------------------------------------------------------------------ */

/**
 * Every string the report element tree would print, without rendering a PDF.
 * The components are plain functions of their props (no hooks, no state), so
 * calling them collects the same text react-pdf would lay out — and does it
 * without fetching the card images a real render needs.
 */
function collectReportText(node: any, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    for (const child of node) collectReportText(child, out)
    return out
  }
  if (typeof node === 'object' && node.props) {
    if (typeof node.type === 'function') return collectReportText(node.type(node.props), out)
    return collectReportText(node.props.children, out)
  }
  return out
}

function reportFixture(): ReportCardData {
  const sub = (score: number, summary: string) => ({
    score,
    summary,
    frontScore: score,
    backScore: score,
    frontSummary: summary,
    backSummary: summary,
  })
  return {
    primaryName: 'Charizard',
    contextLine: 'Base Set • #4/102 • 1999',
    featuresLine: 'Holo',
    serial: 'DCM-2026-000404',
    grade: 9,
    gradeFormatted: '9',
    condition: 'Mint',
    cardName: 'Charizard',
    playerName: '',
    setName: 'Base Set',
    year: '1999',
    manufacturer: 'Wizards of the Coast',
    cardNumber: '4/102',
    sport: 'pokemon',
    frontImageUrl: '',
    backImageUrl: '',
    conditionLabel: 'Mint',
    labelCondition: 'Mint',
    gradeRange: '9.0 ± 0.5',
    professionalGrades: { psa: 9, bgs: '8.5', sgc: 9, cgc: 9 },
    subgrades: {
      centering: sub(9, 'Slight left shift on the front.'),
      corners: sub(9, 'Sharp corners.'),
      edges: sub(9, 'Clean edges.'),
      surface: sub(9, 'Light print speckle.'),
    },
    aiConfidence: 'A',
    imageQuality: 'Excellent',
    generatedDate: 'September 3, 2026',
    reportId: 'ABCD1234',
    overallSummary: 'A strong copy with no notable flaws.',
  }
}

/**
 * The CoA is uploaded to eBay as a regulatory document, and an eBay listing
 * must not name another grading company ANYWHERE — the same rule the title and
 * description builders enforce. `marketplaceSafe` is what keeps that PDF
 * clean, so it is asserted here rather than trusted.
 */
function runMarketplaceCoaCheck(): number {
  console.log('\nmarketplace-safe grading report (CoA uploaded to eBay)\n')
  const cardData = reportFixture()
  let failures = 0

  const safeText = collectReportText(CardGradingReport({ cardData, marketplaceSafe: true }) as any).join(' ')
  const blocked = findBlockedGrader(safeText)
  if (blocked) {
    console.log(`FAIL  marketplaceSafe report names a rival grader: "${blocked}"`)
    failures++
  } else {
    console.log('ok    marketplaceSafe report names no rival grader')
  }

  // The in-app / emailed CoA keeps the equivalency grid — if this stops being
  // true the prop has leaked into the consumer report.
  const fullText = collectReportText(CardGradingReport({ cardData }) as any).join(' ')
  if (!fullText.includes('Estimated Professional Grading Equivalency')) {
    console.log('FAIL  default report lost the professional grading equivalency section')
    failures++
  } else {
    console.log('ok    default report still carries the equivalency section')
  }

  return failures
}

function runDraftFixtures(): number {
  let failures = 0
  console.log('\nbuildListingDraft fixtures\n')
  for (const fixture of DRAFT_FIXTURES) {
    const draft = buildListingDraft(fixture.card, { cardType: fixture.cardType })
    const problems: string[] = []
    if (draft.title.length > MAX) problems.push(`${draft.title.length} chars (max ${MAX})`)
    if (!draft.title.endsWith(fixture.expectTitleEndsWith)) {
      problems.push(`title should end with "${fixture.expectTitleEndsWith}"`)
    }
    for (const forbidden of fixture.forbiddenInDescription) {
      if (draft.descriptionHtml.includes(forbidden)) {
        problems.push(`description contains "${forbidden}"`)
      }
    }
    const status = problems.length ? 'FAIL' : 'ok  '
    console.log(`${status}  ${fixture.label}\n        [${draft.title.length}] ${draft.title}`)
    for (const p of problems) console.log(`      ↳ ${p}`)
    if (problems.length) failures++
  }
  return failures
}

function main() {
  let failures = 0
  const width = Math.max(...FIXTURES.map(f => f.label.length))

  for (const fixture of FIXTURES) {
    const f = resolveListingFields(fixture.card)
    const title = buildEbayTitle({
      name: f.name,
      setName: f.setName,
      subset: f.subset,
      cardNumber: f.cardNumber ? `#${f.cardNumber}` : '',
      year: f.year,
      serialNumbering: f.serialDenominator,
      grade: f.grade ?? '',
      condition: f.conditionLabel,
      category: f.category,
      gradeLabel: fixture.gradeLabel,
      manufacturer: f.manufacturer,
      parallel: f.parallel,
      rarity: f.rarity,
      finish: f.finish,
      rookie: f.rookie,
      autograph: f.autograph,
      team: f.team,
      sport: f.sport,
      gameWord: f.gameWord,
      language: f.language,
    })

    const problems: string[] = []
    if (title.length > MAX) problems.push(`${title.length} chars (max ${MAX})`)
    const blocked = findBlockedGrader(title)
    if (blocked) problems.push(`names a rival grader: "${blocked}"`)
    if (!f.name) problems.push('fixture has no resolvable name')

    const status = problems.length ? 'FAIL' : 'ok  '
    console.log(`${status}  ${fixture.label.padEnd(width)}  [${String(title.length).padStart(2)}]  ${title}`)
    for (const p of problems) console.log(`      ↳ ${p}`)
    if (problems.length) failures++
  }

  failures += runDraftFixtures()
  failures += runMarketplaceCoaCheck()

  console.log('')
  if (failures > 0) {
    console.log(`${failures} of ${FIXTURES.length + DRAFT_FIXTURES.length} fixtures failed.`)
    process.exit(1)
  }
  console.log(
    `All ${FIXTURES.length} fixture titles are within ${MAX} chars and name no rival grader, ` +
      `and all ${DRAFT_FIXTURES.length} draft fixture(s) pass.`
  )
}

main()
