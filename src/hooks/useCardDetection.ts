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

      // Track stable frames
      if (smoothedConfidence > 60) {
        stableFramesRef.current++;
      } else {
        stableFramesRef.current = 0;
      }

      setDetection({
        isCardDetected: smoothedConfidence > 60,
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
 * Looks for a distinct rectangular object different from background
 */
function analyzeFrameForCard(imageData: ImageData): DetectionResult {
  const { data, width, height } = imageData;

  // 1. Calculate center region stats (where card should be)
  const centerWidth = Math.floor(width * 0.6);
  const centerHeight = Math.floor(height * 0.6);
  const centerX = Math.floor((width - centerWidth) / 2);
  const centerY = Math.floor((height - centerHeight) / 2);

  // 2. Calculate edge region stats (background)
  const edgePixels: number[] = [];
  const centerPixels: number[] = [];

  // Sample edges (background)
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      // Check if pixel is in edge region (not in center)
      if (x < centerX || x >= centerX + centerWidth || y < centerY || y >= centerY + centerHeight) {
        edgePixels.push(gray);
      } else {
        centerPixels.push(gray);
      }
    }
  }

  // Calculate stats for both regions
  const edgeMean = edgePixels.reduce((a, b) => a + b, 0) / edgePixels.length;
  const centerMean = centerPixels.reduce((a, b) => a + b, 0) / centerPixels.length;

  // Calculate variance for center region (card detail)
  const centerVariance = centerPixels.reduce((sum, val) => sum + Math.pow(val - centerMean, 2), 0) / centerPixels.length;
  const centerStdDev = Math.sqrt(centerVariance);

  // Calculate difference between center and edge (card vs background)
  const colorDifference = Math.abs(centerMean - edgeMean);

  console.log('[CardDetection] Edge Mean:', edgeMean.toFixed(1), 'Center Mean:', centerMean.toFixed(1), 'Diff:', colorDifference.toFixed(1), 'Center StdDev:', centerStdDev.toFixed(1));

  // A card should have:
  // 1. Higher variance in center (details, text, image) - StdDev > 20
  // 2. Different color from edges (distinct object) - Diff > 15

  let confidence = 0;

  // Must have BOTH conditions to be a card
  const hasDetail = centerStdDev > 20;  // Card has texture/detail
  const isDifferent = colorDifference > 15;  // Card is distinct from background

  if (hasDetail && isDifferent) {
    // Both conditions met - likely a card
    // Calculate confidence based on how strong the signals are
    const detailScore = Math.min(100, Math.round((centerStdDev - 20) / 0.4)); // 0-100
    const diffScore = Math.min(100, Math.round((colorDifference - 15) / 0.5)); // 0-100
    confidence = Math.round((detailScore + diffScore) / 2);
  } else if (hasDetail) {
    // Has detail but not distinct - might be detailed background
    confidence = Math.min(30, Math.round(centerStdDev / 2));
  } else if (isDifferent) {
    // Different color but no detail - might be solid object
    confidence = Math.min(30, Math.round(colorDifference));
  } else {
    // Neither - definitely not a card
    confidence = 0;
  }

  console.log('[CardDetection] Has Detail:', hasDetail, 'Is Different:', isDifferent, '→ Confidence:', confidence);

  return {
    isCardDetected: confidence > 60, // Card detected if confidence > 60%
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
  if (confidence < 30) {
    return 'Position card in frame';
  } else if (confidence < 60) {
    return 'Adjusting position...';
  } else if (stableFrames < 15) {
    return 'Hold steady...';
  } else {
    return 'Ready to capture!';
  }
}
