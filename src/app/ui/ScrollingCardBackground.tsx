"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

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
  const [cardImages, setCardImages] = useState<string[]>([]);

  useEffect(() => {
    const fetchCardImages = async () => {
      try {
        // Try to fetch public cards first (using is_public boolean column)
        let { data, error } = await supabase
          .from('cards')
          .select('front_path')
          .eq('is_public', true)
          .not('front_path', 'is', null)
          .limit(30);

        // If no public cards found, fetch any cards as fallback
        if (error || !data || data.length === 0) {
          console.log('No public cards found, fetching any available cards...');
          const result = await supabase
            .from('cards')
            .select('front_path')
            .not('front_path', 'is', null)
            .limit(30);

          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching card images:', error);
          return;
        }

        if (data && data.length > 0) {
          // Create signed URLs for each card's front image
          const urlPromises = data.map(async (card) => {
            const { data: urlData } = await supabase.storage
              .from('cards')
              .createSignedUrl(card.front_path, 60 * 60); // 1 hour expiry
            return urlData?.signedUrl || null;
          });

          const urls = await Promise.all(urlPromises);
          const validUrls = urls.filter(url => url !== null) as string[];

          setCardImages(validUrls);
          console.log(`Loaded ${validUrls.length} card images for background`);
        } else {
          console.warn('No cards with front_path found in database');
        }
      } catch (err) {
        console.error('Error loading background cards:', err);
      }
    };

    fetchCardImages();
  }, []);

  // If no images loaded yet, show nothing (or could show skeleton)
  if (cardImages.length === 0) {
    return null;
  }

  // Distribute cards across 3 rows
  const row1Cards = cardImages.slice(0, 10);
  const row2Cards = cardImages.slice(10, 20);
  const row3Cards = cardImages.slice(20, 30);

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
