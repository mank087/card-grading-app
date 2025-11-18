"use client";

import Image from "next/image";

interface ScrollingCardBackgroundProps {
  opacity?: number; // 0-100, default 40
  blur?: number; // px, default 2
  speed?: number; // multiplier, default 1
}

export default function ScrollingCardBackground({
  opacity = 40,
  blur = 2,
  speed = 1
}: ScrollingCardBackgroundProps) {
  // Static card images stored in public/homepage-cards/
  const staticCardImages = [
    '/homepage-cards/Aaron Judge Auto.png',
    '/homepage-cards/Black Lotus MTG.png',
    '/homepage-cards/Charizard 1999.png',
    '/homepage-cards/Garbage Pail Kids Adam Bomb.png',
    '/homepage-cards/Garbage Pail Kids Hound Doug.png',
    '/homepage-cards/Gisele Bundchen Pop Century.png',
    '/homepage-cards/Ian Malcom, Chaotician MTG.png',
    '/homepage-cards/Kaboom Kevin Durant.png',
    '/homepage-cards/Magneton.png',
    '/homepage-cards/Mathew Stafford Kurt Warner Auto.png',
    '/homepage-cards/maxxine-dupri.png',
    '/homepage-cards/Mega Lucario EX.png',
    '/homepage-cards/Micahel Jordan Rookie.png',
    '/homepage-cards/Mickey Mantle 1952.png',
    '/homepage-cards/Mickey Mouse Brave Little Prince.png',
    '/homepage-cards/pikachu-grey-felt-hat.png',
    '/homepage-cards/Shohei Ohtani Auto Patch.png',
    '/homepage-cards/The One Ring MTG.png',
    '/homepage-cards/Tom Brady Downtown Buccaneers.png'
  ];

  const cardImages = staticCardImages;

  // Need at least 2 images to show the background
  if (cardImages.length < 2) {
    console.warn(`[ScrollingCardBackground] ⚠️ Only ${cardImages.length} images available, need at least 2. Not rendering.`);
    return null;
  }

  // Distribute cards across 3 rows (repeat images if we don't have enough)
  const imagesNeeded = 30;
  let allImages = [...cardImages];

  // If we have fewer than 30 images, repeat them to fill 3 rows
  while (allImages.length < imagesNeeded) {
    allImages = [...allImages, ...cardImages];
  }

  const row1Cards = allImages.slice(0, 10);
  const row2Cards = allImages.slice(10, 20);
  const row3Cards = allImages.slice(20, 30);

  // Duplicate arrays for seamless infinite scroll
  const row1Double = [...row1Cards, ...row1Cards];
  const row2Double = [...row2Cards, ...row2Cards];
  const row3Double = [...row3Cards, ...row3Cards];

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        opacity: opacity / 100,
        filter: `blur(${blur}px)`
      }}
    >
      {/* Row 1 - Scrolling Right */}
      <div className="scroll-row scroll-right" style={{ animationDuration: `${20 / speed}s` }}>
        {row1Double.map((url, index) => (
          <div key={`row1-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={300}
              height={420}
              className="rounded-lg shadow-lg object-cover"
              loading={index < 5 ? "eager" : "lazy"}
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* Row 2 - Scrolling Left */}
      <div className="scroll-row scroll-left" style={{ animationDuration: `${25 / speed}s` }}>
        {row2Double.map((url, index) => (
          <div key={`row2-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={300}
              height={420}
              className="rounded-lg shadow-lg object-cover"
              loading="lazy"
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* Row 3 - Scrolling Right */}
      <div className="scroll-row scroll-right" style={{ animationDuration: `${30 / speed}s` }}>
        {row3Double.map((url, index) => (
          <div key={`row3-${index}`} className="card-item">
            <Image
              src={url}
              alt=""
              width={300}
              height={420}
              className="rounded-lg shadow-lg object-cover"
              loading="lazy"
              unoptimized
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        .scroll-row {
          display: flex;
          gap: 1rem;
          position: absolute;
          width: max-content;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        /* Mobile: smaller cards, tighter spacing */
        @media (max-width: 768px) {
          .scroll-row {
            gap: 0.75rem;
          }

          .card-item {
            width: 150px !important;
            height: 210px !important;
          }

          .scroll-row:nth-child(1) {
            top: 5%;
          }

          .scroll-row:nth-child(2) {
            top: 40%;
          }

          .scroll-row:nth-child(3) {
            top: 75%;
          }
        }

        /* Tablet: medium cards */
        @media (min-width: 769px) and (max-width: 1024px) {
          .scroll-row {
            gap: 1.25rem;
          }

          .card-item {
            width: 200px !important;
            height: 280px !important;
          }

          .scroll-row:nth-child(1) {
            top: 8%;
          }

          .scroll-row:nth-child(2) {
            top: 42%;
          }

          .scroll-row:nth-child(3) {
            top: 76%;
          }
        }

        /* Desktop: larger cards, better spacing */
        @media (min-width: 1025px) {
          .scroll-row {
            gap: 2rem;
          }

          .card-item {
            width: 280px !important;
            height: 392px !important;
          }

          .scroll-row:nth-child(1) {
            top: 10%;
          }

          .scroll-row:nth-child(2) {
            top: 45%;
          }

          .scroll-row:nth-child(3) {
            top: 80%;
          }
        }

        /* Large Desktop: even larger cards */
        @media (min-width: 1920px) {
          .scroll-row {
            gap: 2.5rem;
          }

          .card-item {
            width: 320px !important;
            height: 448px !important;
          }
        }

        .card-item {
          flex-shrink: 0;
          width: 280px;
          height: 392px;
        }

        @keyframes scroll-right {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes scroll-left {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(0);
          }
        }

        .scroll-right {
          animation-name: scroll-right;
          left: 0;
        }

        .scroll-left {
          animation-name: scroll-left;
          left: 0;
          transform: translateX(-50%);
        }

        /* Pause on hover for accessibility */
        .scroll-row:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
