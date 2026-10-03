'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { rotateCaptureCanvas } from '@/utils/rotateCaptureCanvas';
import { recordLocalCaptureAudit } from '@/lib/localCaptureAudit';
import { useCamera } from '@/hooks/useCamera';
import CameraGuideOverlay from './CameraGuideOverlay';
import ImagePreview from './ImagePreview';
import { validateImageQuality, getImageDataFromCanvas } from '@/utils/imageQuality';
import { cropCanvasToGuideFrame, canvasToJpegFile } from '@/utils/guideCrop';
import { computeGuideLayoutPx } from '@/utils/cameraGuideGeometry';
import { ImageQualityValidation } from '@/types/camera';
import Image from 'next/image';
import { useToast } from '@/hooks/useToast';
import { useCaptureFeedback } from '@/hooks/useCaptureFeedback';
import { MIN_CAPTURE_EDGE } from '@/utils/captureSelection';
import { prepareSystemCameraPhoto } from '@/utils/systemCameraPhoto';
import { reportUploadEvent } from '@/lib/uploadTelemetry';

/**
 * How the browser actually produced the frame.
 *
 * 'image_capture_still' is a true still off the camera's photo pipeline
 * (ImageCapture.takePhoto — Chrome/Edge/Android); 'video_frame_grab' is a
 * copy of the preview frame, capped at the negotiated stream mode, which is
 * all iOS Safari can give us. They are materially different in quality, and
 * until now the distinction was computed and then discarded — so nothing could
 * tell whether poor photos correlated with the fallback path.
 */
export type WebCaptureMethod = 'image_capture_still' | 'video_frame_grab' | 'system_camera';

interface MobileCameraProps {
  side: 'front' | 'back';
  onCapture: (file: File, meta?: { captureMethod: WebCaptureMethod }) => void;
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
  // Which path produced the frame — carried through to the card row so the
  // capture-quality dataset can separate true stills from preview grabs.
  const [captureMethod, setCaptureMethod] = useState<WebCaptureMethod>('video_frame_grab');
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityValidation, setQualityValidation] = useState<ImageQualityValidation | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const toast = useToast();
  const auditCaptureId = useRef('');
  const captureCanvas = useRef<HTMLCanvasElement | null>(null);
  const quarterTurns = useRef(0);
  const [framingWarning, setFramingWarning] = useState<string | null>(null);
  const systemCameraInput = useRef<HTMLInputElement>(null);
  const captureBusy = useRef(false);
  const lifecycle = useRef(0);
  const feedback = useCaptureFeedback(videoRef, !!stream && !capturedImageUrl && !isProcessing, orientation);
  useEffect(() => () => {
    lifecycle.current++;
    if (captureCanvas.current) captureCanvas.current.width = captureCanvas.current.height = 0;
  }, []);
  useEffect(() => () => {
    if (capturedImageUrl?.startsWith('blob:')) URL.revokeObjectURL(capturedImageUrl);
  }, [capturedImageUrl]);

  const handleSystemPhoto = async (file?: File) => {
    if (!file || captureBusy.current) return;
    captureBusy.current = true;
    const generation = lifecycle.current;
    setIsProcessing(true);
    try {
      const photo = await prepareSystemCameraPhoto(file);
      if (generation !== lifecycle.current) { URL.revokeObjectURL(photo.previewUrl); return; }
      if (Math.max(photo.canvas.width, photo.canvas.height) < MIN_CAPTURE_EDGE) {
        URL.revokeObjectURL(photo.previewUrl);
        toast.error('This photo is too small. Use an original full-resolution photo.');
        return;
      }
      auditCaptureId.current = `${Date.now()}-system`;
      captureCanvas.current = photo.canvas;
      quarterTurns.current = 0;
      setCapturedFile(photo.file);
      setCapturedImageUrl(photo.previewUrl);
      setCaptureMethod('system_camera');
      setFramingWarning(null);
      setQualityValidation(validateImageQuality(getImageDataFromCanvas(photo.canvas)));
      reportUploadEvent({ event: 'capture_attempted', side, capture_source: 'camera', capture_method: 'system_camera',
        image_width: photo.canvas.width, image_height: photo.canvas.height });
      stopCamera();
    } catch { if (generation === lifecycle.current) toast.error('Could not open this photo. Try another photo or Gallery.'); }
    finally { captureBusy.current = false; setIsProcessing(false); }
  };

  const rotatePreview = async () => {
    if (!captureCanvas.current || isProcessing) return;
    setIsProcessing(true);
    try {
      const turns = (quarterTurns.current + 1) % 4;
      const encoded = await canvasToJpegFile(rotateCaptureCanvas(captureCanvas.current, turns), { quality: 0.9, maxDimension: 3000 });
      if (capturedImageUrl?.startsWith('blob:')) URL.revokeObjectURL(capturedImageUrl);
      quarterTurns.current = turns;
      setCapturedImageUrl(encoded.previewUrl);
      setCapturedFile(encoded.file);
    } catch { toast.error('Could not rotate this photo. Please try again.'); }
    finally { setIsProcessing(false); }
  };

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

  // Returning from the phone camera/picker can pause or end the browser stream.
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'hidden' || capturedImageUrl || captureBusy.current || !stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') void startCamera(facingMode);
      else void videoRef.current?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [stream, capturedImageUrl, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Torch (flashlight) support detection — graceful no-op where unsupported (e.g. iOS Safari)
  useEffect(() => {
    setTorchOn(false);
    if (!stream) {
      setTorchSupported(false);
      return;
    }
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(!!capabilities?.torch);
    } catch {
      setTorchSupported(false);
    }
  }, [stream]);

  const toggleTorch = useCallback(async () => {
    if (!stream || captureBusy.current) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet]
      });
      setTorchOn(next);
    } catch (err) {
      // Unsupported or rejected — leave state unchanged (graceful no-op)
      console.warn('[MobileCamera] Torch toggle failed:', err);
    }
  }, [stream, torchOn]);


  // Simple capture handler.
  // v9.1 single-pass encode: captureImage returns a raw canvas frame (no JPEG),
  // and cropCanvasToGuideFrame does crop+resize+encode in ONE step. The upload
  // page skips re-compression for camera files, so this is the only lossy encode.
  const handleCapture = useCallback(async () => {
    if (captureBusy.current || !feedback.ready) return;
    captureBusy.current = true;
    const generation = lifecycle.current;

    setIsProcessing(true);
    setFramingWarning(null);
    const captureId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    auditCaptureId.current = captureId;
    const shutterRect = videoRef.current?.getBoundingClientRect();
    recordLocalCaptureAudit({ captureId, stage: 'shutter', side, orientation,
      viewport: shutterRect ? { width: shutterRect.width, height: shutterRect.height } : undefined });

    try {
      const captured = await captureImage(orientation);
      if (generation !== lifecycle.current) return;
      if (!captured) {
        recordLocalCaptureAudit({ captureId, stage: 'failed', side, orientation });
        toast.error('Failed to capture image. Please try again.');
        setIsProcessing(false);
        return;
      }

      let previewUrl: string;
      let file: File;
      let qualityCanvas: HTMLCanvasElement;
      recordLocalCaptureAudit({ captureId, stage: 'frame', side, orientation,
        frame: { width: captured.canvas.width, height: captured.canvas.height },
        stream: captured.streamSize, transform: captured.streamTransform, source: captured.captureSource,
        alignment: captured.alignment });

      try {
        // v9.10 geometry-aware crop: measure the real video element and guide
        // box so the crop is exactly what the user framed (plus padding),
        // instead of the old fixed-percentage assumption that ignored the
        // video's object-cover letterboxing.
        const rect = shutterRect;
        const viewContext = rect && rect.width > 0 && rect.height > 0
          ? (() => {
              const g = computeGuideLayoutPx(rect.width, rect.height, orientation);
              return {
                viewW: rect.width,
                viewH: rect.height,
                guideW: g.width,
                guideH: g.height,
                guideCenterOffsetY: g.centerOffsetY,
                streamW: captured.streamSize.width,
                streamH: captured.streamSize.height,
                streamTransform: captured.streamTransform,
              };
            })()
          : undefined;

        const cropResult = await cropCanvasToGuideFrame(captured.canvas, {
          // 13% padding per side (was 5%): cards drift past the guide as the
          // shutter is tapped, and a clipped edge cannot be graded. The grader
          // finds the card inside the photo, so margin costs nothing.
          paddingPercent: 0.13,
          orientation: orientation,
          maxDimension: 3000, // matches the old compression pipeline's max size
          quality: 0.9,
          viewContext,
        });
        previewUrl = cropResult.croppedDataUrl;
        file = cropResult.croppedFile;
        qualityCanvas = cropResult.croppedCanvas;
        recordLocalCaptureAudit({ captureId, stage: 'crop', side, orientation,
          viewport: rect ? { width: rect.width, height: rect.height } : undefined,
          guide: viewContext ? { width: viewContext.guideW, height: viewContext.guideH,
            centerOffsetY: viewContext.guideCenterOffsetY } : undefined,
          geometry: viewContext ? 'viewport' : 'legacy', crop: cropResult.cropArea,
          output: cropResult.croppedSize });
      } catch (err) {
        console.warn('[MobileCamera] Crop failed, using full frame:', err);
        setFramingWarning('The full camera frame was saved. Check that the card is upright, fills the photo, and all four corners are visible before continuing.');
        const fallback = await canvasToJpegFile(captured.canvas, { quality: 0.9, maxDimension: 3000 });
        previewUrl = fallback.previewUrl;
        file = fallback.file;
        qualityCanvas = fallback.canvas;
        recordLocalCaptureAudit({ captureId, stage: 'fallback', side, orientation,
          output: { width: fallback.canvas.width, height: fallback.canvas.height } });
      }

      if (generation !== lifecycle.current) { URL.revokeObjectURL(previewUrl); return; }
      if (captured.canvas !== qualityCanvas) captured.canvas.width = captured.canvas.height = 0;
      captureCanvas.current = qualityCanvas;
      quarterTurns.current = 0;
      setCapturedImageUrl(previewUrl);
      setCapturedFile(file);
      setCaptureMethod(captured.captureSource === 'photo' ? 'image_capture_still' : 'video_frame_grab');
      reportUploadEvent({ event: 'capture_attempted', side, capture_source: 'camera',
        capture_method: captured.captureSource === 'photo' ? 'image_capture_still' : 'video_frame_grab',
        image_width: qualityCanvas.width, image_height: qualityCanvas.height,
        metadata: { ...captured.diagnostics, stream: captured.streamSize, facingMode, torchOn } });
      if (captured.diagnostics && Math.max(captured.diagnostics.guideWidth, captured.diagnostics.guideHeight) < MIN_CAPTURE_EDGE) {
        setFramingWarning('The framed card has limited detail. For a clearer photo, try your phone camera or an original photo from Gallery.');
      }
      setIsProcessing(false);
      stopCamera();

      // Validate quality directly from the final canvas (no re-decode of the
      // JPEG). Read it down to analysis size rather than pulling the full
      // 3000px buffer — the old full-res getImageData allocated ~50MB here and
      // then fed a 12M-pixel main-thread convolution, which is a stall or an
      // out-of-memory reload on exactly the low-end phones that produce the
      // worst photos.
      try {
        const imageData = getImageDataFromCanvas(qualityCanvas);
        setQualityValidation(validateImageQuality(imageData));
      } catch (err) {
        setQualityValidation(validateImageQuality(null));
        console.warn('[MobileCamera] Quality validation failed:', err);
      }
    } catch (err) {
      recordLocalCaptureAudit({ captureId, stage: 'failed', side, orientation });
      if (generation !== lifecycle.current) return;
      console.error('Capture error:', err);
      toast.error('Failed to capture image. Please try again.');
      setIsProcessing(false);
    } finally {
      captureBusy.current = false;
    }
  }, [captureImage, orientation, feedback.ready, toast, side, videoRef, facingMode, torchOn, stopCamera]);

  const handleConfirm = () => {
    if (capturedFile && !isProcessing) {
      recordLocalCaptureAudit({ captureId: auditCaptureId.current, stage: 'accepted', side, orientation });
      onCapture(capturedFile, { captureMethod });
    }
  };

  const handleRetake = () => {
    recordLocalCaptureAudit({ captureId: auditCaptureId.current, stage: 'retake', side, orientation });
    if (capturedImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setCapturedFile(null);
    setQualityValidation(null);
    setFramingWarning(null);
    if (captureCanvas.current) captureCanvas.current.width = captureCanvas.current.height = 0;
    captureCanvas.current = null;
    stopCamera();
    void startCamera(facingMode);
  };

  const handleSwitchCamera = () => {
    if (captureBusy.current) return;
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const toggleOrientation = () => {
    if (captureBusy.current) return;
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
        onRotate={rotatePreview}
        busy={isProcessing}
        framingWarning={framingWarning}
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
                  void startCamera(facingMode);
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleOrientation}
              disabled={isProcessing}
              className="text-white p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
              title={`Switch to ${orientation === 'portrait' ? 'landscape' : 'portrait'} guide`}
              aria-label={`Switch to ${orientation === 'portrait' ? 'landscape' : 'portrait'} guide`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-5 h-5 transition-transform duration-300 ${orientation === 'landscape' ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <rect x="7" y="4" width="10" height="16" rx="2" strokeWidth="2" />
              </svg>
            </button>
            {torchSupported && (
              <button
                onClick={toggleTorch}
                disabled={isProcessing}
                className={`p-1.5 rounded-full transition-colors ${
                  torchOn
                    ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                    : 'text-white bg-black/30 hover:bg-black/50'
                }`}
                title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                aria-pressed={torchOn}
              >
                {/* Flashlight (lightning bolt) icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill={torchOn ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            <button
              onClick={handleSwitchCamera}
              disabled={isProcessing}
              className="text-white p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
              title="Switch Camera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Low-resolution stream warning — rendered under the HEADER, not in the
          bottom stack, so it never collides with the guide, tips, or shutter.
          The fallback constraint ladder can silently negotiate 1080p or worse;
          card crops from those streams sit at or below the 1000px grading
          minimum. Warn BEFORE the shutter. */}
      {feedback.guideEdge !== null && feedback.guideEdge < MIN_CAPTURE_EDGE && (
        <div className="absolute left-0 right-0 z-20 flex justify-center px-4" style={{ top: '52px' }}>
          <div className="bg-amber-500/90 backdrop-blur-sm text-gray-900 px-3 py-1.5 rounded-lg text-xs font-medium text-center max-w-sm">
            Preview detail is limited at this framing. Try Phone Camera if the saved photo is small or soft.
          </div>
        </div>
      )}

      {/* Overlaid Capture Controls - bottom, compact design */}
      <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom pb-4">
        <p role="status" className="mx-auto mb-2 max-w-sm px-4 text-center text-xs text-white bg-black/60">
          {isProcessing ? 'Saving photo — hold steady…' : feedback.ready ? feedback.message : 'Waiting for camera…'}
        </p>
        <input ref={systemCameraInput} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { void handleSystemPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        {/* Capture button - slightly smaller */}
        <div className="flex justify-center">
          <button
            onClick={handleCapture}
            disabled={isProcessing || !feedback.ready}
            className={`w-18 h-18 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm
              hover:bg-white/30 active:scale-95 transition-all shadow-2xl
              ${isProcessing ? 'opacity-50' : ''}`}
            style={{ width: '72px', height: '72px' }}
            aria-label="Capture photo"
          >
            <div className="w-full h-full rounded-full bg-white/90" />
          </button>
        </div>
        <button type="button" disabled={isProcessing} onClick={() => systemCameraInput.current?.click()}
          className="block mx-auto mt-2 px-3 py-1 rounded-full bg-black/60 text-white text-xs disabled:opacity-50">
          Use Phone Camera
        </button>
      </div>
    </div>
  );
}
