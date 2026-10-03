'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedFrame } from '@/types/camera';
import { sampleCaptureRegion, sourceLuma } from '@/utils/captureSharpness';
import { alignmentError, candidateTransforms, chooseStillTransform } from '@/utils/captureAlignment';
import { getCaptureRegion, mapCaptureRegion, preferStill } from '@/utils/captureSelection';

// Shutter burst: frames grabbed, and the spacing when requestVideoFrameCallback
// is unavailable. ~4 frames at 30 fps is ~130 ms — long enough to outlast the
// tap's jolt, short enough that the user does not notice.
const BURST_FRAMES = 4;
const BURST_INTERVAL_MS = 50;
interface StillPhotoSettings { imageWidth: number; imageHeight: number }
interface StillImageCapture {
  getPhotoCapabilities?: () => Promise<{
    imageWidth?: { min: number; max: number };
    imageHeight?: { min: number; max: number };
  }>;
  takePhoto: (settings?: StillPhotoSettings) => Promise<Blob>;
}

// Detect iOS for constraint compatibility
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Get camera constraints optimized for card photography
 */
const getCameraConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints => {
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  return {
    video: {
      facingMode: isIOS ? facingMode : { ideal: facingMode },
      // v9.0: request 4K — browsers negotiate DOWN to the camera's best mode, so this
      // yields the highest available capture resolution. At the old 1920×1080 ideal, a
      // portrait card crop from the landscape stream came out ~1037px on the long edge
      // (borderline for the 1000px minimum-resolution grading gate) and the 720p
      // fallback produced ~690px captures that the gate rightly rejects.
      width: { ideal: portrait ? 2160 : 3840 },
      height: { ideal: portrait ? 3840 : 2160 },
      frameRate: { ideal: 30 },
    }
  };
};

/**
 * Fallback constraints if optimal fails
 */
const getFallbackConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints[] => {
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  return [
    { video: { facingMode, width: { ideal: portrait ? 1080 : 1920 }, height: { ideal: portrait ? 1920 : 1080 } } },
    { video: { facingMode } },
  ];
};

async function cameraTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Camera request timed out')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/**
 * Apply continuous focus/exposure/white-balance where the camera supports it.
 * Advisory constraints only — every branch is a graceful no-op on browsers or
 * cameras that don't expose these capabilities (e.g. iOS Safari, webcams).
 */
const applyFocusConstraints = async (mediaStream: MediaStream): Promise<void> => {
  try {
    const track = mediaStream.getVideoTracks()[0];
    if (!track?.getCapabilities || !track.applyConstraints) return;
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[];
      exposureMode?: string[];
      whiteBalanceMode?: string[];
    };
    const advanced: MediaTrackConstraintSet[] = [];
    if (caps.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet);
    }
    if (caps.exposureMode?.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet);
    }
    if (caps.whiteBalanceMode?.includes('continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' } as MediaTrackConstraintSet);
    }
    if (advanced.length > 0) {
      await track.applyConstraints({ advanced });
    }
  } catch (err) {
    console.warn('[Camera] Focus constraint tuning skipped:', err);
  }
};

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSession = useRef(0);

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    const session = ++cameraSession.current;
    setIsStarting(true);
    setError(null);

    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setStream(null);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      if (session !== cameraSession.current) return;

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported');
      }

      let mediaStream: MediaStream | null = null;

      // Try optimal constraints first
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints(facingMode));
      } catch (failure) {
        if (session !== cameraSession.current) return;
        // A denied permission is not a resolution-negotiation failure.
        if (['NotAllowedError', 'SecurityError'].includes((failure as Error).name)) throw failure;
        // Try fallbacks
        const fallbacks = getFallbackConstraints(facingMode);
        for (const constraints of fallbacks) {
          if (session !== cameraSession.current) return;
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (failure) {
            if (['NotAllowedError', 'SecurityError'].includes((failure as Error).name)) throw failure;
            continue;
          }
        }
      }

      if (!mediaStream) {
        throw new Error('Could not access camera');
      }

      if (session !== cameraSession.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      // Nudge the camera into continuous AF/AE/AWB where supported.
      await applyFocusConstraints(mediaStream);
      if (session !== cameraSession.current) return;

      // Record what resolution was ACTUALLY negotiated — the fallback ladder can
      // silently land on 1080p or the device default, and the UI warns before
      // capture instead of hard-rejecting after the shutter.
      try {
        const settings = mediaStream.getVideoTracks()[0]?.getSettings?.();
        if (settings?.width && settings?.height) {
          setStreamResolution({ width: settings.width, height: settings.height });
        } else {
          setStreamResolution(null);
        }
      } catch {
        setStreamResolution(null);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {
          // Retry once
          return new Promise(resolve => setTimeout(resolve, 100))
            .then(() => videoRef.current?.play());
        });
      }

    } catch (failure) {
      if (session !== cameraSession.current) return;
      const err = failure instanceof Error ? failure : new Error(String(failure));
      console.error('[Camera] Error:', err);

      let message = 'Failed to access camera';
      if (err.name === 'NotAllowedError') {
        message = 'Camera permission denied. Please allow access in browser settings.';
      } else if (err.name === 'NotFoundError') {
        message = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        message = 'Camera is in use by another app.';
      } else if (err.message) {
        message = err.message;
      }

      setError(message);
      setHasPermission(false);
    } finally {
      if (session === cameraSession.current) setIsStarting(false);
    }
  };

  const stopCamera = useCallback(() => {
    cameraSession.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setError(null);
    setIsStarting(false);
    setStreamResolution(null);
  }, []);

  // v9.1 single-pass encode: capture returns the raw canvas frame with NO extra
  // JPEG encode. The downstream crop step performs the one and only
  // crop+resize+encode on our side.
  //
  // v9.10 still capture: prefer ImageCapture.takePhoto() (Chrome/Edge/Android),
  // which asks the camera for a TRUE still — full sensor resolution and the
  // photo processing pipeline — instead of grabbing a preview video frame
  // capped at the negotiated stream mode. Falls back to the frame grab on
  // browsers without ImageCapture (iOS Safari), on timeout, or when the
  // returned photo cannot be aligned or is softer than the selected preview.
  //
  // The returned streamTransform maps PREVIEW-STREAM coordinates onto the
  // capture canvas: identity for a frame grab. For a still photo it USED to
  // assume the preview was a centered crop of the photo; Sept 2026 data showed
  // that is wrong on many Android devices (cut-off card edges, 52% low photo
  // confidence), so the still is now aligned against the preview and used only
  // when a field-of-view model measurably matches (utils/captureAlignment.ts).
  // The guide crop computes its rectangle in stream coordinates (what the user
  // actually saw) and converts.
  //
  // Sept 2026 burst: the preview frame is the sharpest of a short burst, not
  // the one frame at the instant the shutter was tapped (when the phone moves).
  const captureImage = useCallback(async (orientation: 'portrait' | 'landscape' = 'portrait'): Promise<CapturedFrame | null> => {
    const session = cameraSession.current;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    const streamW = video.videoWidth;
    const streamH = video.videoHeight;
    const view = video.getBoundingClientRect();
    if (!(view.width > 0 && view.height > 0)) return null;
    const region = getCaptureRegion(streamW, streamH, view.width, view.height, orientation);
    const sampleScale = Math.min(1, 256 / Math.max(region.width, region.height));
    const sampleSize = { width: Math.max(3, Math.round(region.width * sampleScale)), height: Math.max(3, Math.round(region.height * sampleScale)) };
    const diagnostics: NonNullable<CapturedFrame['diagnostics']> = {
      version: 'capture-v2', selection: 'preview_only', previewSharpness: null,
      stillSharpness: null, guideWidth: region.width, guideHeight: region.height,
    };

    const drawFrame = (canvas: HTMLCanvasElement): boolean => {
      canvas.width = streamW;
      canvas.height = streamH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0);
      return true;
    };
    // Wait for the next decoded preview frame (so burst frames are distinct).
    const nextFrame = () => new Promise<void>((resolve) => {
      const done = () => resolve();
      const v = video;
      if (typeof v.requestVideoFrameCallback === 'function') {
        const callback = v.requestVideoFrameCallback(() => { clearTimeout(timer); done(); });
        const timer = setTimeout(() => { v.cancelVideoFrameCallback?.(callback); done(); }, 150);
      } else {
        setTimeout(done, BURST_INTERVAL_MS);
      }
    });

    // Burst: keep only the best and the current canvas (4K frames are ~33 MB each).
    let best: HTMLCanvasElement | null = null;
    let bestScore = -1;
    let spare: HTMLCanvasElement = document.createElement('canvas');
    for (let i = 0; i < BURST_FRAMES; i++) {
      if (i > 0) await nextFrame();
      if (session !== cameraSession.current) return null;
      if (!drawFrame(spare)) break;
      const score = sampleCaptureRegion(spare, region, sampleSize)?.sharpness ?? 0;
      if (score > bestScore) {
        const previous = best;
        best = spare;
        bestScore = score;
        spare = previous ?? document.createElement('canvas');
      }
    }
    if (!best) return null;
    const previewCanvas = best;
    diagnostics.previewSharpness = bestScore;
    // Release the losing full-resolution buffer before allocating the still.
    spare.width = spare.height = 0;

    const frameGrab = (): CapturedFrame => ({
      canvas: previewCanvas,
      width: previewCanvas.width,
      height: previewCanvas.height,
      timestamp: Date.now(),
      captureSource: 'frame',
      streamSize: { width: streamW, height: streamH },
      streamTransform: { scale: 1, offsetX: 0, offsetY: 0 },
      diagnostics,
    });

    // Attempt a true still capture where the API exists.
    const ImageCaptureCtor = (window as Window & {
      ImageCapture?: new (track: MediaStreamTrack) => StillImageCapture;
    }).ImageCapture;
    const track = streamRef.current?.getVideoTracks()[0];
    if (ImageCaptureCtor && track && track.readyState === 'live') {
      try {
        const imageCapture = new ImageCaptureCtor(track);
        let photoSettings: StillPhotoSettings | undefined;
        try {
          const caps = await cameraTimeout(imageCapture.getPhotoCapabilities?.() ?? Promise.reject(new Error('Photo capabilities unavailable')), 750);
          const w = caps.imageWidth?.max, h = caps.imageHeight?.max;
          if (w && h && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            // Bound decode memory while still requesting a photographic-resolution image.
            const scale = Math.min(1, Math.sqrt(12_000_000 / (w * h)));
            photoSettings = { imageWidth: Math.max(caps.imageWidth?.min || 1, Math.round(w * scale)),
              imageHeight: Math.max(caps.imageHeight?.min || 1, Math.round(h * scale)) };
          }
        } catch { /* Optional API: the camera's default still remains usable. */ }
        // takePhoto can hang on some devices — race it against a timeout and
        // fall back to the instant frame grab rather than blocking the shutter.
        let blob: Blob;
        try {
          blob = await cameraTimeout(imageCapture.takePhoto(photoSettings), 4000);
        } catch (failure) {
          if (!photoSettings || !['OverconstrainedError', 'NotSupportedError'].includes((failure as Error).name)) throw failure;
          if (session !== cameraSession.current) return null;
          // Some devices advertise a range but accept only discrete photo sizes.
          blob = await cameraTimeout(imageCapture.takePhoto(), 4000);
        }
        if (session !== cameraSession.current) return null;
        const bitmap = await createImageBitmap(blob);
        try {
          if (session !== cameraSession.current) return null;
          // Compare matched guide regions, including equal-resolution photos.
          diagnostics.selection = 'still_too_large';
          if (bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 25_000_000) {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(bitmap, 0, 0);
              // Which part of the still did the user frame? Measure it.
              const pv = sourceLuma(previewCanvas, streamW, streamH, 192);
              const st = sourceLuma(canvas, bitmap.width, bitmap.height, 256);
              const photo = { width: bitmap.width, height: bitmap.height };
              const stream = { width: streamW, height: streamH };
              const scored = pv && st
                ? candidateTransforms(streamW, streamH, bitmap.width, bitmap.height)
                    .map((c) => ({ ...c, error: alignmentError(pv, st, stream, photo, c.transform) }))
                : [];
              const chosen = chooseStillTransform(scored);
              console.log('[Camera] still alignment', scored.map((s) => `${s.model}=${s.error.toFixed(3)}`).join(' '),
                chosen ? `-> ${chosen.model}` : '-> none, using preview frame');
              diagnostics.selection = 'still_alignment_unknown';
              const stillRegion = chosen && mapCaptureRegion(region, chosen.transform, bitmap.width, bitmap.height);
              if (chosen && stillRegion) {
                const stillScore = sampleCaptureRegion(canvas, stillRegion, sampleSize)?.sharpness ?? 0;
                diagnostics.stillSharpness = stillScore;
                diagnostics.selection = 'preview_sharper_or_larger';
                if (!preferStill({ sharpness: bestScore, ...region }, { sharpness: stillScore, ...stillRegion })) {
                  canvas.width = canvas.height = 0;
                  return frameGrab();
                }
                diagnostics.selection = 'aligned_sharp_still';
                diagnostics.guideWidth = stillRegion.width;
                diagnostics.guideHeight = stillRegion.height;
                previewCanvas.width = previewCanvas.height = 0;
                return {
                  canvas,
                  width: canvas.width,
                  height: canvas.height,
                  timestamp: Date.now(),
                  captureSource: 'photo',
                  streamSize: stream,
                  streamTransform: chosen.transform,
                  alignment: { model: chosen.model, error: chosen.error },
                  diagnostics,
                };
              }
              canvas.width = canvas.height = 0;
            }
          }
        } finally {
          bitmap.close();
        }
      } catch (err) {
        diagnostics.selection = 'still_request_failed';
        console.warn('[Camera] takePhoto failed, using frame grab:', err);
      }
    }
    if (session !== cameraSession.current) return null;
    return frameGrab();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    // Invalidate the latest asynchronous request, not the number at mount.
    const sessionCounter = cameraSession;
    return () => {
      sessionCounter.current++;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    stream,
    error,
    hasPermission,
    isStarting,
    streamResolution,
    startCamera,
    stopCamera,
    captureImage,
  };
};
