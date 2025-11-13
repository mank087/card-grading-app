-- ========================================
-- DCM v3.1 Helpful SQL Queries
-- ========================================
-- Copy/paste these into Supabase SQL Editor as needed
-- ========================================

-- ========================================
-- 1. VERIFY v3.1 IS WORKING
-- ========================================

-- Check if v3.1 cards exist
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as front_centering_type,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    dcm_grade_whole,
    created_at
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
ORDER BY created_at DESC
LIMIT 10;

-- Count cards by OpenCV version
SELECT
    COALESCE(ai_grading->'Centering_Measurements'->>'opencv_version', 'pre-v3.1') as opencv_version,
    COUNT(*) as count
FROM cards
WHERE ai_grading IS NOT NULL
GROUP BY opencv_version
ORDER BY count DESC;

-- ========================================
-- 2. BORDERLESS / FULL-ART CARDS
-- ========================================

-- Find cards with design-anchor centering (borderless/full-art)
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as front_type,
    ai_grading->'Centering_Measurements'->>'back_centering_type' as back_type,
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as front_mode,
    ai_grading->'Centering_Measurements'->>'back_edge_detection_mode' as back_mode,
    dcm_grade_whole
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'front_centering_type' = 'design-anchor'
   OR ai_grading->'Centering_Measurements'->>'back_centering_type' = 'design-anchor'
ORDER BY created_at DESC;

-- Count detection modes used
SELECT
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as detection_mode,
    COUNT(*) as count
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
GROUP BY detection_mode
ORDER BY count DESC;

-- ========================================
-- 3. IMAGE QUALITY ANALYSIS
-- ========================================

-- Find cards by image quality grade
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    ai_grading->'Centering_Measurements'->>'back_image_quality_grade' as back_quality,
    dcm_grade_whole,
    created_at
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
ORDER BY created_at DESC;

-- Count cards by image quality
SELECT
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as quality_grade,
    COUNT(*) as count
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
GROUP BY quality_grade
ORDER BY quality_grade;

-- Find low-quality images (C or D grade)
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    ai_grading->'Centering_Measurements'->>'back_image_quality_grade' as back_quality,
    dcm_grade_whole
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'front_image_quality_grade' IN ('C', 'D')
   OR ai_grading->'Centering_Measurements'->>'back_image_quality_grade' IN ('C', 'D')
ORDER BY created_at DESC;

-- ========================================
-- 4. GRADE ANALYSIS
-- ========================================

-- Average grade by image quality
SELECT
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as quality_grade,
    COUNT(*) as card_count,
    ROUND(AVG(dcm_grade_whole::numeric), 2) as avg_grade,
    MIN(dcm_grade_whole) as min_grade,
    MAX(dcm_grade_whole) as max_grade
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND dcm_grade_whole IS NOT NULL
GROUP BY quality_grade
ORDER BY quality_grade;

-- Average grade by centering type
SELECT
    ai_grading->'Centering_Measurements'->>'front_centering_type' as centering_type,
    COUNT(*) as card_count,
    ROUND(AVG(dcm_grade_whole::numeric), 2) as avg_grade
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND dcm_grade_whole IS NOT NULL
GROUP BY centering_type
ORDER BY centering_type;

-- ========================================
-- 5. RECENT ACTIVITY
-- ========================================

-- Last 10 v3.1 graded cards with all metadata
SELECT
    id,
    card_name,
    category,
    dcm_grade_whole,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as centering_type,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as quality,
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as detection_mode,
    created_at
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
ORDER BY created_at DESC
LIMIT 10;

-- Today's v3.1 cards
SELECT
    COUNT(*) as cards_graded_today,
    ROUND(AVG(dcm_grade_whole::numeric), 2) as avg_grade
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND DATE(created_at) = CURRENT_DATE;

-- ========================================
-- 6. PERFORMANCE ANALYSIS
-- ========================================

-- Average processing time for v3.1 cards
SELECT
    COUNT(*) as total_cards,
    ROUND(AVG(processing_time::numeric) / 1000, 2) as avg_seconds,
    MIN(processing_time) / 1000 as min_seconds,
    MAX(processing_time) / 1000 as max_seconds
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND processing_time IS NOT NULL;

-- Processing time by detection mode
SELECT
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as detection_mode,
    COUNT(*) as count,
    ROUND(AVG(processing_time::numeric) / 1000, 2) as avg_seconds
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND processing_time IS NOT NULL
GROUP BY detection_mode
ORDER BY detection_mode;

-- ========================================
-- 7. COMPARISON: v3.1 vs PRE-v3.1
-- ========================================

-- Grade distribution comparison
SELECT
    CASE
        WHEN ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1' THEN 'v3.1'
        ELSE 'pre-v3.1'
    END as version,
    dcm_grade_whole as grade,
    COUNT(*) as count
FROM cards
WHERE dcm_grade_whole IS NOT NULL
GROUP BY version, grade
ORDER BY version, grade DESC;

-- Average grade comparison
SELECT
    CASE
        WHEN ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1' THEN 'v3.1'
        ELSE 'pre-v3.1'
    END as version,
    COUNT(*) as total_cards,
    ROUND(AVG(dcm_grade_whole::numeric), 2) as avg_grade
FROM cards
WHERE dcm_grade_whole IS NOT NULL
GROUP BY version
ORDER BY version;

-- ========================================
-- 8. TROUBLESHOOTING
-- ========================================

-- Find cards missing v3.1 fields (should be none for new cards)
SELECT
    id,
    card_name,
    created_at,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version
FROM cards
WHERE created_at > NOW() - INTERVAL '1 day'
  AND (ai_grading->'Centering_Measurements'->>'opencv_version' IS NULL
   OR ai_grading->'Centering_Measurements'->>'opencv_version' != '3.1')
ORDER BY created_at DESC;

-- Check for cards with processing errors
SELECT
    id,
    card_name,
    ai_grading->>'error' as error_message,
    created_at
FROM cards
WHERE ai_grading->>'error' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- 9. EXPORT DATA
-- ========================================

-- Export v3.1 card data for analysis (CSV-friendly)
SELECT
    id,
    card_name,
    category,
    dcm_grade_whole,
    raw_decimal_grade,
    ai_confidence_score,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as front_centering_type,
    ai_grading->'Centering_Measurements'->>'back_centering_type' as back_centering_type,
    ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
    ai_grading->'Centering_Measurements'->>'back_image_quality_grade' as back_quality,
    ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as front_detection_mode,
    ai_grading->'Centering_Measurements'->>'back_edge_detection_mode' as back_detection_mode,
    processing_time,
    created_at
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
ORDER BY created_at DESC;

-- ========================================
-- 10. MAINTENANCE
-- ========================================

-- Clean up test cards (CAREFUL - THIS DELETES DATA!)
-- Uncomment and modify the WHERE clause as needed
/*
DELETE FROM cards
WHERE card_name LIKE '%test%'
  AND created_at < NOW() - INTERVAL '1 day';
*/

-- Update prompt_version for any cards missing it
UPDATE cards
SET prompt_version = '3.1'
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1'
  AND prompt_version IS NULL;

-- Vacuum and analyze for performance (run periodically)
VACUUM ANALYZE cards;
