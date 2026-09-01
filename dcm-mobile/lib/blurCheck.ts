/**
 * Pre-capture blur detection — the mobile counterpart of the web's
 * src/utils/imageQuality.ts focus check.
 *
 * WHY THIS EXISTS NOW. lib/imageUtils.ts carries an honesty note saying this
 * app cannot measure sharpness because React Native has no canvas and the
 * pixel-access libraries (@shopify/react-native-skia, expo-gl) are native
 * modules we cannot add in an OTA release. That reasoning still holds for
 * those libraries — but it also rejected "a pure JS decoder over an
 * expo-image-manipulator base64 export" as impractical, and that part was
 * measured on the FULL capture (up to 3000x4200). Downscaled to a 512px
 * working copy first — which the web check does anyway, for exactly this
 * reason — the decode is ~0.37 megapixels and the whole path costs a couple
 * of hundred milliseconds. expo-image-manipulator is already a dependency and
 * does the resize natively; jpeg-js is pure JavaScript with no dependencies,
 * so nothing here changes the native binary.
 *
 * The check is ADVISORY. It never blocks a capture and never throws: every
 * failure path returns null, which callers must treat as "sharp, proceed".
 * The authoritative image-quality verdict is still the grader's
 * conversational_image_confidence, formed server-side with far more evidence
 * (glare, shadows, corner visibility) than focus alone.
 */
import * as ImageManipulator from 'expo-image-manipulator'
import { decode as decodeJpeg } from 'jpeg-js'

/**
 * Fixed working resolution for the analysis, in pixels on the long edge.
 *
 * MUST STAY 512, and must stay identical to ANALYSIS_EDGE in the web's
 * src/utils/imageQuality.ts and in scripts/_tmp-blur-calibration.ts.
 * Laplacian variance scales with resolution, so the calibrated thresholds
 * below are only meaningful at the scale they were measured at. Changing this
 * number silently invalidates the threshold.
 */
const ANALYSIS_EDGE = 512

/**
 * Warn below this Laplacian variance (measured at ANALYSIS_EDGE).
 *
 * CALIBRATION SOURCE: scripts/_tmp-blur-calibration.ts, run over the 100 most
 * recent graded submissions (Aug 2026); raw numbers in
 * scripts/_snapshots/blur-calibration/measurements.json. Distribution by the
 * grader's own independent image-confidence letter, at sharp/mitchell scale:
 *
 *     conf   n     p10     p25     p50     p75     p90
 *     A      1   13398   13398   13398   13398   13398
 *     B     63    3695    4667    6036    7750    9972
 *     C     30     795    1600    2212    3055    6821
 *     D      6     317     337     450     493     680
 *
 * The web floor is BLUR_MIN_USABLE = 600 in BROWSER scale, which the header
 * comment in src/utils/imageQuality.ts records as ~455 at mitchell scale. It
 * is bounded by two hand-checked images: 317 (a D, confirmed unusable by eye)
 * must be caught, 515 (a borderline C that calibration deliberately decided to
 * keep) must not be.
 *
 * WHY 400 AND NOT 455. expo-image-manipulator's resize uses the platform
 * scaler (CoreGraphics on iOS, Android's Bitmap.createScaledBitmap), and the
 * downscale kernel materially moves this number — calibration measured
 * mitchell reading ~0.67x lanczos3 and nearest ~1.44x on the same images, and
 * the browser reading 1.22x-1.51x mitchell. Neither native scaler has been
 * characterised. Since an unknown kernel could read anywhere in roughly
 * 1.0x-1.5x of the mitchell figures, the conservative choice — the one that
 * under-warns rather than nagging someone about a good photo — is the LOW end.
 * 400 sits above the confirmed-unusable 317 and well below the
 * must-not-warn 515, and would have flagged 4% of the calibration sample.
 *
 * A false "retake" on a sharp photo costs a real customer a real retake; a
 * missed soft photo is still caught server-side. Where those errors compete,
 * this threshold is set low on purpose. If the native scalers are ever
 * characterised on device, raise it toward 455 — not past it.
 */
export const SHARPNESS_WARN_BELOW = 400

/**
 * Decoder guard. The input is always a 512px working copy (~0.37MP), so this
 * can never legitimately trip — it exists so a malformed header cannot talk
 * the pure-JS decoder into allocating an arbitrary buffer on the JS heap.
 */
const MAX_DECODE_MEGAPIXELS = 2

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * base64 -> bytes. Written out rather than leaning on global atob: Hermes
 * exposes atob on current React Native, but this module must not be the thing
 * that throws on an older runtime that an OTA update can still reach, and the
 * payload here is only ~60-100KB so the hand-rolled loop is not a cost.
 */
function base64ToBytes(b64: string): Uint8Array {
  const lookup = new Uint8Array(128)
  for (let i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS.charCodeAt(i)] = i

  let clean = b64
  const comma = clean.indexOf(',')
  if (comma !== -1 && clean.slice(0, comma).indexOf('base64') !== -1) clean = clean.slice(comma + 1)
  // Strip padding and any stray whitespace/newlines some encoders insert.
  clean = clean.replace(/[^A-Za-z0-9+/]/g, '')

  const byteLength = Math.floor((clean.length * 3) / 4)
  const out = new Uint8Array(byteLength)
  let p = 0
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)]
    const c1 = lookup[clean.charCodeAt(i + 1)]
    const c2 = i + 2 < clean.length ? lookup[clean.charCodeAt(i + 2)] : 0
    const c3 = i + 3 < clean.length ? lookup[clean.charCodeAt(i + 3)] : 0
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (p < byteLength) out[p++] = (n >> 16) & 0xff
    if (p < byteLength) out[p++] = (n >> 8) & 0xff
    if (p < byteLength) out[p++] = n & 0xff
  }
  return out
}

/**
 * Variance of the Laplacian over Rec.601 luma — byte-for-byte the same
 * operator as the web's checkBlur and the calibration script: 8-neighbour
 * kernel, mean of squares, borders excluded. If any of the three change, they
 * must change together or the threshold stops transferring.
 */
function laplacianVariance(rgb: Uint8Array, width: number, height: number, stride: number): number {
  if (width < 3 || height < 3) return 0

  const luma = new Float32Array(width * height)
  for (let p = 0, i = 0; p < luma.length; p++, i += stride) {
    luma[p] = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2]
  }

  let sum = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap =
        -luma[i - width - 1] - luma[i - width] - luma[i - width + 1] +
        -luma[i - 1] + 8 * luma[i] - luma[i + 1] +
        -luma[i + width - 1] - luma[i + width] - luma[i + width + 1]
      sum += lap * lap
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

export interface SharpnessResult {
  /** Laplacian variance at ANALYSIS_EDGE. Higher = sharper. */
  variance: number
  /** True when the image is clearly soft and the user should be nudged. */
  isSoft: boolean
  /** Wall-clock cost of the whole measurement, for telemetry / dev logging. */
  elapsedMs: number
}

/**
 * Measure the sharpness of an already-processed capture.
 *
 * Pass the COMPRESSED/CROPPED uri (what processCardCapture or compressImage
 * returned), not the raw camera file. Two reasons: the crop means the card
 * fills the frame, so a sharp background cannot rescue a soft card, and the
 * calibration sample was exactly these uploaded files.
 *
 * `dims` is the compressed image's pixel size. Pass it — it decides which edge
 * the 512px working copy is fitted to, and the threshold below is only valid
 * at a 512px LONG edge.
 *
 * Returns null on ANY failure — unreadable file, decoder error, degenerate
 * dimensions. Callers must read null as "no opinion", never as "blurry".
 */
export async function measureSharpness(
  uri: string,
  dims?: { width: number; height: number },
): Promise<SharpnessResult | null> {
  const started = Date.now()
  try {
    /**
     * Native resize + JPEG export.
     *
     * The resize must fit the LONG edge to ANALYSIS_EDGE, exactly as the web
     * check and the calibration script do. Constraining the WIDTH instead
     * would leave a portrait 2.5:3.5 card at 512x717 — a 40% larger long edge,
     * at which the variance no longer means what the thresholds were measured
     * to mean (and a 40% costlier decode). The manipulator keeps aspect when
     * only one edge is given, so we pick which edge from the caller's known
     * dimensions and fall back to width when they are absent.
     *
     * compress: 1 keeps the re-encode as close to lossless as JPEG allows — a
     * lossy pass here would smooth exactly the high-frequency detail being
     * measured and bias every image toward "soft".
     */
    const resize = dims && dims.height > dims.width
      ? { resize: { height: ANALYSIS_EDGE } }
      : { resize: { width: ANALYSIS_EDGE } }
    const small = await ImageManipulator.manipulateAsync(
      uri,
      [resize],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    )
    if (!small?.base64) return null

    const bytes = base64ToBytes(small.base64)
    if (bytes.length < 4) return null

    const decoded = decodeJpeg(bytes, {
      useTArray: true,      // RN has no global Buffer
      formatAsRGBA: false,  // 3 bytes/px — a third less allocation than RGBA
      maxResolutionInMP: MAX_DECODE_MEGAPIXELS,
      tolerantDecoding: true,
    })
    if (!decoded?.data || decoded.width < 3 || decoded.height < 3) return null

    const variance = laplacianVariance(decoded.data, decoded.width, decoded.height, 3)
    const elapsedMs = Date.now() - started
    if (__DEV__) {
      console.log(`[blurCheck] ${decoded.width}x${decoded.height} variance=${Math.round(variance)} in ${elapsedMs}ms`)
    }
    return { variance, isSoft: variance < SHARPNESS_WARN_BELOW, elapsedMs }
  } catch (err) {
    // Never surface this. A blur check that breaks a capture is strictly worse
    // than no blur check at all.
    if (__DEV__) console.warn('[blurCheck] measurement failed, treating as sharp:', err)
    return null
  }
}
