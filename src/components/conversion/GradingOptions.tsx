'use client'

import { pricingTiers, VIP_PACKAGE, CARD_LOVERS_PLANS } from '@/lib/creditPackages'

/**
 * Every way to keep grading, side by side: the three packs, VIP and Card
 * Lovers. Used by the out-of-credits popup and the in-page panel so someone
 * who just ran out sees ALL the options at once (owner request, Sept 24 2026)
 * instead of one product pushed at them. Each row deep-links to its plan card
 * on /credits, which carries the full details and the checkout button.
 *
 * Prices come from creditPackages.ts, the same source checkout uses.
 */

export interface GradingOption {
  id: string
  name: string
  headline: string
  perGrade: string
  bonus?: string
  tag?: string
  anchor: string
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

/** Per-grade prices always carry cents: "$2.00", never "$2". */
function perGradeMoney(n: number): string {
  return `$${n.toFixed(2)}`
}

export function getGradingOptions(showFirstPurchaseBonus: boolean): GradingOption[] {
  const packs: GradingOption[] = pricingTiers.map(tier => ({
    id: tier.id,
    name: tier.name,
    headline: `${tier.credits} credit${tier.credits === 1 ? '' : 's'} for ${money(tier.price)}`,
    perGrade: `${perGradeMoney(tier.perGradeCost)} a grade`,
    bonus: showFirstPurchaseBonus && tier.bonusCredits
      ? `+${tier.bonusCredits} bonus on your first pack`
      : undefined,
    tag: tier.popular ? 'Most popular' : undefined,
    anchor: `plan-${tier.id}`,
  }))

  const annual = CARD_LOVERS_PLANS.annual
  const annualPerGrade = annual.price / annual.totalCredits

  return [
    ...packs,
    {
      id: 'vip',
      name: VIP_PACKAGE.name,
      headline: `${VIP_PACKAGE.credits} credits for ${money(VIP_PACKAGE.price)}`,
      perGrade: `${perGradeMoney(VIP_PACKAGE.perGradeCost)} a grade`,
      tag: 'Lowest one-time price',
      anchor: 'plan-vip',
    },
    {
      id: 'card-lovers',
      name: 'Card Lovers membership',
      // "from" is the annual rate; monthly works out higher. Both are on /credits.
      headline: `${CARD_LOVERS_PLANS.monthly.credits} credits a month for ${money(CARD_LOVERS_PLANS.monthly.price)}, or save with annual`,
      perGrade: `from ${perGradeMoney(annualPerGrade)} a grade`,
      tag: 'Subscription',
      anchor: 'plan-card-lovers',
    },
  ]
}

/** /credits link, with the Grade10 notice pre-applied when it is offered. */
export function creditsHref(anchor?: string, withPromo = false): string {
  return `/credits${withPromo ? '?promo=GRADE10' : ''}${anchor ? `#${anchor}` : ''}`
}

export function GradingOptionsList({
  showFirstPurchaseBonus,
  withPromo = false,
  onNavigate,
}: {
  showFirstPurchaseBonus: boolean
  withPromo?: boolean
  onNavigate?: () => void
}) {
  const options = getGradingOptions(showFirstPurchaseBonus)
  return (
    <ul className="space-y-2" aria-label="Ways to buy grading credits">
      {options.map(option => (
        <li key={option.id}>
          <a
            href={creditsHref(option.anchor, withPromo)}
            onClick={onNavigate}
            className="group flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-[#f7f2fd]"
            style={{
              border: '1px solid var(--dcm-border, #dfe3eb)',
              borderRadius: '10px',
              textDecoration: 'none',
            }}
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--dcm-ink, #14233b)' }}>
                  {option.name}
                </span>
                {option.tag && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--dcm-purple-text, #7624b5)', background: '#f3e8ff' }}
                  >
                    {option.tag}
                  </span>
                )}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--dcm-muted, #596579)' }}>
                {option.headline}
                {option.bonus && (
                  <span style={{ color: 'var(--dcm-purple-text, #7624b5)' }}> · {option.bonus}</span>
                )}
              </span>
            </span>
            <span className="flex items-center gap-1.5 flex-shrink-0 text-right">
              <span className="text-xs font-semibold" style={{ color: 'var(--dcm-ink, #14233b)' }}>
                {option.perGrade}
              </span>
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--dcm-muted, #596579)' }}>
                &rsaquo;
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
