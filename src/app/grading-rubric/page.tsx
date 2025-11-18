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
            Precision grading powered by DCM Optic™ - our proprietary 16-step evaluation process that delivers professional-grade assessments in minutes
          </p>
        </div>

        {/* The DCM Difference */}
        <section className="mb-16">
          <div className="bg-purple-600 text-white rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold mb-4">The DCM Difference</h2>
            <p className="text-lg mb-4">
              Traditional grading services can take weeks or months. DCM Optic™ combines advanced artificial intelligence with decades of industry grading standards to deliver accurate, consistent results in under 2 minutes.
            </p>
            <p className="text-lg">
              Every card receives the same meticulous attention to detail, whether it's your first submission or your thousandth.
            </p>
          </div>
        </section>

        {/* 16-Step Process */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Our 16-Step Grading Process
          </h2>

          <div className="space-y-6">
            {/* Step 1-4: Image Analysis */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 1: Image Quality & Validation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-blue-600">Step 1: Image Completeness Check</p>
                  <p className="text-sm text-gray-600">Verifies both front and back images are present and properly oriented</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Step 2: Resolution Assessment</p>
                  <p className="text-sm text-gray-600">Evaluates image clarity and assigns confidence rating (A, B, C, or D)</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Step 3: Lighting Analysis</p>
                  <p className="text-sm text-gray-600">Checks for proper illumination, glare, and shadow interference</p>
                </div>
                <div>
                  <p className="font-semibold text-blue-600">Step 4: Focus & Clarity Verification</p>
                  <p className="text-sm text-gray-600">Ensures sufficient detail for accurate grading</p>
                </div>
              </div>
            </div>

            {/* Step 5-8: Physical Condition */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 2: Physical Condition Evaluation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-green-600">Step 5: Corner Examination</p>
                  <p className="text-sm text-gray-600">Microscopic analysis of all four corners for wear, rounding, and fiber exposure</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Step 6: Edge Inspection</p>
                  <p className="text-sm text-gray-600">Evaluates all four edges for whitening, chipping, and roughness</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Step 7: Surface Analysis</p>
                  <p className="text-sm text-gray-600">Detects scratches, print defects, staining, and surface damage</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">Step 8: Structural Integrity Check</p>
                  <p className="text-sm text-gray-600">Identifies creases, bends, dents, and tears with severity assessment</p>
                </div>
              </div>
            </div>

            {/* Step 9-12: Centering & Alignment */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 3: Centering & Alignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-yellow-600">Step 9: Left-Right Centering Measurement</p>
                  <p className="text-sm text-gray-600">Calculates precise border ratios using multiple methods</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Step 10: Top-Bottom Centering Measurement</p>
                  <p className="text-sm text-gray-600">Evaluates vertical centering consistency</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Step 11: Registration Analysis</p>
                  <p className="text-sm text-gray-600">Checks print alignment and color registration accuracy</p>
                </div>
                <div>
                  <p className="font-semibold text-yellow-600">Step 12: Orientation Verification</p>
                  <p className="text-sm text-gray-600">Ensures proper card rotation and directional accuracy</p>
                </div>
              </div>
            </div>

            {/* Step 13-16: Authentication & Final */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Phase 4: Authentication & Special Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-purple-600">Step 13: Card Information Extraction</p>
                  <p className="text-sm text-gray-600">Identifies player, set, year, manufacturer, and card number</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Step 14: Special Features Detection</p>
                  <p className="text-sm text-gray-600">Recognizes autographs, memorabilia, serial numbers, and parallels</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Step 15: Professional Slab Recognition</p>
                  <p className="text-sm text-gray-600">Detects existing grades from PSA, BGS, CGC, SGC, and other services</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-600">Step 16: Final Grade Calculation</p>
                  <p className="text-sm text-gray-600">Aggregates all factors to determine final grade with uncertainty range</p>
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
              DCM uses a 10-point scale with 0.1 precision, aligned with industry-standard grading criteria from PSA, BGS, and CGC. Each grade reflects the overall condition of your card.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border-l-4 border-yellow-500">
                <div className="text-3xl font-bold text-yellow-800 w-16">10</div>
                <div>
                  <p className="font-bold text-gray-900">Gem Mint</p>
                  <p className="text-sm text-gray-600">Virtually perfect card with sharp corners, pristine surface, and perfect centering</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                <div className="text-3xl font-bold text-green-800 w-16">9</div>
                <div>
                  <p className="font-bold text-gray-900">Mint</p>
                  <p className="text-sm text-gray-600">Near-perfect with only minor imperfections under close inspection</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                <div className="text-3xl font-bold text-blue-800 w-16">8</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint-Mint</p>
                  <p className="text-sm text-gray-600">Excellent condition with slight wear visible upon close examination</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-400">
                <div className="text-3xl font-bold text-blue-700 w-16">7</div>
                <div>
                  <p className="font-bold text-gray-900">Near Mint</p>
                  <p className="text-sm text-gray-600">Minor surface wear or slight corner/edge wear</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-500">
                <div className="text-3xl font-bold text-purple-800 w-16">6</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent-Mint</p>
                  <p className="text-sm text-gray-600">Visible wear on corners or edges, but still displays well</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-400">
                <div className="text-3xl font-bold text-purple-700 w-16">5</div>
                <div>
                  <p className="font-bold text-gray-900">Excellent</p>
                  <p className="text-sm text-gray-600">Moderate wear with slightly rounded corners</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-l-4 border-gray-500">
                <div className="text-3xl font-bold text-gray-800 w-16">1-4</div>
                <div>
                  <p className="font-bold text-gray-900">Good to Very Good</p>
                  <p className="text-sm text-gray-600">Significant wear, creasing, or other damage affecting overall appearance</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Cards with structural damage (creases, bends, tears) receive grade caps based on severity. This ensures consistency with professional grading standards.
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
              Every DCM grade includes an <strong>Image Confidence Rating</strong> and <strong>Grade Uncertainty Range</strong>. This transparency helps you understand how confident the assessment is based on your submitted photos.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Image Confidence Levels</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-green-800">A</span>
                      <span className="text-sm font-semibold text-green-700">Excellent Quality</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Crystal clear images with perfect lighting, sharp focus, and no glare. Highest grading confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-blue-800">B</span>
                      <span className="text-sm font-semibold text-blue-700">Good Quality</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Clear images with minor issues like slight glare or shadows. High grading confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-yellow-800">C</span>
                      <span className="text-sm font-semibold text-yellow-700">Fair Quality</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Acceptable images with noticeable issues like moderate glare, lower resolution, or focus problems. Moderate confidence.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-red-800">D</span>
                      <span className="text-sm font-semibold text-red-700">Poor Quality</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Images with significant issues like heavy glare, blur, or poor lighting. Lower grading confidence - consider resubmitting.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Grade Uncertainty Ranges</h3>
                <p className="text-gray-700 mb-4">
                  The uncertainty range indicates how much the actual grade might vary based on image quality and card condition complexity.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="font-semibold text-gray-900">±0.25 to ±0.5</span>
                    <span className="text-sm text-green-700">A-rated images</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-semibold text-gray-900">±0.5 to ±0.75</span>
                    <span className="text-sm text-blue-700">B-rated images</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="font-semibold text-gray-900">±0.75 to ±1.0</span>
                    <span className="text-sm text-yellow-700">C-rated images</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="font-semibold text-gray-900">±1.0 to ±1.5</span>
                    <span className="text-sm text-red-700">D-rated images</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-800">
                    <strong>Example:</strong> A card graded 8.5 with ±0.5 uncertainty means the grade likely falls between 8.0 and 9.0 based on the image quality provided.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pro Tip: Getting the Best Confidence Rating
              </h4>
              <ul className="text-sm text-blue-800 space-y-1 ml-7">
                <li>• Use natural lighting or a bright, diffused light source</li>
                <li>• Avoid flash photography that creates glare</li>
                <li>• Keep the card flat and parallel to the camera</li>
                <li>• Fill the frame with the card, leaving minimal background</li>
                <li>• Ensure the entire card is in focus</li>
                <li>• Take photos against a contrasting, solid-color background</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Component Scores */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Detailed Component Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Centering Score
              </h3>
              <p className="text-gray-700 mb-3">
                Measures how evenly the borders are distributed around the card. Perfect centering (10.0) means 50/50 left-right and top-bottom.
              </p>
              <p className="text-sm text-gray-600">
                Graded from 1.0-10.0 with 0.5 precision
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                Corners Score
              </h3>
              <p className="text-gray-700 mb-3">
                Evaluates all four corners for sharpness, rounding, and white fiber exposure. Each corner is individually assessed.
              </p>
              <p className="text-sm text-gray-600">
                Graded from 1.0-10.0 with 0.5 precision
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                Edges Score
              </h3>
              <p className="text-gray-700 mb-3">
                Examines all four edges for whitening, chipping, roughness, and other defects. Factory-fresh edges score 10.0.
              </p>
              <p className="text-sm text-gray-600">
                Graded from 1.0-10.0 with 0.5 precision
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                Surface Score
              </h3>
              <p className="text-gray-700 mb-3">
                Detects scratches, print defects, stains, and other surface imperfections on both front and back.
              </p>
              <p className="text-sm text-gray-600">
                Graded from 1.0-10.0 with 0.5 precision
              </p>
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
              DCM Optic™ is our proprietary grading technology that combines advanced artificial intelligence with industry-standard evaluation criteria. Trained on thousands of professionally graded cards, our system provides consistent, accurate assessments that align with PSA, BGS, and CGC grading standards.
            </p>
            <p className="text-lg text-gray-700 mb-4">
              Every submission is processed through the same rigorous 16-step evaluation, ensuring fairness and consistency across all card types, from vintage baseball to modern Pokémon.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">99.9%</p>
                <p className="text-sm text-gray-600">Consistent Accuracy</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-600 mb-2">&lt;2 min</p>
                <p className="text-sm text-gray-600">Average Grading Time</p>
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
                DCM Optic™ uses the same grading criteria as PSA, BGS, and CGC. While we provide accurate assessments, DCM grades are for informational purposes and don't replace official third-party grading for authentication or resale value certification.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What is the uncertainty range?
              </h3>
              <p className="text-gray-700">
                Every grade includes an uncertainty range (±0.25 to ±1.5) based on image quality and card condition factors. Higher quality images result in lower uncertainty. This transparency helps you understand the confidence level of your grade.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Can DCM grade cards already in slabs?
              </h3>
              <p className="text-gray-700">
                Yes! DCM Optic™ can detect professionally graded slabs from PSA, BGS, CGC, SGC, and other services. The system will extract the existing grade while also performing its own independent assessment.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What card types are supported?
              </h3>
              <p className="text-gray-700">
                DCM grades all major card categories: Sports (Baseball, Basketball, Football, Hockey, Soccer, Wrestling), Pokémon, Magic: The Gathering, Lorcana, and other trading card games. Each category uses optimized grading parameters.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                How should I photograph my cards for best results?
              </h3>
              <p className="text-gray-700">
                Use good lighting without glare, keep the card flat and centered, ensure the entire card is visible, and capture both front and back. Higher quality images result in more accurate grades with lower uncertainty ranges.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white shadow-xl">
            <h2 className="text-3xl font-bold mb-4">Ready to Grade Your Cards?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Experience the precision of DCM Optic™ grading technology. Get professional-grade assessments in under 2 minutes.
            </p>
            <a
              href="/upload?category=Sports"
              className="inline-block bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Grade Your First Card Free
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
