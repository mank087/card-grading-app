'use client';

import type { OverlayDefect } from '@/lib/defectOverlayData';

interface DefectLegendProps {
  defects: OverlayDefect[];
  activeDefectId?: number | null;
  onDefectHover?: (d: OverlayDefect | null) => void;
}

const SEVERITY_DOT: Record<string, string> = {
  minor: 'bg-green-500',
  moderate: 'bg-yellow-500',
  heavy: 'bg-red-500',
};

const SEVERITY_BG: Record<string, string> = {
  minor: 'bg-green-50 border-green-200',
  moderate: 'bg-yellow-50 border-yellow-200',
  heavy: 'bg-red-50 border-red-200',
};

const SOURCE_LABELS: Record<string, string> = {
  corner: 'Corners',
  edge: 'Edges',
  surface: 'Surface',
};

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function DefectLegend({ defects, activeDefectId, onDefectHover }: DefectLegendProps) {
  if (defects.length === 0) return null;

  // Group by source
  const grouped: Record<string, OverlayDefect[]> = {};
  for (const d of defects) {
    if (!grouped[d.source]) grouped[d.source] = [];
    grouped[d.source].push(d);
  }

  const sourceOrder: OverlayDefect['source'][] = ['corner', 'edge', 'surface'];

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Defect Map Legend</p>
      {sourceOrder.map((source) => {
        const items = grouped[source];
        if (!items || items.length === 0) return null;

        return (
          <div key={source}>
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{SOURCE_LABELS[source]}</p>
            <div className="space-y-1">
              {items.map((d) => {
                const isActive = activeDefectId === d.id;
                return (
                  <div
                    key={d.id}
                    className={`
                      flex items-start gap-2 px-2 py-1.5 rounded-md border text-xs transition-colors cursor-default
                      ${isActive ? SEVERITY_BG[d.severity] : 'bg-white border-gray-100 hover:bg-gray-50'}
                    `}
                    onMouseEnter={() => onDefectHover?.(d)}
                    onMouseLeave={() => onDefectHover?.(null)}
                  >
                    <span className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[d.severity]}`} />
                    <span className="font-bold text-gray-700 flex-shrink-0">#{d.id}</span>
                    <span className="text-gray-600">
                      {formatType(d.type)} <span className="text-gray-400">({d.severity})</span>
                      {d.description && (
                        <span className="text-gray-400"> — {d.description.length > 80 ? d.description.slice(0, 80) + '…' : d.description}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
