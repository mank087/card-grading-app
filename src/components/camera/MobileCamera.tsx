'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useCardDetection } from '@/hooks/useCardDetection';
import { useStabilization } from '@/hooks/useStabilization';
import { useGuideOrientation } from '@/hooks/useGuideOrientation';
import { useCaptureReadiness } from '@/hooks/useCaptureReadiness';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';
import { validateImageQuality, getImageDataFromFile } from '@/utils/imageQuality';
import { cropToGuideFrame } from '@/utils/guideCrop';
import { ImageQualityValidation, LightingInfo } from '@/types/camera';
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';

// Lighting indicator component
function LightingIndicator({ lighting }: { lighting: LightingInfo }) {
  const getIcon = () => {
    switch (lighting.level) {
      case 'too_dark': return '🌑';
      case 'dim': return '🌒';
      case 'good': return '☀️';
      case 'bright': return '🌤️';
      case 'too_bright': return '⚡';
      default: return '☀️';
    }
  };

  const getColor = () => {
    switch (lighting.level) {
      case 'too_dark': return 'bg-red-500/80 text-white';
      case 'dim': return 'bg-yellow-500/80 text-white';
      case 'good': return 'bg-green-500/80 text-white';
      case 'bright': return 'bg-yellow-400/80 text-gray-900';
      case 'too_bright': return 'bg-red-500/80 text-white';
      default: return 'bg-green-500/80 text-white';
    }
  };

  // Only show indicator if lighting isn't good
  if (lighting.level === 'good') {
    return null;
  }

  return (
    <div className={`absolute top-16 right-4 px-3 py-2 rounded-lg flex items-center gap-2 ${getColor()} backdrop-blur-sm shadow-lg`}>
      <span className="text-lg">{getIcon()}</span>
      <span className="text-xs font-medium">{lighting.message}</span>
    </div>
  );
}

interface MobileCameraProps {
  side: 'front' | 'back';
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function MobileCamera({ side, onCapture, onCancel }: MobileCameraProps) {
  const {
    videoRef,
    stream,
    error,
    hasPermission,
    startCamera,
    stopCamera,
    captureImage,
  } = useCamera();

  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityValidation, setQualityValidation] = useState<ImageQualityValidation | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const toast = useToast();

  // Guide orientation (portrait/landscape toggle)
  const {
    orientation: guideOrientation,
    toggleOrientation,
  } = useGuideOrientation();

  // Card detection with edge detection
  const detection = useCardDetection(videoRef, !!stream, guideOrientation);

  // Motion/stabilization detection
  const stabilization = useStabilization(videoRef, !!stream);

  // Capture handler - extracted for auto-capture
  const handleCapture = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const captured = await captureImage();
      if (!captured) {
        toast.error('Failed to capture image. Please try again.');
        setIsProcessing(false);
        return;
      }

      console.log('[MobileCamera] Image captured, applying auto-crop...');

      // Auto-crop to guide frame boundaries
      let finalFile = captured.file;
      let finalDataUrl = captured.dataUrl;

      try {
        const cropResult = await cropToGuideFrame(captured.file, {
          paddingPercent: 0.08, // 8% padding for positioning tolerance
          maintainAspectRatio: true,
          orientation: guideOrientation, // Pass current orientation
        });

        finalFile = cropResult.croppedFile;
        finalDataUrl = cropResult.croppedDataUrl;

        console.log('[MobileCamera] Auto-crop applied:', {
          original: cropResult.originalSize,
          cropped: cropResult.croppedSize,
          removed: `${Math.round((1 - (cropResult.croppedSize.width * cropResult.croppedSize.height) / (cropResult.originalSize.width * cropResult.originalSize.height)) * 100)}%`
        });
      } catch (cropErr) {
        console.warn('[MobileCamera] Auto-crop failed, using original image:', cropErr);
      }

      setCapturedImageUrl(finalDataUrl);
      setCapturedFile(finalFile);

      // Validate image quality
      const imageData = await getImageDataFromFile(finalFile);
      if (imageData) {
        const validation = validateImageQuality(imageData);
        setQualityValidation(validation);
      }
    } catch (err) {
      console.error('Capture error:', err);
      toast.error('Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [captureImage, guideOrientation, isProcessing, toast]);

  // Auto-capture readiness
  const readiness = useCaptureReadiness({
    detection,
    stabilization,
    autoCaptureEnabled,
    onAutoCapture: handleCapture,
    enabled: !!stream && !capturedImageUrl,
  });

  // Start camera on mount and when facingMode changes
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      console.log('[MobileCamera] Cleaning up camera on unmount or facingMode change');
      stopCamera();
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure video element has the stream when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('[MobileCamera] Syncing stream to video element');
      videoRef.current.srcObject = stream;

      videoRef.current.play().then(() => {
        console.log('[MobileCamera] Video playing');
      }).catch(err => {
        console.error('[MobileCamera] Video play error:', err);
      });
    }
  }, [stream, videoRef]);

  const handleConfirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    setCapturedFile(null);
    setQualityValidation(null);
    console.log('[MobileCamera] Restarting camera after retake');
    stopCamera();
    setTimeout(() => {
      startCamera(facingMode);
    }, 200);
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleAutoCapture = () => {
    setAutoCaptureEnabled(prev => !prev);
  };

  // Show preview if image captured
  if (capturedImageUrl && capturedFile) {
    return (
      <ImagePreview
        imageUrl={capturedImageUrl}
        side={side}
        qualityValidation={qualityValidation}
        onConfirm={handleConfirm}
        onRetake={handleRetake}
      />
    );
  }

  // Show error state
  if (hasPermission === false || error) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-200 transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-lg font-bold">Camera Access</h2>
          <div className="w-16"></div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">📷</div>
            <h3 className="text-xl font-bold text-white">Camera Permission Needed</h3>
            <p className="text-gray-300">
              To capture card images, we need access to your camera. Please allow camera access when prompted.
            </p>
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-left">
                <p className="text-red-200 text-sm font-semibold mb-2">Error Details:</p>
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Diagnostic Information */}
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-left">
              <p className="text-gray-400 text-xs font-semibold mb-2">Diagnostic Info:</p>
              <div className="text-gray-300 text-xs space-y-1">
                <p>• Browser: {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-2).join(' ') : 'Unknown'}</p>
                <p>• HTTPS: {typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? '✓ Yes' : '✗ No (Required!)') : 'Unknown'}</p>
                <p>• MediaDevices API: {typeof navigator !== 'undefined' && navigator.mediaDevices ? '✓ Available' : '✗ Not Available'}</p>
                <p>• getUserMedia: {typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia ? '✓ Supported' : '✗ Not Supported'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  stopCamera();
                  await new Promise(resolve => setTimeout(resolve, 200));
                  startCamera(facingMode);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Use Gallery Instead
              </button>
            </div>

            {/* Help Text */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3 text-left">
              <p className="text-blue-200 text-xs font-semibold mb-2">Troubleshooting:</p>
              <ul className="text-blue-300 text-xs space-y-1 list-disc list-inside">
                <li>Make sure camera permission is allowed in browser settings</li>
                <li>Close other apps that might be using the camera</li>
                <li>Refresh the page and try again</li>
                <li>Ensure you're using HTTPS (not HTTP)</li>
                <li>Try using "Gallery" option as a workaround</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!stream || hasPermission === null) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-pulse">📷</div>
          <p className="text-white text-lg">Starting camera...</p>
        </div>
      </div>
    );
  }

  // Show camera view
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between relative z-10">
        <button
          onClick={onCancel}
          className="text-white hover:text-gray-200 transition-colors font-medium"
        >
          ← Cancel
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/DCM-logo.png"
            alt="DCM"
            width={24}
            height={24}
            className="object-contain"
          />
          <h2 className="text-lg font-bold">Capture Card</h2>
        </div>
        <button
          onClick={handleSwitchCamera}
          className="text-white hover:text-gray-200 transition-colors text-sm"
          title="Switch Camera"
        >
          🔄
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          webkit-playsinline="true"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Guide Overlay with all detection info */}
        <CameraGuideOverlay
          side={side}
          orientation={guideOrientation}
          detection={detection}
          readiness={readiness}
          onToggleOrientation={toggleOrientation}
        />

        {/* Lighting Indicator */}
        <LightingIndicator lighting={detection.lighting} />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-4 relative z-10">
        {/* Auto-capture toggle */}
        <div className="flex items-center justify-center mb-3">
          <button
            onClick={toggleAutoCapture}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              autoCaptureEnabled
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoCaptureEnabled ? 'bg-white' : 'bg-gray-500'}`} />
            Auto-capture {autoCaptureEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Capture Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className={`w-20 h-20 rounded-full border-4 transition-all shadow-lg ${
              readiness.readyForCapture
                ? 'border-green-400 bg-green-400/20 hover:bg-green-400/30'
                : detection.detected
                  ? 'border-yellow-400 bg-yellow-400/20 hover:bg-yellow-400/30'
                  : 'border-white bg-white/20 hover:bg-white/30'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            aria-label="Capture photo"
          >
            {isProcessing ? (
              <div className="w-full h-full rounded-full bg-gray-400 animate-pulse"></div>
            ) : (
              <div className={`w-full h-full rounded-full ${
                readiness.readyForCapture
                  ? 'bg-green-400'
                  : detection.detected
                    ? 'bg-yellow-400'
                    : 'bg-white'
              }`}></div>
            )}
          </button>
        </div>

        {/* Tip text */}
        <p className="text-center text-xs text-gray-500 mt-3">
          {autoCaptureEnabled
            ? 'Hold steady - auto-captures when ready'
            : 'Tap to capture • You can always retake'
          }
        </p>
      </div>
    </div>
  );
}
