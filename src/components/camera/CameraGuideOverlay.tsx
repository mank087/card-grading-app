'use client';

interface CameraGuideOverlayProps {
  cardDetected?: boolean;
  side: 'front' | 'back';
}

export default function CameraGuideOverlay({ cardDetected = false, side }: CameraGuideOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Card outline guide - centered with standard card aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className={`relative border-4 rounded-lg transition-all duration-300 ${
            cardDetected
              ? 'border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
              : 'border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]'
          }`}
          style={{
            width: '80%',
            maxWidth: '350px',
            aspectRatio: '2.5 / 3.5' // Standard trading card ratio
          }}
        >
          {/* Corner markers - L-shaped brackets */}
          <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 transition-colors duration-300 ${
            cardDetected ? 'border-green-400' : 'border-white'
          }`} />
          <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 transition-colors duration-300 ${
            cardDetected ? 'border-green-400' : 'border-white'
          }`} />
          <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 transition-colors duration-300 ${
            cardDetected ? 'border-green-400' : 'border-white'
          }`} />
          <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 transition-colors duration-300 ${
            cardDetected ? 'border-green-400' : 'border-white'
          }`} />

          {/* Center crosshair (optional) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-4 h-4 border-2 rounded-full transition-colors duration-300 ${
              cardDetected ? 'border-green-400/70' : 'border-white/50'
            }`} />
          </div>

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

      {/* Top instructions */}
      <div className="absolute top-6 left-0 right-0 text-center px-4">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-full inline-block shadow-lg">
          <p className="text-sm font-semibold">
            {side === 'front' ? '📸 Front of Card' : '📸 Back of Card'}
          </p>
        </div>
      </div>

      {/* Bottom instructions */}
      <div className="absolute bottom-28 left-0 right-0 text-center px-4">
        <div className="space-y-2">
          <div className="bg-black/70 text-white px-4 py-2 rounded-lg inline-block">
            <p className="text-sm font-medium">
              {cardDetected ? '✓ Card Detected - Ready to Capture' : 'Position all 4 corners inside the frame'}
            </p>
          </div>
          <div className="bg-black/60 text-white/90 px-4 py-1.5 rounded-lg inline-block">
            <p className="text-xs">💡 Avoid glare, shadows, and reflections</p>
          </div>
        </div>
      </div>
    </div>
  );
}
