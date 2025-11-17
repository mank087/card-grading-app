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
        // Fetch 30 random public cards with front images
        const { data, error } = await supabase
          .from('cards')
          .select('front_url')
          .eq('visibility', 'public')
          .not('front_url', 'is', null)
          .limit(30);

        if (error) {
          console.error('Error fetching card images:', error);
          return;
        }

        if (data && data.length > 0) {
          const urls = data.map(card => card.front_url);
          setCardImages(urls);
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
              width={200}
              height={280}
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
              width={200}
              height={280}
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
              width={200}
              height={280}
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
          gap: 1.5rem;
          position: absolute;
          width: max-content;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
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

        .card-item {
          flex-shrink: 0;
          width: 200px;
          height: 280px;
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
          right: 0;
        }

        /* Pause on hover for accessibility */
        .scroll-row:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
