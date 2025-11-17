'use client';

import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface UploadMethodSelectorProps {
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  side: 'front' | 'back';
}

export default function UploadMethodSelector({
  onCameraSelect,
  onGallerySelect,
  side
}: UploadMethodSelectorProps) {
  const { showCameraOption, mounted } = useDeviceDetection();

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted) {
    return null;
  }

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

      <div className="grid gap-4">
        {/* Camera Option - Only show on mobile/tablet */}
        {showCameraOption && (
          <button
            onClick={onCameraSelect}
            className="group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl p-6 transition-all shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                📷
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-lg font-bold mb-1">Use Camera</h4>
                <p className="text-sm text-white/90">
                  Capture with guided positioning
                </p>
              </div>
              <div className="text-white/60 group-hover:text-white transition-colors">
                →
              </div>
            </div>

            {/* Recommended badge */}
            <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold">
              RECOMMENDED
            </div>
          </button>
        )}

        {/* Gallery/File Upload Option */}
        <button
          onClick={onGallerySelect}
          className="group relative overflow-hidden bg-white hover:bg-gray-50 border-2 border-gray-300 hover:border-indigo-400 rounded-xl p-6 transition-all shadow-md hover:shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-3xl">
              🖼️
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-lg font-bold text-gray-900 mb-1">
                {showCameraOption ? 'Choose from Gallery' : 'Upload Image'}
              </h4>
              <p className="text-sm text-gray-600">
                {showCameraOption ? 'Select an existing photo' : 'Choose a file from your device'}
              </p>
            </div>
            <div className="text-gray-400 group-hover:text-indigo-600 transition-colors">
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
