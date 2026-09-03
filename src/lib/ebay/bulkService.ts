/**
 * Server helpers shared by every /api/ebay/bulk route.
 *
 * Three jobs: the feature-flag + auth gate, ownership-scoped loads of a batch
 * and its items, and the per-card draft assembly (title / description /
 * specifics / price) that both the create and the regenerate paths run.
 *
 * Query discipline: `cards` is ~290 columns wide and several are large JSON
 * blobs. Every select here is an explicit narrow column list, and card reads
 * are chunked — a 100-card batch must never become one wide scan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';
import { supabaseServer } from '@/lib/supabaseServer';
import { resolveSelfOrigin } from '@/lib/selfOrigin';
import { getOrgById, getOrgForUser } from '@/lib/organizations';
import { isMissingColumnError } from '@/lib/cards/ownership';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import {
  buildListingDraft,
  type EbayAspect,
  type ListingDefaultsPayload,
} from '@/lib/ebay/listingDraft';
import { getCategoryForCardType } from '@/lib/ebay/itemSpecifics';
import { getConnectionForUser, refreshTokenIfNeeded } from '@/lib/ebay/auth';
import { fetchCategoryAspects } from '@/lib/ebay/aspectsApi';
import type { ListingBranding } from '@/lib/ebay/listingDescription';
import { stripBlockedGraderSentences } from '@/lib/ebay/gradingCompanyBlocklist';
import { stripLinks } from '@/lib/ebay/listingDescription';
import {
  priceForCard,
  shippingSummaryFor,
  type BulkBatchSettings,
} from '@/lib/ebay/bulkSettings';
import { readinessPatch } from '@/lib/ebay/bulkReadiness';
import { POLICY_COLUMNS, prefsFromRow } from '@/lib/ebay/businessPolicies';

export type ServerClient = ReturnType<typeof supabaseServer>;

/** Server flag. Every bulk route 404s when it is off (default: off). */
export function bulkEnabled(): boolean {
  return process.env.EBAY_BULK_ENABLED === 'true';
}

/** Phase 2 gate: publishing stays 501 until the drain exists. */
export function bulkPublishEnabled(): boolean {
  return process.env.EBAY_BULK_PUBLISH_ENABLED === 'true';
}

export interface BulkAuth {
  userId: string;
  supabase: ServerClient;
}

/**
 * Flag + JWT gate for a bulk route. Returns either the authenticated context
 * or the response to send. The flag is checked FIRST so a disabled feature is
 * indistinguishable from a route that does not exist.
 */
export async function guardBulkRoute(
  request: NextRequest
): Promise<{ ok: true; auth: BulkAuth } | { ok: false; response: NextResponse }> {
  if (!bulkEnabled()) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }
  return { ok: true, auth: { userId: auth.userId, supabase: supabaseServer() } };
}

/* ------------------------------------------------------------------ */
/* Drain kick                                                          */
/* ------------------------------------------------------------------ */

/** How long a kick waits before giving up. The cron finishes the job either way. */
const KICK_TIMEOUT_MS = 2_000;

/**
 * Nudge the drain for one batch, without waiting for it.
 *
 * Publish / resume / retry all call this so the seller sees the first card go
 * live in seconds instead of waiting for the next minute's cron. It is purely
 * an optimisation: the per-minute cron drains every running batch regardless,
 * which is what makes closing the tab safe.
 *
 * `resolveSelfOrigin`, never `request.nextUrl.origin` — Vercel serves the
 * generated deployment host behind Deployment Protection, where a self-fetch
 * is redirected to a login page that answers 200 with HTML and the route we
 * meant to call never runs (see src/lib/selfOrigin.ts).
 *
 * The cron bearer is the drain's only credential, so the kick sends it too;
 * that keeps the drain to one authorization path rather than teaching it to
 * accept user JWTs as well.
 */
export function kickBulkDrain(request: NextRequest, batchId: string): void {
  const origin = resolveSelfOrigin(request);
  const url = `${origin}/api/ebay/bulk/drain?batch_id=${encodeURIComponent(batchId)}`;
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KICK_TIMEOUT_MS);
  void fetch(url, { method: 'POST', headers, signal: controller.signal })
    .catch(() => {
      /* Aborting is the expected outcome: the drain runs for up to a minute
         and we are not waiting for it. The cron is the durable driver. */
    })
    .finally(() => clearTimeout(timer));
}

/* ------------------------------------------------------------------ */
/* Batch access                                                        */
/* ------------------------------------------------------------------ */

export const BATCH_COLUMNS =
  'id, user_id, org_id, status, settings, total_count, ready_count, live_count, ' +
  'failed_count, created_at, updated_at, started_at, completed_at, last_error';

/** Narrow on purpose — description_html is the only wide column, and the
 *  review table needs it, but nothing else selects item rows in bulk. */
export const ITEM_COLUMNS =
  'id, batch_id, card_id, position, status, attempts, title, price, description_html, ' +
  'item_specifics, image_urls, image_status, readiness, price_edited, title_edited, ' +
  'description_edited, listing_row_id, error_code, error_message, updated_at';

export interface BulkBatchRow {
  id: string;
  user_id: string;
  org_id: string | null;
  status: string;
  settings: BulkBatchSettings;
  total_count: number;
  ready_count: number;
  live_count: number;
  failed_count: number;
  [key: string]: unknown;
}

/** Load a batch the caller owns, or null. Ownership is by user_id, always. */
export async function loadOwnedBatch(
  supabase: ServerClient,
  batchId: string,
  userId: string
): Promise<BulkBatchRow | null> {
  const { data } = await supabase
    .from('ebay_bulk_batches')
    .select(BATCH_COLUMNS)
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as unknown as BulkBatchRow) ?? null;
}

/** Recompute the batch's counters from its items and stamp updated_at. */
export async function refreshBatchCounts(supabase: ServerClient, batchId: string): Promise<void> {
  const { data } = await supabase
    .from('ebay_bulk_items')
    .select('status')
    .eq('batch_id', batchId);
  const rows = (data ?? []) as { status: string }[];
  await supabase
    .from('ebay_bulk_batches')
    .update({
      total_count: rows.length,
      ready_count: rows.filter(r => r.status === 'ready').length,
      live_count: rows.filter(r => r.status === 'live').length,
      failed_count: rows.filter(r => r.status === 'failed').length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
}

/* ------------------------------------------------------------------ */
/* Card reads                                                          */
/* ------------------------------------------------------------------ */

/**
 * The columns the draft builder consumes. Mirrors `/api/ebay/eligible-cards`
 * CARD_COLUMNS minus the picker-only fields, and deliberately excludes every
 * heavy blob (ai_grading, conversational_corners_edges_surface, …).
 */
export const DRAFT_CARD_COLUMNS = [
  'id', 'user_id', 'card_name', 'category', 'sub_category', 'serial',
  'front_path', 'back_path', 'org_id', 'org_serial_display',
  'conversational_whole_grade', 'conversational_decimal_grade',
  'conversational_condition_label', 'conversational_card_info',
  'conversational_sub_scores', 'conversational_weighted_sub_scores',
  'conversational_final_grade_summary', 'dvg_whole_grade', 'dvg_decimal_grade',
  'dcm_price_estimate', 'dcm_cached_prices', 'ebay_price_median',
  'scryfall_price_usd', 'scryfall_price_usd_foil',
  'featured', 'pokemon_featured', 'card_set', 'card_number', 'release_date',
  'serial_numbering', 'rarity_tier', 'rarity_description', 'autographed',
  'autograph_type', 'memorabilia_type', 'rookie_card', 'first_print_rookie',
  'holofoil', 'is_foil', 'foil_type', 'is_double_faced', 'mtg_rarity',
  'is_enchanted', 'manufacturer', 'custom_label_data',
].join(',');

const CARD_CHUNK = 25;

/** Fetch the caller's cards by id, chunked, with the narrow draft column list. */
export async function loadDraftCards(
  supabase: ServerClient,
  cardIds: string[],
  userId: string
): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  for (let i = 0; i < cardIds.length; i += CARD_CHUNK) {
    const chunk = cardIds.slice(i, i + CARD_CHUNK);
    const { data, error } = await supabase
      .from('cards')
      .select(DRAFT_CARD_COLUMNS)
      .eq('user_id', userId)
      .in('id', chunk);
    if (error) {
      console.error('[ebay/bulk] card load failed:', error.message);
      throw new Error('Failed to load cards');
    }
    out.push(...((data ?? []) as unknown as Record<string, any>[]));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Listing defaults + branding                                         */
/* ------------------------------------------------------------------ */

/**
 * The same payload `GET /api/ebay/listing-defaults` returns, resolved
 * server-side. `buildListingDraft`'s `resolveActiveDefaults` applies the
 * cross-org guard to it per card, so a dealer listing a mix of store-graded
 * and personally graded cards gets the right template and grade label on each.
 */
export async function loadListingDefaults(
  supabase: ServerClient,
  userId: string
): Promise<ListingDefaultsPayload> {
  const membership = await getOrgForUser(userId);

  const rowFor = async (filter: { user_id?: string; org_id?: string }) => {
    const select = (columns: string) => {
      let q = supabase.from('listing_templates').select(columns);
      if (filter.org_id) q = q.eq('org_id', filter.org_id);
      else q = q.eq('user_id', filter.user_id!).is('org_id', null);
      return q.maybeSingle();
    };
    // Widest first, dropping one hand-applied migration's columns per step —
    // mirrors the fallback in the /api/ebay/listing-defaults route.
    let data: unknown = null;
    for (const columns of [
      `description_template, shipping_defaults, title_grade_label, ${POLICY_COLUMNS}`,
      'description_template, shipping_defaults, title_grade_label',
      'description_template, shipping_defaults',
    ]) {
      const result = await select(columns);
      if (!result.error) {
        data = result.data;
        break;
      }
      if (!isMissingColumnError(result.error)) return null;
    }
    const row = data as {
      description_template: string | null;
      shipping_defaults: Record<string, unknown> | null;
      title_grade_label?: string | null;
    } | null;
    if (!row) return null;
    const policies = prefsFromRow(row as unknown as Record<string, unknown>);
    return {
      descriptionTemplate: row.description_template,
      shippingDefaults: row.shipping_defaults,
      titleGradeLabel: row.title_grade_label ?? null,
      useBusinessPolicies: policies.useBusinessPolicies,
      defaultShippingPolicyId: policies.shippingPolicyId,
      defaultReturnPolicyId: policies.returnPolicyId,
      defaultPaymentPolicyId: policies.paymentPolicyId,
    };
  };

  const [personal, org] = await Promise.all([
    rowFor({ user_id: userId }),
    membership ? rowFor({ org_id: membership.org.id }) : Promise.resolve(null),
  ]);

  return {
    personal,
    org,
    orgRole: membership?.role ?? null,
    orgId: membership?.org.id ?? null,
  };
}

/**
 * Banner branding (name + colour only — the logo art is a client-side render
 * and the description never carries images) for the orgs in this batch,
 * looked up once per distinct org rather than once per card.
 */
export async function loadBrandingByOrg(
  orgIds: string[]
): Promise<Map<string, ListingBranding>> {
  const map = new Map<string, ListingBranding>();
  const unique = Array.from(new Set(orgIds.filter(Boolean)));
  for (const orgId of unique) {
    const org = await getOrgById(orgId);
    if (!org || org.status === 'cancelled') continue;
    map.set(orgId, { name: org.name, brandColor: org.brand_color || null });
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* eBay aspects                                                        */
/* ------------------------------------------------------------------ */

/**
 * eBay's required + recommended aspects for the categories in a batch,
 * fetched ONCE per distinct eBay category. A DCM batch spans at most three
 * eBay categories (Sports / CCG / Non-Sport), so this is 1-3 Taxonomy calls
 * for a 100-card batch, and the result is merged into every row's specifics
 * at create time. Without it, a row's "required specifics" readiness only
 * knew about the aspects OUR mappers emit, and a missing eBay-required
 * aspect would not surface until the seller opened the drawer — or until
 * eBay rejected the listing.
 *
 * Best-effort: a Taxonomy failure leaves the batch with our own mapped
 * specifics rather than blocking batch creation.
 */
export async function loadAspectsByCategory(
  userId: string,
  categoryIds: string[]
): Promise<Map<string, EbayAspect[]>> {
  const map = new Map<string, EbayAspect[]>();
  const unique = Array.from(new Set(categoryIds.filter(Boolean)));
  if (unique.length === 0) return map;

  let connection = await getConnectionForUser(userId);
  if (!connection) return map;
  connection = await refreshTokenIfNeeded(connection);
  if (!connection) return map;

  const conn = { access_token: connection.access_token, is_sandbox: connection.is_sandbox };
  for (const categoryId of unique) {
    try {
      const result = await fetchCategoryAspects(conn, categoryId);
      if (result.ok) map.set(categoryId, result.aspects as EbayAspect[]);
    } catch (err) {
      console.error('[ebay/bulk] aspects fetch failed for', categoryId, err);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Listing image URLs                                                  */
/* ------------------------------------------------------------------ */

/** Must match EBAY_IMAGES_BUCKET in /api/ebay/images. */
export const EBAY_IMAGES_BUCKET = 'ebay-listing-images';

/**
 * The public-URL prefix /api/ebay/images produces for one card's photos:
 * `<supabase>/storage/v1/object/public/ebay-listing-images/<userId>/<cardId>/`
 * (that route keys uploads as `${user.id}/${cardId}/${timestamp}/…`).
 */
export function listingImagePrefix(userId: string, cardId: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${EBAY_IMAGES_BUCKET}/${userId}/${cardId}/`;
}

/**
 * Is this a URL we uploaded, for THIS user and THIS card?
 *
 * The review page PATCHes photo URLs back after it uploads them, so the
 * column is client-writable — and it is copied verbatim into an eBay
 * listing. Without this check a seller could point their listing photos at
 * any URL on the internet (or at another seller's card folder). The prefix
 * pins the bucket, the owner and the card all at once.
 */
export function isOwnedListingImageUrl(url: string, userId: string, cardId: string): boolean {
  if (typeof url !== 'string' || url.length > 2000) return false;
  if (url.includes('..')) return false;
  // Collapse duplicate slashes after the scheme before comparing: a
  // NEXT_PUBLIC_SUPABASE_URL with a trailing slash makes getPublicUrl emit
  // "…//storage/v1/…", and a purely textual prefix test would then reject
  // every photo we ourselves uploaded.
  const collapse = (s: string) => s.replace(/(?<!:)\/{2,}/g, '/');
  return collapse(url).startsWith(collapse(listingImagePrefix(userId, cardId)));
}

/* ------------------------------------------------------------------ */
/* Draft assembly                                                      */
/* ------------------------------------------------------------------ */

export interface DraftContext {
  settings: BulkBatchSettings;
  listingDefaults: ListingDefaultsPayload | null;
  brandingByOrg: Map<string, ListingBranding>;
  /**
   * eBay's required + recommended aspects, keyed by eBay category id (see
   * loadAspectsByCategory). Passing them makes the required ones part of
   * every row's item specifics — and therefore part of its readiness —
   * before anyone opens a drawer.
   */
  aspectsByCategory?: Map<string, EbayAspect[]>;
}

export interface DraftedItemFields {
  title: string;
  description_html: string;
  item_specifics: unknown;
  price: number | null;
}

/** The cardType the draft builder + route slugs use, from the DCM category. */
export function cardTypeFor(card: { category?: string | null }): string {
  return categoryToRouteSlug(card.category ?? '');
}

/** The eBay category id a card will be listed in. */
export function ebayCategoryForCard(card: { category?: string | null }): string {
  return getCategoryForCardType(cardTypeFor(card));
}

/**
 * Build one row's listing fields. The description is passed through the same
 * two repairs the publish path applies (links stripped, rival-grader sentences
 * dropped) so the review list shows exactly what will ship.
 */
export function draftFieldsForCard(card: any, ctx: DraftContext): DraftedItemFields {
  const cardType = cardTypeFor(card);
  const draft = buildListingDraft(card, {
    cardType,
    listingDefaults: ctx.listingDefaults,
    branding: (card.org_id && ctx.brandingByOrg.get(card.org_id)) || null,
    aspects: ctx.aspectsByCategory?.get(getCategoryForCardType(cardType)) ?? null,
    shippingSummary: shippingSummaryFor(ctx.settings),
  });

  return {
    title: draft.title.slice(0, 80),
    description_html: stripBlockedGraderSentences(stripLinks(draft.descriptionHtml)),
    item_specifics: draft.itemSpecifics,
    price: priceForCard(card, ctx.settings.priceRule),
  };
}

/** A freshly drafted item row, ready to insert. */
export function newItemRow(
  batchId: string,
  card: any,
  position: number,
  ctx: DraftContext
): Record<string, unknown> {
  const fields = draftFieldsForCard(card, ctx);
  const base = {
    batch_id: batchId,
    card_id: card.id,
    position,
    ...fields,
    image_urls: [],
    image_status: 'pending' as const,
    price_edited: false,
    title_edited: false,
    description_edited: false,
  };
  const { readiness, status } = readinessPatch(
    { ...base, status: 'draft' },
    ctx.settings.listingFormat,
    ctx.settings.shipping.postalCode
  );
  return { ...base, readiness, status };
}
