'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStoredSession, AUTH_STATE_CHANGE_EVENT } from '@/lib/directAuth'
import AppStoreBadge from '@/components/AppStoreBadge'
import GooglePlayBadge from '@/components/GooglePlayBadge'
import { ActionLink, Icon, SectionHeading, type IconName } from '@/components/design/Primitives'
import { HomeHeroVideo } from './HomeHeroVideo'
import { showcaseHref } from '@/components/design/featuredCard'
import { useShowcaseCards } from '@/components/design/useShowcaseCards'
import { HeritageCard } from '@/components/design/HeritageCard'
import { GradingShowreel } from '@/components/design/GradingShowreel'
import { pricingTiers, VIP_PACKAGE } from '@/lib/creditPackages'

const steps: { title: string; copy: string; icon: IconName }[] = [
  { title: 'Snap two photos', copy: 'Front and back, with your phone or camera. Capture guides and a photo quality check help you get a clear view.', icon: 'camera' },
  { title: 'Let Optic look closer', copy: 'DCM Optic™ evaluates centering, corners, edges, and surface, with a written breakdown of your card’s condition.', icon: 'scan' },
  { title: 'Make the grade yours', copy: 'Explore your report, create a label, check market value, or prepare your card for sale. It’s all connected.', icon: 'report' },
]
const features: { title: string; copy: string; href: string; action: string; icon: IconName }[] = [
  { title: 'Your collection', copy: 'Your actual cards, organized in one place. Keep your grades and card details close at hand.', href: '/collection', action: 'Explore Collection', icon: 'collection' },
  { title: 'Your portfolio', copy: 'See the market information behind your cards and follow the value of your collection.', href: '/market-pricing', action: 'Explore Portfolio', icon: 'chart' },
  { title: 'Your label', copy: 'Give each card a finishing touch with custom labels, printable reports, and digital slab images.', href: '/labels', action: 'Explore Label Studio', icon: 'label' },
  { title: 'Your next sale', copy: 'Turn your graded card into an eBay listing with InstaList, right from your collection.', href: '/instalist-marketplace', action: 'Explore InstaList', icon: 'sell' },
]

export default function HomeExperience() {
  const [filmOpen, setFilmOpen] = useState(false)
  const [member, setMember] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const cards = useShowcaseCards()
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    const sync = () => { setMember(Boolean(getStoredSession()?.user)); setAuthChecked(true) }
    sync()
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, sync)
    return () => window.removeEventListener(AUTH_STATE_CHANGE_EVENT, sync)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const loadCount = () => fetch('/api/pop/categories', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { const count = data?.totals?.totalGraded; if (typeof count === 'number' && Number.isFinite(count) && count >= 0) setTotal(count) })
      .catch(() => { /* Population-report link remains available. */ })
    loadCount()
    return () => controller.abort()
  }, [])
  const gradeHref = !authChecked || member ? '/upload' : '/login?mode=signup'
  const gradeLabel = !authChecked || member ? 'Grade a Card' : 'Grade 2 Cards Free'
  const sample = cards[0]
  return <div className="dcm-brand">
    <section className="dcm-hero dcm-hero--cinema dcm-dark"><div className="dcm-container">
      <div className="dcm-hero-copy">
        <p className="dcm-eyebrow">Your collection. A closer look.</p>
        <h1>Professional card grading.<br /><span>Instant results.</span></h1>
        <p className="dcm-lead">Snap two photos. DCM Optic™ returns a grade, condition report, market value, and printable label in about a minute. Your cards stay with you.</p>
        <div className="dcm-actions"><ActionLink href={gradeHref}>{gradeLabel}<Icon name="arrow" /></ActionLink><ActionLink href="/get-started" variant="secondary">How It Works</ActionLink></div>
        <button type="button" className="dcm-home-watch-link" onClick={() => setFilmOpen(true)} aria-haspopup="dialog" aria-label="Watch DCM in action, 44 seconds with music"><span aria-hidden="true">▶</span> Watch DCM in action <span>· 44 sec</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg></button>
        <p className="dcm-fineprint">{!authChecked ? 'Your cards, reports, and labels in one place.' : member ? 'Your collection, reports, and labels are ready when you are.' : 'Free account. No credit card required.'}</p>
      </div><HomeHeroVideo open={filmOpen} onClose={() => setFilmOpen(false)} />
    </div></section>
    <div className="dcm-trust"><div className="dcm-container dcm-trust-grid">
      <Link href="/pop"><strong>{total === null ? 'Public' : total.toLocaleString('en-US')}</strong>{total === null ? 'population report' : 'cards graded'}</Link>
      <Link href="/grading-standard"><Icon name="shield" /><strong>Published</strong> grading standards</Link>
      <Link href="/get-started"><Icon name="camera" /><strong>No shipping.</strong> Just two photos.</Link>
      <Link href="#get-the-app"><strong>iOS & Android</strong> apps available</Link>
    </div></div>
    <section className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="How it works" title="From your camera to your collection.">Three simple steps. A whole new perspective on your cards.</SectionHeading>
      <div className="dcm-three-grid">{steps.map((step, i) => <article className="dcm-step" key={step.title}><div className="dcm-step-top"><Icon name={step.icon} /><span>0{i + 1}</span></div><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
      <div className="mt-6"><ActionLink href="/get-started" variant="text">See How It Works <Icon name="arrow" /></ActionLink></div>
    </div></section>
    <section className="dcm-section dcm-surface"><div className="dcm-container dcm-home-evidence">
      <div><SectionHeading eyebrow="The evidence behind the grade" title="A number is just the beginning.">Explore the centering, corners, edges, and surface behind your card’s result. Each report brings your card images and grading details together.</SectionHeading>
        <ActionLink href={sample ? showcaseHref(sample) : '/featured'}>Explore a Real Report <Icon name="arrow" /></ActionLink><p className="dcm-fineprint">DCM grades reflect our published standard. <Link href="/grading-limitations">Understand photo-based grading.</Link></p>
      </div><GradingShowreel cards={cards.slice(0,5)} />
    </div></section>
    <section className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="More than a grade" title="Everything your collection can become.">Grade it. Organize it. Show it. Sell it. Keep the next step close.</SectionHeading>
      <div className="dcm-four-grid">{features.map(feature => <article className="dcm-feature" key={feature.title}><Icon name={feature.icon} /><h3>{feature.title}</h3><p>{feature.copy}</p><ActionLink href={feature.href} variant="text">{feature.action}<Icon name="arrow" /></ActionLink></article>)}</div>
    </div></section>
    {cards.length > 0 && <section className="dcm-section dcm-surface"><div className="dcm-container">
      <div className="dcm-section-topline"><SectionHeading eyebrow="From the community" title="Real cards. Real DCM grades." /><ActionLink href="/featured" variant="text">All Featured Cards <Icon name="arrow" /></ActionLink></div>
      <div className="dcm-gallery dcm-gallery--heritage">{cards.slice(0, 5).map(card => <Link className="dcm-gallery-card" href={showcaseHref(card)} key={card.id}><HeritageCard card={card} /><h3>{card.card_name}</h3><p>{card.card_set || card.category}</p></Link>)}</div>
    </div></section>}
    <section className="dcm-section"><div className="dcm-container dcm-split">
      <div><SectionHeading eyebrow="Grading, in the open" title="Confidence starts with clarity.">Our standards, population data, and limitations are public. Take a closer look at how DCM grades.</SectionHeading><ActionLink href="/why-dcm" variant="text">Why DCM <Icon name="arrow" /></ActionLink></div>
      <div className="dcm-proof-links">{[['Our grading standard', '/grading-standard'], ['Public population report', '/pop'], ['Photo-based grading limitations', '/grading-limitations'], ['Compare grading services', '/card-grading-companies'], ['How AI card grading works', '/ai-card-grading'], ['AI grading accuracy', '/ai-card-grading-accuracy'], ['Grading rubric', '/grading-rubric'], ['Reports and labels', '/reports-and-labels'], ['Compare grading costs', '/cheapest-card-grading']].map(([label, href]) => <Link href={href} key={href}>{label}<Icon name="arrow" /></Link>)}</div>
    </div></section>
    <section className="dcm-section dcm-surface"><div className="dcm-container dcm-price-intro-row">
      <SectionHeading eyebrow="A place to start" title={!authChecked || member ? 'Ready for your next card?' : 'Your first two grades are on us.'}>Then choose what fits your collection. Single grades from ${pricingTiers[0].price.toFixed(2)}, or ${VIP_PACKAGE.perGradeCost.toFixed(2)} per grade with the {VIP_PACKAGE.credits}-credit VIP pack.</SectionHeading><ActionLink href="/credits" variant="secondary">Explore Pricing <Icon name="arrow" /></ActionLink>
    </div></section>
    <section id="get-the-app" className="dcm-closing dcm-dark scroll-mt-20"><div className="dcm-container">
      <SectionHeading eyebrow="At home. At a show. Anywhere." title="Know the condition of every card.">Sports, Pokémon, Magic: The Gathering, Disney Lorcana, and more. Start here, or take DCM with you.</SectionHeading>
      <div className="dcm-actions"><ActionLink href={gradeHref}>{gradeLabel}<Icon name="arrow" /></ActionLink>{member && <ActionLink href="/collection" variant="secondary">View Collection</ActionLink>}</div>
      <div className="dcm-app-links"><AppStoreBadge variant="black" height={44} /><GooglePlayBadge height={44} /></div>
    </div></section>
  </div>
}
