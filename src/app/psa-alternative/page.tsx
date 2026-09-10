import { completeMetadata } from '@/lib/seo/completeMetadata'
import { Metadata } from 'next';
import Link from 'next/link';
import { ReferenceCardShowcase } from '@/components/design/ReferenceCardShowcase';
import { MarketingShowcaseBoundary } from '@/components/marketing/MarketingShowcaseBoundary';
import { PsaCostComparison, PsaReportExample } from '@/components/marketing/PsaComparisonTools';
import { CARD_LOVERS_PLANS } from '@/lib/creditPackages';
import styles from '@/components/marketing/PsaExperience.module.css';
const PSA_SOURCE = 'https://www.psacard.com/articles/articleview/15763';
const UPDATED_ISO = '2026-09-10';

export const metadata: Metadata = completeMetadata({
  title: "PSA Alternative: Photo-Based Card Grading",
  description:
    "A PSA alternative: assess trading cards from two photos in about 60 seconds. From $0.50 a card with Card Lovers Annual, or $2.99 for one. Four subgrades.",
  keywords:
    'PSA alternative, alternative to PSA grading, PSA vs DCM, cheap card grading, fast card grading, AI card grading, online card grading, no-mail card grading, photo card grading',
  alternates: {
    canonical: 'https://dcmgrading.com/psa-alternative',
  },
  openGraph: {
    title: 'PSA Alternative. Understand Card Condition From Photos | DCM Grading',
    description:
      'No mailing. As low as $0.50 a card with Card Lovers Annual, or $2.99 for a single card. Four subgrades on every grade. Sports, Pokémon and other trading cards.',
    type: 'website',
    siteName: 'DCM Grading',
    url: 'https://dcmgrading.com/psa-alternative',
    images: [
      {
        url: '/why-dcm/Price-graded-cards.png',
        width: 1200,
        height: 630,
        alt: 'DCM Grading PSA alternative comparison showing instant AI grading and lower per-card pricing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PSA Alternative. Understand Card Condition From Photos',
    description: 'No mailing. As low as $0.50 a card with Card Lovers Annual. Four subgrades on every grade.',
    images: ['/why-dcm/Price-graded-cards.png'],
  },
});

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Card Grading Companies',
      item: 'https://dcmgrading.com/card-grading-companies',
    },
    { '@type': 'ListItem', position: 3, name: 'PSA Alternative', item: 'https://dcmgrading.com/psa-alternative' },
  ],
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI Trading Card Grading (PSA Alternative)',
  name: 'DCM Grading',
  provider: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: 'https://dcmgrading.com/DCM-logo.png',
  },
  areaServed: 'Worldwide',
  description:
    'Photo-based AI card grading. A PSA alternative with no mailing requirement, no card-value minimums, four subgrades on every card, and pricing as low as $0.50 a card with Card Lovers Annual.',
  offers: {
    '@type': 'Offer',
    price: '2.99',
    priceCurrency: 'USD',
    description:
      'A single grading credit is $2.99. Packs bring the per-grade cost to $2.00 (5 for $9.99), $1.00 (20 for $19.99) and $0.66 (150 for $99). Card Lovers Annual is $449 for 900 grades, about $0.50 each.',
    url: 'https://dcmgrading.com/credits',
  },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'PSA Alternative: Understand Card Condition From Photos in About 60 Seconds',
  description:
    'What a good PSA alternative looks like in 2026, with sourced PSA pricing and turnaround, and an honest account of what a photo-based grade is and is not.',
  datePublished: '2026-09-09',
  dateModified: UPDATED_ISO,
  mainEntityOfPage: 'https://dcmgrading.com/psa-alternative',
  author: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
  publisher: {
    '@type': 'Organization',
    name: 'DCM Grading',
    url: 'https://dcmgrading.com',
    logo: { '@type': 'ImageObject', url: 'https://dcmgrading.com/DCM-logo.png' },
  },
  citation: [PSA_SOURCE, 'https://www.psacard.com/services/tradingcardgrading'],
};

/**
 * Single source for the FAQ: rendered as open headings below AND serialized to
 * FAQPage JSON-LD. Each answer opens with a one-sentence direct answer.
 */
const faqs = [
  {
    q: 'What is the best PSA alternative for grading cards in 2026?',
    a: 'For a grade you can have today on a card that never leaves your hands, DCM is a photo-based option for documenting card condition at home. It grades against a published rubric covering centering, corners, edges and surface, returns a whole-number grade from 1 to 10 with four subgrades and a written reason for every deduction, and costs $2.99 for a single card, as low as $0.66 a card with the 150-credit VIP package. Mail-in grading from PSA, Beckett, SGC or CGC remains the right call when the card is valuable enough that a sealed, serialized slab changes what a buyer will pay.',
  },
  {
    q: 'Do I have to mail my cards in for DCM?',
    a: 'No. DCM is photo-based: you take front and back photos with your phone, upload them, and the grade comes back in about 60 seconds. Your cards never leave your hands, so there is no packing, no insured shipping in either direction, and no return-shipment window where the card exists only as a tracking number.',
  },
  {
    q: 'How does DCM pricing compare to PSA?',
    a: 'DCM costs $2.99 for a single grading credit, $19.99 for 20, or $99 for 150. Card Lovers Annual is $449 for 900 credits upfront. PSA announced Standard at $59.99 per card, opening September 14, 2026, with a $1,000 maximum insured value. Its Value tiers remain paused. These are different services: DCM provides a digital assessment and printable labels; PSA provides physical authentication, grading and encapsulation. Shipping and applicable taxes are additional to PSA grading fees.',
  },
  {
    q: 'How long does PSA take compared to DCM?',
    a: 'DCM typically returns a digital assessment in about a minute, although processing time varies. PSA’s September 9 announcement gives Standard an estimated 90–100 business-day turnaround, opening September 14, 2026. Priority, formerly Regular, is estimated at 70–80 business days. PSA estimates are not guarantees, and shipping adds time to the physical submission journey.',
  },
  {
    q: 'Does DCM have a card-value minimum?',
    a: 'No. DCM grades every card with the same protocol, whether it is a ten-cent base card or a four-figure chase, and there is no minimum submission size. Mail-in services structure their pricing around declared value and service level, and their budget tiers are the first to be paused when submissions spike, as happened at both PSA and Beckett in the summer of 2026.',
  },
  {
    q: 'Are subgrades included with every DCM grade?',
    a: 'Yes, all four, on every grade, at no extra cost. Centering, corners, edges and surface are each scored, with the final result determined by DCM’s published grading standard and three-pass consensus process. Among the mail-in graders, Beckett prints subgrades on the label at every tier while PSA, SGC and CGC do not as standard.',
  },
  {
    q: 'Can a DCM grade replace a PSA slab for selling on eBay?',
    a: 'No, and we do not claim it can. Where a buyer specifically wants a sealed PSA slab in hand, that is what they want and nothing else substitutes for it. What a DCM grade does do is document the condition of a raw card with four subgrades, a defect log and a public verification page a buyer can check by scanning the label, which is a stronger listing than a raw card in a sleeve with no record at all.',
  },
  {
    q: 'How does AI grading actually work?',
    a: 'DCM Optic runs three independent evaluation passes over every card and takes the median as the grade. Corners, edges and surface zones are re-examined on magnified crops, every deduction is logged with a written reason, and each grade carries an image confidence letter from A to D plus an uncertainty range. The rubric is published at /grading-standard and the limitations are published at /grading-limitations.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function PsaAlternativePage() {
  const signup = '/login?mode=signup&redirect=%2Fupload'
  return <div className={`dcm-brand ${styles.page}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    <MarketingShowcaseBoundary selection="reports-and-labels">
      <div className={styles.container}>
        <section className={styles.hero}>
          <div><p className="dcm-eyebrow">The PSA alternative · Your cards stay with you</p>
            <h1>A PSA alternative.<br />A closer look at your cards.</h1>
            <p className={styles.lead}>A PSA alternative for card condition analysis at home. Get a DCM grade, four subgrades and a detailed report from front-and-back photos, usually in about a minute.</p>
            <div className={styles.actions}><Link className={styles.primary} href={signup}>Grade 2 Cards Free →</Link><a className={styles.secondary} href="#real-report">Explore a Real Report</a></div>
            <p className={styles.note}>No credit card required. No mailing. Digital assessment and printable labels; physical authentication and encapsulation are separate services.</p>
          </div>
          <div className={styles.heroCard}><ReferenceCardShowcase page="reports-and-labels" category="Pokemon" /></div>
        </section>
        <aside className={styles.update} aria-label="PSA service update">
          <strong>PSA update · Checked September 10, 2026</strong>
          <p>Standard opens September 14: <strong>$59.99 per card</strong>, estimated <strong>90–100 business days</strong>, maximum insured value <strong>$1,000</strong>. Value tiers remain paused. Existing Value and Bulk orders will be processed before Standard orders.</p>
          <p>Regular is being renamed Priority: $79.99 per card, estimated 70–80 business days. <a href={PSA_SOURCE} target="_blank" rel="noopener noreferrer">Read PSA’s September 9 announcement ↗</a></p>
        </aside>
        <section id="real-report" className={styles.section}><PsaReportExample /></section>
        <section className={styles.section}><PsaCostComparison /></section>
        <section className={styles.section}>
          <p className="dcm-eyebrow">Two different journeys</p><h2>From your card to your next decision.</h2>
          <div className={styles.two}>
            <article className={styles.tile}><h3>DCM · Photo-based analysis</h3><p>Your card stays on your desk. Receive a digital grade and condition report, then choose how to use it.</p><ol className={styles.steps}><li>Photograph the front and back</li><li>Upload for DCM Optic analysis</li><li>Explore your grade and four subgrades</li><li>Create labels, organize or prepare a listing</li></ol><p className={styles.note}>Usually about a minute per analysis. Photo quality and processing conditions can affect timing.</p></article>
            <article className={styles.tile}><h3>PSA · Physical grading</h3><p>Choose this path when you want physical authentication, a sealed PSA holder or PSA-specific certification.</p><ol className={styles.steps}><li>Select an eligible service level</li><li>Prepare and send your cards</li><li>Physical authentication, grading and encapsulation</li><li>Receive your graded cards</li></ol><p className={styles.note}>Standard: estimated 90–100 business days, announced opening September 14. Shipping adds time. Estimates are not guaranteed.</p></article>
          </div>
        </section>
        <section className={styles.section}>
          <p className="dcm-eyebrow">Make the result useful</p><h2>More ways to enjoy your collection.</h2>
          <div className={styles.grid}>
            <article className={styles.tile}><p className="dcm-eyebrow">01 / Keep</p><h3>Understand what you own.</h3><p>Document condition, create Heritage labels and keep your cards and reports together in your collection.</p><Link href="/reports-and-labels">Explore reports and labels →</Link></article>
            <article className={styles.tile}><p className="dcm-eyebrow">02 / Consider</p><h3>Inspect before you submit.</h3><p>Review condition evidence before deciding whether physical grading fits your goals. DCM grades do not predict or guarantee PSA results.</p><Link href="/grading-standard">See the grading standard →</Link></article>
            <article className={styles.tile}><p className="dcm-eyebrow">03 / Sell</p><h3>Prepare your next listing.</h3><p>Bring your card details and documented condition into an eBay listing with InstaList. Review your listing before publishing.</p><Link href="/instalist-marketplace">Explore InstaList →</Link></article>
          </div>
        </section>
        <section className={styles.section}>
          <p className="dcm-eyebrow">Choose the outcome you need</p><h2>DCM vs PSA at a glance.</h2>
          <div className={styles.tableWrap}><table><caption className="sr-only">DCM digital assessments compared with PSA physical grading; PSA Standard announced for September 14, 2026</caption><thead><tr><th scope="col">What matters to you</th><th scope="col">DCM</th><th scope="col">PSA Standard · announced</th></tr></thead><tbody>
            {[
              ['Your card', 'Stays with you; front-and-back photos required', 'Physical submission required'],
              ['Price', '$2.99 for one credit; one-time packs and optional membership available', '$59.99 per card; opens September 14'],
              ['Timing', 'Usually about a minute for a digital analysis', 'Estimated 90–100 business days, plus shipping'],
              ['Condition evidence', 'Centering, corners, edges and surface subgrades with written analysis', 'PSA grade and certification; four subgrades are not printed on the standard label'],
              ['Value thresholds', 'No card-value-based pricing bands', '$1,000 maximum insured value per card on Standard'],
              ['Output', 'Digital report, customizable printable labels and collection tools', 'Physical authentication, grading and sealed holder'],
              ['Shipping', 'No shipping for the assessment', 'Shipping and applicable charges are additional'],
            ].map(([feature,dcm,psa]) => <tr key={feature}><th scope="row">{feature}</th><td>{dcm}</td><td>{psa}</td></tr>)}
          </tbody></table></div>
          <p className={styles.note}>DCM uses its own published standard. A DCM assessment is not PSA certification or a substitute for physical authentication. <Link href="/grading-limitations">Understand photo-based grading limitations</Link>. <a href={PSA_SOURCE} target="_blank" rel="noopener noreferrer">PSA source, September 9, 2026 ↗</a></p>
        </section>
        <section className={styles.section}>
          <p className="dcm-eyebrow">Start with two cards</p><h2>Choose a plan when you’re ready for more.</h2>
          <div className={styles.grid}>
            <article className={styles.tile}><h3>Try DCM</h3><strong>2 free credits</strong><p>Experience your own card report. No payment card required and no automatic subscription.</p><Link className={styles.primary} style={{color:'white'}} href={signup}>Create Your Free Account</Link></article>
            <article className={styles.tile}><h3>Grade a batch</h3><strong>One-time packs</strong><p>Start with one credit for $2.99, or choose a larger pack. Unused credits never expire.</p><Link href="/credits">Compare All Pricing →</Link></article>
            <article className={styles.tile}><h3>Card Lovers</h3><strong>${CARD_LOVERS_PLANS.monthly.price}/month</strong><p>{CARD_LOVERS_PLANS.monthly.credits} credits each month, member savings and a heart emblem. Or ${CARD_LOVERS_PLANS.annual.price}/year for {CARD_LOVERS_PLANS.annual.totalCredits} credits upfront, about $0.50 per included grade.</p><Link href="/card-lovers">Explore Membership →</Link></article>
          </div>
          <p className={styles.note}>Prices in USD before applicable taxes. Card Lovers is recurring; annual is billed $449/year. Signup credits are separate from eligible pack bonuses. Basic reports, labels and collection tools do not require membership.</p>
        </section>
        <section className={`${styles.section} ${styles.faq}`}><p className="dcm-eyebrow">Your questions, answered</p><h2>Choosing a PSA alternative.</h2>{faqs.map(f => <article key={f.q}><h3>{f.q}</h3><p>{f.a}</p></article>)}</section>
        <section className={styles.section}><h2>Take a closer look.</h2><div className={styles.related}>{[
          ['All grading companies','/card-grading-companies'],['Cheapest card grading','/cheapest-card-grading'],['Fastest card grading','/fastest-card-grading'],['AI grading accuracy','/ai-card-grading-accuracy'],['Published grading standard','/grading-standard'],['Public population report','/pop'],['Everything DCM can do','/why-dcm'],['How it works','/get-started'],['Portfolio tools','/market-pricing'],
        ].map(([label,href]) => <Link className={styles.secondary} key={href} href={href}>{label} →</Link>)}</div></section>
      </div>
    </MarketingShowcaseBoundary>
    <section className={styles.closing}><h2>Your next card deserves a closer look.</h2><p>Start with two free credits. See the condition, explore the report and decide what comes next.</p><div className={styles.actions}><Link className={styles.primary} href={signup}>Grade 2 Cards Free →</Link><Link className={styles.secondary} href="/credits">Compare Plans</Link></div></section>
  </div>
}
