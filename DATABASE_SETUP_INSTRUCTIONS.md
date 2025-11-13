# Database Setup Instructions for v3.1

## 📋 Quick Setup

### Option 1: Run Complete Schema (Recommended for New Installations)

1. **Go to Supabase SQL Editor:**
   - Open your Supabase project: https://supabase.com/dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

2. **Copy and Run the Complete Schema:**
   - Open `database_schema_v3_1_complete.sql`
   - Copy the **entire contents**
   - Paste into Supabase SQL Editor
   - Click **"Run"** (or press Ctrl+Enter)

3. **Verify Success:**
   - You should see: `✅ Database schema v3.1 complete!`
   - Check that no errors appear in the output

✅ **Safe to run multiple times** - Uses `IF NOT EXISTS` so won't duplicate

---

## Option 2: Run Individual Migrations (For Existing Databases)

If you already have a `cards` table and want to add only new fields:

### Step 1: Check What You Have
```sql
-- Run this to see your current columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;
```

### Step 2: Add Missing Columns
The complete schema will add any missing columns without breaking existing data.

Just run `database_schema_v3_1_complete.sql` - it's designed to be safe!

---

## 🔍 What Gets Created/Updated

### Main Tables:
- ✅ **cards** - Main table with all grading data
- ✅ **card_evaluations** - Optional multi-evaluation support

### Key v3.1 Fields Added:
All stored in `ai_grading` JSONB column:
- `opencv_version` - "3.1" for new system
- `front_centering_type` - "border-detected" or "design-anchor"
- `back_centering_type` - "border-detected" or "design-anchor"
- `front_edge_detection_mode` - "standard", "color-channel", or "manual-fallback"
- `back_edge_detection_mode` - "standard", "color-channel", or "manual-fallback"
- `front_image_quality_grade` - "A", "B", "C", or "D"
- `back_image_quality_grade` - "A", "B", "C", or "D"

### Performance Indexes:
- ✅ User queries (user_id)
- ✅ Date sorting (created_at)
- ✅ Category filtering (category)
- ✅ Name search (card_name)
- ✅ Grade filtering (dcm_grade_whole)
- ✅ JSON queries (ai_grading GIN index)
- ✅ Version tracking (prompt_version)

### Security:
- ✅ Row Level Security (RLS) enabled
- ✅ Users can only access their own cards
- ✅ Storage bucket policies configured

---

## ✅ Verify Your Database

### After running the SQL, verify with these queries:

**1. Check v3.1 cards exist (after grading one):**
```sql
SELECT
    id,
    card_name,
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    ai_grading->'Centering_Measurements'->>'front_centering_type' as centering_type,
    prompt_version,
    created_at
FROM cards
ORDER BY created_at DESC
LIMIT 5;
```

**2. Count columns:**
```sql
SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'cards';
```
Expected: ~40+ columns

**3. Check indexes:**
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'cards'
ORDER BY indexname;
```
Expected: 8+ indexes

---

## 🚨 Troubleshooting

### Error: "relation already exists"
✅ **Ignore this** - It means the table already exists. The script will continue.

### Error: "column already exists"
✅ **Ignore this** - It means the column already exists. The script will continue.

### Error: "permission denied"
❌ **Check:** Make sure you're logged in as the database owner or have sufficient permissions.

### Error: "syntax error"
❌ **Check:** Make sure you copied the entire SQL file, including the beginning and end.

---

## 📊 Understanding the Schema

### Essential Columns for v3.1:
```
id                      - Unique card ID (UUID)
user_id                 - Owner of the card
front_path              - Supabase storage path to front image
back_path               - Supabase storage path to back image
category                - Sports, Pokémon, Magic, etc.
card_name               - Extracted card name
dcm_grade_whole         - Final grade (1-10)
ai_grading              - Complete v3.1 JSON response
prompt_version          - "3.1" for new system
created_at              - When card was uploaded
```

### v3.1 Data Location:
All v3.1-specific fields are stored inside the `ai_grading` JSONB column under:
```
ai_grading -> 'Centering_Measurements' -> {
  'opencv_version',
  'front_centering_type',
  'back_centering_type',
  'front_edge_detection_mode',
  'back_edge_detection_mode',
  'front_image_quality_grade',
  'back_image_quality_grade'
}
```

### Query Example:
```sql
-- Get all v3.1 graded cards
SELECT
    card_name,
    ai_grading->'Centering_Measurements'->>'opencv_version' as version,
    dcm_grade_whole as grade
FROM cards
WHERE ai_grading->'Centering_Measurements'->>'opencv_version' = '3.1';
```

---

## 🔄 Migration from Older Schema

If you have cards graded with older systems:
- ✅ **Old cards will still work** - They just won't have v3.1 fields
- ✅ **New cards will have v3.1 data** - Starting from your first upload after setup
- ✅ **No data loss** - Existing grading data is preserved

To identify old vs new cards:
```sql
SELECT
    ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
    COUNT(*) as count
FROM cards
GROUP BY opencv_version
ORDER BY count DESC;
```

---

## 💾 Backup Recommendation

**Before running any schema changes:**
```sql
-- Export your cards table (optional safety measure)
-- In Supabase Dashboard:
-- 1. Go to Table Editor
-- 2. Select 'cards' table
-- 3. Click "Export" > "CSV"
```

---

## 🆘 Rollback

If something goes wrong and you need to start over:

### Remove v3.1-specific indexes (safe):
```sql
DROP INDEX IF EXISTS idx_cards_prompt_version;
DROP INDEX IF EXISTS idx_cards_evaluation_status;
```

### Remove optional table (if you don't need multi-evaluation):
```sql
DROP TABLE IF EXISTS card_evaluations CASCADE;
```

### Reset prompt_version (if needed):
```sql
UPDATE cards SET prompt_version = NULL WHERE prompt_version = '3.1';
```

---

## ✅ Success Checklist

After running the schema:
- [ ] No errors in SQL output
- [ ] `SELECT * FROM cards LIMIT 1;` returns results (if you have cards)
- [ ] Storage bucket 'cards' exists (check Storage tab)
- [ ] RLS policies are enabled (check Authentication > Policies)
- [ ] Upload and grade a test card successfully
- [ ] New card has `opencv_version = "3.1"` in database

---

## 📞 Support

**Schema looks good?**
✅ Proceed to test with `npm run dev` and upload a card!

**Schema has errors?**
1. Check the error message carefully
2. Verify you're connected to the right database
3. Try running just the first section (CREATE TABLE)
4. Check Supabase logs for details

---

**Next Step:** Upload a card and verify v3.1 data appears in the `ai_grading` column!
