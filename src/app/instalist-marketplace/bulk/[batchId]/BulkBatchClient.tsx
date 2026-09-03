'use client';

/**
 * Bulk listing review page (Part 2, Phase 1).
 *
 * One row per card, each already drafted server-side, so this page is an
 * editor over `ebay_bulk_items` rather than N copies of the listing modal.
 * Everything the seller changes is PATCHed immediately — a reload, a crashed
 * tab or a phone picking the batch up later all resume from the same rows.
 *
 * The one thing that CANNOT live on the server is the photo set: the slab
 * label art and the mini report are canvas renders. So on load this page
 * renders and uploads photos for every row still marked `pending`, three at a
 * time, and stores the resulting eBay-hosted URLs on the row. Reload-safe by
 * construction: `ready` rows are skipped.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getStoredSession } from '@/lib/directAuth';
import { useCustomLabelStyle } from '@/hooks/useCustomLabelStyle';
import { categoryToRouteSlug } from '@/lib/postGradeEmailTemplates';
import {
  prepareListingImages,
  uploadListingImages,
  mapWithConcurrency,
  DEFAULT_IMAGE_ORDER,
  type SystemImageKey,
} from '@/lib/ebay/prepareListingImages';
import { getCategoryForCardType } from '@/lib/ebay/itemSpecifics';
import { resolveListingFields } from '@/lib/ebay/listingFields';
import { mergeAspectsIntoSpecifics, type EbayAspect } from '@/lib/ebay/listingDraft';
import { EBAY_TITLE_MAX, specificsTally } from '@/lib/ebay/bulkReadiness';
import { resolveCardValue } from '@/lib/pricing/resolveCardValue';
import {
  describeListingFormat,
  type BulkBatchSettings,
  type BulkPriceRule,
} from '@/lib/ebay/bulkSettings';
import { PAUSE_REASONS } from '@/lib/ebay/bulkPublish';
import BulkSettingsPanel from './BulkSettingsPanel';
import BulkItemDrawer, { type DrawerTab } from './BulkItemDrawer';
import type { BulkBatch, BulkBatchPayload, BulkItem, BulkListingRef } from '../types';
import type { MarketplaceCard } from '../../types';

const ALL_SELECTED: Record<SystemImageKey, boolean> = {
  front: true,
  back: true,
  miniReport: true,
  rawFront: true,
  rawBack: true,
};

const IMAGE_CONCURRENCY = 3;

/**
 * Rows the progress view offers a Retry on. `skipped` is included because it
 * is the most reversible reason of the three — the card was blocked by a live
 * listing or a pending claim, either of which can be gone by the time the
 * seller looks. The server re-runs the real duplicate check and simply skips
 * it again if it is still listed.
 */
const RETRYABLE_STATUSES: ReadonlySet<string> = new Set(['failed', 'blocked', 'skipped']);

/** The bulk-action buttons, so the bar can name the one that is running. */
type BulkActionKind = 'regenerate' | 'remove' | 'prefix' | 'suffix';

/** The slices the draft filter strip offers. */
type RowFilter = 'all' | 'needs' | 'ready' | 'skipped';

/** Shared tap target for the review row's action links. */
const rowActionClass = 'min-h-[40px] inline-flex items-center';

/** "Applying 12 of 40…" — the running bulk button says how far it has got. */
function bulkBusyLabel(busy: { done: number; total: number }): string {
  return `Applying ${Math.min(busy.done + 1, busy.total)} of ${busy.total}…`;
}

const ROW_FILTER_LABEL: Record<RowFilter, string> = {
  all: 'All',
  needs: 'Needs work',
  ready: 'Ready',
  skipped: 'Skipped',
};

interface Props {
  batchId: string;
}

export default function BulkBatchClient({ batchId }: Props) {
  // `loading` matters: the hook starts on the default style and only then
  // resolves the seller's saved one. Rendering slab art before it settles
  // uploads a Modern label for a Heritage or enterprise account — and those
  // photos are what the buyer sees, so the photo pass waits for it.
  const { labelStyle, activeConfig, loading: labelStyleLoading } = useCustomLabelStyle();

  const [token, setToken] = useState<string | null>(null);
  const [batch, setBatch] = useState<BulkBatch | null>(null);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [cards, setCards] = useState<Map<string, MarketplaceCard>>(new Map());
  /** eBay rows for published/skipped items, keyed by `item.listing_row_id`. */
  const [listings, setListings] = useState<Map<string, BulkListingRef>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress view (batch.status !== 'draft')
  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [retryingAll, setRetryingAll] = useState(false);

  const [settings, setSettings] = useState<BulkBatchSettings | null>(null);
  // Read by `load`, which must not depend on `settings` — it is called from a
  // 3-second poll and a new identity each render would restart the interval.
  const settingsRef = useRef<BulkBatchSettings | null>(null);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<number | null>(null);

  const [imageProgress, setImageProgress] = useState<{ done: number; total: number } | null>(null);
  const imagesStarted = useRef(false);
  /** Item ids with a photo pass in flight, so a re-check can't double-render. */
  const prepInFlight = useRef<Set<string>>(new Set());

  // The photo pass is a long-running loop over a snapshot. It reads the
  // latest items/cards through refs rather than closing over them, because
  // every PATCH it makes updates `items` — closing over state would have
  // meant re-running (and re-rendering N slabs) on every row it finished.
  const itemsRef = useRef<BulkItem[]>([]);
  const cardsRef = useRef<Map<string, MarketplaceCard>>(new Map());
  const unmountedRef = useRef(false);
  // Reset on (re)mount: React StrictMode runs the cleanup once on a simulated
  // unmount in dev while keeping the ref, which would otherwise mute every
  // PATCH and progress update for the life of the page.
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  /** Which bulk-action button is running, and how far through it is. */
  const [bulkBusy, setBulkBusy] = useState<{ kind: BulkActionKind; done: number; total: number } | null>(null);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  /** Which slice of the draft list the filter strip is showing. */
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  /** Two-step confirm on "remove the rows that still need something". */
  const [confirmDropNotReady, setConfirmDropNotReady] = useState(false);
  const [droppingNotReady, setDroppingNotReady] = useState(false);
  const [affixText, setAffixText] = useState('');
  const [affixNote, setAffixNote] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ itemId: string; tab: DrawerTab } | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  /** Tone matters: "40 cards queued" is good news and must not wear the
   *  same amber panel a failure does. */
  const [publishNote, setPublishNote] = useState<{ text: string; tone: 'success' | 'warning' } | null>(null);

  const aspectCache = useRef<Map<string, EbayAspect[]>>(new Map());

  /* ------------------------------------------------------------ load -- */

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch(`/api/ebay/bulk/batches/${batchId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) {
      setError('This batch no longer exists, or bulk listing is not switched on for your account.');
      return;
    }
    if (!res.ok) {
      setError('Could not load this batch. Please try again.');
      return;
    }
    const json: BulkBatchPayload = await res.json();
    const cardMap = new Map(json.cards.map(c => [c.id, c]));
    itemsRef.current = json.items;
    cardsRef.current = cardMap;
    setBatch(json.batch);
    setItems(json.items);
    setCards(cardMap);
    setListings(new Map((json.listings ?? []).map(l => [l.id, l])));
    // Settings are the review form's state. Once the batch is running they are
    // frozen server-side, and re-seeding them from a poll would fight anything
    // still on screen — so only a draft re-syncs them.
    if (json.batch.status === 'draft') {
      setSettings(json.batch.settings);
      setSettingsDirty(false);
    } else if (!settingsRef.current) {
      setSettings(json.batch.settings);
    }
  }, [batchId]);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.access_token) {
      setError('Please sign in again.');
      setLoading(false);
      return;
    }
    setToken(session.access_token);
    load(session.access_token).finally(() => setLoading(false));
  }, [load]);

  // Listing allowance is advisory: when eBay does not report one the line is
  // simply not shown.
  useEffect(() => {
    if (!token) return;
    fetch('/api/ebay/bulk/limits', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (typeof j?.available === 'number') setAllowance(j.available); })
      .catch(() => { /* advisory only */ });
  }, [token]);

  /* -------------------------------------------------------- patching -- */

  const patchItem = useCallback(
    async (itemId: string, patch: Record<string, unknown>): Promise<BulkItem | null> => {
      if (!token) return null;
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save that change.');
      const updated: BulkItem = json.item;
      itemsRef.current = itemsRef.current.map(i => (i.id === itemId ? updated : i));
      setItems(prev => prev.map(i => (i.id === itemId ? updated : i)));
      return updated;
    },
    [batchId, token]
  );

  /* ---------------------------------------------------------- photos -- */

  /**
   * Render and upload the slab photo set for a snapshot of item ids, three
   * at a time. Every row is independent, so one card's failure marks only
   * that row `failed`; the pass runs to the end either way and stops only on
   * unmount. Reload-safe: rows already `ready` are never in the snapshot.
   */
  const runImagePrep = useCallback(
    async (itemIds: string[], options?: { showProgress?: boolean }) => {
      if (!token) return;
      const todo = itemIds.filter(id => !prepInFlight.current.has(id));
      if (todo.length === 0) return;
      todo.forEach(id => prepInFlight.current.add(id));

      // A one-row retry must not repaint the page-wide bar as "0 of 1": the
      // load-time pass may still be running behind it, and its own row shows
      // a spinner already.
      const showProgress = options?.showProgress !== false;
      let done = 0;
      if (showProgress) setImageProgress({ done: 0, total: todo.length });

      await mapWithConcurrency(todo, IMAGE_CONCURRENCY, async itemId => {
        if (unmountedRef.current) return;
        const item = itemsRef.current.find(i => i.id === itemId);
        const card = item ? cardsRef.current.get(item.card_id) : undefined;
        try {
          if (!item || !card) throw new Error('Card not loaded');
          const cardType = categoryToRouteSlug(card.category ?? '');
          const prepared = await prepareListingImages(card, {
            cardType,
            labelStyle,
            customLabelConfig: activeConfig,
          });
          const urls = await uploadListingImages({
            cardId: card.id,
            accessToken: token,
            order: [...DEFAULT_IMAGE_ORDER],
            blobs: prepared.blobs,
            selected: ALL_SELECTED,
          });
          // Object URLs were only for preview tiles this page never shows.
          Object.values(prepared.objectUrls).forEach(url => URL.revokeObjectURL(url));
          if (unmountedRef.current) return;
          await patchItem(itemId, {
            image_urls: urls,
            image_status: urls.length > 0 ? 'ready' : 'failed',
          });
        } catch (err) {
          console.error('[bulk] photo prep failed for', itemId, err);
          if (!unmountedRef.current) {
            await patchItem(itemId, { image_status: 'failed' }).catch(() => {});
          }
        } finally {
          prepInFlight.current.delete(itemId);
          done++;
          if (showProgress && !unmountedRef.current) setImageProgress({ done, total: todo.length });
        }
      });
      if (showProgress && !unmountedRef.current) setImageProgress(null);
    },
    [activeConfig, labelStyle, patchItem, token]
  );

  // Fires ONCE, on the first render after the batch and the seller's label
  // style have both landed. The snapshot is taken here and never recomputed:
  // the pass PATCHes rows as it goes, and an effect that depended on `items`
  // would tear itself down on the first completed row.
  useEffect(() => {
    if (!token || loading || labelStyleLoading || imagesStarted.current) return;
    // Photos belong to the review step. Once a batch is running its rows are
    // the drain's, and re-rendering slab art over them would race the publish.
    if (batch && batch.status !== 'draft') return;
    imagesStarted.current = true;
    const pendingIds = itemsRef.current
      .filter(i => i.image_status === 'pending' && i.status !== 'skipped')
      .map(i => i.id);
    if (pendingIds.length === 0) return;
    void runImagePrep(pendingIds);
  }, [token, loading, labelStyleLoading, runImagePrep, batch]);

  /* -------------------------------------------------------- settings -- */

  const applySettings = useCallback(async () => {
    if (!token || !settings) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Could not apply those settings.');
        return;
      }
      const applied = itemsRef.current.filter(i => i.status !== 'skipped').length;
      await load(token);
      setSavedFlash(`Applied to ${applied} card${applied === 1 ? '' : 's'}`);
      setTimeout(() => setSavedFlash(null), 3000);
    } finally {
      setApplying(false);
    }
  }, [batchId, load, settings, token]);

  const saveShippingDefaults = useCallback(async () => {
    if (!token || !settings) return;
    setSavingDefaults(true);
    try {
      // Same endpoint and scope rules the single-card modal uses; org owners
      // listing their own store's cards save the store's defaults.
      const scope = batch?.org_id ? 'org' : 'personal';
      const res = await fetch('/api/ebay/listing-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scope,
          shippingDefaults: { ...settings.shipping, bestOfferEnabled: settings.bestOfferEnabled },
        }),
      });
      // An org save is refused for staff (403) — fall back to personal rather
      // than telling a member their settings vanished.
      if (!res.ok && scope === 'org') {
        await fetch('/api/ebay/listing-defaults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            scope: 'personal',
            shippingDefaults: { ...settings.shipping, bestOfferEnabled: settings.bestOfferEnabled },
          }),
        });
      }
      setSavedFlash('Shipping defaults saved');
      setTimeout(() => setSavedFlash(null), 2500);
    } finally {
      setSavingDefaults(false);
    }
  }, [batch?.org_id, settings, token]);

  /* ---------------------------------------------------- row actions -- */

  const regenerateRow = useCallback(
    async (itemId: string) => {
      if (!token) return;
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/items/${itemId}/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.item) {
        itemsRef.current = itemsRef.current.map(i => (i.id === itemId ? json.item : i));
        setItems(prev => prev.map(i => (i.id === itemId ? json.item : i)));
      }
    },
    [batchId, token]
  );

  const removeRow = useCallback(
    async (itemId: string) => {
      if (!token) return;
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        itemsRef.current = itemsRef.current.filter(i => i.id !== itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
        setSelectedRows(prev => prev.filter(id => id !== itemId));
      }
    },
    [batchId, token]
  );

  /**
   * A row whose photo render failed is otherwise a dead end: the load-time
   * pass only picks up `pending` rows, so a reload would skip it forever.
   * Flip it back to pending and run just that one.
   */
  const retryPhotos = useCallback(
    async (itemId: string) => {
      try {
        await patchItem(itemId, { image_status: 'pending' });
      } catch {
        return;
      }
      void runImagePrep([itemId], { showProgress: false });
    },
    [patchItem, runImagePrep]
  );

  /**
   * A skipped card can stop being blocked while the seller is still
   * reviewing (they ended the eBay listing, or an abandoned claim aged out).
   * The server re-runs the publish path's own conflict check; if the row
   * comes back it still needs its photos, which were never rendered.
   */
  const recheckRow = useCallback(
    async (itemId: string) => {
      if (!token) return;
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/items/${itemId}/recheck`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.item) return;
      itemsRef.current = itemsRef.current.map(i => (i.id === itemId ? json.item : i));
      setItems(prev => prev.map(i => (i.id === itemId ? json.item : i)));
      if (json.changed && json.item.image_status === 'pending') {
        void runImagePrep([itemId], { showProgress: false });
      }
    },
    [batchId, runImagePrep, token]
  );

  /** Sequential on purpose: a bulk action over 100 rows is 100 PATCHes and
   *  firing them all at once is how you rate-limit your own API.
   *
   *  `kind` names which button is running so the bar can disable the rest and
   *  count the one that is working — a 40-row pass takes long enough that a
   *  silent bar reads as a dead click. */
  const forEachSelected = useCallback(
    async (kind: BulkActionKind, fn: (item: BulkItem) => Promise<void>) => {
      const chosen = items.filter(i => selectedRows.includes(i.id));
      setBulkBusy({ kind, done: 0, total: chosen.length });
      try {
        for (const item of chosen) {
          try {
            await fn(item);
          } catch (err) {
            console.error('[bulk] bulk action failed for', item.id, err);
          }
          setBulkBusy(prev => (prev ? { ...prev, done: prev.done + 1 } : prev));
        }
      } finally {
        setBulkBusy(null);
      }
    },
    [items, selectedRows]
  );

  /**
   * Add text to the front or back of every selected title. Rows the affix
   * would push past eBay's 80 characters are skipped rather than truncated —
   * silently cutting a card's name out of a title is worse than leaving that
   * row alone, and the count below says how many were left.
   */
  const applyTitleAffix = useCallback(
    async (kind: 'prefix' | 'suffix', rawText: string) => {
      const affix = rawText.trim();
      if (!affix) return;
      let skipped = 0;
      await forEachSelected(kind, async item => {
        const base = item.title ?? '';
        const next = kind === 'prefix' ? `${affix} ${base}` : `${base} ${affix}`;
        if (next.length > EBAY_TITLE_MAX) { skipped++; return; }
        await patchItem(item.id, { title: next });
      });
      setAffixNote(
        skipped > 0
          ? `${skipped} title${skipped === 1 ? ' was' : 's were'} left alone — the text would not fit in ${EBAY_TITLE_MAX} characters.`
          : null
      );
      setAffixText('');
    },
    [forEachSelected, patchItem]
  );

  /* ------------------------------------------------------- specifics -- */

  /**
   * Safety net, not the primary path: batch creation already merges eBay's
   * aspects into every row server-side (that is what makes an unfilled
   * required specific fail readiness without anyone opening a drawer). This
   * re-merge covers the case where the Taxonomy call failed at create time,
   * and is idempotent — mergeAspectsIntoSpecifics only adds names the row
   * does not already carry. Fetched once per eBay category.
   */
  const ensureAspects = useCallback(
    async (item: BulkItem) => {
      const card = cards.get(item.card_id);
      if (!token || !card) return;
      const cardType = categoryToRouteSlug(card.category ?? '');
      const categoryId = getCategoryForCardType(cardType);
      let aspects = aspectCache.current.get(categoryId);
      if (!aspects) {
        try {
          const res = await fetch(`/api/ebay/aspects?category_id=${categoryId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          aspects = (json.aspects ?? []) as EbayAspect[];
          aspectCache.current.set(categoryId, aspects);
        } catch {
          return;
        }
      }
      if (!aspects.length) return;
      const current = item.item_specifics ?? [];
      const extra = mergeAspectsIntoSpecifics(
        current as any,
        aspects,
        resolveListingFields(card, cardType)
      );
      if (extra.length === 0) return;
      setItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, item_specifics: [...current, ...extra] } : i))
      );
    },
    [cards, token]
  );

  /* --------------------------------------------------------- publish -- */

  const nonSkipped = useMemo(() => items.filter(i => i.status !== 'skipped'), [items]);
  const allReady = nonSkipped.length > 0 && nonSkipped.every(i => i.status === 'ready');
  // Derived from the rows in hand, not batch.ready_count: the batch column is
  // only refreshed server-side, so it lags every inline edit on this page.
  const readyCount = useMemo(() => items.filter(i => i.status === 'ready').length, [items]);
  /** Draft rows the all-or-nothing publish gate is waiting on. */
  const notReady = useMemo(
    () => items.filter(i => i.status !== 'skipped' && i.status !== 'ready'),
    [items]
  );

  const filterCounts = useMemo(
    () => ({
      all: items.length,
      needs: notReady.length,
      ready: readyCount,
      skipped: items.length - nonSkipped.length,
    }),
    [items.length, nonSkipped.length, notReady.length, readyCount]
  );

  const visibleRows = useMemo(() => {
    if (rowFilter === 'needs') return notReady;
    if (rowFilter === 'ready') return items.filter(i => i.status === 'ready');
    if (rowFilter === 'skipped') return items.filter(i => i.status === 'skipped');
    return items;
  }, [items, notReady, rowFilter]);

  /**
   * Drop every row the gate is waiting on. The gate itself stays all-or-nothing
   * — this is the other way out of it, for a seller who would rather list the
   * 57 cards that are fine than hunt down the 3 that are not.
   */
  const dropNotReady = useCallback(async () => {
    setDroppingNotReady(true);
    try {
      for (const item of notReady) {
        await removeRow(item.id);
      }
    } finally {
      setDroppingNotReady(false);
      setConfirmDropNotReady(false);
    }
  }, [notReady, removeRow]);

  /** Progress-view tally. Derived from the rows, for the same reason. */
  const counts = useMemo(() => {
    const by = (s: string) => items.filter(i => i.status === s).length;
    const live = by('live');
    const failed = by('failed');
    const blocked = by('blocked');
    const skipped = by('skipped');
    return {
      total: items.length,
      live,
      failed,
      blocked,
      skipped,
      inFlight: by('queued') + by('uploading') + by('publishing'),
      settled: live + failed + blocked + skipped,
      // Everything the Retry action can act on. Skipped rows are included:
      // re-checking one costs a duplicate lookup and no eBay call.
      retryable: failed + blocked + skipped,
    };
  }, [items]);

  const publish = useCallback(async () => {
    if (!token) return;
    setPublishing(true);
    setPublishNote(null);
    try {
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 501) {
        setPublishNote({
          text:
            json.message ||
            'Publishing is not enabled yet. Your batch is saved and will publish once it ships.',
          tone: 'warning',
        });
        return;
      }
      if (!res.ok) {
        setPublishNote({ text: json.error || 'Could not start publishing.', tone: 'warning' });
        return;
      }
      await load(token);
      setPublishNote({
        text: `${json.queued} card${json.queued === 1 ? '' : 's'} queued for eBay.`,
        tone: 'success',
      });
    } finally {
      setPublishing(false);
    }
  }, [batchId, load, token]);

  /* --------------------------------------------------- progress view -- */

  /**
   * Poll while the batch is running.
   *
   * Deliberately keyed on `batch.status`, not on `batch`: the poll itself
   * replaces the batch object every three seconds, and depending on the whole
   * object would tear down and rebuild the interval on every tick. It also
   * stops the moment the tab is hidden — a backgrounded tab has nobody
   * watching it, and the drain does not need us.
   */
  const batchStatus = batch?.status;
  useEffect(() => {
    if (!token || batchStatus !== 'running') return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load(token);
    }, 3000);
    return () => window.clearInterval(id);
  }, [token, batchStatus, load]);

  const batchAction = useCallback(
    async (action: 'pause' | 'resume' | 'cancel') => {
      if (!token) return;
      setBatchBusy(action);
      setPublishNote(null);
      try {
        const res = await fetch(`/api/ebay/bulk/batches/${batchId}/${action}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPublishNote({ text: json.error || `Could not ${action} this batch.`, tone: 'warning' });
          return;
        }
        await load(token);
      } finally {
        setBatchBusy(null);
        setConfirmCancel(false);
      }
    },
    [batchId, load, token]
  );

  const retryItem = useCallback(
    async (itemId: string): Promise<string | null> => {
      if (!token) return 'Please sign in again.';
      const res = await fetch(`/api/ebay/bulk/batches/${batchId}/items/${itemId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json.error || 'Could not retry this card.';
      if (json.item) {
        itemsRef.current = itemsRef.current.map(i => (i.id === itemId ? json.item : i));
        setItems(prev => prev.map(i => (i.id === itemId ? json.item : i)));
      }
      if (json.batch) setBatch(json.batch);
      if (Array.isArray(json.notReady) && json.notReady.length > 0) {
        return `Still not ready: ${json.notReady.join(', ')}`;
      }
      // A re-check that found the card still listed is a real answer, not a
      // no-op — say so, or the button looks broken.
      if (json.skipped) return 'Still listed on eBay — nothing to do.';
      return null;
    },
    [batchId, token]
  );

  /** Sequential, like every other bulk action here — 50 parallel POSTs is how
   *  you rate-limit your own API. */
  const retryAllFailed = useCallback(async () => {
    if (!token) return;
    setRetryingAll(true);
    try {
      const targets = itemsRef.current.filter(i => RETRYABLE_STATUSES.has(i.status));
      for (const item of targets) {
        await retryItem(item.id).catch(() => null);
      }
      await load(token);
    } finally {
      setRetryingAll(false);
    }
  }, [load, retryItem, token]);

  /* ---------------------------------------------------------- render -- */

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading your batch…</p>
        </div>
      </main>
    );
  }

  if (error || !batch || !settings) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Couldn&rsquo;t open this batch</h1>
          <p className="text-gray-600 mb-4">{error ?? 'Something went wrong.'}</p>
          <Link
            href="/instalist-marketplace"
            className="inline-block px-5 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
          >
            Back to InstaList
          </Link>
        </div>
      </main>
    );
  }

  const drawerItem = drawer ? items.find(i => i.id === drawer.itemId) : null;
  // The whole page has two modes. `draft` is the review editor built in
  // Phase 1; everything else is the progress view, which is read-only over the
  // same rows plus the run controls.
  const isDraft = batch.status === 'draft';
  // The SAVED format, not the panel's edit state: it is what the rows were
  // seeded against, so the price column has to be named after it.
  const isAuction = batch.settings?.listingFormat === 'AUCTION';
  // The column HEADING follows the panel's current choice instead, so switching
  // format renames the column at once rather than only after Apply.
  const priceHeading = settings.listingFormat === 'AUCTION' ? 'Starting price' : 'Price';

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/instalist-marketplace" className="text-sm text-indigo-600 hover:text-indigo-800">
              &larr; InstaList
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
              {isDraft ? 'Review your batch' : BATCH_HEADINGS[batch.status] ?? 'Your batch'}
            </h1>
            {isDraft ? (
              <p className="text-sm text-gray-600 mt-1">
                {nonSkipped.length} card{nonSkipped.length === 1 ? '' : 's'} to list
                {items.length !== nonSkipped.length && (
                  <> &middot; {items.length - nonSkipped.length} skipped</>
                )}
                {' '}&middot; {readyCount} ready
                {' '}&middot; {describeListingFormat(batch.settings)}
              </p>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                {counts.live} live &middot; {counts.inFlight} to go
                {counts.failed > 0 && <> &middot; {counts.failed} failed</>}
                {counts.blocked > 0 && <> &middot; {counts.blocked} held</>}
                {counts.skipped > 0 && <> &middot; {counts.skipped} skipped</>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isDraft ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={publish}
                  disabled={!allReady || publishing}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {publishing
                    ? 'Starting…'
                    : `List ${nonSkipped.length} card${nonSkipped.length === 1 ? '' : 's'}`}
                </button>
                {/* Why the button is off, and the one action that turns it on
                    without opening every row. */}
                {notReady.length > 0 && (
                  confirmDropNotReady ? (
                    <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span className="text-sm text-red-800">
                        Remove {notReady.length} card{notReady.length === 1 ? '' : 's'} from this batch?
                      </span>
                      <button
                        onClick={dropNotReady}
                        disabled={droppingNotReady}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        {droppingNotReady ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button
                        onClick={() => setConfirmDropNotReady(false)}
                        disabled={droppingNotReady}
                        className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
                      >
                        Keep them
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-amber-800">
                        {notReady.length} card{notReady.length === 1 ? '' : 's'} still need
                        {notReady.length === 1 ? 's' : ''} something
                      </span>
                      <button
                        onClick={() => setConfirmDropNotReady(true)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50"
                      >
                        Remove the {notReady.length} not-ready card{notReady.length === 1 ? '' : 's'}
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <BatchControls
                status={batch.status}
                busy={batchBusy}
                confirmCancel={confirmCancel}
                onConfirmCancel={setConfirmCancel}
                onAction={batchAction}
              />
            )}
          </div>
        </div>

        {publishNote && (
          <div
            className={`border rounded-lg px-4 py-3 text-sm ${
              publishNote.tone === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {publishNote.text}
          </div>
        )}

        {!isDraft && (
          <BatchProgress
            batch={batch}
            counts={counts}
            token={token}
            settings={batch.settings}
            onRetryAll={retryAllFailed}
            retryingAll={retryingAll}
          />
        )}

        {isDraft && imageProgress && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-700 mb-2">
              Preparing slab photos — {imageProgress.done} of {imageProgress.total}
            </p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.round((imageProgress.done / Math.max(1, imageProgress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Leave this page open until it finishes. If you reload, it picks up where it left off.
            </p>
          </div>
        )}

        {isDraft && <BulkSettingsPanel
          settings={settings}
          token={token}
          onChange={next => { setSettings(next); setSettingsDirty(true); }}
          onApply={applySettings}
          onSaveDefaults={saveShippingDefaults}
          dirty={settingsDirty}
          applying={applying}
          savingDefaults={savingDefaults}
          savedFlash={savedFlash}
          itemCount={nonSkipped.length}
          allowance={allowance}
        />}

        {/* --------------------------------------------- bulk actions -- */}
        {isDraft && selectedRows.length > 0 && (
          // Sticky: the bar acts on a selection made anywhere in a 100-row
          // list, so it has to still be on screen when the reviewer gets there.
          <div className="sticky top-0 z-20 bg-indigo-600 text-white rounded-lg px-4 py-3 space-y-2 text-sm shadow-lg">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{selectedRows.length} row{selectedRows.length === 1 ? '' : 's'}</span>
              <button
                onClick={() => forEachSelected('regenerate', item => regenerateRow(item.id))}
                disabled={bulkBusy !== null}
                className="underline hover:no-underline disabled:opacity-60 disabled:no-underline"
              >
                {bulkBusy?.kind === 'regenerate' ? bulkBusyLabel(bulkBusy) : 'Reset to generated'}
              </button>
              {confirmBulkRemove ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>Remove {selectedRows.length} card{selectedRows.length === 1 ? '' : 's'} from this batch?</span>
                  <button
                    onClick={async () => {
                      await forEachSelected('remove', item => removeRow(item.id));
                      setConfirmBulkRemove(false);
                    }}
                    disabled={bulkBusy !== null}
                    className="px-2.5 py-1 bg-white text-red-700 rounded-md font-semibold disabled:opacity-60"
                  >
                    {bulkBusy?.kind === 'remove' ? bulkBusyLabel(bulkBusy) : 'Yes, remove'}
                  </button>
                  <button
                    onClick={() => setConfirmBulkRemove(false)}
                    disabled={bulkBusy !== null}
                    className="opacity-90 hover:opacity-100 disabled:opacity-60"
                  >
                    Keep them
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmBulkRemove(true)}
                  disabled={bulkBusy !== null}
                  className="underline hover:no-underline disabled:opacity-60 disabled:no-underline"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setSelectedRows([])}
                disabled={bulkBusy !== null}
                className="ml-auto opacity-80 hover:opacity-100 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="bulk-affix">Text to add to the selected titles</label>
              <input
                id="bulk-affix"
                type="text"
                value={affixText}
                onChange={e => setAffixText(e.target.value)}
                placeholder="Text to add to titles"
                className="flex-1 min-w-[10rem] px-2.5 py-1.5 rounded-md text-gray-900 text-sm border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                onClick={() => applyTitleAffix('prefix', affixText)}
                disabled={!affixText.trim() || bulkBusy !== null}
                className="px-3 py-1.5 bg-white text-indigo-700 rounded-md font-semibold disabled:opacity-50"
              >
                {bulkBusy?.kind === 'prefix' ? bulkBusyLabel(bulkBusy) : 'Add to front'}
              </button>
              <button
                onClick={() => applyTitleAffix('suffix', affixText)}
                disabled={!affixText.trim() || bulkBusy !== null}
                className="px-3 py-1.5 bg-white text-indigo-700 rounded-md font-semibold disabled:opacity-50"
              >
                {bulkBusy?.kind === 'suffix' ? bulkBusyLabel(bulkBusy) : 'Add to end'}
              </button>
            </div>
            {affixNote && <p className="text-xs text-indigo-100">{affixNote}</p>}
          </div>
        )}

        {/* -------------------------------------------- progress list -- */}
        {!isDraft && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[4rem_1fr_8rem_12rem] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Card</span>
              <span>Title</span>
              <span>{priceHeading}</span>
              <span>Status</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map(item => (
                <ProgressRow
                  key={item.id}
                  item={item}
                  card={cards.get(item.card_id)}
                  listing={item.listing_row_id ? listings.get(item.listing_row_id) : undefined}
                  onRetry={() => retryItem(item.id)}
                  onEdit={tab => {
                    setDrawerError(null);
                    setDrawer({ itemId: item.id, tab });
                  }}
                />
              ))}
            </ul>
          </div>
        )}

        {/* ---------------------------------------------- review list -- */}
        {isDraft && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Filter strip. "Needs work" is the one people actually want: it is
              the list of rows standing between them and the publish button. */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200">
            {(['all', 'needs', 'ready', 'skipped'] as const)
              .filter(key => key === 'all' || filterCounts[key] > 0)
              .map(key => (
                <button
                  key={key}
                  onClick={() => setRowFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    rowFilter === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {ROW_FILTER_LABEL[key]} ({filterCounts[key]})
                </button>
              ))}
          </div>
          <div className="hidden md:grid grid-cols-[2rem_4rem_1fr_9rem_12rem_6rem] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <SelectAllCheckbox
              rows={visibleRows}
              selectedRows={selectedRows}
              onChange={setSelectedRows}
            />
            <span>Card</span>
            <span>Title</span>
            <span>{priceHeading}</span>
            <span>Details</span>
            <span>Status</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {visibleRows.length === 0 && (
              <li className="px-4 py-6 text-sm text-gray-500 text-center">
                No rows in this view.
              </li>
            )}
            {visibleRows.map(item => (
              <BulkRow
                key={item.id}
                item={item}
                card={cards.get(item.card_id)}
                selected={selectedRows.includes(item.id)}
                onToggle={() =>
                  setSelectedRows(prev =>
                    prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                  )
                }
                onPatch={patchItem}
                onRegenerate={() => regenerateRow(item.id)}
                onRemove={() => removeRow(item.id)}
                onRecheck={() => recheckRow(item.id)}
                onRetryPhotos={() => retryPhotos(item.id)}
                onOpenDrawer={async tab => {
                  if (tab === 'specifics') await ensureAspects(item);
                  setDrawerError(null);
                  setDrawer({ itemId: item.id, tab });
                }}
              />
            ))}
          </ul>
        </div>
        )}
      </div>

      {drawer && drawerItem && (
        <BulkItemDrawer
          item={drawerItem}
          card={cards.get(drawerItem.card_id)}
          mode={isDraft ? 'review' : 'repair'}
          listingFormat={isAuction ? 'AUCTION' : 'FIXED_PRICE'}
          tab={drawer.tab}
          onTabChange={async tab => {
            if (tab === 'specifics') await ensureAspects(drawerItem);
            setDrawer({ itemId: drawerItem.id, tab });
          }}
          onClose={() => setDrawer(null)}
          saving={drawerSaving}
          error={drawerError}
          onRegenerate={async () => {
            setDrawerSaving(true);
            try {
              await regenerateRow(drawerItem.id);
            } finally {
              setDrawerSaving(false);
            }
          }}
          onPatch={async patch => {
            setDrawerSaving(true);
            setDrawerError(null);
            try {
              await patchItem(drawerItem.id, patch);
              setDrawer(null);
            } catch (err: any) {
              setDrawerError(err?.message ?? 'Could not save that change.');
            } finally {
              setDrawerSaving(false);
            }
          }}
          // Save, then send the card back to eBay, then close — the whole
          // point of opening a failed row.
          onSaveAndRetry={async patch => {
            setDrawerSaving(true);
            setDrawerError(null);
            try {
              await patchItem(drawerItem.id, patch);
              const problem = await retryItem(drawerItem.id);
              if (problem) {
                setDrawerError(problem);
                return;
              }
              setDrawer(null);
            } catch (err: any) {
              setDrawerError(err?.message ?? 'Could not save that change.');
            } finally {
              setDrawerSaving(false);
            }
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Progress view                                                       */
/* ------------------------------------------------------------------ */

const BATCH_HEADINGS: Record<string, string> = {
  running: 'Publishing your batch',
  paused: 'Batch paused',
  complete: 'Batch finished',
  failed: 'Batch finished',
  cancelled: 'Batch cancelled',
};

/** "DCM estimate" / "Estimate × 90%" / "$12.00 each" / "Priced per row". */
function describePriceRule(rule: BulkPriceRule): string {
  switch (rule.mode) {
    case 'fixed': return `$${rule.amount.toFixed(2)} each`;
    case 'estimate_pct': return `Estimate × ${rule.percent}%`;
    case 'blank': return 'Priced per row';
    default: return 'DCM estimate';
  }
}

/** The shipping half of the summary: policy names, or the inline terms. */
function describeShipping(settings: BulkBatchSettings): string {
  if (settings.policies.useBusinessPolicies) {
    return `Policy: ${settings.policies.shippingPolicyName ?? 'eBay business policies'}`;
  }
  const ship = settings.shipping;
  const how =
    ship.shippingType === 'FREE'
      ? 'Free shipping'
      : ship.shippingType === 'FLAT_RATE'
        ? `Flat $${Number(ship.flatRateAmount).toFixed(2)}`
        : 'Calculated shipping';
  return ship.postalCode ? `${how} from ${ship.postalCode}` : how;
}

interface ProgressCounts {
  total: number;
  live: number;
  failed: number;
  blocked: number;
  skipped: number;
  inFlight: number;
  settled: number;
  retryable: number;
}

/** "Retry 3 cards" when something failed; "Re-check 3 skipped" when not. */
function retryLabel(counts: ProgressCounts): string {
  const n = counts.retryable;
  const noun = `card${n === 1 ? '' : 's'}`;
  return counts.failed + counts.blocked > 0
    ? `Retry ${n} ${noun}`
    : `Re-check ${n} skipped ${noun}`;
}

/** Pause / Resume / Cancel. Cancel confirms inline — never a window.confirm. */
function BatchControls({
  status,
  busy,
  confirmCancel,
  onConfirmCancel,
  onAction,
}: {
  status: string;
  busy: string | null;
  confirmCancel: boolean;
  onConfirmCancel: (v: boolean) => void;
  onAction: (action: 'pause' | 'resume' | 'cancel') => void;
}) {
  const finished = status === 'complete' || status === 'failed' || status === 'cancelled';
  if (finished) {
    return (
      <Link
        href="/instalist-marketplace"
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
      >
        Back to InstaList
      </Link>
    );
  }

  if (confirmCancel) {
    return (
      <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <span className="text-sm text-red-800">
          Cancel the rest? Cards already listed stay on eBay.
        </span>
        <button
          onClick={() => onAction('cancel')}
          disabled={busy === 'cancel'}
          className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
        </button>
        <button
          onClick={() => onConfirmCancel(false)}
          className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900"
        >
          Keep going
        </button>
      </div>
    );
  }

  return (
    <>
      {status === 'running' ? (
        <button
          onClick={() => onAction('pause')}
          disabled={busy !== null}
          className="px-4 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          {busy === 'pause' ? 'Pausing…' : 'Pause'}
        </button>
      ) : (
        <button
          onClick={() => onAction('resume')}
          disabled={busy !== null}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy === 'resume' ? 'Resuming…' : 'Resume'}
        </button>
      )}
      <button
        onClick={() => onConfirmCancel(true)}
        disabled={busy !== null}
        className="px-4 py-2 text-gray-600 hover:text-red-700 font-semibold disabled:opacity-50"
      >
        Cancel
      </button>
    </>
  );
}

/**
 * The bar, the counts, the paused banner and the done summary.
 *
 * The paused banner is the important half: a pause is never "something went
 * wrong, start over", it is one named condition with one action, and the
 * batch resumes from exactly where it stopped.
 */
function BatchProgress({
  batch,
  counts,
  token,
  settings,
  onRetryAll,
  retryingAll,
}: {
  batch: BulkBatch;
  counts: ProgressCounts;
  token: string | null;
  settings: BulkBatchSettings | null;
  onRetryAll: () => void;
  retryingAll: boolean;
}) {
  const [reconnecting, setReconnecting] = useState(false);
  const pct = counts.total > 0 ? Math.round((counts.settled / counts.total) * 100) : 0;
  const finished = batch.status === 'complete' || batch.status === 'failed' || batch.status === 'cancelled';
  const reason = batch.status === 'paused' ? batch.last_error ?? '' : '';
  const needsAttention = counts.retryable;

  const reconnect = async () => {
    if (!token) return;
    setReconnecting(true);
    try {
      const res = await fetch('/api/ebay/auth?return_url=/ebay-auth-success', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      const authUrl = json.authUrl || json.url;
      if (authUrl) window.open(authUrl, 'ebay-oauth', 'width=600,height=750');
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-sm text-gray-700">
            {finished
              ? `${counts.live} of ${counts.total} listed`
              : `${counts.settled} of ${counts.total} done`}
          </p>
          <p className="text-xs text-gray-500">
            {batch.status === 'running'
              ? 'You can close this tab — listing carries on without it.'
              : BATCH_HEADINGS[batch.status] ?? ''}
          </p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              batch.status === 'failed' ? 'bg-red-500' : 'bg-indigo-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
          <span className="text-emerald-700 font-semibold">{counts.live} live</span>
          {counts.inFlight > 0 && <span>{counts.inFlight} to go</span>}
          {counts.failed > 0 && <span className="text-red-700">{counts.failed} failed</span>}
          {counts.blocked > 0 && <span className="text-amber-700">{counts.blocked} held</span>}
          {counts.skipped > 0 && <span>{counts.skipped} skipped</span>}
        </div>
        {/* The panel is gone once a batch runs, and "what did I actually send?"
            is the first question a finished run raises. */}
        {settings && (
          <p className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            {describeListingFormat(settings)} &middot; {describePriceRule(settings.priceRule)}
            {' '}&middot; {describeShipping(settings)}
          </p>
        )}
      </div>

      {/* ------------------------------------------- paused banners -- */}
      {reason === 'disclaimer_required' && (
        <Banner tone="amber" title="Accept the seller terms to carry on">
          <p>{PAUSE_REASONS.disclaimer_required}</p>
          <p className="mt-2">
            <Link href="/instalist-marketplace" className="font-semibold underline">
              Open a single card listing
            </Link>{' '}
            to read and accept the InstaList seller terms, then press Resume here.
          </p>
        </Banner>
      )}

      {reason === 'ebay_reconnect' && (
        <Banner tone="amber" title="Reconnect your eBay account">
          <p>{PAUSE_REASONS.ebay_reconnect}</p>
          <button
            onClick={reconnect}
            disabled={reconnecting || !token}
            className="mt-2 px-3 py-1.5 bg-amber-700 text-white rounded-md text-sm font-semibold hover:bg-amber-800 disabled:opacity-50"
          >
            {reconnecting ? 'Opening eBay…' : 'Reconnect eBay'}
          </button>
        </Banner>
      )}

      {reason === 'listing_limit' && (
        <Banner tone="amber" title="You have reached your eBay listing allowance">
          <p>{PAUSE_REASONS.listing_limit}</p>
        </Banner>
      )}

      {reason === 'paused_by_seller' && (
        <Banner tone="gray" title="Paused">
          <p>Nothing was lost. Press Resume and the remaining cards carry on from here.</p>
        </Banner>
      )}

      {/* ---------------------------------------------- done summary -- */}
      {finished && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-800">
            <strong>{counts.live}</strong> card{counts.live === 1 ? '' : 's'} listed on eBay
            {counts.failed > 0 && <> &middot; <strong>{counts.failed}</strong> failed</>}
            {counts.blocked > 0 && <> &middot; <strong>{counts.blocked}</strong> held</>}
            {counts.skipped > 0 && <> &middot; <strong>{counts.skipped}</strong> already listed</>}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Link
              href="/instalist-marketplace"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              See your live listings
            </Link>
            {needsAttention > 0 && (
              <button
                onClick={onRetryAll}
                disabled={retryingAll}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {retryingAll ? 'Retrying…' : retryLabel(counts)}
              </button>
            )}
          </div>
        </div>
      )}

      {!finished && needsAttention > 0 && (
        <div className="flex justify-end">
          <button
            onClick={onRetryAll}
            disabled={retryingAll}
            className="px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
          >
            {retryingAll ? 'Retrying…' : retryLabel(counts)}
          </button>
        </div>
      )}
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: 'amber' | 'gray';
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm ${styles}`}>
      <p className="font-semibold mb-1">{title}</p>
      {children}
    </div>
  );
}

/** One read-only row: what happened to this card, and what to do about it. */
function ProgressRow({
  item,
  card,
  listing,
  onRetry,
  onEdit,
}: {
  item: BulkItem;
  card: MarketplaceCard | undefined;
  listing: BulkListingRef | undefined;
  onRetry: () => Promise<string | null>;
  onEdit: (tab: DrawerTab) => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const thumbnail = item.image_urls?.[0] ?? card?.front_url ?? null;
  const canRetry = RETRYABLE_STATUSES.has(item.status);

  return (
    <li className="px-4 py-3 md:grid md:grid-cols-[4rem_1fr_8rem_12rem] md:gap-3 md:items-start">
      <div className="hidden md:block">
        <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-sm text-gray-900 break-words">{item.title ?? card?.card_name ?? 'Card'}</p>
        {listing?.listing_url && (
          <a
            href={listing.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            View on eBay{listing.listing_id ? ` (item ${listing.listing_id})` : ''}
          </a>
        )}
      </div>

      <div className="mt-1 md:mt-0 text-sm text-gray-700">
        {item.price == null ? '—' : `$${Number(item.price).toFixed(2)}`}
      </div>

      <div className="mt-2 md:mt-0">
        <StatusPill item={item} />
        {item.error_message && (item.status === 'failed' || item.status === 'blocked' || item.status === 'skipped') && (
          <p className="text-xs text-gray-600 mt-1 break-words">{item.error_message}</p>
        )}
        {canRetry && (
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              onClick={async () => {
                setRetrying(true);
                setRetryError(null);
                try {
                  setRetryError(await onRetry());
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {retrying ? 'Retrying…' : item.status === 'skipped' ? 'Re-check' : 'Retry'}
            </button>
            {/* The drain's advice is "fix it and retry", so the fixing has to
                be reachable from the row it failed on. */}
            <button
              onClick={() => onEdit('details')}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              Edit
            </button>
          </div>
        )}
        {retryError && <p className="text-xs text-red-600 mt-1">{retryError}</p>}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Header checkbox for the review list. Acts on the rows CURRENTLY VISIBLE, so
 * "select all" under a filter means the filtered set — which is what it looks
 * like — and never silently reaches rows the reviewer cannot see.
 */
function SelectAllCheckbox({
  rows,
  selectedRows,
  onChange,
}: {
  rows: BulkItem[];
  selectedRows: string[];
  onChange: (ids: string[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const chosen = rows.filter(r => selectedRows.includes(r.id)).length;
  const all = rows.length > 0 && chosen === rows.length;
  // `indeterminate` is a DOM property, not an attribute — React cannot set it.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = chosen > 0 && !all;
  }, [chosen, all]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      disabled={rows.length === 0}
      onChange={() => {
        const visible = rows.map(r => r.id);
        onChange(
          all
            ? selectedRows.filter(id => !visible.includes(id))
            : Array.from(new Set([...selectedRows, ...visible]))
        );
      }}
      aria-label="Select every row in this view"
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
    />
  );
}

function BulkRow({
  item,
  card,
  selected,
  onToggle,
  onPatch,
  onRegenerate,
  onRemove,
  onRecheck,
  onRetryPhotos,
  onOpenDrawer,
}: {
  item: BulkItem;
  card: MarketplaceCard | undefined;
  selected: boolean;
  onToggle: () => void;
  onPatch: (itemId: string, patch: Record<string, unknown>) => Promise<BulkItem | null>;
  onRegenerate: () => void;
  onRemove: () => void;
  onRecheck: () => Promise<void>;
  onRetryPhotos: () => Promise<void>;
  onOpenDrawer: (tab: DrawerTab) => void;
}) {
  const [title, setTitle] = useState(item.title ?? '');
  const [price, setPrice] = useState(item.price == null ? '' : String(item.price));
  const [rowError, setRowError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [retryingPhotos, setRetryingPhotos] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  useEffect(() => { setTitle(item.title ?? ''); }, [item.title]);
  useEffect(() => { setPrice(item.price == null ? '' : String(item.price)); }, [item.price]);

  const tally = specificsTally(item.item_specifics);
  const estimate = card ? resolveCardValue(card) : null;
  const median = card?.ebay_price_median ?? null;
  const photos = item.image_urls?.length ?? 0;
  const thumbnail = item.image_urls?.[0] ?? card?.front_url ?? null;
  const isSkipped = item.status === 'skipped';
  // Regenerating throws away hand-written copy, so a row that carries any asks
  // first. An untouched row has nothing to lose and regenerates on one click.
  const edited = item.title_edited || item.description_edited;

  const commit = async (patch: Record<string, unknown>) => {
    setRowError(null);
    try {
      await onPatch(item.id, patch);
    } catch (err: any) {
      setRowError(err?.message ?? 'Could not save that change.');
    }
  };

  return (
    <li
      className={`px-4 py-3 md:grid md:grid-cols-[2rem_4rem_1fr_9rem_12rem_6rem] md:gap-3 md:items-start ${
        isSkipped ? 'opacity-60' : ''
      } ${selected ? 'bg-indigo-50' : ''}`}
    >
      <div className="flex items-center gap-3 md:block md:pt-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label="Select row"
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="md:hidden text-sm font-semibold text-gray-900 truncate">
          {card?.card_name ?? 'Card'}
        </span>
      </div>

      <div className="hidden md:block">
        <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {card?.conversational_whole_grade != null && (
            <span className="inline-flex w-fit px-1.5 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">
              {card.conversational_whole_grade}
            </span>
          )}
          <span className="text-[11px] text-gray-500 truncate">{card?.category}</span>
        </div>
      </div>

      <div className="mt-2 md:mt-0">
        <div className="flex items-start gap-2">
          <textarea
            value={title}
            rows={2}
            onChange={e => setTitle(e.target.value.slice(0, EBAY_TITLE_MAX))}
            onBlur={() => { if (title !== (item.title ?? '')) commit({ title }); }}
            disabled={isSkipped}
            className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          />
          <button
            onClick={() => (edited ? setConfirmRegenerate(true) : onRegenerate())}
            disabled={isSkipped}
            title="Regenerate title and description"
            aria-label="Regenerate"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-gray-400 hover:text-indigo-600 disabled:opacity-40"
          >
            &#8635;
          </button>
        </div>
        {confirmRegenerate && (
          <div className="mt-1 flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            <span className="text-[11px] text-amber-900">
              This replaces your edited title/description. Regenerate?
            </span>
            <button
              onClick={() => { setConfirmRegenerate(false); onRegenerate(); }}
              className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] font-semibold hover:bg-amber-700"
            >
              Regenerate
            </button>
            <button
              onClick={() => setConfirmRegenerate(false)}
              className="text-[11px] text-gray-600 hover:text-gray-900"
            >
              Keep mine
            </button>
          </div>
        )}
        <p className={`text-[11px] mt-0.5 ${title.length > EBAY_TITLE_MAX ? 'text-red-600' : 'text-gray-500'}`}>
          {title.length}/{EBAY_TITLE_MAX}
          {item.title_edited && <span className="ml-2 text-indigo-600">edited</span>}
        </p>
      </div>

      <div className="mt-2 md:mt-0">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={() => {
              const next = price === '' ? null : Number(price);
              const current = item.price == null ? null : Number(item.price);
              if (next !== current) commit({ price: next });
            }}
            disabled={isSkipped}
            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {estimate && estimate.value > 0 ? `DCM $${estimate.value.toFixed(2)}` : 'No estimate'}
          {median ? ` · eBay $${median.toFixed(2)}` : ''}
        </p>
      </div>

      {/* 40px minimum on every one of these: they sit inches apart in a
          100-row list and half of them are read on a phone. */}
      <div className="mt-2 md:mt-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {isSkipped && (
          <button
            onClick={async () => {
              setRechecking(true);
              try { await onRecheck(); } finally { setRechecking(false); }
            }}
            disabled={rechecking}
            className={`${rowActionClass} text-indigo-600 hover:text-indigo-800 disabled:opacity-50`}
          >
            {rechecking ? 'Checking…' : 'Re-check'}
          </button>
        )}
        <button
          onClick={() => onOpenDrawer('description')}
          className={`${rowActionClass} text-indigo-600 hover:text-indigo-800`}
        >
          Preview description
        </button>
        <button
          onClick={() => onOpenDrawer('specifics')}
          className={`${rowActionClass} text-indigo-600 hover:text-indigo-800`}
        >
          {tally.requiredFilled}/{tally.requiredTotal} required
          {tally.recommendedTotal > 0 && ` · ${tally.recommendedFilled}/${tally.recommendedTotal} rec.`}
        </button>
        <button
          onClick={() => onOpenDrawer('images')}
          className={`${rowActionClass} text-indigo-600 hover:text-indigo-800`}
        >
          {photos} photo{photos === 1 ? '' : 's'}
        </button>
        {item.image_status === 'failed' && !isSkipped && (
          <button
            onClick={async () => {
              setRetryingPhotos(true);
              try { await onRetryPhotos(); } finally { setRetryingPhotos(false); }
            }}
            disabled={retryingPhotos}
            className={`${rowActionClass} text-amber-700 hover:text-amber-900 disabled:opacity-50`}
          >
            {retryingPhotos ? 'Retrying…' : 'Retry photos'}
          </button>
        )}
        {/* Remove is destructive, so it does not sit in the same run of blue
            links as the four that just open a drawer. */}
        <button
          onClick={onRemove}
          className={`${rowActionClass} ml-auto pl-3 border-l border-gray-200 text-gray-400 hover:text-red-600`}
        >
          Remove
        </button>
        {/* Every blocker, not just the first — the pill has room for one, and
            "fix this row" needs the whole list. */}
        {!isSkipped && (item.readiness?.length ?? 0) > 0 && (
          <span className="w-full text-amber-700">
            {item.readiness!.map(r => r.label).join(' · ')}
          </span>
        )}
        {rowError && <span className="w-full text-red-600">{rowError}</span>}
      </div>

      <div className="mt-2 md:mt-0">
        <StatusPill item={item} />
      </div>
    </li>
  );
}

function StatusPill({ item }: { item: BulkItem }) {
  const base = 'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold';
  if (item.status === 'skipped') {
    return (
      <span className={`${base} bg-gray-100 text-gray-600`} title={item.error_message ?? ''}>
        Already listed
      </span>
    );
  }
  if (item.status === 'ready') {
    return <span className={`${base} bg-emerald-100 text-emerald-800`}>Ready</span>;
  }
  if (item.status === 'queued') {
    return <span className={`${base} bg-indigo-50 text-indigo-700`}>Queued</span>;
  }
  if (item.status === 'uploading' || item.status === 'publishing') {
    return <span className={`${base} bg-indigo-100 text-indigo-800`}>Publishing…</span>;
  }
  if (item.status === 'live') {
    return <span className={`${base} bg-emerald-600 text-white`}>Live</span>;
  }
  // "Held" rather than "Blocked": nothing about the card is wrong, the account
  // simply ran out of listing allowance, and the row is intact.
  if (item.status === 'blocked') {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`} title={item.error_message ?? ''}>
        Held
      </span>
    );
  }
  if (item.status === 'failed') {
    return (
      <span className={`${base} bg-red-100 text-red-700`} title={item.error_message ?? ''}>
        Failed
      </span>
    );
  }
  const first = item.readiness?.[0];
  return (
    <span className={`${base} bg-amber-100 text-amber-800`} title={item.readiness?.map(r => r.label).join(' · ')}>
      {first?.label ?? 'Draft'}
    </span>
  );
}
