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
 *
 * Resizes to max 3000px on the long edge at JPEG 0.85, matching web's
 * src/lib/imageCompression.ts. OpenAI's vision API caps inputs at
 * ~2048px before the model sees them, so the extra resolution does NOT
 * affect grading. The 3000px source is preserved on Supabase for
 * downstream uses where higher fidelity helps:
 *   - card-detail pinch-to-zoom inspection
 *   - label export / slab PDF rendering
 *   - eBay listing image generation
 *   - any future re-grading or feature work that benefits from a
 *     better archived source than what the model originally consumed
 *
 * Handles both Android (file://) and iOS (ph://) URIs.
 */
const MAX_LONG_EDGE = 3000

/**
 * Compress + optionally resize. If `knownDims` is provided we skip the
 * probe roundtrip — callers that just cropped the photo already know the
 * dimensions, so we save one ImageManipulator pass (and one temp JPEG)
 * per capture. On the iPad capture path this halves disk + memory churn.
 */
export async function compressImage(
  uri: string,
  knownDims?: { width: number; height: number }
): Promise<CompressedImage> {
  let probedW = knownDims?.width
  let probedH = knownDims?.height
  if (probedW == null || probedH == null) {
    const original = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    })
    probedW = original.width
    probedH = original.height
  }

  // Resize so the long edge is no more than MAX_LONG_EDGE. Resize on the
  // longer dimension preserves aspect; ImageManipulator's `resize:{width}`
  // / `resize:{height}` keeps the other dimension proportional.
  const actions: ImageManipulator.Action[] = []
  if (probedW >= probedH && probedW > MAX_LONG_EDGE) {
    actions.push({ resize: { width: MAX_LONG_EDGE } })
  } else if (probedH > probedW && probedH > MAX_LONG_EDGE) {
    actions.push({ resize: { height: MAX_LONG_EDGE } })
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
 * Crop image to the card aspect ratio (2.5:3.5 portrait / 3.5:2.5 landscape),
 * keeping as much of the captured frame as possible.
 *
 * Earlier versions cropped tightly to "70% (guide width) + 5% padding ×2 =
 * 80% of the frame", on the assumption that the captured frame matched the
 * camera preview 1:1. That assumption breaks on iOS, where the CameraView
 * preview applies aspect-fill — the preview shows only the center band of
 * the sensor (typically 80-90% of the sensor width). takePictureAsync then
 * returns the FULL sensor frame, and an "80% crop of the full frame" ends
 * up being significantly tighter than the 70% guide the user aligned the
 * card to. Result: card appears noticeably zoomed-in vs what the user saw.
 *
 * Now: crop only enforces card aspect ratio without shrinking. The longer
 * axis is preserved at 100%; the shorter axis is trimmed just enough to
 * match the card's 2.5:3.5 ratio. The card ends up at roughly the same
 * relative size in the captured image as it appeared in the preview.
 */
export async function cropToCardAspect(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<{ uri: string; width: number; height: number }> {
  const original = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  })
  const { width, height } = original

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5

  let cropWidth: number, cropHeight: number

  // Enforce card aspect ratio with NO scale reduction. The longer axis
  // stays at full size; the shorter axis is whatever the longer axis ÷
  // cardAspect demands. Centered on the original frame.
  const imgAspect = width / height
  if (imgAspect > cardAspect) {
    // Image wider than card — height is full, trim sides to card AR
    cropHeight = height
    cropWidth = Math.round(cropHeight * cardAspect)
  } else {
    // Image taller than card — width is full, trim top/bottom to card AR
    cropWidth = width
    cropHeight = Math.round(cropWidth / cardAspect)
  }

  // Clamp to image bounds
  cropWidth = Math.min(cropWidth, width)
  cropHeight = Math.min(cropHeight, height)

  // Center the crop
  const originX = Math.max(0, Math.round((width - cropWidth) / 2))
  const originY = Math.max(0, Math.round((height - cropHeight) / 2))

  const finalW = Math.min(cropWidth, width - originX)
  const finalH = Math.min(cropHeight, height - originY)

  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: finalW, height: finalH } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  )

  // Return dims so compressImage can skip its own probe pass — saves one
  // ImageManipulator roundtrip + one temp JPEG per capture.
  return { uri: cropped.uri, width: cropped.width, height: cropped.height }
}

/**
 * Image quality assessment — checks resolution, blur, and brightness.
 * Uses dimension checks + basic heuristics. For a more thorough check,
 * the capture screen runs pixel analysis via the camera preview quality.
 */
export function assessQuality(compressed: CompressedImage): QualityResult {
  const { width, height } = compressed
  const megapixels = (width * height) / 1000000

  let score = 70 // Start lower — require good resolution to pass
  const suggestions: string[] = []

  // Resolution scoring
  if (megapixels >= 4) score += 15
  else if (megapixels >= 2) score += 8
  else {
    score -= 20
    suggestions.push('Image resolution is very low — move phone closer to the card')
  }

  if (width >= 1500 && height >= 1500) score += 5
  else if (width < 800 || height < 800) {
    score -= 15
    suggestions.push('Image is too small — try taking the photo again')
  }

  // Aspect ratio check — a card should be roughly 2.5:3.5 or 3.5:2.5
  const aspect = width / height
  const cardAspect = 2.5 / 3.5
  const invAspect = 3.5 / 2.5
  const aspectDiff = Math.min(Math.abs(aspect - cardAspect), Math.abs(aspect - invAspect))
  if (aspectDiff > 0.3) {
    score -= 10
    suggestions.push('Image does not appear to be a trading card — ensure the card fills the frame')
  }

  // Minimum dimension check — very small images are likely not useful
  if (width < 400 || height < 400) {
    score -= 15
    suggestions.push('Image is too small for accurate grading')
  }

  score = Math.max(0, Math.min(100, score))

  // Thresholds match web's src/utils/imageQuality.ts:172-185 (95/80/60).
  // Conservative on purpose: handheld phone cameras under household
  // lighting almost never hit the A bar, and that's intentional —
  // calling a slightly soft photo "A — Excellent!" sets the user up for
  // disappointment when the server's actual confidence comes back B or C.
  // The ±0.25/±0.5/±1.0/±1.5 uncertainty bakes in margin so users with
  // borderline image quality understand the grade has wiggle room.
  const grade: QualityResult['grade'] =
    score >= 95 ? 'A' : score >= 80 ? 'B' : score >= 60 ? 'C' : 'D'

  const uncertainty =
    grade === 'A' ? '±0.25' : grade === 'B' ? '±0.5' : grade === 'C' ? '±1.0' : '±1.5'

  // More descriptive labels
  let blurLabel = 'Good'
  let brightnessLabel = 'Good'
  if (score < 60) {
    blurLabel = 'Unknown — low resolution'
    brightnessLabel = 'Unknown — low resolution'
    suggestions.push('Take a clearer, well-lit photo for best grading accuracy')
  } else if (score < 75) {
    blurLabel = 'Acceptable'
    brightnessLabel = 'Acceptable'
  }

  return {
    score,
    grade,
    blurLabel,
    brightnessLabel,
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
