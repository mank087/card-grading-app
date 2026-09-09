import Link from 'next/link'
import { pricingTiers, VIP_PACKAGE, CARD_LOVERS_PLANS, type PricingTier } from '@/lib/creditPackages'
import { CardVisualRail } from '@/components/design/CardVisualRail'
import { ActionButton, ActionLink, Icon, Notice, SectionHeading } from '@/components/design/Primitives'

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
  onPlanChange?: (plan: 'annual' | 'monthly') => void
  onPurchase?: (tier: PricingTier) => void
  onVipPurchase?: () => void
  onSubscribe?: () => void
  onDismissWelcome?: () => void
}

export default function PricingExperience({ authenticated = null, balance = 0, balanceLoading = true, firstPurchase = false, founder = false, cardLover = false, welcome = false, error, purchaseLoading = null, selectedPlan = 'annual', onPlanChange, onPurchase, onVipPurchase, onSubscribe, onDismissWelcome }: PricingExperienceProps) {
  // The stored-session check resolves on mount, so `authenticated === null` lasts
  // one render. Purchase controls therefore default to the LOGGED-OUT call to
  // action and swap to Buy/Subscribe only once a session is confirmed — one
  // direction, so a signed-in user never sees Buy turn back into Sign Up.
  const busy = purchaseLoading !== null
  const showBonus = authenticated === false || (authenticated && !balanceLoading && firstPurchase)
  const annual = selectedPlan === 'annual'
  const membership = CARD_LOVERS_PLANS[selectedPlan]
  const membershipCredits = annual ? CARD_LOVERS_PLANS.annual.totalCredits : CARD_LOVERS_PLANS.monthly.credits
  return <div className="dcm-brand dcm-pricing-page">
    <section className="dcm-price-intro"><div className="dcm-container dcm-price-intro-row">
      <div><p className="dcm-eyebrow">Grading that fits your collection</p><h1>Card grading pricing.<br />Every detail included.</h1><p className="dcm-lead">One credit grades one card. Get your DCM grade, condition report, and printable labels with every assessment.</p></div>
      {authenticated && <div className="dcm-plan"><p className="dcm-eyebrow">Your balance</p><p className="dcm-price">{balanceLoading ? '—' : balance}<span className="dcm-price-unit"> credits</span></p><ActionLink href="/upload" variant="text">Grade a Card <Icon name="arrow" /></ActionLink></div>}
    </div><div className="dcm-container"><CardVisualRail compact /></div></section>

    <section className="pb-16" aria-labelledby="credit-packs-heading"><div className="dcm-container">
      {authenticated === false && <div className="dcm-offer-strip"><div><strong>Your first two grades are on us.</strong><p>Create a free account. No credit card required.</p></div><ActionLink href="/login?mode=signup&redirect=/credits">Grade 2 Cards Free <Icon name="arrow" /></ActionLink></div>}
      {authenticated && welcome && <Notice tone="success"><div className="dcm-price-intro-row"><div><strong>Welcome to DCM.</strong><p>Choose a card and put your available credits to work.</p><ActionLink href="/upload" variant="text">Grade Your First Card <Icon name="arrow" /></ActionLink></div><ActionButton variant="text" onClick={onDismissWelcome}>Dismiss welcome</ActionButton></div></Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {authenticated && (cardLover || founder) && <Notice>{cardLover ? 'Card Lovers' : 'Founder'} discount active: your 20% credit-purchase discount is applied at checkout. Listed prices below are standard rates.</Notice>}
      <div className="dcm-section-topline"><div><p className="dcm-eyebrow">Pay as you go</p><h2 id="credit-packs-heading">Pick your next pack.</h2></div><p className="dcm-fineprint">One-time purchases. Credits never expire.</p></div>
      <div className="dcm-plans">
        {pricingTiers.map(tier => <article className={`dcm-plan ${tier.popular ? 'dcm-plan--popular' : ''}`} key={tier.id}>
          <p className="dcm-plan-badge">{tier.popular ? 'Most popular' : tier.id === 'basic' ? 'Start small' : 'Build your collection'}</p>
          <h3>{tier.name}</h3><p className="dcm-price">${tier.price.toFixed(2)}</p><p className="dcm-plan-meta">{tier.credits} credit{tier.credits === 1 ? '' : 's'} · ${tier.perGradeCost.toFixed(2)} / grade</p>
          <div className="dcm-plan-benefits"><p>{tier.description}</p>{showBonus ? <p><strong>+{tier.bonusCredits} first-purchase bonus</strong><br />{tier.credits + tier.bonusCredits} total credits on your eligible first purchase.</p> : <p>Full report and labels included with every grade.</p>}</div>
          {authenticated !== true ? <ActionLink variant={tier.popular ? 'primary' : 'secondary'} href="/login?mode=signup&redirect=/credits">Sign Up to Purchase</ActionLink> : <ActionButton variant={tier.popular ? 'primary' : 'secondary'} disabled={busy} onClick={() => onPurchase?.(tier)}>{purchaseLoading === tier.id ? 'Opening checkout…' : `Buy ${tier.name}`}</ActionButton>}
        </article>)}
        <article className="dcm-plan"><p className="dcm-plan-badge">One-time bulk value</p><h3>{VIP_PACKAGE.name}</h3><p className="dcm-price">${VIP_PACKAGE.price}</p><p className="dcm-plan-meta">{VIP_PACKAGE.credits} credits · ${VIP_PACKAGE.perGradeCost.toFixed(2)} / grade</p><div className="dcm-plan-benefits"><p>More room for your collection.</p><p><strong>VIP diamond emblem</strong><br />Included on your card labels.</p><Link className="underline underline-offset-4" href="/vip">Explore VIP benefits</Link></div>
          {authenticated !== true ? <ActionLink variant="secondary" href="/login?mode=signup&redirect=/credits">Sign Up to Purchase</ActionLink> : <ActionButton variant="secondary" disabled={busy} onClick={onVipPurchase}>{purchaseLoading === 'vip' ? 'Opening checkout…' : 'Get VIP Package'}</ActionButton>}
        </article>
      </div>
      <p className="dcm-fineprint">Prices in USD. Per-grade rates use base credits, before eligible bonuses or discounts. Payments are processed through Stripe.</p>
    </div></section>

    <section className="dcm-section dcm-surface" aria-labelledby="membership-heading"><div className="dcm-container dcm-membership">
      <div><p className="dcm-eyebrow">For the love of collecting</p><h2 id="membership-heading">More card analysis.<br />Every month.</h2><p className="dcm-lead">Card Lovers membership brings regular grading credits and extra benefits to the collection you keep coming back to.</p>
        <ul className="dcm-checklist"><li><Icon name="check" />20% off additional credit purchases</li><li><Icon name="check" />Card Lover heart emblem on your labels</li><li><Icon name="check" />Unused credits never expire</li></ul>
        <ActionLink href="/card-lovers" variant="text">All Card Lovers Benefits <Icon name="arrow" /></ActionLink>
      </div>
      <div className="dcm-membership-card">
        <div className="dcm-segmented" role="group" aria-label="Membership billing period"><button type="button" aria-pressed={annual} onClick={() => onPlanChange?.('annual')}>Annual</button><button type="button" aria-pressed={!annual} onClick={() => onPlanChange?.('monthly')}>Monthly</button></div>
        <div aria-live="polite"><p className="dcm-price">${membership.price}<span className="dcm-price-unit"> / {membership.interval}</span></p><p className="dcm-plan-meta">{annual ? `Billed annually. Equivalent to $${(membership.price / 12).toFixed(2)} per month.` : 'Billed monthly. Cancel your subscription anytime.'}</p>
          <ul className="dcm-checklist"><li><Icon name="check" /><span><strong>{membershipCredits} credits {annual ? 'upfront' : 'each month'}</strong>{annual && <><br />Includes {CARD_LOVERS_PLANS.annual.bonusCredits} annual bonus credits</>}</span></li><li><Icon name="check" />${(membership.price / membershipCredits).toFixed(2)} per included grade</li></ul>
        </div>
        {cardLover ? <Notice tone="success">Your Card Lovers membership is active. <Link href="/account" className="underline">Manage your account</Link>.</Notice> : authenticated !== true ? <ActionLink className="w-full" href="/login?mode=signup&redirect=/credits">Sign Up to Subscribe</ActionLink> : <ActionButton className="w-full" disabled={busy} onClick={onSubscribe}>{purchaseLoading === 'card_lovers' ? 'Opening checkout…' : `Subscribe ${annual ? 'Annually' : 'Monthly'}`}</ActionButton>}
        <p className="dcm-fineprint">Recurring membership. Your billing period and total are shown at checkout.</p>
      </div>
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
    <section className="dcm-closing dcm-dark"><div className="dcm-container"><SectionHeading eyebrow="Start with a card you love" title={authenticated ? 'Your next card is waiting.' : 'See your collection in a new light.'}>Front and back photos. A detailed DCM assessment. Your cards stay with you.</SectionHeading><ActionLink href={authenticated ? '/upload' : '/login?mode=signup&redirect=/credits'}>{authenticated ? 'Grade a Card' : 'Grade 2 Cards Free'}<Icon name="arrow" /></ActionLink></div></section>
  </div>
}
