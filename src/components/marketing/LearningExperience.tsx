'use client'

import { useServerShowcase } from '@/components/design/ShowcaseProvider'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ActionLink, Icon, SectionHeading } from '@/components/design/Primitives'
import { HeritageCard } from '@/components/design/HeritageCard'
import { showcaseHref, showcaseSubgrade, type ShowcaseCard } from '@/components/design/featuredCard'
import { LEARNING_CARD_IDS } from '@/lib/cards/marketingShowcase'
import { RelatedGuides } from '@/components/design/RelatedGuides'
import { resolveGradeChip } from '@/lib/labelPresets'

type PageKind = 'get-started' | 'ai-card-grading'
type Faq = { question: string; answer: string }
const dimensions = [
  ['centering', 'The balance of the borders and printed design, on both sides.'],
  ['corners', 'Each corner’s shape and any visible rounding, whitening or damage.'],
  ['edges', 'The perimeter of the card, including chips, wear and rough cuts.'],
  ['surface', 'Visible scratches, print defects, dents and other surface marks.'],
] as const

function CardExample({ card }: { card?: ShowcaseCard }) {
  if (!card) return <div className="dcm-learning-card-placeholder"><Icon name="label" /><p>Explore graded cards and their Heritage labels.</p><ActionLink href="/featured" variant="text">View Featured Cards</ActionLink></div>
  return <figure className="dcm-learning-example">
    <Link href={showcaseHref(card)} aria-label={`View ${card.card_name} report`}><HeritageCard card={card} /></Link>
    <figcaption>{card.card_name}<Link href={showcaseHref(card)}>View condition report →</Link></figcaption>
  </figure>
}

export default function LearningExperience({ kind, faqs }: { kind: PageKind; faqs?: Faq[] }) {
  const optic = kind === 'ai-card-grading'
  const initial = useServerShowcase(kind)
  const [cards, setCards] = useState<ShowcaseCard[]>(() => initial ?? [])
  const [selected, setSelected] = useState(0)
  useEffect(() => {
    if (initial?.length) return
    const controller = new AbortController()
    setCards([])
    fetch(`/api/cards/featured?showcase=${kind}&limit=3`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Card examples unavailable'); return r.json() })
      .then(data => {
        const pool: ShowcaseCard[] = Array.isArray(data.cards) ? data.cards : []
        setCards(LEARNING_CARD_IDS[kind].flatMap(id => {
          const card = pool.find(card => card.id === id && card.front_url)
          return card ? [card] : []
        }))
      }).catch(() => {})
    return () => controller.abort()
  }, [kind, initial])
  const active = cards[selected % Math.max(1, cards.length)]
  const questions = faqs ?? [
    { question: 'What do I need to get started?', answer: 'Create an account, choose your card category, and upload clear photos of the front and back. New accounts receive two free grading credits.' },
    { question: 'Do I send my cards to DCM?', answer: 'No. Grading is based on your uploaded photos. Your physical cards stay with you.' },
    { question: 'How long does grading take?', answer: 'Results typically arrive in about a minute. Processing time can vary with image uploads and demand.' },
    { question: 'Can I print a label for my card?', answer: 'Yes. Open your graded card to access label and report options. Explore Label Studio for available designs and customization.' },
    { question: 'Will another grading company assign the same grade?', answer: 'DCM uses its own published grading standard. A DCM result does not guarantee the grade another company will assign during a physical inspection.' },
  ]

  return <div className="dcm-brand dcm-learning">
    <section aria-labelledby="dcm-learning-hero-title" className={`dcm-learning-hero ${optic ? 'dcm-learning-hero--optic' : ''}`}>
      <div className="dcm-container dcm-learning-split">
        <div>
          <p className="dcm-eyebrow">{optic ? 'DCM Optic™ · AI card grading' : 'How it works'}</p>
          <h1 id="dcm-learning-hero-title">{optic ? <>Understand the condition.<br /><em>See the evidence.</em></> : <>Grade your first card.<br /><em>Start with two photos.</em></>}</h1>
          <p className="dcm-lead">{optic ? 'Centering, corners, edges and surface. DCM Optic brings the details together in a grade and written condition report, using photos of the card you actually own.' : 'From your first upload to a Heritage label of your own. Get a card grade and detailed condition analysis in about a minute, with your cards right where they belong, with you.'}</p>
          <div className="dcm-actions"><ActionLink href="/upload">Grade Your Card</ActionLink><ActionLink href={optic ? '/grading-rubric' : '#your-first-grade'} variant="secondary">{optic ? 'Read the Grading Rubric' : 'See the Steps'}</ActionLink></div>
          <p className="dcm-fineprint">New to DCM? <Link href="/login?mode=signup">Create an account and get 2 free grades.</Link></p>
        </div>
        <div className="dcm-learning-hero-card"><CardExample card={cards[0]} /></div>
      </div>
    </section>

    <div role="navigation" className="dcm-learning-jump" aria-label="On this page"><div className="dcm-container">
      <Link href="#your-first-grade">{optic ? 'The analysis' : 'The steps'}</Link><Link href="#card-details">{optic ? 'Explore subgrades' : 'Photo tips'}</Link><Link href="#your-results">{optic ? 'Your report' : 'Your results'}</Link><Link href="#questions">Questions</Link>
    </div></div>

    <section id="your-first-grade" className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow={optic ? 'A closer look, from both sides' : 'Start with the card in your hands'} title={optic ? 'Multiple evaluations. One condition report.' : 'Three steps to your first grade.'} />
      <div className="dcm-learning-steps">{(optic ? [
        ['01', 'Three independent passes', 'DCM Optic evaluates the photos in three passes and compares the results to reduce the influence of a single outlier.'],
        ['02', 'A detailed inspection', 'Magnified regions support a closer examination of corners, edges and surface. Photo quality helps determine how much detail can be assessed.'],
        ['03', 'A grade you can explore', 'Open the subgrades and written analysis to understand the condition factors behind the final result.'],
      ] : [
        ['01', 'Choose your card category', 'Sign in and select sports, Pokémon or another supported card type. Your first two grading credits are included with a new account.'],
        ['02', 'Upload front and back', 'Take two clear photos of the same card. Follow the capture guidance and review your images before submitting.'],
        ['03', 'Open your grade and report', 'Review the overall grade, four subgrades and written condition notes. Your graded card is saved to your collection.'],
      ]).map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </div></section>

    <section id="card-details" className="dcm-section dcm-learning-tint"><div className="dcm-container dcm-learning-split">
      <div className="dcm-learning-secondary-card"><CardExample card={optic ? active : cards[1]} /></div>
      <div>
        <SectionHeading eyebrow={optic ? 'Explore an actual graded card' : 'Before you upload'} title={optic ? 'Four parts of the condition.' : 'Better photos. More visible detail.'} />
        {optic ? <>
          <div className="dcm-learning-tabs" role="group" aria-label="Choose a card for subgrades">{cards.map((card, i) => <button type="button" key={card.id} aria-pressed={selected === i} onClick={() => setSelected(i)}>{card.card_name}</button>)}</div>
          <dl className="dcm-learning-subgrades">{dimensions.map(([key, description]) => {
            const score = active ? showcaseSubgrade(active, key) : null
            return <div key={key}><dt>{key}<p>{description}</p></dt><dd><strong>{score ?? '—'}<small>/10</small></strong><span className="dcm-learning-meter"><span style={{ width: score === null ? 0 : `${score * 10}%`, background: resolveGradeChip(score, true).ink }} /></span></dd></div>
          })}</dl>
          <p className="dcm-fineprint">Subgrades shown are from the selected card’s recorded report.</p>
        </> : <ul className="dcm-learning-checks">
          <li><Icon name="check" /><span><strong>Keep all four corners in view.</strong> Leave a small margin around the entire card.</span></li>
          <li><Icon name="check" /><span><strong>Use even, indirect light.</strong> Avoid glare, shadows and reflections across the artwork.</span></li>
          <li><Icon name="check" /><span><strong>Hold the camera parallel.</strong> Keep the card flat, sharp and in focus.</span></li>
          <li><Icon name="check" /><span><strong>Check both photos.</strong> Confirm the front and back belong to the same card.</span></li>
        </ul>}
        <ActionLink href={optic ? '/grading-standard' : '/upload'} variant="text">{optic ? 'Explore the Grading Standard' : 'Start Your Upload'} <Icon name="arrow" /></ActionLink>
      </div>
    </div></section>

    <section id="your-results" className="dcm-section"><div className="dcm-container dcm-learning-split">
      <div><SectionHeading eyebrow="Make the grade yours" title={optic ? 'The detail belongs beside the grade.' : 'A report to read. A label to keep.'}>
        Your card’s grade, condition label and serial number stay connected to its report. Heritage labels bring those details into a display you can share.
      </SectionHeading>
        <div className="dcm-learning-result-links">
          <Link href="/reports-and-labels"><Icon name="report" /><span><strong>Read the condition report</strong>See the subgrades and written analysis.</span><Icon name="arrow" /></Link>
          <Link href="/labels"><Icon name="label" /><span><strong>Create your label</strong>Explore printable and digital label designs.</span><Icon name="arrow" /></Link>
          <Link href="/collection"><Icon name="collection" /><span><strong>Build your collection</strong>Keep your cards and grading results together.</span><Icon name="arrow" /></Link>
        </div>
      </div><div className="dcm-learning-secondary-card"><CardExample card={cards[2]} /></div>
    </div></section>

    <section className="dcm-section dcm-learning-tint"><div className="dcm-container dcm-learning-note">
      <Icon name="scan" /><div><h2>{optic ? 'Photo quality is part of the picture.' : 'Know what a photo-based grade can tell you.'}</h2><p>DCM evaluates the detail visible in your photos. Reflections, blur and hidden defects can affect the assessment. Review the report’s image confidence alongside the grade. DCM follows its own grading standard; results do not guarantee a matching grade from another service.</p><ActionLink href="/grading-limitations" variant="text">Understand Grading Limitations <Icon name="arrow" /></ActionLink></div>
    </div></section>

    <RelatedGuides />
    <section id="questions" className="dcm-section"><div className="dcm-container dcm-learning-faq"><SectionHeading eyebrow="Before you begin" title="A few things to know." />{questions.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
    <section className="dcm-section dcm-learning-cta"><div className="dcm-container"><SectionHeading title="Give your next card a closer look.">Start with two free grades, then choose the credit package or membership that fits your collection.</SectionHeading><div className="dcm-actions"><ActionLink href="/login?mode=signup">Grade 2 Cards Free</ActionLink><ActionLink href="/credits" variant="secondary">Explore Pricing</ActionLink><ActionLink href={optic ? '/get-started' : '/ai-card-grading'} variant="text">{optic ? 'How to Get Started' : 'How DCM Optic Works'}</ActionLink></div></div></section>
  </div>
}
