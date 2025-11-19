'use client'

import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminAuthGuard>
      {(user) => (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <AdminSidebar user={user} />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Header */}
            <header className="bg-white border-b border-gray-200 px-8 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    Welcome back, <span className="font-semibold">{user.full_name || user.email}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      )}
    </AdminAuthGuard>
  )
}
