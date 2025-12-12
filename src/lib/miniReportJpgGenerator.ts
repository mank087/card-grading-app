/**
 * Mini-Report JPG Generator
 *
 * Generates a 2.5" x 3.5" mini-report label as a high-resolution JPG image
 * suitable for eBay listings, auction photos, and social media.
 *
 * Output: 750 x 1050 pixels (300 DPI equivalent for 2.5" x 3.5")
 *
 * NOTE: Canvas API does not support CJK fonts by default.
 * Japanese/Chinese/Korean characters are converted to ASCII-safe equivalents.
 */

import { FoldableLabelData } from './foldableLabelGenerator';
import { extractAsciiSafe } from './labelDataGenerator';

// Canvas dimensions (300 DPI equivalent)
const CANVAS_WIDTH = 750;   // 2.5" at 300 DPI
const CANVAS_HEIGHT = 1050; // 3.5" at 300 DPI

// Colors (matching existing DCM branding)
const COLORS = {
  purplePrimary: '#7c3aed',    // Purple-600
  purpleDark: '#6b46c1',       // Purple-700
  purpleLight: '#f3e8ff',      // Purple-100

  // Metallic slab gradient colors
  slabGradient1: '#9333ea',    // Purple-600
  slabGradient2: '#6b21a8',    // Purple-800
  slabGradient3: '#a855f7',    // Purple-500
  slabGradient4: '#7c3aed',    // Purple-600
  slabGradient5: '#581c87',    // Purple-900

  // Subgrade colors
  centeringBlue: '#3b82f6',    // Blue-500
  cornersGreen: '#10b981',     // Green-500
  edgesPurple: '#a855f7',      // Purple-500
  surfaceAmber: '#f59e0b',     // Amber-500

  // Text colors
  textDark: '#1f2937',         // Gray-900
  textMedium: '#4b5563',       // Gray-600
  textLight: '#6b7280',        // Gray-500
  white: '#ffffff',
  featureBlue: '#2563eb',      // Blue-600

  // Background
  bgSummary: '#eef2ff',        // Indigo-50
};

/**
 * Format grade - show whole number unless it has a meaningful decimal (like 9.5)
 */
function formatGradeDisplay(grade: string | number): string {
  if (typeof grade === 'string') {
    const num = parseFloat(grade);
    if (isNaN(num)) return grade;
    return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  }
  return grade % 1 === 0 ? grade.toFixed(0) : grade.toFixed(1);
}

/**
 * Wrap text to fit within a specified width
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draw a rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  options: { fill?: boolean; stroke?: boolean } = { fill: true, stroke: false }
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (options.fill) ctx.fill();
  if (options.stroke) ctx.stroke();
}

/**
 * Draw a subgrade circle with centered text
 */
function drawSubgradeCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  grade: string | number,
  label: string
) {
  // Draw filled circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Format grade text
  const gradeText = formatGradeDisplay(grade);
  const hasDecimal = gradeText.includes('.');

  // Draw grade text (white, bold, centered) - FIXED: use fixed font sizes, not scaled
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${hasDecimal ? 36 : 44}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gradeText, centerX, centerY);

  // Draw label below circle
  ctx.fillStyle = COLORS.textDark;
  ctx.font = 'bold 18px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, centerX, centerY + radius + 8);
}

/**
 * Draw metallic purple slab border (gradient effect)
 */
function drawMetallicSlabBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  cornerRadius: number
) {
  // Create gradient for metallic effect
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, COLORS.slabGradient1);
  gradient.addColorStop(0.25, COLORS.slabGradient2);
  gradient.addColorStop(0.5, COLORS.slabGradient3);
  gradient.addColorStop(0.75, COLORS.slabGradient4);
  gradient.addColorStop(1, COLORS.slabGradient5);

  ctx.fillStyle = gradient;

  // Draw outer rounded rect
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + width - cornerRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  ctx.lineTo(x + width, y + height - cornerRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
  ctx.lineTo(x + cornerRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
  ctx.closePath();

  // Cut out inner area
  const innerX = x + borderWidth;
  const innerY = y + borderWidth;
  const innerWidth = width - borderWidth * 2;
  const innerHeight = height - borderWidth * 2;
  const innerRadius = Math.max(0, cornerRadius - borderWidth);

  ctx.moveTo(innerX + innerRadius, innerY);
  ctx.lineTo(innerX + innerWidth - innerRadius, innerY);
  ctx.quadraticCurveTo(innerX + innerWidth, innerY, innerX + innerWidth, innerY + innerRadius);
  ctx.lineTo(innerX + innerWidth, innerY + innerHeight - innerRadius);
  ctx.quadraticCurveTo(innerX + innerWidth, innerY + innerHeight, innerX + innerWidth - innerRadius, innerY + innerHeight);
  ctx.lineTo(innerX + innerRadius, innerY + innerHeight);
  ctx.quadraticCurveTo(innerX, innerY + innerHeight, innerX, innerY + innerHeight - innerRadius);
  ctx.lineTo(innerX, innerY + innerRadius);
  ctx.quadraticCurveTo(innerX, innerY, innerX + innerRadius, innerY);
  ctx.closePath();

  ctx.fill('evenodd');
}

/**
 * Draw purple separator line (gradient)
 */
function drawPurpleSeparator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, COLORS.slabGradient1);
  gradient.addColorStop(0.5, COLORS.slabGradient3);
  gradient.addColorStop(1, COLORS.slabGradient1);

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

/**
 * Load an image from a data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Generate the mini-report as a JPG image
 */
export async function generateMiniReportJpg(data: FoldableLabelData): Promise<Blob> {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Enable font smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ============================================
  // BACKGROUND AND METALLIC SLAB BORDER
  // ============================================

  // White background
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Outer metallic purple slab border
  const outerBorderWidth = 8;
  const outerCornerRadius = 16;
  drawMetallicSlabBorder(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, outerBorderWidth, outerCornerRadius);

  // ============================================
  // HEADER SECTION (no inner border - just outer slab border + separator)
  // ============================================

  const headerHeight = 210;
  const headerMargin = outerBorderWidth + 8;

  // Header content area (no additional border, just uses outer slab border)
  const innerHeaderX = headerMargin;
  const innerHeaderY = headerMargin;
  const innerHeaderWidth = CANVAS_WIDTH - headerMargin * 2;
  const innerHeaderHeight = headerHeight;

  // DCM Logo - positioned inside the header slab
  const logoX = innerHeaderX + 12;
  const logoY = innerHeaderY + 12;
  const logoSize = 130;

  if (data.logoDataUrl) {
    try {
      const logoImg = await loadImage(data.logoDataUrl);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      // Fallback text
      ctx.fillStyle = COLORS.purplePrimary;
      ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 20, logoY + 65);
    }
  } else {
    // Fallback text
    ctx.fillStyle = COLORS.purplePrimary;
    ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DCM', logoX + 20, logoY + 65);
  }

  // Card info (center) - adjusted for new layout
  const infoX = logoX + logoSize + 15;
  // Leave space for grade display on right side (grade starts around x=600)
  // infoX is around 157, so max width should stop well before grade area
  const gradeAreaStart = CANVAS_WIDTH - 150; // Where grade display begins
  const infoMaxWidth = gradeAreaStart - infoX - 20; // Leave 20px padding before grade

  // Line 1: Card Name (dark, bold, dynamic font size)
  // Use ASCII-safe text for Canvas rendering (CJK characters not supported)
  const safeCardName = extractAsciiSafe(data.cardName, 'Pokemon Card');
  ctx.fillStyle = COLORS.textDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let playerFontSize = 32;
  ctx.font = `bold ${playerFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  while (ctx.measureText(safeCardName).width > infoMaxWidth && playerFontSize > 18) {
    playerFontSize -= 2;
    ctx.font = `bold ${playerFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  }
  ctx.fillText(safeCardName, infoX, innerHeaderY + 18);

  // Line 2: Set Name • Card Number • Year
  // Use ASCII-safe versions for all text
  ctx.fillStyle = COLORS.textMedium;
  const safeSetName = data.setName ? extractAsciiSafe(data.setName, '') : '';
  const safeCardNumber = data.cardNumber ? extractAsciiSafe(data.cardNumber, '') : '';
  const safeYear = data.year ? extractAsciiSafe(data.year, '') : '';
  const setInfo = [safeSetName, safeCardNumber, safeYear].filter(Boolean).join(' • ');

  let setFontSize = 20;
  ctx.font = `${setFontSize}px 'Helvetica Neue', Arial, sans-serif`;

  // Always wrap if text is too wide - don't just shrink font
  let currentY = innerHeaderY + 55;
  if (ctx.measureText(setInfo).width > infoMaxWidth) {
    // Wrap to multiple lines
    const setLines = wrapText(ctx, setInfo, infoMaxWidth);
    setLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, infoX, currentY + (i * 24));
    });
    currentY += (Math.min(setLines.length, 2)) * 24;
  } else {
    ctx.fillText(setInfo, infoX, currentY);
    currentY += 28;
  }

  // Line 3: Special features (if any) - blue text
  if (data.specialFeatures) {
    const safeFeatures = extractAsciiSafe(data.specialFeatures, '');
    if (safeFeatures) {
      ctx.fillStyle = COLORS.featureBlue;
      ctx.font = 'bold 18px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(safeFeatures, infoX, currentY);
      currentY += 24;
    }
  }

  // Line 4: Serial number (gray, monospace style)
  ctx.fillStyle = COLORS.textLight;
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(data.serial, infoX, currentY);

  // Grade display (right side) - adjusted for new layout
  const gradeX = CANVAS_WIDTH - 85;
  const gradeText = formatGradeDisplay(data.grade);
  const hasDecimal = gradeText.includes('.');

  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = `bold ${hasDecimal ? 56 : 72}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeX, innerHeaderY + 30);

  // Divider line under grade
  ctx.strokeStyle = COLORS.purplePrimary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gradeX - 50, innerHeaderY + 105);
  ctx.lineTo(gradeX + 50, innerHeaderY + 105);
  ctx.stroke();

  // Condition label
  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(data.conditionLabel.toUpperCase(), gradeX, innerHeaderY + 115);

  // ============================================
  // PURPLE SEPARATOR BETWEEN HEADER AND SUBGRADES
  // ============================================
  const separatorY = innerHeaderY + headerHeight;
  drawPurpleSeparator(ctx, outerBorderWidth, separatorY, CANVAS_WIDTH - outerBorderWidth * 2, 6);

  // ============================================
  // SUBGRADES SECTION (2x2 grid with QR in center)
  // ============================================

  const subgradesY = separatorY + 20;
  const circleRadius = 60;

  // Position circles in corners with QR code in center
  const leftColX = 100;
  const rightColX = CANVAS_WIDTH - 100;
  const row1Y = subgradesY + 70;
  const row2Y = subgradesY + 220;

  // Row 1: Centering (left), Corners (right)
  drawSubgradeCircle(ctx, leftColX, row1Y, circleRadius, COLORS.centeringBlue, data.subgrades.centering, 'CENTERING');
  drawSubgradeCircle(ctx, rightColX, row1Y, circleRadius, COLORS.cornersGreen, data.subgrades.corners, 'CORNERS');

  // Row 2: Edges (left), Surface (right)
  drawSubgradeCircle(ctx, leftColX, row2Y, circleRadius, COLORS.edgesPurple, data.subgrades.edges, 'EDGES');
  drawSubgradeCircle(ctx, rightColX, row2Y, circleRadius, COLORS.surfaceAmber, data.subgrades.surface, 'SURFACE');

  // QR Code in center of subgrades
  const qrSize = 150;
  const qrX = (CANVAS_WIDTH - qrSize) / 2;
  const qrY = subgradesY + 70;

  if (data.qrCodeDataUrl) {
    try {
      const qrImg = await loadImage(data.qrCodeDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch {
      // Draw placeholder if QR fails
      ctx.strokeStyle = COLORS.textLight;
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);
    }
  }

  // ============================================
  // OVERALL SUMMARY SECTION
  // ============================================

  const summaryY = row2Y + 100;
  const summaryHeight = CANVAS_HEIGHT - summaryY - outerBorderWidth - 12;
  const summaryPadding = 20;

  // Summary background
  ctx.fillStyle = COLORS.bgSummary;
  drawRoundedRect(ctx, 16, summaryY, CANVAS_WIDTH - 32, summaryHeight, 12, { fill: true });

  // Summary title
  ctx.fillStyle = COLORS.purpleDark;
  ctx.font = `bold ${22}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('OVERALL CARD CONDITION SUMMARY', 16 + summaryPadding, summaryY + 16);

  // Summary text (wrapped)
  // Use ASCII-safe text for Canvas rendering
  const safeSummary = extractAsciiSafe(data.overallSummary, 'Card condition analysis not available.');
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `${20}px 'Helvetica Neue', Arial, sans-serif`;

  const summaryMaxWidth = CANVAS_WIDTH - 80;
  const summaryLines = wrapText(ctx, safeSummary, summaryMaxWidth);
  const maxLines = 8;
  const displayLines = summaryLines.slice(0, maxLines);

  displayLines.forEach((line, i) => {
    // Add ellipsis to last line if truncated
    const isLastLine = i === displayLines.length - 1;
    const hasMoreLines = summaryLines.length > maxLines;
    let displayLine = line;
    if (isLastLine && hasMoreLines && line.length > 3) {
      displayLine = line.slice(0, -3) + '...';
    }
    ctx.fillText(displayLine, 16 + summaryPadding, summaryY + 48 + (i * 26));
  });

  // ============================================
  // RETURN JPG BLOB
  // ============================================

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate JPG blob'));
        }
      },
      'image/jpeg',
      0.95 // 95% quality
    );
  });
}

/**
 * Generate and download the mini-report as JPG
 */
export async function downloadMiniReportJpg(data: FoldableLabelData, filename: string): Promise<void> {
  const blob = await generateMiniReportJpg(data);

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
}
