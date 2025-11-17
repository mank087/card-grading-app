'use client';

import { useEffect, useRef, useState } from 'react';

interface DetectionResult {
  isCardDetected: boolean;
  confidence: number; // 0-100
  message: string;
}

/**
 * Lightweight card detection hook
 * Analyzes the guide frame area for card presence
 */
export const useCardDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true
) => {
  const [detection, setDetection] = useState<DetectionResult>({
    isCardDetected: false,
    confidence: 0,
    message: 'Position card in frame'
  });
  const animationFrameRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const stableFramesRef = useRef<number>(0);
  const lastConfidenceRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !videoRef.current) {
      return;
    }

    // Create reusable canvas for detection
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const detectCard = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(detectCard);
        return;
      }

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(detectCard);
        return;
      }

      // Set canvas to video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log('[CardDetection] Canvas initialized:', canvas.width, 'x', canvas.height);
      }

      // Debug: Check if video dimensions are valid
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('[CardDetection] Video dimensions are 0, skipping detection');
        animationFrameRef.current = requestAnimationFrame(detectCard);
        return;
      }

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Define guide frame area (centered, 80% width, card aspect ratio 2.5:3.5)
      const frameWidth = Math.floor(canvas.width * 0.8);
      const frameHeight = Math.floor(frameWidth * (3.5 / 2.5)); // Card aspect ratio
      const frameX = Math.floor((canvas.width - frameWidth) / 2);
      const frameY = Math.floor((canvas.height - frameHeight) / 2);

      // Sample pixels within guide frame
      const imageData = ctx.getImageData(frameX, frameY, frameWidth, frameHeight);

      // Detect card presence
      const result = analyzeFrameForCard(imageData);

      // Smooth confidence changes to avoid flickering
      const smoothedConfidence = smoothConfidence(result.confidence, lastConfidenceRef.current);
      lastConfidenceRef.current = smoothedConfidence;

      // Track stable frames (lowered threshold for testing)
      if (smoothedConfidence > 50) {
        stableFramesRef.current++;
      } else {
        stableFramesRef.current = 0;
      }

      setDetection({
        isCardDetected: smoothedConfidence > 50, // Lowered for testing
        confidence: smoothedConfidence,
        message: getDetectionMessage(smoothedConfidence, stableFramesRef.current)
      });

      // Continue detection loop (30 FPS to save battery)
      animationFrameRef.current = requestAnimationFrame(detectCard);
    };

    detectCard();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, videoRef]);

  return {
    ...detection,
    stableFrames: stableFramesRef.current,
    isStable: stableFramesRef.current >= 15 // 0.5 seconds at 30fps
  };
};

/**
 * Analyze image data for card presence
 * Simplified: Just check for content variance (card vs empty background)
 */
function analyzeFrameForCard(imageData: ImageData): DetectionResult {
  const { data, width, height } = imageData;

  // Calculate average brightness and variance
  let sum = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  // Sample every 8th pixel for performance
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      sum += gray;
      sumSquares += gray * gray;
      sampleCount++;
    }
  }

  const mean = sum / sampleCount;
  const variance = (sumSquares / sampleCount) - (mean * mean);
  const stdDev = Math.sqrt(variance);

  console.log('[CardDetection] Analysis - Mean:', mean.toFixed(1), 'StdDev:', stdDev.toFixed(1), 'Samples:', sampleCount);

  // A card should have moderate variation (edges, text, image)
  // Empty background = low variance (uniform color)
  // Card present = higher variance (details)

  let confidence = 0;

  if (stdDev < 10) {
    // Very uniform - probably empty or solid background
    confidence = 0;
  } else if (stdDev >= 10 && stdDev <= 60) {
    // Good variance - likely a card with details
    confidence = Math.round(((stdDev - 10) / 50) * 100);
  } else {
    // Too much variation - complex background or very detailed card
    confidence = 100;
  }

  console.log('[CardDetection] Final confidence:', confidence);

  return {
    isCardDetected: confidence > 50, // Lowered threshold for testing
    confidence: Math.min(100, Math.max(0, confidence)),
    message: ''
  };
}

/**
 * Smooth confidence changes to avoid flickering
 */
function smoothConfidence(newConfidence: number, oldConfidence: number): number {
  // Use exponential moving average
  const alpha = 0.3;
  return Math.round(alpha * newConfidence + (1 - alpha) * oldConfidence);
}

/**
 * Generate user-friendly detection message
 */
function getDetectionMessage(confidence: number, stableFrames: number): string {
  if (confidence < 20) {
    return 'Position card in frame';
  } else if (confidence < 50) {
    return 'Adjusting position...';
  } else if (stableFrames < 15) {
    return 'Hold steady...';
  } else {
    return 'Ready to capture!';
  }
}
