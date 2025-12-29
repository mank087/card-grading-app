'use client';

import { useState, useEffect } from 'react';

interface CameraGuideOverlayProps {
  side: 'front' | 'back';
  orientation?: 'portrait' | 'landscape';
  onToggleOrientation?: () => void;
}

export default function CameraGuideOverlay({
  side,
  orientation = 'portrait',
  onToggleOrientation,
}: CameraGuideOverlayProps) {
  // Card aspect ratio: 2.5" x 3.5" standard trading card
  const cardAspectRatio = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5;

  // Calculate optimal guide dimensions based on available screen space
  const [guideDimensions, setGuideDimensions] = useState({ width: '96%', height: 'auto' });

  useEffect(() => {
    const calculateOptimalSize = () => {
      // Available space: full screen minus header (~48px) and bottom controls (~100px)
      const headerHeight = 48;
      const bottomControlsHeight = 100;
      const horizontalPadding = 4; // Minimal padding

      const availableWidth = window.innerWidth - horizontalPadding;
      const availableHeight = window.innerHeight - headerHeight - bottomControlsHeight;

      // Calculate max dimensions while maintaining card aspect ratio
      // Width-constrained: use 98% of available width
      const widthBasedWidth = availableWidth * 0.98;
      const widthBasedHeight = widthBasedWidth / cardAspectRatio;

      // Height-constrained: use 98% of available height
      const heightBasedHeight = availableHeight * 0.98;
      const heightBasedWidth = heightBasedHeight * cardAspectRatio;

      // Use whichever constraint allows the LARGER guide
      if (widthBasedHeight <= availableHeight) {
        // Width is the limiting factor - guide fits vertically
        setGuideDimensions({
          width: `${widthBasedWidth}px`,
          height: `${widthBasedHeight}px`
        });
      } else {
        // Height is the limiting factor - constrain by height
        setGuideDimensions({
          width: `${heightBasedWidth}px`,
          height: `${heightBasedHeight}px`
        });
      }
    };

    calculateOptimalSize();
    window.addEventListener('resize', calculateOptimalSize);
    return () => window.removeEventListener('resize', calculateOptimalSize);
  }, [cardAspectRatio, orientation]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Card outline guide - centered, maximized to fill available space */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative border-4 border-white/90 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          style={{
            width: guideDimensions.width,
            height: guideDimensions.height,
          }}
        >
          {/* Corner markers - larger for visibility */}
          <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-xl" />
          <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-xl" />
          <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-xl" />
          <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-xl" />

          {/* Subtle center indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-black/40 backdrop-blur-sm text-white/80 px-4 py-1.5 rounded-full">
              <p className="text-sm font-medium text-center">
                {side === 'front' ? 'FRONT' : 'BACK'}
              </p>
            </div>
          </div>

          {/* Fill frame tip inside the guide */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <div className="bg-black/50 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full">
              <span className="text-xs font-medium">Fill card to edges</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orientation toggle button - positioned to not overlap with header */}
      {onToggleOrientation && (
        <div className="absolute top-16 right-4 pointer-events-auto">
          <button
            onClick={onToggleOrientation}
            className="bg-black/60 backdrop-blur-sm text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform"
            aria-label={`Switch to ${orientation === 'portrait' ? 'landscape' : 'portrait'} mode`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-6 h-6 transition-transform duration-300 ${
                orientation === 'landscape' ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
