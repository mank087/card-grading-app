'use client';

/**
 * Render children at their DESIGN width and scale the whole block up.
 *
 * Owner review item 5: "Enlarge alters the mockup". `LabelMockup`'s One-Touch
 * and Toploader previews draw their compact label with fixed pixel sizes —
 * `text-[5px]`, `h-[12px]` for the mark, `text-[9px]` for the grade
 * (LabelMockup.tsx:612-630, 712-740) — against a container designed at
 * `max-w-[200px]`. Widen that container to the enlarge modal's 420px and the
 * label's BOX doubles while its type stays at five pixels: the label reads as
 * a mostly empty white bar, which is not what the sheet prints.
 *
 * `ScaleToFit` cannot help — it only ever scales DOWN. This is its mirror: the
 * children always lay out at `designWidth`, and the block is transform-scaled
 * up to `targetWidth`, so the enlarged view is an exact magnification of the
 * card-sized one. Every proportion is identical at every size.
 *
 * Below `designWidth` it does nothing and renders its children untouched, so
 * the mockup's own `max-w-[200px]` keeps control.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface ScaleUpBoxProps {
  /** The width the children were drawn for. */
  designWidth: number;
  /** The width the caller wants to occupy. */
  targetWidth: number;
  className?: string;
  children: ReactNode;
}

export function ScaleUpBox({ designWidth, targetWidth, className, children }: ScaleUpBoxProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [designHeight, setDesignHeight] = useState<number | null>(null);
  const scale = targetWidth > designWidth ? targetWidth / designWidth : 1;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // The inner block is UNSCALED, so its height is the design height and does
    // not move when `scale` changes — no feedback loop.
    const measure = () => setDesignHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  if (scale === 1) return <>{children}</>;

  return (
    <div
      className={className}
      style={{
        width: designWidth * scale,
        height: designHeight != null ? designHeight * scale : undefined,
        overflow: 'hidden',
      }}
    >
      <div
        ref={innerRef}
        style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
}

export default ScaleUpBox;
