'use client'

import { useState } from 'react'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AdminAuthGuard>
      {(user) => (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
          {/* Sidebar */}
          <AdminSidebar
            user={user}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top Header */}
            <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
              <div className="flex items-center justify-between">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors mr-2"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Admin Dashboard</h2>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600 hidden sm:block">
                    Welcome, <span className="font-semibold">{user.full_name || user.email.split('@')[0]}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
              {children}
            </main>
          </div>
        </div>
      )}
    </AdminAuthGuard>
  )
}
