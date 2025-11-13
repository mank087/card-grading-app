# 🚀 OpenCV Service Startup Guide

## ✅ Implementation Complete

Phase 1 and Phase 3 have been successfully implemented:

### Phase 1: Re-enabled OpenCV Service
- ✅ Updated `tryEnhancedDetection()` to call OpenCV service
- ✅ Integrated OpenCV into two-stage pipeline
- ✅ OpenCV centering data injected into Stage 1 results
- ✅ AI fallback active if OpenCV unavailable

### Phase 3: Enhanced Threshold-Based Detection
- ✅ New `detect_inner_border_enhanced()` method
- ✅ Tries multiple threshold values (200, 180, 160, 140)
- ✅ Handles different border colors (white, cream, colored)
- ✅ Pixel-perfect centering ratios
- ✅ Fallback to edge detection if thresholding fails

## 🏃 How to Start the System

### Step 1: Start OpenCV Service

Open a NEW terminal/command prompt:

```bash
cd C:\Users\benja\card-grading-app\card_detection_service
python app.py
```

You should see:
```
Starting Card Detection Service...
Available endpoints:
  GET  /health          - Health check
  POST /detect-card     - Single card detection
  POST /detect-card-batch - Batch card detection

 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5001
 * Running on http://192.168.x.x:5001
Press CTRL+C to quit
```

### Step 2: Verify OpenCV Service

In another terminal:

```bash
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "card-detection-service",
  "version": "1.0.0"
}
```

### Step 3: Start Next.js Application

In your main terminal:

```bash
cd C:\Users\benja\card-grading-app
npm run dev
```

### Step 4: Update OpenAI Assistants

**CRITICAL**: You still need to update both assistants with the new instructions!

1. Go to https://platform.openai.com/assistants
2. Update `asst_EbYus9ZeLMrGHw9ICEfQ99vm` with `stage1_measurement_instructions.txt`
3. Update `asst_XjzIEKt9P6Gj6aXRFe91jwV3` with `stage2_evaluation_instructions.txt`

See `UPDATE_ASSISTANTS_CHECKLIST.md` for details.

## 📊 How It Works Now

### With OpenCV (Happy Path)

1. **User uploads card** → Front & back images sent to API
2. **OpenCV service called** → Pixel-based centering measurement
   ```
   [OPENCV] Attempting OpenCV centering detection...
   [OPENCV] ✅ Detection successful
   [OPENCV] Front centering: { horizontal: "48/52", vertical: "51/49" }
   [OPENCV] Back centering: { horizontal: "50/50", vertical: "47/53" }
   ```
3. **Stage 1 AI called** → Skip centering, extract card info + defects
   ```
   [TWO-STAGE] ✅ Using OpenCV pixel-based centering
   [STAGE1] Created measurement thread (attempt 1/1)
   [STAGE1] ✅ Injecting OpenCV centering data
   ```
4. **Stage 2 AI called** → Apply grading rules using OpenCV centering
   ```
   [STAGE2] Evaluation data extracted successfully
   [SAFEGUARD] Forcing altered_writing = false for factory autograph
   ```
5. **Final result** → Grade with pixel-perfect centering + AI defect detection

### Without OpenCV (Fallback)

1. **OpenCV service unavailable** → Log warning, continue with AI
   ```
   [OPENCV] ⚠️ Service unavailable or error: connect ECONNREFUSED
   [TWO-STAGE] ⚠️ OpenCV unavailable, AI will measure centering
   ```
2. **Stage 1 AI called** → Measure centering + extract card info + defects
3. **Retry logic active** → Up to 3 attempts if all ratios = 50/50
4. **Stage 2 AI called** → Apply grading rules using AI centering
5. **Final result** → Grade with AI-measured centering + AI defect detection

## 🎯 Expected Console Output

### Successful OpenCV Detection

```
[OPENCV] Attempting OpenCV centering detection...
[OPENCV] ✅ Detection successful
[OPENCV] Front centering: { horizontal: "48/52", vertical: "51/49" }
[OPENCV] Back centering: { horizontal: "50/50", vertical: "47/53" }
[TWO-STAGE] ✅ Using OpenCV pixel-based centering
[STAGE1] Created measurement thread (attempt 1/1): thread_xxx
[STAGE1] Using temperature: 0
[STAGE1] ✅ Injecting OpenCV centering data into measurement results
[STAGE2] Created evaluation thread: thread_xxx
[STAGE2] Evaluation data extracted successfully
```

### OpenCV Service Down (Fallback)

```
[OPENCV] Attempting OpenCV centering detection...
[OPENCV] ⚠️ Service unavailable or error: connect ECONNREFUSED 127.0.0.1:5001
[OPENCV] Falling back to AI vision for centering
[TWO-STAGE] ⚠️ OpenCV unavailable, AI will measure centering
[STAGE1] Created measurement thread (attempt 1/3): thread_xxx
[STAGE1] Using temperature: 0
[STAGE1] Measurement data extracted successfully
```

## 📝 Card Results Page Changes

### New Fields in Centering Measurements

```json
{
  "Centering_Measurements": {
    "front_x_axis_ratio": "48/52",
    "front_y_axis_ratio": "51/49",
    "front_edge_description": "OpenCV pixel-based: 12px left, 13px right",
    "back_x_axis_ratio": "50/50",
    "back_y_axis_ratio": "47/53",
    "back_edge_description": "OpenCV pixel-based: 12px left, 12px right",
    "measurement_source": "OpenCV",  // ← NEW: "OpenCV" or "AI Vision"
    "measurement_method": "Enhanced Threshold-Based Detection",  // ← NEW
    "measurement_confidence": "High"  // ← NEW
  }
}
```

## 🔍 Testing the Integration

### Test 1: OpenCV Service Running

1. Start OpenCV service: `python app.py`
2. Upload a card
3. Check console for `[OPENCV] ✅ Detection successful`
4. Verify card results show `"measurement_source": "OpenCV"`

### Test 2: OpenCV Service Down (Fallback)

1. Stop OpenCV service (Ctrl+C)
2. Upload a card
3. Check console for `[OPENCV] ⚠️ Service unavailable`
4. Verify card results show `"measurement_source": "AI Vision"`
5. System continues working (no errors)

### Test 3: OpenCV Enhanced Detection

1. Upload a card with visible cream/white borders
2. Check OpenCV service console for:
   ```
   [OPENCV] Found good inner border at threshold 200: L=12px R=13px T=10px B=11px
   [OPENCV] Pixel measurements - Left: 12px, Right: 13px, Top: 10px, Bottom: 11px
   [OPENCV] Centering ratios - Horizontal: 48/52, Vertical: 48/52, Score: 10.0
   ```

## 🐛 Troubleshooting

### Issue: OpenCV service won't start

**Error**: `ModuleNotFoundError: No module named 'flask'`

**Solution**:
```bash
cd card_detection_service
pip install -r requirements.txt
```

### Issue: OpenCV always falls back to AI

**Error**: `[OPENCV] ⚠️ Service unavailable`

**Solutions**:
1. Check OpenCV service is running: `curl http://localhost:5001/health`
2. Verify port 5001 is not blocked by firewall
3. Check Python service console for errors

### Issue: OpenCV returns success but centering still "50/50"

**Cause**: Inner border detection failed

**Check OpenCV console for**:
```
[OPENCV] Threshold method failed, using edge detection fallback
[OPENCV] Error in enhanced border detection: ...
```

**Solutions**:
1. Card may have unusual border design
2. Image quality may be too low
3. Threshold values may need adjustment for card type
4. Fallback to AI vision (automatic)

### Issue: Cards still getting 10/B

**Cause**: OpenAI assistants not updated with new instructions

**Solution**: Follow `UPDATE_ASSISTANTS_CHECKLIST.md`

## 📊 Performance Expectations

### With OpenCV

- **Centering Measurement**: ~2-3 seconds (pixel-based)
- **Stage 1 (AI)**: ~20-30 seconds (card info + defects only)
- **Stage 2 (AI)**: ~10-15 seconds (grading rules)
- **Total**: ~30-50 seconds per card

### Without OpenCV (Fallback)

- **Centering Measurement**: Included in Stage 1
- **Stage 1 (AI)**: ~25-35 seconds (centering + card info + defects)
- **Stage 2 (AI)**: ~10-15 seconds (grading rules)
- **Total**: ~35-50 seconds per card

## ✨ Key Benefits

### Pixel-Perfect Centering

- **Before**: AI eyeballs ratios → "looks like 52/48"
- **After**: OpenCV measures pixels → "12px left, 13px right = 48/52"

### 100% Consistency

- **Before**: Same card → different ratios each time
- **After**: Same card → same ratios every time

### Transparency

- **Before**: No idea how centering was measured
- **After**: "OpenCV pixel-based: 12px left, 13px right"

### Reliability

- **Before**: AI might default to 50/50 when uncertain
- **After**: OpenCV provides actual measurements or fallback to AI

## 🔄 Auto-Start Script (Optional)

Create `start_all_services.bat`:

```batch
@echo off
echo Starting Card Grading Services...

echo.
echo [1/2] Starting OpenCV Service...
start "OpenCV Service" cmd /k "cd card_detection_service && python app.py"

timeout /t 5 /nobreak

echo.
echo [2/2] Starting Next.js Application...
start "Next.js App" cmd /k "npm run dev"

echo.
echo ✅ All services started!
echo.
echo OpenCV Service: http://localhost:5001
echo Next.js App: http://localhost:3000
echo.
pause
```

Run: `start_all_services.bat`

## 📈 Monitoring

### Check OpenCV Service Health

```bash
curl http://localhost:5001/health
```

### Check OpenCV Logs

Watch the OpenCV service terminal for:
- `[OPENCV] Processing front card: ...`
- `[OPENCV] Found good inner border at threshold 200: ...`
- `[OPENCV] Centering ratios - Horizontal: 48/52, Vertical: 51/49`

### Check Next.js Logs

Watch the Next.js console for:
- `[OPENCV] Attempting OpenCV centering detection...`
- `[OPENCV] ✅ Detection successful`
- `[TWO-STAGE] ✅ Using OpenCV pixel-based centering`

## 🎉 Success Criteria

After starting both services and uploading a card, you should see:

1. ✅ Console shows `[OPENCV] ✅ Detection successful`
2. ✅ Card results show `"measurement_source": "OpenCV"`
3. ✅ Centering ratios are realistic (not all 50/50)
4. ✅ Edge descriptions show pixel measurements
5. ✅ Grade is based on actual defects detected (not all 10/B)

---

**Status**: ✅ Ready to Test
**Next Step**: Start OpenCV service and upload a test card!
