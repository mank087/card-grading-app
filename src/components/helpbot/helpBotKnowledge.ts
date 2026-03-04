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
  { id: 'printing-labels', label: 'Printing Labels', emoji: '\u{1F3F7}\uFE0F' },
]

export const knowledgeBase: KnowledgeEntry[] = [
  // ── Getting Started ──
  {
    id: 'what-is-dcm',
    question: 'What is DCM Grading?',
    answer:
      'DCM Grading is an AI-powered card grading service that uses DCM Optic\u2122 technology to evaluate your trading cards in under 60 seconds. Upload front and back photos, and our three-pass consensus system delivers a professional-quality grade instantly.',
    keywords: ['what', 'dcm', 'grading', 'about', 'service', 'ai', 'optic'],
    category: 'getting-started',
    links: [{ label: 'Learn more', href: '/faq' }],
    relatedIds: ['how-it-works', 'card-types'],
  },
  {
    id: 'how-it-works',
    question: 'How does DCM Grading work?',
    answer:
      'Upload front and back photos of your card. Our system runs three independent evaluations using DCM Optic\u2122, then combines them using consensus rules. You get a final grade (1\u201310), eight component scores, a consistency rating, and detailed defect notes\u2014all in about 60 seconds.',
    keywords: ['how', 'work', 'process', 'steps', 'upload', 'three-pass', 'consensus'],
    category: 'getting-started',
    links: [{ label: 'Start grading', href: '/upload' }],
    relatedIds: ['what-is-dcm', 'three-pass', 'component-scores'],
  },
  {
    id: 'card-types',
    question: 'What types of cards can DCM grade?',
    answer:
      'DCM supports Sports cards (baseball, basketball, football, hockey, soccer), Pok\u00e9mon, Magic: The Gathering, Disney Lorcana, One Piece TCG, and other trading cards. Select your card type when uploading for the most accurate evaluation.',
    keywords: ['types', 'cards', 'sports', 'pokemon', 'mtg', 'magic', 'lorcana', 'one piece', 'supported'],
    category: 'getting-started',
    links: [{ label: 'Grade a card', href: '/upload' }],
    relatedIds: ['what-is-dcm'],
  },
  {
    id: 'how-long',
    question: 'How long does grading take?',
    answer:
      'Most cards are graded in 30\u201360 seconds. Cards with complex surfaces or multiple defects may take slightly longer. You\'ll see a progress indicator while grading is in process.',
    keywords: ['how long', 'time', 'speed', 'fast', 'seconds', 'minutes', 'duration', 'wait'],
    category: 'getting-started',
    links: [],
    relatedIds: ['how-it-works'],
  },

  // ── Grading & Scores ──
  {
    id: 'grading-scale',
    question: 'What grading scale does DCM use?',
    answer:
      'DCM uses a 10-point scale: 10 = Gem Mint, 9 = Mint, 8 = Near Mint-Mint, 7 = Near Mint, 6 = Excellent-Mint, 5 = Excellent, and lower grades for increasing wear. Grades are whole numbers from 1\u201310.',
    keywords: ['scale', 'grade', 'number', '10', 'gem mint', 'mint', 'near mint', 'score', 'range'],
    category: 'grading-scores',
    links: [{ label: 'Grading rubric', href: '/grading-rubric' }],
    relatedIds: ['component-scores', 'grade-caps'],
  },
  {
    id: 'component-scores',
    question: 'What are component scores?',
    answer:
      'Each card receives 8 component scores: Centering, Corners, Edges, and Surface for both front and back. The front is weighted 55% and the back 45%. These combine into your final overall grade.',
    keywords: ['component', 'scores', 'centering', 'corners', 'edges', 'surface', 'front', 'back', 'weight', 'subgrades'],
    category: 'grading-scores',
    links: [{ label: 'View rubric details', href: '/grading-rubric' }],
    relatedIds: ['grading-scale', 'centering'],
  },
  {
    id: 'three-pass',
    question: 'What is three-pass consensus grading?',
    answer:
      'Three independent AI evaluations analyze your card separately. A defect must be confirmed by at least 2 of 3 passes to count. This eliminates false positives, reduces variance, and produces more reliable grades than a single evaluation.',
    keywords: ['three-pass', 'consensus', 'passes', 'independent', 'evaluation', 'accuracy', 'reliable'],
    category: 'grading-scores',
    links: [{ label: 'Learn more', href: '/faq#three-pass' }],
    relatedIds: ['how-it-works', 'consistency'],
  },
  {
    id: 'consistency',
    question: 'What does the consistency score mean?',
    answer:
      'The consistency score shows how closely the three passes agreed. High consistency (\u00b10.5) means strong agreement. Moderate (\u00b11.0) means minor differences. Low (>1.0) means notable disagreement\u2014consider re-grading with better photos.',
    keywords: ['consistency', 'agreement', 'confidence', 'high', 'moderate', 'low', 'variance', 'passes agree'],
    category: 'grading-scores',
    links: [],
    relatedIds: ['three-pass', 'regrade'],
  },
  {
    id: 'centering',
    question: 'What centering standards does DCM use?',
    answer:
      'DCM follows industry-standard centering measurements. For Gem Mint (10), the front must be within 55/45 and the back within 75/25. More lenient centering thresholds apply for lower grades.',
    keywords: ['centering', 'alignment', 'off-center', '55/45', '75/25', 'standard'],
    category: 'grading-scores',
    links: [{ label: 'Full centering standards', href: '/grading-rubric' }],
    relatedIds: ['component-scores', 'grading-scale'],
  },
  {
    id: 'grade-caps',
    question: 'What are grade caps?',
    answer:
      'Certain structural defects automatically cap your grade regardless of other scores. Creases, corner lifts, tears, and severe bends each have maximum grade thresholds that cannot be exceeded.',
    keywords: ['cap', 'caps', 'maximum', 'crease', 'tear', 'bend', 'corner lift', 'structural', 'defect', 'limit'],
    category: 'grading-scores',
    links: [{ label: 'View grade cap details', href: '/grading-rubric' }],
    relatedIds: ['grading-scale', 'component-scores'],
  },
  {
    id: 'evidence-based',
    question: 'What does "evidence-based grading" mean?',
    answer:
      'Every defect DCM reports must be backed by observable evidence in your photos. Each finding includes the defect type, location, severity, and confidence level. No guessing\u2014if we can\'t see it, we don\'t deduct for it.',
    keywords: ['evidence', 'based', 'observable', 'defect', 'proof', 'transparent', 'findings'],
    category: 'grading-scores',
    links: [],
    relatedIds: ['three-pass', 'image-confidence'],
  },
  {
    id: 'unexpected-grade',
    question: 'What if a card scores higher or lower than I expect it to?',
    answer:
      'The DCM system is dependent on the images uploaded to be clear of visual issues like blur and glare to ensure the highest accuracy possible. If a grade is very far off from what is expected, try to re-grade that card with better lighting and a neutral contrasting background. Also, be sure to properly enter any defects or issues with the card that the photos may not see like warping, scratches, angular defects, etc.',
    keywords: ['unexpected', 'higher', 'lower', 'expect', 'wrong grade', 'too high', 'too low', 'surprised', 'disagree'],
    category: 'grading-scores',
    links: [],
    relatedIds: ['regrade', 'photo-tips', 'image-confidence'],
  },

  // ── Photo Tips ──
  {
    id: 'photo-tips',
    question: 'How should I photograph my cards?',
    answer:
      'Use natural, diffused lighting (no flash). Place the card flat on a contrasting background. Fill the frame with the card. Ensure sharp focus and avoid shadows. Remove from holders if possible. Photograph both front and back.',
    keywords: ['photo', 'photograph', 'picture', 'camera', 'lighting', 'tips', 'how to', 'best', 'image'],
    category: 'photo-tips',
    links: [{ label: 'Full photo guide', href: '/faq#image-quality' }],
    relatedIds: ['image-confidence', 'sleeves-toploaders', 'image-formats'],
  },
  {
    id: 'image-confidence',
    question: 'What is the image confidence rating?',
    answer:
      'Image confidence (A\u2013D) indicates how well DCM could see your card. A (95\u2013100%) means excellent visibility. B (85\u201394%) is good. C (70\u201384%) means partial obstruction. D (<70%) means significant issues\u2014consider re-photographing.',
    keywords: ['confidence', 'image', 'rating', 'quality', 'visibility', 'A', 'B', 'C', 'D', 'grade'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'regrade'],
  },
  {
    id: 'sleeves-toploaders',
    question: 'Can I grade cards in sleeves or top loaders?',
    answer:
      'Yes! Penny sleeves work well. Top loaders are acceptable but may cause minor reflections. Thick magnetic holders can reduce image clarity. For best results, remove the card from its holder before photographing.',
    keywords: ['sleeve', 'toploader', 'top loader', 'holder', 'penny', 'magnetic', 'case', 'protected'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'slabs'],
  },
  {
    id: 'slabs',
    question: 'Can DCM grade cards already in graded slabs?',
    answer:
      'Yes, DCM can grade slabbed cards from any mail-away grading company. We detect the slab and grade the card independently. Note that thick slab plastic may reduce image clarity, which could affect the image confidence rating.',
    keywords: ['slab', 'slabbed', 'encased', 'graded', 'already graded', 'reholder', 'mail-away'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['sleeves-toploaders', 'image-confidence'],
  },
  {
    id: 'image-formats',
    question: 'What image formats are supported?',
    answer:
      'DCM accepts JPEG, PNG, HEIC, and WebP formats. For best results, use images at least 1000\u00d71400 pixels. Phone cameras work great\u2014just make sure the photo is in focus and well-lit.',
    keywords: ['format', 'jpeg', 'png', 'heic', 'webp', 'resolution', 'pixels', 'size', 'file type'],
    category: 'photo-tips',
    links: [],
    relatedIds: ['photo-tips', 'phone-upload'],
  },
  {
    id: 'phone-upload',
    question: 'Can I upload from my phone?',
    answer:
      'Yes! DCM is fully mobile-friendly. You can take photos directly from your phone camera and upload them right away. The mobile experience is optimized for easy grading on the go.',
    keywords: ['phone', 'mobile', 'upload', 'camera', 'iphone', 'android', 'smartphone'],
    category: 'photo-tips',
    links: [{ label: 'Start grading', href: '/upload' }],
    relatedIds: ['photo-tips', 'image-formats'],
  },

  // ── Pricing & Credits ──
  {
    id: 'pricing',
    question: 'How much does DCM Grading cost?',
    answer:
      'DCM uses a credit system\u2014one credit per grade. Packages: Basic ($2.99/1 credit), Pro ($9.99/5 credits), Elite ($19.99/20 credits), VIP ($99/150 credits). The more you buy, the more you save per grade.',
    keywords: ['price', 'cost', 'credit', 'credits', 'how much', 'package', 'basic', 'pro', 'elite', 'vip', 'buy'],
    category: 'pricing-credits',
    links: [{ label: 'View packages', href: '/credits' }],
    relatedIds: ['card-lovers', 'free-trial'],
  },
  {
    id: 'card-lovers',
    question: 'What is the Card Lovers subscription?',
    answer:
      'Card Lovers is our premium subscription. Monthly ($49.99) includes 70 credits plus exclusive access to Market Pricing data, Pop Reports, and featured cards. Annual ($449) includes 900 credits\u2014the best per-credit value available.',
    keywords: ['card lovers', 'subscription', 'monthly', 'annual', 'premium', 'market pricing', 'exclusive', 'member'],
    category: 'pricing-credits',
    links: [{ label: 'Subscribe', href: '/credits' }],
    relatedIds: ['pricing', 'market-pricing'],
  },
  {
    id: 'free-trial',
    question: 'Is there a free trial?',
    answer:
      'New accounts receive complimentary credits so you can try DCM risk-free. Sign up and start grading immediately\u2014no credit card required for your first grades.',
    keywords: ['free', 'trial', 'complimentary', 'credits', 'new account', 'try', 'sign up', 'no cost'],
    category: 'pricing-credits',
    links: [{ label: 'Sign up free', href: '/get-started' }],
    relatedIds: ['pricing'],
  },
  {
    id: 'market-pricing',
    question: 'How does Market Pricing work?',
    answer:
      'Market Pricing provides real card values sourced from PriceCharting and SportsCardsPro, based on actual sales data across both raw and graded cards. DCM also provides its own estimated value calculated as a function of raw and graded sales data. This feature is exclusive to Card Lovers subscribers and updates regularly. You can view pricing on each card\'s detail page in the Market Pricing section.',
    keywords: ['market', 'pricing', 'value', 'price', 'ebay', 'estimate', 'worth', 'how much worth', 'sold'],
    category: 'pricing-credits',
    links: [{ label: 'Learn about Card Lovers', href: '/credits' }],
    relatedIds: ['card-lovers', 'collection-pricing', 'parallel-mismatch'],
  },
  {
    id: 'collection-pricing',
    question: 'How do I see the value of my collection?',
    answer:
      'Card Lovers subscribers can view estimated values for each graded card and see their total collection value on the Collection page and in the Market Pricing dashboard. For non-Card Lovers, pricing will show per card in the card details page and on the Collection page. Pricing is based on recent market data matched to each card\'s grade.',
    keywords: ['collection', 'value', 'total', 'portfolio', 'worth', 'price', 'estimate'],
    category: 'pricing-credits',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['market-pricing', 'card-lovers'],
  },
  {
    id: 'parallel-mismatch',
    question: 'What if my card\'s parallel or variant isn\'t matched correctly?',
    answer:
      'Sometimes DCM may not perfectly identify a card\'s specific parallel (e.g., holo, reverse holo, full art) which may have an impact on estimated card value. You can fix this yourself on the card\'s detail page. Scroll to the Market Pricing section and use the dropdown to manually select the correct parallel from the list when available. This updates the pricing to match the right version of your card.',
    keywords: ['parallel', 'variant', 'wrong card', 'mismatch', 'holo', 'reverse holo', 'full art', 'incorrect', 'wrong version', 'update parallel'],
    category: 'pricing-credits',
    links: [],
    relatedIds: ['market-pricing', 'collection-pricing'],
  },

  // ── DCM vs Mail-Away Grading ──
  {
    id: 'dcm-vs-mailaway',
    question: 'How does DCM compare to mail-away grading companies?',
    answer:
      'DCM provides instant AI-powered grades aligned with professional industry standards, but at a fraction of the cost and time. Use DCM for pre-screening before submitting to a mail-away grading company, or as an independent assessment for personal collecting and trading.',
    keywords: ['compare', 'difference', 'vs', 'versus', 'better', 'professional', 'mail-away', 'mail away', 'traditional'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'Full comparison', href: '/faq#accuracy' }],
    relatedIds: ['accuracy', 'grade-differs'],
  },
  {
    id: 'accuracy',
    question: 'How accurate are DCM grades?',
    answer:
      'DCM uses three-pass consensus, evidence-based grading, and industry-aligned standards to maximize accuracy. While no photo-based system is identical to physical inspection, DCM provides a reliable assessment that aligns closely with mail-away graders.',
    keywords: ['accurate', 'accuracy', 'reliable', 'correct', 'trustworthy', 'how good', 'precision'],
    category: 'dcm-vs-mailaway',
    links: [],
    relatedIds: ['three-pass', 'evidence-based', 'grade-differs'],
  },
  {
    id: 'grade-differs',
    question: 'What if my DCM grade differs from a professional grade?',
    answer:
      'Differences can arise from image limitations (photo vs. physical inspection), natural subjectivity in grading, different standard interpretations, and grading shifts over time. Consider re-grading with better photos, or use DCM as a complement to mail-away grading services.',
    keywords: ['differ', 'different', 'wrong', 'disagree', 'mismatch', 'inaccurate', 'not match', 'off'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'FAQ details', href: '/faq#accuracy' }],
    relatedIds: ['accuracy', 'regrade'],
  },
  {
    id: 'why-dcm',
    question: 'Why should I use DCM instead of traditional grading?',
    answer:
      'Speed (60 seconds vs. weeks), cost (as low as $0.50 per card vs. $20\u2013$150+), convenience (grade from home), transparency (see exactly what was found), and unlimited re-grades. DCM is ideal for pre-screening, personal collections, and quick assessments.',
    keywords: ['why', 'advantage', 'benefit', 'better', 'instead', 'reason', 'worth it'],
    category: 'dcm-vs-mailaway',
    links: [{ label: 'Start grading', href: '/upload' }],
    relatedIds: ['dcm-vs-mailaway', 'pricing'],
  },

  // ── Special Cases ──
  {
    id: 'autographed',
    question: 'Can DCM grade autographed cards?',
    answer:
      'Yes! Manufacturer-authenticated autographs (e.g., Topps Certified) are graded normally. For cards with unverified or hand-signed autographs, DCM grades the card condition but assigns N/A for authentication.',
    keywords: ['autograph', 'signed', 'signature', 'auto', 'authenticated', 'certified', 'hand-signed'],
    category: 'special-cases',
    links: [],
    relatedIds: ['altered-cards'],
  },
  {
    id: 'altered-cards',
    question: 'What happens if my card has been altered?',
    answer:
      'Cards with alterations (trimming, recoloring, rebacking, re-cornering) receive an N/A designation. DCM detects common forms of alteration and will flag them in the grading report rather than assigning a numeric grade.',
    keywords: ['altered', 'trimmed', 'fake', 'counterfeit', 'modified', 'recolored', 'rebacked'],
    category: 'special-cases',
    links: [],
    relatedIds: ['autographed'],
  },
  {
    id: 'vintage',
    question: 'Does DCM grade vintage cards?',
    answer:
      'Yes! DCM accounts for era-appropriate standards and vintage manufacturing variations. Older cards are evaluated with context for typical centering, print quality, and wear patterns of their era.',
    keywords: ['vintage', 'old', 'classic', 'retro', 'era', 'old cards', 'wax era', 'junk wax'],
    category: 'special-cases',
    links: [],
    relatedIds: ['card-types', 'grading-scale'],
  },
  {
    id: 'fake-cards',
    question: 'Can DCM determine fake cards?',
    answer:
      'DCM looks for manufacturer authentication, copyrights, and related authenticity markings. Counterfeit or fake cards can be hard to spot and DCM may not always accurately determine the authenticity of a card. Check with your local card store or convention for true authenticity analysis.',
    keywords: ['fake', 'counterfeit', 'authentic', 'authenticity', 'real', 'legit', 'legitimate', 'forgery', 'reproduction'],
    category: 'special-cases',
    links: [],
    relatedIds: ['altered-cards', 'autographed'],
  },

  // ── Account & Collection ──
  {
    id: 'access-cards',
    question: 'How do I access my graded cards?',
    answer:
      'All graded cards are saved in your Collection. From there you can view detailed results, download grade labels, share cards publicly, and track your collection\'s value over time.',
    keywords: ['access', 'find', 'view', 'collection', 'my cards', 'where', 'results', 'graded cards'],
    category: 'account-collection',
    links: [{ label: 'View collection', href: '/collection' }],
    relatedIds: ['privacy', 'regrade'],
  },
  {
    id: 'privacy',
    question: 'Are my graded cards private?',
    answer:
      'You control the visibility of each card. Cards can be set to Public (visible on your profile and in Pop Reports) or Private (only visible to you). You can change this anytime from your collection.',
    keywords: ['private', 'privacy', 'public', 'visible', 'visibility', 'share', 'hidden', 'who can see'],
    category: 'account-collection',
    links: [],
    relatedIds: ['access-cards'],
  },
  {
    id: 'regrade',
    question: 'Can I re-grade a card?',
    answer:
      'Yes! Re-grading costs 1 credit and runs a completely fresh evaluation. It\'s recommended if your original photos had poor lighting, the image confidence was low, or you want a second opinion.',
    keywords: ['regrade', 're-grade', 'again', 'redo', 'retry', 'new grade', 'second opinion'],
    category: 'account-collection',
    links: [{ label: 'Go to collection', href: '/collection' }],
    relatedIds: ['consistency', 'image-confidence'],
  },
  {
    id: 'my-account',
    question: 'How do I view My Account, credits purchased, and Subscription information?',
    answer:
      'All account details including Card Lovers subscription status is found in the My Account page.',
    keywords: ['account', 'my account', 'credits purchased', 'subscription', 'billing', 'plan', 'settings', 'profile'],
    category: 'account-collection',
    links: [{ label: 'My Account', href: '/account' }],
    relatedIds: ['card-lovers', 'pricing'],
  },
  {
    id: 'contact-support',
    question: 'How do I contact support?',
    answer:
      'Email us at admin@dcmgrading.com or use the Contact page. We typically respond within 24\u201348 hours. For faster answers, check our FAQ page which covers most common questions.',
    keywords: ['contact', 'support', 'help', 'email', 'admin', 'question', 'issue', 'problem', 'reach'],
    category: 'account-collection',
    links: [
      { label: 'Contact page', href: '/contact' },
      { label: 'View FAQ', href: '/faq' },
    ],
    relatedIds: [],
  },

  // ── Printing Labels ──
  {
    id: 'label-overview',
    question: 'How do I print labels for my graded cards?',
    answer:
      'Go to any card\'s detail page and click the download button to access label options. You can download a Foldable Slab Label (for magnetic one-touch holders), a Full Grading Report (PDF), a Mini Report (JPG), or card images with grade overlays. For bulk printing, visit your Collection page to print up to 18 labels per sheet.',
    keywords: ['print', 'label', 'labels', 'download', 'how to print', 'where', 'find labels', 'get labels'],
    category: 'printing-labels',
    links: [
      { label: 'Reports & Labels guide', href: '/reports-and-labels' },
      { label: 'View collection', href: '/collection' },
    ],
    relatedIds: ['label-avery-slab', 'label-avery-toploader', 'label-batch'],
  },
  {
    id: 'label-avery-slab',
    question: 'What labels should I use for magnetic one-touch slabs?',
    answer:
      'Use Avery 6871 labels (2-3/8" \u00d7 1-1/4", 18 per sheet). Print the Foldable Slab Label from your card\'s detail page. The label is designed to fold over the top edge of a magnetic one-touch holder. Peel the label, align it with the top edge of the slab, and fold it over so the front shows the grade and the back has a QR code for verification.',
    keywords: ['avery', '6871', 'slab', 'one-touch', 'magnetic', 'fold', 'foldable', 'one touch', 'template'],
    category: 'printing-labels',
    links: [{ label: 'Reports & Labels guide', href: '/reports-and-labels' }],
    relatedIds: ['label-overview', 'label-avery-toploader', 'label-batch'],
  },
  {
    id: 'label-avery-toploader',
    question: 'What labels should I use for top loaders?',
    answer:
      'Use Avery 8167 template labels for top loaders. These print out front and back labels that can be applied to a top loader. The labels have a card identifier, grade, and QR code that links to the full card details page.',
    keywords: ['avery', '8167', 'toploader', 'top loader', 'mini report', 'insert', 'cut'],
    category: 'printing-labels',
    links: [{ label: 'Reports & Labels guide', href: '/reports-and-labels' }],
    relatedIds: ['label-overview', 'label-avery-slab'],
  },
  {
    id: 'label-batch',
    question: 'Can I print labels for multiple cards at once?',
    answer:
      'Yes! Go to your Collection page and use the batch label printing feature. Select up to 18 cards, arrange them on a 3\u00d76 grid with drag-and-drop, and download a single PDF sheet. If you have more than 18 cards, the PDF automatically paginates across multiple pages. Use Avery 6871 label sheets for best results.',
    keywords: ['batch', 'bulk', 'multiple', 'many', 'sheet', 'collection', '18', 'several'],
    category: 'printing-labels',
    links: [{ label: 'Go to collection', href: '/collection' }],
    relatedIds: ['label-overview', 'label-avery-slab'],
  },
  {
    id: 'label-apply',
    question: 'How do I apply a label to my slab or top loader?',
    answer:
      'For magnetic one-touch slabs: Print on Avery 6871, peel the label, center it along the top edge of the holder, and fold it over\u2014the front displays the grade and card info, the back has the QR code. For top loaders: Print the Avery 8167 front and back labels and apply them to the top loader. Make sure the labels are straight and fully adhered before displaying.',
    keywords: ['apply', 'stick', 'attach', 'put on', 'fold', 'how to apply', 'instructions'],
    category: 'printing-labels',
    links: [{ label: 'Reports & Labels guide', href: '/reports-and-labels' }],
    relatedIds: ['label-avery-slab', 'label-avery-toploader'],
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
