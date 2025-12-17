'use client';

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
  // Aspect ratio based on orientation
  const aspectRatio = orientation === 'portrait' ? '2.5 / 3.5' : '3.5 / 2.5';
  const guideWidth = orientation === 'portrait' ? '75%' : '85%';
  const maxWidth = orientation === 'portrait' ? '300px' : '420px';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Card outline guide - centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative border-4 border-white/80 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          style={{
            width: guideWidth,
            maxWidth: maxWidth,
            aspectRatio: aspectRatio,
          }}
        >
          {/* Corner markers */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

          {/* Card side indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-black/60 text-white px-6 py-2 rounded-lg">
              <p className="text-lg font-bold text-center">
                {side === 'front' ? 'FRONT' : 'BACK'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orientation toggle button */}
      {onToggleOrientation && (
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            onClick={onToggleOrientation}
            className="bg-black/70 text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform"
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

      {/* Top badge */}
      <div className="absolute top-4 left-4 right-16">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full inline-block shadow-lg">
          <p className="text-sm font-semibold">
            {side === 'front' ? 'Front of Card' : 'Back of Card'}
          </p>
        </div>
      </div>

      {/* Bottom tips - static message */}
      <div className="absolute bottom-32 left-0 right-0 px-4">
        <div className="bg-black/70 text-white rounded-xl p-4 mx-auto max-w-sm">
          <p className="text-sm font-medium text-center mb-3">Tips for best results:</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-lg mb-1">💡</p>
              <p className="text-xs">Good lighting</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-lg mb-1">🚫</p>
              <p className="text-xs">No glare</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-lg mb-1">📐</p>
              <p className="text-xs">Fill frame</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
