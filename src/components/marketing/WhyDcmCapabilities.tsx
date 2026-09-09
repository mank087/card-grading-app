'use client'

import { useServerShowcase } from '@/components/design/ShowcaseProvider'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ActionLink, SectionHeading } from '@/components/design/Primitives'
import { HeritageCard } from '@/components/design/HeritageCard'
import { showcaseHref, type ShowcaseCard } from '@/components/design/featuredCard'
import CategoryBreakdownChart from '@/components/market-pricing/CategoryBreakdownChart'
import GradeDistributionChart from '@/components/market-pricing/GradeDistributionChart'

const exampleCategories = [
  { category: 'Pokemon', count: 42, value: 3840.50, percentage: 38.2 },
  { category: 'Sports', count: 28, value: 2950, percentage: 29.3 },
  { category: 'MTG', count: 18, value: 1620.75, percentage: 16.1 },
  { category: 'Lorcana', count: 12, value: 980.25, percentage: 9.7 },
  { category: 'One Piece', count: 8, value: 670, percentage: 6.7 },
]
const exampleGrades = [{ grade: '10', count: 8 }, { grade: '9', count: 36 }, { grade: '8', count: 33 }, { grade: '7', count: 18 }, { grade: '6', count: 13 }]

function Features({ items }: { items: [string, string][] }) {
  return <dl className="dcm-why-feature-list">{items.map(([title, copy]) => <div key={title}><dt>{title}</dt><dd>{copy}</dd></div>)}</dl>
}

export default function WhyDcmCapabilities() {
  const initial = useServerShowcase('why-dcm')
  const [cards, setCards] = useState<ShowcaseCard[]>(() => initial ?? [])
  useEffect(() => {
    if (initial?.length) return
    const controller = new AbortController()
    fetch('/api/cards/featured?showcase=why-dcm&limit=3', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then(data => setCards(Array.isArray(data.cards) ? data.cards : []))
      .catch(() => {})
    return () => controller.abort()
  }, [initial])
  const cardExample = (id: string) => {
    const card = cards.find(card => card.id === id && card.front_url)
    return card ? <figure className="dcm-why-detail-card"><Link href={showcaseHref(card)} aria-label={`View ${card.card_name} report`}><HeritageCard card={card} /></Link><figcaption>{card.card_name} · Actual DCM grade and Heritage label<br /><Link href={showcaseHref(card)}>Read this card’s report →</Link></figcaption></figure> : <ActionLink href="/featured" variant="secondary">Explore real card reports</ActionLink>
  }
  return <>
    <section id="grading" className="dcm-section dcm-surface"><div className="dcm-container dcm-why-detail-grid">
      <div><SectionHeading eyebrow="01 / Identify & grade" title="Understand the card. Then its condition.">DCM identifies the card and evaluates the front and back with DCM Optic. The report connects a whole-number grade to the details visible in your photos.</SectionHeading>
        <Features items={[
          ['Card identification', 'Identify the card name, set, number and relevant variant details. Supported card databases help distinguish cards across sports and major trading card games.'],
          ['Centering', 'Assess the balance of the printed borders and alignment on the front and back.'],
          ['Corners & edges', 'Review corner wear, whitening, edge damage and other visible condition issues.'],
          ['Surface', 'Look for visible scratches, print issues, creases and surface wear. Photo clarity and glare affect what can be assessed.'],
          ['A grade with an explanation', 'The final grade follows DCM’s published standard, with centering, corners, edges and surface subgrades and supporting findings.'],
        ]} /><div className="dcm-actions"><ActionLink href="/ai-card-grading">How DCM Optic works</ActionLink><ActionLink href="/grading-standard" variant="text">Read the standard →</ActionLink></div>
      </div>{cardExample('5a04d45d-9bdc-4b60-a9bd-230bba2b6d1f')}
    </div></section>
    <section id="reports" className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="02 / Review the evidence" title="A full report behind every grade.">Open your card details to understand the result, review the images and choose how to keep or share the assessment.</SectionHeading>
      <div className="dcm-why-detail-grid"><Features items={[
        ['Grade, condition and subgrades', 'See the overall grade and condition label alongside the four condition scores.'],
        ['Defect analysis & photo evidence', 'Read the findings and inspect the supporting images to understand which details affected the grade.'],
        ['Image confidence', 'Review the report’s confidence information and any limits caused by the supplied photographs.'],
        ['Market context', 'See available market estimates alongside the condition assessment. Estimates provide context and are not guaranteed sale prices.'],
        ['Public verification', 'Share a public report or serial number so another collector can review the recorded assessment. Your card’s visibility settings control public access.'],
      ]} /><figure className="dcm-why-report-preview"><Image src="/DCM-full-downloadable-report.png" alt="Example of DCM’s downloadable full grading report" width={900} height={1200} className="w-full h-auto" /><figcaption>Example downloadable report layout</figcaption></figure></div>
      <div className="dcm-why-plans"><article><h3>Interactive card report</h3><p>Revisit the original card photos, condition findings and grading details from your collection.</p></article><article><h3>Full report PDF</h3><p>Download a printable record of the card’s assessment to store or include with your card.</p></article><article><h3>Mini report</h3><p>Use a compact summary with the grade, serial and QR code for a display, top loader insert or listing image.</p></article></div>
      <ActionLink href="/reports-and-labels">Explore reports and labels</ActionLink>
    </div></section>
    <section id="portfolio" className="dcm-section dcm-surface"><div className="dcm-container">
      <SectionHeading eyebrow="03 / Manage your collection" title="See the collection behind the cards.">Your portfolio brings graded cards and available market pricing together, with breakdowns that help you understand what you own and where its value sits.</SectionHeading>
      <div className="dcm-why-detail-grid"><div><Features items={[
        ['Collection value & individual estimates', 'Review available card values and your portfolio total. See which cards have pricing available and which still need a market estimate.'],
        ['Category, grade & value breakdowns', 'Explore the mix of sports and trading card games, how grades are distributed, and the spread of card values.'],
        ['Most valuable cards & top sets', 'See which cards and sets contribute the most value to your collection.'],
        ['Grade and value relationships', 'Compare value by grade, grade versus value, and value changes since grading.'],
        ['Pricing sources', 'Review available pricing from sources such as PriceCharting, eBay and Scryfall, with the source information shown in the portfolio.'],
      ]} /><ActionLink href="/market-pricing">Explore Portfolio</ActionLink></div>
      <div className="dcm-why-chart-preview"><p className="dcm-eyebrow">Illustrative portfolio · sample data</p><h3>Collection value by category</h3><CategoryBreakdownChart data={exampleCategories} /><h3>Grade distribution</h3><GradeDistributionChart data={exampleGrades} /><p className="dcm-fineprint">Example data shown. Sign in to explore the values and grade distribution of your own collection.</p></div></div>
      <div className="dcm-why-note"><h3>Your collection stays connected.</h3><p>Open a card from your collection to revisit its report, download labels or prepare it for sale. Grading records, card images and collection tools stay together.</p><ActionLink href="/collection" variant="text">Open My Collection →</ActionLink></div>
    </div></section>
    <section id="labels" className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="04 / Design & display" title="Your label, your way.">Choose both the design of your grading label and the format that fits your holder. Heritage is the site’s default, with Modern and Traditional styles also available in Label Studio.</SectionHeading>
      <div className="dcm-why-detail-grid"><div><Features items={[
        ['Heritage', 'An ivory field, patterned color band and grade-colored chip. Match the band to your card or customize its palette; Gem Mint 10 uses the rainbow-outline treatment.'],
        ['Modern', 'A dark label style with color and gradient controls for a different presentation.'],
        ['Traditional', 'A classic light label style that keeps card identity and grading information easy to read.'],
        ['Customize and preview', 'Choose a format, adjust the available style controls and preview the front and back before downloading.'],
        ['Member badges', 'Eligible VIP and Card Lovers badges bring your membership identity onto supported grading labels.'],
      ]} /><div className="dcm-actions"><ActionLink href="/labels">Open Label Studio</ActionLink><ActionLink href="/labels/classic" variant="text">Classic Studio →</ActionLink></div></div>{cardExample('4b4de275-88f7-4846-9542-0064cee74d2d')}</div>
      <div className="dcm-why-plans">{[
        ['Graded slab', '/labels/graded-card-slab.png', 'Front and back labels for compatible grading slab cases. Keep the card identity, grade and verification details together.'],
        ['Magnetic one-touch', '/labels/mag-one-touch-DCM.png', 'A fold-over label for magnetic holders. Avery 6871 is the recommended template for the supported foldable label format.'],
        ['Top loader', '/labels/top-loader-dcm.png', 'Compact label options for top loaders, including supported front/back and fold-over formats.'],
      ].map(([name, image, copy]) => <article key={name}><Image src={image} alt={`${name} holder and label format example`} width={320} height={400} className="dcm-why-holder" /><h3>{name}</h3><p>{copy}</p></article>)}</div>
      <div className="dcm-why-note"><h3>Digital display and print-ready downloads.</h3><p>Create a graded card image for sharing online, or download your chosen label format to print. Report and label downloads are available to the account that graded the card. Match the template’s print size to your holder before applying it.</p><div className="dcm-actions"><ActionLink href="/reports-and-labels" variant="text">Compare all formats →</ActionLink><ActionLink href="/shop" variant="text">Find holders and supplies →</ActionLink></div></div>
    </div></section>
    <section id="instalist" className="dcm-section dcm-surface"><div className="dcm-container">
      <SectionHeading eyebrow="05 / Share & sell" title="From graded card to eBay listing.">InstaList uses your card’s identification, images and grading report to prepare a listing, so you can give buyers the condition details you already have.</SectionHeading>
      <div className="dcm-why-detail-grid"><div><Features items={[
        ['A prepared title and description', 'Build the listing from the card’s details, with a formatted description that includes the DCM grading breakdown.'],
        ['Images built from your card', 'Use labeled front and back images, raw front and back photos, and a mini report to show the card and its assessment.'],
        ['Condition and item specifics', 'Carry relevant grading and card information into eBay’s listing fields. Review the details before publishing.'],
        ['Your sale format and price', 'Choose a supported fixed-price or auction format and set the terms of your sale.'],
        ['Shipping options', 'Use the shipping tools to configure supported domestic and international delivery options.'],
      ]} /><ActionLink href="/instalist-marketplace">Explore eBay InstaList</ActionLink></div><figure className="dcm-why-listing-preview"><Image src="/eBay-Instalist-Marketplace/ebay-instalist-dcm-1.png" alt="Example eBay listing created for a DCM graded card" width={1100} height={900} className="w-full h-auto mb-4" /><Image src="/eBay-Instalist-Marketplace/ebay-instalist-dcm-3.png" alt="Example DCM condition report included in an eBay listing description" width={1100} height={1400} className="w-full h-auto" /><figcaption>Existing listing example: the DCM condition breakdown presented to buyers.</figcaption></figure></div>
      <ol className="dcm-why-process"><li><strong>1. Choose your card</strong><span>Start from a graded card in your collection.</span></li><li><strong>2. Prepare the listing</strong><span>Connect eBay and review the generated card details and images.</span></li><li><strong>3. Set the sale terms</strong><span>Choose price, format and shipping before publishing.</span></li></ol>
    </div></section>
    <section id="explore" className="dcm-section"><div className="dcm-container">
      <SectionHeading eyebrow="06 / Keep exploring" title="Tools for the way you collect.">From identifying your next card to comparing grades across the community, DCM connects the wider collecting workflow.</SectionHeading>
      <div className="dcm-why-plans"><article><h3>Card databases</h3><p>Browse supported sets and cards across Pokémon, Magic: The Gathering, Lorcana, One Piece, Yu-Gi-Oh!, Star Wars and sports.</p><div className="dcm-actions"><ActionLink href="/pokemon-database" variant="text">Pokémon →</ActionLink><ActionLink href="/sports-database" variant="text">Sports →</ActionLink><ActionLink href="/mtg-database" variant="text">MTG →</ActionLink></div></article><article><h3>Population Report</h3><p>Explore how many cards DCM has graded and how those grades are distributed by category and individual card.</p><ActionLink href="/pop" variant="text">Browse population data →</ActionLink></article><article><h3>Featured Cards</h3><p>Look through public graded cards, compare condition reports and see Heritage labels rendered with real card information.</p><ActionLink href="/featured" variant="text">Explore the showcase →</ActionLink></article></div>
    </div></section>
    <section id="walkthrough" className="dcm-section dcm-surface"><div className="dcm-container"><SectionHeading eyebrow="See the workflow" title="Follow a card from photo to finished label.">Watch the grading walkthrough, then use the getting-started guide to prepare your own photos.</SectionHeading><div className="dcm-why-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/oSz9lfvaEK4?rel=0" title="DCM Grading: Full Process Walkthrough" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><ActionLink href="/get-started">Get started with your first card</ActionLink></div></section>
  </>
}
