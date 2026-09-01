// src/lib/submissions/preflight.ts
//
// Client-side image-quality preflight for the bulk-grading review grid
// (WS4-lite). Pure functions over a single File — the intake page owns
// scheduling (concurrency, caching results on the PairSlot) and rendering.
// Spec: docs/SOW_submissions_bulk_grading_2026-08-31.md (WS4).
//
// Thresholds are deliberately the same ones the single-card uploader already
// enforces (src/app/upload/page.tsx, "v8.9 MINIMUM-RESOLUTION GATE") so a
// pair that would pass single-card upload never gets a stricter bar here.

import { ensureBrowserDecodableImage, getImageDimensions } from '@/lib/imageCompression';

/** Matches the single uploader's hard block: below this, fine defects vanish. */
export const MIN_LONG_EDGE_PX = 1000;

/** A card is roughly 2.5x3.5in (~5:7) — this is generous, catching only true errors. */
export const MAX_ASPECT_RATIO = 2;

/** Downsample size for the blank/misfeed luminance-variance check. */
const BLANK_SAMPLE_SIZE = 32;

/** Below this variance (0-255 scale, squared units) a sample reads as "blank". */
const BLANK_VARIANCE_THRESHOLD = 20;

export type PreflightSeverity = 'ok' | 'warn' | 'block';

export interface PreflightIssue {
  code: 'decode_failed' | 'low_resolution' | 'blank' | 'bad_aspect_ratio';
  severity: PreflightSeverity;
  message: string;
}

export interface PreflightResult {
  checkedAt: number;
  width: number | null;
  height: number | null;
  issues: PreflightIssue[];
}

/** True when nothing here should block charging/grading — warnings are fine. */
export function preflightBlocks(result: PreflightResult | null | undefined): boolean {
  if (!result) return false;
  return result.issues.some((i) => i.severity === 'block');
}

/**
 * Downsample to a small canvas and measure luminance variance. A scanner
 * misfeed (blank page, or the platen glass with nothing on it) reads as
 * near-uniform; a card — even a plain-backed one — has enough print/texture
 * variance to clear this bar easily.
 */
async function looksBlank(img: HTMLImageElement): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = BLANK_SAMPLE_SIZE;
  canvas.height = BLANK_SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, BLANK_SAMPLE_SIZE, BLANK_SAMPLE_SIZE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, BLANK_SAMPLE_SIZE, BLANK_SAMPLE_SIZE).data;
  } catch {
    // Canvas tainted (shouldn't happen for a local File-backed object URL) —
    // don't block on a check we can't run.
    return false;
  }

  const n = BLANK_SAMPLE_SIZE * BLANK_SAMPLE_SIZE;
  const luminances = new Float64Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Standard luma weights.
    luminances[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += luminances[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = luminances[i] - mean;
    variance += d * d;
  }
  variance /= n;
  return variance < BLANK_VARIANCE_THRESHOLD;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode_failed'));
    img.src = url;
  });
}

/**
 * Run every check for one picked file. Never throws — a decode failure comes
 * back as a `block`-severity issue rather than an exception, since the caller
 * runs this over many files concurrently and one bad file must not abort the
 * batch.
 */
export async function runPreflight(file: File): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const checkedAt = Date.now();

  // (a) decode — HEIC gets converted first, same as the real upload path,
  // so an iPhone scan doesn't fail preflight for a format issue the upload
  // step would have silently fixed anyway.
  let decodable: File;
  try {
    decodable = await ensureBrowserDecodableImage(file);
  } catch {
    decodable = file;
  }

  let dims: { width: number; height: number };
  try {
    dims = await getImageDimensions(decodable);
  } catch {
    issues.push({
      code: 'decode_failed',
      severity: 'block',
      message: "This image won't open — it may be corrupt or an unsupported format.",
    });
    return { checkedAt, width: null, height: null, issues };
  }

  const { width, height } = dims;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.max(1, Math.min(width, height));

  // (b) resolution — matches the single uploader's hard 1000px-long-edge gate.
  if (longEdge < MIN_LONG_EDGE_PX) {
    issues.push({
      code: 'low_resolution',
      severity: 'block',
      message: `${width}×${height} is below the ${MIN_LONG_EDGE_PX}px minimum for accurate grading.`,
    });
  }

  // (d) extreme aspect ratio — non-blocking, just doesn't look like a card.
  if (longEdge / shortEdge > MAX_ASPECT_RATIO) {
    issues.push({
      code: 'bad_aspect_ratio',
      severity: 'warn',
      message: `${width}×${height} doesn't look like a card — check this is the right image.`,
    });
  }

  // (c) blank/misfeed — non-blocking; only checked once the file at least
  // decodes, and skipped if the aspect ratio already flagged it as not a
  // card (a canvas draw of something exotic isn't worth the false positive).
  try {
    const url = URL.createObjectURL(decodable);
    try {
      const img = await loadImage(url);
      if (await looksBlank(img)) {
        issues.push({
          code: 'blank',
          severity: 'warn',
          message: 'Looks blank — scanner misfeed?',
        });
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // Blank check is best-effort — never block on it.
  }

  return { checkedAt, width, height, issues };
}

/**
 * Runs `worker` over `items` with a concurrency cap, calling `onEach` as each
 * settles (so the UI can update per-item rather than waiting for the batch).
 * Order-independent by design — preflight results are cached by id, not
 * position.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const lane = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}
