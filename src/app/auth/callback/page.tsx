'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOAuthSession, getStoredSession } from '@/lib/directAuth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Completing authentication...')

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Wait for Supabase SDK to process URL hash (contains access_token, refresh_token)
        setStatus('Processing authentication...')
        await new Promise(resolve => setTimeout(resolve, 500))

        // Get the OAuth session after redirect
        console.log('[OAuth Callback] Getting OAuth session...')
        const result = await getOAuthSession()

        if (result.error) {
          console.error('[OAuth Callback] Session error:', result.error)
          setError(result.error)
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        if (result.session) {
          setStatus('Verifying session...')
          console.log('[OAuth Callback] Session received, verifying storage...')

          // Verify session was actually stored before navigating
          const storedSession = getStoredSession()

          if (storedSession) {
            console.log('[OAuth Callback] Session verified in localStorage, redirecting...')
            router.push('/collection')
          } else {
            // Retry once after a short delay
            console.log('[OAuth Callback] Session not found in localStorage, retrying...')
            await new Promise(resolve => setTimeout(resolve, 300))

            const retrySession = getStoredSession()
            if (retrySession) {
              console.log('[OAuth Callback] Session found on retry, redirecting...')
              router.push('/collection')
            } else {
              console.error('[OAuth Callback] Session storage failed after retry')
              setError('Session storage failed. Please try again.')
              setTimeout(() => router.push('/login'), 3000)
            }
          }
        } else {
          console.error('[OAuth Callback] No session returned from getOAuthSession')
          setError('No session found. Please try again.')
          setTimeout(() => router.push('/login'), 3000)
        }
      } catch (err: any) {
        console.error('[OAuth Callback] Exception:', err)
        setError(err.message || 'Authentication failed')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    handleOAuthCallback()
  }, [router])

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700 font-medium">{status}</p>
      </div>
    </main>
  )
}
