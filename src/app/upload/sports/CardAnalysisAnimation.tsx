"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GradingWaitFeatures } from '@/components/grading/GradingWaitFeatures'
import { useGradingQueue } from '@/contexts/GradingQueueContext'

interface CardAnalysisAnimationProps {
  frontImageUrl: string
  cardName?: string
  cardId?: string
  category?: string
  allowNavigation?: boolean
  onGradeAnother?: () => void
}

export default function CardAnalysisAnimation({ frontImageUrl, cardName, cardId, category, allowNavigation = true, onGradeAnother }: CardAnalysisAnimationProps) {
  const router = useRouter()
  const { queue } = useGradingQueue()
  const [waitedLong, setWaitedLong] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const queueCard = queue.find(card => card.cardId === cardId)
  const failed = queueCard?.status === 'error'
  const complete = queueCard?.status === 'completed'
  const uploading = queueCard?.status === 'uploading'
  const slow = waitedLong || queueCard?.stage === 'slow'

  useEffect(() => {
    setWaitedLong(false)
    setImageFailed(false)
    const delay = Math.max(0, 120000 - (queueCard?.uploadedAt ? Date.now() - queueCard.uploadedAt : 0))
    const timer = setTimeout(() => setWaitedLong(true), delay)
    return () => clearTimeout(timer)
  }, [cardId, frontImageUrl, queueCard?.uploadedAt])

  // Auto-redirect when the uploaded card completes grading
  const gradeCompleteFiredRef = useRef(false)
  useEffect(() => {
    if (!cardId || !category) return

    // Find the card in the queue
    const queueCard = queue.find(c => c.cardId === cardId)

    if (queueCard && queueCard.status === 'completed' && queueCard.resultUrl) {
      console.log('[CardAnalysisAnimation] Card grading completed! Auto-redirecting to:', queueCard.resultUrl)

      // Fire grade_complete conversion event exactly once per card.
      // This is distinct from the existing upload-time first_grade_completed —
      // this one fires only after the AI grading actually finishes.
      if (!gradeCompleteFiredRef.current && typeof window !== 'undefined') {
        gradeCompleteFiredRef.current = true
        if ((window as any).gtag) {
          (window as any).gtag('event', 'grade_complete', {
            event_category: 'conversion',
            card_category: category,
            card_id: cardId,
          })
        }
        if ((window as any).fbq) {
          (window as any).fbq('trackCustom', 'GradeComplete', {
            card_category: category,
          })
        }
        console.log('[CardAnalysisAnimation] grade_complete event tracked:', category)
      }

      // Redirect immediately for faster UX
      router.push(queueCard.resultUrl!)
    }
  }, [queue, cardId, category, router])
  return (
    <main className="dcm-brand dcm-grading-wait">
      <div className="dcm-grading-wait__layout">
        <div>
        <GradingWaitFeatures mode="inspection" active={!failed && !complete && !uploading}>
        <div className="dcm-grading-wait__visual" aria-label="Submitted card preview" role="region">
          {frontImageUrl && !imageFailed ? <img src={frontImageUrl} alt={cardName || 'Your submitted card'} onError={() => setImageFailed(true)} /> : <p>Card preview unavailable. Your submission status is shown alongside.</p>}
          {!failed && !complete && <span className="dcm-grading-wait__scan" aria-hidden="true" />}
          <span className="dcm-grading-wait__caption">DCM OPTIC · CARD CONDITION ANALYSIS</span>
        </div>
        </GradingWaitFeatures>
        </div>
        <div>
          <p className="dcm-eyebrow">Your card, in focus</p>
          <h1>{failed ? 'Your card needs another look.' : complete ? 'Your report is ready.' : uploading ? 'Uploading your card.' : 'Your card analysis is underway.'}</h1>
          {cardName && <p className="dcm-grading-wait__name">{cardName}</p>}
          <div role="status" aria-live="polite" aria-atomic="true" className="dcm-grading-wait__status">
            <strong>{failed ? 'Check your submission' : complete ? 'Opening your report' : uploading ? 'Saving your photos' : slow ? 'Still waiting for your result' : 'Grading in progress'}</strong>
            <p>{failed ? 'We could not confirm a completed grade. Check My Collection before submitting again. If the card is still pending, contact support.' : complete ? 'Your grade and condition report are ready to review.' : uploading ? 'Keep this page open while your photos finish uploading.' : slow ? 'This is taking longer than usual. Check My Collection for the latest status; please avoid submitting the same card again while it is pending.' : 'Your report will open here when grading finishes. Processing time varies by card and demand.'}</p>
          </div>
          <GradingWaitFeatures mode="benefits" active={!failed && !complete && !uploading} />
          {allowNavigation && !uploading && <div className="dcm-grading-wait__actions">
            <Link href="/collection" className="dcm-button dcm-button--primary">My Collection</Link>
            <button type="button" className="dcm-button dcm-button--secondary" onClick={() => onGradeAnother ? onGradeAnother() : router.push('/upload')}>Grade another card</button>
          </div>}
          {failed && <Link href="/contact" className="underline">Contact support</Link>}
        </div>
      </div>
    </main>
  )
}
