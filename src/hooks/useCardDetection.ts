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
  Point,
  CARD_ASPECT_RATIOS,
} from '@/types/camera';

// Detection settings
const ANALYSIS_INTERVAL = 50; // ~20fps
const DETECTION_WIDTH = 320; // Analysis resolution
const DETECTION_HEIGHT = 240;

// Thresholds
const EDGE_THRESHOLD = 50; // Sobel edge strength threshold
const CORNER_THRESHOLD = 0.01; // Harris corner response threshold
const CONFIDENCE_THRESHOLD_DETECTED = 40; // Min confidence to be "detected"
const CONFIDENCE_THRESHOLD_READY = 60; // Min confidence to be "ready"

// Guide frame settings (matches CameraGuideOverlay)
const GUIDE_WIDTH_PERCENT = 0.75; // Guide frame width as % of viewport
const GUIDE_MAX_WIDTH = 320; // Max guide width in pixels

/**
 * Apply Sobel edge detection
 */
function detectEdges(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const edges = new Float32Array(width * height);

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  // Convert to grayscale first
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    gray[idx] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  // Apply Sobel operator
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += gray[idx] * sobelX[ki];
          gy += gray[idx] * sobelY[ki];
        }
      }

      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return edges;
}

/**
 * Find strong horizontal and vertical lines in edge map
 * Returns line segments that could be card edges
 */
function findCardEdges(
  edges: Float32Array,
  width: number,
  height: number
): { horizontal: number[]; vertical: number[] } {
  const horizontalStrength: number[] = new Array(height).fill(0);
  const verticalStrength: number[] = new Array(width).fill(0);

  // Sum edge strength along rows (horizontal lines)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = edges[y * width + x];
      if (edge > EDGE_THRESHOLD) {
        horizontalStrength[y] += edge;
      }
    }
  }

  // Sum edge strength along columns (vertical lines)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const edge = edges[y * width + x];
      if (edge > EDGE_THRESHOLD) {
        verticalStrength[x] += edge;
      }
    }
  }

  // Find peaks (strong lines)
  const findPeaks = (arr: number[], minDistance: number = 20): number[] => {
    const peaks: number[] = [];
    const threshold = Math.max(...arr) * 0.3;

    for (let i = minDistance; i < arr.length - minDistance; i++) {
      if (arr[i] > threshold &&
          arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1]) {
        // Check if it's a local maximum
        let isPeak = true;
        for (let j = 1; j <= minDistance; j++) {
          if (arr[i - j] > arr[i] || arr[i + j] > arr[i]) {
            isPeak = false;
            break;
          }
        }
        if (isPeak) {
          peaks.push(i);
        }
      }
    }

    return peaks;
  };

  return {
    horizontal: findPeaks(horizontalStrength, Math.floor(height * 0.1)),
    vertical: findPeaks(verticalStrength, Math.floor(width * 0.1)),
  };
}

/**
 * Estimate card bounds from detected edges
 */
function estimateCardBounds(
  horizontalLines: number[],
  verticalLines: number[],
  width: number,
  height: number,
  guideOrientation: GuideOrientation
): CardBounds | null {
  // Need at least 2 horizontal and 2 vertical lines
  if (horizontalLines.length < 2 || verticalLines.length < 2) {
    return null;
  }

  // Sort lines
  horizontalLines.sort((a, b) => a - b);
  verticalLines.sort((a, b) => a - b);

  // Get outermost lines as card edges
  const top = horizontalLines[0];
  const bottom = horizontalLines[horizontalLines.length - 1];
  const left = verticalLines[0];
  const right = verticalLines[verticalLines.length - 1];

  // Validate aspect ratio
  const cardWidth = right - left;
  const cardHeight = bottom - top;
  const aspectRatio = cardWidth / cardHeight;

  const expectedRatio = CARD_ASPECT_RATIOS[guideOrientation];
  const tolerance = 0.3; // Allow 30% deviation

  if (aspectRatio < expectedRatio * (1 - tolerance) ||
      aspectRatio > expectedRatio * (1 + tolerance)) {
    return null;
  }

  // Calculate confidence based on how well the aspect ratio matches
  const ratioError = Math.abs(aspectRatio - expectedRatio) / expectedRatio;
  const confidence = Math.max(0, 100 - ratioError * 200);

  return {
    topLeft: { x: left, y: top },
    topRight: { x: right, y: top },
    bottomRight: { x: right, y: bottom },
    bottomLeft: { x: left, y: bottom },
    confidence,
  };
}

/**
 * Calculate alignment quality of detected card
 */
function calculateAlignment(
  bounds: CardBounds | null,
  frameWidth: number,
  frameHeight: number,
  guideOrientation: GuideOrientation
): CardAlignment {
  const defaultAlignment: CardAlignment = {
    isCentered: false,
    isParallel: true, // Assume parallel since we detect axis-aligned edges
    rotationAngle: 0,
    fillPercent: 0,
    isWithinGuide: false,
  };

  if (!bounds) {
    return defaultAlignment;
  }

  // Calculate card dimensions and center
  const cardWidth = bounds.topRight.x - bounds.topLeft.x;
  const cardHeight = bounds.bottomLeft.y - bounds.topLeft.y;
  const cardCenterX = bounds.topLeft.x + cardWidth / 2;
  const cardCenterY = bounds.topLeft.y + cardHeight / 2;

  // Frame center
  const frameCenterX = frameWidth / 2;
  const frameCenterY = frameHeight / 2;

  // Check centering (within 10% of frame)
  const centerThreshold = Math.min(frameWidth, frameHeight) * 0.1;
  const xOffset = Math.abs(cardCenterX - frameCenterX);
  const yOffset = Math.abs(cardCenterY - frameCenterY);
  const isCentered = xOffset < centerThreshold && yOffset < centerThreshold;

  // Calculate guide frame dimensions
  const guideAspectRatio = guideOrientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5;
  const guideWidth = Math.min(frameWidth * GUIDE_WIDTH_PERCENT, GUIDE_MAX_WIDTH);
  const guideHeight = guideWidth / guideAspectRatio;
  const guideArea = guideWidth * guideHeight;

  // Calculate fill percent
  const cardArea = cardWidth * cardHeight;
  const fillPercent = Math.min(100, (cardArea / guideArea) * 100);

  // Check if within guide bounds
  const guideLeft = (frameWidth - guideWidth) / 2;
  const guideRight = guideLeft + guideWidth;
  const guideTop = (frameHeight - guideHeight) / 2;
  const guideBottom = guideTop + guideHeight;

  const isWithinGuide =
    bounds.topLeft.x >= guideLeft - 10 &&
    bounds.topRight.x <= guideRight + 10 &&
    bounds.topLeft.y >= guideTop - 10 &&
    bounds.bottomLeft.y <= guideBottom + 10;

  // Calculate rotation (simplified - check if edges are parallel)
  const topEdgeAngle = Math.atan2(
    bounds.topRight.y - bounds.topLeft.y,
    bounds.topRight.x - bounds.topLeft.x
  ) * (180 / Math.PI);

  return {
    isCentered,
    isParallel: Math.abs(topEdgeAngle) < 5,
    rotationAngle: topEdgeAngle,
    fillPercent,
    isWithinGuide,
  };
}

/**
 * Analyze lighting conditions
 */
function analyzeLighting(imageData: ImageData, bounds: CardBounds | null): LightingInfo {
  const { data, width, height } = imageData;

  // Sample pixels (within bounds if available, otherwise whole image)
  let totalBrightness = 0;
  let sampleCount = 0;
  let maxBrightness = 0;
  let minBrightness = 255;
  let highBrightnessCount = 0;
  let lowBrightnessCount = 0;

  const startX = bounds ? Math.max(0, Math.floor(bounds.topLeft.x)) : 0;
  const endX = bounds ? Math.min(width, Math.ceil(bounds.topRight.x)) : width;
  const startY = bounds ? Math.max(0, Math.floor(bounds.topLeft.y)) : 0;
  const endY = bounds ? Math.min(height, Math.ceil(bounds.bottomLeft.y)) : height;

  for (let y = startY; y < endY; y += 4) {
    for (let x = startX; x < endX; x += 4) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      totalBrightness += brightness;
      sampleCount++;
      maxBrightness = Math.max(maxBrightness, brightness);
      minBrightness = Math.min(minBrightness, brightness);

      if (brightness > 240) highBrightnessCount++;
      if (brightness < 30) lowBrightnessCount++;
    }
  }

  const avgBrightness = sampleCount > 0 ? totalBrightness / sampleCount : 128;
  const hasGlare = highBrightnessCount > sampleCount * 0.02; // >2% overexposed
  const hasShadow = lowBrightnessCount > sampleCount * 0.15; // >15% very dark

  let level: LightingInfo['level'];
  let message: string;

  if (avgBrightness < 30) {
    level = 'too_dark';
    message = 'Too dark - add more light';
  } else if (avgBrightness < 60) {
    level = 'dim';
    message = 'Dim - more light recommended';
  } else if (avgBrightness < 200) {
    level = 'good';
    message = 'Good lighting';
  } else if (avgBrightness < 230) {
    level = 'bright';
    message = 'Bright - watch for glare';
  } else {
    level = 'too_bright';
    message = 'Too bright - reduce glare';
  }

  return {
    level,
    brightness: avgBrightness,
    message,
    hasGlare,
    hasShadow,
  };
}

/**
 * Generate warnings based on detection results
 */
function generateWarnings(
  bounds: CardBounds | null,
  alignment: CardAlignment,
  lighting: LightingInfo,
  frameWidth: number,
  frameHeight: number
): CardWarning[] {
  const warnings: CardWarning[] = [];

  if (!bounds) {
    warnings.push('corners_cut_off');
    return warnings;
  }

  // Size warnings
  if (alignment.fillPercent < 50) {
    warnings.push('card_too_small');
  } else if (alignment.fillPercent > 95) {
    warnings.push('card_too_large');
  }

  // Position warnings
  if (!alignment.isCentered) {
    warnings.push('card_off_center');
  }

  // Rotation warning
  if (!alignment.isParallel) {
    warnings.push('card_rotated');
  }

  // Lighting warnings
  if (lighting.hasGlare) {
    warnings.push('glare_detected');
  }
  if (lighting.hasShadow) {
    warnings.push('shadow_detected');
  }

  return warnings;
}

/**
 * Determine card orientation from aspect ratio
 */
function detectOrientation(bounds: CardBounds | null): CardOrientation {
  if (!bounds) return 'unknown';

  const width = bounds.topRight.x - bounds.topLeft.x;
  const height = bounds.bottomLeft.y - bounds.topLeft.y;
  const aspectRatio = width / height;

  if (aspectRatio > 1.1) return 'landscape';
  if (aspectRatio < 0.9) return 'portrait';
  return 'unknown';
}

/**
 * Enhanced card detection hook with edge detection
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
      isCentered: false,
      isParallel: true,
      rotationAngle: 0,
      fillPercent: 0,
      isWithinGuide: false,
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
  const frameCountRef = useRef(0);
  const lastConfidenceRef = useRef(0);

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

    frameCountRef.current++;

    // Draw scaled frame
    ctx.drawImage(video, 0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);
    const imageData = ctx.getImageData(0, 0, DETECTION_WIDTH, DETECTION_HEIGHT);

    // Detect edges
    const edges = detectEdges(imageData);

    // Find card edges (lines)
    const lines = findCardEdges(edges, DETECTION_WIDTH, DETECTION_HEIGHT);

    // Estimate card bounds
    const bounds = estimateCardBounds(
      lines.horizontal,
      lines.vertical,
      DETECTION_WIDTH,
      DETECTION_HEIGHT,
      guideOrientation
    );

    // Calculate alignment
    const alignment = calculateAlignment(
      bounds,
      DETECTION_WIDTH,
      DETECTION_HEIGHT,
      guideOrientation
    );

    // Analyze lighting
    const lighting = analyzeLighting(imageData, bounds);

    // Generate warnings
    const warnings = generateWarnings(
      bounds,
      alignment,
      lighting,
      DETECTION_WIDTH,
      DETECTION_HEIGHT
    );

    // Calculate overall confidence
    let confidence = 0;
    if (bounds) {
      confidence = bounds.confidence;
      // Boost confidence for good alignment
      if (alignment.isCentered) confidence += 10;
      if (alignment.isParallel) confidence += 10;
      if (alignment.fillPercent > 60 && alignment.fillPercent < 90) confidence += 10;
      if (lighting.level === 'good') confidence += 10;
      // Reduce for warnings
      confidence -= warnings.length * 5;
      confidence = Math.max(0, Math.min(100, confidence));
    }

    // Smooth confidence for stability
    const smoothedConfidence = lastConfidenceRef.current * 0.4 + confidence * 0.6;
    lastConfidenceRef.current = smoothedConfidence;

    // Determine detection state
    const detected = smoothedConfidence >= CONFIDENCE_THRESHOLD_DETECTED;
    const readyForCapture = detected &&
      smoothedConfidence >= CONFIDENCE_THRESHOLD_READY &&
      warnings.length === 0 &&
      alignment.isWithinGuide;

    // Detect orientation
    const orientation = detectOrientation(bounds);

    // Log diagnostics periodically
    if (frameCountRef.current % 60 === 0) {
      console.log('[CardDetection] Confidence:', Math.round(smoothedConfidence),
        '| Lines H:', lines.horizontal.length, 'V:', lines.vertical.length,
        '| Fill:', Math.round(alignment.fillPercent) + '%',
        '| Warnings:', warnings.length);
    }

    setDetection({
      detected,
      confidence: Math.round(smoothedConfidence),
      bounds,
      orientation,
      alignment,
      lighting,
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
