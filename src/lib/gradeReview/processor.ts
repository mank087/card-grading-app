import OpenAI from 'openai';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveGradingModel, applyModelCompat } from '@/lib/grading/modelRouter';
import { CENTERING_INSPECTION_PROMPT, CENTERING_REVIEW_VERSION, compareCentering, prepareCenteringReview, type Side } from './centeringReview';
import { buildCorrection } from './correction';
import { corroborates, describeCentering, explainGradeLimit, retainedResult, type ReviewOutcome, type UnableReason } from './automaticReview';
import { processFullReview, type FullInspect } from './fullProcessor';

type Job = { id: string; card_id: string; lease_token: string; concerns: unknown; snapshot: unknown; card: Record<string, unknown> };
type InspectionImage = { side: Side; dataUrl: string; sha256: string; width: number; height: number };
export interface InspectionResult { observation: unknown; model: string; promptTokens: number; completionTokens: number }
export type Inspect = (images: InspectionImage[], cardId: string, purpose: 'initial' | 'confirmation') => Promise<InspectionResult>;

async function inspect(images: InspectionImage[], cardId: string, purpose: 'initial' | 'confirmation'): Promise<InspectionResult> {
  const model = resolveGradingModel(cardId).model;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 40000 });
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model, max_completion_tokens: 6000, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: CENTERING_INSPECTION_PROMPT + (purpose === 'confirmation' ? '\nMake a fresh measurement of the visible borders. Do not assume a correction is needed. You have not been shown another inspection or its conclusions.' : '') }, { role: 'user', content: images.flatMap(image => [
      { type: 'text' as const, text: `Inspect this ${image.side} face only.` },
      { type: 'image_url' as const, image_url: { url: image.dataUrl, detail: 'high' as const } },
    ]) }],
  };
  const response = await client.chat.completions.create(applyModelCompat(body, model).config);
  const choice = response.choices[0];
  // Preserve returned usage even when output is truncated/refused/malformed;
  // comparison will reject it after the attempt's metadata has been captured.
  return { observation: choice?.finish_reason === 'stop' && !choice.message.refusal ? choice.message.content : null, model,
    promptTokens: response.usage?.prompt_tokens ?? 0, completionTokens: response.usage?.completion_tokens ?? 0 };
}

export async function loadReviewImage(db: ReturnType<typeof supabaseServer>, path: string, side: Side): Promise<InspectionImage> {
  if (path.includes('..') || path.includes('://') || path.startsWith('/')) throw new Error('invalid_image_path');
  const { data, error } = await db.storage.from('cards').createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw new Error('image_unavailable');
  if (new URL(data.signedUrl).origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) throw new Error('invalid_image_origin');
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.body) throw new Error('image_unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 20 * 1024 * 1024) throw new Error('image_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const original = Buffer.concat(chunks);
  const { data: buffer, info } = await sharp(original, { limitInputPixels: 40000000 }).rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 95 }).toBuffer({ resolveWithObject: true });
  return { side, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    sha256: createHash('sha256').update(original).digest('hex'), width: info.width, height: info.height };
}

/** One bounded automatic review: keep, corroborate-and-correct, or inconclusive. */
export async function processOneGradeReview(options: { inspect?: Inspect; inspectFull?: FullInspect; loadImage?: typeof loadReviewImage; db?: ReturnType<typeof supabaseServer> } = {}) {
  const db = options.db ?? supabaseServer();
  const { data, error } = await db.rpc('claim_grade_review');
  if (error) throw new Error('review_claim_failed');
  if (!data) return { processed: false };
  const job = data as Job;
  if (Array.isArray(job.concerns) && job.concerns.some(concern => concern.category !== 'centering')) return processFullReview(db, job, options);
  const started = Date.now();
  let prepared: ReturnType<typeof prepareCenteringReview> | null = null;
  let outcome: ReviewOutcome = 'unable_to_verify';
  let result = '';
  let expected: Record<string, unknown> = {}, patch: Record<string, unknown> = {};
  let audit: Record<string, unknown> = { version: CENTERING_REVIEW_VERSION };
  const calls: Array<{ purpose: string; model: string; prompt_tokens: number; completion_tokens: number }> = [];
  const metadata: Record<string, unknown> = { version: CENTERING_REVIEW_VERSION, calls, inspection_calls: 0 };
  const unable = (reason: UnableReason) => {
    outcome = 'unable_to_verify'; result = retainedResult(prepared, outcome, reason); audit.reason = reason;
  };
  try {
    prepared = prepareCenteringReview(job.snapshot, job.concerns);
  } catch {
    unable('unsupported_report');
  }
  let inspectionError: string | null = null;
  if (prepared) {
    const ready = prepared;
    let first: ReturnType<typeof compareCentering> | null = null;
    let images: InspectionImage[] = [];
    const runInspection = async (purpose: 'initial' | 'confirmation') => {
      metadata.inspection_calls = Number(metadata.inspection_calls) + 1;
      const response = await (options.inspect ?? inspect)(images, job.card_id, purpose);
      calls.push({ purpose, model: response.model, prompt_tokens: response.promptTokens, completion_tokens: response.completionTokens });
      return response;
    };
    try {
      images = await Promise.all(ready.sides.map(side => (options.loadImage ?? loadReviewImage)(db, ready.saved[`${side}_path`], side)));
      metadata.images = images.map(({ side, sha256, width, height }) => ({ side, sha256, width, height }));
      const inspection = await runInspection('initial');
      try { first = compareCentering(ready, inspection.observation); audit.first = first; }
      catch { unable('invalid_observation'); }
    } catch {
      // Only transport failures before a usable observation may retry. Never
      // reroll a valid uncertain or disagreeing inspection until it changes.
      inspectionError = 'inspection_unavailable';
    }
    if (first && !inspectionError) {
      if (first.findings.some(finding => finding.verdict === 'unable_to_verify')) unable('unclear_photos');
      else if (first.findings.every(finding => finding.verdict === 'confirmed')) {
        outcome = 'grade_confirmed'; result = retainedResult(ready, outcome, undefined, first);
      } else {
        let confirmation: ReturnType<typeof compareCentering> | null = null;
        try {
          const inspection = await runInspection('confirmation');
          confirmation = compareCentering(ready, inspection.observation);
          audit.confirmation = confirmation;
        } catch { unable('verification_unavailable'); }
        if (confirmation) {
          const agreed = corroborates(first, confirmation);
          audit.verification = { agreed };
          if (!agreed) unable('disagreement');
          else {
            try {
              const correction = buildCorrection(job.card, job.snapshot, first, job.concerns, job.id);
              const currentImages = await Promise.all(ready.sides.map(side => (options.loadImage ?? loadReviewImage)(db, ready.saved[`${side}_path`], side)));
              if (currentImages.some(current => images.find(original => original.side === current.side)?.sha256 !== current.sha256)) unable('images_changed');
              else {
                patch = correction.patch; expected = correction.expected; outcome = correction.outcome as ReviewOutcome;
                result = [describeCentering(first), correction.explanation, explainGradeLimit(JSON.parse(String(patch.conversational_grading)), correction.afterGrade)].filter(Boolean).join(' ');
                audit = { ...audit, original_grade: correction.beforeGrade, reviewed_grade: correction.afterGrade };
              }
            } catch { unable('scoring_unavailable'); }
          }
        }
      }
    }
  }
  // Keep database failures out of the inspection catch: an uncertain commit
  // must not schedule another paid inspection or claim a retry was recorded.
  const { data: saved, error: finishError } = await db.rpc('finish_grade_review', {
    p_id: job.id, p_token: job.lease_token, p_proposal: audit,
    p_metadata: { ...metadata, duration_ms: Date.now() - started }, p_error: inspectionError,
    p_outcome: outcome, p_result: result, p_expected: expected, p_patch: patch,
  });
  if (finishError) throw new Error('review_finish_failed');
  return { processed: true, recorded: Boolean(saved), inspectionFailed: inspectionError !== null, outcome: inspectionError ? null : outcome,
    correctedCardId: saved && outcome === 'report_corrected' ? job.card_id : null,
    awaitingOwner: Boolean(saved && outcome === 'grade_corrected') };
}
