'use client'

import { useState, useEffect } from 'react'
import { ActionButton, ActionLink } from '@/components/design/Primitives'

interface FirstGradeCongratsModalProps {
  isFirstPurchase: boolean
  onDismiss: () => void
  onStartTour?: () => void // New prop to trigger the guided tour
  variant?: 'signup' | 'first-grade' // Controls header copy and dismiss key
}

const PROMO_CODE = 'Grade10'
const SIGNUP_DISMISSED_KEY = 'dcm_welcome_promo_signup_dismissed'
const FIRST_GRADE_DISMISSED_KEY = 'dcm_welcome_promo_first_grade_dismissed'
// Legacy key kept for backward compat — if user already dismissed the old modal,
// we won't pester them again with the first-grade variant.
const LEGACY_DISMISSED_KEY = 'dcm_first_grade_modal_dismissed'

export function FirstGradeCongratsModal({
  isFirstPurchase,
  onDismiss,
  onStartTour,
  variant = 'first-grade'
}: FirstGradeCongratsModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const dismissKey = variant === 'signup' ? SIGNUP_DISMISSED_KEY : FIRST_GRADE_DISMISSED_KEY

  useEffect(() => {
    // Check if this variant of the modal was already dismissed
    const wasDismissed = localStorage.getItem(dismissKey)
    const wasLegacyDismissed = variant === 'first-grade' && localStorage.getItem(LEGACY_DISMISSED_KEY)
    if (!wasDismissed && !wasLegacyDismissed) {
      // Small delay for better UX - let the page load first
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [dismissKey, variant])

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true')
    setIsVisible(false)
    onDismiss()
  }

  const handleStartTour = () => {
    localStorage.setItem(dismissKey, 'true')
    setIsVisible(false)
    if (onStartTour) {
      onStartTour()
    } else {
      onDismiss()
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      // Fire promo_code_applied as a strong-intent signal — user actively
      // grabbed the code, meaning they're at least considering purchase.
      if (typeof window !== 'undefined') {
        if ((window as any).gtag) {
          (window as any).gtag('event', 'promo_code_applied', {
            event_category: 'conversion',
            promo_code: PROMO_CODE,
            source: `congrats_modal_${variant}`,
          })
        }
        if ((window as any).fbq) {
          (window as any).fbq('trackCustom', 'PromoCodeApplied', {
            promo_code: PROMO_CODE,
            source: `congrats_modal_${variant}`,
          })
        }
        console.log('[FirstGradeCongratsModal] promo_code_applied event tracked:', PROMO_CODE)
      }
    } catch (err) {
      console.error('Failed to copy promo code:', err)
    }
  }

  if (!isVisible) return null

  const isSignup = variant === 'signup'
  const headerTitle = isSignup ? 'Welcome to DCM Grading' : 'Nice first grade'
  const headerSubtitle = isSignup
    ? 'Your 2 free credits are ready to use.'
    : 'Here’s a thank-you gift for grading your first card.'

  return (
    <div className="dcm-brand fixed inset-0 z-50 overflow-y-auto animate-fadeIn" style={{ background: 'rgba(20, 35, 59, 0.6)' }}>
      <div className="flex items-center justify-center min-h-full p-4">
        <div
          className="w-full max-w-md max-h-[90vh] overflow-y-auto animate-slideUp"
          style={{
            background: 'var(--dcm-surface, #ffffff)',
            border: '1px solid var(--dcm-border, #dfe3eb)',
            borderTop: '4px solid var(--dcm-purple, #9810fa)',
            borderRadius: '14px',
            boxShadow: '0 18px 50px rgba(20, 35, 59, 0.18)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--dcm-border, #dfe3eb)' }}>
            <p className="dcm-eyebrow" style={{ marginBottom: '8px' }}>
              {isSignup ? 'Account created' : 'First grade complete'}
            </p>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--dcm-ink, #14233b)', letterSpacing: '-0.02em' }}>
              {headerTitle}
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--dcm-muted, #596579)', lineHeight: 1.6 }}>
              {headerSubtitle}
            </p>
          </div>

          <div className="p-6">
            {isSignup ? (
              <>
                <p className="text-sm mb-5" style={{ color: 'var(--dcm-ink, #14233b)', lineHeight: 1.7 }}>
                  Upload photos of a card&rsquo;s front and back and you will have a full grade report in about a
                  minute. No mailing, and your card never leaves your desk.
                </p>

                <ul className="space-y-2 mb-6 text-sm" style={{ color: 'var(--dcm-ink, #14233b)' }}>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Centering, corners, edges, and surface subgrades</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Market pricing for the grade you get</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Custom slab labels and eBay InstaList</span>
                  </li>
                </ul>

                <div className="flex flex-col gap-2">
                  <ActionLink href="/upload" variant="primary" onClick={handleDismiss} className="w-full">
                    Use my 2 free credits
                  </ActionLink>
                  <ActionButton variant="text" onClick={handleStartTour} className="w-full">
                    Maybe later
                  </ActionButton>
                </div>

                <p className="text-xs mt-5" style={{ color: 'var(--dcm-muted, #596579)', lineHeight: 1.7 }}>
                  When you&rsquo;re ready for more, code{' '}
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy promo code"
                    className="font-mono font-semibold"
                    style={{ color: 'var(--dcm-purple-text, #7624b5)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {PROMO_CODE}
                  </button>{' '}
                  saves 10%. {copied ? 'Copied.' : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm mb-5" style={{ color: 'var(--dcm-ink, #14233b)', lineHeight: 1.7 }}>
                  Take <strong style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>10% off</strong> your first credit
                  purchase. It works on every credit pack and on Card Lovers.
                </p>

                {/* Promo code */}
                <div
                  className="p-5 mb-5"
                  style={{
                    background: '#f7f2fd',
                    border: '1px dashed var(--dcm-purple, #9810fa)',
                    borderRadius: '10px',
                  }}
                >
                  <p
                    className="dcm-eyebrow text-center"
                    style={{ marginBottom: '10px' }}
                  >
                    Your promo code
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <span
                      className="text-3xl font-extrabold tracking-widest font-mono"
                      style={{ color: 'var(--dcm-purple-text, #7624b5)' }}
                    >
                      {PROMO_CODE}
                    </span>
                    <ActionButton variant="secondary" onClick={handleCopyCode} title="Copy promo code">
                      {copied ? 'Copied' : 'Copy'}
                    </ActionButton>
                  </div>
                  <p className="text-xs text-center mt-3" style={{ color: 'var(--dcm-muted, #596579)' }}>
                    Apply it at checkout to save 10%.
                  </p>
                </div>

                {isFirstPurchase && (
                  <p className="text-xs mb-5" style={{ color: 'var(--dcm-muted, #596579)', lineHeight: 1.7 }}>
                    First-time graders also stack up to 5 bonus credits on top of the discount.
                  </p>
                )}

                <ul className="space-y-2 mb-6 text-sm" style={{ color: 'var(--dcm-ink, #14233b)' }}>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Detailed grade reports with subgrades</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Real-time market pricing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden="true" style={{ color: 'var(--dcm-purple-text, #7624b5)' }}>&#10003;</span>
                    <span>Custom slab labels and eBay InstaList</span>
                  </li>
                </ul>

                <div className="flex flex-col gap-2">
                  <ActionLink href="/credits" variant="primary" onClick={handleDismiss} className="w-full">
                    Redeem 10% off
                  </ActionLink>
                  <ActionButton variant="text" onClick={handleStartTour} className="w-full">
                    Take a quick tour
                  </ActionButton>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Export keys so other components can check/reset them
export {
  SIGNUP_DISMISSED_KEY,
  FIRST_GRADE_DISMISSED_KEY,
  LEGACY_DISMISSED_KEY as MODAL_DISMISSED_KEY,
  PROMO_CODE
}
