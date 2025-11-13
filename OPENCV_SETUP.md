# OpenCV Card Detection Setup Guide

This guide will help you set up the OpenCV card detection microservice to improve centering analysis accuracy.

## Overview

The card detection service uses OpenCV to:
- Detect actual card boundaries within photos
- Normalize perspective to a standard 2.5" × 3.5" rectangle
- Calculate precise centering measurements
- Eliminate guesswork and improve grading accuracy

## Prerequisites

- Python 3.8+ installed
- Node.js application running on port 3008
- Card grading app already functional

## Setup Instructions

### 1. Install Python Dependencies

Navigate to the card detection service directory:
```bash
cd card_detection_service
```

Install required packages:
```bash
pip install -r requirements.txt
```

**Required packages:**
- opencv-python==4.8.1.78
- numpy==1.24.3
- flask==2.3.3
- flask-cors==4.0.0
- pillow==10.0.1
- requests==2.31.0

### 2. Start the Card Detection Service

**Option A: Use the batch file (Windows)**
```bash
start_service.bat
```

**Option B: Manual start**
```bash
python app.py
```

The service will start on `http://localhost:5001`

### 3. Verify Service is Running

Check the health endpoint:
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

### 4. Test Card Detection

You can test the service with a sample image:

**Single card detection:**
```bash
curl -X POST http://localhost:5001/detect-card \
  -H "Content-Type: application/json" \
  -d '{"image_url": "your_card_image_url"}'
```

**Batch detection (front/back):**
```bash
curl -X POST http://localhost:5001/detect-card-batch \
  -H "Content-Type: application/json" \
  -d '{
    "images": {
      "front": "front_card_url",
      "back": "back_card_url"
    }
  }'
```

## How It Works

### 1. Card Detection Process

1. **Edge Detection**: Uses Canny edge detection to find card boundaries
2. **Contour Analysis**: Identifies the largest rectangular contour matching card aspect ratio (2.5:3.5)
3. **Perspective Correction**: Warps the detected card to a normalized 250×350px rectangle
4. **Content Analysis**: Detects the card's design center vs. geometric center
5. **Measurement Calculation**: Provides precise border percentages and centering ratios

### 2. Integration with AI Grading

When the card detection service is running:

1. **Upload Process**: Card images are sent to both AI grading and OpenCV detection
2. **Enhanced Instructions**: AI receives precise measurements instead of estimating
3. **Visual Overlay**: CenteringOverlay component uses real card boundaries
4. **Fallback Handling**: If detection fails, system falls back to AI estimation

### 3. Visual Indicators

- **`[OpenCV]`**: Measurements from precise card detection
- **`[AI Est]`**: Fallback to AI visual estimation
- **Improved Card Boundaries**: Orange border shows actual detected card area
- **Accurate Centering Lines**: Green (ideal) and red (actual) lines based on real measurements

## API Endpoints

### GET /health
Health check endpoint

### POST /detect-card
Single card detection
- Accepts: `image` file upload or `image_url` JSON parameter
- Returns: Card detection results with measurements

### POST /detect-card-batch
Batch processing for multiple cards
- Accepts: JSON with `images` object containing multiple image URLs
- Returns: Detection results for each image

## Troubleshooting

### Service Won't Start
- Ensure Python 3.8+ is installed
- Check that port 5001 is available
- Verify all dependencies are installed correctly

### Detection Fails
- Check image quality (clear, well-lit photos work best)
- Ensure card takes up significant portion of image (>10%)
- Verify card has clear rectangular boundaries
- Check that image aspect ratio is reasonable

### Integration Issues
- Verify both services are running (Node.js on 3008, Python on 5001)
- Check console logs for connection errors
- Ensure firewall isn't blocking localhost connections

## Performance Notes

- First detection may be slower due to OpenCV initialization
- Typical processing time: 1-3 seconds per card
- Memory usage: ~100MB for the service
- Concurrent requests supported

## Fallback Behavior

If the OpenCV service is unavailable:
- Cards will still be processed using AI estimation
- Visual overlays will show `[AI Est]` instead of `[OpenCV]`
- No interruption to core grading functionality
- Consider this a enhancement, not a dependency

## Future Enhancements

The OpenCV foundation enables future improvements:
- Corner detection for precise corner grading
- Edge analysis for wear assessment
- Surface defect mapping
- Print quality measurement
- Automated photo quality scoring

## Support

If you encounter issues:
1. Check service logs in the console
2. Verify all prerequisites are met
3. Test with the health endpoint first
4. Try a simple single-card detection before batch processing