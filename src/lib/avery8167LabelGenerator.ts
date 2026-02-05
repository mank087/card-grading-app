/**
 * Avery 8167 Label PDF Generator
 *
 * Generates labels on Avery 8167 template (80 labels per sheet, 4×20 grid).
 * Each label is 1.75" × 0.5" - designed for toploader stickers.
 *
 * Two label types:
 * - FRONT: Horizontal layout with DCM color logo (left) + card name (center) + grade/condition (right)
 * - BACK: Centered QR code with subtle DCM logo watermark pattern
 *
 * Uses the same FoldableLabelData interface for consistency with other reports.
 */

import { jsPDF, GState } from 'jspdf';
import QRCode from 'qrcode';
import { FoldableLabelData, loadLogoAsBase64 } from './foldableLabelGenerator';

// Page dimensions (in points: 1 inch = 72 points)
const INCH = 72;
const PAGE_WIDTH = 8.5 * INCH;   // Portrait width
const PAGE_HEIGHT = 11 * INCH;  // Portrait height

// Avery 8167 label specifications
// Label size: 1-3/4" x 1/2" (1.75" x 0.5")
const LABEL_WIDTH = 1.75 * INCH;
const LABEL_HEIGHT = 0.5 * INCH;
const CORNER_RADIUS = 3; // Small rounded corners in points

// Avery 8167 margins and spacing
const TOP_MARGIN = 0.5 * INCH;        // 0.5 inches
const LEFT_MARGIN = 0.28125 * INCH;   // 9/32 inches
const HORIZONTAL_GAP = 0.3125 * INCH; // 5/16 inches between columns
const VERTICAL_GAP = 0;               // No gap between rows

// Grid configuration
const COLUMNS = 4;
const ROWS = 20;
const TOTAL_LABELS = COLUMNS * ROWS; // 80 labels

// Colors (matching DCM branding)
const COLORS = {
  purplePrimary: '#7c3aed',    // Purple-600
  purpleDark: '#6d28d9',       // Purple-700
  purpleLight: '#a78bfa',      // Purple-400 for subtle accents
  white: '#ffffff',
  textDark: '#1f2937',         // Gray-800
};

export interface LabelPosition8167 {
  row: number;    // 0-19
  column: number; // 0-3
}

/**
 * Calibration offsets for printer alignment (in inches)
 */
export interface CalibrationOffsets {
  x: number;  // Horizontal offset in inches
  y: number;  // Vertical offset in inches
}

/**
 * Simple label data for 8167 toploader labels
 */
export interface ToploaderLabelData {
  grade: number | string;
  conditionLabel: string;
  qrCodeUrl: string;
  cardName?: string; // Card/player name for identification
}

/**
 * Calculate the X,Y position of a label on the sheet
 */
function getLabelPosition(position: LabelPosition8167, offsets?: CalibrationOffsets): { x: number; y: number } {
  const offsetX = (offsets?.x || 0) * INCH;
  const offsetY = (offsets?.y || 0) * INCH;

  const x = LEFT_MARGIN + (position.column * (LABEL_WIDTH + HORIZONTAL_GAP)) + offsetX;
  const y = TOP_MARGIN + (position.row * (LABEL_HEIGHT + VERTICAL_GAP)) + offsetY;
  return { x, y };
}

/**
 * Convert position index (0-79) to row/column
 */
export function indexToPosition8167(index: number): LabelPosition8167 {
  const row = Math.floor(index / COLUMNS);
  const column = index % COLUMNS;
  return { row, column };
}

/**
 * Convert row/column to position index
 */
export function positionToIndex8167(position: LabelPosition8167): number {
  return position.row * COLUMNS + position.column;
}

/**
 * Format grade - Always show whole number
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
 * Generate QR code as base64 data URL
 */
async function generateQRCodeBase64(url: string, size: number = 100): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw error;
  }
}


/**
 * Draw the FRONT label - Horizontal layout:
 * [DCM Logo] | Card Name | Grade + Condition
 */
function drawFrontLabel(
  doc: jsPDF,
  x: number,
  y: number,
  data: ToploaderLabelData,
  logoBase64: string
): void {
  const labelW = LABEL_WIDTH;
  const labelH = LABEL_HEIGHT;

  // Layout widths
  const logoAreaWidth = labelH + 4; // Square area for logo plus padding
  const gradeAreaWidth = 28; // Width for grade section on right
  const cardNameAreaWidth = labelW - logoAreaWidth - gradeAreaWidth - 4; // Remaining space for card name

  // STEP 1: Draw WHITE background for entire label
  doc.setFillColor(COLORS.white);
  doc.roundedRect(x, y, labelW, labelH, CORNER_RADIUS, CORNER_RADIUS, 'F');

  // STEP 2: Draw small purple accent line on the left edge
  doc.setFillColor(COLORS.purplePrimary);
  doc.roundedRect(x, y, 3, labelH, CORNER_RADIUS, 0, 'F');

  // STEP 3: Draw DCM logo (color logo) on left side
  const logoSize = labelH * 0.80; // 80% of label height
  const logoX = x + 5;
  const logoY = y + (labelH - logoSize) / 2;

  try {
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
    } else {
      throw new Error('No logo');
    }
  } catch (e) {
    // Fallback: draw "DCM" text if logo fails
    doc.setFontSize(7);
    doc.setTextColor(COLORS.purplePrimary);
    doc.setFont('helvetica', 'bold');
    doc.text('DCM', x + 8, y + labelH / 2 + 2);
  }

  // STEP 4: Draw card name in middle section with text wrapping
  const cardNameX = x + logoAreaWidth + 2;
  const cardNameMaxWidth = cardNameAreaWidth - 4;

  if (data.cardName) {
    doc.setTextColor(COLORS.textDark);
    doc.setFont('helvetica', 'bold');

    const fullName = data.cardName;

    // Try to fit on one line first, starting with larger font
    doc.setFontSize(6);
    const textWidth = doc.getTextWidth(fullName);

    if (textWidth <= cardNameMaxWidth) {
      // Fits on one line - center vertically
      doc.text(fullName, cardNameX, y + labelH / 2 + 2);
    } else {
      // Need to wrap to 2 lines - use smaller font
      doc.setFontSize(5);

      // Split into words and build two lines
      const words = fullName.split(' ');
      let line1 = '';
      let line2 = '';
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
        const testWidth = doc.getTextWidth(testLine);

        if (testWidth <= cardNameMaxWidth) {
          currentLine = testLine;
        } else {
          if (!line1) {
            // First line is full, move to second
            line1 = currentLine || words[i];
            currentLine = currentLine ? words[i] : '';
          } else {
            // Already have line1, continue building line2
            currentLine = testLine;
          }
        }
      }

      // Assign remaining text
      if (!line1) {
        line1 = currentLine;
      } else if (!line2) {
        line2 = currentLine;
      }

      // If line2 is too long, truncate it with ellipsis
      if (line2 && doc.getTextWidth(line2) > cardNameMaxWidth) {
        while (doc.getTextWidth(line2 + '...') > cardNameMaxWidth && line2.length > 1) {
          line2 = line2.slice(0, -1);
        }
        line2 = line2.trim() + '...';
      }

      // Draw lines - position based on whether we have 1 or 2 lines
      const lineHeight = 6;
      if (line2) {
        // Two lines - offset from center
        doc.text(line1, cardNameX, y + labelH / 2 - 1);
        doc.text(line2, cardNameX, y + labelH / 2 + lineHeight - 1);
      } else {
        // Only one line (edge case)
        doc.text(line1, cardNameX, y + labelH / 2 + 2);
      }
    }
  }

  // STEP 5: Draw vertical separator line before grade section
  const separatorX = x + labelW - gradeAreaWidth - 2;
  doc.setDrawColor(COLORS.purpleLight);
  doc.setLineWidth(0.5);
  doc.line(separatorX, y + 3, separatorX, y + labelH - 3);

  // STEP 6: Draw grade number on right side
  const gradeX = x + labelW - gradeAreaWidth / 2 - 1;
  const gradeText = formatGradeDisplay(data.grade);

  // Grade number - larger, at top of grade area
  doc.setFontSize(12);
  doc.setTextColor(COLORS.purplePrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(gradeText, gradeX, y + labelH * 0.42, { align: 'center' });

  // Draw SHORT horizontal purple line under the grade number
  const lineY = y + labelH * 0.52;
  const lineWidth = 12;
  doc.setDrawColor(COLORS.purplePrimary);
  doc.setLineWidth(0.75);
  doc.line(gradeX - lineWidth / 2, lineY, gradeX + lineWidth / 2, lineY);

  // Condition label below line
  const conditionText = data.conditionLabel.toUpperCase();
  const conditionFontSize = conditionText.length > 10 ? 3 : conditionText.length > 7 ? 3.5 : 4;
  doc.setFontSize(conditionFontSize);
  doc.setTextColor(COLORS.purplePrimary);
  doc.setFont('helvetica', 'bold');
  doc.text(conditionText, gradeX, y + labelH * 0.78, { align: 'center' });
}

/**
 * Draw the BACK label (QR code with subtle DCM logo watermark pattern)
 */
async function drawBackLabel(
  doc: jsPDF,
  x: number,
  y: number,
  qrCodeBase64: string,
  colorLogoBase64?: string
): Promise<void> {
  const labelW = LABEL_WIDTH;
  const labelH = LABEL_HEIGHT;

  // Draw white background
  doc.setFillColor(COLORS.white);
  doc.roundedRect(x, y, labelW, labelH, CORNER_RADIUS, CORNER_RADIUS, 'F');

  // Calculate QR code position and size
  const qrSize = labelH * 0.85; // 85% of label height for good scannability
  const qrX = x + (labelW - qrSize) / 2;
  const qrY = y + (labelH - qrSize) / 2;

  // Draw watermark pattern of DCM logos (if logo available)
  if (colorLogoBase64) {
    try {
      // Save graphics state and set low opacity for watermark
      doc.saveGraphicsState();
      const gState = new GState({ opacity: 0.08 }); // Very subtle watermark
      doc.setGState(gState);

      // Small logo size for watermark pattern
      const watermarkSize = 12; // Small logos
      const spacing = 16; // Space between logos

      // Draw logos on left side of label (before QR)
      const leftAreaEnd = qrX - 2;
      for (let wx = x + 2; wx < leftAreaEnd; wx += spacing) {
        for (let wy = y + 2; wy < y + labelH - watermarkSize; wy += spacing) {
          doc.addImage(colorLogoBase64, 'PNG', wx, wy, watermarkSize, watermarkSize);
        }
      }

      // Draw logos on right side of label (after QR)
      const rightAreaStart = qrX + qrSize + 2;
      for (let wx = rightAreaStart; wx < x + labelW - 2; wx += spacing) {
        for (let wy = y + 2; wy < y + labelH - watermarkSize; wy += spacing) {
          doc.addImage(colorLogoBase64, 'PNG', wx, wy, watermarkSize, watermarkSize);
        }
      }

      // Restore graphics state
      doc.restoreGraphicsState();
    } catch (e) {
      console.warn('Failed to draw watermark pattern:', e);
    }
  }

  // Draw QR code centered (on top of watermark)
  doc.addImage(qrCodeBase64, 'PNG', qrX, qrY, qrSize, qrSize);
}

/**
 * Generate a single front label at specified position
 */
export async function generateFrontLabel8167(
  data: ToploaderLabelData,
  positionIndex: number,
  offsets?: CalibrationOffsets
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const position = indexToPosition8167(positionIndex);
  const { x, y } = getLabelPosition(position, offsets);

  // Load color logo for front label (white background)
  const logoBase64 = await loadLogoAsBase64();

  drawFrontLabel(doc, x, y, data, logoBase64);

  return doc.output('blob');
}

/**
 * Generate a single back label at specified position
 */
export async function generateBackLabel8167(
  qrCodeUrl: string,
  positionIndex: number,
  offsets?: CalibrationOffsets
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const position = indexToPosition8167(positionIndex);
  const { x, y } = getLabelPosition(position, offsets);

  // Generate QR code and load color logo for watermark
  const [qrCodeBase64, colorLogoBase64] = await Promise.all([
    generateQRCodeBase64(qrCodeUrl, 200),
    loadLogoAsBase64().catch(() => undefined)
  ]);

  await drawBackLabel(doc, x, y, qrCodeBase64, colorLogoBase64);

  return doc.output('blob');
}

/**
 * Generate a sheet with multiple front labels
 */
export async function generateFrontLabelSheet8167(
  labels: ToploaderLabelData[],
  startPosition: number = 0,
  offsets?: CalibrationOffsets
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo for front labels (white background)
  const logoBase64 = await loadLogoAsBase64();

  for (let i = 0; i < labels.length; i++) {
    const positionIndex = startPosition + i;
    if (positionIndex >= TOTAL_LABELS) break;

    const position = indexToPosition8167(positionIndex);
    const { x, y } = getLabelPosition(position, offsets);

    drawFrontLabel(doc, x, y, labels[i], logoBase64);
  }

  return doc.output('blob');
}

/**
 * Generate a sheet with multiple back labels
 */
export async function generateBackLabelSheet8167(
  qrCodeUrls: string[],
  startPosition: number = 0,
  offsets?: CalibrationOffsets
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo once for watermark
  const colorLogoBase64 = await loadLogoAsBase64().catch(() => undefined);

  for (let i = 0; i < qrCodeUrls.length; i++) {
    const positionIndex = startPosition + i;
    if (positionIndex >= TOTAL_LABELS) break;

    const position = indexToPosition8167(positionIndex);
    const { x, y } = getLabelPosition(position, offsets);

    const qrCodeBase64 = await generateQRCodeBase64(qrCodeUrls[i], 200);
    await drawBackLabel(doc, x, y, qrCodeBase64, colorLogoBase64);
  }

  return doc.output('blob');
}

/**
 * Generate a test/preview sheet showing the label design
 */
export async function generatePreviewSheet8167(): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo (used for both front labels and back watermarks)
  let colorLogoBase64: string = '';
  try {
    colorLogoBase64 = await loadLogoAsBase64();
  } catch (e) {
    // Continue without logo
  }

  // Sample card names to demonstrate wrapping behavior
  const sampleCardNames = [
    'Pikachu VMAX',                           // Short - fits on one line
    'Michael Jordan',                          // Medium - fits on one line
    'Patrick Mahomes II',                      // Medium - might wrap
    'Charizard Base Set Shadowless',           // Long - will wrap to 2 lines
    'LeBron James Rookie Card Auto',           // Long - will wrap to 2 lines
  ];

  // Sample data for preview
  const baseSampleData: ToploaderLabelData = {
    grade: 9,
    conditionLabel: 'Mint',
    qrCodeUrl: 'https://dcmgrading.com/pokemon/sample',
    cardName: 'Sample Card',
  };

  // Generate sample QR code
  const qrCodeBase64 = await generateQRCodeBase64(baseSampleData.qrCodeUrl, 200);

  // Draw a few sample labels to show the design
  // Front labels in first column - show different card name lengths
  for (let row = 0; row < 5; row++) {
    const position = { row, column: 0 };
    const { x, y } = getLabelPosition(position);
    drawFrontLabel(doc, x, y, {
      ...baseSampleData,
      grade: 10 - row,
      cardName: sampleCardNames[row],
      conditionLabel: row === 0 ? 'Gem Mint' : row === 4 ? 'Near Mint-Mint' : 'Mint'
    }, colorLogoBase64);
  }

  // Back labels in second column
  for (let row = 0; row < 5; row++) {
    const position = { row, column: 1 };
    const { x, y } = getLabelPosition(position);
    await drawBackLabel(doc, x, y, qrCodeBase64, colorLogoBase64);
  }

  // No title on the PDF - labels must align with Avery 8167 template
  // Title would overlap the first row of labels

  return doc.output('blob');
}

// Export constants for UI components
export const AVERY_8167_COLUMNS = COLUMNS;
export const AVERY_8167_ROWS = ROWS;
export const AVERY_8167_TOTAL = TOTAL_LABELS;

/**
 * Get label count and configuration for UI display
 */
export function getAvery8167Config() {
  return {
    columns: COLUMNS,
    rows: ROWS,
    totalLabels: TOTAL_LABELS,
    labelWidth: LABEL_WIDTH / INCH,  // in inches
    labelHeight: LABEL_HEIGHT / INCH, // in inches
    templateName: 'Avery 8167',
    description: '80 labels per sheet (4×20 grid), 1.75" × 0.5" each'
  };
}

/**
 * Generate a single PDF with both front and back labels at specified positions
 * Front label at frontPosition, back label at backPosition (usually frontPosition + 1)
 */
export async function generateToploaderLabelPair(
  data: ToploaderLabelData,
  frontPositionIndex: number,
  backPositionIndex: number,
  offsets?: CalibrationOffsets
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo (used for both front labels and back watermarks)
  let colorLogoBase64: string = '';
  try {
    colorLogoBase64 = await loadLogoAsBase64();
  } catch (e) {
    // Continue without logo
  }

  // Generate QR code for back label
  const qrCodeBase64 = await generateQRCodeBase64(data.qrCodeUrl, 200);

  // Draw front label
  const frontPosition = indexToPosition8167(frontPositionIndex);
  const { x: frontX, y: frontY } = getLabelPosition(frontPosition, offsets);
  drawFrontLabel(doc, frontX, frontY, data, colorLogoBase64);

  // Draw back label with watermark
  const backPosition = indexToPosition8167(backPositionIndex);
  const { x: backX, y: backY } = getLabelPosition(backPosition, offsets);
  await drawBackLabel(doc, backX, backY, qrCodeBase64, colorLogoBase64);

  return doc.output('blob');
}

/**
 * Generate a single-page sheet with cards at specific positions
 * @param cardsData Array of card label data
 * @param cardPositionIndices Array of card positions (0-39) - each card uses a front+back pair
 * @param offsets Optional calibration offsets for printer alignment
 * @returns Promise<Blob> - PDF blob with labels at specified positions
 */
export async function generateToploaderLabelSheet(
  cardsData: ToploaderLabelData[],
  cardPositionIndices: number[],
  offsets?: CalibrationOffsets
): Promise<Blob> {
  // Validate inputs
  if (cardsData.length !== cardPositionIndices.length) {
    throw new Error('Card data array and position indices length mismatch');
  }

  if (cardsData.length === 0) {
    throw new Error('No cards to generate labels for');
  }

  const maxCards = 40; // 40 cards per page
  if (cardsData.length > maxCards) {
    throw new Error(`Cannot print ${cardsData.length} cards on one sheet (max ${maxCards})`);
  }

  // Check for duplicate positions
  const positionSet = new Set(cardPositionIndices);
  if (positionSet.size !== cardPositionIndices.length) {
    throw new Error('Duplicate position indices detected');
  }

  // Validate position range
  for (const pos of cardPositionIndices) {
    if (pos < 0 || pos >= maxCards) {
      throw new Error(`Invalid position index: ${pos}. Must be between 0 and ${maxCards - 1}`);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo (used for both front labels and back watermarks)
  let colorLogoBase64: string = '';
  try {
    colorLogoBase64 = await loadLogoAsBase64();
  } catch (e) {
    // Continue without logo
  }

  // Draw each card at its specified position
  for (let i = 0; i < cardsData.length; i++) {
    const data = cardsData[i];
    const cardPosition = cardPositionIndices[i];

    // Calculate the label positions for this card
    // Card position 0 → front at label 0, back at label 1
    // Card position 1 → front at label 2, back at label 3
    // Card position 2 → front at label 4, back at label 5
    // etc.
    const row = Math.floor(cardPosition / 2);
    const cardInRow = cardPosition % 2; // 0 or 1
    const frontCol = cardInRow * 2; // 0 or 2
    const backCol = frontCol + 1;   // 1 or 3

    const frontLabelIndex = row * COLUMNS + frontCol;
    const backLabelIndex = row * COLUMNS + backCol;

    // Generate QR code for this card
    const qrCodeBase64 = await generateQRCodeBase64(data.qrCodeUrl, 200);

    // Draw front label
    const frontPosition = indexToPosition8167(frontLabelIndex);
    const { x: frontX, y: frontY } = getLabelPosition(frontPosition, offsets);
    drawFrontLabel(doc, frontX, frontY, data, colorLogoBase64);

    // Draw back label
    const backPosition = indexToPosition8167(backLabelIndex);
    const { x: backX, y: backY } = getLabelPosition(backPosition, offsets);
    await drawBackLabel(doc, backX, backY, qrCodeBase64, colorLogoBase64);
  }

  return doc.output('blob');
}

/**
 * Generate a multi-page Avery 8167 toploader label PDF with auto-pagination
 * Each card gets a front label (columns 0,2) and back label (columns 1,3)
 * 40 cards per page (80 labels), auto-paginates for larger batches
 * @param cardsData Array of card label data (unlimited cards)
 * @param offsets Optional calibration offsets for printer alignment
 * @param globalPositions Optional array of global card positions (page * 40 + positionOnPage) for specific placement
 * @returns Promise<Blob> - PDF blob with all labels rendered across multiple pages
 */
export async function generateToploaderLabelSheetMultiPage(
  cardsData: ToploaderLabelData[],
  offsets?: CalibrationOffsets,
  globalPositions?: number[]
): Promise<Blob> {
  if (cardsData.length === 0) {
    throw new Error('No cards to generate labels for');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  // Load color logo (used for both front labels and back watermarks)
  let colorLogoBase64: string = '';
  try {
    colorLogoBase64 = await loadLogoAsBase64();
  } catch (e) {
    // Continue without logo
  }

  const cardsPerPage = 40;
  const cardsPerRow = 2;

  // Helper function to draw a card at a specific card position
  const drawCardAtPosition = async (data: ToploaderLabelData, cardPosition: number) => {
    // Card position maps to:
    // - row = cardPosition / 2
    // - cardInRow = cardPosition % 2 (0 or 1)
    // - frontCol = cardInRow * 2 (0 or 2)
    // - backCol = frontCol + 1 (1 or 3)
    const row = Math.floor(cardPosition / cardsPerRow);
    const cardInRow = cardPosition % cardsPerRow;
    const frontCol = cardInRow * 2;
    const backCol = frontCol + 1;

    const frontPositionIndex = row * COLUMNS + frontCol;
    const backPositionIndex = row * COLUMNS + backCol;

    // Generate QR code for this card
    const qrCodeBase64 = await generateQRCodeBase64(data.qrCodeUrl, 200);

    // Draw front label
    const frontPosition = indexToPosition8167(frontPositionIndex);
    const { x: frontX, y: frontY } = getLabelPosition(frontPosition, offsets);
    drawFrontLabel(doc, frontX, frontY, data, colorLogoBase64);

    // Draw back label
    const backPosition = indexToPosition8167(backPositionIndex);
    const { x: backX, y: backY } = getLabelPosition(backPosition, offsets);
    await drawBackLabel(doc, backX, backY, qrCodeBase64, colorLogoBase64);
  };

  if (globalPositions && globalPositions.length === cardsData.length) {
    // Use specific positions - group by page first
    const cardsByPage = new Map<number, { data: ToploaderLabelData; positionOnPage: number }[]>();

    cardsData.forEach((data, index) => {
      const globalPos = globalPositions[index];
      const pageIndex = Math.floor(globalPos / cardsPerPage);
      const positionOnPage = globalPos % cardsPerPage;

      if (!cardsByPage.has(pageIndex)) {
        cardsByPage.set(pageIndex, []);
      }
      cardsByPage.get(pageIndex)!.push({ data, positionOnPage });
    });

    // Sort pages and render
    const sortedPages = Array.from(cardsByPage.keys()).sort((a, b) => a - b);

    for (let i = 0; i < sortedPages.length; i++) {
      const pageIndex = sortedPages[i];
      if (i > 0) {
        doc.addPage();
      }

      const cardsOnPage = cardsByPage.get(pageIndex)!;
      for (const { data, positionOnPage } of cardsOnPage) {
        await drawCardAtPosition(data, positionOnPage);
      }
    }
  } else {
    // Auto-distribute cards sequentially
    for (let cardIndex = 0; cardIndex < cardsData.length; cardIndex++) {
      const data = cardsData[cardIndex];
      const pageIndex = Math.floor(cardIndex / cardsPerPage);
      const cardOnPage = cardIndex % cardsPerPage;

      // Add new page if needed (not for first page)
      if (cardOnPage === 0 && pageIndex > 0) {
        doc.addPage();
      }

      await drawCardAtPosition(data, cardOnPage);
    }
  }

  return doc.output('blob');
}

/**
 * Get the number of cards that fit per page for Avery 8167
 */
export function getAvery8167CardsPerPage(): number {
  return 40; // 20 rows × 2 card pairs per row
}
