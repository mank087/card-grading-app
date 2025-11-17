'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedImage } from '@/types/camera';

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      if (stream) {
        console.log('[Camera] Stopping existing stream before starting new one');
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
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

      // Try with preferred constraints first
      try {
        console.log('[Camera] Attempting with ideal constraints');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch (firstErr) {
        console.warn('[Camera] First attempt failed, trying with simpler constraints:', firstErr);

        // Fallback: Try with just facingMode
        try {
          console.log('[Camera] Attempting with facingMode only');
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode
            }
          });
        } catch (secondErr) {
          console.warn('[Camera] Second attempt failed, trying with any camera:', secondErr);

          // Last resort: Try with just video: true
          console.log('[Camera] Attempting with video: true');
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }

      if (!mediaStream) {
        throw new Error('Failed to get media stream');
      }

      console.log('[Camera] Media stream acquired successfully');
      console.log('[Camera] Stream tracks:', mediaStream.getTracks().map(t => `${t.kind}: ${t.label}`));

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

    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('[Camera] Stopping track:', track.kind, track.label);
        track.stop();
        track.enabled = false;
      });
      setStream(null);
    }

    // Clear video element to fully release the stream
    if (videoRef.current) {
      console.log('[Camera] Clearing video element');
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Reset video element to initial state
    }

    // Reset states
    setError(null);
    setIsStarting(false);
  }, [stream]);

  const captureImage = (): Promise<CapturedImage | null> => {
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

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }

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
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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
