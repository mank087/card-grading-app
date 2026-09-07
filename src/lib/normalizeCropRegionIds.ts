/**
 * Canonicalise the region ids in a zoom-inspection sample before voting.
 *
 * The crop prompt names regions "F-COR-TL", "B-SUR-Q2", … and the vote tally
 * in zoomInspection.ts matches on the exact id. Models sometimes echo the
 * label as written in the prompt ("REGION F-COR-TL"), and until Sept 2026
 * such findings were silently dropped — the region simply never received the
 * vote. A calibration replay measured 1,226 unknown ids across 705 samples,
 * every one of them a prefixed-but-otherwise-exact id.
 *
 * Rules, deliberately narrow:
 *   - an id is accepted only if it is exactly an expected id, or exactly an
 *     expected id after a literal "REGION " prefix;
 *   - nothing else is inferred (no case-folding, no side/location guessing,
 *     no partial matches) — anything unrecognised is rejected and reported;
 *   - duplicates are NOT collapsed here. The tally already counts at most one
 *     vote per sample per (region, type); this only makes ids comparable.
 *
 * Pure. Never throws on a well-formed object of either supported shape.
 */

export interface NormalizedCropIds<T = any> {
  value: T;
  /** Ids that were rewritten, e.g. { original: 'REGION F-COR-TL', canonical: 'F-COR-TL' }. */
  aliases: Array<{ original: string; canonical: string }>;
  /** Ids that could not be mapped and were removed from the sample. */
  rejected: unknown[];
}

export function normalizeCropRegionIds<T extends Record<string, any>>(
  raw: T,
  expectedIds: readonly string[]
): NormalizedCropIds<T> {
  const expected = new Set(expectedIds);
  const aliases: Array<{ original: string; canonical: string }> = [];
  const rejected: unknown[] = [];

  const canonical = (id: unknown): string | null => {
    if (typeof id !== 'string') return null;
    if (expected.has(id)) return id;
    if (id.startsWith('REGION ')) {
      const stripped = id.slice('REGION '.length);
      if (expected.has(stripped)) return stripped;
    }
    return null;
  };
  const map = (id: unknown): string | null => {
    const c = canonical(id);
    if (c === null) { rejected.push(id); return null; }
    if (c !== id) aliases.push({ original: id as string, canonical: c });
    return c;
  };

  if (!raw || typeof raw !== 'object') return { value: raw, aliases, rejected };

  const compact = Array.isArray(raw.clean) || Array.isArray(raw.findings);
  if (compact) {
    const clean = (Array.isArray(raw.clean) ? raw.clean : []).map(map).filter((id: string | null): id is string => id !== null);
    const findings = (Array.isArray(raw.findings) ? raw.findings : [])
      .map((f: any) => (f && typeof f === 'object' ? { ...f, id: map(f.id) } : null))
      .filter((f: any) => f && f.id !== null);
    return { value: { ...raw, clean, findings } as T, aliases, rejected };
  }
  if (Array.isArray(raw.regions)) {
    const regions = raw.regions
      .map((r: any) => (r && typeof r === 'object' ? { ...r, id: map(r.id) } : null))
      .filter((r: any) => r && r.id !== null);
    return { value: { ...raw, regions } as T, aliases, rejected };
  }
  return { value: raw, aliases, rejected };
}
