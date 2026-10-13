/**
 * /labels guide copy: what DCM labels are, how the wizard works, the holders
 * and sizes, customization, print tips and an FAQ. Server component, rendered
 * below the wizard so the copy is in the initial HTML (SEO/AEO) and is pushed
 * down the page as the wizard's steps grow.
 *
 * Step names, holder sizes, Avery stock, per-sheet counts, the card cap and
 * the band patterns all come from the wizard's own constants, so this copy
 * can't drift from what the tool actually does.
 */

import Link from 'next/link'
import { BAND_PATTERNS } from '@/lib/labelLab/bandGeometry'
import {
  CARDS_PER_SHEET,
  HOLDERS,
  MAX_WIZARD_CARDS,
  SLAB_SIZES,
  STEPS,
  type WizardStep,
} from './wizardTypes'

const PAGE_URL = 'https://dcmgrading.com/labels'
const UPDATED_LABEL = 'Updated October 2026'
const UPDATED_ISO = '2026-10-13'

const standard = SLAB_SIZES.find((s) => s.id === 'standard')!
const zion = SLAB_SIZES.find((s) => s.id === 'zion')!
const holder = (id: (typeof HOLDERS)[number]['id']) => HOLDERS.find((h) => h.id === id)!
const inches = (w: number, h: number) => `${w} × ${h} inches`
/** Table cells match HOLDERS' own dimension style: 2.8" × 0.8" */
const inchMarks = (w: number, h: number) => `${w}" × ${h}"`
const patternNames = BAND_PATTERNS.map((p) => p.name.toLowerCase())

/** What each wizard step does, keyed by step number. */
const STEP_COPY: Record<WizardStep, string> = {
  1: `Pick up to ${MAX_WIZARD_CARDS} DCM-graded cards from your collection. Signed-out visitors design with sample graded cards.`,
  2: 'Choose a graded slab, a magnetic one-touch or a toploader. The holder sets the label size and the sheet it prints on.',
  3: 'Pick Heritage (ivory field, patterned color band, grade chip), Modern (dark gradient, bold type) or, for slabs, Traditional (a classic grading-house layout with a DCM purple frame). Saved designs show up here too.',
  4: 'Set colors, patterns, text color, grade color and border. The preview updates live, and you can swipe through every card you picked.',
  5: 'Optionally edit any card’s label text, then download a print-ready PDF. Signed-in users can save the design and make it their account default.',
  6: 'See which cases, label sheets and cutting tools go with the labels you designed.',
}

const CUSTOMIZE = [
  {
    title: 'Heritage color band',
    body: `By default the band takes its colors from each card’s own artwork. Switch to DCM brand colors or pick up to 5 of your own, then choose a band pattern: ${patternNames.join(', ')}.`,
  },
  {
    title: 'Modern color themes',
    body: 'Start from a preset theme or build your own palette of up to 5 colors, then pick a pattern style and gradient angle.',
  },
  {
    title: 'Text, grade and border color',
    body: 'Set the text color, the color of the grade itself and the label border so the label matches your collection or your brand.',
  },
  {
    title: 'Per-card text edits',
    body: 'Shorten a long set name or adjust a line on any card. Signed-in edits save to the card and appear everywhere its label does.',
  },
  {
    title: 'Saved designs and a default',
    body: 'Save a design to reuse it next time, and make it your account default so your slab images and card pages use it too.',
  },
  {
    title: 'Membership emblems',
    body: 'Founder, VIP and Card Lovers members can add their membership emblem to their labels.',
  },
  {
    title: 'Zion Mag Pro sizing',
    body: `Switch slab labels to ${inches(zion.width, zion.height)} for the smaller label slot in Zion Mag Pro holders. Every style prints at that size.`,
  },
  {
    title: 'Classic design mode',
    body: 'Want full manual control over dimensions and layout? Classic design mode keeps the original single-page studio.',
    href: '/labels/classic',
  },
]

const PRINT_TIPS = [
  'Print at 100% scale, or "Actual Size". "Fit to page" shrinks the labels and throws off the cut lines and sheet alignment.',
  'Print one test page on plain paper first and hold it against your label sheet or slab before using label stock.',
  'For one-touch and toploader sheets, the download dialog lets you choose the label positions, so a partly used Avery sheet isn’t wasted.',
  'For slabs, the download dialog includes a fold-over format that prints the front and back labels as one strip you fold in half.',
  'Let the ink dry fully before cutting or peeling, and trim slab labels just inside the printed cut lines for a clean fit.',
]

const FAQS = [
  {
    q: 'Is DCM Label Studio free?',
    a: 'Yes. Designing, downloading and reprinting labels in Label Studio costs nothing. Each label is built from a DCM grade; new accounts get 2 free grades, and after that a grade starts at $2.99 per card.',
  },
  {
    q: 'Do I need a DCM-graded card to make a label?',
    a: 'Yes, to print a label for your own card. Every field on a DCM label comes from that card’s DCM grading report, including the grade, the condition name and the serial number, so it can’t be filled in for an ungraded card. DCM grades cards from photos, with no mail-in, so Label Studio is how you put a DCM grade on your own holder.',
  },
  {
    q: 'Can I try Label Studio without an account?',
    a: `Yes. Signed-out visitors can go through every step of the wizard with sample graded cards. Sign in to design labels for your own cards (up to ${MAX_WIZARD_CARDS} at a time), save a design and make it your account default.`,
  },
  {
    q: 'What paper or label sheets do I need?',
    a: `Slab labels print on plain paper and are cut to fit the label slot, ${CARDS_PER_SHEET.slab} to a sheet. One-touch labels print on Avery 6871 sheets, ${CARDS_PER_SHEET.onetouch} cards per sheet. Toploader labels print on Avery 8167 sheets, ${CARDS_PER_SHEET.toploader} cards per sheet front-and-back or ${CARDS_PER_SHEET.toploader * 2} with the fold-over layout.`,
  },
  {
    q: 'What size is a graded card slab label?',
    a: `The standard slab label is ${inches(standard.width, standard.height)}. Zion Mag Pro holders have a smaller slot, so Label Studio also prints slab labels at ${inches(zion.width, zion.height)}.`,
  },
  {
    q: 'What does the QR code on the back of a DCM label do?',
    a: 'It opens the card’s public DCM verification page, where anyone, including a buyer, can confirm the card’s grade, serial number and grading report.',
  },
  {
    q: 'Can I change the text on a label?',
    a: 'Yes. At the Finish step you can edit any card’s label text. When you’re signed in, the edits save to the card and appear everywhere its label is shown: the card page, your collection and future prints.',
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dcmgrading.com' },
      { '@type': 'ListItem', position: 2, name: 'Reports & Labels', item: 'https://dcmgrading.com/reports-and-labels' },
      { '@type': 'ListItem', position: 3, name: 'Label Studio', item: PAGE_URL },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'DCM Label Studio',
    url: PAGE_URL,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Any (web browser)',
    description:
      'Free online label maker for DCM-graded trading cards. Design and print custom grading labels for graded slabs, magnetic one-touch holders and toploaders.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'DCM Grading', url: 'https://dcmgrading.com' },
    dateModified: UPDATED_ISO,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to make a custom card grading label',
    description: 'Design and print a grading label for a DCM-graded card with DCM Label Studio.',
    totalTime: 'PT5M',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
    supply: [
      { '@type': 'HowToSupply', name: 'Plain paper (slab labels)' },
      { '@type': 'HowToSupply', name: 'Avery 6871 label sheets (one-touch labels)' },
      { '@type': 'HowToSupply', name: 'Avery 8167 label sheets (toploader labels)' },
    ],
    step: STEPS.map((s) => ({
      '@type': 'HowToStep',
      position: s.n,
      name: s.optional ? `${s.name} (optional)` : s.name,
      text: STEP_COPY[s.n],
      url: `${PAGE_URL}#label-step-${s.n}`,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
]

const H2 = 'text-2xl sm:text-3xl font-bold text-gray-900 mb-4 scroll-mt-24'

export default function LabelsGuide() {
  return (
    <section
      id="about-label-studio"
      aria-labelledby="labels-guide-heading"
      className="dcm-brand bg-white border-t border-gray-200"
    >
      {jsonLd.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-gray-700">
        {/* Answer-first intro */}
        <p className="dcm-eyebrow">About Label Studio</p>
        <h2 id="labels-guide-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5">
          Custom card grading labels, designed and printed at home
        </h2>
        <p className="text-lg leading-relaxed mb-3">
          <strong>DCM Label Studio is a free online label maker for DCM-graded trading cards.</strong> Pick up to{' '}
          {MAX_WIZARD_CARDS} graded cards, choose a graded slab, magnetic one-touch or toploader, pick a Heritage,
          Modern or Traditional style, customize the colors and download a print-ready PDF. It takes a few
          minutes.
        </p>
        <p className="text-sm text-gray-500 mb-12">{UPDATED_LABEL}</p>

        {/* What DCM does for labels */}
        <h2 id="what-is-a-dcm-label" className={H2}>What is a DCM grading label?</h2>
        <p className="leading-relaxed mb-4">
          A DCM grading label is the printed label for a card graded by DCM. Every field comes straight from the
          card&apos;s DCM grading report, so nothing is typed in by hand. DCM grades Pokémon, sports, Magic: The
          Gathering, Lorcana, One Piece, Yu-Gi-Oh! and other trading cards from photos, with no mail-in. DCM
          doesn&apos;t seal cards in slabs, so Label Studio is how you put a DCM grade on the holder you already
          use.
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-12 leading-relaxed">
          <li><strong>Front:</strong> the card name, set, card number and year, features such as rookie, autograph or serial numbering, and the DCM grade with its condition name (a 10 is Gem Mint).</li>
          <li><strong>Back:</strong> a QR code that opens the card&apos;s public DCM verification page. Slab back labels also show the four subgrades: centering, corners, edges and surface.</li>
          <li><strong>Serial number:</strong> a unique DCM serial ties the physical label to the card&apos;s grading report.</li>
        </ul>

        {/* Wizard steps */}
        <h2 id="how-to-make-a-grading-label" className={H2}>How to make a grading label in five steps</h2>
        <p className="leading-relaxed mb-5">
          The Label Wizard above walks you through five steps, plus an optional sixth. You can go back to any
          earlier step without losing your design.
        </p>
        <ol className="space-y-4 mb-12">
          {STEPS.map((s) => (
            <li key={s.n} id={`label-step-${s.n}`} className="flex gap-4 scroll-mt-24">
              <span
                aria-hidden="true"
                className="flex-none w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center"
              >
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {s.name}
                  {s.optional && <span className="font-normal text-gray-500"> (optional)</span>}
                </h3>
                <p className="leading-relaxed">{STEP_COPY[s.n]}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Holders and sizes */}
        <h2 id="label-sizes" className={H2}>Which holders and label sizes are supported?</h2>
        <p className="leading-relaxed mb-5">
          Label Studio prints labels for the three most common card holders. The holder you choose sets the label
          size and the sheet it prints on.
        </p>
        <div className="overflow-x-auto mb-12 rounded-xl border border-gray-200">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Card holders, label sizes and print stock supported by DCM Label Studio</caption>
            <thead className="bg-gray-50 text-gray-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Holder</th>
                <th scope="col" className="px-4 py-3 font-semibold">Label size</th>
                <th scope="col" className="px-4 py-3 font-semibold">Prints on</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cards per sheet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold text-gray-900">{holder('slab').name}</th>
                <td className="px-4 py-3">
                  {inchMarks(standard.width, standard.height)}
                  <br />
                  <span className="text-gray-500">{zion.name}: {inchMarks(zion.width, zion.height)}</span>
                </td>
                <td className="px-4 py-3">Plain paper, cut and inserted; duplex or fold-over</td>
                <td className="px-4 py-3">{CARDS_PER_SHEET.slab}</td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold text-gray-900">{holder('onetouch').name}</th>
                <td className="px-4 py-3">{holder('onetouch').dimensions.replace(' label', '')}</td>
                <td className="px-4 py-3">{holder('onetouch').stock}</td>
                <td className="px-4 py-3">{CARDS_PER_SHEET.onetouch}</td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold text-gray-900">{holder('toploader').name}</th>
                <td className="px-4 py-3">{holder('toploader').dimensions.replace(' labels', '')}, front and back</td>
                <td className="px-4 py-3">{holder('toploader').stock}</td>
                <td className="px-4 py-3">
                  {CARDS_PER_SHEET.toploader}
                  <span className="text-gray-500"> ({CARDS_PER_SHEET.toploader * 2} fold-over)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Customization */}
        <h2 id="customize-labels" className={H2}>How can I customize my labels?</h2>
        <p className="leading-relaxed mb-5">
          Each style has its own controls, and every change shows up live in the preview before you print.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {CUSTOMIZE.map((c) => (
            <div key={c.title} className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">
                {c.href ? <Link href={c.href} className="hover:text-purple-700 underline underline-offset-2">{c.title}</Link> : c.title}
              </h3>
              <p className="text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        {/* Print tips */}
        <h2 id="print-grading-labels" className={H2}>How do I print grading labels?</h2>
        <p className="leading-relaxed mb-4">
          Download the PDF at the Finish step and print it from any home printer. For clean, aligned labels:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-12 leading-relaxed">
          {PRINT_TIPS.map((t) => <li key={t}>{t}</li>)}
        </ul>

        {/* FAQ */}
        <h2 id="label-faq" className={H2}>Frequently asked questions</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200 mb-12">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5">
              <h3 className="font-semibold text-gray-900 mb-2">{f.q}</h3>
              <p className="leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-purple-50 border border-purple-100 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Grade a card, then make its label</h2>
          <p className="leading-relaxed mb-5">
            Start with 2 free grades. Your grading report and a ready-to-print label are waiting as soon as the
            grade is done.
          </p>
          <div className="dcm-actions">
            <Link className="dcm-button dcm-button--primary" href="/get-started">Grade your first card</Link>
            <Link className="dcm-button dcm-button--secondary" href="/reports-and-labels">Explore reports and labels</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
