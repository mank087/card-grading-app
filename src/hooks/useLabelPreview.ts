/**
 * useLabelPreview — Custom hook for debounced canvas rendering
 *
 * Accepts a CustomLabelConfig + SlabLabelData, renders to a canvas ref
 * with 300ms debounce for smooth live preview in the Label Studio designer.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { renderCustomFrontPreview, renderCustomBackPreview } from '@/lib/customSlabLabelGenerator';
import type { SlabLabelData } from '@/lib/slabLabelGenerator';
import type { CustomLabelConfig } from '@/lib/labelPresets';

interface UseLabelPreviewOptions {
  config: CustomLabelConfig;
  data: SlabLabelData | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  debounceMs?: number;
}

interface UseLabelPreviewReturn {
  isRendering: boolean;
}

export function useLabelPreview({
  config,
  data,
  canvasRef,
  debounceMs = 300,
}: UseLabelPreviewOptions): UseLabelPreviewReturn {
  const [isRendering, setIsRendering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);

  const render = useCallback(async () => {
    if (!data || !canvasRef.current) return;

    const renderId = ++renderIdRef.current;
    setIsRendering(true);

    try {
      if (config.side === 'front') {
        await renderCustomFrontPreview(canvasRef.current, data, config);
      } else {
        await renderCustomBackPreview(canvasRef.current, data, config);
      }
    } catch (err) {
      console.error('Label preview render error:', err);
    }

    // Only clear rendering if this is still the latest render
    if (renderId === renderIdRef.current) {
      setIsRendering(false);
    }
  }, [config, data, canvasRef]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      render();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [render, debounceMs]);

  return { isRendering };
}
