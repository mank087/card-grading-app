# DVG v1 Browser Cache Issue - Fix Guide

## 🔍 Problem Diagnosis

Your browser is **caching the old JavaScript** and calling `/api/sports/[id]` (v3.4.1) instead of `/api/vision-grade/[id]` (DVG v1), even though the source code has been updated.

**Evidence from logs:**
```
[GET /api/sports/b6d04d1f-1706-499e-814e-887210d38772] Starting sports card grading request
[OPENCV-v3.1] Attempting hybrid card detection...
```

Should be:
```
[DVG v1 GET] Starting vision grading for card...
[DVG v1] Creating thread...
```

---

## ✅ Fixes Implemented

I've updated the frontend with:

1. **Debug logging** - You'll now see `[FRONTEND DEBUG]` messages showing exactly what endpoint is being called
2. **Cache-busting** - Added `?t=${Date.now()}` to force fresh API calls
3. **Both locations updated** - Initial fetch AND retry fetch

**Files changed:**
- `src/app/sports/[id]/page.tsx` (lines 446-447, 486-487)

---

## 🔧 Steps to Fix (When You Return)

### Step 1: Clear Browser Cache (REQUIRED)

**Option A: Hard Refresh (Quickest)**
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

**Option B: Clear Cache in DevTools**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Option C: Use Incognito/Private Window**
- Open new incognito/private browser window
- Navigate to http://localhost:3000/upload/sports
- Upload card there

---

### Step 2: Restart Dev Server

```bash
# Stop server (Ctrl+C if running)
npm run dev
```

Wait for:
```
✓ Ready in XXXms
```

---

### Step 3: Test Upload

1. Go to: http://localhost:3000/upload/sports
2. Upload a new card (front + back)
3. Watch console logs

---

## 🎯 What to Look For

### ✅ SUCCESS - You'll see:

**Browser Console (F12):**
```
[FRONTEND DEBUG] Calling DVG v1 endpoint: /api/vision-grade/abc-123
[FRONTEND DEBUG] DVG v1 API response status: 200
```

**Server Console:**
```
[DVG v1 GET] Starting vision grading for card abc-123
[DVG v1] Using assistant: asst_vhY692wJLfgVbNfGwi7Mkccz
[DVG v1] Creating thread...
[DVG v1] Thread created: thread_xxx
[DVG v1] Run created: run_xxx
[DVG v1] Waiting for completion...
[DVG v1] Run completed successfully
[DVG v1] Grading completed successfully
[DVG v1] Grade: 8.5
[DVG v1] Grading completed in 15000ms
```

**Results Page:**
- "DVG v1 Grading Results" section
- Large decimal grade display
- Image quality grade (A/B/C/D)
- Positives/Issues lists
- NO OpenCV or Stage 1/2 sections

---

### ❌ STILL BROKEN - You'll see:

**Server Console:**
```
[GET /api/sports/abc-123] Starting sports card grading request
[OPENCV-v3.1] Attempting hybrid card detection...
[STAGE 1] Creating observation thread...
[STAGE 2] Creating scoring thread...
```

**If this happens:**
1. Browser cache is STILL cached
2. Try **incognito window** (guaranteed fresh)
3. OR clear ALL browser data (not just cache)

---

## 🔍 Additional Debugging

### Check Network Tab (DevTools)

1. Open DevTools (F12)
2. Go to Network tab
3. Upload card
4. Look for API call
5. Should see: `vision-grade` NOT `sports`

### Check Compiled Route

After restart, check logs for:
```
○ Compiling /api/vision-grade/[id] ...
✓ Compiled /api/vision-grade/[id] in XXXms
```

NOT:
```
○ Compiling /api/sports/[id] ...
```

---

## 🚨 Nuclear Option (If Nothing Works)

If browser cache persists:

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Delete ALL caches
powershell -Command "Remove-Item -Recurse -Force .next"

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall
npm install

# 5. Restart
npm run dev

# 6. Use INCOGNITO window
# Open new incognito/private window
# Go to http://localhost:3000/upload/sports
```

---

## 📊 Expected Flow

```
User uploads card
       ↓
Frontend: /api/vision-grade/{cardId}
       ↓
DVG v1 Route: Checks for existing grading
       ↓
visionGrader.ts: Creates thread + images
       ↓
OpenAI Assistant (asst_vhY692wJLfgVbNfGwi7Mkccz)
       ↓
Assistant analyzes images (~15-20 sec)
       ↓
Returns JSON with grade
       ↓
Save to database (dvg_grading, dvg_decimal_grade, etc.)
       ↓
Display DVG v1 results
```

**NO OpenCV, NO Stage 1/2, NO multi-stage pipeline!**

---

## ✅ Checklist When You Return

- [ ] Stop dev server
- [ ] Restart: `npm run dev`
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] OR use incognito window
- [ ] Upload NEW card
- [ ] Check console for `[FRONTEND DEBUG]` messages
- [ ] Verify calling `/api/vision-grade/`
- [ ] Check server logs for `[DVG v1]` messages
- [ ] See DVG v1 results on page

---

## 📝 Summary

**Root Cause:** Browser JavaScript cache serving old compiled code

**Solution:** Hard refresh + incognito window + cache-busting query params

**Verification:** Look for `[DVG v1]` logs, NOT `[OPENCV-v3.1]` or `[STAGE 1/2]`

---

**Last Updated:** After implementing debug logging and cache-busting
**Status:** Ready to test when you return
