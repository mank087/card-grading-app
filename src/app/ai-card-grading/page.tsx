import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'AI Card Grading. Professional Grades in Under 60 Seconds',
  description: 'AI card grading powered by DCM Optic. Three independent passes evaluate centering, corners, edges, and surface in under a minute. Grade any card you own. Sports, Pokémon, MTG, Lorcana, and more. No mailing.',
  keywords: 'AI card grading, automated card grading, computer vision card grading, robograding, instant card grading, AI trading card grading, photo card grading, online card grading, DCM Optic, three-pass grading',
  alternates: {
    canonical: 'https://dcmgrading.com/ai-card-grading',
  },
  openGraph: {
    title: 'AI Card Grading. Instant Professional Grades | DCM Grading',
    description: 'Three independent AI passes per card. Sports, Pokémon, MTG, Lorcana, and more. No mailing required.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/ai-card-grading',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'AI card grading by DCM Optic showing market price uplift on graded cards',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Card Grading. Instant Professional Grades',
    description: 'Three independent AI passes per card. Under a minute. No mailing required.',
    images: ['/why-dcm/Price-graded-cards.png'],
  },
};

// JSON-LD Service schema. Google can surface this as a rich result for
// service queries like "ai card grading near me" or "ai trading card
// grading service." Keep aligned with the visible page copy so the
// structured data and on-page content don't drift apart.
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI Trading Card Grading',
  name: 'DCM Grading. AI Card Grading',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: 'https://dcmgrading.com/DCM-logo.png',
  },
  areaServed: 'Worldwide',
  description:
    'Photo-based AI card grading using three-pass consensus computer vision. Evaluates centering, corners, edges, and surface across sports, Pokémon, MTG, Lorcana, One Piece, Yu-Gi-Oh, Star Wars, and other trading cards.',
  offers: {
    '@type': 'Offer',
    price: '0.50',
    priceCurrency: 'USD',
    description:
      'Pricing from $0.50 per card with Card Lovers Annual membership. Pay-as-you-go starts at $2.99 for your first card.',
    url: 'https://dcmgrading.com/credits',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Card Categories Supported',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sports Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pokémon Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Magic: The Gathering Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Disney Lorcana Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'One Piece TCG Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Yu-Gi-Oh! Card Grading' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Star Wars Unlimited Card Grading' } },
    ],
  },
};

// FAQPage schema. Eligible for the "People also ask" rich result.
// Keep questions and answers in lockstep with the visible FAQ section
// at the bottom of the page.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does AI card grading work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You upload clear photos of the front and back of your card. DCM Optic runs three independent computer-vision passes over the images, measuring centering, examining all four corners and all four edges, and scanning the full surface in a 9-zone grid. The three passes are averaged into a final whole-number grade from 1 to 10. The whole evaluation takes under 60 seconds.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is AI card grading accurate compared to PSA, BGS, or SGC?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'DCM applies the same industry-standard criteria the major grading houses use. 55/45 centering minimums for a perfect grade, structural-damage caps for creases or corner lift, and per-category specialization for foil and chrome surfaces. The three-pass consensus model mirrors how top grading companies put multiple human graders on the same card before assigning a final grade.',
      },
    },
    {
      '@type': 'Question',
      name: 'What card types can DCM grade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every major trading card category. Sports cards (baseball, basketball, football, hockey, soccer, wrestling), Pokémon (English and Japanese), Magic: The Gathering, Disney Lorcana, One Piece TCG, Yu-Gi-Oh!, Star Wars Unlimited, Garbage Pail Kids, and other non-sports cards. No card-value floor, no parallel or rarity restrictions.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does AI card grading cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Pay-as-you-go credit packs start at $2.99 for a single grade. Volume packs drop the per-grade cost. With the Card Lovers Annual membership it works out to about $0.50 per card. Compare that to traditional mail-in grading where the cheapest tiers are typically $20 or more per card before shipping.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to mail my cards in?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. AI card grading is photo-based. Your cards never leave your hands. There is no shipping risk, no insurance to buy, and no months-long wait for return shipping.',
      },
    },
    {
      '@type': 'Question',
      name: 'What information do I get with each grade?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every grade comes with subgrades for centering, corners, edges, and surface, a defect log explaining each deduction, an image confidence rating from A to D based on photo quality, a three-pass consistency score showing how closely the three evaluations agreed, and a printable mini-report and full report. Card Lovers also get current market pricing tied to the grade.',
      },
    },
  ],
};

export default function AiCardGradingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      {/* Structured data for search engines. Lives inside the page so it
          ships with the same revision as the visible copy. */}
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
          <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            DCM Optic. Three-Pass Consensus
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            AI Card Grading. Professional Grades in Under 60 Seconds
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Upload two photos. Get a full PSA-aligned grade with subgrades, defect notes, and market pricing in less than a minute. No mailing, no waiting weeks, no card-value minimums.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </Link>
            <Link
              href="/grading-rubric"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-lg border-2 border-purple-200 hover:bg-purple-50 transition-colors"
            >
              See the Full Grading Rubric
            </Link>
          </div>
        </section>

        {/* What AI Card Grading Means */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What is AI Card Grading?</h2>
            <p className="text-lg text-gray-700 mb-4">
              AI card grading, sometimes called <strong>robograding</strong> or <strong>automated card grading</strong>, uses computer vision to evaluate a trading card the way a human grader would. It looks at centering, corners, edges, and surface for damage and printing defects, then assigns a standardized grade on a 1 to 10 scale, plus subgrades and a written explanation.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              DCM Optic is our AI grading engine. We built it specifically for trading cards, trained it on the same criteria PSA, BGS, and SGC use, and we run every card through <strong>three independent evaluations</strong> before producing a final grade. That means the grade you see is a consensus, not a single opinion.
            </p>
            <p className="text-lg text-gray-700">
              The whole process happens from your phone or browser. No shipping, no waiting weeks for a slab to come back, no minimum card value.
            </p>
          </div>
        </section>

        {/* Three-Pass Consensus */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 border border-blue-200">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-white text-2xl font-bold">3×</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Three-Pass Consensus Grading</h2>
            </div>
            <p className="text-lg text-gray-700 mb-6">
              Single-pass AI grading systems give you one opinion. DCM runs <strong>three complete, independent evaluations</strong> of every card and averages the result. It is the same technique top grading houses use when they put multiple human graders on a single submission, just automated.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[
                { n: '1', title: 'First Pass', body: 'A full evaluation of centering, corners, edges, and surface with the complete defect log.' },
                { n: '2', title: 'Second Pass', body: 'A fully independent re-examination that catches anything the first pass missed.' },
                { n: '3', title: 'Third Pass', body: 'Final independent verification, followed by the consensus calculation across all three passes.' },
              ].map((p) => (
                <div key={p.n} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-blue-600 font-bold">{p.n}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{p.title}</h3>
                  <p className="text-sm text-gray-600">{p.body}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200">
              <h3 className="font-bold text-gray-900 mb-3">Why three passes beats one</h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• <strong>Reduces variance.</strong> Averaging three evaluations produces more consistent grades than any single pass can.</li>
                <li>• <strong>Consensus-based defects.</strong> Only defects confirmed in two or more passes affect your final grade.</li>
                <li>• <strong>Consistency score.</strong> When all three passes agree, your grade comes with a high-confidence flag.</li>
                <li>• <strong>Mirrors how PSA, BGS, and SGC grade.</strong> Multiple-grader consensus, automated, and free of the day-to-day inconsistency that comes with rotating human graders.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* What gets evaluated */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">What the AI Actually Looks At</h2>
          <p className="text-center text-gray-600 mb-8 max-w-3xl mx-auto">
            Every grade is broken down into four subgrades plus a defect log. No black-box scoring. Every deduction is tied to something visible in your photos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Centering</h3>
              <p className="text-sm text-gray-600">
                Independent left/right and top/bottom border ratios on both the front and back of the card. PSA-aligned, with 55/45 or better required for a 10.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Corners</h3>
              <p className="text-sm text-gray-600">
                All eight corners (four front, four back) examined for fiber exposure, rounding, impact damage, and structural lift.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-teal-500">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Edges</h3>
              <p className="text-sm text-gray-600">
                Full edge-length scan for whitening, chipping, nicks, factory cut quality, and dent damage.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Surface</h3>
              <p className="text-sm text-gray-600">
                A 9-zone grid scan on both surfaces (18 zones total) for scratches, print defects, white dots, and creases. Finish-aware, so chrome, refractor, and holographic cards get specialized examination.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Pre-grading checks run first.</strong> Before the AI scores condition, it verifies authentication (autograph, trimming detection, alterations), identifies finish type (refractor, chrome, holographic, matte), and detects whether the card is already in a slab or holder. <Link href="/grading-rubric" className="underline font-semibold">Read the full grading rubric</Link>.
            </p>
          </div>
        </section>

        {/* Card types supported */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Every Card Type, No Restrictions</h2>
          <p className="text-center text-gray-600 mb-8 max-w-3xl mx-auto">
            DCM grades any trading card. Common, rare, valuable, or sentimental. <strong>No card-value floors, no parallel restrictions, no rarity-tier minimums.</strong>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { emoji: '⚾', name: 'Sports', sub: 'Baseball, Basketball, Football, Hockey, Soccer, Wrestling', href: '/sports-grading' },
              { emoji: '⚡', name: 'Pokémon', sub: 'English, Japanese, Promos, Full Art, Vintage', href: '/pokemon-grading' },
              { emoji: '🧙', name: 'Magic: The Gathering', sub: 'Foils, Borderless, Old-Border, Modern' },
              { emoji: '✨', name: 'Disney Lorcana', sub: 'All Sets, Enchanted, Special Foils' },
              { emoji: '🏴‍☠️', name: 'One Piece TCG', sub: 'Leader, Character, Manga Art, Parallel' },
              { emoji: '🐉', name: 'Yu-Gi-Oh!', sub: 'Vintage and Modern, all rarities' },
              { emoji: '⚔️', name: 'Star Wars Unlimited', sub: 'All factions, Hyperspace, Showcase' },
              { emoji: '🃏', name: 'Other', sub: 'Garbage Pail Kids, non-sports, custom' },
            ].map((c) => {
              const inner = (
                <>
                  <div className="text-3xl mb-2">{c.emoji}</div>
                  <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{c.sub}</p>
                </>
              );
              return c.href ? (
                <Link key={c.name} href={c.href} className="bg-white rounded-xl shadow-md p-4 text-center hover:shadow-lg hover:border-purple-300 border border-transparent transition-all">
                  {inner}
                </Link>
              ) : (
                <div key={c.name} className="bg-white rounded-xl shadow-md p-4 text-center">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        {/* Workflow */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">From Photo to Grade in Under 60 Seconds</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { n: '1', title: 'Snap two photos', body: 'Front and back of the card. Your phone camera is plenty.' },
              { n: '2', title: 'Upload', body: 'Mobile app or browser. Auto-cropped and quality-scored.' },
              { n: '3', title: 'Three passes', body: 'DCM Optic runs three independent evaluations.' },
              { n: '4', title: 'Get your grade', body: 'Whole-number 1 to 10 grade, subgrades, defect log, market price.' },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-xl shadow-md p-5">
                <div className="w-9 h-9 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold mb-3">{s.n}</div>
                <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reports + Labels */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md overflow-hidden md:grid md:grid-cols-2">
            <div className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Reports and Slab Labels Included</h2>
              <p className="text-gray-700 mb-4">
                Every graded card comes with a printable mini-report that fits a top loader, plus a full report with the complete defect breakdown. Use Label Studio to design your own slab label, then print it on a 2.5×3.5 foldable card and slide it into a One Touch or Magnetic holder.
              </p>
              <ul className="text-sm text-gray-700 space-y-1 mb-4">
                <li>• Mini-report for top-loader display</li>
                <li>• Full report with three-pass breakdown and market price</li>
                <li>• Custom slab labels via Label Studio</li>
                <li>• Card Lover and VIP emblems for members</li>
              </ul>
              <Link href="/reports-and-labels" className="inline-flex items-center text-purple-600 font-semibold hover:text-purple-700">
                See reports and labels
              </Link>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center p-6">
              <Image
                src="/why-dcm/Price-graded-cards.png"
                alt="Raw vs DCM-graded card market price comparison showing the value lift from professional grading"
                width={500}
                height={400}
                className="rounded-lg shadow-md w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Pricing. From $0.50 per Card</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$2.99</p>
                <p className="text-sm opacity-90 mt-1">First card, try it</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$0.99</p>
                <p className="text-sm opacity-90 mt-1">Per card on volume packs</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold">$0.50</p>
                <p className="text-sm opacity-90 mt-1">Per card with Card Lovers Annual</p>
              </div>
            </div>
            <p className="text-lg opacity-95 mb-4">
              Compare that to traditional mail-in grading at $20 or more per card before shipping and insurance, with weeks-to-months turnaround.
            </p>
            <Link
              href="/credits"
              className="inline-block bg-white text-purple-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              See all pricing
            </Link>
          </div>
        </section>

        {/* FAQ. Also serialized to JSON-LD above. */}
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
            <h2 className="text-3xl font-bold mb-4">Ready to grade your first card?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Sign up free and grade your first card on us. No shipping, no waiting, no minimums.
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
