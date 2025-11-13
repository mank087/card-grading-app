# Conversational Grading v3.3 - Manual Migration Guide

**Date:** October 24, 2025
**Status:** Ready to Execute

---

## 📋 Overview

The v3.3 database migration adds 16 new fields to the `cards` table to support enhanced grading features:

### **New Fields Added:**
1. **Rarity Classification** (9 fields)
   - `rarity_tier` - Primary rarity classification (1-of-1, SSP, SP, etc.)
   - `serial_number_fraction` - Serial number (e.g., "12/99")
   - `autograph_type` - on-card, sticker, unverified, or none
   - `memorabilia_type` - patch, fabric, relic, jersey, etc.
   - `finish_material` - foil, matte, refractor, chrome, etc.
   - `rookie_flag` - yes, no, or potential
   - `subset_insert_name` - Name of subset or insert series
   - `special_attributes` - die-cut, acetate, booklet, etc.
   - `rarity_notes` - Additional rarity notes

2. **Enhanced Grading Metadata** (4 fields)
   - `weighted_total_pre_cap` - Score before grade caps applied
   - `capped_grade_reason` - Explanation if grade was capped
   - `conservative_rounding_applied` - Boolean flag
   - `lighting_conditions_notes` - Lighting/glare documentation

3. **Defect Coordinate Tracking** (2 fields)
   - `defect_coordinates_front` - JSONB array of front defects with (X%, Y%) positions
   - `defect_coordinates_back` - JSONB array of back defects with (X%, Y%) positions

4. **Cross-Side Verification** (1 field)
   - `cross_side_verification_result` - Crease detection result

---

## 🚀 How to Run the Migration

### **Option 1: Supabase SQL Editor (Recommended)**

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open: `C:\Users\benja\card-grading-app\migrations\conversational_grading_v3_3_migration_fixed.sql`
   - Select all content (Ctrl+A)
   - Copy (Ctrl+C)

4. **Paste and Run**
   - Paste into SQL Editor (Ctrl+V)
   - Click "Run" button (or press F5)
   - Wait for "Success" message

5. **Verify**
   - You should see: "Successfully ran 1 query in [time]"
   - No error messages should appear

### **Option 2: Using psql (Alternative)**

If you have PostgreSQL tools installed:

```bash
psql "your-supabase-connection-string" -f migrations/conversational_grading_v3_3_migration_fixed.sql
```

---

## ✅ Verification

After running the migration, verify the new columns exist:

```sql
-- Run this in Supabase SQL Editor
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cards'
AND column_name IN (
  'rarity_tier',
  'defect_coordinates_front',
  'conservative_rounding_applied',
  'cross_side_verification_result'
)
ORDER BY column_name;
```

**Expected Result:**
You should see 4 rows showing the new columns.

---

## 🔍 What This Migration Does

### **1. Adds New Columns**
- 16 new fields added to `cards` table
- All use `IF NOT EXISTS` to safely run multiple times
- No existing data is modified

### **2. Creates Indexes**
- 6 new indexes for performance:
  - `idx_cards_rarity_tier` - Fast filtering by rarity
  - `idx_cards_autograph_type` - Fast autograph filtering
  - `idx_cards_rookie_flag` - Fast rookie card filtering
  - `idx_cards_cross_verification` - Fast structural issue filtering
  - `idx_cards_defects_front_gin` - Fast JSON defect queries (front)
  - `idx_cards_defects_back_gin` - Fast JSON defect queries (back)

### **3. Backward Compatible**
- All new fields are nullable
- Existing cards continue to work
- Old grading system unaffected
- New fields only populated for cards graded with v3.3

---

## 🛡️ Safety Notes

✅ **Safe to run multiple times** - All statements use `IF NOT EXISTS`
✅ **No data loss** - Only adds new columns, doesn't modify existing data
✅ **Backward compatible** - Existing cards continue to work
✅ **Reversible** - Can drop columns if needed (see rollback section)

---

## 🔄 Rollback (If Needed)

If you need to undo the migration:

```sql
-- WARNING: This will delete all v3.3 data!
-- Only run if you need to rollback the migration

ALTER TABLE cards DROP COLUMN IF EXISTS rarity_tier;
ALTER TABLE cards DROP COLUMN IF EXISTS serial_number_fraction;
ALTER TABLE cards DROP COLUMN IF EXISTS autograph_type;
ALTER TABLE cards DROP COLUMN IF EXISTS memorabilia_type;
ALTER TABLE cards DROP COLUMN IF EXISTS finish_material;
ALTER TABLE cards DROP COLUMN IF EXISTS rookie_flag;
ALTER TABLE cards DROP COLUMN IF EXISTS subset_insert_name;
ALTER TABLE cards DROP COLUMN IF EXISTS special_attributes;
ALTER TABLE cards DROP COLUMN IF EXISTS rarity_notes;
ALTER TABLE cards DROP COLUMN IF EXISTS weighted_total_pre_cap;
ALTER TABLE cards DROP COLUMN IF EXISTS capped_grade_reason;
ALTER TABLE cards DROP COLUMN IF EXISTS conservative_rounding_applied;
ALTER TABLE cards DROP COLUMN IF EXISTS lighting_conditions_notes;
ALTER TABLE cards DROP COLUMN IF EXISTS defect_coordinates_front;
ALTER TABLE cards DROP COLUMN IF EXISTS defect_coordinates_back;
ALTER TABLE cards DROP COLUMN IF EXISTS cross_side_verification_result;

DROP INDEX IF EXISTS idx_cards_rarity_tier;
DROP INDEX IF EXISTS idx_cards_autograph_type;
DROP INDEX IF EXISTS idx_cards_rookie_flag;
DROP INDEX IF EXISTS idx_cards_cross_verification;
DROP INDEX IF EXISTS idx_cards_defects_front_gin;
DROP INDEX IF EXISTS idx_cards_defects_back_gin;
```

---

## 📊 Migration File Locations

- **Main Migration (with comments):**
  `migrations/conversational_grading_v3_3_migration.sql`

- **Fixed Migration (simplified):**
  `migrations/conversational_grading_v3_3_migration_fixed.sql` ← **Use this one**

- **Automated Script (doesn't work with Supabase):**
  `run_v3_3_migration.js`

---

## 🎯 Next Steps After Migration

Once the migration is complete:

1. ✅ **Phase 2 Complete** - Database schema updated
2. ⏭️ **Phase 3** - Update AI assistant configuration
3. ⏭️ **Phase 4** - Update TypeScript interfaces and backend logic
4. ⏭️ **Phase 5** - Update frontend displays
5. ⏭️ **Phase 6** - Test new features

---

## ❓ Troubleshooting

### **Error: "relation cards does not exist"**
- You're in the wrong schema
- Run: `SET search_path TO public;` before migration
- Or check if your table is named differently

### **Error: "column already exists"**
- This is OK! The migration is idempotent
- It means the column was already added
- Continue to next step

### **Error: "permission denied"**
- You need admin/superuser access
- Log in to Supabase dashboard as project owner
- Or contact your database administrator

---

## 📞 Support

If you encounter issues:

1. Check the error message carefully
2. Verify you're connected to the correct database
3. Ensure you have admin permissions
4. Try running statements one at a time to isolate the issue

---

**Migration prepared by:** Claude Code Assistant
**Version:** Conversational Grading v3.3
**Date:** October 24, 2025
