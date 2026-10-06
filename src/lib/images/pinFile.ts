/**
 * Copy a picked file into memory before anything else touches it (Oct 2026).
 *
 * On Android Chrome a photo chosen through the system photo picker (Google
 * Photos and other providers) is backed by a grant that can be revoked as soon
 * as the <input type="file"> is cleared or re-used. The upload page cleared
 * the input right after handing the File to an async handler, so the first
 * read failed ~30 ms later with "The requested file could not be read,
 * typically due to permission problems…" (NotReadableError) — a customer
 * picked the same two photos four times and never got past it.
 *
 * Reading the bytes once, up front, gives a File that no longer depends on the
 * picker's grant. If even that read fails, the original File is returned so
 * the caller's own error handling reports it as before.
 */
export async function pinFile(file: File): Promise<File> {
  try {
    const bytes = await file.arrayBuffer();
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
