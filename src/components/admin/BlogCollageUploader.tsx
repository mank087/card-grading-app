'use client';

import { useState, useRef, useCallback } from 'react';

interface BlogCollageUploaderProps {
  onUpload: (url: string) => void;
}

interface CollageImage {
  id: string;
  file: File;
  preview: string;
}

type LayoutOption = '1-full' | '2-side' | '3-col' | '3-feature' | '4-grid' | '5-feature' | '6-grid';

interface LayoutConfig {
  label: string;
  count: number;
  cells: { x: number; y: number; w: number; h: number }[];
}

const LAYOUTS: Record<LayoutOption, LayoutConfig> = {
  '1-full': {
    label: 'Full',
    count: 1,
    cells: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  '2-side': {
    label: 'Side by Side',
    count: 2,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  '3-col': {
    label: '3 Columns',
    count: 3,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  '3-feature': {
    label: 'Feature Left',
    count: 3,
    cells: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.5 },
      { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
    ],
  },
  '4-grid': {
    label: '2x2 Grid',
    count: 4,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  '5-feature': {
    label: 'Feature + Grid',
    count: 5,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0, w: 0.25, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.5 },
    ],
  },
  '6-grid': {
    label: '3x2 Grid',
    count: 6,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
};

const GAP = 4; // px gap between cells
const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;

function getAvailableLayouts(count: number): LayoutOption[] {
  if (count === 1) return ['1-full'];
  if (count === 2) return ['2-side'];
  if (count === 3) return ['3-col', '3-feature'];
  if (count === 4) return ['4-grid'];
  if (count === 5) return ['5-feature'];
  if (count === 6) return ['6-grid'];
  return [];
}

function getDefaultLayout(count: number): LayoutOption {
  const layouts = getAvailableLayouts(count);
  return layouts[0];
}

export default function BlogCollageUploader({ onUpload }: BlogCollageUploaderProps) {
  const [images, setImages] = useState<CollageImage[]>([]);
  const [layout, setLayout] = useState<LayoutOption>('2-side');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleAddImages = useCallback((files: FileList) => {
    const newImages: CollageImage[] = [];
    const remaining = 6 - images.length;

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      newImages.push({
        id: `${Date.now()}-${i}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    const updated = [...images, ...newImages];
    setImages(updated);

    // Auto-select best layout for the count
    if (updated.length >= 1 && updated.length <= 6) {
      setLayout(getDefaultLayout(updated.length));
    }

    setError(null);
  }, [images]);

  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      if (updated.length >= 1 && updated.length <= 6) {
        setLayout(getDefaultLayout(updated.length));
      }
      return updated;
    });
  };

  const handleMoveImage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;

    setImages(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleAddImages(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleAddImages(e.dataTransfer.files);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const generateCollage = async (): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const currentLayout = LAYOUTS[layout];
    const cells = currentLayout.cells;

    for (let i = 0; i < Math.min(images.length, cells.length); i++) {
      const cell = cells[i];
      const img = await loadImage(images[i].preview);

      // Cell dimensions with gap
      const cellX = cell.x * OUTPUT_WIDTH + GAP;
      const cellY = cell.y * OUTPUT_HEIGHT + GAP;
      const cellW = cell.w * OUTPUT_WIDTH - GAP * 2;
      const cellH = cell.h * OUTPUT_HEIGHT - GAP * 2;

      // Cover-fit: scale to fill, then center-crop
      const imgRatio = img.width / img.height;
      const cellRatio = cellW / cellH;

      let sx = 0, sy = 0, sw = img.width, sh = img.height;

      if (imgRatio > cellRatio) {
        // Image is wider than cell - crop sides
        sw = img.height * cellRatio;
        sx = (img.width - sw) / 2;
      } else {
        // Image is taller than cell - crop top/bottom
        sh = img.width / cellRatio;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, cellX, cellY, cellW, cellH);
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.92
      );
    });
  };

  const handleCreateCollage = async () => {
    if (images.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const blob = await generateCollage();
      if (!blob) throw new Error('Failed to generate collage');

      const file = new File([blob], `collage-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/blog/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url } = await response.json();
      onUpload(url);

      // Clean up
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create collage');
    } finally {
      setUploading(false);
    }
  };

  const currentLayout = LAYOUTS[layout];
  const availableLayouts = images.length >= 1 ? getAvailableLayouts(images.length) : [];

  return (
    <div className="space-y-4">
      {/* Image slots */}
      {images.length > 0 && (
        <div className="space-y-3">
          {/* Preview */}
          <div
            className="relative bg-gray-800 rounded-lg overflow-hidden"
            style={{ aspectRatio: '16/9' }}
          >
            {currentLayout.cells.map((cell, i) => {
              const img = images[i];
              if (!img) return null;

              return (
                <div
                  key={img.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `calc(${cell.x * 100}% + ${GAP}px)`,
                    top: `calc(${cell.y * 100}% + ${GAP}px)`,
                    width: `calc(${cell.w * 100}% - ${GAP * 2}px)`,
                    height: `calc(${cell.h * 100}% - ${GAP * 2}px)`,
                  }}
                >
                  <img
                    src={img.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* Image number badge */}
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Image list with reorder controls */}
          <div className="space-y-1">
            {images.map((img, i) => (
              <div key={img.id} className="flex items-center gap-2 bg-gray-100 rounded px-2 py-1.5">
                <span className="text-xs font-medium text-gray-500 w-4">{i + 1}</span>
                <img src={img.preview} alt="" className="w-10 h-7 object-cover rounded" />
                <span className="text-xs text-gray-600 truncate flex-1">{img.file.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveImage(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveImage(i, 1)}
                    disabled={i === images.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="p-0.5 text-red-400 hover:text-red-600"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Layout selector (when multiple layouts available) */}
          {availableLayouts.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Layout</label>
              <div className="flex gap-2">
                {availableLayouts.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayout(l)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      layout === l
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {LAYOUTS[l].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add more / Create buttons */}
          <div className="flex gap-2">
            {images.length < 6 && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium transition-colors"
              >
                + Add More ({6 - images.length} remaining)
              </button>
            )}
            <button
              type="button"
              onClick={handleCreateCollage}
              disabled={uploading || images.length === 0}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Collage'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty state / drop zone */}
      {images.length === 0 && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600 text-sm mb-1">Drop 1-6 images to create a collage</p>
          <p className="text-gray-400 text-xs">Or click to browse files</p>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
