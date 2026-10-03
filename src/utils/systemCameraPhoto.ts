import { ensureBrowserDecodableImage } from '@/lib/imageCompression';
import { canvasToJpegFile } from './guideCrop';

/** Keep the phone-camera composition, honor EXIF, and encode once at upload size. */
export async function prepareSystemCameraPhoto(file: File) {
  const readable = await ensureBrowserDecodableImage(file);
  const url = URL.createObjectURL(readable);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not decode photo'));
      img.src = url;
    });
    const scale = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo processing unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToJpegFile(canvas, { quality: 0.92, maxDimension: 3000 });
  } finally { URL.revokeObjectURL(url); }
}
