'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface ImageZoomModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  alt: string
  title: string
}

export default function ImageZoomModal({ isOpen, onClose, imageUrl, alt, title }: ImageZoomModalProps) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [magnifierVisible, setMagnifierVisible] = useState(false)
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 })
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const magnifierRef = useRef<HTMLDivElement>(null)

  // Detect if device supports hover (desktop)
  useEffect(() => {
    setIsDesktop(window.matchMedia('(hover: hover)').matches)
  }, [])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'auto'
    }
  }, [isOpen, onClose])

  // Update image dimensions when image loads
  const handleImageLoad = () => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect()
      setImagePosition({ x: rect.left, y: rect.top })
      setImageSize({ width: rect.width, height: rect.height })
    }
  }

  // Desktop magnifier functionality
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDesktop || !imageRef.current) return

    const rect = imageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if mouse is within image bounds
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setMagnifierVisible(true)

      // Calculate magnifier position centered on cursor with smart edge detection
      const magnifierHalfSize = magnifierSize / 2
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Start with cursor-centered position
      let magnifierX = e.clientX - magnifierHalfSize
      let magnifierY = e.clientY - magnifierHalfSize

      // Check if magnifier would go off right edge
      if (magnifierX + magnifierSize > viewportWidth) {
        magnifierX = viewportWidth - magnifierSize - 10
      }

      // Check if magnifier would go off left edge
      if (magnifierX < 10) {
        magnifierX = 10
      }

      // Check if magnifier would go off bottom edge
      if (magnifierY + magnifierSize > viewportHeight) {
        magnifierY = viewportHeight - magnifierSize - 10
      }

      // Check if magnifier would go off top edge
      if (magnifierY < 10) {
        magnifierY = 10
      }

      setMagnifierPosition({
        x: magnifierX,
        y: magnifierY
      })

      // Store cursor position relative to image for magnifier background
      setCursorPosition({ x, y })
    } else {
      setMagnifierVisible(false)
    }
  }

  const handleMouseLeave = () => {
    setMagnifierVisible(false)
  }

  if (!isOpen) return null

  const magnifierSize = 200
  const zoomLevel = 2.5

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
        aria-label="Close modal"
      >
        ✕
      </button>

      {/* Modal title */}
      <div className="absolute top-4 left-4 text-white text-lg font-medium z-10">
        {title}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Image container */}
      <div
        className="relative max-w-[70vw] max-h-[70vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          ref={imageRef}
          src={imageUrl}
          alt={alt}
          width={800}
          height={1120}
          className="max-w-full max-h-full object-contain"
          onLoad={handleImageLoad}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          priority
        />

        {/* Desktop magnifier */}
        {isDesktop && magnifierVisible && (
          <div
            ref={magnifierRef}
            className="fixed pointer-events-none border-2 border-white rounded-full shadow-lg z-20"
            style={{
              width: magnifierSize,
              height: magnifierSize,
              left: magnifierPosition.x,
              top: magnifierPosition.y,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${imageSize.width * zoomLevel}px ${imageSize.height * zoomLevel}px`,
              backgroundPosition: `-${(cursorPosition.x * zoomLevel) - (magnifierSize / 2)}px -${(cursorPosition.y * zoomLevel) - (magnifierSize / 2)}px`,
              backgroundRepeat: 'no-repeat'
            }}
          />
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm text-center">
        {isDesktop ? (
          <p>Hover over image for magnifier • Click outside or press ESC to close</p>
        ) : (
          <p>Pinch to zoom • Tap outside or swipe down to close</p>
        )}
      </div>
    </div>
  )
}