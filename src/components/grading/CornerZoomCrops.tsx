'use client';

import { resolveCornerTiles } from '@/lib/grading/cornerTiles';

interface CornerZoomCropsProps {
  imageUrl: string;
  side: 'front' | 'back';
  slabDetected?: boolean;
  /**
   * `cards.capture_quality` — the grading engine's detected card corners. Tiles
   * are cropped around those corners; without them (older cards, corners not
   * found) the tiles are hidden rather than showing zoomed background.
   */
  captureQuality?: unknown;
}

export function CornerZoomCrops({ imageUrl, side, slabDetected, captureQuality }: CornerZoomCropsProps) {
  const borderColor = side === 'front' ? 'border-blue-300' : 'border-purple-300';
  const labelColor = side === 'front' ? 'text-blue-700' : 'text-purple-700';

  if (slabDetected) {
    return null;
  }

  const tiles = resolveCornerTiles(captureQuality, side);
  if (!tiles) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className={`text-xs font-semibold ${labelColor} mb-2`}>Corner Close-ups ({side === 'front' ? 'Front' : 'Back'})</p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex flex-col items-center">
            <div
              className={`relative w-full aspect-square rounded-lg border-2 ${borderColor} overflow-hidden bg-gray-100`}
              role="img"
              aria-label={`${tile.label} corner zoom - ${side}`}
            >
              {/* The image is scaled so `tile.size` of its width spans the tile,
                  then translated (percentages of its OWN box) so the tile centre
                  lands in the middle — square pixels without knowing the photo's
                  aspect ratio. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="lazy"
                decoding="async"
                className="absolute select-none pointer-events-none"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${100 / tile.size}%`,
                  height: 'auto',
                  maxWidth: 'none',
                  transform: `translate(${-tile.cx * 100}%, ${-tile.cy * 100}%)`,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 mt-1 font-medium">{tile.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
