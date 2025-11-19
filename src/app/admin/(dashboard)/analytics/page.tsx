'use client'

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600 mt-1">Insights into user behavior, grading trends, and platform growth</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-indigo-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-indigo-900 mb-2">Feature Coming Soon</h3>
            <p className="text-indigo-800 mb-4">
              The analytics dashboard is currently under development. This section will include:
            </p>
            <ul className="list-disc list-inside text-indigo-700 space-y-1 text-sm">
              <li>User acquisition and retention metrics</li>
              <li>Grade distribution by category</li>
              <li>Most popular card types and sets</li>
              <li>Grading quality control metrics</li>
              <li>User engagement trends</li>
              <li>Revenue and financial projections</li>
            </ul>
            <p className="text-sm text-indigo-600 mt-4">
              Expected: Phase 2 implementation (Weeks 4-6)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
