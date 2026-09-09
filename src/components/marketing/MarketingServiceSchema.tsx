import { BASE_PRICE_PER_CREDIT, VIP_PACKAGE, CARD_LOVERS_PLANS } from '@/lib/creditPackages'

export function MarketingServiceSchema({ page }: { page: 'card-grading' | 'why-dcm' | 'get-started' | 'vip' | 'card-lovers' }) {
  const offers = page === 'vip'
    ? [{ name: 'VIP: 150 grading credits', price: VIP_PACKAGE.price }]
    : page === 'card-lovers'
      ? Object.values(CARD_LOVERS_PLANS).map(plan => ({ name: plan.name, price: plan.price, priceSpecification: { '@type': 'UnitPriceSpecification', price: plan.price, priceCurrency: 'USD', billingDuration: plan.interval === 'year' ? 'P1Y' : 'P1M' } }))
      : [{ name: 'Single-card grading credit', price: BASE_PRICE_PER_CREDIT }]
  const schema = {
    '@context': 'https://schema.org', '@type': 'Service',
    name: page === 'vip' ? 'DCM VIP grading package' : page === 'card-lovers' ? 'DCM Card Lovers membership' : 'DCM Optic card grading',
    serviceType: 'Photo-based trading card condition analysis',
    description: 'Submit front and back card photos for a condition report with centering, corners, edges and surface subgrades. Review findings and create downloadable labels.',
    url: `https://dcmgrading.com/${page}`,
    // Reference the site-wide Organization node emitted by the root layout instead of minting a second one.
    provider: { '@id': 'https://dcmgrading.com/#organization' },
    offers: offers.map(offer => ({ '@type': 'Offer', ...offer, priceCurrency: 'USD', url: `https://dcmgrading.com/${page === 'vip' || page === 'card-lovers' ? page : 'credits'}` })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
}
