'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CardDetectionResult,
  CardBounds,
  CardOrientation,
  CardAlignment,
  CardWarning,
  LightingInfo,
  GuideOrientation,
} from '@/types/camera';

// Detection settings - simplified for reliability
const ANALYSIS_INTERVAL = 100; // ~10fps for better performance
const DETECTION_WIDTH = 160; // Lower res for speed
const DETECTION_HEIGHT = 120;

/**
 * Simplified card detection using brightness and contrast analysis
 * Less CPU intensive and more reliable across devices
 */
export function useCardDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true,
  guideOrientation: GuideOrientation = 'portrait'
): CardDetectionResult {
  const [detection, setDetection] = useState<CardDetectionResult>({
    detected: false,
    confidence: 0,
    bounds: null,
    orientation: 'unknown',
    alignment: {
      isCentered: true,
      isParallel: true,
      rotationAngle: 0,
      fillPercent: 70,
      isWithinGuide: true,
    },
    lighting: {
      level: 'good',
      brightness: 128,
      message: 'Checking...',
      hasGlare: false,
      hasShadow: false,
    },
    warnings: [],
    readyForCapture: false,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const analyze = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!video || !canvas || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      timeoutIdRef.current = setTimeout(() => {
        animationIdRef.current = requestAnimationFrame(analyze);
      }, ANALYSIS_INTERVAL);
      return;
    }

    // Draw scaled frame
    ctx.drawImage(video, 0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);
    const imageData = ctx.getImageData(0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);
    const { data } = imageData;

    // Analyze center region (where card should be)
    const centerX = DETECTION_WIDTH / 2;
    const centerY = DETECTION_HEIGHT / 2;
    const sampleRadius = Math.min(DETECTION_WIDTH, DETECTION_HEIGHT) * 0.3;

    let totalBrightness = 0;
    let maxBrightness = 0;
    let minBrightness = 255;
    let sampleCount = 0;
    let highBrightnessCount = 0;
    let lowBrightnessCount = 0;

    // Sample center region
    for (let y = Math.floor(centerY - sampleRadius); y < centerY + sampleRadius; y += 2) {
      for (let x = Math.floor(centerX - sampleRadius); x < centerX + sampleRadius; x += 2) {
        if (x < 0 || x >= DETECTION_WIDTH || y < 0 || y >= DETECTION_HEIGHT) continue;

        const idx = (y * DETECTION_WIDTH + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        totalBrightness += brightness;
        sampleCount++;
        maxBrightness = Math.max(maxBrightness, brightness);
        minBrightness = Math.min(minBrightness, brightness);

        if (brightness > 245) highBrightnessCount++;
        if (brightness < 20) lowBrightnessCount++;
      }
    }

    const avgBrightness = sampleCount > 0 ? totalBrightness / sampleCount : 128;
    const contrast = maxBrightness - minBrightness;
    const hasGlare = highBrightnessCount > sampleCount * 0.05;
    const hasShadow = lowBrightnessCount > sampleCount * 0.2;

    // Determine lighting level
    let lightingLevel: LightingInfo['level'];
    let lightingMessage: string;

    if (avgBrightness < 40) {
      lightingLevel = 'too_dark';
      lightingMessage = 'Too dark - add more light';
    } else if (avgBrightness < 70) {
      lightingLevel = 'dim';
      lightingMessage = 'Dim lighting';
    } else if (avgBrightness < 200) {
      lightingLevel = 'good';
      lightingMessage = 'Good lighting';
    } else if (avgBrightness < 235) {
      lightingLevel = 'bright';
      lightingMessage = 'Bright - watch for glare';
    } else {
      lightingLevel = 'too_bright';
      lightingMessage = 'Too bright';
    }

    // Simple detection: assume card is present if we have good contrast and lighting
    // This is intentionally lenient - we trust the user to frame the card properly
    const hasGoodContrast = contrast > 30;
    const hasAcceptableLighting = lightingLevel === 'good' || lightingLevel === 'bright' || lightingLevel === 'dim';

    // Be very lenient with detection - if lighting is reasonable, assume card is there
    const detected = hasAcceptableLighting;
    const confidence = detected ? (hasGoodContrast ? 80 : 60) : 30;

    // Generate warnings
    const warnings: CardWarning[] = [];
    if (hasGlare) warnings.push('glare_detected');
    if (hasShadow && lightingLevel !== 'too_dark') warnings.push('shadow_detected');
    if (lightingLevel === 'too_dark') warnings.push('shadow_detected');
    if (lightingLevel === 'too_bright') warnings.push('glare_detected');

    // Ready for capture if detection confidence is reasonable and no severe warnings
    const readyForCapture = detected &&
      confidence >= 50 &&
      !hasGlare &&
      lightingLevel !== 'too_dark' &&
      lightingLevel !== 'too_bright';

    setDetection({
      detected,
      confidence,
      bounds: null, // Not using bounds in simplified version
      orientation: guideOrientation === 'landscape' ? 'landscape' : 'portrait',
      alignment: {
        isCentered: true, // Assume centered - user is responsible for framing
        isParallel: true,
        rotationAngle: 0,
        fillPercent: 75, // Assume good fill
        isWithinGuide: true,
      },
      lighting: {
        level: lightingLevel,
        brightness: avgBrightness,
        message: lightingMessage,
        hasGlare,
        hasShadow,
      },
      warnings,
      readyForCapture,
    });

    // Schedule next analysis
    timeoutIdRef.current = setTimeout(() => {
      animationIdRef.current = requestAnimationFrame(analyze);
    }, ANALYSIS_INTERVAL);
  }, [videoRef, guideOrientation]);

  useEffect(() => {
    if (!enabled) {
      setDetection(prev => ({
        ...prev,
        detected: false,
        confidence: 0,
        readyForCapture: false,
      }));
      return;
    }

    // Initialize canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = DETECTION_WIDTH;
      canvasRef.current.height = DETECTION_HEIGHT;
    }

    if (!ctxRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }

    if (!ctxRef.current) {
      console.error('[CardDetection] Failed to get canvas context');
      return;
    }

    // Start analysis
    animationIdRef.current = requestAnimationFrame(analyze);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [enabled, analyze]);

  return detection;
}

export default useCardDetection;

// Re-export types for convenience
export type { LightingInfo } from '@/types/camera';
