'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOAuthSession } from '@/lib/directAuth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get the OAuth session after redirect
        const result = await getOAuthSession()

        if (result.error) {
          setError(result.error)
          // Redirect to login after 3 seconds
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        if (result.session) {
          // Success! Redirect to collection
          router.push('/collection')
        } else {
          setError('No session found')
          setTimeout(() => router.push('/login'), 3000)
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err)
        setError(err.message || 'Authentication failed')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    handleOAuthCallback()
  }, [router])

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
            <strong>Authentication Error:</strong> {error}
          </div>
          <p className="text-sm text-gray-600">Redirecting to login page...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700">Completing authentication...</p>
      </div>
    </main>
  )
}
