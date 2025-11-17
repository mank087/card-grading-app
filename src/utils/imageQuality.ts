import { ImageQualityValidation, QualityCheckResult } from '@/types/camera';

/**
 * Check if image is too blurry using Laplacian variance
 * Higher variance = sharper image
 */
function checkBlur(imageData: ImageData): QualityCheckResult {
  const { data, width, height } = imageData;
  let variance = 0;
  const gray: number[] = [];

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Calculate Laplacian variance (simplified)
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1] +
        -gray[idx - 1] + 8 * gray[idx] - gray[idx + 1] +
        -gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1];
      sum += laplacian * laplacian;
      count++;
    }
  }
  variance = sum / count;

  // Thresholds (tuned for card images)
  const BLUR_THRESHOLD_GOOD = 100;
  const BLUR_THRESHOLD_ACCEPTABLE = 50;

  if (variance >= BLUR_THRESHOLD_GOOD) {
    return {
      passed: true,
      score: 100,
      message: 'Image is sharp and clear'
    };
  } else if (variance >= BLUR_THRESHOLD_ACCEPTABLE) {
    return {
      passed: true,
      score: 70,
      message: 'Image quality is acceptable'
    };
  } else {
    return {
      passed: false,
      score: Math.round((variance / BLUR_THRESHOLD_ACCEPTABLE) * 100),
      message: 'Image is too blurry - hold camera steady'
    };
  }
}

/**
 * Check if image brightness is within acceptable range
 * Too dark or too bright will affect grading accuracy
 */
function checkBrightness(imageData: ImageData): QualityCheckResult {
  const { data } = imageData;
  let sum = 0;
  const sampleSize = data.length / 4; // Number of pixels

  // Calculate average brightness
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    sum += brightness;
  }

  const avgBrightness = sum / sampleSize;

  // Ideal range: 80-180 (out of 255)
  const IDEAL_MIN = 80;
  const IDEAL_MAX = 180;
  const ACCEPTABLE_MIN = 60;
  const ACCEPTABLE_MAX = 220;

  if (avgBrightness >= IDEAL_MIN && avgBrightness <= IDEAL_MAX) {
    return {
      passed: true,
      score: 100,
      message: 'Lighting is excellent'
    };
  } else if (avgBrightness >= ACCEPTABLE_MIN && avgBrightness <= ACCEPTABLE_MAX) {
    return {
      passed: true,
      score: 70,
      message: 'Lighting is acceptable'
    };
  } else if (avgBrightness < ACCEPTABLE_MIN) {
    return {
      passed: false,
      score: Math.round((avgBrightness / ACCEPTABLE_MIN) * 100),
      message: 'Image is too dark - add more light'
    };
  } else {
    return {
      passed: false,
      score: Math.max(0, Math.round(100 - ((avgBrightness - ACCEPTABLE_MAX) / (255 - ACCEPTABLE_MAX) * 100))),
      message: 'Image is too bright - reduce light or glare'
    };
  }
}

/**
 * Validate image quality for card grading
 * Returns overall validation result with specific check results
 */
export function validateImageQuality(imageData: ImageData): ImageQualityValidation {
  const blurCheck = checkBlur(imageData);
  const brightnessCheck = checkBrightness(imageData);

  const overallScore = Math.round((blurCheck.score + brightnessCheck.score) / 2);
  const allPassed = blurCheck.passed && brightnessCheck.passed;

  const suggestions: string[] = [];
  if (!blurCheck.passed) {
    suggestions.push('Hold camera steady and tap to focus');
  }
  if (!brightnessCheck.passed) {
    if (brightnessCheck.message.includes('dark')) {
      suggestions.push('Move to a brighter area or turn on lights');
    } else {
      suggestions.push('Reduce direct light or adjust angle to avoid glare');
    }
  }

  return {
    isValid: allPassed && overallScore >= 60,
    overallScore,
    checks: {
      blur: blurCheck,
      brightness: brightnessCheck
    },
    suggestions
  };
}

/**
 * Convert File/Blob to ImageData for quality checking
 */
export async function getImageDataFromFile(file: File | Blob): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      resolve(imageData);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
