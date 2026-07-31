'use client';

import React from 'react';

/**
 * Filter panel for the collection.
 *
 * Category, sub-sport, sort and ownership each used to occupy their own
 * permanent full-width row — together with the binder strip and search that was
 * 5-8 stacked rows and 479px of chrome before the first card (56% of the
 * viewport on a 2560px monitor; worse on a phone, where the 8 category chips
 * wrap to two lines).
 *
 * They move in here, behind one button. The page keeps only what's ACTIVE, as
 * removable chips — state stays visible, the controls don't.
 *
 * Ownership lives here rather than only on the strip so "sold cards inside a
 * binder" stays reachable; the strip's Sold chip is the fast path for the
 * common case of browsing everything you've sold.
 */

export interface FilterState {
  category: string;
  subSport: string | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  ownershipView: 'owned' | 'sold';
}

export const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'grade', label: 'Grade' },
  { key: 'price', label: 'Value' },
  { key: 'date', label: 'Date added' },
  { key: 'series', label: 'Set' },
];

/** How many non-default filters are on — drives the badge on the trigger. */
export function activeFilterCount(s: FilterState, inBinder: boolean): number {
  let n = 0;
  if (s.category !== 'all') n++;
  if (s.subSport) n++;
  if (s.sortColumn) n++;
  // Inside a binder, Sold is a filter; outside it's expressed by the strip chip.
  if (inBinder && s.ownershipView === 'sold') n++;
  return n;
}

export function FilterSheet({
  state,
  categories,
  sports,
  inBinder,
  onChange,
  onReset,
  onClose,
}: {
  state: FilterState;
  categories: { key: string; label: string; icon?: string }[];
  sports: { sport: string; count: number }[];
  inBinder: boolean;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const pill = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
      active
        ? 'bg-purple-600 border-purple-600 text-white'
        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Filter &amp; sort</h2>
          <button onClick={onReset} className="text-sm font-semibold text-purple-700 hover:underline">
            Reset
          </button>
        </div>

        {/* Ownership — only meaningful inside a binder; outside, the strip's
            Sold chip already expresses it and showing it twice is confusing. */}
        {inBinder && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Show</p>
            <div className="flex gap-2">
              {(['owned', 'sold'] as const).map(v => (
                <button
                  key={v}
                  className={pill(state.ownershipView === v)}
                  onClick={() => onChange({ ownershipView: v })}
                >
                  {v === 'owned' ? 'Owned' : 'Sold'}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Category</p>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button
              key={c.key}
              className={pill(state.category === c.key)}
              onClick={() => onChange({ category: c.key, subSport: null })}
            >
              {c.icon ? `${c.icon} ` : ''}{c.label}
            </button>
          ))}
        </div>

        {state.category === 'Sports' && sports.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Sport</p>
            <div className="flex flex-wrap gap-2">
              {sports.map(s => (
                <button
                  key={s.sport}
                  className={pill(state.subSport === s.sport)}
                  onClick={() => onChange({ subSport: state.subSport === s.sport ? null : s.sport })}
                >
                  {s.sport} ({s.count})
                </button>
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-5 mb-2">Sort by</p>
        <div className="flex flex-wrap gap-2">
          <button
            className={pill(!state.sortColumn)}
            onClick={() => onChange({ sortColumn: null })}
            title="Custom order — required to drag cards inside a binder"
          >
            {inBinder ? 'Custom order' : 'Newest first'}
          </button>
          {SORT_OPTIONS.map(o => (
            <button
              key={o.key}
              className={pill(state.sortColumn === o.key)}
              onClick={() =>
                onChange({
                  sortColumn: o.key,
                  sortDirection:
                    state.sortColumn === o.key && state.sortDirection === 'asc' ? 'desc' : 'asc',
                })
              }
            >
              {o.label}
              {state.sortColumn === o.key ? (state.sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
            </button>
          ))}
        </div>

        {inBinder && state.sortColumn && (
          <p className="text-xs text-amber-700 mt-3">
            Dragging to rearrange is off while a sort is active — pick “Custom order” to
            arrange this binder by hand.
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700"
        >
          Show results
        </button>
      </div>
    </div>
  );
}

export default FilterSheet;
