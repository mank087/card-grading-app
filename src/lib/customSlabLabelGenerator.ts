/**
 * Custom Slab Label Generator
 *
 * Parameterized canvas renderer for the Label Studio custom designer.
 * Accepts arbitrary dimensions, colors, and style. Ported from slabLabelGenerator.ts
 * with all dimensions/colors as parameters.
 *
 * Provides:
 *  - renderCustomFrontPreview() — screen-DPI preview for the live canvas
 *  - renderCustomBackPreview()  — screen-DPI preview for the live canvas
 *  - generateCustomSlabLabel()  — 300 DPI PDF for print
 */

import { jsPDF } from 'jspdf';
import { extractAsciiSafe, extractAsciiSafePreserveBullets, containsCJK } from './labelDataGenerator';
import type { SlabLabelData } from './slabLabelGenerator';
import type { CustomLabelConfig } from './labelPresets';

// ============================================================================
// HELPERS
// ============================================================================

function formatGradeDisplay(grade: number | null, isAlteredAuthentic?: boolean): string {
  if (grade !== null) return Math.round(grade).toString();
  return isAlteredAuthentic ? 'A' : 'N/A';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontStyle: string = ''
): string[] {
  ctx.font = `${fontStyle} ${fontSize}px 'Helvetica Neue', Arial, sans-serif`.trim();
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/** Standard palette for traditional style */
const TRAD_COLORS = {
  purplePrimary: '#7c3aed',
  purpleDark: '#6b46c1',
  textDark: '#1f2937',
  textMedium: '#4b5563',
  featureBlue: '#2563eb',
  white: '#ffffff',
};

// ============================================================================
// FONT SIZING (proportional to canvas)
// ============================================================================

const FONT_RATIO = {
  name: 1.0,
  context: 0.76,
  features: 0.70,
  serial: 0.76,
};

const SPACING_RATIO = {
  afterName: 0.15,
  contextLineGap: 0.09,
  afterContext: 0.12,
  afterFeatures: 0.12,
};

interface FittedFontSizes {
  name: number;
  context: number;
  features: number;
  serial: number;
  afterName: number;
  contextLineGap: number;
  afterContext: number;
  afterFeatures: number;
}

function fitCardInfoFonts(
  ctx: CanvasRenderingContext2D,
  maxWidth: number,
  maxHeight: number,
  cardName: string,
  contextLine: string,
  featuresLine: string,
  serial: string,
  baseMaxName: number = 38,
  scale: number = 1
): { sizes: FittedFontSizes; ctxLines: string[] } {
  const MIN_NAME = Math.max(4, Math.round(14 * scale));

  for (let nameSize = baseMaxName; nameSize >= MIN_NAME; nameSize -= 1) {
    const sizes: FittedFontSizes = {
      name: nameSize,
      context: Math.round(nameSize * FONT_RATIO.context),
      features: Math.round(nameSize * FONT_RATIO.features),
      serial: Math.round(nameSize * FONT_RATIO.serial),
      afterName: Math.round(nameSize * SPACING_RATIO.afterName),
      contextLineGap: Math.round(nameSize * SPACING_RATIO.contextLineGap),
      afterContext: Math.round(nameSize * SPACING_RATIO.afterContext),
      afterFeatures: Math.round(nameSize * SPACING_RATIO.afterFeatures),
    };

    ctx.font = `bold ${sizes.name}px 'Helvetica Neue', Arial, sans-serif`;
    if (ctx.measureText(cardName).width > maxWidth) continue;

    const ctxLines = contextLine
      ? wrapText(ctx, contextLine, maxWidth, sizes.context).slice(0, 2)
      : [];

    if (featuresLine) {
      ctx.font = `bold ${sizes.features}px 'Helvetica Neue', Arial, sans-serif`;
      if (ctx.measureText(featuresLine).width > maxWidth) continue;
    }

    ctx.font = `${sizes.serial}px 'Courier New', monospace`;
    if (ctx.measureText(serial).width > maxWidth) continue;

    let blockH = sizes.name;
    if (ctxLines.length > 0) {
      blockH += sizes.afterName;
      blockH += ctxLines.length * sizes.context + (ctxLines.length - 1) * sizes.contextLineGap;
    }
    if (featuresLine) blockH += sizes.afterContext + sizes.features;
    blockH += sizes.afterFeatures + sizes.serial;

    if (blockH <= maxHeight) return { sizes, ctxLines };
  }

  const fallback = MIN_NAME;
  const sizes: FittedFontSizes = {
    name: fallback,
    context: Math.max(3, Math.round(fallback * FONT_RATIO.context)),
    features: Math.max(3, Math.round(fallback * FONT_RATIO.features)),
    serial: Math.max(3, Math.round(fallback * FONT_RATIO.serial)),
    afterName: Math.max(1, Math.round(fallback * SPACING_RATIO.afterName)),
    contextLineGap: Math.max(1, Math.round(fallback * SPACING_RATIO.contextLineGap)),
    afterContext: Math.max(1, Math.round(fallback * SPACING_RATIO.afterContext)),
    afterFeatures: Math.max(1, Math.round(fallback * SPACING_RATIO.afterFeatures)),
  };
  const ctxLines = contextLine
    ? wrapText(ctx, contextLine, maxWidth, sizes.context).slice(0, 2)
    : [];
  return { sizes, ctxLines };
}

// ============================================================================
// BACKGROUND
// ============================================================================

function drawCustomBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  config: CustomLabelConfig
) {
  if (config.colorPreset === 'rainbow') {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.17, '#ff8800');
    grad.addColorStop(0.33, '#ffff00');
    grad.addColorStop(0.5, '#00cc00');
    grad.addColorStop(0.67, '#0066ff');
    grad.addColorStop(0.83, '#8800ff');
    grad.addColorStop(1, '#ff00ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, config.gradientStart);
    grad.addColorStop(0.5, config.gradientEnd);
    grad.addColorStop(1, config.gradientStart);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Subtle glow for dark themes
  if (config.style === 'modern') {
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    glow.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Determine if colors are light (for text contrast) */
function isLightTheme(config: CustomLabelConfig): boolean {
  return config.style === 'traditional' ||
    config.colorPreset === 'traditional';
}

/**
 * Draw a border inside the cut lines so it is fully visible after trimming.
 * The cut lines sit at TRIM_INSET (0.02") inside the content area.
 * The border is drawn from the cut line inward by borderWidth.
 */
function drawBorder(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  B: number, CW: number, CH: number,
  config: CustomLabelConfig,
  dpi: number
) {
  if (!config.borderEnabled || !config.borderWidth) return 0;
  const TRIM_INSET = 0.02;
  const trim = Math.round(TRIM_INSET * dpi);
  const bw = Math.round(config.borderWidth * dpi);
  ctx.fillStyle = config.borderColor;

  // Border origin = bleed + trim inset (the cut line)
  const bx = B + trim;
  const by = B + trim;
  const bWidth = CW - trim * 2; // visible width after cut
  const bHeight = CH - trim * 2; // visible height after cut

  // Top
  ctx.fillRect(bx, by, bWidth, bw);
  // Bottom
  ctx.fillRect(bx, by + bHeight - bw, bWidth, bw);
  // Left
  ctx.fillRect(bx, by + bw, bw, bHeight - bw * 2);
  // Right
  ctx.fillRect(bx + bWidth - bw, by + bw, bw, bHeight - bw * 2);
  return bw + trim;
}

// ============================================================================
// FRONT LABEL RENDERER
// ============================================================================

export async function renderFrontCanvas(
  data: SlabLabelData,
  config: CustomLabelConfig,
  dpi: number
): Promise<HTMLCanvasElement> {
  const BLEED_IN = 0.08;
  const canvasW = Math.round((config.width + BLEED_IN * 2) * dpi);
  const canvasH = Math.round((config.height + BLEED_IN * 2) * dpi);
  const bleedPx = Math.round(BLEED_IN * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  const W = canvasW, H = canvasH, B = bleedPx;
  const CW = W - B * 2;
  const CH = H - B * 2;
  const light = isLightTheme(config);

  drawCustomBackground(ctx, W, H, config);

  // Draw border (returns inset in pixels, 0 if no border)
  const borderInset = drawBorder(ctx, W, H, B, CW, CH, config, dpi);

  // Effective content area after border
  const EB = B + borderInset; // effective bleed offset
  const ECW = CW - borderInset * 2;
  const ECH = CH - borderInset * 2;

  // Scale factor relative to standard 2.8"×0.8" at 300dpi
  const scale = (config.width * dpi) / (2.8 * 300);

  const padding = Math.round(18 * scale);

  // Left: DCM Logo
  const logoSize = ECH * 0.55;
  const logoX = EB + padding;
  const logoY = EB + (ECH - logoSize) / 2;
  const logoSrc = light ? data.logoDataUrl : data.whiteLogoDataUrl;

  if (logoSrc) {
    try {
      const logoImg = await loadImage(logoSrc);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      ctx.fillStyle = light ? TRAD_COLORS.purplePrimary : TRAD_COLORS.white;
      ctx.font = `bold ${Math.round(36 * scale)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 5, EB + ECH / 2);
    }
  }

  // Right: Grade + Condition
  const gradeText = formatGradeDisplay(data.grade, data.isAlteredAuthentic);
  const conditionText = data.isAlteredAuthentic && data.grade === null
    ? 'AUTHENTIC'
    : (data.condition || '').toUpperCase();

  const gradeAreaWidth = Math.round(130 * scale);
  const gradeRightPadding = padding + Math.round(20 * scale);
  const gradeCenterX = EB + ECW - gradeRightPadding - gradeAreaWidth / 2;

  const gradeFontSize = Math.round(88 * scale);
  const condFontSize = Math.round(24 * scale);
  const dividerGap = light ? Math.round(8 * scale) : Math.round(4 * scale);
  const condGap = Math.round(4 * scale);
  const totalGradeH = gradeFontSize + dividerGap + condFontSize;
  const gradeStartY = EB + (ECH - totalGradeH) / 2;

  ctx.fillStyle = light ? TRAD_COLORS.purplePrimary : TRAD_COLORS.white;
  ctx.font = `bold ${gradeFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeCenterX, gradeStartY);

  if (!light) {
    // No divider for modern
  } else {
    const divY = gradeStartY + gradeFontSize + 2;
    ctx.strokeStyle = TRAD_COLORS.purplePrimary;
    ctx.lineWidth = Math.round(3 * scale);
    ctx.beginPath();
    ctx.moveTo(gradeCenterX - Math.round(40 * scale), divY);
    ctx.lineTo(gradeCenterX + Math.round(40 * scale), divY);
    ctx.stroke();
  }

  ctx.fillStyle = light ? TRAD_COLORS.purpleDark : 'rgba(255, 255, 255, 0.8)';
  ctx.font = `bold ${condFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(conditionText, gradeCenterX, gradeStartY + gradeFontSize + dividerGap + condGap);

  // Center: Card Info
  const infoX = logoX + logoSize + Math.round(16 * scale);
  const infoMaxWidth = (EB + ECW - gradeRightPadding - gradeAreaWidth) - infoX - Math.round(20 * scale);
  const infoMaxHeight = ECH - Math.round(16 * scale);

  // Only apply CJK-safe extraction when text contains CJK characters (canvas can't render them).
  // For non-CJK text, use as-is since generateLabelData already cleaned it.
  const safeCardName = containsCJK(data.primaryName)
    ? extractAsciiSafe(data.primaryName, 'Card', data.englishName)
    : (data.primaryName || 'Card');
  const safeContextLine = containsCJK(data.contextLine)
    ? extractAsciiSafePreserveBullets(data.contextLine, '')
    : (data.contextLine || '');
  const safeFeatures = data.featuresLine
    ? (containsCJK(data.featuresLine) ? extractAsciiSafePreserveBullets(data.featuresLine, '') : data.featuresLine)
    : '';

  const maxNameFont = Math.round(38 * scale);
  const { sizes: fs, ctxLines } = fitCardInfoFonts(
    ctx, infoMaxWidth, infoMaxHeight,
    safeCardName, safeContextLine, safeFeatures, data.serial, maxNameFont, scale
  );

  let blockH = fs.name;
  if (ctxLines.length > 0) {
    blockH += fs.afterName;
    blockH += ctxLines.length * fs.context + (ctxLines.length - 1) * fs.contextLineGap;
  }
  if (safeFeatures) blockH += fs.afterContext + fs.features;
  blockH += fs.afterFeatures + fs.serial;

  let currentY = EB + (ECH - blockH) / 2;

  ctx.fillStyle = light ? TRAD_COLORS.textDark : 'rgba(255, 255, 255, 0.95)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${fs.name}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText(safeCardName, infoX, currentY);
  currentY += fs.name + fs.afterName;

  if (ctxLines.length > 0) {
    ctx.fillStyle = light ? TRAD_COLORS.textMedium : 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${fs.context}px 'Helvetica Neue', Arial, sans-serif`;
    for (const line of ctxLines) {
      ctx.fillText(line, infoX, currentY);
      currentY += fs.context + fs.contextLineGap;
    }
  }

  if (safeFeatures) {
    currentY += fs.afterContext - fs.contextLineGap;
    ctx.fillStyle = light ? TRAD_COLORS.featureBlue : 'rgba(34, 197, 94, 0.9)';
    ctx.font = `bold ${fs.features}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(safeFeatures, infoX, currentY);
    currentY += fs.features + fs.afterFeatures;
  } else {
    currentY += fs.afterFeatures;
  }

  ctx.fillStyle = light ? TRAD_COLORS.textMedium : 'rgba(255, 255, 255, 0.7)';
  ctx.font = `${fs.serial}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText(data.serial, infoX, currentY);

  return canvas;
}

// ============================================================================
// BACK LABEL RENDERER
// ============================================================================

export async function renderBackCanvas(
  data: SlabLabelData,
  config: CustomLabelConfig,
  dpi: number
): Promise<HTMLCanvasElement> {
  const BLEED_IN = 0.08;
  const canvasW = Math.round((config.width + BLEED_IN * 2) * dpi);
  const canvasH = Math.round((config.height + BLEED_IN * 2) * dpi);
  const bleedPx = Math.round(BLEED_IN * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  const W = canvasW, H = canvasH, B = bleedPx;
  const CW = W - B * 2;
  const CH = H - B * 2;
  const light = isLightTheme(config);
  const scale = (config.width * dpi) / (2.8 * 300);

  drawCustomBackground(ctx, W, H, config);

  // Draw border (returns inset in pixels, 0 if no border)
  const borderInset = drawBorder(ctx, W, H, B, CW, CH, config, dpi);

  // Effective content area after border
  const EB = B + borderInset;
  const ECW = CW - borderInset * 2;
  const ECH = CH - borderInset * 2;

  const padding = Math.round(18 * scale);

  // Left: QR Code
  const qrSize = ECH * 0.72;
  const qrX = EB + padding + Math.round(12 * scale);
  const qrY = EB + (ECH - qrSize) / 2;

  if (!light) {
    const qrPad = Math.round(8 * scale);
    ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
    ctx.shadowBlur = Math.round(12 * scale);
    ctx.fillStyle = config.gradientStart;
    ctx.fillRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
  }

  ctx.fillStyle = TRAD_COLORS.white;
  if (light) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 4;
    ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6);
  }

  if (data.qrCodeDataUrl) {
    try {
      const qrImg = await loadImage(data.qrCodeDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch { /* skip */ }
  }

  // Badges
  let badgeXOffset = qrX + qrSize + Math.round(light ? 20 : 28 * scale);
  const drawBadge = (symbol: string, label: string, color: string, textColor: string) => {
    const bx = badgeXOffset;
    const symbolSize = Math.round(28 * scale);
    const textSize = Math.round(16 * scale);
    const totalBadgeH = symbolSize + 6 + (ECH * 0.45);
    const by = EB + (ECH - totalBadgeH) / 2;

    ctx.fillStyle = color;
    ctx.font = `bold ${symbolSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(symbol, bx, by);

    ctx.save();
    ctx.translate(bx, by + symbolSize + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${textSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    badgeXOffset += Math.round(36 * scale);
  };

  if (data.showFounderEmblem) drawBadge('\u2605', 'FOUNDER', light ? '#d97706' : '#FFD700', light ? TRAD_COLORS.purplePrimary : '#FFFFFF');
  if (data.showCardLoversEmblem) drawBadge('\u2665', 'Card Lover', '#f43f5e', light ? '#f43f5e' : '#FFFFFF');
  if (data.showVipEmblem) drawBadge('\u25C6', 'VIP', '#6366f1', light ? '#6366f1' : '#FFFFFF');

  // Center: Grade
  const centerX = EB + ECW / 2;
  const gradeText = formatGradeDisplay(data.grade, data.isAlteredAuthentic);
  const conditionText = data.isAlteredAuthentic && data.grade === null
    ? 'AUTHENTIC' : (data.condition || '').toUpperCase();

  const gradeFontSize = Math.round(88 * scale);
  const condFontSize = Math.round(24 * scale);
  const condGap = Math.round(8 * scale);
  const totalH = gradeFontSize + (conditionText ? condGap + condFontSize : 0);
  const centerStartY = EB + (ECH - totalH) / 2;

  ctx.fillStyle = light ? TRAD_COLORS.purplePrimary : TRAD_COLORS.white;
  ctx.font = `bold ${gradeFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, centerX, centerStartY);

  if (conditionText) {
    ctx.fillStyle = light ? TRAD_COLORS.purpleDark : 'rgba(255, 255, 255, 0.8)';
    ctx.font = `bold ${condFontSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(conditionText, centerX, centerStartY + gradeFontSize + condGap);
  }

  // Right: Sub-scores
  if (data.subScores) {
    const cutLinePadding = Math.round(30 * scale);
    const rightEdge = EB + ECW - padding - cutLinePadding;
    const subFontSize = Math.round(26 * scale);
    const lineHeight = subFontSize + Math.round(10 * scale);
    const totalSubH = lineHeight * 4 - Math.round(10 * scale);
    const subStartY = EB + (ECH - totalSubH) / 2;

    const drawSubScore = (label: string, value: number, index: number) => {
      const y = subStartY + index * lineHeight + subFontSize / 2;
      const scoreText = `${label}: ${Math.round(value)}`;
      ctx.fillStyle = light ? TRAD_COLORS.textMedium : 'rgba(255, 255, 255, 0.95)';
      ctx.font = `${subFontSize}px 'Helvetica Neue', Arial, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, rightEdge, y);
    };

    drawSubScore('Centering', data.subScores.centering, 0);
    drawSubScore('Corners', data.subScores.corners, 1);
    drawSubScore('Edges', data.subScores.edges, 2);
    drawSubScore('Surface', data.subScores.surface, 3);
  }

  return canvas;
}

// ============================================================================
// PUBLIC API — Preview (screen DPI)
// ============================================================================

const PREVIEW_DPI = 96;

/** Render a front label preview onto a target canvas element */
export async function renderCustomFrontPreview(
  targetCanvas: HTMLCanvasElement,
  data: SlabLabelData,
  config: CustomLabelConfig
): Promise<void> {
  const rendered = await renderFrontCanvas(data, config, PREVIEW_DPI);
  targetCanvas.width = rendered.width;
  targetCanvas.height = rendered.height;
  const ctx = targetCanvas.getContext('2d')!;
  ctx.drawImage(rendered, 0, 0);
}

/** Render a back label preview onto a target canvas element */
export async function renderCustomBackPreview(
  targetCanvas: HTMLCanvasElement,
  data: SlabLabelData,
  config: CustomLabelConfig
): Promise<void> {
  const rendered = await renderBackCanvas(data, config, PREVIEW_DPI);
  targetCanvas.width = rendered.width;
  targetCanvas.height = rendered.height;
  const ctx = targetCanvas.getContext('2d')!;
  ctx.drawImage(rendered, 0, 0);
}

// ============================================================================
// PUBLIC API — PDF Export (300 DPI)
// ============================================================================

const PRINT_DPI = 300;
const INCH = 72; // 1 inch = 72 points in jsPDF

/** Generate a print-quality PDF at 300 DPI with the custom dimensions/colors */
export async function generateCustomSlabLabel(
  data: SlabLabelData,
  config: CustomLabelConfig
): Promise<Blob> {
  const BLEED_IN = 0.08;
  const labelWidthPt = config.width * INCH;
  const labelHeightPt = config.height * INCH;
  const bleedPt = BLEED_IN * INCH;

  // Page is letter sized
  const PAGE_W = 8.5 * INCH;
  const PAGE_H = 11 * INCH;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Center the label on page
  const singleX = (PAGE_W - labelWidthPt) / 2;
  const singleY = (PAGE_H - labelHeightPt) / 2;

  // Render front at 300 DPI
  const frontCanvas = await renderFrontCanvas(data, config, PRINT_DPI);
  const frontImg = frontCanvas.toDataURL('image/png');

  // Page header
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#9ca3af');
  doc.text('FRONT — Custom Label', 50, 40);
  doc.text(`${config.width}" × ${config.height}"`, PAGE_W - 50, 40, { align: 'right' });

  // Place front image with bleed
  doc.addImage(frontImg, 'PNG',
    singleX - bleedPt, singleY - bleedPt,
    labelWidthPt + bleedPt * 2, labelHeightPt + bleedPt * 2
  );

  // Cut guides
  const trimInset = 0.02 * INCH;
  const cutX = singleX + trimInset;
  const cutY = singleY + trimInset;
  const cutW = labelWidthPt - trimInset * 2;
  const cutH = labelHeightPt - trimInset * 2;

  const guideColor = config.style === 'modern' ? '#ffffff' : '#000000';
  doc.setDrawColor(guideColor);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0);
  doc.rect(cutX, cutY, cutW, cutH, 'S');
  doc.setLineDashPattern([], 0);

  // Corner marks
  const markLen = 8;
  doc.setDrawColor(guideColor);
  doc.setLineWidth(0.5);
  doc.line(cutX - markLen, cutY, cutX, cutY);
  doc.line(cutX, cutY - markLen, cutX, cutY);
  doc.line(cutX + cutW, cutY, cutX + cutW + markLen, cutY);
  doc.line(cutX + cutW, cutY - markLen, cutX + cutW, cutY);
  doc.line(cutX - markLen, cutY + cutH, cutX, cutY + cutH);
  doc.line(cutX, cutY + cutH, cutX, cutY + cutH + markLen);
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW + markLen, cutY + cutH);
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW, cutY + cutH + markLen);

  // Dimension annotation below label
  doc.setFontSize(8);
  doc.setTextColor('#6b7280');
  doc.text(`${config.width}" × ${config.height}"`, PAGE_W / 2, singleY + labelHeightPt + 30, { align: 'center' });

  // Page 2: Back
  doc.addPage('letter', 'portrait');
  const backCanvas = await renderBackCanvas(data, config, PRINT_DPI);
  const backImg = backCanvas.toDataURL('image/png');

  doc.setFontSize(7);
  doc.setTextColor('#9ca3af');
  doc.text('BACK — Custom Label', 50, 40);
  doc.text(`${config.width}" × ${config.height}"`, PAGE_W - 50, 40, { align: 'right' });

  doc.addImage(backImg, 'PNG',
    singleX - bleedPt, singleY - bleedPt,
    labelWidthPt + bleedPt * 2, labelHeightPt + bleedPt * 2
  );

  // Corner marks on back
  doc.setDrawColor(guideColor);
  doc.setLineWidth(0.5);
  doc.line(cutX - markLen, cutY, cutX, cutY);
  doc.line(cutX, cutY - markLen, cutX, cutY);
  doc.line(cutX + cutW, cutY, cutX + cutW + markLen, cutY);
  doc.line(cutX + cutW, cutY - markLen, cutX + cutW, cutY);
  doc.line(cutX - markLen, cutY + cutH, cutX, cutY + cutH);
  doc.line(cutX, cutY + cutH, cutX, cutY + cutH + markLen);
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW + markLen, cutY + cutH);
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW, cutY + cutH + markLen);

  doc.setFontSize(8);
  doc.setTextColor('#6b7280');
  doc.text(`${config.width}" × ${config.height}"`, PAGE_W / 2, singleY + labelHeightPt + 30, { align: 'center' });

  return doc.output('blob');
}

/** Download a custom label as PDF */
export async function downloadCustomSlabLabel(
  data: SlabLabelData,
  config: CustomLabelConfig,
  filename: string = 'DCM-Custom-Label.pdf'
): Promise<void> {
  const blob = await generateCustomSlabLabel(data, config);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// BATCH CUSTOM LABEL GENERATOR (multi-up grid, same layout as standard batch)
// ============================================================================

const BATCH_INCH = 72;
const BATCH_DPI = 300;

// Label dimensions in points (matches slabLabelGenerator)
const BATCH_LABEL_WIDTH_IN = 2.8;
const BATCH_LABEL_HEIGHT_IN = 0.8;
const BATCH_LABEL_WIDTH = BATCH_LABEL_WIDTH_IN * BATCH_INCH;
const BATCH_LABEL_HEIGHT = BATCH_LABEL_HEIGHT_IN * BATCH_INCH;
const BATCH_BLEED_IN = 0.08;
const BATCH_BLEED_PT = BATCH_BLEED_IN * BATCH_INCH;

// Cut guide margin around each label
const BATCH_CUT_MARGIN = 0.25 * BATCH_INCH;

// Cell size (label + margins)
const BATCH_CELL_WIDTH = BATCH_LABEL_WIDTH + BATCH_CUT_MARGIN * 2;
const BATCH_CELL_HEIGHT = BATCH_LABEL_HEIGHT + BATCH_CUT_MARGIN * 2;

// Page dimensions (US Letter)
const BATCH_PAGE_WIDTH = 8.5 * BATCH_INCH;
const BATCH_PAGE_HEIGHT = 11 * BATCH_INCH;

// Grid layout: 2 columns x 5 rows = 10 per page
const BATCH_COLS = 2;
const BATCH_ROWS = 5;
const BATCH_LABELS_PER_PAGE = BATCH_COLS * BATCH_ROWS;

// Grid positioning (centered on page)
const BATCH_GRID_WIDTH = BATCH_COLS * BATCH_CELL_WIDTH;
const BATCH_GRID_HEIGHT = BATCH_ROWS * BATCH_CELL_HEIGHT;
const BATCH_GRID_START_X = (BATCH_PAGE_WIDTH - BATCH_GRID_WIDTH) / 2;
const BATCH_GRID_START_Y = (BATCH_PAGE_HEIGHT - BATCH_GRID_HEIGHT) / 2;

// Trim inset for cut guides
const BATCH_TRIM_INSET_IN = 0.02;
const BATCH_TRIM_INSET_PT = BATCH_TRIM_INSET_IN * BATCH_INCH;
const BATCH_CUT_WIDTH = BATCH_LABEL_WIDTH - BATCH_TRIM_INSET_PT * 2;
const BATCH_CUT_HEIGHT = BATCH_LABEL_HEIGHT - BATCH_TRIM_INSET_PT * 2;

function batchGetLabelPosition(index: number) {
  const col = index % BATCH_COLS;
  const row = Math.floor(index / BATCH_COLS);
  const cellX = BATCH_GRID_START_X + col * BATCH_CELL_WIDTH;
  const cellY = BATCH_GRID_START_Y + row * BATCH_CELL_HEIGHT;
  return { labelX: cellX + BATCH_CUT_MARGIN, labelY: cellY + BATCH_CUT_MARGIN };
}

function batchGetMirroredLabelPosition(index: number) {
  const col = index % BATCH_COLS;
  const row = Math.floor(index / BATCH_COLS);
  const mirroredCol = BATCH_COLS - 1 - col;
  const cellX = BATCH_GRID_START_X + mirroredCol * BATCH_CELL_WIDTH;
  const cellY = BATCH_GRID_START_Y + row * BATCH_CELL_HEIGHT;
  return { labelX: cellX + BATCH_CUT_MARGIN, labelY: cellY + BATCH_CUT_MARGIN };
}

function batchPlaceLabelImage(doc: jsPDF, imgDataUrl: string, labelX: number, labelY: number) {
  doc.addImage(
    imgDataUrl, 'JPEG',
    labelX - BATCH_BLEED_PT,
    labelY - BATCH_BLEED_PT,
    BATCH_LABEL_WIDTH + BATCH_BLEED_PT * 2,
    BATCH_LABEL_HEIGHT + BATCH_BLEED_PT * 2
  );
}

function batchDrawPageHeader(doc: jsPDF, pageType: 'front' | 'back', pageNum: number, totalPages: number) {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#9ca3af');
  const headerY = BATCH_GRID_START_Y - 12;
  doc.text(`${pageType === 'front' ? 'FRONT' : 'BACK'} \u2014 Custom Label \u2014 Page ${pageNum} of ${totalPages}`, BATCH_GRID_START_X, headerY);
  const instructions = pageType === 'front'
    ? 'Print duplex (flip on long edge) \u2022 Cut along dotted lines'
    : 'BACK SIDE \u2022 Print duplex (flip on long edge)';
  doc.text(instructions, BATCH_PAGE_WIDTH / 2, headerY, { align: 'center' });
  doc.text('Label: 2.8" \u00D7 0.8"', BATCH_PAGE_WIDTH - BATCH_GRID_START_X, headerY, { align: 'right' });
}

function batchDrawCornerMarks(doc: jsPDF, labelX: number, labelY: number) {
  const cutX = labelX + BATCH_TRIM_INSET_PT;
  const cutY = labelY + BATCH_TRIM_INSET_PT;
  const markLen = 8;
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([], 0);
  doc.line(cutX - markLen, cutY, cutX, cutY);
  doc.line(cutX, cutY - markLen, cutX, cutY);
  doc.line(cutX + BATCH_CUT_WIDTH, cutY, cutX + BATCH_CUT_WIDTH + markLen, cutY);
  doc.line(cutX + BATCH_CUT_WIDTH, cutY - markLen, cutX + BATCH_CUT_WIDTH, cutY);
  doc.line(cutX - markLen, cutY + BATCH_CUT_HEIGHT, cutX, cutY + BATCH_CUT_HEIGHT);
  doc.line(cutX, cutY + BATCH_CUT_HEIGHT, cutX, cutY + BATCH_CUT_HEIGHT + markLen);
  doc.line(cutX + BATCH_CUT_WIDTH, cutY + BATCH_CUT_HEIGHT, cutX + BATCH_CUT_WIDTH + markLen, cutY + BATCH_CUT_HEIGHT);
  doc.line(cutX + BATCH_CUT_WIDTH, cutY + BATCH_CUT_HEIGHT, cutX + BATCH_CUT_WIDTH, cutY + BATCH_CUT_HEIGHT + markLen);
}

function batchDrawFrontCutGuides(doc: jsPDF, labelX: number, labelY: number) {
  const cutX = labelX + BATCH_TRIM_INSET_PT;
  const cutY = labelY + BATCH_TRIM_INSET_PT;
  doc.setDrawColor('#ffffff');
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0);
  doc.rect(cutX, cutY, BATCH_CUT_WIDTH, BATCH_CUT_HEIGHT, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor('#ffffff');
  doc.text('\u2702', cutX - 7, cutY + 3);
  doc.text('\u2702', cutX + BATCH_CUT_WIDTH + 1, cutY + 3);
  doc.text('\u2702', cutX - 7, cutY + BATCH_CUT_HEIGHT + 3);
  doc.text('\u2702', cutX + BATCH_CUT_WIDTH + 1, cutY + BATCH_CUT_HEIGHT + 3);
  batchDrawCornerMarks(doc, labelX, labelY);
}

/**
 * Generate batch custom slab labels in the same multi-up grid layout as standard batch.
 * 10 labels per page (2x5), front/back duplex pages, cut guides, mirrored backs.
 */
export async function generateBatchCustomSlabLabels(
  dataArray: SlabLabelData[],
  config: CustomLabelConfig
): Promise<Blob> {
  if (dataArray.length === 0) throw new Error('No label data provided');

  // Single label: use centered layout
  if (dataArray.length === 1) {
    return generateCustomSlabLabel(dataArray[0], config);
  }

  // Force config to standard slab dimensions for batch grid layout
  const batchConfig: CustomLabelConfig = {
    ...config,
    width: BATCH_LABEL_WIDTH_IN,
    height: BATCH_LABEL_HEIGHT_IN,
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const totalSheets = Math.ceil(dataArray.length / BATCH_LABELS_PER_PAGE);

  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const startIdx = sheet * BATCH_LABELS_PER_PAGE;
    const endIdx = Math.min(startIdx + BATCH_LABELS_PER_PAGE, dataArray.length);

    if (sheet > 0) doc.addPage('letter', 'portrait');

    // Front side
    batchDrawPageHeader(doc, 'front', sheet + 1, totalSheets);
    for (let i = startIdx; i < endIdx; i++) {
      const gridIdx = i - startIdx;
      const { labelX, labelY } = batchGetLabelPosition(gridIdx);
      const frontCanvas = await renderFrontCanvas(dataArray[i], batchConfig, BATCH_DPI);
      const frontImg = frontCanvas.toDataURL('image/jpeg', 0.92);
      batchPlaceLabelImage(doc, frontImg, labelX, labelY);
      batchDrawFrontCutGuides(doc, labelX, labelY);
    }

    // Back side (mirrored X for duplex)
    doc.addPage('letter', 'portrait');
    batchDrawPageHeader(doc, 'back', sheet + 1, totalSheets);
    for (let i = startIdx; i < endIdx; i++) {
      const gridIdx = i - startIdx;
      const { labelX, labelY } = batchGetMirroredLabelPosition(gridIdx);
      const backCanvas = await renderBackCanvas(dataArray[i], batchConfig, BATCH_DPI);
      const backImg = backCanvas.toDataURL('image/jpeg', 0.92);
      batchPlaceLabelImage(doc, backImg, labelX, labelY);
      batchDrawCornerMarks(doc, labelX, labelY);
    }
  }

  return doc.output('blob');
}
