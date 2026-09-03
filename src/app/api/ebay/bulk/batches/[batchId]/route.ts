/**
 * GET    /api/ebay/bulk/batches/:id  — the batch, its items, and the card
 *                                      rows the review page renders from.
 * PATCH  /api/ebay/bulk/batches/:id  — batch settings ("across the board").
 * DELETE /api/ebay/bulk/batches/:id  — discard a draft batch.
 *
 * A settings change re-seeds only the rows the seller has NOT hand-edited:
 * `price_edited` / `title_edited` / `description_edited` are the record of
 * what they typed, and a batch-level price rule or shipping change must never
 * overwrite it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import { createSignedUrlMap } from '@/lib/signedUrlBatch';
import {
  guardBulkRoute,
  loadOwnedBatch,
  loadDraftCards,
  loadListingDefaults,
  loadBrandingByOrg,
  draftFieldsForCard,
  refreshBatchCounts,
  ITEM_COLUMNS,
  type DraftContext,
  type ServerClient,
} from '@/lib/ebay/bulkService';
import { normalizeBulkSettings, withSellerPolicyDefaults } from '@/lib/ebay/bulkSettings';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string }> };

const ITEM_PAGE = 100;
const UPDATE_CHUNK = 20;

interface ItemRow {
  id: string;
  card_id: string;
  status: string;
  title: string | null;
  price: number | string | null;
  description_html: string | null;
  item_specifics: unknown;
  image_urls: unknown;
  image_status: string | null;
  price_edited: boolean;
  title_edited: boolean;
  description_edited: boolean;
  [key: string]: unknown;
}

async function loadItems(
  supabase: ServerClient,
  batchId: string,
  offset = 0,
  limit = ITEM_PAGE
): Promise<ItemRow[]> {
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('batch_id', batchId)
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1);
  return (data ?? []) as unknown as ItemRow[];
}

export async function GET(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const items = await loadItems(supabase, batchId, offset);

  // The review page renders a thumbnail, grade chip and category per row, and
  // re-runs the client-side image pipeline for rows whose photos are still
  // pending — which needs the same card fields the draft builder reads.
  const cards = await loadDraftCards(
    supabase,
    items.map(i => i.card_id),
    userId
  );

  const paths: string[] = [];
  for (const c of cards) {
    if (c.front_path) paths.push(c.front_path);
    if (c.back_path) paths.push(c.back_path);
  }
  let urlMap = new Map<string, string>();
  if (paths.length > 0) {
    try {
      urlMap = await createSignedUrlMap(supabase.storage, 'cards', paths, 60 * 60);
    } catch (err) {
      console.error('[ebay/bulk] signed URL batch failed:', err);
    }
  }

  // The eBay links for rows the drain has published (and for skipped rows,
  // whose blocking listing is the one the seller wants to look at). Keyed by
  // ebay_listings.id, which is what `items.listing_row_id` holds. Narrow and
  // owner-scoped; empty for a batch that has not run.
  const listingRowIds = items
    .map(i => i.listing_row_id)
    .filter((id): id is string => typeof id === 'string');
  let listings: Record<string, unknown>[] = [];
  if (listingRowIds.length > 0) {
    const { data: listingRows } = await supabase
      .from('ebay_listings')
      .select('id, listing_id, listing_url, status, price, published_at')
      .eq('user_id', userId)
      .in('id', listingRowIds);
    listings = (listingRows ?? []) as unknown as Record<string, unknown>[];
  }

  return NextResponse.json({
    batch,
    items,
    listings,
    cards: cards.map(c => ({
      ...c,
      front_url: c.front_path ? urlMap.get(c.front_path) ?? null : null,
      back_url: c.back_path ? urlMap.get(c.back_path) ?? null : null,
    })),
    hasMore: items.length === ITEM_PAGE,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batch.status !== 'draft') {
    return NextResponse.json(
      { error: 'This batch has already been submitted and can no longer be changed.' },
      { status: 409 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (body?.settings === undefined) {
    return NextResponse.json({ error: 'settings is required' }, { status: 400 });
  }

  // Loaded before the save because the seller's business-policy opt-in is
  // re-stamped onto the settings here — a batch must not keep running on
  // policies after the seller has turned them off (or stay inline after they
  // have turned them on).
  const listingDefaults = await loadListingDefaults(supabase, userId);

  const settings = normalizeBulkSettings(body.settings, batch.settings);
  // PERSONAL row only: policies belong to this user's eBay account, so they
  // never resolve org-first the way templates and grade labels do.
  settings.policies = withSellerPolicyDefaults(settings.policies, listingDefaults.personal);

  const { error: saveError } = await supabase
    .from('ebay_bulk_batches')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', batchId);
  if (saveError) {
    console.error('[ebay/bulk] settings save failed:', saveError.message);
    return NextResponse.json({ error: 'Failed to save the batch settings' }, { status: 500 });
  }

  // ------------------------------------------------------ re-seeding ----
  const items = await loadItems(supabase, batchId, 0, ITEM_PAGE);
  const editable = items.filter(i => i.status === 'draft' || i.status === 'ready');
  const cards = await loadDraftCards(supabase, editable.map(i => i.card_id), userId);
  const byId = new Map(cards.map(c => [c.id as string, c]));

  const brandingByOrg = await loadBrandingByOrg(
    cards.map(c => c.org_id).filter((id): id is string => typeof id === 'string')
  );
  const ctx: DraftContext = { settings, listingDefaults, brandingByOrg };

  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  for (const item of editable) {
    const card = byId.get(item.card_id);
    if (!card) continue;
    const draft = draftFieldsForCard(card, ctx);

    // Price rule applies only where the seller has not typed a price; the
    // title carries the grade label the settings panel can change; the
    // description embeds the shipping summary. Each is re-rendered only
    // while it is still the generated one.
    const nextTitle = item.title_edited ? item.title : draft.title;
    const nextPrice = item.price_edited ? item.price : draft.price;
    const nextDescription = item.description_edited ? item.description_html : draft.description_html;

    const next: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!item.title_edited) next.title = nextTitle;
    if (!item.price_edited) next.price = nextPrice;
    if (!item.description_edited) next.description_html = nextDescription;

    const { readiness, status } = readinessPatch(
      {
        ...item,
        title: nextTitle,
        price: nextPrice,
        description_html: nextDescription,
      },
      settings.listingFormat,
      settings.shipping.postalCode
    );
    next.readiness = readiness;
    next.status = status;
    updates.push({ id: item.id, patch: next });
  }

  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    await Promise.all(
      updates.slice(i, i + UPDATE_CHUNK).map(u =>
        supabase.from('ebay_bulk_items').update(u.patch).eq('id', u.id).eq('batch_id', batchId)
      )
    );
  }

  await refreshBatchCounts(supabase, batchId);
  const refreshed = await loadOwnedBatch(supabase, batchId, userId);
  return NextResponse.json({ success: true, batch: refreshed, reseeded: updates.length });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { batchId } = await params;
  if (!isUuid(batchId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batch.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only a draft batch can be deleted.' },
      { status: 409 }
    );
  }

  // Items cascade with the batch row.
  const { error } = await supabase
    .from('ebay_bulk_batches')
    .delete()
    .eq('id', batchId)
    .eq('user_id', userId);
  if (error) {
    console.error('[ebay/bulk] delete failed:', error.message);
    return NextResponse.json({ error: 'Failed to delete the batch' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
