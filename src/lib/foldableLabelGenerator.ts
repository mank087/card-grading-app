/**
 * Foldable Label PDF Generator
 *
 * Generates an 11" x 8.5" LANDSCAPE PDF that folds into a 2.5" x 3.5" trading card label
 * for insertion into toploaders or card cases.
 *
 * Fold Layout (11" x 8.5" landscape → 2.5" x 3.5"):
 * - Left panel: 4.25" (folds behind, provides room for instructions)
 * - Center panel: 2.5" (visible label width)
 * - Right panel: 4.25" (folds behind)
 * - Top panel: 2.5" (folds behind, tucks under label)
 * - Center panel: 3.5" (visible label height)
 * - Bottom panel: 2.5" (folds behind, tucks under label)
 *
 * The 2.5" top/bottom panels are smaller than the 3.5" label height,
 * ensuring they tuck neatly behind without any overhang.
 */

import { jsPDF } from 'jspdf';
import { extractAsciiSafe } from './labelDataGenerator';

// Page dimensions (in inches, converted to points: 1 inch = 72 points)
const INCH = 72;
const PAGE_WIDTH = 11 * INCH;    // Landscape width
const PAGE_HEIGHT = 8.5 * INCH;  // Landscape height

// Label dimensions
const LABEL_WIDTH = 2.5 * INCH;
const LABEL_HEIGHT = 3.5 * INCH;

// Fold positions for landscape
const FOLD_X1 = 4.25 * INCH;  // Left fold (11 - 2.5) / 2 = 4.25
const FOLD_X2 = 6.75 * INCH;  // Right fold (4.25 + 2.5 = 6.75)
const FOLD_Y1 = 2.5 * INCH;   // Top fold (8.5 - 3.5) / 2 = 2.5
const FOLD_Y2 = 6.0 * INCH;   // Bottom fold (2.5 + 3.5 = 6.0)

// Label position (centered in middle panel)
const LABEL_X = FOLD_X1;
const LABEL_Y = FOLD_Y1;

// Colors (matching existing DCM branding)
const COLORS = {
  purplePrimary: '#7c3aed',    // Purple-600
  purpleDark: '#6b46c1',       // Purple-700
  purpleLight: '#f3e8ff',      // Purple-100
  gradientIndigo: '#6366f1',   // Indigo-500

  // Subgrade colors (gradient start colors)
  centeringBlue: '#3b82f6',    // Blue-500
  cornersGreen: '#10b981',     // Green-500
  edgesPurple: '#a855f7',      // Purple-500
  surfaceAmber: '#f59e0b',     // Amber-500

  // Text colors
  textDark: '#1f2937',         // Gray-900
  textMedium: '#4b5563',       // Gray-600
  textLight: '#6b7280',        // Gray-500
  white: '#ffffff',
  grayBorder: '#d1d5db',       // Gray-300

  // Background
  bgLight: '#f9fafb',          // Gray-50
  bgSummary: '#eef2ff',        // Indigo-50
};

export interface FoldableLabelData {
  // Card identification
  cardName: string;
  setName: string;
  cardNumber?: string;
  year?: string;
  specialFeatures?: string;  // "RC • Auto • /99"
  serial: string;            // DCM-XXXXXXXX

  // English fallback for CJK card names (e.g., "Mega Gengar EX" for Japanese cards)
  // Used when cardName contains Japanese/Chinese/Korean characters
  englishName?: string;

  // Grade information
  grade: number | string;
  conditionLabel: string;    // "Gem Mint", "Mint", etc.

  // Subgrades
  subgrades: {
    centering: number | string;
    corners: number | string;
    edges: number | string;
    surface: number | string;
  };

  // Summary
  overallSummary: string;

  // QR Code
  qrCodeDataUrl: string;     // Base64 data URL
  cardUrl: string;           // URL for verification

  // Logo
  logoDataUrl?: string;         // Base64 DCM logo (right-side up)
  rotatedLogoDataUrl?: string;  // Base64 DCM logo (rotated 180° for fold-over labels)
}

/**
 * Generate QR code with DCM logo overlay
 * Must be called from browser context
 */
export async function generateQRCodeWithLogo(url: string): Promise<string> {
  // Dynamic import to avoid SSR issues
  const QRCode = (await import('qrcode')).default;

  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, {
    width: 150,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H', // High error correction for logo overlay
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas.toDataURL('image/png');
  }

  // Load and draw DCM logo in center
  return new Promise((resolve) => {
    const logo = new Image();
    logo.crossOrigin = 'anonymous';

    logo.onload = () => {
      // Calculate logo size (about 20% of QR code size)
      const logoSize = canvas.width * 0.2;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = (canvas.height - logoSize) / 2;

      // Draw white background circle for logo
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, logoSize * 0.6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw logo
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

      resolve(canvas.toDataURL('image/png'));
    };

    logo.onerror = () => {
      // If logo fails to load, return QR code without logo
      console.warn('[FOLDABLE LABEL] Failed to load logo for QR code');
      resolve(canvas.toDataURL('image/png'));
    };

    logo.src = '/DCM-logo.png';
  });
}

/**
 * Generate plain QR code without logo overlay for better scannability
 * Used for smaller labels like Avery where scanning is more challenging
 * Must be called from browser context
 */
export async function generateQRCodePlain(url: string): Promise<string> {
  // Dynamic import to avoid SSR issues
  const QRCode = (await import('qrcode')).default;

  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, {
    width: 150,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M', // Medium error correction (no logo obstruction)
  });

  return canvas.toDataURL('image/png');
}

/**
 * Load DCM logo as base64 data URL
 */
export async function loadLogoAsBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    img.onerror = () => reject(new Error('Failed to load logo'));
    img.src = '/DCM-logo.png';
  });
}

/**
 * Draw rounded rectangle helper
 */
function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  options: { fill?: boolean; stroke?: boolean } = { fill: true, stroke: false }
) {
  doc.roundedRect(x, y, width, height, radius, radius, options.fill && options.stroke ? 'FD' : options.fill ? 'F' : 'S');
}

/**
 * Format grade - v6.0: Always show whole number (no decimals)
 */
function formatGradeDisplay(grade: string | number): string {
  if (typeof grade === 'string') {
    const num = parseFloat(grade);
    if (isNaN(num)) return grade;
    return Math.round(num).toString();
  }
  return Math.round(grade).toString();
}

/**
 * Draw a circle with centered text
 */
function drawSubgradeCircle(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  grade: string | number,
  label: string
) {
  // Draw filled circle
  doc.setFillColor(color);
  doc.circle(centerX, centerY, radius, 'F');

  // Format grade text
  const gradeText = formatGradeDisplay(grade);
  const hasDecimal = gradeText.includes('.');

  // Draw grade text (white, bold, centered)
  // Adjust font size based on whether there's a decimal
  doc.setTextColor(COLORS.white);
  doc.setFontSize(hasDecimal ? 10 : 12);
  doc.setFont('helvetica', 'bold');

  // Center vertically - adjust for font metrics
  const yOffset = hasDecimal ? 3.5 : 4;
  doc.text(gradeText, centerX, centerY + yOffset, { align: 'center' });

  // Draw label below circle
  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text(label, centerX, centerY + radius + 6, { align: 'center' });
}

/**
 * Wrap text to fit within a specified width
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.getTextWidth(testLine);

    if (testWidth > maxWidth && currentLine) {
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
 * Generate the foldable label PDF
 */
export async function generateFoldableLabel(data: FoldableLabelData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  });

  // ============================================
  // DRAW FOLD LINES AND INSTRUCTIONS
  // ============================================

  doc.setDrawColor(COLORS.grayBorder);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([4, 2], 0);

  // Vertical fold lines
  doc.line(FOLD_X1, 0.25 * INCH, FOLD_X1, PAGE_HEIGHT - 0.25 * INCH);
  doc.line(FOLD_X2, 0.25 * INCH, FOLD_X2, PAGE_HEIGHT - 0.25 * INCH);

  // Horizontal fold lines
  doc.line(0.25 * INCH, FOLD_Y1, PAGE_WIDTH - 0.25 * INCH, FOLD_Y1);
  doc.line(0.25 * INCH, FOLD_Y2, PAGE_WIDTH - 0.25 * INCH, FOLD_Y2);

  // Reset dash pattern
  doc.setLineDashPattern([], 0);

  // Fold/Cut labels - using scissors symbol (✂) for cut option
  doc.setTextColor(COLORS.textLight);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');

  // Left fold/cut labels
  doc.text('Fold or Cut', FOLD_X1 - 40, 0.5 * INCH);
  doc.text('Fold or Cut', FOLD_X1 - 40, PAGE_HEIGHT / 2);
  doc.text('Fold or Cut', FOLD_X1 - 40, PAGE_HEIGHT - 0.5 * INCH);

  // Right fold/cut labels
  doc.text('Fold or Cut', FOLD_X2 + 5, 0.5 * INCH);
  doc.text('Fold or Cut', FOLD_X2 + 5, PAGE_HEIGHT / 2);
  doc.text('Fold or Cut', FOLD_X2 + 5, PAGE_HEIGHT - 0.5 * INCH);

  // Bottom fold/cut labels
  doc.text('Fold or Cut', 0.5 * INCH, FOLD_Y2 + 10);
  doc.text('Fold or Cut', PAGE_WIDTH / 2 - 20, FOLD_Y2 + 10);
  doc.text('Fold or Cut', PAGE_WIDTH - 1.2 * INCH, FOLD_Y2 + 10);

  // Top fold/cut labels
  doc.text('Fold or Cut', 0.5 * INCH, FOLD_Y1 - 5);
  doc.text('Fold or Cut', PAGE_WIDTH / 2 - 20, FOLD_Y1 - 5);
  doc.text('Fold or Cut', PAGE_WIDTH - 1.2 * INCH, FOLD_Y1 - 5);

  // ============================================
  // INSTRUCTIONS (Left panel - two options: fold or cut)
  // ============================================

  const instX = 0.5 * INCH;
  const instY = FOLD_Y1 + 0.2 * INCH;

  doc.setTextColor(COLORS.textMedium);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('TWO DISPLAY OPTIONS:', instX, instY);

  // Option A: Cut out label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('OPTION A: Cut Out Label', instX, instY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const cutInstructions = [
    '1. Print at 100% scale',
    '2. Cut along ALL dotted lines',
    '3. Insert label into sleeve, toploader,',
    '   or magnetic holder',
  ];
  cutInstructions.forEach((line, i) => {
    doc.text(line, instX, instY + 30 + (i * 10));
  });

  // Option B: Fold for display stand
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('OPTION B: Fold for Display Stand', instX, instY + 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const foldInstructions = [
    '1. Print at 100% scale',
    '2. Fold ALL edges along dotted lines',
    '3. Tuck flaps behind to create stand',
    '4. Display upright alongside your card',
  ];
  foldInstructions.forEach((line, i) => {
    doc.text(line, instX, instY + 90 + (i * 10));
  });

  // Final size note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Label size: 2.5" x 3.5"', instX, instY + 145);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('(standard trading card dimensions)', instX, instY + 156);

  // ============================================
  // DRAW LABEL BORDER (white background with purple border)
  // ============================================

  // White background for label area
  doc.setFillColor(COLORS.white);
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(2);
  doc.rect(LABEL_X, LABEL_Y, LABEL_WIDTH, LABEL_HEIGHT, 'FD');

  // ============================================
  // HEADER SECTION (White background with purple border, matching card detail page)
  // ============================================

  const headerHeight = 55;
  const headerY = LABEL_Y;

  // Header with white background and purple border (matching card detail page style)
  doc.setFillColor(COLORS.white);
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(1.5);
  doc.rect(LABEL_X + 1, headerY + 1, LABEL_WIDTH - 2, headerHeight, 'FD');

  // DCM Logo (left side)
  const logoX = LABEL_X + 6;
  const logoY = headerY + 10;
  const logoSize = 38;

  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      // Draw fallback text if logo fails
      doc.setTextColor(COLORS.purplePrimary);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DCM', logoX + 8, logoY + 25);
    }
  } else {
    // Draw fallback text
    doc.setTextColor(COLORS.purplePrimary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DCM', logoX + 8, logoY + 25);
  }

  // Card info (center) - more space, better fit
  const infoX = LABEL_X + 48;
  const infoMaxWidth = LABEL_WIDTH - 100;

  // Use ASCII-safe text for jsPDF (CJK fonts not supported by default)
  // Pass englishName as fallback for Japanese/Chinese/Korean cards
  const safeCardName = extractAsciiSafe(data.cardName, 'Card', data.englishName);
  const safeSetName = data.setName ? extractAsciiSafe(data.setName, '') : '';
  const safeCardNumber = data.cardNumber ? extractAsciiSafe(data.cardNumber, '') : '';
  const safeYear = data.year ? extractAsciiSafe(data.year, '') : '';
  const safeFeatures = data.specialFeatures ? extractAsciiSafe(data.specialFeatures, '') : '';

  // Line 1: Player/Character Name (dark text, bold, dynamic font size)
  doc.setTextColor(COLORS.textDark);
  doc.setFont('helvetica', 'bold');

  // Dynamic font size for player name to fit without truncation
  let playerFontSize = 9;
  doc.setFontSize(playerFontSize);
  while (doc.getTextWidth(safeCardName) > infoMaxWidth && playerFontSize > 5) {
    playerFontSize -= 0.5;
    doc.setFontSize(playerFontSize);
  }
  doc.text(safeCardName, infoX, headerY + 13);

  // Line 2: Set Name • Card Number • Year (gray text, with wrapping if needed)
  doc.setTextColor(COLORS.textMedium);
  doc.setFont('helvetica', 'normal');
  const setInfo = [safeSetName, safeCardNumber, safeYear].filter(Boolean).join(' • ');

  // Start with font size 6, shrink if needed, then wrap if still too long
  let setFontSize = 6;
  doc.setFontSize(setFontSize);

  // First, try to fit on one line by reducing font size
  while (doc.getTextWidth(setInfo) > infoMaxWidth && setFontSize > 5) {
    setFontSize -= 0.5;
    doc.setFontSize(setFontSize);
  }

  // If still too long, wrap to multiple lines
  let currentY = headerY + 24;
  if (doc.getTextWidth(setInfo) > infoMaxWidth) {
    const setLines = wrapText(doc, setInfo, infoMaxWidth, setFontSize);
    setLines.slice(0, 2).forEach((line, i) => {  // Max 2 lines for set info
      doc.text(line, infoX, currentY + (i * 8));
    });
    currentY += (Math.min(setLines.length, 2) - 1) * 8;
  } else {
    doc.text(setInfo, infoX, currentY);
  }

  // Line 3: Special features (if any) - blue text
  let line3Y = currentY + 10;
  if (safeFeatures) {
    doc.setTextColor('#2563eb'); // Blue-600
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(safeFeatures, infoX, line3Y);
    line3Y += 9;
  }

  // Line 4: Serial number (gray, monospace style)
  doc.setTextColor(COLORS.textLight);
  doc.setFontSize(5);
  doc.setFont('courier', 'normal');
  doc.text(data.serial, infoX, line3Y);

  // Grade display (right side) - purple text on white
  const gradeX = LABEL_X + LABEL_WIDTH - 28;
  const gradeText = formatGradeDisplay(data.grade);
  const hasDecimal = gradeText.includes('.');

  doc.setTextColor(COLORS.purplePrimary);
  doc.setFontSize(hasDecimal ? 16 : 20);
  doc.setFont('helvetica', 'bold');
  doc.text(gradeText, gradeX, headerY + 26, { align: 'center' });

  // Divider line under grade (purple)
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(1);
  doc.line(gradeX - 14, headerY + 32, gradeX + 14, headerY + 32);

  // Condition label (purple)
  doc.setTextColor(COLORS.purplePrimary);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text(data.conditionLabel.toUpperCase(), gradeX, headerY + 42, { align: 'center' });

  // ============================================
  // SUBGRADES SECTION (2x2 grid with QR in center)
  // ============================================

  const subgradesY = headerY + headerHeight + 8;
  const circleRadius = 16;

  // Position circles in corners with QR code in center
  const leftColX = LABEL_X + 28;
  const rightColX = LABEL_X + LABEL_WIDTH - 28;
  const row1Y = subgradesY + 18;
  const row2Y = subgradesY + 60;

  // Row 1: Centering (left), Corners (right)
  drawSubgradeCircle(doc, leftColX, row1Y, circleRadius, COLORS.centeringBlue, data.subgrades.centering, 'CENTERING');
  drawSubgradeCircle(doc, rightColX, row1Y, circleRadius, COLORS.cornersGreen, data.subgrades.corners, 'CORNERS');

  // Row 2: Edges (left), Surface (right)
  drawSubgradeCircle(doc, leftColX, row2Y, circleRadius, COLORS.edgesPurple, data.subgrades.edges, 'EDGES');
  drawSubgradeCircle(doc, rightColX, row2Y, circleRadius, COLORS.surfaceAmber, data.subgrades.surface, 'SURFACE');

  // QR Code in center of subgrades
  const qrSize = 42;
  const qrX = LABEL_X + (LABEL_WIDTH - qrSize) / 2;
  const qrY = subgradesY + 18;

  if (data.qrCodeDataUrl) {
    try {
      doc.addImage(data.qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      // Draw placeholder if QR fails
      doc.setDrawColor(COLORS.grayBorder);
      doc.setLineWidth(0.5);
      doc.rect(qrX, qrY, qrSize, qrSize, 'S');
    }
  }

  // ============================================
  // OVERALL SUMMARY SECTION (expanded)
  // ============================================

  const summaryY = row2Y + 32;
  const summaryHeight = LABEL_Y + LABEL_HEIGHT - summaryY - 6; // Use remaining space
  const summaryPadding = 6;

  // Summary background
  doc.setFillColor(COLORS.bgSummary);
  drawRoundedRect(doc, LABEL_X + 4, summaryY, LABEL_WIDTH - 8, summaryHeight, 3, { fill: true });

  // Summary title
  doc.setTextColor(COLORS.purpleDark);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OVERALL CARD CONDITION SUMMARY', LABEL_X + 4 + summaryPadding, summaryY + 9);

  // Summary text (wrapped) - more lines allowed
  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');

  const summaryMaxWidth = LABEL_WIDTH - 20;
  const summaryLines = wrapText(doc, data.overallSummary, summaryMaxWidth, 5);
  const maxLines = 8; // Increased from 5
  const displayLines = summaryLines.slice(0, maxLines);

  displayLines.forEach((line, i) => {
    // Add ellipsis to last line if truncated
    const isLastLine = i === displayLines.length - 1;
    const hasMoreLines = summaryLines.length > maxLines;
    let displayLine = line;
    if (isLastLine && hasMoreLines && line.length > 3) {
      displayLine = line.slice(0, -3) + '...';
    }
    doc.text(displayLine, LABEL_X + 4 + summaryPadding, summaryY + 18 + (i * 7));
  });

  // ============================================
  // RETURN PDF BLOB
  // ============================================

  return doc.output('blob');
}

/**
 * Generate and download the foldable label
 */
export async function downloadFoldableLabel(data: FoldableLabelData, filename: string): Promise<void> {
  const blob = await generateFoldableLabel(data);

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
