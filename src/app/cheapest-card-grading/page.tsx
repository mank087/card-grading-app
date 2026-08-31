import { Metadata } from 'next';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import {
  COMPANIES,
  DCM_PACKS,
  CARD_LOVERS,
  SOURCES,
  LAST_CHECKED,
  UPDATED_LABEL,
  UPDATED_ISO,
  HONEST_MIDDLE,
} from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = {
  title: 'Cheapest Card Grading (2026): Published Prices Compared',
  description:
    'What is the cheapest card grading service? In August 2026 the mail-in majors published base prices from $15 to about $80 per card before shipping. DCM grades a card for $2.99, down to $0.66 per card on the 150-credit pack, with nothing to ship.',
  keywords:
    'cheapest card grading, card grading prices, how much does card grading cost, cheap card grading service, card grading cost comparison, affordable card grading',
  alternates: { canonical: 'https://dcmgrading.com/cheapest-card-grading' },
  openGraph: {
    title: 'Cheapest Card Grading (2026) | DCM Grading',
    description:
      'Published base prices for PSA, Beckett, SGC and CGC next to $2.99 a card at home. Sourced, August 2026.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/cheapest-card-grading',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'Card grading prices compared, August 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cheapest Card Grading (2026)',
    description: 'Published base prices for the mail-in majors next to $2.99 a card at home.',
    images: ['/why-dcm/Price-graded-cards.png'],
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Card Grading Companies',
      item: 'https://dcmgrading.com/card-grading-companies',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Cheapest Card Grading',
      item: 'https://dcmgrading.com/cheapest-card-grading',
    },
  ],
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Cheapest Card Grading (2026): Published Prices Compared',
  description:
    'Published per-card prices for PSA, Beckett, SGC, CGC and DCM, with what each price does and does not include, as of August 2026.',
  datePublished: UPDATED_ISO,
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/cheapest-card-grading',
  author: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
  publisher: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: { '@type': 'ImageObject', url: 'https://dcmgrading.com/DCM-logo.png' },
  },
  citation: Object.values(SOURCES).map((s) => s.url),
};

const faqs = [
  {
    q: 'What is the cheapest card grading service?',
    a: 'The cheapest published base price among the mail-in graders in August 2026 was SGC Standard at $15 per card, with CGC Bulk at about $15 but requiring a 25-card minimum. PSA and Beckett had both paused their budget tiers, leaving $79.99 and $79.95 as their cheapest open service levels. DCM grades a single card for $2.99, or $0.66 per card on the 150-credit pack, and nothing ships.',
  },
  {
    q: 'How much does it cost to get a card graded?',
    a: 'Budget $15 to $80 per card for a mail-in grade in August 2026, plus $15 to $40 of insured shipping in each direction depending on declared value. The advertised tier price is only part of the total: shipping, insurance, and in some cases subgrades or minimum submission sizes are extra. Grading at home costs $2.99 for a single card at DCM with nothing to add.',
  },
  {
    q: 'What does a card grading price include?',
    a: 'A mail-in fee buys the grade and the sealed slab, not the shipping. Beckett prints subgrades on the label at every tier, while PSA, SGC and CGC do not as standard, though CGC shows them on some services. CGC’s bulk rate requires a 25-card submission, so its real entry cost is 25 times the per-card price. Every DCM grade includes four subgrades, a written reason for every deduction, an image confidence letter and a printable label at no extra cost.',
  },
  {
    q: 'Is cheap card grading worth it?',
    a: 'It depends on whether the card needs a slab or just a documented grade. On a $30 card, a $15 to $80 fee plus shipping plus a queue of 15 to 100-plus business days rarely pays for itself, and that describes most of a normal collection. Where a card is valuable enough that a sealed, recognized slab changes what a buyer will pay, the fee is doing real work.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

/** Cheapest first. Unpublished prices sort last. */
const rows = [...COMPANIES].sort((a, b) => {
  if (a.priceSort === null) return 1;
  if (b.priceSort === null) return -1;
  return a.priceSort - b.priceSort;
});

export default function CheapestCardGradingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <section className="mb-12">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            Pricing, sourced
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">Cheapest Card Grading</h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            The cheapest published mail-in price in August 2026 was <strong>SGC Standard at $15</strong> per card, with
            CGC Bulk at about $15 on a 25-card minimum. PSA and Beckett had paused their budget tiers, leaving{' '}
            <strong>$79.99</strong> and <strong>$79.95</strong> as their cheapest open levels. None of those figures
            includes shipping. Grading at home with DCM costs <strong>$2.99</strong> for one card, down to $0.66 per
            card on the 150-credit pack.
          </p>
          <p className="text-sm text-gray-500">
            {UPDATED_LABEL}. Figures last checked {LAST_CHECKED}. Per card, shipping excluded. Sources below.
          </p>
        </section>

        {/* Price table */}
        <section className="mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Published prices, cheapest first</h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-left">
                    <th className="py-4 px-4 font-bold">Service</th>
                    <th className="py-4 px-4 font-bold">Cheapest open tier</th>
                    <th className="py-4 px-4 font-bold">Price per card</th>
                    <th className="py-4 px-4 font-bold">Minimum</th>
                    <th className="py-4 px-4 font-bold">Not included</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b border-gray-200 last:border-0 align-top ${c.isDcm ? 'bg-purple-50' : ''}`}
                    >
                      <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">{c.name}</td>
                      <td className="py-4 px-4 text-gray-700">{c.cheapestTier}</td>
                      <td className="py-4 px-4 text-gray-900 font-semibold">{c.price}</td>
                      <td className="py-4 px-4 text-gray-700">{c.minimum}</td>
                      <td className="py-4 px-4 text-gray-700">
                        {c.isDcm
                          ? 'Nothing to add. No shipping, no insurance, no tier upcharge. Subgrades included.'
                          : 'Insured shipping both ways, typically $15 to $40 by declared value.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* What the price does and does not buy */}
        <section className="mb-14">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What each price does and does not buy</h2>
            <ul className="space-y-3 text-gray-700">
              <li>
                <strong className="text-gray-900">Shipping and insurance are extra everywhere it applies.</strong>{' '}
                Insured shipping both ways typically runs $15 to $40 depending on declared value. On a $15 grading
                fee, that is the majority of the real cost.
              </li>
              <li>
                <strong className="text-gray-900">Subgrades are not standard everywhere.</strong> Beckett prints them
                on the label at every tier. PSA, SGC and CGC do not as standard, though CGC shows them on some
                services. DCM includes four subgrades on every grade.
              </li>
              <li>
                <strong className="text-gray-900">Minimums change the entry price.</strong> A bulk rate that needs 25
                cards is a 25-card decision, not a one-card decision.
              </li>
              <li>
                <strong className="text-gray-900">Budget tiers get paused.</strong> The affordable tiers are the first
                to close when submissions spike, which is exactly what happened at PSA and Beckett in the summer of
                2026.
              </li>
              <li>
                <strong className="text-gray-900">A mail-in fee buys a sealed slab.</strong> That is a real thing the
                cheaper option does not produce. A DCM grade is a documented, publicly verifiable evaluation plus a
                printable label for a holder you own, not a sealed slab, and it is not registry-eligible.
              </li>
            </ul>
          </div>
        </section>

        {/* DCM pricing */}
        <section className="mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">What DCM actually costs</h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-900 text-left">
                    <th className="py-3 px-4 font-bold">Pack</th>
                    <th className="py-3 px-4 font-bold">Price</th>
                    <th className="py-3 px-4 font-bold">Grades</th>
                    <th className="py-3 px-4 font-bold">Per grade</th>
                  </tr>
                </thead>
                <tbody>
                  {DCM_PACKS.map((p) => (
                    <tr key={p.name} className="border-b border-gray-200">
                      <td className="py-3 px-4 font-semibold text-gray-900">{p.name}</td>
                      <td className="py-3 px-4 text-gray-900">${p.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-gray-700">{p.credits}</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">{p.per}</td>
                    </tr>
                  ))}
                  {CARD_LOVERS.map((p) => (
                    <tr key={p.name} className="border-b border-gray-200 last:border-0 bg-purple-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{p.name}</td>
                      <td className="py-3 px-4 text-gray-900">
                        ${p.price.toFixed(2)} / {p.billing}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {p.credits} per {p.billing}
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">{p.per}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Two free grades to start, no card-value minimum, and every grade includes four subgrades, a written reason
            for every deduction, an image confidence letter from A to D and a printable label.{' '}
            <Link href="/credits" className="text-purple-700 underline">
              Full pricing
            </Link>
            .
          </p>
        </section>

        {/* Honest middle */}
        <section className="mb-14">
          <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200">
            <h2 className="text-2xl font-bold text-blue-900 mb-3">The honest way to spend the money</h2>
            <p className="text-blue-900 mb-3">
              The problem was never that grading is expensive. It is that grading <em>everything</em> is expensive, and
              you do not find out which cards were worth it until after you have paid. Grade the stack at home first,
              then spend the mail-in fees on the cards that earned them.
            </p>
            <p className="text-blue-900 font-semibold">{HONEST_MIDDLE}</p>
          </div>
        </section>

        {/* Sources */}
        <section className="mb-14">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Sources</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              {Object.values(SOURCES).map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-700 underline hover:text-purple-900"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-gray-700 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related + CTA */}
        <section className="mb-12">
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/card-grading-companies" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              All grading companies compared →
            </Link>
            <Link href="/fastest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              Fastest card grading →
            </Link>
            <Link href="/psa-alternative" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              PSA alternative →
            </Link>
            <Link href="/credits" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              DCM pricing →
            </Link>
          </div>
        </section>

        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Grade the binder for less than one submission</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Two free grades to start. $2.99 a card after that, and nothing to ship.
            </p>
            <Link
              href="/login?mode=signup"
              className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
