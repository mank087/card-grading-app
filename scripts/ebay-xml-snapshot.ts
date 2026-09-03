/**
 * eBay Trading API XML shape check — the one rule business policies impose.
 *
 *   npx tsx scripts/ebay-xml-snapshot.ts      (npm run check:ebay-xml)
 *
 * A listing tells eBay its shipping and return terms EITHER inline
 * (<ShippingDetails>, <ReturnPolicy>, <DispatchTimeMax>, <PaymentMethods>) OR
 * by reference (<SellerProfiles>). Sending both is rejected, and the failure
 * arrives as a Trading API error mid-batch rather than at review time — which
 * is exactly the kind of thing a snapshot test is cheaper than.
 *
 * So: two builds of the same item, one each way, and the assertion in both
 * directions. No network, no database, no eBay call.
 */

import {
  buildAddFixedPriceItemXml,
  buildAddItemXml,
  DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  type ListingDetails,
  type ShippingDetails,
  type ReturnDetails,
} from '../src/lib/ebay/tradingApi';

/** Tags that may only appear when the item carries its terms INLINE. */
const INLINE_ONLY = ['<ShippingDetails>', '<ReturnPolicy>', '<DispatchTimeMax>', '<PaymentMethods>'];
/** Tags that may only appear when the item references business policies. */
const POLICY_ONLY = [
  '<SellerProfiles>',
  '<ShippingProfileID>',
  '<ReturnProfileID>',
  '<PaymentProfileID>',
];

const baseListing: ListingDetails = {
  title: 'Charizard ex Obsidian Flames 125/197 Ultra Rare Holo 2023 Pokemon Card DCM 10',
  description: '<div>…generated description…</div>',
  categoryId: '183454',
  price: 249.99,
  quantity: 1,
  conditionId: '2750',
  imageUrls: ['https://example.supabase.co/storage/v1/object/public/x/front.jpg'],
  itemSpecifics: [{ name: 'Graded', value: 'Yes' }],
  sku: 'DCM-TEST-0001',
  listingDuration: 'GTC',
  bestOfferEnabled: true,
  professionalGrader: '2750123',
  grade: '275020',
  certificationNumber: 'DCM-2026-000123',
};

const shipping: ShippingDetails = {
  shippingType: 'CALCULATED',
  domesticShippingService: DEFAULT_DOMESTIC_SHIPPING_SERVICE,
  flatRateCost: 5,
  handlingDays: 1,
  postalCode: '33101',
  packageDimensions: { weightOz: 4, lengthIn: 10, widthIn: 6, depthIn: 1 },
  offerInternational: true,
  internationalShippingType: 'FLAT_RATE',
  internationalShippingService: 'USPSPriorityMailInternational',
  internationalFlatRateCost: 24,
  internationalShipToLocations: ['Worldwide'],
};

const returns: ReturnDetails = {
  domesticReturnsAccepted: true,
  domesticReturnPeriodDays: 30,
  domesticReturnShippingPaidBy: 'BUYER',
  internationalReturnsAccepted: false,
};

const POLICIES = {
  shippingPolicyId: '600001234567',
  returnPolicyId: '600007654321',
  paymentPolicyId: '600001111111',
};

interface Failure {
  label: string;
  message: string;
}
const failures: Failure[] = [];

function expectAbsent(label: string, xml: string, tags: string[]): void {
  for (const tag of tags) {
    if (xml.includes(tag)) failures.push({ label, message: `${tag} must NOT be present` });
  }
}

function expectPresent(label: string, xml: string, tags: string[]): void {
  for (const tag of tags) {
    if (!xml.includes(tag)) failures.push({ label, message: `${tag} is missing` });
  }
}

function check(label: string, xml: string, mode: 'inline' | 'policies'): void {
  if (mode === 'policies') {
    expectPresent(label, xml, POLICY_ONLY);
    expectAbsent(label, xml, INLINE_ONLY);
    // The parcel's own dimensions are NOT a shipping term and stay — a
    // calculated shipping policy cannot quote a rate without them.
    expectPresent(label, xml, ['<ShippingPackageDetails>']);
    // Item location is likewise a property of the item, not the policy.
    expectPresent(label, xml, ['<PostalCode>']);
    // And the ids the seller actually chose have to reach eBay.
    expectPresent(label, xml, [
      `<ShippingProfileID>${POLICIES.shippingPolicyId}</ShippingProfileID>`,
      `<ReturnProfileID>${POLICIES.returnPolicyId}</ReturnProfileID>`,
      `<PaymentProfileID>${POLICIES.paymentPolicyId}</PaymentProfileID>`,
    ]);
  } else {
    expectPresent(label, xml, INLINE_ONLY);
    expectAbsent(label, xml, POLICY_ONLY);
    // Item.ShipToLocations is a repeatable *string* in eBay's schema. Nesting
    // <ShipToLocation> children inside one <ShipToLocations> element made
    // every international listing fail with the opaque "SimpleDeserializer
    // encountered a child element" error (found Sept 3, 2026).
    expectPresent(label, xml, ['<ShipToLocations>Worldwide</ShipToLocations>']);
    expectAbsent(label, xml, ['<ShipToLocations><ShipToLocation>', '<ShipToLocations>\n']);
  }
  const status = failures.some(f => f.label === label) ? 'FAIL' : 'ok';
  console.log(`  ${status.padEnd(4)} ${label} (${xml.length} bytes)`);
}

function main(): void {
  console.log('eBay Trading API XML shape check — inline terms vs SellerProfiles\n');

  check(
    'AddFixedPriceItem · inline shipping/returns',
    buildAddFixedPriceItemXml(baseListing, shipping, returns),
    'inline'
  );
  check(
    'AddFixedPriceItem · business policies',
    buildAddFixedPriceItemXml({ ...baseListing, policies: POLICIES }, shipping, returns),
    'policies'
  );
  check(
    'AddItem (auction) · inline shipping/returns',
    buildAddItemXml(baseListing, shipping, returns),
    'inline'
  );
  check(
    'AddItem (auction) · business policies',
    buildAddItemXml({ ...baseListing, policies: POLICIES }, shipping, returns),
    'policies'
  );

  if (failures.length > 0) {
    console.error(`\n${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
    for (const f of failures) console.error(`  - ${f.label}: ${f.message}`);
    process.exit(1);
  }
  console.log('\nAll good: neither shape leaks into the other.');
}

main();
