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
 * Crop image to guide frame boundaries
 *
 * @param file - Original captured image file
 * @param options - Crop configuration options
 * @returns Promise with cropped image and metadata
 */
export async function cropToGuideFrame(
  file: File,
  options: CropOptions = {}
): Promise<CropResult> {
  const {
    paddingPercent = 0.08, // 8% padding by default (~1 inch buffer at card size)
    maintainAspectRatio = true,
    orientation = 'portrait'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const originalWidth = img.width;
        const originalHeight = img.height;

        // Calculate guide frame dimensions (matches CameraGuideOverlay.tsx)
        // Guide is 96% of width for both orientations to maximize card size
        const guideWidthPercent = 0.96;
        const aspectRatio = orientation === 'portrait' ? (3.5 / 2.5) : (2.5 / 3.5);

        const guideWidth = originalWidth * guideWidthPercent;
        const guideHeight = maintainAspectRatio
          ? guideWidth * aspectRatio
          : originalHeight * guideWidthPercent;

        // Calculate guide position (centered)
        const guideX = (originalWidth - guideWidth) / 2;
        const guideY = (originalHeight - guideHeight) / 2;

        // Apply padding (expand crop area slightly for positioning tolerance)
        const paddingX = guideWidth * paddingPercent;
        const paddingY = guideHeight * paddingPercent;

        const cropX = Math.max(0, guideX - paddingX);
        const cropY = Math.max(0, guideY - paddingY);
        const cropWidth = Math.min(originalWidth - cropX, guideWidth + (paddingX * 2));
        const cropHeight = Math.min(originalHeight - cropY, guideHeight + (paddingY * 2));

        // Create canvas for cropped image
        const canvas = document.createElement('canvas');
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Draw cropped portion
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight, // Source rectangle
          0, 0, cropWidth, cropHeight          // Destination rectangle
        );

        // Convert to blob
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
            originalSize: { width: originalWidth, height: originalHeight },
            croppedSize: { width: cropWidth, height: cropHeight },
            cropArea: {
              x: Math.round(cropX),
              y: Math.round(cropY),
              width: Math.round(cropWidth),
              height: Math.round(cropHeight)
            }
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
