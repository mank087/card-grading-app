import Link from 'next/link'
import Image from 'next/image'
import { ActionLink, Icon, SectionHeading } from '@/components/design/Primitives'
import { ReferenceCardShowcase } from '@/components/design/ReferenceCardShowcase'

const formats = [
  { name: 'Graded card slab image', type: 'Digital display', description: 'Bring your card photo and grading label together in one image for your collection, social posts or marketplace listings.', use: 'Sharing your graded card online.', icon: 'collection' as const },
  { name: 'Foldable slab label', type: 'Magnetic one-touch', description: 'A fold-over label for a magnetic one-touch holder. The Heritage design carries the grade on the front, with subgrades and a QR code on the back.', use: 'Displaying a card in a magnetic holder. Avery 6871 is the recommended label template.', icon: 'label' as const },
  { name: 'Top loader label', type: 'Physical display', description: 'A compact label that keeps the card’s grade and identifying details visible with its top loader.', use: 'Organizing, displaying and sharing cards in top loaders.', icon: 'label' as const },
  { name: 'Full grading report', type: 'One-page PDF', description: 'A fuller record of the card, its grade and condition analysis, with images and grading details in a printable document.', use: 'Keeping a record of the assessment or including the report with a card.', icon: 'report' as const },
  { name: 'Mini report', type: 'Compact report', description: 'The essential grade, serial number and QR code in a smaller format that can be displayed beside a card or shared as an image.', use: 'A folding display stand, a top loader insert or an online listing image.', icon: 'report' as const },
]

export default function ReportsExperience() {
  return <div className="dcm-brand dcm-reference-page">
    <section className="dcm-learning-hero dcm-learning-hero--optic"><div className="dcm-container dcm-learning-split">
      <div><p className="dcm-eyebrow">Reports & labels</p><h1>Card reports &amp; labels.<br /><em>Condition made visible.</em></h1><p className="dcm-lead">A Heritage label for your display. A report with the details behind the grade. Choose the format that fits how you collect, share and sell.</p><div className="dcm-actions"><ActionLink href="/labels">Open Label Studio</ActionLink><ActionLink href="#formats" variant="secondary">Compare Formats</ActionLink></div><p className="dcm-fineprint">Already graded a card? <Link href="/collection">Open it from your collection.</Link></p></div>
      <ReferenceCardShowcase page="reports-and-labels" />
    </div></section>

    <div role="navigation" className="dcm-learning-jump" aria-label="On this page"><div className="dcm-container"><Link href="#formats">Choose a format</Link><Link href="#customize">Customize your label</Link><Link href="#reports">Report examples</Link><Link href="#download">Download & print</Link></div></div>

    <section id="formats" className="dcm-section"><div className="dcm-container"><SectionHeading eyebrow="A format for every use" title="Display it. Share it. Keep the details.">Start with what you want to do with your card.</SectionHeading>
      <div className="dcm-format-grid">{formats.map(format => <article key={format.name}><Icon name={format.icon} /><p className="dcm-eyebrow">{format.type}</p><h3>{format.name}</h3><p>{format.description}</p><div><strong>Best for</strong><p>{format.use}</p></div></article>)}</div>
      <p className="dcm-fineprint">Digital slab images and printed labels are display formats; they do not physically encapsulate your card.</p>
    </div></section>

    <section id="customize" className="dcm-section dcm-learning-tint"><div className="dcm-container dcm-label-studio-layout"><div><SectionHeading eyebrow="Label Studio" title="Make the presentation yours.">Choose the label format, design and card details, then preview your changes before downloading.</SectionHeading><div className="dcm-actions"><ActionLink href="/labels">Customize a Label</ActionLink><ActionLink href="/labels/classic" variant="text">Open Classic Studio</ActionLink></div></div>
      <ol className="dcm-studio-steps"><li><strong>01 · Choose a format</strong><p>Graded slab image, magnetic one-touch or top loader.</p></li><li><strong>02 · Choose your design</strong><p>Heritage and modern styles, with available colors and emblems.</p></li><li><strong>03 · Check the card details</strong><p>Review the name, set, year and card number shown on the label.</p></li><li><strong>04 · Preview and download</strong><p>Review the finished layout, then save your print or digital file.</p></li></ol>
    </div></section>

    <section id="reports" className="dcm-section"><div className="dcm-container"><SectionHeading eyebrow="The details behind the label" title="Keep the assessment with the card.">Compare the full report and compact mini report. These examples show the exported report layouts.</SectionHeading><div className="dcm-report-examples">
      <figure><a href="/DCM-full-downloadable-report.png" target="_blank" rel="noreferrer"><Image src="/DCM-full-downloadable-report.png" alt="Example full DCM grading report with card images and grading details" width={650} height={850} /></a><figcaption><strong>Full grading report</strong><p>Open the example to inspect the complete layout.</p></figcaption></figure>
      <figure><a href="/DCM-MiniReport-Umbreon-ex-309396.jpg" target="_blank" rel="noreferrer"><Image src="/DCM-MiniReport-Umbreon-ex-309396.jpg" alt="Example DCM mini report showing a grade, card details and QR code" width={650} height={850} /></a><figcaption><strong>Mini report</strong><p>A compact format for displays and digital sharing.</p></figcaption></figure>
    </div></div></section>

    <section id="download" className="dcm-section dcm-learning-tint"><div className="dcm-container"><SectionHeading eyebrow="From your collection" title="Open your card. Choose your format.">Downloads are available to the account that graded the card.</SectionHeading><div className="dcm-learning-steps"><article><span>01</span><h3>Open your graded card</h3><p>Sign in and choose a card from your collection to open its details.</p></article><article><span>02</span><h3>Find Reports & Labels</h3><p>Choose the report or label format, or open Label Studio to customize the presentation.</p></article><article><span>03</span><h3>Download and print</h3><p>Follow the template’s print guidance and check the size against your holder before applying the label.</p></article></div>
      <div className="dcm-reference-callout"><Icon name="collection" /><div><strong>Printing several labels?</strong><p>Select multiple cards in your collection to print a sheet in one pass.</p></div><ActionLink href="/collection" variant="text">Open Collection →</ActionLink></div>
    </div></section>

    <section className="dcm-section"><div className="dcm-container dcm-learning-faq"><SectionHeading title="Before you print." /><details><summary>Where do I find holders and label supplies?</summary><p>Visit the <Link href="/shop">DCM shop</Link> for recommended holders, top loaders and label supplies. Match your chosen label format to the holder you plan to use.</p></details><details><summary>Can anyone download my card’s labels?</summary><p>Report and label downloads are available to the account that originally graded the card. Public report viewing follows the card’s visibility settings.</p></details><details><summary>What does the serial number connect to?</summary><p>The card’s serial number identifies its DCM grading record. Use the report link or supported QR code to review the associated assessment.</p></details></div></section>
    <section className="dcm-section dcm-learning-cta"><div className="dcm-container"><SectionHeading title="Give your graded cards a finishing touch." /><div className="dcm-actions"><ActionLink href="/labels">Open Label Studio</ActionLink><ActionLink href="/upload" variant="secondary">Grade a Card</ActionLink></div></div></section>
  </div>
}
