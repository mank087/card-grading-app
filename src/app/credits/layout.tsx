import { Metadata } from 'next';
import { pricingTiers, VIP_PACKAGE } from '@/lib/creditPackages';

/**
 * The credits page itself is a client component, so anything an answer engine
 * or a crawler needs to read without running JavaScript has to live here.
 *
 * Two things do:
 *  1. Product/Offer JSON-LD for the four credit packs and both Card Lovers
 *     plans, with real USD prices, so nothing has to be inferred.
 *  2. A short, visible, server-rendered pricing summary above the page.
 *
 * Prices come from @/lib/creditPackages (the same module checkout uses) so a
 * price change flows here automatically. Card Lovers plans are defined on the
 * client page and mirrored below.
 */

/** Card Lovers memberships, mirroring the credits page. */
const CARD_LOVERS = [
  {
    name: 'Card Lovers Monthly',
    price: 49.99,
    credits: 70,
    billing: 'P1M',
    billingLabel: 'month',
    per: '$0.71',
  },
  {
    name: 'Card Lovers Annual',
    price: 449,
    credits: 900,
    billing: 'P1Y',
    billingLabel: 'year',
    per: '$0.50',
  },
] as const;

const PACKS = [
  ...pricingTiers.map((t) => ({
    name: `${t.name} Pack`,
    price: t.price,
    credits: t.credits,
    per: `$${t.perGradeCost.toFixed(2)}`,
  })),
  {
    name: `${VIP_PACKAGE.name} Pack`,
    price: VIP_PACKAGE.price,
    credits: VIP_PACKAGE.credits,
    per: `$${VIP_PACKAGE.perGradeCost.toFixed(2)}`,
  },
];

/** Display formatter: $99 rather than $99.00, $2.99 unchanged. */
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const metadata: Metadata = {
  title: 'Buy Credits - Pricing & Packages',
  description:
    'DCM Grading pricing: as low as $0.66 a card with the VIP package (150 credits for $99), or $2.99 for a single grading credit. Packs in between are 5 for $9.99 ($2.00 a grade) and 20 for $19.99 ($1.00 a grade). Card Lovers is $49.99 a month for 70 grades or $449 a year for 900. Two free credits when you sign up.',
  keywords:
    'card grading pricing, buy grading credits, DCM credits, trading card grading cost, grading packages, cheap card grading, how much does DCM grading cost',
  openGraph: {
    title: 'Buy Credits - DCM Grading Pricing & Packages',
    description:
      'As low as $0.66 a card with the VIP package (150 credits for $99), or $2.99 for a single grading credit. Card Lovers Annual is $449 for 900 grades.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'Buy Credits - DCM Grading Pricing',
    description: 'As low as $0.66 a card with the VIP package. $2.99 for a single credit. Two free credits to start.',
  },
  alternates: {
    canonical: 'https://dcmgrading.com/credits',
  },
};

/**
 * OfferCatalog carrying every purchasable option with its real USD price, so
 * the per-grade cost never has to be guessed at from prose.
 */
const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OfferCatalog',
  name: 'DCM Grading credit packs and memberships',
  url: 'https://dcmgrading.com/credits',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: 'https://dcmgrading.com/DCM-logo.png',
  },
  itemListElement: [
    ...PACKS.map((p, i) => ({
      '@type': 'Offer',
      position: i + 1,
      name: p.name,
      price: p.price.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://dcmgrading.com/credits',
      description: `${p.credits} grading credit${p.credits === 1 ? '' : 's'} for ${money(p.price)}, ${p.per} per graded card.`,
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        value: p.credits,
        unitText: 'grading credits',
      },
      itemOffered: {
        '@type': 'Product',
        name: `DCM Grading ${p.name}`,
        description: `${p.credits} card grades from DCM Optic. Each grade includes four subgrades, a written reason for every deduction, an image confidence letter and a printable label.`,
        brand: { '@type': 'Brand', name: 'DCM Grading' },
      },
    })),
    ...CARD_LOVERS.map((m, i) => ({
      '@type': 'Offer',
      position: PACKS.length + i + 1,
      name: m.name,
      price: m.price.toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://dcmgrading.com/credits',
      description: `${m.name}: ${money(m.price)} per ${m.billingLabel} for ${m.credits} grades, ${m.per} per graded card.`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: m.price.toFixed(2),
        priceCurrency: 'USD',
        billingDuration: m.billing,
      },
      itemOffered: {
        '@type': 'Service',
        name: `DCM ${m.name}`,
        serviceType: 'Trading card grading membership',
        provider: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
      },
    })),
  ],
};

export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      {children}

      {/* Server-rendered pricing summary. The interactive pricing above is a
          client component whose body does not render until it hydrates — a
          crawler or answer engine fetching this page with no JavaScript sees
          none of it. This plain-HTML strip is therefore the only machine-
          readable copy of the price ladder on the page, which is why it lives
          in the layout rather than in page.tsx.

          It sits AFTER {children} so it reads as a closing summary rather than
          a wall of text above the hero. It cannot be placed directly beneath
          the Card Lovers card without moving it into the client page, which
          would remove it from the server HTML and defeat its purpose. */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h2 className="sr-only">DCM Grading pricing summary</h2>
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">DCM Grading pricing (USD):</strong>{' '}
            {PACKS.map((p) => `${p.credits} credit${p.credits === 1 ? '' : 's'} for ${money(p.price)} (${p.per} a grade)`).join(' · ')}
            {' · '}
            {CARD_LOVERS.map((m) => `${m.name} ${money(m.price)} a ${m.billingLabel} for ${m.credits} grades (${m.per} a grade)`).join(' · ')}
            . Two free credits when you sign up. One credit grades one card, with four subgrades and a written reason
            for every deduction.
          </p>
        </div>
      </section>
    </>
  );
}
