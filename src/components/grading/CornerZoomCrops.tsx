'use client';

interface CornerZoomCropsProps {
  imageUrl: string;
  side: 'front' | 'back';
  slabDetected?: boolean;
}

const CORNERS = [
  { label: 'Top Left', bgPos: '0% 0%' },
  { label: 'Top Right', bgPos: '100% 0%' },
  { label: 'Bottom Left', bgPos: '0% 100%' },
  { label: 'Bottom Right', bgPos: '100% 100%' },
] as const;

export function CornerZoomCrops({ imageUrl, side, slabDetected }: CornerZoomCropsProps) {
  const borderColor = side === 'front' ? 'border-blue-300' : 'border-purple-300';
  const labelColor = side === 'front' ? 'text-blue-700' : 'text-purple-700';

  if (slabDetected) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className={`text-xs font-semibold ${labelColor} mb-2`}>Corner Close-ups ({side === 'front' ? 'Front' : 'Back'})</p>
      <div className="grid grid-cols-2 gap-2">
        {CORNERS.map((corner) => (
          <div key={corner.label} className="flex flex-col items-center">
            <div
              className={`w-full aspect-square rounded-lg border-2 ${borderColor} overflow-hidden`}
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: '500% 500%',
                backgroundPosition: corner.bgPos,
                backgroundRepeat: 'no-repeat',
              }}
              role="img"
              aria-label={`${corner.label} corner zoom - ${side}`}
            />
            <span className="text-[10px] text-gray-500 mt-1 font-medium">{corner.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
