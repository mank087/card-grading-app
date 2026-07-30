'use client';

import React from 'react';
import type { BinderSummary } from './BinderStrip';

/**
 * Bottom sheet for a single card, opened by long-press (or the ⋯ button) on
 * touch devices.
 *
 * Why this exists: dragging a card across a scrolling grid on a phone is
 * genuinely awkward — the binder chips are small, often scrolled out of view,
 * and the drag fights the page scroll. Explicit actions are both easier to hit
 * and more precise than dragging, so touch gets this instead of the desktop
 * drag: tap to file into a binder, and step the card through the order with
 * top/up/down/bottom rather than aiming a drop.
 *
 * Reorder actions map onto the same "put this after that card" API the drag
 * uses, so there's one ordering path on the server, not two.
 */

export interface CardActionSheetProps {
  cardName: string;
  /** Binders this card can be filed into (manual only — smart ones fill themselves). */
  binders: BinderSummary[];
  /** Binder ids this card already belongs to. */
  memberOf: Set<string>;
  /** Set when viewing inside a manual binder — enables the reorder block. */
  currentBinder: { id: string; name: string } | null;
  /** Position of this card in the current binder, and how many there are. */
  index: number;
  total: number;
  busy: boolean;
  onToggleBinder: (binderId: string) => void;
  onCreateBinder: () => void;
  onMove: (to: 'top' | 'up' | 'down' | 'bottom') => void;
  onRemoveFromBinder: () => void;
  onClose: () => void;
}

export function CardActionSheet({
  cardName,
  binders,
  memberOf,
  currentBinder,
  index,
  total,
  busy,
  onToggleBinder,
  onCreateBinder,
  onMove,
  onRemoveFromBinder,
  onClose,
}: CardActionSheetProps) {
  const atTop = index <= 0;
  const atBottom = index >= total - 1;

  const moveBtn = (
    to: 'top' | 'up' | 'down' | 'bottom',
    label: string,
    disabled: boolean
  ) => (
    <button
      onClick={() => onMove(to)}
      disabled={disabled || busy}
      className="flex-1 px-2 py-3 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100"
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar — signals "this is a sheet you can dismiss" on touch */}
        <div className="sm:hidden w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

        <h2 className="font-bold text-gray-900 truncate">{cardName}</h2>

        {/* ---- Reorder, only inside a manual binder ---- */}
        {currentBinder && total > 1 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4">
              Position in {currentBinder.name} · {index + 1} of {total}
            </p>
            <div className="flex gap-2 mt-2">
              {moveBtn('top', '⤒ Top', atTop)}
              {moveBtn('up', '↑ Up', atTop)}
              {moveBtn('down', '↓ Down', atBottom)}
              {moveBtn('bottom', '⤓ Bottom', atBottom)}
            </div>
          </>
        )}

        {/* ---- Binder membership ---- */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5">
          Binders
        </p>
        <div className="mt-2 space-y-2">
          {binders.map(b => {
            const inIt = memberOf.has(b.id);
            return (
              <button
                key={b.id}
                onClick={() => onToggleBinder(b.id)}
                disabled={busy}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors disabled:opacity-50 ${
                  inIt ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: b.accent_color || '#a78bfa' }}
                />
                <span className="font-semibold text-gray-900 truncate">{b.name}</span>
                <span className="ml-auto text-sm shrink-0">
                  {inIt ? <span className="text-purple-700 font-bold">✓ In</span>
                        : <span className="text-gray-400">Add</span>}
                </span>
              </button>
            );
          })}

          <button
            onClick={onCreateBinder}
            disabled={busy}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            ＋ New binder with this card
          </button>
        </div>

        {currentBinder && (
          <button
            onClick={onRemoveFromBinder}
            disabled={busy}
            className="w-full mt-3 px-4 py-3 rounded-lg bg-red-50 text-red-700 font-semibold hover:bg-red-100 disabled:opacity-50"
          >
            Remove from {currentBinder.name}
            <span className="block text-xs font-normal text-red-600">
              Keeps the card in your collection
            </span>
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-3 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default CardActionSheet;
