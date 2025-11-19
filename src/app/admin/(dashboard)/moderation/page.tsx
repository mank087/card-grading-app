'use client'

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
        <p className="text-gray-600 mt-1">Review flagged content and moderation queue</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-red-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Feature Coming Soon</h3>
            <p className="text-red-800 mb-4">
              The content moderation system is currently under development. This section will include:
            </p>
            <ul className="list-disc list-inside text-red-700 space-y-1 text-sm">
              <li>Flagged content queue with review workflow</li>
              <li>Recently made public cards for review</li>
              <li>Moderation actions (approve, remove, flag)</li>
              <li>Moderation history and audit trail</li>
              <li>Bulk moderation actions</li>
            </ul>
            <p className="text-sm text-red-600 mt-4">
              Expected: Phase 1 implementation (Week 2)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
