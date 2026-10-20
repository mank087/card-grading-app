/**
 * Sold-results proof for the /why-dcm strip (SoldProofStrip).
 *
 * Source: InstaList eBay sales Jul 1 - Oct 20 2026, compared with the same
 * card's ungraded eBay sales within 180 days of each sale (PriceCharting /
 * SportsCardsPro product page, 10% trimmed mean, at least 3 raw sales, card
 * number and printing confirmed). Look-back work: scripts/_sold-report/lookback/.
 * Slab images: npx tsx scripts/why-dcm-sold-slabs.ts
 *
 * The page shows no dates so it stays evergreen; refresh these numbers when
 * new sales come in. "On average" = total DCM sale prices vs the total raw
 * average of the same cards (dollar-weighted), not a mean of percentages,
 * which a few $2 cards selling for $25 would inflate. Keep every claim
 * scoped to a grade or category: lower grades often sell below raw.
 */
export interface SoldProofExample {
  cardId: string
  serial: string
  category: 'pokemon' | 'mtg' | 'sports' | 'other'
  name: string
  setLine: string
  grade: number
  sold: number
  rawAvg: number
  rawSales: number
  format: 'Fixed price' | 'Auction'
}

export interface SoldProofStat {
  /** Average premium over raw, e.g. 1.04 = +104%. */
  premium: number
  claim: string
}

export const SOLD_PROOF = {
  stats: [
    { premium: 1.04, claim: 'DCM 10s sold for about double the raw price on average' }, // 27 sales, 24 above raw
    { premium: 0.88, claim: 'Sports cards graded DCM 8 or higher sold above raw on average' }, // 39 sales, 37 above raw
    { premium: 0.31, claim: 'DCM 9s and 10s sold above raw on average' }, // 70 sales, 52 above raw
  ] satisfies SoldProofStat[],
  examples: [
    { cardId: '51770d77-e480-456d-8299-b4aece482278', serial: '411728', category: 'pokemon', name: 'Dark Espeon', setLine: '2002 Neo Destiny Holo #4', grade: 8, sold: 415, rawAvg: 256.49, rawSales: 22, format: 'Fixed price' },
    { cardId: 'ee767c76-6c09-4836-ab9f-fe379128a38d', serial: '325047', category: 'other', name: 'Spider-Man vs. Venom', setLine: '1993 Marvel Universe IV Hologram #H-IV', grade: 9, sold: 299, rawAvg: 180.23, rawSales: 21, format: 'Fixed price' },
    { cardId: '0072f914-8cf4-475e-8834-bb963db4bbf9', serial: '318806', category: 'mtg', name: 'Earthcraft', setLine: '1997 Tempest', grade: 10, sold: 265, rawAvg: 207.12, rawSales: 24, format: 'Auction' },
    { cardId: '45019fa3-e2dd-448f-8b90-a3fbc6f136a9', serial: '495385', category: 'sports', name: 'Kobe Bryant', setLine: '1998 Fleer Tradition #1', grade: 9, sold: 70, rawAvg: 33.77, rawSales: 24, format: 'Fixed price' },
    { cardId: '0ec5df28-00ef-4576-9a83-3c6c5faad1df', serial: '385689', category: 'sports', name: 'John Elway', setLine: '1984 Topps #63', grade: 8, sold: 80, rawAvg: 48.55, rawSales: 26, format: 'Fixed price' },
    { cardId: 'b66c00d8-d1e3-47d2-bc1b-b8d4c2f1a64e', serial: '944921', category: 'sports', name: 'Michael Jordan', setLine: '1992 SkyBox USA #USA11', grade: 10, sold: 108.5, rawAvg: 13.13, rawSales: 30, format: 'Fixed price' },
  ] satisfies SoldProofExample[],
}
