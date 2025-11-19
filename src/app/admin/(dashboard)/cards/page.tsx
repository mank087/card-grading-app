'use client'

export default function AdminCardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Card Management</h1>
        <p className="text-gray-600 mt-1">View and manage all graded cards across the platform</p>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-purple-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Feature Coming Soon</h3>
            <p className="text-purple-800 mb-4">
              The card management dashboard is currently under development. This section will include:
            </p>
            <ul className="list-disc list-inside text-purple-700 space-y-1 text-sm">
              <li>Searchable card list with advanced filters</li>
              <li>Filter by category, grade, user, date range</li>
              <li>Card detail view with full grading analysis</li>
              <li>Delete or change visibility of cards</li>
              <li>Re-trigger AI grading for cards</li>
              <li>Bulk operations for multiple cards</li>
            </ul>
            <p className="text-sm text-purple-600 mt-4">
              Expected: Phase 1 implementation (Week 2)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
