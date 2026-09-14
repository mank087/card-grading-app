import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import LeadForm from './LeadForm'
import { StoreMockRow } from './BrandedSlabVisual'
import { ORG_PLANS, ORG_OVERAGE_PACK } from '@/lib/orgPlans'
import styles from './enterprise.module.css'
export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/enterprise' },
  title: 'Enterprise Card Grading for Shops & Breakers',
  description: "Build your card grading brand with DCM Optic: branded labels, grading reports and a hosted storefront. Explore wholesale plans for shops and sellers.",
  keywords: 'card store grading, dealer card grading, case breaker grading, streamer card grading, white label card grading, branded slab labels, LCS grading service, enterprise card grading, card shop grading program',
  openGraph: {
    images: [{ url: '/DCM-logo.png', alt: 'DCM Grading' }],
    url: 'https://dcmgrading.com/enterprise',
    title: 'DCM Enterprise: Launch Your Own Card Grading Brand',
    description: 'Branded grading for shops, breakers, streamers, and collectors: your logo on labels, reports, and card pages, backed by the DCM verification registry.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'DCM Enterprise: Launch Your Own Card Grading Brand',
    description: 'Your own card grading brand, powered by DCM Optic™ grading.',
  },
});

const benefits = [
  ['Grade inventory on your schedule', 'Photograph cards at your counter, on stream, or at a show. DCM Optic™ returns centering, corner, edge, and surface assessments in minutes.'],
  ['Make every result recognizable', 'Your logo and colors carry through labels, reports, downloadable card images, and card pages. Give your inventory a consistent presentation.'],
  ['Give customers the details', 'Share the condition report behind each grade. A unique serial and QR code let buyers look up the recorded card photos and assessment.'],
  ['Keep your team working together', 'You and your staff draw from a shared monthly grading allowance. Choose the volume that fits your business.'],
  ['Give your brand a home', 'Share a hosted business page with your story, contact details, socials, serial lookup, and recently graded cards.'],
  ['Print where you work', 'Create Heritage labels, fold-over labels, and batches of labels for your own holders. Download the files and print locally.'],
]
const faqs = [
  ['What happens after I apply?', 'The DCM team reviews your business and branding, usually within one business day. Once approved, you can choose and pay for a plan, finish setting up your brand, and start grading. There is no payment until approval.'],
  ['What do I need to get started?', 'Have your business details and logo ready, plus a phone or camera for clear front and back card photos. For physical displays, you supply a compatible printer, label stock, and holders, and handle assembly yourself. DCM provides the grading software, records, and downloadable label and report files.'],
  ['Can my team use the same plan?', 'Yes. Your team draws from your organization’s shared monthly grading allowance.'],
  ['Do unused grades roll over?', 'Unused monthly grades do not roll over. Your monthly allowance refreshes each billing cycle. Separately purchased overage credits roll over and are used after your monthly allowance is exhausted.'],
  ['What does the QR code verify?', 'It opens the card’s recorded assessment, including its photos, grade, and details on your branded registry page. It does not authenticate the physical card or certify that a holder contains that card.'],
  ['Does DCM supply or seal the holders?', 'No. Your business supplies, assembles, and seals its holders. DCM Optic™ provides an AI-assisted visual condition assessment from card photos; DCM does not physically inspect or authenticate the card.'],
  ['Can businesses outside the US apply?', 'Yes. International businesses are welcome. Prices are in USD, and you print labels locally and provide your own holders.'],
  ['Can I cancel my plan?', 'You can cancel at any time, effective at the end of your current billing period. Monthly grades remain available through that paid period and expire when the plan ends. Overage credits remain usable while the organization’s account stays active. See the Enterprise Program Terms for full details.'],
]

// The visible FAQ <details> list and this JSON-LD are both built from `faqs`.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([question, answer]) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
    { '@type': 'ListItem', position: 2, name: 'Enterprise', item: 'https://dcmgrading.com/enterprise' },
  ],
}

// Prices come from ORG_PLANS so the schema cannot drift from the plan cards.
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'DCM Enterprise white-label card grading',
  serviceType: 'Branded photo-based trading card condition assessment for businesses',
  description: 'Grade card inventory with DCM Optic and publish the result under your own brand: branded labels, condition reports, a serial registry, and a hosted business page.',
  url: 'https://dcmgrading.com/enterprise',
  // Reference the site-wide Organization node emitted by the root layout instead of minting a second one.
  provider: { '@id': 'https://dcmgrading.com/#organization' },
  offers: Object.values(ORG_PLANS).map(plan => ({
    '@type': 'Offer',
    name: `${plan.name}: ${plan.gradesPerMonth.toLocaleString()} grades per month`,
    price: plan.priceUsd,
    priceCurrency: 'USD',
    url: 'https://dcmgrading.com/enterprise/apply',
    priceSpecification: { '@type': 'UnitPriceSpecification', price: plan.priceUsd, priceCurrency: 'USD', billingDuration: 'P1M' },
  })),
}

export default function EnterprisePage() {
  return <div className={`dcm-brand ${styles.page}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
    <section className={`dcm-dark ${styles.hero}`}>
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div>
          <p className="dcm-eyebrow">DCM Enterprise · For shops, breakers & sellers</p>
          <h1>Bring card grading<br />to your counter.<br /><span>Put your brand<br />on every result.</span></h1>
          <p className={styles.heroLead}>Grade cards with DCM Optic™, create branded labels and reports, and give customers a searchable grading record. All under your business name.</p>
          <p className={styles.starting}>From ${ORG_PLANS.dealer.priceUsd}/month <span>· {ORG_PLANS.dealer.gradesPerMonth} grades included</span></p>
          <div className="dcm-actions"><Link href="/enterprise/apply" className="dcm-button dcm-button--primary">Apply to Launch Your Brand <span aria-hidden="true">→</span></Link><Link href="#contact" className="dcm-button dcm-button--secondary">Request a Demo</Link></div>
          <p className="dcm-fineprint">No payment until approved. Applications usually reviewed within one business day.</p>
          <Link href="#pricing" className={styles.heroLink}>Compare monthly plans <span aria-hidden="true">↓</span></Link>
        </div>
        <figure className={styles.heroVisual}>
          <p>Your name. Your colors. Your label.</p>
          <Image src="/enterprise/slab-your-logo-v4.png" alt="Aaron Judge card in a Heritage slab display with a reserved space for your business logo" width={800} height={1314} priority sizes="(max-width: 760px) 75vw, 330px" />
          <figcaption>Example branded display. Holders and printing supplied by your business.</figcaption>
        </figure>
      </div>
    </section>

    <div className={styles.jump} role="navigation" aria-label="Enterprise page sections"><div className={styles.container}><Link href="#branding">Your brand in action</Link><Link href="#how-it-works">Getting started</Link><Link href="#pricing">Plans & pricing</Link><Link href="#questions">Common questions</Link></div></div>

    <section id="branding" className={styles.section}><div className={styles.container}>
      <p className="dcm-eyebrow">Built around your identity</p><h2>One brand, from label to lookup.</h2><p className={styles.lead}>Give customers a consistent experience when they see your card, read its report, or look up the grading record.</p>
      <ol className={styles.brandJourney}>
        {[
          ['Branded label', 'Your logo and colors on Heritage and other label styles.'],
          ['Grading report', 'Your branding alongside photos and condition details.'],
          ['QR-linked record', 'Your serial prefix leads to a branded card assessment.'],
          ['Business page', 'Your story, contact details, and graded cards in one place.'],
        ].map(([title, copy], i) => <li key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}
      </ol>
      <div className={styles.examples}><StoreMockRow /></div>
      <p className={styles.caption}>Illustrative brands on real DCM label renders. Your own logo and colors are configured during onboarding.</p>
    </div></section>

    <section className={`${styles.section} ${styles.tint}`}><div className={styles.container}>
      <p className="dcm-eyebrow">Built for your day-to-day business</p><h2>More ways to put grading to work.</h2>
      <div className={styles.benefits}>{benefits.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
      <div className={styles.useCases}><strong>At the counter. On stream. At the show.</strong><p>Walk a customer through a report, grade a pull after a break, or prepare inventory with consistent labels and card records.</p></div>
    </div></section>

    <section id="how-it-works" className={styles.section}><div className={styles.container}>
      <p className="dcm-eyebrow">From application to first card</p><h2>Set up your brand. Start grading.</h2>
      <ol className={styles.steps}>{[
        ['Apply with your business details', 'Share your business name, logo, and expected volume. The DCM team reviews your application before you pay.'],
        ['Choose a plan and set up', 'After approval, subscribe and configure your branding, labels, and business page. Enterprise includes onboarding and launch support.'],
        ['Grade, print, and share', 'Capture front and back photos, review the assessment, and download your branded files. Share the card’s record with your customers.'],
      ].map(([title, copy], i) => <li key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>
      <div className={styles.supplies}><div><h3>DCM provides</h3><p>Grading software, card records, branded label and report files, and your hosted business page.</p></div><div><h3>You bring</h3><p>Your business identity, clear card photos, and, for physical displays, your printer, label stock, holders, and assembly.</p></div></div>
    </div></section>

    <section id="pricing" className={`${styles.section} ${styles.tint}`}><div className={styles.container}>
      <p className="dcm-eyebrow">Predictable monthly grading budget</p><h2>Choose the volume that fits your business.</h2><p className={styles.lead}>Both plans include branded labels, reports, card pages, your business page, and your own serial registry.</p>
      <div className={styles.plans}>{Object.values(ORG_PLANS).map(plan => <article key={plan.key} className={`${styles.plan} ${plan.key === 'enterprise' ? styles.featured : ''}`}>
        <p className="dcm-eyebrow">{plan.key === 'dealer' ? 'Build grading into your business' : 'For higher monthly volume'}</p><h3>{plan.name}</h3>
        <p className={styles.price}>${plan.priceUsd}<span>/month</span></p><p className={styles.allowance}>{plan.gradesPerMonth.toLocaleString()} grades included each month</p>
        <p className={styles.rate}>Approximately ${(plan.priceUsd / plan.gradesPerMonth).toFixed(2)} per grade when the full allowance is used.</p>
        <ul>{['Your logo and colors on labels & reports', 'Branded card records & serial registry', 'Hosted business page', 'Shared grading allowance for your team', ...(plan.key === 'dealer' ? ['Email support'] : ['Onboarding & launch support', 'Direct line to the DCM team'])].map(feature => <li key={feature}>{feature}</li>)}</ul>
        <Link href="/enterprise/apply" className="dcm-button dcm-button--primary">Apply to Launch Your Brand <span aria-hidden="true">→</span></Link>
      </article>)}</div>
      <div className={styles.pricingNotes}><div><h3>Monthly grades reset</h3><p>Unused monthly grades do not roll over. Your allowance refreshes each billing cycle.</p></div><div><h3>Extra credits carry over</h3><p>Overage packs cost ${ORG_OVERAGE_PACK.priceUsd.toFixed(2)} for {ORG_OVERAGE_PACK.grades} grades (${ORG_OVERAGE_PACK.perGradeUsd.toFixed(2)} per grade). They roll over and are used after your monthly allowance.</p></div></div>
      <p className={styles.caption}>All prices in USD. No payment until approved. Physical supplies and printing are provided by your business. <Link href="/enterprise/terms">Read the Enterprise Program Terms.</Link></p>
    </div></section>

    <section id="questions" className={styles.section}><div className={`${styles.container} ${styles.split}`}>
      <div><p className="dcm-eyebrow">Before you launch</p><h2>Know what to expect.</h2><p className={styles.lead}>From setup and supplies to your monthly allowance.</p><Link href="/enterprise/terms" className="dcm-button dcm-button--text">Full Program Terms <span aria-hidden="true">→</span></Link></div>
      <div className={styles.faq}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </div></section>

    <section id="contact" className={`${styles.section} ${styles.tint}`}><div className={`${styles.container} ${styles.split}`}>
      <div><p className="dcm-eyebrow">Let’s talk about your business</p><h2>See how your brand fits.</h2><p className={styles.lead}>Tell us what you sell and how much you expect to grade. We’ll reach out within one business day to discuss your workflow and plan options.</p><div className={styles.ready}><h3>Ready to get started?</h3><p>Have your business details and logo ready to apply.</p><Link href="/enterprise/apply" className="dcm-button dcm-button--primary">Apply to Launch Your Brand <span aria-hidden="true">→</span></Link><p className={styles.caption}>No payment until approved.</p></div></div>
      <div><h3 className={styles.formHeading}>Request a Demo</h3><LeadForm /></div>
    </div></section>
  </div>
}
