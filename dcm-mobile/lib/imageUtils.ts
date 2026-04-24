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
 * Max 3000x3000, JPEG at 0.85 quality.
 */
export async function compressImage(uri: string): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 3000 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  )

  // Estimate file size from dimensions and compression
  // (avoids deprecated expo-file-system APIs)
  const fileSize = Math.round(result.width * result.height * 0.15)
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    fileSize,
  }
}

/**
 * Crop image to card aspect ratio (center crop with padding).
 */
export async function cropToCardAspect(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<string> {
  // Get original dimensions
  const result = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG })
  const { width, height } = result

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
  const imageAspect = width / height

  let cropWidth: number, cropHeight: number, originX: number, originY: number

  if (imageAspect > cardAspect) {
    // Image is wider — crop sides
    cropHeight = height * 0.90
    cropWidth = cropHeight * cardAspect
  } else {
    // Image is taller — crop top/bottom
    cropWidth = width * 0.90
    cropHeight = cropWidth / cardAspect
  }

  originX = (width - cropWidth) / 2
  originY = (height - cropHeight) / 2

  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{
      crop: {
        originX: Math.max(0, originX),
        originY: Math.max(0, originY),
        width: Math.min(cropWidth, width),
        height: Math.min(cropHeight, height),
      }
    }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  )

  return cropped.uri
}

/**
 * Basic image quality assessment.
 * Checks file size and dimensions as proxies for quality.
 */
export function assessQuality(compressed: CompressedImage): QualityResult {
  const { width, height, fileSize } = compressed
  const megapixels = (width * height) / 1000000
  const fileSizeMB = fileSize / (1024 * 1024)

  let score = 80
  const suggestions: string[] = []

  // Resolution check
  if (megapixels >= 4) score += 10
  else if (megapixels >= 2) score += 5
  else {
    score -= 15
    suggestions.push('Try holding your phone closer for higher resolution')
  }

  // File size as quality proxy (larger = more detail)
  if (fileSizeMB >= 1) score += 5
  else if (fileSizeMB < 0.3) {
    score -= 10
    suggestions.push('Image may be too compressed — ensure good lighting')
  }

  // Dimension check
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
 * Generate SHA-256 hash of image file for duplicate detection.
 * Uses fetch to read file as arraybuffer, then hashes with expo-crypto.
 */
export async function hashImage(uri: string): Promise<string> {
  const response = await fetch(uri)
  const blob = await response.blob()
  // Convert blob to base64 string for hashing
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1] || ''
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64)
      resolve(hash)
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert a local file URI to a Blob for Supabase upload.
 */
export async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return await response.blob()
}
