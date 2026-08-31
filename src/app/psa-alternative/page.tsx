import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import {
  SOURCES,
  LAST_CHECKED,
  UPDATED_LABEL,
  UPDATED_ISO,
  HONEST_MIDDLE,
} from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = {
  title: 'PSA Alternative: Grade Any Card From a Photo in About 60 Seconds',
  description:
    'Looking for a PSA alternative? DCM grades any trading card from two photos in about 60 seconds for $2.99, with four subgrades and a written reason for every deduction. No mailing, no insurance, no queue. Updated August 2026 with sourced PSA pricing.',
  keywords:
    'PSA alternative, alternative to PSA grading, PSA vs DCM, cheap card grading, fast card grading, AI card grading, online card grading, no-mail card grading, photo card grading',
  alternates: {
    canonical: 'https://dcmgrading.com/psa-alternative',
  },
  openGraph: {
    title: 'PSA Alternative. Grade Any Card From a Photo | DCM Grading',
    description:
      'No mailing. $2.99 a card, down to $0.50 with Card Lovers Annual. Four subgrades on every grade. Every card type accepted.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/psa-alternative',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'DCM Grading PSA alternative comparison showing instant AI grading and lower per-card pricing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PSA Alternative. Grade Any Card From a Photo',
    description: 'No mailing. $2.99 a card. Four subgrades on every grade.',
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
    { '@type': 'ListItem', position: 3, name: 'PSA Alternative', item: 'https://dcmgrading.com/psa-alternative' },
  ],
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI Trading Card Grading (PSA Alternative)',
  name: 'DCM Grading',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: 'https://dcmgrading.com/DCM-logo.png',
  },
  areaServed: 'Worldwide',
  description:
    'Photo-based AI card grading. A PSA alternative with no mailing requirement, no card-value minimums, four subgrades on every card, and pricing from $2.99 per grade.',
  offers: {
    '@type': 'Offer',
    price: '2.99',
    priceCurrency: 'USD',
    description:
      'A single grading credit is $2.99. Packs bring the per-grade cost to $2.00 (5 for $9.99), $1.00 (20 for $19.99) and $0.66 (150 for $99). Card Lovers Annual is $449 for 900 grades, about $0.50 each.',
    url: 'https://dcmgrading.com/credits',
  },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'PSA Alternative: Grade Any Card From a Photo in About 60 Seconds',
  description:
    'What a good PSA alternative looks like in 2026, with sourced PSA pricing and turnaround, and an honest account of what a photo-based grade is and is not.',
  datePublished: UPDATED_ISO,
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/psa-alternative',
  author: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
  publisher: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: { '@type': 'ImageObject', url: 'https://dcmgrading.com/DCM-logo.png' },
  },
  citation: [SOURCES.psaPricing.url, SOURCES.psaUpdates.url, SOURCES.dkPsaTurnaround.url, SOURCES.pregradeRoundup.url],
};

/**
 * Single source for the FAQ: rendered as open headings below AND serialized to
 * FAQPage JSON-LD. Each answer opens with a one-sentence direct answer.
 */
const faqs = [
  {
    q: 'What is the best PSA alternative for grading cards in 2026?',
    a: 'For a grade you can have today on a card that never leaves your hands, DCM is the closest alternative to PSA. It grades against a published rubric covering centering, corners, edges and surface, returns a whole-number grade from 1 to 10 with four subgrades and a written reason for every deduction, and costs $2.99 for a single card. Mail-in grading from PSA, Beckett, SGC or CGC remains the right call when the card is valuable enough that a sealed, serialized slab changes what a buyer will pay.',
  },
  {
    q: 'Do I have to mail my cards in for DCM?',
    a: 'No. DCM is photo-based: you take front and back photos with your phone, upload them, and the grade comes back in about 60 seconds. Your cards never leave your hands, so there is no packing, no insured shipping in either direction, and no return-shipment window where the card exists only as a tracking number.',
  },
  {
    q: 'How does DCM pricing compare to PSA?',
    a: 'DCM is $2.99 for a single grade, versus $79.99 for PSA’s cheapest tier that was open in August 2026. PSA’s Value services, published at $24.99 to $64.99, were listed as paused at that time. DCM packs bring the per-grade cost down to $2.00 (5 for $9.99), $1.00 (20 for $19.99) and $0.66 (150 for $99), and Card Lovers Annual is $449 for 900 grades, about $0.50 each. Neither PSA figure includes insured shipping in both directions, typically $15 to $40 by declared value; DCM has no shipping at all.',
  },
  {
    q: 'How long does PSA take compared to DCM?',
    a: 'PSA published a 40 to 50 business day turnaround on its cheapest open tier in August 2026, and DCM returns a grade in about 60 seconds. PSA’s own updates page reported a backlog above 12 million cards in late July 2026, so published turnarounds are best read as a floor rather than a promise. Neither figure includes the time the card spends in transit each way.',
  },
  {
    q: 'Does DCM have a card-value minimum?',
    a: 'No. DCM grades every card with the same protocol, whether it is a ten-cent base card or a four-figure chase, and there is no minimum submission size. Mail-in services structure their pricing around declared value and service level, and their budget tiers are the first to be paused when submissions spike, as happened at both PSA and Beckett in the summer of 2026.',
  },
  {
    q: 'Are subgrades included with every DCM grade?',
    a: 'Yes, all four, on every grade, at no extra cost. Centering, corners, edges and surface are each scored, and the final grade is the lowest of the four under a weakest-link rule. Among the mail-in graders, Beckett prints subgrades on the label at every tier while PSA, SGC and CGC do not as standard.',
  },
  {
    q: 'Can a DCM grade replace a PSA slab for selling on eBay?',
    a: 'No, and we do not claim it can. Where a buyer specifically wants a sealed PSA slab in hand, that is what they want and nothing else substitutes for it. What a DCM grade does do is document the condition of a raw card with four subgrades, a defect log and a public verification page a buyer can check by scanning the label, which is a stronger listing than a raw card in a sleeve with no record at all.',
  },
  {
    q: 'How does AI grading actually work?',
    a: 'DCM Optic runs three independent evaluation passes over every card and takes the median as the grade. Corners, edges and surface zones are re-examined on magnified crops, every deduction is logged with a written reason, and each grade carries an image confidence letter from A to D plus an uncertainty range. The rubric is published at /grading-standard and the limitations are published at /grading-limitations.',
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

interface RowProps {
  feature: string;
  dcm: string;
  psa: string;
  dcmWin?: boolean;
}

function ComparisonRow({ feature, dcm, psa, dcmWin = true }: RowProps) {
  return (
    <tr className="border-b border-gray-200 last:border-0">
      <td className="py-4 px-4 font-semibold text-gray-900 align-top w-1/3">{feature}</td>
      <td className={`py-4 px-4 align-top ${dcmWin ? 'bg-purple-50' : ''}`}>
        <div className="flex items-start gap-2">
          {dcmWin && (
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-gray-800 text-sm">{dcm}</span>
        </div>
      </td>
      <td className="py-4 px-4 align-top text-gray-700 text-sm">{psa}</td>
    </tr>
  );
}

export default function PsaAlternativePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero. The first paragraph answers the question outright. */}
        <section className="mb-14">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            The PSA Alternative
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">
            A PSA Alternative That Doesn&apos;t Require Mailing Your Cards
          </h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            The PSA alternative for most of a collection is grading at home: DCM grades any trading card from two
            photos in <strong>about 60 seconds</strong> for <strong>$2.99</strong>, with four subgrades and a written
            reason for every deduction, and the card never leaves your hands. No packing, no insurance, no queue. The
            honest limit is that DCM returns a digital grade and a printable label, not a sealed PSA slab, so the cards
            that genuinely need one still go out.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {UPDATED_LABEL}. PSA figures on this page are published numbers last checked {LAST_CHECKED} and are linked
            to their sources below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
            <Link
              href="/card-grading-companies"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-lg border-2 border-purple-200 hover:bg-purple-50 transition-colors"
            >
              Compare All Grading Companies
            </Link>
          </div>
        </section>

        {/* Why people look for a PSA alternative */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Collectors Look for a PSA Alternative</h2>
            <p className="text-lg text-gray-700 mb-4">
              PSA is the reference point in this hobby for a reason. If you are holding a vintage rookie or a chase
              card out of a good break, a sealed PSA slab is still what the resale market asks for. For the rest of a
              collection, the arithmetic gets harder.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              In August 2026 PSA&apos;s cheapest tier that was open was <strong>Regular at $79.99</strong> per card
              with a published turnaround of <strong>40 to 50 business days</strong>; the Value services published at
              $24.99 to $64.99 were listed as paused, alongside a reported backlog above 12 million cards in late July{' '}
              <a href={SOURCES.psaUpdates.url} target="_blank" rel="noopener noreferrer" className="text-purple-700 underline">
                (PSA submission updates)
              </a>
              ,{' '}
              <a href={SOURCES.dkPsaTurnaround.url} target="_blank" rel="noopener noreferrer" className="text-purple-700 underline">
                (DraftKings Network turnaround breakdown, May 2026)
              </a>
              . Add insured shipping both ways, typically $15 to $40 by declared value, on top of the fee.
            </p>
            <p className="text-lg text-gray-700">
              DCM exists for the cards that do not clear that bar. It grades any card you own, from photos, right now,
              with four subgrades and a defect log. And when a card does turn out to deserve a mail-in submission, you
              have the evidence to decide before you pay for it.
            </p>
          </div>
        </section>

        {/* The Comparison Table */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">DCM vs PSA at a Glance</h2>
          <p className="text-center text-gray-600 mb-8 max-w-3xl mx-auto">
            Published figures where they exist, side by side. PSA prices and turnarounds are as published in August
            2026 and are linked below the table.
          </p>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                    <th className="py-4 px-4 text-left font-bold w-1/3">Feature</th>
                    <th className="py-4 px-4 text-left font-bold">DCM Grading</th>
                    <th className="py-4 px-4 text-left font-bold">PSA (mail-in)</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    feature="Need to mail your cards?"
                    dcm="No. Photo-based. Cards never leave your hands."
                    psa="Yes. Cards must be shipped with insurance and return shipping."
                  />
                  <ComparisonRow
                    feature="Turnaround time"
                    dcm="About 60 seconds per card."
                    psa="40 to 50 business days published on Regular, the cheapest tier open in August 2026, before transit."
                  />
                  <ComparisonRow
                    feature="Price per card"
                    dcm="$2.99 for a single grade. $2.00 on a 5-pack, $1.00 on a 20-pack, $0.66 on a 150-pack, about $0.50 on Card Lovers Annual."
                    psa="$79.99 on Regular, the cheapest tier open in August 2026. Value services at $24.99 to $64.99 were paused."
                  />
                  <ComparisonRow
                    feature="Shipping and insurance"
                    dcm="None. Nothing ships."
                    psa="Insured shipping both ways, typically $15 to $40 depending on declared value, on top of the fee."
                  />
                  <ComparisonRow
                    feature="Card-value minimum"
                    dcm="None. Commons, low-value parallels and sentimental cards are graded the same way as chases."
                    psa="Service levels are structured by declared value, and the budget tiers were paused in August 2026."
                  />
                  <ComparisonRow
                    feature="Subgrades included?"
                    dcm="Yes. Centering, corners, edges and surface on every grade at no extra cost."
                    psa="Not printed on the standard label."
                  />
                  <ComparisonRow
                    feature="Grading method"
                    dcm="Three independent computer-vision passes per card, median consensus, rubric published at /grading-standard."
                    psa="Human graders. Multiple graders on higher service levels."
                  />
                  <ComparisonRow
                    feature="Defect explanations"
                    dcm="Every deduction is logged with a short written reason."
                    psa="A grade is assigned. Detailed reasoning is not part of the standard report."
                  />
                  <ComparisonRow
                    feature="Card types supported"
                    dcm="Sports, Pokémon, MTG, Lorcana, One Piece, Yu-Gi-Oh, Star Wars, non-sports, and more."
                    psa="Broad coverage across major TCG and sports categories."
                    dcmWin={false}
                  />
                  <ComparisonRow
                    feature="Final output"
                    dcm="Digital grade, four subgrades, defect log, confidence letter, market price, and a printable label with a QR that resolves to a public verification page."
                    psa="Sealed physical slab with a serialized cert. Registry-eligible."
                    dcmWin={false}
                  />
                  <ComparisonRow
                    feature="Risk of loss or damage in transit"
                    dcm="None. The card stays with you."
                    psa="Real, which is why insured shipping is part of the cost."
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Sources</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {[SOURCES.psaPricing, SOURCES.psaUpdates, SOURCES.dkPsaTurnaround, SOURCES.pregradeRoundup].map((s) => (
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
              PSA pricing and service availability change often. Last checked {LAST_CHECKED}. The full sourced table
              covering Beckett, SGC, CGC and TAG is on{' '}
              <Link href="/card-grading-companies" className="underline">
                the grading companies comparison
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Key advantages */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">What DCM Does Differently</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'Nothing ships, so nothing is at risk',
                body: 'Your cards stay in your possession. Two photos, upload, grade. There is no window where the card is a tracking number, and no insured shipping cost on either leg.',
              },
              {
                title: '$2.99 a card, less in volume',
                body: 'A single grade is $2.99. Five are $9.99, twenty are $19.99, a hundred and fifty are $99, and Card Lovers Annual is $449 for 900 grades. Two free grades to start.',
              },
              {
                title: 'No card-value minimum',
                body: 'Every card gets the same protocol, whether it is a ten-cent base card or a four-figure chase. There is no declared-value band to fit into and no minimum submission size.',
              },
              {
                title: 'Four subgrades on every grade',
                body: 'Centering, corners, edges and surface are each scored, and the final grade is the lowest of the four under a weakest-link rule. No upcharge, no service tier to pick.',
              },
              {
                title: 'Three-pass median consensus',
                body: 'Every card runs through three independent evaluations and the median becomes the grade, computed server-side. A single outlier read cannot decide the result.',
              },
              {
                title: 'A written reason for every deduction',
                body: 'Print line on the top edge. Light whitening at the upper-left corner. Surface scratch in zone 5. You see what the evaluation saw and can check the call against the card.',
              },
              {
                title: 'A confidence letter, A to D',
                body: 'Photo grading is not perfect and glare and soft focus are real. Every grade carries an image confidence letter and an uncertainty range, so a shaky read announces itself instead of hiding.',
              },
              {
                title: 'A public record, not a screenshot',
                body: 'Every label carries a QR that resolves to a public verification page with the grade, the subgrades and the reasoning. The platform-wide grade distribution is open at /pop.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* When DCM is right, when PSA is right */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">When to Use DCM vs When to Send to PSA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
              <div className="text-2xl font-bold text-purple-700 mb-3">Use DCM when</div>
              <ul className="space-y-2 text-sm text-gray-800">
                <li>• You want the grade today, not in forty to fifty business days.</li>
                <li>• You are valuing or insuring a collection.</li>
                <li>• The card would not clear a $79.99 fee plus shipping.</li>
                <li>• You are deciding which cards are worth a paid mail-in submission.</li>
                <li>• You are listing raw on eBay and want documented condition in the listing.</li>
                <li>• You do not want to ship a sentimental or fragile card anywhere.</li>
                <li>• You want a printable label and a scannable report for display.</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="text-2xl font-bold text-gray-700 mb-3">Send to PSA when</div>
              <ul className="space-y-2 text-sm text-gray-800">
                <li>• The card is valuable enough that a sealed slab changes what a buyer will pay.</li>
                <li>• You are selling where buyers expect a PSA slab in hand.</li>
                <li>• You are building a registry set, which needs a slab from a company that runs one.</li>
                <li>• The card needs a third-party authenticity opinion.</li>
                <li>• You have already graded at home and confirmed the card earns the fee.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200 text-center">
            <p className="text-blue-900">
              <strong>{HONEST_MIDDLE}</strong>
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md overflow-hidden md:grid md:grid-cols-2">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-6 order-2 md:order-1">
              <Image
                src="/why-dcm/judge-graded-card.png"
                alt="DCM-graded card with subgrades for centering, corners, edges, and surface alongside a defect log"
                width={500}
                height={400}
                className="rounded-lg shadow-md w-full h-auto"
              />
            </div>
            <div className="p-8 order-1 md:order-2">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">What You Get With Every DCM Grade</h2>
              <ul className="text-gray-700 space-y-2 mb-4 text-sm">
                <li>• Whole-number grade from 1 to 10</li>
                <li>• Subgrades for centering, corners, edges and surface</li>
                <li>• A defect log explaining every deduction</li>
                <li>• Image confidence rating from A to D, with an uncertainty range</li>
                <li>• Three-pass consistency score</li>
                <li>• Printable mini-report for your toploader</li>
                <li>• Full report with the complete breakdown</li>
                <li>• Custom slab label you can print and pair with a One Touch or magnetic holder</li>
                <li>• A public verification page at /verify, reachable by scanning the label</li>
                <li>• Current market price for the grade (Card Lovers and VIP)</li>
              </ul>
              <Link href="/reports-and-labels" className="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700">
                See reports and labels
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Pricing That Won&apos;t Make You Think Twice</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$2.99</p>
                <p className="text-sm opacity-90 mt-1">A single grade.</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$1.00</p>
                <p className="text-sm opacity-90 mt-1">Per card on the 20-pack ($19.99).</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$0.66</p>
                <p className="text-sm opacity-90 mt-1">Per card on the 150-pack ($99).</p>
              </div>
            </div>
            <p className="text-lg opacity-95 mb-4">
              Card Lovers Annual is $449 for 900 grades, about $0.50 each. Four subgrades and a defect log are included
              on every grade, with no tier upcharges and nothing to ship.
            </p>
            <Link
              href="/credits"
              className="inline-block bg-white text-purple-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              See all pricing
            </Link>
          </div>
        </section>

        {/* FAQ, rendered open for extraction */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-gray-700 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Related pages</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/card-grading-companies" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                All grading companies compared →
              </Link>
              <Link href="/cheapest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Cheapest card grading →
              </Link>
              <Link href="/fastest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Fastest card grading →
              </Link>
              <Link href="/ai-card-grading-accuracy" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Is AI card grading accurate? →
              </Link>
              <Link href="/grading-standard" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                The published grading standard →
              </Link>
              <Link href="/pop" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Public pop report →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Try the PSA Alternative That Doesn&apos;t Ask You to Mail Anything</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Sign up free and grade your first card on us. Two photos and about a minute is all it takes.
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
