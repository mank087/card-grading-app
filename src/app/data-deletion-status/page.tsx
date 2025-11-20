'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DataDeletionContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-bold mb-4">Data Deletion Status</h1>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <p className="text-green-800 mb-2">
            <strong>Your data has been deleted successfully.</strong>
          </p>
          <p className="text-sm text-green-700">
            All your personal data, including graded cards and account information,
            has been permanently removed from our system.
          </p>
        </div>

        {code && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-600 mb-1">Confirmation Code:</p>
            <p className="text-sm font-mono text-gray-800">{code}</p>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <h2 className="font-semibold mb-2">What was deleted:</h2>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your account and profile information</li>
            <li>All graded cards and images</li>
            <li>Authentication credentials</li>
            <li>Any associated metadata</li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            This deletion was processed in compliance with GDPR and user data protection regulations.
            If you have any questions, please contact support.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function DataDeletionStatusPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-24 bg-gray-200 rounded mb-4"></div>
          </div>
        </div>
      </main>
    }>
      <DataDeletionContent />
    </Suspense>
  )
}
