'use client';

/**
 * Computer-monitor illustration with a continuously scrolling eBay listing.
 *
 * Shared by the InstaList Marketplace info page and the Why DCM page. The
 * three screenshots are stacked, then duplicated so the CSS translateY
 * animation can loop seamlessly (when the playhead reaches -50% of the
 * doubled stack, it sees the second copy starting at the same position as
 * the original).
 *
 * Speed is tuned for a 60s full traversal — slow enough that a visitor
 * can register what's on screen, not so slow that the page feels static.
 */
export default function EbayListingMonitor({ showCaption = true }: { showCaption?: boolean }) {
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
      {showCaption && (
        <p className="text-center text-xs text-gray-500 mt-4 max-w-[420px] mx-auto">
          A real DCM-graded card listed via InstaList — Jaxson Dart Topps Chrome Refractor,
          Grade 10, sold on eBay.
        </p>
      )}
    </div>
  );
}
