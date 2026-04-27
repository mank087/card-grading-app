import * as ImageManipulator from 'expo-image-manipulator'
import * as Crypto from 'expo-crypto'

export interface QualityResult {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  blurLabel: string
  brightnessLabel: string
  uncertainty: string
  suggestions: string[]
}

export interface CompressedImage {
  uri: string
  width: number
  height: number
  fileSize: number
}

/**
 * Compress an image for upload.
 * Resizes to max 3000px wide, JPEG at 0.85 quality.
 * Handles both Android (file://) and iOS (ph://) URIs.
 */
export async function compressImage(uri: string): Promise<CompressedImage> {
  // First get original dimensions without modifying
  const original = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // Only resize if wider than 3000px
  const actions: ImageManipulator.Action[] = []
  if (original.width > 3000) {
    actions.push({ resize: { width: 3000 } })
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // Estimate file size from dimensions and compression ratio
  const fileSize = Math.round(result.width * result.height * 0.15)
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    fileSize,
  }
}

/**
 * Crop image to match the camera guide overlay, plus 5% padding.
 *
 * The guide overlay is 70% of the camera view width with a card aspect ratio
 * (2.5:3.5), centered. The camera sensor captures a wider frame than what
 * the guide covers. This crops to match the guide region so background
 * behind the card is removed.
 */
export async function cropToCardAspect(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<string> {
  const original = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  })
  const { width, height } = original

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5

  // The guide overlay is 70% of the camera view width.
  // The camera frame maps to the full CameraView area.
  // We crop to 70% + 5% padding = 75% of the frame, maintaining card AR.
  const guideScale = 0.70
  const padding = 0.05
  const targetScale = guideScale + padding * 2 // 0.80

  let cropWidth: number, cropHeight: number

  // Fit the card AR within the target scale of the captured frame
  const imgAspect = width / height
  if (imgAspect > cardAspect) {
    // Image wider than card — height is the constraint
    cropHeight = Math.round(height * targetScale)
    cropWidth = Math.round(cropHeight * cardAspect)
  } else {
    // Image taller than card — width is the constraint
    cropWidth = Math.round(width * targetScale)
    cropHeight = Math.round(cropWidth / cardAspect)
  }

  // Clamp to image bounds
  cropWidth = Math.min(cropWidth, width)
  cropHeight = Math.min(cropHeight, height)

  // Center the crop
  const originX = Math.max(0, Math.round((width - cropWidth) / 2))
  const originY = Math.max(0, Math.round((height - cropHeight) / 2))

  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{
      crop: {
        originX,
        originY,
        width: Math.min(cropWidth, width - originX),
        height: Math.min(cropHeight, height - originY),
      }
    }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  )

  return cropped.uri
}

/**
 * Image quality assessment based on dimensions.
 */
export function assessQuality(compressed: CompressedImage): QualityResult {
  const { width, height } = compressed
  const megapixels = (width * height) / 1000000

  let score = 80
  const suggestions: string[] = []

  if (megapixels >= 4) score += 10
  else if (megapixels >= 2) score += 5
  else {
    score -= 15
    suggestions.push('Try holding your phone closer for higher resolution')
  }

  if (width >= 1500 && height >= 1500) score += 5
  else if (width < 800 || height < 800) {
    score -= 10
    suggestions.push('Image resolution is low — try taking the photo again')
  }

  score = Math.max(0, Math.min(100, score))

  const grade: QualityResult['grade'] =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'

  const uncertainty =
    grade === 'A' ? '±0' : grade === 'B' ? '±1' : grade === 'C' ? '±2' : '±3'

  return {
    score,
    grade,
    blurLabel: score >= 80 ? 'Good' : score >= 60 ? 'Acceptable' : 'Poor',
    brightnessLabel: score >= 80 ? 'Good' : score >= 60 ? 'Acceptable' : 'Poor',
    uncertainty,
    suggestions,
  }
}

/**
 * Generate a hash for duplicate detection.
 * Uses the filename from the URI since each capture produces a unique filename.
 */
export async function hashImage(uri: string): Promise<string> {
  const filename = uri.split('/').pop() || uri
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, filename)
}

/**
 * Convert a local file URI to an ArrayBuffer for Supabase upload.
 * Works on both Android and iOS.
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri)
  return response.arrayBuffer()
}
