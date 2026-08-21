/**
 * Recommended products — the Shop tab and Label Studio's supplies section.
 *
 * Mirrors web's src/lib/shopProducts.ts. The two projects do not share code, so
 * this is a deliberate copy: keep the ASINs, link ids, and categories in step
 * when either side changes. (See docs/MOBILE_LABEL_STUDIO_PARITY_PLAN.md §6 —
 * whether these become a shared package is still an open decision.)
 *
 * `image` is a bundled asset via require(), and optional: a product with no
 * artwork yet renders a titled placeholder rather than a broken image.
 */

export const AFFILIATE_TAG = 'dcmgrading03-20'

export function amazonAffiliateUrl(asin: string, linkId?: string, tag: string = AFFILIATE_TAG): string {
  const params = new URLSearchParams({
    linkCode: 'll2',
    tag,
    language: 'en_US',
    ref_: 'as_li_ss_tl',
  })
  if (linkId) params.set('linkId', linkId)
  return `https://www.amazon.com/dp/${asin}?${params.toString()}`
}

export type ProductCategory = 'slab' | 'magnetic' | 'zion' | 'tool' | 'labels'

export interface Product {
  id: string
  name: string
  description: string
  shortDescription: string
  /** Bundled asset. Optional — no artwork yet renders a placeholder. */
  image?: any
  asin: string
  linkId?: string
  tag?: string
  badge?: string
  categories: ProductCategory[]
}

export const PRODUCTS: Product[] = [
  {
    id: 'card-scanner-stand',
    name: 'Card Scanner Stand',
    description: 'Hands-free phone stand for consistent overhead card photography.',
    shortDescription: 'Overhead phone stand for consistent, sharp grading photos.',
    image: require('@/assets/images/shop-scanner-stand.jpg'),
    asin: 'B0G4D5J8GG',
    linkId: 'fe14feb53605799758759b454abbe0df',
    badge: 'Best for Photos',
    categories: ['tool'],
  },
  {
    id: 'magnetic-graded-slabs',
    name: 'Magnetic Graded Slabs',
    description: 'Premium magnetic closure cases for displaying DCM-graded cards.',
    shortDescription: 'Magnetic-closure display cases for your highest-value cards.',
    image: require('@/assets/images/shop-magnetic-slabs.jpg'),
    asin: 'B0GK6PSGKQ',
    linkId: 'cda52cb06ef2d75f7bdc4dd4e477ad42',
    badge: 'Premium Display',
    categories: ['magnetic', 'slab'],
  },
  {
    id: 'traditional-graded-slabs',
    name: 'Traditional Graded Slabs',
    description: 'Classic snap-fit graded card slabs. 100 per pack — great value.',
    shortDescription: 'Classic snap-fit cases, 100 per pack — the standard label slot.',
    image: require('@/assets/images/shop-traditional-slabs.jpg'),
    asin: 'B0C369YLLB',
    linkId: 'ff7b9f5641325f4b0a51fad3b2f4ae4c',
    badge: 'Best Value',
    categories: ['slab'],
  },
  {
    id: 'zion-magpro',
    name: 'Zion Cases MagPro 35PT (5 Pack)',
    description:
      'Dual-magnet 35PT holder, five per pack. Label Studio has a Zion Mag Pro size option (2.51" × 0.76") so your labels fit this case exactly.',
    shortDescription: 'Dual-magnet 35PT holders — Label Studio has a size preset.',
    asin: 'B0CV9MFY9K',
    linkId: '12db9752a7bbbaaeac592f500c944ad2',
    badge: 'Zion Size Supported',
    categories: ['magnetic', 'zion'],
  },
  {
    id: 'avery-6871',
    name: 'Avery 6871 Labels (2.375" × 1.25")',
    description:
      'The label stock the One-Touch sheets are laid out for — 18 per page, back panel inverted on the top half so it reads upright once folded. Print at 100% scale.',
    shortDescription: 'One-Touch label stock — 18 per page.',
    asin: 'B00007M4HJ',
    linkId: '1e69599b7a1a8a38139531e917282a1d',
    badge: 'One-Touch Sheets',
    categories: ['labels'],
  },
  {
    id: 'avery-8167',
    name: 'Avery 8167 Labels (1.75" × 0.5")',
    description:
      'The label stock both Toploader formats are laid out for — 40 cards per page as front-and-back pairs, 80 folded. Print at 100% scale.',
    shortDescription: 'Toploader label stock — 40 per page, or 80 folded.',
    asin: 'B00004Z5QO',
    linkId: 'a044b1dc8e00e40e60d13214dfdf102e',
    badge: 'Toploader Sheets',
    categories: ['labels'],
  },
  {
    id: 'paper-cutter',
    name: 'A4 Paper Cutter & Trimmer',
    description:
      'A 12-inch slider trimmer with a security blade and foldable ruler. Straight, repeatable cuts along the guides printed on every DCM label sheet.',
    shortDescription: 'Straight, repeatable cuts along the guides on every sheet.',
    asin: 'B08PKXC1B7',
    linkId: '36b20e1c4c20d54b32d9cc302298f496',
    badge: 'Clean Label Cuts',
    categories: ['tool'],
  },
]

export function productUrl(p: Product): string {
  return amazonAffiliateUrl(p.asin, p.linkId, p.tag)
}

/** Products relevant to the chosen holder, most relevant first. */
export function productsForHolder(
  holder: 'slab' | 'onetouch' | 'toploader' | 'digital' | null,
  isZionSize?: boolean,
): Product[] {
  const byId = (id: string) => PRODUCTS.find(p => p.id === id)!
  const cutter = byId('paper-cutter')

  // The label stock leads for the small holders: the sheet is laid out for it
  // and nothing else fits the die-cuts.
  if (holder === 'onetouch') {
    return [byId('avery-6871'), byId('zion-magpro'), byId('magnetic-graded-slabs'), cutter]
  }
  if (holder === 'toploader') {
    return [byId('avery-8167'), byId('card-scanner-stand'), byId('traditional-graded-slabs'), cutter]
  }
  if (isZionSize) {
    return [byId('zion-magpro'), byId('magnetic-graded-slabs'), byId('traditional-graded-slabs'), cutter]
  }
  if (holder === 'slab') {
    return [byId('traditional-graded-slabs'), byId('magnetic-graded-slabs'), byId('zion-magpro'), cutter]
  }
  return [byId('card-scanner-stand'), byId('traditional-graded-slabs'), byId('magnetic-graded-slabs'), cutter]
}
