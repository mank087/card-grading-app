// Server-side data access for the population report.
//
// The pop report used to live entirely behind /api/pop/*, which meant the page
// shipped a loading shell to anything that does not run JavaScript — including
// every answer engine. These functions are the single source of truth for that
// data so the server components and the API routes cannot drift apart.
//
// Query discipline (feedback_production_db_safety): every read here selects
// narrow columns or is a `head: true` count against the pop indexes added in
// supabase/migrations/20260225_add_pop_report.sql. Nothing selects a JSON blob.

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  POP_CATEGORIES,
  getCategoryFromSlug,
  getCategoryMeta,
  getSlugFromCategory,
} from '@/lib/popReport';

export interface PopCategoryRow {
  slug: string;
  dbCategory: string;
  dbSubCategory?: string | null;
  displayName: string;
  icon: string;
  uniqueCards: number;
  totalGraded: number;
}

export interface PopTotals {
  totalUniqueCards: number;
  totalGraded: number;
}

export interface PopCardRow {
  cardName: string;
  cardNumber: string;
  featured: string | null;
  cardSet: string | null;
  thumbnailUrl: string | null;
  total: number;
  grades: Record<number, number>;
}

export interface PopCategoryInfo {
  slug: string;
  dbCategory: string;
  /** Set when the slug names a sub-category of "Other" (Star Wars, Digimon, ...). */
  dbSubCategory?: string | null;
  displayName: string;
  icon: string;
}

export interface PopPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const DEFAULT_ICON = '🃏';

/** Slugify a DB sub_category value the same way the category grid does. */
function slugifySubCategory(subCat: string): string {
  return subCat
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Every category with graded cards, plus platform totals.
 * Mirrors what /api/pop/categories has always returned.
 */
export async function fetchPopCategories(): Promise<{
  categories: PopCategoryRow[];
  totals: PopTotals;
}> {
  const [rpcResult, subCatResult] = await Promise.all([
    supabaseAdmin.rpc('get_pop_categories'),
    supabaseAdmin
      .from('cards')
      .select('sub_category')
      .eq('category', 'Other')
      .not('conversational_whole_grade', 'is', null)
      .not('sub_category', 'is', null),
  ]);

  if (rpcResult.error) {
    console.error('Pop categories RPC error:', rpcResult.error);
    throw new Error('Failed to fetch pop categories');
  }

  // Sub-category counts inside "Other" (Star Wars, Digimon, ...). These are
  // surfaced as their own tiles, so their cards are subtracted from "Other".
  const subCatCounts = new Map<string, number>();
  for (const row of (subCatResult.data || []) as { sub_category: string | null }[]) {
    const sc = row.sub_category;
    if (!sc) continue;
    subCatCounts.set(sc, (subCatCounts.get(sc) || 0) + 1);
  }
  let subCategoryTotal = 0;
  for (const total of subCatCounts.values()) subCategoryTotal += total;

  const categories: PopCategoryRow[] = (
    (rpcResult.data || []) as { category: string; unique_cards: number; total_graded: number }[]
  )
    .map((row) => {
      const meta = POP_CATEGORIES.find((c) => c.dbCategory === row.category && !c.dbSubCategory);
      const slug = getSlugFromCategory(row.category);

      let uniqueCards = Number(row.unique_cards);
      let totalGraded = Number(row.total_graded);
      if (row.category === 'Other') {
        uniqueCards = Math.max(0, uniqueCards - subCategoryTotal);
        totalGraded = Math.max(0, totalGraded - subCategoryTotal);
      }

      return {
        slug,
        dbCategory: row.category,
        dbSubCategory: null,
        displayName: meta?.displayName || row.category,
        icon: meta?.icon || DEFAULT_ICON,
        uniqueCards,
        totalGraded,
      };
    })
    .filter((c) => c.totalGraded >= 3);

  for (const [subCat, total] of subCatCounts) {
    if (total < 1) continue;
    const meta = POP_CATEGORIES.find((c) => c.dbSubCategory === subCat);
    categories.push({
      slug: meta?.slug || slugifySubCategory(subCat),
      dbCategory: 'Other',
      dbSubCategory: subCat,
      displayName: meta?.displayName || subCat,
      icon: meta?.icon || DEFAULT_ICON,
      uniqueCards: total,
      totalGraded: total,
    });
  }

  const totals: PopTotals = {
    totalUniqueCards: categories.reduce((sum, c) => sum + c.uniqueCards, 0),
    totalGraded: categories.reduce((sum, c) => sum + c.totalGraded, 0),
  };

  return { categories, totals };
}

/** Batch-sign card thumbnails; one storage round trip instead of one per card. */
async function signThumbnails(paths: (string | null)[]): Promise<(string | null)[]> {
  const wanted = paths.filter((p): p is string => Boolean(p));
  if (wanted.length === 0) return paths.map(() => null);

  const byPath = new Map<string, string>();
  try {
    const { data } = await supabaseAdmin.storage.from('cards').createSignedUrls(wanted, 3600);
    for (const entry of data || []) {
      if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
    }
  } catch {
    // Thumbnails are decoration; a signing failure must not lose the table.
  }
  return paths.map((p) => (p ? byPath.get(p) || null : null));
}

/**
 * Resolve a URL slug to the DB category (and sub-category, when the slug names
 * a sub-category of "Other" that is not in the hardcoded list).
 */
async function resolveCategory(slug: string): Promise<{
  dbCategory: string;
  dbSubCategory: string | null;
  meta: ReturnType<typeof getCategoryMeta>;
}> {
  const meta = getCategoryMeta(slug);
  let dbCategory = getCategoryFromSlug(slug);
  let dbSubCategory = meta?.dbSubCategory || null;

  if (!meta) {
    const { data: subCatRows } = await supabaseAdmin
      .from('cards')
      .select('sub_category')
      .eq('category', 'Other')
      .not('sub_category', 'is', null)
      .not('conversational_whole_grade', 'is', null)
      .limit(1000);
    const match = (subCatRows as { sub_category: string }[] | null)?.find(
      (r) => slugifySubCategory(r.sub_category) === slug
    );
    if (match) {
      dbCategory = 'Other';
      dbSubCategory = match.sub_category; // exact DB value preserves casing
    }
  }

  return { dbCategory, dbSubCategory, meta };
}

/** One page of the population table for a category. */
export async function fetchPopCards(opts: {
  slug: string;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ category: PopCategoryInfo; cards: PopCardRow[]; pagination: PopPagination }> {
  const slug = opts.slug;
  const search = opts.search || null;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const { dbCategory, dbSubCategory, meta } = await resolveCategory(slug);

  // Sub-category report: the RPCs key on category only, so this branch queries
  // directly and aggregates in memory.
  if (dbSubCategory) {
    let cardsQuery = supabaseAdmin
      .from('cards')
      .select('card_name, card_number, featured, card_set, front_path, conversational_whole_grade')
      .eq('category', dbCategory)
      .eq('sub_category', dbSubCategory)
      .not('conversational_whole_grade', 'is', null);
    if (search) {
      cardsQuery = cardsQuery.or(
        `card_name.ilike.%${search}%,featured.ilike.%${search}%,card_set.ilike.%${search}%`
      );
    }

    const [cardsResult, countResult] = await Promise.all([
      cardsQuery,
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('category', dbCategory)
        .eq('sub_category', dbSubCategory)
        .not('conversational_whole_grade', 'is', null),
    ]);

    interface RawRow {
      card_name: string | null;
      card_number: string | null;
      featured: string | null;
      card_set: string | null;
      front_path: string | null;
      conversational_whole_grade: number | null;
    }
    interface Grouped {
      card_name: string;
      card_number: string;
      featured: string | null;
      card_set: string | null;
      front_path: string | null;
      total: number;
      grades: Record<number, number>;
    }

    const rawCards = (cardsResult.data || []) as RawRow[];
    const cardMap = new Map<string, Grouped>();
    for (const card of rawCards) {
      const key = `${card.card_name || card.featured || 'Unknown'}__${card.card_set || ''}__${card.card_number || ''}`;
      let entry = cardMap.get(key);
      if (!entry) {
        entry = {
          card_name: card.card_name || card.featured || 'Unknown',
          card_number: card.card_number || '',
          featured: card.featured,
          card_set: card.card_set,
          front_path: card.front_path,
          total: 0,
          grades: {},
        };
        cardMap.set(key, entry);
      }
      entry.total++;
      const grade = card.conversational_whole_grade;
      if (grade) entry.grades[grade] = (entry.grades[grade] || 0) + 1;
      if (!entry.front_path && card.front_path) entry.front_path = card.front_path;
    }

    const sortedCards = Array.from(cardMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(offset, offset + limit);

    const thumbs = await signThumbnails(sortedCards.map((r) => r.front_path));
    const cards: PopCardRow[] = sortedCards.map((row, i) => {
      const grades: Record<number, number> = {};
      for (let g = 1; g <= 10; g++) grades[g] = row.grades[g] || 0;
      return {
        cardName: row.card_name,
        cardNumber: row.card_number,
        featured: row.featured,
        cardSet: row.card_set,
        thumbnailUrl: thumbs[i],
        total: row.total,
        grades,
      };
    });

    const total = countResult.count || rawCards.length;
    return {
      category: {
        slug,
        dbCategory,
        dbSubCategory,
        displayName: meta?.displayName || dbSubCategory,
        icon: meta?.icon || DEFAULT_ICON,
      },
      cards,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    };
  }

  const [cardsResult, countResult, categoriesResult] = await Promise.all([
    supabaseAdmin.rpc('get_pop_cards', {
      p_category: dbCategory,
      p_search: search,
      p_limit: limit,
      p_offset: offset,
    }),
    supabaseAdmin.rpc('get_pop_cards_count', { p_category: dbCategory, p_search: search }),
    supabaseAdmin.rpc('get_pop_categories'),
  ]);

  if (cardsResult.error) {
    console.error('Pop cards RPC error:', cardsResult.error);
    throw new Error('Failed to fetch pop cards');
  }

  const totalCount =
    typeof countResult.data === 'number' ? countResult.data : Number(countResult.data) || 0;

  // Resolve the display name from the DB so acronyms (MMA, TCG) keep their casing.
  const dbCategoryRow = (
    (categoriesResult.data || []) as { category: string }[]
  ).find((c) => c.category.toLowerCase() === dbCategory.toLowerCase());
  const resolvedDisplayName = meta?.displayName || dbCategoryRow?.category || dbCategory;

  interface RpcRow {
    card_name: string;
    card_number: string;
    featured: string | null;
    card_set: string | null;
    front_path: string | null;
    total: number;
    [key: string]: unknown;
  }
  const rows = (cardsResult.data || []) as RpcRow[];
  const thumbs = await signThumbnails(rows.map((r) => r.front_path));

  const cards: PopCardRow[] = rows.map((row, i) => {
    const grades: Record<number, number> = {};
    for (let g = 1; g <= 10; g++) grades[g] = Number(row[`grade_${g}`] || 0);
    return {
      cardName: row.card_name,
      cardNumber: row.card_number,
      featured: row.featured,
      cardSet: row.card_set,
      thumbnailUrl: thumbs[i],
      total: Number(row.total),
      grades,
    };
  });

  return {
    category: {
      slug,
      dbCategory,
      dbSubCategory: null,
      displayName: resolvedDisplayName,
      icon: meta?.icon || DEFAULT_ICON,
    },
    cards,
    pagination: { total: totalCount, limit, offset, hasMore: offset + limit < totalCount },
  };
}

// ---------------------------------------------------------------------------
// Grade distribution — the numbers the narrative summary is computed from.
// ---------------------------------------------------------------------------

export interface CategoryGemRate {
  slug: string;
  displayName: string;
  totalGraded: number;
  tens: number;
  gemRate: number; // 0-100
}

export interface PopGradeStats {
  /** Count of cards at each whole grade, 1 through 10. */
  distribution: Record<number, number>;
  totalGraded: number;
  tens: number;
  nines: number;
  gemRate: number; // % of graded cards at 10
  nineRate: number; // % at 9
  nineOrBetterRate: number; // % at 9 or 10
  hardest: CategoryGemRate | null; // lowest gem rate
  easiest: CategoryGemRate | null; // highest gem rate
  /** Categories that qualified for the hardest/easiest comparison. */
  rankedCategories: CategoryGemRate[];
}

/** Minimum sample before a category is allowed into the hardest/easiest claim. */
const GEM_RATE_MIN_SAMPLE = 250;

/** Catch-all buckets — they are not a "category" a reader can act on. */
const GEM_RATE_EXCLUDED = new Set(['Other', 'Sports', 'TCG']);

/**
 * The category as the pop RPC computes it: `category`, except cards filed under
 * the legacy 'Sports' bucket, which carry their real sport in
 * conversational_card_info->>sport_or_category.
 */
function categoryFilter(dbCategory: string): string {
  return `category.eq.${dbCategory},and(category.eq.Sports,conversational_card_info->>sport_or_category.eq.${dbCategory})`;
}

/**
 * Platform-wide grade distribution plus per-category gem rates.
 *
 * All index-backed `head: true` counts (idx on category, conversational_whole_grade).
 * No rows are transferred.
 */
export async function fetchPopGradeStats(categories: PopCategoryRow[]): Promise<PopGradeStats> {
  const gradeCounts = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('conversational_whole_grade', i + 1)
    )
  );

  const distribution: Record<number, number> = {};
  let totalGraded = 0;
  gradeCounts.forEach((res, i) => {
    const n = res.count || 0;
    distribution[i + 1] = n;
    totalGraded += n;
  });

  const tens = distribution[10] || 0;
  const nines = distribution[9] || 0;

  const candidates = categories.filter(
    (c) =>
      !c.dbSubCategory &&
      !GEM_RATE_EXCLUDED.has(c.dbCategory) &&
      c.totalGraded >= GEM_RATE_MIN_SAMPLE
  );

  const rankedCategories: CategoryGemRate[] = (
    await Promise.all(
      candidates.map(async (c) => {
        const { count } = await supabaseAdmin
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('conversational_whole_grade', 10)
          .or(categoryFilter(c.dbCategory));
        const catTens = count || 0;
        return {
          slug: c.slug,
          displayName: c.displayName,
          totalGraded: c.totalGraded,
          tens: catTens,
          gemRate: c.totalGraded > 0 ? (catTens / c.totalGraded) * 100 : 0,
        };
      })
    )
  ).sort((a, b) => a.gemRate - b.gemRate);

  return {
    distribution,
    totalGraded,
    tens,
    nines,
    gemRate: totalGraded > 0 ? (tens / totalGraded) * 100 : 0,
    nineRate: totalGraded > 0 ? (nines / totalGraded) * 100 : 0,
    nineOrBetterRate: totalGraded > 0 ? ((tens + nines) / totalGraded) * 100 : 0,
    hardest: rankedCategories[0] || null,
    easiest: rankedCategories[rankedCategories.length - 1] || null,
    rankedCategories,
  };
}

/** Grade distribution for a single category, for the per-category page. */
export async function fetchCategoryGradeStats(dbCategory: string): Promise<{
  distribution: Record<number, number>;
  totalGraded: number;
  gemRate: number;
  nineOrBetterRate: number;
} | null> {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      supabaseAdmin
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('conversational_whole_grade', i + 1)
        .or(categoryFilter(dbCategory))
    )
  );

  const distribution: Record<number, number> = {};
  let totalGraded = 0;
  results.forEach((res, i) => {
    const n = res.count || 0;
    distribution[i + 1] = n;
    totalGraded += n;
  });

  if (totalGraded === 0) return null;

  return {
    distribution,
    totalGraded,
    gemRate: ((distribution[10] || 0) / totalGraded) * 100,
    nineOrBetterRate: (((distribution[10] || 0) + (distribution[9] || 0)) / totalGraded) * 100,
  };
}
