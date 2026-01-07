'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { setSessionFromUrl, updatePassword } from '@/lib/directAuth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  // On mount, parse the recovery token from URL and set session
  useEffect(() => {
    const initSession = async () => {
      const result = await setSessionFromUrl()

      if (result.error) {
        console.error('[ResetPassword] Session error:', result.error)
        setSessionError(true)
      }

      setInitializing(false)
    }

    initSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const result = await updatePassword(password)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?mode=login')
      }, 3000)
    }

    setLoading(false)
  }

  // Show loading state while initializing
  if (initializing) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    )
  }

  // Show error if no valid recovery token
  if (sessionError) {
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
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid or expired link</h2>
            <p className="text-gray-600 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </main>
    )
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-gray-600 mb-6">
                Your password has been successfully reset. You'll be redirected to the login page shortly.
              </p>
              <Link
                href="/login?mode=login"
                className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
              >
                Go to login
              </Link>
            </div>
          ) : (
            // Form state
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h2>
              <p className="text-gray-600 mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Confirm new password"
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
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
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
