'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-[10%] w-32 h-44 rotate-[-8deg]">
            <Image src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg" alt="" fill className="object-contain" />
          </div>
          <div className="absolute top-20 right-[15%] w-28 h-40 rotate-[12deg]">
            <Image src="/Sports/DCM-Card-LeBron-James-547249-front.jpg" alt="" fill className="object-contain" />
          </div>
          <div className="absolute bottom-10 left-[20%] w-24 h-34 rotate-[5deg]">
            <Image src="/promo-charizard.png" alt="" fill className="object-contain" />
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image src="/DCM-logo.png" alt="DCM" width={60} height={60} className="rounded-lg" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Get Started with DCM Grading
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Dynamic Collectibles Management (DCM) brings AI-powered card grading to collectors worldwide.
              Get professional-grade analysis in under 60 seconds — no shipping, no waiting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/upload"
                className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg"
              >
                Grade Your First Card
              </Link>
              <Link
                href="/credits"
                className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/20 transition-all"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What is DCM Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-6">
              What is DCM Grading?
            </h2>
            <p className="text-lg text-gray-600 text-center mb-12 max-w-3xl mx-auto">
              DCM (Dynamic Collectibles Management) is an AI-powered card grading service that provides instant,
              professional-grade analysis of your trading cards. Using advanced computer vision technology called
              DCM Optic™, we evaluate the same factors traditional grading companies assess — but deliver results
              in seconds, not months.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 rounded-2xl bg-gray-50">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Instant Results</h3>
                <p className="text-gray-600">Get comprehensive grading analysis in under 60 seconds. No waiting weeks or months.</p>
              </div>

              <div className="text-center p-6 rounded-2xl bg-gray-50">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Risk</h3>
                <p className="text-gray-600">Your cards never leave your hands. Simply upload photos — no shipping required.</p>
              </div>

              <div className="text-center p-6 rounded-2xl bg-gray-50">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Affordable</h3>
                <p className="text-gray-600">Starting at just $1 per card. Know your card's grade before deciding to submit elsewhere.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            How DCM Grading Works
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Grade your cards in three simple steps. No account setup hassles, no complicated forms.
          </p>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
                  <div className="absolute -top-4 left-8 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    1
                  </div>
                  <div className="pt-4">
                    <div className="w-full h-48 relative mb-6 bg-gray-100 rounded-xl overflow-hidden">
                      <Image
                        src="/Pokemon/Mega-charizard-x-ex-dcm-10.png"
                        alt="Upload card photos"
                        fill
                        className="object-contain p-4"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Upload Your Card Photos</h3>
                    <p className="text-gray-600">
                      Take clear photos of your card's front and back using your phone or camera.
                      Good lighting and a flat surface work best. Upload both images to start the grading process.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
                  <div className="absolute -top-4 left-8 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    2
                  </div>
                  <div className="pt-4">
                    <div className="w-full h-48 relative mb-6 bg-gray-100 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                        <span className="text-sm text-purple-600 font-medium">DCM Optic™ Analysis</span>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Analysis</h3>
                    <p className="text-gray-600">
                      Our DCM Optic™ AI examines 30+ condition factors in under 60 seconds.
                      It evaluates centering, corners, edges, and surface quality with precision accuracy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
                  <div className="absolute -top-4 left-8 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    3
                  </div>
                  <div className="pt-4">
                    <div className="w-full h-48 relative mb-6 bg-gray-100 rounded-xl overflow-hidden">
                      <Image
                        src="/Pokemon/DCM-MiniReport-Umbreon-ex-887696.jpg"
                        alt="Get your grade report"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Get Your Grade & Report</h3>
                    <p className="text-gray-600">
                      Receive detailed scores for each grading category, estimated PSA/BGS/CGC grades,
                      and downloadable reports and labels for your collection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Evaluate Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            What DCM Evaluates
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            DCM analyzes the same four key factors used by professional grading companies like PSA, BGS, and CGC.
          </p>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Centering */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Centering</h3>
                  <p className="text-gray-600 mb-3">
                    Measures how well the image is centered on the card. We calculate precise left/right
                    and top/bottom border ratios for both front and back.
                  </p>
                  <div className="text-sm text-blue-700 font-medium">
                    Example: 55/45 left-right, 52/48 top-bottom
                  </div>
                </div>
              </div>
            </div>

            {/* Corners */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Corners</h3>
                  <p className="text-gray-600 mb-3">
                    Examines all four corners for whitening, dings, bends, or wear.
                    Sharp, pristine corners are essential for high grades.
                  </p>
                  <div className="text-sm text-green-700 font-medium">
                    Checks: Whitening, fuzzing, dings, bends
                  </div>
                </div>
              </div>
            </div>

            {/* Edges */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 border border-orange-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Edges</h3>
                  <p className="text-gray-600 mb-3">
                    Analyzes all four edges for chipping, whitening, or damage.
                    Clean edges without wear significantly impact the overall grade.
                  </p>
                  <div className="text-sm text-orange-700 font-medium">
                    Checks: Chips, whitening, roughness, nicks
                  </div>
                </div>
              </div>
            </div>

            {/* Surface */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 border border-purple-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Surface</h3>
                  <p className="text-gray-600 mb-3">
                    Inspects the card surface for scratches, print lines, staining, holo damage,
                    and other defects that affect appearance and value.
                  </p>
                  <div className="text-sm text-purple-700 font-medium">
                    Checks: Scratches, print lines, stains, holo damage
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grading Scale Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            DCM Grading Scale
          </h2>
          <p className="text-lg text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            DCM uses a 10-point grading scale aligned with industry standards.
            Each grade reflects the overall condition of your card.
          </p>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { grade: 10, label: 'GEM MINT', color: 'from-emerald-500 to-green-600', desc: 'Perfect condition' },
                { grade: 9, label: 'MINT', color: 'from-green-500 to-emerald-600', desc: 'Near perfect' },
                { grade: 8, label: 'NM-MT', color: 'from-blue-500 to-indigo-600', desc: 'Near Mint-Mint' },
                { grade: 7, label: 'NM', color: 'from-indigo-500 to-purple-600', desc: 'Near Mint' },
                { grade: 6, label: 'EX-MT', color: 'from-purple-500 to-pink-600', desc: 'Excellent-Mint' },
              ].map((item) => (
                <div key={item.grade} className={`bg-gradient-to-br ${item.color} rounded-xl p-4 text-center`}>
                  <div className="text-4xl font-bold mb-1">{item.grade}</div>
                  <div className="text-sm font-semibold mb-1">{item.label}</div>
                  <div className="text-xs opacity-80">{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Grade Comparison</h3>
              <p className="text-gray-400 text-sm mb-4">
                DCM provides estimated grade equivalents for major grading companies so you can make informed
                decisions about professional submissions.
              </p>
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="font-bold text-purple-400 mb-1">DCM</div>
                  <div className="text-gray-300">Our Grade</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="font-bold text-red-400 mb-1">PSA</div>
                  <div className="text-gray-300">Estimate</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="font-bold text-blue-400 mb-1">BGS</div>
                  <div className="text-gray-300">Estimate</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="font-bold text-green-400 mb-1">CGC</div>
                  <div className="text-gray-300">Estimate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards We Grade Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            Cards We Grade
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            DCM supports grading for all major trading card categories and brands.
          </p>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {/* Pokemon */}
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border border-yellow-200">
              <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg"
                  alt="Pokemon Cards"
                  fill
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Pokemon Cards</h3>
              <p className="text-gray-600 text-sm mb-3">
                All Pokemon TCG cards including vintage WOTC, modern sets, Japanese cards, and special editions.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Base Set</span>
                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Scarlet & Violet</span>
                <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">Japanese</span>
              </div>
            </div>

            {/* Sports */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/Sports/DCM-Card-LeBron-James-547249-front.jpg"
                  alt="Sports Cards"
                  fill
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sports Cards</h3>
              <p className="text-gray-600 text-sm mb-3">
                NFL, NBA, MLB, NHL, UFC, WWE, Soccer, and more. All major brands supported.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">Panini</span>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">Topps</span>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">Upper Deck</span>
              </div>
            </div>

            {/* Other TCGs */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
              <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
                <Image
                  src="/DCM-Card-Rapunzel---High-Climber-710817-front.jpg"
                  alt="Other TCG Cards"
                  fill
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Other TCGs</h3>
              <p className="text-gray-600 text-sm mb-3">
                Magic: The Gathering, Disney Lorcana, Yu-Gi-Oh!, One Piece, and other trading card games.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full">MTG</span>
                <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full">Lorcana</span>
                <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full">Yu-Gi-Oh!</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            What You Get
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Every DCM grading includes comprehensive reports and downloadable assets.
          </p>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative h-64 bg-gray-100">
                <Image
                  src="/DCM-full-downloadable-report.png"
                  alt="Full Grading Report"
                  fill
                  className="object-contain p-4"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Detailed Grade Report</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Individual scores for centering, corners, edges, surface
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Front and back analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    PSA, BGS, CGC grade estimates
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Defect identification and notes
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative h-64 bg-gray-100">
                <Image
                  src="/DCM-Label-Mag-OneTouch.png"
                  alt="Downloadable Labels"
                  fill
                  className="object-contain p-4"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Downloadable Labels & Images</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Printable labels for magnetic holders
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Graded card images with DCM slab overlay
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Mini reports for social sharing
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    High-resolution downloads
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            No subscriptions, no hidden fees. Pay only for what you use.
          </p>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-500 uppercase mb-2">Basic</div>
                <div className="text-4xl font-bold text-gray-900 mb-1">$2.99</div>
                <div className="text-gray-500 text-sm mb-4">1 credit</div>
                <div className="text-gray-600 text-sm">Perfect for trying DCM</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
                BEST VALUE
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-purple-200 uppercase mb-2">Pro</div>
                <div className="text-4xl font-bold mb-1">$9.99</div>
                <div className="text-purple-200 text-sm mb-4">5 + 3 bonus credits</div>
                <div className="text-purple-100 text-sm">$1.25 per card</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-500 uppercase mb-2">Elite</div>
                <div className="text-4xl font-bold text-gray-900 mb-1">$19.99</div>
                <div className="text-gray-500 text-sm mb-4">20 + 5 bonus credits</div>
                <div className="text-gray-600 text-sm">$0.80 per card</div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/credits"
              className="inline-block bg-purple-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-purple-700 transition-all"
            >
              View All Pricing Options
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: "Is DCM grading the same as PSA, BGS, or CGC grading?",
                a: "DCM provides AI-powered grading analysis that evaluates the same factors as traditional grading companies. While we're not a replacement for encapsulated slabs, DCM helps you understand your card's condition before deciding whether to submit to professional graders."
              },
              {
                q: "How accurate is DCM's AI grading?",
                a: "DCM Optic™ analyzes 30+ condition factors using advanced computer vision. Our grade estimates are designed to align with industry standards. We recommend using DCM to pre-screen cards before submitting to traditional grading services."
              },
              {
                q: "Do I need to ship my cards?",
                a: "No! DCM is completely digital. Simply take photos of your card's front and back and upload them. Your cards never leave your possession."
              },
              {
                q: "What photo quality do I need?",
                a: "For best results, use good lighting (natural light works great), place your card on a flat, contrasting surface, and take clear, focused photos. Most modern smartphones work perfectly."
              },
              {
                q: "Can I use DCM grades to sell my cards?",
                a: "Yes! Many collectors use DCM grades and reports to inform buyers about card condition. Our downloadable labels and slab images are perfect for listings. However, buyers typically pay premium prices for professionally encapsulated cards."
              },
              {
                q: "How long does grading take?",
                a: "DCM delivers results in under 60 seconds. Upload your photos and get your comprehensive grade report almost instantly."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Grade Your Cards?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of collectors who use DCM to know their cards' grades instantly.
            Start grading today — no account required to try.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/upload"
              className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold text-lg px-10 py-4 rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg"
            >
              Grade Your First Card
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-block bg-white/10 backdrop-blur border border-white/20 text-white font-semibold text-lg px-10 py-4 rounded-xl hover:bg-white/20 transition-all"
            >
              Create Free Account
            </Link>
          </div>
          <p className="mt-6 text-gray-400 text-sm">
            50,000+ cards graded • Instant results • No shipping required
          </p>
        </div>
      </section>
    </main>
  )
}
