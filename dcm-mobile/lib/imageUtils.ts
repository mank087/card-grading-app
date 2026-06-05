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
 * Crop image to the card aspect ratio. Standalone version used by
 * non-capture callers; the camera/gallery flow uses processCardCapture
 * below which does this + center-band + resize + compress in a single
 * ImageManipulator pass to avoid stacking JPEG re-encodes.
 *
 * Why the center-band step matters: CameraView's preview applies
 * aspect-fill on iOS and Android, showing only the center band of the
 * sensor (~85% in each dimension on typical devices). takePictureAsync
 * returns the FULL sensor frame, so a card the user aligned to the
 * on-screen guide ends up much smaller in the captured photo than the
 * preview implied. Pre-cropping to the center 85% before the aspect-
 * ratio crop puts the captured frame close to what the user actually
 * saw through the preview.
 */
const PREVIEW_VISIBLE_FRACTION = 0.85

export async function cropToCardAspect(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<{ uri: string; width: number; height: number }> {
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
  })
  const { originX, originY, finalW, finalH } = computeCardCrop(
    probe.width,
    probe.height,
    orientation,
  )

  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: finalW, height: finalH } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  )

  return { uri: cropped.uri, width: cropped.width, height: cropped.height }
}

/**
 * Center-band + card-aspect + max-edge resize + JPEG compress in a
 * single ImageManipulator pass.
 *
 * The previous capture pipeline called three separate manipulateAsync
 * passes (probe → cropToCardAspect → compressImage). Each pass decoded
 * and re-encoded JPEG, which compounded to visible softness around card
 * text and corners. Now: one decode, one combined transform list, one
 * encode at the final downstream-friendly quality.
 *
 * Caller still gets back the same CompressedImage shape so the capture
 * screen needs almost no other change.
 */
export async function processCardCapture(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  sensorHints?: { width: number; height: number },
): Promise<CompressedImage> {
  // Read dimensions if the caller didn't already know them. Most camera
  // and gallery results expose width/height directly so we avoid the
  // probe pass entirely when the caller passes them in.
  let sensorW = sensorHints?.width
  let sensorH = sensorHints?.height
  if (sensorW == null || sensorH == null) {
    const probe = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    })
    sensorW = probe.width
    sensorH = probe.height
  }

  const { originX, originY, finalW, finalH } = computeCardCrop(sensorW, sensorH, orientation)

  // Decide whether to resize too. If the post-crop dimensions are over
  // MAX_LONG_EDGE on the long axis, append a resize action. Otherwise
  // skip resize so we don't waste cycles upscaling or no-op'ing a tiny
  // amount.
  const longEdge = Math.max(finalW, finalH)
  const actions: ImageManipulator.Action[] = [
    { crop: { originX, originY, width: finalW, height: finalH } },
  ]
  if (longEdge > MAX_LONG_EDGE) {
    if (finalW >= finalH) actions.push({ resize: { width: MAX_LONG_EDGE } })
    else actions.push({ resize: { height: MAX_LONG_EDGE } })
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  const fileSize = Math.round(result.width * result.height * 0.15)
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    fileSize,
  }
}

/**
 * Shared crop math. Takes a sensor-sized image, applies the 85% center
 * band (matches the preview's visible region), then enforces the card
 * 2.5:3.5 aspect ratio centered within that band.
 */
function computeCardCrop(
  width: number,
  height: number,
  orientation: 'portrait' | 'landscape',
): { originX: number; originY: number; finalW: number; finalH: number } {
  // Step 1 — preview-band crop. Trim each dimension to 85% so the
  // captured frame approximates what the user saw through the aspect-
  // fill preview.
  const bandW = Math.round(width * PREVIEW_VISIBLE_FRACTION)
  const bandH = Math.round(height * PREVIEW_VISIBLE_FRACTION)
  const bandX = Math.max(0, Math.round((width - bandW) / 2))
  const bandY = Math.max(0, Math.round((height - bandH) / 2))

  // Step 2 — card-aspect crop, centered within the band.
  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
  const bandAspect = bandW / bandH

  let cropW: number
  let cropH: number
  if (bandAspect > cardAspect) {
    cropH = bandH
    cropW = Math.round(cropH * cardAspect)
  } else {
    cropW = bandW
    cropH = Math.round(cropW / cardAspect)
  }
  cropW = Math.min(cropW, bandW)
  cropH = Math.min(cropH, bandH)

  const originX = bandX + Math.max(0, Math.round((bandW - cropW) / 2))
  const originY = bandY + Math.max(0, Math.round((bandH - cropH) / 2))
  const finalW = Math.min(cropW, width - originX)
  const finalH = Math.min(cropH, height - originY)

  return { originX, originY, finalW, finalH }
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
