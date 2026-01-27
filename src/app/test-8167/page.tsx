'use client';

import { useState } from 'react';
import { generatePreviewSheet8167 } from '@/lib/avery8167LabelGenerator';

export default function Test8167Page() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const blob = await generatePreviewSheet8167();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Failed to generate preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPreview = async () => {
    if (!previewUrl) {
      await generatePreview();
    }

    try {
      const blob = await generatePreviewSheet8167();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'avery-8167-preview.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Avery 8167 Label Preview</h1>
        <p className="text-gray-400 mb-8">
          Toploader sticker labels - 80 per sheet (4×20 grid), 1.75" × 0.5" each
        </p>

        {/* Design Description */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Label Design</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Front Label */}
            <div>
              <h3 className="text-purple-400 font-medium mb-2">Front Label</h3>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center h-16 rounded overflow-hidden border border-purple-500">
                  {/* Purple side with diagonal */}
                  <div
                    className="h-full w-2/5 bg-purple-600 flex items-center justify-center relative"
                    style={{
                      clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)',
                    }}
                  >
                    <span className="text-white text-xs font-bold">DCM</span>
                  </div>
                  {/* White side */}
                  <div className="h-full flex-1 bg-white flex flex-col items-center justify-center -ml-4">
                    <span className="text-purple-600 text-2xl font-bold">9</span>
                    <div className="w-12 h-0.5 bg-purple-600 my-0.5"></div>
                    <span className="text-purple-600 text-[10px]">Mint</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Purple background with white DCM logo, diagonal cut to white,
                  grade number over purple line over condition label
                </p>
              </div>
            </div>

            {/* Back Label */}
            <div>
              <h3 className="text-purple-400 font-medium mb-2">Back Label</h3>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-center h-16 rounded overflow-hidden border border-purple-500 bg-white">
                  <div className="w-12 h-12 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 text-xs">QR</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Centered QR code only - links to card verification page
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={generatePreview}
            disabled={isGenerating}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 rounded-lg font-medium transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate Preview'}
          </button>

          <button
            onClick={downloadPreview}
            disabled={isGenerating}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Download PDF
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* PDF Preview */}
        {previewUrl && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <iframe
              src={previewUrl}
              className="w-full h-[800px] rounded border border-gray-600"
              title="Label Preview"
            />
          </div>
        )}

        {/* Specs */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Avery 8167 Specifications</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Label Size</span>
              <p className="font-medium">1.75" × 0.5"</p>
            </div>
            <div>
              <span className="text-gray-400">Labels/Sheet</span>
              <p className="font-medium">80 (4×20)</p>
            </div>
            <div>
              <span className="text-gray-400">Cards/Sheet</span>
              <p className="font-medium">40 (front + back)</p>
            </div>
            <div>
              <span className="text-gray-400">Sheet Size</span>
              <p className="font-medium">8.5" × 11"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
