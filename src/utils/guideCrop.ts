/**
 * Guide-based image cropping utility
 * Crops captured images to match the camera guide frame boundaries
 * This ensures consistent framing and removes background clutter
 */

export interface CropResult {
  croppedFile: File;
  croppedDataUrl: string;
  croppedBlob: Blob;
  originalSize: { width: number; height: number };
  croppedSize: { width: number; height: number };
  cropArea: { x: number; y: number; width: number; height: number };
}

export interface CropOptions {
  paddingPercent?: number; // Padding around guide frame (default: 0.05 = 5%)
  maintainAspectRatio?: boolean; // Force card aspect ratio (default: true)
  orientation?: 'portrait' | 'landscape'; // Card orientation (default: 'portrait')
}

/**
 * Crop image to guide frame boundaries.
 *
 * Strategy: The guide overlay sits centered in the camera view and occupies
 * a known percentage of the screen. The camera video frame is also centered.
 * We calculate the card-aspect-ratio crop region as a proportion of the
 * captured image, matching what the guide shows on screen, then add padding.
 */
export async function cropToGuideFrame(
  file: File,
  options: CropOptions = {}
): Promise<CropResult> {
  const {
    paddingPercent = 0.05,
    orientation = 'portrait'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const W = img.width;
        const H = img.height;

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

        // Create canvas for cropped image
        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create cropped image blob'));
            return;
          }

          const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const croppedFile = new File(
            [blob],
            file.name.replace(/\.(jpg|jpeg|png)$/i, '-cropped.jpg'),
            { type: 'image/jpeg' }
          );

          URL.revokeObjectURL(url);

          resolve({
            croppedFile,
            croppedDataUrl,
            croppedBlob: blob,
            originalSize: { width: W, height: H },
            croppedSize: { width: cropW, height: cropH },
            cropArea: { x: cropX, y: cropY, width: cropW, height: cropH }
          });
        }, 'image/jpeg', 0.95);

      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
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
