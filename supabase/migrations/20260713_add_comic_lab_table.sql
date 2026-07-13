-- ============================================================================
-- COMIC LAB (admin testing sandbox) — persisted lab grades
-- ============================================================================
-- Admin-only table backing /admin/comic-lab. NOT a user-facing feature:
-- RLS is enabled with NO policies, so only the service role (admin API
-- routes) can read/write. Images live in the existing "cards" storage
-- bucket under comic-lab/<id>/.
-- ============================================================================

CREATE TABLE IF NOT EXISTS comics_lab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_by TEXT,                      -- admin email
  era TEXT NOT NULL,                   -- golden|silver|bronze|copper|modern

  -- identity (from the model's comic_info; editable later)
  title TEXT,
  issue_number TEXT,
  publisher TEXT,

  -- grade outputs
  final_grade NUMERIC(3,1) NOT NULL,
  grade_label TEXT NOT NULL,
  category_scores JSONB NOT NULL,      -- {spine, corners, edges, surface, wrap}
  page_quality TEXT,                   -- white|off-white|...|unknown
  packaging_type TEXT,                 -- none|bag|slab
  summary TEXT,
  engine_version TEXT NOT NULL,
  grading_json JSONB NOT NULL,         -- full ComicGradeResult

  -- image storage paths (bucket: cards)
  front_path TEXT NOT NULL,
  back_path TEXT NOT NULL,
  spine_path TEXT,
  page_edge_path TEXT,

  -- anchor workflow: operator's expected grade for calibration comparisons
  expected_grade NUMERIC(3,1),
  operator_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_comics_lab_created ON comics_lab(created_at DESC);

ALTER TABLE comics_lab ENABLE ROW LEVEL SECURITY;
-- no policies on purpose: service-role access only (admin API routes)
