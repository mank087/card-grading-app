'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { StabilizationState } from '@/types/camera';

// Motion threshold - lower value = more sensitive
const MOTION_THRESHOLD = 12; // Increased for more tolerance
// How many stable frames before considered "stable"
const STABLE_FRAMES_REQUIRED = 3; // Reduced for faster response
// Analysis frequency (ms) - ~20fps
const ANALYSIS_INTERVAL = 50;
// Low resolution for performance
const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 120;

/**
 * Calculate motion between two frames
 * Returns a score from 0-100, lower is more stable
 */
function calculateMotion(prev: ImageData, curr: ImageData): number {
  let totalDiff = 0;
  const sampleStep = 16; // Sample every 16th pixel for speed
  let sampleCount = 0;

  for (let i = 0; i < curr.data.length; i += 4 * sampleStep) {
    // Compare RGB values (skip alpha)
    const rDiff = Math.abs(curr.data[i] - prev.data[i]);
    const gDiff = Math.abs(curr.data[i + 1] - prev.data[i + 1]);
    const bDiff = Math.abs(curr.data[i + 2] - prev.data[i + 2]);
    totalDiff += (rDiff + gDiff + bDiff) / 3;
    sampleCount++;
  }

  // Normalize to 0-100 scale
  const avgDiff = totalDiff / sampleCount;
  // Clamp to 100 max
  return Math.min(100, avgDiff);
}

/**
 * Hook to detect motion/stabilization in camera feed
 * Used to prevent capturing while user is moving the camera
 */
export function useStabilization(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true
): StabilizationState {
  const [state, setState] = useState<StabilizationState>({
    isStable: false,
    motionScore: 100, // Start unstable
    stableFrameCount: 0,
  });

  const prevFrameRef = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const checkStability = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!video || !canvas || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      // Schedule next check
      timeoutIdRef.current = setTimeout(() => {
        animationIdRef.current = requestAnimationFrame(checkStability);
      }, ANALYSIS_INTERVAL);
      return;
    }

    // Draw scaled down frame for analysis
    ctx.drawImage(video, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const currentFrame = ctx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    if (prevFrameRef.current) {
      const motionScore = calculateMotion(prevFrameRef.current, currentFrame);
      const isStable = motionScore < MOTION_THRESHOLD;

      setState(prev => {
        const newStableFrameCount = isStable ? prev.stableFrameCount + 1 : 0;
        const isNowStable = newStableFrameCount >= STABLE_FRAMES_REQUIRED;

        return {
          motionScore: Math.round(motionScore * 10) / 10, // Round to 1 decimal
          isStable: isNowStable,
          stableFrameCount: newStableFrameCount,
        };
      });
    }

    prevFrameRef.current = currentFrame;

    // Schedule next check with delay
    timeoutIdRef.current = setTimeout(() => {
      animationIdRef.current = requestAnimationFrame(checkStability);
    }, ANALYSIS_INTERVAL);
  }, [videoRef]);

  useEffect(() => {
    if (!enabled) {
      // Reset state when disabled
      setState({
        isStable: false,
        motionScore: 100,
        stableFrameCount: 0,
      });
      return;
    }

    // Create canvas for frame analysis
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = ANALYSIS_WIDTH;
      canvasRef.current.height = ANALYSIS_HEIGHT;
    }

    // Get context with willReadFrequently for performance
    if (!ctxRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }

    if (!ctxRef.current) {
      console.error('[Stabilization] Failed to get canvas context');
      return;
    }

    // Start stability checking
    animationIdRef.current = requestAnimationFrame(checkStability);

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      prevFrameRef.current = null;
    };
  }, [enabled, checkStability]);

  return state;
}

export default useStabilization;
