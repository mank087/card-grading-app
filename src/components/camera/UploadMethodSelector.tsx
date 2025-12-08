'use client';

import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import Link from 'next/link';

interface UploadMethodSelectorProps {
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  side: 'front' | 'back';
  disabled?: boolean;
  creditsBalance?: number;
}

export default function UploadMethodSelector({
  onCameraSelect,
  onGallerySelect,
  side,
  disabled = false,
  creditsBalance = 1
}: UploadMethodSelectorProps) {
  const { showCameraOption, mounted } = useDeviceDetection();

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted) {
    return null;
  }

  // Show disabled state when no credits
  const isDisabled = disabled || creditsBalance === 0;

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upload {side === 'front' ? 'Front' : 'Back'} of Card
        </h3>
        <p className="text-sm text-gray-600">
          {showCameraOption
            ? 'Choose how you want to upload the image'
            : 'Upload an image from your device'}
        </p>
      </div>

      {/* No credits warning banner */}
      {isDisabled && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">No credits available</p>
              <p className="text-xs text-red-600">Purchase credits to start grading</p>
            </div>
            <Link
              href="/credits"
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Get Credits
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {/* Camera Option - Only show on mobile/tablet */}
        {showCameraOption && (
          <button
            onClick={onCameraSelect}
            disabled={isDisabled}
            className={`group relative overflow-hidden rounded-xl p-6 transition-all shadow-lg ${
              isDisabled
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl'
            } text-white`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                isDisabled ? 'bg-gray-400/30' : 'bg-white/20'
              }`}>
                📷
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-lg font-bold mb-1">Use Camera</h4>
                <p className={`text-sm ${isDisabled ? 'text-white/60' : 'text-white/90'}`}>
                  Capture with guided positioning
                </p>
              </div>
              <div className={`transition-colors ${isDisabled ? 'text-white/30' : 'text-white/60 group-hover:text-white'}`}>
                →
              </div>
            </div>

            {/* Recommended badge */}
            {!isDisabled && (
              <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
                RECOMMENDED
              </div>
            )}
          </button>
        )}

        {/* Gallery/File Upload Option */}
        <button
          onClick={onGallerySelect}
          disabled={isDisabled}
          className={`group relative overflow-hidden border-2 rounded-xl p-6 transition-all shadow-md ${
            isDisabled
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-indigo-400 hover:shadow-lg'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
              isDisabled ? 'bg-gray-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'
            }`}>
              🖼️
            </div>
            <div className="flex-1 text-left">
              <h4 className={`text-lg font-bold mb-1 ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                {showCameraOption ? 'Choose from Gallery' : 'Upload Image'}
              </h4>
              <p className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                {showCameraOption ? 'Select an existing photo' : 'Choose a file from your device'}
              </p>
            </div>
            <div className={`transition-colors ${isDisabled ? 'text-gray-300' : 'text-gray-400 group-hover:text-indigo-600'}`}>
              →
            </div>
          </div>
        </button>
      </div>

      {/* Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 font-semibold mb-2">💡 Tips for Best Results:</p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Use good lighting - avoid shadows and glare</li>
          <li>• Ensure all 4 corners are visible</li>
          <li>• Keep the card flat and in focus</li>
          <li>• Capture against a plain background</li>
        </ul>
      </div>
    </div>
  );
}
