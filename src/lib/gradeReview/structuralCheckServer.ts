/**
 * Grade-time side effects of a structural-cap check (see structuralCheck.ts):
 * write the capture_quality mirror the admin list filters on, and email the
 * admin. Called from the grading pipeline, so nothing here ever throws and each
 * step is bounded by a timeout.
 */
import { structuralMirror, type StructuralCheck } from './structuralCheck';

const SITE = 'https://dcmgrading.com';
export const STRUCTURAL_CHECKS_ADMIN_URL = `${SITE}/admin/structural-checks`;
const TIMEOUT_MS = 5000;
const isCardId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

async function bounded<T>(work: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), TIMEOUT_MS); });
  try { return await Promise.race([work.catch(() => fallback), timeout]); } finally { if (timer) clearTimeout(timer); }
}

/** Subject + bodies for the admin alert. Pure. */
export function structuralCheckEmail(input: { cardId: string; cardName: string; category: string; check: StructuralCheck }) {
  const { cardName, check } = input;
  const subject = `Structural cap check: ${cardName} (${check.capped_grade} from ${check.uncapped_grade})`;
  const text = `A structural (crease/bend) cap lowered ${cardName} from ${check.uncapped_grade} to ${check.capped_grade}.\n\nWhat was detected: ${check.evidence}\n\nThe customer sees the ${check.capped_grade} with a note that our team will double-check it. Confirm the crease or remove the cap here:\n${STRUCTURAL_CHECKS_ADMIN_URL}\n\nCard id: ${input.cardId} (${input.category})`;
  return { subject, text, bodyHtml: `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">A structural (crease/bend) cap lowered <strong>${escapeHtml(cardName)}</strong> from <strong>${escapeHtml(check.uncapped_grade)}</strong> to <strong>${escapeHtml(check.capped_grade)}</strong>.</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px 0;"><strong>What was detected:</strong> ${escapeHtml(check.evidence)}</p><p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px 0;">The customer sees the ${escapeHtml(check.capped_grade)} with a note that our team will double-check it.</p><p style="color:#6b7280;font-size:13px;margin:0;">Card id: ${escapeHtml(input.cardId)} (${escapeHtml(input.category)})</p>` };
}

/** Merge the mirror into cards.capture_quality. Resolves false on any failure. */
export async function recordStructuralCheckMirror(cardId: string | null | undefined, check: StructuralCheck): Promise<boolean> {
  if (!isCardId(cardId)) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  return bounded((async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key);
    const { data, error } = await db.from('cards').select('capture_quality').eq('id', cardId).maybeSingle();
    if (error || !data) return false;
    const current = data.capture_quality && typeof data.capture_quality === 'object' && !Array.isArray(data.capture_quality) ? data.capture_quality : {};
    const { error: saveError } = await db.from('cards').update({ capture_quality: { ...current, structural_check: structuralMirror(check) } }).eq('id', cardId);
    if (saveError) { console.warn('[structural-check] mirror not saved:', saveError.message); return false; }
    return true;
  })(), false);
}

/** Email admin@dcmgrading.com through the same mailer and template as grade-review alerts. */
export async function sendStructuralCheckAlert(input: { cardId: string | null | undefined; cardName: string; category: string; check: StructuralCheck }): Promise<boolean> {
  if (!isCardId(input.cardId) || process.env.STRUCTURAL_CHECK_ALERTS === 'off' || !process.env.RESEND_API_KEY) return false;
  const cardId = input.cardId;
  return bounded((async () => {
    const [{ Resend }, { brandedEmail }] = await Promise.all([import('resend'), import('./notifications')]);
    const message = structuralCheckEmail({ ...input, cardId });
    const html = brandedEmail({ preheader: message.subject, eyebrow: 'Admin alert', heading: 'Structural cap check', bodyHtml: message.bodyHtml,
      cta: { label: 'Open structural checks', url: STRUCTURAL_CHECKS_ADMIN_URL } });
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'DCM Grading <admin@dcmgrading.com>', to: 'admin@dcmgrading.com',
      replyTo: 'admin@dcmgrading.com', subject: message.subject, text: message.text, html },
      { idempotencyKey: `structural-check-${cardId}-${input.check.flagged_at}` });
    if (result.error) { console.warn('[structural-check] alert not sent:', result.error.message); return false; }
    return true;
  })(), false);
}

/** Both side effects, never throwing. */
export async function reportStructuralCheck(input: { cardId: string | null | undefined; cardName: string; category: string; check: StructuralCheck }): Promise<void> {
  try {
    const [mirrored, emailed] = await Promise.all([recordStructuralCheckMirror(input.cardId, input.check), sendStructuralCheckAlert(input)]);
    console.log(`[structural-check] flagged ${input.cardId ?? '(no card id)'}: ${input.check.capped_grade} from ${input.check.uncapped_grade} (mirror=${mirrored}, email=${emailed})`);
  } catch (e: any) {
    console.warn('[structural-check] side effects failed:', e?.message || e);
  }
}
