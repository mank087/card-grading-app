'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { resetPasswordForEmail } from '@/lib/directAuth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await resetPasswordForEmail(email)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/DCM-logo.png"
              alt="DCM Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-xl font-bold text-gray-900">DCM Grading</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {success ? (
            // Success state
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-600 mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
                Click the link in the email to reset your password.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                  }}
                  className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all"
                >
                  Try a different email
                </button>
                <Link
                  href="/login?mode=login"
                  className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
                >
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            // Form state
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h2>
              <p className="text-gray-600 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-purple-500/25"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login?mode=login"
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Help text */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Need help?{' '}
          <a href="mailto:support@dcmgrading.com" className="text-purple-600 hover:text-purple-800">
            Contact support
          </a>
        </p>
      </div>
    </main>
  )
}
