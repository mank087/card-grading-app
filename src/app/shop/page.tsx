import { completeMetadata } from '@/lib/seo/completeMetadata'
import type { Metadata } from 'next'
import Image from 'next/image'
import { PRODUCTS, productUrl, type Product } from '@/lib/shopProducts'
import { ActionLink, Icon, SectionHeading } from '@/components/design/Primitives'

export const metadata: Metadata = completeMetadata({
  alternates: { canonical: 'https://dcmgrading.com/shop' },
  title: { absolute: 'Card Grading Supplies & Recommended Products | DCM Grading' },
  description: 'Find supplies for your DCM workflow: phone stands, card holders, printable label stock and paper cutters. Photograph, label and display your cards.',
})

const sections = [
  { id: 'photograph', number: '01', title: 'Start with a clear photo.', label: 'Photo setup', description: 'A stable phone and consistent framing make it easier to capture the details DCM Optic assesses.', products: ['card-scanner-stand'], guide: 'Read the photo guide', href: '/grade-your-first-card', tip: 'Use even lighting, keep the entire card in frame and check for glare. Clearer photos help reveal condition; they do not improve the card’s condition.' },
  { id: 'holders', number: '02', title: 'Find a home for your card.', label: 'Card holders', description: 'Choose a display format, then match your label dimensions to the holder you use.', products: ['magnetic-graded-slabs', 'traditional-graded-slabs', 'zion-magpro'], guide: 'Explore label formats', href: '/reports-and-labels', tip: 'Check card thickness, holder dimensions and the label area on the seller’s listing before ordering. Use the matching holder size in Label Studio.' },
  { id: 'printing', number: '03', title: 'Give your label a clean finish.', label: 'Printing & trimming', description: 'Match the label stock to your print format, then use the printed guides for a consistent fit.', products: ['avery-6871', 'avery-8167', 'paper-cutter'], guide: 'Open Label Studio', href: '/labels', tip: 'Print at 100% scale. Disable “fit to page” and test on plain paper before using label stock. One-Touch and Toploader layouts use different sheet sizes.' },
] as const

function ProductCard({ product }: { product: Product }) {
  return <article id={product.id} className="dcm-shop-product">
    <div className="dcm-shop-product-image">
      {product.image ? <Image src={product.image} alt={product.name} width={360} height={280} sizes="(max-width: 680px) 85vw, (max-width: 1000px) 42vw, 350px" /> : <div className="dcm-shop-stock-preview">
        <div className={`dcm-shop-sheet ${product.id === 'avery-8167' ? 'dcm-shop-sheet--small' : ''}`} aria-hidden="true">{Array.from({ length: product.id === 'avery-8167' ? 24 : 12 }, (_, i) => <span key={i} />)}</div>
        <span>Label sheet illustration</span>
      </div>}
    </div>
    <div className="dcm-shop-product-content">
      {product.badge && <p className="dcm-eyebrow">{product.badge}</p>}
      <h3>{product.name}</h3>
      <p>{product.description.replace(/\s*[—–]\s*/g, '; ')}</p>
      <a href={productUrl(product)} target="_blank" rel="noopener noreferrer sponsored" className="dcm-button dcm-button--secondary" aria-label={`View ${product.name} on Amazon (opens a new tab)`}>View on Amazon <span aria-hidden="true">↗</span></a>
    </div>
  </article>
}

export default function ShopPage() {
  const catalog = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'DCM recommended card grading supplies', itemListElement: PRODUCTS.map((product, index) => ({ '@type': 'ListItem', position: index + 1, name: product.name, url: `https://dcmgrading.com/shop#${product.id}` })) }
  return <div className="dcm-brand dcm-shop-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(catalog).replace(/</g, '\\u003c') }} />
    <section className="dcm-shop-hero"><div className="dcm-container dcm-shop-hero-grid">
      <div><p className="dcm-eyebrow">The supplies behind the setup</p><h1>Card grading supplies.<br /><span>Ready for your next card.</span></h1><p className="dcm-lead">From your first photo to your finished label, find the accessories that fit your DCM workflow.</p><div className="dcm-actions"><ActionLink href="#supplies">Explore supplies <Icon name="arrow" /></ActionLink><ActionLink href="/labels" variant="secondary">Open Label Studio</ActionLink></div><p className="dcm-shop-optional">Accessories are optional. You can start grading with clear front and back photos.</p></div>
      <figure className="dcm-shop-hero-visual"><div><Image src="/shop/card-scanner-stand.jpg" alt="Phone stand for an overhead card photography setup" width={480} height={380} priority sizes="(max-width: 850px) 85vw, 450px" /></div><figcaption><Icon name="camera" /><span><strong>A steady starting point.</strong>Set up your shot, then let the card’s condition speak.</span></figcaption></figure>
    </div></section>
    <div id="supplies" className="dcm-container dcm-shop-directory"><div role="navigation" aria-label="Shop by task">{sections.map(section => <a key={section.id} href={`#${section.id}`}><span>{section.number}</span>{section.label}<span aria-hidden="true">↓</span></a>)}</div><p className="dcm-shop-disclosure">As an Amazon Associate, DCM Grading earns from qualifying purchases. These affiliate links open Amazon in a new tab. Check the seller’s listing for current price and availability.</p></div>
    {sections.map(section => <section key={section.id} id={section.id} className="dcm-section dcm-shop-section"><div className="dcm-container"><div className="dcm-shop-section-heading"><SectionHeading eyebrow={`${section.number} / ${section.label}`} title={section.title}>{section.description}</SectionHeading><ActionLink href={section.href} variant="text">{section.guide} <Icon name="arrow" /></ActionLink></div><div className={`dcm-shop-grid ${section.products.length === 1 ? 'dcm-shop-grid--single' : ''}`}>{section.products.map(id => <ProductCard key={id} product={PRODUCTS.find(product => product.id === id)!} />)}{section.products.length === 1 && <aside className="dcm-shop-photo-note"><Icon name="scan" /><h3>Capture the details that matter.</h3><p>{section.tip}</p><ul><li>Photograph the front and back.</li><li>Keep the camera parallel to the card.</li><li>Review focus before uploading.</li></ul><ActionLink href="/get-started" variant="text">See how grading works <Icon name="arrow" /></ActionLink></aside>}</div>{section.products.length > 1 && <p className="dcm-shop-fit-note"><Icon name="check" /><span>{section.tip}</span></p>}</div></section>)}
    <section className="dcm-shop-finish dcm-dark"><div className="dcm-container"><div><p className="dcm-eyebrow">Make the grade yours</p><h2>Your card. Your label. Your display.</h2><p className="dcm-lead">Build a Heritage label, customize your layout and print in the format that fits your holder.</p></div><ActionLink href="/labels">Create your label <Icon name="arrow" /></ActionLink></div></section>
  </div>
}
