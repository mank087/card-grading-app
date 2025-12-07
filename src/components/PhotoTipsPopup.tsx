'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dcm_hide_photo_tips'

interface PhotoTipsPopupProps {
  isOpen: boolean
  onClose: () => void
  onProceed: () => void
}

export default function PhotoTipsPopup({ isOpen, onClose, onProceed }: PhotoTipsPopupProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  if (!isOpen) return null

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    onProceed()
  }

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pro Tip</h2>
              <p className="text-indigo-100 text-sm">Getting an A-Grade Confidence Rating</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-yellow-500 mt-0.5">☀️</span>
              <span className="text-gray-700 text-sm">Use natural lighting or a bright, diffused light source</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-400 mt-0.5">⚡</span>
              <span className="text-gray-700 text-sm">Avoid flash photography that creates glare</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-500 mt-0.5">📐</span>
              <span className="text-gray-700 text-sm">Keep the card flat and parallel to the camera</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">🔓</span>
              <span className="text-gray-700 text-sm">Remove from holders if possible for clearest images</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-500 mt-0.5">🔍</span>
              <span className="text-gray-700 text-sm">Fill the frame with the card, leaving minimal background</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-indigo-500 mt-0.5">✨</span>
              <span className="text-gray-700 text-sm">Ensure the entire card is in sharp focus</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-gray-500 mt-0.5">🎨</span>
              <span className="text-gray-700 text-sm">Use a contrasting, solid-color background</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
              Don't show this again
            </span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md"
            >
              Got it, proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to check if tips should be shown
export function useShouldShowPhotoTips(): boolean {
  const [shouldShow, setShouldShow] = useState(true)

  useEffect(() => {
    const hidden = localStorage.getItem(STORAGE_KEY)
    setShouldShow(hidden !== 'true')
  }, [])

  return shouldShow
}
