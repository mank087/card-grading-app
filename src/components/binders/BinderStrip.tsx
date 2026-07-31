'use client';

import React from 'react';
import { BinderDropTarget } from './SortableCardGrid';

/**
 * Horizontally scrollable binder selector, sitting above the collection's
 * existing controls.
 *
 * Selecting a binder scopes everything below it — the ownership tabs, search,
 * sort and category filters keep working inside that scope. "All Cards" is the
 * default and behaves exactly as the page always has, so nothing changes for
 * users who never make a binder.
 *
 * A strip rather than a separate /binders page: one collection surface means
 * binders inherit the search, sort and bulk-select machinery instead of
 * duplicating all of it.
 */

export interface BinderSummary {
  id: string;
  name: string;
  accent_color: string | null;
  card_count: number;
  smart_filter: unknown | null;
  system_key: string | null;
}

export function BinderStrip({
  binders,
  selectedId,
  ownershipView,
  ownedCount,
  soldCount,
  onSelect,
  onSelectSold,
  onCreate,
  onManage,
}: {
  binders: BinderSummary[];
  selectedId: string | null;
  /** Sold is a scope chip here, not a separate tab row. */
  ownershipView: 'owned' | 'sold';
  ownedCount: number;
  soldCount: number;
  onSelect: (id: string | null) => void;
  onSelectSold: () => void;
  onCreate: () => void;
  onManage: (binder: BinderSummary) => void;
}) {
  const chip = (active: boolean) =>
    `shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
      active
        ? 'bg-purple-600 border-purple-600 text-white'
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {/* Scope: everything, sold, then binders. Sold used to be its own tab
            row with its own hint line — but it's already a smart binder
            internally, so expressing it as a chip here removes two full-width
            rows and makes the model one idea instead of two. */}
        <button
          className={chip(selectedId === null && ownershipView === 'owned')}
          onClick={() => onSelect(null)}
        >
          All Cards
          <span className={`text-xs ${selectedId === null && ownershipView === 'owned' ? 'text-purple-100' : 'text-gray-400'}`}>
            {ownedCount}
          </span>
        </button>

        {soldCount > 0 && (
          <button
            className={`${chip(ownershipView === 'sold')} ${
              ownershipView === 'sold' ? '!bg-emerald-600 !border-emerald-600' : ''
            }`}
            onClick={onSelectSold}
            title="Cards you've sold — still verifiable by the buyer"
          >
            Sold
            <span className={`text-xs ${ownershipView === 'sold' ? 'text-emerald-100' : 'text-gray-400'}`}>
              {soldCount}
            </span>
          </button>
        )}

        {binders.map(b => {
          const active = selectedId === b.id;
          // Smart binders fill themselves — nothing can be dropped into them.
          const canDrop = !b.smart_filter;
          return (
            <BinderDropTarget key={b.id} binderId={b.id} disabled={!canDrop}>
              {(isOver) => (
                <button
                  className={`${chip(active)} ${
                    isOver ? 'ring-4 ring-purple-400 ring-offset-1 scale-105 bg-purple-50 border-purple-400 text-purple-900' : ''
                  }`}
                  onClick={() => onSelect(b.id)}
                  onDoubleClick={() => onManage(b)}
                  title={b.smart_filter ? 'Fills itself from a filter' : 'Drop cards here to add them'}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: b.accent_color || (active && !isOver ? '#fff' : '#a78bfa') }}
                  />
                  <span className="whitespace-nowrap">{b.name}</span>
                  {b.smart_filter ? <span className="text-xs opacity-70">auto</span> : null}
                  <span className={`text-xs ${active && !isOver ? 'text-purple-100' : 'text-gray-400'}`}>
                    {isOver ? 'drop' : b.card_count}
                  </span>
                </button>
              )}
            </BinderDropTarget>
          );
        })}

        {/* Its own drop target: otherwise a card dropped here falls through to
            whichever real binder is nearest and gets filed somewhere the user
            never picked. Dropping opens the create dialog instead. */}
        <BinderDropTarget binderId="__new__">
          {(isOver) => (
            <button
              className={`shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full border border-dashed text-sm font-semibold transition-all ${
                isOver
                  ? 'border-purple-500 border-solid bg-purple-50 text-purple-800 ring-4 ring-purple-300 scale-105'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={onCreate}
            >
              ＋ {isOver ? 'Drop to create a binder' : 'New binder'}
            </button>
          )}
        </BinderDropTarget>
      </div>

      {/* Empty state: a bare "+ New binder" chip on its own reads as broken, so
          say what a binder is for exactly once. */}
      {/* The "drag a card onto a binder" hint used to live here permanently.
          It's a one-time teach, not a fixture — it now only shows while the
          user has no binders at all, and disappears the moment they make one. */}
      {binders.length === 0 && (
        <p className="text-sm text-gray-500 mt-1">
          Binders group cards however you like — by set, by player, by what&apos;s for
          sale. Make one, then drag cards onto it.
        </p>
      )}
    </div>
  );
}

export default BinderStrip;
