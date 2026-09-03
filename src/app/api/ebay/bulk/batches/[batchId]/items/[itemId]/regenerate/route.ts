/**
 * POST /api/ebay/bulk/batches/:id/items/:itemId/regenerate
 *
 * Throw away the seller's edits on one row and rebuild the title, the
 * description and the item specifics from the draft builder, then re-seed the
 * price from the batch's price rule. The edited flags are cleared, so the row
 * follows batch-settings changes again.
 *
 * Photos are untouched: they are a client-side render, not a draft field.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  loadDraftCards,
  loadListingDefaults,
  loadBrandingByOrg,
  loadAspectsByCategory,
  ebayCategoryForCard,
  draftFieldsForCard,
  refreshBatchCounts,
  ITEM_COLUMNS,
  type DraftContext,
} from '@/lib/ebay/bulkService';
import { normalizeBulkSettings } from '@/lib/ebay/bulkSettings';
import { readinessPatch, isReadinessManaged } from '@/lib/ebay/bulkReadiness';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string; itemId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { batchId, itemId } = await params;
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batch.status !== 'draft') {
    return NextResponse.json({ error: 'This batch is no longer editable.' }, { status: 409 });
  }

  const { data: itemData } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .maybeSingle();
  const item = itemData as any;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ownership is re-checked on the CARD as well as the batch: the batch row
  // proves who owns the queue, the card query proves who owns the card.
  const [card] = await loadDraftCards(supabase, [item.card_id], userId);
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  const settings = normalizeBulkSettings(batch.settings);
  const listingDefaults = await loadListingDefaults(supabase, userId);
  const brandingByOrg = await loadBrandingByOrg(card.org_id ? [card.org_id] : []);
  // Regenerating REPLACES item_specifics, so eBay's required aspects have to
  // be re-merged here too — otherwise a reset would quietly drop them and the
  // row would look ready while missing a required specific.
  const aspectsByCategory = await loadAspectsByCategory(userId, [ebayCategoryForCard(card)]);
  const ctx: DraftContext = { settings, listingDefaults, brandingByOrg, aspectsByCategory };

  const draft = draftFieldsForCard(card, ctx);
  const patch: Record<string, unknown> = {
    title: draft.title,
    description_html: draft.description_html,
    item_specifics: draft.item_specifics,
    price: draft.price,
    title_edited: false,
    description_edited: false,
    price_edited: false,
    updated_at: new Date().toISOString(),
  };

  if (isReadinessManaged(item.status)) {
    const { readiness, status } = readinessPatch({ ...item, ...patch, status: item.status });
    patch.readiness = readiness;
    patch.status = status;
  }

  const { data: updated, error } = await supabase
    .from('ebay_bulk_items')
    .update(patch)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .select(ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('[ebay/bulk] regenerate failed:', error.message);
    return NextResponse.json({ error: 'Failed to regenerate this row' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  return NextResponse.json({ success: true, item: updated });
}
