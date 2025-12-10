'use client'

import { Toaster } from 'react-hot-toast'
import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import { CreditsProvider } from '@/contexts/CreditsContext'
import PersistentStatusBar from '@/components/PersistentStatusBar'
import { useBackgroundGrading } from '@/hooks/useBackgroundGrading'

function BackgroundGradingMonitor() {
  useBackgroundGrading()
  return null
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreditsProvider>
      <GradingQueueProvider>
        <BackgroundGradingMonitor />
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
