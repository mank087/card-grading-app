'use client';

import { useCallback, useRef } from 'react';

/**
 * Long-press detection for touch, deliberately touch-ONLY.
 *
 * Desktop keeps drag-and-drop (a mouse can aim at a binder chip precisely);
 * touch gets a sheet instead, because dragging across a scrolling grid on a
 * phone fights the page scroll and the chips are small and often off-screen.
 *
 * Cancels on move (so a scroll never fires it) and on touchend before the
 * threshold, and suppresses the click that would otherwise follow and open the
 * card underneath.
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  }, []);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      fired.current = false;
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        // A short buzz confirms the press registered — without it a long-press
        // that opens a sheet feels like the app hung.
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
        onLongPress();
      }, ms);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t || !start.current) return;
      // 10px of travel means they're scrolling, not pressing.
      if (Math.abs(t.clientX - start.current.x) > 10 || Math.abs(t.clientY - start.current.y) > 10) {
        clear();
      }
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
    // Swallow the click that follows a long-press, or the card opens behind
    // the sheet.
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}

export default useLongPress;
