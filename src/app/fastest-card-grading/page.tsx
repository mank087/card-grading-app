import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';
import Link from 'next/link';
import {
  COMPANIES,
  SOURCES,
  LAST_CHECKED,
  UPDATED_LABEL,
  UPDATED_ISO,
  HONEST_MIDDLE,
} from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = completeMetadata({
  title: "Fastest Card Grading: Turnarounds Compared",
  description:
    "Published turnarounds for PSA, Beckett, SGC and CGC run 15 to 100 business days on their cheapest open tiers. DCM grades from two photos in about 60 seconds.",
  keywords:
    'fastest card grading, card grading turnaround times, how long does card grading take, fast card grading service, instant card grading, same day card grading',
  alternates: { canonical: 'https://dcmgrading.com/fastest-card-grading' },
  openGraph: {
    title: 'Fastest Card Grading (2026) | DCM Grading',
    description:
      'Published turnarounds for the mail-in majors, side by side with a grade that takes about 60 seconds. Sourced and dated, October 2026.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/fastest-card-grading',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'Card grading turnaround times compared, October 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fastest Card Grading (2026)',
    description: 'Published turnarounds for PSA, Beckett, SGC and CGC vs about 60 seconds at home.',
    images: ['/why-dcm/Price-graded-cards.png'],
  },
});

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
    'Published turnaround times for PSA, Beckett, SGC, CGC and DCM, with sources and a check date on every row (October 2026).',
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
    a: 'DCM returns a grade in about 60 seconds because nothing ships: you photograph the front and back and the grade comes back with four subgrades and a written reason for every deduction. Among the mail-in graders, as of October 8, 2026, Beckett Express publishes the shortest turnaround on a cheapest open tier at 15 business days, followed by SGC Standard at 40 or more, CGC Economy at 90 and PSA Standard at 90 to 100. Every mail-in service also sells faster tiers at higher prices.',
  },
  {
    q: 'How long does card grading take in 2026?',
    a: 'On the cheapest open single-card tiers, published turnarounds run from 15 to 100 business days as of October 8, 2026: Beckett Express 15, SGC Standard 40 or more, CGC Economy 90 and PSA Standard 90 to 100. CGC Bulk is about 150 working days. Those figures exclude shipping in both directions, and they are estimates, not guarantees. PSA reported a backlog above 12 million cards in late July 2026 and still lists its Value services as temporarily paused, and Beckett paused its two cheapest tiers on August 5 after a reported 102 percent year-over-year rise in submissions; they remain paused.',
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
    <main className="dcm-brand dcm-editorial min-h-screen relative dcm-editorial-soft">

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <section className="mb-12 dcm-editorial-heading">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            Turnaround, sourced
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">Fastest Card Grading</h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            The fastest way to get a card graded is not to ship it. DCM grades from two photos in{' '}
            <strong>about 60 seconds</strong>, with no packing, no insurance and no return queue. Among the mail-in
            graders as of October 8, 2026, Beckett publishes <strong>15 business days</strong> on Express, SGC{' '}
            <strong>40 or more</strong> on Standard, CGC <strong>90</strong> on Economy and PSA{' '}
            <strong>90 to 100</strong> on Standard, all before shipping in either direction.
          </p>
          <p className="text-sm text-gray-500">
            {UPDATED_LABEL}. Figures last checked {LAST_CHECKED}; each row shows its own check
            date. Business days, shipping excluded. Sources below.
          </p>
        </section>

        {/* Table */}
        <section className="mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Published turnaround times, fastest first</h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white text-left dcm-editorial-dark">
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
                      <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">
                        {c.name}
                        <div className="text-xs font-normal text-gray-500 mt-1">Checked {c.checked}</div>
                      </td>
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
            Turnaround is quoted for the cheapest open tier at each company as of the row&apos;s check date. Faster
            tiers exist everywhere at higher prices. As of October 8, 2026, CGC Standard is $55 for 10 days and CGC
            Express $100 for 5, SGC Expedited (2 to 3 business days) starts at $150, PSA Express is $199 for 20 to 30
            business days and PSA Super Express is $349 for 10 to 15.
          </p>
        </section>

        {/* Why the numbers are a floor */}
        <section className="mb-14">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Read published turnarounds as a floor</h2>
            <p className="text-gray-700 mb-3">
              PSA&apos;s submission updates page reported a backlog above 12 million cards in late July 2026, and as
              of October 8, 2026 its services page lists Value services as temporarily paused. Beckett paused its Base
              and Standard tiers on August 5, 2026 after a reported 102 percent year-over-year rise in submissions,
              and as of October 8, 2026 they remain temporarily paused with a waitlist open.
            </p>
            <p className="text-gray-700">
              Published turnarounds are estimates, not guarantees. Add insured shipping in both directions on
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
          <div className="rounded-2xl p-12 text-white shadow-xl dcm-editorial-dark">
            <h2 className="text-3xl font-bold mb-4">A grade in about a minute</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Two free grades to start. Two photos, and the card never leaves your hands.
            </p>
            <Link
              href="/get-started"
              className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg dcm-editorial-secondary"
            >
              Grade Your First Card Free
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
