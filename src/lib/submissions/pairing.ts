// src/lib/submissions/pairing.ts
//
// Client-side pairing logic for the bulk-grading intake page.
// Not part of the server core — pure browser-side File[] -> front/back pairs.
// Spec: docs/SOW_submissions_bulk_grading_2026-08-31.md (WS3).

export type SubmissionConvention = 'alternating' | 'stems' | 'folders';

export interface PickedFile {
  /** Stable per-session id, not tied to File identity (File has no id). */
  id: string;
  file: File;
  name: string;
  lastModified: number;
  /** webkitRelativePath when picked via a folder input; '' for plain multi-select. */
  relativePath: string;
}

export interface PairSlot {
  position: number;
  front: PickedFile | null;
  back: PickedFile | null;
}

/** Natural sort: "file2" sorts before "file10". */
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export function naturalCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

const STEM_SIDE_RE = /^(.*?)[-_ ]?(front|back|f|b)$/i;

function stemSide(name: string): { stem: string; side: 'front' | 'back' } | null {
  const m = STEM_SIDE_RE.exec(stripExt(name).trim());
  if (!m) return null;
  const token = m[2].toLowerCase();
  const side: 'front' | 'back' = token === 'front' || token === 'f' ? 'front' : 'back';
  const stem = (m[1] || '').replace(/[-_ ]+$/, '').toLowerCase() || stripExt(name).toLowerCase();
  return { stem, side };
}

/**
 * Detect the intake convention. Order of preference:
 *  1. Two distinct top-level folders (only possible via webkitdirectory) → 'folders'
 *  2. Every filename carries a front/back (or f/b) token → 'stems'
 *  3. Otherwise → 'alternating' (duplex-scanner default)
 */
export function detectConvention(files: PickedFile[]): SubmissionConvention {
  if (!files.length) return 'alternating';

  const topFolders = new Set(
    files
      .map((f) => (f.relativePath.includes('/') ? f.relativePath.split('/')[0] : ''))
      .filter(Boolean)
  );
  if (topFolders.size === 2) return 'folders';

  const allStemmed = files.every((f) => stemSide(f.name) !== null);
  if (allStemmed) return 'stems';

  return 'alternating';
}

function sortByName(files: PickedFile[]): PickedFile[] {
  return [...files].sort((a, b) => naturalCompare(a.name, b.name));
}
function sortByTime(files: PickedFile[]): PickedFile[] {
  return [...files].sort((a, b) => a.lastModified - b.lastModified || naturalCompare(a.name, b.name));
}

/**
 * True when filename order and lastModified order disagree on which file
 * comes before which, ignoring exact ties. Used to flag the alternating
 * convention's pairing before it silently mis-pairs a reversed stack.
 */
function ordersDisagree(byName: PickedFile[], byTime: PickedFile[]): boolean {
  if (byName.length !== byTime.length) return false;
  for (let i = 0; i < byName.length; i++) {
    if (byName[i].id !== byTime[i].id) return true;
  }
  return false;
}

export interface BuildPairsResult {
  pairs: PairSlot[];
  /** Alternating mode only: filename order and lastModified order disagree. */
  orderMismatch: boolean;
  /** Odd count in alternating mode — hard block per SOW. */
  oddCount: boolean;
}

function pairsFromFlatOrder(ordered: PickedFile[]): PairSlot[] {
  const pairs: PairSlot[] = [];
  for (let i = 0; i < ordered.length; i += 2) {
    pairs.push({ position: pairs.length, front: ordered[i] ?? null, back: ordered[i + 1] ?? null });
  }
  return pairs;
}

function buildAlternating(files: PickedFile[], preferTimeOrder: boolean): BuildPairsResult {
  const byName = sortByName(files);
  const byTime = sortByTime(files);
  const orderMismatch = ordersDisagree(byName, byTime);
  const ordered = preferTimeOrder ? byTime : byName;
  return {
    pairs: pairsFromFlatOrder(ordered),
    orderMismatch,
    oddCount: ordered.length % 2 !== 0,
  };
}

function buildStems(files: PickedFile[]): BuildPairsResult {
  const byStem = new Map<string, { front?: PickedFile; back?: PickedFile }>();
  const order: string[] = [];
  for (const f of files) {
    const parsed = stemSide(f.name);
    const stem = parsed?.stem ?? stripExt(f.name).toLowerCase();
    const side = parsed?.side ?? 'front';
    if (!byStem.has(stem)) {
      byStem.set(stem, {});
      order.push(stem);
    }
    const entry = byStem.get(stem)!;
    if (!entry[side]) entry[side] = f;
    else if (!entry[side === 'front' ? 'back' : 'front']) entry[side === 'front' ? 'back' : 'front'] = f;
  }
  order.sort(naturalCompare);
  const pairs: PairSlot[] = order.map((stem, i) => {
    const entry = byStem.get(stem)!;
    return { position: i, front: entry.front ?? null, back: entry.back ?? null };
  });
  return { pairs, orderMismatch: false, oddCount: false };
}

function buildFolders(files: PickedFile[]): BuildPairsResult {
  const byFolder = new Map<string, PickedFile[]>();
  for (const f of files) {
    const folder = f.relativePath.includes('/') ? f.relativePath.split('/')[0] : '__root__';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push(f);
  }
  const folderNames = Array.from(byFolder.keys()).sort(naturalCompare);
  const frontFolder = folderNames[0];
  const backFolder = folderNames[1];
  const fronts = sortByName(byFolder.get(frontFolder) ?? []);
  const backs = sortByName(byFolder.get(backFolder) ?? []);

  // Prefer matching basenames across folders (same leaf filename in both
  // folders is the common two-folder-export shape); fall back to positional
  // pairing when basenames don't line up.
  const backByBase = new Map(backs.map((b) => [stripExt(b.name).toLowerCase(), b]));
  const usedBackIds = new Set<string>();
  const basenamesMatch = fronts.every((f) => backByBase.has(stripExt(f.name).toLowerCase()));

  const pairs: PairSlot[] = [];
  if (basenamesMatch && fronts.length === backs.length) {
    fronts.forEach((f, i) => {
      const b = backByBase.get(stripExt(f.name).toLowerCase()) ?? null;
      if (b) usedBackIds.add(b.id);
      pairs.push({ position: i, front: f, back: b });
    });
  } else {
    const max = Math.max(fronts.length, backs.length);
    for (let i = 0; i < max; i++) {
      pairs.push({ position: i, front: fronts[i] ?? null, back: backs[i] ?? null });
    }
  }
  return { pairs, orderMismatch: false, oddCount: fronts.length !== backs.length };
}

export function buildPairs(
  files: PickedFile[],
  convention: SubmissionConvention,
  preferTimeOrder = false
): BuildPairsResult {
  if (convention === 'stems') return buildStems(files);
  if (convention === 'folders') return buildFolders(files);
  return buildAlternating(files, preferTimeOrder);
}
