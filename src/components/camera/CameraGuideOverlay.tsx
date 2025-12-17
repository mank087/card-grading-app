'use client';

import { useMemo } from 'react';
import {
  GuideOrientation,
  CardDetectionResult,
  CaptureReadinessState,
  CARD_ASPECT_RATIOS,
} from '@/types/camera';
import { getReadinessMessage } from '@/hooks/useCaptureReadiness';

interface CameraGuideOverlayProps {
  side: 'front' | 'back';
  orientation: GuideOrientation;
  detection: CardDetectionResult;
  readiness: CaptureReadinessState;
  onToggleOrientation: () => void;
}

export default function CameraGuideOverlay({
  side,
  orientation,
  detection,
  readiness,
  onToggleOrientation,
}: CameraGuideOverlayProps) {
  // Determine visual state
  const isReady = readiness.readyForCapture;
  const isCountingDown = readiness.autoCaptureCountdown !== null && readiness.autoCaptureCountdown > 0;
  const hasWarnings = detection.warnings.length > 0;

  // Border color based on state
  const borderColor = useMemo(() => {
    if (isCountingDown) return 'border-green-400';
    if (isReady) return 'border-green-400';
    if (detection.detected && detection.confidence > 50) return 'border-yellow-400';
    return 'border-white/80';
  }, [isCountingDown, isReady, detection.detected, detection.confidence]);

  // Glow effect based on state
  const glowEffect = useMemo(() => {
    if (isCountingDown) return 'shadow-[0_0_40px_rgba(34,197,94,0.9)]';
    if (isReady) return 'shadow-[0_0_30px_rgba(34,197,94,0.7)]';
    if (detection.detected && detection.confidence > 50) return 'shadow-[0_0_25px_rgba(234,179,8,0.5)]';
    return 'shadow-[0_0_20px_rgba(255,255,255,0.3)]';
  }, [isCountingDown, isReady, detection.detected, detection.confidence]);

  // Aspect ratio based on orientation
  const aspectRatio = orientation === 'portrait'
    ? CARD_ASPECT_RATIOS.portrait
    : CARD_ASPECT_RATIOS.landscape;

  // Status message
  const statusMessage = getReadinessMessage(readiness);

  // Warning messages for display
  const warningMessages = useMemo(() => {
    const messages: string[] = [];
    detection.warnings.forEach(w => {
      switch (w) {
        case 'card_too_small': messages.push('Move closer'); break;
        case 'card_too_large': messages.push('Move back'); break;
        case 'card_rotated': messages.push('Straighten card'); break;
        case 'card_off_center': messages.push('Center card'); break;
        case 'corners_cut_off': messages.push('Show all corners'); break;
        case 'glare_detected': messages.push('Reduce glare'); break;
        case 'shadow_detected': messages.push('Even lighting'); break;
        case 'blur_detected': messages.push('Hold steady'); break;
      }
    });
    return messages.slice(0, 2); // Max 2 warnings at a time
  }, [detection.warnings]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Card outline guide - centered with aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative border-4 rounded-lg transition-all duration-300 ${borderColor} ${glowEffect} ${
            isCountingDown ? 'animate-pulse' : ''
          }`}
          style={{
            width: orientation === 'portrait' ? '75%' : '90%',
            maxWidth: orientation === 'portrait' ? '320px' : '450px',
            aspectRatio: `${aspectRatio}`,
          }}
        >
          {/* Corner markers - L-shaped brackets */}
          <div className={`absolute -top-1 -left-1 w-10 h-10 border-t-[5px] border-l-[5px] transition-all duration-300 rounded-tl-lg ${borderColor.replace('border-', 'border-')}`} />
          <div className={`absolute -top-1 -right-1 w-10 h-10 border-t-[5px] border-r-[5px] transition-all duration-300 rounded-tr-lg ${borderColor.replace('border-', 'border-')}`} />
          <div className={`absolute -bottom-1 -left-1 w-10 h-10 border-b-[5px] border-l-[5px] transition-all duration-300 rounded-bl-lg ${borderColor.replace('border-', 'border-')}`} />
          <div className={`absolute -bottom-1 -right-1 w-10 h-10 border-b-[5px] border-r-[5px] transition-all duration-300 rounded-br-lg ${borderColor.replace('border-', 'border-')}`} />

          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-4 h-4 border-2 rounded-full transition-colors duration-300 ${
              isReady ? 'border-green-400/70' : 'border-white/50'
            }`} />
          </div>

          {/* Countdown display */}
          {isCountingDown && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-green-500/90 w-20 h-20 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-white text-4xl font-bold">
                  {readiness.autoCaptureCountdown}
                </span>
              </div>
            </div>
          )}

          {/* Card side indicator - only show when not counting down */}
          {!isCountingDown && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-black/60 text-white px-6 py-2 rounded-lg">
                <p className="text-lg font-bold text-center">
                  {side === 'front' ? 'FRONT' : 'BACK'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Orientation toggle button */}
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
            <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="2" />
            <path d="M8 7h8M8 11h8M8 15h4" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Top status badge */}
      <div className="absolute top-4 left-0 right-16 text-center px-4">
        <div className={`px-6 py-2 rounded-full inline-block shadow-lg ${
          isCountingDown
            ? 'bg-green-600 text-white'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
        }`}>
          <p className="text-sm font-semibold">
            {isCountingDown
              ? `Capturing ${side}...`
              : side === 'front' ? 'Front of Card' : 'Back of Card'
            }
          </p>
        </div>
      </div>

      {/* Bottom feedback area */}
      <div className="absolute bottom-36 left-0 right-0 text-center px-4">
        <div className="space-y-2">
          {/* Main status message */}
          <div className={`px-4 py-2 rounded-lg inline-flex items-center gap-2 ${
            isReady || isCountingDown
              ? 'bg-green-600/90 text-white'
              : hasWarnings
                ? 'bg-yellow-600/90 text-white'
                : 'bg-black/70 text-white'
          }`}>
            {isReady || isCountingDown ? (
              <span className="text-lg">✓</span>
            ) : hasWarnings ? (
              <span className="text-lg">⚠</span>
            ) : null}
            <p className="text-sm font-medium">{statusMessage}</p>
          </div>

          {/* Warning chips */}
          {warningMessages.length > 0 && !isReady && !isCountingDown && (
            <div className="flex flex-wrap justify-center gap-2">
              {warningMessages.map((msg, i) => (
                <div key={i} className="bg-yellow-500/80 text-white px-3 py-1 rounded-lg">
                  <p className="text-xs font-medium">{msg}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tips when no warnings */}
          {warningMessages.length === 0 && !isReady && !isCountingDown && (
            <div className="flex flex-wrap justify-center gap-2">
              <div className="bg-black/60 text-white/90 px-3 py-1.5 rounded-lg inline-block">
                <p className="text-xs">Even lighting</p>
              </div>
              <div className="bg-black/60 text-white/90 px-3 py-1.5 rounded-lg inline-block">
                <p className="text-xs">No glare</p>
              </div>
              <div className="bg-black/60 text-white/90 px-3 py-1.5 rounded-lg inline-block">
                <p className="text-xs">Fill the frame</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fill percent indicator (debug/feedback) */}
      {detection.detected && detection.alignment.fillPercent > 0 && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center px-4">
          <div className="bg-black/60 px-3 py-1 rounded-full">
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    detection.alignment.fillPercent >= 60 && detection.alignment.fillPercent <= 95
                      ? 'bg-green-400'
                      : 'bg-yellow-400'
                  }`}
                  style={{ width: `${Math.min(100, detection.alignment.fillPercent)}%` }}
                />
              </div>
              <span className="text-white text-xs">{Math.round(detection.alignment.fillPercent)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
