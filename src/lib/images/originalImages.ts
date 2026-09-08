/**
 * Single-download-per-grade image loader.
 *
 * WHY: a grade used to download the SAME front+back originals from the private
 * "cards" bucket up to three times — once for the CV centering advisory
 * (visionGrader), once for the regioned zoom inspection, and once more for the
 * structural verifier (both in zoomInspection). At ~780 KB + ~850 KB per card
 * and ~5,400 grades/month that was ~23 GB/month of Supabase egress for bytes we
 * already had in memory.
 *
 * The loader below is memoized per grading run: the first consumer fetches, and
 * every later consumer awaits the same promise. Crops are still cut locally with
 * sharp .extract from these buffers — nothing about the grading math changes.
 */

export interface CardOriginals {
  front: Buffer;
  back: Buffer;
}

/**
 * Download both originals once. Throws with the same message shape the zoom
 * pass used to throw so callers' fail-safe branches behave identically.
 */
export async function fetchCardOriginals(frontImageUrl: string, backImageUrl: string): Promise<CardOriginals> {
  const [frontRes, backRes] = await Promise.all([fetch(frontImageUrl), fetch(backImageUrl)]);
  if (!frontRes.ok || !backRes.ok) throw new Error(`image download failed (${frontRes.status}/${backRes.status})`);
  const [front, back] = await Promise.all([
    frontRes.arrayBuffer().then(b => Buffer.from(b)),
    backRes.arrayBuffer().then(b => Buffer.from(b)),
  ]);
  return { front, back };
}

/**
 * Memoized loader for one grading run. Lazy: a card whose path never needs the
 * pixels (non-JSON prompt formats never run the zoom passes) downloads nothing,
 * exactly as before. A failed fetch is NOT cached — the next consumer retries,
 * which matches the old per-call behavior.
 */
export function createCardOriginalsLoader(frontImageUrl: string, backImageUrl: string): () => Promise<CardOriginals> {
  let pending: Promise<CardOriginals> | null = null;
  return () => {
    if (!pending) {
      pending = fetchCardOriginals(frontImageUrl, backImageUrl).catch((err) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
