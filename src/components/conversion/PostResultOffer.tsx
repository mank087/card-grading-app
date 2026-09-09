'use client'

import { useEffect, useState } from 'react'
import { ActionButton, ActionLink } from '@/components/design/Primitives'
import { useCredits } from '@/contexts/CreditsContext'
import { getStoredSession } from '@/lib/directAuth'
import { CARD_LOVERS_PLANS, pricingTiers } from '@/lib/creditPackages'

/**
 * Post-result offer (2026-09-09).
 *
 * Of 1,000 recent signups, 312 burned both free credits and never paid, and half
 * of the 29 who did pay had already hit zero first. The moment a grade lands on
 * an account with no credits left is the whole lever, so it gets an in-flow
 * panel under "Grade another card" instead of one more floating banner.
 *
 * It is deliberately narrow: owner only, balance exactly 0, and only for people
 * who have never bought anything. Buyers, members and org-funded graders have
 * already answered this question.
 */

export interface PostResultOfferProps {
  /** cards.user_id. The panel belongs to the person whose credits ran out. */
  ownerId?: string | null
  /** True once the page has a final grade rendered. */
  gradeComplete: boolean
  /** cards.org_id, when the card row carries one. Any org means someone else pays. */
  orgId?: string | null
}

const DISMISS_PREFIX = 'dcm.postResultOffer.'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function dismissKey(userId: string) {
  return `${DISMISS_PREFIX}${userId}`
}

/**
 * The one eligibility rule. The card page also uses it to suppress the low
 * credits banner and the balance-0 congrats modal, so the same person is never
 * asked to buy three times on one screen.
 */
export function usePostResultOfferEligible({ ownerId, gradeComplete, orgId }: PostResultOfferProps): boolean {
  const { balance, isLoading, totalPurchased, isCardLover, isVip } = useCredits()
  const [viewerId, setViewerId] = useState<string | null>(null)

  useEffect(() => {
    setViewerId(getStoredSession()?.user?.id || null)
  }, [])

  if (!gradeComplete) return false
  if (orgId) return false
  if (!ownerId || !viewerId || viewerId !== ownerId) return false
  if (isLoading) return false
  if (balance !== 0) return false
  if (totalPurchased !== 0) return false
  if (isCardLover || isVip) return false
  return true
}

export function PostResultOffer(props: PostResultOfferProps) {
  const eligible = usePostResultOfferEligible(props)
  const { ownerId } = props
  const [dismissed, setDismissed] = useState(true) // start hidden, avoids a flash

  useEffect(() => {
    if (!eligible || !ownerId) return
    let storedAt: string | null = null
    try {
      storedAt = window.localStorage.getItem(dismissKey(ownerId))
    } catch {
      storedAt = null
    }
    const at = storedAt ? parseInt(storedAt, 10) : 0
    setDismissed(Boolean(at) && Date.now() - at < DISMISS_DURATION_MS)
  }, [eligible, ownerId])

  if (!eligible || dismissed) return null

  const monthly = CARD_LOVERS_PLANS.monthly
  const pro = pricingTiers.find(tier => tier.id === 'pro')

  const handleDismiss = () => {
    if (ownerId) {
      try {
        window.localStorage.setItem(dismissKey(ownerId), Date.now().toString())
      } catch {
        // Nothing to store into. Hiding it for this page view is enough.
      }
    }
    setDismissed(true)
  }

  return (
    <div
      className="dcm-brand mt-6"
      style={{
        background: 'var(--dcm-surface, #ffffff)',
        border: '1px solid var(--dcm-border, #dfe3eb)',
        borderTop: '3px solid var(--dcm-purple, #9810fa)',
        borderRadius: '14px',
        padding: '24px',
      }}
    >
      <p className="dcm-eyebrow" style={{ marginBottom: '8px' }}>Your grade is in</p>
      <h3
        className="text-xl font-bold"
        style={{ color: 'var(--dcm-ink, #14233b)', letterSpacing: '-0.02em' }}
      >
        Keep grading with Card Lovers
      </h3>
      <p className="text-sm mt-2" style={{ color: 'var(--dcm-muted, #596579)', lineHeight: 1.6 }}>
        {monthly.credits} credits every month for ${monthly.price}, plus member benefits. Credits do not expire.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ActionLink href="/card-lovers" variant="primary">See Card Lovers plans</ActionLink>
        <ActionLink href="/credits" variant="secondary">Compare one-time packs</ActionLink>
        <ActionButton variant="text" onClick={handleDismiss}>Not now</ActionButton>
      </div>

      {pro && (
        <p className="text-xs mt-4" style={{ color: 'var(--dcm-muted, #596579)', lineHeight: 1.7 }}>
          Or start small:{' '}
          <a
            href="/credits"
            style={{ color: 'var(--dcm-purple-text, #7624b5)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            {pro.credits} credits for ${pro.price.toFixed(2)}
          </a>
        </p>
      )}
    </div>
  )
}

export { DISMISS_PREFIX as POST_RESULT_OFFER_DISMISS_PREFIX }
