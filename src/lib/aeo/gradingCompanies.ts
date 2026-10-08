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
 *  - Re-date LAST_CHECKED when any figure moves, and set `checked` on every row
 *    you re-verify. Rows that could not be re-verified keep their old date.
 */

export const LAST_CHECKED = 'October 8, 2026';
export const UPDATED_LABEL = 'Updated October 2026';
/** ISO date used for `dateModified` in JSON-LD. */
export const UPDATED_ISO = '2026-10-08';

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
  psaUpdates: {
    id: 'psaUpdates',
    label: 'PSA submission updates',
    url: 'https://www.psacard.com/info/submission-updates',
  },
  beckettMaintenance: {
    id: 'beckettMaintenance',
    label: 'Beckett grading status notice',
    url: 'https://maintenance.beckett.com/',
  },
  beckettSubmissionForm: {
    id: 'beckettSubmissionForm',
    label: 'Beckett card grading submission form (temporary)',
    url: 'https://beckett.jotform.com/form/beckett-card-grading-submission',
  },
  psaPricing: {
    id: 'psaPricing',
    label: 'PSA trading card grading services and pricing',
    url: 'https://www.psacard.com/services/tradingcardgrading',
  },
  sgcPricing: {
    id: 'sgcPricing',
    label: 'SGC card grading services and pricing',
    url: 'https://gosgc.com/card-grading/services-pricing',
  },
  cgcPricing: {
    id: 'cgcPricing',
    label: 'CGC Cards grading services and fees',
    url: 'https://www.cgccards.com/submit/services-fees/cgc-grading/',
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
  /** Cheapest open tier as of the row's `checked` date, or a note. */
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
  /** Date this row's figures were last verified against its sources. */
  checked: string;
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
    cheapestTier: 'Standard (Value services paused)',
    price: '$59.99',
    priceSort: 59.99,
    turnaround: '90 to 100 business days',
    turnaroundSort: 90,
    minimum: 'None listed',
    notes:
      'PSA lists Value services as temporarily paused. Standard covers cards up to $1,000 insured value. Priority is $79.99 (up to $1,500, 70 to 80 business days), Express $199 (up to $2,500, 20 to 30 business days), Super Express $349 (up to $5,000, 10 to 15 business days) and Premier $599 (up to $10,000, 7 to 10 business days). PSA reported a backlog above 12 million cards in late July 2026.',
    sourceIds: ['psaPricing', 'psaUpdates'],
    checked: 'October 8, 2026',
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
      'Base and Standard are temporarily paused, with a waitlist open. Beckett first paused them on August 5, 2026 after a reported 102 percent year-over-year rise in submissions. While Beckett.com is offline, submissions go through a temporary Beckett submission form.',
    sourceIds: ['beckettMaintenance', 'beckettSubmissionForm', 'pregradeBeckett'],
    checked: 'October 8, 2026',
  },
  {
    name: 'SGC',
    method: 'Human graders.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Standard',
    price: '$50',
    priceSort: 50,
    turnaround: '40 or more business days',
    turnaroundSort: 40,
    minimum: 'None listed',
    notes:
      'Standard covers cards up to $1,500 declared value. Expedited (2 to 3 business days) runs from $150 (up to $3,500 value) to $3,750 for cards valued at $100,000 or more.',
    sourceIds: ['sgcPricing'],
    checked: 'October 8, 2026',
  },
  {
    name: 'CGC',
    method: 'Human graders. Subgrades shown on some services.',
    methodShort: 'Human graders',
    format: 'Mail-in. Sealed physical slab with a serialized cert.',
    cheapestTier: 'Economy',
    price: '$20',
    priceSort: 20,
    turnaround: '90 business days',
    turnaroundSort: 90,
    minimum: 'None',
    notes:
      'Economy covers cards up to $1,000 value. Bulk is $17 per card but requires a 25-card submission, with about 150 working days and a $500 maximum value. Standard is $55 (10 days), Express $100 (5 days) and WalkThrough $300 (2 days). CGC lists turnarounds as estimates, not guarantees.',
    sourceIds: ['cgcPricing'],
    checked: 'October 8, 2026',
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
    checked: 'August 24, 2026',
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
    checked: 'October 8, 2026',
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
