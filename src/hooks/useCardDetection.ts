'use client';

import { useEffect, useRef, useState } from 'react';

interface DetectionResult {
  isCardDetected: boolean;
  confidence: number; // 0-100
  message: string;
  hints?: string[]; // Specific feedback about what's wrong
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
    hints: []
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

      // Define guide frame area (centered, 80% width, card aspect ratio 2.5:3.5)
      const frameWidth = Math.floor(canvas.width * 0.8);
      const frameHeight = Math.floor(frameWidth * (3.5 / 2.5)); // Card aspect ratio
      const frameX = Math.floor((canvas.width - frameWidth) / 2);
      const frameY = Math.floor((canvas.height - frameHeight) / 2);

      // Sample pixels within guide frame
      const imageData = ctx.getImageData(frameX, frameY, frameWidth, frameHeight);

      // Detect card presence using enhanced multi-criteria analysis
      const result = analyzeFrameForCard(imageData, frameCountRef.current, side);
      frameCountRef.current++;

      // Faster smoothing for quicker response
      const smoothedConfidence = smoothConfidence(result.confidence, lastConfidenceRef.current, 0.5);
      lastConfidenceRef.current = smoothedConfidence;

      // Use hysteresis to prevent flickering (different thresholds for entering vs exiting detected state)
      const ENTER_THRESHOLD = 50; // Threshold to become "detected"
      const EXIT_THRESHOLD = 35;  // Threshold to lose "detected" status (lower = stickier)

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
        hints: result.hints
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
    isStable: stableFramesRef.current >= 10 // Faster response time
  };
};

/**
 * Enhanced multi-criteria card detection
 * Uses weighted scoring for robust detection across lighting conditions
 * Adjusted for card backs (uniform surfaces, lower saturation)
 */
function analyzeFrameForCard(imageData: ImageData, frameCount: number, side: 'front' | 'back' = 'front'): DetectionResult {
  const { data, width, height } = imageData;
  const hints: string[] = [];
  const isBack = side === 'back';

  // Define regions more precisely
  const centerWidth = Math.floor(width * 0.7); // Larger center region
  const centerHeight = Math.floor(height * 0.7);
  const centerX = Math.floor((width - centerWidth) / 2);
  const centerY = Math.floor((height - centerHeight) / 2);

  // Sample pixels (optimized sampling)
  const edgePixels: number[] = [];
  const centerPixels: number[] = [];
  const allPixels: number[] = [];

  // Sample every 6 pixels for better detection (was 8)
  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
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

  // CRITERION 1: Brightness analysis
  const overallMean = allPixels.reduce((a, b) => a + b, 0) / allPixels.length;
  const edgeMean = edgePixels.reduce((a, b) => a + b, 0) / edgePixels.length;
  const centerMean = centerPixels.reduce((a, b) => a + b, 0) / centerPixels.length;

  // Check for lighting issues
  if (overallMean < 30) {
    hints.push('Too dark - add more light');
  } else if (overallMean > 220) {
    hints.push('Too bright - reduce glare');
  }

  // CRITERION 2: Texture/Detail analysis
  const centerVariance = centerPixels.reduce((sum, val) => sum + Math.pow(val - centerMean, 2), 0) / centerPixels.length;
  const centerStdDev = Math.sqrt(centerVariance);

  // CRITERION 3: Edge contrast (card vs background)
  const colorDifference = Math.abs(centerMean - edgeMean);

  // CRITERION 4: Edge detection (look for rectangular edges)
  const edgeStrength = detectEdges(imageData, centerX, centerY, centerWidth, centerHeight);

  // CRITERION 5: Color saturation (cards usually have some color)
  const saturation = calculateSaturation(data, centerX, centerY, centerWidth, centerHeight);

  // Log diagnostics every 30 frames (~1.5 seconds)
  if (frameCount % 30 === 0) {
    console.log('[CardDetection] Brightness:', overallMean.toFixed(1),
                '| Detail:', centerStdDev.toFixed(1),
                '| Contrast:', colorDifference.toFixed(1),
                '| Edges:', edgeStrength.toFixed(1),
                '| Saturation:', saturation.toFixed(1));
  }

  // WEIGHTED SCORING (not all-or-nothing)
  // Adjust weights and thresholds for card backs (more uniform, less colorful)
  let score = 0;
  const weights = isBack
    ? { detail: 20, contrast: 30, edges: 35, saturation: 15 }  // Back: focus on shape/edges
    : { detail: 30, contrast: 25, edges: 25, saturation: 20 }; // Front: balanced

  // Detail score (texture variance) - more lenient for backs
  const detailThreshold = isBack ? 8 : 15;  // Backs can be more uniform
  if (centerStdDev > detailThreshold) {
    const detailScore = Math.min(100, (centerStdDev - detailThreshold) * 2);
    score += (detailScore / 100) * weights.detail;
  } else if (!isBack) {
    hints.push('No card detail detected');
  }

  // Contrast score (card vs background)
  if (colorDifference > 10) {
    const contrastScore = Math.min(100, (colorDifference - 10) * 3);
    score += (contrastScore / 100) * weights.contrast;
  } else {
    hints.push('Card not distinct from background');
  }

  // Edge score (rectangular shape) - MORE important for backs
  if (edgeStrength > 0.3) {
    const edgeScore = Math.min(100, edgeStrength * 100);
    score += (edgeScore / 100) * weights.edges;
  }

  // Saturation score (cards have color) - less important for backs
  const saturationThreshold = isBack ? 5 : 10;  // Backs can be white/gray
  if (saturation > saturationThreshold) {
    const satScore = Math.min(100, saturation * 2);
    score += (satScore / 100) * weights.saturation;
  }

  // Boost score if brightness is good
  if (overallMean >= 50 && overallMean <= 200) {
    score *= 1.2; // 20% bonus for good lighting
  }

  const confidence = Math.min(100, Math.max(0, Math.round(score)));

  return {
    isCardDetected: confidence > 50,
    confidence,
    message: '',
    hints: hints.length > 0 ? hints : undefined
  };
}

/**
 * Simple edge detection using gradient analysis
 */
function detectEdges(imageData: ImageData, cx: number, cy: number, cw: number, ch: number): number {
  const { data, width } = imageData;
  let edgeStrength = 0;
  let edgeCount = 0;

  // Sample horizontal and vertical gradients
  for (let y = cy; y < cy + ch; y += 10) {
    for (let x = cx; x < cx + cw; x += 10) {
      if (x + 1 >= width || y + 1 >= imageData.height) continue;

      const idx = (y * width + x) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      const idxDown = ((y + 1) * width + x) * 4;

      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const grayRight = (data[idxRight] + data[idxRight + 1] + data[idxRight + 2]) / 3;
      const grayDown = (data[idxDown] + data[idxDown + 1] + data[idxDown + 2]) / 3;

      const gx = Math.abs(gray - grayRight);
      const gy = Math.abs(gray - grayDown);
      const gradient = Math.sqrt(gx * gx + gy * gy);

      if (gradient > 20) { // Edge threshold
        edgeStrength += gradient;
        edgeCount++;
      }
    }
  }

  return edgeCount > 0 ? edgeStrength / edgeCount / 100 : 0;
}

/**
 * Calculate color saturation
 */
function calculateSaturation(data: Uint8ClampedArray, cx: number, cy: number, cw: number, ch: number): number {
  let saturation = 0;
  let count = 0;

  for (let y = cy; y < cy + ch; y += 8) {
    for (let x = cx; x < cx + cw; x += 8) {
      const idx = (y * 1000 + x) * 4; // Approximate width
      if (idx + 2 < data.length) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        saturation += (max - min);
        count++;
      }
    }
  }

  return count > 0 ? saturation / count : 0;
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
