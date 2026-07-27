// Image compression utilities for sports card uploads
// Optimizes images for faster processing and reduced storage costs

/**
 * iPhones default to HEIC which Android Chrome and most non-Safari mobile
 * browsers can't render in <img> elements. Detect via MIME type or extension
 * since browsers report HEIC files inconsistently (sometimes empty MIME,
 * sometimes 'image/heic' or 'image/heif').
 */
function isHeicFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/heic' || t === 'image/heif' || t === 'image/heic-sequence' || t === 'image/heif-sequence') return true;
  const n = file.name.toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

/**
 * Convert a HEIC/HEIF file to a JPEG File using heic2any. Returns the
 * original file unchanged if it's not HEIC. Caller should call this BEFORE
 * passing the file to compressImage so the canvas can load it.
 */
export async function ensureBrowserDecodableImage(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  // Lazy import — heic2any is ~80kb and only needed on iPhone uploads.
  const heic2any = (await import('heic2any')).default;
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  // heic2any may return Blob or Blob[] for multi-image HEICs; take the first.
  const out = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([out], newName, { type: 'image/jpeg', lastModified: Date.now() });
}

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
 * Read the pixel dimensions of an image file WITHOUT re-encoding it.
 * Used by the camera path, whose files are already final single-pass JPEGs —
 * running them through compressImage again would add a second lossy generation.
 */
export async function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
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
 * Get compression settings for gallery/desktop uploads.
 *
 * v9.10: flattened. The old size-tiered ladder (q0.80 above 5MB, q0.85 above
 * 2MB) applied the HARSHEST quantization to the largest, highest-detail
 * originals — exactly the uploads with the most grading signal — and chose
 * WebP output while the storage path and content-type are hardcoded JPEG
 * (files landed in the bucket as WebP bytes named front.jpg). The 3000px
 * resize already bounds file size; a flat q0.90 JPEG costs a little storage
 * and preserves corner/edge detail for zoom inspection.
 */
export function getOptimalCompressionSettings(_fileSize: number): CompressionOptions {
  return {
    maxWidth: 3000,
    quality: 0.90,
    format: 'jpeg'
  };
}