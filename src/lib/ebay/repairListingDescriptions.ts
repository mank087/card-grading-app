/**
 * Rebuild the descriptions of a seller's live eBay listings that describe the
 * WRONG card, and push them to eBay (ReviseFixedPriceItem, description only).
 *
 * WHY. "Save as my template" in the listing modal stored one card's rendered
 * description as the account template (Oct 19 2026, seller hsw1062): every
 * later listing rendered that card's name, serial and grade under its own
 * title. The template guard now refuses that, but listings already live had
 * to be revised in place, and the seller's eBay tokens can only be decrypted
 * in production - hence an admin tool rather than a local script.
 *
 * WHAT COUNTS AS WRONG. The standard layout prints "Serial: NNNNNN"; a
 * description whose serial is not the card's own (or its org serial) belongs
 * to another card. Descriptions with no serial line are left alone - a seller
 * who hand-wrote a description is not second-guessed here.
 *
 * Dry run by default: `apply` revises eBay and writes the new description to
 * ebay_listings; `clearTemplate` nulls the personal description template so
 * the next listing uses the standard layout again.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildListingDraft } from '@/lib/ebay/listingDraft';
import { cardTypeFor } from '@/lib/ebay/bulkService';
import { buildShippingSummary, buildPolicyShippingSummary, type ShippingSummaryInput } from '@/lib/ebay/listingDescription';
import { domesticServiceLabel } from '@/lib/ebay/bulkSettings';
import { getValidAccessToken } from '@/lib/ebay/auth';
import { reviseItemDescription } from '@/lib/ebay/tradingApi';
import { describedSerial, describesAnotherCard } from '@/lib/ebay/describedSerial';

export { describedSerial, describesAnotherCard };

export interface RepairRow {
  listingId: string;
  cardId: string;
  title: string;
  /** The serial the live description names, or null when it has none. */
  describedSerial: string | null;
  cardSerial: string;
  /** Plain-text opening of the rebuilt description, for the preview. */
  newHeadline: string;
  result?: 'revised' | 'failed';
  error?: string;
}

export interface RepairReport {
  userId: string;
  activeListings: number;
  wrong: RepairRow[];
  templateCleared: boolean;
  templateHadNoMergeFields: boolean;
}

export async function repairListingDescriptions(
  db: SupabaseClient,
  opts: { userId: string; apply: boolean; clearTemplate: boolean }
): Promise<RepairReport> {
  const { userId, apply } = opts;
  const { data: tpl } = await db
    .from('listing_templates')
    .select('id,description_template,shipping_defaults,use_business_policies')
    .eq('user_id', userId)
    .is('org_id', null)
    .maybeSingle();
  const sd = (tpl?.shipping_defaults || {}) as Partial<ShippingSummaryInput>;
  const shippingSummary = tpl?.use_business_policies
    ? buildPolicyShippingSummary()
    : buildShippingSummary(
        { ...sd, shippingType: sd.shippingType || 'CALCULATED' },
        domesticServiceLabel(String(sd.domesticShippingService || ''))
      );
  const template = String(tpl?.description_template || '');
  const templateHadNoMergeFields = !!template && !/\{[a-zA-Z]+\}/.test(template);

  const { data: listings, error } = await db
    .from('ebay_listings')
    .select('id,card_id,listing_id,title,description,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const report: RepairReport = {
    userId,
    activeListings: listings?.length ?? 0,
    wrong: [],
    templateCleared: false,
    templateHadNoMergeFields,
  };

  const cardIds = [...new Set((listings || []).map(l => l.card_id as string))];
  const cards = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < cardIds.length; i += 25) {
    const { data, error: cErr } = await db.from('cards').select('*').in('id', cardIds.slice(i, i + 25));
    if (cErr) throw cErr;
    for (const c of data || []) cards.set(c.id as string, c as Record<string, unknown>);
  }

  const plans: Array<{ row: RepairRow; dbId: string; html: string }> = [];
  for (const l of listings || []) {
    const card = cards.get(l.card_id as string);
    if (!card || !l.listing_id) continue;
    const ids = card as { serial?: string | null; org_serial_display?: string | null; category?: string | null };
    if (!describesAnotherCard(String(l.description || ''), ids)) continue;
    const draft = buildListingDraft(card, { cardType: cardTypeFor(ids), listingDefaults: null, shippingSummary });
    const headline = draft.descriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    plans.push({
      dbId: l.id as string,
      html: draft.descriptionHtml,
      row: {
        listingId: String(l.listing_id),
        cardId: l.card_id as string,
        title: String(l.title || ''),
        describedSerial: describedSerial(String(l.description || '')),
        cardSerial: String(ids.org_serial_display || ids.serial || ''),
        newHeadline: headline,
      },
    });
  }
  report.wrong = plans.map(p => p.row);
  if (!apply) return report;

  if (opts.clearTemplate && tpl?.id && tpl.description_template) {
    const { error: tErr } = await db.from('listing_templates').update({ description_template: null }).eq('id', tpl.id);
    if (tErr) throw tErr;
    report.templateCleared = true;
  }
  if (plans.length === 0) return report;

  const { data: conn } = await db.from('ebay_connections').select('is_sandbox').eq('user_id', userId).maybeSingle();
  const accessToken = await getValidAccessToken(userId);
  const config = { accessToken, sandbox: !!conn?.is_sandbox };
  for (const p of plans) {
    try {
      await reviseItemDescription(config, p.row.listingId, p.html);
      const { error: uErr } = await db
        .from('ebay_listings')
        .update({ description: p.html, updated_at: new Date().toISOString() })
        .eq('id', p.dbId);
      if (uErr) throw uErr;
      p.row.result = 'revised';
    } catch (e) {
      p.row.result = 'failed';
      p.row.error = e instanceof Error ? e.message : String(e);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return report;
}
