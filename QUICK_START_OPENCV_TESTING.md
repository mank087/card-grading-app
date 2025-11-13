# Quick Start: OpenCV Testing Tomorrow Morning

**Date:** October 16, 2025
**Status:** Ready to test OpenCV Stage 0 integration

---

## 🚀 How to Start Everything (5 minutes)

### 1. Open Terminal in Project Directory
```bash
cd C:\Users\benja\card-grading-app
```

### 2. Start Next.js Development Server
```bash
npm run dev
```

**Server starts on:** http://localhost:3000

✅ **That's it!** Python OpenCV runs automatically when needed (no separate server).

---

## 🧪 Quick Test: Your Holographic Card

**The card that received 10.0 should now get 9.5**

### Option A: Regrade Existing Card
1. Navigate to card detail page
2. Add `?force_regrade=true` to URL
3. Click "Grade Card" button
4. Watch server logs

### Option B: Delete and Re-Upload
1. Go to Supabase SQL Editor
2. Run: `DELETE FROM cards WHERE id = 'YOUR_CARD_ID';`
3. Re-upload card through UI
4. Grade it

---

## 👀 What to Look For

### **In Server Logs:**
```
[OpenCV Stage 0] Starting OpenCV analysis...
[OpenCV Stage 0] Analysis complete
[OpenCV Reliability] Card boundary detection failed (likely borderless/holographic card or in case)
[OpenCV Grade Cap] Maximum 9.5 - Protective case or borderless card detected
[DVG v2 GET] LLM Grade: 10.0
[OpenCV Grade Cap Applied] 10.0 → 9.5
```

### **On Card Detail Page:**
- **Grade:** Should be ≤ 9.5 (not 10.0)
- **Negatives:** Should include:
  - "⚠️ Grade capped at 9.5: Card in protective case - cannot verify 10.0 grade through plastic"
  - "15,846 pixels of edge whitening detected"
- **Analysis:** Should mention OpenCV measurements

---

## 🐛 If Something Breaks

### Python Not Found?
```bash
"C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe" --version
```
Should output: `Python 3.13.x`

### OpenCV Analysis Failed?
```bash
# Test OpenCV directly
"C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe" opencv_service/card_cv_stage1.py --help
```

### Still Getting 10.0?
1. Check server logs for "[OpenCV Grade Cap Applied]"
2. Verify `?force_regrade=true` in URL
3. Try deleting card and re-uploading

---

## 📊 5 Cards to Test

1. **Holographic card in case** (your original) → Should get 9.5
2. **Raw card with clear borders** → Should use full OpenCV
3. **Borderless card (no case)** → Should fall back to LLM for centering
4. **Mint card in case** → Should cap at 9.5 even if perfect
5. **Damaged card (no case)** → Should detect defects accurately

---

## 📁 Full Documentation

See: `OPENCV_STAGE0_IMPLEMENTATION_COMPLETE.md` for comprehensive details.

---

**Quick Start Time:** 5 minutes
**First Test:** Holographic card → Should now get 9.5 instead of 10.0
