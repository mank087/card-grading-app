'use client';

import Image from 'next/image';
import { ImageQualityValidation } from '@/types/camera';

interface ImagePreviewProps {
  imageUrl: string;
  side: 'front' | 'back';
  qualityValidation?: ImageQualityValidation | null;
  onConfirm: () => void;
  onRetake: () => void;
}

export default function ImagePreview({
  imageUrl,
  side,
  qualityValidation,
  onConfirm,
  onRetake
}: ImagePreviewProps) {
  const hasQualityIssues = qualityValidation && !qualityValidation.isValid;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4">
        <h2 className="text-lg font-bold text-center">
          Review {side === 'front' ? 'Front' : 'Back'} Image
        </h2>
      </div>

      {/* Image Preview */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md" style={{ aspectRatio: '2.5 / 3.5' }}>
            <Image
              src={imageUrl}
              alt={`${side} of card`}
              fill
              className="object-contain rounded-lg"
              priority
            />
          </div>
        </div>
      </div>

      {/* Quality Validation Feedback */}
      {qualityValidation && (
        <div className="px-4 py-3 bg-gray-800">
          <div className={`rounded-lg p-3 ${
            qualityValidation.isValid
              ? 'bg-green-900/50 border border-green-500'
              : 'bg-yellow-900/50 border border-yellow-500'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {qualityValidation.isValid ? '✓' : '⚠️'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${
                    qualityValidation.isValid ? 'text-green-300' : 'text-yellow-300'
                  }`}>
                    Image Quality: Grade {qualityValidation.confidenceLetter}
                  </p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    qualityValidation.confidenceLetter === 'A' ? 'bg-green-600 text-white' :
                    qualityValidation.confidenceLetter === 'B' ? 'bg-blue-600 text-white' :
                    qualityValidation.confidenceLetter === 'C' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {qualityValidation.confidenceLetter === 'A' ? 'Excellent' :
                     qualityValidation.confidenceLetter === 'B' ? 'Good' :
                     qualityValidation.confidenceLetter === 'C' ? 'Fair' : 'Poor'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Score: {qualityValidation.overallScore}/100 • AI Grade Uncertainty: {qualityValidation.gradeUncertainty}
                </p>
              </div>
            </div>

            {/* Quality Check Details */}
            <div className="space-y-1 text-xs">
              <div className={`flex items-center gap-2 ${
                qualityValidation.checks.blur.passed ? 'text-green-400' : 'text-yellow-400'
              }`}>
                <span>{qualityValidation.checks.blur.passed ? '✓' : '⚠'}</span>
                <span>{qualityValidation.checks.blur.message}</span>
              </div>
              <div className={`flex items-center gap-2 ${
                qualityValidation.checks.brightness.passed ? 'text-green-400' : 'text-yellow-400'
              }`}>
                <span>{qualityValidation.checks.brightness.passed ? '✓' : '⚠'}</span>
                <span>{qualityValidation.checks.brightness.message}</span>
              </div>
            </div>

            {/* Confidence Letter Explanation */}
            <div className="mt-2 pt-2 border-t border-gray-600">
              <p className="text-gray-400 text-xs">
                <span className="font-semibold">Grade {qualityValidation.confidenceLetter}:</span>{' '}
                {qualityValidation.confidenceLetter === 'A' &&
                  'Sharp focus, excellent lighting. AI grading will be highly accurate (±0.25 grades).'}
                {qualityValidation.confidenceLetter === 'B' &&
                  'Good clarity with moderate shadows. AI grading accuracy is good (±0.5 grades).'}
                {qualityValidation.confidenceLetter === 'C' &&
                  'Fair quality with noticeable blur or shadows. AI grading may vary (±1.0 grade).'}
                {qualityValidation.confidenceLetter === 'D' &&
                  'Poor quality - severe blur or lighting issues. AI grading accuracy reduced (±1.5 grades).'}
              </p>
            </div>

            {/* Suggestions */}
            {qualityValidation.suggestions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-600">
                <p className="text-yellow-300 text-xs font-semibold mb-1">Suggestions:</p>
                <ul className="text-xs text-gray-300 space-y-0.5">
                  {qualityValidation.suggestions.map((suggestion, idx) => (
                    <li key={idx}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-4 space-y-3">
        {hasQualityIssues && (
          <p className="text-center text-yellow-400 text-sm mb-2">
            You can retake for better quality or continue with this image
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onRetake}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
          >
            🔄 Retake
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-4 rounded-lg font-semibold transition-colors ${
              qualityValidation?.isValid
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            {qualityValidation?.isValid ? '✓ Use This Image' : '⚠️ Use Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
