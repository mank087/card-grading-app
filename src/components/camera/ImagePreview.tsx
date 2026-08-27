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

      {/* Image Preview — object-contain fills whatever space the quality
          panel and buttons leave, so the card is NEVER clipped. The previous
          wrapper derived its height from its WIDTH (fixed 2.5/3.5 aspect box):
          on phone-height viewports the box wanted ~550px while the flex area
          had ~200px, and overflow-hidden cut the card off top and bottom. It
          also forced landscape captures into a portrait frame. min-h-0 lets
          the flex item actually shrink. */}
      <div className="flex-1 min-h-0 relative bg-gray-900">
        <div className="absolute inset-3">
          <Image
            src={imageUrl}
            alt={`${side} of card`}
            fill
            className="object-contain rounded-lg"
            priority
          />
        </div>
      </div>

      {/* Quality Validation Feedback — height-capped and scrollable so a long
          suggestion list squeezes the panel, not the card image above it. */}
      {qualityValidation && (
        <div className="px-4 py-3 bg-gray-800 max-h-[38vh] overflow-y-auto">
          <div className={`rounded-lg p-3 ${
            qualityValidation.isValid
              ? 'bg-green-900/50 border border-green-500'
              : 'bg-yellow-900/50 border border-yellow-500'
          }`}>
            {/* Reports the two things this check actually measures. The old
                "Image Quality: Grade B · ±0.5" header asserted a confidence
                letter from focus and brightness alone, on a scale that did not
                match the grading rubric (which defines B as ±1, C as ±2, D as
                ±3) — so the badge here routinely contradicted the grade report
                the customer received minutes later. The real letter now comes
                only from grading. */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {qualityValidation.isValid ? '✓' : '⚠️'}
              </span>
              <div className="flex-1">
                <p className={`font-semibold ${
                  qualityValidation.isValid ? 'text-green-300' : 'text-yellow-300'
                }`}>
                  {qualityValidation.isValid ? 'Focus and lighting look good' : 'Focus or lighting needs attention'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Glare, framing and corner visibility are assessed by DCM Optic™ during grading.
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

            {/* The four "Grade A/B/C/D means ±0.25/±0.5/±1.0/±1.5" blurbs that
                stood here are gone. Every number in them was wrong against the
                rubric, and they promised a grading accuracy this screen has no
                basis to promise. */}

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
        {/* isValid can now actually be false — focus and lighting are hard
            constraints rather than averaged scores — so this warning means the
            photo is genuinely unusable, not merely imperfect. Say so plainly.
            The override stays: the authoritative block is server-side, and a
            client that guesses wrong should not be the thing that stops a
            paying customer. */}
        {hasQualityIssues && (
          <p className="text-center text-yellow-400 text-sm mb-2">
            This photo may be too poor to grade accurately. Retaking is strongly recommended.
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
