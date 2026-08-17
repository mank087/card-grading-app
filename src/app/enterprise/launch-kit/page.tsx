'use client'

/**
 * /enterprise/launch-kit — digital launch kit for new enterprise stores.
 *
 * Print-ready counter signage, a staff pitch sheet, social captions, and a
 * first-week checklist. When a logged-in org member opens it, the signage
 * personalizes with the store's name, logo, and brand color; otherwise it
 * renders with placeholders. Print via the browser (Ctrl/Cmd+P) — each sign
 * breaks onto its own page and the site chrome is hidden.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useOrgContext } from '@/contexts/OrgContext'
import { ORG_OVERAGE_PACK } from '@/lib/orgPlans'

export default function LaunchKitPage() {
  const { membership } = useOrgContext()
  const storeName = membership?.name || 'Your Store Name'
  const brandColor = membership?.brandColor || '#7C3AED'
  const logo = membership?.logos.color || null
  const [copied, setCopied] = useState<number | null>(null)

  const captions = [
    `🔥 BIG NEWS: ${storeName} now grades cards IN STORE. Bring your cards in and walk out with a graded slab the same visit. No shipping, no months of waiting. Powered by DCM Optic™ grading with a scannable verification QR on every label.`,
    `Thinking about grading but not sure what's worth submitting? Bring your stack to ${storeName} and we'll grade them on the spot for a fraction of traditional grading costs, so you only send your true bangers off for expensive slabs. Work smarter. 📈`,
    `Every card we grade at ${storeName} gets a serial number and QR code backed by the DCM verification registry. Scan any of our slabs and see exactly what was graded, when, and the full condition report. Real transparency. 🔍`,
    `Grading day at ${storeName}! 🃏 Bring your Pokémon, sports cards, MTG, One Piece, Lorcana and more. We grade them all, in minutes, while you shop. Ask at the counter.`,
  ]

  const copyCaption = (i: number) => {
    navigator.clipboard.writeText(captions[i])
    setCopied(i)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 print:bg-white print:py-0">
      {/* Hide site chrome + control page breaks when printing */}
      <style>{`
        @media print {
          nav, header, footer { display: none !important; }
          .print-page { page-break-after: always; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Intro (screen only) */}
        <div className="no-print">
          <p className="uppercase tracking-widest text-purple-600 text-xs font-semibold mb-2">DCM Enterprise</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Launch Kit</h1>
          <p className="text-gray-600 text-sm max-w-xl">
            Everything you need for your first week of in-store grading: printable counter signage, a
            pitch sheet for your staff, and ready-to-post social captions.
            {membership
              ? ' Signage below is personalized with your store branding.'
              : ' Sign in with your store account to personalize the signage with your logo and name.'}
          </p>
          <button onClick={() => window.print()}
            className="mt-4 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
            🖨️ Print signage &amp; pitch sheet
          </button>
        </div>

        {/* ===== Counter sign ===== */}
        <div className="print-page bg-white rounded-2xl shadow-md p-10 text-center border-4" style={{ borderColor: brandColor }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={storeName} className="h-20 mx-auto mb-4 object-contain" />
          ) : (
            <div className="text-2xl font-bold mb-4" style={{ color: brandColor }}>{storeName}</div>
          )}
          <h2 className="text-4xl font-extrabold text-gray-900 leading-tight mb-3">
            WE GRADE CARDS<br />
            <span style={{ color: brandColor }}>RIGHT HERE.</span>
          </h2>
          <p className="text-xl text-gray-700 font-semibold mb-6">In minutes, while you wait.</p>
          <ul className="text-left inline-block text-gray-700 space-y-2 mb-6">
            <li>✅ Graded &amp; slabbed the same visit</li>
            <li>✅ Fraction of the cost of mail-in grading</li>
            <li>✅ Serial number + QR verification on every label</li>
            <li>✅ Pokémon · Sports · MTG · One Piece · Lorcana &amp; more</li>
          </ul>
          <div className="text-lg font-bold text-gray-900 border-t border-gray-200 pt-4">
            Ask at the counter <span className="text-gray-400 font-normal">·</span>{' '}
            <span style={{ color: brandColor }}>$____ per card</span>
          </div>
          <p className="text-xs text-gray-400 mt-6">Powered by DCM Optic™ grading · verify any slab at dcmgrading.com</p>
        </div>

        {/* ===== Staff pitch sheet ===== */}
        <div className="print-page bg-white rounded-2xl shadow-md p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Staff Pitch Sheet</h2>
          <p className="text-sm text-gray-500 mb-6">{storeName}: how to talk about in-store grading</p>

          <div className="space-y-5 text-gray-700 text-sm leading-relaxed">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">The 10-second pitch</h3>
              <p className="italic">
                &quot;We grade cards here in the store now. It takes a few minutes, and you get a slab with a
                serial number and a QR code anyone can scan to verify the grade. Way cheaper than mailing
                cards off and waiting months.&quot;
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">When they say &quot;but PSA sells for more&quot;</h3>
              <p>
                Agree that for their top cards, it can. Then flip it: &quot;That&apos;s exactly why people grade here
                first. For a fraction of the price you find out which cards are actually 9s and 10s, and only
                pay big-grading prices for the winners. Grading everything at $20+ a card is how people lose
                money.&quot; You&apos;re not competing with PSA. You&apos;re the smart first step.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">The trust answer</h3>
              <p>
                Every slab has a QR code. Scan it in front of the customer and show them the photos, the grade,
                the sub-grades, and the condition report on the public verification page. No other counter
                service can do that live.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Who to mention it to</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Anyone buying singles or supplies (&quot;want that graded before it goes in the binder?&quot;)</li>
                <li>Sellers: graded inventory sells for more and moves faster</li>
                <li>Parents with kids&apos; collections: an affordable way to make it feel real</li>
                <li>Anyone mentioning PSA wait times or prices</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">First-week checklist</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Counter sign up (this kit) with your per-card price filled in</li>
                <li>Grade 5 to 10 of the store&apos;s own cards and display them slabbed by the register</li>
                <li>Post the announcement caption (kit page 3) on your socials</li>
                <li>Practice the QR-scan demo so it&apos;s smooth in front of customers</li>
                <li>Pick your &quot;grading day&quot; if you want an event angle</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ===== Social captions (screen only) ===== */}
        <div className="no-print bg-white rounded-2xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Social captions</h2>
          <p className="text-sm text-gray-500 mb-5">Copy, tweak, post. Add your own photos of slabs on the counter.</p>
          <div className="space-y-4">
            {captions.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
                <p className="text-sm text-gray-700 flex-1 whitespace-pre-wrap">{c}</p>
                <button onClick={() => copyCaption(i)}
                  className="shrink-0 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-400">
                  {copied === i ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer (screen only) */}
        <p className="no-print text-xs text-gray-400 text-center pb-6">
          Questions or want help with your launch?{' '}
          <Link href="/enterprise#contact" className="underline hover:text-gray-600">Contact the DCM team</Link>
          {' '}·{' '}
          <Link href="/store/billing" className="underline hover:text-gray-600">Store billing</Link>
        </p>
      </div>
    </main>
  )
}
