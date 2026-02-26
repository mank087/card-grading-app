'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string | React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
  defaultOpen?: boolean;
  tourId?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  gradientFrom = '#6d28d9',
  gradientTo = '#a855f7',
  defaultOpen = false,
  tourId,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4" {...(tourId ? { 'data-tour': tourId, id: tourId } : {})}>
      {/* Clickable gradient header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-t-xl ${!isOpen ? 'rounded-b-xl' : ''} text-white font-bold text-sm md:text-base shadow-md transition-all duration-200 hover:brightness-110 active:brightness-95`}
        style={{
          backgroundImage: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
        }}
      >
        <span className="flex items-center gap-2">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-semibold">
              {badge}
            </span>
          )}
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Collapsible content - always mounted to preserve child state/effects */}
      <div
        className={`bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl p-4 md:p-6 shadow-sm ${isOpen ? '' : 'hidden'}`}
      >
        {children}
      </div>
    </div>
  );
}
