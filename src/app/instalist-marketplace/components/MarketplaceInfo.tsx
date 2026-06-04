import Link from 'next/link';

/**
 * Informational / marketing content for the InstaList Marketplace.
 *
 * Two variants:
 *   - "hero"   = full-page treatment for users who can't (yet) use the
 *                marketplace: logged out, no graded cards, or not connected
 *                to eBay. Big hero, full benefit grid, prominent CTA.
 *   - "footer" = compact recap shown below an active marketplace so the
 *                value-prop and process stay visible to existing users.
 *
 * The CTA changes per state:
 *   - signup  = "Create an account" + "Log in" (unauthenticated users)
 *   - grade   = "Grade your first card" (authed user with zero graded cards)
 *   - connect = "Connect your eBay" (authed user with cards but no eBay link)
 *   - none    = no CTA block (footer variant)
 */

type CtaMode = 'signup' | 'grade' | 'connect' | 'none';

interface Props {
  variant: 'hero' | 'footer';
  ctaMode?: CtaMode;
  onConnect?: () => void;
  isConnecting?: boolean;
  connectError?: string | null;
}

export default function MarketplaceInfo({
  variant,
  ctaMode = 'none',
  onConnect,
  isConnecting,
  connectError,
}: Props) {
  if (variant === 'hero') {
    return <HeroVariant ctaMode={ctaMode} onConnect={onConnect} isConnecting={isConnecting} connectError={connectError} />;
  }
  return <FooterVariant />;
}

// ============================================================================
// HERO VARIANT — full-page informational treatment
// ============================================================================

function HeroVariant({
  ctaMode,
  onConnect,
  isConnecting,
  connectError,
}: {
  ctaMode: CtaMode;
  onConnect?: () => void;
  isConnecting?: boolean;
  connectError?: string | null;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-indigo-50/40">
      {/* HERO — split layout on desktop, stacked on mobile */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* Left: copy + CTA */}
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-3 py-1.5 rounded-full mb-4">
                <span className="text-base">⚡</span> InstaList Marketplace
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
                List your graded cards on
                {' '}
                <img
                  src="/eBay-Instalist-Marketplace/Ebay-logo.jpg"
                  alt="eBay logo"
                  className="inline-block h-[1.4em] w-auto align-middle"
                  style={{ verticalAlign: '-0.2em' }}
                />
                <br />
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  in seconds, not minutes.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
                InstaList is a complimentary tool for DCM users. We generate the listing images,
                pre-fill the title and price, and bake your DCM grade into eBay&rsquo;s
                certification fields automatically. You review, hit publish, and the card&rsquo;s live.
              </p>

              <div className="flex justify-center lg:justify-start">
                <CtaBlock ctaMode={ctaMode} onConnect={onConnect} isConnecting={isConnecting} connectError={connectError} />
              </div>
            </div>

            {/* Right: monitor mockup with auto-scrolling eBay listing screenshots */}
            <div className="flex justify-center lg:justify-end">
              <EbayListingMonitor />
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-3">
          What InstaList does for every card
        </h2>
        <p className="text-gray-600 text-center max-w-2xl mx-auto mb-10">
          The same images and pricing that take other sellers an hour are generated automatically the moment you pick a card.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <BenefitCard
            icon="🖼️"
            title="Auto-generated listing images"
            body="Front + back graded label images, your mini grading report, and the raw photos of your card. Add gallery uploads if you want more."
          />
          <BenefitCard
            icon="🏷️"
            title="Grade baked into eBay specifics"
            body="DCM grader certification, grade, and certification number populate eBay&rsquo;s required graded-card fields for you."
          />
          <BenefitCard
            icon="📊"
            title="Live performance dashboard"
            body="Active listings, sold history, ended (unsold), revenue, view counts, watchers. All in one view, refreshed every 15 minutes."
          />
          <BenefitCard
            icon="🔄"
            title="One-click relist"
            body="When a listing ends without selling, relist it with the same details and updated price in one click."
          />
          <BenefitCard
            icon="🎁"
            title="Complimentary for DCM users"
            body="No referral fees, no markup, no commission. InstaList is part of your DCM account. You list, you keep all the proceeds."
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            How it works
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-10">
            Three steps from graded card to live eBay listing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Step
              number="1"
              title="Connect your eBay account"
              body="One-time OAuth handshake. We never store your eBay password, and we&rsquo;ll never post anything without your action."
            />
            <Step
              number="2"
              title="Pick a graded card"
              body="Choose from your collection. We show only cards that aren&rsquo;t already listed, so you never double-post."
            />
            <Step
              number="3"
              title="Review and publish"
              body="Auto-generated images, suggested title and price, ready-to-go shipping defaults. Edit anything, hit List on eBay."
            />
          </div>
        </div>
      </section>

      {/* FAQ / TRUST */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FaqItem
            q="Will buyers trust a DCM grade on eBay?"
            a="DCM populates eBay&rsquo;s official graded-card fields (Professional Grader, Grade, Certification Number) on every listing. Buyers see the grade in the item specifics the same way they would for any major grading service."
          />
          <FaqItem
            q="What about shipping?"
            a="InstaList comes with sensible defaults for a small bubble mailer. You can override per listing — flat-rate, calculated, or free shipping all supported. Same shipping options as the existing card-detail flow."
          />
          <FaqItem
            q="Can I edit a listing after I publish it?"
            a="After publishing a listing through DCM, edits can be made directly in the eBay app or website."
          />
          <FaqItem
            q="What does this cost?"
            a="Nothing. InstaList is included with your DCM account. eBay charges their normal seller fees on sales, paid directly to them."
          />
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl px-6 sm:px-12 py-10 sm:py-14 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {ctaMode === 'signup' && 'Ready to Grade and List Your First Card?'}
            {ctaMode === 'grade' && 'Grade your first card to get started'}
            {ctaMode === 'connect' && 'You&rsquo;re one click away from your first listing'}
            {ctaMode === 'none' && 'Ready to Grade and List Your First Card?'}
          </h2>
          <p className="text-indigo-100 mb-6 max-w-xl mx-auto">
            Same account, same credits, same tools. InstaList is built into DCM Grading and takes about 60 seconds to set up.
          </p>
          <CtaBlock ctaMode={ctaMode} onConnect={onConnect} isConnecting={isConnecting} connectError={connectError} inverted />
        </div>
      </section>
    </main>
  );
}

// ============================================================================
// FOOTER VARIANT — shown below an active marketplace
// ============================================================================

function FooterVariant() {
  return (
    <section className="mt-12 sm:mt-16 border-t border-gray-200 pt-10 sm:pt-12 pb-4">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Everything InstaList does for every card
        </h2>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto">
          A quick recap of what&rsquo;s working behind the scenes on every listing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CompactBenefit icon="🖼️" title="Auto images" body="Graded labels, mini report, raw photos, gallery uploads." />
        <CompactBenefit icon="🏷️" title="Grade in item specifics" body="DCM grader certification populated automatically." />
        <CompactBenefit icon="📊" title="Live dashboard" body="Views, watchers, revenue — refreshed every 15 min." />
        <CompactBenefit icon="🔄" title="One-click relist" body="Ended without selling? Relist with one tap." />
        <CompactBenefit icon="🎁" title="Free for DCM users" body="No referral fees. Keep everything you sell." />
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        DCM grade and certification fields populate eBay&rsquo;s official graded-card item specifics on every listing.
      </p>
    </section>
  );
}

// ============================================================================
// SHARED PIECES
// ============================================================================

function CtaBlock({
  ctaMode,
  onConnect,
  isConnecting,
  connectError,
  inverted = false,
}: {
  ctaMode: CtaMode;
  onConnect?: () => void;
  isConnecting?: boolean;
  connectError?: string | null;
  inverted?: boolean;
}) {
  if (ctaMode === 'none') return null;

  if (ctaMode === 'signup') {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
        <Link
          href="/login?mode=signup&redirect=/instalist-marketplace"
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base shadow-lg transition-all ${
            inverted
              ? 'bg-white text-indigo-700 hover:bg-indigo-50'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'
          }`}
        >
          Create a free account
        </Link>
        <Link
          href="/login?mode=login&redirect=/instalist-marketplace"
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
            inverted
              ? 'border-2 border-white/40 text-white hover:bg-white/10'
              : 'border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          Log in
        </Link>
      </div>
    );
  }

  if (ctaMode === 'grade') {
    return (
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/upload"
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base shadow-lg transition-all ${
            inverted
              ? 'bg-white text-indigo-700 hover:bg-indigo-50'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'
          }`}
        >
          <span className="text-lg">📸</span>
          Grade your first card
        </Link>
        <p className={`text-xs ${inverted ? 'text-indigo-100' : 'text-gray-500'}`}>
          You need at least one graded card before you can list on eBay.
        </p>
      </div>
    );
  }

  if (ctaMode === 'connect') {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base shadow-lg transition-all disabled:opacity-60 ${
            inverted
              ? 'bg-white text-indigo-700 hover:bg-indigo-50'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'
          }`}
        >
          {isConnecting ? 'Opening eBay...' : 'Connect your eBay account'}
        </button>
        {connectError && (
          <p className={`text-sm ${inverted ? 'text-red-100' : 'text-red-600'}`}>{connectError}</p>
        )}
        <p className={`text-xs ${inverted ? 'text-indigo-100' : 'text-gray-500'}`}>
          One-time OAuth handshake. We never post anything without your action.
        </p>
      </div>
    );
  }

  return null;
}

function BenefitCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}

function CompactBenefit({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="text-center sm:text-left">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold mb-3">
        {number}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-bold text-gray-900 mb-2">{q}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
    </div>
  );
}

/**
 * Computer-monitor illustration with a continuously scrolling eBay listing.
 *
 * The three screenshots are stacked, then duplicated so the CSS
 * translateY animation can loop seamlessly (when the playhead reaches
 * -50% of the doubled stack, it sees the second copy starting at the
 * same position as the original).
 *
 * Speed is tuned for a 60s full traversal — slow enough that a visitor
 * can register what's on screen, not so slow that the page feels static.
 */
function EbayListingMonitor() {
  const screenshots = [
    {
      src: '/eBay-Instalist-Marketplace/ebay-instalist-dcm-1.png',
      alt: 'Top of the eBay listing — Jaxson Dart 2025 Topps Chrome Refractor rookie card, DCM Grade 10 Gem Mint, marked SOLD',
    },
    {
      src: '/eBay-Instalist-Marketplace/ebay-instalist-dcm-2.png',
      alt: 'Item specifics section showing the DCM grading certification automatically populated into eBay item specifics',
    },
    {
      src: '/eBay-Instalist-Marketplace/ebay-instalist-dcm-3.png',
      alt: 'DCM grading report embedded in the eBay listing description — condition overview, sub-grades for centering, corners, edges, surface, and graded by DCM verification',
    },
  ];

  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none">
      <style jsx>{`
        @keyframes ebay-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .ebay-scroll-content {
          animation: ebay-scroll 60s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ebay-scroll-content { animation: none; }
        }
      `}</style>

      {/* Monitor bezel */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-2.5 sm:p-3 shadow-2xl ring-1 ring-black/20">
        {/* Top bezel band with camera dot */}
        <div className="flex justify-center pb-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-gray-600" aria-hidden />
        </div>

        {/* Screen */}
        <div className="relative overflow-hidden rounded-md bg-white aspect-[4/3] sm:aspect-[5/4]">
          {/* Browser-style chrome at top to sell the "live listing" idea */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 bg-gray-100 border-b border-gray-200 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="ml-2 flex-1 text-[10px] sm:text-xs text-gray-500 truncate font-mono">
              ebay.com/itm/jaxson-dart-dcm-grade-10
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* Scrolling stack — doubled for seamless loop */}
          <div className="ebay-scroll-content pt-7 sm:pt-8">
            {[...screenshots, ...screenshots].map((s, i) => (
              <img
                key={i}
                src={s.src}
                alt={i < screenshots.length ? s.alt : ''}
                aria-hidden={i >= screenshots.length}
                className="block w-full h-auto"
                draggable={false}
                loading="lazy"
              />
            ))}
          </div>

          {/* Gradient fade at the bottom so cuts mid-image read as a scroll, not a hard edge */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>

      {/* Monitor stand */}
      <div className="mx-auto mt-0 w-14 h-4 bg-gradient-to-b from-gray-800 to-gray-900 [clip-path:polygon(20%_0%,80%_0%,100%_100%,0%_100%)]" />
      <div className="mx-auto -mt-px w-32 sm:w-40 h-1.5 bg-gradient-to-b from-gray-900 to-gray-800 rounded-b-md shadow-md" />

      {/* Caption */}
      <p className="text-center text-xs text-gray-500 mt-4 max-w-[420px] mx-auto">
        A real DCM-graded card listed via InstaList — Jaxson Dart Topps Chrome Refractor,
        Grade 10, sold on eBay.
      </p>
    </div>
  );
}
