export interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  keywords: string[]
  category: Category
  links: { label: string; href: string }[]
  relatedIds: string[]
}

export type Category =
  | 'getting-started'
  | 'grading-scores'
  | 'photo-tips'
  | 'pricing-credits'
  | 'dcm-vs-mailaway'
  | 'special-cases'
  | 'account-collection'
  | 'printing-labels'
  | 'selling-instalist'
  | 'mobile-apps'
  | 'enterprise'

export interface CategoryInfo {
  id: Category
  label: string
  emoji: string
}

export const categories: CategoryInfo[] = [
  { id: 'getting-started', label: 'Getting Started', emoji: '\u{1F680}' },
  { id: 'grading-scores', label: 'Grading & Scores', emoji: '\u{1F4CA}' },
  { id: 'photo-tips', label: 'Photo Tips', emoji: '\u{1F4F7}' },
  { id: 'pricing-credits', label: 'Pricing & Credits', emoji: '\u{1F4B3}' },
  { id: 'dcm-vs-mailaway', label: 'DCM vs Mail-Away', emoji: '\u{1F3C6}' },
  { id: 'special-cases', label: 'Special Cases', emoji: '\u{2728}' },
  { id: 'account-collection', label: 'Account & Collection', emoji: '\u{1F4C1}' },
  { id: 'printing-labels', label: 'Labels & Reports', emoji: '\u{1F3F7}️' },
  { id: 'selling-instalist', label: 'Selling on eBay', emoji: '\u{1F6D2}' },
  { id: 'mobile-apps', label: 'Mobile Apps', emoji: '\u{1F4F1}' },
  { id: 'enterprise', label: 'Shops & Enterprise', emoji: '\u{1F3EA}' },
]

/**
 * Keep this file in step with the product. Last full review: September 10,
 * 2026 (pricing, Card Lovers benefits, grading rules, labels, InstaList,
 * manual reviews, mobile apps, enterprise). Prices here must match
 * src/lib/creditPackages.ts.
 */
export const knowledgeBase: KnowledgeEntry[] = [
  // ── Getting Started ──
  {
    id: 'what-is-dcm',
    question: 'What is DCM Grading?',
    answer:
      'DCM Grading assesses the condition of trading cards from two photos. Upload the front and back, and DCM Optic™, our grading engine, returns a whole-number grade from 1 to 10 with four subgrades, a written reason for every deduction, a printable label and a verification page, usually in about a minute. Your card never leaves your hands.',
    keywords: ['what', 'dcm', 'grading', 'about', 'service', 'ai', 'optic', 'who', 'company'],
    category: 'getting-started',
    links: [{ label: 'How it works', href: '/get-started' }, { label: 'Why DCM', href: '/why-dcm' }],
    relatedIds: ['how-it-works', 'card-types', 'free-trial'],
  },
  {
    id: 'how-it-works',
    question: 'How does DCM Grading work?',
    answer:
      'Photograph the front and back of your card and upload them. DCM Optic™ runs three independent evaluation passes, takes the consensus, and scores centering, corners, edges and surface. The final grade is the lowest of the four subgrades. Every grade comes with a defect log, an image confidence letter, an uncertainty range and a condition report.',
    keywords: ['how', 'work', 'process', 'steps', 'upload', 'three-pass', 'consensus', 'optic'],
    category: 'getting-started',
    links: [{ label: 'Start grading', href: '/upload' }, { label: 'Grading standard', href: '/grading-standard' }],
    relatedIds: ['what-is-dcm', 'three-pass', 'component-scores'],
  },
  {
    id: 'card-types',
    question: 'What types of cards can DCM grade?',
    answer:
      'Sports cards (baseball, basketball, football, hockey, soccer and more), Pokémon, Magic: The Gathering, Disney Lorcana, One Piece, Yu-Gi-Oh, and an Other category for Star Wars, Marvel, Naruto and other TCG and non-sport cards. Pick the card type when you upload so the right rules and card database apply.',
    keywords: ['types', 'cards', 'sports', 'pokemon', 'mtg', 'magic', 'lorcana', 'one piece', 'yugioh', 'yu-gi-oh', 'star wars', 'marvel', 'naruto', 'supported', 'other'],
    category: 'getting-started',
    links: [{ label: 'Grade a card', href: '/upload' }],
    relatedIds: ['what-is-dcm', 'vintage'],
  },
  {
    id: 'how-long',
    question: 'How long does grading take?',
    answer:
      'Usually about a minute. At busy times a card can sit in the queue a little longer, and grading keeps running if you leave the page. Your finished card appears in your Collection either way. If a grade fails for any reason, the credit is refunded automatically.',
    keywords: ['how long', 'time', 'speed', 'fast', 'seconds', 'minutes', 'duration', 'wait', 'queue', 'stuck', 'processing'],
    category: 'getting-started',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['how-it-works', 'bulk-grading'],
  },
  {
    id: 'bulk-grading',
    question: 'Can I grade many cards at once?',
    answer:
      'Yes. On the upload page choose "Submit more than one card" to build a submission of front-and-back pairs. The cards are queued and graded in the background, so you can close the tab and come back. Each card uses one credit and lands in your Collection as it finishes.',
    keywords: ['bulk', 'batch', 'many', 'multiple', 'submission', 'submit more', 'queue', 'several', 'lots'],
    category: 'getting-started',
    links: [{ label: 'Start a submission', href: '/upload' }],
    relatedIds: ['how-long', 'pricing'],
  },

  // ── Grading & Scores ──
  {
    id: 'grading-scale',
    question: 'What grading scale does DCM use?',
    answer:
      'A 10-point scale of whole numbers: 10 Gem Mint, 9 Mint, 8 Near Mint-Mint, 7 Near Mint, 6 Excellent-Mint, 5 Excellent, and lower grades for heavier wear. The final grade is the lowest of the four subgrades, the weakest-link rule, and structural damage such as a crease caps the grade regardless of the other scores.',
    keywords: ['scale', 'grade', 'number', '10', 'gem mint', 'mint', 'near mint', 'score', 'range', 'weakest link', 'lowest'],
    category: 'grading-scores',
    links: [{ label: 'Grading standard', href: '/grading-standard' }, { label: 'Grading rubric', href: '/grading-rubric' }],
    relatedIds: ['component-scores', 'grade-caps'],
  },
  {
    id: 'component-scores',
    question: 'What are the subgrades?',
    answer:
      'Every card is scored on four categories: centering, corners, edges and surface, with the front and back both examined. The final grade is the lowest of the four, not an average, so one weak category sets the ceiling. Each subgrade lists the specific defects found and where they are.',
    keywords: ['component', 'scores', 'subgrade', 'subgrades', 'centering', 'corners', 'edges', 'surface', 'front', 'back', 'four'],
    category: 'grading-scores',
    links: [{ label: 'Grading standard', href: '/grading-standard' }],
    relatedIds: ['grading-scale', 'centering'],
  },
  {
    id: 'three-pass',
    question: 'What is three-pass consensus grading?',
    answer:
      'DCM Optic™ evaluates every card three separate times and combines the passes by consensus, so a defect has to be seen consistently to count. Corners, edges and surface are re-examined on magnified crops. The result is less run-to-run variance than a single evaluation.',
    keywords: ['three-pass', 'consensus', 'passes', 'independent', 'evaluation', 'accuracy', 'reliable', 'median'],
    category: 'grading-scores',
    links: [{ label: 'Grading standard', href: '/grading-standard' }],
    relatedIds: ['how-it-works', 'consistency'],
  },
  {
    id: 'consistency',
    question: 'What do the consistency score and uncertainty range mean?',
    answer:
      'The consistency score shows how closely the three passes agreed. The uncertainty range shows how far the grade could reasonably move given the photo quality. High agreement and a tight range mean a confident grade. A wide range usually means the photos limited the evaluation, so re-photograph and re-grade.',
    keywords: ['consistency', 'agreement', 'confidence', 'uncertainty', 'range', 'high', 'moderate', 'low', 'variance', 'passes agree'],
    category: 'grading-scores',
    links: [],
    relatedIds: ['three-pass', 'image-confidence', 'regrade'],
  },
  {
    id: 'centering',
    question: 'How does DCM measure centering?',
    answer:
      'Centering is measured on the front and back from the border proportions and scored against the thresholds in DCM’s published standard. A Gem Mint centering score needs tight front and back centering; looser proportions step the centering subgrade down. Full-art and borderless cards are evaluated on the elements that are visible.',
    keywords: ['centering', 'alignment', 'off-center', '55/45', '75/25', 'standard', 'borders'],
    category: 'grading-scores',
    links: [{ label: 'Centering in the standard', href: '/grading-standard' }],
    relatedIds: ['component-scores', 'grading-scale'],
  },
  {
    id: 'grade-caps',
    question: 'What are grade caps?',
    answer:
      'Structural damage caps the grade no matter how clean the rest of the card is. Creases, tears, corner lifts, severe bends and similar defects each carry a maximum grade in the published standard, and the report says which cap applied and why.',
    keywords: ['cap', 'caps', 'maximum', 'crease', 'tear', 'bend', 'corner lift', 'structural', 'defect', 'limit'],
    category: 'grading-scores',
    links: [{ label: 'Structural caps', href: '/grading-standard' }],
    relatedIds: ['grading-scale', 'component-scores'],
  },
  {
    id: 'evidence-based',
    question: 'What does "evidence-based grading" mean?',
    answer:
      'Every deduction has to be backed by something visible in your photos, and the report tells you the defect, its location and why it cost points. If it cannot be seen, it is not deducted. That is also why photo quality matters so much.',
    keywords: ['evidence', 'based', 'observable', 'defect', 'proof', 'transparent', 'findings', 'reason', 'deduction'],
    category: 'grading-scores',
    links: [{ label: 'Grading limitations', href: '/grading-limitations' }],
    relatedIds: ['three-pass', 'image-confidence'],
  },
  {
    id: 'unexpected-grade',
    question: 'What if a card scores higher or lower than I expect?',
    answer:
      'First check the image confidence letter and the defect log. Blur, glare, shadows or a busy background can hide or invent wear, so re-photograph in even light on a plain dark background and re-grade for one credit. VIP purchasers and active Card Lovers can also request a manual review by the DCM team from the card page. If the card name, set, year or number is wrong, anyone can request a card-detail correction for free.',
    keywords: ['unexpected', 'higher', 'lower', 'expect', 'wrong grade', 'too high', 'too low', 'surprised', 'disagree', 'dispute', 'appeal'],
    category: 'grading-scores',
    links: [{ label: 'Grading limitations', href: '/grading-limitations' }],
    relatedIds: ['manual-review', 'regrade', 'photo-tips', 'image-confidence'],
  },
  {
    id: 'manual-review',
    question: 'Can a person review my grade?',
    answer:
      'Yes. On any of your graded cards, scroll below the graded date and choose "Request a review". Grade reviews are available to VIP purchasers and active Card Lovers members, with one complimentary manual review included per grade; the DCM team re-checks all four subgrades on both sides and emails you the result, which you can accept or keep. Card-detail corrections (name, set, year, card number) are free for every card owner.',
    keywords: ['manual review', 'human', 'review', 'dispute', 'appeal', 'second opinion', 'team', 'wrong name', 'wrong year', 'wrong set', 'card details', 'correction', 'fix details'],
    category: 'grading-scores',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['unexpected-grade', 'card-lovers', 'regrade'],
  },

  // ── Photo Tips ──
  {
    id: 'photo-tips',
    question: 'How should I photograph my cards?',
    answer:
      'Lay the card flat on a plain, dark, non-reflective background in daylight or under a bright, even lamp, no flash. Fill the frame, keep the phone parallel to the card, and tap to focus. Take the card out of sleeves and holders if you can. Photograph both the front and the back. The apps guide each shot.',
    keywords: ['photo', 'photograph', 'picture', 'camera', 'lighting', 'tips', 'how to', 'best', 'image', 'background', 'glare'],
    category: 'photo-tips',
    links: [{ label: 'Photo guide', href: '/grade-your-first-card' }],
    relatedIds: ['image-confidence', 'sleeves-toploaders', 'image-formats'],
  },
  {
    id: 'image-confidence',
    question: 'What is the image confidence rating?',
    answer:
      'Every grade carries a letter from A to D that says how well your photos supported the evaluation. A means excellent visibility, B good, C partial obstruction or softness, and D significant problems. A C or D grade is a signal to re-photograph and re-grade before relying on the result.',
    keywords: ['confidence', 'image', 'rating', 'quality', 'visibility', 'letter', 'A', 'B', 'C', 'D'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'regrade', 'consistency'],
  },
  {
    id: 'sleeves-toploaders',
    question: 'Can I grade cards in sleeves or top loaders?',
    answer:
      'A penny sleeve is usually fine. Top loaders and magnetic holders add reflections and soften detail, which lowers the image confidence and can hide edge and surface wear. For the most accurate grade, photograph the bare card.',
    keywords: ['sleeve', 'toploader', 'top loader', 'holder', 'penny', 'magnetic', 'case', 'protected', 'one-touch'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'slabs'],
  },
  {
    id: 'slabs',
    question: 'Can DCM grade cards already in graded slabs?',
    answer:
      'Yes. DCM detects the slab and evaluates the card inside independently of the printed grade. Thick slab plastic, scuffs and reflections reduce what the photos show, so expect a lower image confidence letter than a raw card would get.',
    keywords: ['slab', 'slabbed', 'encased', 'graded', 'already graded', 'reholder', 'psa slab', 'crossover'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['sleeves-toploaders', 'image-confidence'],
  },
  {
    id: 'image-formats',
    question: 'What image formats are supported?',
    answer:
      'JPEG, PNG, HEIC and WebP. Photos need to be at least 1000 pixels on the short side; phone cameras easily clear that. The upload checks for blur, duplicate front and back photos, and image size before it spends a credit.',
    keywords: ['format', 'jpeg', 'png', 'heic', 'webp', 'resolution', 'pixels', 'size', 'file type', 'minimum'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'mobile-apps'],
  },

  // ── Pricing & Credits ──
  {
    id: 'free-trial',
    question: 'Is there a free trial?',
    answer:
      'Every new account gets 2 free credits, one credit per card, with no payment card required. Grade two cards, open the full reports and print the labels before deciding whether to buy more. Credits never expire.',
    keywords: ['free', 'trial', 'complimentary', 'credits', 'new account', 'try', 'sign up', 'no cost', '2 free', 'two free'],
    category: 'pricing-credits',
    links: [{ label: 'Create a free account', href: '/login?mode=signup' }],
    relatedIds: ['pricing', 'card-lovers'],
  },
  {
    id: 'pricing',
    question: 'How much does DCM Grading cost?',
    answer:
      'One credit grades one card. Packs: Basic $2.99 for 1 credit, Pro $9.99 for 5, Elite $19.99 for 20, VIP $99 for 150 (about $0.66 a grade, plus the VIP diamond emblem on your labels). Your first pack purchase adds bonus credits: 1 on Basic, 3 on Pro, 5 on Elite. Credits never expire. Card Lovers membership brings the price to about $0.50 a grade.',
    keywords: ['price', 'cost', 'credit', 'credits', 'how much', 'package', 'pack', 'basic', 'pro', 'elite', 'vip', 'buy', 'bonus', 'expire'],
    category: 'pricing-credits',
    links: [{ label: 'View pricing', href: '/credits' }],
    relatedIds: ['card-lovers', 'free-trial', 'promo-codes'],
  },
  {
    id: 'card-lovers',
    question: 'What is the Card Lovers membership?',
    answer:
      'Card Lovers is DCM’s membership. Monthly is $49.99 for 70 credits each month. Annual is $449 for 900 credits upfront, which includes 60 bonus credits, about $0.50 a grade. Members also get 20% off any extra credits they buy, the Card Lover heart emblem on their labels, on-demand portfolio price refresh, loyalty bonus credits at months 3, 6, 9 and 12, and a complimentary manual grade review on each grade. Reports, labels, market pricing and InstaList are available to everyone; membership is about volume and price.',
    keywords: ['card lovers', 'subscription', 'membership', 'monthly', 'annual', 'member', 'benefits', 'loyalty', 'heart', 'emblem', 'cancel'],
    category: 'pricing-credits',
    links: [{ label: 'Card Lovers', href: '/card-lovers' }],
    relatedIds: ['pricing', 'manual-review', 'my-account'],
  },
  {
    id: 'promo-codes',
    question: 'Do you have promo codes or discounts?',
    answer:
      'Promo codes are entered on the checkout page. Your first pack purchase already includes bonus credits, and Card Lovers members get 20% off extra credits automatically. Referred customers get 10% off their first purchase through the affiliate program.',
    keywords: ['promo', 'promo code', 'discount', 'coupon', 'code', 'sale', 'deal', 'grade10', 'grade20', 'affiliate', 'referral'],
    category: 'pricing-credits',
    links: [{ label: 'Pricing', href: '/credits' }, { label: 'Affiliate program', href: '/affiliates' }],
    relatedIds: ['pricing', 'card-lovers'],
  },
  {
    id: 'market-pricing',
    question: 'How does market pricing work?',
    answer:
      'Every graded card shows a DCM value estimate on its card page and in your Collection, built from raw and graded sales data from PriceCharting, SportsCardsPro and eBay, matched to your card and grade. Card Lovers members can refresh prices on demand. If the match is wrong, pick the correct product or parallel from the dropdown in the Market Pricing section.',
    keywords: ['market', 'pricing', 'value', 'price', 'ebay', 'estimate', 'worth', 'how much worth', 'sold', 'comps', 'pricecharting'],
    category: 'pricing-credits',
    links: [{ label: 'Portfolio tools', href: '/market-pricing' }],
    relatedIds: ['collection-pricing', 'parallel-mismatch', 'card-lovers'],
  },
  {
    id: 'collection-pricing',
    question: 'How do I see the value of my collection?',
    answer:
      'Your Collection page and Portfolio show the estimated value of every graded card and the total, based on recent market data matched to each card’s grade. Values update on a schedule; Card Lovers members can refresh on demand. Mark cards as sold to keep the portfolio honest without deleting them.',
    keywords: ['collection', 'value', 'total', 'portfolio', 'worth', 'price', 'estimate', 'net worth'],
    category: 'pricing-credits',
    links: [{ label: 'View collection', href: '/collection' }, { label: 'Portfolio', href: '/market-pricing' }],
    relatedIds: ['market-pricing', 'card-ownership'],
  },
  {
    id: 'parallel-mismatch',
    question: 'What if my card’s parallel or variant isn’t matched correctly?',
    answer:
      'Open the card page, scroll to Market Pricing and use the dropdown to choose the right product or parallel (holo, reverse holo, full art, numbered parallel and so on). The estimate updates immediately. If the card name, set, year or number itself is wrong, request a card-detail correction from the button below the graded date; it is free for every owner.',
    keywords: ['parallel', 'variant', 'wrong card', 'mismatch', 'holo', 'reverse holo', 'full art', 'incorrect', 'wrong version', 'update parallel', 'wrong price'],
    category: 'pricing-credits',
    links: [],
    relatedIds: ['market-pricing', 'manual-review'],
  },

  // ── DCM vs Mail-Away Grading ──
  {
    id: 'dcm-vs-mailaway',
    question: 'How does DCM compare to PSA and other mail-in graders?',
    answer:
      'DCM is a photo-based condition assessment you can have in about a minute for $2.99 or less, with four subgrades and a written reason for every deduction, and the card stays with you. PSA, BGS, SGC and CGC are mail-in services that return a sealed physical slab after weeks and cost from about $15 to well over $59.99 a card plus shipping. A DCM grade documents condition and helps you decide what deserves a mail-in submission; it is not a substitute for a sealed slab when a buyer wants one.',
    keywords: ['compare', 'difference', 'vs', 'versus', 'psa', 'bgs', 'beckett', 'sgc', 'cgc', 'tag', 'professional', 'mail-away', 'mail away', 'mail-in', 'traditional', 'alternative'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'PSA alternative', href: '/psa-alternative' }, { label: 'All grading companies', href: '/card-grading-companies' }],
    relatedIds: ['accuracy', 'grade-differs', 'why-dcm'],
  },
  {
    id: 'accuracy',
    question: 'How accurate are DCM grades?',
    answer:
      'DCM grades against a published standard with three-pass consensus and evidence-based deductions, and publishes its limitations openly. A photo-based grade cannot see everything a grader holding the card can, so treat DCM as a consistent, documented assessment rather than a prediction of what PSA or BGS will assign.',
    keywords: ['accurate', 'accuracy', 'reliable', 'correct', 'trustworthy', 'how good', 'precision', 'predict'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'Accuracy', href: '/ai-card-grading-accuracy' }, { label: 'Limitations', href: '/grading-limitations' }],
    relatedIds: ['three-pass', 'evidence-based', 'grade-differs'],
  },
  {
    id: 'grade-differs',
    question: 'What if my DCM grade differs from a professional grade?',
    answer:
      'Differences come from photo limits versus physical inspection, from graders applying their own standards, and from the natural spread between any two graders. Check the image confidence letter, re-grade with better photos if it is a C or D, and remember that DCM uses a weakest-link rule that some services do not.',
    keywords: ['differ', 'different', 'wrong', 'disagree', 'mismatch', 'inaccurate', 'not match', 'off', 'psa gave'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'Grading limitations', href: '/grading-limitations' }],
    relatedIds: ['accuracy', 'regrade', 'manual-review'],
  },
  {
    id: 'why-dcm',
    question: 'Why use DCM instead of only mail-in grading?',
    answer:
      'Speed (about a minute instead of weeks), cost ($2.99 for one card, $0.66 with the VIP pack, about $0.50 with Card Lovers Annual), and the card never leaving your hands. You get four subgrades, a defect log, labels, a verification page, market pricing and one-click eBay listing on every card. Use it to grade a whole collection, to decide which cards are worth a mail-in submission, and to sell raw cards with documented condition.',
    keywords: ['why', 'advantage', 'benefit', 'better', 'instead', 'reason', 'worth it', 'pre-screen', 'prescreen'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'Why DCM', href: '/why-dcm' }],
    relatedIds: ['dcm-vs-mailaway', 'pricing', 'instalist'],
  },

  // ── Special Cases ──
  {
    id: 'autographed',
    question: 'Can DCM grade autographed cards?',
    answer:
      'Yes. Manufacturer-certified autographs (Topps Certified, Panini Authentic and similar) are graded normally. A hand-signed or otherwise unverified autograph still receives its full numeric condition grade, and the report and label carry an "Altered - Unverified Autograph" notation because DCM cannot authenticate a signature from a photo.',
    keywords: ['autograph', 'signed', 'signature', 'auto', 'authenticated', 'certified', 'hand-signed', 'unverified'],
    category: 'special-cases',
    links: [],
    relatedIds: ['altered-cards', 'fake-cards'],
  },
  {
    id: 'altered-cards',
    question: 'What happens if my card has been altered?',
    answer:
      'Cards DCM judges to be trimmed, recolored, rebacked or re-cornered receive an Authentic Altered designation instead of a numeric grade, and the report explains what was seen. If you believe the call is wrong, re-photograph and re-grade, or request a manual review if you are eligible.',
    keywords: ['altered', 'trimmed', 'modified', 'recolored', 'rebacked', 'authentic altered', 'designation'],
    category: 'special-cases',
    links: [],
    relatedIds: ['autographed', 'fake-cards', 'manual-review'],
  },
  {
    id: 'vintage',
    question: 'Does DCM grade vintage cards?',
    answer:
      'Yes. Vintage cards are evaluated with era-appropriate context for print quality, centering norms and typical wear, and the year, set and card number are cross-checked against reference checklists. If the identification is wrong, request a free card-detail correction from the card page.',
    keywords: ['vintage', 'old', 'classic', 'retro', 'era', 'old cards', 'wax era', 'junk wax', '1950s', '1960s', 'topps'],
    category: 'special-cases',
    links: [],
    relatedIds: ['card-types', 'manual-review'],
  },
  {
    id: 'fake-cards',
    question: 'Can DCM detect fake cards?',
    answer:
      'DCM looks for manufacturer markings, copyrights and print characteristics, but counterfeits can be very good and a photo is not an authentication. Treat DCM as a condition assessment, not an authenticity guarantee, and use a local card shop, show or an authentication service when authenticity matters.',
    keywords: ['fake', 'counterfeit', 'authentic', 'authenticity', 'real', 'legit', 'legitimate', 'forgery', 'reproduction', 'proxy'],
    category: 'special-cases',
    links: [],
    relatedIds: ['altered-cards', 'autographed'],
  },

  // ── Account & Collection ──
  {
    id: 'access-cards',
    question: 'How do I find my graded cards?',
    answer:
      'Everything you grade is saved to your Collection with the full report, labels, market pricing and sharing options. You can search and filter by category, grade and name, organize cards into binders, and open any card for its detail page and verification link.',
    keywords: ['access', 'find', 'view', 'collection', 'my cards', 'where', 'results', 'graded cards', 'binder', 'search', 'filter'],
    category: 'account-collection',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['privacy', 'regrade', 'card-ownership'],
  },
  {
    id: 'privacy',
    question: 'Are my graded cards private?',
    answer:
      'You choose per card. Public cards appear on your profile, on their verification page and in the population report; private cards are visible only to you, though the QR verification link still works for anyone you share a label with. Change visibility any time from the card page or your Collection.',
    keywords: ['private', 'privacy', 'public', 'visible', 'visibility', 'share', 'hidden', 'who can see', 'profile'],
    category: 'account-collection',
    links: [],
    relatedIds: ['access-cards', 'verification'],
  },
  {
    id: 'verification',
    question: 'How does a buyer verify a DCM grade?',
    answer:
      'Every graded card has a unique serial number and a verification page, and every printed label carries a QR code that opens it. The page shows the card, its grade, the four subgrades and the graded date, so a buyer can confirm a label matches the record.',
    keywords: ['verify', 'verification', 'serial', 'qr', 'qr code', 'cert', 'certificate', 'lookup', 'check grade', 'authentic label'],
    category: 'account-collection',
    links: [],
    relatedIds: ['privacy', 'label-overview'],
  },
  {
    id: 'regrade',
    question: 'Can I re-grade a card?',
    answer:
      'Yes. Re-grading costs 1 credit and runs a completely fresh evaluation with new photos if you upload them. It is the right move when the image confidence was C or D, the photos had glare or blur, or the uncertainty range was wide. Your previous grade is replaced by the new one.',
    keywords: ['regrade', 're-grade', 'again', 'redo', 'retry', 'new grade', 'second opinion', 'new photos'],
    category: 'account-collection',
    links: [{ label: 'Go to collection', href: '/collection' }],
    relatedIds: ['consistency', 'image-confidence', 'manual-review'],
  },
  {
    id: 'card-ownership',
    question: 'What happens when I sell or give away a card?',
    answer:
      'Mark it as sold from the card page or your Collection instead of deleting it. Sold cards move out of your active portfolio but keep their record, so the label and verification page a buyer scans still work. Deleting a card permanently removes its grade, report and verification page.',
    keywords: ['sold', 'sell', 'delete', 'remove', 'archive', 'archived', 'ownership', 'gave away', 'traded'],
    category: 'account-collection',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['access-cards', 'instalist', 'verification'],
  },
  {
    id: 'my-account',
    question: 'Where do I manage my account, credits and membership?',
    answer:
      'The My Account page shows your credit balance and purchase history, your Card Lovers status with cancel and resume options, your label style defaults, emblem preferences and profile settings.',
    keywords: ['account', 'my account', 'credits purchased', 'subscription', 'billing', 'plan', 'settings', 'profile', 'cancel', 'manage', 'password'],
    category: 'account-collection',
    links: [{ label: 'My Account', href: '/account' }],
    relatedIds: ['card-lovers', 'pricing'],
  },
  {
    id: 'pop-report',
    question: 'Does DCM have a population report?',
    answer:
      'Yes, and it is public. The population report shows how many cards DCM has graded by category, set and grade, so you can see how rare a 10 is for a given card. Only public cards count toward it.',
    keywords: ['pop', 'population', 'pop report', 'how many', 'rarity', 'census', 'graded count'],
    category: 'account-collection',
    links: [{ label: 'Population report', href: '/pop' }],
    relatedIds: ['privacy'],
  },
  {
    id: 'contact-support',
    question: 'How do I contact support?',
    answer:
      'Email admin@dcmgrading.com or use the Contact page. We read every message and usually reply within a day. Include the card link or serial number when you write about a specific grade.',
    keywords: ['contact', 'support', 'help', 'email', 'admin', 'question', 'issue', 'problem', 'reach', 'bug'],
    category: 'account-collection',
    links: [
      { label: 'Contact page', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
    relatedIds: [],
  },

  // ── Labels & Reports ──
  {
    id: 'label-overview',
    question: 'What labels and reports can I print?',
    answer:
      'Every graded card comes with a slab label in Modern, Traditional or Heritage style, a fold-over label for magnetic one-touch holders, compact labels for top loaders, a full condition report PDF, a mini report and card images with the grade overlay. Open the card page and choose Labels or Reports, or open Label Studio to customize colors, emblems and layout.',
    keywords: ['print', 'label', 'labels', 'download', 'report', 'pdf', 'how to print', 'where', 'find labels', 'get labels', 'heritage', 'modern', 'traditional', 'label studio'],
    category: 'printing-labels',
    links: [
      { label: 'Reports & labels', href: '/reports-and-labels' },
      { label: 'Label Studio', href: '/labels' },
    ],
    relatedIds: ['label-slab', 'label-onetouch', 'label-batch', 'verification'],
  },
  {
    id: 'label-slab',
    question: 'What size are the slab labels and what do I print them on?',
    answer:
      'Standard slab labels are 2.8" by 0.8", the common insert size for graded-card style holders, and print front and back on Letter paper with cut guides, 10 per sheet, or 20 per sheet with the "Labels per sheet" option in the print dialog. There is also a Zion Mag Pro size, 2.51" by 0.76", for that holder’s smaller slot. Print at 100% scale on label stock or cardstock and cut along the guides.',
    keywords: ['slab', 'slab label', 'size', '2.8', 'zion', 'mag pro', '20 per sheet', '10 per sheet', 'sheet', 'duplex', 'cut', 'cardstock', 'label stock'],
    category: 'printing-labels',
    links: [{ label: 'Reports & labels', href: '/reports-and-labels' }],
    relatedIds: ['label-overview', 'label-batch'],
  },
  {
    id: 'label-onetouch',
    question: 'What labels work for magnetic one-touch holders and top loaders?',
    answer:
      'For magnetic one-touch holders use the fold-over label: it folds over the top edge so the front shows the grade and the back carries the QR code. Avery 6871 sheets are recommended. For top loaders use the compact front and back labels on Avery 8167 sheets. Both are on every card page and in batch printing.',
    keywords: ['avery', '6871', '8167', 'one-touch', 'one touch', 'magnetic', 'fold', 'foldable', 'fold-over', 'toploader', 'top loader', 'template', 'apply', 'stick'],
    category: 'printing-labels',
    links: [{ label: 'Reports & labels', href: '/reports-and-labels' }],
    relatedIds: ['label-overview', 'label-batch'],
  },
  {
    id: 'label-batch',
    question: 'Can I print labels for many cards at once?',
    answer:
      'Yes. Select cards in your Collection and choose Print Labels to build one PDF for the whole selection in any label style, with the sheet layout and duplex back pages handled for you. The mobile apps can print batches too.',
    keywords: ['batch', 'bulk', 'multiple', 'many', 'sheet', 'collection', 'several', 'print all'],
    category: 'printing-labels',
    links: [{ label: 'Go to collection', href: '/collection' }],
    relatedIds: ['label-overview', 'label-slab'],
  },

  // ── Selling on eBay ──
  {
    id: 'instalist',
    question: 'What is InstaList?',
    answer:
      'InstaList creates an eBay listing from a graded card in one step. Connect your eBay seller account once, then from any card page choose List on eBay: DCM builds the title and item specifics from the card data, generates the photos (labeled front and back, raw photos and a mini report), fills in your saved shipping and return settings, and publishes. Sold listings can mark the card as sold automatically.',
    keywords: ['instalist', 'ebay', 'list', 'listing', 'sell', 'selling', 'marketplace', 'post', 'auction', 'buy it now'],
    category: 'selling-instalist',
    links: [{ label: 'InstaList marketplace', href: '/instalist-marketplace' }],
    relatedIds: ['instalist-bulk', 'instalist-errors', 'card-ownership'],
  },
  {
    id: 'instalist-bulk',
    question: 'Can I list many cards on eBay at once?',
    answer:
      'Yes. Bulk listing lets you pick up to 100 graded cards, review every title, price and photo set in one screen, then publish the whole batch; DCM works through it in the background and shows progress. You can pause, cancel or delete a batch, and fix and retry any card that eBay rejects.',
    keywords: ['bulk', 'batch', 'many', 'multiple', 'list all', 'mass', '100', 'queue', 'draft batch'],
    category: 'selling-instalist',
    links: [{ label: 'InstaList marketplace', href: '/instalist-marketplace' }],
    relatedIds: ['instalist', 'instalist-errors'],
  },
  {
    id: 'instalist-errors',
    question: 'Why did my eBay listing fail?',
    answer:
      'The most common cause is the eBay account itself: eBay requires a completed seller registration with a payout method and identity verification before it accepts listings from any tool, and returns "you need to create a seller’s account" until that is done. Fix it on eBay.com under My eBay, Selling, then try again. Other errors, such as a title naming another grading company or a missing required item specific, are shown in the listing dialog with what to change.',
    keywords: ['error', 'failed', 'fail', 'rejected', 'seller account', 'not allowing', 'cannot list', 'listing error', 'eBay error', 'reconnect', 'token'],
    category: 'selling-instalist',
    links: [{ label: 'Contact support', href: '/contact' }],
    relatedIds: ['instalist', 'instalist-bulk'],
  },

  // ── Mobile Apps ──
  {
    id: 'mobile-apps',
    question: 'Is there a DCM app?',
    answer:
      'Yes, for iPhone and Android, with the same account and credits as the web. The apps guide each photo with the camera, grade in the background, and include your Collection, labels, portfolio and InstaList. Credit packs are bought inside the iOS app through the App Store; Card Lovers membership is purchased on the web and works everywhere.',
    keywords: ['app', 'apps', 'mobile', 'iphone', 'ios', 'android', 'app store', 'google play', 'download', 'phone'],
    category: 'mobile-apps',
    links: [
      { label: 'iPhone app', href: 'https://apps.apple.com/us/app/dcm-grading/id6768663163' },
      { label: 'Android app', href: 'https://play.google.com/store/apps/details?id=com.dcmgrading.app' },
    ],
    relatedIds: ['photo-tips', 'pricing', 'card-lovers'],
  },

  // ── Shops & Enterprise ──
  {
    id: 'enterprise',
    question: 'Do you offer plans for card shops, breakers and dealers?',
    answer:
      'Yes. Dealer and Enterprise plans give a business pooled monthly credits at the best per-card rates, a branded storefront and Enterprise Page, your own serial registry, and the Label Designer to put your logo and colors on Heritage labels, including a band-free layout with a large logo. Apply from the Enterprise page and we will set you up.',
    keywords: ['enterprise', 'dealer', 'shop', 'store', 'breaker', 'business', 'white label', 'white-label', 'branded', 'storefront', 'wholesale', 'volume', 'partner', 'label designer'],
    category: 'enterprise',
    links: [{ label: 'Enterprise plans', href: '/enterprise' }, { label: 'Apply', href: '/enterprise/apply' }],
    relatedIds: ['pricing', 'label-overview'],
  },
  {
    id: 'affiliates',
    question: 'Do you have an affiliate program?',
    answer:
      'Yes. Affiliates get a link and code that gives their audience 10% off a first DCM purchase and earn a commission on every sale they refer, with tracking and payouts in the affiliate dashboard.',
    keywords: ['affiliate', 'referral', 'refer', 'commission', 'creator', 'influencer', 'youtube', 'partner program', 'link'],
    category: 'enterprise',
    links: [{ label: 'Affiliate program', href: '/affiliates' }],
    relatedIds: ['promo-codes'],
  },
]

export function getEntriesByCategory(category: Category): KnowledgeEntry[] {
  return knowledgeBase.filter((e) => e.category === category)
}

export function getEntryById(id: string): KnowledgeEntry | undefined {
  return knowledgeBase.find((e) => e.id === id)
}

export function getRelatedEntries(entry: KnowledgeEntry): KnowledgeEntry[] {
  return entry.relatedIds
    .map((id) => getEntryById(id))
    .filter((e): e is KnowledgeEntry => e !== undefined)
}
