'use client'

import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import PersistentStatusBar from '@/components/PersistentStatusBar'
import { useBackgroundGrading } from '@/hooks/useBackgroundGrading'
import { initSessionRefresh, cleanupSessionRefresh } from '@/lib/directAuth'

function BackgroundGradingMonitor() {
  useBackgroundGrading()
  return null
}

// Initialize session refresh monitoring to keep users logged in
function SessionRefreshMonitor() {
  useEffect(() => {
    initSessionRefresh()
    return () => cleanupSessionRefresh()
  }, [])
  return null
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreditsProvider>
      <GradingQueueProvider>
        <BackgroundGradingMonitor />
        <SessionRefreshMonitor />
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          containerStyle={{
            top: 80, // Below navigation
          }}
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '14px',
              maxWidth: '400px',
            },
          }}
        />
        <PersistentStatusBar />
        {children}
      </GradingQueueProvider>
    </CreditsProvider>
  )
}
