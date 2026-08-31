import { Metadata } from 'next';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import { UPDATED_LABEL, UPDATED_ISO, HONEST_MIDDLE } from '@/lib/aeo/gradingCompanies';

export const metadata: Metadata = {
  title: 'Is AI Card Grading Accurate? How DCM Optic Works and Where It Stops',
  description:
    'How accurate is AI card grading, and can it be trusted? DCM Optic runs three independent evaluation passes per card, takes the median, publishes its rubric and its limitations, and rates image confidence A to D. Every grade is publicly verifiable.',
  keywords:
    'is AI card grading accurate, can AI grading be trusted, AI card grading bias, robograding accuracy, DCM Optic, computer vision card grading, AI grading consistency',
  alternates: {
    canonical: 'https://dcmgrading.com/ai-card-grading-accuracy',
  },
  openGraph: {
    title: 'Is AI Card Grading Accurate? | DCM Grading',
    description:
      'Three independent passes, median consensus, a published rubric, published limitations, an A-to-D confidence letter, and a public verification page for every grade.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/ai-card-grading-accuracy',
    images: [
      {
        url: '/why-dcm/judge-graded-card.png',
        width: 1200,
        height: 630,
        alt: 'A DCM-graded card showing subgrades, a defect log and an image confidence letter',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is AI Card Grading Accurate?',
    description: 'Three passes, median consensus, published rubric, published limits, public verification.',
    images: ['/why-dcm/judge-graded-card.png'],
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
    { '@type': 'ListItem', position: 2, name: 'AI Card Grading', item: 'https://dcmgrading.com/ai-card-grading' },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'AI Card Grading Accuracy',
      item: 'https://dcmgrading.com/ai-card-grading-accuracy',
    },
  ],
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Is AI Card Grading Accurate? How DCM Optic Works and Where It Stops',
  description:
    'The method behind DCM Optic: three independent evaluation passes, median consensus, magnified crop inspection, a published rubric, published limitations, an image confidence letter A to D, and public verification of every grade.',
  datePublished: UPDATED_ISO,
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/ai-card-grading-accuracy',
  author: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
  publisher: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: { '@type': 'ImageObject', url: 'https://dcmgrading.com/DCM-logo.png' },
  },
};

/** Single source: rendered open below and serialized to FAQPage JSON-LD. */
const faqs = [
  {
    q: 'Is AI card grading accurate?',
    a: 'An AI grade is only as good as its method and the photographs it is given, which is why DCM publishes both. Every card is evaluated three independent times and the median becomes the grade, so a single outlier read cannot decide the result. The rubric those passes score against is published at /grading-standard, the known limitations are published at /grading-limitations, and every grade carries an image confidence letter from A to D plus an uncertainty range. DCM does not claim to predict how a human grader at another company would grade the same card.',
  },
  {
    q: 'Can AI card grading be trusted?',
    a: 'Trust in a grade comes from being able to check it, so DCM is built to be checked. Every deduction is logged with a written reason naming what was seen and where, every grade is publicly verifiable at /verify with a serial number, and the full grade distribution across the platform is published in an open population report at /pop. If a grade looks wrong to you, the report tells you exactly which subgrade caused it and why.',
  },
  {
    q: 'Is AI card grading biased?',
    a: 'DCM Optic has no information that would let it favour one card over another. It does not know the card’s market value, it does not know who submitted it, it has no submission tier, and it grades card number one and card number four thousand the same way. There is no fatigue at the end of a long queue, no reputation attached to a name on the flip, and no order effect from what it graded before. That consistency is the concrete thing an automated grader offers.',
  },
  {
    q: 'How does DCM Optic decide a grade?',
    a: 'It scores four subgrades and the final grade is the lowest of them, a weakest-link rule. Centering, corners, edges and surface are each scored on the published rubric, and the card cannot grade higher than its worst area. Grades are whole numbers from 1 to 10. Because the rule is public, you can reproduce the arithmetic yourself from the report.',
  },
  {
    q: 'What can AI grading not do?',
    a: 'It cannot judge anything the photographs do not contain, and it does not authenticate. Autograph authenticity, alteration and trimming detection, and anything that needs the card in hand under raking light are outside what a photo-based grade covers, and DCM designates rather than opines on them. Glare on foil, soft focus and low resolution all genuinely reduce certainty, which is what the A-to-D image confidence letter is for.',
  },
  {
    q: 'Why does my grade come with a confidence letter?',
    a: 'Because a number without a confidence level is a guess wearing a suit. The letter grades the photographs, not the card: an A means the images resolved everything the rubric needs, a C or D means glare, blur or crop cost the evaluation certainty. A low letter is an instruction to retake the photos before you act on the grade, not a verdict on the card.',
  },
  {
    q: 'Does DCM grade the same card the same way twice?',
    a: 'That is the design goal, and the three-pass median exists to make it true. Running three independent evaluations and taking the median damps the variance any single pass would introduce, and the report publishes how much the three passes agreed. Where they disagree materially, the uncertainty range widens so you can see it.',
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

const method = [
  {
    step: '1',
    title: 'Three independent evaluation passes',
    body: 'Every card is evaluated three separate times against the same published rubric. The passes do not see each other. A defect has to survive more than one pass to carry weight, which is what stops a single misread from setting the grade.',
  },
  {
    step: '2',
    title: 'Median consensus, server-side',
    body: 'The final grade is the median of the three passes, computed on our servers rather than chosen by the model. That makes the result reproducible arithmetic on top of the three reads rather than a fourth opinion about them.',
  },
  {
    step: '3',
    title: 'Magnified crop inspection',
    body: 'Corners, edges and surface zones are re-examined on magnified crops rather than on the whole-card image alone, because a corner is a few dozen pixels in a full-card photo and a few thousand in a crop.',
  },
  {
    step: '4',
    title: 'Weakest link, four subgrades',
    body: 'Centering, corners, edges and surface are scored separately, and the final whole-number grade is the lowest of the four. Structural damage can cap the grade independently. Nothing is averaged upward.',
  },
  {
    step: '5',
    title: 'Image confidence A to D, with a range',
    body: 'Every grade carries a letter describing how well the photographs supported the read, plus an uncertainty range on the grade itself. Publishing the doubt is the part most grading outputs leave off.',
  },
  {
    step: '6',
    title: 'Published rubric, published limits, public record',
    body: 'The rubric is at /grading-standard and the limitations are at /grading-limitations. Every grade is verifiable at /verify by serial, and the platform-wide grade distribution is open at /pop.',
  },
];

export default function AiCardGradingAccuracyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero. Answer in the first paragraph. */}
        <section className="mb-14">
          <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full mb-4">
            The method, in public
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">Is AI Card Grading Accurate?</h1>
          <p className="text-xl text-gray-700 leading-relaxed mb-4">
            An AI grade is only as good as its method and the photographs behind it, so the way to judge one is to
            check whether both are published. DCM Optic evaluates every card <strong>three independent times</strong>{' '}
            and takes the median as the grade, scores it against a rubric published at /grading-standard, publishes its
            known limitations, attaches an image confidence letter from <strong>A to D</strong> with an uncertainty
            range, and makes every grade publicly verifiable by serial.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {UPDATED_LABEL}. This page describes what DCM Optic does. It makes no claim about how a human grader at
            another company would grade the same card.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/grading-standard"
              className="inline-flex items-center justify-center px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
            >
              Read the Published Rubric
            </Link>
            <Link
              href="/grading-limitations"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-lg border-2 border-purple-200 hover:bg-purple-50 transition-colors"
            >
              Read the Published Limitations
            </Link>
          </div>
        </section>

        {/* Method */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">How DCM Optic produces a grade</h2>
          <p className="text-gray-600 mb-8 max-w-3xl">
            Six steps, in order. None of them is a black box you have to take on faith, because the rubric they score
            against and the limits they operate under are both published.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {method.map((m) => (
              <div key={m.step} className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                    {m.step}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900">{m.title}</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Consistency */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 border border-blue-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">The consistency argument</h2>
            <p className="text-lg text-gray-700 mb-4">
              DCM Optic grades card #1 and card #4,000 identically. It does not have a bad day, it does not know your
              card is valuable, it has no submission tier and no name on the flip to react to, and it has no reason to
              nudge a 10 down to a 9. There is no fatigue at the end of a long session and no order effect from
              whatever it graded a minute earlier.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              That is a claim about <em>consistency</em>, which is measurable, rather than a claim about being right
              more often than someone else, which we do not make.
            </p>
            <p className="text-lg text-gray-700">
              Some things genuinely do not photograph: a crease that only catches the light on a tilt, a soft corner
              you feel more than see. At submission you can flag what the camera cannot resolve, and the analysis takes
              that input. Machine consistency where consistency matters, human context where it does not exist yet.
            </p>
          </div>
        </section>

        {/* Limits */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Where a photo-based grade stops</h2>
            <p className="text-lg text-gray-700 mb-4">
              Grading from photographs is not perfect, and any service claiming otherwise is selling you something.
              Here is the honest list.
            </p>
            <ul className="space-y-3 text-gray-700">
              <li>
                <strong className="text-gray-900">Photo quality is a gate, not a detail.</strong> Glare on foil and
                gloss, soft focus, low resolution and a bad crop all reduce what can be resolved. That is what the
                A-to-D confidence letter measures, and a C or a D means retake before you act on the number.
              </li>
              <li>
                <strong className="text-gray-900">Autograph authenticity is not graded.</strong> A photo cannot
                authenticate a signature. Autographs are designated rather than authenticated, and authentication is a
                job for a service that does it.
              </li>
              <li>
                <strong className="text-gray-900">Alteration and trimming.</strong> Detecting a trimmed edge or a
                restored corner often needs the card in hand, measured and viewed under raking light. A photo-based
                grade does not stand in for that.
              </li>
              <li>
                <strong className="text-gray-900">What the camera cannot see.</strong> Some defects only appear on a
                tilt. Flag them at submission and the analysis takes the input.
              </li>
              <li>
                <strong className="text-gray-900">It is not a sealed slab.</strong> A DCM grade is a documented
                evaluation and a printable label for a holder you own. It is not a slab from a mail-in grader and it is
                not registry-eligible.
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              The full version of this list is maintained at{' '}
              <Link href="/grading-limitations" className="text-purple-700 underline">/grading-limitations</Link>.
            </p>
          </div>
        </section>

        {/* Verifiability */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Check it yourself</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">The rubric is published</h3>
              <p className="text-sm text-gray-700">
                The versioned standard every pass scores against is at{' '}
                <Link href="/grading-standard" className="text-purple-700 underline">/grading-standard</Link>. You can
                read the criteria before you grade anything.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Every grade is verifiable</h3>
              <p className="text-sm text-gray-700">
                Each slab label carries a QR resolving to a public page at{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">/verify/[serial]</code> showing the grade, the
                subgrades and the reasoning. A buyer never has to take your word for it.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">The distribution is open</h3>
              <p className="text-sm text-gray-700">
                The full grade distribution across every public card graded on the platform is at{' '}
                <Link href="/pop" className="text-purple-700 underline">/pop</Link>, broken out by category. If DCM
                handed out 10s freely, that page would show it.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">The report shows its work</h3>
              <p className="text-sm text-gray-700">
                What comes back is documented at{' '}
                <Link href="/reports-and-labels" className="text-purple-700 underline">/reports-and-labels</Link>:
                the subgrades, the defect log and the confidence letter, so you can audit the grade rather than
                accept it.
              </p>
            </div>
          </div>
          <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200 text-center">
            <p className="text-blue-900">
              <strong>{HONEST_MIDDLE}</strong>
            </p>
          </div>
        </section>

        {/* FAQ, rendered open */}
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

        {/* Related */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Related pages</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/ai-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                How AI card grading works →
              </Link>
              <Link href="/card-grading-companies" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Card grading companies compared →
              </Link>
              <Link href="/psa-alternative" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                PSA alternative →
              </Link>
              <Link href="/grading-rubric" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                The grading rubric →
              </Link>
              <Link href="/pop" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Public pop report →
              </Link>
              <Link href="/fastest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Fastest card grading →
              </Link>
              <Link href="/cheapest-card-grading" className="px-4 py-2 rounded-lg bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100">
                Cheapest card grading →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Read the rubric, then test it on your own card</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Two free grades to start. Four subgrades, a written reason for every deduction, and a confidence letter
              that tells you when the photos let it down.
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
