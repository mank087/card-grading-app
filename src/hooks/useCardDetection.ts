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
      if (smoothedConfidence > 70) {
        stableFramesRef.current++;
      } else {
        stableFramesRef.current = 0;
      }

      setDetection({
        isCardDetected: smoothedConfidence > 70,
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
 * Looks for edges and contrast indicating a card
 */
function analyzeFrameForCard(imageData: ImageData): DetectionResult {
  const { data, width, height } = imageData;

  // Calculate edge density using simplified gradient
  let edgeCount = 0;
  let totalPixels = 0;
  const threshold = 30;

  // Sample every 4th pixel for performance
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const idx = (y * width + x) * 4;

      // Get grayscale value
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      // Check horizontal gradient
      const rightIdx = (y * width + (x + 1)) * 4;
      const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;

      // Check vertical gradient
      const downIdx = ((y + 1) * width + x) * 4;
      const downGray = (data[downIdx] + data[downIdx + 1] + data[downIdx + 2]) / 3;

      const gradientH = Math.abs(gray - rightGray);
      const gradientV = Math.abs(gray - downGray);

      if (gradientH > threshold || gradientV > threshold) {
        edgeCount++;
      }

      totalPixels++;
    }
  }

  const edgeDensity = edgeCount / totalPixels;

  // Calculate confidence based on edge density
  // Card should have moderate edge density (not too low = empty, not too high = cluttered)
  let confidence = 0;

  if (edgeDensity < 0.05) {
    // Too few edges - probably empty or very blurry
    confidence = 0;
  } else if (edgeDensity >= 0.05 && edgeDensity <= 0.25) {
    // Good edge density - likely a card
    confidence = Math.round(((edgeDensity - 0.05) / 0.20) * 100);
  } else {
    // Too many edges - cluttered background
    confidence = Math.max(0, 100 - Math.round((edgeDensity - 0.25) * 200));
  }

  return {
    isCardDetected: confidence > 70,
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
  } else if (confidence < 70) {
    return 'Adjusting position...';
  } else if (stableFrames < 15) {
    return 'Hold steady...';
  } else {
    return 'Ready to capture!';
  }
}
