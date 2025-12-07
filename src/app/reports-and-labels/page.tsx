import FloatingCardsBackground from '../ui/FloatingCardsBackground';
import Link from 'next/link';
import Image from 'next/image';

export default function ReportsAndLabelsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white relative">
      <FloatingCardsBackground />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Reports & Labels
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Professional documentation for your graded cards. Display, share, and sell with confidence.
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800 mb-1">Privacy & Security</h3>
              <p className="text-green-700">
                Only the original grader of a card can download reports and labels. This protects the integrity of your grades and ensures documentation remains tied to verified ownership.
              </p>
            </div>
          </div>
        </div>

        {/* Foldable Slab Label Section */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-10">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Foldable Slab Label</h2>
                <p className="text-purple-100">Avery Label Template 6871</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Perfect for Magnetic One-Touch Slabs</h3>
                <p className="text-gray-600 mb-4">
                  Our print-ready label is specifically designed to fit and fold over the top of magnetic one-touch slabs,
                  giving your cards a professional graded appearance for display or sale.
                </p>

                <h4 className="font-semibold text-gray-900 mb-2">Label Features:</h4>
                <ul className="space-y-2 text-gray-600 mb-6">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Card identification:</strong> Name, set, year, and card number</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>DCM grade:</strong> Prominently displayed numerical grade</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Condition label:</strong> Gem Mint, Mint, Near Mint, etc.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Serial number:</strong> Unique identifier for verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>QR code:</strong> Links directly to the card's grading page</span>
                  </li>
                </ul>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Pro Tip:</strong> Use Avery 6871 labels for best results. The label folds over the top edge of your one-touch, creating a clean, professional look that rivals traditional grading company slabs.
                  </p>
                </div>
              </div>

              <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  <div className="w-48 h-64 bg-gradient-to-b from-purple-100 to-purple-200 rounded-lg mx-auto mb-4 flex items-center justify-center border-2 border-purple-300 shadow-inner">
                    <div className="text-center px-4">
                      <div className="w-full h-8 bg-purple-600 rounded mb-2 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">DCM LABEL</span>
                      </div>
                      <div className="text-xs text-purple-600 font-medium">Charizard</div>
                      <div className="text-xs text-purple-500">Base Set</div>
                      <div className="text-2xl font-bold text-purple-700 my-2">9.5</div>
                      <div className="text-xs text-purple-600">Gem Mint</div>
                      <div className="w-8 h-8 bg-white rounded mx-auto mt-2 flex items-center justify-center">
                        <span className="text-[6px] text-gray-400">QR</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Label preview (actual label shown on card detail page)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full Grading Report Section */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Full Grading Report</h2>
                <p className="text-blue-100">Comprehensive One-Page PDF</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Card Documentation</h3>
                <p className="text-gray-600 mb-4">
                  The full grading report summarizes all card grading details onto a professional one-page printout.
                  Perfect for providing to buyers as proof of card quality or keeping with your collection records.
                </p>

                <h4 className="font-semibold text-gray-900 mb-2">Report Includes:</h4>
                <ul className="space-y-2 text-gray-600 mb-6">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Front & back images:</strong> High-quality photos of your card</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Detailed subgrades:</strong> Centering, corners, edges, and surface scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Condition analysis:</strong> Written assessment of each grading category</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Professional grade estimates:</strong> PSA, BGS, SGC, and CGC comparisons</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>QR verification:</strong> Scannable code linking to online record</span>
                  </li>
                </ul>

                <h4 className="font-semibold text-gray-900 mb-2">Ideal Uses:</h4>
                <ul className="space-y-1 text-gray-600 text-sm">
                  <li>• Include with cards sold online or in-person</li>
                  <li>• Document collection for insurance purposes</li>
                  <li>• Provide proof of condition to potential buyers</li>
                  <li>• Keep detailed records of your collection</li>
                </ul>
              </div>

              <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  <div className="w-56 h-72 bg-white rounded-lg mx-auto mb-4 shadow-lg border border-gray-200 p-3">
                    <div className="w-full h-6 bg-blue-600 rounded mb-2 flex items-center px-2">
                      <span className="text-white text-[8px] font-bold">DCM GRADING REPORT</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <div className="w-12 h-16 bg-gray-200 rounded"></div>
                      <div className="w-12 h-16 bg-gray-200 rounded"></div>
                      <div className="flex-1">
                        <div className="text-[6px] text-left text-gray-600 space-y-0.5">
                          <div className="font-bold">Card Name</div>
                          <div>Set • Year</div>
                          <div className="text-lg font-bold text-blue-600">9.5</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[6px]">
                        <span>Centering</span>
                        <span className="font-bold">9.5</span>
                      </div>
                      <div className="flex justify-between text-[6px]">
                        <span>Corners</span>
                        <span className="font-bold">9.5</span>
                      </div>
                      <div className="flex justify-between text-[6px]">
                        <span>Edges</span>
                        <span className="font-bold">10</span>
                      </div>
                      <div className="flex justify-between text-[6px]">
                        <span>Surface</span>
                        <span className="font-bold">9.5</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-[5px] text-gray-500 text-left">
                        Professional estimates: PSA 10 • BGS 9.5
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-[5px] text-gray-400">QR</span>
                      </div>
                      <div className="text-[5px] text-gray-400">Serial: 123456</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Report preview (actual report shown on card detail page)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Report Section */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-10">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Mini Report</h2>
                <p className="text-orange-100">Versatile Compact Format</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Multiple Display Options</h3>
                <p className="text-gray-600 mb-4">
                  The mini report is designed for maximum versatility. Whether you're displaying cards physically
                  or selling online, this compact format delivers essential grading information at a glance.
                </p>

                <h4 className="font-semibold text-gray-900 mb-2">Three Ways to Use:</h4>
                <div className="space-y-4 mb-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h5 className="font-medium text-orange-800 mb-1">1. Folding Display Stand</h5>
                    <p className="text-sm text-orange-700">
                      Fold the mini report to stand upright beside your physical card. Perfect for showcases,
                      display cases, or card shows where you want grade information visible.
                    </p>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h5 className="font-medium text-orange-800 mb-1">2. Top Loader Insert</h5>
                    <p className="text-sm text-orange-700">
                      Cut out and slide behind your card in a top loader. Buyers can see the grade
                      information right alongside the card without removing it from protection.
                    </p>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h5 className="font-medium text-orange-800 mb-1">3. Digital Image for Online Sales</h5>
                    <p className="text-sm text-orange-700">
                      Download the mini report as an image and upload directly to eBay, Mercari, Facebook Marketplace,
                      or any platform where card images can be shared. Instantly communicate card quality to buyers.
                    </p>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 mb-2">Mini Report Features:</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Card grade:</strong> Clear, prominent grade display</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Serial number:</strong> Unique identifier for authenticity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>QR code:</strong> Easy verification by scanning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Compact design:</strong> All essentials in minimal space</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center min-h-[300px]">
                <div className="text-center">
                  <div className="flex gap-4 items-end justify-center mb-4">
                    {/* Folded standing version */}
                    <div className="text-center">
                      <div className="w-20 h-28 bg-white rounded shadow-lg border border-gray-200 p-2 transform -rotate-3">
                        <div className="w-full h-3 bg-orange-500 rounded mb-1"></div>
                        <div className="text-[6px] font-bold text-gray-800">Pokemon Card</div>
                        <div className="text-xl font-bold text-orange-600">9</div>
                        <div className="text-[5px] text-gray-500">Near Mint</div>
                        <div className="w-6 h-6 bg-gray-100 rounded mx-auto mt-1">
                          <span className="text-[4px] text-gray-400">QR</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Standing</p>
                    </div>

                    {/* Top loader version */}
                    <div className="text-center">
                      <div className="w-16 h-24 bg-gradient-to-b from-transparent to-gray-200 rounded border-2 border-gray-300 relative">
                        <div className="absolute bottom-1 left-1 right-1 h-8 bg-white rounded shadow-inner p-1">
                          <div className="text-[5px] font-bold">DCM 9.5</div>
                          <div className="text-[4px] text-gray-500">#123456</div>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">In Top Loader</p>
                    </div>

                    {/* Digital version */}
                    <div className="text-center">
                      <div className="w-20 h-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                        <div className="text-[6px] font-bold text-gray-800 mb-1">eBay Listing</div>
                        <div className="w-full h-10 bg-orange-100 rounded flex items-center justify-center">
                          <span className="text-orange-600 font-bold text-sm">9.5</span>
                        </div>
                        <div className="text-[5px] text-gray-500 mt-1">Verified Grade</div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">Online Image</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Mini report versatility (actual format shown on card detail page)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Access Section */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl shadow-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6 text-center">How to Access Your Reports & Labels</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Grade Your Card</h3>
              <p className="text-gray-300 text-sm">
                Upload your card images and receive your DCM Optic™ grade within minutes.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">View Card Details</h3>
              <p className="text-gray-300 text-sm">
                Navigate to your card's detail page from your collection or the grading results.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Download & Print</h3>
              <p className="text-gray-300 text-sm">
                Find the Reports & Labels section and download your preferred format instantly.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/upload"
              className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Start Grading
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
