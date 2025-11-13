'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { createClient } from '@supabase/supabase-js'

export default function TestSupabasePage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runTests()
  }, [])

  const runTests = async () => {
    const testResults: any = {}

    // Test 1: Check environment variables
    testResults.envVars = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      urlLength: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').length,
      keyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length,
      keyPrefix: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').substring(0, 20)
    }

    // Test 2: Try to create a fresh client
    try {
      const testClient = createClient(
        'https://zyxtqcvwkbpvsjsszbzg.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eHRxY3Z3a2JwdnNqc3N6YnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NjI2NTUsImV4cCI6MjA3MzUzODY1NX0.-U0WoZvZSPpbeZ6w4H9t3MH3EsIkMO_hs4CKB9sJ858'
      )
      testResults.freshClient = 'Created successfully'

      // Try a simple health check
      try {
        const { data, error } = await testClient.auth.getSession()
        testResults.freshClientSession = error ? `Error: ${error.message}` : 'Session check OK'
      } catch (err: any) {
        testResults.freshClientSession = `Exception: ${err.message}`
      }
    } catch (err: any) {
      testResults.freshClient = `Error: ${err.message}`
    }

    // Test 3: Check the imported supabase client
    testResults.importedClient = typeof supabase

    // Test 4: Try getSession on imported client
    try {
      const { data, error } = await supabase.auth.getSession()
      testResults.importedClientSession = error ? `Error: ${error.message}` : 'Session check OK'
    } catch (err: any) {
      testResults.importedClientSession = `Exception: ${err.message}`
    }

    // Test 5: Test direct fetch to Supabase
    try {
      const response = await fetch('https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/health')
      const data = await response.json()
      testResults.directFetch = `Success: ${JSON.stringify(data)}`
    } catch (err: any) {
      testResults.directFetch = `Error: ${err.message}`
    }

    // Test 6: Check if we can construct the auth URL
    try {
      const authUrl = 'https://zyxtqcvwkbpvsjsszbzg.supabase.co/auth/v1/token?grant_type=password'
      testResults.authUrl = authUrl
      testResults.authUrlValid = URL.canParse ? URL.canParse(authUrl) : 'Cannot test (old browser)'
    } catch (err: any) {
      testResults.authUrl = `Error: ${err.message}`
    }

    setResults(testResults)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">Supabase Connection Tests</h1>
      <div className="w-full max-w-4xl bg-gray-100 p-6 rounded-lg">
        {loading ? (
          <p>Running tests...</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(results).map(([key, value]) => (
              <div key={key} className="bg-white p-4 rounded shadow">
                <h3 className="font-bold text-lg mb-2">{key}</h3>
                <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
