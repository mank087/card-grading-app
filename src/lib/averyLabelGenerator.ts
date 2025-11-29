/**
 * Avery 6871 Label PDF Generator
 *
 * Generates labels on Avery 6871 template (18 labels per sheet, 3×6 grid).
 * Each label is 2.5" × 1" with rounded corners.
 *
 * Label Design (folds over magnetic one-touch slab):
 * - TOP HALF (back when folded): QR code upside down, centered
 * - CENTER: Purple "Dynamic Collectibles Management" bar (sits at top edge of holder)
 * - BOTTOM HALF (front when folded): Card details + grade
 * - Purple rounded border around entire label
 *
 * Uses the same FoldableLabelData interface for consistency with other reports.
 */

import { jsPDF } from 'jspdf';
import { FoldableLabelData } from './foldableLabelGenerator';

// Page dimensions (in points: 1 inch = 72 points)
const INCH = 72;
const PAGE_WIDTH = 8.5 * INCH;   // Portrait width
const PAGE_HEIGHT = 11 * INCH;  // Portrait height

// Avery 6871 label specifications (extracted directly from official Avery PDF template)
// Label size: 2-3/8" x 1-1/4" (2.375" x 1.25")
const LABEL_WIDTH = 2.375 * INCH;
const LABEL_HEIGHT = 1.25 * INCH;
const CORNER_RADIUS = 6; // Rounded corners in points

// Avery 6871 margins and spacing (exact values from PDF template rectangles)
// First label at (0.375", 1.125"), gaps calculated from label positions
const TOP_MARGIN = 1.125 * INCH;      // 1.125 inches = 1-1/8" = 81 points
const LEFT_MARGIN = 0.375 * INCH;     // 0.375 inches = 3/8" = 27 points
const HORIZONTAL_GAP = 0.3125 * INCH; // 0.3125 inches = 5/16" = 22.5 points (exact from PDF)
const VERTICAL_GAP = 0.25 * INCH;     // 0.25 inches = 1/4" = 18 points

// Grid configuration
const COLUMNS = 3;
const ROWS = 6;
const TOTAL_LABELS = COLUMNS * ROWS; // 18 labels

// Colors (matching DCM branding from foldable label)
// Using darker colors for better print visibility
const COLORS = {
  purplePrimary: '#7c3aed',    // Purple-600
  purpleDark: '#6b46c1',       // Purple-700
  purpleLight: '#f3e8ff',      // Purple-100
  textDark: '#000000',         // Pure black for best print visibility
  textMedium: '#1f2937',       // Gray-900 (darker than before)
  textLight: '#374151',        // Gray-700 (darker for serial number visibility)
  white: '#ffffff',
  grayBorder: '#e5e7eb',       // Gray-200
  blue: '#1d4ed8',             // Blue-700 for special features (darker)
};

export interface LabelPosition {
  row: number;    // 0-5
  column: number; // 0-2
}

/**
 * Calculate the X,Y position of a label on the sheet
 */
function getLabelPosition(position: LabelPosition): { x: number; y: number } {
  const x = LEFT_MARGIN + (position.column * (LABEL_WIDTH + HORIZONTAL_GAP));
  const y = TOP_MARGIN + (position.row * (LABEL_HEIGHT + VERTICAL_GAP));
  return { x, y };
}

/**
 * Format grade - show whole number unless it has a meaningful decimal
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
 * Truncate text to fit within a maximum width
 */
function truncateText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string {
  doc.setFontSize(fontSize);
  if (doc.getTextWidth(text) <= maxWidth) return text;

  let truncated = text;
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Fit text to a maximum width by reducing font size
 */
function fitTextToWidth(doc: jsPDF, text: string, maxWidth: number, startFontSize: number, minFontSize: number = 4): number {
  let fontSize = startFontSize;
  doc.setFontSize(fontSize);

  while (doc.getTextWidth(text) > maxWidth && fontSize > minFontSize) {
    fontSize -= 0.5;
    doc.setFontSize(fontSize);
  }

  return fontSize;
}

/**
 * Draw a single Avery label at the specified position
 *
 * Layout (label folds over one-touch slab):
 * ┌─────────────────────────────┐
 * │     QR CODE (upside down)   │  ← Back (top half)
 * │         (centered)          │
 * ├─────────────────────────────┤  ← Fold line (purple bar)
 * │ Dynamic Collectibles Mgmt   │
 * ├─────────────────────────────┤
 * │ [LOGO] Card Name    │  10   │  ← Front (bottom half)
 * │        Set • Year   │ ────  │
 * │        RC • Auto    │ GEM   │
 * │        DCM-123456   │ MINT  │
 * └─────────────────────────────┘
 */
function drawLabel(doc: jsPDF, data: FoldableLabelData, position: LabelPosition) {
  const { x, y } = getLabelPosition(position);

  const padding = 3;
  const halfHeight = LABEL_HEIGHT / 2;
  const purpleBarHeight = 10;

  // ============================================
  // PURPLE BORDER (entire label outline)
  // Thicker border that bleeds outward (print-to-edge labels)
  // Draw slightly inside the boundary so stroke bleeds outward
  // ============================================
  const borderWidth = 3;  // Thicker border for visibility
  const borderInset = borderWidth / 2;  // Half stroke width to keep inner edge aligned
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(borderWidth);
  doc.roundedRect(
    x + borderInset,
    y + borderInset,
    LABEL_WIDTH - borderWidth,
    LABEL_HEIGHT - borderWidth,
    CORNER_RADIUS,
    CORNER_RADIUS,
    'S'
  );

  // ============================================
  // CENTER: Purple "Dynamic Collectibles Management" bar
  // This sits at the fold line (center of label)
  // Extends to meet the border (no gap)
  // ============================================
  const purpleBarY = y + halfHeight - (purpleBarHeight / 2);

  doc.setFillColor(COLORS.purplePrimary);
  // Extend bar to inner edge of border stroke
  doc.rect(x + borderInset, purpleBarY, LABEL_WIDTH - borderWidth, purpleBarHeight, 'F');

  // Header text - centered
  doc.setTextColor(COLORS.white);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Dynamic Collectibles Management', x + LABEL_WIDTH / 2, purpleBarY + 7, { align: 'center' });

  // ============================================
  // TOP HALF (BACK): QR Code upside down, centered
  // The QR is drawn upside down so when the label folds over,
  // it appears right-side up on the back of the slab
  // ============================================
  const backAreaY = y + padding;
  const backAreaHeight = halfHeight - (purpleBarHeight / 2) - padding;
  const qrSize = Math.min(backAreaHeight - 2, 24); // Fit within back area
  const qrX = x + (LABEL_WIDTH - qrSize) / 2; // Centered horizontally
  const qrY = backAreaY + (backAreaHeight - qrSize) / 2; // Centered vertically in back area

  // Draw QR code - the rotation will be handled by passing rotatedQrCodeDataUrl
  // For now, draw it normally - rotation is done in the caller
  if (data.qrCodeDataUrl) {
    try {
      doc.addImage(data.qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      // Draw placeholder if QR fails
      doc.setDrawColor(COLORS.grayBorder);
      doc.setLineWidth(0.5);
      doc.rect(qrX, qrY, qrSize, qrSize, 'S');
      doc.setTextColor(COLORS.textLight);
      doc.setFontSize(5);
      doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2 + 2, { align: 'center' });
    }
  }

  // ============================================
  // BOTTOM HALF (FRONT): DCM Logo + Card details + Grade
  // Position content at the very bottom edge so it's visible when folded over slab
  // Label is now 1.25" tall, so bottom half has more space
  // ============================================

  // Calculate positions from the absolute bottom of the label
  const labelBottom = y + LABEL_HEIGHT;
  const bottomPadding = 3; // Small padding from edge

  // Logo positioned at bottom left
  const logoSize = 24; // Slightly larger logo since we have more height
  const logoX = x + padding + 2;
  const logoY = labelBottom - bottomPadding - logoSize - 2;

  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      // Fallback text if logo fails
      doc.setTextColor(COLORS.purplePrimary);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('DCM', logoX + 4, logoY + 14);
    }
  }

  // Calculate layout - card info in center, grade on right
  const gradeAreaWidth = 28;
  const cardInfoX = logoX + logoSize + 4;
  const cardInfoWidth = LABEL_WIDTH - logoSize - gradeAreaWidth - (padding * 4);

  // 4 lines of text, positioned at the bottom
  // Line 4 (serial) at very bottom, work upward
  const lineHeight = 5.5; // More line spacing with taller label
  const line4Y = labelBottom - bottomPadding - 2; // Serial at bottom
  const line3Y = line4Y - lineHeight;              // Features
  const line2Y = line3Y - lineHeight;              // Set info
  const line1Y = line2Y - lineHeight;              // Card name

  // Line 1: Player/Card Name (bold) - dynamic font size, starts larger
  doc.setTextColor(COLORS.textDark);
  doc.setFont('helvetica', 'bold');
  fitTextToWidth(doc, data.cardName, cardInfoWidth, 7, 4);  // Start at 7pt, min 4pt
  doc.text(data.cardName, cardInfoX, line1Y);

  // Line 2: Set Name • Card Number • Year - dynamic font size
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.textMedium);
  const setInfo = [data.setName, data.cardNumber, data.year].filter(Boolean).join(' • ');
  fitTextToWidth(doc, setInfo, cardInfoWidth, 6, 3.5);  // Start at 6pt, min 3.5pt
  doc.text(setInfo, cardInfoX, line2Y);

  // Line 3: Special features (if any) - blue text, dynamic font size
  if (data.specialFeatures) {
    doc.setTextColor(COLORS.blue);
    doc.setFont('helvetica', 'bold');
    fitTextToWidth(doc, data.specialFeatures, cardInfoWidth, 6, 3.5);  // Start at 6pt, min 3.5pt
    doc.text(data.specialFeatures, cardInfoX, line3Y);
  }

  // Line 4: Serial number - bold for visibility
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.textLight);
  fitTextToWidth(doc, data.serial, cardInfoWidth, 5.5, 3.5);  // Start at 5.5pt, min 3.5pt
  doc.text(data.serial, cardInfoX, line4Y);

  // ============================================
  // GRADE (right side) - matching downloadable report style
  // Grade number, purple line, condition label (no box)
  // Positioned at bottom right
  // ============================================
  const gradeX = x + LABEL_WIDTH - padding - gradeAreaWidth / 2 - 2;

  // Position grade so condition label is near bottom
  const conditionY = labelBottom - bottomPadding - 2;
  const gradeLine = conditionY - 6;
  const gradeNumY = gradeLine - 4;

  // Grade number (large, purple) - increased sizes for visibility
  const gradeText = formatGradeDisplay(data.grade);
  const hasDecimal = gradeText.includes('.');
  doc.setTextColor(COLORS.purplePrimary);
  doc.setFontSize(hasDecimal ? 12 : 14);  // Increased from 10/12 to 12/14
  doc.setFont('helvetica', 'bold');
  doc.text(gradeText, gradeX, gradeNumY, { align: 'center' });

  // Horizontal purple line under grade
  const lineWidth = 20;
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(1);
  doc.line(gradeX - lineWidth / 2, gradeLine, gradeX + lineWidth / 2, gradeLine);

  // Condition label (below line) - increased size for visibility
  doc.setTextColor(COLORS.purplePrimary);
  doc.setFontSize(5);  // Increased from 4 to 5
  doc.setFont('helvetica', 'bold');
  const conditionText = data.conditionLabel.toUpperCase();
  doc.text(conditionText, gradeX, conditionY, { align: 'center' });
}

/**
 * Generate a preview grid showing all 18 label positions
 * Returns SVG markup for the position selector UI
 */
export function generatePositionSelectorSVG(selectedPosition: number | null): string {
  const svgWidth = 170;
  const svgHeight = 220;
  const labelW = 50;
  const labelH = 33;
  const gap = 2;
  const offsetX = 10;
  const offsetY = 10;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // Background (page)
  svg += `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1" rx="4"/>`;

  // Draw grid of labels
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const index = row * COLUMNS + col;
      const x = offsetX + col * (labelW + gap);
      const y = offsetY + row * (labelH + gap);
      const isSelected = selectedPosition === index;

      const fill = isSelected ? '#7c3aed' : '#ffffff';
      const stroke = isSelected ? '#6b46c1' : '#d1d5db';
      const textColor = isSelected ? '#ffffff' : '#6b7280';

      svg += `<rect x="${x}" y="${y}" width="${labelW}" height="${labelH}" fill="${fill}" stroke="${stroke}" stroke-width="1" rx="3" class="cursor-pointer hover:stroke-purple-500" data-position="${index}"/>`;
      svg += `<text x="${x + labelW/2}" y="${y + labelH/2 + 4}" text-anchor="middle" fill="${textColor}" font-size="10" font-family="Arial">${index + 1}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Convert position index (0-17) to row/column
 */
export function indexToPosition(index: number): LabelPosition {
  return {
    row: Math.floor(index / COLUMNS),
    column: index % COLUMNS
  };
}

/**
 * Convert row/column to position index (0-17)
 */
export function positionToIndex(position: LabelPosition): number {
  return position.row * COLUMNS + position.column;
}

/**
 * Generate an Avery 6871 label PDF with a single label at the specified position
 */
export async function generateAveryLabel(
  data: FoldableLabelData,
  positionIndex: number
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Validate position
  if (positionIndex < 0 || positionIndex >= TOTAL_LABELS) {
    throw new Error(`Invalid position index: ${positionIndex}. Must be 0-${TOTAL_LABELS - 1}`);
  }

  const position = indexToPosition(positionIndex);

  // Draw the label at the selected position
  drawLabel(doc, data, position);

  return doc.output('blob');
}

/**
 * Generate and download an Avery label
 */
export async function downloadAveryLabel(
  data: FoldableLabelData,
  positionIndex: number,
  filename: string
): Promise<void> {
  const blob = await generateAveryLabel(data, positionIndex);

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

/**
 * Get label count and configuration for UI display
 */
export function getAveryConfig() {
  return {
    columns: COLUMNS,
    rows: ROWS,
    totalLabels: TOTAL_LABELS,
    labelWidth: LABEL_WIDTH / INCH,  // in inches
    labelHeight: LABEL_HEIGHT / INCH, // in inches
    templateName: 'Avery 6871',
    description: '18 labels per sheet (3×6 grid), 2-3/8" × 1-1/4" each'
  };
}
