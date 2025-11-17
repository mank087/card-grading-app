# Mobile Camera Implementation Plan
## Card Grading App - Camera Capture with Guidance Overlay

**Created**: 2025-11-14
**Status**: Planning Phase
**Objective**: Add mobile device camera capture with card positioning guidance while preserving manual upload functionality

---

## 📋 Executive Summary

This plan outlines the implementation of a mobile-first camera capture feature that:
- Uses the device's native camera for front/back card images
- Provides visual guidance overlays to ensure uniform card positioning
- Maintains manual file upload as a fallback/secondary option
- Preserves existing desktop upload experience
- Improves image quality and consistency for better AI grading results

---

## 🎯 User Experience Goals

### Mobile Users:
1. **Primary Flow**: Tap "Capture with Camera" → Position card in guide → Snap photo → Review → Continue
2. **Secondary Flow**: Tap "Upload from Gallery" → Select existing photo
3. **Guidance**: Visual overlay showing card corners/edges alignment
4. **Feedback**: Real-time preview with "Card detected" / "Adjust position" indicators

### Desktop Users:
1. **Unchanged**: Continue using file upload (drag & drop or browse)
2. **No Camera**: Desktop camera not exposed (security/UX reasons)

---

## 🛠 Technical Stack Recommendations

### Core Libraries

1. **Camera Access**
   - Use native browser APIs: `navigator.mediaDevices.getUserMedia()`
   - No external library needed (supported in all modern mobile browsers)

2. **Image Capture & Processing**
   - **Option A**: Pure Canvas API (recommended for simplicity)
     - Pros: No dependencies, full control, lightweight
     - Cons: More manual work

   - **Option B**: `react-camera-pro` (npm package)
     - Pros: React hooks, easier implementation
     - Cons: Additional dependency (~50KB)
     - Install: `npm install react-camera-pro`

3. **Device Detection**
   - Use existing or add: `react-device-detect`
   - Install: `npm install react-device-detect`
   - Detect mobile vs desktop to show appropriate UI

4. **Guidance Overlay**
   - SVG overlays (recommended) or Canvas drawings
   - CSS positioning for alignment guides
   - No external library needed

### Browser Compatibility
- ✅ iOS Safari 11+
- ✅ Android Chrome 53+
- ✅ Android Firefox 68+
- ⚠️ Requires HTTPS (camera access blocked on HTTP)
- ✅ Your app is already on Vercel (HTTPS by default)

---

## 📐 Architecture & File Structure

### New Components to Create

```
src/
├── components/
│   ├── camera/
│   │   ├── MobileCamera.tsx          # Main camera component
│   │   ├── CameraGuideOverlay.tsx    # Card positioning guide
│   │   ├── CameraControls.tsx        # Capture/retake buttons
│   │   ├── ImagePreview.tsx          # Review captured image
│   │   └── CameraPermissionPrompt.tsx # Permission request UI
│   └── upload/
│       └── UploadMethodSelector.tsx   # Camera vs Gallery chooser
├── hooks/
│   ├── useCamera.ts                   # Camera access hook
│   ├── useDeviceDetection.ts          # Mobile/desktop detection
│   └── useImageCapture.ts             # Capture & processing logic
├── utils/
│   ├── imageProcessing.ts             # Crop, compress, validate
│   └── cameraUtils.ts                 # Camera config, constraints
└── types/
    └── camera.ts                      # TypeScript interfaces
```

### Pages to Update

```
src/app/
├── upload/
│   ├── page.tsx                       # Add category selection
│   ├── sports/page.tsx                # Update for camera
│   ├── pokemon/page.tsx               # Update for camera
│   ├── mtg/page.tsx                   # Update for camera
│   ├── lorcana/page.tsx               # Update for camera
│   └── other/page.tsx                 # Update for camera
```

---

## 🎨 UI/UX Design Specifications

### Camera Guide Overlay Design

```
┌─────────────────────────────────────┐
│  ← Back                    [Flash]  │ ← Header
├─────────────────────────────────────┤
│                                     │
│     ╔═══════════════════════╗       │
│     ║                       ║       │
│     ║                       ║       │ ← Card outline guide
│     ║   [Card Preview]      ║       │   (semi-transparent)
│     ║                       ║       │
│     ║                       ║       │
│     ╚═══════════════════════╝       │
│                                     │
│  "Position card within frame"       │ ← Instruction text
├─────────────────────────────────────┤
│         ⃝  Capture                  │ ← Capture button
│     [Switch Camera] [Gallery]       │ ← Secondary actions
└─────────────────────────────────────┘
```

### Guide Overlay Features

1. **Card Outline**
   - Aspect ratio: 2.5:3.5 (standard trading card)
   - Semi-transparent white border (2-3px)
   - Corner markers (L-shaped brackets)
   - Centered with 10% margin on all sides

2. **Visual Feedback**
   - Green outline when card detected in frame
   - Red outline when card too close/far
   - Pulsing animation on corners for alignment

3. **Instructions**
   - Top: "Front of Card" / "Back of Card"
   - Bottom: "Position all 4 corners inside the frame"
   - Tips: "Avoid glare and shadows"

---

## 📝 Step-by-Step Implementation Plan

### Phase 1: Foundation Setup (Day 1)

#### Step 1.1: Install Dependencies
```bash
npm install react-device-detect
# Optional: npm install react-camera-pro
```

#### Step 1.2: Create Type Definitions
Create `src/types/camera.ts`:
```typescript
export interface CameraConfig {
  facingMode: 'user' | 'environment';
  aspectRatio: number;
  width: { ideal: number };
  height: { ideal: number };
}

export interface CapturedImage {
  dataUrl: string;
  blob: Blob;
  file: File;
  timestamp: number;
}

export interface CameraGuideOverlay {
  cornerPositions: { x: number; y: number }[];
  cardAspectRatio: number;
  showGrid: boolean;
}
```

#### Step 1.3: Create Camera Hook
Create `src/hooks/useCamera.ts`:
```typescript
import { useState, useRef, useEffect } from 'react';

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError(err.message);
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = (): CapturedImage | null => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const file = new File([blob], `card-${Date.now()}.jpg`, { type: 'image/jpeg' });

        resolve({
          dataUrl,
          blob,
          file,
          timestamp: Date.now()
        });
      }, 'image/jpeg', 0.95);
    });
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return {
    videoRef,
    stream,
    error,
    hasPermission,
    startCamera,
    stopCamera,
    captureImage
  };
};
```

### Phase 2: Camera Components (Day 2)

#### Step 2.1: Create Camera Guide Overlay Component
Create `src/components/camera/CameraGuideOverlay.tsx`:
```typescript
'use client';

interface CameraGuideOverlayProps {
  cardDetected?: boolean;
}

export default function CameraGuideOverlay({ cardDetected = false }: CameraGuideOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Card outline guide - centered with standard card aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className={`relative border-4 rounded-lg transition-colors duration-300 ${
            cardDetected ? 'border-green-400' : 'border-white'
          }`}
          style={{
            width: '80%',
            maxWidth: '350px',
            aspectRatio: '2.5 / 3.5' // Standard trading card ratio
          }}
        >
          {/* Corner markers */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white" />

          {/* Center crosshair (optional) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/50 rounded-full" />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-0 right-0 text-center">
        <div className="bg-black/60 text-white px-4 py-2 rounded-full inline-block">
          <p className="text-sm font-medium">Position all 4 corners inside the frame</p>
        </div>
      </div>

      {/* Bottom tips */}
      <div className="absolute bottom-24 left-0 right-0 text-center">
        <div className="bg-black/60 text-white px-4 py-2 rounded-lg inline-block">
          <p className="text-xs">💡 Avoid glare, shadows, and reflections</p>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2.2: Create Main Camera Component
Create `src/components/camera/MobileCamera.tsx`:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';

interface MobileCameraProps {
  side: 'front' | 'back';
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function MobileCamera({ side, onCapture, onCancel }: MobileCameraProps) {
  const { videoRef, hasPermission, startCamera, stopCamera, captureImage } = useCamera();
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startCamera('environment').then(() => setIsLoading(false));

    return () => stopCamera();
  }, []);

  const handleCapture = async () => {
    const image = await captureImage();
    if (image) {
      setCapturedImage(image);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera('environment');
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage.file);
    }
  };

  // If image captured, show preview
  if (capturedImage) {
    return (
      <ImagePreview
        imageUrl={capturedImage.dataUrl}
        side={side}
        onRetake={handleRetake}
        onConfirm={handleConfirm}
      />
    );
  }

  // Show camera view
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <button onClick={onCancel} className="text-lg">
            ← Back
          </button>
          <h2 className="text-lg font-semibold">
            {side === 'front' ? 'Front of Card' : 'Back of Card'}
          </h2>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Camera view */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Guide overlay */}
      <CameraGuideOverlay />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex items-center justify-center gap-6">
          {/* Gallery button */}
          <button
            onClick={() => {/* Open file picker */}}
            className="text-white/80 hover:text-white"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs block mt-1">Gallery</span>
          </button>

          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={isLoading || !hasPermission}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-full bg-white m-auto" />
          </button>

          {/* Switch camera button (for devices with multiple cameras) */}
          <button className="text-white/80 hover:text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs block mt-1">Flip</span>
          </button>
        </div>
      </div>

      {/* Permission denied message */}
      {hasPermission === false && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white p-8 text-center">
          <div>
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-xl font-bold mb-2">Camera Access Needed</h3>
            <p className="text-sm text-white/80 mb-4">
              Please allow camera access in your browser settings to capture card images.
            </p>
            <button
              onClick={onCancel}
              className="bg-white text-black px-6 py-2 rounded-lg font-medium"
            >
              Use Gallery Instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Step 2.3: Create Image Preview Component
Create `src/components/camera/ImagePreview.tsx`:
```typescript
'use client';

interface ImagePreviewProps {
  imageUrl: string;
  side: 'front' | 'back';
  onRetake: () => void;
  onConfirm: () => void;
}

export default function ImagePreview({ imageUrl, side, onRetake, onConfirm }: ImagePreviewProps) {
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <h2 className="text-white text-lg font-semibold text-center">
          Review {side === 'front' ? 'Front' : 'Back'}
        </h2>
      </div>

      {/* Image preview */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <img
          src={imageUrl}
          alt={`${side} of card`}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex gap-4">
          <button
            onClick={onRetake}
            className="flex-1 bg-white/20 text-white py-3 rounded-lg font-medium hover:bg-white/30"
          >
            Retake
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Use This Photo
          </button>
        </div>

        {/* Quality tips */}
        <div className="mt-4 text-center">
          <p className="text-white/60 text-xs">
            ✓ All corners visible • ✓ No glare • ✓ Clear details
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Phase 3: Upload Method Selection (Day 3)

#### Step 3.1: Create Upload Method Selector
Create `src/components/upload/UploadMethodSelector.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { isMobile } from 'react-device-detect';

interface UploadMethodSelectorProps {
  side: 'front' | 'back';
  onFileSelected: (file: File) => void;
}

export default function UploadMethodSelector({ side, onFileSelected }: UploadMethodSelectorProps) {
  const [showCamera, setShowCamera] = useState(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  if (showCamera && isMobile) {
    return (
      <MobileCamera
        side={side}
        onCapture={onFileSelected}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile: Camera as primary option */}
      {isMobile ? (
        <>
          {/* Primary: Camera */}
          <button
            onClick={() => setShowCamera(true)}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture with Camera
          </button>

          {/* Secondary: Gallery */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id={`file-input-${side}`}
            />
            <label
              htmlFor={`file-input-${side}`}
              className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-lg font-medium hover:border-gray-400 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Gallery
            </label>
          </div>
        </>
      ) : (
        /* Desktop: File upload only */
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            id={`file-input-${side}`}
          />
          <label
            htmlFor={`file-input-${side}`}
            className="w-full border-2 border-dashed border-gray-300 text-gray-700 py-8 rounded-lg font-medium hover:border-gray-400 flex flex-col items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Click to upload or drag and drop</span>
            <span className="text-sm text-gray-500">JPG, PNG up to 10MB</span>
          </label>
        </div>
      )}
    </div>
  );
}
```

### Phase 4: Integration with Existing Upload Pages (Day 4)

#### Step 4.1: Update Sports Upload Page
Modify `src/app/upload/sports/page.tsx`:

```typescript
// Add this section where you currently handle file uploads

import UploadMethodSelector from '@/components/upload/UploadMethodSelector';

// Replace existing file input with:
<div className="space-y-6">
  {/* Front image */}
  <div>
    <label className="block text-lg font-semibold mb-2">
      Front of Card
    </label>
    {!frontFile ? (
      <UploadMethodSelector
        side="front"
        onFileSelected={setFrontFile}
      />
    ) : (
      <div className="relative">
        <img src={URL.createObjectURL(frontFile)} alt="Front" className="w-full rounded-lg" />
        <button
          onClick={() => setFrontFile(null)}
          className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full"
        >
          ✕
        </button>
      </div>
    )}
  </div>

  {/* Back image */}
  <div>
    <label className="block text-lg font-semibold mb-2">
      Back of Card
    </label>
    {!backFile ? (
      <UploadMethodSelector
        side="back"
        onFileSelected={setBackFile}
      />
    ) : (
      <div className="relative">
        <img src={URL.createObjectURL(backFile)} alt="Back" className="w-full rounded-lg" />
        <button
          onClick={() => setBackFile(null)}
          className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full"
        >
          ✕
        </button>
      </div>
    )}
  </div>
</div>
```

#### Step 4.2: Repeat for Other Upload Pages
Apply the same pattern to:
- `src/app/upload/pokemon/page.tsx`
- `src/app/upload/mtg/page.tsx`
- `src/app/upload/lorcana/page.tsx`
- `src/app/upload/other/page.tsx`

---

## 🔧 Advanced Features (Optional Enhancements)

These optional features can significantly improve the user experience and image quality. Each feature is described in detail below with full implementation code.

---

## 🎯 OPTIONAL FEATURE 1: Auto Card Detection

### Overview
Automatically detect when a card is properly positioned within the guide frame and provide real-time visual feedback. This can optionally trigger automatic capture after the card has been stable for a set duration.

### Benefits
- ✅ Faster capture workflow
- ✅ Better positioning accuracy
- ✅ Reduced user error
- ✅ Professional feel

### Technical Approach

**Option A: Simple Rectangle Detection (Recommended for MVP)**
- Faster processing (60 FPS possible)
- Lower battery usage
- Good enough for most cases
- No external dependencies

**Option B: Advanced OpenCV Detection**
- More accurate corner detection
- Handles perspective distortion
- Better with difficult lighting
- Requires OpenCV.js library

### Implementation: Option A (Simple Rectangle Detection)

#### Step 1: Install No Dependencies Needed
This approach uses native Canvas API only.

#### Step 2: Create Detection Hook
Create `src/hooks/useCardDetection.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';

interface DetectionResult {
  isCardDetected: boolean;
  confidence: number; // 0-100
  corners?: { x: number; y: number }[];
  message: string;
}

export const useCardDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true
) => {
  const [detection, setDetection] = useState<DetectionResult>({
    isCardDetected: false,
    confidence: 0,
    message: 'Position card in frame'
  });
  const animationFrameRef = useRef<number>();
  const stableFramesRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    const detectCard = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(detectCard);
        return;
      }

      // Create temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(detectCard);
        return;
      }

      // Draw current frame
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Perform detection
      const result = detectCardInFrame(imageData, canvas.width, canvas.height);

      // Update detection state
      setDetection(result);

      // Track stable frames for auto-capture
      if (result.isCardDetected && result.confidence > 80) {
        stableFramesRef.current++;
      } else {
        stableFramesRef.current = 0;
      }

      // Continue detection loop
      animationFrameRef.current = requestAnimationFrame(detectCard);
    };

    detectCard();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, videoRef]);

  return {
    ...detection,
    stableFrames: stableFramesRef.current,
    shouldAutoCapture: stableFramesRef.current >= 30 // 0.5 seconds at 60fps
  };
};

// Core detection algorithm
function detectCardInFrame(
  imageData: ImageData,
  width: number,
  height: number
): DetectionResult {
  const data = imageData.data;

  // 1. Convert to grayscale and find edges
  const edges = detectEdges(data, width, height);

  // 2. Find contours
  const contours = findContours(edges, width, height);

  // 3. Filter for card-shaped rectangles
  const cardContour = findBestCardContour(contours, width, height);

  if (!cardContour) {
    return {
      isCardDetected: false,
      confidence: 0,
      message: 'Position card in frame'
    };
  }

  // 4. Calculate confidence based on position and size
  const confidence = calculateConfidence(cardContour, width, height);

  // 5. Generate user feedback
  const message = generateFeedbackMessage(cardContour, confidence, width, height);

  return {
    isCardDetected: confidence > 60,
    confidence,
    corners: cardContour.corners,
    message
  };
}

// Edge detection using simple Sobel operator
function detectEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const edges = new Uint8ClampedArray(width * height);
  const threshold = 50;

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);

          gx += gray * sobelX[kernelIdx];
          gy += gray * sobelY[kernelIdx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
}

// Find rectangular contours
function findContours(
  edges: Uint8ClampedArray,
  width: number,
  height: number
): any[] {
  const contours: any[] = [];
  const visited = new Uint8ClampedArray(width * height);

  // Simple contour following algorithm
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (edges[idx] > 0 && !visited[idx]) {
        const contour = traceContour(edges, visited, x, y, width, height);
        if (contour.length > 50) { // Minimum contour size
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

// Trace contour from starting point
function traceContour(
  edges: Uint8ClampedArray,
  visited: Uint8ClampedArray,
  startX: number,
  startY: number,
  width: number,
  height: number
): { x: number; y: number }[] {
  const contour: { x: number; y: number }[] = [];
  const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const point = stack.pop()!;
    const idx = point.y * width + point.x;

    if (visited[idx] || edges[idx] === 0) continue;

    visited[idx] = 1;
    contour.push(point);

    // Check 8-connected neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = point.x + dx;
        const ny = point.y + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          stack.push({ x: nx, y: ny });
        }
      }
    }
  }

  return contour;
}

// Find best card-shaped contour
function findBestCardContour(
  contours: any[],
  width: number,
  height: number
): { corners: { x: number; y: number }[]; area: number } | null {
  const CARD_ASPECT_RATIO = 2.5 / 3.5; // Standard trading card
  const ASPECT_TOLERANCE = 0.15;

  let bestContour: any = null;
  let bestScore = 0;

  for (const contour of contours) {
    // Approximate polygon
    const polygon = approximatePolygon(contour, 0.02);

    // Must be roughly 4-sided (quadrilateral)
    if (polygon.length < 4 || polygon.length > 6) continue;

    // Get bounding box
    const bounds = getBoundingBox(polygon);
    const aspectRatio = bounds.width / bounds.height;

    // Check aspect ratio
    if (Math.abs(aspectRatio - CARD_ASPECT_RATIO) > ASPECT_TOLERANCE) continue;

    // Calculate score based on size and position
    const sizeScore = (bounds.width * bounds.height) / (width * height);
    const centerScore = calculateCenterScore(bounds, width, height);
    const score = sizeScore * 0.6 + centerScore * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestContour = {
        corners: polygon.slice(0, 4),
        area: bounds.width * bounds.height
      };
    }
  }

  return bestContour;
}

// Douglas-Peucker algorithm for polygon approximation
function approximatePolygon(
  contour: { x: number; y: number }[],
  epsilon: number
): { x: number; y: number }[] {
  if (contour.length <= 2) return contour;

  const epsilonSquared = epsilon * epsilon;

  // Find point with maximum distance
  let maxDist = 0;
  let maxIndex = 0;

  const firstPoint = contour[0];
  const lastPoint = contour[contour.length - 1];

  for (let i = 1; i < contour.length - 1; i++) {
    const dist = perpendicularDistance(contour[i], firstPoint, lastPoint);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilonSquared) {
    const left = approximatePolygon(contour.slice(0, maxIndex + 1), epsilon);
    const right = approximatePolygon(contour.slice(maxIndex), epsilon);

    return [...left.slice(0, -1), ...right];
  }

  return [firstPoint, lastPoint];
}

// Calculate perpendicular distance from point to line
function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return pdx * pdx + pdy * pdy;
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  const projection = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };

  const pdx = point.x - projection.x;
  const pdy = point.y - projection.y;

  return pdx * pdx + pdy * pdy;
}

// Get bounding box of polygon
function getBoundingBox(polygon: { x: number; y: number }[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Calculate how centered the card is
function calculateCenterScore(
  bounds: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): number {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const frameCenterX = frameWidth / 2;
  const frameCenterY = frameHeight / 2;

  const distX = Math.abs(centerX - frameCenterX) / frameWidth;
  const distY = Math.abs(centerY - frameCenterY) / frameHeight;

  const distance = Math.sqrt(distX * distX + distY * distY);

  return Math.max(0, 1 - distance * 2);
}

// Calculate overall confidence score
function calculateConfidence(
  cardContour: { corners: { x: number; y: number }[]; area: number },
  width: number,
  height: number
): number {
  const bounds = getBoundingBox(cardContour.corners);

  // Size factor (ideal: 60-80% of frame)
  const sizeRatio = (bounds.width * bounds.height) / (width * height);
  const idealSizeRatio = 0.7;
  const sizeFactor = 1 - Math.abs(sizeRatio - idealSizeRatio) / idealSizeRatio;

  // Position factor (how centered)
  const centerFactor = calculateCenterScore(bounds, width, height);

  // Aspect ratio factor
  const aspectRatio = bounds.width / bounds.height;
  const idealAspect = 2.5 / 3.5;
  const aspectFactor = 1 - Math.abs(aspectRatio - idealAspect) / idealAspect;

  // Combined confidence
  const confidence = (sizeFactor * 0.4 + centerFactor * 0.3 + aspectFactor * 0.3) * 100;

  return Math.max(0, Math.min(100, confidence));
}

// Generate user feedback message
function generateFeedbackMessage(
  cardContour: { corners: { x: number; y: number }[]; area: number },
  confidence: number,
  width: number,
  height: number
): string {
  const bounds = getBoundingBox(cardContour.corners);
  const sizeRatio = (bounds.width * bounds.height) / (width * height);

  if (confidence >= 80) {
    return '✓ Perfect! Hold steady';
  } else if (confidence >= 60) {
    return 'Good - adjust slightly';
  } else if (sizeRatio < 0.5) {
    return 'Move closer to card';
  } else if (sizeRatio > 0.9) {
    return 'Move further away';
  } else {
    const centerScore = calculateCenterScore(bounds, width, height);
    if (centerScore < 0.5) {
      return 'Center the card in frame';
    }
    return 'Adjust card position';
  }
}
```

#### Step 3: Integrate with Camera Component
Update `MobileCamera.tsx`:

```typescript
import { useCardDetection } from '@/hooks/useCardDetection';

export default function MobileCamera({ side, onCapture, onCancel }: MobileCameraProps) {
  const { videoRef, startCamera, captureImage } = useCamera();
  const detection = useCardDetection(videoRef, true);

  // Auto-capture when stable
  useEffect(() => {
    if (detection.shouldAutoCapture && !capturedImage) {
      handleCapture();
    }
  }, [detection.shouldAutoCapture]);

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Camera view */}
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

      {/* Guide overlay with detection feedback */}
      <CameraGuideOverlay
        cardDetected={detection.isCardDetected}
        confidence={detection.confidence}
        message={detection.message}
      />

      {/* ... rest of component */}
    </div>
  );
}
```

#### Step 4: Update Guide Overlay
Update `CameraGuideOverlay.tsx`:

```typescript
interface CameraGuideOverlayProps {
  cardDetected?: boolean;
  confidence?: number;
  message?: string;
}

export default function CameraGuideOverlay({
  cardDetected = false,
  confidence = 0,
  message = 'Position card in frame'
}: CameraGuideOverlayProps) {
  // Determine border color based on confidence
  const getBorderColor = () => {
    if (confidence >= 80) return 'border-green-400 shadow-green-400/50';
    if (confidence >= 60) return 'border-yellow-400 shadow-yellow-400/50';
    if (confidence >= 40) return 'border-orange-400 shadow-orange-400/50';
    return 'border-white shadow-white/30';
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Card outline guide with dynamic feedback */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className={`relative border-4 rounded-lg transition-all duration-300 shadow-lg ${getBorderColor()}`}
          style={{
            width: '80%',
            maxWidth: '350px',
            aspectRatio: '2.5 / 3.5'
          }}
        >
          {/* Animated corner markers */}
          {[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right'
          ].map((corner) => (
            <div
              key={corner}
              className={`absolute w-8 h-8 border-4 ${
                cardDetected ? 'border-green-400' : 'border-white'
              } ${
                corner === 'top-left' ? '-top-1 -left-1 border-t-4 border-l-4' :
                corner === 'top-right' ? '-top-1 -right-1 border-t-4 border-r-4' :
                corner === 'bottom-left' ? '-bottom-1 -left-1 border-b-4 border-l-4' :
                '-bottom-1 -right-1 border-b-4 border-r-4'
              } transition-colors duration-300 ${
                cardDetected ? 'animate-pulse' : ''
              }`}
            />
          ))}

          {/* Confidence meter */}
          {confidence > 0 && (
            <div className="absolute -bottom-8 left-0 right-0">
              <div className="bg-black/60 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    confidence >= 80 ? 'bg-green-400' :
                    confidence >= 60 ? 'bg-yellow-400' :
                    confidence >= 40 ? 'bg-orange-400' :
                    'bg-red-400'
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic instruction message */}
      <div className="absolute top-4 left-0 right-0 text-center">
        <div className={`bg-black/60 text-white px-4 py-2 rounded-full inline-block transition-colors ${
          cardDetected ? 'bg-green-600/80' : 'bg-black/60'
        }`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}
```

### Implementation: Option B (OpenCV Advanced Detection)

For more advanced detection with perspective correction:

#### Step 1: Install OpenCV.js
```bash
npm install @techstark/opencv-js
```

#### Step 2: Load OpenCV
Add to `public/index.html` or load dynamically:

```typescript
// src/utils/loadOpenCV.ts
export const loadOpenCV = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (window.cv) {
      resolve(window.cv);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.5.2/opencv.js';
    script.async = true;

    script.onload = () => {
      // Wait for OpenCV to initialize
      const checkCV = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkCV);
          resolve(window.cv);
        }
      }, 100);
    };

    script.onerror = reject;
    document.body.appendChild(script);
  });
};
```

#### Step 3: Advanced Detection Hook
```typescript
// src/hooks/useAdvancedCardDetection.ts
import { useEffect, useState, useRef } from 'react';
import { loadOpenCV } from '@/utils/loadOpenCV';

export const useAdvancedCardDetection = (
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true
) => {
  const [cv, setCv] = useState<any>(null);
  const [detection, setDetection] = useState<DetectionResult>({
    isCardDetected: false,
    confidence: 0,
    corners: [],
    message: 'Loading...'
  });

  useEffect(() => {
    loadOpenCV().then(setCv).catch(console.error);
  }, []);

  useEffect(() => {
    if (!cv || !enabled || !videoRef.current) return;

    let animationFrame: number;

    const detectCardWithOpenCV = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrame = requestAnimationFrame(detectCardWithOpenCV);
        return;
      }

      try {
        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        // Convert to OpenCV Mat
        const src = cv.imread(canvas);
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const edges = new cv.Mat();
        const hierarchy = new cv.Mat();
        const contours = new cv.MatVector();

        // Preprocessing
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edges, 50, 150);

        // Find contours
        cv.findContours(
          edges,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE
        );

        // Find best card-shaped contour
        let bestContour = null;
        let maxScore = 0;

        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const perimeter = cv.arcLength(contour, true);
          const approx = new cv.Mat();

          // Approximate polygon
          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

          // Must be 4-sided
          if (approx.rows === 4) {
            const area = cv.contourArea(contour);
            const frameArea = src.rows * src.cols;
            const sizeRatio = area / frameArea;

            // Card should be 50-80% of frame
            if (sizeRatio > 0.5 && sizeRatio < 0.8) {
              // Check aspect ratio
              const rect = cv.boundingRect(approx);
              const aspectRatio = rect.width / rect.height;
              const idealAspect = 2.5 / 3.5;

              if (Math.abs(aspectRatio - idealAspect) < 0.2) {
                const score = sizeRatio * (1 - Math.abs(aspectRatio - idealAspect));

                if (score > maxScore) {
                  maxScore = score;
                  bestContour = approx;
                }
              }
            }
          }
        }

        if (bestContour) {
          // Extract corners
          const corners = [];
          for (let i = 0; i < 4; i++) {
            corners.push({
              x: bestContour.data32S[i * 2],
              y: bestContour.data32S[i * 2 + 1]
            });
          }

          // Order corners: top-left, top-right, bottom-right, bottom-left
          const orderedCorners = orderCorners(corners);

          setDetection({
            isCardDetected: true,
            confidence: Math.min(100, maxScore * 100),
            corners: orderedCorners,
            message: '✓ Card detected! Hold steady'
          });
        } else {
          setDetection({
            isCardDetected: false,
            confidence: 0,
            corners: [],
            message: 'Position card in frame'
          });
        }

        // Cleanup
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('OpenCV detection error:', error);
      }

      animationFrame = requestAnimationFrame(detectCardWithOpenCV);
    };

    detectCardWithOpenCV();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [cv, enabled, videoRef]);

  return detection;
};

// Order corners clockwise from top-left
function orderCorners(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  // Find center point
  const centerX = corners.reduce((sum, p) => sum + p.x, 0) / 4;
  const centerY = corners.reduce((sum, p) => sum + p.y, 0) / 4;

  // Sort by angle from center
  const sorted = corners.map(p => ({
    ...p,
    angle: Math.atan2(p.y - centerY, p.x - centerX)
  })).sort((a, b) => a.angle - b.angle);

  // Rotate to start from top-left
  const topLeftIndex = sorted.findIndex(p => p.x < centerX && p.y < centerY);
  if (topLeftIndex !== -1) {
    return [
      ...sorted.slice(topLeftIndex),
      ...sorted.slice(0, topLeftIndex)
    ].map(({ x, y }) => ({ x, y }));
  }

  return sorted.map(({ x, y }) => ({ x, y }));
}
```

### Performance Considerations

**Detection Frequency:**
- Option A (Simple): 60 FPS possible
- Option B (OpenCV): 15-30 FPS recommended

**Battery Impact:**
- Run detection every other frame to save battery
- Pause detection when preview is shown
- Stop completely when camera is closed

**Optimization Tips:**
```typescript
// Reduce resolution for detection
const DETECTION_WIDTH = 640; // Instead of full 1920
const DETECTION_HEIGHT = 480; // Instead of full 1080

// Downsample frame before processing
const downsampled = ctx.getImageData(
  0, 0,
  DETECTION_WIDTH,
  DETECTION_HEIGHT
);
```

---

## 📊 OPTIONAL FEATURE 2: Image Quality Validation

### Overview
Automatically validate image quality before allowing user to proceed. Check for common issues like blur, poor lighting, glare, and inadequate card coverage.

### Benefits
- ✅ Fewer failed uploads
- ✅ Better AI grading accuracy
- ✅ Reduced re-grading requests
- ✅ Professional user experience

### Quality Checks

#### 1. Blur Detection (Laplacian Variance)
Measures image sharpness. Blurry images have low variance in edge intensity.

```typescript
// src/utils/imageQuality.ts

export interface QualityCheck {
  score: number; // 0-100
  passed: boolean;
  message: string;
}

export interface QualityValidation {
  isValid: boolean;
  overallScore: number;
  checks: {
    blur: QualityCheck;
    brightness: QualityCheck;
    contrast: QualityCheck;
    glare: QualityCheck;
    coverage: QualityCheck;
  };
  suggestions: string[];
}

export function validateImageQuality(
  imageData: ImageData,
  cardBounds?: { x: number; y: number; width: number; height: number }
): QualityValidation {
  const blur = checkBlur(imageData, cardBounds);
  const brightness = checkBrightness(imageData, cardBounds);
  const contrast = checkContrast(imageData, cardBounds);
  const glare = checkGlare(imageData, cardBounds);
  const coverage = checkCoverage(imageData, cardBounds);

  const overallScore = (
    blur.score * 0.3 +
    brightness.score * 0.2 +
    contrast.score * 0.2 +
    glare.score * 0.2 +
    coverage.score * 0.1
  );

  const allPassed = [blur, brightness, contrast, glare, coverage].every(c => c.passed);

  const suggestions = [blur, brightness, contrast, glare, coverage]
    .filter(c => !c.passed)
    .map(c => c.message);

  return {
    isValid: allPassed && overallScore >= 60,
    overallScore,
    checks: { blur, brightness, contrast, glare, coverage },
    suggestions
  };
}

// Blur detection using Laplacian variance
function checkBlur(
  imageData: ImageData,
  bounds?: { x: number; y: number; width: number; height: number }
): QualityCheck {
  const { data, width, height } = imageData;

  // Focus on card region if provided
  const region = bounds || { x: 0, y: 0, width, height };

  // Convert to grayscale
  const gray = new Float32Array(region.width * region.height);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const srcIdx = ((region.y + y) * width + (region.x + x)) * 4;
      const grayValue = (data[srcIdx] + data[srcIdx + 1] + data[srcIdx + 2]) / 3;
      gray[y * region.width + x] = grayValue;
    }
  }

  // Apply Laplacian operator
  let variance = 0;
  let count = 0;

  for (let y = 1; y < region.height - 1; y++) {
    for (let x = 1; x < region.width - 1; x++) {
      const laplacian =
        -gray[(y - 1) * region.width + x] +
        -gray[y * region.width + (x - 1)] +
        4 * gray[y * region.width + x] +
        -gray[y * region.width + (x + 1)] +
        -gray[(y + 1) * region.width + x];

      variance += laplacian * laplacian;
      count++;
    }
  }

  variance = variance / count;

  // Thresholds (empirically determined)
  const EXCELLENT_THRESHOLD = 500;
  const GOOD_THRESHOLD = 200;
  const ACCEPTABLE_THRESHOLD = 100;

  let score: number;
  let passed: boolean;
  let message: string;

  if (variance >= EXCELLENT_THRESHOLD) {
    score = 100;
    passed = true;
    message = 'Excellent sharpness';
  } else if (variance >= GOOD_THRESHOLD) {
    score = 70 + (variance - GOOD_THRESHOLD) / (EXCELLENT_THRESHOLD - GOOD_THRESHOLD) * 30;
    passed = true;
    message = 'Good sharpness';
  } else if (variance >= ACCEPTABLE_THRESHOLD) {
    score = 40 + (variance - ACCEPTABLE_THRESHOLD) / (GOOD_THRESHOLD - ACCEPTABLE_THRESHOLD) * 30;
    passed = false;
    message = 'Image is slightly blurry - tap to focus';
  } else {
    score = Math.min(40, (variance / ACCEPTABLE_THRESHOLD) * 40);
    passed = false;
    message = 'Image is too blurry - ensure camera is focused';
  }

  return { score, passed, message };
}

// Brightness check
function checkBrightness(
  imageData: ImageData,
  bounds?: { x: number; y: number; width: number; height: number }
): QualityCheck {
  const { data, width, height } = imageData;
  const region = bounds || { x: 0, y: 0, width, height };

  let totalBrightness = 0;
  let count = 0;

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      totalBrightness += brightness;
      count++;
    }
  }

  const avgBrightness = totalBrightness / count;

  // Ideal range: 80-180 (out of 255)
  const IDEAL_MIN = 80;
  const IDEAL_MAX = 180;
  const ACCEPTABLE_MIN = 50;
  const ACCEPTABLE_MAX = 220;

  let score: number;
  let passed: boolean;
  let message: string;

  if (avgBrightness >= IDEAL_MIN && avgBrightness <= IDEAL_MAX) {
    score = 100;
    passed = true;
    message = 'Perfect lighting';
  } else if (avgBrightness >= ACCEPTABLE_MIN && avgBrightness <= ACCEPTABLE_MAX) {
    if (avgBrightness < IDEAL_MIN) {
      score = 60 + ((avgBrightness - ACCEPTABLE_MIN) / (IDEAL_MIN - ACCEPTABLE_MIN)) * 40;
      message = 'Slightly dark - add more light';
    } else {
      score = 60 + ((ACCEPTABLE_MAX - avgBrightness) / (ACCEPTABLE_MAX - IDEAL_MAX)) * 40;
      message = 'Slightly bright - reduce light';
    }
    passed = false;
  } else {
    score = avgBrightness < ACCEPTABLE_MIN ? 20 : 20;
    passed = false;
    message = avgBrightness < ACCEPTABLE_MIN
      ? 'Too dark - move to brighter area'
      : 'Too bright - reduce direct light';
  }

  return { score, passed, message };
}

// Contrast check
function checkContrast(
  imageData: ImageData,
  bounds?: { x: number; y: number; width: number; height: number }
): QualityCheck {
  const { data, width, height } = imageData;
  const region = bounds || { x: 0, y: 0, width, height };

  const brightnesses: number[] = [];

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      brightnesses.push(brightness);
    }
  }

  // Calculate standard deviation
  const mean = brightnesses.reduce((sum, val) => sum + val, 0) / brightnesses.length;
  const variance = brightnesses.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / brightnesses.length;
  const stdDev = Math.sqrt(variance);

  // Good contrast: stdDev > 30, Excellent: > 50
  const EXCELLENT_THRESHOLD = 50;
  const GOOD_THRESHOLD = 30;
  const ACCEPTABLE_THRESHOLD = 20;

  let score: number;
  let passed: boolean;
  let message: string;

  if (stdDev >= EXCELLENT_THRESHOLD) {
    score = 100;
    passed = true;
    message = 'Excellent contrast';
  } else if (stdDev >= GOOD_THRESHOLD) {
    score = 70 + ((stdDev - GOOD_THRESHOLD) / (EXCELLENT_THRESHOLD - GOOD_THRESHOLD)) * 30;
    passed = true;
    message = 'Good contrast';
  } else if (stdDev >= ACCEPTABLE_THRESHOLD) {
    score = 40 + ((stdDev - ACCEPTABLE_THRESHOLD) / (GOOD_THRESHOLD - ACCEPTABLE_THRESHOLD)) * 30;
    passed = false;
    message = 'Low contrast - adjust lighting';
  } else {
    score = (stdDev / ACCEPTABLE_THRESHOLD) * 40;
    passed = false;
    message = 'Very low contrast - improve lighting setup';
  }

  return { score, passed, message };
}

// Glare detection (bright spots)
function checkGlare(
  imageData: ImageData,
  bounds?: { x: number; y: number; width: number; height: number }
): QualityCheck {
  const { data, width, height } = imageData;
  const region = bounds || { x: 0, y: 0, width, height };

  const GLARE_THRESHOLD = 240; // Pixels brighter than this are considered glare
  const MAX_GLARE_PERCENTAGE = 0.05; // Maximum 5% glare acceptable

  let glarePixels = 0;
  let totalPixels = 0;

  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      if (brightness >= GLARE_THRESHOLD) {
        glarePixels++;
      }
      totalPixels++;
    }
  }

  const glarePercentage = glarePixels / totalPixels;

  let score: number;
  let passed: boolean;
  let message: string;

  if (glarePercentage <= MAX_GLARE_PERCENTAGE) {
    score = 100 - (glarePercentage / MAX_GLARE_PERCENTAGE) * 100;
    passed = true;
    message = glarePercentage < 0.01 ? 'No glare detected' : 'Minimal glare';
  } else {
    score = Math.max(0, 50 - ((glarePercentage - MAX_GLARE_PERCENTAGE) / MAX_GLARE_PERCENTAGE) * 50);
    passed = false;
    message = 'Glare detected - adjust angle or lighting';
  }

  return { score, passed, message };
}

// Card coverage check (is card filling enough of the frame?)
function checkCoverage(
  imageData: ImageData,
  bounds?: { x: number; y: number; width: number; height: number }
): QualityCheck {
  const { width, height } = imageData;

  if (!bounds) {
    return {
      score: 50,
      passed: false,
      message: 'Unable to detect card boundaries'
    };
  }

  const cardArea = bounds.width * bounds.height;
  const frameArea = width * height;
  const coverage = cardArea / frameArea;

  // Ideal: 60-75% of frame
  const IDEAL_MIN = 0.60;
  const IDEAL_MAX = 0.75;
  const ACCEPTABLE_MIN = 0.50;
  const ACCEPTABLE_MAX = 0.85;

  let score: number;
  let passed: boolean;
  let message: string;

  if (coverage >= IDEAL_MIN && coverage <= IDEAL_MAX) {
    score = 100;
    passed = true;
    message = 'Perfect card size';
  } else if (coverage >= ACCEPTABLE_MIN && coverage <= ACCEPTABLE_MAX) {
    if (coverage < IDEAL_MIN) {
      score = 60 + ((coverage - ACCEPTABLE_MIN) / (IDEAL_MIN - ACCEPTABLE_MIN)) * 40;
      message = 'Move closer to card';
    } else {
      score = 60 + ((ACCEPTABLE_MAX - coverage) / (ACCEPTABLE_MAX - IDEAL_MAX)) * 40;
      message = 'Move further from card';
    }
    passed = false;
  } else {
    score = coverage < ACCEPTABLE_MIN ? 20 : 20;
    passed = false;
    message = coverage < ACCEPTABLE_MIN
      ? 'Card too small - move much closer'
      : 'Card too large - move back';
  }

  return { score, passed, message };
}
```

### Integration with Camera Component

```typescript
// Update ImagePreview.tsx to validate before confirming

import { validateImageQuality } from '@/utils/imageQuality';

export default function ImagePreview({ imageUrl, side, onRetake, onConfirm }: ImagePreviewProps) {
  const [validation, setValidation] = useState<QualityValidation | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = validateImageQuality(imageData);

      setValidation(result);
      setIsValidating(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Image preview */}
      <div className="w-full h-full flex items-center justify-center p-4">
        <img src={imageUrl} alt={`${side} of card`} className="max-w-full max-h-full object-contain rounded-lg" />

        {/* Quality overlay */}
        {validation && !validation.isValid && (
          <div className="absolute top-20 left-4 right-4 bg-yellow-600/90 text-white p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Image Quality Issues</h3>
                <ul className="text-sm space-y-1">
                  {validation.suggestions.map((suggestion, i) => (
                    <li key={i}>• {suggestion}</li>
                  ))}
                </ul>
                <p className="text-xs mt-2 opacity-90">
                  You can still use this photo, but quality may affect grading accuracy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quality score indicator */}
        {validation && (
          <div className="absolute top-4 right-4 bg-black/60 px-3 py-2 rounded-lg">
            <div className="text-white text-sm font-medium">
              Quality: {Math.round(validation.overallScore)}%
            </div>
            <div className="mt-1 bg-gray-700 rounded-full h-2 w-20 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  validation.overallScore >= 80 ? 'bg-green-400' :
                  validation.overallScore >= 60 ? 'bg-yellow-400' :
                  'bg-red-400'
                }`}
                style={{ width: `${validation.overallScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="flex gap-4">
          <button
            onClick={onRetake}
            className="flex-1 bg-white/20 text-white py-3 rounded-lg font-medium hover:bg-white/30"
          >
            Retake
          </button>
          <button
            onClick={onConfirm}
            disabled={isValidating}
            className={`flex-1 py-3 rounded-lg font-medium ${
              validation?.isValid
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            } disabled:opacity-50`}
          >
            {isValidating ? 'Validating...' : validation?.isValid ? 'Use This Photo' : 'Use Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## ✂️ OPTIONAL FEATURE 3: Automatic Crop to Card Boundaries

### Overview
Automatically detect card edges and crop the image to include only the card, removing background. This improves AI grading accuracy and creates cleaner card images.

### Benefits
- ✅ Better AI grading accuracy
- ✅ Smaller file sizes
- ✅ Consistent card presentation
- ✅ Professional appearance

### Implementation

```typescript
// src/utils/cardCrop.ts

export interface CropResult {
  croppedImage: Blob;
  croppedDataUrl: string;
  originalSize: { width: number; height: number };
  croppedSize: { width: number; height: number };
  success: boolean;
}

export async function autoCropCard(
  imageData: ImageData,
  corners?: { x: number; y: number }[]
): Promise<CropResult> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // If corners provided (from detection), use perspective transform
  if (corners && corners.length === 4) {
    return perspectiveCrop(imageData, corners);
  }

  // Otherwise, use edge detection to find card
  return edgeBasedCrop(imageData);
}

// Perspective transform crop (when corners are known)
async function perspectiveCrop(
  imageData: ImageData,
  corners: { x: number; y: number }[]
): Promise<CropResult> {
  // Standard card dimensions (in pixels)
  const CARD_WIDTH = 750;  // 2.5 inches at 300 DPI
  const CARD_HEIGHT = 1050; // 3.5 inches at 300 DPI

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Order corners: top-left, top-right, bottom-right, bottom-left
  const orderedCorners = orderCornersClockwise(corners);

  // Calculate perspective transform matrix
  const transform = calculatePerspectiveTransform(
    orderedCorners,
    [
      { x: 0, y: 0 },
      { x: CARD_WIDTH, y: 0 },
      { x: CARD_WIDTH, y: CARD_HEIGHT },
      { x: 0, y: CARD_HEIGHT }
    ]
  );

  // Apply transform
  ctx.setTransform(
    transform.m11, transform.m12,
    transform.m21, transform.m22,
    transform.m31, transform.m32
  );

  // Draw transformed image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
  });

  return {
    croppedImage: blob,
    croppedDataUrl: canvas.toDataURL('image/jpeg', 0.95),
    originalSize: { width: imageData.width, height: imageData.height },
    croppedSize: { width: CARD_WIDTH, height: CARD_HEIGHT },
    success: true
  };
}

// Edge-based crop (when corners not detected)
async function edgeBasedCrop(imageData: ImageData): Promise<CropResult> {
  const { data, width, height } = imageData;

  // Convert to grayscale
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  // Find content bounds (non-background pixels)
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // Estimate background color (most common color at edges)
  const bgColor = estimateBackgroundColor(gray, width, height);
  const threshold = 30; // Color difference threshold

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const diff = Math.abs(gray[idx] - bgColor);

      if (diff > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Add 5% padding
  const padding = 0.05;
  const paddingX = Math.round((maxX - minX) * padding);
  const paddingY = Math.round((maxY - minY) * padding);

  minX = Math.max(0, minX - paddingX);
  minY = Math.max(0, minY - paddingY);
  maxX = Math.min(width, maxX + paddingX);
  maxY = Math.min(height, maxY + paddingY);

  const cropWidth = maxX - minX;
  const cropHeight = maxY - minY;

  // Create cropped canvas
  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw cropped region
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(
    tempCanvas,
    minX, minY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );

  // Convert to blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
  });

  return {
    croppedImage: blob,
    croppedDataUrl: canvas.toDataURL('image/jpeg', 0.95),
    originalSize: { width, height },
    croppedSize: { width: cropWidth, height: cropHeight },
    success: cropWidth > 100 && cropHeight > 100 // Sanity check
  };
}

// Helper: Estimate background color
function estimateBackgroundColor(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): number {
  // Sample pixels from edges
  const samples: number[] = [];

  // Top and bottom edges
  for (let x = 0; x < width; x += 10) {
    samples.push(gray[x]); // Top
    samples.push(gray[(height - 1) * width + x]); // Bottom
  }

  // Left and right edges
  for (let y = 0; y < height; y += 10) {
    samples.push(gray[y * width]); // Left
    samples.push(gray[y * width + (width - 1)]); // Right
  }

  // Return median
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

// Helper: Order corners clockwise from top-left
function orderCornersClockwise(
  corners: { x: number; y: number }[]
): { x: number; y: number }[] {
  // Find center
  const centerX = corners.reduce((sum, p) => sum + p.x, 0) / corners.length;
  const centerY = corners.reduce((sum, p) => sum + p.y, 0) / corners.length;

  // Sort by angle from center
  const sorted = corners
    .map(p => ({
      ...p,
      angle: Math.atan2(p.y - centerY, p.x - centerX)
    }))
    .sort((a, b) => a.angle - b.angle);

  // Find top-left (smallest x + y)
  const topLeftIdx = sorted.reduce((minIdx, p, idx) => {
    const currentMin = sorted[minIdx];
    return (p.x + p.y < currentMin.x + currentMin.y) ? idx : minIdx;
  }, 0);

  // Rotate array to start from top-left
  return [
    ...sorted.slice(topLeftIdx),
    ...sorted.slice(0, topLeftIdx)
  ].map(({ x, y }) => ({ x, y }));
}

// Helper: Calculate perspective transform matrix
function calculatePerspectiveTransform(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[]
): {
  m11: number; m12: number;
  m21: number; m22: number;
  m31: number; m32: number;
} {
  // Simplified affine transform (works for moderate perspective)
  // For full perspective, use homography matrix calculation

  const sx0 = src[0].x, sy0 = src[0].y;
  const sx1 = src[1].x, sy1 = src[1].y;
  const sx2 = src[2].x, sy2 = src[2].y;

  const dx0 = dst[0].x, dy0 = dst[0].y;
  const dx1 = dst[1].x, dy1 = dst[1].y;
  const dx2 = dst[2].x, dy2 = dst[2].y;

  const m11 = (dx1 - dx0) / (sx1 - sx0);
  const m12 = (dy1 - dy0) / (sx1 - sx0);
  const m21 = (dx2 - dx0) / (sy2 - sy0);
  const m22 = (dy2 - dy0) / (sy2 - sy0);
  const m31 = dx0 - m11 * sx0 - m21 * sy0;
  const m32 = dy0 - m12 * sx0 - m22 * sy0;

  return { m11, m12, m21, m22, m31, m32 };
}
```

### Integration with Capture Flow

```typescript
// Update useCamera hook to include auto-crop

export const useCamera = () => {
  // ... existing code ...

  const captureAndCropImage = async (
    corners?: { x: number; y: number }[]
  ): Promise<CapturedImage | null> => {
    if (!videoRef.current) return null;

    // Capture original image
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoRef.current, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Auto-crop
    const cropResult = await autoCropCard(imageData, corners);

    if (!cropResult.success) {
      // Fallback to original if crop failed
      return captureImage();
    }

    const file = new File(
      [cropResult.croppedImage],
      `card-${Date.now()}.jpg`,
      { type: 'image/jpeg' }
    );

    return {
      dataUrl: cropResult.croppedDataUrl,
      blob: cropResult.croppedImage,
      file,
      timestamp: Date.now()
    };
  };

  return {
    // ... existing returns ...
    captureAndCropImage
  };
};
```

---

## 🎨 OPTIONAL FEATURE 4: Branding & Theming

### Overview
Customize the camera UI to match your brand identity with colors, logos, and styling.

### Brand Colors

Create a theme configuration:

```typescript
// src/config/cameraTheme.ts

export interface CameraTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
  text: {
    primary: string;
    secondary: string;
    light: string;
  };
  guide: {
    default: string;
    detected: string;
    perfect: string;
  };
}

// Default DCM theme (based on your existing branding)
export const dcmTheme: CameraTheme = {
  primary: '#6366f1',      // Indigo-600 (matches your grade boxes)
  secondary: '#8b5cf6',    // Purple-600 (matches your gradients)
  success: '#10b981',      // Green-500
  warning: '#f59e0b',      // Amber-500
  error: '#ef4444',        // Red-500
  overlay: 'rgba(0, 0, 0, 0.3)',
  text: {
    primary: '#ffffff',
    secondary: '#e5e7eb',
    light: 'rgba(255, 255, 255, 0.8)'
  },
  guide: {
    default: '#ffffff',
    detected: '#10b981',   // Green when card detected
    perfect: '#3b82f6'     // Blue when perfectly aligned
  }
};

// Alternative: Sports card theme (red/orange)
export const sportsTheme: CameraTheme = {
  primary: '#dc2626',      // Red-600
  secondary: '#ea580c',    // Orange-600
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  overlay: 'rgba(0, 0, 0, 0.3)',
  text: {
    primary: '#ffffff',
    secondary: '#e5e7eb',
    light: 'rgba(255, 255, 255, 0.8)'
  },
  guide: {
    default: '#ffffff',
    detected: '#10b981',
    perfect: '#3b82f6'
  }
};

// Pokemon theme (yellow/blue)
export const pokemonTheme: CameraTheme = {
  primary: '#eab308',      // Yellow-500
  secondary: '#3b82f6',    // Blue-500
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  overlay: 'rgba(0, 0, 0, 0.3)',
  text: {
    primary: '#ffffff',
    secondary: '#e5e7eb',
    light: 'rgba(255, 255, 255, 0.8)'
  },
  guide: {
    default: '#ffffff',
    detected: '#10b981',
    perfect: '#3b82f6'
  }
};
```

### Apply Theme to Components

Update `CameraGuideOverlay.tsx`:

```typescript
import { dcmTheme, type CameraTheme } from '@/config/cameraTheme';

interface CameraGuideOverlayProps {
  cardDetected?: boolean;
  confidence?: number;
  message?: string;
  theme?: CameraTheme;
}

export default function CameraGuideOverlay({
  cardDetected = false,
  confidence = 0,
  message = 'Position card in frame',
  theme = dcmTheme
}: CameraGuideOverlayProps) {
  const getBorderColor = () => {
    if (confidence >= 90) return theme.guide.perfect;
    if (confidence >= 70) return theme.guide.detected;
    return theme.guide.default;
  };

  const getBorderStyle = () => {
    const color = getBorderColor();
    return {
      borderColor: color,
      boxShadow: `0 0 20px ${color}40`
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Overlay with theme color */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: theme.overlay }}
      />

      {/* Card guide */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className="relative border-4 rounded-lg transition-all duration-300"
          style={{
            ...getBorderStyle(),
            width: '80%',
            maxWidth: '350px',
            aspectRatio: '2.5 / 3.5'
          }}
        >
          {/* Branded corner markers */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
            <div
              key={corner}
              className="absolute w-10 h-10 border-4 transition-all duration-300"
              style={{
                borderColor: getBorderColor(),
                ...(corner === 'top-left' && { top: -2, left: -2, borderRight: 0, borderBottom: 0 }),
                ...(corner === 'top-right' && { top: -2, right: -2, borderLeft: 0, borderBottom: 0 }),
                ...(corner === 'bottom-left' && { bottom: -2, left: -2, borderRight: 0, borderTop: 0 }),
                ...(corner === 'bottom-right' && { bottom: -2, right: -2, borderLeft: 0, borderTop: 0 })
              }}
            />
          ))}

          {/* DCM Logo watermark (optional) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <img
              src="/DCM-logo.png"
              alt="DCM"
              className="w-20 h-20 object-contain"
            />
          </div>

          {/* Confidence indicator */}
          {confidence > 0 && (
            <div className="absolute -bottom-10 left-0 right-0 px-4">
              <div className="bg-black/60 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${confidence}%`,
                    backgroundColor: getBorderColor()
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Branded instruction message */}
      <div className="absolute top-4 left-0 right-0 text-center">
        <div
          className="inline-block px-4 py-2 rounded-full transition-colors"
          style={{
            backgroundColor: cardDetected ? theme.success + 'cc' : 'rgba(0, 0, 0, 0.6)',
            color: theme.text.primary
          }}
        >
          <p className="text-sm font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}
```

### Logo Integration

Add your logo to camera header:

```typescript
// Update MobileCamera.tsx header

<div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
  <div className="flex items-center justify-between text-white">
    <button onClick={onCancel} className="text-lg">
      ← Back
    </button>

    {/* Centered logo + title */}
    <div className="flex items-center gap-2">
      <img
        src="/DCM-logo.png"
        alt="DCM"
        className="w-8 h-8"
      />
      <h2 className="text-lg font-semibold">
        {side === 'front' ? 'Front of Card' : 'Back of Card'}
      </h2>
    </div>

    <div className="w-16" />
  </div>
</div>
```

### Capture Button Styling

```typescript
// Branded capture button with your colors

<button
  onClick={handleCapture}
  disabled={isLoading || !hasPermission}
  className="relative w-20 h-20 rounded-full disabled:opacity-50"
  style={{
    borderWidth: '4px',
    borderColor: dcmTheme.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  }}
>
  <div
    className="w-16 h-16 rounded-full m-auto"
    style={{ backgroundColor: dcmTheme.primary }}
  />

  {/* Pulse animation when ready */}
  {detection.isCardDetected && (
    <div
      className="absolute inset-0 rounded-full animate-ping"
      style={{
        borderWidth: '4px',
        borderColor: dcmTheme.success,
        opacity: 0.5
      }}
    />
  )}
</button>
```

### Category-Specific Themes

Apply different themes based on card category:

```typescript
// In upload pages, pass category theme

import { dcmTheme, sportsTheme, pokemonTheme } from '@/config/cameraTheme';

// Sports page
<MobileCamera
  side={side}
  onCapture={handleCapture}
  onCancel={handleCancel}
  theme={sportsTheme}  // Red/Orange
/>

// Pokemon page
<MobileCamera
  side={side}
  onCapture={handleCapture}
  onCancel={handleCancel}
  theme={pokemonTheme}  // Yellow/Blue
/>

// MTG/Lorcana/Other
<MobileCamera
  side={side}
  onCapture={handleCapture}
  onCancel={handleCancel}
  theme={dcmTheme}  // Default Indigo/Purple
/>
```

### Custom Animations

```typescript
// src/styles/cameraAnimations.css

@keyframes cardDetected {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes cornerPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.card-detected-animation {
  animation: cardDetected 1s ease-in-out infinite;
}

.corner-pulse-animation {
  animation: cornerPulse 1.5s ease-in-out infinite;
}
```

Apply animations:

```typescript
<div
  className={`border-4 rounded-lg transition-all ${
    cardDetected ? 'card-detected-animation' : ''
  }`}
>
  {/* Corner markers with pulse */}
  <div className={cardDetected ? 'corner-pulse-animation' : ''}>
    {/* ... corner divs ... */}
  </div>
</div>
```

---

## 📊 Performance Impact of Optional Features

| Feature | Performance Impact | Battery Impact | Size Impact |
|---------|-------------------|----------------|-------------|
| **Auto-Detect (Simple)** | Low (60 FPS) | Low | None |
| **Auto-Detect (OpenCV)** | Medium (15-30 FPS) | Medium | +500 KB |
| **Quality Validation** | Low (once per capture) | Minimal | None |
| **Auto-Crop** | Low (once per capture) | Minimal | None |
| **Branding/Theming** | Negligible | None | +5-10 KB |

### Optimization Recommendations

1. **Use Simple Auto-Detect First**: Start with Option A, upgrade to OpenCV only if needed
2. **Throttle Detection**: Run every 2-3 frames instead of every frame
3. **Lazy Load OpenCV**: Only load when camera is opened
4. **Cache Results**: Store validation results, don't recalculate

```typescript
// Throttled detection example
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 100; // ms (10 FPS)

const detectCard = () => {
  const now = Date.now();

  if (now - lastDetectionTime < DETECTION_INTERVAL) {
    animationFrame = requestAnimationFrame(detectCard);
    return;
  }

  lastDetectionTime = now;
  // ... perform detection ...
};
```

---

## 🎯 Recommendation Matrix

| Use Case | Auto-Detect | Quality Validation | Auto-Crop | Custom Branding |
|----------|------------|-------------------|-----------|-----------------|
| **MVP Launch** | ✅ Simple | ✅ Basic | ❌ Skip | ✅ Logo Only |
| **Beta Testing** | ✅ Simple | ✅ Full | ✅ Yes | ✅ Full Theme |
| **Production** | Consider OpenCV | ✅ Full | ✅ Yes | ✅ Full Theme |
| **Low-End Devices** | ⚠️ Simple Only | ✅ Basic | ❌ Skip | ✅ Light Theme |
| **High-End Devices** | ✅ OpenCV | ✅ Full | ✅ Yes | ✅ Full Theme + Animations |

**Our Recommendation for Initial Launch:**
1. ✅ **Auto-Detect**: Option A (Simple) - good balance
2. ✅ **Quality Validation**: Basic (blur + brightness only)
3. ❌ **Auto-Crop**: Skip for now, add in v2
4. ✅ **Branding**: Logo + themed colors (no complex animations)

This gives you 80% of the value with 20% of the complexity!

---

## ✅ Testing Checklist

### Unit Tests
- [ ] Camera permission handling
- [ ] Image capture and conversion
- [ ] File upload fallback
- [ ] Device detection

### Integration Tests
- [ ] Camera → Preview → Upload flow
- [ ] Gallery picker → Upload flow
- [ ] Error handling (permission denied)
- [ ] Cleanup on unmount

### Device Testing
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Android (Firefox)
- [ ] iPad/Tablet
- [ ] Desktop fallback

### User Experience Testing
- [ ] Guide overlay visible and helpful
- [ ] Capture button responsive
- [ ] Image preview clear
- [ ] Retake works correctly
- [ ] Upload completes successfully

---

## 🚀 Deployment Considerations

### 1. HTTPS Requirement
- ✅ Already handled (Vercel provides HTTPS)
- Camera APIs blocked on HTTP sites

### 2. Browser Permissions
- User must grant camera permission
- Permission persists per domain
- Provide clear UI for denied permissions

### 3. Performance
- Video stream can be resource-intensive
- Stop camera stream when not in use
- Compress images before upload (already implemented)

### 4. Security
- No storage of camera stream
- Images only captured when user clicks button
- User can review before confirming

---

## 📊 Estimated Timeline

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| **Phase 1** | Setup, hooks, types | 4-6 hours |
| **Phase 2** | Camera components | 6-8 hours |
| **Phase 3** | Upload selector | 2-3 hours |
| **Phase 4** | Integration | 3-4 hours |
| **Testing** | All devices/browsers | 4-6 hours |
| **Total** | | **19-27 hours** |

Recommended: 3-4 days of focused development + 1 day testing

---

## 💡 Best Practices & Tips

### 1. Progressive Enhancement
- Always provide manual upload fallback
- Don't assume camera is available
- Graceful degradation for unsupported browsers

### 2. User Experience
- Clear instructions at each step
- Visual feedback during capture
- Allow retakes without penalty
- Show loading states

### 3. Performance
- Clean up camera streams
- Compress images before upload
- Lazy load camera components
- Use proper error boundaries

### 4. Accessibility
- Screen reader support
- Keyboard navigation
- High contrast mode support
- Alternative text for all icons

---

## 🔄 Migration Path

### Backward Compatibility
- ✅ Existing upload functionality preserved
- ✅ Desktop users see no changes
- ✅ Mobile users get new camera option first
- ✅ Gallery upload still available

### Rollout Strategy
1. **Week 1**: Deploy to staging, internal testing
2. **Week 2**: Beta test with select mobile users
3. **Week 3**: Full rollout with monitoring
4. **Week 4**: Collect feedback, iterate

---

## 📚 Additional Resources

### Documentation
- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Can I Use: getUserMedia](https://caniuse.com/stream)
- [Web.dev: Accessing the Camera](https://web.dev/media-capturing-images/)

### Libraries to Consider
- `react-camera-pro`: Camera component for React
- `opencv.js`: Computer vision for card detection
- `pica`: High-quality image resize
- `compressorjs`: Image compression

### Similar Implementations
- Banking apps (check deposit)
- Document scanners
- AR apps with overlays

---

## 🎯 Success Metrics

After implementation, measure:
- **Adoption Rate**: % of mobile users using camera vs gallery
- **Upload Success Rate**: % of camera captures that complete upload
- **Image Quality**: AI grading confidence scores (should improve)
- **User Satisfaction**: Feedback/ratings on camera experience
- **Time to Upload**: Average time from landing to upload complete

Target Goals:
- 70%+ mobile users prefer camera over gallery
- 90%+ camera capture success rate
- 5-10% improvement in AI confidence scores
- <30 seconds average upload time

---

## 🔐 Privacy & Security Notes

- Camera stream never leaves device until user confirms
- No automatic captures or recording
- Explicit user consent required
- Clear indication when camera is active
- Easy opt-out to manual upload

---

## End of Plan

**Next Steps:**
1. Review this plan
2. Approve or request modifications
3. Begin Phase 1 implementation
4. Set up development environment
5. Create feature branch: `feature/mobile-camera-capture`

**Questions to Consider:**
- Do you want auto card detection or manual capture only?
- Should we implement automatic cropping?
- Do you want image quality validation before upload?
- Any specific branding for the camera UI?

---

*This plan is ready for implementation. Let me know when you'd like to proceed!*
