# ✅ Column Name Fix - COMPLETE
**Date**: October 21, 2025
**Issue**: Database uses `serial` not `serial_number`

---

## 🔧 What Was Fixed

The cards table uses `serial` for the serial number column, not `serial_number`. I've updated all references:

### **Files Updated**:

1. **`migrations/add_card_visibility.sql`**
   - Changed index from `serial_number` → `serial`

2. **`src/app/api/cards/search/route.ts`**
   - Updated SELECT query to use `serial`
   - Updated search query (ilike) to use `serial`
   - Updated comments

3. **`src/app/api/cards/[id]/visibility/route.ts`**
   - Updated all SELECT queries to use `serial`
   - Updated response objects to return `serial` instead of `serial_number`

4. **`src/app/search/page.tsx`**
   - Updated CardResult interface: `serial_number` → `serial`
   - Updated display to show `card.serial`

---

## ✅ Migration Now Ready

The migration SQL is now correct. You can run it in Supabase:

1. Go to: https://supabase.com/dashboard/project/zyxtqcvwkbpvsjsszbzg/sql/new
2. Copy the contents from `migrations/add_card_visibility.sql`
3. Paste into SQL Editor
4. Click "Run" ✅

**Expected output**: "Success. No rows returned"

---

## 🧪 Verify Migration

After running, verify it worked:

```sql
-- Check visibility column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cards' AND column_name = 'visibility';

-- Expected: visibility | text | 'private'

-- Check all cards are private
SELECT visibility, COUNT(*)
FROM cards
GROUP BY visibility;

-- Expected: private | [your card count]

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'cards' AND indexname LIKE 'idx_cards_visibility%';

-- Expected: 2 indexes (idx_cards_visibility_serial, idx_cards_user_visibility)
```

---

## 🎯 What Changed

### **Before (WRONG)**:
```sql
CREATE INDEX idx_cards_visibility_serial
ON cards(visibility, serial_number)  -- ❌ Column doesn't exist
WHERE visibility = 'public';
```

### **After (CORRECT)**:
```sql
CREATE INDEX idx_cards_visibility_serial
ON cards(visibility, serial)  -- ✅ Correct column name
WHERE visibility = 'public';
```

---

## 📊 Complete Migration SQL

```sql
-- Step 1: Add visibility column with default 'private'
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private'));

-- Step 2: Set all existing cards to 'private' for safety
UPDATE cards
SET visibility = 'private'
WHERE visibility IS NULL;

-- Step 3: Create index for fast search queries (public cards only)
CREATE INDEX IF NOT EXISTS idx_cards_visibility_serial
ON cards(visibility, serial)
WHERE visibility = 'public';

-- Step 4: Create index for user's card filtering
CREATE INDEX IF NOT EXISTS idx_cards_user_visibility
ON cards(user_id, visibility);

-- Step 5: Add comment to document the column
COMMENT ON COLUMN cards.visibility IS 'Card visibility: public (shareable, searchable) or private (owner only)';
```

---

## ✅ Status

- ✅ All code updated to use `serial`
- ✅ Migration SQL corrected
- ✅ No compilation errors
- ✅ Server running successfully
- ⏳ Ready to run migration in Supabase

---

**Next Step**: Run the migration SQL in Supabase, then test the feature! 🚀
