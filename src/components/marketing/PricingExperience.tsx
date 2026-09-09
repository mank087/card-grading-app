import Link from 'next/link'
import { pricingTiers, VIP_PACKAGE, CARD_LOVERS_PLANS, type PricingTier } from '@/lib/creditPackages'
import { CardVisualRail } from '@/components/design/CardVisualRail'
import { ActionButton, ActionLink, Icon, Notice, SectionHeading } from '@/components/design/Primitives'

export type PackId = 'basic' | 'pro' | 'elite' | 'vip'

export interface PricingExperienceProps {
  authenticated?: boolean | null
  balance?: number
  balanceLoading?: boolean
  firstPurchase?: boolean
  founder?: boolean
  cardLover?: boolean
  welcome?: boolean
  error?: string | null
  purchaseLoading?: string | null
  selectedPlan?: 'annual' | 'monthly'
  /** True after a signed-out visitor came back from signup with a saved intent. */
  resumed?: boolean
  /** Preselected pack from that saved intent. */
  highlightPack?: PackId | null
  /** Promo code read off the URL by the post-grade emails. */
  promoCode?: 'GRADE10' | 'GRADE20' | null
  onPlanChange?: (plan: 'annual' | 'monthly') => void
  onPurchase?: (tier: PricingTier) => void
  onVipPurchase?: () => void
  onSubscribe?: () => void
  onDismissWelcome?: () => void
}

/**
 * Layout note (2026-09-09). Of 1,000 recent signups only 29 paid, and 28 of
 * those bought a one-time pack. So the fold now carries one free route, then
 * three choices: the Pro pack, the membership, and VIP. Basic and Elite stay on
 * the page in a compact row rather than competing for the same attention.
 */
const layoutStyles = `
.dcm-plans--trio { grid-template-columns: repeat(3, 1fr); align-items: stretch; }
.dcm-plans--pair { grid-template-columns: repeat(2, 1fr); }
.dcm-plan--featured { border: 2px solid var(--dcm-purple, #9810fa); padding: 25px 21px; }
.dcm-free-route { margin: 22px 0 34px; font-size: 15px; }
.dcm-pack-compact .dcm-price { font-size: 30px; margin-top: 10px; }
@media (max-width: 1100px) {
  /* Three cards side by side stop being readable before the shared plan grid
     drops to two, so the trio stacks here. On a phone the membership card leads,
     because it is the offer that keeps someone grading past their free credits. */
  .dcm-plans--trio { grid-template-columns: 1fr; }
  .dcm-plans--trio .dcm-plan--featured { order: -1; }
}
@media (max-width: 767px) {
  .dcm-plans--pair { grid-template-columns: 1fr; }
}
`

export default function PricingExperience({ authenticated = null, balance = 0, balanceLoading = true, firstPurchase = false, founder = false, cardLover = false, welcome = false, error, purchaseLoading = null, selectedPlan = 'annual', resumed = false, highlightPack = null, promoCode = null, onPlanChange, onPurchase, onVipPurchase, onSubscribe, onDismissWelcome }: PricingExperienceProps) {
  // The stored-session check resolves on mount, so `authenticated === null` lasts
  // one render. Purchase controls therefore default to the LOGGED-OUT call to
  // action and swap to Buy/Subscribe only once a session is confirmed — one
  // direction, so a signed-in user never sees Buy turn back into Sign Up.
  const busy = purchaseLoading !== null
  const signedIn = authenticated === true
  const showBonus = authenticated === false || (signedIn && !balanceLoading && firstPurchase)
  const annual = selectedPlan === 'annual'
  const membership = CARD_LOVERS_PLANS[selectedPlan]
  const membershipCredits = annual ? CARD_LOVERS_PLANS.annual.totalCredits : CARD_LOVERS_PLANS.monthly.credits
  const perIncludedGrade = (membership.price / membershipCredits).toFixed(2)

  const pro = pricingTiers.find(tier => tier.id === 'pro')
  const compactTiers = pricingTiers.filter(tier => tier.id !== 'pro')
  // The free route: signed-out visitors sign up, signed-in visitors already have
  // their two credits and just need the upload page.
  const freeRouteHref = signedIn ? '/upload' : '/login?mode=signup&redirect=/credits'
  const freeRouteLabel = signedIn ? 'Use your credits on a card' : 'Start with 2 free grades'

  const purchaseLabel = (id: string, fallback: string) => (purchaseLoading === id ? 'Opening checkout…' : fallback)

  const packButton = (tier: PricingTier, variant: 'primary' | 'secondary') => (
    <ActionButton variant={variant} disabled={busy} onClick={() => onPurchase?.(tier)}>
      {signedIn ? purchaseLabel(tier.id, `Buy ${tier.name}`) : `Get ${tier.name}`}
    </ActionButton>
  )

  return <div className="dcm-brand dcm-pricing-page">
    <style dangerouslySetInnerHTML={{ __html: layoutStyles }} />

    <section className="dcm-price-intro"><div className="dcm-container dcm-price-intro-row">
      <div><p className="dcm-eyebrow">Grading that fits your collection</p><h1>Card grading pricing.</h1><p className="dcm-lead">One credit grades one card. Every grade includes the condition report and printable labels.</p></div>
      {signedIn && <div className="dcm-plan"><p className="dcm-eyebrow">Your balance</p><p className="dcm-price">{balanceLoading ? '—' : balance}<span className="dcm-price-unit"> credits</span></p><ActionLink href="/upload" variant="text">Grade a Card <Icon name="arrow" /></ActionLink></div>}
    </div></section>

    <section className="pb-16" aria-labelledby="plans-heading"><div className="dcm-container">
      <p className="dcm-free-route"><ActionLink href={freeRouteHref} variant="text">{freeRouteLabel} <Icon name="arrow" /></ActionLink></p>

      {error && <Notice tone="error">{error}</Notice>}
      {resumed && <Notice tone="success">Welcome back. Your plan is selected below.</Notice>}
      {promoCode === 'GRADE20' && <Notice>Enter code GRADE20 at checkout for 20% off a credit pack.</Notice>}
      {promoCode === 'GRADE10' && <Notice>Enter code Grade10 at checkout for 10% off a credit pack.</Notice>}
      {signedIn && welcome && <Notice tone="success"><div className="dcm-price-intro-row"><div><strong>Welcome to DCM.</strong><p>Choose a card and put your available credits to work.</p><ActionLink href="/upload" variant="text">Grade Your First Card <Icon name="arrow" /></ActionLink></div><ActionButton variant="text" onClick={onDismissWelcome}>Dismiss welcome</ActionButton></div></Notice>}
      {signedIn && (cardLover || founder) && <Notice>{cardLover ? 'Card Lovers' : 'Founder'} discount active: your 20% credit-purchase discount is applied at checkout. Listed prices below are standard rates.</Notice>}

      <div className="dcm-section-topline"><div><p className="dcm-eyebrow">Choose how you grade</p><h2 id="plans-heading">Three ways to keep going.</h2></div><p className="dcm-fineprint">Credits never expire, on packs and on membership.</p></div>

      <div className="dcm-plans dcm-plans--trio">
        {pro && <article className={`dcm-plan ${highlightPack === 'pro' ? 'dcm-plan--popular' : ''}`} id="plan-pro">
          <p className="dcm-plan-badge">Most popular</p>
          <h3>{pro.name}</h3><p className="dcm-price">${pro.price.toFixed(2)}</p><p className="dcm-plan-meta">{pro.credits} credits · ${pro.perGradeCost.toFixed(2)} / grade</p>
          <div className="dcm-plan-benefits"><p>{pro.description}</p>{showBonus ? <p><strong>+{pro.bonusCredits} first-purchase bonus</strong><br />{pro.credits + pro.bonusCredits} total credits on your eligible first purchase.</p> : <p>Full report and labels included with every grade.</p>}<p>One-time purchase. Nothing recurring.</p></div>
          {packButton(pro, 'primary')}
        </article>}

        <article className="dcm-plan dcm-plan--featured" id="plan-card-lovers">
          <p className="dcm-plan-badge">Best for regular grading</p>
          <h3>Card Lovers</h3>
          <div className="dcm-segmented" role="group" aria-label="Membership billing period"><button type="button" aria-pressed={annual} onClick={() => onPlanChange?.('annual')}>Annual</button><button type="button" aria-pressed={!annual} onClick={() => onPlanChange?.('monthly')}>Monthly</button></div>
          <div aria-live="polite">
            <p className="dcm-price">${membership.price}<span className="dcm-price-unit"> / {membership.interval}</span></p>
            <p className="dcm-plan-meta">{annual ? `Billed annually. Equivalent to $${(membership.price / 12).toFixed(2)} per month.` : 'Billed monthly. Cancel your subscription anytime.'}</p>
            <ul className="dcm-checklist">
              <li><Icon name="check" /><span><strong>{membershipCredits} credits {annual ? 'upfront' : 'each month'}</strong>{annual && <><br />Includes {CARD_LOVERS_PLANS.annual.bonusCredits} annual bonus credits</>}</span></li>
              <li><Icon name="check" />About ${perIncludedGrade} per included grade</li>
              <li><Icon name="check" />20% off any extra credits you buy</li>
              <li><Icon name="check" />Card Lover heart emblem on your labels</li>
              <li><Icon name="check" />On-demand portfolio price refresh</li>
              <li><Icon name="check" />Monthly loyalty bonus credits at month 3, 6, 9 and 12</li>
            </ul>
          </div>
          {cardLover
            ? <Notice tone="success">Your Card Lovers membership is active. <Link href="/account" className="underline">Manage your account</Link>.</Notice>
            : <ActionButton className="w-full" disabled={busy} onClick={onSubscribe}>{signedIn ? purchaseLabel('card_lovers', `Subscribe ${annual ? 'Annually' : 'Monthly'}`) : 'Join Card Lovers'}</ActionButton>}
          <p className="dcm-fineprint"><Link className="underline underline-offset-4" href="/card-lovers">All Card Lovers benefits</Link></p>
        </article>

        <article className={`dcm-plan ${highlightPack === 'vip' ? 'dcm-plan--popular' : ''}`} id="plan-vip">
          <p className="dcm-plan-badge">One-time bulk value</p>
          <h3>{VIP_PACKAGE.name}</h3><p className="dcm-price">${VIP_PACKAGE.price}</p><p className="dcm-plan-meta">{VIP_PACKAGE.credits} credits · ${VIP_PACKAGE.perGradeCost.toFixed(2)} / grade</p>
          <div className="dcm-plan-benefits"><p>{VIP_PACKAGE.description}. More room for a whole collection.</p><p><strong>VIP diamond emblem</strong><br />Included on your card labels.</p><Link className="underline underline-offset-4" href="/vip">Explore VIP benefits</Link></div>
          <ActionButton variant="secondary" disabled={busy} onClick={onVipPurchase}>{signedIn ? purchaseLabel('vip', 'Get VIP Package') : 'Get VIP Package'}</ActionButton>
        </article>
      </div>

      <div className="dcm-section-topline" style={{ marginTop: '48px' }}><div><p className="dcm-eyebrow">Pay as you go</p><h2 id="all-packs-heading">All one-time packs.</h2></div><p className="dcm-fineprint">Buy once. Use the credits whenever you like.</p></div>
      <div className="dcm-plans dcm-plans--pair dcm-pack-compact" aria-labelledby="all-packs-heading">
        {compactTiers.map(tier => <article className={`dcm-plan ${highlightPack === tier.id ? 'dcm-plan--popular' : ''}`} key={tier.id} id={`plan-${tier.id}`}>
          <p className="dcm-plan-badge">{tier.id === 'basic' ? 'Start small' : 'Build your collection'}</p>
          <h3>{tier.name}</h3><p className="dcm-price">${tier.price.toFixed(2)}</p><p className="dcm-plan-meta">{tier.credits} credit{tier.credits === 1 ? '' : 's'} · ${tier.perGradeCost.toFixed(2)} / grade</p>
          <div className="dcm-plan-benefits"><p>{tier.description}</p>{showBonus && <p><strong>+{tier.bonusCredits} first-purchase bonus</strong> on your eligible first purchase.</p>}</div>
          {packButton(tier, 'secondary')}
        </article>)}
      </div>
      <p className="dcm-fineprint">Prices in USD. Per-grade rates use base credits, before eligible bonuses or discounts. Payments are processed through Stripe.</p>

      <div style={{ marginTop: '40px' }}><CardVisualRail compact /></div>
    </div></section>

    <section className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="Included with every grade" title="The complete picture of your card." />
      <div className="dcm-three-grid">{[
        { title: 'A detailed assessment', copy: 'Centering, corners, edges, and surface, with a written condition report.', icon: 'scan' as const },
        { title: 'Reports and labels', copy: 'Downloadable formats to document, display, and share your card.', icon: 'report' as const },
        { title: 'Your collection, connected', copy: 'Keep your card images, grades, and details together in your collection.', icon: 'collection' as const },
      ].map(item => <article className="dcm-step" key={item.title}><div className="dcm-step-top"><Icon name={item.icon} /></div><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
    </div></section>
    <section className="dcm-section dcm-surface"><div className="dcm-container dcm-faq dcm-pricing-faq"><SectionHeading eyebrow="Good to know" title="A few details before you start." />
      {[
        ['What does one credit include?', 'One credit grades one card, including centering, corners, edges, and surface assessments, a condition report, and downloadable labels.'],
        ['Is my payment secure?', 'Payments are processed securely by Stripe. DCM does not store your full payment-card details.'],
        ['Do my credits expire?', 'No. Your unused grading credits do not expire.'],
        ['Do I need a subscription?', 'No. Basic, Pro, Elite, and VIP are one-time purchases. Card Lovers is an optional recurring membership.'],
        ['How does the first-purchase bonus work?', 'Eligible first-time buyers receive the bonus shown on their Basic, Pro, or Elite pack. The two free signup credits are separate from that purchase bonus.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </div></section>
    <section className="dcm-closing dcm-dark"><div className="dcm-container"><SectionHeading eyebrow="Start with a card you love" title={signedIn ? 'Your next card is waiting.' : 'See your collection in a new light.'}>Front and back photos. A detailed DCM assessment. Your cards stay with you.</SectionHeading><ActionLink href={signedIn ? '/upload' : '/login?mode=signup&redirect=/credits'}>{signedIn ? 'Grade a Card' : 'Grade 2 Cards Free'}<Icon name="arrow" /></ActionLink></div></section>
  </div>
}
