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

  // Thresholds (relaxed for better UX - most phone cameras produce usable images)
  const BLUR_THRESHOLD_EXCELLENT = 400;  // Very sharp
  const BLUR_THRESHOLD_GOOD = 150;       // Sharp enough for accurate grading
  const BLUR_THRESHOLD_ACCEPTABLE = 50;  // Minimum acceptable (lowered from 100)

  if (variance >= BLUR_THRESHOLD_EXCELLENT) {
    return {
      passed: true,
      score: 100,
      message: 'Excellent sharpness'
    };
  } else if (variance >= BLUR_THRESHOLD_GOOD) {
    return {
      passed: true,
      score: Math.round(75 + ((variance - BLUR_THRESHOLD_GOOD) / (BLUR_THRESHOLD_EXCELLENT - BLUR_THRESHOLD_GOOD) * 25)),
      message: 'Good sharpness'
    };
  } else if (variance >= BLUR_THRESHOLD_ACCEPTABLE) {
    return {
      passed: true,
      score: Math.round(60 + ((variance - BLUR_THRESHOLD_ACCEPTABLE) / (BLUR_THRESHOLD_GOOD - BLUR_THRESHOLD_ACCEPTABLE) * 15)),
      message: 'Acceptable sharpness'
    };
  } else {
    // Even "failed" blur still passes - we just warn the user
    return {
      passed: variance >= 25, // Only fail for severely blurry images
      score: Math.max(40, Math.round((variance / BLUR_THRESHOLD_ACCEPTABLE) * 60)),
      message: variance >= 25 ? 'Slightly blurry - may affect accuracy' : 'Image is blurry - consider retaking'
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

  // Relaxed thresholds for better UX while still providing useful feedback
  const EXCELLENT_MIN = 90;
  const EXCELLENT_MAX = 170;
  const GOOD_MIN = 70;
  const GOOD_MAX = 190;
  const ACCEPTABLE_MIN = 50;
  const ACCEPTABLE_MAX = 220;

  if (avgBrightness >= EXCELLENT_MIN && avgBrightness <= EXCELLENT_MAX) {
    return {
      passed: true,
      score: 100,
      message: 'Lighting is excellent'
    };
  } else if (avgBrightness >= GOOD_MIN && avgBrightness <= GOOD_MAX) {
    // Graduated scoring within good range
    let score = 85;
    if (avgBrightness < EXCELLENT_MIN) {
      // Slightly darker than excellent
      score = Math.round(85 + ((avgBrightness - GOOD_MIN) / (EXCELLENT_MIN - GOOD_MIN) * 15));
    } else if (avgBrightness > EXCELLENT_MAX) {
      // Slightly brighter than excellent
      score = Math.round(85 + ((GOOD_MAX - avgBrightness) / (GOOD_MAX - EXCELLENT_MAX) * 15));
    }
    return {
      passed: true,
      score,
      message: 'Lighting is good'
    };
  } else if (avgBrightness >= ACCEPTABLE_MIN && avgBrightness <= ACCEPTABLE_MAX) {
    // Graduated scoring within acceptable range
    let score = 65;
    if (avgBrightness < GOOD_MIN) {
      score = Math.round(65 + ((avgBrightness - ACCEPTABLE_MIN) / (GOOD_MIN - ACCEPTABLE_MIN) * 15));
    } else if (avgBrightness > GOOD_MAX) {
      score = Math.round(65 + ((ACCEPTABLE_MAX - avgBrightness) / (ACCEPTABLE_MAX - GOOD_MAX) * 15));
    }
    return {
      passed: true,
      score,
      message: 'Lighting is acceptable - may affect grading'
    };
  } else if (avgBrightness < ACCEPTABLE_MIN) {
    return {
      passed: false,
      score: Math.round((avgBrightness / ACCEPTABLE_MIN) * 60),
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
 * Aligned with AI grading confidence letter system
 */
export function validateImageQuality(imageData: ImageData): ImageQualityValidation {
  const blurCheck = checkBlur(imageData);
  const brightnessCheck = checkBrightness(imageData);

  const overallScore = Math.round((blurCheck.score + brightnessCheck.score) / 2);
  const allPassed = blurCheck.passed && brightnessCheck.passed;

  // Calculate confidence letter based on AI grading system
  // NOTE: We only check blur + brightness, but AI also checks glare, corners visible, shadows, etc.
  // Therefore we use CONSERVATIVE thresholds to avoid over-promising Grade A
  //
  // AI Grade A needs: <10% glare, all corners visible, even lighting, sharp focus, sub-mm defects
  // We only verify: sharp focus + good brightness (not enough for guaranteed A)
  //
  // A (Excellent): Sharp focus, even lighting, <10% glare → ±0.25 grade uncertainty
  // B (Good): Good clarity, moderate shadows, 10-30% glare → ±0.5 grade uncertainty
  // C (Fair): Noticeable blur, heavy shadows, 30-60% glare → ±1.0 grade uncertainty
  // D (Poor): Severe blur, very poor lighting, >60% glare → ±1.5 grade uncertainty
  let confidenceLetter: 'A' | 'B' | 'C' | 'D';
  let gradeUncertainty: string;

  // Conservative thresholds - we can't detect glare/corners/shadows, so default to B unless exceptional
  if (overallScore >= 95) {
    confidenceLetter = 'A';  // Only perfect scores get A
    gradeUncertainty = '±0.25';
  } else if (overallScore >= 80) {
    confidenceLetter = 'B';  // Most good images will be B (realistic)
    gradeUncertainty = '±0.5';
  } else if (overallScore >= 60) {
    confidenceLetter = 'C';
    gradeUncertainty = '±1.0';
  } else {
    confidenceLetter = 'D';
    gradeUncertainty = '±1.5';
  }

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

  // Add confidence letter explanation
  if (confidenceLetter === 'D') {
    suggestions.push('Poor image quality may result in inaccurate grading (±1.5 grades)');
  } else if (confidenceLetter === 'C') {
    suggestions.push('Fair image quality - grade may vary by ±1.0 grade');
  }

  // More forgiving validation - only mark invalid for severely poor quality
  // This aligns with our philosophy that users should always be able to proceed
  const isValid = overallScore >= 50 || (blurCheck.passed && brightnessCheck.passed);

  return {
    isValid,
    overallScore,
    confidenceLetter,
    gradeUncertainty,
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
