import { normalizeCropRegionIds } from '../normalizeCropRegionIds';

export class IncompleteInspectionError extends Error {
  readonly code = 'INSPECTION_INCOMPLETE';
  constructor(readonly stage: 'geometry' | 'zoom' | 'structural' | 'ensemble', readonly reason: string) {
    super(`Inspection incomplete (${stage}). A reliable grade could not be completed. Please contact support for help with this submission.`);
    this.name = 'IncompleteInspectionError';
  }
}

export function inspectionFailureResponse(error: unknown) {
  if (!(error instanceof IncompleteInspectionError)) return {};
  return { error: error.message, inspection_incomplete: true, code: error.code,
    inspection_stage: error.stage, next_action: 'contact_support' };
}

export function completedChoice(choice: any): boolean {
  return choice?.finish_reason === 'stop' && !choice?.message?.refusal && typeof choice?.message?.content === 'string';
}

/** A sample may vote only when every expected region is accounted for exactly once. */
// Why a sample could not vote — the only way to tell a bad photo from a brittle contract.
function rejectSample(reason: string): null {
  console.warn(`[ZOOM] sample rejected: ${reason}`);
  return null;
}

export function parseZoomSample(choice: any, expectedIds: string[]): { regions: any[] } | null {
  if (!completedChoice(choice)) return rejectSample("choice not completed");
  try {
    const parsed = JSON.parse(choice.message.content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return rejectSample("not a JSON object");
    // Reject malformed containers before the alias normalizer can discard them.
    const compact = 'clean' in parsed || 'findings' in parsed;
    if (compact && (!Array.isArray(parsed.clean) || !Array.isArray(parsed.findings) || 'regions' in parsed)) return rejectSample("malformed clean/findings container");
    if (!compact && !Array.isArray(parsed.regions)) return rejectSample("missing regions array");
    const entries = compact ? parsed.findings : parsed.regions;
    if (entries.some((entry: any) => !entry || typeof entry !== 'object')) return rejectSample("non-object entry");
    const { value, rejected } = normalizeCropRegionIds(parsed, expectedIds);
    if (rejected.length) return rejectSample("unknown region id");
    const regions = compact
      ? [...value.clean.map((id: string) => ({ id, card_area: 'most', clean: true, defects: [] })),
        ...value.findings.map((entry: any) => ({ ...entry, clean: false }))]
      : value.regions;
    // Per-region contract (Sept 17 replay): a clean, 91%-fill card lost whole
    // samples because ONE edge strip was "some" card (edge strips always include
    // background) or a findings entry listed no defects. A sample now votes on
    // every region it actually observed; an unobserved region simply gets no
    // vote from this sample, and quorum is counted per region by the batch.
    const ids = new Set(regions.map((entry: any) => entry?.id));
    if (ids.size !== regions.length) return rejectSample("duplicate region id");
    const observed: any[] = [];
    const unobserved: string[] = [];
    for (const region of regions) {
      if (typeof region.clean !== 'boolean' || !Array.isArray(region.defects)) return rejectSample(`region ${region.id} malformed`);
      if (region.clean && region.defects.length !== 0) return rejectSample(`region ${region.id} is both clean and defective`);
      if (region.defects.some((d: any) => !d || typeof d.type !== 'string' || !d.type.trim()
        || !['minor', 'moderate', 'heavy'].includes(d.severity)
        || typeof d.description !== 'string' || !d.description.trim())) return rejectSample("malformed defect");
      const area = String(region.card_area ?? '').toLowerCase();
      if (!['most', 'some', 'none'].includes(area)) return rejectSample(`region ${region.id} has no valid card_area`);
      // Unobserved: no card in the crop, or listed under findings with nothing
      // found (the prompt's way to say "could not inspect"). Never counted clean.
      // "most" + nothing to report = the model saw card material and found it fine;
      // it just filed the region under findings. 13 of 100 production cards failed on
      // exactly this (Sept 17 replay), almost all on edge strips of well-framed photos.
      // Only "some"/"none" with nothing reported is the prompt's "could not inspect".
      if (!region.clean && region.defects.length === 0 && area === 'most') { observed.push({ ...region, clean: true }); continue; }
      if (area === 'none' || (!region.clean && region.defects.length === 0)) { unobserved.push(`${region.id}(${area})`); continue; }
      observed.push(region);
    }
    if (unobserved.length) console.warn(`[ZOOM] sample left unobserved: ${unobserved.join(', ')}`);
    return { regions: observed };
  } catch { return rejectSample("unparseable"); }
}

export const ZOOM_REGION_QUORUM = 3;

/** Region ids that at least ZOOM_REGION_QUORUM samples actually observed. */
export function coveredRegionIds(samples: { regions: any[] }[], expectedIds: string[]): string[] {
  return expectedIds.filter(id => samples.filter(s => s.regions.some(r => r.id === id)).length >= ZOOM_REGION_QUORUM);
}

/** Retry only the failed batch once. Never combine correlated retries into extra votes. */
export async function inspectZoomBatch(expectedIds: string[], request: () => Promise<any>) {
  let promptTokens = 0, completionTokens = 0;
  let best: { regions: any[] }[] = [];
  let bestCovered: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request();
      promptTokens += response.usage?.prompt_tokens ?? 0;
      completionTokens += response.usage?.completion_tokens ?? 0;
      const samples = (Array.isArray(response.choices) ? response.choices : []).slice(0, 5)
        .map((choice: any) => parseZoomSample(choice, expectedIds)).filter(Boolean) as { regions: any[] }[];
      const covered = coveredRegionIds(samples, expectedIds);
      if (covered.length > bestCovered.length || (covered.length === bestCovered.length && samples.length > best.length)) { best = samples; bestCovered = covered; }
      if (bestCovered.length === expectedIds.length) return { batchSamples: best, complete: true, covered: bestCovered.length, attempts: attempt + 1, promptTokens, completionTokens };
      console.warn(`[ZOOM] batch attempt ${attempt + 1}: no quorum for ${expectedIds.filter(id => !covered.includes(id)).join(', ')}`);
    } catch { /* the next attempt is limited to this batch */ }
  }
  return { batchSamples: best, complete: false, covered: bestCovered.length, attempts: 2, promptTokens, completionTokens };
}

export function validFill(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function requireCompleteEnsemble(evaluations: Array<{ final: number | null; cats: Record<string, number | null> }>): void {
  if (evaluations.length !== 3 || evaluations.some(e =>
    [e.final, ...['centering', 'corners', 'edges', 'surface'].map(key => e.cats[key])]
      .some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 10))) {
    throw new IncompleteInspectionError('ensemble', 'three complete evaluations with finite scores in range are required');
  }
}

export function requireCompleteZoom(zoom: { ok: boolean; error?: string; capture?: { outcome: string } } | null): void {
  if (!zoom?.ok) throw new IncompleteInspectionError(zoom?.capture?.outcome === 'abandoned' ? 'geometry' : 'zoom', zoom?.error || 'inspection unavailable');
}
