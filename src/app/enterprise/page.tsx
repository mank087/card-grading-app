import { Metadata } from 'next';
import LeadForm from './LeadForm';
import NeonSign from './NeonSign';
import BrandedSlabVisual, { StoreMockRow } from './BrandedSlabVisual';
import { ORG_PLANS, ORG_OVERAGE_PACK } from '@/lib/orgPlans';

export const metadata: Metadata = {
  title: 'Enterprise Card Grading for Stores, Breakers & Creators',
  description: 'Launch your own card grading brand. Branded slab labels, grading reports, card pages, and a hosted storefront, powered by DCM Optic™ grading. Wholesale grading from $0.40/card for card shops, case breakers, streamers, and high-volume collectors.',
  keywords: 'card store grading, dealer card grading, case breaker grading, streamer card grading, white label card grading, branded slab labels, LCS grading service, enterprise card grading, card shop grading program',
  openGraph: {
    title: 'DCM Enterprise: Launch Your Own Card Grading Brand',
    description: 'Branded grading for shops, breakers, streamers, and collectors: your logo on labels, reports, and card pages, backed by the DCM verification registry.',
    type: 'website',
    siteName: 'DCM Grading',
  },
  twitter: {
    card: 'summary',
    title: 'DCM Enterprise: Launch Your Own Card Grading Brand',
    description: 'Your own card grading brand, powered by DCM Optic™ grading.',
  },
};

const BENEFITS = [
  {
    icon: '🎟️',
    title: 'Monthly Grading Volumes',
    body: `A fresh allotment of grades every billing cycle: ${ORG_PLANS.dealer.gradesPerMonth} or ${ORG_PLANS.enterprise.gradesPerMonth.toLocaleString()} per month at rates built for volume, as low as $${ORG_PLANS.enterprise.perCardUsd.toFixed(2)} a card. Traditional grading runs $15 to $25 per card with weeks of turnaround.`,
  },
  {
    icon: '🏷️',
    title: 'Your brand on every slab',
    body: 'Upload your logo once and it appears on slab labels in every style, including the premium Heritage design. Fold-over and batch printing included, sized and recolored automatically for light and dark labels.',
  },
  {
    icon: '📄',
    title: 'Branded reports and card pages',
    body: 'Graded card detail pages, full PDF grading reports, downloadable card images, and eBay listing imagery all carry your brand and colors.',
  },
  {
    icon: '🔍',
    title: 'Your serials, your branded registry',
    body: "Your account gets its own serial prefix, and every card you grade is assigned a unique serial number. Scanning the QR on the slab resolves to a branded registry page with the card's photos, grade, and full details presented under your brand.",
  },
  {
    icon: '⚡',
    title: 'Grades in minutes, not months',
    body: 'DCM Optic™ grading returns sub-grades for centering, corners, edges, and surface in minutes. Grade at the counter, on stream, or at a show while they watch.',
  },
  {
    icon: '🏬',
    title: 'Your own Enterprise Page',
    body: 'A hosted landing page at dcmgrading.com with your branding, your story, contact and socials, a serial lookup, and a live feed of your recently graded cards. One link to share everywhere.',
  },
];

const TIERS = [
  {
    name: ORG_PLANS.dealer.name,
    blurb: 'For shops, breakers, and streamers adding grading to their business',
    priceUsd: ORG_PLANS.dealer.priceUsd,
    gradesPerMonth: ORG_PLANS.dealer.gradesPerMonth,
    perCardUsd: ORG_PLANS.dealer.perCardUsd,
    features: ['Branded labels & slabs', 'Branded reports & card pages', 'Your own Enterprise Page', 'Email support'],
    highlight: false,
  },
  {
    name: ORG_PLANS.enterprise.name,
    blurb: 'For high-volume sellers and grading-first businesses',
    priceUsd: ORG_PLANS.enterprise.priceUsd,
    gradesPerMonth: ORG_PLANS.enterprise.gradesPerMonth,
    perCardUsd: ORG_PLANS.enterprise.perCardUsd,
    features: ['Everything in Dealer', 'Best per-card rate', 'Onboarding & launch support', 'Direct line to the DCM team'],
    highlight: true,
  },
];

/**
 * Faint, non-interactive background art for desktop: tilted slab/card
 * outlines, a stream play chip, and sparkles — stores, streamers, and
 * hobbyists in outline form. Hidden on mobile; never captures the pointer.
 */
function SectionDeco({ variant }: { variant: 'left' | 'right' }) {
  const side = variant === 'left' ? 'left-0 -translate-x-1/3' : 'right-0 translate-x-1/3';
  const rot = variant === 'left' ? '-rotate-12' : 'rotate-12';
  return (
    <div aria-hidden className={`hidden lg:block absolute top-10 ${side} pointer-events-none select-none`}>
      <svg width="360" height="480" viewBox="0 0 360 480" fill="none" className={`${rot} opacity-[0.05]`}>
        {/* slab outline with label band */}
        <rect x="40" y="20" width="200" height="300" rx="18" stroke="#6D28D9" strokeWidth="4" />
        <rect x="58" y="40" width="164" height="56" rx="8" stroke="#6D28D9" strokeWidth="4" />
        <rect x="58" y="112" width="164" height="188" rx="8" stroke="#6D28D9" strokeWidth="4" />
        <rect x="178" y="48" width="36" height="40" rx="8" fill="#6D28D9" />
        {/* stream play chip */}
        <circle cx="290" cy="360" r="44" stroke="#6D28D9" strokeWidth="4" />
        <path d="M278 340l38 20-38 20v-40z" fill="#6D28D9" />
        {/* fanned cards */}
        <rect x="20" y="360" width="90" height="126" rx="10" stroke="#6D28D9" strokeWidth="4" transform="rotate(-14 65 423)" />
        <rect x="70" y="352" width="90" height="126" rx="10" stroke="#6D28D9" strokeWidth="4" transform="rotate(-2 115 415)" />
        {/* sparkles */}
        <path d="M300 120l6 16 16 6-16 6-6 16-6-16-16-6 16-6 6-16z" fill="#6D28D9" />
        <path d="M320 220l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10z" fill="#6D28D9" />
      </svg>
    </div>
  );
}

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero — kept tight so the primary CTA sits above the fold on desktop */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 text-white py-12 sm:py-14">
        {/* ambient glow orbs */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-purple-400/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-blue-400/25 blur-3xl" />
        {/* faint slab outlines drifting at the edges */}
        <div aria-hidden className="hidden lg:block pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 opacity-10">
          <svg width="220" height="330" viewBox="0 0 220 330" fill="none" className="-rotate-12">
            <rect x="10" y="10" width="200" height="310" rx="20" stroke="white" strokeWidth="3" />
            <rect x="28" y="30" width="164" height="58" rx="8" stroke="white" strokeWidth="3" />
            <rect x="28" y="104" width="164" height="196" rx="8" stroke="white" strokeWidth="3" />
          </svg>
        </div>
        <div aria-hidden className="hidden lg:block pointer-events-none absolute -right-8 top-8 opacity-10">
          <svg width="190" height="290" viewBox="0 0 220 330" fill="none" className="rotate-12">
            <rect x="10" y="10" width="200" height="310" rx="20" stroke="white" strokeWidth="3" />
            <rect x="28" y="30" width="164" height="58" rx="8" stroke="white" strokeWidth="3" />
            <rect x="28" y="104" width="164" height="196" rx="8" stroke="white" strokeWidth="3" />
          </svg>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="uppercase tracking-widest text-purple-200 text-sm font-semibold mb-3">DCM Enterprise</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Launch your own card grading brand
          </h1>
          <p className="text-lg sm:text-xl text-purple-100 max-w-2xl mx-auto mb-6">
            For card shops, case breakers, streamers, and serious collectors. Professional grading
            under your brand: your logo on the slab, the report, and the card page, powered by
            DCM Optic™ and backed by the DCM verification registry.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="/enterprise/apply"
              className="inline-block px-8 py-3 bg-white text-purple-700 rounded-lg font-semibold hover:bg-purple-50 transition-colors">
              Launch your brand
            </a>
            <a href="#contact"
              className="inline-block px-8 py-3 border border-purple-300 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors">
              Talk to us first
            </a>
          </div>
        </div>
      </section>

      {/* Brand visuals */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionDeco variant="right" />
        <div className="relative grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <NeonSign />
            <p className="text-center text-gray-500 text-sm mt-4">
              Grading at the counter, on stream, or at the show table gives people a reason to come to you.
            </p>
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 text-center lg:text-left leading-tight">
              <span className="block">Your cards.</span>
              <span className="block">Your brand.</span>
              <span className="block text-purple-600">Our engine.</span>
            </h2>
            <p className="text-gray-600 mb-8 text-center lg:text-left">
              Every slab you produce carries your logo and colors. They show on the label,
              the grading report, and the card&apos;s page online, with DCM Optic&trade; verification
              behind it.
            </p>
            <BrandedSlabVisual />
          </div>
        </div>

        {/* Example brands */}
        <div className="mt-16">
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">See it with your brand on it</h3>
          <p className="text-center text-gray-500 text-sm mb-8">
            Example brands shown for illustration. Your logo, your colors, tailored with you at onboarding.
          </p>
          <StoreMockRow />
        </div>
      </section>

      {/* Benefits */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 overflow-visible">
        <SectionDeco variant="left" />
        <h2 className="relative text-3xl font-bold text-gray-900 text-center mb-10">Everything you need to grade under your brand</h2>
        <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-white rounded-2xl shadow-md p-6">
              <div className="text-3xl mb-3">{b.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section id="pricing" className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 scroll-mt-24">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <div className="w-[36rem] h-72 rounded-full bg-purple-200/40 blur-3xl" />
        </div>
        <h2 className="relative text-3xl font-bold text-gray-900 text-center mb-3">Flexible Enterprise Pricing Plans</h2>
        <p className="relative text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          Monthly grades refresh every billing cycle, and every plan includes full branding, your
          Enterprise Page, and your own serial registry.
        </p>
        <div className="relative grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {TIERS.map(t => (
            <div key={t.name}
              className={`rounded-2xl p-6 flex flex-col ${t.highlight
                ? 'bg-purple-700 text-white shadow-xl ring-2 ring-purple-400'
                : 'bg-white text-gray-900 shadow-md'}`}>
              <h3 className="text-xl font-bold mb-1">{t.name}</h3>
              <p className={`text-sm mb-4 ${t.highlight ? 'text-purple-200' : 'text-gray-500'}`}>{t.blurb}</p>
              <div className="mb-1">
                <span className="text-4xl font-bold">${t.priceUsd}</span>
                <span className={`text-sm ${t.highlight ? 'text-purple-200' : 'text-gray-500'}`}>/mo</span>
              </div>
              <p className={`text-sm mb-1 ${t.highlight ? 'text-purple-100' : 'text-gray-700'}`}>
                {t.gradesPerMonth.toLocaleString()} grades every month
              </p>
              <p className={`text-sm font-semibold mb-4 ${t.highlight ? 'text-purple-200' : 'text-purple-600'}`}>
                ${t.perCardUsd.toFixed(2)} per card
              </p>
              <ul className="space-y-2 text-sm flex-1">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className={t.highlight ? 'text-purple-300' : 'text-purple-600'}>✓</span>
                    <span className={t.highlight ? 'text-purple-50' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/enterprise/apply"
                className={`mt-6 text-center px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${t.highlight
                  ? 'bg-white text-purple-700 hover:bg-purple-50'
                  : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                Get started
              </a>
            </div>
          ))}
        </div>
        <p className="relative text-center text-sm text-gray-500 mt-6">
          Need more in a hot month? Overage packs are ${ORG_OVERAGE_PACK.priceUsd.toFixed(2)} per{' '}
          {ORG_OVERAGE_PACK.grades} grades (${ORG_OVERAGE_PACK.perGradeUsd.toFixed(2)}/grade) and roll
          over until you use them.
        </p>
        <p className="relative text-center text-xs text-gray-400 mt-3">
          Every brand is reviewed by the DCM team before going live, usually within one business day.
          No payment until you&apos;re approved. All prices are in USD, and international businesses are
          welcome: labels and slabs are printed locally by you, so nothing ships. Participation is subject to the{' '}
          <a href="/enterprise/terms" className="underline hover:text-gray-600">Enterprise Program Terms</a>.
        </p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative bg-white py-16 border-t border-gray-100 overflow-hidden scroll-mt-24">
        <SectionDeco variant="right" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center mx-auto mb-3">1</div>
              <h3 className="font-semibold text-gray-900 mb-2">We set up your brand</h3>
              <p className="text-sm text-gray-600">Apply with your logo and details. We review and tailor your labels, reports, and pages with you, then you pick a plan. Most brands are live within a day.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center mx-auto mb-3">2</div>
              <h3 className="font-semibold text-gray-900 mb-2">You grade</h3>
              <p className="text-sm text-gray-600">You and your team draw from a shared pool of monthly credits. Photograph the card, get sub-grades in minutes, print the slab label wherever you work.</p>
            </div>
            <div>
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center mx-auto mb-3">3</div>
              <h3 className="font-semibold text-gray-900 mb-2">Buyers verify on your branded registry</h3>
              <p className="text-sm text-gray-600">Every slab carries a unique serial and QR code that resolve to your branded DCM registry page, so your grades sell with real verification behind your brand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lead form */}
      <section id="contact" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Bring grading to your business</h2>
        <p className="text-center text-gray-600 mb-8">
          Whether you run a shop counter, a break room, a stream setup, or a show table, tell us
          about your business and we&apos;ll reach out with plan options within one business day.
        </p>
        <LeadForm />
      </section>
    </main>
  );
}
