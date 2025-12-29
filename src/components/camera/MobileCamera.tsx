'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';
import { validateImageQuality, getImageDataFromFile } from '@/utils/imageQuality';
import { cropToGuideFrame } from '@/utils/guideCrop';
import { ImageQualityValidation } from '@/types/camera';
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';

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
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const toast = useToast();

  // Start camera on mount and when facingMode changes
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream, videoRef]);

  // Simple capture handler
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

      // Show preview immediately
      setCapturedImageUrl(captured.dataUrl);
      setCapturedFile(captured.file);
      setIsProcessing(false);

      // Process crop in background
      try {
        const cropResult = await cropToGuideFrame(captured.file, {
          paddingPercent: 0.03, // Tight 3% padding for maximum card coverage
          maintainAspectRatio: true,
          orientation: orientation,
        });
        setCapturedImageUrl(cropResult.croppedDataUrl);
        setCapturedFile(cropResult.croppedFile);

        // Validate quality
        const imageData = await getImageDataFromFile(cropResult.croppedFile);
        if (imageData) {
          setQualityValidation(validateImageQuality(imageData));
        }
      } catch (err) {
        console.warn('[MobileCamera] Crop failed, using original:', err);
      }
    } catch (err) {
      console.error('Capture error:', err);
      toast.error('Failed to capture image. Please try again.');
      setIsProcessing(false);
    }
  }, [captureImage, orientation, isProcessing, toast]);

  const handleConfirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    setCapturedFile(null);
    setQualityValidation(null);
    stopCamera();
    setTimeout(() => startCamera(facingMode), 100);
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleOrientation = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
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

  // Error state
  if (hasPermission === false || error) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between">
          <button onClick={onCancel} className="text-white font-medium">
            ← Back
          </button>
          <h2 className="text-lg font-bold">Camera Access</h2>
          <div className="w-16" />
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <div className="text-6xl">📷</div>
            <h3 className="text-xl font-bold text-white">Camera Permission Needed</h3>
            <p className="text-gray-300">
              Please allow camera access to capture card images.
            </p>
            {error && (
              <p className="text-red-400 text-sm bg-red-900/30 p-3 rounded-lg">{error}</p>
            )}
            <div className="space-y-3 pt-4">
              <button
                onClick={() => {
                  stopCamera();
                  setTimeout(() => startCamera(facingMode), 200);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Try Again
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Use Gallery Instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
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

  // Main camera view - full screen with overlaid controls
  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Full-screen Camera View */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Guide Overlay */}
        <CameraGuideOverlay
          side={side}
          orientation={orientation}
          onToggleOrientation={toggleOrientation}
        />
      </div>

      {/* Overlaid Header - compact translucent */}
      <div className="absolute top-0 left-0 right-0 z-20">
        <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-2 flex items-center justify-between safe-area-top">
          <button
            onClick={onCancel}
            className="text-white font-medium flex items-center gap-1 bg-black/30 px-2.5 py-1 rounded-full text-sm"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-full">
            <Image
              src="/DCM-logo.png"
              alt="DCM"
              width={18}
              height={18}
              className="object-contain"
            />
            <span className="font-semibold text-sm">{side === 'front' ? 'Front' : 'Back'}</span>
          </div>
          <button
            onClick={handleSwitchCamera}
            className="text-white p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            title="Switch Camera"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Overlaid Capture Controls - bottom, compact design */}
      <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom pb-4">
        {/* Tips row - compact */}
        <div className="flex justify-center gap-1.5 mb-3 px-2">
          <div className="bg-black/50 backdrop-blur-sm text-white/90 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="text-[10px]">☀️</span>
            <span className="text-[9px] font-medium">Light</span>
          </div>
          <div className="bg-black/50 backdrop-blur-sm text-white/90 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="text-[10px]">🚫</span>
            <span className="text-[9px] font-medium">Glare</span>
          </div>
          <div className="bg-black/50 backdrop-blur-sm text-white/90 px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="text-[10px]">🎯</span>
            <span className="text-[9px] font-medium">Focus</span>
          </div>
        </div>

        {/* Capture button - slightly smaller */}
        <div className="flex justify-center">
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className={`w-18 h-18 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm
              hover:bg-white/30 active:scale-95 transition-all shadow-2xl
              ${isProcessing ? 'opacity-50' : ''}`}
            style={{ width: '72px', height: '72px' }}
            aria-label="Capture photo"
          >
            <div className="w-full h-full rounded-full bg-white/90" />
          </button>
        </div>
      </div>
    </div>
  );
}
