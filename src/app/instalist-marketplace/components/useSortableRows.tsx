import { useMemo, useState } from 'react';

/**
 * Reusable column-sort state for the marketplace tables.
 *
 * Usage:
 *   const { sortedRows, sortKey, sortDir, toggleSort, sortIndicator } =
 *     useSortableRows(listings, getValue, 'soldAt', 'desc');
 *
 * - `getValue(row, key)` returns the value to sort by for a given column.
 *   Strings sort case-insensitively; numbers sort numerically; nulls sort last.
 * - `toggleSort(key)` cycles asc → desc → asc on the same column, or jumps to
 *   `desc` (for numeric/date columns) / `asc` (for text columns) on a new column.
 * - `sortIndicator(key)` returns a small JSX arrow for the active column.
 */
export type SortDir = 'asc' | 'desc';

export function useSortableRows<R, K extends string>(
  rows: R[],
  getValue: (row: R, key: K) => string | number | null | undefined,
  defaultKey: K,
  defaultDir: SortDir = 'desc'
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      // Nulls / undefined always sort to the bottom regardless of direction.
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir, getValue]);

  const toggleSort = (key: K, defaultDirForKey: SortDir = 'asc') => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultDirForKey);
    }
  };

  const sortIndicator = (key: K) => {
    if (key !== sortKey) {
      return <span className="ml-1 text-gray-300" aria-hidden>&#8597;</span>;
    }
    return (
      <span className="ml-1 text-indigo-600" aria-hidden>
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return { sortedRows, sortKey, sortDir, toggleSort, sortIndicator };
}

/**
 * Helper to wrap a `<Th>` cell with click-to-sort behaviour. Keeps tab files
 * tidy — they just write `<SortableTh col="price" align="right" {...sortApi}>Price</SortableTh>`.
 */
export function SortableTh<K extends string>({
  col,
  align = 'left',
  toggleSort,
  sortIndicator,
  defaultDir = 'asc',
  children,
}: {
  col: K;
  align?: 'left' | 'right';
  toggleSort: (key: K, defaultDirForKey?: SortDir) => void;
  sortIndicator: (key: K) => React.ReactNode;
  defaultDir?: SortDir;
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={() => toggleSort(col, defaultDir)}
      className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center">
        {children}
        {sortIndicator(col)}
      </span>
    </th>
  );
}
