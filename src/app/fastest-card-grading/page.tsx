import { Metadata } from 'next';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import {
  COMPANIES,
  SOURCES,
  LAST_CHECKED,
  UPDATED_LABEL,
  UPDATED_ISO,
  HONEST_MIDDLE,
} from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = {
  title: 'Fastest Card Grading (2026): Published Turnaround Times Compared',
  description:
    'How fast is card grading in 2026? Published turnarounds for PSA, Beckett, SGC and CGC ran from 15 to 100-plus business days in August 2026. DCM grades from two photos in about 60 seconds, with nothing to ship.',
  keywords:
    'fastest card grading, card grading turnaround times, how long does card grading take, fast card grading service, instant card grading, same day card grading',
  alternates: { canonical: 'https://dcmgrading.com/fastest-card-grading' },
  openGraph: {
    title: 'Fastest Card Grading (2026) | DCM Grading',
    description:
      'Published turnarounds for the mail-in majors, side by side with a grade that takes about 60 seconds. Sourced, August 2026.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/fastest-card-grading',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'Card grading turnaround times compared, August 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fastest Card Grading (2026)',
    description: 'Published turnarounds for PSA, Beckett, SGC and CGC vs about 60 seconds at home.',
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
      name: 'Fastest Card Grading',
      item: 'https://dcmgrading.com/fastest-card-grading',
    },
  ],
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Fastest Card Grading (2026): Published Turnaround Times Compared',
  description:
    'Published turnaround times for PSA, Beckett, SGC, CGC and DCM, with sources, as of August 2026.',
  datePublished: UPDATED_ISO,
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/fastest-card-grading',
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
    q: 'What is the fastest card grading service?',
    a: 'DCM returns a grade in about 60 seconds because nothing ships: you photograph the front and back and the grade comes back with four subgrades and a written reason for every deduction. Among the mail-in graders in August 2026, Beckett published the shortest turnaround on its cheapest open tier at 15 business days, with PSA and SGC at 40 to 50 business days and CGC Bulk at 100 or more. Every mail-in service also sells faster tiers at higher prices.',
  },
  {
    q: 'How long does card grading take in 2026?',
    a: 'On the cheapest tiers that were open in August 2026, published turnarounds ran from 15 business days to more than 100. Those figures exclude shipping in both directions and were set before the current queues formed, so treat them as a floor. PSA reported a backlog above 12 million cards in late July 2026, and Beckett paused its two cheapest tiers on August 5 after a reported 102 percent year-over-year rise in submissions.',
  },
  {
    q: 'Can you get a card graded the same day?',
    a: 'Not by mail, in practice, but you can grade at home in about a minute. Walk-through and express mail-in tiers shorten the queue for a higher fee and still involve shipping the card both ways. A photo-based grade from DCM is returned in about 60 seconds and the card never leaves your hands, though it produces a digital grade and a printable label rather than a sealed slab.',
  },
  {
    q: 'Why is mail-in card grading so slow?',
    a: 'The affordable tiers are the slow ones, and they are the first to be paused when demand spikes. Cards have to be received, logged, queued, graded, encapsulated and shipped back, and the cheapest service levels sit at the back of that queue by design. That is the trade the mail-away model asks you to make on a $30 card.',
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

/** Sorted fastest first. Unpublished turnarounds sort last. */
const rows = [...COMPANIES].sort((a, b) => {
  if (a.turnaroundSort === null) return 1;
  if (b.turnaroundSort === null) return -1;
  return a.turnaroundSort - b.turnaroundSort;
});

export default function FastestCardGradingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <section className="mb-12">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            Turnaround, sourced
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">Fastest Card Grading</h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            The fastest way to get a card graded is not to ship it. DCM grades from two photos in{' '}
            <strong>about 60 seconds</strong>, with no packing, no insurance and no return queue. Among the mail-in
            graders in August 2026, Beckett published <strong>15 business days</strong> on its cheapest open tier,
            PSA and SGC published <strong>40 to 50</strong>, and CGC Bulk published <strong>100 or more</strong> —
            before shipping in either direction.
          </p>
          <p className="text-sm text-gray-500">
            {UPDATED_LABEL}. Figures last checked {LAST_CHECKED}. Business days, shipping excluded. Sources below.
          </p>
        </section>

        {/* Table */}
        <section className="mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Published turnaround times, fastest first</h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-left">
                    <th className="py-4 px-4 font-bold">Service</th>
                    <th className="py-4 px-4 font-bold">Tier</th>
                    <th className="py-4 px-4 font-bold">Published turnaround</th>
                    <th className="py-4 px-4 font-bold">Ships?</th>
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
                      <td className="py-4 px-4 text-gray-900 font-semibold">{c.turnaround}</td>
                      <td className="py-4 px-4 text-gray-700">
                        {c.isDcm ? 'No. The card stays with you.' : 'Yes, both ways, insured.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Turnaround is quoted for the cheapest tier that was open at each company in August 2026. Faster tiers
            exist everywhere at higher prices, from roughly $150 for a five-to-seven-day PSA Super Express to $250 or
            more for walk-through service at Beckett.
          </p>
        </section>

        {/* Why the numbers are a floor */}
        <section className="mb-14">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Read published turnarounds as a floor</h2>
            <p className="text-gray-700 mb-3">
              PSA&apos;s submission updates page reported a backlog above 12 million cards in late July 2026, with its
              Value services listed as paused. Beckett paused its Base and Standard tiers on August 5, 2026 after a
              reported 102 percent year-over-year rise in submissions, with reopening estimated for mid September.
            </p>
            <p className="text-gray-700">
              Published turnarounds were set before those queues formed. Add insured shipping in both directions on
              top, and the elapsed time from your kitchen table back to your kitchen table is longer than any number in
              the table above.
            </p>
          </div>
        </section>

        {/* Honest middle */}
        <section className="mb-14">
          <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200">
            <h2 className="text-2xl font-bold text-blue-900 mb-3">Speed is not the only axis</h2>
            <p className="text-blue-900 mb-3">
              A 60-second grade and a sealed slab are different products. DCM returns a{' '}
              <Link href="/grading-standard" className="text-blue-700 underline hover:text-blue-900">whole-number grade from 1 to 10</Link>,
              four subgrades, a written reason for every deduction, an image confidence letter and a{' '}
              <Link href="/reports-and-labels" className="text-blue-700 underline hover:text-blue-900">printable label for a holder you already own</Link>.
              It is not a sealed slab from a mail-in grader and it is not registry-eligible.
            </p>
            <p className="text-blue-900 mb-3">
              What we do publish is the record: every grade DCM has issued is aggregated in the public{' '}
              <Link href="/pop" className="text-blue-700 underline hover:text-blue-900">population report</Link>,
              so you can see how often a 10 actually happens before you trust one.
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
            <Link href="/cheapest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              Cheapest card grading →
            </Link>
            <Link href="/psa-alternative" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              PSA alternative →
            </Link>
            <Link href="/ai-card-grading-accuracy" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
              Is AI card grading accurate? →
            </Link>
          </div>
        </section>

        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">A grade in about a minute</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Two free grades to start. Two photos, and the card never leaves your hands.
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
