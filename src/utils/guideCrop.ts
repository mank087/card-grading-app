/**
 * Guide-based image cropping utility
 * Crops captured images to match the camera guide frame boundaries
 * This ensures consistent framing and removes background clutter
 *
 * v9.1 single-pass encode: crop, resize, and JPEG encode all happen in ONE
 * canvas draw + ONE toBlob call. The camera path hands us a raw capture
 * canvas (never JPEG-encoded), so the file produced here is the first and
 * only lossy encode in the pipeline.
 */

export interface CropResult {
  croppedFile: File;
  /** Preview URL for the cropped image (object URL — revoke when done). */
  croppedDataUrl: string;
  croppedBlob: Blob;
  /** The canvas holding the final cropped/resized pixels (useful for quality checks without re-decoding). */
  croppedCanvas: HTMLCanvasElement;
  originalSize: { width: number; height: number };
  croppedSize: { width: number; height: number };
  cropArea: { x: number; y: number; width: number; height: number };
}

export interface CropOptions {
  paddingPercent?: number; // Padding around guide frame (default: 0.05 = 5%)
  maintainAspectRatio?: boolean; // Force card aspect ratio (default: true)
  orientation?: 'portrait' | 'landscape'; // Card orientation (default: 'portrait')
  /** Resize so the long edge is at most this many pixels (default: 3000, matching compression pipeline). */
  maxDimension?: number;
  /** JPEG encode quality for the single final encode (default: 0.9). */
  quality?: number;
  /** Output file name (default: card-<timestamp>.jpg). */
  fileName?: string;
}

/**
 * Compute the guide-frame crop rectangle for a source of W×H pixels.
 *
 * Strategy: The guide overlay sits centered in the camera view and occupies
 * a known percentage of the screen. The camera video frame is also centered.
 * We calculate the card-aspect-ratio crop region as a proportion of the
 * captured image, matching what the guide shows on screen, then add padding.
 */
function computeGuideCropRect(
  W: number,
  H: number,
  paddingPercent: number,
  orientation: 'portrait' | 'landscape'
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  // Card aspect ratio: 2.5" x 3.5" standard trading card
  const cardAR = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5;

  // The guide overlay uses ~96% of the narrower screen dimension.
  // The captured video frame maps 1:1 to the camera view area.
  // We size the crop box to the largest card-aspect-ratio rectangle
  // that fits within 96% of the image, centered, then add padding.
  const guideScale = 0.96;

  // Fit card AR inside guideScale% of the image
  let cropW: number, cropH: number;
  const imgAR = W / H;

  if (imgAR > cardAR) {
    // Image is wider than card — height-constrained
    cropH = Math.round(H * guideScale);
    cropW = Math.round(cropH * cardAR);
  } else {
    // Image is taller than card — width-constrained
    cropW = Math.round(W * guideScale);
    cropH = Math.round(cropW / cardAR);
  }

  // Add padding
  const padX = Math.round(cropW * paddingPercent);
  const padY = Math.round(cropH * paddingPercent);
  cropW = Math.min(W, cropW + padX * 2);
  cropH = Math.min(H, cropH + padY * 2);

  // Center the crop
  const cropX = Math.max(0, Math.round((W - cropW) / 2));
  const cropY = Math.max(0, Math.round((H - cropH) / 2));
  // Clamp to image bounds
  cropW = Math.min(cropW, W - cropX);
  cropH = Math.min(cropH, H - cropY);

  return { cropX, cropY, cropW, cropH };
}

/**
 * Shared implementation: crop + resize + encode in a single pass.
 */
function cropSourceToGuideFrame(
  source: CanvasImageSource,
  W: number,
  H: number,
  options: CropOptions
): Promise<CropResult> {
  const {
    paddingPercent = 0.05,
    orientation = 'portrait',
    maxDimension = 3000,
    quality = 0.9,
    fileName = `card-${Date.now()}.jpg`
  } = options;

  return new Promise((resolve, reject) => {
    try {
      const { cropX, cropY, cropW, cropH } = computeGuideCropRect(W, H, paddingPercent, orientation);

      // Resize during the same draw so we never re-sample a second time
      const scale = Math.min(1, maxDimension / Math.max(cropW, cropH));
      const outW = Math.max(1, Math.round(cropW * scale));
      const outH = Math.max(1, Math.round(cropH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

      // The ONE and only JPEG encode for the camera path
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create cropped image blob'));
          return;
        }

        const croppedFile = new File(
          [blob],
          fileName.replace(/\.(jpg|jpeg|png)$/i, '') + '-cropped.jpg',
          { type: 'image/jpeg' }
        );

        resolve({
          croppedFile,
          croppedDataUrl: URL.createObjectURL(blob),
          croppedBlob: blob,
          croppedCanvas: canvas,
          originalSize: { width: W, height: H },
          croppedSize: { width: outW, height: outH },
          cropArea: { x: cropX, y: cropY, width: cropW, height: cropH }
        });
      }, 'image/jpeg', quality);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Crop a raw capture canvas to the guide frame — no intermediate encode.
 * This is the camera path's single crop+resize+encode step.
 */
export async function cropCanvasToGuideFrame(
  sourceCanvas: HTMLCanvasElement,
  options: CropOptions = {}
): Promise<CropResult> {
  return cropSourceToGuideFrame(sourceCanvas, sourceCanvas.width, sourceCanvas.height, options);
}

/**
 * Crop an image File to guide frame boundaries (decodes, then single crop+resize+encode).
 */
export async function cropToGuideFrame(
  file: File,
  options: CropOptions = {}
): Promise<CropResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      cropSourceToGuideFrame(img, img.width, img.height, { fileName: file.name, ...options })
        .then((result) => {
          URL.revokeObjectURL(url);
          resolve(result);
        })
        .catch((err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Encode a canvas to a JPEG File in one pass (optionally resizing).
 * Used as the camera-path fallback when guide cropping fails.
 */
export async function canvasToJpegFile(
  sourceCanvas: HTMLCanvasElement,
  options: { quality?: number; maxDimension?: number; fileName?: string } = {}
): Promise<{ file: File; blob: Blob; previewUrl: string; canvas: HTMLCanvasElement }> {
  const {
    quality = 0.9,
    maxDimension = 3000,
    fileName = `card-${Date.now()}.jpg`
  } = options;

  let canvas = sourceCanvas;
  const longEdge = Math.max(sourceCanvas.width, sourceCanvas.height);
  if (longEdge > maxDimension) {
    const scale = maxDimension / longEdge;
    const resized = document.createElement('canvas');
    resized.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    resized.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const ctx = resized.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, resized.width, resized.height);
    canvas = resized;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode image'));
        return;
      }
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      resolve({ file, blob, previewUrl: URL.createObjectURL(blob), canvas });
    }, 'image/jpeg', quality);
  });
}

/**
 * Calculate cropping stats for UI display
 */
export function calculateCropStats(result: CropResult): {
  percentCropped: number;
  areaRemoved: number;
  sizeReduction: number;
} {
  const originalArea = result.originalSize.width * result.originalSize.height;
  const croppedArea = result.croppedSize.width * result.croppedSize.height;
  const areaRemoved = originalArea - croppedArea;

  return {
    percentCropped: Math.round((areaRemoved / originalArea) * 100),
    areaRemoved,
    sizeReduction: Math.round((areaRemoved / originalArea) * 100)
  };
}
