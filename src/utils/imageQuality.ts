import { ImageQualityValidation, QualityCheckResult } from '@/types/camera';

/**
 * Fixed working resolution for all pixel analysis.
 *
 * Two reasons this is a constant and not "whatever the capture happens to be":
 *
 * 1. MEMORY. This used to run on the full crop — up to 3000x4200 — and push
 *    every pixel's luminance into a plain number[]. That is ~12.6M boxed
 *    doubles (~100MB) on top of the ~50MB ImageData, then a synchronous
 *    12M-iteration convolution on the main thread. The devices most likely to
 *    stall or reload out of memory are low-end Android, which is the same
 *    cohort submitting the photos this function exists to catch.
 *
 * 2. COMPARABILITY. Laplacian variance scales with resolution and with JPEG
 *    generation. Measured on the same scene, a 4K camera capture and a 1200px
 *    gallery pick land in different parts of the scale — so a single set of
 *    thresholds could not mean the same thing for both. Normalising first is
 *    what makes one threshold portable across every source.
 *
 * 512 is comfortably enough for a focus judgement (defocus blur is a
 * low-frequency phenomenon) and bounds the working set at ~1MB.
 */
const ANALYSIS_EDGE = 512;

/**
 * Blur thresholds, in Laplacian variance at ANALYSIS_EDGE.
 *
 * CALIBRATED against the 100 most recent graded submissions (Aug 2026) rather
 * than reasoned about — the first version of this file shipped estimates that
 * turned out to be ~20x too low, so every real photo scored "excellent" and
 * the check was inert. Measured distribution, by the grader's own independent
 * image-confidence letter:
 *
 *     conf   n     p10     p25     p50     p75     p90
 *     A      1   13398   13398   13398   13398   13398
 *     B     63    3695    4667    6036    7750    9972
 *     C     30     795    1600    2212    3055    6821
 *     D      6     317     337     450     493     680
 *
 * The ordering is clean and monotonic, which is meaningful because the two
 * signals are independent: this is pixel maths, that is a vision model's
 * holistic judgement. Bands below put 6% in "too blurry", 5% "slight",
 * 27% "acceptable", 46% "good", 16% "excellent".
 *
 * ── Converted to browser scale ─────────────────────────────────────────────
 * Those figures were measured server-side through sharp. The browser resizes
 * via canvas drawImage, whose filter is NOT the same, so the raw numbers do
 * not transfer. Measured on the same eight originals in Chrome 151 / Windows:
 *
 *     mitchell   browser   ratio          mitchell   browser   ratio
 *          154       211    1.37               972      1337    1.38
 *          317       413    1.30              2192      3136    1.43
 *          515       685    1.33              3425      5164    1.51
 *          795       967    1.22             15890     22326    1.41
 *
 * The ratio is NOT constant — it averages 1.32 below 1000 and 1.45 above, so a
 * single global multiplier (median 1.372) is the wrong instrument. Applied
 * flat it puts the floor at 690, which is above the 685 reading of the
 * borderline card that calibration deliberately decided to KEEP. Each
 * threshold is therefore converted at the ratio local to its own magnitude.
 *
 * The floor is pinned by two measured points and sits between them with
 * margin: 413 (confirmed unusable, must reject) and 685 (borderline, must not).
 *
 * ── Remaining caveats ──────────────────────────────────────────────────────
 * 1. DESKTOP CHROME ONLY. Safari and mobile Chrome have not been checked, and
 *    they do not share a downscale implementation — nor does either share one
 *    with desktop Chrome. Since almost every capture happens on a phone, the
 *    mobile numbers matter more than the ones these were derived from. Re-run
 *    the harness there; if they disagree materially, take the conservative
 *    (lowest) floor rather than averaging.
 * 2. Under-warning is recoverable — the authoritative check is server-side.
 *    Over-warning blocks a paying customer. Where the two errors compete, the
 *    floor is set low.
 * 3. Sample is one time window and skewed (63% B, a single A), so the top of
 *    the scale is the least well evidenced part of it.
 *
 * Ground truth for the floor was hand-checked, not taken on faith: every
 * image below it was viewed. All were genuinely unusable — attack text
 * illegible, fine detail gone — and one had still been graded a 9.
 */
const BLUR_EXCELLENT = 11000; // 8000 mitchell x ~1.45 (sharp-end ratio)
const BLUR_GOOD = 5000;       // 3500 mitchell x ~1.45
const BLUR_ACCEPTABLE = 1900; // 1400 mitchell x ~1.37 (mid-range ratio)
/**
 * The usability floor. Below this a photo cannot support corner, edge, or
 * fine-print inspection, and grading it wastes a credit. This is a HARD
 * constraint — see validateImageQuality.
 *
 * 600 in browser scale ≈ 455 mitchell, rejecting 5% of the calibration sample.
 * Bounded on both sides by measured images rather than by a multiplier:
 * comfortably above 413 (a D-rated card, confirmed unusable by eye) and
 * comfortably below 685 (a C-rated card that is marginal but should only be
 * warned about). Anything in 414..684 satisfies both; 600 centres it.
 */
const BLUR_MIN_USABLE = 600;

/** Average-luminance bounds. Outside ACCEPTABLE the frame is unusable. */
const BRIGHT_EXCELLENT_MIN = 90;
const BRIGHT_EXCELLENT_MAX = 170;
const BRIGHT_GOOD_MIN = 70;
const BRIGHT_GOOD_MAX = 190;
const BRIGHT_ACCEPTABLE_MIN = 50;
const BRIGHT_ACCEPTABLE_MAX = 220;

/**
 * Downsample to a fixed working size and return grayscale luminance.
 *
 * Uses the canvas scaler rather than sampling pixels ourselves: it box-filters
 * on the way down, which suppresses the aliasing that would otherwise read as
 * false high-frequency detail and make a blurry photo look sharp.
 */
function toWorkingLuma(imageData: ImageData): { luma: Float32Array; width: number; height: number } | null {
  const { width: srcW, height: srcH } = imageData;
  if (!srcW || !srcH) return null;

  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  let working: ImageData;
  if (scale === 1) {
    working = imageData;
  } else {
    const src = document.createElement('canvas');
    src.width = srcW;
    src.height = srcH;
    const srcCtx = src.getContext('2d');
    if (!srcCtx) return null;
    srcCtx.putImageData(imageData, 0, 0);

    const dst = document.createElement('canvas');
    dst.width = w;
    dst.height = h;
    const dstCtx = dst.getContext('2d');
    if (!dstCtx) return null;
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'high';
    dstCtx.drawImage(src, 0, 0, w, h);
    working = dstCtx.getImageData(0, 0, w, h);
  }

  const { data } = working;
  const luma = new Float32Array(w * h);
  for (let i = 0, p = 0; p < luma.length; i += 4, p++) {
    luma[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { luma, width: w, height: h };
}

/**
 * Focus check via Laplacian variance. Higher = sharper.
 *
 * `passed` is a real signal now: it means "sharp enough to grade", and
 * validateImageQuality treats a false as disqualifying on its own. It
 * previously bottomed out at a score of 40 regardless of how blurred the
 * frame was, which let good lighting carry an unusable photo past the
 * averaged threshold.
 */
function checkBlur(luma: Float32Array, width: number, height: number): QualityCheckResult {
  if (width < 3 || height < 3) {
    return { passed: false, score: 0, message: 'Image is too small to assess focus' };
  }

  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -luma[i - width - 1] - luma[i - width] - luma[i - width + 1] +
        -luma[i - 1] + 8 * luma[i] - luma[i + 1] +
        -luma[i + width - 1] - luma[i + width] - luma[i + width + 1];
      sum += lap * lap;
      count++;
    }
  }
  const variance = count > 0 ? sum / count : 0;

  if (variance >= BLUR_EXCELLENT) {
    return { passed: true, score: 100, message: 'Excellent sharpness' };
  }
  if (variance >= BLUR_GOOD) {
    return {
      passed: true,
      score: Math.round(75 + ((variance - BLUR_GOOD) / (BLUR_EXCELLENT - BLUR_GOOD)) * 25),
      message: 'Good sharpness',
    };
  }
  if (variance >= BLUR_ACCEPTABLE) {
    return {
      passed: true,
      score: Math.round(60 + ((variance - BLUR_ACCEPTABLE) / (BLUR_GOOD - BLUR_ACCEPTABLE)) * 15),
      message: 'Acceptable sharpness',
    };
  }
  if (variance >= BLUR_MIN_USABLE) {
    return {
      passed: true,
      score: Math.round(40 + ((variance - BLUR_MIN_USABLE) / (BLUR_ACCEPTABLE - BLUR_MIN_USABLE)) * 20),
      message: 'Slightly blurry — may affect accuracy',
    };
  }
  // No score floor: a severely blurred frame must be able to report how bad
  // it is, both to the user and to the validity rule.
  return {
    passed: false,
    score: Math.max(0, Math.round((variance / BLUR_MIN_USABLE) * 40)),
    message: 'Too blurry to grade — hold steady and tap the card to focus',
  };
}

/** Exposure check on mean luminance. */
function checkBrightness(luma: Float32Array): QualityCheckResult {
  let sum = 0;
  for (let i = 0; i < luma.length; i++) sum += luma[i];
  const avg = luma.length > 0 ? sum / luma.length : 0;

  if (avg >= BRIGHT_EXCELLENT_MIN && avg <= BRIGHT_EXCELLENT_MAX) {
    return { passed: true, score: 100, message: 'Lighting is excellent' };
  }
  if (avg >= BRIGHT_GOOD_MIN && avg <= BRIGHT_GOOD_MAX) {
    let score = 85;
    if (avg < BRIGHT_EXCELLENT_MIN) {
      score = Math.round(85 + ((avg - BRIGHT_GOOD_MIN) / (BRIGHT_EXCELLENT_MIN - BRIGHT_GOOD_MIN)) * 15);
    } else if (avg > BRIGHT_EXCELLENT_MAX) {
      score = Math.round(85 + ((BRIGHT_GOOD_MAX - avg) / (BRIGHT_GOOD_MAX - BRIGHT_EXCELLENT_MAX)) * 15);
    }
    return { passed: true, score, message: 'Lighting is good' };
  }
  if (avg >= BRIGHT_ACCEPTABLE_MIN && avg <= BRIGHT_ACCEPTABLE_MAX) {
    let score = 65;
    if (avg < BRIGHT_GOOD_MIN) {
      score = Math.round(65 + ((avg - BRIGHT_ACCEPTABLE_MIN) / (BRIGHT_GOOD_MIN - BRIGHT_ACCEPTABLE_MIN)) * 15);
    } else if (avg > BRIGHT_GOOD_MAX) {
      score = Math.round(65 + ((BRIGHT_ACCEPTABLE_MAX - avg) / (BRIGHT_ACCEPTABLE_MAX - BRIGHT_GOOD_MAX)) * 15);
    }
    return { passed: true, score, message: 'Lighting is acceptable — may affect grading' };
  }
  if (avg < BRIGHT_ACCEPTABLE_MIN) {
    return {
      passed: false,
      score: Math.round((avg / BRIGHT_ACCEPTABLE_MIN) * 60),
      message: 'Too dark to grade — add more light',
    };
  }
  return {
    passed: false,
    score: Math.max(0, Math.round(100 - ((avg - BRIGHT_ACCEPTABLE_MAX) / (255 - BRIGHT_ACCEPTABLE_MAX)) * 100)),
    message: 'Too bright — reduce light or change angle to avoid glare',
  };
}

/**
 * Validate image quality for card grading.
 *
 * VALIDITY IS A CONJUNCTION, NOT AN AVERAGE. The previous rule was
 *
 *   isValid = overallScore >= 50 || (blur.passed && brightness.passed)
 *
 * which could not fail. Replaying both scoring functions across their full
 * input range: the worst case where both checks pass scored 53, already above
 * the 50 threshold, so the second branch never changed an outcome. And the
 * first branch let exposure outvote focus — severe blur scored 40 against the
 * old floor, paired with ideal lighting at 100, and averaged to 70. That is
 * exactly the photograph customers complain about, passing on the strength of
 * good room light.
 *
 * Focus and exposure are now independent constraints. The 0-100 score is kept
 * for display — people understand it — but it no longer decides anything.
 *
 * NOTE ON SCOPE: this measures the whole frame, so a sharp textured background
 * can still flatter a blurry card. Measuring inside the detected card region is
 * the server-side gate's job; this is the cheap client-side first pass.
 */
export function validateImageQuality(imageData: ImageData): ImageQualityValidation {
  const working = toWorkingLuma(imageData);

  // Analysis unavailable (no canvas context, degenerate dimensions). Fail open
  // with a neutral result rather than blocking on our own inability to measure.
  if (!working) {
    const unknown: QualityCheckResult = { passed: true, score: 70, message: 'Quality could not be assessed' };
    return {
      isValid: true,
      overallScore: 70,
      confidenceLetter: 'C',
      gradeUncertainty: '±1.0',
      checks: { blur: unknown, brightness: unknown },
      suggestions: ['Image quality could not be checked on this device — DCM Optic™ will assess it during grading'],
    };
  }

  const blurCheck = checkBlur(working.luma, working.width, working.height);
  const brightnessCheck = checkBrightness(working.luma);

  const overallScore = Math.round((blurCheck.score + brightnessCheck.score) / 2);

  // Both must hold. Neither can compensate for the other.
  const isValid = blurCheck.passed && brightnessCheck.passed;

  // Confidence letter stays deliberately conservative: we verify focus and
  // exposure only, while the grader also weighs glare, corner visibility and
  // shadows. Promising an A on two of five signals sets up disappointment when
  // the server's real confidence comes back lower.
  let confidenceLetter: 'A' | 'B' | 'C' | 'D';
  let gradeUncertainty: string;
  if (!isValid) {
    confidenceLetter = 'D';
    gradeUncertainty = '±1.5';
  } else if (overallScore >= 95) {
    confidenceLetter = 'A';
    gradeUncertainty = '±0.25';
  } else if (overallScore >= 80) {
    confidenceLetter = 'B';
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
    suggestions.push('Hold the camera steady and tap the card to focus');
  }
  if (!brightnessCheck.passed) {
    suggestions.push(
      brightnessCheck.message.includes('dark')
        ? 'Move to a brighter area or turn on more lights'
        : 'Reduce direct light or change angle to avoid glare'
    );
  }
  if (isValid && confidenceLetter === 'C') {
    suggestions.push('Fair image quality — the grade may vary by ±1.0');
  }

  return {
    isValid,
    overallScore,
    confidenceLetter,
    gradeUncertainty,
    checks: { blur: blurCheck, brightness: brightnessCheck },
    suggestions,
  };
}

/**
 * Read a canvas down to analysis size.
 *
 * The camera path already holds the cropped frame on a canvas, so it needs no
 * decode — but calling getImageData on it directly would pull the full
 * 3000x4200 buffer (~50MB) across just to shrink it. Scaling during the read
 * keeps the allocation at ~1MB.
 */
export function getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData | null {
  try {
    const { width: srcW, height: srcH } = canvas;
    if (!srcW || !srcH) return null;

    const scale = Math.min(1, ANALYSIS_EDGE / Math.max(srcW, srcH));
    if (scale === 1) {
      return canvas.getContext('2d')?.getImageData(0, 0, srcW, srcH) ?? null;
    }

    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const dst = document.createElement('canvas');
    dst.width = w;
    dst.height = h;
    const ctx = dst.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

/**
 * Convert File/Blob to ImageData for quality checking.
 *
 * Decodes straight to the analysis size rather than at native resolution: a
 * 12MP gallery pick would otherwise allocate a ~48MB ImageData just to be
 * thrown away by the downsample. drawImage does the scaling during decode.
 */
export async function getImageDataFromFile(file: File | Blob): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, ANALYSIS_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        resolve(ctx.getImageData(0, 0, w, h));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
