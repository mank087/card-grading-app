'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { signInWithPassword, signUp, getStoredSession, signInWithOAuth } from '../../lib/directAuth'
import FloatingCardsBackground from '../ui/FloatingCardsBackground'

// Declare rdt for TypeScript
declare global {
  interface Window {
    rdt: (...args: any[]) => void
  }
}

// Inner component that uses useSearchParams
function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExistingAccountError, setShowExistingAccountError] = useState(false)

  // Default to signup mode, unless mode=login is specified in URL
  const modeParam = searchParams.get('mode')
  const [isSignUp, setIsSignUp] = useState(modeParam !== 'login')

  useEffect(() => {
    // Check if user is already signed in
    const session = getStoredSession()
    if (session && session.user) {
      router.push('/collection')
    }
  }, [router])

  // Update mode when URL parameter changes
  useEffect(() => {
    setIsSignUp(modeParam !== 'login')
    // Clear the existing account error when switching modes
    setShowExistingAccountError(false)
  }, [modeParam])

  // Helper to check if error indicates existing account
  const isExistingAccountError = (errorMsg: string) => {
    const lowerError = errorMsg.toLowerCase()
    return lowerError.includes('already registered') ||
           lowerError.includes('already exists') ||
           lowerError.includes('user already') ||
           lowerError.includes('email already')
  }

  // Handle switching to login with pre-filled credentials
  const handleSwitchToLogin = () => {
    setShowExistingAccountError(false)
    setError('')
    setIsSignUp(false)
    // Update URL without full navigation to preserve form state
    router.push('/login?mode=login', { scroll: false })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowExistingAccountError(false)

    try {
      if (isSignUp) {
        const result = await signUp(email, password)
        if (result.error) {
          // Check if this is an "already exists" error
          if (isExistingAccountError(result.error)) {
            setShowExistingAccountError(true)
          } else {
            setError(result.error)
          }
        } else {
          // Track Reddit SignUp conversion
          if (typeof window !== 'undefined' && window.rdt) {
            window.rdt('track', 'SignUp')
            console.log('[Reddit Pixel] SignUp event tracked')
          }
          alert('Account created! Check your email for the confirmation link.')
        }
      } else {
        const result = await signInWithPassword(email, password)
        if (result.error) {
          setError(result.error)
        } else if (result.user) {
          // Check if this is a new user (created within last 60 seconds)
          const createdAt = new Date(result.user.created_at || 0).getTime()
          const now = Date.now()
          const isNewUser = (now - createdAt) < 60000

          // New users go to credits page for onboarding, existing users go to collection
          if (isNewUser) {
            router.push('/credits?welcome=true')
          } else {
            router.push('/collection')
          }
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    setOauthLoading(true)
    setError('')

    try {
      const result = await signInWithOAuth(provider)
      if (result.error) {
        setError(result.error)
        setOauthLoading(false)
      }
      // If successful, user will be redirected to OAuth provider
      // No need to set loading to false as page will redirect
    } catch (error: any) {
      console.error('OAuth error:', error)
      setError(error.message || 'An error occurred')
      setOauthLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Left Panel - Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 relative overflow-hidden">
        <FloatingCardsBackground />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 py-12">
          {/* Logo and Headline */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/DCM Logo white.png"
                alt="DCM Logo"
                width={64}
                height={64}
                className="object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">Dynamic Collectibles<br />Management</h1>
                <p className="text-purple-200">Professional Card Grading</p>
              </div>
            </div>
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Grade Your Cards<br />in Seconds
            </h2>
            <p className="text-xl text-purple-100">
              Get professional-quality condition assessments powered by DCM Optic™ technology.
            </p>
          </div>

          {/* Benefits List */}
          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Three-Pass AI Consensus</p>
                <p className="text-purple-200 text-sm">Every card graded 3 times independently for maximum accuracy</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Results in Under 60 Seconds</p>
                <p className="text-purple-200 text-sm">No waiting weeks or months for professional grading</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">8-Component Analysis</p>
                <p className="text-purple-200 text-sm">Centering, corners, edges & surface for front and back</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">All Card Types Supported</p>
                <p className="text-purple-200 text-sm">Sports, Pokémon, MTG, Lorcana, and more</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Free Credits with Signup</p>
                <p className="text-purple-200 text-sm">Try DCM grading when you create your account</p>
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="border-t border-purple-500/30 pt-8">
            <p className="text-purple-200 text-sm mb-4">Trusted by collectors for:</p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-white text-sm">Pre-submission screening</span>
              <span className="px-3 py-1 bg-white/10 rounded-full text-white text-sm">Collection management</span>
              <span className="px-3 py-1 bg-white/10 rounded-full text-white text-sm">Selling preparation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-gray-50 relative z-10">
        {/* Mobile Logo (shown only on small screens) */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/DCM-logo.png"
              alt="DCM Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <div className="text-left">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Dynamic Collectibles<br />Management</h1>
            </div>
          </div>
          <p className="text-gray-600">Professional card grading in seconds</p>
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-600">
              {isSignUp
                ? 'Start grading your cards with DCM Optic™ technology'
                : 'Sign in to access your collection and grade cards'}
            </p>
          </div>

          {/* Auth Form Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {oauthLoading ? 'Connecting...' : 'Continue with Google'}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={oauthLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-[#1877F2] text-white py-3 px-4 rounded-xl hover:bg-[#166FE5] disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {oauthLoading ? 'Connecting...' : 'Continue with Facebook'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>

              {showExistingAccountError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
                  <p className="mb-2">
                    That email is already associated with an existing DCM account.
                  </p>
                  <button
                    type="button"
                    onClick={handleSwitchToLogin}
                    className="text-purple-600 hover:text-purple-800 font-medium underline"
                  >
                    Try logging in instead
                  </button>
                </div>
              )}

              {error && !showExistingAccountError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-semibold shadow-lg shadow-purple-500/25"
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="mt-6 text-center">
              <Link
                href={isSignUp ? '/login?mode=login' : '/login?mode=signup'}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
              </Link>
            </div>
          </div>

          {/* Terms Notice */}
          <p className="mt-6 text-center text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-purple-600 hover:text-purple-800">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-purple-600 hover:text-purple-800">Privacy Policy</Link>
          </p>

          {/* Mobile Benefits (shown only on small screens) */}
          <div className="lg:hidden mt-10 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Why Dynamic Collectibles Management?</h3>

            {/* Benefits List - Expanded to match desktop */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">Three-Pass AI Consensus</p>
                  <p className="text-gray-600 text-sm">Every card graded 3 times independently for maximum accuracy</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">Results in Under 60 Seconds</p>
                  <p className="text-gray-600 text-sm">No waiting weeks or months for professional grading</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">8-Component Analysis</p>
                  <p className="text-gray-600 text-sm">Centering, corners, edges & surface for front and back</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">All Card Types Supported</p>
                  <p className="text-gray-600 text-sm">Sports, Pokémon, MTG, Lorcana, and more</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">Free Credits with Signup</p>
                  <p className="text-gray-600 text-sm">Try DCM grading when you create your account</p>
                </div>
              </div>
            </div>

            {/* Social Proof - Matching desktop */}
            <div className="border-t border-gray-200 pt-6">
              <p className="text-gray-500 text-sm mb-3 text-center">Trusted by collectors for:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">Pre-submission screening</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">Collection management</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">Selling preparation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// Loading fallback for Suspense
function LoginPageLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </main>
  )
}

// Wrapper component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  )
}
