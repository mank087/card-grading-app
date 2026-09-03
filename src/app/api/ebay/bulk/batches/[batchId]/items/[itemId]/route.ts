/**
 * PATCH  /api/ebay/bulk/batches/:id/items/:itemId — inline edits from the
 *        review list (title, price, description, specifics, photos).
 * DELETE /api/ebay/bulk/batches/:id/items/:itemId — drop a card from a batch.
 *
 * Two rules the whole feature leans on live here:
 *   1. The eBay content rules are enforced on the DRAFT, not just at publish
 *      time, so the review list shows what will actually ship: a title naming
 *      a rival grader is rejected outright (eBay pulls those listings), and a
 *      description is REPAIRED — links stripped, rival-grader sentences
 *      dropped — exactly as `publishCardListing` would repair it.
 *   2. Any field the seller sends is marked edited, and an edited field is
 *      never re-seeded by a later batch-settings change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@/lib/uuid';
import {
  guardBulkRoute,
  loadOwnedBatch,
  refreshBatchCounts,
  isOwnedListingImageUrl,
  ITEM_COLUMNS,
} from '@/lib/ebay/bulkService';
import {
  EBAY_TITLE_MAX,
  readinessPatch,
  isReadinessManaged,
  computeReadiness,
} from '@/lib/ebay/bulkReadiness';
import { batchListingFormat, batchPostalCode } from '@/lib/ebay/bulkSettings';
import { containsBlockedGrader, findBlockedGrader, stripBlockedGraderSentences } from '@/lib/ebay/gradingCompanyBlocklist';
import { containsLinkOrUrl, stripLinks } from '@/lib/ebay/listingDescription';

export const runtime = 'nodejs';

type Params = { params: Promise<{ batchId: string; itemId: string }> };

/**
 * Rows that may be repaired after a run: the ones the drain has finished with
 * and left in a state the seller is expected to act on. `queued` / `uploading`
 * / `publishing` belong to the drain, and `live` is on eBay.
 */
const REPAIRABLE_ITEM_STATUSES = new Set(['draft', 'ready', 'failed', 'blocked', 'skipped']);

/** Batch states in which repairing a row is meaningful (Retry can follow). */
const REPAIRABLE_BATCH_STATUSES = new Set(['draft', 'running', 'paused', 'complete', 'failed']);

const DESCRIPTION_MAX = 60_000;
const MAX_IMAGE_URLS = 24;
const MAX_SPECIFICS = 60;

interface ParsedSpecific {
  name: string;
  value: string | string[];
  required: boolean;
  editable: boolean;
}

function parseSpecifics(raw: unknown): ParsedSpecific[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'itemSpecifics must be an array' };
  if (raw.length > MAX_SPECIFICS) return { error: `At most ${MAX_SPECIFICS} item specifics` };
  const out: ParsedSpecific[] = [];
  for (const entry of raw as any[]) {
    if (!entry || typeof entry !== 'object') return { error: 'Each item specific must be an object' };
    const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 65) : '';
    if (!name) return { error: 'Each item specific needs a name' };
    let value: string | string[];
    if (Array.isArray(entry.value)) {
      value = entry.value
        .filter((v: unknown) => typeof v === 'string')
        .slice(0, 20)
        .map((v: string) => v.slice(0, 65));
    } else if (typeof entry.value === 'string') {
      value = entry.value.slice(0, 65);
    } else {
      value = '';
    }
    out.push({
      name,
      value,
      required: entry.required === true,
      editable: entry.editable !== false,
    });
  }
  return out;
}

/**
 * Photo URLs are client-supplied and are copied verbatim into the eBay
 * listing, so each one must be a file WE uploaded, in the eBay images
 * bucket, under this user's folder and this card's folder. Anything else —
 * another card, another seller, any host on the internet — is a 400, not a
 * silent drop: the review page should never think it saved a photo it did
 * not save.
 */
function parseImageUrls(
  raw: unknown,
  userId: string,
  cardId: string
): string[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'imageUrls must be an array' };
  if (raw.length > MAX_IMAGE_URLS) return { error: `At most ${MAX_IMAGE_URLS} photos` };
  const urls: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !isOwnedListingImageUrl(value, userId, cardId)) {
      return { error: 'Photos must be images uploaded for this card.' };
    }
    urls.push(value);
  }
  return urls;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { batchId, itemId } = await params;
  if (!isUuid(batchId) || !isUuid(itemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const guard = await guardBulkRoute(request);
  if (!guard.ok) return guard.response;
  const { userId, supabase } = guard.auth;

  const batch = await loadOwnedBatch(supabase, batchId, userId);
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: itemData } = await supabase
    .from('ebay_bulk_items')
    .select(ITEM_COLUMNS)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .maybeSingle();
  const item = itemData as any;
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Editability is a property of the ROW as much as the batch.
  //
  // A draft batch is wholly editable, as before. Beyond that, the rows that
  // came to rest — failed, held, skipped — must stay editable too, or the
  // Retry button is a promise we cannot keep: the drain tells the seller to
  // fix the listing and try again, and a hard "this batch is no longer
  // editable" left them with a broken row and no way to touch it. Rows the
  // drain owns (queued, uploading, publishing) and rows that are already on
  // eBay (live) stay closed: editing those either races the publish or
  // rewrites a listing we cannot revise.
  const rowEditable = REPAIRABLE_ITEM_STATUSES.has(item.status);
  const batchRepairable = REPAIRABLE_BATCH_STATUSES.has(batch.status);
  const editable = batch.status === 'draft' || (rowEditable && batchRepairable);
  if (!editable) {
    return NextResponse.json(
      {
        error: rowEditable
          ? 'This batch is no longer editable.'
          : item.status === 'live'
            ? 'This card is already listed on eBay and can no longer be changed here.'
            : 'This card is being published right now — wait for it to finish.',
      },
      { status: 409 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const merged: Record<string, unknown> = { ...item };

  // ------------------------------------------------------------ title --
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title must be a string' }, { status: 400 });
    }
    const title = body.title.replace(/\s+/g, ' ').trim();
    if (title.length > EBAY_TITLE_MAX) {
      return NextResponse.json(
        { error: `Titles are limited to ${EBAY_TITLE_MAX} characters (yours is ${title.length}).` },
        { status: 400 }
      );
    }
    if (containsBlockedGrader(title)) {
      return NextResponse.json(
        { error: `Titles can't name another grading company ("${findBlockedGrader(title)}").` },
        { status: 400 }
      );
    }
    // eBay forbids links and bare web addresses anywhere in a listing, and a
    // title is entirely seller-typed — there is nothing to repair in 80
    // characters, so it is refused here exactly as publishCardListing does.
    if (containsLinkOrUrl(title)) {
      return NextResponse.json(
        { error: "Titles can't contain a web address, link or email address." },
        { status: 400 }
      );
    }
    patch.title = title;
    patch.title_edited = true;
    merged.title = title;
  }

  // ------------------------------------------------------------ price --
  if (body.price !== undefined) {
    if (body.price === null || body.price === '') {
      patch.price = null;
      patch.price_edited = true;
      merged.price = null;
    } else {
      const price = typeof body.price === 'number' ? body.price : Number(body.price);
      if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
        return NextResponse.json({ error: 'Price must be greater than 0.' }, { status: 400 });
      }
      const rounded = Math.round(price * 100) / 100;
      patch.price = rounded;
      patch.price_edited = true;
      merged.price = rounded;
    }
  }

  // ------------------------------------------------------ description --
  if (body.description_html !== undefined) {
    if (typeof body.description_html !== 'string') {
      return NextResponse.json({ error: 'description_html must be a string' }, { status: 400 });
    }
    if (body.description_html.length > DESCRIPTION_MAX) {
      return NextResponse.json({ error: 'Description is too long.' }, { status: 400 });
    }
    // Repaired, not rejected — the same choice publishCardListing makes,
    // because a description is mostly generated text and losing one sentence
    // beats blocking a listing over a word in a grade summary.
    const repaired = stripBlockedGraderSentences(stripLinks(body.description_html));
    patch.description_html = repaired;
    patch.description_edited = true;
    merged.description_html = repaired;
  }

  // -------------------------------------------------------- specifics --
  if (body.item_specifics !== undefined) {
    const specifics = parseSpecifics(body.item_specifics);
    if (!Array.isArray(specifics)) {
      return NextResponse.json({ error: specifics.error }, { status: 400 });
    }
    patch.item_specifics = specifics;
    merged.item_specifics = specifics;
  }

  // ----------------------------------------------------------- images --
  if (body.image_urls !== undefined) {
    const urls = parseImageUrls(body.image_urls, userId, item.card_id);
    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: urls.error }, { status: 400 });
    }
    patch.image_urls = urls;
    merged.image_urls = urls;
  }
  if (body.image_status !== undefined) {
    if (!['pending', 'ready', 'failed'].includes(body.image_status)) {
      return NextResponse.json({ error: 'Invalid image_status' }, { status: 400 });
    }
    // 'ready' is the claim that this row's photos can go to eBay, so it has
    // to be backed by at least one URL that survived the check above — a
    // client can't mark an empty photo set ready and slip past readiness.
    const effectiveUrls = Array.isArray(merged.image_urls) ? (merged.image_urls as unknown[]) : [];
    if (body.image_status === 'ready' && effectiveUrls.length === 0) {
      return NextResponse.json(
        { error: 'Photos can only be marked ready with at least one uploaded image.' },
        { status: 400 }
      );
    }
    patch.image_status = body.image_status;
    merged.image_status = body.image_status;
  }

  // Readiness only governs rows the seller still owns: for a draft/ready row
  // it decides the status, exactly as it did before.
  const listingFormat = batchListingFormat(batch.settings);
  const postalCode = batchPostalCode(batch.settings);
  if (isReadinessManaged(item.status)) {
    const { readiness, status } = readinessPatch(
      { ...(merged as any), status: item.status },
      listingFormat,
      postalCode
    );
    patch.readiness = readiness;
    patch.status = status;
  } else {
    // A failed / held / skipped row being repaired mid-run. Readiness is
    // recomputed so the drawer and the Retry gate see the edit — but the
    // STATUS is left alone. Flipping a failed row to `ready` here would tell
    // the seller it was fixed when nothing has re-attempted it, and would put
    // a row into a state the drain does not pick up; Retry is the one thing
    // that moves it, and it recomputes readiness again for itself.
    patch.readiness = computeReadiness(merged as any, listingFormat, postalCode);
  }

  const { data: updated, error } = await supabase
    .from('ebay_bulk_items')
    .update(patch)
    .eq('id', itemId)
    .eq('batch_id', batchId)
    .select(ITEM_COLUMNS)
    .single();

  if (error) {
    console.error('[ebay/bulk] item update failed:', error.message);
    return NextResponse.json({ error: 'Failed to save the change' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  return NextResponse.json({ success: true, item: updated });
}

export async function DELETE(request: NextRequest, { params }: Params) {
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

  const { error } = await supabase
    .from('ebay_bulk_items')
    .delete()
    .eq('id', itemId)
    .eq('batch_id', batchId);
  if (error) {
    console.error('[ebay/bulk] item delete failed:', error.message);
    return NextResponse.json({ error: 'Failed to remove the card' }, { status: 500 });
  }

  await refreshBatchCounts(supabase, batchId);
  return NextResponse.json({ success: true });
}
