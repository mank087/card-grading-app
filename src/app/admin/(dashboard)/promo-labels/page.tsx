'use client'

import { useState } from 'react'

/**
 * Promo Label Generator — Admin-only tool
 *
 * Generates fold-over toploader labels with DCM logo collage (front)
 * and QR code linking to dcmgrading.com/why-dcm (back/fold-over top).
 * Uses Avery 8167 template (1.75" x 0.5", 80 labels per sheet).
 */

// Avery 8167 specs (in points: 1 inch = 72 points)
const INCH = 72
const LABEL_WIDTH = 1.75 * INCH
const LABEL_HEIGHT = 0.5 * INCH
const CORNER_RADIUS = 3
const TOP_MARGIN = 0.5 * INCH
const LEFT_MARGIN = 0.28125 * INCH
const HORIZONTAL_GAP = 0.3125 * INCH
const VERTICAL_GAP = 0
const COLUMNS = 4
const ROWS = 20
const PAGE_WIDTH = 8.5 * INCH
const PAGE_HEIGHT = 11 * INCH

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
    y: TOP_MARGIN + row * (LABEL_HEIGHT + VERTICAL_GAP),
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
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } else {
        reject(new Error('Failed to get canvas context'))
      }
    }
    img.onerror = () => reject(new Error('Failed to load logo'))
    img.src = '/DCM-logo.png'
  })
}

async function generateQRBase64(url: string, size: number = 150): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })
}

function drawPromoFrontLabel(
  doc: any,
  x: number,
  y: number,
  logoBase64: string
): void {
  const labelW = LABEL_WIDTH
  const labelH = LABEL_HEIGHT

  // White background
  doc.setFillColor(COLORS.white)
  doc.roundedRect(x, y, labelW, labelH, CORNER_RADIUS, CORNER_RADIUS, 'F')

  // Purple accent line on left edge
  doc.setFillColor(COLORS.purplePrimary)
  doc.roundedRect(x, y, 3, labelH, CORNER_RADIUS, 0, 'F')

  // Purple accent line on right edge
  doc.setFillColor(COLORS.purplePrimary)
  doc.roundedRect(x + labelW - 3, y, 3, labelH, 0, CORNER_RADIUS, 'F')

  // DCM logo collage — fill the label with logos in a grid pattern
  if (logoBase64) {
    try {
      const logoSize = labelH * 0.55
      const spacing = logoSize + 3
      const startX = x + 8
      const startY = y + (labelH - logoSize) / 2

      // Calculate how many logos fit
      const availableWidth = labelW - 16
      const logosPerRow = Math.floor(availableWidth / spacing)

      // Center the row of logos
      const totalLogosWidth = logosPerRow * spacing - 3
      const offsetX = (availableWidth - totalLogosWidth) / 2

      for (let i = 0; i < logosPerRow; i++) {
        const lx = startX + offsetX + i * spacing
        doc.addImage(logoBase64, 'PNG', lx, startY, logoSize, logoSize)
      }
    } catch (e) {
      console.warn('Logo collage failed:', e)
    }
  }

  // "DCM" text centered at bottom
  doc.setFontSize(4)
  doc.setTextColor(COLORS.purpleLight)
  doc.setFont('helvetica', 'bold')
  doc.text('dcmgrading.com', x + labelW / 2, y + labelH - 2, { align: 'center' })
}

async function drawPromoBackLabel(
  doc: any,
  x: number,
  y: number,
  qrCodeBase64: string,
  logoBase64: string
): Promise<void> {
  const labelW = LABEL_WIDTH
  const labelH = LABEL_HEIGHT

  // White background
  doc.setFillColor(COLORS.white)
  doc.roundedRect(x, y, labelW, labelH, CORNER_RADIUS, CORNER_RADIUS, 'F')

  // QR code centered
  const qrSize = labelH * 0.85
  const qrX = x + (labelW - qrSize) / 2
  const qrY = y + (labelH - qrSize) / 2

  // Watermark pattern of DCM logos on both sides of QR
  if (logoBase64) {
    try {
      const { GState } = await import('jspdf')
      doc.saveGraphicsState()
      const gState = new GState({ opacity: 0.08 })
      doc.setGState(gState)

      const watermarkSize = 12
      const spacing = 16

      // Left side logos
      for (let wx = x + 2; wx < qrX - 2; wx += spacing) {
        for (let wy = y + 2; wy < y + labelH - watermarkSize; wy += spacing) {
          doc.addImage(logoBase64, 'PNG', wx, wy, watermarkSize, watermarkSize)
        }
      }

      // Right side logos
      for (let wx = qrX + qrSize + 2; wx < x + labelW - 2; wx += spacing) {
        for (let wy = y + 2; wy < y + labelH - watermarkSize; wy += spacing) {
          doc.addImage(logoBase64, 'PNG', wx, wy, watermarkSize, watermarkSize)
        }
      }

      doc.restoreGraphicsState()
    } catch (e) {
      console.warn('Watermark failed:', e)
    }
  }

  // QR code on top of watermark
  doc.addImage(qrCodeBase64, 'PNG', qrX, qrY, qrSize, qrSize)
}

async function generatePromoLabelPDF(labelsPerSheet: number = 80): Promise<Blob> {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  })

  const logoBase64 = await loadLogoBase64()
  const qrBase64 = await generateQRBase64(QR_URL)

  // Page 1: Front labels (DCM logo collage)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const idx = row * COLUMNS + col
      if (idx >= labelsPerSheet) break
      const pos = getLabelPosition(row, col)
      drawPromoFrontLabel(doc, pos.x, pos.y, logoBase64)
    }
  }

  // Page 2: Back labels (QR codes) — mirrored for duplex printing
  doc.addPage('letter', 'portrait')
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const idx = row * COLUMNS + col
      if (idx >= labelsPerSheet) break
      // Mirror columns for duplex: col 0↔3, col 1↔2
      const mirroredCol = COLUMNS - 1 - col
      const pos = getLabelPosition(row, mirroredCol)
      await drawPromoBackLabel(doc, pos.x, pos.y, qrBase64, logoBase64)
    }
  }

  return doc.output('blob')
}

async function generateSinglePromoLabel(): Promise<string> {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [LABEL_WIDTH * 2 + 20, LABEL_HEIGHT + 20],
  })

  const logoBase64 = await loadLogoBase64()
  const qrBase64 = await generateQRBase64(QR_URL)

  // Front label on left
  drawPromoFrontLabel(doc, 5, 10, logoBase64)

  // Fold line
  doc.setDrawColor('#cccccc')
  doc.setLineDashPattern([3, 2], 0)
  doc.line(LABEL_WIDTH + 10, 5, LABEL_WIDTH + 10, LABEL_HEIGHT + 15)
  doc.setLineDashPattern([], 0)

  // Back label on right
  await drawPromoBackLabel(doc, LABEL_WIDTH + 15, 10, qrBase64, logoBase64)

  return doc.output('datauristring')
}

export default function PromoLabelsPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handlePreview = async () => {
    setIsGenerating(true)
    try {
      const dataUri = await generateSinglePromoLabel()
      setPreviewUrl(dataUri)
    } catch (err) {
      console.error('Preview generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadSheet = async () => {
    setIsGenerating(true)
    try {
      const blob = await generatePromoLabelPDF(80)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dcm-promo-labels-avery8167.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Sheet generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Promo Label Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate fold-over toploader labels with DCM logo collage and QR code linking to dcmgrading.com/why-dcm.
          Avery 8167 template (1.75&quot; x 0.5&quot;, 80 labels per sheet).
        </p>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 mt-2">
          Admin Only
        </span>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Labels</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePreview}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm"
          >
            {isGenerating ? 'Generating...' : 'Preview Single Label'}
          </button>
          <button
            onClick={handleDownloadSheet}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 text-sm"
          >
            {isGenerating ? 'Generating...' : 'Download Full Sheet (80 labels)'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Label Preview</h2>
          <p className="text-xs text-gray-500 mb-4">
            Left: Front (logo collage, visible on toploader) | Right: Back (QR code, folds over top)
          </p>
          <div className="bg-gray-100 rounded-lg p-4">
            <iframe
              src={previewUrl}
              className="w-full border border-gray-200 rounded"
              style={{ height: '120px' }}
              title="Promo label preview"
            />
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>How to use:</strong> Print the full sheet on Avery 8167 label stock. The front (logo collage) faces outward
              on the toploader. The back (QR code) folds over the top edge. When scanned, the QR code takes users to dcmgrading.com/why-dcm.
            </p>
          </div>
        </div>
      )}

      {/* Specs */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-700 mb-2">Label Specifications</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>Template: Avery 8167 (1.75&quot; x 0.5&quot;)</li>
          <li>Layout: 4 columns x 20 rows = 80 labels per sheet</li>
          <li>Front: DCM logo collage with purple accent borders + dcmgrading.com text</li>
          <li>Back: QR code (dcmgrading.com/why-dcm) with DCM logo watermark</li>
          <li>Print: Duplex (two-sided) — page 1 fronts, page 2 backs (mirrored for alignment)</li>
        </ul>
      </div>
    </div>
  )
}
