# Camera Module Optimization Plan (Revised)

## User Requirements
- **Auto-capture**: Yes - capture automatically when conditions are optimal
- **Orientation**: Support both portrait AND landscape cards with adjustable guidelines
- **Flash/Torch**: Eliminated - causes glare on cards
- **Detection**: Full edge detection for accuracy (acceptable CPU usage for <2 min sessions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      MobileCamera.tsx                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  useCamera   │  │ useCardDetect│  │ useCaptureReadiness   │ │
│  │  - stream    │  │ - edges      │  │ - stability           │ │
│  │  - focus     │  │ - corners    │  │ - quality score       │ │
│  │  - exposure  │  │ - alignment  │  │ - auto-capture timer  │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │              CameraGuideOverlay                           │  │
│  │  - Orientation toggle (portrait/landscape)                │  │
│  │  - Dynamic guide frame                                    │  │
│  │  - Real-time alignment feedback                           │  │
│  │  - Auto-capture countdown indicator                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Camera Constraints & Core Improvements

### 1.1 Updated Camera Constraints

```typescript
// useCamera.ts - Updated constraints
const getOptimalConstraints = (facingMode: 'user' | 'environment') => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Base constraints
  const constraints: MediaTrackConstraints = {
    facingMode: isIOS ? facingMode : { exact: facingMode },
    // Request 4:3 aspect ratio (closer to card ratio than 16:9)
    width: { ideal: 2160, min: 1080 },
    height: { ideal: 2880, min: 1440 },
    aspectRatio: { ideal: 4/3 },
    frameRate: { ideal: 30, max: 30 },
  };

  // Advanced constraints for supported devices
  if (!isIOS) {
    Object.assign(constraints, {
      focusMode: { ideal: 'continuous' },
      exposureMode: { ideal: 'continuous' },
      whiteBalanceMode: { ideal: 'continuous' },
    });
  }

  return { video: constraints };
};
```

### 1.2 Focus & Exposure Lock on Capture

```typescript
// Lock camera settings just before capture for consistency
const lockSettingsForCapture = async (): Promise<void> => {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;

  const capabilities = track.getCapabilities?.();
  const settings = track.getSettings?.();

  if (!capabilities || !settings) return;

  const advancedConstraints: MediaTrackConstraintSet[] = [];

  // Lock focus at current distance
  if (capabilities.focusMode?.includes('manual') && settings.focusDistance) {
    advancedConstraints.push({
      focusMode: 'manual',
      focusDistance: settings.focusDistance,
    });
  }

  // Lock exposure at current level
  if (capabilities.exposureMode?.includes('manual')) {
    advancedConstraints.push({
      exposureMode: 'manual',
    });
  }

  if (advancedConstraints.length > 0) {
    await track.applyConstraints({ advanced: advancedConstraints });
  }
};

const unlockSettings = async (): Promise<void> => {
  const track = stream?.getVideoTracks()[0];
  if (!track) return;

  await track.applyConstraints({
    advanced: [{
      focusMode: 'continuous',
      exposureMode: 'continuous',
    }]
  });
};
```

---

## Phase 2: Enhanced Card Detection

### 2.1 New Detection Architecture

```typescript
// types/camera.ts - New interfaces

export interface CardBounds {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

export interface Point {
  x: number;
  y: number;
}

export type CardOrientation = 'portrait' | 'landscape' | 'unknown';

export interface CardDetectionResult {
  // Card found?
  detected: boolean;
  confidence: number;  // 0-100

  // Card boundaries (if detected)
  bounds: CardBounds | null;
  orientation: CardOrientation;

  // Alignment quality
  alignment: {
    isCentered: boolean;        // Card center within 10% of frame center
    isParallel: boolean;        // Card edges parallel to frame edges (< 5° rotation)
    rotationAngle: number;      // Degrees of rotation (-45 to 45)
    fillPercent: number;        // How much of guide frame is filled (0-100)
    isWithinGuide: boolean;     // All corners inside guide area
  };

  // Quality warnings
  warnings: CardWarning[];

  // Computed
  readyForCapture: boolean;
}

export type CardWarning =
  | 'card_too_small'      // Move closer
  | 'card_too_large'      // Move back
  | 'card_rotated'        // Straighten card
  | 'card_off_center'     // Center the card
  | 'corners_cut_off'     // All 4 corners not visible
  | 'glare_detected'      // Bright spot detected
  | 'shadow_detected'     // Dark region on card
  | 'blur_detected';      // Motion or focus blur
```

### 2.2 Edge Detection Algorithm

```typescript
// hooks/useCardDetection.ts - Enhanced detection

/**
 * Sobel edge detection for finding card boundaries
 * More accurate than texture-only detection
 */
function detectEdges(imageData: ImageData): EdgeMap {
  const { data, width, height } = imageData;
  const edges = new Float32Array(width * height);

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  // Convert to grayscale and apply Sobel
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[ki];
          gy += gray * sobelY[ki];
        }
      }

      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return { edges, width, height };
}

/**
 * Find card corners using Harris corner detection
 */
function findCardCorners(edges: EdgeMap): Point[] {
  // Implementation of Harris corner detection
  // Returns array of potential corner points
  // ...
}

/**
 * Find the 4 corners that form a rectangle (the card)
 */
function findCardRectangle(corners: Point[], width: number, height: number): CardBounds | null {
  // Use RANSAC or similar to find 4 corners forming a rectangle
  // Validate aspect ratio is close to standard card (2.5:3.5)
  // ...
}
```

### 2.3 Glare & Shadow Detection

```typescript
/**
 * Detect glare (overexposed regions) and shadows
 * Critical for card photography quality
 */
function detectLightingIssues(
  imageData: ImageData,
  cardBounds: CardBounds | null
): { hasGlare: boolean; hasShadow: boolean; regions: Region[] } {
  if (!cardBounds) return { hasGlare: false, hasShadow: false, regions: [] };

  const { data, width } = imageData;
  const regions: Region[] = [];

  // Sample pixels within card bounds
  const cardPixels = getPixelsInBounds(imageData, cardBounds);

  // Calculate histogram
  const histogram = new Array(256).fill(0);
  cardPixels.forEach(p => histogram[p]++);

  // Glare: significant pixels > 250
  const glarePixels = histogram.slice(250).reduce((a, b) => a + b, 0);
  const hasGlare = glarePixels > cardPixels.length * 0.02; // >2% overexposed

  // Shadow: significant pixels < 30 in localized region
  const shadowPixels = histogram.slice(0, 30).reduce((a, b) => a + b, 0);
  const hasShadow = shadowPixels > cardPixels.length * 0.15; // >15% underexposed

  return { hasGlare, hasShadow, regions };
}
```

---

## Phase 3: Orientation Support & Adjustable Guidelines

### 3.1 Orientation Detection & Toggle

```typescript
// types/camera.ts
export type GuideOrientation = 'portrait' | 'landscape';

// Standard card aspect ratios
export const CARD_ASPECT_RATIOS = {
  portrait: 2.5 / 3.5,   // 0.714 (width/height when portrait)
  landscape: 3.5 / 2.5,  // 1.4 (width/height when landscape)
};
```

```typescript
// hooks/useGuideOrientation.ts
export function useGuideOrientation(detectedOrientation: CardOrientation) {
  const [manualOrientation, setManualOrientation] = useState<GuideOrientation | null>(null);

  // Use manual override if set, otherwise use detected
  const activeOrientation: GuideOrientation =
    manualOrientation ??
    (detectedOrientation === 'landscape' ? 'landscape' : 'portrait');

  const toggleOrientation = () => {
    setManualOrientation(prev =>
      prev === 'portrait' ? 'landscape' :
      prev === 'landscape' ? 'portrait' :
      activeOrientation === 'portrait' ? 'landscape' : 'portrait'
    );
  };

  // Auto-detect from card if no manual override
  useEffect(() => {
    if (!manualOrientation && detectedOrientation !== 'unknown') {
      // Don't auto-switch, just update internal state
    }
  }, [detectedOrientation, manualOrientation]);

  return {
    orientation: activeOrientation,
    toggleOrientation,
    isManualOverride: manualOrientation !== null,
    resetToAuto: () => setManualOrientation(null),
  };
}
```

### 3.2 Updated Guide Overlay Component

```typescript
// components/camera/CameraGuideOverlay.tsx

interface CameraGuideOverlayProps {
  side: 'front' | 'back';
  orientation: GuideOrientation;
  onToggleOrientation: () => void;

  // Detection results
  cardDetected: boolean;
  cardBounds: CardBounds | null;
  alignment: AlignmentInfo;
  warnings: CardWarning[];

  // Auto-capture state
  autoCaptureCountdown: number | null;  // null = not counting, 0-3 = seconds
  readyForCapture: boolean;
}

export default function CameraGuideOverlay({
  side,
  orientation,
  onToggleOrientation,
  cardDetected,
  cardBounds,
  alignment,
  warnings,
  autoCaptureCountdown,
  readyForCapture,
}: CameraGuideOverlayProps) {

  // Calculate guide dimensions based on orientation
  const guideStyle = useMemo(() => {
    const aspectRatio = CARD_ASPECT_RATIOS[orientation];

    if (orientation === 'portrait') {
      return {
        width: '75%',
        maxWidth: '320px',
        aspectRatio: `${2.5} / ${3.5}`,
      };
    } else {
      return {
        width: '90%',
        maxWidth: '480px',
        aspectRatio: `${3.5} / ${2.5}`,
      };
    }
  }, [orientation]);

  // Border color based on state
  const borderColor = useMemo(() => {
    if (autoCaptureCountdown !== null) return 'border-green-400';
    if (readyForCapture) return 'border-green-400';
    if (cardDetected) return 'border-yellow-400';
    return 'border-white/80';
  }, [autoCaptureCountdown, readyForCapture, cardDetected]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Orientation Toggle Button - pointer-events-auto to be clickable */}
      <button
        onClick={onToggleOrientation}
        className="absolute top-4 left-4 pointer-events-auto bg-black/60 text-white px-3 py-2 rounded-lg flex items-center gap-2 z-10"
      >
        <span className="text-lg">{orientation === 'portrait' ? '📱' : '📺'}</span>
        <span className="text-xs font-medium">
          {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
        </span>
      </button>

      {/* Card Guide Frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative border-4 rounded-lg transition-all duration-300 ${borderColor}`}
          style={guideStyle}
        >
          {/* Corner brackets */}
          {/* ... existing corner bracket code ... */}

          {/* Side indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="bg-black/60 text-white px-6 py-2 rounded-lg">
              <p className="text-lg font-bold text-center">
                {side === 'front' ? 'FRONT' : 'BACK'}
              </p>
            </div>
          </div>

          {/* Auto-capture countdown */}
          {autoCaptureCountdown !== null && (
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
              <div className="bg-green-500 text-white px-6 py-3 rounded-full animate-pulse">
                <p className="text-xl font-bold">
                  {autoCaptureCountdown === 0 ? '📸' : autoCaptureCountdown}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alignment Feedback */}
      <div className="absolute bottom-32 left-0 right-0 px-4">
        <AlignmentFeedback
          alignment={alignment}
          warnings={warnings}
          readyForCapture={readyForCapture}
        />
      </div>
    </div>
  );
}

function AlignmentFeedback({ alignment, warnings, readyForCapture }: AlignmentFeedbackProps) {
  if (readyForCapture) {
    return (
      <div className="bg-green-600/90 text-white px-4 py-3 rounded-lg text-center mx-auto max-w-xs">
        <p className="font-semibold">✓ Perfect! Hold steady...</p>
      </div>
    );
  }

  // Show most important warning
  const primaryWarning = warnings[0];
  const warningMessages: Record<CardWarning, string> = {
    'card_too_small': '↔️ Move closer to the card',
    'card_too_large': '↔️ Move back slightly',
    'card_rotated': '🔄 Straighten the card',
    'card_off_center': '⬆️ Center the card in frame',
    'corners_cut_off': '📐 All 4 corners must be visible',
    'glare_detected': '💡 Tilt to reduce glare',
    'shadow_detected': '🌑 Adjust lighting to remove shadow',
    'blur_detected': '📷 Hold steady - image is blurry',
  };

  if (primaryWarning) {
    return (
      <div className="bg-yellow-500/90 text-white px-4 py-3 rounded-lg text-center mx-auto max-w-xs">
        <p className="font-medium">{warningMessages[primaryWarning]}</p>
      </div>
    );
  }

  return (
    <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-center mx-auto max-w-xs">
      <p className="text-sm">Position card within the frame</p>
    </div>
  );
}
```

---

## Phase 4: Auto-Capture System

### 4.1 Capture Readiness Hook

```typescript
// hooks/useCaptureReadiness.ts

interface CaptureReadinessState {
  // Individual checks
  isCardDetected: boolean;
  isStable: boolean;           // No motion for N frames
  isAligned: boolean;          // Card properly positioned
  isQualityGood: boolean;      // No blur, good lighting

  // Overall
  readyForCapture: boolean;
  readyFrameCount: number;     // How many consecutive ready frames

  // Auto-capture
  autoCaptureCountdown: number | null;  // 3, 2, 1, 0 (capture)
  autoCaptureEnabled: boolean;
}

export function useCaptureReadiness(
  detection: CardDetectionResult,
  stabilization: StabilizationState,
  onAutoCapture: () => void
) {
  const [state, setState] = useState<CaptureReadinessState>({
    isCardDetected: false,
    isStable: false,
    isAligned: false,
    isQualityGood: false,
    readyForCapture: false,
    readyFrameCount: 0,
    autoCaptureCountdown: null,
    autoCaptureEnabled: true,
  });

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isCardDetected = detection.detected && detection.confidence > 60;
    const isStable = stabilization.isStable;
    const isAligned = detection.alignment.isWithinGuide &&
                      detection.alignment.isParallel &&
                      detection.alignment.fillPercent > 70;
    const isQualityGood = !detection.warnings.includes('blur_detected') &&
                          !detection.warnings.includes('glare_detected');

    const readyForCapture = isCardDetected && isStable && isAligned && isQualityGood;

    setState(prev => {
      const newReadyFrameCount = readyForCapture ? prev.readyFrameCount + 1 : 0;

      return {
        ...prev,
        isCardDetected,
        isStable,
        isAligned,
        isQualityGood,
        readyForCapture,
        readyFrameCount: newReadyFrameCount,
      };
    });
  }, [detection, stabilization]);

  // Auto-capture countdown logic
  useEffect(() => {
    if (!state.autoCaptureEnabled) return;

    // Start countdown when ready for 10+ consecutive frames (~500ms at 20fps)
    if (state.readyFrameCount >= 10 && state.autoCaptureCountdown === null) {
      setState(prev => ({ ...prev, autoCaptureCountdown: 3 }));
    }

    // Reset countdown if conditions lost
    if (!state.readyForCapture && state.autoCaptureCountdown !== null) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setState(prev => ({ ...prev, autoCaptureCountdown: null }));
    }
  }, [state.readyFrameCount, state.readyForCapture, state.autoCaptureEnabled]);

  // Countdown timer
  useEffect(() => {
    if (state.autoCaptureCountdown === null) return;

    if (state.autoCaptureCountdown === 0) {
      // Capture!
      onAutoCapture();
      setState(prev => ({ ...prev, autoCaptureCountdown: null, readyFrameCount: 0 }));
      return;
    }

    countdownRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        autoCaptureCountdown: prev.autoCaptureCountdown !== null
          ? prev.autoCaptureCountdown - 1
          : null
      }));
    }, 1000);

    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, [state.autoCaptureCountdown, onAutoCapture]);

  const toggleAutoCapture = () => {
    setState(prev => ({
      ...prev,
      autoCaptureEnabled: !prev.autoCaptureEnabled,
      autoCaptureCountdown: null
    }));
  };

  return {
    ...state,
    toggleAutoCapture,
  };
}
```

### 4.2 Stabilization Detection

```typescript
// hooks/useStabilization.ts

interface StabilizationState {
  isStable: boolean;
  motionScore: number;        // 0-100, lower is more stable
  stableFrameCount: number;
}

export function useStabilization(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean
) {
  const [state, setState] = useState<StabilizationState>({
    isStable: false,
    motionScore: 100,
    stableFrameCount: 0,
  });

  const prevFrameRef = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 160;  // Low res for performance
      canvasRef.current.height = 120;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationId: number;

    const checkStability = () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationId = requestAnimationFrame(checkStability);
        return;
      }

      // Draw scaled down frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (prevFrameRef.current) {
        const motionScore = calculateMotion(prevFrameRef.current, currentFrame);
        const isStable = motionScore < 8;  // Threshold for "stable"

        setState(prev => ({
          motionScore,
          isStable,
          stableFrameCount: isStable ? prev.stableFrameCount + 1 : 0,
        }));
      }

      prevFrameRef.current = currentFrame;

      // Check at ~20fps
      setTimeout(() => {
        animationId = requestAnimationFrame(checkStability);
      }, 50);
    };

    checkStability();

    return () => cancelAnimationFrame(animationId);
  }, [enabled, videoRef]);

  return state;
}

function calculateMotion(prev: ImageData, curr: ImageData): number {
  let totalDiff = 0;
  const sampleStep = 16;  // Sample every 16th pixel for speed
  let sampleCount = 0;

  for (let i = 0; i < curr.data.length; i += 4 * sampleStep) {
    const diff = Math.abs(curr.data[i] - prev.data[i]) +
                 Math.abs(curr.data[i + 1] - prev.data[i + 1]) +
                 Math.abs(curr.data[i + 2] - prev.data[i + 2]);
    totalDiff += diff / 3;
    sampleCount++;
  }

  return totalDiff / sampleCount;
}
```

---

## Phase 5: Pre-Capture Quality Feedback

### 5.1 Real-Time Quality Analysis

```typescript
// hooks/useLiveQuality.ts

interface LiveQualityState {
  blur: {
    score: number;        // 0-100
    isAcceptable: boolean;
  };
  lighting: {
    brightness: number;   // 0-255
    isAcceptable: boolean;
    hasGlare: boolean;
    hasShadow: boolean;
  };
  overall: {
    score: number;        // 0-100
    isAcceptable: boolean;
  };
}

export function useLiveQuality(
  videoRef: React.RefObject<HTMLVideoElement>,
  cardBounds: CardBounds | null,
  enabled: boolean
) {
  const [quality, setQuality] = useState<LiveQualityState>({
    blur: { score: 0, isAcceptable: false },
    lighting: { brightness: 128, isAcceptable: true, hasGlare: false, hasShadow: false },
    overall: { score: 0, isAcceptable: false },
  });

  // Analysis runs at lower frequency than detection (~5fps)
  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    const analyzeQuality = () => {
      // ... quality analysis within card bounds
      // Reuse existing imageQuality.ts functions
    };

    const intervalId = setInterval(analyzeQuality, 200);
    return () => clearInterval(intervalId);
  }, [enabled, videoRef, cardBounds]);

  return quality;
}
```

---

## Implementation Summary

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useCamera.ts` | Modify | Add focus/exposure lock, better constraints |
| `src/hooks/useCardDetection.ts` | Rewrite | Edge detection, corner finding, alignment |
| `src/hooks/useStabilization.ts` | New | Motion detection for stable capture |
| `src/hooks/useCaptureReadiness.ts` | New | Auto-capture logic with countdown |
| `src/hooks/useGuideOrientation.ts` | New | Portrait/landscape toggle |
| `src/hooks/useLiveQuality.ts` | New | Real-time quality feedback |
| `src/components/camera/MobileCamera.tsx` | Modify | Integrate new hooks, auto-capture |
| `src/components/camera/CameraGuideOverlay.tsx` | Rewrite | Orientation toggle, alignment feedback |
| `src/types/camera.ts` | Modify | New interfaces for detection/alignment |

### Implementation Order

```
Week 1: Foundation
├── Day 1-2: Camera constraints + focus/exposure lock
├── Day 2-3: Stabilization detection hook
└── Day 3-4: Basic orientation toggle in overlay

Week 2: Detection
├── Day 1-2: Edge detection algorithm
├── Day 2-3: Corner detection + card bounds
└── Day 3-4: Alignment calculation + warnings

Week 3: Auto-Capture & Polish
├── Day 1: Capture readiness hook
├── Day 2: Auto-capture countdown UI
├── Day 3: Live quality feedback
└── Day 4: Testing + bug fixes
```

### Success Metrics

| Metric | Target |
|--------|--------|
| Auto-capture success rate | >90% of captures usable |
| Average time on camera screen | <30 seconds |
| False positive detection | <5% |
| Motion blur rate | <2% of captures |
| Landscape card support | Fully functional |

---

## Removed Features (Per User Request)

- ~~Torch/Flash control~~ - Causes glare on cards
- ~~Portrait orientation lock~~ - Need landscape support
- ~~Pinch-to-zoom~~ - Not necessary with proper framing guidance

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Auto-capture? | Yes, with 3-2-1 countdown |
| Portrait lock? | No, support both orientations |
| Flash/torch? | Eliminated |
| Detection complexity? | Full edge detection |
