/**
 * EXIF orientation for the analysis copy of a card photo (Oct 2026).
 *
 * Every consumer of a card's pixels (zoom crops, the geometry gate, the
 * structural and low-score verifiers, the display crop) cuts regions from the
 * downloaded buffer with sharp, which ignores the EXIF orientation tag. A photo
 * saved sideways with an orientation tag displays upright in a browser but is
 * cropped sideways here, and the display copy (re-encoded without the tag)
 * then shows sideways to the customer. Rotating the pixels once, at download,
 * puts every consumer in the same upright frame.
 *
 * Scope: only photos that carry an orientation tag other than 1 are touched.
 * Measured Oct 15 2026: 0 of 80 recent uploads carried one (the app and the web
 * uploader bake the orientation in), so this is a safety net, not a fix for a
 * photo that is physically landscape. The stored original is never modified.
 */
import sharp from 'sharp';

export interface OrientationResult {
  buffer: Buffer;
  /** The EXIF orientation found on the input (1 = already upright). */
  orientation: number;
  /** True when the buffer was re-encoded upright. */
  rotated: boolean;
}

export async function normalizeOrientation(original: Buffer): Promise<OrientationResult> {
  const meta = await sharp(original, { failOn: 'none' }).metadata();
  const orientation = typeof meta.orientation === 'number' ? meta.orientation : 1;
  if (orientation === 1) return { buffer: original, orientation, rotated: false };
  // .rotate() with no angle applies the EXIF orientation and strips the tag.
  // JPEG at high quality: the originals are JPEG, and PNG would multiply the
  // bytes every later stage holds in memory and sends to the model.
  const buffer = await sharp(original, { failOn: 'none' }).rotate().jpeg({ quality: 95 }).toBuffer();
  return { buffer, orientation, rotated: true };
}
