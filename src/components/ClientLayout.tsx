'use client'

import { GradingQueueProvider } from '@/contexts/GradingQueueContext'
import PersistentStatusBar from '@/components/PersistentStatusBar'
import { useBackgroundGrading } from '@/hooks/useBackgroundGrading'

function BackgroundGradingMonitor() {
  useBackgroundGrading()
  return null
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <GradingQueueProvider>
      <BackgroundGradingMonitor />
      <PersistentStatusBar />
      {children}
    </GradingQueueProvider>
  )
}
