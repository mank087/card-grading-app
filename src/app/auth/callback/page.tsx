'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOAuthSession, getStoredSession } from '@/lib/directAuth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Completing authentication...')
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Log what we received - VERY IMPORTANT for debugging
        const fullUrl = window.location.href
        const hash = window.location.hash
        const search = window.location.search

        console.log('[OAuth Callback] ====== CALLBACK PAGE LOADED ======')
        console.log('[OAuth Callback] Full URL:', fullUrl)
        console.log('[OAuth Callback] Hash:', hash || '(empty)')
        console.log('[OAuth Callback] Search:', search || '(empty)')

        // Show debug info on page temporarily
        setDebugInfo(`URL: ${fullUrl.substring(0, 100)}...`)

        // Check if we have tokens in the URL hash OR search params (Supabase can use either)
        const hasHash = hash && hash.length > 1
        const hasSearch = search && search.length > 1

        if (!hasHash && !hasSearch) {
          console.error('[OAuth Callback] No tokens in URL - neither hash nor search params')
          setError('No authentication tokens received. The OAuth redirect may not be configured correctly.')
          setDebugInfo(`No tokens found. URL: ${fullUrl}`)
          setTimeout(() => router.push('/login'), 5000)
          return
        }

        setStatus('Processing authentication...')

        // If tokens are in search params (code flow), we need to exchange them
        if (hasSearch && !hasHash) {
          console.log('[OAuth Callback] Tokens in search params (code flow)')
          const params = new URLSearchParams(search)
          const code = params.get('code')
          const errorParam = params.get('error')
          const errorDescription = params.get('error_description')

          if (errorParam) {
            console.error('[OAuth Callback] OAuth error:', errorParam, errorDescription)
            setError(errorDescription || errorParam)
            setTimeout(() => router.push('/login'), 3000)
            return
          }

          if (code) {
            console.log('[OAuth Callback] Authorization code received, exchanging...')
            setStatus('Exchanging authorization code...')
          }
        }

        // Get the OAuth session - this will parse tokens from URL
        console.log('[OAuth Callback] Calling getOAuthSession...')
        const result = await getOAuthSession()
        console.log('[OAuth Callback] getOAuthSession result:', result.error ? `Error: ${result.error}` : 'Success')

        if (result.error) {
          console.error('[OAuth Callback] Session error:', result.error)
          setError(result.error)
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        if (result.session) {
          setStatus('Verifying session...')
          console.log('[OAuth Callback] Session received, verifying storage...')

          // Small delay to ensure localStorage write is complete
          await new Promise(resolve => setTimeout(resolve, 100))

          // Verify session was actually stored before navigating
          const storedSession = getStoredSession()

          if (storedSession && storedSession.user) {
            console.log('[OAuth Callback] Session verified in localStorage, user:', storedSession.user.email)
            setStatus('Success! Redirecting...')

            // Check if this is a new user (created within last 60 seconds)
            const createdAt = new Date(storedSession.user.created_at || 0).getTime()
            const now = Date.now()
            const isNewUser = (now - createdAt) < 60000 // Created within last 60 seconds

            // Use replace to prevent back-button issues
            // New users go to credits page for onboarding, existing users go to collection
            if (isNewUser) {
              console.log('[OAuth Callback] New user detected, redirecting to credits page')

              // Send welcome email (fire-and-forget, don't block redirect)
              fetch('/api/email/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: storedSession.user.email,
                  name: storedSession.user.user_metadata?.full_name || storedSession.user.user_metadata?.name
                })
              }).catch(err => console.error('[OAuth Callback] Failed to send welcome email:', err))

              router.replace('/credits?welcome=true')
            } else {
              router.replace('/collection')
            }
          } else {
            // Retry once after a short delay
            console.log('[OAuth Callback] Session not found in localStorage, retrying...')
            await new Promise(resolve => setTimeout(resolve, 500))

            const retrySession = getStoredSession()
            if (retrySession && retrySession.user) {
              console.log('[OAuth Callback] Session found on retry, redirecting...')
              // Check if this is a new user
              const createdAt = new Date(retrySession.user.created_at || 0).getTime()
              const now = Date.now()
              const isNewUser = (now - createdAt) < 60000

              if (isNewUser) {
                // Send welcome email (fire-and-forget, don't block redirect)
                fetch('/api/email/welcome', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: retrySession.user.email,
                    name: retrySession.user.user_metadata?.full_name || retrySession.user.user_metadata?.name
                  })
                }).catch(err => console.error('[OAuth Callback] Failed to send welcome email:', err))

                router.replace('/credits?welcome=true')
              } else {
                router.replace('/collection')
              }
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
          {debugInfo && (
            <p className="text-xs text-gray-400 mb-4 break-all">{debugInfo}</p>
          )}
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
        {debugInfo && (
          <p className="text-xs text-gray-400 mt-4 break-all">{debugInfo}</p>
        )}
      </div>
    </main>
  )
}
