'use client'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure system settings, feature flags, and API keys</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-yellow-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Super Admin Only</h3>
            <p className="text-yellow-800 mb-4">
              The settings dashboard is restricted to super admins only. Features include:
            </p>
            <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
              <li>Feature flags (enable/disable gallery, registrations, etc.)</li>
              <li>API configuration (OpenAI keys, rate limits)</li>
              <li>Upload limits and file size restrictions</li>
              <li>Maintenance mode toggle</li>
              <li>Email and notification settings</li>
            </ul>
            <p className="text-sm text-yellow-600 mt-4">
              Expected: Phase 3 implementation (Weeks 7-8)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Settings</h2>
        <p className="text-sm text-gray-600 mb-3">
          View current settings in the system_settings table:
        </p>
        <div className="bg-gray-50 p-4 rounded font-mono text-xs">
          <code className="text-gray-800">
            SELECT * FROM system_settings;
          </code>
        </div>
      </div>
    </div>
  )
}
