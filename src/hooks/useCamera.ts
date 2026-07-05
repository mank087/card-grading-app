'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedFrame } from '@/types/camera';

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

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
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
  }, []);

  // v9.1 single-pass encode: capture returns the raw canvas frame with NO JPEG
  // encode. The downstream crop step performs the one and only crop+resize+encode,
  // so the camera path no longer re-encodes the image three times (capture 0.92 →
  // crop 0.95 → compress 0.8-0.9), which compounded JPEG generation loss.
  const captureImage = useCallback(async (): Promise<CapturedFrame | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    return {
      canvas,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now()
    };
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
    startCamera,
    stopCamera,
    captureImage,
  };
};
