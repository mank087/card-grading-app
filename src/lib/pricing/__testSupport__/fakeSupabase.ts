/**
 * A tiny in-memory stand-in for the supabase-js query builder, enough for the
 * Phase 2C price-write tests. Not a test file itself (vitest only collects
 * *.test.ts), just the shared fixture those tests import.
 *
 * It records every filter a write used, so a test can assert that both revision
 * columns really appear in the WHERE clause, and it applies updates against a
 * mutable row store, so a test can simulate "the owner corrected the card
 * between the read and the write" by simply bumping the row.
 */

export interface RecordedQuery {
  table: string;
  kind: 'update' | 'select';
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
  selected: string | null;
  matched: number;
}

export interface FakeSupabase {
  from(table: string): any;
  rows: Map<string, Record<string, any>>;
  queries: RecordedQuery[];
  updates: RecordedQuery[];
  /** Filters of the most recent update, as a plain object. */
  lastUpdateFilters(): Record<string, unknown>;
}

export interface FakeSupabaseOptions {
  /** Seed rows. Each must have an `id`. */
  rows?: Array<Record<string, any>>;
  /** Force an error from every update. */
  updateError?: { code?: string; message: string } | null;
  /** Called before each update is applied — the place to mutate a row mid-flight. */
  beforeUpdate?: (fake: FakeSupabase) => void;
}

export function createFakeSupabase(options: FakeSupabaseOptions = {}): FakeSupabase {
  const rows = new Map<string, Record<string, any>>();
  for (const row of options.rows || []) rows.set(String(row.id), { ...row });

  const queries: RecordedQuery[] = [];

  const fake: FakeSupabase = {
    rows,
    queries,
    get updates() {
      return queries.filter(q => q.kind === 'update');
    },
    lastUpdateFilters() {
      const ups = queries.filter(q => q.kind === 'update');
      const last = ups[ups.length - 1];
      return Object.fromEntries(last ? last.filters : []);
    },
    from(table: string) {
      return makeBuilder(table);
    },
  };

  function matches(row: Record<string, any>, filters: Array<[string, unknown]>): boolean {
    return filters.every(([column, value]) => {
      const actual = row[column];
      // `.in(column, values)` is recorded as an array value.
      if (Array.isArray(value)) return value.map(String).includes(String(actual));
      // Postgres compares numbers numerically; a revision stored as 0 must match 0.
      if (typeof value === 'number') return Number(actual ?? NaN) === value;
      return actual === value;
    });
  }

  function makeBuilder(table: string) {
    const record: RecordedQuery = { table, kind: 'select', filters: [], selected: null, matched: 0 };
    let payload: Record<string, unknown> | null = null;
    let single: 'single' | 'maybeSingle' | null = null;
    let selectCalled = false;

    const run = () => {
      const all = [...rows.values()];
      if (record.kind === 'update') {
        if (options.beforeUpdate) options.beforeUpdate(fake);
        if (options.updateError) {
          queries.push({ ...record, payload: payload || {} });
          return { data: null, error: options.updateError };
        }
        const hits = all.filter(row => matches(row, record.filters));
        for (const row of hits) Object.assign(row, payload);
        record.matched = hits.length;
        record.payload = payload || {};
        queries.push({ ...record, filters: [...record.filters] });
        if (!selectCalled) return { data: null, error: null };
        return { data: hits.map(row => ({ id: row.id })), error: null };
      }
      const hits = all.filter(row => matches(row, record.filters));
      record.matched = hits.length;
      queries.push({ ...record, filters: [...record.filters] });
      if (single) {
        if (hits.length === 0) {
          return single === 'single'
            ? { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
            : { data: null, error: null };
        }
        return { data: { ...hits[0] }, error: null };
      }
      return { data: hits.map(row => ({ ...row })), error: null };
    };

    const builder: any = {
      update(next: Record<string, unknown>) {
        record.kind = 'update';
        payload = next;
        return builder;
      },
      select(columns?: string) {
        selectCalled = true;
        record.selected = columns ?? '*';
        return builder;
      },
      eq(column: string, value: unknown) {
        record.filters.push([column, value]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        record.filters.push([column, values]);
        return builder;
      },
      not() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      single() { single = 'single'; return builder; },
      maybeSingle() { single = 'maybeSingle'; return builder; },
      then(resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (e) {
          return Promise.reject(e).then(resolve, reject);
        }
      },
    };
    return builder;
  }

  return fake;
}
