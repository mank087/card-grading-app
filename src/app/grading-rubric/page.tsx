export default function GradingRubricPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            DCM Grading Rubric
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Precision grading powered by DCM Optic™ — our proprietary 30-point evaluation system that delivers professional-grade assessments with unmatched consistency
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
              Every card receives the same meticulous 30-point evaluation, whether it's your first submission or your thousandth. Our evidence-based grading protocol ensures every assessment is backed by observable, documented findings.
            </p>
          </div>
        </section>

        {/* 30-Point Process */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Our 30-Point Grading Protocol
          </h2>

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

            {/* Phase 3: Centering */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 3: Centering Evaluation</h3>
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

            {/* Phase 4: Corners */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 4: Corner Inspection</h3>
              <p className="text-sm text-gray-600 mb-4">Two-phase protocol examining all 8 corners individually</p>
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

            {/* Phase 5: Edges */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-teal-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 5: Edge Inspection</h3>
              <p className="text-sm text-gray-600 mb-4">Two-phase protocol examining all 8 edges individually</p>
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

            {/* Phase 6: Surface */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 6: Surface Inspection</h3>
              <p className="text-sm text-gray-600 mb-4">Systematic 9-zone grid analysis of both front and back surfaces</p>
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
              DCM uses a 10-point scale with 0.5 precision, aligned with industry-standard grading criteria from PSA, BGS, and CGC. Our evidence-based protocol ensures every deduction is documented and justified.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border-l-4 border-yellow-500">
                <div className="text-3xl font-bold text-yellow-800 w-16">10</div>
                <div>
                  <p className="font-bold text-gray-900">Gem Mint</p>
                  <p className="text-sm text-gray-600">Zero defects. Sharp corners, pristine surface, perfect centering (55/45 or better). No fiber exposure, no scratches, no whitening.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                <div className="text-3xl font-bold text-green-800 w-16">9.5</div>
                <div>
                  <p className="font-bold text-gray-900">Gem Mint</p>
                  <p className="text-sm text-gray-600">Near-perfect with only microscopic imperfections visible at maximum zoom</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-400">
                <div className="text-3xl font-bold text-green-700 w-16">9</div>
                <div>
                  <p className="font-bold text-gray-900">Mint</p>
                  <p className="text-sm text-gray-600">Minor imperfections under close inspection. Slight corner softening or minor edge whitening.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                <div className="text-2xl font-bold text-blue-800 w-20">8.5-8</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint-Mint</p>
                  <p className="text-sm text-gray-600">Slight wear visible upon close examination. Minor rounding, light whitening, or small surface imperfections.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-400">
                <div className="text-2xl font-bold text-blue-700 w-20">7.5-7</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint</p>
                  <p className="text-sm text-gray-600">Minor surface wear or slight corner/edge wear visible at normal viewing distance</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-500">
                <div className="text-2xl font-bold text-purple-800 w-20">6.5-6</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent-Mint</p>
                  <p className="text-sm text-gray-600">Visible wear on corners or edges, moderate centering issues, but still displays well</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-l-4 border-gray-500">
                <div className="text-2xl font-bold text-gray-800 w-20">5.5-1</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent to Good</p>
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

        {/* Component Scores */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            8-Component Scoring System
          </h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
            Every card receives 8 individual component scores — 4 for the front and 4 for the back — with weighted averaging (55% front, 45% back) to calculate the final grade.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                Centering Score (Front & Back)
              </h3>
              <p className="text-gray-700 mb-3">
                Measures border distribution using precise ratios. PSA-aligned standards: 55/45 for Gem Mint 10 on front, 75/25 acceptable on back.
              </p>
              <p className="text-sm text-gray-600">
                Quality tiers: Perfect (50/50-51/49), Excellent (52/48-53/47), Good (54/46-55/45), Fair (56/44-60/40), Off-Center (61/39+)
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Corners Score (Front & Back)
              </h3>
              <p className="text-gray-700 mb-3">
                Evaluates all 8 corners individually for sharpness, fiber exposure, rounding, and structural integrity.
              </p>
              <p className="text-sm text-gray-600">
                10.0 requires ZERO defects on all 8 corners — no fiber, no rounding, no lift
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-teal-500 rounded-full mr-3"></span>
                Edges Score (Front & Back)
              </h3>
              <p className="text-gray-700 mb-3">
                Examines all 8 edges for whitening, chipping, roughness, and factory cut quality.
              </p>
              <p className="text-sm text-gray-600">
                10.0 requires ZERO white flecks, ZERO chipping, smooth factory cuts on all edges
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                Surface Score (Front & Back)
              </h3>
              <p className="text-gray-700 mb-3">
                Detects scratches, white dots, print defects, stains, and surface damage using 9-zone grid analysis.
              </p>
              <p className="text-sm text-gray-600">
                10.0 requires ZERO scratches, ZERO white dots, ZERO pattern disruption (holographic)
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-800">
              <strong>Weakest Link Scoring:</strong> The final grade cannot exceed the lowest weighted category score. A card with 10.0 centering, 10.0 corners, 10.0 edges, but 8.0 surface will receive a grade reflecting the surface condition.
            </p>
          </div>
        </section>

        {/* Image Confidence & Uncertainty */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Image Confidence Rating System
          </h2>

          <div className="bg-white rounded-xl shadow-md p-8 mb-8">
            <p className="text-lg text-gray-700 mb-6">
              Every DCM grade includes an <strong>Image Confidence Rating</strong> (A-D) and <strong>Grade Uncertainty Range</strong>. This transparency helps you understand how confident the assessment is based on your submitted photos.
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
                <h3 className="text-xl font-bold text-gray-900 mb-4">Grade Uncertainty Ranges</h3>
                <p className="text-gray-700 mb-4">
                  The uncertainty range indicates how much the actual grade might vary based on image quality. Higher quality images = lower uncertainty.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="font-semibold text-gray-900">±0.25</span>
                    <span className="text-sm text-green-700">Grade A — High Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-semibold text-gray-900">±0.5</span>
                    <span className="text-sm text-blue-700">Grade B — Good Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="font-semibold text-gray-900">±1.0</span>
                    <span className="text-sm text-yellow-700">Grade C — Moderate Confidence</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="font-semibold text-gray-900">±1.5</span>
                    <span className="text-sm text-red-700">Grade D — Low Confidence</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-800">
                    <strong>Example:</strong> A card graded 9.0 with ±0.5 uncertainty (Grade B) means the grade likely falls between 8.5 and 9.5 based on image quality.
                  </p>
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
            DCM Optic™ uses specialized evaluation criteria (deltas) optimized for each card type
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
              Every submission is processed through the same rigorous 30-point evaluation, ensuring fairness and consistency across all card types and conditions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">30</p>
                <p className="text-sm text-gray-600">Evaluation Points</p>
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

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                How does DCM compare to professional grading services?
              </h3>
              <p className="text-gray-700">
                DCM Optic™ uses PSA-aligned grading criteria and provides comparable assessments. While we provide accurate, evidence-based evaluations, DCM grades are for informational purposes and don't replace official third-party grading for authentication or resale value certification.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What does "evidence-based grading" mean?
              </h3>
              <p className="text-gray-700">
                Every defect or pristine assessment must be backed by observable evidence. We document specific locations, measurements, and visual characteristics for every finding. No assumptions — only deductions for defects we can actually see.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Can DCM grade cards already in slabs?
              </h3>
              <p className="text-gray-700">
                Yes! DCM Optic™ can detect professionally graded slabs from PSA, BGS, CGC, SGC, and other services. The system performs its own independent assessment while acknowledging visibility limitations from the holder.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Why do front and back have separate scores?
              </h3>
              <p className="text-gray-700">
                Following industry standards, we evaluate front and back independently with weighted averaging (55% front, 45% back). Front condition is weighted more heavily as it's the primary display side of the card.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                How should I photograph my cards for best results?
              </h3>
              <p className="text-gray-700">
                Use good lighting without glare, keep the card flat and centered, ensure the entire card is visible, and capture both front and back. Remove from holders when possible. Higher quality images (Grade A) result in ±0.25 uncertainty vs ±1.5 for Grade D images.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Ready to Grade Your Cards?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Experience the precision of DCM Optic™ grading technology. Get professional-grade assessments in under 60 seconds.
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
