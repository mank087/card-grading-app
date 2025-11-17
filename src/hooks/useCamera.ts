'use client';

import { useState, useRef, useEffect } from 'react';
import { CapturedImage } from '@/types/camera';

export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    try {
      // First, check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      let mediaStream: MediaStream | null = null;

      // Try with preferred constraints first
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch (firstErr) {
        console.warn('First camera attempt failed, trying with simpler constraints:', firstErr);

        // Fallback: Try with just facingMode
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode
            }
          });
        } catch (secondErr) {
          console.warn('Second camera attempt failed, trying with any camera:', secondErr);

          // Last resort: Try with just video: true
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }

      if (!mediaStream) {
        throw new Error('Failed to get media stream');
      }

      setStream(mediaStream);
      setHasPermission(true);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Ensure video plays (important for iOS Safari)
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video autoplay failed:', playErr);
          // This is often not a critical error - user can manually start
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMessage = 'Failed to access camera';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application.';
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

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

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
