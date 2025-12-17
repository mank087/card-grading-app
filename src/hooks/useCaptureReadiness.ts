'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CaptureReadinessState,
  CardDetectionResult,
  StabilizationState
} from '@/types/camera';

// How many consecutive ready frames before starting countdown
const READY_FRAMES_REQUIRED = 5; // Reduced for faster response
// Countdown duration in seconds
const COUNTDOWN_SECONDS = 2; // Faster countdown
// How often to check readiness (ms)
const CHECK_INTERVAL = 100;

interface UseCaptureReadinessOptions {
  /** Card detection result from useCardDetection */
  detection: CardDetectionResult;
  /** Stabilization state from useStabilization */
  stabilization: StabilizationState;
  /** Whether auto-capture is enabled */
  autoCaptureEnabled: boolean;
  /** Callback when auto-capture triggers */
  onAutoCapture: () => void;
  /** Whether capture readiness checking is enabled */
  enabled?: boolean;
}

/**
 * Hook to manage capture readiness and auto-capture countdown
 * Combines detection, stabilization, and alignment to determine capture readiness
 */
export function useCaptureReadiness({
  detection,
  stabilization,
  autoCaptureEnabled,
  onAutoCapture,
  enabled = true,
}: UseCaptureReadinessOptions): CaptureReadinessState {
  const [state, setState] = useState<CaptureReadinessState>({
    isCardDetected: false,
    isStable: false,
    isAligned: false,
    isQualityGood: false,
    readyForCapture: false,
    readyFrameCount: 0,
    autoCaptureCountdown: null,
    autoCaptureEnabled,
  });

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readyFrameCountRef = useRef(0);
  const countdownStartTimeRef = useRef<number | null>(null);

  // Clear countdown timer
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownStartTimeRef.current = null;
  }, []);

  // Start countdown timer
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) return; // Already running

    countdownStartTimeRef.current = Date.now();

    // Update countdown every 100ms for smooth display
    countdownIntervalRef.current = setInterval(() => {
      if (!countdownStartTimeRef.current) {
        clearCountdown();
        return;
      }

      const elapsed = Date.now() - countdownStartTimeRef.current;
      const remaining = Math.max(0, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));

      setState(prev => ({
        ...prev,
        autoCaptureCountdown: remaining,
      }));

      // Trigger capture when countdown reaches 0
      if (remaining === 0 && elapsed >= COUNTDOWN_SECONDS * 1000) {
        clearCountdown();
        onAutoCapture();
      }
    }, CHECK_INTERVAL);
  }, [clearCountdown, onAutoCapture]);

  // Update readiness state based on detection and stabilization
  useEffect(() => {
    if (!enabled) {
      setState(prev => ({
        ...prev,
        isCardDetected: false,
        isStable: false,
        isAligned: false,
        isQualityGood: false,
        readyForCapture: false,
        readyFrameCount: 0,
        autoCaptureCountdown: null,
      }));
      clearCountdown();
      readyFrameCountRef.current = 0;
      return;
    }

    // Evaluate individual conditions - simplified and lenient
    const isCardDetected = detection.detected;
    const isStable = stabilization.isStable;
    const isAligned = true; // Trust user to align - simplified version
    const isQualityGood = detection.lighting.level === 'good' ||
                          detection.lighting.level === 'bright' ||
                          detection.lighting.level === 'dim';

    // Check for critical warnings - only glare is critical
    const hasCriticalWarnings = detection.warnings.some(w =>
      w === 'glare_detected'
    );

    // Overall readiness - much more lenient
    // Just need: detected + stable + no glare
    const readyForCapture = isCardDetected &&
                            isStable &&
                            !hasCriticalWarnings;

    // Track consecutive ready frames
    if (readyForCapture) {
      readyFrameCountRef.current++;
    } else {
      readyFrameCountRef.current = 0;
    }

    const readyFrameCount = readyFrameCountRef.current;

    // Auto-capture countdown logic
    if (autoCaptureEnabled && readyFrameCount >= READY_FRAMES_REQUIRED) {
      // Start countdown if not already running
      if (!countdownIntervalRef.current) {
        startCountdown();
      }
    } else {
      // Reset countdown if conditions no longer met
      if (countdownIntervalRef.current) {
        clearCountdown();
        setState(prev => ({
          ...prev,
          autoCaptureCountdown: null,
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isCardDetected,
      isStable,
      isAligned,
      isQualityGood,
      readyForCapture,
      readyFrameCount,
      autoCaptureEnabled,
    }));

  }, [
    detection,
    stabilization,
    autoCaptureEnabled,
    enabled,
    startCountdown,
    clearCountdown,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, [clearCountdown]);

  return state;
}

/**
 * Get user-friendly message based on current readiness state
 */
export function getReadinessMessage(state: CaptureReadinessState): string {
  if (state.autoCaptureCountdown !== null && state.autoCaptureCountdown > 0) {
    return `Capturing in ${state.autoCaptureCountdown}...`;
  }

  if (!state.isCardDetected) {
    return 'Position card in frame';
  }

  if (!state.isStable) {
    return 'Hold steady...';
  }

  if (!state.isAligned) {
    return 'Center and align card';
  }

  if (state.readyForCapture) {
    return 'Ready! Hold still...';
  }

  return 'Adjusting...';
}

export default useCaptureReadiness;
