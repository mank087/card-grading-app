import { Metadata } from 'next';
import FloatingCardsBackground from '../ui/FloatingCardsBackground';

export const metadata: Metadata = {
  title: 'Grading Rubric - How We Grade Cards',
  description: 'Understand DCM\'s professional grading standards. Our 30-point inspection with three-pass consensus technology evaluates centering, corners, edges, and surface condition for accurate card grades.',
  keywords: 'card grading rubric, grading standards, PSA grading scale, BGS grading, card condition, centering, corners, edges, surface, DCM Optic, three-pass grading, how cards are graded',
  openGraph: {
    title: 'Grading Rubric - How DCM Grades Cards',
    description: 'Learn how DCM grades trading cards with our comprehensive 30-point inspection and three-pass consensus technology.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'DCM Grading Rubric',
    description: '30-point inspection with three-pass consensus technology for accurate card grades.',
  },
};

export default function GradingRubricPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            DCM Grading Rubric
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Precision grading powered by DCM Optic™ — our proprietary multi-point inspection system with three-pass consensus technology that delivers professional-grade assessments with unmatched accuracy
          </p>
        </div>

        {/* The DCM Difference */}
        <section className="mb-16">
          <div className="bg-purple-600 text-white rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-4">The DCM Difference</h2>
            <p className="text-lg mb-4">
              Traditional grading services can take weeks or months. DCM Optic™ combines advanced artificial intelligence with decades of industry grading standards to deliver accurate, consistent results in under 60 seconds.
            </p>
            <p className="text-lg">
              Every card receives the same meticulous multi-point evaluation with our revolutionary <strong>three-pass consensus technology</strong>. This means your card is analyzed three independent times, with results averaged and cross-validated to eliminate errors and ensure the highest possible accuracy.
            </p>
          </div>
        </section>

        {/* Three-Pass Technology Highlight */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-8 border border-blue-200">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-4">
                <span className="text-white text-2xl font-bold">3×</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Three-Pass Consensus Technology</h2>
            </div>
            <p className="text-lg text-gray-700 mb-6">
              Unlike single-pass grading systems, DCM Optic™ performs <strong>three complete, independent evaluations</strong> of every card. This revolutionary approach significantly improves grading accuracy and reliability.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">First Pass</h3>
                <p className="text-sm text-gray-600">Complete evaluation of all corners, edges, surface, and centering with detailed defect documentation.</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Second Pass</h3>
                <p className="text-sm text-gray-600">Independent re-examination as if seeing the card for the first time, catching anything that may have been missed.</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-blue-600 font-bold">3</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Third Pass</h3>
                <p className="text-sm text-gray-600">Final independent verification with fresh perspective, followed by consensus calculation.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-blue-200">
              <h4 className="font-bold text-gray-900 mb-3">Why Three Passes Matter</h4>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Reduces variance:</strong> Averaging three independent evaluations produces more consistent, reliable grades</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Consensus-based defects:</strong> Only defects confirmed in 2+ passes affect the final grade</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Consistency scoring:</strong> High agreement between passes indicates higher confidence in the final grade</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Mimics professional services:</strong> Top grading companies use multiple evaluators — our three-pass system achieves the same rigor</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Comprehensive Inspection Protocol */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Comprehensive Inspection Protocol
          </h2>
          <p className="text-center text-gray-600 mb-8 max-w-3xl mx-auto">
            Every card undergoes a rigorous multi-phase evaluation examining dozens of individual inspection points across corners, edges, surface, and centering — all performed three times for maximum accuracy.
          </p>

          <div className="space-y-6">
            {/* Phase 0: Pre-Grading Verification */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 0: Pre-Grading Verification</h3>
              <p className="text-sm text-gray-600 mb-4">Mandatory verification before condition evaluation begins</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-red-600">Autograph Verification</p>
                  <p className="text-sm text-gray-600">Distinguishes manufacturer-authenticated signatures from unverified additions</p>
                </div>
                <div>
                  <p className="font-semibold text-red-600">Handwritten Markings Detection</p>
                  <p className="text-sm text-gray-600">Scans for post-production alterations, stamps, adhesive residue, and markings</p>
                </div>
                <div>
                  <p className="font-semibold text-red-600">Trimming Detection Protocol</p>
                  <p className="text-sm text-gray-600">Analyzes border proportions and edge patterns to detect trimmed cards</p>
                </div>
                <div>
                  <p className="font-semibold text-red-600">Image Completeness Check</p>
                  <p className="text-sm text-gray-600">Verifies both front and back images are present and properly oriented</p>
                </div>
                <div>
                  <p className="font-semibold text-red-600">Professional Slab Detection</p>
                  <p className="text-sm text-gray-600">Identifies PSA, BGS, CGC, SGC, and other graded holders for independent analysis</p>
                </div>
              </div>
            </div>

            {/* Phase 1: Image Analysis */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 1: Image Quality & Confidence Assessment</h3>
              <p className="text-sm text-gray-600 mb-4">Establishes grading confidence based on image quality</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-blue-600">Regional Visibility Scoring</p>
                  <p className="text-sm text-gray-600">Assesses visibility of corners, edges, surface, and centering markers</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Focus & Resolution Analysis</p>
                  <p className="text-sm text-gray-600">Evaluates image sharpness and detail clarity for accurate assessment</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Lighting & Glare Detection</p>
                  <p className="text-sm text-gray-600">Identifies reflections and shadows that may affect visibility</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Protective Case Detection</p>
                  <p className="text-sm text-gray-600">Identifies sleeves, top loaders, and slabs affecting inspection</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Confidence Letter Assignment</p>
                  <p className="text-sm text-gray-600">Assigns A, B, C, or D rating based on overall image quality</p>
                </div>
              </div>
            </div>

            {/* Phase 2: Card Information */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 2: Card Information Extraction</h3>
              <p className="text-sm text-gray-600 mb-4">Identifies card metadata and special features</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-indigo-600">Card Identification</p>
                  <p className="text-sm text-gray-600">Extracts player/character, set, year, manufacturer, and card number</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-600">Finish Type Detection</p>
                  <p className="text-sm text-gray-600">Identifies refractor, chrome, holographic, matte, and standard finishes</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-600">Special Features Recognition</p>
                  <p className="text-sm text-gray-600">Detects autographs, memorabilia, serial numbers, and parallels</p>
                </div>
                <div>
                  <p className="font-semibold text-indigo-600">Authenticity Verification</p>
                  <p className="text-sm text-gray-600">Confirms official licensing and manufacturer authentication</p>
                </div>
              </div>
            </div>

            {/* Phase 3: Centering - 3x */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">Phase 3: Centering Evaluation</h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">×3 Passes</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">Independent front and back centering analysis with PSA-aligned standards</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-yellow-600">Front Left/Right Measurement</p>
                  <p className="text-sm text-gray-600">Calculates precise horizontal border ratios</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Front Top/Bottom Measurement</p>
                  <p className="text-sm text-gray-600">Calculates precise vertical border ratios</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Back Left/Right Measurement</p>
                  <p className="text-sm text-gray-600">Independent back horizontal centering analysis</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Back Top/Bottom Measurement</p>
                  <p className="text-sm text-gray-600">Independent back vertical centering analysis</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>PSA-Aligned Standards:</strong> Front 55/45 or better required for Gem Mint 10. Back centering weighted less heavily (75/25 acceptable).
                </p>
              </div>
            </div>

            {/* Phase 4: Corners - 3x */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">Phase 4: Corner Inspection</h3>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">×3 Passes</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">Two-phase protocol examining all 8 corners individually (4 front, 4 back)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-green-600">Structural Integrity Check</p>
                  <p className="text-sm text-gray-600">Detects corner lift, tilt, bends, and structural damage</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Fiber Exposure Detection</p>
                  <p className="text-sm text-gray-600">Microscopic analysis for white cardstock showing at corner tips</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Corner Geometry Analysis</p>
                  <p className="text-sm text-gray-600">Evaluates sharpness, rounding, and softening</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Impact Damage Detection</p>
                  <p className="text-sm text-gray-600">Identifies dings, compression marks, and handling damage</p>
                </div>
              </div>
            </div>

            {/* Phase 5: Edges - 3x */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-teal-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">Phase 5: Edge Inspection</h3>
                <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-1 rounded">×3 Passes</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">Two-phase protocol examining all 8 edges individually (4 front, 4 back)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-teal-600">Edge Roughness/Texture Check</p>
                  <p className="text-sm text-gray-600">Evaluates factory cut quality and fiber separation</p>
                </div>
                <div>
                  <p className="font-semibold text-teal-600">Whitening Detection</p>
                  <p className="text-sm text-gray-600">Scans entire edge length for white fiber exposure</p>
                </div>
                <div>
                  <p className="font-semibold text-teal-600">Chipping Analysis</p>
                  <p className="text-sm text-gray-600">Identifies coating loss and material damage</p>
                </div>
                <div>
                  <p className="font-semibold text-teal-600">Nick & Dent Detection</p>
                  <p className="text-sm text-gray-600">Finds compression damage and edge irregularities</p>
                </div>
              </div>
            </div>

            {/* Phase 6: Surface - 3x */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">Phase 6: Surface Inspection</h3>
                <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded">×3 Passes</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">Systematic 9-zone grid analysis of both front and back surfaces (18 total zones)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-purple-600">Microscopic Defect Scan</p>
                  <p className="text-sm text-gray-600">Detects white dots, debris, micro-scratches, and print defects</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Reflection Analysis</p>
                  <p className="text-sm text-gray-600">Multi-angle examination to reveal scratches and surface wear</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Finish-Specific Examination</p>
                  <p className="text-sm text-gray-600">Specialized analysis for refractor, chrome, and holographic cards</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Structural Damage Detection</p>
                  <p className="text-sm text-gray-600">Identifies creases, dents, stains, and surface breaks</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grading Scale */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Understanding the DCM Grading Scale
          </h2>

          <div className="bg-white rounded-xl shadow-md p-8">
            <p className="text-gray-700 mb-6">
              DCM uses a 10-point whole number scale, aligned with industry-standard grading criteria from PSA, BGS, and CGC. Our evidence-based protocol ensures every deduction is documented and justified.
            </p>

            <div className="space-y-3">
              {/* 10 - Gold Metallic */}
              <div className="flex items-center gap-4 p-4 rounded-lg border-l-4" style={{ background: 'linear-gradient(to right, #fef3c7, #fcd34d)', borderLeftColor: '#d97706' }}>
                <div className="text-3xl font-bold w-16" style={{ color: '#92400e', textShadow: '0 1px 2px rgba(251, 191, 36, 0.5)' }}>10</div>
                <div>
                  <p className="font-bold text-gray-900">Gem Mint</p>
                  <p className="text-sm text-gray-600">Zero defects. Sharp corners, pristine surface, perfect centering (55/45 or better). No fiber exposure, no scratches, no whitening.</p>
                </div>
              </div>

              {/* 9 - Silver Metallic */}
              <div className="flex items-center gap-4 p-4 rounded-lg border-l-4" style={{ background: 'linear-gradient(to right, #f3f4f6, #d1d5db)', borderLeftColor: '#6b7280' }}>
                <div className="text-3xl font-bold w-16" style={{ color: '#374151', textShadow: '0 1px 2px rgba(156, 163, 175, 0.5)' }}>9</div>
                <div>
                  <p className="font-bold text-gray-900">Mint</p>
                  <p className="text-sm text-gray-600">Near-perfect with only microscopic imperfections. Minor corner softening or slight edge whitening allowed.</p>
                </div>
              </div>

              {/* 8 - Bronze Metallic */}
              <div className="flex items-center gap-4 p-4 rounded-lg border-l-4" style={{ background: 'linear-gradient(to right, #fef3e2, #f5d0a9)', borderLeftColor: '#b45309' }}>
                <div className="text-3xl font-bold w-16" style={{ color: '#78350f', textShadow: '0 1px 2px rgba(180, 83, 9, 0.3)' }}>8</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint-Mint</p>
                  <p className="text-sm text-gray-600">Slight wear visible upon close examination. Minor rounding, light whitening, or small surface imperfections.</p>
                </div>
              </div>

              {/* 7 - Blue */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                <div className="text-3xl font-bold text-blue-700 w-16">7</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint</p>
                  <p className="text-sm text-gray-600">Minor surface wear or slight corner/edge wear visible at normal viewing distance</p>
                </div>
              </div>

              {/* 6 - Purple */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-500">
                <div className="text-3xl font-bold text-purple-800 w-16">6</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent-Mint</p>
                  <p className="text-sm text-gray-600">Visible wear on corners or edges, moderate centering issues, but still displays well</p>
                </div>
              </div>

              {/* 5-1 - Gray */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-l-4 border-gray-500">
                <div className="text-2xl font-bold text-gray-800 w-16">5-1</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent to Poor</p>
                  <p className="text-sm text-gray-600">Significant wear, structural damage (creases, bends), or other issues affecting overall appearance</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Grade Caps:</strong> Structural damage (creases, corner lift, tears) triggers automatic grade caps regardless of other component scores. This ensures consistency with professional grading standards.
              </p>
            </div>
          </div>
        </section>

        {/* Image Confidence & Uncertainty */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Image Confidence Rating System
          </h2>

          <div className="bg-white rounded-xl shadow-md p-8 mb-8">
            <p className="text-lg text-gray-700 mb-6">
              Every DCM grade includes an <strong>Image Confidence Rating</strong> (A-D), <strong>Grade Uncertainty Range</strong>, and now a <strong>Three-Pass Consistency Score</strong>. This transparency helps you understand how confident the assessment is based on your submitted photos and how well the three independent passes agreed.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Image Confidence Levels</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-green-800">A</span>
                      <span className="text-sm font-semibold text-green-700">95-100% Visibility</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Crystal clear images with perfect lighting, sharp focus, and no obstructions. Highest grading confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-blue-800">B</span>
                      <span className="text-sm font-semibold text-blue-700">85-94% Visibility</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Clear images with minor issues like slight glare, card in sleeve/top loader. High grading confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-yellow-800">C</span>
                      <span className="text-sm font-semibold text-yellow-700">70-84% Visibility</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Acceptable images with moderate glare, card in thick holder/slab, or focus issues. Moderate confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-red-800">D</span>
                      <span className="text-sm font-semibold text-red-700">&lt;70% Visibility</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Images with significant issues like heavy glare, blur, or poor lighting. Consider resubmitting for better results.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Grade Uncertainty & Consistency</h3>
                <p className="text-gray-700 mb-4">
                  The uncertainty range indicates how much the actual grade might vary based on image quality. Higher confidence means a more precise grade.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="font-semibold text-gray-900">±0</span>
                    <span className="text-sm text-green-700">Grade A — Highest Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-semibold text-gray-900">±1</span>
                    <span className="text-sm text-blue-700">Grade B — High Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <span className="font-semibold text-gray-900">±2</span>
                      <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">New Photos Recommended</span>
                    </div>
                    <span className="text-sm text-yellow-700">Grade C — Moderate Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div>
                      <span className="font-semibold text-gray-900">±3</span>
                      <span className="ml-2 text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">New Photos Recommended</span>
                    </div>
                    <span className="text-sm text-red-700">Grade D — Low Confidence</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-bold text-indigo-900 mb-2">Three-Pass Consistency</h4>
                  <ul className="text-sm text-indigo-800 space-y-1">
                    <li><strong>High:</strong> All 3 passes agree within ±1 point</li>
                    <li><strong>Moderate:</strong> Passes vary by 1-2 points</li>
                    <li><strong>Low:</strong> Passes vary by more than 2 points</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pro Tip: Getting an A-Grade Confidence Rating
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 ml-7">
                <li>• Use natural lighting or a bright, diffused light source</li>
                <li>• Avoid flash photography that creates glare</li>
                <li>• Keep the card flat and parallel to the camera</li>
                <li>• Remove from holders if possible for clearest images</li>
                <li>• Fill the frame with the card, leaving minimal background</li>
                <li>• Ensure the entire card is in sharp focus</li>
                <li>• Use a contrasting, solid-color background</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Card Type Specialization */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Card Type Specialization
          </h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            DCM Optic™ uses specialized evaluation criteria optimized for each card type
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-md p-4 text-center">
              <div className="text-3xl mb-2">⚾</div>
              <p className="font-bold text-gray-900">Sports</p>
              <p className="text-xs text-gray-600">Baseball, Basketball, Football, Hockey, Soccer, Wrestling</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <p className="font-bold text-gray-900">Pokémon</p>
              <p className="text-xs text-gray-600">TCG, Japanese, Promos, Full Art</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4 text-center">
              <div className="text-3xl mb-2">🧙</div>
              <p className="font-bold text-gray-900">MTG</p>
              <p className="text-xs text-gray-600">Magic: The Gathering, Foils, Borderless</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4 text-center">
              <div className="text-3xl mb-2">✨</div>
              <p className="font-bold text-gray-900">Lorcana</p>
              <p className="text-xs text-gray-600">Disney Lorcana TCG</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-4 text-center">
              <div className="text-3xl mb-2">🃏</div>
              <p className="font-bold text-gray-900">Other</p>
              <p className="text-xs text-gray-600">Yu-Gi-Oh!, One Piece, and more</p>
            </div>
          </div>
        </section>

        {/* Technology */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Powered by DCM Optic™
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              DCM Optic™ is our proprietary grading engine that combines advanced AI vision technology with industry-standard evaluation criteria. Our evidence-based protocol ensures every assessment is backed by observable, documented findings — no assumptions, no guesswork.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              With our revolutionary three-pass consensus system, every card receives not just one evaluation, but three independent analyses that are averaged and cross-validated. This delivers the most accurate and reliable grades possible from photo-based grading.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">3×</p>
                <p className="text-sm text-gray-600">Independent Passes</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">8</p>
                <p className="text-sm text-gray-600">Component Scores</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">&lt;60s</p>
                <p className="text-sm text-gray-600">Average Grade Time</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">24/7</p>
                <p className="text-sm text-gray-600">Always Available</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Link */}
        <section className="mb-16">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Have Questions?
            </h2>
            <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
              Visit our comprehensive FAQ for answers about three-pass grading, image quality tips, pricing, supported card types, and more.
            </p>
            <a
              href="/faq"
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              View FAQ
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Ready to Grade Your Cards?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Experience the precision of DCM Optic™ three-pass grading technology. Get professional-grade assessments in under 60 seconds.
            </p>
            <a
              href="/login"
              className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Create an Account
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
