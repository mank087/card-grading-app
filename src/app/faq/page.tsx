import { Metadata } from 'next';
import Link from 'next/link';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about DCM card grading services, our three-pass consensus technology, pricing, supported card types, and more.',
  keywords: 'DCM grading FAQ, card grading questions, AI card grading, three-pass grading, card authentication, grading accuracy, how does card grading work',
  openGraph: {
    title: 'FAQ - Frequently Asked Questions | DCM Grading',
    description: 'Find answers to common questions about DCM card grading services, pricing, and supported card types.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'FAQ - DCM Grading',
    description: 'Answers to common questions about AI-powered card grading.',
  },
};

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category: string;
}

const faqs: FAQItem[] = [
  // Getting Started
  {
    id: 'what-is-dcm',
    question: 'What is DCM Grading?',
    answer: (
      <>
        <p className="mb-3">
          DCM Grading is an AI-powered card grading service that provides professional-quality condition assessments for trading cards. Using our proprietary DCM Optic™ technology, we analyze your card images and deliver accurate grades in under 60 seconds.
        </p>
        <p>
          Unlike traditional grading services that can take weeks or months, DCM provides instant results while maintaining the same rigorous standards used by professional grading companies.
        </p>
      </>
    ),
    category: 'Getting Started',
  },
  {
    id: 'how-it-works',
    question: 'How does DCM Grading work?',
    answer: (
      <>
        <p className="mb-3">
          Simply upload clear photos of your card's front and back. Our DCM Optic™ AI engine performs a comprehensive multi-phase evaluation examining corners, edges, surface condition, and centering.
        </p>
        <p className="mb-3">
          What makes us unique is our <strong>three-pass consensus system</strong> — every card is evaluated three independent times, with results averaged and cross-validated. This eliminates errors and ensures the most accurate grade possible.
        </p>
        <p>
          Within seconds, you'll receive a detailed grade report including component scores, defect documentation, and a confidence rating based on your image quality.
        </p>
      </>
    ),
    category: 'Getting Started',
  },
  {
    id: 'why-use-dcm',
    question: 'Why should I use DCM instead of traditional grading services?',
    answer: (
      <>
        <p className="mb-3"><strong>Speed:</strong> Get results in under 60 seconds, not weeks or months.</p>
        <p className="mb-3"><strong>Cost:</strong> Grade cards for a fraction of the cost of traditional services.</p>
        <p className="mb-3"><strong>Convenience:</strong> Grade from anywhere, anytime — no shipping required.</p>
        <p className="mb-3"><strong>Accuracy:</strong> Our three-pass consensus system delivers highly accurate, consistent grades.</p>
        <p className="mb-3"><strong>Pre-Screening:</strong> Use DCM to evaluate cards before deciding which ones are worth submitting to PSA, BGS, or CGC.</p>
        <p><strong>Transparency:</strong> See exactly why your card received its grade with detailed defect documentation.</p>
      </>
    ),
    category: 'Getting Started',
  },
  {
    id: 'card-types',
    question: 'What types of cards can DCM grade?',
    answer: (
      <>
        <p className="mb-3">DCM supports a wide variety of trading cards:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Sports Cards:</strong> Baseball, Basketball, Football, Hockey, Soccer, Wrestling, UFC, and more</li>
          <li><strong>Pokémon:</strong> All sets including Japanese, Promos, Full Art, and vintage</li>
          <li><strong>Magic: The Gathering:</strong> All sets, foils, borderless, and special editions</li>
          <li><strong>Disney Lorcana:</strong> All sets and rarities</li>
          <li><strong>Other TCGs:</strong> Yu-Gi-Oh!, One Piece, and other collectible card games</li>
        </ul>
        <p>Our system automatically detects card type and applies specialized evaluation criteria optimized for each category.</p>
      </>
    ),
    category: 'Getting Started',
  },

  // Three-Pass Technology
  {
    id: 'three-pass-system',
    question: 'What is three-pass consensus grading?',
    answer: (
      <>
        <p className="mb-3">
          Three-pass consensus grading means every card is evaluated <strong>three complete, independent times</strong>. Each pass examines all corners, edges, surface, and centering as if seeing the card for the first time.
        </p>
        <p className="mb-3">
          After all three passes, we average the results and apply consensus rules: a defect must be detected in at least 2 of 3 passes to affect your final grade. This eliminates false positives and ensures only real, verifiable defects impact your score.
        </p>
        <p>
          This approach mimics how top professional grading companies use multiple human evaluators, delivering the same level of rigor in an automated system.
        </p>
      </>
    ),
    category: 'Three-Pass Technology',
  },
  {
    id: 'why-three-passes',
    question: 'Why does three-pass grading improve accuracy?',
    answer: (
      <>
        <p className="mb-3"><strong>Reduces Variance:</strong> Averaging three independent evaluations produces more consistent, reliable grades than a single pass.</p>
        <p className="mb-3"><strong>Catches Errors:</strong> If one pass misses a defect, the other two passes are likely to catch it.</p>
        <p className="mb-3"><strong>Eliminates False Positives:</strong> By requiring 2+ passes to confirm a defect, we prevent phantom defects from affecting your grade.</p>
        <p><strong>Provides Confidence Metric:</strong> When all three passes agree closely, you can be highly confident in the grade. Higher variance indicates areas of uncertainty.</p>
      </>
    ),
    category: 'Three-Pass Technology',
  },
  {
    id: 'consistency-score',
    question: 'What does the consistency score mean?',
    answer: (
      <>
        <p className="mb-3">The consistency score shows how well all three evaluation passes agreed:</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>High Consistency:</strong> All 3 passes agree within ±0.5 points — highest confidence in the grade</li>
          <li><strong>Moderate Consistency:</strong> Passes vary by 0.5-1.0 points — good confidence, some areas of uncertainty</li>
          <li><strong>Low Consistency:</strong> Passes vary by more than 1.0 point — consider resubmitting with better images</li>
        </ul>
      </>
    ),
    category: 'Three-Pass Technology',
  },

  // Grading Process
  {
    id: 'grading-scale',
    question: 'What grading scale does DCM use?',
    answer: (
      <>
        <p className="mb-3">DCM uses a 10-point scale with 0.5 precision, aligned with industry-standard grading criteria:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>10:</strong> Gem Mint — Zero defects, perfect in every way</li>
          <li><strong>9.5:</strong> Gem Mint — Near-perfect with only microscopic imperfections</li>
          <li><strong>9:</strong> Mint — Minor imperfections under close inspection</li>
          <li><strong>8.5-8:</strong> Near Mint-Mint — Slight wear visible upon examination</li>
          <li><strong>7.5-7:</strong> Near Mint — Minor wear visible at normal distance</li>
          <li><strong>6.5-6:</strong> Excellent-Mint — Visible wear but displays well</li>
          <li><strong>5.5 and below:</strong> Varying degrees of wear or damage</li>
        </ul>
      </>
    ),
    category: 'Grading Process',
  },
  {
    id: 'component-scores',
    question: 'What are component scores?',
    answer: (
      <>
        <p className="mb-3">Every card receives 8 individual component scores — 4 for the front and 4 for the back:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Centering:</strong> Border distribution and alignment</li>
          <li><strong>Corners:</strong> Sharpness, fiber exposure, structural integrity</li>
          <li><strong>Edges:</strong> Whitening, chipping, factory cut quality</li>
          <li><strong>Surface:</strong> Scratches, print defects, stains, structural damage</li>
        </ul>
        <p className="mb-3">Front and back are weighted 55%/45% respectively, with the front given more weight as it's the primary display side.</p>
        <p><strong>Weakest Link Rule:</strong> Your final grade cannot exceed your lowest component score. This ensures consistency with professional grading standards.</p>
      </>
    ),
    category: 'Grading Process',
  },
  {
    id: 'centering-standards',
    question: 'What centering standards does DCM use?',
    answer: (
      <>
        <p className="mb-3">DCM uses PSA-aligned centering standards:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Front:</strong> 55/45 or better required for Gem Mint 10</li>
          <li><strong>Back:</strong> 75/25 acceptable (weighted less heavily)</li>
        </ul>
        <p className="mb-3">Centering is measured as a ratio (e.g., 60/40) where a perfect card would be 50/50. The first number represents one side, the second represents the opposite side.</p>
        <p>Quality tiers: Perfect (50/50-51/49), Excellent (52/48-53/47), Good (54/46-55/45), Fair (56/44-60/40), Off-Center (61/39+)</p>
      </>
    ),
    category: 'Grading Process',
  },
  {
    id: 'grade-caps',
    question: 'What are grade caps?',
    answer: (
      <>
        <p className="mb-3">Grade caps are automatic limits applied when structural damage is detected. Certain defects are so significant that they limit the maximum possible grade regardless of how perfect other areas are.</p>
        <p className="mb-3">Examples of grade-capping defects:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Creases (visible fold lines)</li>
          <li>Corner lift or tilt (corner separating from surface)</li>
          <li>Tears or paper loss</li>
          <li>Severe bends affecting card structure</li>
        </ul>
      </>
    ),
    category: 'Grading Process',
  },

  // Image Quality
  {
    id: 'confidence-rating',
    question: 'What is the image confidence rating?',
    answer: (
      <>
        <p className="mb-3">The confidence rating (A-D) indicates how well we can assess your card based on image quality:</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Grade A (95-100% visibility):</strong> Crystal clear images, highest confidence, ±0.25 uncertainty</li>
          <li><strong>Grade B (85-94% visibility):</strong> Clear images with minor issues, high confidence, ±0.5 uncertainty</li>
          <li><strong>Grade C (70-84% visibility):</strong> Acceptable images with moderate issues, ±1.0 uncertainty</li>
          <li><strong>Grade D (&lt;70% visibility):</strong> Significant issues, consider resubmitting, ±1.5 uncertainty</li>
        </ul>
      </>
    ),
    category: 'Image Quality',
  },
  {
    id: 'photo-tips',
    question: 'How should I photograph my cards for best results?',
    answer: (
      <>
        <p className="mb-3">For the most accurate grades, follow these tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Use natural lighting or bright, diffused artificial light</li>
          <li>Avoid flash — it creates glare that obscures defects</li>
          <li>Keep the card flat and parallel to the camera</li>
          <li>Remove from holders/sleeves when possible</li>
          <li>Fill the frame with the card, minimal background</li>
          <li>Ensure the entire card is in sharp focus</li>
          <li>Use a solid, contrasting background color</li>
          <li>Capture both front AND back images</li>
        </ul>
      </>
    ),
    category: 'Image Quality',
  },
  {
    id: 'cards-in-holders',
    question: 'Can I grade cards still in sleeves or top loaders?',
    answer: (
      <>
        <p className="mb-3">Yes, but with some caveats:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Penny sleeves:</strong> Usually fine, may slightly reduce confidence</li>
          <li><strong>Top loaders:</strong> Acceptable, watch for glare on the plastic</li>
          <li><strong>Thick holders/slabs:</strong> More challenging due to reflections and distortion</li>
        </ul>
        <p>For best results, remove the card from its holder if you can do so safely. Cards in holders typically receive a B or C confidence rating due to visibility limitations.</p>
      </>
    ),
    category: 'Image Quality',
  },
  {
    id: 'grade-slabbed-cards',
    question: 'Can DCM grade cards already in PSA/BGS/CGC slabs?',
    answer: (
      <>
        <p className="mb-3">Yes! DCM Optic™ can detect professionally graded slabs and perform an independent assessment. We'll identify the grading company and existing grade, then provide our own evaluation.</p>
        <p className="mb-3">Keep in mind:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Slab plastic may create glare or reflections</li>
          <li>Image confidence will typically be B or C</li>
          <li>Our grade is independent and may differ from the slab grade</li>
          <li>We note visibility limitations in our analysis</li>
        </ul>
      </>
    ),
    category: 'Image Quality',
  },

  // Accuracy & Comparison
  {
    id: 'dcm-vs-psa',
    question: 'How does DCM compare to PSA, BGS, and CGC?',
    answer: (
      <>
        <p className="mb-3">DCM uses grading criteria aligned with professional services like PSA, BGS, and CGC. Our three-pass consensus system mimics how these companies use multiple human evaluators.</p>
        <p className="mb-3"><strong>Key differences:</strong></p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>DCM grades are based on photo analysis, not physical inspection</li>
          <li>DCM is instant; traditional services take weeks/months</li>
          <li>DCM costs a fraction of traditional grading fees</li>
          <li>DCM grades are for informational purposes</li>
        </ul>
        <p><strong>Important:</strong> DCM grades don't replace official third-party grading for authentication or resale value certification. We're ideal for pre-screening cards before submission or for personal collection management.</p>
      </>
    ),
    category: 'Accuracy & Comparison',
  },
  {
    id: 'grade-accuracy',
    question: 'How accurate are DCM grades?',
    answer: (
      <>
        <p className="mb-3">DCM delivers highly accurate grades through several mechanisms:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Three-pass consensus:</strong> Reduces variance and catches errors</li>
          <li><strong>Evidence-based grading:</strong> Every deduction requires observable proof</li>
          <li><strong>PSA-aligned criteria:</strong> Same standards used by professionals</li>
          <li><strong>Continuous improvement:</strong> Our AI learns from millions of evaluations</li>
        </ul>
        <p>Accuracy depends on image quality. With Grade A images (clear, well-lit photos), our grades typically align closely with what professional services would assign. Lower quality images increase uncertainty.</p>
      </>
    ),
    category: 'Accuracy & Comparison',
  },
  {
    id: 'evidence-based',
    question: 'What does "evidence-based grading" mean?',
    answer: (
      <>
        <p className="mb-3">Evidence-based grading means every defect or pristine assessment must be backed by observable evidence in your images. We don't assume defects exist — we only deduct for what we can actually see and document.</p>
        <p className="mb-3">For every finding, we record:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Specific location on the card</li>
          <li>Type and severity of defect</li>
          <li>Measurement or size estimate</li>
          <li>Confidence level in the observation</li>
        </ul>
      </>
    ),
    category: 'Accuracy & Comparison',
  },
  {
    id: 'grade-differs',
    question: 'What if my DCM grade differs from a professional grade?',
    answer: (
      <>
        <p className="mb-3">Grade differences can occur for several reasons:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Image limitations:</strong> Photos may not capture all defects visible under physical inspection</li>
          <li><strong>Subjectivity:</strong> Even professional graders can vary by ±0.5 points on the same card</li>
          <li><strong>Different standards:</strong> PSA, BGS, and CGC have slightly different criteria</li>
          <li><strong>Timing:</strong> Grading standards can shift over time</li>
        </ul>
        <p>Use our uncertainty range as a guide. A card graded 9.0 with ±0.5 uncertainty could reasonably receive an 8.5-9.5 from a professional service.</p>
      </>
    ),
    category: 'Accuracy & Comparison',
  },

  // Special Cases
  {
    id: 'autograph-cards',
    question: 'Can DCM grade autographed cards?',
    answer: (
      <>
        <p className="mb-3">Yes, but with important distinctions:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Manufacturer-authenticated autographs:</strong> Cards with official autograph certification (hologram, printed authentication) are graded normally. The autograph is noted as a special feature.</li>
          <li><strong>Unverified signatures:</strong> Cards with signatures that aren't manufacturer-authenticated receive an "N/A" grade because we cannot verify authenticity.</li>
        </ul>
        <p>We look for authentication markers like holograms, "Certified Autograph Issue" text, and official autograph card numbering.</p>
      </>
    ),
    category: 'Special Cases',
  },
  {
    id: 'altered-cards',
    question: 'What happens if my card has been altered?',
    answer: (
      <>
        <p className="mb-3">Cards with post-production alterations receive an "N/A" (Not Authenticated / Altered) designation instead of a numeric grade. Alterations include:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>Trimmed edges or borders</li>
          <li>Unverified autographs or markings</li>
          <li>Handwritten additions (names, dates, prices)</li>
          <li>Adhesive residue or sticker damage</li>
          <li>Color enhancement or restoration</li>
        </ul>
        <p>We still provide a full analysis explaining what was detected and why the card cannot receive a numeric grade.</p>
      </>
    ),
    category: 'Special Cases',
  },
  {
    id: 'vintage-cards',
    question: 'Does DCM grade vintage cards?',
    answer: (
      <>
        <p className="mb-3">Yes! DCM can grade vintage cards from any era. Our system accounts for:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>Different printing and cutting standards from various decades</li>
          <li>Era-appropriate expectations for centering and edges</li>
          <li>Common vintage defects like wax staining or gum residue</li>
          <li>Manufacturing variations that aren't defects</li>
        </ul>
        <p>High-quality photos are especially important for vintage cards to capture subtle wear patterns and distinguish age-related characteristics from damage.</p>
      </>
    ),
    category: 'Special Cases',
  },
  {
    id: 'error-cards',
    question: 'How does DCM handle error cards and variations?',
    answer: (
      <>
        <p className="mb-3">DCM recognizes and documents error cards and variations. Manufacturing errors that occurred during production (misprints, wrong backs, missing foil, etc.) are noted as special features, not defects.</p>
        <p>The condition grade reflects the physical state of the card, not whether it's an error. An error card can still be Gem Mint if it has no wear or damage.</p>
      </>
    ),
    category: 'Special Cases',
  },

  // Pricing & Account
  {
    id: 'pricing',
    question: 'How much does DCM Grading cost?',
    answer: (
      <>
        <p className="mb-3">DCM uses a credit-based system. Credits can be purchased in packages:</p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>Each card grade costs 1 credit</li>
          <li>Re-grading a card (with new photos) costs 1 credit</li>
          <li>Bulk packages offer significant savings</li>
        </ul>
        <p>Visit our <Link href="/credits" className="text-purple-600 hover:text-purple-800 underline">Credits page</Link> for current pricing and packages.</p>
      </>
    ),
    category: 'Pricing & Account',
  },
  {
    id: 'free-trial',
    question: 'Is there a free trial?',
    answer: (
      <p>New accounts receive complimentary credits to try the service. This lets you experience DCM Grading before purchasing additional credits.</p>
    ),
    category: 'Pricing & Account',
  },
  {
    id: 'regrade',
    question: 'Can I re-grade a card?',
    answer: (
      <>
        <p className="mb-3">Yes! If you're not satisfied with your grade or want to try with better photos, you can re-grade any card in your collection. Re-grading costs 1 credit and performs a fresh three-pass evaluation.</p>
        <p>Re-grading is recommended when:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your original images had glare or blur</li>
          <li>You received a low confidence rating (C or D)</li>
          <li>You want to verify the grade with different lighting</li>
        </ul>
      </>
    ),
    category: 'Pricing & Account',
  },
  {
    id: 'collection',
    question: 'How do I access my graded cards?',
    answer: (
      <p>All your graded cards are saved in your <Link href="/collection" className="text-purple-600 hover:text-purple-800 underline">Collection</Link>. You can view detailed reports, download grade certificates, share cards publicly or keep them private, and track your collection's overall condition distribution.</p>
    ),
    category: 'Pricing & Account',
  },
  {
    id: 'privacy',
    question: 'Are my graded cards private?',
    answer: (
      <>
        <p className="mb-3">You control the visibility of each card:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Public:</strong> Card is searchable and viewable by anyone with the link</li>
          <li><strong>Private:</strong> Only you can see the card when logged in</li>
        </ul>
        <p className="mt-3">You can change visibility at any time from the card detail page.</p>
      </>
    ),
    category: 'Pricing & Account',
  },

  // Technical & Support
  {
    id: 'supported-formats',
    question: 'What image formats are supported?',
    answer: (
      <p>DCM accepts JPEG, PNG, HEIC, and WebP images. For best results, use high-resolution photos (at least 1000x1400 pixels) with good lighting and minimal compression.</p>
    ),
    category: 'Technical & Support',
  },
  {
    id: 'mobile-upload',
    question: 'Can I upload from my phone?',
    answer: (
      <p>Yes! DCM is fully mobile-friendly. You can take photos directly with your phone camera and upload them immediately. Modern smartphone cameras produce excellent results when using proper lighting.</p>
    ),
    category: 'Technical & Support',
  },
  {
    id: 'grade-time',
    question: 'How long does grading take?',
    answer: (
      <p>Most cards are graded in 30-60 seconds. Complex cards with many features or special finishes may take slightly longer. You'll see a progress indicator while your card is being analyzed.</p>
    ),
    category: 'Technical & Support',
  },
  {
    id: 'contact-support',
    question: 'How do I contact support?',
    answer: (
      <p>For questions, feedback, or issues, visit our <Link href="/contact" className="text-purple-600 hover:text-purple-800 underline">Contact page</Link> or email us at admin@dcmgrading.com. We typically respond within 24-48 hours.</p>
    ),
    category: 'Technical & Support',
  },
];

// Group FAQs by category
const categories = [...new Set(faqs.map(faq => faq.category))];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about DCM Grading, our three-pass consensus technology, and how to get the most accurate grades for your cards.
          </p>
        </div>

        {/* Quick Navigation */}
        <nav className="bg-white rounded-xl shadow-md p-6 mb-12">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Jump to a topic:</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <a
                key={category}
                href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
              >
                {category}
              </a>
            ))}
          </div>
        </nav>

        {/* FAQ Sections */}
        <div className="space-y-12">
          {categories.map((category) => (
            <section key={category} id={category.toLowerCase().replace(/\s+/g, '-')}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-purple-500">
                {category}
              </h2>
              <div className="space-y-4">
                {faqs
                  .filter((faq) => faq.category === category)
                  .map((faq) => (
                    <div
                      key={faq.id}
                      id={faq.id}
                      className="bg-white rounded-xl shadow-md p-6 scroll-mt-24"
                    >
                      <a href={`#${faq.id}`} className="group">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-start">
                          <span className="text-purple-500 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">#</span>
                          {faq.question}
                        </h3>
                      </a>
                      <div className="text-gray-700 leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        {/* Still Have Questions CTA */}
        <section className="mt-16">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white text-center shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <p className="text-lg mb-6 max-w-xl mx-auto">
              Our team is here to help. Reach out and we'll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-block bg-white text-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Contact Us
              </Link>
              <Link
                href="/grading-rubric"
                className="inline-block bg-purple-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-400 transition-colors border border-purple-400"
              >
                View Grading Rubric
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
