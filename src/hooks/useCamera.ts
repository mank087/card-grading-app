'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedImage } from '@/types/camera';

// Detect iOS for constraint compatibility
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Get camera constraints optimized for card photography
 */
const getCameraConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints => {
  return {
    video: {
      facingMode: isIOS ? facingMode : { ideal: facingMode },
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30 },
    }
  };
};

/**
 * Fallback constraints if optimal fails
 */
const getFallbackConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints[] => [
  { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } },
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

  const captureImage = useCallback(async (): Promise<CapturedImage | null> => {
    if (!videoRef.current) return null;

    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) {
        resolve(null);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const file = new File([blob], `card-${Date.now()}.jpg`, { type: 'image/jpeg' });

        resolve({
          dataUrl,
          blob,
          file,
          timestamp: Date.now()
        });
      }, 'image/jpeg', 0.92);
    });
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
