'use client';

/**
 * Per-row editor drawer: description, item specifics, photos.
 *
 * One drawer, three tabs, because all three are "open this row and fix it"
 * and a reviewer moving down a 100-card list should not learn three
 * different panels.
 *
 * The description preview renders through sanitizeListingHtml — this is the
 * one place in the flow where seller-authored HTML is put into the DOM.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeListingHtml } from '@/lib/ebay/listingDescription';
import { EBAY_TITLE_MAX } from '@/lib/ebay/bulkReadiness';
import type { BulkItem, BulkItemSpecific } from '../types';
import type { MarketplaceCard } from '../../types';

export type DrawerTab = 'details' | 'description' | 'specifics' | 'images';

/** 40px tap targets on the photo reorder / remove controls. */
const photoButtonClass = 'w-10 h-10 inline-flex items-center justify-center';

interface Props {
  item: BulkItem;
  card: MarketplaceCard | undefined;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onRegenerate: () => Promise<void>;
  saving: boolean;
  error: string | null;
  /**
   * 'review' is the draft editor, where title and price are edited inline on
   * the row. 'repair' is the progress view opening a failed / held / skipped
   * row after a run: the row is no longer in the table's editable form, so the
   * drawer grows a Details tab for title and price — and the photo set becomes
   * read-only, because re-rendering slab art belongs to the review step and
   * the drain publishes whatever URLs the row already carries.
   */
  mode?: 'review' | 'repair';
  /** Auction batches call the price what it is: the opening bid. */
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  /**
   * Repair mode on a failed row: save the edits and send the card to eBay
   * again in one press. Saving and then hunting for the row's own Retry is two
   * steps for what is always the same intent.
   */
  onSaveAndRetry?: (patch: Record<string, unknown>) => Promise<void>;
}

const REVIEW_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'specifics', label: 'Item specifics' },
  { id: 'images', label: 'Photos' },
];

const REPAIR_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'details', label: 'Title & price' },
  ...REVIEW_TABS,
];

export default function BulkItemDrawer({
  item,
  card,
  tab,
  onTabChange,
  onClose,
  onPatch,
  onRegenerate,
  saving,
  error,
  mode = 'review',
  listingFormat = 'FIXED_PRICE',
  onSaveAndRetry,
}: Props) {
  const repair = mode === 'repair';
  const tabs = repair ? REPAIR_TABS : REVIEW_TABS;

  const [html, setHtml] = useState(item.description_html ?? '');
  const [showCode, setShowCode] = useState(false);
  const [specifics, setSpecifics] = useState<BulkItemSpecific[]>(item.item_specifics ?? []);
  const [urls, setUrls] = useState<string[]>(item.image_urls ?? []);
  const [title, setTitle] = useState(item.title ?? '');
  const [price, setPrice] = useState(item.price == null ? '' : String(item.price));

  // Re-seed local state when the drawer is pointed at a different row, or the
  // row itself changed on the server (a regenerate, a photo pass finishing).
  // Keyed on updated_at rather than the field values: the 3 s poll while a
  // batch is running hands us freshly parsed arrays every tick, and keying on
  // their identity wiped a seller's in-progress repair edits mid-typing.
  useEffect(() => {
    setHtml(item.description_html ?? '');
    setSpecifics(item.item_specifics ?? []);
    setUrls(item.image_urls ?? []);
    setTitle(item.title ?? '');
    setPrice(item.price == null ? '' : String(item.price));
  }, [item.id, item.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeHtml = useMemo(() => sanitizeListingHtml(html), [html]);

  // Unsaved work, across every tab. It is what the discard guard asks about,
  // and what decides whether Esc and a backdrop click close straight away.
  const dirty =
    html !== (item.description_html ?? '') ||
    title !== (item.title ?? '') ||
    price !== (item.price == null ? '' : String(item.price)) ||
    JSON.stringify(specifics) !== JSON.stringify(item.item_specifics ?? []) ||
    JSON.stringify(urls) !== JSON.stringify(item.image_urls ?? []);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus lands inside the drawer on mount: a panel that opens behind the
  // keyboard's focus is invisible to anyone not using a mouse.
  useEffect(() => { closeRef.current?.focus(); }, []);

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  // Esc closes, or asks first when there is something to lose. Bound on the
  // document because focus can be anywhere inside the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dirty) setConfirmDiscard(true);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dirty, onClose]);

  /** The patch the current tab saves. */
  const patchForTab = (): Record<string, unknown> => {
    if (tab === 'details') {
      return { title: title.trim(), price: price === '' ? null : Number(price) };
    }
    if (tab === 'description') return { description_html: html };
    if (tab === 'specifics') return { item_specifics: specifics };
    return { image_urls: urls };
  };

  // `failed` is the only status where saving alone leaves the card no better
  // off than it was, so that is the only place the retry button appears.
  const canSaveAndRetry = repair && item.status === 'failed' && !!onSaveAndRetry;

  const moveUrl = (index: number, delta: number) => {
    const next = [...urls];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setUrls(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Edit this card"
      // Backdrop only: a drag that started inside the panel must not close it.
      onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div className="w-full sm:max-w-2xl bg-white h-full flex flex-col shadow-xl">
        <header className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {card?.card_name ?? 'Card'}
            </p>
            <p className="text-xs text-gray-500 truncate">{item.title}</p>
          </div>
          <button
            ref={closeRef}
            onClick={requestClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            &times;
          </button>
        </header>

        <nav className="flex gap-4 px-4 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`py-2.5 text-sm font-medium border-b-2 ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="m-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'details' && (
            <div className="space-y-4">
              {item.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
                  <p className="font-semibold mb-0.5">eBay said</p>
                  <p>{item.error_message}</p>
                </div>
              )}
              <div>
                <label htmlFor="repair-title" className="block text-xs font-semibold text-gray-600 mb-1">
                  Title
                </label>
                <textarea
                  id="repair-title"
                  value={title}
                  rows={3}
                  onChange={e => setTitle(e.target.value.slice(0, EBAY_TITLE_MAX))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className={`text-xs mt-0.5 ${title.length > EBAY_TITLE_MAX ? 'text-red-600' : 'text-gray-500'}`}>
                  {title.length}/{EBAY_TITLE_MAX}
                </p>
              </div>
              <div>
                <label htmlFor="repair-price" className="block text-xs font-semibold text-gray-600 mb-1">
                  {listingFormat === 'AUCTION' ? 'Starting price' : 'Price'}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    id="repair-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-32 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {(item.readiness?.length ?? 0) > 0 && (
                <p className="text-xs text-amber-700">
                  Still needed: {item.readiness!.map(r => r.label).join(', ')}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Save your changes here, then press Retry on the row to send this card to eBay again.
              </p>
            </div>
          )}

          {tab === 'description' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowCode(c => !c)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {showCode ? 'Show preview' : 'Edit HTML'}
                </button>
                <button
                  onClick={onRegenerate}
                  disabled={saving}
                  className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  Reset to generated
                </button>
              </div>
              {showCode ? (
                <textarea
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[52vh] px-3 py-2 font-mono text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <div
                  className="border border-gray-200 rounded-lg p-3 overflow-x-auto"
                  // Sanitized above; eBay strips active content itself, this
                  // guards our own preview.
                  dangerouslySetInnerHTML={{ __html: safeHtml }}
                />
              )}
              <p className="text-xs text-gray-500">
                Links and web addresses are removed automatically — eBay&rsquo;s listing policy
                forbids them, even non-clickable ones.
              </p>
            </div>
          )}

          {tab === 'specifics' && (
            <div className="space-y-2">
              {specifics.length === 0 && (
                <p className="text-sm text-gray-500">No item specifics on this row yet.</p>
              )}
              {specifics.map((spec, index) => {
                // eBay's MULTI-cardinality aspects (Player/Athlete, Features,
                // Character…) arrive as arrays and must go back as arrays —
                // flattening one to "Ken Griffey Jr., Barry Bonds" makes it a
                // single nonsense value in eBay's filters. The field is edited
                // as a comma-separated line and re-split on the way out.
                const isMulti = Array.isArray(spec.value);
                return (
                  <div key={`${spec.name}-${index}`} className="flex items-center gap-2">
                    <span className="w-2/5 text-xs text-gray-600 truncate">
                      {spec.name}
                      {spec.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                    <input
                      type="text"
                      value={isMulti ? (spec.value as string[]).join(', ') : (spec.value as string)}
                      onChange={e => {
                        const raw = e.target.value;
                        const next = [...specifics];
                        next[index] = {
                          ...spec,
                          value: isMulti
                            ? raw.split(',').map(v => v.trim()).filter(Boolean)
                            : raw,
                        };
                        setSpecifics(next);
                      }}
                      className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                );
              })}
              <p className="text-xs text-gray-500 pt-1">
                * required by eBay for this category. Leave a field blank rather than typing
                &ldquo;N/A&rdquo; — eBay treats a filled-in placeholder as answered. Fields that
                accept several values are comma-separated.
              </p>
            </div>
          )}

          {tab === 'images' && (
            <div className="space-y-3">
              {item.image_status !== 'ready' && (
                <p className="text-sm text-gray-500">
                  {item.image_status === 'failed'
                    ? 'Photos failed to prepare for this card. Use "Retry photos" on the row.'
                    : 'Photos are still being prepared…'}
                </p>
              )}
              {urls.length === 0 && item.image_status === 'ready' && (
                <p className="text-sm text-gray-500">No photos selected — this row cannot publish.</p>
              )}
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {urls.map((url, index) => (
                  <li key={url} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${index + 1}`} className="w-full h-24 object-cover" />
                    <div className="flex items-center justify-between px-1 py-1 text-xs">
                      <span className="text-gray-500">{index === 0 ? 'Main' : index + 1}</span>
                      {!repair && (
                        <span className="flex gap-1">
                          <button onClick={() => moveUrl(index, -1)} className={`${photoButtonClass} text-gray-500 hover:text-gray-900`} aria-label="Move earlier">&uarr;</button>
                          <button onClick={() => moveUrl(index, 1)} className={`${photoButtonClass} text-gray-500 hover:text-gray-900`} aria-label="Move later">&darr;</button>
                          <button
                            onClick={() => setUrls(urls.filter((_, i) => i !== index))}
                            className={`${photoButtonClass} text-red-500 hover:text-red-700`}
                            aria-label="Remove"
                          >
                            &times;
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">
                {repair
                  ? 'The first photo is the one eBay shows in search results. Photos are fixed once a batch has run — start a new batch to change them.'
                  : 'The first photo is the one eBay shows in search results.'}
              </p>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-gray-200 space-y-2">
          {confirmDiscard && (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-xs text-amber-900">Discard changes?</span>
              <button
                onClick={onClose}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-md text-xs font-semibold hover:bg-amber-700"
              >
                Discard
              </button>
              <button
                onClick={() => setConfirmDiscard(false)}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Keep editing
              </button>
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button onClick={requestClose} className="text-sm text-gray-600 hover:text-gray-900">
              Discard
            </button>
            {/* Photos are read-only after a run, so there is nothing to save. */}
            {!(repair && tab === 'images') && (
              <button
                onClick={() =>
                  canSaveAndRetry ? onSaveAndRetry!(patchForTab()) : onPatch(patchForTab())
                }
                disabled={saving || (tab === 'details' && title.trim().length === 0)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : canSaveAndRetry ? 'Save and retry' : 'Save'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
