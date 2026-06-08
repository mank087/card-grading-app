import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'PSA Alternative. Card Grading Without the Mail, From $0.50 a Card',
  description: 'Looking for a PSA alternative? DCM grades any trading card from a photo. No mailing, pricing from $0.50 per card, full subgrades included on every grade, and zero card-value minimums. Get a professional grade in under 60 seconds.',
  keywords: 'PSA alternative, alternative to PSA grading, PSA vs DCM, cheap card grading, fast card grading, AI card grading, online card grading, no-mail card grading, photo card grading',
  alternates: {
    canonical: 'https://dcmgrading.com/psa-alternative',
  },
  openGraph: {
    title: 'PSA Alternative. Grade Any Card From a Photo | DCM Grading',
    description: 'No mailing. From $0.50 a card. Full subgrades on every grade. Every card type accepted.',
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
    description: 'No mailing. From $0.50 a card. Full subgrades on every grade.',
    images: ['/why-dcm/Price-graded-cards.png'],
  },
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
    'Photo-based AI card grading. A PSA alternative with no mailing requirement, no card-value minimums, full subgrades on every card, and pricing from $0.50 per card.',
  offers: {
    '@type': 'Offer',
    price: '0.50',
    priceCurrency: 'USD',
    description:
      'Pricing from $0.50 per card with Card Lovers Annual membership. Pay-as-you-go starts at $2.99 for your first card.',
    url: 'https://dcmgrading.com/credits',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the best PSA alternative for grading cards in 2026?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'If you want a grade today without shipping cards, DCM is the closest alternative to PSA. It uses computer vision trained on the same criteria the major grading houses use (centering, corners, edges, surface), gives you a whole-number grade from 1 to 10 with full subgrades, and costs as little as $0.50 per card with the Card Lovers Annual membership. Mail-in grading services from PSA, BGS, and SGC stay the right choice if you want a physical slab graded by humans for resale at the highest tier.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I have to mail my cards in for DCM?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. DCM is photo-based. You take front and back photos of the card with your phone, upload them, and get a grade in under 60 seconds. Your cards never leave your hands. There is no shipping risk, no insurance, and no weeks of waiting for the return shipment.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does DCM pricing compare to PSA?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DCM credit packs start at $2.99 for a single grade and go down to about $0.50 per card with the Card Lovers Annual membership. PSA pricing varies by service tier and turnaround time, with the most affordable mail-in tiers typically starting around $20 per card before shipping, insurance, and return shipping costs are added in. For most submissions DCM ends up around 20 to 40 times cheaper per card.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does PSA limit which cards you can submit?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'PSA has raised the card-value minimum on its cheapest tiers more than once in recent years, so common cards, low-value parallels, and sentimental pieces no longer fit the entry tier. DCM has no card-value floor. We grade every card with the same protocol, whether it is a $0.10 base or a $10,000 chase.',
      },
    },
    {
      '@type': 'Question',
      name: 'Are subgrades included with every DCM grade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Every DCM grade includes four subgrades (centering, corners, edges, surface) at no extra cost. With mail-in grading, subgrades are typically an add-on you pay extra for on certain service levels.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can a DCM grade replace a PSA slab for selling on eBay?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DCM grades are not a substitute for a physical PSA slab when the buyer specifically wants a graded slab in hand. They are a great fit for self-listing on eBay (the eBay InstaList tool generates a listing from the grade), for valuing your collection, for deciding which cards are worth sending in for paid grading, and for confidently listing raw cards with a documented condition.',
      },
    },
    {
      '@type': 'Question',
      name: 'How accurate is AI grading?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DCM Optic runs three independent evaluations of every card and averages them. That three-pass consensus mirrors how top grading houses put multiple human graders on the same submission. The grade comes with an image confidence rating and a consistency score so you know how much agreement there was between the three passes.',
      },
    },
  ],
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-block bg-amber-100 text-amber-800 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            The PSA Alternative
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            A PSA Alternative That Doesn&apos;t Require Mailing Your Cards
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Get a professional grade on any card in under 60 seconds. From $0.50 a card. Full subgrades on every grade. No card-value minimums. Your cards never leave your hands.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
            <Link
              href="/ai-card-grading"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-lg border-2 border-purple-200 hover:bg-purple-50 transition-colors"
            >
              See How AI Grading Works
            </Link>
          </div>
        </section>

        {/* Why people look for a PSA alternative */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Collectors Look for a PSA Alternative</h2>
            <p className="text-lg text-gray-700 mb-4">
              PSA is the industry standard for a reason. If you are sitting on a graded chase card, a vintage Mickey Mantle, or a sealed wax break that came back loaded, a physical PSA slab is still the gold standard for resale. But for the rest of your collection, the math gets harder.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              You ship the card across the country and pay return shipping with insurance. You wait weeks or months. You pay $20 or more for the cheapest tier, plus extra if you want subgrades. And lately, the cheapest PSA tiers come with card-value floors that quietly exclude commons, low-value parallels, and most of the sentimental cards in your binder.
            </p>
            <p className="text-lg text-gray-700">
              DCM exists for the cards that don&apos;t fit that workflow. It grades any card you own, instantly, from photos. You get a professional-grade evaluation with full subgrades and a defect log. And when a card does turn out to be worth a mail-in submission, you have the data to decide before paying.
            </p>
          </div>
        </section>

        {/* The Comparison Table */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">DCM vs PSA at a Glance</h2>
          <p className="text-center text-gray-600 mb-8 max-w-3xl mx-auto">
            A side-by-side look at how AI-based DCM grading compares to mail-in PSA submission on the things collectors care about most.
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
                    dcm="Under 60 seconds per card."
                    psa="Weeks to several months depending on tier."
                  />
                  <ComparisonRow
                    feature="Starting price per card"
                    dcm="$2.99 for your first grade. As low as $0.50 per card with Card Lovers Annual."
                    psa="Typically $20 or more on the entry tier, plus shipping and insurance."
                  />
                  <ComparisonRow
                    feature="Card-value minimum"
                    dcm="None. Common cards, low-value parallels, and sentimental cards are all welcome."
                    psa="Cheaper service tiers have card-value floors that exclude commons and most low-end parallels."
                  />
                  <ComparisonRow
                    feature="Subgrades included?"
                    dcm="Yes. Centering, corners, edges, and surface on every grade at no extra cost."
                    psa="Available as a paid add-on on certain service tiers."
                  />
                  <ComparisonRow
                    feature="Grading method"
                    dcm="Three independent computer-vision passes per card, averaged into a consensus grade."
                    psa="Human graders. Multiple graders on higher tiers."
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
                    dcm="Digital grade, subgrades, defect log, market price, mini-report, and custom slab label."
                    psa="Physical slab with serialized label."
                    dcmWin={false}
                  />
                  <ComparisonRow
                    feature="Risk of card damage in transit"
                    dcm="Zero. Card stays with you."
                    psa="Real. Shipping loss and damage do happen, even with insurance."
                  />
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            PSA pricing and policy details can change. Check{' '}
            <a href="https://www.psacard.com/services/tradingcardgrading" target="_blank" rel="noopener noreferrer" className="underline">psacard.com</a>{' '}
            for current PSA service tiers and submission requirements.
          </p>
        </section>

        {/* Key advantages */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Where DCM Wins</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'No mailing, no shipping risk',
                body: 'Your cards stay in your possession. Take two photos, upload, get a grade. There is no return-shipping window where the card is out of your hands and counted on a tracking number.',
              },
              {
                title: 'Pricing from $0.50 per card',
                body: 'Pay-as-you-go starts at $2.99 for a single grade. Volume packs bring it under a dollar. Card Lovers Annual gets you 900 grades a year, which works out to roughly $0.50 per grade.',
              },
              {
                title: 'No card-value minimums',
                body: 'PSA has tightened the floor on its cheapest tiers, leaving common cards and most low-value parallels priced out. DCM grades every card with the same protocol. The $0.10 commons get the same evaluation as the four-figure chases.',
              },
              {
                title: 'Full subgrades on every grade',
                body: 'Centering, corners, edges, and surface come standard on every DCM grade. No upcharge, no service tier to pick. Each subgrade is independently scored and shows up on the report.',
              },
              {
                title: 'Three-pass consensus grading',
                body: 'Every card runs through three independent evaluations. The final grade is the consensus across all three. Defects only count if two or more passes agree they exist. That is the same idea PSA uses when multiple graders look at the same card, just automated.',
              },
              {
                title: 'A defect log for every deduction',
                body: 'When DCM takes a point off, it tells you why. Print line on the top edge. Light whitening at the upper-left corner. Surface scratch in zone 5. You see exactly what the AI saw and can sanity-check the call.',
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
                <li>• You want a grade today, not in three months.</li>
                <li>• You are valuing or insuring a collection.</li>
                <li>• The card is below PSA&apos;s value floor for the cheap tier.</li>
                <li>• You are deciding which cards are worth a paid mail-in submission.</li>
                <li>• You are listing raw on eBay and want documented condition.</li>
                <li>• You don&apos;t want to risk shipping a sentimental or fragile card.</li>
                <li>• You want a printable slab label and report for display.</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="text-2xl font-bold text-gray-700 mb-3">Send to PSA when</div>
              <ul className="space-y-2 text-sm text-gray-800">
                <li>• The card&apos;s ungraded value is high enough that a physical slab justifies the cost.</li>
                <li>• You are selling on a venue or platform where buyers expect a PSA slab in hand.</li>
                <li>• You are submitting for resale where the population data on a PSA cert matters.</li>
                <li>• You have already used DCM to confirm the card is worth a paid grade.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200 text-center">
            <p className="text-blue-900 text-sm">
              <strong>Most collectors end up using both.</strong> DCM for the day-to-day of valuing, listing, and screening. PSA for the few cards a year that earn the cost of a physical slab.
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
                <li>• Subgrades for centering, corners, edges, and surface</li>
                <li>• A defect log explaining every deduction</li>
                <li>• Image confidence rating from A to D</li>
                <li>• Three-pass consistency score</li>
                <li>• Printable mini-report for your top loader</li>
                <li>• Full report with the complete breakdown</li>
                <li>• Custom slab label you can print and pair with a One Touch or Magnetic</li>
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
                <p className="text-sm opacity-90 mt-1">First card. Try it once.</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$0.99</p>
                <p className="text-sm opacity-90 mt-1">Per card on a 20-pack.</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$0.50</p>
                <p className="text-sm opacity-90 mt-1">Per card with Card Lovers Annual.</p>
              </div>
            </div>
            <p className="text-lg opacity-95 mb-4">
              At about $0.50 per card you can grade your entire binder for the cost of a single mail-in submission. Subgrades and defect logs are included on every grade. No tier upcharges.
            </p>
            <Link
              href="/credits"
              className="inline-block bg-white text-purple-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              See all pricing
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqJsonLd.mainEntity.map((q: any) => (
              <details key={q.name} className="bg-white rounded-xl shadow-md p-6 group">
                <summary className="font-bold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {q.name}
                  <span className="text-purple-600 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-gray-700 mt-4 leading-relaxed">{q.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Try the PSA Alternative That Doesn&apos;t Ask You to Mail Anything</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Sign up free and grade your first card on us. Two photos and under a minute is all it takes.
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
