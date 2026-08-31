/**
 * Sourced competitor facts for the AEO content pages.
 *
 * Single source of truth for /card-grading-companies, /fastest-card-grading,
 * /cheapest-card-grading and /psa-alternative so the four pages can never drift
 * from each other. Every figure here is a PUBLISHED number from the grading
 * company or a dated third-party roundup, and every row carries the source it
 * came from. It mirrors the sourced table in the blog post
 * `psa-vs-bgs-vs-sgc-vs-cgc-turnaround-cost-2026`.
 *
 * RULES FOR EDITING THIS FILE
 *  - Never add a number without a source in SOURCES and a `sourceId` on the row.
 *  - Never add a claim about how a third party would grade a card.
 *  - Re-date LAST_CHECKED when any figure moves.
 */

export const LAST_CHECKED = 'August 24, 2026';
export const UPDATED_LABEL = 'Updated August 2026';
/** ISO date used for `dateModified` in JSON-LD. */
export const UPDATED_ISO = '2026-08-24';

export interface Source {
  id: string;
  label: string;
  url: string;
}

export const SOURCES: Record<string, Source> = {
  pregradeRoundup: {
    id: 'pregradeRoundup',
    label: 'PreGradeCards, "CGC vs PSA vs BGS vs SGC vs TAG", August 15, 2026',
    url: 'https://pregradecards.com/blog/cgc-vs-psa-vs-bgs-vs-sgc-vs-tag-best-grader-2026',
  },
  pregradeBeckett: {
    id: 'pregradeBeckett',
    label: 'PreGradeCards, "Beckett pauses grading", August 2026',
    url: 'https://pregradecards.com/blog/beckett-pauses-grading-august-2026-budget-tiers-closed',
  },
  dkPsaTurnaround: {
    id: 'dkPsaTurnaround',
    label: 'DraftKings Network, PSA turnaround breakdown, May 14, 2026',
    url: 'https://dknetwork.draftkings.com/2026/05/14/psa-turnaround-times-2026/',
  },
  psaUpdates: {
    id: 'psaUpdates',
    label: 'PSA submission updates',
    url: 'https://www.psacard.com/info/submission-updates',
  },
  cardgradeBgs: {
    id: 'cardgradeBgs',
    label: 'CardGrade.io, BGS cost breakdown',
    url: 'https://cardgrade.io/blog/bgs-grading-cost-breakdown',
  },
  psaPricing: {
    id: 'psaPricing',
    label: 'PSA trading card grading services and pricing',
    url: 'https://www.psacard.com/services/tradingcardgrading',
  },
  tagSite: {
    id: 'tagSite',
    label: 'TAG Grading, published services',
    url: 'https://taggrading.com/',
  },
};

export interface CompanyRow {
  /** Display name. */
  name: string;
  /** Short factual descriptor. */
  method: string;
  /** Human graders or computer vision. */
  methodShort: 'Human graders' | 'Human graders, machine-assisted' | 'Computer-vision AI';
  /** What you get back. */
  format: string;
  /** Cheapest tier that was open in August 2026, or a note. */
  cheapestTier: string;
  /** Published price per card for that tier. */
  price: string;
  /** Numeric price used only for sorting the cheapest table. Null when unpublished. */
  priceSort: number | null;
  /** Published turnaround for that tier. */
  turnaround: string;
  /** Numeric turnaround in business days, low end, for sorting. Null when unpublished. */
  turnaroundSort: number | null;
  minimum: string;
  notes: string;
  sourceIds: string[];
  isDcm?: boolean;
}

/**
 * Business days throughout, shipping excluded. Published turnarounds are
 * estimates the companies made before the current queues formed, so they read
 * as a floor rather than a promise.
 */
export const COMPANIES: CompanyRow[] = [
  {
    name: 'PSA',
    method: 'Human graders. Multiple graders on higher service levels.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Regular (Value tiers paused)',
    price: '$79.99',
    priceSort: 79.99,
    turnaround: '40 to 50 business days',
    turnaroundSort: 40,
    minimum: 'None on Regular',
    notes:
      'Value services from $24.99 to $64.99 were listed as paused in August 2026, with a reported backlog above 12 million cards in late July.',
    sourceIds: ['pregradeRoundup', 'dkPsaTurnaround', 'psaUpdates', 'psaPricing'],
  },
  {
    name: 'Beckett (BGS)',
    method: 'Human graders. Subgrades printed on the label at every tier.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Express (Base and Standard paused)',
    price: '$79.95',
    priceSort: 79.95,
    turnaround: '15 business days',
    turnaroundSort: 15,
    minimum: 'None on Express',
    notes:
      'Base ($14.95 to $17.95) and Standard ($34.95) were paused on August 5, 2026 after a reported 102 percent year-over-year rise in submissions, with reopening estimated for mid September.',
    sourceIds: ['pregradeBeckett', 'cardgradeBgs', 'pregradeRoundup'],
  },
  {
    name: 'SGC',
    method: 'Human graders.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Standard',
    price: '$15',
    priceSort: 15,
    turnaround: '40 to 50 business days',
    turnaroundSort: 40,
    minimum: 'None',
    notes: 'No tier pauses reported in August 2026. The cheapest published base price among the mail-in majors.',
    sourceIds: ['pregradeRoundup'],
  },
  {
    name: 'CGC',
    method: 'Human graders. Subgrades shown on some services.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Bulk',
    price: 'about $15',
    priceSort: 15,
    turnaround: '100 or more business days',
    turnaroundSort: 100,
    minimum: '25 cards',
    notes: 'The bulk rate requires a 25-card submission, so the entry cost is the bulk minimum rather than one card.',
    sourceIds: ['pregradeRoundup'],
  },
  {
    name: 'TAG',
    method: 'Mail-in grading with machine-assisted optical analysis and a per-card digital report.',
    methodShort: 'Human graders, machine-assisted',
    format: 'Mail-in. Sealed physical slab plus a digital report.',
    cheapestTier: 'See published tiers',
    price: 'Published on TAG’s site',
    priceSort: null,
    turnaround: 'Published on TAG’s site',
    turnaroundSort: null,
    minimum: 'Varies by tier',
    notes:
      'We do not restate TAG pricing or turnaround here because we do not have a dated published figure we can source. Check TAG directly for current numbers.',
    sourceIds: ['tagSite', 'pregradeRoundup'],
  },
  {
    name: 'DCM Grading',
    method:
      'DCM Optic runs three independent evaluation passes per card and takes the median as the grade. Rubric published at /grading-standard.',
    methodShort: 'Computer-vision AI',
    format: 'No mail-in. Digital grade and report, plus a printable label you apply to a holder you already own.',
    cheapestTier: 'Single credit (packs go lower)',
    price: '$2.99',
    priceSort: 2.99,
    turnaround: 'About 60 seconds',
    turnaroundSort: 0,
    minimum: 'None. Two free grades to start.',
    notes:
      'Packs bring the per-grade cost down: 5 for $9.99, 20 for $19.99, 150 for $99. A DCM grade is not a slab from one of the companies above and is not registry-eligible.',
    sourceIds: [],
    isDcm: true,
  },
];

/** The mail-in majors, i.e. everything except DCM. */
export const MAIL_IN_COMPANIES = COMPANIES.filter((c) => !c.isDcm);
export const DCM_ROW = COMPANIES.find((c) => c.isDcm)!;

/** DCM credit packs — mirrors src/lib/creditPackages.ts. */
export const DCM_PACKS = [
  { name: 'Basic', price: 2.99, credits: 1, per: '$2.99' },
  { name: 'Pro', price: 9.99, credits: 5, per: '$2.00' },
  { name: 'Elite', price: 19.99, credits: 20, per: '$1.00' },
  { name: 'VIP', price: 99, credits: 150, per: '$0.66' },
] as const;

/** Card Lovers memberships. */
export const CARD_LOVERS = [
  { name: 'Card Lovers Monthly', price: 49.99, credits: 70, per: '$0.71', billing: 'month' },
  { name: 'Card Lovers Annual', price: 449, credits: 900, per: '$0.50', billing: 'year' },
] as const;

/** The honest-middle line. Used verbatim across the AEO pages. */
export const HONEST_MIDDLE =
  'Most of your collection ends here. The top slice still goes out — we’ll tell you which.';

export function sourcesFor(row: CompanyRow): Source[] {
  return row.sourceIds.map((id) => SOURCES[id]).filter(Boolean);
}
