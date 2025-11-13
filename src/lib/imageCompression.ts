// Image compression utilities for sports card uploads
// Optimizes images for faster processing and reduced storage costs

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
}

interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
}

/**
 * Compresses an image file for optimal upload and processing
 * @param file - Original image file
 * @param options - Compression settings
 * @returns Promise<CompressionResult>
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 3000,
    maxHeight = 3000,
    quality = 0.85,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate optimal dimensions maintaining aspect ratio
        const { width, height } = calculateOptimalDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // CRITICAL: Reset canvas transform and apply correct orientation
        // Canvas must draw image in the same orientation the browser displays it
        // This ensures AI sees the same orientation as the user
        ctx!.save();
        ctx!.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        // Draw image (browser's Image element already handles EXIF orientation)
        // So we draw it as the browser presents it
        ctx!.drawImage(img, 0, 0, width, height);
        ctx!.restore();

        const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create compressed file with appropriate name
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const extension = format === 'webp' ? '.webp' : '.jpg';
          const compressedFile = new File([blob], `${originalName}${extension}`, {
            type: mimeType,
            lastModified: Date.now()
          });

          // Calculate compression metrics
          const originalSize = file.size;
          const compressedSize = blob.size;
          const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

          resolve({
            compressedFile,
            originalSize,
            compressedSize,
            compressionRatio,
            dimensions: { width, height }
          });
        }, mimeType, quality);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if exceeding max dimensions
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > height) {
      // Landscape or square
      width = Math.min(width, maxWidth);
      height = width / aspectRatio;
    } else {
      // Portrait
      height = Math.min(height, maxHeight);
      width = height * aspectRatio;
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Get optimal compression settings based on file size and browser support
 */
export function getOptimalCompressionSettings(fileSize: number): CompressionOptions {
  const supportsWebp = supportsWebP();

  // Adjust compression based on file size
  // 🆕 Increased maxWidth to 3000px to allow Grade A image quality (1200+ DPI equivalent)
  if (fileSize > 5 * 1024 * 1024) { // >5MB
    return {
      maxWidth: 3000,
      quality: 0.80,
      format: supportsWebp ? 'webp' : 'jpeg'
    };
  } else if (fileSize > 2 * 1024 * 1024) { // >2MB
    return {
      maxWidth: 3000,
      quality: 0.85,
      format: supportsWebp ? 'webp' : 'jpeg'
    };
  } else {
    return {
      maxWidth: 3000,
      quality: 0.90,
      format: supportsWebp ? 'webp' : 'jpeg'
    };
  }
}