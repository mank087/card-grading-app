'use client';

import { useState, useCallback } from 'react';
import { GuideOrientation, CardOrientation } from '@/types/camera';

interface UseGuideOrientationReturn {
  /** Current active orientation for the guide frame */
  orientation: GuideOrientation;
  /** Toggle between portrait and landscape */
  toggleOrientation: () => void;
  /** Whether user has manually overridden the orientation */
  isManualOverride: boolean;
  /** Reset to auto-detect mode (portrait default) */
  resetToAuto: () => void;
  /** Set orientation directly */
  setOrientation: (orientation: GuideOrientation) => void;
}

/**
 * Hook to manage guide frame orientation (portrait/landscape)
 * Allows user to toggle for horizontal card layouts
 *
 * @param detectedOrientation - Orientation detected from card (optional, for future auto-detect)
 * @param defaultOrientation - Initial orientation (default: 'portrait')
 */
export function useGuideOrientation(
  detectedOrientation: CardOrientation = 'unknown',
  defaultOrientation: GuideOrientation = 'portrait'
): UseGuideOrientationReturn {
  // null = auto mode (use detected or default), otherwise manual override
  const [manualOrientation, setManualOrientation] = useState<GuideOrientation | null>(null);

  // Determine active orientation:
  // 1. Manual override takes priority
  // 2. Then detected orientation (if known)
  // 3. Finally default orientation
  const activeOrientation: GuideOrientation =
    manualOrientation ??
    (detectedOrientation === 'landscape' ? 'landscape' :
     detectedOrientation === 'portrait' ? 'portrait' :
     defaultOrientation);

  const toggleOrientation = useCallback(() => {
    setManualOrientation(prev => {
      // If manual is set, flip it
      if (prev === 'portrait') return 'landscape';
      if (prev === 'landscape') return 'portrait';
      // If auto mode, flip from current active
      return activeOrientation === 'portrait' ? 'landscape' : 'portrait';
    });
  }, [activeOrientation]);

  const resetToAuto = useCallback(() => {
    setManualOrientation(null);
  }, []);

  const setOrientation = useCallback((orientation: GuideOrientation) => {
    setManualOrientation(orientation);
  }, []);

  return {
    orientation: activeOrientation,
    toggleOrientation,
    isManualOverride: manualOrientation !== null,
    resetToAuto,
    setOrientation,
  };
}

export default useGuideOrientation;
