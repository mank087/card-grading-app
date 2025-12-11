'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type GradingStage =
  | 'uploading'    // 0-15%: Images being uploaded
  | 'queued'       // 15-20%: In queue, waiting
  | 'identifying'  // 20-35%: Card identification
  | 'grading'      // 35-80%: DCM Optic™ analyzing
  | 'calculating'  // 80-95%: Computing final grade
  | 'saving'       // 95-99%: Saving to database
  | 'completed'    // 100%: Done
  | 'error'        // Error state

export interface GradingCard {
  id: string
  cardId: string
  category: string
  categoryLabel: string
  frontImageUrl: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  stage: GradingStage
  progress: number
  uploadedAt: number
  completedAt?: number
  errorMessage?: string
  resultUrl?: string
  cardName?: string
  estimatedTimeRemaining?: number | null
}

interface GradingQueueContextType {
  queue: GradingCard[]
  addToQueue: (card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress' | 'stage'>) => string
  updateCardStatus: (id: string, updates: Partial<GradingCard>) => void
  removeFromQueue: (id: string) => void
  getCard: (id: string) => GradingCard | undefined
  clearCompleted: () => void
  updateCardStage: (id: string, stage: GradingStage, progress: number, extras?: Partial<GradingCard>) => void
}

const GradingQueueContext = createContext<GradingQueueContextType | undefined>(undefined)

export function GradingQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<GradingCard[]>([])
  const router = useRouter()

  // Load queue from localStorage on mount
  // Also cleanup stale cards that were processing from a previous session
  useEffect(() => {
    const saved = localStorage.getItem('gradingQueue')
    if (saved) {
      try {
        const parsed: GradingCard[] = JSON.parse(saved)
        const now = Date.now()
        const STALE_THRESHOLD = 10 * 60 * 1000 // 10 minutes

        // Mark stale processing/uploading cards as errors
        const cleanedQueue = parsed.map(card => {
          if ((card.status === 'processing' || card.status === 'uploading') &&
              (now - card.uploadedAt) > STALE_THRESHOLD) {
            console.log(`[GradingQueue] Marking stale card ${card.cardId} as error (uploaded ${Math.floor((now - card.uploadedAt) / 1000)}s ago)`)
            return {
              ...card,
              status: 'error' as const,
              errorMessage: 'Session expired. Please re-upload this card to grade it.'
            }
          }
          return card
        })

        setQueue(cleanedQueue)
      } catch (e) {
        console.error('Failed to parse grading queue:', e)
      }
    }
  }, [])

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('gradingQueue', JSON.stringify(queue))
    } else {
      localStorage.removeItem('gradingQueue')
    }
  }, [queue])

  const addToQueue = useCallback((card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress' | 'stage'>) => {
    const id = `grading-${Date.now()}-${Math.random().toString(36).slice(2)}`
    // Set initial stage based on status - re-grades start as 'processing' not 'uploading'
    const initialStage: GradingStage = card.status === 'processing' ? 'queued' : 'uploading'
    const newCard: GradingCard = {
      ...card,
      id,
      uploadedAt: Date.now(),
      progress: 0,
      stage: initialStage,
    }
    console.log(`[GradingQueue] Added card ${card.cardId} with status=${card.status}, stage=${initialStage}`)
    setQueue(prev => [...prev, newCard])
    return id
  }, [])

  const updateCardStatus = useCallback((id: string, updates: Partial<GradingCard>) => {
    setQueue(prev => prev.map(card =>
      card.id === id ? { ...card, ...updates } : card
    ))
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(card => card.id !== id))
  }, [])

  const getCard = useCallback((id: string) => {
    return queue.find(card => card.id === id)
  }, [queue])

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(card => card.status !== 'completed'))
  }, [])

  const updateCardStage = useCallback((id: string, stage: GradingStage, progress: number, extras?: Partial<GradingCard>) => {
    setQueue(prev => prev.map(card =>
      card.id === id ? { ...card, stage, progress, ...extras } : card
    ))
  }, [])

  return (
    <GradingQueueContext.Provider value={{
      queue,
      addToQueue,
      updateCardStatus,
      removeFromQueue,
      getCard,
      clearCompleted,
      updateCardStage
    }}>
      {children}
    </GradingQueueContext.Provider>
  )
}

export function useGradingQueue() {
  const context = useContext(GradingQueueContext)
  if (!context) {
    throw new Error('useGradingQueue must be used within GradingQueueProvider')
  }
  return context
}
