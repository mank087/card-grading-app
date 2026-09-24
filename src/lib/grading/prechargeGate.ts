/**
 * Where the pre-charge photo check meets the credit and grading routes.
 *
 * ENFORCEMENT POINT: /api/stripe/deduct. Every single-card client (web upload,
 * native app) charges through it after uploading and before starting the
 * grade, so the check runs there, on the server, for every client version.
 *
 * OLDER APPS. An app build that predates this ignores the deduct response and
 * goes on to call the grading route. So a block is also written to the card
 * row (grade_status 'failed' + an error_message tagged "(precharge)"), and the
 * grading routes refuse such a card with the same INSPECTION_INCOMPLETE body,
 * credit_refund_status 'not_charged'. The app's processing screen already
 * renders that body ("... No grading credit was charged for this attempt."),
 * so an old build shows the reason without an OTA and without a charge.
 *
 * FAIL OPEN everywhere: flag off, check error/timeout, download failure, or a
 * block that could not be recorded on the row all mean "charge and grade as
 * before". A block the grading route cannot see would let an old app grade
 * for free, so an unrecorded block is not returned as a block.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { incompleteInspectionMessage } from './inspectionMessageText';
import {
  isPrechargePhotoCheckEnabled,
  runPhotoPrecheck,
  PRECHARGE_TIMEOUT_MS,
  type PhotoSide,
  type PrechargeReason,
  type PrechargeResult,
} from './photoPrecheck';

/** Stage tag in cards.error_message; the grading routes key off it. */
export const PRECHARGE_ERROR_TAG = 'Inspection incomplete (precharge).';

const REASONS: readonly PrechargeReason[] = ['no_card', 'different_cards', 'multiple_cards', 'not_a_card', 'framing', 'blurry', 'screenshot'];

/** Reasons the owner cannot fix by photographing again. */
const SUPPORT_REASONS = new Set<PrechargeReason>(['not_a_card']);

export interface PrechargeBlockBody {
  error: string;
  code: 'INSPECTION_INCOMPLETE';
  inspection_incomplete: true;
  inspection_stage: 'precharge';
  inspection_reason: PrechargeReason;
  photo_side: PhotoSide;
  next_action: 'retake_photos' | 'contact_support';
  credit_refunded: false;
  credit_refund_status: 'not_charged';
  /** Lets a client tell this apart from a grading-stage failure. */
  photo_check_blocked: true;
}

export function prechargeBlockBody(reason: PrechargeReason, side: PhotoSide): PrechargeBlockBody {
  const body = {
    code: 'INSPECTION_INCOMPLETE' as const,
    inspection_incomplete: true as const,
    inspection_stage: 'precharge' as const,
    inspection_reason: reason,
    photo_side: side,
    next_action: SUPPORT_REASONS.has(reason) ? 'contact_support' as const : 'retake_photos' as const,
    credit_refunded: false as const,
    credit_refund_status: 'not_charged' as const,
    photo_check_blocked: true as const,
  };
  return { error: incompleteInspectionMessage(body) || 'These photos cannot be graded. Please retake them.', ...body };
}

/** The row's error_message: tag, [reason], (side photo), then the owner-facing text. */
export function prechargeErrorMessage(reason: PrechargeReason, side: PhotoSide): string {
  const sideTag = side === 'both' ? '' : ` (${side} photo)`;
  return `${PRECHARGE_ERROR_TAG} [${reason}]${sideTag} ${prechargeBlockBody(reason, side).error}`.slice(0, 500);
}

/** Was this card stopped by the pre-charge check? Reads only grade_status and error_message. */
export function prechargeBlockFromRow(card: { grade_status?: string | null; error_message?: string | null } | null | undefined): PrechargeBlockBody | null {
  if (!card || card.grade_status !== 'failed' || typeof card.error_message !== 'string') return null;
  if (!card.error_message.startsWith(PRECHARGE_ERROR_TAG)) return null;
  const reason = /\[([a-z_]+)\]/.exec(card.error_message)?.[1] as PrechargeReason | undefined;
  const side = (/\((front|back) photo\)/.exec(card.error_message)?.[1] as PhotoSide | undefined) ?? 'both';
  return prechargeBlockBody(reason && REASONS.includes(reason) ? reason : 'framing', side);
}

/**
 * Grading-route guard for older clients that start a grade the deduct route
 * refused. A regrade (force_regrade) is an explicit, separately charged
 * request and is not stopped here.
 */
export function prechargeBlockedResponse(card: any, forceRegrade: boolean): NextResponse | null {
  if (forceRegrade) return null;
  const body = prechargeBlockFromRow(card);
  if (!body) return null;
  console.log(`[PrechargeGate] refusing to grade card ${card?.id}: blocked before charge (${body.inspection_reason}/${body.photo_side})`);
  return NextResponse.json({ ...body, grading_failed: true }, { status: 422 });
}

export type PrechargeGateOutcome =
  | { blocked: false; result?: PrechargeResult; skipped?: string }
  | { blocked: true; body: PrechargeBlockBody; result?: PrechargeResult };

async function download(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from('cards').download(path);
  if (error || !data) throw new Error(`download failed for ${path}: ${error?.message ?? 'no data'}`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Run the check for a first-grade charge. Called by the deduct route with the
 * card row it already loaded. Never throws.
 */
export async function prechargePhotoGate(card: {
  id: string;
  user_id: string;
  front_path?: string | null;
  back_path?: string | null;
  grade_status?: string | null;
  error_message?: string | null;
}): Promise<PrechargeGateOutcome> {
  try {
    // A repeat deduct call for a card already stopped: same answer, no model call.
    const prior = prechargeBlockFromRow(card);
    if (prior) return { blocked: true, body: prior };

    if (!isPrechargePhotoCheckEnabled()) return { blocked: false, skipped: 'disabled' };
    // Only a card that has never been graded, locked or failed is checked.
    if (card.grade_status != null) return { blocked: false, skipped: `grade_status=${card.grade_status}` };
    if (!card.front_path || !card.back_path) return { blocked: false, skipped: 'missing image paths' };

    // Already charged (a retried deduct call): never block after a charge.
    const { data: priorCharge } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('card_id', card.id)
      .eq('type', 'grade')
      .limit(1)
      .maybeSingle();
    if (priorCharge) return { blocked: false, skipped: 'already charged' };

    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const images = await Promise.race([
      Promise.all([download(card.front_path), download(card.back_path)]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('image download timed out')), PRECHARGE_TIMEOUT_MS / 2); }),
    ]).finally(() => clearTimeout(timer));
    const remaining = PRECHARGE_TIMEOUT_MS - (Date.now() - started);
    const result = await runPhotoPrecheck(images[0], images[1], { timeoutMs: Math.max(2000, remaining), cardId: card.id, userId: card.user_id });
    console.log(`[PrechargeGate] card ${card.id}: ${result.verdict}${result.reason ? ` ${result.reason}/${result.side}` : ''}`
      + ` in ${result.latency_ms}ms${result.failed_open ? ` (failed open: ${result.error})` : ''}${result.signals.length ? ` signals=${result.signals.join(',')}` : ''}`);
    if (result.verdict !== 'block' || !result.reason || !result.side) return { blocked: false, result };

    // Record the block so the grading routes refuse it too. Compare-and-set on
    // a never-graded row: if anything else has touched grade_status since we
    // read it, do not block.
    const { data: updated, error } = await supabaseAdmin
      .from('cards')
      .update({ grade_status: 'failed', error_message: prechargeErrorMessage(result.reason, result.side) })
      .eq('id', card.id)
      .is('grade_status', null)
      .select('id');
    if (error || !updated?.length) {
      console.warn(`[PrechargeGate] card ${card.id}: block not recorded (${error?.message ?? 'row changed'}) — failing open`);
      return { blocked: false, result };
    }
    return { blocked: true, body: prechargeBlockBody(result.reason, result.side), result };
  } catch (e: any) {
    console.warn(`[PrechargeGate] card ${card?.id}: check unavailable, failing open:`, e?.message || e);
    return { blocked: false, skipped: 'error' };
  }
}
