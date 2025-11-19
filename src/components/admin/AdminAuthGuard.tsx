'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminUser } from '@/lib/admin/adminAuth'

interface AdminAuthGuardProps {
  children: (user: AdminUser) => React.ReactNode
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/admin/auth/verify')
        const data = await response.json()

        if (data.authenticated && data.user) {
          setUser(data.user)
          setLoading(false)
        } else {
          // Not authenticated, redirect to login
          router.push(`/admin/login?redirect=${encodeURIComponent(pathname || '/admin/dashboard')}`)
        }
      } catch (error) {
        console.error('Error verifying admin session:', error)
        router.push('/admin/login')
      }
    }

    verifySession()
  }, [router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return <>{children(user)}</>
}
