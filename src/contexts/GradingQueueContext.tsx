'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export interface GradingCard {
  id: string
  cardId: string
  category: string
  categoryLabel: string
  frontImageUrl: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  uploadedAt: number
  completedAt?: number
  errorMessage?: string
  resultUrl?: string
}

interface GradingQueueContextType {
  queue: GradingCard[]
  addToQueue: (card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress'>) => string
  updateCardStatus: (id: string, updates: Partial<GradingCard>) => void
  removeFromQueue: (id: string) => void
  getCard: (id: string) => GradingCard | undefined
  clearCompleted: () => void
}

const GradingQueueContext = createContext<GradingQueueContextType | undefined>(undefined)

export function GradingQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<GradingCard[]>([])
  const router = useRouter()

  // Load queue from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gradingQueue')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setQueue(parsed)
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

  const addToQueue = useCallback((card: Omit<GradingCard, 'id' | 'uploadedAt' | 'progress'>) => {
    const id = `grading-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newCard: GradingCard = {
      ...card,
      id,
      uploadedAt: Date.now(),
      progress: 0,
    }
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

  return (
    <GradingQueueContext.Provider value={{
      queue,
      addToQueue,
      updateCardStatus,
      removeFromQueue,
      getCard,
      clearCompleted
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
