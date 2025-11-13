# DCM v3.1 Quick Start Guide

## 🚀 Starting the System

### 1. Start Flask OpenCV Service (Terminal 1)
```bash
cd card_detection_service
python app.py
```

**Expected output:**
```
[INIT] v3.1 processor loaded successfully
Starting Card Detection Service...
Available endpoints:
  GET  /health          - Health check
  POST /detect-card     - Single card detection
  POST /detect-card-batch - Batch card detection
```

### 2. Start Next.js App (Terminal 2)
```bash
npm run dev
```

### 3. Verify v3.1 is Active
```bash
curl http://localhost:5001/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "card-detection-service",
  "version": "3.1.0",
  "processor": "v3.1 hybrid",
  "features": {
    "borderless_support": true,
    "design_anchor_centering": true,
    "image_quality_grading": true,
    "clahe_enhancement": true
  }
}
```

---

## 📝 Testing Checklist

### Upload Test Cards:
1. ✅ **Standard bordered card** (base card with white borders)
   - Expected: `edge_detection_mode: "standard"`, `centering_type: "border-detected"`

2. ✅ **Borderless full-art card** (Topps Chrome, Prizm, etc.)
   - Expected: `edge_detection_mode: "color-channel"`, `centering_type: "design-anchor"`

3. ✅ **Blurry/low-quality image**
   - Expected: `image_quality_grade: "D"`, `grade_uncertainty: "±1.0"`

4. ✅ **Card with glare/case reflection**
   - Expected: `image_quality_grade: "C"`, `grade_uncertainty: "±0.5"`

5. ✅ **High-quality clear image**
   - Expected: `image_quality_grade: "A"`, `grade_uncertainty: "±0.0"`

---

## 🔍 What to Look For in Console

### Stage 0 (Flask):
```
[v3.1] Standard detection failed for front, trying color-channel fallback
[v3.1] Successfully detected card boundaries
```

### Sports Route (Next.js):
```
[OPENCV-v3.1] Attempting hybrid card detection...
[OPENCV-v3.1] ✅ Hybrid detection successful
[OPENCV-v3.1] Front mode: standard
[OPENCV-v3.1] Back mode: color-channel
[OPENCV-v3.1] Front quality: A
[OPENCV-v3.1] Back quality: B
[TWO-STAGE-v3.1] ✅ Using v3.1 hybrid detection
[TWO-STAGE-v3.1] Front centering type: border-detected
[TWO-STAGE-v3.1] Back centering type: design-anchor
[TWO-STAGE-v3.1] Image quality: A / B
```

---

## 🛠️ Troubleshooting

### Problem: Flask service not starting
**Solution:**
```bash
cd card_detection_service
pip install opencv-python pillow requests flask flask-cors numpy
python app.py
```

### Problem: v3.1 processor not loading
**Check:**
```bash
# Verify file exists
ls card_detection_service/card_processor_v3_1.py

# Check Python imports
python -c "from card_processor_v3_1 import process_card_url; print('OK')"
```

### Problem: Stage 0 fails, but app still works
**Expected behavior:** App falls back to AI-only grading
**Check logs:**
```
[OPENCV-v3.1] Detection failed or low confidence, using AI-only
[TWO-STAGE] ⚠️ OpenCV unavailable, AI will measure centering
```

### Problem: Want to disable v3.1
**Solution:**
```bash
# In terminal or .env file
export USE_OPENCV_V3_1=false

# Restart Flask service
python app.py
```

---

## 📊 Verifying v3.1 Fields in Database

### Query to check v3.1 fields:
```sql
SELECT
  id,
  card_name,
  ai_grading->'Centering_Measurements'->>'opencv_version' as opencv_version,
  ai_grading->'Centering_Measurements'->>'front_centering_type' as front_type,
  ai_grading->'Centering_Measurements'->>'front_image_quality_grade' as front_quality,
  ai_grading->'Centering_Measurements'->>'front_edge_detection_mode' as front_mode
FROM cards
ORDER BY created_at DESC
LIMIT 10;
```

**Expected output:**
```
| id | card_name       | opencv_version | front_type       | front_quality | front_mode  |
|----|-----------------|----------------|------------------|---------------|-------------|
| 123| Patrick Mahomes | 3.1            | border-detected  | A             | standard    |
| 124| LeBron James    | 3.1            | design-anchor    | B             | color-channel|
```

---

## 📦 Files Changed (Summary)

```
✅ New Files:
   - card_detection_service/card_processor_v3_1.py
   - ai_prompts/stage1_instructions_v3_1.txt
   - ai_prompts/stage2_instructions_v3_1.txt
   - schemas/stage1_v3_1.json
   - schemas/stage2_v3_1.json

✅ Modified Files:
   - card_detection_service/app.py
   - src/app/api/sports/[id]/route.ts

✅ No Changes:
   - Frontend components (backward compatible)
   - Database schema (uses existing JSONB)
```

---

## 🎯 Next Steps (When You Return)

1. **Test with real cards** (see testing checklist above)
2. **Update OpenAI Assistants:**
   - Copy `ai_prompts/stage1_instructions_v3_1.txt` to Stage 1 Assistant
   - Copy `ai_prompts/stage2_instructions_v3_1.txt` to Stage 2 Assistant
3. **Monitor for issues:**
   - Check console logs for errors
   - Verify grades are consistent with v2.2
   - Confirm borderless cards are handled correctly
4. **(Optional) Add JSON schema validation** with AJV

---

## 🆘 Emergency Rollback

If something breaks:
```bash
# Disable v3.1
export USE_OPENCV_V3_1=false

# Restart services
cd card_detection_service
python app.py

# In another terminal
npm run dev
```

---

## ✅ Success Indicators

You'll know v3.1 is working when:
- ✅ Health endpoint shows `"processor": "v3.1 hybrid"`
- ✅ Console logs show `[OPENCV-v3.1]` messages
- ✅ Database records have `"opencv_version": "3.1"`
- ✅ Borderless cards show `"centering_type": "design-anchor"`
- ✅ Image quality grades appear (A, B, C, or D)

---

**Questions? Check:** `PHASE_1_V3_1_IMPLEMENTATION_COMPLETE.md` for full details.
