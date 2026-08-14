/**
 * "Why buy graded" trust slide for eBay photo sets (customer-requested).
 *
 * A square branded panel appended to the listing photos: brand mark, grade,
 * serial, verification QR, and sub-grades. Org cards render with the store's
 * logo + brand color; consumer cards render the DCM version. The QR encodes
 * the card's registry page (org storefront page for org cards) — QR in a
 * product photo set is standard practice for graded cards; no text URLs are
 * drawn (eBay links policy).
 */
import QRCode from 'qrcode'

export interface TrustSlideData {
  brandName: string
  brandColor?: string | null
  /** Data-URL logo (org color logo, or the DCM mark). */
  logoDataUrl?: string
  grade: number
  conditionLabel: string
  serial: string
  qrUrl: string
  subgrades: { centering: number; corners: number; edges: number; surface: number }
}

const SIZE = 1200

function darken(hex: string, pct: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const f = (v: number) => Math.max(0, Math.round(v * (1 - pct)))
  return '#' + ((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

export async function generateTrustSlide(data: TrustSlideData): Promise<Blob> {
  const accent = data.brandColor && /^#[0-9a-f]{6}$/i.test(data.brandColor) ? data.brandColor : '#7C3AED'
  const accentDark = darken(accent, 0.4)

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Header band
  const headerH = 260
  const grad = ctx.createLinearGradient(0, 0, SIZE, headerH)
  grad.addColorStop(0, accent)
  grad.addColorStop(1, accentDark)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, headerH)

  // Logo (centered in header) or brand name text
  let headerTextY = headerH - 54
  if (data.logoDataUrl) {
    try {
      const logo = await loadImage(data.logoDataUrl)
      const maxH = 130
      const scale = Math.min(maxH / logo.height, 420 / logo.width)
      const w = logo.width * scale
      const h = logo.height * scale
      // White chip behind the mark so dark logos survive the brand band
      const chipPad = 18
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      const chipW = w + chipPad * 2
      const chipH = h + chipPad * 2
      const chipX = (SIZE - chipW) / 2
      const chipY = 36
      ctx.beginPath()
      ctx.moveTo(chipX + 20, chipY)
      ctx.arcTo(chipX + chipW, chipY, chipX + chipW, chipY + chipH, 20)
      ctx.arcTo(chipX + chipW, chipY + chipH, chipX, chipY + chipH, 20)
      ctx.arcTo(chipX, chipY + chipH, chipX, chipY, 20)
      ctx.arcTo(chipX, chipY, chipX + chipW, chipY, 20)
      ctx.fill()
      ctx.drawImage(logo, (SIZE - w) / 2, chipY + chipPad, w, h)
    } catch { /* fall through to text */ }
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.font = 'bold 40px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(`${data.brandName.toUpperCase()} GRADED`, SIZE / 2, headerTextY)

  // Grade block
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 300px "Helvetica Neue", Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(Math.round(data.grade)), SIZE / 2, 620)
  ctx.font = 'bold 64px "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = accent
  ctx.fillText(data.conditionLabel.toUpperCase(), SIZE / 2, 700)
  ctx.font = '36px "Helvetica Neue", Arial, sans-serif'
  ctx.fillStyle = '#6B7280'
  ctx.fillText(`Serial ${data.serial}`, SIZE / 2, 756)

  // Sub-grades row
  const subs: [string, number][] = [
    ['CENTERING', data.subgrades.centering],
    ['CORNERS', data.subgrades.corners],
    ['EDGES', data.subgrades.edges],
    ['SURFACE', data.subgrades.surface],
  ]
  const rowY = 830
  const cellW = 240
  const startX = (SIZE - cellW * 4) / 2
  subs.forEach(([label, value], i) => {
    const cx = startX + cellW * i + cellW / 2
    ctx.fillStyle = '#F3F4F6'
    ctx.beginPath()
    ctx.arc(cx, rowY + 40, 56, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 52px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(String(Math.round(value)), cx, rowY + 58)
    ctx.fillStyle = '#6B7280'
    ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(label, cx, rowY + 132)
  })

  // Verification QR + caption
  try {
    const qrDataUrl = await QRCode.toDataURL(data.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: { dark: '#111827', light: '#ffffff' },
    })
    const qr = await loadImage(qrDataUrl)
    ctx.drawImage(qr, SIZE / 2 - 80, 1000, 160, 160)
  } catch { /* slide still useful without the QR */ }
  ctx.fillStyle = '#6B7280'
  ctx.font = '28px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText('Scan to view the full grading report', SIZE / 2, 990)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Failed to render trust slide'))), 'image/jpeg', 0.92)
  })
}
