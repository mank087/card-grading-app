import { Metadata } from 'next';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import {
  COMPANIES,
  MAIL_IN_COMPANIES,
  SOURCES,
  LAST_CHECKED,
  UPDATED_LABEL,
  UPDATED_ISO,
  HONEST_MIDDLE,
} from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = {
  title: 'Card Grading Companies Compared (2026): PSA, BGS, SGC, CGC, TAG, DCM',
  description:
    'A sourced comparison of the major card grading companies in August 2026: published base price, published turnaround, grading method and format for PSA, Beckett (BGS), SGC, CGC, TAG and DCM Grading.',
  keywords:
    'card grading companies, best card grading service, card grading comparison, PSA vs BGS vs SGC vs CGC, grading company prices, grading turnaround times, cheapest card grading, fastest card grading',
  alternates: {
    canonical: 'https://dcmgrading.com/card-grading-companies',
  },
  openGraph: {
    title: 'Card Grading Companies Compared (2026) | DCM Grading',
    description:
      'Published prices, published turnarounds, method and format for PSA, Beckett, SGC, CGC, TAG and DCM. Sourced and dated, August 2026.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/card-grading-companies',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'Comparison of card grading companies by price, turnaround and method, August 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Card Grading Companies Compared (2026)',
    description: 'Published prices and turnarounds for PSA, Beckett, SGC, CGC, TAG and DCM. Sourced, August 2026.',
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
  ],
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Card Grading Companies Compared (2026): PSA, BGS, SGC, CGC, TAG and DCM',
  description:
    'A sourced comparison of the major trading card grading companies by published price, published turnaround, grading method and output format.',
  datePublished: UPDATED_ISO,
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/card-grading-companies',
  author: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
  publisher: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: { '@type': 'ImageObject', url: 'https://dcmgrading.com/DCM-logo.png' },
  },
  citation: Object.values(SOURCES).map((s) => s.url),
};

/**
 * Single source for the FAQ: rendered as open headings below AND serialized to
 * FAQPage JSON-LD. Each answer opens with a one-sentence direct answer.
 */
const faqs = [
  {
    q: 'What are the main card grading companies?',
    a: 'The main trading card grading companies are PSA, Beckett (BGS), SGC, CGC, TAG and DCM Grading. PSA, Beckett, SGC and CGC are mail-in services where human graders assess the card and return it in a sealed slab. TAG is a mail-in service that uses machine-assisted optical analysis alongside its grading. DCM Grading is photo-based: DCM Optic grades from two photos in about 60 seconds and the card never leaves your hands.',
  },
  {
    q: 'What is the cheapest card grading service?',
    a: 'Among mail-in graders, SGC published the lowest base price in August 2026 at $15 per card on its Standard tier, with CGC at about $15 on a Bulk tier that requires a 25-card minimum. PSA and Beckett were both at roughly $80 on their cheapest open tiers after pausing their budget services. DCM grades a single card for $2.99, as low as $0.66 a card with the 150-credit VIP package, with no shipping or insurance to add.',
  },
  {
    q: 'Which card grading company is fastest?',
    a: 'Among mail-in graders in August 2026, Beckett published the shortest turnaround on its cheapest open tier at 15 business days, with PSA and SGC at 40 to 50 business days and CGC Bulk at 100 or more. DCM returns a grade in about 60 seconds because nothing ships. Published mail-in turnarounds are estimates made before the current queues formed, so read them as a floor rather than a promise.',
  },
  {
    q: 'Which card grading company should I use?',
    a: 'It depends on what the card needs to do. If the card is valuable enough that a sealed, serialized slab from a recognized third-party grader changes what a buyer will pay, or you want it in a registry, send it to one of the mail-in companies. If you want a documented grade today on cards that were never going to justify a submission fee and a two-month wait, grade at home. Most collectors end up doing both.',
  },
  {
    q: 'Do any card grading companies use AI?',
    a: 'Yes. DCM Grading uses computer vision end to end: DCM Optic runs three independent evaluation passes on every card and takes the median as the grade, with the rubric published at /grading-standard. TAG uses machine-assisted optical analysis within a mail-in service. PSA, Beckett, SGC and CGC grade with human graders.',
  },
  {
    q: 'Do you have to mail your cards to get them graded?',
    a: 'Not to every service. PSA, Beckett, SGC, CGC and TAG all require you to ship the card, which means packing, insured shipping both ways, and the card being out of your hands for the length of the queue. DCM is photo-based, so there is no shipping, no insurance and no package that can go missing. The trade-off is that DCM returns a digital grade and a printable label rather than a sealed slab.',
  },
  {
    q: 'Is a grade from an AI grading company the same as a PSA slab?',
    a: 'No, and we do not claim it is. A DCM grade is a documented, publicly verifiable evaluation of the card against a published rubric, with four subgrades and a written reason for every deduction. It is not a sealed slab from a third-party grader and it is not registry-eligible. Where a buyer specifically wants a PSA, BGS, SGC or CGC slab in hand, that is what they want.',
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

export default function CardGradingCompaniesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero. The first paragraph answers the page's question outright. */}
        <section className="mb-14">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            Sourced comparison
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">
            Card Grading Companies Compared
          </h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            The major trading card grading companies are <strong>PSA</strong>, <strong>Beckett (BGS)</strong>,{' '}
            <strong>SGC</strong>, <strong>CGC</strong>, <strong>TAG</strong> and <strong>DCM Grading</strong>. The
            first five are mail-in services: you ship the card, it is graded, and it comes back sealed in a slab. In
            August 2026 their published base prices ran from $15 to about $80 per card, with published turnarounds
            from 15 to 100-plus business days. DCM is photo-based, grades in about 60 seconds for $2.99 a single card
            or as low as $0.66 a card with the VIP package, and the card never leaves your hands.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {UPDATED_LABEL}. Figures last checked {LAST_CHECKED}. Business days throughout, shipping excluded. Sources
            are linked under the table.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
            <Link
              href="/grading-standard"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-lg border-2 border-purple-200 hover:bg-purple-50 transition-colors"
            >
              Read the Published Rubric
            </Link>
          </div>
        </section>

        {/* The comparison table */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            The comparison table (August 2026)
          </h2>
          <p className="text-gray-600 mb-6">
            Every figure below is a published number from the grading company or a dated third-party roundup. Prices
            are per card on the cheapest tier that was open in August 2026 and exclude shipping and insurance.
          </p>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-left">
                    <th className="py-4 px-4 font-bold">Service</th>
                    <th className="py-4 px-4 font-bold">Cheapest open tier</th>
                    <th className="py-4 px-4 font-bold">Published price</th>
                    <th className="py-4 px-4 font-bold">Published turnaround</th>
                    <th className="py-4 px-4 font-bold">Method</th>
                    <th className="py-4 px-4 font-bold">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPANIES.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b border-gray-200 last:border-0 align-top ${c.isDcm ? 'bg-purple-50' : ''}`}
                    >
                      <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">{c.name}</td>
                      <td className="py-4 px-4 text-gray-700">{c.cheapestTier}</td>
                      <td className="py-4 px-4 text-gray-900 font-semibold">{c.price}</td>
                      <td className="py-4 px-4 text-gray-700">{c.turnaround}</td>
                      <td className="py-4 px-4 text-gray-700">{c.methodShort}</td>
                      <td className="py-4 px-4 text-gray-700">{c.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-3">Notes on each service</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              {COMPANIES.map((c) => (
                <li key={c.name}>
                  <strong className="text-gray-900">{c.name}:</strong> {c.notes} Minimum: {c.minimum}.
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Sources</h3>
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
            <p className="text-xs text-gray-500 mt-4">
              Grading company pricing and service availability change often. The linked sources are the place to
              confirm a current figure.
            </p>
          </div>
        </section>

        {/* What the table doesn't show */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-5">What the table does not show</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong className="text-gray-900">Backlogs.</strong> PSA&apos;s own updates page reported a backlog
                above 12 million cards in late July 2026 and listed Value services as paused. Beckett paused its Base
                and Standard tiers on August 5, 2026 after a reported 102 percent year-over-year rise in submissions.
                Published turnarounds were set before those queues formed.
              </p>
              <p>
                <strong className="text-gray-900">Faster tiers.</strong> Every mail-in service sells faster tiers at
                higher prices, from roughly $150 for a five-to-seven-day PSA Super Express to $250 or more for
                walk-through service at Beckett. Those tiers make sense for cards worth several hundred dollars and up.
              </p>
              <p>
                <strong className="text-gray-900">Subgrades.</strong> Beckett prints subgrades on the label at every
                tier. PSA, SGC and CGC do not as standard, though CGC shows them on some services. DCM includes four
                subgrades on every grade.
              </p>
              <p>
                <strong className="text-gray-900">Shipping and insurance.</strong> Add insured shipping both ways,
                typically $15 to $40 depending on declared value, to every mail-in row. There is no shipping row for
                DCM because nothing ships.
              </p>
            </div>
          </div>
        </section>

        {/* Which should you choose */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Which should you choose?</h2>
          <p className="text-gray-600 mb-8 max-w-3xl">
            This is not one decision. It is a decision per card, and the honest version is that most collections
            contain a handful of cards that justify a mail-in fee and a great many that never will.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="text-2xl font-bold text-gray-800 mb-3">Send it to PSA, Beckett, SGC or CGC when</div>
              <ul className="space-y-2 text-sm text-gray-800">
                <li>• The card is valuable enough that a sealed slab from a recognized grader changes what a buyer pays.</li>
                <li>• You are building a registry set, which needs a slab from a company that runs one.</li>
                <li>• The buyer you have in mind specifically wants a slab in hand from that company.</li>
                <li>• The card is a vintage or high-dollar piece where a third-party authenticity opinion matters.</li>
                <li>• You can absorb the published turnaround, which in August 2026 ran from 15 to 100-plus business days.</li>
              </ul>
            </div>
            <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
              <div className="text-2xl font-bold text-purple-700 mb-3">Grade it with DCM when</div>
              <ul className="space-y-2 text-sm text-gray-800">
                <li>• You want the grade today, on a card that stays in your hands.</li>
                <li>• You are grading volume: a binder, a box break, a whole shoebox.</li>
                <li>• The card would not clear a mail-in fee plus shipping, which is most cards.</li>
                <li>• You are valuing or insuring a collection and need documented condition.</li>
                <li>• You are listing raw on eBay and want a grade, subgrades and a written defect log in the listing.</li>
                <li>• You want to know which cards in the stack are worth sending out.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200 text-center">
            <p className="text-blue-900">
              <strong>{HONEST_MIDDLE}</strong>
            </p>
          </div>
        </section>

        {/* What makes DCM different, method-first */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Where DCM fits in this list</h2>
            <p className="text-lg text-gray-700 mb-4">
              DCM is the only company in the table that does not ask you to ship anything. You photograph the front and
              back, DCM Optic runs <strong>three independent evaluation passes</strong> over the card, and the median
              of those passes becomes the grade. You get a whole-number grade from 1 to 10, four subgrades, a written
              reason for every deduction, and an{' '}
              <Link href="/reports-and-labels" className="text-purple-700 underline">image confidence letter from A to D</Link>{' '}
              with an uncertainty range.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              The rubric is published at <Link href="/grading-standard" className="text-purple-700 underline">/grading-standard</Link>{' '}
              and the limitations are published at{' '}
              <Link href="/grading-limitations" className="text-purple-700 underline">/grading-limitations</Link>. Every
              grade lands in a public{' '}
              <Link href="/pop" className="text-purple-700 underline">population report</Link>, and every slab label
              carries a QR that resolves to a public verification page anyone can check.
            </p>
            <p className="text-lg text-gray-700">
              DCM runs the whole loop rather than one step of it: collect, grade, value, slab and sell. A DCM grade is
              not a sealed slab from one of the mail-in companies and is not registry-eligible, and this page does not
              claim otherwise.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href="/psa-alternative" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                PSA alternative →
              </Link>
              <Link href="/ai-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                How AI card grading works →
              </Link>
              <Link href="/ai-card-grading-accuracy" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Is AI card grading accurate? →
              </Link>
              <Link href="/fastest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Fastest card grading →
              </Link>
              <Link href="/cheapest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Cheapest card grading →
              </Link>
              <Link href="/pop" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Public pop report →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ, rendered open for extraction */}
        <section className="mb-16">
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

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Find out which of your cards are worth sending out</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Two free grades to start. Two photos, about a minute, and the card never leaves your hands.
            </p>
            <Link
              href="/get-started"
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
