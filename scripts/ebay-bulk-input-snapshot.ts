/**
 * Print the exact eBay payload the bulk drain would build for three fixture
 * rows. No network, no database, no eBay call.
 *
 *   npx tsx scripts/ebay-bulk-input-snapshot.ts
 *
 * Why this exists: the drain's mapping from a reviewed `ebay_bulk_items` row
 * to `publishCardListing`'s input is the one place a bulk listing can quietly
 * differ from a hand-made one — a dropped shipping field, a stale grade, an
 * item specific carrying our own `required` flag into eBay's NameValueList.
 * Reading it out of the drain's control flow is hard; reading it here is not.
 *
 * The three fixtures cover the cases that have historically diverged:
 *   1. a graded Pokemon card, calculated shipping, Best Offer on
 *   2. a sports card with an enterprise grade label and flat-rate + returns
 *   3. a row whose specifics are half-empty and whose aspects carry metadata
 *   4. a batch running on the seller's eBay business policies
 *   5. a card with no numeric grade, seeded through buildListingDraft
 *   6. an AUCTION batch — format, duration, quantity 1 and no Best Offer
 */

import {
  buildPublishInputFromBulkItem,
  bulkSku,
  type BulkPublishBatch,
  type BulkPublishItem,
} from '../src/lib/ebay/bulkPublish';
import { DEFAULT_BULK_SETTINGS, type BulkBatchSettings } from '../src/lib/ebay/bulkSettings';
import { buildListingDraft } from '../src/lib/ebay/listingDraft';

/** Frozen so the printed SKUs are stable across runs. */
const NOW = Date.parse('2026-09-02T12:00:00.000Z');

const BATCH_ID = '11111111-2222-3333-4444-555555555555';
const USER_ID = '99999999-8888-7777-6666-555555555555';

function settings(overrides: Partial<BulkBatchSettings> = {}): BulkBatchSettings {
  return {
    ...DEFAULT_BULK_SETTINGS,
    ...overrides,
    shipping: { ...DEFAULT_BULK_SETTINGS.shipping, postalCode: '33101', ...(overrides.shipping ?? {}) },
  };
}

interface Fixture {
  label: string;
  item: BulkPublishItem;
  batch: BulkPublishBatch;
  card: any;
}

const fixtures: Fixture[] = [
  {
    label: '1. Pokemon · calculated shipping · Best Offer on',
    batch: { id: BATCH_ID, user_id: USER_ID, settings: settings() },
    card: {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      user_id: USER_ID,
      card_name: 'Charizard ex',
      category: 'Pokemon',
      card_set: 'Obsidian Flames',
      card_number: '125/197',
      serial: 'DCM-2026-000123',
      conversational_whole_grade: 10,
      conversational_condition_label: 'Gem Mint',
      holofoil: true,
      release_date: '2023-08-11',
    },
    item: {
      id: 'bbbbbbbb-0000-0000-0000-000000000001',
      card_id: 'aaaaaaaa-0000-0000-0000-000000000001',
      title: 'Charizard ex Obsidian Flames 125/197 Ultra Rare Holo 2023 Pokemon Card DCM 10',
      price: 249.99,
      description_html: '<div>…generated description…</div>',
      item_specifics: [
        { name: 'Graded', value: 'Yes', required: true, editable: false },
        { name: 'Grade', value: '10', required: true, editable: false },
        { name: 'Professional Grader', value: 'Other', required: true, editable: false },
        { name: 'Certification Number', value: 'DCM-2026-000123', required: true, editable: false },
        { name: 'Card Name', value: 'Charizard ex', required: false, editable: true },
        { name: 'Finish', value: 'Holo', required: false, editable: true },
      ],
      image_urls: [
        'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c/front.jpg',
        'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c/back.jpg',
      ],
    },
  },
  {
    label: '2. Sports · enterprise grade label · flat rate + returns + international',
    batch: {
      id: BATCH_ID,
      user_id: USER_ID,
      settings: settings({
        bestOfferEnabled: false,
        gradeLabel: 'Kings Kards',
        shipping: {
          ...DEFAULT_BULK_SETTINGS.shipping,
          shippingType: 'FLAT_RATE',
          flatRateAmount: 6.5,
          handlingDays: 2,
          postalCode: '10001',
          offerInternational: true,
          internationalShippingType: 'FLAT_RATE',
          internationalFlatRateCost: 24,
          domesticReturnsAccepted: true,
          domesticReturnPeriodDays: 30,
          domesticReturnShippingPaidBy: 'BUYER',
        },
      }),
    },
    card: {
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      user_id: USER_ID,
      card_name: 'C.J. Stroud',
      category: 'Sports',
      sub_category: 'Football',
      card_set: 'Panini Prizm',
      card_number: '341',
      serial: 'KK-2026-000045',
      org_id: 'cccccccc-0000-0000-0000-000000000001',
      org_serial_display: 'KK-2026-000045',
      conversational_whole_grade: 9,
      rookie_card: true,
      release_date: '2023-01-01',
    },
    item: {
      id: 'bbbbbbbb-0000-0000-0000-000000000002',
      card_id: 'aaaaaaaa-0000-0000-0000-000000000002',
      title: '2023 Panini Prizm Football C.J. Stroud #341 Silver RC Rookie Kings Kards 9',
      price: 175,
      description_html: '<div>…store-branded description…</div>',
      item_specifics: [
        { name: 'Graded', value: 'Yes', required: true },
        { name: 'Grade', value: '9', required: true },
        { name: 'Professional Grader', value: 'Other', required: true },
        { name: 'Sport', value: 'Football', required: true },
        { name: 'Season', value: '2023', required: false },
      ],
      image_urls: [
        'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c2/front.jpg',
      ],
    },
  },
  {
    label: '3. Half-filled specifics — empty aspects must be DROPPED, not sent blank',
    batch: { id: BATCH_ID, user_id: USER_ID, settings: settings() },
    card: {
      id: 'aaaaaaaa-0000-0000-0000-000000000003',
      user_id: USER_ID,
      card_name: 'Monkey D. Luffy',
      category: 'One Piece',
      card_set: 'OP05',
      card_number: 'OP05-119',
      serial: 'DCM-2026-000777',
      conversational_whole_grade: 8,
    },
    item: {
      id: 'bbbbbbbb-0000-0000-0000-000000000003',
      card_id: 'aaaaaaaa-0000-0000-0000-000000000003',
      title: 'Monkey D. Luffy OP05-119 Alt Art Manga Rare SEC One Piece Card Game DCM 8',
      price: 89.95,
      description_html: '<div>…generated description…</div>',
      item_specifics: [
        { name: 'Graded', value: 'Yes', required: true },
        { name: 'Grade', value: '8', required: true },
        { name: 'Parallel/Variety', value: '', required: false },
        { name: 'Features', value: [], required: false },
        { name: 'Language', value: ['Japanese', ''], required: false },
        { name: '', value: 'orphaned', required: false },
        // Placeholders. eBay files these as real answers, which drops the card
        // out of the buyer's filter for that aspect just as a blank would —
        // all four must be gone from the payload below.
        { name: 'Autograph Authentication', value: 'N/A', required: false },
        { name: 'Team', value: 'Unknown', required: false },
        { name: 'Insert Set', value: 'None', required: false },
        { name: 'Grader Notes', value: ['n/a', 'None'], required: false },
      ],
      image_urls: [
        'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c3/front.jpg',
      ],
    },
  },
  {
    // The Phase 3 shape. `policies` must be present and the inline shipping
    // fields must ALSO still be there: publishCardListing decides which side
    // applies from the seller's stored opt-in, so the drain sends both and
    // never has to guess which one eBay will accept. The XML-level exclusion
    // is proved separately in scripts/ebay-xml-snapshot.ts.
    label: '4. Business policies · the three ids replace the inline terms at XML time',
    batch: {
      id: BATCH_ID,
      user_id: USER_ID,
      settings: settings({
        policies: {
          useBusinessPolicies: true,
          shippingPolicyId: '600001234567',
          returnPolicyId: '600007654321',
          paymentPolicyId: '600001111111',
          shippingPolicyName: 'Free Ground Advantage',
          returnPolicyName: '30-day returns',
        },
      }),
    },
    card: {
      id: 'aaaaaaaa-0000-0000-0000-000000000004',
      user_id: USER_ID,
      card_name: 'Blue-Eyes White Dragon',
      category: 'Yu-Gi-Oh',
      card_set: 'Legend of Blue Eyes White Dragon',
      card_number: 'LOB-001',
      serial: 'DCM-2026-000901',
      conversational_whole_grade: 9,
      release_date: '2002-03-08',
    },
    item: {
      id: 'bbbbbbbb-0000-0000-0000-000000000004',
      card_id: 'aaaaaaaa-0000-0000-0000-000000000004',
      title: '2002 Yu-Gi-Oh LOB Blue-Eyes White Dragon LOB-001 Ultra Rare DCM 9',
      price: 320,
      description_html: '<div>…description naming the shipping policy…</div>',
      item_specifics: [
        { name: 'Graded', value: 'Yes', required: true },
        { name: 'Grade', value: '9', required: true },
      ],
      image_urls: [
        'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c4/front.jpg',
      ],
    },
  },
];

/**
 * Fixture 5 is built the way the bulk REVIEW screen builds a row — through
 * buildListingDraft — rather than from a hand-written title/description, so
 * the no-numeric-grade path is exercised end to end.
 *
 * The card is a v9.23 unverified-autograph Altered with no grade on file. It
 * used to seed the title "DCM 0" and a description reading "Authentic Poor"
 * over four zero sub-grades; the title must now end in "DCM Authentic" and the
 * description must carry neither. publishCardListing itself still refuses the
 * listing (no grade), which is why the printed payload's `grade` is null.
 */
const noGradeCard = {
  id: 'aaaaaaaa-0000-0000-0000-000000000005',
  user_id: USER_ID,
  card_name: 'Blastoise',
  category: 'Pokemon',
  card_set: 'Base Set',
  card_number: '2/102',
  serial: 'DCM-2026-000404',
  autograph_type: 'unverified',
  conversational_condition_label: 'Authentic',
  conversational_final_grade_summary: 'Signature present on the front of the card.',
  release_date: '1999-01-09',
  conversational_card_info: {
    player_or_character: 'Blastoise',
    set_name: 'Base Set',
    card_number: '2/102',
    year: '1999',
  },
};

const noGradeDraft = buildListingDraft(noGradeCard, { cardType: 'pokemon' });

fixtures.push({
  label: '5. No numeric grade (Altered / unverified autograph) — seeded by buildListingDraft',
  batch: { id: BATCH_ID, user_id: USER_ID, settings: settings() },
  card: noGradeCard,
  item: {
    id: 'bbbbbbbb-0000-0000-0000-000000000005',
    card_id: noGradeCard.id,
    title: noGradeDraft.title,
    price: 55,
    description_html: noGradeDraft.descriptionHtml,
    item_specifics: noGradeDraft.itemSpecifics,
    image_urls: [
      'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c5/front.jpg',
    ],
  },
});

/**
 * Fixture 6: the batch-wide auction format. A bulk auction has to reach eBay
 * as a 7-day Chinese auction of exactly one item with Best Offer off — eBay
 * rejects Best Offer on an auction, and a quantity above 1 is a fixed-price
 * concept the drain must never carry over.
 */
const auctionBatch: BulkPublishBatch = {
  id: BATCH_ID,
  user_id: USER_ID,
  settings: settings({ listingFormat: 'AUCTION', duration: 'DAYS_7', bestOfferEnabled: false }),
};

const auctionItem: BulkPublishItem = {
  id: 'bbbbbbbb-0000-0000-0000-000000000006',
  card_id: 'aaaaaaaa-0000-0000-0000-000000000006',
  title: '1999 Pokemon Base Set Charizard 4/102 Holo Unlimited DCM 7',
  // On an auction this is the starting bid, not an asking price.
  price: 99,
  description_html: '<div>…generated description…</div>',
  item_specifics: [
    { name: 'Graded', value: 'Yes', required: true },
    { name: 'Grade', value: '7', required: true },
  ],
  image_urls: [
    'https://example.supabase.co/storage/v1/object/public/ebay-listing-images/u/c6/front.jpg',
  ],
};

const auctionCard = {
  id: 'aaaaaaaa-0000-0000-0000-000000000006',
  user_id: USER_ID,
  card_name: 'Charizard',
  category: 'Pokemon',
  card_set: 'Base Set',
  card_number: '4/102',
  serial: 'DCM-2026-000606',
  conversational_whole_grade: 7,
  release_date: '1999-01-09',
};

fixtures.push({
  label: '6. Auction · 7 days · starting price · Best Offer impossible',
  batch: auctionBatch,
  card: auctionCard,
  item: auctionItem,
});

/** Assertions on fixture 6, alongside the printed payload. */
function checkAuctionInput(): number {
  const problems: string[] = [];
  const input = buildPublishInputFromBulkItem(auctionItem, auctionBatch, auctionCard, { now: NOW });
  const expected: Record<string, unknown> = {
    listingFormat: 'AUCTION',
    duration: 'DAYS_7',
    bestOfferEnabled: false,
    quantity: 1,
    price: 99,
  };
  for (const [key, want] of Object.entries(expected)) {
    const got = (input as Record<string, unknown>)[key];
    if (got !== want) problems.push(`${key} should be ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  console.log('='.repeat(78));
  console.log(problems.length ? 'FAIL  auction publish input' : 'ok    auction publish input');
  problems.forEach(p => console.log(`      ${p}`));
  console.log('');
  return problems.length;
}

/** Assertions on fixture 5 — printed with the snapshot, and they fail the run. */
function checkNoGradeDraft(): number {
  const problems: string[] = [];
  if (!noGradeDraft.title.endsWith('DCM Authentic')) {
    problems.push(`title should end with "DCM Authentic": ${noGradeDraft.title}`);
  }
  for (const forbidden of ['DCM 0', '>0<', 'Sub-Grades</h3>', 'Authentic Poor']) {
    if (noGradeDraft.descriptionHtml.includes(forbidden)) {
      problems.push(`description contains "${forbidden}"`);
    }
  }
  console.log('='.repeat(78));
  console.log(problems.length ? 'FAIL  no-grade draft' : 'ok    no-grade draft');
  problems.forEach(p => console.log(`      ${p}`));
  console.log('');
  return problems.length;
}

function main(): void {
  console.log('eBay bulk publish input snapshot — no network, no database\n');
  console.log(`SKU pattern: ${bulkSku(BATCH_ID, 'aaaaaaaa-0000-0000-0000-000000000001', NOW)}\n`);

  for (const fixture of fixtures) {
    console.log('='.repeat(78));
    console.log(fixture.label);
    console.log('='.repeat(78));
    try {
      const input = buildPublishInputFromBulkItem(fixture.item, fixture.batch, fixture.card, {
        now: NOW,
      });
      console.log(JSON.stringify(input, null, 2));
    } catch (err: any) {
      console.log(`REJECTED: ${err?.message ?? err}`);
    }
    console.log('');
  }

  if (checkNoGradeDraft() + checkAuctionInput() > 0) process.exit(1);
}

main();
