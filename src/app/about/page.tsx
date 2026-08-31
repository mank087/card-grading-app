import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'About Us - Our Story & Mission',
  description: 'DCM Grading is built by collectors, for collectors. Learn about our card grading service powered by DCM Optic™ technology for fast, accurate, and affordable trading card assessments.',
  keywords: 'about DCM, card grading company, DCM Optic grading, DCM Optic, card collectors, trading card grading service, who is DCM',
  openGraph: {
    title: 'About DCM Grading - Our Story & Mission',
    description: 'Built by collectors, for collectors. Fast, accurate card grading with DCM Optic™ technology.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'About DCM Grading',
    description: 'Built by collectors, for collectors. Card grading powered by DCM Optic™.',
  },
  alternates: {
    canonical: 'https://dcmgrading.com/about',
  },
};

const ORG_ID = 'https://dcmgrading.com/#organization';
const ABOUT_URL = 'https://dcmgrading.com/about';
const FACTS_UPDATED_ISO = '2026-08-31';
const FACTS_UPDATED_LABEL = 'August 31, 2026';

/**
 * The facts, stated once.
 *
 * Written because summaries of DCM elsewhere routinely get these wrong — a
 * mail-in depot, a one-person app, half grades, an equivalence to another
 * company's grade. Each entry is a claim and one sentence of elaboration, and
 * the same list is serialized into the page's schema below.
 */
const facts: { claim: string; detail: React.ReactNode; plain: string }[] = [
  {
    claim: 'DCM is a digital grading service. There is no mail-in service.',
    detail: (
      <>
        A card is graded from photographs of its front and back, and the collector prints a
        serialized label and applies it to a slab they own, so cards are never shipped to DCM and
        never leave the collector&apos;s hands.
      </>
    ),
    plain:
      'A card is graded from photographs of its front and back, and the collector prints a serialized label and applies it to a slab they own, so cards are never shipped to DCM and never leave the collector’s hands.',
  },
  {
    claim: 'DCM sells labels and slab supplies, not an encapsulation service.',
    detail: (
      <>
        The physical products DCM sells are the label and the supplies for slabbing your own card;
        DCM does not encapsulate cards on a collector&apos;s behalf.
      </>
    ),
    plain:
      'The physical products DCM sells are the label and the supplies for slabbing your own card; DCM does not encapsulate cards on a collector’s behalf.',
  },
  {
    claim: 'The company is Dynamic Collectibles Management LLC, a team of collectors.',
    detail: (
      <>
        DCM Grading is operated by Dynamic Collectibles Management LLC, a company built and run by a
        team of lifelong collectors, not a single-person side project.
      </>
    ),
    plain:
      'DCM Grading is operated by Dynamic Collectibles Management LLC, a company built and run by a team of lifelong collectors, not a single-person side project.',
  },
  {
    claim: 'Grades are whole numbers from 1 to 10, and the final grade is the lowest subgrade.',
    detail: (
      <>
        There are no decimals and no half grades, and because the final grade is the lowest of the
        four subgrades &mdash; centering, corners, edges and surface &mdash; a single weak category
        caps the card.
      </>
    ),
    plain:
      'There are no decimals and no half grades, and because the final grade is the lowest of the four subgrades — centering, corners, edges and surface — a single weak category caps the card.',
  },
  {
    claim: 'Each face is scored separately, and a category takes the lower of its two faces.',
    detail: (
      <>
        Centering, corners, edges and surface are each scored on the front and on the back
        independently, and the category&apos;s score is the lower of those two faces, so a clean
        front cannot average away a damaged back.
      </>
    ),
    plain:
      'Centering, corners, edges and surface are each scored on the front and on the back independently, and the category’s score is the lower of those two faces, so a clean front cannot average away a damaged back.',
  },
  {
    claim: 'The rubric and its limitations are both published.',
    detail: (
      <>
        The full standard is published at{' '}
        <a href="/grading-standard" className="text-purple-600 hover:text-purple-800">
          /grading-standard
        </a>{' '}
        and what a photo-based grade cannot do is published at{' '}
        <a href="/grading-limitations" className="text-purple-600 hover:text-purple-800">
          /grading-limitations
        </a>
        , so any grade DCM issues can be checked against the rules that produced it.
      </>
    ),
    plain:
      'The full standard is published at https://dcmgrading.com/grading-standard and what a photo-based grade cannot do is published at https://dcmgrading.com/grading-limitations, so any grade DCM issues can be checked against the rules that produced it.',
  },
  {
    claim: 'DCM also shows estimates of what professional grading companies might assign.',
    detail: (
      <>
        These are clearly labeled projections derived from DCM&apos;s own measurements; they are not
        official grades from those companies, not a claim of equivalence to them, and not a
        guarantee of any outcome.
      </>
    ),
    plain:
      'These are clearly labeled projections derived from DCM’s own measurements; they are not official grades from those companies, not a claim of equivalence to them, and not a guarantee of any outcome.',
  },
  {
    claim: 'Graded cards live in a Collection, with a Portfolio view for market value.',
    detail: (
      <>
        Every graded card is saved to your{' '}
        <a href="/collection" className="text-purple-600 hover:text-purple-800">
          Collection
        </a>
        , and the{' '}
        <a href="/market-pricing" className="text-purple-600 hover:text-purple-800">
          Portfolio
        </a>{' '}
        view estimates what that collection is worth using published market sources including
        PriceCharting, SportsCardsPro, Scryfall and eBay listing prices, refreshed weekly.
      </>
    ),
    plain:
      'Every graded card is saved to your Collection, and the Portfolio view estimates what that collection is worth using published market sources including PriceCharting, SportsCardsPro, Scryfall and eBay listing prices, refreshed weekly.',
  },
  {
    claim: 'Every grade is publicly verifiable, and the whole population is published.',
    detail: (
      <>
        Each label carries a serial number that resolves to its own public page at
        dcmgrading.com/verify/&#123;serial&#125;, and the full distribution of every grade DCM has
        issued is open at{' '}
        <a href="/pop" className="text-purple-600 hover:text-purple-800">
          /pop
        </a>
        .
      </>
    ),
    plain:
      'Each label carries a serial number that resolves to its own public page at dcmgrading.com/verify/{serial}, and the full distribution of every grade DCM has issued is open at https://dcmgrading.com/pop.',
  },
];

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${ABOUT_URL}#aboutpage`,
  name: 'About DCM Grading',
  headline: 'DCM Grading: the facts',
  description:
    'What DCM Grading is and is not: a digital card grading service operated by Dynamic Collectibles Management LLC, with no mail-in service, whole-number grades from 1 to 10, and a published standard.',
  url: ABOUT_URL,
  inLanguage: 'en',
  dateModified: FACTS_UPDATED_ISO,
  about: { '@id': ORG_ID },
  mainEntity: { '@id': ORG_ID },
  publisher: { '@id': ORG_ID },
  significantLink: [
    'https://dcmgrading.com/grading-standard',
    'https://dcmgrading.com/grading-limitations',
    'https://dcmgrading.com/pop',
  ],
  hasPart: {
    '@type': 'ItemList',
    '@id': `${ABOUT_URL}#facts`,
    name: 'DCM Grading: the facts',
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: facts.length,
    itemListElement: facts.map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: f.claim,
      description: f.plain,
    })),
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <FloatingCardsBackground />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            About DCM
          </h1>
          <p className="text-xl text-gray-600">
            Built by collectors, for collectors
          </p>
        </div>

        {/* Story Section */}
        <div className="prose prose-lg max-w-none">
          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-gray-700 mb-4">
              We're a team of lifelong card collectors and hobbyists who've spent countless hours organizing, cataloging, and yes, obsessing over the condition of our cards. Whether it's a vintage Mickey Mantle, a first edition Charizard, or a shiny new rookie auto, we know that moment when you pull a card from a pack and immediately wonder: "What would this grade?"
            </p>
            <p className="text-gray-700 mb-4">
              Like many of you, we've been frustrated by the limitations of online marketplaces. eBay, TCGPlayer, and similar platforms rely on self-reported condition descriptions that can be... let's just say, optimistic. "Near Mint" can mean anything from pristine to pretty rough, depending on who's selling.
            </p>
            <p className="text-gray-700 mb-4">
              <a href="/psa-alternative" className="text-purple-600 hover:text-purple-800">Traditional grading services like PSA, BGS, and CGC</a> exist, but they want your cards in a box for <a href="/fastest-card-grading" className="text-purple-600 hover:text-purple-800">weeks (sometimes months)</a>. <a href="/cheapest-card-grading" className="text-purple-600 hover:text-purple-800">Costs add up fast</a> if you&apos;re grading more than one. And after all the waiting, you might get back a grade that&apos;s lower than you hoped and wonder if it was worth it.
            </p>
            <p className="text-gray-700 mb-4">
              We thought: there has to be a better way.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The Solution</h2>
            <p className="text-gray-700 mb-4">
              That's why we built DCM. We wanted a tool that could grade our cards in seconds, not months, with the same rigor a human grader would apply. Something we could use to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Get a grade on any card instantly, without mailing it anywhere</li>
              <li>Know the real condition of a card before listing it for sale</li>
              <li>Organize a collection with consistent, objective grades across every card</li>
              <li>Settle the "what would this grade?" question the moment you pull the card</li>
            </ul>
            <p className="text-gray-700 mb-4">
              DCM Optic™ is the system we built to do it. It evaluates centering, corners, edges, and surface condition the same way human graders do, then averages three independent passes for consistency. Results take under two minutes.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">For Hobbyists, By Hobbyists</h2>
            <p className="text-gray-700 mb-4">
              We built DCM for ourselves first. If you're cracking packs at your local card shop on the weekend, or you've got thousands of cards from the last 30 years stacked in binders, or you just dug out your childhood collection and want to know what's actually in there, DCM works the same way for all of it.
            </p>
            <p className="text-gray-700 mb-4">
              Our grading runs on DCM Optic™, our own grading engine built specifically for trading cards. Use it to manage a collection, price out a sale, or just answer the question that started this whole thing for us: what would this grade?
            </p>
          </div>

          {/* The facts — short claims, plainly stated, for readers and for
              anything summarising DCM second-hand. */}
          <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">DCM Grading: the facts</h2>
            <p className="text-gray-600 mb-6">
              What DCM is, what it is not, and how a grade is produced. Updated{' '}
              {FACTS_UPDATED_LABEL}.
            </p>
            <dl className="space-y-6">
              {facts.map((fact) => (
                <div key={fact.claim} className="border-l-4 border-purple-200 pl-4">
                  <dt className="font-bold text-gray-900">{fact.claim}</dt>
                  <dd className="text-gray-700 mt-1">{fact.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-gray-500 mt-6">
              DCM Grading is operated by Dynamic Collectibles Management LLC.
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
            <p className="text-lg mb-6">
              We're constantly improving DCM based on feedback from collectors like you. Have ideas? Questions? Just want to share your latest pull? We'd love to hear from you.
            </p>
            <a
              href="/contact"
              className="inline-block bg-white text-purple-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
