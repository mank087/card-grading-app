'use client';

import { useState, useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';
import { validateImageQuality, getImageDataFromFile } from '@/utils/imageQuality';
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

  // Start camera on mount
  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
  }, [facingMode]);

  const handleCapture = async () => {
    setIsProcessing(true);
    try {
      const captured = await captureImage();
      if (!captured) {
        alert('Failed to capture image. Please try again.');
        setIsProcessing(false);
        return;
      }

      setCapturedImageUrl(captured.dataUrl);
      setCapturedFile(captured.file);

      // Validate image quality
      const imageData = await getImageDataFromFile(captured.file);
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
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedImageUrl(null);
    setCapturedFile(null);
    setQualityValidation(null);
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

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">📷</div>
            <h3 className="text-xl font-bold text-white">Camera Permission Needed</h3>
            <p className="text-gray-300">
              To capture card images, we need access to your camera. Please allow camera access when prompted.
            </p>
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={() => startCamera(facingMode)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Enable Camera
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Use Gallery Instead
              </button>
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
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Guide Overlay */}
        <CameraGuideOverlay side={side} cardDetected={false} />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-6 relative z-10">
        <div className="flex items-center justify-center gap-8">
          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={isProcessing}
            className={`w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-all shadow-lg ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
            aria-label="Capture photo"
          >
            {isProcessing ? (
              <div className="w-full h-full rounded-full bg-gray-400 animate-pulse"></div>
            ) : (
              <div className="w-full h-full rounded-full bg-white"></div>
            )}
          </button>
        </div>

        <p className="text-center text-gray-400 text-sm mt-4">
          Tap the button to capture
        </p>
      </div>
    </div>
  );
}
