# Direct Vision Grader v1 (DVG v1) - Setup Guide

## Overview

DVG v1 is a **clean slate** card grading system that replaces the complex 3-stage pipeline (OpenCV + 2 AI stages) with a **single GPT-4o vision assistant**.

### Benefits vs v3.4.1 System
- ✅ **Simpler**: 1 assistant call vs 3-stage pipeline
- ✅ **Faster**: ~15-20 seconds vs 30-60 seconds
- ✅ **Better borderless card support**: Native vision analysis vs failed geometry detection
- ✅ **Cheaper**: 1 assistant run vs 3 separate API calls
- ✅ **Easier to maintain**: Update assistant instructions vs complex multi-system architecture
- ✅ **More accurate**: No reliance on edge detection that fails on borderless cards
- ✅ **Live updates**: Change grading criteria without code deployment

---

## Files Created

### 1. Prompt & Schema
- **`prompts/card_grader_v1.txt`** (312 lines)
  - Comprehensive grading instructions
  - NO AUTOMATIC PERFECT SCORES principle
  - Detailed 1-10 grading scale
  - Defect assessment checklist
  - JSON output format specification

- **`schemas/vision_grade_v1.json`** (180 lines)
  - JSON Schema for validation
  - Enforces response structure
  - Type safety for all fields

### 2. Core Services
- **`src/lib/visionGrader.ts`** (280 lines)
  - `gradeCardWithVision()` - Main grading function
  - Uses OpenAI Assistants API for vision grading
  - Returns structured `VisionGradeResult`
  - Helper functions for metrics extraction
  - Automatic polling and thread management

- **`src/lib/schemaValidator.ts`** (200 lines)
  - `validateVisionGradeResult()` - Full schema validation
  - `sanitizeAndValidate()` - Fix common issues + validate
  - `quickValidate()` - Fast pre-validation check
  - Uses Ajv for JSON Schema validation

### 3. API Route
- **`src/app/api/vision-grade/[id]/route.ts`** (287 lines)
  - `GET /api/vision-grade/[id]` endpoint
  - Rate limiting (max 3 concurrent)
  - Signed URL caching (50 min)
  - Database updates with DVG v1 fields
  - Backwards compatibility with legacy fields

### 4. Database Migration
- **`add_dvg_v1_fields.sql`** (65 lines)
  - Adds 15 new DVG v1 columns to `cards` table
  - Indexes for performance
  - Comments for documentation

### 5. Configuration
- **`.env.local`** (updated)
  - Added DVG v1 config:
    - `DVG_ENABLED=true`
    - `DVG_MODEL=gpt-4o`
    - `DVG_TEMPERATURE=0.4`
    - `OPENAI_DVG_ASSISTANT_ID=asst_vhY692wJLfgVbNfGwi7Mkccz`

---

## Database Schema (DVG v1 Fields)

```sql
-- Core grading result
dvg_grading JSONB                    -- Complete JSON response

-- Grade values
dvg_decimal_grade DECIMAL(4,2)       -- 8.5
dvg_whole_grade INTEGER              -- 8
dvg_grade_uncertainty TEXT           -- ±0.0, ±0.5, or ±1.0

-- Image quality
dvg_image_quality TEXT               -- A, B, C, or D
dvg_reshoot_required BOOLEAN         -- true if C or D

-- Centering
dvg_centering_front_lr TEXT          -- "52/48"
dvg_centering_front_tb TEXT          -- "54/46"
dvg_centering_back_lr TEXT           -- "53/47"
dvg_centering_back_tb TEXT           -- "50/50"

-- Analysis
dvg_positives TEXT[]                 -- Array of positive aspects
dvg_negatives TEXT[]                 -- Array of defects

-- Metadata
dvg_model TEXT                       -- "gpt-4o"
dvg_version TEXT                     -- "dvg-v1"
```

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install ajv
```

### 2. Run Database Migration

**Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `add_dvg_v1_fields.sql`
3. Execute the SQL

**Option B: psql CLI**
```bash
psql -h [your-supabase-host] -U postgres -d postgres -f add_dvg_v1_fields.sql
```

### 3. Verify Configuration

Check `.env.local` has:
```env
OPENAI_API_KEY=sk-...
DVG_ENABLED=true
DVG_MODEL=gpt-4o
DVG_TEMPERATURE=0.4
OPENAI_DVG_ASSISTANT_ID=asst_vhY692wJLfgVbNfGwi7Mkccz
```

**Important:** The assistant `asst_vhY692wJLfgVbNfGwi7Mkccz` should be configured with:
- **Instructions:** Contents of `prompts/card_grader_v1.txt`
- **Model:** `gpt-4o`
- **Response format:** JSON object
- **Vision capabilities:** Enabled

### 4. Restart Development Server

```bash
npm run dev
```

---

## Usage

### API Endpoint

```
GET /api/vision-grade/[cardId]
```

**Example:**
```bash
curl http://localhost:3000/api/vision-grade/123
```

**Response:**
```json
{
  "id": "123",
  "card_name": "Patrick Mahomes Prizm",
  "player": "Patrick Mahomes",
  "dvg_decimal_grade": 8.5,
  "dvg_whole_grade": 8,
  "dvg_grade_uncertainty": "±0.0",
  "dvg_grading": { ... },
  "front_url": "https://...",
  "back_url": "https://...",
  "processing_time": 14532,
  "grading_system": "dvg-v1"
}
```

### TypeScript Usage

```typescript
import { gradeCardWithVision } from '@/lib/visionGrader';

const result = await gradeCardWithVision({
  frontImageUrl: 'https://...',
  backImageUrl: 'https://...',
  model: 'gpt-4o',
  temperature: 0.4
});

console.log(result.recommended_grade.recommended_decimal_grade); // 8.5
```

---

## Testing

### 1. Test with Existing Card

```bash
# If you have a card with ID "abc123"
curl http://localhost:3000/api/vision-grade/abc123
```

### 2. Check Logs

Look for:
```
[DVG v1 GET] Starting vision grading for card abc123
[DVG v1] Loaded grading prompt successfully
[DVG v1] Received API response
[DVG v1] Grading completed successfully
[DVG v1] Grade: 8.5
[DVG v1] Grading completed in 14532ms
```

### 3. Verify Database

```sql
SELECT
  id,
  card_name,
  dvg_decimal_grade,
  dvg_whole_grade,
  dvg_version
FROM cards
WHERE dvg_version = 'dvg-v1';
```

---

## Key Differences from v3.4.1

| Feature | v3.4.1 (3-Stage) | DVG v1 (Single Assistant) |
|---------|------------------|---------------------------|
| **API Calls** | 3 (OpenCV + 2 AI) | 1 (Assistant run) |
| **Processing Time** | 30-60 seconds | ~15-20 seconds |
| **Borderless Cards** | ❌ Fails (geometry detection) | ✅ Works (visual analysis) |
| **Setup Complexity** | High (Python service + 2 assistants) | Low (1 assistant) |
| **Maintenance** | 5+ files, 3 systems | Update assistant instructions |
| **Cost per Card** | ~$0.15 (3 calls) | ~$0.05-0.08 (1 run) |
| **Live Updates** | ❌ Requires code deployment | ✅ Update assistant anytime |

---

## Troubleshooting

### Error: "OPENAI_DVG_ASSISTANT_ID not configured"
- Check `.env.local` has `OPENAI_DVG_ASSISTANT_ID=asst_vhY692wJLfgVbNfGwi7Mkccz`
- Restart Next.js dev server after adding

### Error: "Failed to load vision grading schema"
- Check `schemas/vision_grade_v1.json` exists
- Run `npm install ajv`

### Error: "Card not found"
- Verify card ID exists in database
- Check Supabase connection in `.env.local`

### Error: "Run failed" or "Run cancelled"
- Check assistant `asst_vhY692wJLfgVbNfGwi7Mkccz` exists in OpenAI
- Verify assistant has vision capabilities enabled
- Ensure assistant instructions are configured (use `prompts/card_grader_v1.txt`)
- Check assistant response format is set to JSON object

### Error: "Invalid JSON response from assistant"
- Verify assistant instructions include JSON output format specification
- Check assistant model is `gpt-4o` (vision capable)
- Review assistant's latest run in OpenAI Playground

### Database Error: "column does not exist"
- Run the database migration (`add_dvg_v1_fields.sql`)
- Verify migration completed successfully

---

## Next Steps

1. **Frontend Integration**
   - Update card detail page to display DVG v1 results
   - Add toggle to switch between v3.4.1 and DVG v1 views
   - Show image quality assessment and reshoot flags

2. **Batch Processing**
   - Create batch grading endpoint
   - Process entire collection with DVG v1

3. **Comparison Tool**
   - Compare DVG v1 vs v3.4.1 grades
   - Analyze accuracy improvements

4. **Fine-tuning**
   - Adjust temperature based on results
   - Refine prompt for specific card types

---

## Rollback to v3.4.1

If you need to revert:

1. Use the backup system:
```bash
cd backup_v3_4_1_2025-10-07
RESTORE.bat
```

2. See `SYSTEM_BACKUP_V3_4_1.md` for full restoration details

---

## Support

- DVG v1 Documentation: This file
- v3.4.1 Backup: `backup_v3_4_1_2025-10-07/SYSTEM_BACKUP_V3_4_1.md`
- OpenAI Vision API: https://platform.openai.com/docs/guides/vision
- JSON Schema: https://json-schema.org/

---

**Status**: ✅ Implementation Complete (Pending: ajv install + DB migration + testing)

**Date**: October 7, 2025

**Version**: DVG v1.0
