'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedImage } from '@/types/camera';

// Detect iOS for constraint compatibility
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Get optimal camera constraints for card photography
 * - 4:3 aspect ratio (closer to card ratio than 16:9)
 * - High resolution for detail capture
 * - Continuous focus/exposure for live preview
 */
const getOptimalConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints => {
  // Base constraints that work across devices
  const baseConstraints: MediaTrackConstraints = {
    // iOS doesn't support 'exact' well, use ideal instead
    facingMode: isIOS ? facingMode : { ideal: facingMode },
    // Request 4:3 aspect ratio - better for card photography than 16:9
    width: { ideal: 2160, min: 1080 },
    height: { ideal: 2880, min: 1440 },
    frameRate: { ideal: 30, max: 30 },
  };

  // Advanced constraints for Android/desktop (iOS ignores these)
  if (!isIOS) {
    Object.assign(baseConstraints, {
      // @ts-ignore - These are valid constraints but not in TS types
      focusMode: { ideal: 'continuous' },
      // @ts-ignore
      exposureMode: { ideal: 'continuous' },
      // @ts-ignore
      whiteBalanceMode: { ideal: 'continuous' },
    });
  }

  return { video: baseConstraints };
};

/**
 * Fallback constraints for older/limited devices
 */
const getFallbackConstraints = (facingMode: 'user' | 'environment'): MediaStreamConstraints[] => [
  // Try 1: Just facingMode with 1080p
  {
    video: {
      facingMode: facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    }
  },
  // Try 2: Just facingMode
  {
    video: {
      facingMode: facingMode,
    }
  },
  // Try 3: Any camera
  {
    video: true
  }
];

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSettingsLocked, setIsSettingsLocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Lock focus and exposure settings before capture
   * Ensures consistent, sharp images
   */
  const lockSettingsForCapture = useCallback(async (): Promise<void> => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    try {
      // @ts-ignore - getCapabilities may not be in TS types
      const capabilities = track.getCapabilities?.();
      // @ts-ignore
      const settings = track.getSettings?.();

      if (!capabilities || !settings) return;

      const advancedConstraints: MediaTrackConstraintSet[] = [];

      // Lock focus at current distance if supported
      if (capabilities.focusMode?.includes('manual') && settings.focusDistance !== undefined) {
        advancedConstraints.push({
          // @ts-ignore
          focusMode: 'manual',
          // @ts-ignore
          focusDistance: settings.focusDistance,
        });
      }

      // Lock exposure if supported
      if (capabilities.exposureMode?.includes('manual')) {
        advancedConstraints.push({
          // @ts-ignore
          exposureMode: 'manual',
        });
      }

      if (advancedConstraints.length > 0) {
        await track.applyConstraints({ advanced: advancedConstraints });
        setIsSettingsLocked(true);
        console.log('[Camera] Settings locked for capture');
      }
    } catch (err) {
      console.warn('[Camera] Could not lock settings:', err);
      // Continue without locking - capture will still work
    }
  }, []);

  /**
   * Unlock settings to return to continuous mode
   */
  const unlockSettings = useCallback(async (): Promise<void> => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !isSettingsLocked) return;

    try {
      await track.applyConstraints({
        advanced: [{
          // @ts-ignore
          focusMode: 'continuous',
          // @ts-ignore
          exposureMode: 'continuous',
        }]
      });
      setIsSettingsLocked(false);
      console.log('[Camera] Settings unlocked');
    } catch (err) {
      console.warn('[Camera] Could not unlock settings:', err);
    }
  }, [isSettingsLocked]);

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    // Prevent multiple simultaneous start attempts
    if (isStarting) {
      console.log('[Camera] Already starting, ignoring duplicate call');
      return;
    }

    setIsStarting(true);
    console.log('[Camera] Starting camera with facingMode:', facingMode);

    try {
      // First, stop any existing camera stream
      if (streamRef.current) {
        console.log('[Camera] Stopping existing stream before starting new one');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
        setStream(null);
      }

      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }

      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      let mediaStream: MediaStream | null = null;

      // Try optimal constraints first
      try {
        console.log('[Camera] Attempting with optimal constraints (4:3, high res)');
        const constraints = getOptimalConstraints(facingMode);
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[Camera] Optimal constraints succeeded');
      } catch (optimalErr) {
        console.warn('[Camera] Optimal constraints failed, trying fallbacks:', optimalErr);

        // Try fallback constraints in order
        const fallbacks = getFallbackConstraints(facingMode);
        for (let i = 0; i < fallbacks.length; i++) {
          try {
            console.log(`[Camera] Trying fallback ${i + 1}/${fallbacks.length}`);
            mediaStream = await navigator.mediaDevices.getUserMedia(fallbacks[i]);
            console.log(`[Camera] Fallback ${i + 1} succeeded`);
            break;
          } catch (fallbackErr) {
            console.warn(`[Camera] Fallback ${i + 1} failed:`, fallbackErr);
            if (i === fallbacks.length - 1) {
              throw fallbackErr; // All fallbacks failed
            }
          }
        }
      }

      if (!mediaStream) {
        throw new Error('Failed to get media stream');
      }

      // Log actual stream settings
      const videoTrack = mediaStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('[Camera] Stream acquired:', {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);
      setError(null);

      if (videoRef.current) {
        console.log('[Camera] Setting srcObject on video element');
        videoRef.current.srcObject = mediaStream;

        // Wait for video element to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }

          const timeoutId = setTimeout(() => {
            console.warn('[Camera] loadedmetadata timeout, continuing anyway');
            resolve();
          }, 3000);

          const handleLoadedMetadata = () => {
            console.log('[Camera] Video metadata loaded');
            clearTimeout(timeoutId);
            videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
            resolve();
          };

          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        });

        // Now try to play the video
        console.log('[Camera] Attempting to play video');
        try {
          await videoRef.current.play();
          console.log('[Camera] Video playing successfully');
        } catch (playErr: any) {
          console.error('[Camera] Video play failed:', playErr);
          // Try one more time after a short delay
          await new Promise(resolve => setTimeout(resolve, 100));
          try {
            await videoRef.current.play();
            console.log('[Camera] Video playing after retry');
          } catch (retryErr) {
            throw new Error('Video playback failed. Please try again.');
          }
        }
      }

      setIsStarting(false);
      console.log('[Camera] Camera started successfully');

    } catch (err: any) {
      console.error('[Camera] Camera access error:', err);
      setIsStarting(false);

      let errorMessage = 'Failed to access camera';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application. Please close other apps and try again.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Camera does not support the requested settings.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access blocked. Please ensure you are using HTTPS.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setHasPermission(false);
    }
  };

  const stopCamera = useCallback(() => {
    console.log('[Camera] Stopping camera...');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('[Camera] Stopping track:', track.kind, track.label);
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
      setStream(null);
    }

    // Clear video element to fully release the stream
    if (videoRef.current) {
      console.log('[Camera] Clearing video element');
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }

    // Reset states
    setError(null);
    setIsStarting(false);
    setIsSettingsLocked(false);
  }, []);

  /**
   * Capture image with optional settings lock
   * Lock ensures focus/exposure don't shift during capture
   */
  const captureImage = useCallback(async (lockSettings: boolean = true): Promise<CapturedImage | null> => {
    if (!videoRef.current) {
      return null;
    }

    // Lock settings for consistent capture
    if (lockSettings) {
      await lockSettingsForCapture();
      // Small delay to let settings stabilize
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return new Promise((resolve) => {
      if (!videoRef.current) {
        resolve(null);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(videoRef.current, 0, 0);

      // Use high quality JPEG
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const file = new File([blob], `card-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Unlock settings after capture
        if (lockSettings) {
          unlockSettings();
        }

        resolve({
          dataUrl,
          blob,
          file,
          timestamp: Date.now()
        });
      }, 'image/jpeg', 0.95);
    });
  }, [lockSettingsForCapture, unlockSettings]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      console.log('[Camera Hook] Component unmounting, cleaning up camera');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return {
    videoRef,
    stream,
    error,
    hasPermission,
    isStarting,
    isSettingsLocked,
    startCamera,
    stopCamera,
    captureImage,
    lockSettingsForCapture,
    unlockSettings,
  };
};
