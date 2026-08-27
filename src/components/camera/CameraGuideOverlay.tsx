'use client';

import { useState, useEffect } from 'react';
import { computeGuideLayoutPx } from '@/utils/cameraGuideGeometry';

interface CameraGuideOverlayProps {
  side: 'front' | 'back';
  orientation?: 'portrait' | 'landscape';
}

export default function CameraGuideOverlay({
  side,
  orientation = 'portrait',
}: CameraGuideOverlayProps) {
  // Guide layout comes from the shared geometry util so the capture crop uses
  // the exact same rectangle (size AND vertical position) the user framed
  // against. centerOffsetY keeps the guide centered between the header and
  // the bottom controls instead of the full viewport — previously it sat low
  // enough to collide with the tips row and capture button on short screens.
  const [guideLayout, setGuideLayout] = useState({ width: 0, height: 0, centerOffsetY: 0 });

  useEffect(() => {
    const calculateOptimalSize = () => {
      setGuideLayout(computeGuideLayoutPx(window.innerWidth, window.innerHeight, orientation));
    };

    calculateOptimalSize();
    window.addEventListener('resize', calculateOptimalSize);
    return () => window.removeEventListener('resize', calculateOptimalSize);
  }, [orientation]);

  if (!guideLayout.width) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Card outline guide - centered in the available region */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative border-4 border-white/90 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          style={{
            width: `${guideLayout.width}px`,
            height: `${guideLayout.height}px`,
            transform: `translateY(${guideLayout.centerOffsetY}px)`,
          }}
        >
          {/* Corner markers - larger for visibility */}
          <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-xl" />
          <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-xl" />
          <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-xl" />
          <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-xl" />

          {/* Single label ABOVE the guide — nothing overlays the card itself.
              (The old center FRONT/BACK pill and the in-guide "Fill card to
              edges" pill both sat on top of the card being framed.) */}
          {/* "fill card to edges" was too soft to change behaviour — people
              read it as "roughly centred" and still shot from too far away,
              which is the top cause of cards the grader cannot identify.
              Name the target the eye can actually check against. */}
          <div className="absolute -top-9 left-0 right-0 flex justify-center">
            <div className="bg-black/50 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full whitespace-nowrap">
              <span className="text-xs font-semibold tracking-wide">
                {side === 'front' ? 'FRONT' : 'BACK'} · move close, reach all 4 corners
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
