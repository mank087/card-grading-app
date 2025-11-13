'use client'

export default function DebugEnvPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">Environment Variables Debug</h1>
      <div className="w-full max-w-2xl bg-gray-100 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Client-Side Environment Variables</h2>
        <div className="space-y-2 font-mono text-sm">
          <div>
            <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>
            <br />
            <code className="bg-white p-2 block mt-1 rounded">
              {process.env.NEXT_PUBLIC_SUPABASE_URL || '(undefined or empty)'}
            </code>
            <p className="text-xs text-gray-600 mt-1">
              Type: {typeof process.env.NEXT_PUBLIC_SUPABASE_URL} |
              Length: {(process.env.NEXT_PUBLIC_SUPABASE_URL || '').length}
            </p>
          </div>
          <div className="mt-4">
            <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>
            <br />
            <code className="bg-white p-2 block mt-1 rounded break-all">
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?
                `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 50)}...` :
                '(undefined or empty)'
              }
            </code>
            <p className="text-xs text-gray-600 mt-1">
              Type: {typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY} |
              Length: {(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length}
            </p>
          </div>
          <div className="mt-6 p-4 bg-yellow-100 rounded">
            <p className="text-sm">
              <strong>Note:</strong> If these show as undefined or empty, the environment variables
              were not available during the Vercel build process. They need to be set in Vercel
              settings BEFORE the deployment builds.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
