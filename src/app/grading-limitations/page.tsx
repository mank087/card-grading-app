import { Metadata } from 'next'
import Link from 'next/link'
import FloatingCardsBackground from '../ui/FloatingCardsBackground'

export const metadata: Metadata = {
  title: 'Grading Limitations | DCM Grading',
  description: 'Understanding the limitations of photo-based card grading. Learn what DCM Optic™ can and cannot reliably assess from card images.',
}

export default function GradingLimitationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 relative">
      <FloatingCardsBackground />
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Understanding Grading Limitations
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            DCM Optic™ provides accurate condition assessments from photographs, but some defects
            and card characteristics cannot be reliably evaluated without physical inspection.
          </p>
        </div>

        {/* Introduction */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Photo-Based Grading: Capabilities & Constraints
          </h2>
          <p className="text-gray-700 mb-4">
            DCM Optic™ utilizes advanced machine learning algorithms and computer vision technology
            to analyze trading card images with professional-grade precision. Our system evaluates
            centering, corners, edges, and surface condition from high-quality photographs.
          </p>
          <p className="text-gray-700 mb-4">
            However, photograph-based assessment has inherent limitations. Certain physical
            characteristics and defects require tactile inspection, specialized equipment, or
            controlled lighting environments that cannot be replicated through standard photography.
          </p>
          <p className="text-gray-700">
            This page outlines what our technology can reliably assess and where physical
            inspection by traditional grading services may be necessary for definitive evaluation.
          </p>
        </section>

        {/* What We Grade Well */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Why DCM Optic™ Grades are Reliable
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Centering Analysis</h3>
                <p className="text-gray-600 text-sm">
                  Precise measurement of border symmetry on front and back, detecting off-center
                  cuts and misalignment with high accuracy.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Corner Condition</h3>
                <p className="text-gray-600 text-sm">
                  Detection of corner wear, whitening, dings, rounding, and fiber exposure
                  across all eight corners.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Edge Wear</h3>
                <p className="text-gray-600 text-sm">
                  Identification of edge whitening, chipping, roughness, and coating loss
                  along all card edges.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Visible Surface Defects</h3>
                <p className="text-gray-600 text-sm">
                  Scratches, scuffs, print defects, staining, and surface contamination
                  visible in properly lit photographs.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Creases & Folds</h3>
                <p className="text-gray-600 text-sm">
                  Visible crease lines, fold marks, and associated white stress lines
                  from structural damage.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Card Identification</h3>
                <p className="text-gray-600 text-sm">
                  Accurate recognition of card name, set, year, player/character,
                  and special variants including serial numbering.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Limitations */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Conditions With Limited Assessment Accuracy
            </h2>
          </div>

          <p className="text-gray-700 mb-6">
            The following conditions may not be accurately detected or assessed through photographs.
            Grades for cards with these characteristics should be considered estimates with wider
            uncertainty ranges.
          </p>

          <div className="space-y-6">
            {/* Card Warping */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span>
                Card Warping & Bowing
              </h3>
              <p className="text-gray-700 text-sm mb-3">
                Physical warping is a three-dimensional deformation that cannot be reliably detected
                from two-dimensional photographs. A card may appear flat in an image while having
                significant curvature in reality.
              </p>
              <div className="bg-white rounded-lg p-4 text-sm">
                <p className="font-medium text-gray-900 mb-2">Important Note:</p>
                <p className="text-gray-600">
                  Natural foil curl in holographic and refractor cards is common and typically
                  does not affect professional grades. This occurs because the metallic foil layer
                  expands differently than the paper stock. Severe warping from water damage or
                  improper storage, however, may impact card value and is best assessed in person.
                </p>
              </div>
            </div>

            {/* Card Thickness */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span>
                Card Thickness & Stock Quality
              </h3>
              <p className="text-gray-700 text-sm">
                Variations in card thickness, paper stock quality, and potential delamination
                (separation of card layers) cannot be assessed from photographs. These factors
                may indicate reprints, counterfeits, or manufacturing defects that require
                physical inspection to verify.
              </p>
            </div>

            {/* Texture & Feel */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span>
                Tactile Surface Characteristics
              </h3>
              <p className="text-gray-700 text-sm">
                Surface texture, card stiffness, and tactile defects like raised bumps or
                embedded debris cannot be detected through images. Cards with textured finishes,
                embossing, or special coatings may have wear that is only apparent through touch.
              </p>
            </div>

            {/* Micro-scratches */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span>
                Micro-Scratches & Fine Surface Wear
              </h3>
              <p className="text-gray-700 text-sm">
                Extremely fine scratches and surface wear may only be visible under specific
                lighting angles or magnification. While our algorithms detect many surface
                defects, hairline scratches that appear only at certain angles may not be
                captured in standard photographs.
              </p>
            </div>

            {/* Odors & Contamination */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-amber-600">●</span>
                Odors, Smoke Damage & Chemical Exposure
              </h3>
              <p className="text-gray-700 text-sm">
                Cards exposed to smoke, mold, chemicals, or other environmental contaminants
                may carry odors or invisible residue that affects their condition and value.
                These factors are impossible to assess through photographs.
              </p>
            </div>
          </div>
        </section>

        {/* Photography Variables */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              How Photography Affects Accuracy
            </h2>
          </div>

          <p className="text-gray-700 mb-6">
            The quality and conditions of your photographs directly impact grading accuracy.
            Our confidence ratings account for image quality factors.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-green-700">Optimal Conditions</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Even, diffused lighting without harsh shadows
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Neutral background (dark preferred)
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Card fills 70-80% of the frame
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sharp focus on card surface
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Card removed from sleeve/toploader
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-red-700">Conditions That Reduce Accuracy</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Glare or reflections obscuring the surface
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Heavy shadows hiding corners or edges
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Blurry or out-of-focus images
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Card photographed at an angle
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cards in holders with scratches or haze
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Cards We Cannot Grade */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Cards Not Suitable for Photo-Based Grading
            </h2>
          </div>

          <p className="text-gray-700 mb-6">
            Some cards should not be submitted for photo-based grading due to authentication
            requirements or characteristics that cannot be properly evaluated from images.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Authentication-Required Items</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Cards suspected to be counterfeit</li>
                <li>• Reprints requiring verification</li>
                <li>• Cards with uncertain provenance</li>
                <li>• High-value vintage requiring authentication</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Altered or Modified Cards</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Trimmed cards (edge manipulation)</li>
                <li>• Re-colored or touched-up cards</li>
                <li>• Cards with added signatures (unverified)</li>
                <li>• Cleaned or chemically treated cards</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Severely Damaged Cards</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Cards with missing pieces</li>
                <li>• Water-damaged with visible warping</li>
                <li>• Fire or heat damaged cards</li>
                <li>• Cards with tape residue or sticker damage</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Special Format Cards</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Oversized cards (jumbo, box toppers)</li>
                <li>• Mini cards or non-standard sizes</li>
                <li>• 3D or lenticular cards</li>
                <li>• Cards with attached elements (relics in certain conditions)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Understanding Our Grades */}
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-4">
            Understanding DCM Optic™ Confidence Ratings
          </h2>
          <p className="mb-6 text-indigo-100">
            Every grade includes a confidence rating that reflects our assessment certainty
            based on image quality and visibility of card features.
          </p>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">A</div>
              <div className="text-sm text-indigo-200">Excellent</div>
              <div className="text-xs text-indigo-300 mt-2">±0.25 grade variance</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">B</div>
              <div className="text-sm text-indigo-200">Good</div>
              <div className="text-xs text-indigo-300 mt-2">±0.5 grade variance</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">C</div>
              <div className="text-sm text-indigo-200">Fair</div>
              <div className="text-xs text-indigo-300 mt-2">±1.0 grade variance</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">D</div>
              <div className="text-sm text-indigo-200">Limited</div>
              <div className="text-xs text-indigo-300 mt-2">±1.5 grade variance</div>
            </div>
          </div>

          <p className="mt-6 text-sm text-indigo-200">
            A lower confidence rating doesn't mean the grade is wrong—it indicates higher
            uncertainty due to image quality factors. Consider retaking photos under better
            conditions for improved confidence.
          </p>
        </section>

        {/* Disclaimer */}
        <section className="bg-gray-100 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Important Disclaimer
          </h2>
          <p className="text-gray-700 text-sm mb-4">
            DCM Grading provides condition assessments for informational and entertainment purposes.
            Our grades are generated through automated analysis of submitted photographs and should
            be considered estimates based on visible characteristics.
          </p>
          <p className="text-gray-700 text-sm mb-4">
            DCM grades are not equivalent to, and should not be represented as, grades from
            PSA, BGS, CGC, SGC, or any other professional grading service. For authentication,
            insurance valuation, or high-stakes transactions, we recommend submitting cards to
            an established physical grading service.
          </p>
          <p className="text-gray-700 text-sm">
            By using DCM Grading, you acknowledge these limitations and agree that grades are
            provided as-is without warranty of accuracy for any specific purpose.
          </p>
        </section>

        {/* Back to Home */}
        <div className="text-center mt-12">
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
