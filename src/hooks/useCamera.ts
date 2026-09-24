'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedFrame } from '@/types/camera';
import { laplacianVariance, sourceLuma } from '@/utils/captureSharpness';
import { alignmentError, candidateTransforms, chooseStillTransform } from '@/utils/captureAlignment';

// Shutter burst: frames grabbed, and the spacing when requestVideoFrameCallback
// is unavailable. ~4 frames at 30 fps is ~130 ms — long enough to outlast the
// tap's jolt, short enough that the user does not notice.
const BURST_FRAMES = 4;
const BURST_INTERVAL_MS = 50;

// Detect iOS for constraint compatibility
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Get camera constraints optimized for card photography
 */
const getCameraConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints => {
  return {
    video: {
      facingMode: isIOS ? facingMode : { ideal: facingMode },
      // v9.0: request 4K — browsers negotiate DOWN to the camera's best mode, so this
      // yields the highest available capture resolution. At the old 1920×1080 ideal, a
      // portrait card crop from the landscape stream came out ~1037px on the long edge
      // (borderline for the 1000px minimum-resolution grading gate) and the 720p
      // fallback produced ~690px captures that the gate rightly rejects.
      width: { ideal: 3840, min: 1280 },
      height: { ideal: 2160, min: 720 },
      frameRate: { ideal: 30 },
    }
  };
};

/**
 * Fallback constraints if optimal fails
 */
const getFallbackConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints[] => [
  { video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } },
  { video: { facingMode } },
  { video: true },
];

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

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    if (isStarting) return;

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

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported');
      }

      let mediaStream: MediaStream | null = null;

      // Try optimal constraints first
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints(facingMode));
      } catch {
        // Try fallbacks
        const fallbacks = getFallbackConstraints(facingMode);
        for (const constraints of fallbacks) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch {
            continue;
          }
        }
      }

      if (!mediaStream) {
        throw new Error('Could not access camera');
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      // Nudge the camera into continuous AF/AE/AWB where supported.
      await applyFocusConstraints(mediaStream);

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

    } catch (err: any) {
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
      setIsStarting(false);
    }
  };

  const stopCamera = useCallback(() => {
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
  // returned photo isn't actually larger than the stream.
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
  const captureImage = useCallback(async (): Promise<CapturedFrame | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const streamW = video.videoWidth;
    const streamH = video.videoHeight;

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
      const v = video as any;
      if (typeof v.requestVideoFrameCallback === 'function') {
        const timer = setTimeout(done, 150);
        v.requestVideoFrameCallback(() => { clearTimeout(timer); done(); });
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
      if (!drawFrame(spare)) break;
      const l = sourceLuma(spare, streamW, streamH, 256, { w: 0.6, h: 0.6 });
      const score = l ? laplacianVariance(l.luma, l.width, l.height) : 0;
      if (score > bestScore) {
        const previous = best;
        best = spare;
        bestScore = score;
        spare = previous ?? document.createElement('canvas');
      }
    }
    if (!best) return null;
    const previewCanvas = best;

    const frameGrab = (): CapturedFrame => ({
      canvas: previewCanvas,
      width: previewCanvas.width,
      height: previewCanvas.height,
      timestamp: Date.now(),
      captureSource: 'frame',
      streamSize: { width: streamW, height: streamH },
      streamTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    });

    // Attempt a true still capture where the API exists.
    const ImageCaptureCtor = (window as any).ImageCapture;
    const track = streamRef.current?.getVideoTracks()[0];
    if (ImageCaptureCtor && track && track.readyState === 'live') {
      try {
        const imageCapture = new ImageCaptureCtor(track);
        // takePhoto can hang on some devices — race it against a timeout and
        // fall back to the instant frame grab rather than blocking the shutter.
        const blob: Blob = await Promise.race([
          imageCapture.takePhoto(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('takePhoto timeout')), 4000)),
        ]);
        const bitmap = await createImageBitmap(blob);
        try {
          // Sanity: only use the still if it genuinely beats the preview stream.
          // Some devices return stills at or below stream resolution — the frame
          // grab is then equivalent and its geometry is exactly WYSIWYG.
          if (bitmap.width * bitmap.height > streamW * streamH * 1.05) {
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
              if (chosen) {
                return {
                  canvas,
                  width: canvas.width,
                  height: canvas.height,
                  timestamp: Date.now(),
                  captureSource: 'photo',
                  streamSize: stream,
                  streamTransform: chosen.transform,
                  alignment: { model: chosen.model, error: chosen.error },
                };
              }
            }
          }
        } finally {
          bitmap.close();
        }
      } catch (err) {
        console.warn('[Camera] takePhoto failed, using frame grab:', err);
      }
    }

    return frameGrab();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
