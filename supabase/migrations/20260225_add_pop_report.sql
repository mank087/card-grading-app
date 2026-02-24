-- Pop Report: Indexes and RPC functions
-- Enables efficient aggregation queries for the population report feature
-- Flat 2-level structure: Category → Cards (no set drill-down)

-- ============================================================
-- INDEXES
-- ============================================================

-- Category-level grade distribution
CREATE INDEX IF NOT EXISTS idx_cards_pop_category_grade
ON cards(category, conversational_whole_grade)
WHERE conversational_whole_grade IS NOT NULL;

-- Card-level aggregation within category (name + number grouping)
CREATE INDEX IF NOT EXISTS idx_cards_pop_category_card_grade
ON cards(category, card_name, card_number, conversational_whole_grade)
WHERE conversational_whole_grade IS NOT NULL;

-- JSONB index for sport_or_category extraction on Sports cards
CREATE INDEX IF NOT EXISTS idx_cards_pop_sport_category
ON cards((conversational_card_info->>'sport_or_category'))
WHERE category = 'Sports' AND conversational_card_info IS NOT NULL;

-- ============================================================
-- CLEANUP: Drop old set-based functions and indexes
-- ============================================================

DROP FUNCTION IF EXISTS get_pop_categories();
DROP FUNCTION IF EXISTS get_pop_sets(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_pop_sets_count(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_pop_cards(TEXT, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_pop_cards_count(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_pop_cards(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_pop_cards_count(TEXT, TEXT);

DROP INDEX IF EXISTS idx_cards_pop_category_set_grade;
DROP INDEX IF EXISTS idx_cards_pop_set_card_grade;

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- get_pop_categories: Returns per-category aggregate stats
CREATE OR REPLACE FUNCTION get_pop_categories()
RETURNS TABLE(
  category TEXT,
  unique_cards BIGINT,
  total_graded BIGINT
) LANGUAGE sql STABLE
SET search_path = '' AS $$
  SELECT
    COALESCE(
      CASE WHEN c.category = 'Sports'
        THEN c.conversational_card_info->>'sport_or_category'
        ELSE NULL END,
      c.category
    ) AS category,
    COUNT(DISTINCT c.card_name || '::' || COALESCE(c.card_number, '')) AS unique_cards,
    COUNT(*) AS total_graded
  FROM public.cards c
  WHERE c.conversational_whole_grade IS NOT NULL
  GROUP BY 1
  ORDER BY total_graded DESC;
$$;

-- get_pop_cards: Returns cards grouped by name+number with grade distribution
-- Flat query (no set filter) — set is returned as a display column
CREATE OR REPLACE FUNCTION get_pop_cards(
  p_category TEXT,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  card_name TEXT,
  card_number TEXT,
  featured TEXT,
  card_set TEXT,
  front_path TEXT,
  total BIGINT,
  grade_1 BIGINT,
  grade_2 BIGINT,
  grade_3 BIGINT,
  grade_4 BIGINT,
  grade_5 BIGINT,
  grade_6 BIGINT,
  grade_7 BIGINT,
  grade_8 BIGINT,
  grade_9 BIGINT,
  grade_10 BIGINT
) LANGUAGE sql STABLE
SET search_path = '' AS $$
  SELECT
    c.card_name,
    c.card_number,
    MIN(c.featured) AS featured,
    MIN(c.card_set) AS card_set,
    MIN(c.front_path) AS front_path,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 1) AS grade_1,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 2) AS grade_2,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 3) AS grade_3,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 4) AS grade_4,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 5) AS grade_5,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 6) AS grade_6,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 7) AS grade_7,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 8) AS grade_8,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 9) AS grade_9,
    COUNT(*) FILTER (WHERE c.conversational_whole_grade = 10) AS grade_10
  FROM public.cards c
  WHERE c.conversational_whole_grade IS NOT NULL
    AND LOWER(
      COALESCE(
        CASE WHEN c.category = 'Sports'
          THEN c.conversational_card_info->>'sport_or_category'
          ELSE NULL END,
        c.category
      )
    ) = LOWER(p_category)
    AND (
      p_search IS NULL
      OR c.card_name ILIKE '%' || p_search || '%'
      OR c.featured ILIKE '%' || p_search || '%'
      OR c.card_set ILIKE '%' || p_search || '%'
    )
  GROUP BY c.card_name, c.card_number
  ORDER BY total DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- get_pop_cards_count: Returns count of distinct cards for pagination
CREATE OR REPLACE FUNCTION get_pop_cards_count(
  p_category TEXT,
  p_search TEXT DEFAULT NULL
)
RETURNS BIGINT LANGUAGE sql STABLE
SET search_path = '' AS $$
  SELECT COUNT(DISTINCT (c.card_name || '::' || COALESCE(c.card_number, '')))
  FROM public.cards c
  WHERE c.conversational_whole_grade IS NOT NULL
    AND LOWER(
      COALESCE(
        CASE WHEN c.category = 'Sports'
          THEN c.conversational_card_info->>'sport_or_category'
          ELSE NULL END,
        c.category
      )
    ) = LOWER(p_category)
    AND (
      p_search IS NULL
      OR c.card_name ILIKE '%' || p_search || '%'
      OR c.featured ILIKE '%' || p_search || '%'
      OR c.card_set ILIKE '%' || p_search || '%'
    );
$$;
