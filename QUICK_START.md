# 🚀 Quick Start Guide - OpenCV Grading System

## Option 1: Start Everything at Once (Recommended)

Double-click: **`start_all_services.bat`**

This will:
1. Start OpenCV service on port 5001
2. Start Next.js app on port 3000
3. Test that OpenCV is responding

## Option 2: Start Services Separately

### Terminal 1 - OpenCV Service

Double-click: **`card_detection_service\start_opencv_service.bat`**

Or manually:
```bash
cd card_detection_service
C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe app.py
```

### Terminal 2 - Next.js App

```bash
npm run dev
```

## ✅ Verify Services Are Running

### Check OpenCV Service

Open browser to: http://localhost:5001/health

Should see:
```json
{
  "status": "healthy",
  "service": "card-detection-service",
  "version": "1.0.0"
}
```

### Check Next.js App

Open browser to: http://localhost:3000

Should see your card grading app.

## 🧪 Test Upload

1. Go to http://localhost:3000/upload/sports
2. Upload front and back images of a card
3. Watch the console logs

### Expected Logs (OpenCV Success)

```
[OPENCV] Attempting OpenCV centering detection...
[OPENCV] Processing front card: ...
[OPENCV] Found good inner border at threshold 200: L=12px R=13px T=10px B=11px
[OPENCV] Centering ratios - Horizontal: 48/52, Vertical: 51/49
[OPENCV] ✅ Detection successful
[TWO-STAGE] ✅ Using OpenCV pixel-based centering
[STAGE1] ✅ Injecting OpenCV centering data into measurement results
```

### Expected Logs (OpenCV Unavailable - Fallback)

```
[OPENCV] ⚠️ Service unavailable or error: connect ECONNREFUSED 127.0.0.1:5001
[OPENCV] Falling back to AI vision for centering
[TWO-STAGE] ⚠️ OpenCV unavailable, AI will measure centering
```

## 🛑 Stop Services

- Press `Ctrl+C` in each terminal window
- Or close the terminal windows

## 🐛 Troubleshooting

### Issue: Python not found

**Error**: `Python was not found; run without arguments to install from the Microsoft Store`

**Solution**: Use the batch files (`start_opencv_service.bat` or `start_all_services.bat`) which use the correct Python path.

### Issue: Port already in use

**Error**: `Address already in use: 5001`

**Solution**: Kill existing Python process:
```bash
taskkill /F /IM python.exe
```

Then restart the service.

### Issue: OpenCV service starts but crashes immediately

**Check**: Missing dependencies

**Solution**:
```bash
cd card_detection_service
C:\Users\benja\AppData\Local\Programs\Python\Python313\python.exe -m pip install -r requirements.txt
```

### Issue: Cards still getting 10/B grades

**Cause**: OpenAI assistants not updated

**Solution**: See `UPDATE_ASSISTANTS_CHECKLIST.md`

## 📊 What You'll See in Card Results

### With OpenCV Running

```json
{
  "Centering_Measurements": {
    "front_x_axis_ratio": "48/52",
    "front_y_axis_ratio": "51/49",
    "front_edge_description": "OpenCV pixel-based: 12px left, 13px right",
    "measurement_source": "OpenCV",
    "measurement_method": "Enhanced Threshold-Based Detection",
    "measurement_confidence": "High"
  }
}
```

### With OpenCV Not Running (AI Fallback)

```json
{
  "Centering_Measurements": {
    "front_x_axis_ratio": "55/45",
    "front_y_axis_ratio": "52/48",
    "front_edge_description": "Front: left border slightly wider...",
    "measurement_source": "AI Vision",
    "measurement_method": "Visual Analysis",
    "measurement_confidence": "High"
  }
}
```

## ⚙️ Disable OpenCV (Use AI Only)

If you want to temporarily disable OpenCV and use only AI:

1. Stop the OpenCV service (don't start it)
2. Next.js will automatically fall back to AI vision
3. System continues working normally

No code changes needed - fallback is automatic!

## 🔄 Next Steps

1. ✅ Start services using `start_all_services.bat`
2. ✅ Upload a test card
3. ✅ Verify OpenCV centering is used (check "measurement_source")
4. ⚠️ **Update OpenAI assistants** (see `UPDATE_ASSISTANTS_CHECKLIST.md`)
5. ✅ Test with multiple cards

---

**Need Help?** See `OPENCV_STARTUP_GUIDE.md` for detailed troubleshooting.
