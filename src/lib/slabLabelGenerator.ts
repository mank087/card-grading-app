/**
 * Slab Insert Label PDF Generator
 *
 * Generates printable labels sized exactly to fit slab manufacturer's label slot:
 * 2.8" wide × 0.8" tall
 *
 * Labels are rendered using HTML5 Canvas (same drawing approach as cardImageGenerator.ts)
 * then embedded as high-DPI images into the PDF, ensuring the printed label looks
 * identical to the downloadable card images.
 *
 * The canvas renders LARGER than the label (includes bleed area) so the purple/dark
 * background extends past the cut line. When the user cuts along the dotted line,
 * there's no white border — just solid background edge to edge.
 *
 * Features:
 * - Front label: DCM logo, card info (vertically centered), grade + condition
 * - Back label: QR code, large emblems, grade + condition, sub-scores
 * - Duplex printing: Front on page 1, back on page 2 (mirrored X for long-edge flip)
 * - Cut guides: Black dotted lines with scissor icons
 * - Background bleeds past cut line for clean edges
 * - Batch mode: 2 columns × 5 rows = up to 10 labels per page, auto-paginates
 */

import { jsPDF } from 'jspdf';
import { extractAsciiSafe, extractAsciiSafePreserveBullets } from './labelDataGenerator';

// ============================================================================
// CONSTANTS
// ============================================================================

const INCH = 72; // 1 inch = 72 points in jsPDF

// Label dimensions (slab manufacturer spec)
const LABEL_WIDTH_IN = 2.8;
const LABEL_HEIGHT_IN = 0.8;
const LABEL_WIDTH = LABEL_WIDTH_IN * INCH;
const LABEL_HEIGHT = LABEL_HEIGHT_IN * INCH;

// Bleed: background extends this far past the label edge on each side
const BLEED_IN = 0.08;
const BLEED_PT = BLEED_IN * INCH;

// Canvas rendering at 300 DPI for print quality
const DPI = 300;
// Canvas includes bleed on all sides
const CANVAS_W = Math.round((LABEL_WIDTH_IN + BLEED_IN * 2) * DPI); // ~886px
const CANVAS_H = Math.round((LABEL_HEIGHT_IN + BLEED_IN * 2) * DPI); // ~288px
// The actual label content area within the canvas (inset by bleed)
const BLEED_PX = Math.round(BLEED_IN * DPI); // ~24px

// Cut guide margin around each label (space for dotted line + scissor)
const CUT_MARGIN = 0.25 * INCH;

// Total cell size (label + cut margins on all sides)
const CELL_WIDTH = LABEL_WIDTH + CUT_MARGIN * 2;
const CELL_HEIGHT = LABEL_HEIGHT + CUT_MARGIN * 2;

// Page dimensions (US Letter, Portrait)
const PAGE_WIDTH = 8.5 * INCH;
const PAGE_HEIGHT = 11 * INCH;

// Grid layout
const COLS = 2;
const ROWS = 5;
const LABELS_PER_PAGE = COLS * ROWS; // 10

// Grid positioning (centered on page)
const GRID_WIDTH = COLS * CELL_WIDTH;
const GRID_HEIGHT = ROWS * CELL_HEIGHT;
const GRID_START_X = (PAGE_WIDTH - GRID_WIDTH) / 2;
const GRID_START_Y = (PAGE_HEIGHT - GRID_HEIGHT) / 2;

// Colors — IDENTICAL to cardImageGenerator.ts
const COLORS = {
  purplePrimary: '#7c3aed',
  purpleDark: '#6b46c1',
  textDark: '#1f2937',
  textMedium: '#4b5563',
  textLight: '#6b7280',
  featureBlue: '#2563eb',
  white: '#ffffff',
  bgGradientStart: '#f9fafb',
  bgGradientEnd: '#ffffff',
};

const MODERN_COLORS = {
  bgDark1: '#1a1625',
  bgDark2: '#2d1f47',
  textWhite: 'rgba(255, 255, 255, 0.95)',
  textWhiteMuted: 'rgba(255, 255, 255, 0.7)',
  textWhiteSubtle: 'rgba(255, 255, 255, 0.5)',
  textGreen: 'rgba(34, 197, 94, 0.9)',
};

// ============================================================================
// DATA INTERFACE
// ============================================================================

export interface SlabLabelData {
  primaryName: string;
  contextLine: string;
  features: string[];
  featuresLine?: string | null;
  serial: string;
  grade: number | null;
  gradeFormatted?: string;
  condition: string;
  isAlteredAuthentic?: boolean;
  englishName?: string;

  // Back label
  qrCodeDataUrl: string;
  subScores?: {
    centering: number;
    corners: number;
    edges: number;
    surface: number;
  };
  showFounderEmblem?: boolean;
  showVipEmblem?: boolean;
  showCardLoversEmblem?: boolean;

  // Pre-loaded logo data URLs
  logoDataUrl?: string;
  whiteLogoDataUrl?: string;
}

// ============================================================================
// CANVAS HELPERS
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

// ============================================================================
// DYNAMIC FONT SIZING
// ============================================================================

/** Font size ratios relative to the name font size (the largest text) */
const FONT_RATIO = {
  name: 1.0,       // base (e.g. 34px)
  context: 0.76,   // ~26px at base 34 — larger for print readability
  features: 0.70,  // ~24px at base 34
  serial: 0.76,    // matches context line size for visual consistency
};

/** Spacing ratios relative to the name font size */
const SPACING_RATIO = {
  afterName: 0.15,      // gap after name line
  contextLineGap: 0.09, // gap between wrapped context lines
  afterContext: 0.12,    // gap before features or serial
  afterFeatures: 0.12,  // gap after features line
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

/**
 * Calculate the optimal font sizes for the card info block so that all text
 * fits within the available width and height without truncation or overflow.
 *
 * Starts at MAX_NAME_FONT and scales down proportionally until it fits.
 */
function fitCardInfoFonts(
  ctx: CanvasRenderingContext2D,
  maxWidth: number,
  maxHeight: number,
  cardName: string,
  contextLine: string,
  featuresLine: string,
  serial: string
): { sizes: FittedFontSizes; ctxLines: string[] } {
  const MAX_NAME = 38;
  const MIN_NAME = 14;

  for (let nameSize = MAX_NAME; nameSize >= MIN_NAME; nameSize -= 1) {
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

    // Check name fits width
    ctx.font = `bold ${sizes.name}px 'Helvetica Neue', Arial, sans-serif`;
    if (ctx.measureText(cardName).width > maxWidth) continue;

    // Wrap context line, limit to 2 lines
    const ctxLines = contextLine
      ? wrapText(ctx, contextLine, maxWidth, sizes.context).slice(0, 2)
      : [];

    // Check features fits width
    if (featuresLine) {
      ctx.font = `bold ${sizes.features}px 'Helvetica Neue', Arial, sans-serif`;
      if (ctx.measureText(featuresLine).width > maxWidth) continue;
    }

    // Check serial fits width
    ctx.font = `${sizes.serial}px 'Courier New', monospace`;
    if (ctx.measureText(serial).width > maxWidth) continue;

    // Calculate total block height
    let blockH = sizes.name;
    if (ctxLines.length > 0) {
      blockH += sizes.afterName;
      blockH += ctxLines.length * sizes.context + (ctxLines.length - 1) * sizes.contextLineGap;
    }
    if (featuresLine) {
      blockH += sizes.afterContext + sizes.features;
    }
    blockH += sizes.afterFeatures + sizes.serial;

    // If it fits in the available height, we're done
    if (blockH <= maxHeight) {
      return { sizes, ctxLines };
    }
  }

  // Fallback: use minimum sizes
  const sizes: FittedFontSizes = {
    name: MIN_NAME,
    context: Math.round(MIN_NAME * FONT_RATIO.context),
    features: Math.round(MIN_NAME * FONT_RATIO.features),
    serial: Math.round(MIN_NAME * FONT_RATIO.serial),
    afterName: Math.round(MIN_NAME * SPACING_RATIO.afterName),
    contextLineGap: Math.round(MIN_NAME * SPACING_RATIO.contextLineGap),
    afterContext: Math.round(MIN_NAME * SPACING_RATIO.afterContext),
    afterFeatures: Math.round(MIN_NAME * SPACING_RATIO.afterFeatures),
  };
  const ctxLines = contextLine
    ? wrapText(ctx, contextLine, maxWidth, sizes.context).slice(0, 2)
    : [];
  return { sizes, ctxLines };
}

/** Draw the background for the full canvas (including bleed area) */
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, isModern: boolean) {
  if (isModern) {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, MODERN_COLORS.bgDark1);
    bgGrad.addColorStop(0.5, MODERN_COLORS.bgDark2);
    bgGrad.addColorStop(1, MODERN_COLORS.bgDark1);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle inner glow
    const glowGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, COLORS.bgGradientStart);
    bgGrad.addColorStop(1, COLORS.bgGradientEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }
}

// ============================================================================
// FRONT LABEL — Canvas renderer
// ============================================================================

async function renderFrontLabelCanvas(
  data: SlabLabelData,
  style: 'modern' | 'traditional'
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  const W = CANVAS_W;
  const H = CANVAS_H;
  const isModern = style === 'modern';
  const B = BLEED_PX; // bleed offset — content area starts at (B, B)

  // Content area dimensions (the actual 2.8" x 0.8" label)
  const CW = W - B * 2;
  const CH = H - B * 2;

  // Background fills ENTIRE canvas including bleed
  drawBackground(ctx, W, H, isModern);

  const padding = 18;

  // ── Left: DCM Logo (vertically centered in content area) ──
  const logoSize = CH * 0.55;
  const logoX = B + padding;
  const logoY = B + (CH - logoSize) / 2;
  const logoSrc = isModern ? data.whiteLogoDataUrl : data.logoDataUrl;

  if (logoSrc) {
    try {
      const logoImg = await loadImage(logoSrc);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      ctx.fillStyle = isModern ? COLORS.white : COLORS.purplePrimary;
      ctx.font = 'bold 36px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 5, B + CH / 2);
    }
  }

  // ── Right: Grade + Condition (vertically centered as a unit) ──
  const gradeText = formatGradeDisplay(data.grade, data.isAlteredAuthentic);
  const conditionText = data.isAlteredAuthentic && data.grade === null
    ? 'AUTHENTIC'
    : (data.condition || '').toUpperCase();

  // Grade area sized to fit the large grade number (matches back label for both styles)
  const gradeAreaWidth = 130;
  const gradeRightPadding = padding + 20; // extra inset so grade doesn't touch cut line
  const gradeCenterX = B + CW - gradeRightPadding - gradeAreaWidth / 2;

  // Measure total height of grade + divider + condition to center them
  // Both styles match back label sizes: grade 88px, condition 24px
  const gradeFontSize = 88;
  const condFontSize = 24;
  const dividerGap = isModern ? 4 : 8; // space for divider line in traditional
  const condGap = 4;
  const totalGradeH = gradeFontSize + dividerGap + condFontSize;
  const gradeStartY = B + (CH - totalGradeH) / 2;

  ctx.fillStyle = isModern ? COLORS.white : COLORS.purplePrimary;
  ctx.font = `bold ${gradeFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeCenterX, gradeStartY);

  // Divider line (traditional only)
  if (!isModern) {
    const divY = gradeStartY + gradeFontSize + 2;
    ctx.strokeStyle = COLORS.purplePrimary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gradeCenterX - 40, divY);
    ctx.lineTo(gradeCenterX + 40, divY);
    ctx.stroke();
  }

  // Condition text — colors match back label
  ctx.fillStyle = isModern ? 'rgba(255, 255, 255, 0.8)' : COLORS.purpleDark;
  ctx.font = `bold ${condFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(conditionText, gradeCenterX, gradeStartY + gradeFontSize + dividerGap + condGap);

  // ── Center: Card Information (dynamically sized, vertically centered) ──
  const infoX = logoX + logoSize + 16;
  const infoMaxWidth = (B + CW - gradeRightPadding - gradeAreaWidth) - infoX - 20;
  const infoMaxHeight = CH - 16; // small vertical padding

  const safeCardName = extractAsciiSafe(data.primaryName, 'Card', data.englishName);
  const safeContextLine = extractAsciiSafePreserveBullets(data.contextLine, '');
  const safeFeatures = data.featuresLine
    ? extractAsciiSafePreserveBullets(data.featuresLine, '')
    : '';

  // Dynamically fit all text into the available space
  const { sizes: fs, ctxLines } = fitCardInfoFonts(
    ctx, infoMaxWidth, infoMaxHeight,
    safeCardName, safeContextLine, safeFeatures, data.serial
  );

  // Calculate actual block height for vertical centering
  let blockH = fs.name;
  if (ctxLines.length > 0) {
    blockH += fs.afterName;
    blockH += ctxLines.length * fs.context + (ctxLines.length - 1) * fs.contextLineGap;
  }
  if (safeFeatures) blockH += fs.afterContext + fs.features;
  blockH += fs.afterFeatures + fs.serial;

  let currentY = B + (CH - blockH) / 2;

  // Line 1: Card Name
  ctx.fillStyle = isModern ? MODERN_COLORS.textWhite : COLORS.textDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${fs.name}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText(safeCardName, infoX, currentY);
  currentY += fs.name + fs.afterName;

  // Line 2: Context line
  if (ctxLines.length > 0) {
    ctx.fillStyle = isModern ? MODERN_COLORS.textWhiteMuted : COLORS.textMedium;
    ctx.font = `${fs.context}px 'Helvetica Neue', Arial, sans-serif`;
    for (const line of ctxLines) {
      ctx.fillText(line, infoX, currentY);
      currentY += fs.context + fs.contextLineGap;
    }
  }

  // Line 3: Features
  if (safeFeatures) {
    currentY += fs.afterContext - fs.contextLineGap; // adjust for last contextLineGap
    ctx.fillStyle = isModern ? MODERN_COLORS.textGreen : COLORS.featureBlue;
    ctx.font = `bold ${fs.features}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(safeFeatures, infoX, currentY);
    currentY += fs.features + fs.afterFeatures;
  } else {
    currentY += fs.afterFeatures;
  }

  // Line 4: Serial — match line 2 color for print readability
  ctx.fillStyle = isModern ? MODERN_COLORS.textWhiteMuted : COLORS.textMedium;
  ctx.font = `${fs.serial}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillText(data.serial, infoX, currentY);

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ============================================================================
// BACK LABEL — Canvas renderer
// ============================================================================

async function renderBackLabelCanvas(
  data: SlabLabelData,
  style: 'modern' | 'traditional'
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  const W = CANVAS_W;
  const H = CANVAS_H;
  const isModern = style === 'modern';
  const B = BLEED_PX;
  const CW = W - B * 2;
  const CH = H - B * 2;

  // Background fills ENTIRE canvas including bleed
  drawBackground(ctx, W, H, isModern);

  const padding = 18;

  // ── LEFT: QR Code (vertically centered, inset from cut line) ──
  const qrSize = CH * 0.72;
  const qrX = B + padding + 12;
  const qrY = B + (CH - qrSize) / 2;

  if (isModern) {
    const qrPad = 8;
    ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = MODERN_COLORS.bgDark1;
    ctx.fillRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
  }

  // White background for QR
  if (isModern) {
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6);
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
    ctx.shadowBlur = 0;
  }

  if (data.qrCodeDataUrl) {
    try {
      const qrImg = await loadImage(data.qrCodeDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch {
      // skip
    }
  }

  // ── Badges (larger for print readability) ──
  let badgeXOffset = qrX + qrSize + (isModern ? 28 : 20);

  const drawBadge = (symbol: string, label: string, color: string, textColor: string) => {
    const bx = badgeXOffset;
    // Vertically center the badge in content area
    const symbolSize = 28;
    const textSize = 16;
    const totalBadgeH = symbolSize + 6 + (CH * 0.45); // symbol + gap + rotated text
    const by = B + (CH - totalBadgeH) / 2;

    // Large symbol
    ctx.fillStyle = color;
    ctx.font = `bold ${symbolSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(symbol, bx, by);

    // Rotated label text — larger for print
    ctx.save();
    ctx.translate(bx, by + symbolSize + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${textSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();

    badgeXOffset += 36; // wider spacing for larger badges
  };

  if (data.showFounderEmblem) {
    drawBadge('\u2605', 'FOUNDER', isModern ? '#FFD700' : '#d97706', isModern ? '#FFFFFF' : COLORS.purplePrimary);
  }
  if (data.showCardLoversEmblem) {
    drawBadge('\u2665', 'Card Lover', '#f43f5e', isModern ? '#FFFFFF' : '#f43f5e');
  }
  if (data.showVipEmblem) {
    drawBadge('\u25C6', 'VIP', '#6366f1', isModern ? '#FFFFFF' : '#6366f1');
  }

  // ── CENTER: Large Grade + Condition (vertically centered) ──
  const centerX = B + CW / 2;
  const gradeText = formatGradeDisplay(data.grade, data.isAlteredAuthentic);
  const conditionText = data.isAlteredAuthentic && data.grade === null
    ? 'AUTHENTIC'
    : (data.condition || '').toUpperCase();

  const gradeFontSize = 88;  // +10% from 80
  const condFontSize = 24;   // +10% from 22
  const condGapBack = 8;
  const totalH = gradeFontSize + (conditionText ? condGapBack + condFontSize : 0);
  const centerStartY = B + (CH - totalH) / 2;

  ctx.fillStyle = isModern ? COLORS.white : COLORS.purplePrimary;
  ctx.font = `bold ${gradeFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, centerX, centerStartY);

  if (conditionText) {
    ctx.fillStyle = isModern ? 'rgba(255, 255, 255, 0.8)' : COLORS.purpleDark;
    ctx.font = `bold ${condFontSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(conditionText, centerX, centerStartY + gradeFontSize + condGapBack);
  }

  // ── RIGHT: Sub-scores (vertically centered, inset from cut line) ──
  if (data.subScores) {
    const cutLinePadding = 30; // extra inset so text doesn't crowd the cut line
    const rightEdge = B + CW - padding - cutLinePadding;
    const subFontSize = 26;   // +~18% from 22 for better readability
    const lineHeight = subFontSize + 10;
    const totalSubH = lineHeight * 4 - 10; // 4 lines, no gap after last
    const subStartY = B + (CH - totalSubH) / 2;

    const drawSubScore = (label: string, value: number, index: number) => {
      const y = subStartY + index * lineHeight + subFontSize / 2;
      const scoreText = `${label}: ${Math.round(value)}`;
      ctx.fillStyle = isModern ? MODERN_COLORS.textWhite : COLORS.textMedium;
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

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ============================================================================
// PDF HELPERS
// ============================================================================

function getLabelPosition(index: number) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const cellX = GRID_START_X + col * CELL_WIDTH;
  const cellY = GRID_START_Y + row * CELL_HEIGHT;
  return { cellX, cellY, labelX: cellX + CUT_MARGIN, labelY: cellY + CUT_MARGIN };
}

function getMirroredLabelPosition(index: number) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const mirroredCol = COLS - 1 - col;
  const cellX = GRID_START_X + mirroredCol * CELL_WIDTH;
  const cellY = GRID_START_Y + row * CELL_HEIGHT;
  return { cellX, cellY, labelX: cellX + CUT_MARGIN, labelY: cellY + CUT_MARGIN };
}

// Trim inset: cut guides are slightly inside the full label dimensions
// so that imprecise cutting still produces a label that fits the holder.
const TRIM_INSET_IN = 0.02; // 0.02" per side
const TRIM_INSET_PT = TRIM_INSET_IN * INCH;
const CUT_WIDTH = LABEL_WIDTH - TRIM_INSET_PT * 2;   // ~2.76" cut area
const CUT_HEIGHT = LABEL_HEIGHT - TRIM_INSET_PT * 2;  // ~0.76" cut area

/**
 * Draw L-shaped corner crop marks at the four corners of the cut area.
 * Used on both front and back pages for alignment guidance.
 */
function drawCornerMarks(doc: jsPDF, labelX: number, labelY: number, style: 'modern' | 'traditional' = 'traditional') {
  const cutX = labelX + TRIM_INSET_PT;
  const cutY = labelY + TRIM_INSET_PT;
  const cutW = CUT_WIDTH;
  const cutH = CUT_HEIGHT;

  const guideColor = style === 'modern' ? '#ffffff' : '#000000';
  const markLen = 8; // length of each arm of the L-shape in points

  doc.setDrawColor(guideColor);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([], 0); // solid lines for corner marks

  // Top-left corner
  doc.line(cutX - markLen, cutY, cutX, cutY);         // horizontal
  doc.line(cutX, cutY - markLen, cutX, cutY);          // vertical

  // Top-right corner
  doc.line(cutX + cutW, cutY, cutX + cutW + markLen, cutY);
  doc.line(cutX + cutW, cutY - markLen, cutX + cutW, cutY);

  // Bottom-left corner
  doc.line(cutX - markLen, cutY + cutH, cutX, cutY + cutH);
  doc.line(cutX, cutY + cutH, cutX, cutY + cutH + markLen);

  // Bottom-right corner
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW + markLen, cutY + cutH);
  doc.line(cutX + cutW, cutY + cutH, cutX + cutW, cutY + cutH + markLen);
}

/**
 * Draw full cut guides on the FRONT page: dotted rectangle + scissors + corner marks.
 * The cut area is inset by TRIM_INSET so the cut label fits the holder.
 */
function drawFrontCutGuides(doc: jsPDF, labelX: number, labelY: number, style: 'modern' | 'traditional' = 'traditional') {
  const cutX = labelX + TRIM_INSET_PT;
  const cutY = labelY + TRIM_INSET_PT;
  const cutW = CUT_WIDTH;
  const cutH = CUT_HEIGHT;

  const guideColor = style === 'modern' ? '#ffffff' : '#000000';
  doc.setDrawColor(guideColor);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([3, 3], 0);
  doc.rect(cutX, cutY, cutW, cutH, 'S');
  doc.setLineDashPattern([], 0);

  // Scissor icons just outside each corner
  doc.setFontSize(7);
  doc.setTextColor(guideColor);
  doc.text('\u2702', cutX - 7, cutY + 3);
  doc.text('\u2702', cutX + cutW + 1, cutY + 3);
  doc.text('\u2702', cutX - 7, cutY + cutH + 3);
  doc.text('\u2702', cutX + cutW + 1, cutY + cutH + 3);

  // Also add corner marks on front for consistency
  drawCornerMarks(doc, labelX, labelY, style);
}

function drawPageHeader(doc: jsPDF, pageType: 'front' | 'back', pageNum: number, totalPages: number) {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#9ca3af');
  const headerY = GRID_START_Y - 12;

  doc.text(`${pageType === 'front' ? 'FRONT' : 'BACK'} \u2014 Page ${pageNum} of ${totalPages}`, GRID_START_X, headerY);

  const instructions = pageType === 'front'
    ? 'Print duplex (flip on long edge) \u2022 Cut along dotted lines'
    : 'BACK SIDE \u2022 Print duplex (flip on long edge)';
  doc.text(instructions, PAGE_WIDTH / 2, headerY, { align: 'center' });
  doc.text('Label: 2.8" \u00D7 0.8"', PAGE_WIDTH - GRID_START_X, headerY, { align: 'right' });
}

/**
 * Place a label image on the PDF page.
 * The image includes bleed, so we place it slightly larger than the label
 * so the background extends past the cut line.
 */
function placeLabelImage(doc: jsPDF, imgDataUrl: string, labelX: number, labelY: number) {
  // The image includes BLEED_PT of extra background on each side
  // Place it offset by -BLEED_PT so the background bleeds past the cut line
  doc.addImage(
    imgDataUrl, 'JPEG',
    labelX - BLEED_PT,
    labelY - BLEED_PT,
    LABEL_WIDTH + BLEED_PT * 2,
    LABEL_HEIGHT + BLEED_PT * 2
  );
}

// ============================================================================
// SINGLE LABEL GENERATOR
// ============================================================================

export async function generateSlabLabel(
  data: SlabLabelData,
  style: 'modern' | 'traditional'
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const singleX = (PAGE_WIDTH - LABEL_WIDTH) / 2;
  const singleY = (PAGE_HEIGHT - LABEL_HEIGHT) / 2;

  // Render front label — full cut guides (dotted lines + scissors + corner marks)
  const frontImg = await renderFrontLabelCanvas(data, style);
  drawPageHeader(doc, 'front', 1, 1);
  placeLabelImage(doc, frontImg, singleX, singleY);
  drawFrontCutGuides(doc, singleX, singleY, style);

  // Page 2: Back label — corner marks only (no dotted lines)
  doc.addPage('letter', 'portrait');
  const backImg = await renderBackLabelCanvas(data, style);
  drawPageHeader(doc, 'back', 1, 1);
  placeLabelImage(doc, backImg, singleX, singleY);
  drawCornerMarks(doc, singleX, singleY, style);

  return doc.output('blob');
}

// ============================================================================
// BATCH LABEL GENERATOR
// ============================================================================

export async function generateBatchSlabLabels(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional'
): Promise<Blob> {
  if (dataArray.length === 0) throw new Error('No label data provided');

  // Single label: use centered layout (symmetric — works with any duplex setting)
  if (dataArray.length === 1) {
    return generateSlabLabel(dataArray[0], style);
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const totalSheets = Math.ceil(dataArray.length / LABELS_PER_PAGE);

  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const startIdx = sheet * LABELS_PER_PAGE;
    const endIdx = Math.min(startIdx + LABELS_PER_PAGE, dataArray.length);

    if (sheet > 0) doc.addPage('letter', 'portrait');

    // Render and place front labels for this page (one at a time to avoid memory buildup)
    drawPageHeader(doc, 'front', sheet + 1, totalSheets);
    for (let i = startIdx; i < endIdx; i++) {
      const gridIdx = i - startIdx;
      const { labelX, labelY } = getLabelPosition(gridIdx);
      const frontImg = await renderFrontLabelCanvas(dataArray[i], style);
      placeLabelImage(doc, frontImg, labelX, labelY);
      drawFrontCutGuides(doc, labelX, labelY, style);
    }

    // Back side (new page, mirrored X) — render one at a time
    doc.addPage('letter', 'portrait');
    drawPageHeader(doc, 'back', sheet + 1, totalSheets);
    for (let i = startIdx; i < endIdx; i++) {
      const gridIdx = i - startIdx;
      const { labelX, labelY } = getMirroredLabelPosition(gridIdx);
      const backImg = await renderBackLabelCanvas(dataArray[i], style);
      placeLabelImage(doc, backImg, labelX, labelY);
      drawCornerMarks(doc, labelX, labelY, style);
    }
  }

  return doc.output('blob');
}

// ============================================================================
// DOWNLOAD HELPERS
// ============================================================================

export async function downloadSlabLabel(
  data: SlabLabelData,
  style: 'modern' | 'traditional'
): Promise<void> {
  const blob = await generateSlabLabel(data, style);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const sanitize = (text: string) => text.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '-');
  const cardName = sanitize(extractAsciiSafe(data.primaryName, 'Card', data.englishName));
  const serial = sanitize(data.serial);
  link.download = `DCM-Slab-Label-${cardName}-${serial}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadBatchSlabLabels(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional'
): Promise<void> {
  const blob = await generateBatchSlabLabels(dataArray, style);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `DCM-Slab-Labels-Batch-${dataArray.length}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// CONFIG EXPORT (for batch modal UI)
// ============================================================================

export function getSlabLabelConfig() {
  return {
    labelsPerPage: LABELS_PER_PAGE,
    cols: COLS,
    rows: ROWS,
    labelWidthIn: LABEL_WIDTH_IN,
    labelHeightIn: LABEL_HEIGHT_IN,
  };
}
