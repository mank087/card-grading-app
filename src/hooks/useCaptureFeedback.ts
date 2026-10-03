'use client';

import { useEffect, useState, type RefObject } from 'react';
import { getCaptureRegion } from '@/utils/captureSelection';
import { validateImageQuality } from '@/utils/imageQuality';

/** Advisory, throttled viewfinder hints. The guide is not a detected card boundary. */
export function useCaptureFeedback(
  videoRef: RefObject<HTMLVideoElement | null>, active: boolean,
  orientation: 'portrait' | 'landscape',
) {
  const [ready, setReady] = useState(false);
  const [guideEdge, setGuideEdge] = useState<number | null>(null);
  const [message, setMessage] = useState('Keep every edge visible. If text looks soft, move back slightly.');
  useEffect(() => {
    setReady(false);
    setGuideEdge(null);
    if (!active) return;
    const canvas = document.createElement('canvas');
    let previous: Uint8ClampedArray | undefined;
    const check = () => {
      const video = videoRef.current;
      const usable = !!video && document.visibilityState !== 'hidden' && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused;
      setReady(usable);
      if (!usable) { previous = undefined; return; }
      try {
        const view = video.getBoundingClientRect();
        const region = getCaptureRegion(video.videoWidth, video.videoHeight, view.width, view.height, orientation);
        setGuideEdge(Math.round(Math.max(region.width, region.height)));
        const scale = Math.min(1, 512 / Math.max(region.width, region.height));
        canvas.width = Math.max(1, Math.round(region.width * scale));
        canvas.height = Math.max(1, Math.round(region.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const quality = validateImageQuality(pixels);
        let movement = 0, n = 0;
        if (previous?.length === pixels.data.length) {
          for (let i = 0; i < pixels.data.length; i += 64) {
            movement += Math.abs(pixels.data[i] - previous[i]); n++;
          }
        }
        previous = pixels.data;
        setMessage(quality.status === 'unknown' ? 'Check that the printed text looks sharp.'
          : !quality.checks.brightness.passed ? 'Use brighter, diffuse light and avoid reflections.'
          : n > 0 && movement / n > 12 ? 'Hold steady while the camera settles.'
          : !quality.checks.blur.passed ? 'If text looks soft, move back slightly and hold steady.'
          : 'Keep every edge visible and check the printed text is sharp.');
      } catch { setGuideEdge(null); }
    };
    check();
    const timer = setInterval(check, 500);
    return () => { clearInterval(timer); canvas.width = canvas.height = 0; };
  }, [active, orientation, videoRef]);
  return { ready, guideEdge, message };
}
