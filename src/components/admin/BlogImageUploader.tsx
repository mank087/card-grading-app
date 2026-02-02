'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface BlogImageUploaderProps {
  currentImage?: string | null;
  onUpload: (url: string, path: string) => void;
  onRemove?: () => void;
}

const ASPECT_RATIO = 16 / 9;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export default function BlogImageUploader({
  currentImage,
  onUpload,
  onRemove,
}: BlogImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cropping state
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, ASPECT_RATIO));
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    setOriginalFile(file);

    // Create preview URL for cropping
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to desired output (max 1600px wide for web)
    const maxWidth = 1600;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    const outputWidth = Math.min(cropWidth, maxWidth);
    const outputHeight = outputWidth / ASPECT_RATIO;

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop]);

  const handleCropComplete = async () => {
    if (!originalFile) return;

    setUploading(true);
    setError(null);

    try {
      const croppedBlob = await getCroppedImage();
      if (!croppedBlob) {
        throw new Error('Failed to crop image');
      }

      // Create a new file from the cropped blob
      const croppedFile = new File(
        [croppedBlob],
        originalFile.name.replace(/\.[^.]+$/, '.jpg'),
        { type: 'image/jpeg' }
      );

      const formData = new FormData();
      formData.append('file', croppedFile);

      const response = await fetch('/api/admin/blog/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url, path } = await response.json();
      onUpload(url, path);

      // Reset cropping state
      setImageToCrop(null);
      setOriginalFile(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCrop = () => {
    setImageToCrop(null);
    setOriginalFile(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    } else {
      setError('Please drop an image file');
    }
  }, [handleFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFileSelect]);

  // Cropping Modal
  if (imageToCrop) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-medium">Crop Image</h3>
              <p className="text-gray-400 text-sm">Adjust to 16:9 aspect ratio for best results</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              16:9
            </div>
          </div>

          <div className="flex justify-center max-h-[500px] overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={ASPECT_RATIO}
              className="max-w-full"
            >
              <img
                ref={imgRef}
                src={imageToCrop}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-w-full max-h-[450px]"
                style={{ objectFit: 'contain' }}
              />
            </ReactCrop>
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancelCrop}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropComplete}
            disabled={uploading || !completedCrop}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Crop & Upload
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentImage ? (
        <div className="relative">
          <div className="aspect-[16/9] relative rounded-lg overflow-hidden bg-gray-100">
            <Image
              src={currentImage}
              alt="Featured image"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
              title="Replace image"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-2 bg-red-500 rounded-lg shadow-md hover:bg-red-600 transition-colors"
                title="Remove image"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">16:9 aspect ratio</p>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600 mb-2">Drag and drop an image, or</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Browse Files
          </button>
          <p className="text-xs text-gray-500 mt-3">
            JPEG, PNG, WebP, or GIF up to 5MB
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Images will be cropped to 16:9 aspect ratio
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
