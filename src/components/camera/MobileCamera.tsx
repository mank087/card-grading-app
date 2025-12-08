'use client';

import { useState, useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useCardDetection } from '@/hooks/useCardDetection';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';
import { validateImageQuality, getImageDataFromFile } from '@/utils/imageQuality';
import { cropToGuideFrame } from '@/utils/guideCrop';
import { ImageQualityValidation } from '@/types/camera';
import Image from 'next/image';

interface MobileCameraProps {
  side: 'front' | 'back';
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export default function MobileCamera({ side, onCapture, onCancel }: MobileCameraProps) {
  const { videoRef, stream, error, hasPermission, startCamera, stopCamera, captureImage } = useCamera();
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityValidation, setQualityValidation] = useState<ImageQualityValidation | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Auto card detection - pass side to adjust detection for card backs
  const detection = useCardDetection(videoRef, !!stream, side);

  // Start camera on mount and when facingMode changes
  useEffect(() => {
    startCamera(facingMode);

    // Cleanup function - inline to avoid stale closures
    return () => {
      console.log('[MobileCamera] Cleaning up camera on unmount or facingMode change');
      stopCamera();
    };
  }, [facingMode]); // Only depend on facingMode, not the functions

  // Ensure video element has the stream when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('[MobileCamera] Syncing stream to video element');
      console.log('[MobileCamera] Stream active:', stream.active);
      console.log('[MobileCamera] Stream tracks:', stream.getTracks().map(t => `${t.kind}: ${t.label}, enabled: ${t.enabled}`));

      videoRef.current.srcObject = stream;

      // Force play
      videoRef.current.play().then(() => {
        console.log('[MobileCamera] Video playing');
      }).catch(err => {
        console.error('[MobileCamera] Video play error:', err);
      });
    }
  }, [stream]); // Run when stream changes

  const handleCapture = async () => {
    setIsProcessing(true);
    try {
      const captured = await captureImage();
      if (!captured) {
        alert('Failed to capture image. Please try again.');
        setIsProcessing(false);
        return;
      }

      console.log('[MobileCamera] Image captured, applying auto-crop...');

      // Auto-crop to guide frame boundaries
      let finalFile = captured.file;
      let finalDataUrl = captured.dataUrl;

      try {
        const cropResult = await cropToGuideFrame(captured.file, {
          paddingPercent: 0.08, // 8% padding (~1 inch buffer) for positioning tolerance
          maintainAspectRatio: true
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
        // Continue with original image if crop fails
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
      alert('Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      // Don't stop camera here - let parent component control it
      // Camera will be stopped by cleanup when component unmounts
    }
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    setCapturedFile(null);
    setQualityValidation(null);
    // Restart camera to ensure fresh stream
    console.log('[MobileCamera] Restarting camera after retake');
    stopCamera();
    setTimeout(() => {
      startCamera(facingMode);
    }, 200);
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
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
                  // Ensure clean state before retry
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

        {/* Guide Overlay */}
        <CameraGuideOverlay side={side} cardDetected={detection.isCardDetected} />
      </div>

      {/* Controls - Fixed height to prevent layout jumping */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-4 relative z-10">
        {/* Detection feedback - Fixed height container */}
        <div className="h-12 flex items-center justify-center mb-3">
          <div className="text-center">
            <p className={`text-sm font-medium transition-colors ${
              detection.isCardDetected ? 'text-green-400' : 'text-gray-400'
            }`}>
              {detection.isCardDetected ? '✓ Card detected - Ready!' : 'Position card in frame'}
            </p>
            {/* Show hint if available and not detected */}
            {!detection.isCardDetected && detection.hints && detection.hints.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {detection.hints[0]}
              </p>
            )}
          </div>
        </div>

        {/* Capture Button - Always enabled */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className={`w-20 h-20 rounded-full border-4 transition-all shadow-lg ${
              detection.isCardDetected
                ? 'border-green-400 bg-green-400/20 hover:bg-green-400/30'
                : 'border-white bg-white/20 hover:bg-white/30'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            aria-label="Capture photo"
          >
            {isProcessing ? (
              <div className="w-full h-full rounded-full bg-gray-400 animate-pulse"></div>
            ) : (
              <div className={`w-full h-full rounded-full ${
                detection.isCardDetected ? 'bg-green-400' : 'bg-white'
              }`}></div>
            )}
          </button>
        </div>

        {/* Tip text - Fixed position */}
        <p className="text-center text-xs text-gray-500 mt-3">
          Tap to capture • You can always retake
        </p>
      </div>
    </div>
  );
}
