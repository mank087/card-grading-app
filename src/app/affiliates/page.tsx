import { completeMetadata } from '@/lib/seo/completeMetadata'
import Image from 'next/image'
import Link from 'next/link'
import AffiliateApplicationForm from '@/components/affiliates/AffiliateApplicationForm'
import styles from './affiliates.module.css'

export const metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/affiliates' },
  title: { absolute: 'Affiliate Program | DCM Grading' },
  description: 'Earn 20 grading credits for every new customer who makes a first paid purchase through your referral link or code. Your audience gets 15% off.',
})

const questions = [
  ['Who can apply?', 'Creators, breakers, card shops, and collecting communities can apply. Tell us where you share, who your audience is, and how you would introduce them to DCM Grading. Every application is reviewed.'],
  ['Do I need a DCM Grading account?', 'Yes. Use the email associated with your DCM Grading account when you apply so we can credit your rewards to the right account.'],
  ['What counts as a qualifying referral?', 'A new customer must make their first paid purchase on dcmgrading.com through your referral link or code. Free grades do not count. Rewards are granted once per new customer. Direct your audience to the website: purchases inside the iOS app cannot use codes or be tracked.'],
  ['When do I receive my credits?', 'Your 20 grading credits are added automatically when a referred new customer completes their first qualifying paid purchase. Credits never expire. If that purchase is refunded, the referral credits are removed.'],
  ['What if someone buys later?', 'Referral links are tracked for 30 days, so a qualifying purchase during that window can still earn you credits. Your audience can also enter your code at checkout on dcmgrading.com.'],
  ['Can the discount be combined with member pricing?', 'No. The 15% discount applies to the first purchase at list price and cannot be combined with Card Lovers or Founder member pricing.'],
  ['Are the rewards cash payments?', 'Rewards are DCM grading credits. One credit covers one card grade or re-grade, so each qualifying referral earns enough credits for 20 card grades.'],
]

// Single source for the FAQ: the visible <details> list and the FAQPage
// JSON-LD below are both built from `questions`, so they cannot drift.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map(([question, answer]) => ({
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
    { '@type': 'ListItem', position: 2, name: 'Affiliate Program', item: 'https://dcmgrading.com/affiliates' },
  ],
}

export default function AffiliatesPage() {
  return (
    <div className={`dcm-brand ${styles.page}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />
      <section className={`dcm-dark ${styles.hero}`}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <p className="dcm-eyebrow">DCM Grading Partner Program</p>
            <h1>Share DCM.<br /><span>Grade more of<br className={styles.desktopBreak} /> your collection.</span></h1>
            <p className={styles.heroLead}>Earn 20 grading credits for every new customer who makes their first paid purchase through your referral link or code. Your audience gets 15% off their first purchase.</p>
            <div className="dcm-actions">
              <Link href="#apply" className="dcm-button dcm-button--primary">Apply to Become a Partner <span aria-hidden="true">→</span></Link>
              <Link href="#how-it-works" className="dcm-button dcm-button--secondary">How It Works</Link>
            </div>
            <p className="dcm-fineprint">Applications reviewed within a few business days.</p>
          </div>
          <div className={styles.offer}>
            <p className={styles.offerHeading}>A reward for you. A reason to try for them.</p>
            <div className={styles.reward}>
              <p>You get</p><strong>20<span>grading credits</span></strong>
              <p>Enough for 20 card grades.<br />For every qualifying new customer.</p>
            </div>
            <div className={styles.discount}>
              <p>Your audience saves</p><strong>15%<span>off their first purchase</span></strong>
              <p>With your personal link or code.</p>
            </div>
            <p className={styles.offerNote}>Qualifying paid purchases on dcmgrading.com.<br />First purchase at list price. Member discounts do not stack.</p>
          </div>
        </div>
      </section>

      <section className={styles.example} aria-labelledby="reward-heading">
        <div className={`${styles.container} ${styles.exampleGrid}`}>
          <div><p className="dcm-eyebrow">Put your rewards to use</p><h2 id="reward-heading">Your next batch, covered.</h2><p>Use your credits to grade more of your own collection. One credit covers one card grade or re-grade. Credits never expire.</p></div>
          <div className={styles.equation}><div><strong>5</strong><span>qualifying new customers</span></div><span aria-hidden="true">→</span><div><strong>100</strong><span>grading credits earned</span></div><p>Example: 5 qualifying referrals × 20 credits each.</p></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.container} ${styles.proofGrid}`}>
          <figure className={styles.report}>
            <a href="/DCM-full-downloadable-report.png" target="_blank" rel="noreferrer" aria-label="Open the full example DCM grading report in a new tab">
              <Image src="/DCM-full-downloadable-report.png" alt="Example DCM Umbreon ex grading report with front and back photos, overall grade, and centering, corner, edge, and surface assessments" width={771} height={835} sizes="(max-width: 760px) 85vw, 440px" />
            </a>
            <figcaption>Real report example · Select to view full size</figcaption>
          </figure>
          <div><p className="dcm-eyebrow">Something worth sharing</p><h2>Show them what a closer look can reveal.</h2><p className="dcm-lead">Introduce your audience to DCM Optic™ grading: card photos become a grade and a detailed condition report, with the cards staying in their collection.</p>
            <ul className={styles.proofList}>
              <li><strong>The details behind the grade</strong><p>Centering, corners, edges, and surface assessments give collectors more to explore.</p></li>
              <li><strong>A result they can share</strong><p>Downloadable reports and customizable labels help collectors present their cards.</p></li>
              <li><strong>A reason to get started</strong><p>Your code gives new customers 15% off their first purchase at list price.</p></li>
            </ul>
            <Link href="/reports-and-labels" className="dcm-button dcm-button--text">Explore Reports &amp; Labels <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={`${styles.section} ${styles.tint}`}>
        <div className={styles.container}>
          <p className="dcm-eyebrow">From application to first reward</p><h2>Make the introduction. We track the rest.</h2>
          <ol className={styles.steps}>
            {[
              ['Apply', 'Tell us about your audience and how you would share DCM. Use the email on your DCM Grading account.'],
              ['Get approved. Get your code.', 'Approved partners receive a personal referral link and code to share with their audience.'],
              ['Share and earn', 'They save 15% on their first qualifying purchase. You receive 20 credits automatically for each new customer who buys.'],
            ].map(([title, copy], i) => <li key={title}><span className={styles.stepNumber}>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}
          </ol>
          <div className={styles.benefits}>
            <div><h3>Share a link or say your code on camera</h3><p>Use whichever fits your content. Your audience can follow the link or enter your code at web checkout.</p></div>
            <div><h3>Give them time to decide</h3><p>Referral links are tracked for 30 days, so a qualifying purchase later in that window still counts.</p></div>
            <div><h3>See what your sharing earns</h3><p>Find your clicks, referrals, and earned credits on your DCM Grading account page.</p></div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <p className="dcm-eyebrow">Made for the collecting community</p><h2>Your audience. Your way to share.</h2>
          <div className={styles.audiences}>
            {[
              ['Creators & breakers', 'Walk through a grading report in a video, or grade a pull after a pack opening. Share your link in the description and your code on camera.'],
              ['Card shops & show sellers', 'Show a customer how DCM helps document card condition, then share your code so they can try it on their own collection.'],
              ['Collecting communities', 'Share a grading walkthrough with your group, newsletter, or podcast audience and include your referral link.'],
            ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
          <p className={styles.disclosure}>When sharing, disclose that you are a DCM Grading partner.</p>
          <Link href="#apply" className="dcm-button dcm-button--primary">Apply to Become a Partner <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className={`${styles.section} ${styles.tint}`}>
        <div className={`${styles.container} ${styles.faqGrid}`}>
          <div><p className="dcm-eyebrow">Before you join</p><h2>A few things to know.</h2><p className="dcm-lead">Clear rewards. A simple way to share.</p></div>
          <div className={styles.faq}>
            {questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            <details id="program-terms"><summary>Full program terms</summary><ul>
              <li>A new customer is someone making their first paid purchase on dcmgrading.com. Free grades do not count, and purchases made inside the iOS app cannot use codes or be tracked.</li>
              <li>The 15% discount applies to a first purchase at list price. It cannot be combined with Card Lovers or Founder member pricing.</li>
              <li>You earn 20 grading credits once per new customer, credited to the DCM Grading account that matches the email on your application. Credits never expire.</li>
              <li>If a referred purchase is refunded, the credits for that referral are removed.</li>
              <li>Referring yourself, your own accounts, or accounts you control is not rewarded. Codes may be paused for misuse.</li>
              <li>When you share your link or code, disclose that you are a DCM Grading partner as required by the FTC and your platform.</li>
            </ul></details>
          </div>
        </div>
      </section>

      <section id="apply" className={styles.section}>
        <div className={`${styles.container} ${styles.applyGrid}`}>
          <div><p className="dcm-eyebrow">Let’s grow the hobby together</p><h2>Ready to share DCM?</h2><p className="dcm-lead">Tell us about your audience. Approved partners get their own link and code, plus 20 grading credits for every qualifying new customer.</p>
            <div className={styles.next}><h3>What happens next</h3><p>We review your application and reply within a few business days. If approved, you’ll receive your referral details so you can start sharing.</p></div>
            <p className={styles.disclosure}>Have your DCM account email ready. <Link href="/login?mode=signup&redirect=/affiliates">Create an account</Link> if you need one.</p>
          </div>
          <AffiliateApplicationForm />
        </div>
      </section>
    </div>
  )
}
