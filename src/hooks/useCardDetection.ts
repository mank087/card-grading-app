'use client';

import { useEffect, useRef, useState } from 'react';

export interface LightingInfo {
  level: 'too_dark' | 'dim' | 'good' | 'bright' | 'too_bright';
  brightness: number; // 0-255
  message: string;
}

interface DetectionResult {
  isCardDetected: boolean;
  confidence: number; // 0-100
  message: string;
  hints?: string[]; // Specific feedback about what's wrong
  lighting: LightingInfo;
}

/**
 * Enhanced card detection hook
 * Multi-criteria analysis for robust card detection
 */
export const useCardDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true,
  side: 'front' | 'back' = 'front' // Add side parameter to adjust detection
) => {
  const [detection, setDetection] = useState<DetectionResult>({
    isCardDetected: false,
    confidence: 0,
    message: 'Position card in frame',
    hints: [],
    lighting: { level: 'good', brightness: 128, message: 'Checking lighting...' }
  });
  const animationFrameRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const stableFramesRef = useRef<number>(0);
  const lastConfidenceRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastDetectedStateRef = useRef<boolean>(false); // Track last detected state for hysteresis

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

      // Define guide frame area (centered, 82% width, card aspect ratio 2.5:3.5)
      // Matches CameraGuideOverlay.tsx dimensions
      const frameWidth = Math.floor(canvas.width * 0.82);
      const frameHeight = Math.floor(frameWidth * (3.5 / 2.5)); // Card aspect ratio
      const frameX = Math.floor((canvas.width - frameWidth) / 2);
      const frameY = Math.floor((canvas.height - frameHeight) / 2);

      // Sample pixels within guide frame
      const imageData = ctx.getImageData(frameX, frameY, frameWidth, frameHeight);

      // Detect card presence using enhanced multi-criteria analysis
      const result = analyzeFrameForCard(imageData, frameCountRef.current, side);
      frameCountRef.current++;

      // Faster smoothing for quicker response
      const smoothedConfidence = smoothConfidence(result.confidence, lastConfidenceRef.current, 0.6);
      lastConfidenceRef.current = smoothedConfidence;

      // Use hysteresis to prevent flickering (different thresholds for entering vs exiting detected state)
      const ENTER_THRESHOLD = 35; // Threshold to become "detected" (lowered from 50)
      const EXIT_THRESHOLD = 25;  // Threshold to lose "detected" status (lowered from 35)

      let isCardDetected: boolean;
      if (lastDetectedStateRef.current) {
        // Currently detected - need to drop below exit threshold to lose detection
        isCardDetected = smoothedConfidence > EXIT_THRESHOLD;
      } else {
        // Currently not detected - need to exceed enter threshold to gain detection
        isCardDetected = smoothedConfidence > ENTER_THRESHOLD;
      }
      lastDetectedStateRef.current = isCardDetected;

      // Track stable frames
      if (isCardDetected) {
        stableFramesRef.current++;
      } else {
        stableFramesRef.current = 0;
      }

      setDetection({
        isCardDetected,
        confidence: smoothedConfidence,
        message: getDetectionMessage(smoothedConfidence, stableFramesRef.current),
        hints: result.hints,
        lighting: result.lighting
      });

      // Continue detection loop (aim for ~20 FPS to save battery)
      setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(detectCard);
      }, 50);
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
    isStable: stableFramesRef.current >= 3 // Very fast response - 3 frames (~150ms)
  };
};

/**
 * Simplified card detection
 * Uses relaxed thresholds for better user experience
 * Detection is informational only - users can always capture
 */
function analyzeFrameForCard(imageData: ImageData, frameCount: number, side: 'front' | 'back' = 'front'): DetectionResult {
  const { data, width, height } = imageData;
  const hints: string[] = [];

  // Define center region (where card should be)
  const centerWidth = Math.floor(width * 0.7);
  const centerHeight = Math.floor(height * 0.7);
  const centerX = Math.floor((width - centerWidth) / 2);
  const centerY = Math.floor((height - centerHeight) / 2);

  // Sample pixels (optimized sampling)
  const edgePixels: number[] = [];
  const centerPixels: number[] = [];
  const allPixels: number[] = [];

  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      allPixels.push(gray);

      if (x < centerX || x >= centerX + centerWidth || y < centerY || y >= centerY + centerHeight) {
        edgePixels.push(gray);
      } else {
        centerPixels.push(gray);
      }
    }
  }

  // Basic lighting check
  const overallMean = allPixels.reduce((a, b) => a + b, 0) / allPixels.length;
  const centerMean = centerPixels.reduce((a, b) => a + b, 0) / centerPixels.length;
  const edgeMean = edgePixels.reduce((a, b) => a + b, 0) / edgePixels.length;

  // Determine lighting level
  let lighting: LightingInfo;
  if (overallMean < 30) {
    lighting = { level: 'too_dark', brightness: overallMean, message: 'Too dark - add more light' };
    hints.push('Try adding more light');
  } else if (overallMean < 60) {
    lighting = { level: 'dim', brightness: overallMean, message: 'Dim - more light recommended' };
  } else if (overallMean < 200) {
    lighting = { level: 'good', brightness: overallMean, message: 'Good lighting' };
  } else if (overallMean < 230) {
    lighting = { level: 'bright', brightness: overallMean, message: 'Bright - watch for glare' };
  } else {
    lighting = { level: 'too_bright', brightness: overallMean, message: 'Too bright - reduce glare' };
    hints.push('Too bright - reduce glare');
  }

  // Simple texture detection (variance in center)
  const centerVariance = centerPixels.reduce((sum, val) => sum + Math.pow(val - centerMean, 2), 0) / centerPixels.length;
  const centerStdDev = Math.sqrt(centerVariance);

  // Simple contrast detection
  const colorDifference = Math.abs(centerMean - edgeMean);

  // Log diagnostics every 60 frames (~3 seconds)
  if (frameCount % 60 === 0) {
    console.log('[CardDetection] Brightness:', overallMean.toFixed(1),
                '| Detail:', centerStdDev.toFixed(1),
                '| Contrast:', colorDifference.toFixed(1));
  }

  // RELAXED SCORING - More forgiving detection
  let score = 0;

  // Detail/texture score - RELAXED threshold
  const detailThreshold = 8;
  if (centerStdDev > detailThreshold) {
    score += Math.min(40, (centerStdDev - detailThreshold) * 2);
  }

  // Contrast score - RELAXED threshold
  const contrastThreshold = 5;
  if (colorDifference > contrastThreshold) {
    score += Math.min(40, (colorDifference - contrastThreshold) * 3);
  }

  // Brightness bonus - good lighting helps
  if (overallMean >= 50 && overallMean <= 200) {
    score += 20;
  }

  // NO PENALTIES - just additive scoring

  const confidence = Math.min(100, Math.max(0, Math.round(score)));

  // Lower threshold for detection (was 50, now 35)
  const isDetected = confidence > 35;

  // Simple hint if not detected and no lighting issue
  if (!isDetected && hints.length === 0) {
    hints.push('Center the card in the frame');
  }

  return {
    isCardDetected: isDetected,
    confidence,
    message: '',
    hints: hints.length > 0 ? hints : undefined,
    lighting
  };
}


/**
 * Smooth confidence changes with configurable responsiveness
 */
function smoothConfidence(newConfidence: number, oldConfidence: number, alpha: number = 0.5): number {
  // Use exponential moving average with higher alpha for faster response
  return Math.round(alpha * newConfidence + (1 - alpha) * oldConfidence);
}

/**
 * Generate user-friendly detection message with better feedback
 */
function getDetectionMessage(confidence: number, stableFrames: number): string {
  if (confidence < 20) {
    return 'Position card in frame';
  } else if (confidence < 40) {
    return 'Getting closer...';
  } else if (confidence < 50) {
    return 'Almost there...';
  } else if (stableFrames < 10) { // Reduced from 15 for faster feedback
    return 'Hold steady...';
  } else {
    return '✓ Ready to capture!';
  }
}
