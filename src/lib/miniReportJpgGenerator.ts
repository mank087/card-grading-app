/**
 * Mini-Report JPG Generator
 *
 * Generates a 2.5" x 3.5" mini-report label as a high-resolution JPG image
 * suitable for eBay listings, auction photos, and social media.
 *
 * Output: 750 x 1050 pixels (300 DPI equivalent for 2.5" x 3.5")
 */

import { FoldableLabelData } from './foldableLabelGenerator';

// Canvas dimensions (300 DPI equivalent)
const CANVAS_WIDTH = 750;   // 2.5" at 300 DPI
const CANVAS_HEIGHT = 1050; // 3.5" at 300 DPI

// Scale factor (PDF uses 72 DPI, we use 300 DPI equivalent)
const SCALE = CANVAS_WIDTH / (2.5 * 72); // ~4.17

// Colors (matching existing DCM branding)
const COLORS = {
  purplePrimary: '#7c3aed',    // Purple-600
  purpleDark: '#6b46c1',       // Purple-700
  purpleLight: '#f3e8ff',      // Purple-100

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

  // Draw grade text (white, bold, centered)
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${hasDecimal ? 40 * SCALE : 48 * SCALE}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gradeText, centerX, centerY + 2 * SCALE);

  // Draw label below circle
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `bold ${20 * SCALE}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, centerX, centerY + radius + 6 * SCALE);
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
  // BACKGROUND AND BORDER
  // ============================================

  // White background
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Purple border
  ctx.strokeStyle = COLORS.purplePrimary;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, CANVAS_WIDTH - 6, CANVAS_HEIGHT - 6);

  // ============================================
  // HEADER SECTION
  // ============================================

  const headerHeight = 230;
  const headerPadding = 20;

  // Header background (white with purple border)
  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.purplePrimary;
  ctx.lineWidth = 4;
  ctx.fillRect(6, 6, CANVAS_WIDTH - 12, headerHeight);
  ctx.strokeRect(6, 6, CANVAS_WIDTH - 12, headerHeight);

  // DCM Logo
  const logoX = 24;
  const logoY = 40;
  const logoSize = 150;

  if (data.logoDataUrl) {
    try {
      const logoImg = await loadImage(data.logoDataUrl);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      // Fallback text
      ctx.fillStyle = COLORS.purplePrimary;
      ctx.font = `bold ${48}px 'Helvetica Neue', Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 30, logoY + 75);
    }
  } else {
    // Fallback text
    ctx.fillStyle = COLORS.purplePrimary;
    ctx.font = `bold ${48}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('DCM', logoX + 30, logoY + 75);
  }

  // Card info (center)
  const infoX = 185;
  const infoMaxWidth = CANVAS_WIDTH - 300;

  // Line 1: Card Name (dark, bold, dynamic font size)
  ctx.fillStyle = COLORS.textDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let playerFontSize = 36;
  ctx.font = `bold ${playerFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  while (ctx.measureText(data.cardName).width > infoMaxWidth && playerFontSize > 20) {
    playerFontSize -= 2;
    ctx.font = `bold ${playerFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  }
  ctx.fillText(data.cardName, infoX, 28);

  // Line 2: Set Name • Card Number • Year
  ctx.fillStyle = COLORS.textMedium;
  const setInfo = [data.setName, data.cardNumber, data.year].filter(Boolean).join(' • ');

  let setFontSize = 24;
  ctx.font = `${setFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  while (ctx.measureText(setInfo).width > infoMaxWidth && setFontSize > 18) {
    setFontSize -= 1;
    ctx.font = `${setFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  }

  let currentY = 70;
  if (ctx.measureText(setInfo).width > infoMaxWidth) {
    // Wrap to multiple lines
    const setLines = wrapText(ctx, setInfo, infoMaxWidth);
    setLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, infoX, currentY + (i * 28));
    });
    currentY += (Math.min(setLines.length, 2)) * 28;
  } else {
    ctx.fillText(setInfo, infoX, currentY);
    currentY += 32;
  }

  // Line 3: Special features (if any) - blue text
  if (data.specialFeatures) {
    ctx.fillStyle = COLORS.featureBlue;
    ctx.font = `bold ${22}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(data.specialFeatures, infoX, currentY);
    currentY += 28;
  }

  // Line 4: Serial number (gray, monospace style)
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${20}px 'Courier New', monospace`;
  ctx.fillText(data.serial, infoX, currentY);

  // Grade display (right side)
  const gradeX = CANVAS_WIDTH - 100;
  const gradeText = formatGradeDisplay(data.grade);
  const hasDecimal = gradeText.includes('.');

  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = `bold ${hasDecimal ? 64 : 80}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeX, 50);

  // Divider line under grade
  ctx.strokeStyle = COLORS.purplePrimary;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gradeX - 55, 130);
  ctx.lineTo(gradeX + 55, 130);
  ctx.stroke();

  // Condition label
  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = `bold ${20}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(data.conditionLabel.toUpperCase(), gradeX, 145);

  // ============================================
  // SUBGRADES SECTION (2x2 grid with QR in center)
  // ============================================

  const subgradesY = headerHeight + 35;
  const circleRadius = 65;

  // Position circles in corners with QR code in center
  const leftColX = 115;
  const rightColX = CANVAS_WIDTH - 115;
  const row1Y = subgradesY + 75;
  const row2Y = subgradesY + 245;

  // Row 1: Centering (left), Corners (right)
  drawSubgradeCircle(ctx, leftColX, row1Y, circleRadius, COLORS.centeringBlue, data.subgrades.centering, 'CENTERING');
  drawSubgradeCircle(ctx, rightColX, row1Y, circleRadius, COLORS.cornersGreen, data.subgrades.corners, 'CORNERS');

  // Row 2: Edges (left), Surface (right)
  drawSubgradeCircle(ctx, leftColX, row2Y, circleRadius, COLORS.edgesPurple, data.subgrades.edges, 'EDGES');
  drawSubgradeCircle(ctx, rightColX, row2Y, circleRadius, COLORS.surfaceAmber, data.subgrades.surface, 'SURFACE');

  // QR Code in center of subgrades
  const qrSize = 170;
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

  const summaryY = row2Y + 130;
  const summaryHeight = CANVAS_HEIGHT - summaryY - 20;
  const summaryPadding = 24;

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
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `${20}px 'Helvetica Neue', Arial, sans-serif`;

  const summaryMaxWidth = CANVAS_WIDTH - 80;
  const summaryLines = wrapText(ctx, data.overallSummary, summaryMaxWidth);
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
