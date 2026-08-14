/**
 * Default storefront "How it works" steps and FAQ entries.
 *
 * Every store inherits these until it customizes them in /store/settings.
 * The FAQ defaults double as compliance guardrails: they describe AI-assisted
 * grading, verification, and store-assembled slabs accurately so stores don't
 * have to improvise claims (see Enterprise Program Terms §3).
 * Client-safe: plain constants only.
 */

export interface HowItWorksStep {
  title: string
  body: string
}

export interface FaqEntry {
  q: string
  a: string
}

export const DEFAULT_ABOUT_TITLE = 'Professional grading, in-store'

export const DEFAULT_ABOUT_BULLETS: string[] = [
  'Graded on-site, so your card never gets mailed away',
  'Four sub-grades with a full condition report',
  'Serialized label with scan-to-verify authenticity',
]

export const DEFAULT_HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: 'Bring your cards in',
    body: 'No shipping, no forms, no waiting weeks. Bring your cards to the counter: Pokémon, sports, Magic, One Piece, Lorcana, Yu-Gi-Oh! and more.',
  },
  {
    title: 'Graded in minutes',
    body: 'Your card is photographed and graded on the spot with sub-grades for centering, corners, edges, and surface, all while you wait.',
  },
  {
    title: 'Sealed and serialized',
    body: 'Your graded card is sealed in a protective slab with a printed label carrying its grade, a unique serial number, and a verification QR code.',
  },
  {
    title: 'Verify anytime',
    body: "Scan the QR code on any of our slabs, or enter the serial on this page, to see the card's photos, grade, and full condition report.",
  },
]

export const DEFAULT_FAQS: FaqEntry[] = [
  {
    q: 'How does the grading work?',
    a: 'We grade in-store using DCM Optic™, an AI-assisted visual grading system. Your card is photographed front and back and analyzed for centering, corners, edges, and surface, producing a 1 to 10 grade with four sub-grades and a written condition report, in minutes instead of months.',
  },
  {
    q: 'How do I verify a card you graded?',
    a: 'Every slab we produce carries a unique serial number and a QR code. Scan the QR or enter the serial in the lookup on this page to see the exact photos taken at grading, the grade and sub-grades, and the full report. What you see in the registry is what was graded.',
  },
  {
    q: 'What do the sub-grades mean?',
    a: "Centering measures how evenly the card is cut; corners, edges, and surface measure visible wear and defects in each area. The overall grade reflects the card's weakest area, because a card is only as strong as its weakest attribute.",
  },
  {
    q: 'Is this the same as PSA or other mail-in grading?',
    a: "It's a different service with different strengths: grades are produced by an independent AI-assisted system, in minutes, at a fraction of mail-in cost. Many collectors grade with us first to decide which cards are worth an expensive mail-in submission, and keep the rest in our slabs.",
  },
  {
    q: 'Does grading include authentication?',
    a: 'No. Grading evaluates the visible condition of the card. It does not determine whether a card is genuine, altered, or counterfeit. The verification registry does let any buyer confirm exactly what was photographed and graded.',
  },
]
