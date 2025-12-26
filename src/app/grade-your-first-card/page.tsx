'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getStoredSession } from '@/lib/directAuth'
import { useCredits } from '@/contexts/CreditsContext'

export default function GradeYourFirstCardPage() {
  const router = useRouter()
  const { balance, isLoading } = useCredits()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [activeStep, setActiveStep] = useState(1)

  useEffect(() => {
    const session = getStoredSession()
    setIsAuthenticated(!!session?.access_token)
  }, [])

  const steps = [
    { number: 1, title: 'Capture Photos', icon: '📸' },
    { number: 2, title: 'Photo Quality', icon: '✨' },
    { number: 3, title: 'Report Defects', icon: '🔍' },
    { number: 4, title: 'Get Results', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Welcome to DCM Grading!
            </h1>
            <p className="text-xl text-white/90 mb-6 max-w-2xl mx-auto">
              You have <span className="font-bold text-yellow-300">1 free credit</span> to grade your first card.
              Here&apos;s everything you need to know to get started.
            </p>

            {/* CTA Button */}
            <div className="relative inline-block mb-6">
              {/* Animated glow ring */}
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-white to-yellow-400 rounded-xl blur opacity-75 animate-pulse"></div>
              <Link
                href="/upload"
                className="relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 font-bold py-4 px-10 rounded-xl text-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-xl hover:shadow-2xl hover:scale-105 transform"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Grade My First Card
                <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Credit Balance */}
            {isAuthenticated && (
              <div className="inline-flex items-center gap-3 bg-white/20 rounded-full px-6 py-3 backdrop-blur-sm">
                <span className="text-white/90">Your Balance:</span>
                {isLoading ? (
                  <span className="animate-pulse bg-white/30 rounded w-8 h-6"></span>
                ) : (
                  <span className="text-2xl font-bold text-yellow-300">{balance}</span>
                )}
                <span className="text-white/90">credit{balance !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="sticky top-0 z-20 bg-white shadow-md">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex justify-center gap-2 sm:gap-4 py-4 overflow-x-auto">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => {
                  setActiveStep(step.number)
                  document.getElementById(`step-${step.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeStep === step.number
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{step.icon}</span>
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Step 1: Capture Photos */}
        <section id="step-1" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center text-xl font-bold">
              1
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Capture Your Card Photos</h2>
          </div>

          <p className="text-gray-600 mb-8 text-lg">
            You&apos;ll need clear photos of both the <strong>front</strong> and <strong>back</strong> of your card.
            You can use your device&apos;s camera directly or upload existing photos from your gallery.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Camera Option */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Use Camera</h3>
                <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">RECOMMENDED</span>
              </div>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Built-in card alignment guides</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Optimal for centering analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Real-time preview before capture</span>
                </li>
              </ul>
            </div>

            {/* Gallery Option */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">Upload from Gallery</h3>
              </div>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Use existing high-quality photos</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Works on desktop and mobile</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Use scanner images for best results</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card Types */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100">
            <h4 className="font-bold text-gray-900 mb-4">Supported Card Types</h4>
            <div className="flex flex-wrap gap-3">
              {['Pokemon', 'Magic: The Gathering', 'Sports Cards', 'Disney Lorcana', 'Other TCGs'].map((type) => (
                <span key={type} className="bg-white px-4 py-2 rounded-full text-gray-700 font-medium shadow-sm">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Step 2: Photo Quality */}
        <section id="step-2" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center text-xl font-bold">
              2
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Photo Quality Tips</h2>
          </div>

          <p className="text-gray-600 mb-8 text-lg">
            Better photos lead to more accurate grades. Follow these tips for the best results:
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Lighting */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-yellow-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Good Lighting</h4>
              <p className="text-gray-600 text-sm">
                Use natural daylight or bright, even lighting. Avoid harsh shadows and direct flash that can wash out details.
              </p>
            </div>

            {/* Flat Surface */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Flat Surface</h4>
              <p className="text-gray-600 text-sm">
                Place your card on a flat, contrasting background. A dark mat or solid-colored surface works best.
              </p>
            </div>

            {/* Straight Angle */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Straight Angle</h4>
              <p className="text-gray-600 text-sm">
                Hold your camera directly above the card, perpendicular to the surface. This ensures accurate centering analysis.
              </p>
            </div>

            {/* Fill the Frame */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Fill the Frame</h4>
              <p className="text-gray-600 text-sm">
                Get close enough so the card fills most of the image. More detail means better defect detection.
              </p>
            </div>

            {/* In Focus */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Sharp Focus</h4>
              <p className="text-gray-600 text-sm">
                Tap on the card to focus before capturing. Blurry images make it harder to detect surface imperfections.
              </p>
            </div>

            {/* No Sleeves */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Remove Sleeves</h4>
              <p className="text-gray-600 text-sm">
                Take the card out of sleeves and top loaders. Plastic can cause glare and hide surface defects.
              </p>
            </div>
          </div>

          {/* Good vs Bad Examples */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h4 className="font-bold text-gray-900 mb-4">Image Confidence Grades</h4>
            <p className="text-gray-600 mb-6">
              Our system assigns a confidence grade (A-D) to your photos. Higher confidence means more reliable grading results.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="text-3xl font-bold text-green-600 mb-2">A</div>
                <div className="text-sm font-medium text-green-700">Excellent</div>
                <div className="text-xs text-green-600 mt-1">Professional quality</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">B</div>
                <div className="text-sm font-medium text-blue-700">Good</div>
                <div className="text-xs text-blue-600 mt-1">Clear and sharp</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-600 mb-2">C</div>
                <div className="text-sm font-medium text-yellow-700">Acceptable</div>
                <div className="text-xs text-yellow-600 mt-1">Some limitations</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
                <div className="text-3xl font-bold text-red-600 mb-2">D</div>
                <div className="text-sm font-medium text-red-700">Poor</div>
                <div className="text-xs text-red-600 mt-1">Consider retaking</div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 3: Report Defects */}
        <section id="step-3" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center text-xl font-bold">
              3
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Self-Report Condition</h2>
          </div>

          <p className="text-gray-600 mb-8 text-lg">
            Before grading, you&apos;ll have a chance to report any defects you know about.
            This helps our AI focus on potential issues and provide more accurate grades.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* No Defects */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">&quot;No Known Defects&quot;</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Select this if you believe your card is in excellent condition with no visible issues.
                Our AI will still perform a thorough analysis.
              </p>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-sm text-gray-500">
                  <strong>Tip:</strong> Even if you select &quot;no defects,&quot; our DCM Optic™ system will detect
                  any imperfections that may not be visible to the naked eye.
                </p>
              </div>
            </div>

            {/* With Defects */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">&quot;Report Known Issues&quot;</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Describe any defects you&apos;ve noticed. Being upfront helps ensure accurate grading
                and sets appropriate expectations.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Common issues to report:</p>
                <div className="flex flex-wrap gap-2">
                  {['Corner wear', 'Edge whitening', 'Surface scratches', 'Centering issues', 'Print lines', 'Creases'].map((defect) => (
                    <span key={defect} className="bg-white px-3 py-1 rounded-full text-xs font-medium text-gray-600 border border-gray-200">
                      {defect}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-1">Why Report Defects?</h4>
                <p className="text-gray-600">
                  Self-reporting helps calibrate our AI analysis. If you mention a scratch and we detect it,
                  that confirms the accuracy. If you report a clean card but we find issues, we&apos;ll highlight
                  them in detail so you know exactly what affects your grade.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: Get Results */}
        <section id="step-4" className="mb-16 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center text-xl font-bold">
              4
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Grading Results</h2>
          </div>

          <p className="text-gray-600 mb-8 text-lg">
            Within seconds, you&apos;ll receive a comprehensive grading report. Here&apos;s what our DCM Optic™ system analyzes:
          </p>

          {/* What We Grade */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md p-5 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h4 className="font-bold text-gray-900 mb-1">Centering</h4>
              <p className="text-sm text-gray-600">Border symmetry front and back</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 text-center">
              <div className="text-4xl mb-3">📐</div>
              <h4 className="font-bold text-gray-900 mb-1">Corners</h4>
              <p className="text-sm text-gray-600">Sharpness and wear analysis</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 text-center">
              <div className="text-4xl mb-3">📏</div>
              <h4 className="font-bold text-gray-900 mb-1">Edges</h4>
              <p className="text-sm text-gray-600">Chipping, whitening, nicks</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5 text-center">
              <div className="text-4xl mb-3">✨</div>
              <h4 className="font-bold text-gray-900 mb-1">Surface</h4>
              <p className="text-sm text-gray-600">Scratches, print quality, holo</p>
            </div>
          </div>

          {/* Example Outputs */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h4 className="font-bold text-gray-900 mb-6 text-xl">Example Grading Output</h4>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Card with Label */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">Graded Card with Label</p>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg bg-gray-100">
                  <Image
                    src="/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg"
                    alt="Example graded Pokemon card with DCM label"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Mini Report */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-3">Downloadable Mini Report</p>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg bg-gray-100">
                  <Image
                    src="/Pokemon/DCM-MiniReport-Umbreon-ex-887696.jpg"
                    alt="Example DCM grading mini report"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What You Get */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200">
            <h4 className="font-bold text-gray-900 mb-4 text-lg">What&apos;s Included in Every Grade</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Overall Grade (1-10)</p>
                  <p className="text-sm text-gray-600">Whole number grade based on condition</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Subgrades</p>
                  <p className="text-sm text-gray-600">Individual scores for each category</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Detailed Analysis</p>
                  <p className="text-sm text-gray-600">Written explanation of findings</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Downloadable Labels</p>
                  <p className="text-sm text-gray-600">Print labels for slabs or display</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Card Identification</p>
                  <p className="text-sm text-gray-600">Auto-detected name, set, and number</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Market Links</p>
                  <p className="text-sm text-gray-600">eBay and TCGPlayer pricing</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Example Cards Gallery */}
        <section className="mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">Recently Graded Cards</h2>
          <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            See examples of cards graded by our DCM Optic™ system across different categories.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { src: '/Pokemon/DCM-Card-Umbreon-ex-887696-front.jpg', name: 'Umbreon ex' },
              { src: '/DCM-Card-Lugia-217275-front.jpg', name: 'Lugia' },
              { src: '/Sports/DCM-Card-LeBron-James-547249-front.jpg', name: 'LeBron James' },
              { src: '/DCM-Card-Shohei-Ohtani-496896-front.jpg', name: 'Shohei Ohtani' },
            ].map((card, i) => (
              <div key={i} className="group">
                <div className="relative aspect-[3/4.2] rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02] bg-gray-100">
                  <Image
                    src={card.src}
                    alt={`${card.name} graded card`}
                    fill
                    className="object-contain"
                  />
                </div>
                <p className="text-center text-sm font-medium text-gray-700 mt-2">{card.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-white">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Grade Your First Card?</h2>
            <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
              You have 1 free credit waiting. Select your card type and start grading in seconds!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/upload"
                className="inline-flex items-center justify-center gap-2 bg-white text-purple-600 font-bold py-4 px-8 rounded-xl text-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Grade My Card
              </Link>
              <Link
                href="/credits"
                className="inline-flex items-center justify-center gap-2 bg-white/20 text-white font-bold py-4 px-8 rounded-xl text-lg hover:bg-white/30 transition-all"
              >
                View Credit Packages
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
