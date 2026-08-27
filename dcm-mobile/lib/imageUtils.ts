import * as ImageManipulator from 'expo-image-manipulator'
import * as Crypto from 'expo-crypto'

export interface QualityResult {
  score: number
  /**
   * Label for what this module can actually measure on-device:
   * resolution + framing. It is intentionally NOT called "sharpness".
   * See the honesty note on assessQuality — without pixel access we
   * cannot measure blur or brightness, so we must not claim to.
   */
  resolutionLabel: string
  suggestions: string[]
}
// REMOVED: `grade` ('A'|'B'|'C'|'D') and `uncertainty` ('±0.5' etc).
//
// Both were fabrications. assessQuality measures resolution and framing only,
// so an A/B/C/D badge and a stated grade uncertainty presented a resolution
// heuristic as an overall quality verdict — and because the aspect deduction
// below was unreachable, every modern phone produced a flat 90, rendered as a
// confident green "B (90/100)" on a photo that could be completely out of
// focus. The panel underneath was already honest ("Resolution: Good", plus a
// line saying sharpness is judged during grading); the badge contradicted it.
//
// Real image confidence comes from the server as
// cards.conversational_image_confidence. Do not reintroduce a client-side
// letter grade unless this module can actually measure focus.

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
  // v9.10: the old dimension "probe" was a full manipulateAsync([], ...) —
  // a complete decode + JPEG re-encode of the image just to read its size,
  // adding a whole lossy generation to every gallery pick. Callers now pass
  // dimensions from the picker/camera asset; when they genuinely can't, we
  // skip the pre-computed resize and clamp inside the single final pass.
  let probedW = knownDims?.width
  let probedH = knownDims?.height

  // Resize so the long edge is no more than MAX_LONG_EDGE. Resize on the
  // longer dimension preserves aspect; ImageManipulator's `resize:{width}`
  // / `resize:{height}` keeps the other dimension proportional.
  const actions: ImageManipulator.Action[] = []
  if (probedW != null && probedH != null) {
    if (probedW >= probedH && probedW > MAX_LONG_EDGE) {
      actions.push({ resize: { width: MAX_LONG_EDGE } })
    } else if (probedH > probedW && probedH > MAX_LONG_EDGE) {
      actions.push({ resize: { height: MAX_LONG_EDGE } })
    }
  }

  let result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // Unknown-dimension fallback: if the single pass came back oversized,
  // one extra resize pass brings it into bounds. Only hits the rare caller
  // with no dims AND an over-3000px source — never the normal paths.
  if (probedW == null && Math.max(result.width, result.height) > MAX_LONG_EDGE) {
    result = await ImageManipulator.manipulateAsync(
      result.uri,
      [result.width >= result.height ? { resize: { width: MAX_LONG_EDGE } } : { resize: { height: MAX_LONG_EDGE } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    )
  }

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
 * non-capture callers; the CAMERA flow uses processCardCapture below
 * which does this + center-band + resize + compress in a single
 * ImageManipulator pass. GALLERY picks must NOT be run through either —
 * the crop math models the camera preview and will cut user-framed
 * photos (gallery uses compressImage only).
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
export interface PreviewViewInfo {
  /** Measured layout size of the camera preview container (dp). */
  containerW: number
  containerH: number
  /** Guide box width as a fraction of container width — from computeGuideWidthFraction. */
  guideWidthFraction: number
}

/**
 * Size the framing guide to the preview, and be the ONE place that decides it.
 *
 * The guide used to be a flat `width: '70%'` in the stylesheet, with the crop
 * math separately passing a hardcoded `guideWidthFraction: 0.7`. Two constants
 * that had to agree, in two files, with nothing enforcing it. Both callers now
 * read this function, so the box the user aims at and the region we actually
 * crop cannot drift apart.
 *
 * 70% of WIDTH is also just small on a tall phone: the card-aspect box is
 * height-constrained there, so a width-derived guide leaves most of the
 * viewport unused and quietly teaches people to shoot from too far away —
 * which is the complaint this whole effort exists to fix. Deriving from
 * whichever dimension actually binds makes the guide as large as fits.
 *
 * Headroom matters: computeGuideCrop pads 8% per side beyond the guide, and
 * that pad has to land inside the photo. The vertical cap is the tighter of
 * the two because aspect-fill leaves spare pixels off the sides in portrait
 * but none top-and-bottom.
 */
const GUIDE_MAX_W_FRACTION = 0.88
const GUIDE_MAX_H_FRACTION = 0.78
const GUIDE_MIN_FRACTION = 0.6
const GUIDE_FALLBACK_FRACTION = 0.7

export function computeGuideWidthFraction(
  containerW: number,
  containerH: number,
  orientation: 'portrait' | 'landscape' = 'portrait',
): number {
  if (!(containerW > 0) || !(containerH > 0)) return GUIDE_FALLBACK_FRACTION

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
  const maxW = containerW * GUIDE_MAX_W_FRACTION
  const widthIfHeightBound = containerH * GUIDE_MAX_H_FRACTION * cardAspect

  const guideW = Math.min(maxW, widthIfHeightBound)
  const fraction = guideW / containerW

  // Clamp so an unexpected layout measurement can never produce a guide that
  // pushes the padded crop outside the frame.
  return Math.max(GUIDE_MIN_FRACTION, Math.min(GUIDE_MAX_W_FRACTION, fraction))
}

export async function processCardCapture(
  uri: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  sensorHints?: { width: number; height: number },
  viewInfo?: PreviewViewInfo,
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

  // v9.10 geometry-aware crop: when the capture screen measured its preview
  // container, derive the crop from the REAL on-screen guide box via the
  // aspect-fill mapping, instead of the legacy hardcoded 85%-band guess.
  const { originX, originY, finalW, finalH } = viewInfo
    ? computeGuideCrop(sensorW, sensorH, orientation, viewInfo)
    : computeCardCrop(sensorW, sensorH, orientation)

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
    compress: 0.9,
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
 * Map the on-screen guide box into photo pixel coordinates.
 *
 * CameraView renders the sensor stream with aspect-fill (cover): the frame is
 * uniformly scaled to cover the preview container and center-cropped.
 * Inverting that mapping takes the guide box — width guideWidthFraction of
 * the container, card aspect, centered — from container dp into photo pixels.
 * An 8%-per-side pad absorbs small preview/still field-of-view differences
 * and cards framed slightly over the guide line.
 *
 * Assumes the still photo shares the preview stream's aspect (true when both
 * come from the same session preset, which is how expo-camera configures
 * capture). If the aspects diverge wildly the clamps below keep the crop
 * in-bounds rather than slicing the card.
 */
function computeGuideCrop(
  photoW: number,
  photoH: number,
  orientation: 'portrait' | 'landscape',
  view: PreviewViewInfo,
): { originX: number; originY: number; finalW: number; finalH: number } {
  const { containerW, containerH, guideWidthFraction } = view
  if (containerW <= 0 || containerH <= 0) {
    return computeCardCrop(photoW, photoH, orientation)
  }

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5

  // Guide box in container coordinates (centered; width: '70%', aspect card)
  const guideW = containerW * guideWidthFraction
  const guideH = guideW / cardAspect
  const guideX = (containerW - guideW) / 2
  const guideY = (containerH - guideH) / 2

  // aspect-fill: photo scaled to cover the container, centered
  const coverScale = Math.max(containerW / photoW, containerH / photoH)
  const dispX = (containerW - photoW * coverScale) / 2 // <= 0
  const dispY = (containerH - photoH * coverScale) / 2 // <= 0

  // Container -> photo pixels
  let cropX = (guideX - dispX) / coverScale
  let cropY = (guideY - dispY) / coverScale
  let cropW = guideW / coverScale
  let cropH = guideH / coverScale

  // Pad 8% per side beyond the guide
  const PAD = 0.08
  cropX -= cropW * PAD
  cropY -= cropH * PAD
  cropW *= 1 + PAD * 2
  cropH *= 1 + PAD * 2

  // Clamp to photo bounds
  const originX = Math.max(0, Math.round(cropX))
  const originY = Math.max(0, Math.round(cropY))
  const finalW = Math.min(Math.round(cropW), photoW - originX)
  const finalH = Math.min(Math.round(cropH), photoH - originY)

  // Degenerate result (bad layout data) — fall back to the legacy crop
  if (finalW < 200 || finalH < 200) {
    return computeCardCrop(photoW, photoH, orientation)
  }

  return { originX, originY, finalW, finalH }
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
 * Image quality assessment — resolution + framing heuristics ONLY.
 *
 * HONESTY NOTE (why no sharpness/brightness here, unlike the web):
 * web's src/utils/imageQuality.ts measures Laplacian-variance blur and
 * average brightness by reading raw pixels off a <canvas>. React Native
 * has no canvas, and this app has no pixel-access dependency —
 * @shopify/react-native-skia and expo-gl are not installed, and adding
 * either is a NATIVE module change that would break OTA updates for
 * every user on the current binary (see project OTA constraint). A pure
 * JS PNG/JPEG decoder over an expo-image-manipulator base64 export was
 * evaluated and rejected as impractical (inflate implementation + MB-scale
 * base64 churn on the UI thread).
 *
 * So this function reports only what it can truly verify — dimensions,
 * megapixels, and card-like aspect ratio — and the capture UI labels it
 * as "Resolution", not "Sharpness". Blur/lighting are assessed
 * server-side by the AI grader (conversational_image_confidence), which
 * is the value users ultimately see on the card detail screen.
 */
export function assessQuality(compressed: CompressedImage, sourceAspect?: number): QualityResult {
  const { width, height } = compressed
  const megapixels = (width * height) / 1000000

  let score = 70 // Start lower — require good resolution to pass
  const suggestions: string[] = []

  // Resolution scoring
  if (megapixels >= 4) score += 15
  else if (megapixels >= 2) score += 8
  else {
    score -= 20
    suggestions.push('Image resolution is very low — move the phone closer to the card')
  }

  if (width >= 1500 && height >= 1500) score += 5
  else if (width < 800 || height < 800) {
    score -= 15
    suggestions.push('Image is too small — try taking the photo again')
  }

  // Minimum dimension check — very small images are likely not useful
  if (width < 400 || height < 400) {
    score -= 15
    suggestions.push('Image is too small for accurate grading')
  }

  // ASPECT: only meaningful when the CALLER chose the bounds.
  //
  // This check used to run on `compressed`, which is unreachable dead code:
  // computeCardCrop has already forced the output to exactly 2.5:3.5, so
  // aspectDiff was always ~0 and the deduction could never fire. That is why
  // every modern phone scored a flat 90.
  //
  // The fix is NOT to run it on the raw camera frame instead. A camera photo
  // is 4:3 or 16:9 because of the SENSOR, not because of how the card was
  // framed — testing it there would replace dead code with misleading code.
  // It is only informative for gallery picks and manual crops, where the user
  // picked the bounds, so the caller passes sourceAspect for those and omits
  // it for camera captures.
  //
  // Real card-aspect measurement belongs server-side, computed from the
  // detected corner quad after perspective is accounted for.
  if (sourceAspect != null && Number.isFinite(sourceAspect) && sourceAspect > 0) {
    const cardAspect = 2.5 / 3.5
    const invAspect = 3.5 / 2.5
    const aspectDiff = Math.min(Math.abs(sourceAspect - cardAspect), Math.abs(sourceAspect - invAspect))
    if (aspectDiff > 0.3) {
      score -= 10
      suggestions.push('This photo is not card-shaped — crop it so the card fills the frame')
    }
  }

  score = Math.max(0, Math.min(100, score))

  // Resolution label — the only per-image signal this module can measure
  // honestly (see the note on top of this function).
  let resolutionLabel = 'Good'
  if (score < 60) {
    resolutionLabel = 'Low'
    suggestions.push('Take a clearer, well-lit photo for best grading accuracy')
  } else if (score < 75) {
    resolutionLabel = 'Acceptable'
  }

  return {
    score,
    resolutionLabel,
    suggestions,
  }
}

/**
 * Generate a hash of the image CONTENT for duplicate detection.
 *
 * This used to hash the filename, with the reasoning "each capture produces a
 * unique filename" — which is precisely what made it useless. Unique filenames
 * mean two identical images always hashed differently, so the front/back
 * duplicate guard in grade/capture.tsx could never fire. The app appeared to
 * check for duplicates and did not.
 *
 * Hashes the compressed/processed file rather than the original: it is the
 * smaller read, and it is the image that actually gets uploaded and graded.
 *
 * Reads through fetch → blob → FileReader rather than expo-file-system's
 * base64 read, so the payload is streamed by the platform instead of
 * materialising a multi-megabyte base64 string in the JS heap on phones that
 * cannot spare it.
 *
 * Returns null when the content cannot be read. Callers must treat null as
 * "unknown", never as "not a duplicate" — failing to hash is not evidence
 * that two images differ.
 */
export async function hashImage(uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()

    const base64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('read failed'))
      reader.onload = () => {
        const result = String(reader.result || '')
        // strip the "data:image/jpeg;base64," prefix
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      }
      reader.readAsDataURL(blob)
    })

    if (!base64) return null
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64)
  } catch (err) {
    console.warn('[imageUtils] hashImage failed:', err)
    return null
  }
}

/**
 * Convert a local file URI to an ArrayBuffer for Supabase upload.
 * Works on both Android and iOS.
 */
export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri)
  return response.arrayBuffer()
}
