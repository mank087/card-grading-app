'use client'

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">Manage all user accounts and permissions</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-blue-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Feature Coming Soon</h3>
            <p className="text-blue-800 mb-4">
              The user management dashboard is currently under development. This section will include:
            </p>
            <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
              <li>Searchable user list with filters</li>
              <li>User detail view with card statistics</li>
              <li>Ban/suspend user functionality</li>
              <li>User activity timeline</li>
              <li>Export user data (GDPR compliance)</li>
            </ul>
            <p className="text-sm text-blue-600 mt-4">
              Expected: Phase 1 implementation (Week 2)
            </p>
          </div>
        </div>
      </div>

      {/* Temporary manual query instructions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Manual Queries</h2>
        <p className="text-sm text-gray-600 mb-4">
          While this feature is in development, you can run these queries in Supabase SQL Editor:
        </p>
        <div className="bg-gray-50 p-4 rounded font-mono text-xs space-y-4">
          <div>
            <p className="text-gray-700 font-semibold mb-2">View all users with card counts:</p>
            <code className="text-gray-800">SELECT * FROM admin_user_stats ORDER BY total_cards DESC;</code>
          </div>
          <div>
            <p className="text-gray-700 font-semibold mb-2">Find users by email:</p>
            <code className="text-gray-800">SELECT * FROM users WHERE email LIKE '%example%';</code>
          </div>
          <div>
            <p className="text-gray-700 font-semibold mb-2">View user's cards:</p>
            <code className="text-gray-800">SELECT * FROM cards WHERE user_id = 'user-uuid-here';</code>
          </div>
        </div>
      </div>
    </div>
  )
}
