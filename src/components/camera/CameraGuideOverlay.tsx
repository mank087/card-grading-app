'use client';

import { useState, useEffect } from 'react';
import { computeGuideSizePx } from '@/utils/cameraGuideGeometry';

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
  // Guide dimensions come from the shared geometry util so the capture crop
  // uses the exact same rectangle the user framed against.
  const [guideDimensions, setGuideDimensions] = useState({ width: '96%', height: 'auto' });

  useEffect(() => {
    const calculateOptimalSize = () => {
      const { width, height } = computeGuideSizePx(window.innerWidth, window.innerHeight, orientation);
      setGuideDimensions({ width: `${width}px`, height: `${height}px` });
    };

    calculateOptimalSize();
    window.addEventListener('resize', calculateOptimalSize);
    return () => window.removeEventListener('resize', calculateOptimalSize);
  }, [orientation]);

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
