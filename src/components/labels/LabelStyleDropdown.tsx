'use client'

import { useState, useRef, useEffect } from 'react'
import type { SavedCustomStyle } from '@/lib/labelPresets'
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle'

interface LabelStyleDropdownProps {
  labelStyle: LabelStyleId
  customStyles: SavedCustomStyle[]
  onSwitch: (id: LabelStyleId) => void
  compact?: boolean
}

export function LabelStyleDropdown({
  labelStyle,
  customStyles,
  onSwitch,
  compact = false,
}: LabelStyleDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get display name for current style
  const getDisplayName = (id: LabelStyleId): string => {
    if (id === 'modern') return 'Modern (DCM)'
    if (id === 'traditional') return 'Traditional'
    const custom = customStyles.find(s => s.id === id)
    return custom?.name || id
  }

  // Color dot for custom styles
  const ColorDot = ({ config }: { config: SavedCustomStyle['config'] }) => (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{
        background: config.colorPreset === 'rainbow'
          ? 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00cc00, #0066ff, #8800ff, #ff00ff)'
          : `linear-gradient(135deg, ${config.gradientStart}, ${config.gradientEnd})`,
        border: config.borderEnabled ? `1px solid ${config.borderColor}` : '1px solid rgba(0,0,0,0.15)',
      }}
    />
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors text-left ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className="text-gray-500 font-medium">Label Style:</span>
        <span className="font-semibold text-gray-900">{getDisplayName(labelStyle)}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Built-in styles */}
          <button
            onClick={() => { onSwitch('modern'); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
              labelStyle === 'modern' ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-900'
            }`}
          >
            <span className="font-medium text-sm">Modern (DCM)</span>
            {labelStyle === 'modern' && (
              <svg className="w-4 h-4 ml-auto text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { onSwitch('traditional'); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
              labelStyle === 'traditional' ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-900'
            }`}
          >
            <span className="font-medium text-sm">Traditional</span>
            {labelStyle === 'traditional' && (
              <svg className="w-4 h-4 ml-auto text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Custom styles section */}
          {customStyles.length > 0 && (
            <>
              <div className="border-t border-gray-200 mx-3" />
              {customStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => { onSwitch(style.id as LabelStyleId); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    labelStyle === style.id ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <ColorDot config={style.config} />
                  <span className="font-medium text-sm truncate">{style.name}</span>
                  {labelStyle === style.id && (
                    <svg className="w-4 h-4 ml-auto flex-shrink-0 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Create in Label Studio link */}
          {customStyles.length < 4 && (
            <>
              <div className="border-t border-gray-200 mx-3" />
              <a
                href="/labels"
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-50 transition-colors text-purple-600"
              >
                <span className="text-sm">+ Create in Label Studio</span>
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}
