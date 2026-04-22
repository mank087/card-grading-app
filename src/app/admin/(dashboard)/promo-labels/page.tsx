'use client'

import { useState } from 'react'

/**
 * Promo Label Generator — Admin-only tool
 *
 * Generates fold-over toploader promo labels using Avery 8167 template.
 * Single-page, single-label design that folds over the toploader top edge.
 *
 * Layout (flat, before folding):
 * ┌─────────────────┬─────────────────┐
 * │  DCM LOGO       │     [QR]        │  ← 1.75" × 0.5"
 * │  COLLAGE        │   why-dcm       │
 * │  (rotated       │   (rotated      │
 * │   90° CCW)      │    90° CW)      │
 * └─────────────────┴─────────────────┘
 *                   ↑ fold line
 *
 * When folded over toploader top:
 * - Front shows DCM logo collage upright (3 rows of logos)
 * - Back shows QR code upright linking to dcmgrading.com/why-dcm
 */

const INCH = 72
const LABEL_WIDTH = 1.75 * INCH   // 126pt
const LABEL_HEIGHT = 0.5 * INCH   // 36pt
const CORNER_RADIUS = 3
const TOP_MARGIN = 0.5 * INCH
const LEFT_MARGIN = 0.28125 * INCH
const HORIZONTAL_GAP = 0.3125 * INCH
const COLUMNS = 4
const ROWS = 20

const COLORS = {
  purplePrimary: '#7c3aed',
  purpleDark: '#6d28d9',
  purpleLight: '#a78bfa',
  white: '#ffffff',
}

const QR_URL = 'https://dcmgrading.com/why-dcm'

function getLabelPosition(row: number, col: number): { x: number; y: number } {
  return {
    x: LEFT_MARGIN + col * (LABEL_WIDTH + HORIZONTAL_GAP),
    y: TOP_MARGIN + row * (LABEL_HEIGHT),
  }
}

async function loadLogoBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')) }
      else reject(new Error('No canvas context'))
    }
    img.onerror = () => reject(new Error('Failed to load logo'))
    img.src = '/DCM-logo.png'
  })
}

function loadImageAsync(base64: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = base64
  })
}

async function generateQRBase64(url: string, size: number = 200): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  })
}

async function drawPromoFoldOverLabel(
  doc: any,
  x: number,
  y: number,
  logoCollageRotated: string,
  qrRotated: string
): Promise<void> {
  const labelW = LABEL_WIDTH   // 126pt
  const labelH = LABEL_HEIGHT  // 36pt
  const halfW = labelW / 2     // 63pt

  // White background
  doc.setFillColor(COLORS.white)
  doc.roundedRect(x, y, labelW, labelH, CORNER_RADIUS, CORNER_RADIUS, 'F')

  // LEFT HALF: DCM logo collage (rotated 90° CCW)
  doc.addImage(logoCollageRotated, 'PNG', x + 0.5, y + 0.5, halfW - 1, labelH - 1)

  // CENTER: Purple fold line
  doc.setDrawColor(COLORS.purplePrimary)
  doc.setLineWidth(1.5)
  doc.setLineDashPattern([], 0)
  doc.line(x + halfW, y, x + halfW, y + labelH)

  // RIGHT HALF: QR code (rotated 90° CW)
  const pad = 3
  const qrSize = labelH - 2 * pad
  const qrX = x + halfW + (halfW - qrSize) / 2
  const qrY = y + pad
  doc.addImage(qrRotated, 'PNG', qrX, qrY, qrSize, qrSize)
}

/**
 * Pre-render the DCM logo collage as a rotated image.
 * Creates a 3-row grid of DCM logos in upright orientation,
 * then rotates the entire canvas 90° CCW for the label.
 */
async function createLogoCollageRotated(logoBase64: string): Promise<string> {
  const logoImg = await loadImageAsync(logoBase64)
  if (!logoImg) throw new Error('Logo load failed')

  // Upright canvas (as it appears on the toploader front after folding)
  // Width = labelH (narrow toploader edge), Height = halfW (how far label extends)
  const scale = 8
  const uprightW = Math.round(LABEL_HEIGHT * scale)  // 36 * 8 = 288px
  const uprightH = Math.round((LABEL_WIDTH / 2) * scale)  // 63 * 8 = 504px

  const tc = document.createElement('canvas')
  tc.width = uprightW
  tc.height = uprightH
  const ctx = tc.getContext('2d')!
  ctx.fillStyle = COLORS.white
  ctx.fillRect(0, 0, uprightW, uprightH)

  // Draw DCM logos in a 3-column grid, filling the canvas
  const logoSize = Math.floor(uprightW / 3.5)
  const cols = 3
  const totalLogoW = cols * logoSize
  const gapX = (uprightW - totalLogoW) / (cols + 1)
  const rowHeight = logoSize + gapX
  const rows = Math.floor((uprightH - gapX) / rowHeight)
  const totalLogoH = rows * rowHeight
  const startY = (uprightH - totalLogoH) / 2 + gapX / 2

  // Draw DCM logos rotated 180° in a 3-column grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = gapX + c * (logoSize + gapX)
      const ly = startY + r * rowHeight
      ctx.save()
      ctx.translate(lx + logoSize / 2, ly + logoSize / 2)
      ctx.rotate(Math.PI) // 180°
      ctx.drawImage(logoImg, -logoSize / 2, -logoSize / 2, logoSize, logoSize)
      ctx.restore()
    }
  }

  // Rotate 90° CCW for the label
  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = uprightH   // 504 → maps to halfW (63pt)
  rotCanvas.height = uprightW  // 288 → maps to labelH (36pt)
  const rctx = rotCanvas.getContext('2d')!
  rctx.translate(0, rotCanvas.height)
  rctx.rotate(-Math.PI / 2)  // 90° CCW
  rctx.drawImage(tc, 0, 0)

  return rotCanvas.toDataURL('image/png')
}

/**
 * Pre-render the QR code rotated 90° CW for the right half.
 */
async function createQRRotated(qrBase64: string): Promise<string> {
  const img = await loadImageAsync(qrBase64)
  if (!img) return qrBase64 // fallback unrotated

  const res = 300
  const canvas = document.createElement('canvas')
  canvas.width = res
  canvas.height = res
  const ctx = canvas.getContext('2d')!
  ctx.translate(res, 0)
  ctx.rotate(Math.PI / 2) // 90° CW
  ctx.drawImage(img, 0, 0, res, res)

  return canvas.toDataURL('image/png')
}

async function generatePromoSheet(): Promise<Blob> {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  })

  const logoBase64 = await loadLogoBase64()
  const qrBase64 = await generateQRBase64(QR_URL)

  // Pre-render rotated assets once (reused across all 80 labels)
  const logoCollageRotated = await createLogoCollageRotated(logoBase64)
  const qrRotated = await createQRRotated(qrBase64)

  // Draw 80 fold-over promo labels
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const pos = getLabelPosition(row, col)
      await drawPromoFoldOverLabel(doc, pos.x, pos.y, logoCollageRotated, qrRotated)
    }
  }

  return doc.output('blob')
}

async function generateSinglePreview(): Promise<string> {
  const { jsPDF } = await import('jspdf')

  // Single label preview — wider page to show the label clearly
  const margin = 15
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [LABEL_WIDTH + margin * 2, LABEL_HEIGHT + margin * 2],
  })

  const logoBase64 = await loadLogoBase64()
  const qrBase64 = await generateQRBase64(QR_URL)
  const logoCollageRotated = await createLogoCollageRotated(logoBase64)
  const qrRotated = await createQRRotated(qrBase64)

  await drawPromoFoldOverLabel(doc, margin, margin, logoCollageRotated, qrRotated)

  return doc.output('datauristring')
}

export default function PromoLabelsPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handlePreview = async () => {
    setIsGenerating(true)
    try {
      setPreviewUrl(await generateSinglePreview())
    } catch (err) {
      console.error('Preview failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const blob = await generatePromoSheet()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dcm-promo-labels-avery8167.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Promo Label Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fold-over toploader labels with DCM logo collage (front) and QR code to dcmgrading.com/why-dcm (back).
          Single-page Avery 8167 template — 80 labels per sheet.
        </p>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 mt-2">
          Admin Only
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Labels</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handlePreview} disabled={isGenerating}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm">
            {isGenerating ? 'Generating...' : 'Preview Single Label'}
          </button>
          <button onClick={handleDownload} disabled={isGenerating}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 text-sm">
            {isGenerating ? 'Generating...' : 'Download Full Sheet (80 labels)'}
          </button>
        </div>
      </div>

      {previewUrl && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Label Preview</h2>
          <p className="text-xs text-gray-500 mb-4">
            Left half: DCM logo collage (rotated 90 CCW — upright when folded onto toploader front).
            Right half: QR code (rotated 90 CW — upright when folded onto toploader back).
            Purple line = fold line.
          </p>
          <div className="bg-gray-100 rounded-lg p-4 flex justify-center">
            <iframe src={previewUrl} className="border border-gray-200 rounded" style={{ width: '400px', height: '140px' }} title="Promo label preview" />
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>How to use:</strong> Print the full sheet on Avery 8167 labels. Peel a label, align the fold line with the
              toploader&apos;s top edge, and fold over. The logo collage faces front, the QR code faces back. Scanning the QR takes
              users to dcmgrading.com/why-dcm.
            </p>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-2">Label Design</h3>
        <pre className="text-xs text-gray-600 font-mono bg-white rounded p-3 border border-gray-200">
{`┌─────────────────┬─────────────────┐
│  DCM  DCM  DCM  │                 │
│  DCM  DCM  DCM  │     [QR]        │  1.75" × 0.5"
│  DCM  DCM  DCM  │   why-dcm       │  Avery 8167
│  dcmgrading.com │                 │
└─────────────────┴─────────────────┘
  (90° CCW)        ↑ fold    (90° CW)
                   line`}
        </pre>
        <ul className="text-sm text-gray-600 space-y-1 mt-3">
          <li>80 labels per sheet, single page (no duplex needed)</li>
          <li>Left half: 3-column DCM logo grid + dcmgrading.com text</li>
          <li>Right half: QR code linking to dcmgrading.com/why-dcm</li>
          <li>Both halves rotated for correct orientation when folded over toploader</li>
        </ul>
      </div>
    </div>
  )
}
