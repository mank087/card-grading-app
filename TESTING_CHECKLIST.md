# 🧪 Testing Checklist - Complete System

## ✅ Pre-Test Setup

- [x] Updated Stage 1 assistant (`asst_EbYus9ZeLMrGHw9ICEfQ99vm`) with `stage1_measurement_instructions.txt`
- [x] Updated Stage 2 assistant (`asst_XjzIEKt9P6Gj6aXRFe91jwV3`) with `stage2_evaluation_instructions.txt`
- [ ] OpenCV service running (port 5001)
- [ ] Next.js app running (port 3000)

## 🚀 Start Services

Run: **`start_all_services.bat`**

Expected output:
```
[1/2] Starting OpenCV Service...
[2/2] Starting Next.js Application...
✅ All Services Started!
```

Verify OpenCV:
- [ ] Browser shows JSON at http://localhost:5001/health

## 🧪 Test 1: Well-Centered Card (Expected Grade: 9-10)

### Upload Steps
1. Go to http://localhost:3000/upload/sports
2. Upload front and back images of a well-centered card
3. Click "Grade Card"

### Expected Console Output
```
[OPENCV] Attempting OpenCV centering detection...
[OPENCV] ✅ Detection successful
[OPENCV] Front centering: { horizontal: "55/45", vertical: "52/48" }
[TWO-STAGE] ✅ Using OpenCV pixel-based centering
[STAGE1] Measurement data extracted successfully
[STAGE2] Evaluation data extracted successfully
[SIMPLIFIED DEDUCTION] Centering Starting Grade: 10, Total Defect Count: 0-2, Final Grade: 8-10
```

### Expected Card Results
- [ ] **Centering Starting Grade**: 10
- [ ] **measurement_source**: "OpenCV"
- [ ] **measurement_method**: "Enhanced Threshold-Based Detection"
- [ ] **Front/Back Ratios**: Realistic (e.g., 55/45, 52/48) - NOT all 50/50
- [ ] **Total Defect Count**: 0-2 (for a clean card)
- [ ] **Final Grade**: 8-10
- [ ] **AI Confidence**: "A" (should match across all sections)
- [ ] **PSA Estimate**: Actual grade (e.g., "10" or "9") - NOT "N/A"
- [ ] **Card Name**: Extracted correctly - NOT "N/A"
- [ ] **Player Name**: Extracted correctly - NOT "N/A"

## 🧪 Test 2: Off-Center Card (Expected Grade: 5-8)

### Upload Steps
1. Upload front and back of an off-center card
2. Click "Grade Card"

### Expected Console Output
```
[OPENCV] ✅ Detection successful
[OPENCV] Front centering: { horizontal: "70/30", vertical: "65/35" }
[STAGE2] Evaluation data extracted successfully
[SIMPLIFIED DEDUCTION] Centering Starting Grade: 8 (or lower), Total Defect Count: X, Final Grade: 5-8
```

### Expected Card Results
- [ ] **Centering Starting Grade**: <10 (e.g., 8, 7, or lower)
- [ ] **Front/Back Ratios**: Poor centering visible (e.g., 70/30, 75/25)
- [ ] **off_center_detected**: true (if ratio ≥65/35)
- [ ] **Final Grade**: Lower than Test 1
- [ ] **measurement_source**: "OpenCV"

## 🧪 Test 3: Factory Autograph Card (Expected: NOT flagged as alteration)

### Upload Steps
1. Upload a factory autograph card (Prizm, Chrome, etc.)
2. Click "Grade Card"

### Expected Console Output
```
[STAGE2] Evaluation data extracted successfully
[SAFEGUARD] Forcing altered_writing = false for factory/certified autograph
```

### Expected Card Results
- [ ] **Autographed**: "Yes"
- [ ] **Autograph Type**: "On-card autograph (factory)"
- [ ] **altered_writing**: false
- [ ] **Grade**: Based on condition, NOT penalized for autograph

## 🧪 Test 4: Card with Visible Defects (Expected Grade: <9)

### Upload Steps
1. Upload a card with visible corner wear, edge damage, or surface scratches
2. Click "Grade Card"

### Expected Console Output
```
[STAGE1] Measurement data extracted successfully
[STAGE2] Evaluation data extracted successfully
[SIMPLIFIED DEDUCTION] Total Defect Count: 3-10, Final Grade: 5-7
```

### Expected Card Results
- [ ] **Total Defect Count**: >0 (should detect actual defects)
- [ ] **Defects List**: Shows specific defects (e.g., corners_front_whitening: true)
- [ ] **Final Grade**: 10 - defect count (realistic grade <9)
- [ ] **NOT 10/B**: Should see actual defect deductions

## 🧪 Test 5: OpenCV Service Down (Fallback Test)

### Setup
1. Stop OpenCV service (Ctrl+C in OpenCV terminal)
2. Keep Next.js running

### Upload Steps
1. Upload any card
2. Click "Grade Card"

### Expected Console Output
```
[OPENCV] ⚠️ Service unavailable or error: connect ECONNREFUSED 127.0.0.1:5001
[OPENCV] Falling back to AI vision for centering
[TWO-STAGE] ⚠️ OpenCV unavailable, AI will measure centering
[STAGE1] Measurement data extracted successfully (centering measured by AI)
```

### Expected Card Results
- [ ] **measurement_source**: "AI Vision"
- [ ] **measurement_method**: "Visual Analysis"
- [ ] **System continues working**: No errors, card gets graded
- [ ] **Centering ratios**: Still realistic (AI retry logic should prevent 50/50)

## ✅ Success Criteria Summary

### All Tests Should Show:
1. ✅ **Realistic centering ratios** - NOT all 50/50
2. ✅ **Card details extracted** - Name, player, set NOT "N/A"
3. ✅ **Defects detected** - Total count >0 for damaged cards
4. ✅ **Grades vary** - NOT all cards getting 10/B
5. ✅ **OpenCV preferred** - "measurement_source": "OpenCV" when service running
6. ✅ **AI fallback works** - System continues if OpenCV down
7. ✅ **Autograph safeguard** - Factory autos NOT flagged as alterations
8. ✅ **Confidence matches** - AI Confidence section matches Final Grade confidence

## 🐛 If Something Fails

### Cards still getting 10/B
- [ ] Verify assistants updated in OpenAI dashboard
- [ ] Check Stage 1 returns `visual_defects` object with 38 fields
- [ ] Check Stage 2 counts all defects

### Centering still 50/50
- [ ] Verify OpenCV service is running
- [ ] Check `measurement_source` shows "OpenCV"
- [ ] If "AI Vision", check retry logic triggered

### Card details still "N/A"
- [ ] Verify Stage 1 assistant has "TASK 2: CARD INFORMATION EXTRACTION"
- [ ] Check Stage 1 returns `card_information` object

### OpenCV errors
- [ ] Check Python service console for error messages
- [ ] Verify images are downloading correctly
- [ ] Check threshold detection logs

## 📊 Sample Test Cards

### Good Test Cards:
- **Well-centered modern card**: Should get 9-10
- **Vintage off-center card**: Should get 6-8
- **Factory auto (Prizm/Chrome)**: Should NOT get altered_writing flag
- **Card with corner wear**: Should detect corners_front_whitening

### After All Tests:
- [ ] At least one card graded <10
- [ ] At least one card with defects detected
- [ ] OpenCV used for centering (when service running)
- [ ] All card details extracted correctly

---

**Status**: Ready to Test
**Next**: Upload test cards and verify results!
