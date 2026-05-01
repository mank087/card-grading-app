import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'dcm_grading_queue'
const STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 min

export type GradingStage =
  | 'uploading'
  | 'queued'
  | 'identifying'
  | 'grading'
  | 'calculating'
  | 'saving'
  | 'slow'
  | 'completed'
  | 'error'

export interface GradingCard {
  id: string                  // queue entry id
  cardId: string              // database card id
  category: string
  frontImageUrl: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  stage: GradingStage
  progress: number            // 0-100
  uploadedAt: number
  completedAt?: number
  errorMessage?: string
  resultPath?: string         // /card/<id>
  cardName?: string
  estimatedTimeRemaining?: number | null
}

interface GradingQueueContextType {
  queue: GradingCard[]
  addToQueue: (card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress' | 'stage'>) => string
  updateCardStatus: (id: string, updates: Partial<GradingCard>) => void
  removeFromQueue: (id: string) => void
  clearCompleted: () => void
}

const GradingQueueContext = createContext<GradingQueueContextType | undefined>(undefined)

/**
 * Stage timing — mirrors useBackgroundGrading on web. Approximate progress %
 * derived from elapsed milliseconds since the card was uploaded.
 */
export function calculateStage(elapsed: number, knownProgress?: number): { stage: GradingStage; progress: number; estimatedTimeRemaining: number | null } {
  if (knownProgress != null && knownProgress >= 100) {
    return { stage: 'completed', progress: 100, estimatedTimeRemaining: null }
  }
  if (elapsed < 5_000)        return { stage: 'uploading',   progress: Math.min(15, (elapsed / 5_000) * 15), estimatedTimeRemaining: 85 }
  if (elapsed < 10_000)       return { stage: 'queued',      progress: 15 + ((elapsed - 5_000) / 5_000) * 5, estimatedTimeRemaining: 80 }
  if (elapsed < 20_000)       return { stage: 'identifying', progress: 20 + ((elapsed - 10_000) / 10_000) * 15, estimatedTimeRemaining: 70 }
  if (elapsed < 50_000)       return { stage: 'grading',     progress: 35 + ((elapsed - 20_000) / 30_000) * 45, estimatedTimeRemaining: Math.max(10, Math.ceil((90_000 - elapsed) / 1_000)) }
  if (elapsed < 55_000)       return { stage: 'calculating', progress: 80 + ((elapsed - 50_000) / 5_000) * 15, estimatedTimeRemaining: Math.max(5, Math.ceil((90_000 - elapsed) / 1_000)) }
  if (elapsed < 90_000)       return { stage: 'saving',      progress: 95 + ((elapsed - 55_000) / 35_000) * 4, estimatedTimeRemaining: Math.max(1, Math.ceil((90_000 - elapsed) / 1_000)) }
  if (elapsed < 600_000)      return { stage: 'slow',        progress: 99, estimatedTimeRemaining: null }
  return { stage: 'error',    progress: 0,                   estimatedTimeRemaining: null }
}

export function GradingQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<GradingCard[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from AsyncStorage on mount; clean up stale processing entries.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed: GradingCard[] = JSON.parse(raw)
          const now = Date.now()
          const cleaned = parsed.map(card => {
            if ((card.status === 'processing' || card.status === 'uploading') && now - card.uploadedAt > STALE_THRESHOLD_MS) {
              return { ...card, status: 'error' as const, stage: 'error' as const, errorMessage: 'Card may need extra time. Check My Collection.' }
            }
            return card
          })
          setQueue(cleaned)
        } catch {}
      }
      setHydrated(true)
    })
  }, [])

  // Persist queue
  useEffect(() => {
    if (!hydrated) return
    if (queue.length > 0) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    else AsyncStorage.removeItem(STORAGE_KEY)
  }, [queue, hydrated])

  const addToQueue = useCallback((card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress' | 'stage'>) => {
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const initialStage: GradingStage = card.status === 'processing' ? 'queued' : 'uploading'
    const newCard: GradingCard = { ...card, id, uploadedAt: Date.now(), progress: 0, stage: initialStage }
    setQueue(q => [...q, newCard])
    return id
  }, [])

  const updateCardStatus = useCallback((id: string, updates: Partial<GradingCard>) => {
    setQueue(q => q.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setQueue(q => q.filter(c => c.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setQueue(q => q.filter(c => c.status !== 'completed' && c.status !== 'error'))
  }, [])

  return (
    <GradingQueueContext.Provider value={{ queue, addToQueue, updateCardStatus, removeFromQueue, clearCompleted }}>
      {children}
    </GradingQueueContext.Provider>
  )
}

export function useGradingQueue() {
  const ctx = useContext(GradingQueueContext)
  if (!ctx) throw new Error('useGradingQueue must be used inside GradingQueueProvider')
  return ctx
}
