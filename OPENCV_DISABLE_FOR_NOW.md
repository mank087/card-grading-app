# ⚠️ OpenCV Centering - Temporary Disable Recommended

## Current Status

OpenCV is detecting cards but producing **incorrect centering ratios** because:

1. **Card boundary detection fails** - Aspect ratio mismatch (4.345 vs 0.714)
2. **Falls back to direct image processing** - Resizes entire image including background
3. **Inner border detection fails** - Threshold method can't find card design area
4. **Edge detection fallback used** - Detects random edges, not actual borders
5. **Results**: Extreme ratios like 85/15 (should be more like 55/45)

## Example From Logs

```
[OPENCV] Pixel measurements - Left: 29px, Right: 47px, Top: 138px, Bottom: 25px
[OPENCV] Centering ratios - Horizontal: 38/62, Vertical: 85/15
```

**Problem**: Top: 138px, Bottom: 25px = 85/15 ratio (card graded as grade 5)
**Reality**: The card is likely much better centered than this

## Root Cause

Your card images include:
- Card in holder/sleeve
- Background around the card
- Possibly at an angle
- Not just the card itself

OpenCV is measuring borders of **the entire image** instead of **the card's inner design**.

## Recommendation: Disable OpenCV Until Fixed

### Option 1: Stop OpenCV Service (Immediate)

Just **don't start the OpenCV service**. The system will automatically fall back to AI vision.

**No code changes needed** - AI fallback is already built-in.

### Option 2: Force Disable in Code

Edit `route.ts` line 162:

**Change FROM:**
```typescript
console.log('[OPENCV] Attempting OpenCV centering detection...');
```

**Change TO:**
```typescript
console.log('[OPENCV] Temporarily disabled - using AI vision');
return { useOpenCV: false, detectionResults: null };
```

## What Needs to Be Fixed

1. **Better card boundary detection**:
   - Handle cards in holders/sleeves
   - Detect card edges even at angles
   - Use AI to validate card boundaries

2. **Better inner border detection**:
   - Handle different card designs (borderless, colored borders, etc.)
   - Use color-based segmentation
   - Machine learning for border detection

3. **Image preprocessing**:
   - Auto-crop to just the card
   - Remove background
   - Perspective correction

## Current Workaround: Use AI Vision

**AI vision is actually doing better** for your cards because:
- It can see the actual card design
- It understands context (holder, sleeve, background)
- It measures actual visible borders, not image edges

**For now, stick with AI vision until OpenCV is fixed.**

## Testing AI Vision Quality

Upload a few more cards with **OpenCV service stopped** and check:
- Are centering ratios realistic? (50/50 to 70/30 range)
- Does it detect defects properly?
- Are grades varying (not all 10s)?

## Future Fix Plan

1. Add AI-assisted card boundary detection
2. Use computer vision + AI hybrid approach
3. Pre-process images to isolate just the card
4. Train on your specific card image format

---

**Immediate Action**: Stop OpenCV service, rely on AI vision for now.
