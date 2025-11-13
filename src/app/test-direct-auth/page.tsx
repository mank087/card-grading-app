'use client'
import { useState } from 'react'

export default function TestDirectAuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const testDirectFetch = async () => {
    setResult(null)
    setError('')

    try {
      const url = 'https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/token?grant_type=password'
      const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'

      console.log('Making direct fetch to:', url)
      console.log('With body:', { email, password: '***' })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          email,
          password,
        })
      })

      const data = await response.json()
      console.log('Response status:', response.status)
      console.log('Response data:', data)

      setResult({
        status: response.status,
        statusText: response.statusText,
        data: data
      })
    } catch (err: any) {
      console.error('Direct fetch error:', err)
      setError(err.message || err.toString())
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">Direct Auth API Test</h1>
      <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6 space-y-4">
        <p className="text-sm text-gray-600">
          This page bypasses the Supabase client library and makes a direct fetch call to the auth endpoint.
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="test@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="password"
          />
        </div>

        <button
          onClick={testDirectFetch}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Test Direct Fetch
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded">
            <h3 className="font-bold text-red-800">Error:</h3>
            <pre className="text-sm text-red-700 mt-2">{error}</pre>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <h3 className="font-bold text-green-800">Response:</h3>
            <pre className="text-sm text-green-700 mt-2 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  )
}
