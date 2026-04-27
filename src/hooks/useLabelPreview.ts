/**
 * useLabelPreview — Custom hook for debounced canvas rendering
 *
 * Accepts a CustomLabelConfig + SlabLabelData, renders to an OFFSCREEN canvas
 * with 300ms debounce for smooth live preview in the Label Studio designer.
 *
 * Returns a previewDataUrl (base64 PNG) that works reliably on all platforms,
 * including mobile where the target canvas may be hidden (display:none).
 * Also copies the rendered result to the target canvas ref for desktop display.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { renderFrontCanvas, renderBackCanvas } from '@/lib/customSlabLabelGenerator';
import type { SlabLabelData } from '@/lib/slabLabelGenerator';
import type { CustomLabelConfig } from '@/lib/labelPresets';

// Render at 2x for sharp previews. Capped at 2x to avoid huge canvases on
// high-DPI mobile devices (3x+) that can fail or render slowly.
const PREVIEW_DPI = 192;

interface UseLabelPreviewOptions {
  config: CustomLabelConfig;
  data: SlabLabelData | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  debounceMs?: number;
}

interface UseLabelPreviewReturn {
  isRendering: boolean;
  /** Base64 data URL of the rendered label — always available after first render */
  previewDataUrl: string | null;
}

export function useLabelPreview({
  config,
  data,
  canvasRef,
  debounceMs = 300,
}: UseLabelPreviewOptions): UseLabelPreviewReturn {
  const [isRendering, setIsRendering] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);

  // Serialize config to detect all field changes (object reference may not change)
  const configKey = JSON.stringify(config);
  const dataKey = data ? `${data.serial}-${data.grade}-${data.primaryName}` : '';

  const render = useCallback(async () => {
    if (!data) return;

    const renderId = ++renderIdRef.current;
    setIsRendering(true);

    try {
      const offscreen = config.side === 'front'
        ? await renderFrontCanvas(data, config, PREVIEW_DPI)
        : await renderBackCanvas(data, config, PREVIEW_DPI);

      try {
        setPreviewDataUrl(offscreen.toDataURL('image/png'));
      } catch {
        // Extremely unlikely for an offscreen canvas
      }

      const target = canvasRef.current;
      if (target) {
        target.width = offscreen.width;
        target.height = offscreen.height;
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.drawImage(offscreen, 0, 0);
        }
      }
    } catch (err) {
      console.error('Label preview render error:', err);
    }

    if (renderId === renderIdRef.current) {
      setIsRendering(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, dataKey, canvasRef]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      render();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [render, debounceMs]);

  return { isRendering, previewDataUrl };
}
