/**
 * Recommended products — one source of truth for the Shop page and the Label
 * Wizard's optional "Supplies" step.
 *
 * Every outbound link is an Amazon Associates link carrying AFFILIATE_TAG.
 * Links built here use the canonical /dp/<ASIN> form rather than the long
 * search-result URLs Amazon hands you when browsing: those carry a `keywords`
 * / `qid` / `sr` trail that expires, and (crucially) no associate tag at all.
 *
 * `linkId` is SiteStripe's per-placement analytics id. It is OPTIONAL for
 * attribution — `tag` is what credits the account — so products added without
 * one still earn. Paste a SiteStripe linkId in when you want that placement
 * broken out separately in Amazon's reporting.
 */

export const AFFILIATE_TAG = 'dcmgrading03-20';

/**
 * Canonical Amazon Associates URL for a product.
 *
 * `tag` defaults to AFFILIATE_TAG. A product may override it: an Associates
 * account can own several tracking IDs, and a SiteStripe link's `linkId` is
 * issued against the tracking ID that generated it — so a link's tag and
 * linkId must travel together or the placement reports oddly.
 */
export function amazonAffiliateUrl(asin: string, linkId?: string, tag: string = AFFILIATE_TAG): string {
  const params = new URLSearchParams({
    linkCode: 'll2',
    tag,
    language: 'en_US',
    ref_: 'as_li_ss_tl',
  });
  if (linkId) params.set('linkId', linkId);
  return `https://www.amazon.com/dp/${asin}?${params.toString()}`;
}

/**
 * Where a product belongs in the Label Wizard's supplies step:
 *  - 'slab'      : standard snap/graded slab cases (2.8" × 0.8" label slot)
 *  - 'magnetic'  : magnetic one-touch style cases
 *  - 'zion'      : Zion MagPro — the case behind the wizard's Zion size option
 *  - 'tool'      : everything that helps you produce the labels themselves
 */
export type ProductCategory = 'slab' | 'magnetic' | 'zion' | 'tool';

export interface Product {
  /** Stable key — also the anchor/analytics id. */
  id: string;
  name: string;
  description: string;
  /** Short line used in the compact wizard cards. */
  shortDescription: string;
  image: string;
  asin: string;
  /** SiteStripe per-placement id, when one has been generated. */
  linkId?: string;
  /**
   * Tracking-ID override, for a SiteStripe link generated under a tracking ID
   * other than AFFILIATE_TAG. The linkId above is issued against a specific
   * tracking ID, so if you set one you must set both. Currently unused — every
   * product shares the one tag.
   */
  tag?: string;
  badge?: string;
  categories: ProductCategory[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'card-scanner-stand',
    name: 'Card Scanner Stand',
    description:
      'Hands-free phone stand designed for photographing trading cards. Provides consistent overhead positioning and stable framing for the sharpest, most accurate grading photos. Adjustable height and angle for any card size.',
    shortDescription: 'Overhead phone stand for consistent, sharp grading photos.',
    image: '/shop/card-scanner-stand.jpg',
    asin: 'B0G4D5J8GG',
    linkId: 'fe14feb53605799758759b454abbe0df',
    badge: 'Best for Photos',
    categories: ['tool'],
  },
  {
    id: 'magnetic-graded-slabs',
    name: 'Magnetic Graded Slabs',
    description:
      'Premium magnetic closure graded card slabs. Showcase your DCM-graded cards with a professional display-quality case. Easy open/close design with crystal-clear viewing on both sides. Perfect for high-value cards.',
    shortDescription: 'Magnetic-closure display cases for your highest-value cards.',
    image: '/shop/magnetic-graded-slabs.jpg',
    asin: 'B0GK6PSGKQ',
    linkId: 'cda52cb06ef2d75f7bdc4dd4e477ad42',
    badge: 'Premium Display',
    categories: ['magnetic', 'slab'],
  },
  {
    id: 'traditional-graded-slabs',
    name: 'Traditional Graded Slabs',
    description:
      'Classic snap-fit graded card slabs in bulk. The standard case for displaying DCM-graded cards with custom labels. Fits standard trading cards with room for front and back labels. Great value at 100 per pack.',
    shortDescription: 'Classic snap-fit cases, 100 per pack — the standard label slot.',
    image: '/shop/traditional-graded-slab.jpg',
    asin: 'B0C369YLLB',
    linkId: 'ff7b9f5641325f4b0a51fad3b2f4ae4c',
    badge: 'Best Value',
    categories: ['slab'],
  },
  {
    id: 'zion-magpro',
    name: 'Zion Cases MagPro 35PT (5 Pack)',
    description:
      'Magnetic 35PT card holder with dual magnets for secure holding strength that guards against unintentional openings. Five cases per pack. Label Studio has a built-in Zion Mag Pro size option (2.51" × 0.76") so your labels fit this case exactly.',
    shortDescription: 'Dual-magnet 35PT holders, 5 per pack — Label Studio has a size preset.',
    image: '/shop/zion-magpro-slab.jpg',
    asin: 'B0CV9MFY9K',
    linkId: '12db9752a7bbbaaeac592f500c944ad2',
    badge: 'Zion Size Supported',
    categories: ['magnetic', 'zion'],
  },
  {
    id: 'paper-cutter',
    name: 'A4 Paper Cutter & Trimmer',
    description:
      'A 12-inch slider trimmer with a security blade and foldable ruler, sized for cardstock, photo paper, and vinyl. Straight, repeatable cuts are the difference between a label that sits flush in the slot and one that looks hand-trimmed — cut along the guides printed on every DCM label sheet.',
    shortDescription: 'Straight, repeatable cuts along the guides on every label sheet.',
    image: '/shop/paper-cutter.jpg',
    asin: 'B08PKXC1B7',
    linkId: '36b20e1c4c20d54b32d9cc302298f496',
    badge: 'Clean Label Cuts',
    categories: ['tool'],
  },
];

/** Full affiliate URL for a product. */
export function productUrl(p: Product): string {
  return amazonAffiliateUrl(p.asin, p.linkId, p.tag);
}

/** Products relevant to a wizard holder choice, most relevant first. */
export function productsForHolder(
  holder: 'slab' | 'onetouch' | 'toploader' | null,
  slabSize?: 'standard' | 'zion',
): Product[] {
  const byId = (id: string) => PRODUCTS.find(p => p.id === id)!;
  const cutter = byId('paper-cutter');

  if (holder === 'onetouch' || slabSize === 'zion') {
    // Zion sizing implies a Zion case; one-touch users want magnetic cases.
    return [byId('zion-magpro'), byId('magnetic-graded-slabs'), byId('traditional-graded-slabs'), cutter];
  }
  if (holder === 'slab') {
    return [byId('traditional-graded-slabs'), byId('magnetic-graded-slabs'), byId('zion-magpro'), cutter];
  }
  // Toploader (or nothing chosen): cases are less relevant, tools still are.
  return [byId('card-scanner-stand'), byId('traditional-graded-slabs'), byId('magnetic-graded-slabs'), cutter];
}
