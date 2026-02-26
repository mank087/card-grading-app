'use client';

import { useState } from 'react';
import type { OverlayDefect } from '@/lib/defectOverlayData';

interface DefectOverlayProps {
  defects: OverlayDefect[];
  onDefectHover?: (d: OverlayDefect | null) => void;
  onDefectClick?: (d: OverlayDefect) => void;
  visible?: boolean;
}

const SEVERITY_COLORS: Record<string, { bg: string; border: string; pulse?: string }> = {
  minor: { bg: 'bg-green-500', border: 'border-green-700' },
  moderate: { bg: 'bg-yellow-500', border: 'border-yellow-700' },
  heavy: { bg: 'bg-red-500', border: 'border-red-700', pulse: 'animate-pulse' },
};

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function DefectOverlay({ defects, onDefectHover, onDefectClick, visible = true }: DefectOverlayProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (!visible || defects.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {defects.map((d) => {
        const colors = SEVERITY_COLORS[d.severity] || SEVERITY_COLORS.minor;
        const isHovered = hoveredId === d.id;

        return (
          <div
            key={d.id}
            className="absolute pointer-events-auto cursor-pointer group"
            style={{
              left: `${d.x_percent}%`,
              top: `${d.y_percent}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={() => {
              setHoveredId(d.id);
              onDefectHover?.(d);
            }}
            onMouseLeave={() => {
              setHoveredId(null);
              onDefectHover?.(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDefectClick?.(d);
            }}
          >
            {/* Marker circle */}
            <div
              className={`
                flex items-center justify-center rounded-full border-2 shadow-lg
                w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-bold text-white
                ${colors.bg} ${colors.border}
                ${d.severity === 'heavy' ? 'animate-pulse' : ''}
                ${isHovered ? 'ring-2 ring-white ring-offset-1 scale-125' : ''}
                transition-transform duration-150
              `}
            >
              {d.id}
            </div>

            {/* Tooltip on hover */}
            {isHovered && (
              <div
                className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none"
                style={{
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '6px',
                }}
              >
                <div className="font-semibold">{formatType(d.type)} — {d.severity}</div>
                <div className="text-gray-300 max-w-[200px] truncate">{d.description}</div>
                {/* Tooltip arrow */}
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid #111827',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
