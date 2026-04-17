'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// Scanic is loaded via script tag from /lib/scanic.umd.js to avoid Next.js WASM webpack issues
declare global {
  interface Window {
    scanic?: {
      Scanner: new (options?: any) => {
        initialize(): Promise<void>
        scan(image: HTMLCanvasElement, options?: any): Promise<{
          success: boolean
          corners: { topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomRight: { x: number; y: number }; bottomLeft: { x: number; y: number } } | null
          output: HTMLCanvasElement | null
        }>
      }
    }
  }
}

function loadScanicScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.scanic) { resolve(); return }
    const existing = document.getElementById('scanic-script')
    if (existing) { resolve(); return }
    const script = document.createElement('script')
    script.id = 'scanic-script'
    script.src = '/lib/scanic.umd.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Scanic'))
    document.head.appendChild(script)
  })
}

// ============================================================================
// TYPES
// ============================================================================

interface CaptureResult {
  dataUrl: string
  width: number
  height: number
  captureMethod: string
  perspectiveCorrected: boolean
  cornersDetected: boolean
  timestamp: number
  qualityMetrics: QualityMetrics | null
}

interface QualityMetrics {
  blurScore: number
  blurLabel: string
  brightnessScore: number
  brightnessLabel: string
  overallScore: number
  confidenceLetter: string
}

type TabId = 'realtime' | 'smart' | 'current'

// ============================================================================
// QUALITY ANALYSIS (reuse logic from existing imageQuality.ts)
// ============================================================================

function analyzeQuality(canvas: HTMLCanvasElement): QualityMetrics {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blurScore: 0, blurLabel: 'Error', brightnessScore: 0, brightnessLabel: 'Error', overallScore: 0, confidenceLetter: 'D' }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData

  // Blur detection via Laplacian variance
  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  let sum = 0, count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const lap = -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1]
        - gray[idx - 1] + 8 * gray[idx] - gray[idx + 1]
        - gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1]
      sum += lap * lap
      count++
    }
  }
  const variance = sum / count
  const blurScore = variance >= 400 ? 100 : variance >= 150 ? 85 : variance >= 50 ? 70 : Math.max(40, (variance / 50) * 60)
  const blurLabel = variance >= 400 ? 'Excellent' : variance >= 150 ? 'Good' : variance >= 50 ? 'Acceptable' : 'Poor'

  // Brightness detection
  let totalBrightness = 0
  for (let i = 0; i < gray.length; i++) totalBrightness += gray[i]
  const avgBrightness = totalBrightness / gray.length
  const brightnessScore = avgBrightness >= 90 && avgBrightness <= 170 ? 100
    : avgBrightness >= 70 && avgBrightness <= 190 ? 85
    : avgBrightness >= 50 && avgBrightness <= 220 ? 70 : 50
  const brightnessLabel = brightnessScore >= 95 ? 'Excellent' : brightnessScore >= 80 ? 'Good' : brightnessScore >= 65 ? 'Acceptable' : 'Poor'

  const overallScore = Math.round(blurScore * 0.6 + brightnessScore * 0.4)
  const confidenceLetter = overallScore >= 95 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 60 ? 'C' : 'D'

  return { blurScore: Math.round(blurScore), blurLabel, brightnessScore: Math.round(brightnessScore), brightnessLabel, overallScore, confidenceLetter }
}

// ============================================================================
// SHARED CAMERA HOOK
// ============================================================================

function useLabCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isIOS ? 'environment' : { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsActive(true)
    } catch (err: any) {
      setError(err.message || 'Camera access denied')
    }
  }, [])

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsActive(false)
  }, [])

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    return canvas
  }, [])

  useEffect(() => () => { stop() }, [stop])

  return { videoRef, isActive, error, start, stop, captureFrame }
}

// ============================================================================
// TAB 1: REAL-TIME SCANNER (Scanic)
// ============================================================================

function RealtimeScanner({ onCapture }: { onCapture: (result: CaptureResult) => void }) {
  const { videoRef, isActive, error, start, stop, captureFrame } = useLabCamera()
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const scannerRef = useRef<any>(null)
  const animFrameRef = useRef<number>(0)
  const [status, setStatus] = useState<string>('Idle')
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<CaptureResult | null>(null)
  const stableCountRef = useRef(0)
  const lastCornersRef = useRef<any>(null)
  const smoothedCornersRef = useRef<{ x: number; y: number }[] | null>(null)
  const frameCountRef = useRef(0)
  const validDetectionCountRef = useRef(0)

  const [scannerReady, setScannerReady] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)

  // Initialize Scanic (loaded via script tag to avoid WASM/webpack issues)
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        setStatus('Loading scanner engine...')
        await loadScanicScript()
        if (!window.scanic) throw new Error('Scanic not available on window after script load')
        const scanner = new window.scanic.Scanner({
          mode: 'detect',
          maxProcessingDimension: 480,
          lowThreshold: 10,
          highThreshold: 40,
          minArea: 0.08,
          epsilon: 0.04,
        })
        await scanner.initialize()
        if (mounted) {
          scannerRef.current = scanner
          setScannerReady(true)
          setStatus('Scanner ready - start camera')
        }
      } catch (err: any) {
        console.error('Scanic init error:', err)
        if (mounted) {
          setScannerError(err.message || 'Failed to load scanner')
          setStatus('Scanner failed to load')
        }
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  // Detection loop — runs every 5th frame with diagnostics
  useEffect(() => {
    if (!isActive || !scannerRef.current || preview) return

    setStatus('Detection active...')
    let running = true
    let detectCount = 0
    let successCount = 0
    let validCount = 0

    const detect = async () => {
      if (!running) return
      const video = videoRef.current
      const overlay = overlayCanvasRef.current
      if (!video || !overlay || !video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      frameCountRef.current++

      const rect = video.getBoundingClientRect()
      if (overlay.width !== Math.round(rect.width)) overlay.width = Math.round(rect.width)
      if (overlay.height !== Math.round(rect.height)) overlay.height = Math.round(rect.height)
      const octx = overlay.getContext('2d')!
      octx.clearRect(0, 0, overlay.width, overlay.height)

      // Run detection every 5th frame
      if (frameCountRef.current % 5 === 0) {
        detectCount++
        try {
          const smallCanvas = document.createElement('canvas')
          const scale = 400 / video.videoWidth
          smallCanvas.width = 400
          smallCanvas.height = Math.round(video.videoHeight * scale)
          const sctx = smallCanvas.getContext('2d')!
          sctx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height)

          const result = await scannerRef.current.scan(smallCanvas, { mode: 'detect' })

          if (result.success && result.corners) {
            successCount++
            const corners = result.corners
            const sx = overlay.width / smallCanvas.width
            const sy = overlay.height / smallCanvas.height
            const rawPts = [
              { x: corners.topLeft.x * sx, y: corners.topLeft.y * sy },
              { x: corners.topRight.x * sx, y: corners.topRight.y * sy },
              { x: corners.bottomRight.x * sx, y: corners.bottomRight.y * sy },
              { x: corners.bottomLeft.x * sx, y: corners.bottomLeft.y * sy },
            ]

            // Always draw what was found (green if valid, orange if not)
            // Smooth corners
            if (smoothedCornersRef.current) {
              smoothedCornersRef.current = smoothedCornersRef.current.map((prev, i) => ({
                x: prev.x * 0.6 + rawPts[i].x * 0.4,
                y: prev.y * 0.6 + rawPts[i].y * 0.4,
              }))
            } else {
              smoothedCornersRef.current = rawPts.map(p => ({ ...p }))
            }

            // Stability check
            if (lastCornersRef.current) {
              const last = lastCornersRef.current
              const moved = smoothedCornersRef.current.reduce((sum, p, i) =>
                sum + Math.abs(p.x - last[i].x) + Math.abs(p.y - last[i].y), 0)
              if (moved < 50) {
                stableCountRef.current++
              } else {
                stableCountRef.current = Math.max(0, stableCountRef.current - 1)
              }
            } else {
              stableCountRef.current = 1
            }
            lastCornersRef.current = smoothedCornersRef.current.map(p => ({ ...p }))
            validCount++

            // Auto-capture after 5 stable detections
            if (stableCountRef.current >= 5 && !isProcessing) {
              setStatus('Auto-capturing...')
              handleCapture()
              stableCountRef.current = 0
              smoothedCornersRef.current = null
              lastCornersRef.current = null
            } else if (stableCountRef.current >= 2) {
              setStatus(`Card locked (${stableCountRef.current}/5) | ${successCount}/${detectCount} detections`)
            } else {
              setStatus(`Card found - hold still | ${successCount}/${detectCount} detections`)
            }
          } else {
            // No corners found
            stableCountRef.current = Math.max(0, stableCountRef.current - 1)
            if (stableCountRef.current === 0) {
              smoothedCornersRef.current = null
              lastCornersRef.current = null
            }
            setStatus(`No card detected | ${successCount}/${detectCount} scans found corners`)
          }
        } catch (err: any) {
          setStatus(`Detection error: ${err.message?.slice(0, 40) || 'unknown'}`)
        }
      }

      // Draw smoothed outline (persists between detection frames)
      if (smoothedCornersRef.current) {
        const pts = smoothedCornersRef.current
        const color = stableCountRef.current >= 4 ? '#22c55e' : stableCountRef.current >= 2 ? '#eab308' : '#f97316'
        octx.beginPath()
        octx.moveTo(pts[0].x, pts[0].y)
        pts.forEach(p => octx.lineTo(p.x, p.y))
        octx.closePath()
        octx.strokeStyle = color
        octx.lineWidth = 3
        octx.stroke()
        pts.forEach(p => {
          octx.beginPath()
          octx.arc(p.x, p.y, 6, 0, Math.PI * 2)
          octx.fillStyle = color
          octx.fill()
        })
        // Debug: show stability count
        octx.fillStyle = 'rgba(255,255,255,0.9)'
        octx.font = 'bold 12px monospace'
        octx.fillText(`Stable: ${stableCountRef.current}/5`, 8, 16)
      }

      if (running) animFrameRef.current = requestAnimationFrame(detect)
    }

    animFrameRef.current = requestAnimationFrame(detect)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [isActive, preview])

  const handleCapture = async () => {
    setIsProcessing(true)
    try {
      const frame = captureFrame()
      if (!frame) return

      let resultCanvas = frame
      let corrected = false
      let cornersFound = false

      if (scannerRef.current) {
        try {
          const scanResult = await scannerRef.current.scan(frame, { mode: 'extract', output: 'canvas' })
          if (scanResult.success && scanResult.output instanceof HTMLCanvasElement) {
            resultCanvas = scanResult.output
            corrected = true
            cornersFound = true
          }
        } catch { /* fall back to raw frame */ }
      }

      const quality = analyzeQuality(resultCanvas)
      const dataUrl = resultCanvas.toDataURL('image/jpeg', 0.92)

      const result: CaptureResult = {
        dataUrl,
        width: resultCanvas.width,
        height: resultCanvas.height,
        captureMethod: 'Real-Time Scanner (Scanic)',
        perspectiveCorrected: corrected,
        cornersDetected: cornersFound,
        timestamp: Date.now(),
        qualityMetrics: quality,
      }
      setPreview(result)
      onCapture(result)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetake = () => {
    setPreview(null)
    stableCountRef.current = 0
    lastCornersRef.current = null
    setStatus('Scanning for card...')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Real-Time Scanner</h3>
          <p className="text-xs text-gray-500">Scanic edge detection + auto-capture + perspective correction</p>
        </div>
        {!isActive ? (
          <button onClick={() => { setPreview(null); start() }} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            Start Camera
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
            Stop Camera
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      {scannerError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">Scanner: {scannerError}</p>}
      {!scannerReady && !scannerError && <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">Loading scanner engine...</p>}

      {/* Preview mode — shows captured image */}
      {preview ? (
        <div className="space-y-3">
          <div className="bg-gray-100 rounded-lg p-3">
            <img src={preview.dataUrl} alt="Captured card" className="w-full rounded border border-gray-200" />
          </div>
          <InlineQuality result={preview} />
          <div className="flex gap-2">
            <button onClick={handleRetake} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300 font-medium">
              Retake
            </button>
          </div>
        </div>
      ) : (
        /* Camera mode */
        <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-contain" playsInline muted autoPlay />
          <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-green-400 font-mono">{status}</span>
              <button
                onClick={() => handleCapture()}
                disabled={isProcessing}
                className="px-4 py-2 bg-white text-gray-900 text-sm rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Capture'}
              </button>
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Tap &quot;Start Camera&quot; above
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TAB 2: SMART CAPTURE (Guide + Stability + Post-Capture Correction)
// ============================================================================

function SmartCapture({ onCapture }: { onCapture: (result: CaptureResult) => void }) {
  const { videoRef, isActive, error, start, stop, captureFrame } = useLabCamera()
  const [status, setStatus] = useState<string>('Idle')
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<CaptureResult | null>(null)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const prevFrameRef = useRef<ImageData | null>(null)
  const stableCountRef = useRef(0)
  const animFrameRef = useRef<number>(0)

  // Stability detection loop (frame differencing)
  useEffect(() => {
    if (!isActive || preview) return

    let running = true
    const checkStability = () => {
      if (!running) return
      const video = videoRef.current
      if (!video || !video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(checkStability)
        return
      }

      const w = 160, h = 120
      const smallCanvas = document.createElement('canvas')
      smallCanvas.width = w
      smallCanvas.height = h
      const ctx = smallCanvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, w, h)
      const currentFrame = ctx.getImageData(0, 0, w, h)

      if (prevFrameRef.current) {
        const prev = prevFrameRef.current.data
        const curr = currentFrame.data
        let diff = 0
        for (let i = 0; i < curr.length; i += 16) {
          diff += Math.abs(curr[i] - prev[i]) + Math.abs(curr[i + 1] - prev[i + 1]) + Math.abs(curr[i + 2] - prev[i + 2])
        }
        const avgDiff = diff / (curr.length / 16)

        if (avgDiff < 3) {
          stableCountRef.current++
          if (stableCountRef.current >= 15 && !isProcessing) {
            setStatus('Stable! Auto-capturing...')
            handleCapture()
            stableCountRef.current = 0
          } else if (stableCountRef.current >= 5) {
            setStatus(`Hold still... (${Math.min(stableCountRef.current, 15)}/15)`)
          }
        } else {
          stableCountRef.current = Math.max(0, stableCountRef.current - 2)
          setStatus('Position card in guide frame')
        }
      }
      prevFrameRef.current = currentFrame

      if (running) animFrameRef.current = requestAnimationFrame(checkStability)
    }

    animFrameRef.current = requestAnimationFrame(checkStability)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [isActive, preview])

  const handleCapture = async () => {
    setIsProcessing(true)
    try {
      const frame = captureFrame()
      if (!frame) return

      const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
      const frameAspect = frame.width / frame.height
      let cropW: number, cropH: number, cropX: number, cropY: number

      // Use loose crop (95%) since post-capture correction will tighten if edges are found
      if (frameAspect > cardAspect) {
        cropH = frame.height * 0.95
        cropW = cropH * cardAspect
      } else {
        cropW = frame.width * 0.95
        cropH = cropW / cardAspect
      }
      cropX = (frame.width - cropW) / 2
      cropY = (frame.height - cropH) / 2

      const croppedCanvas = document.createElement('canvas')
      croppedCanvas.width = Math.round(cropW)
      croppedCanvas.height = Math.round(cropH)
      const cctx = croppedCanvas.getContext('2d')!
      cctx.drawImage(frame, cropX, cropY, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height)

      let resultCanvas = croppedCanvas
      let corrected = false
      let cornersFound = false

      try {
        await loadScanicScript()
        if (window.scanic) {
          const scanner = new window.scanic.Scanner({
            maxProcessingDimension: 800,
            lowThreshold: 15,
            highThreshold: 50,
            minArea: 0.30,
            epsilon: 0.03,
          })
          await scanner.initialize()
          // First detect to validate corners, then extract if valid
          const detectResult = await scanner.scan(croppedCanvas, { mode: 'detect' })
          if (detectResult.success && detectResult.corners) {
            const c = detectResult.corners
            // Validate detected area covers enough of the cropped image (skip inner borders)
            const w = croppedCanvas.width, h = croppedCanvas.height
            const detW = Math.max(
              Math.hypot(c.topRight.x - c.topLeft.x, c.topRight.y - c.topLeft.y),
              Math.hypot(c.bottomRight.x - c.bottomLeft.x, c.bottomRight.y - c.bottomLeft.y)
            )
            const detH = Math.max(
              Math.hypot(c.bottomLeft.x - c.topLeft.x, c.bottomLeft.y - c.topLeft.y),
              Math.hypot(c.bottomRight.x - c.topRight.x, c.bottomRight.y - c.topRight.y)
            )
            const coverageRatio = (detW * detH) / (w * h)
            if (coverageRatio >= 0.5) {
              const extractResult = await scanner.scan(croppedCanvas, { mode: 'extract', output: 'canvas' })
              if (extractResult.success && extractResult.output instanceof HTMLCanvasElement) {
                resultCanvas = extractResult.output
                corrected = true
                cornersFound = true
              }
            }
          }
        }
      } catch { /* Fall back to guide-cropped image */ }

      const quality = analyzeQuality(resultCanvas)
      const dataUrl = resultCanvas.toDataURL('image/jpeg', 0.92)

      const result: CaptureResult = {
        dataUrl,
        width: resultCanvas.width,
        height: resultCanvas.height,
        captureMethod: 'Smart Capture (Guide + Stability + Post-Correction)',
        perspectiveCorrected: corrected,
        cornersDetected: cornersFound,
        timestamp: Date.now(),
        qualityMetrics: quality,
      }
      setPreview(result)
      onCapture(result)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetake = () => {
    setPreview(null)
    stableCountRef.current = 0
    prevFrameRef.current = null
    setStatus('Position card in guide frame')
  }

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Smart Capture</h3>
          <p className="text-xs text-gray-500">Guide overlay + stability auto-capture + post-capture correction</p>
        </div>
        {!isActive ? (
          <button onClick={() => { setPreview(null); start() }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Start Camera
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
            Stop Camera
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      {preview ? (
        <div className="space-y-3">
          <div className="bg-gray-100 rounded-lg p-3">
            <img src={preview.dataUrl} alt="Captured card" className="w-full rounded border border-gray-200" />
          </div>
          <InlineQuality result={preview} />
          <div className="flex gap-2">
            <button onClick={handleRetake} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300 font-medium">
              Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-contain" playsInline muted autoPlay />

          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/70 rounded relative" style={{ width: orientation === 'portrait' ? '60%' : '75%', aspectRatio: cardAspect }}>
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white" />
              </div>
            </div>
          )}

          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-blue-400 font-mono">{status}</span>
              <div className="flex gap-2">
                <button onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')} className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">
                  {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
                </button>
                <button onClick={handleCapture} disabled={isProcessing} className="px-4 py-2 bg-white text-gray-900 text-sm rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50">
                  {isProcessing ? 'Processing...' : 'Capture'}
                </button>
              </div>
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Tap &quot;Start Camera&quot; above
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TAB 3: CURRENT SYSTEM (Baseline - mirrors existing MobileCamera)
// ============================================================================

function CurrentSystemCapture({ onCapture }: { onCapture: (result: CaptureResult) => void }) {
  const { videoRef, isActive, error, start, stop, captureFrame } = useLabCamera()
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<CaptureResult | null>(null)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  const handleCapture = async () => {
    setIsProcessing(true)
    try {
      const frame = captureFrame()
      if (!frame) return

      const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
      const frameAspect = frame.width / frame.height
      let cropW: number, cropH: number, cropX: number, cropY: number

      if (frameAspect > cardAspect) {
        cropH = frame.height * 0.85
        cropW = cropH * cardAspect
      } else {
        cropW = frame.width * 0.85
        cropH = cropW / cardAspect
      }
      cropX = (frame.width - cropW) / 2
      cropY = (frame.height - cropH) / 2

      const croppedCanvas = document.createElement('canvas')
      croppedCanvas.width = Math.round(cropW)
      croppedCanvas.height = Math.round(cropH)
      const cctx = croppedCanvas.getContext('2d')!
      cctx.drawImage(frame, cropX, cropY, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height)

      const quality = analyzeQuality(croppedCanvas)
      const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.92)

      const result: CaptureResult = {
        dataUrl,
        width: croppedCanvas.width,
        height: croppedCanvas.height,
        captureMethod: 'Current System (Guide Crop)',
        perspectiveCorrected: false,
        cornersDetected: false,
        timestamp: Date.now(),
        qualityMetrics: quality,
      }
      setPreview(result)
      onCapture(result)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRetake = () => {
    setPreview(null)
  }

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Current System</h3>
          <p className="text-xs text-gray-500">Guide overlay + manual capture + guide-crop (production baseline)</p>
        </div>
        {!isActive ? (
          <button onClick={() => { setPreview(null); start() }} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
            Start Camera
          </button>
        ) : (
          <button onClick={stop} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
            Stop Camera
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      {preview ? (
        <div className="space-y-3">
          <div className="bg-gray-100 rounded-lg p-3">
            <img src={preview.dataUrl} alt="Captured card" className="w-full rounded border border-gray-200" />
          </div>
          <InlineQuality result={preview} />
          <div className="flex gap-2">
            <button onClick={handleRetake} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300 font-medium">
              Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] sm:aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-contain" playsInline muted autoPlay />

          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/70 rounded relative" style={{ width: orientation === 'portrait' ? '60%' : '75%', aspectRatio: cardAspect }}>
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/50 text-xs font-medium uppercase tracking-widest">FRONT</span>
                </div>
              </div>
            </div>
          )}

          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-purple-400 font-mono">Tap to capture</span>
              <div className="flex gap-2">
                <button onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')} className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">
                  {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
                </button>
                <button onClick={handleCapture} disabled={isProcessing} className="px-4 py-2 bg-white text-gray-900 text-sm rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50">
                  {isProcessing ? 'Processing...' : 'Capture'}
                </button>
              </div>
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Tap &quot;Start Camera&quot; above
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// INLINE QUALITY DISPLAY (shown within each tab after capture)
// ============================================================================

function InlineQuality({ result }: { result: CaptureResult }) {
  const q = result.qualityMetrics
  if (!q) return null
  const letterColor = q.confidenceLetter === 'A' ? 'bg-green-100 text-green-700 border-green-300'
    : q.confidenceLetter === 'B' ? 'bg-blue-100 text-blue-700 border-blue-300'
    : q.confidenceLetter === 'C' ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-red-100 text-red-700 border-red-300'

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">Image Quality</span>
        <span className={`px-2 py-0.5 rounded border font-bold ${letterColor}`}>
          {q.confidenceLetter} ({q.overallScore}/100)
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Sharpness</span>
          <span className="text-gray-900">{q.blurScore} ({q.blurLabel})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Brightness</span>
          <span className="text-gray-900">{q.brightnessScore} ({q.brightnessLabel})</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Size</span>
          <span className="font-mono text-gray-900">{result.width}x{result.height}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Corrected</span>
          <span className={result.perspectiveCorrected ? 'text-green-600 font-medium' : 'text-gray-400'}>
            {result.perspectiveCorrected ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// QUALITY METRICS CARD (comparison panel)
// ============================================================================

function QualityCard({ result }: { result: CaptureResult }) {
  const q = result.qualityMetrics
  const letterColor = q?.confidenceLetter === 'A' ? 'text-green-600 bg-green-50 border-green-200'
    : q?.confidenceLetter === 'B' ? 'text-blue-600 bg-blue-50 border-blue-200'
    : q?.confidenceLetter === 'C' ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200'

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <p className="text-xs font-medium text-gray-700 truncate">{result.captureMethod}</p>
      </div>
      <div className="p-3">
        <img src={result.dataUrl} alt="Capture" className="w-full rounded border border-gray-100 mb-3" />
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Dimensions</span>
            <span className="font-mono text-gray-900">{result.width} x {result.height}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Perspective Corrected</span>
            <span className={result.perspectiveCorrected ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {result.perspectiveCorrected ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Corners Detected</span>
            <span className={result.cornersDetected ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {result.cornersDetected ? 'Yes' : 'No'}
            </span>
          </div>
          {q && (
            <>
              <div className="border-t border-gray-100 pt-2 mt-2" />
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Confidence</span>
                <span className={`px-2 py-0.5 rounded border text-xs font-bold ${letterColor}`}>
                  {q.confidenceLetter} ({q.overallScore}/100)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sharpness</span>
                <span className="text-gray-900">{q.blurScore}/100 ({q.blurLabel})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Brightness</span>
                <span className="text-gray-900">{q.brightnessScore}/100 ({q.brightnessLabel})</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ScannerLabPage() {
  const [activeTab, setActiveTab] = useState<TabId>('realtime')
  const [captures, setCaptures] = useState<Record<TabId, CaptureResult | null>>({
    realtime: null,
    smart: null,
    current: null,
  })

  const handleCapture = (tab: TabId) => (result: CaptureResult) => {
    setCaptures(prev => ({ ...prev, [tab]: result }))
  }

  const clearAll = () => {
    setCaptures({ realtime: null, smart: null, current: null })
  }

  const tabs: { id: TabId; label: string; color: string }[] = [
    { id: 'realtime', label: 'Real-Time Scanner', color: 'green' },
    { id: 'smart', label: 'Smart Capture', color: 'blue' },
    { id: 'current', label: 'Current System', color: 'purple' },
  ]

  const captureCount = Object.values(captures).filter(Boolean).length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scanner Lab</h1>
            <p className="text-sm text-gray-500 mt-1">
              Test and compare three card capture approaches side by side. Admin-only testing environment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
              Testing Only
            </span>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? tab.color === 'green' ? 'bg-green-600 text-white'
                    : tab.color === 'blue' ? 'bg-blue-600 text-white'
                    : 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {captures[tab.id] && (
                <span className="ml-1 inline-flex w-2 h-2 rounded-full bg-white/80" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {activeTab === 'realtime' && <RealtimeScanner onCapture={handleCapture('realtime')} />}
        {activeTab === 'smart' && <SmartCapture onCapture={handleCapture('smart')} />}
        {activeTab === 'current' && <CurrentSystemCapture onCapture={handleCapture('current')} />}
      </div>

      {/* Comparison Panel */}
      {captureCount > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Capture Comparison ({captureCount}/3)
            </h2>
            <button
              onClick={clearAll}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {captures.realtime && <QualityCard result={captures.realtime} />}
            {captures.smart && <QualityCard result={captures.smart} />}
            {captures.current && <QualityCard result={captures.current} />}
          </div>

          {/* Side-by-Side Comparison Summary */}
          {captureCount >= 2 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 text-gray-500 font-medium">Metric</th>
                      {captures.realtime && <th className="text-center py-2 px-2 text-green-700 font-medium">Real-Time</th>}
                      {captures.smart && <th className="text-center py-2 px-2 text-blue-700 font-medium">Smart</th>}
                      {captures.current && <th className="text-center py-2 px-2 text-purple-700 font-medium">Current</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Confidence</td>
                      {captures.realtime && <td className="text-center py-2 px-2 font-bold">{captures.realtime.qualityMetrics?.confidenceLetter} ({captures.realtime.qualityMetrics?.overallScore})</td>}
                      {captures.smart && <td className="text-center py-2 px-2 font-bold">{captures.smart.qualityMetrics?.confidenceLetter} ({captures.smart.qualityMetrics?.overallScore})</td>}
                      {captures.current && <td className="text-center py-2 px-2 font-bold">{captures.current.qualityMetrics?.confidenceLetter} ({captures.current.qualityMetrics?.overallScore})</td>}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Sharpness</td>
                      {captures.realtime && <td className="text-center py-2 px-2">{captures.realtime.qualityMetrics?.blurScore}</td>}
                      {captures.smart && <td className="text-center py-2 px-2">{captures.smart.qualityMetrics?.blurScore}</td>}
                      {captures.current && <td className="text-center py-2 px-2">{captures.current.qualityMetrics?.blurScore}</td>}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Brightness</td>
                      {captures.realtime && <td className="text-center py-2 px-2">{captures.realtime.qualityMetrics?.brightnessScore}</td>}
                      {captures.smart && <td className="text-center py-2 px-2">{captures.smart.qualityMetrics?.brightnessScore}</td>}
                      {captures.current && <td className="text-center py-2 px-2">{captures.current.qualityMetrics?.brightnessScore}</td>}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Resolution</td>
                      {captures.realtime && <td className="text-center py-2 px-2 font-mono">{captures.realtime.width}x{captures.realtime.height}</td>}
                      {captures.smart && <td className="text-center py-2 px-2 font-mono">{captures.smart.width}x{captures.smart.height}</td>}
                      {captures.current && <td className="text-center py-2 px-2 font-mono">{captures.current.width}x{captures.current.height}</td>}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Perspective Corrected</td>
                      {captures.realtime && <td className="text-center py-2 px-2">{captures.realtime.perspectiveCorrected ? 'Yes' : 'No'}</td>}
                      {captures.smart && <td className="text-center py-2 px-2">{captures.smart.perspectiveCorrected ? 'Yes' : 'No'}</td>}
                      {captures.current && <td className="text-center py-2 px-2">{captures.current.perspectiveCorrected ? 'Yes' : 'No'}</td>}
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-gray-600">Corners Detected</td>
                      {captures.realtime && <td className="text-center py-2 px-2">{captures.realtime.cornersDetected ? 'Yes' : 'No'}</td>}
                      {captures.smart && <td className="text-center py-2 px-2">{captures.smart.cornersDetected ? 'Yes' : 'No'}</td>}
                      {captures.current && <td className="text-center py-2 px-2">{captures.current.cornersDetected ? 'Yes' : 'No'}</td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-6">
        <h3 className="font-semibold text-amber-900 mb-2">How to Test</h3>
        <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
          <li>Select a tab and start the camera</li>
          <li>Place a trading card on a flat surface with good lighting</li>
          <li>Each tab captures differently:
            <ul className="ml-6 mt-1 space-y-1 list-disc">
              <li><strong>Real-Time Scanner</strong> — auto-captures when card edges are detected and stable</li>
              <li><strong>Smart Capture</strong> — auto-captures when phone is stable, then applies post-capture correction</li>
              <li><strong>Current System</strong> — manual tap capture with guide-crop (production baseline)</li>
            </ul>
          </li>
          <li>After capturing with multiple tabs, compare results in the panel below</li>
          <li>Try the same card in all three tabs for an apples-to-apples comparison</li>
        </ol>
      </div>
    </div>
  )
}
