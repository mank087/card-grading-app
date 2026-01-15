'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredSession } from '@/lib/directAuth'

/**
 * eBay Connect Page
 *
 * This page initiates the eBay OAuth flow.
 * User must be logged in to connect their eBay account.
 */
export default function EbayConnectPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'not_logged_in' | 'redirecting' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initiateOAuth = async () => {
      // Check if user is logged in
      const session = getStoredSession()

      if (!session?.access_token) {
        setStatus('not_logged_in')
        return
      }

      setStatus('redirecting')

      try {
        // Call our auth endpoint with the token
        const response = await fetch('/api/ebay/auth?return_url=/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          redirect: 'manual', // Don't auto-follow redirects
        })

        if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 307) {
          // Get the redirect URL from the response
          const redirectUrl = response.headers.get('Location')
          if (redirectUrl) {
            window.location.href = redirectUrl
            return
          }
        }

        // If we get a JSON response, it might be an error
        if (response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json()
          if (data.error) {
            setError(data.error)
            setStatus('error')
            return
          }
        }

        // If response is ok but no redirect, something is wrong
        setError('Unexpected response from server')
        setStatus('error')
      } catch (err) {
        console.error('Error initiating eBay OAuth:', err)
        setError('Failed to connect to eBay. Please try again.')
        setStatus('error')
      }
    }

    initiateOAuth()
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (status === 'not_logged_in') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h1>
          <p className="text-gray-600 mb-6">
            You need to be logged in to connect your eBay account.
          </p>
          <Link
            href="/login?redirect=/ebay/connect"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Log In to Continue
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'redirecting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Redirecting to eBay...</p>
          <p className="text-gray-400 text-sm">You'll be asked to authorize DCM to access your eBay account.</p>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h1>
        <p className="text-gray-600 mb-6">
          {error || 'Something went wrong while connecting to eBay.'}
        </p>
        <div className="space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/account"
            className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Back to Account
          </Link>
        </div>
      </div>
    </div>
  )
}
