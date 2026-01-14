/**
 * Card Image Generator
 *
 * Generates downloadable card images with grade labels for eBay listings,
 * social media, and other platforms.
 *
 * - Front image: Card front with full grade label (logo, card info, grade)
 * - Back image: Card back with QR code label
 *
 * Output: High-resolution JPG images suitable for online listings
 */

import { generateQRCodePlain, loadLogoAsBase64, loadWhiteLogoAsBase64 } from './foldableLabelGenerator';
import { extractAsciiSafe } from './labelDataGenerator';

// Canvas dimensions - card ratio 2.5" x 3.5" (standard trading card)
// Label adds ~110px height at 400px width scale
const CARD_WIDTH = 800;   // High resolution for quality
const CARD_HEIGHT = 1120; // 2.5:3.5 ratio
const LABEL_HEIGHT = 220; // Proportional to 110px at 400px width
const TOTAL_HEIGHT = LABEL_HEIGHT + CARD_HEIGHT + 8; // 8px for separator
const SEPARATOR_HEIGHT = 8;

// Colors (matching existing DCM branding)
const COLORS = {
  purplePrimary: '#7c3aed',
  purpleDark: '#6b46c1',
  purpleLight: '#f3e8ff',

  // Metallic slab gradient colors
  slabGradient1: '#9333ea',
  slabGradient2: '#6b21a8',
  slabGradient3: '#a855f7',
  slabGradient4: '#7c3aed',
  slabGradient5: '#581c87',

  // Text colors
  textDark: '#1f2937',
  textMedium: '#4b5563',
  textLight: '#6b7280',
  white: '#ffffff',
  featureBlue: '#2563eb',

  // Backgrounds
  bgGradientStart: '#f9fafb',
  bgGradientEnd: '#ffffff',
};

// Modern label colors (dark theme with glow)
const MODERN_COLORS = {
  // Dark gradient background
  bgDark1: '#1a1625',
  bgDark2: '#2d1f47',

  // Glow/accent purple
  glowPurple: 'rgba(139, 92, 246, 0.4)',
  glowPurpleLight: 'rgba(139, 92, 246, 0.2)',
  accentPurple: 'rgba(139, 92, 246, 0.6)',
  borderPurple: 'rgba(139, 92, 246, 0.4)',

  // Text colors
  textWhite: 'rgba(255, 255, 255, 0.95)',
  textWhiteMuted: 'rgba(255, 255, 255, 0.7)',
  textWhiteSubtle: 'rgba(255, 255, 255, 0.5)',
  textGreen: 'rgba(34, 197, 94, 0.9)',

  // Badge colors
  badgeBorder: 'rgba(168, 85, 247, 0.5)',
  badgeBg: 'rgba(139, 92, 246, 0.15)',
  badgeText: 'rgba(196, 181, 253, 0.9)',
};

export interface SubScores {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}

export interface CardImageData {
  cardName: string;
  contextLine: string;  // Pre-formatted: "Set • Subset • #123 • 2023" - matches labelDataGenerator
  specialFeatures?: string;
  serial: string;
  grade: number;
  conditionLabel: string;
  cardUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  // English fallback for CJK card names (e.g., "Mega Gengar EX" for Japanese cards)
  englishName?: string;
  // Founder emblem - shown on back label when user is a founder with badge enabled
  showFounderEmblem?: boolean;
  // Label style preference
  labelStyle?: 'modern' | 'traditional';
  // Sub-scores for modern back label
  subScores?: SubScores;
}

/**
 * Format grade - v6.0: Always show whole number (no decimals)
 */
function formatGradeDisplay(grade: number): string {
  return Math.round(grade).toString();
}

/**
 * Load an image from URL
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Draw metallic purple slab border
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
 * Draw purple separator line
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
 * Draw the front label with card info and grade
 */
async function drawFrontLabel(
  ctx: CanvasRenderingContext2D,
  data: CardImageData,
  logoDataUrl: string | undefined,
  startY: number,
  contentWidth: number,
  borderWidth: number
) {
  const labelX = borderWidth;
  const labelY = startY;
  const labelWidth = contentWidth;
  const labelHeight = LABEL_HEIGHT;

  // Label background gradient
  const bgGradient = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelHeight);
  bgGradient.addColorStop(0, COLORS.bgGradientStart);
  bgGradient.addColorStop(1, COLORS.bgGradientEnd);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  const padding = 24;
  const contentStartX = labelX + padding;
  const contentEndX = labelX + labelWidth - padding;

  // Left: DCM Logo
  const logoSize = 112; // Proportional to 56px at 400px width
  const logoX = contentStartX;
  const logoY = labelY + (labelHeight - logoSize) / 2;

  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      // Fallback text
      ctx.fillStyle = COLORS.purplePrimary;
      ctx.font = 'bold 48px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 10, logoY + logoSize / 2);
    }
  }

  // Right: Grade Display
  const gradeX = contentEndX - 80;
  const gradeText = formatGradeDisplay(data.grade);
  const hasDecimal = gradeText.includes('.');

  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = `bold ${hasDecimal ? 56 : 64}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeX, labelY + 40);

  // Divider line under grade
  ctx.strokeStyle = COLORS.purplePrimary;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gradeX - 50, labelY + 115);
  ctx.lineTo(gradeX + 50, labelY + 115);
  ctx.stroke();

  // Condition label
  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(data.conditionLabel.toUpperCase(), gradeX, labelY + 130);

  // Center: Card Information (4 lines)
  const infoX = logoX + logoSize + 24;
  const infoMaxWidth = gradeX - infoX - 50; // Extra padding from grade
  let currentY = labelY + 24;

  // Helper: Wrap text to multiple lines
  const wrapText = (text: string, maxWidth: number, fontSize: number, fontStyle: string = ''): string[] => {
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
  };

  // Line 1: Card Name (bold, larger) - increased from 28 to 32
  // Use ASCII-safe text for Canvas rendering (CJK characters not supported)
  // Pass englishName as fallback for Japanese/Chinese/Korean cards
  const safeCardName = extractAsciiSafe(data.cardName, 'Card', data.englishName);
  ctx.fillStyle = COLORS.textDark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let nameFontSize = 32;
  ctx.font = `bold ${nameFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  while (ctx.measureText(safeCardName).width > infoMaxWidth && nameFontSize > 18) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  }
  ctx.fillText(safeCardName, infoX, currentY);
  currentY += nameFontSize + 6;

  // Line 2: Context line (Set • Subset • #Number • Year) - use pre-formatted contextLine
  // This matches labelDataGenerator for consistency across all label displays
  ctx.fillStyle = COLORS.textMedium;
  const setInfo = data.contextLine ? extractAsciiSafe(data.contextLine, '') : '';

  const setFontSize = 24;
  const setLines = wrapText(setInfo, infoMaxWidth, setFontSize);
  ctx.font = `${setFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  for (const line of setLines) {
    ctx.fillText(line, infoX, currentY);
    currentY += setFontSize + 4;
  }
  currentY += 2; // Small gap after set info

  // Line 3: Special Features (if present) - increased from 18 to 20
  if (data.specialFeatures) {
    const safeFeatures = extractAsciiSafe(data.specialFeatures, '');
    if (safeFeatures) {
      ctx.fillStyle = COLORS.featureBlue;
      ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(safeFeatures, infoX, currentY);
      currentY += 26;
    }
  }

  // Line 4: Serial Number - increased from 16 to 18
  ctx.fillStyle = COLORS.textLight;
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText(data.serial, infoX, currentY);
}

/**
 * Draw the back label with QR code, grade, and sub-scores (matches modern layout)
 */
async function drawBackLabel(
  ctx: CanvasRenderingContext2D,
  data: CardImageData,
  qrCodeDataUrl: string,
  startY: number,
  contentWidth: number,
  borderWidth: number
) {
  const labelX = borderWidth;
  const labelY = startY;
  const labelWidth = contentWidth;
  const labelHeight = LABEL_HEIGHT;

  // Label background gradient (light theme)
  const bgGradient = ctx.createLinearGradient(labelX, labelY, labelX, labelY + labelHeight);
  bgGradient.addColorStop(0, COLORS.bgGradientStart);
  bgGradient.addColorStop(1, COLORS.bgGradientEnd);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  const padding = 24;

  // LEFT: QR Code with simple white background
  const qrSize = 140;
  const qrX = labelX + padding;
  const qrY = labelY + (labelHeight - qrSize) / 2;

  // White background for QR code with subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
  ctx.shadowBlur = 0;

  try {
    const qrImg = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.strokeStyle = COLORS.textLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
  }

  // Founder badge - star at top, FOUNDER text rotated below (compact style)
  if (data.showFounderEmblem) {
    const founderX = qrX + qrSize + 20;
    const founderStartY = qrY + 8;

    // Gold/amber star at top
    ctx.fillStyle = '#d97706'; // amber-600
    ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('\u2605', founderX, founderStartY);

    // "FOUNDER" text rotated -90 degrees below star
    ctx.save();
    ctx.translate(founderX, founderStartY + 32);
    ctx.rotate(-Math.PI / 2);

    ctx.fillStyle = COLORS.purplePrimary;
    ctx.font = 'bold 14px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOUNDER', 0, 0);

    ctx.restore();
  }

  // CENTER: Large Grade + Condition
  const centerX = labelX + labelWidth / 2;
  const gradeText = formatGradeDisplay(data.grade);

  // Calculate vertical centering for grade + condition
  const gradeHeight = 72;
  const conditionHeight = data.conditionLabel ? 28 : 0;
  const totalCenterHeight = gradeHeight + conditionHeight;
  const centerStartY = labelY + (labelHeight - totalCenterHeight) / 2;

  ctx.fillStyle = COLORS.purplePrimary;
  ctx.font = 'bold 72px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, centerX, centerStartY);

  // Condition label (centered below grade)
  if (data.conditionLabel) {
    ctx.fillStyle = COLORS.purpleDark;
    ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(data.conditionLabel.toUpperCase(), centerX, centerStartY + gradeHeight + 5);
  }

  // RIGHT: Four Sub-Grades (whole numbers, formatted as "Label: Score")
  if (data.subScores) {
    const rightEdge = labelX + labelWidth - padding;
    const subStartY = labelY + 32;
    const lineHeight = 42;

    const drawSubScore = (label: string, value: number, yOffset: number) => {
      const y = subStartY + yOffset;
      const scoreText = `${label}: ${Math.round(value)}`;

      ctx.fillStyle = COLORS.textMedium;
      ctx.font = '18px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, rightEdge, y);
    };

    drawSubScore('Centering', data.subScores.centering, 0);
    drawSubScore('Corners', data.subScores.corners, lineHeight);
    drawSubScore('Edges', data.subScores.edges, lineHeight * 2);
    drawSubScore('Surface', data.subScores.surface, lineHeight * 3);
  }
}

/**
 * Draw modern dark slab border with glow effect
 */
function drawModernSlabBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  cornerRadius: number
) {
  // Dark gradient background
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, MODERN_COLORS.bgDark1);
  gradient.addColorStop(0.5, MODERN_COLORS.bgDark2);
  gradient.addColorStop(1, MODERN_COLORS.bgDark1);

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

  // Add glow effect border
  ctx.strokeStyle = MODERN_COLORS.borderPurple;
  ctx.lineWidth = 2;
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
  ctx.stroke();
}

/**
 * Draw modern purple separator line
 */
function drawModernSeparator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
  gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.6)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.3)');

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
}

/**
 * Draw the modern front label with card info and grade
 */
async function drawModernFrontLabel(
  ctx: CanvasRenderingContext2D,
  data: CardImageData,
  logoDataUrl: string | undefined,
  startY: number,
  contentWidth: number,
  borderWidth: number
) {
  const labelX = borderWidth;
  const labelY = startY;
  const labelWidth = contentWidth;
  const labelHeight = LABEL_HEIGHT;

  // Dark gradient background
  const bgGradient = ctx.createLinearGradient(labelX, labelY, labelX + labelWidth, labelY + labelHeight);
  bgGradient.addColorStop(0, MODERN_COLORS.bgDark1);
  bgGradient.addColorStop(0.5, MODERN_COLORS.bgDark2);
  bgGradient.addColorStop(1, MODERN_COLORS.bgDark1);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  // Subtle inner glow
  const glowGradient = ctx.createRadialGradient(
    labelX + labelWidth / 2, labelY + labelHeight / 2, 0,
    labelX + labelWidth / 2, labelY + labelHeight / 2, labelWidth / 2
  );
  glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
  glowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  const padding = 24;
  const contentStartX = labelX + padding;
  const contentEndX = labelX + labelWidth - padding;

  // Left: DCM Logo (white version)
  const logoSize = 112;
  const logoX = contentStartX;
  const logoY = labelY + (labelHeight - logoSize) / 2;

  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      // For the dark background, we'll draw it as-is (assuming white logo)
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    } catch {
      // Fallback text
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 48px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DCM', logoX + 10, logoY + logoSize / 2);
    }
  }

  // Right: Grade Display
  const gradeX = contentEndX - 80;
  const gradeText = formatGradeDisplay(data.grade);

  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 64px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, gradeX, labelY + 40);

  // Condition label
  if (data.conditionLabel) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(data.conditionLabel.toUpperCase(), gradeX, labelY + 115);
  }

  // Center: Card Information
  const infoX = logoX + logoSize + 24;
  const infoMaxWidth = gradeX - infoX - 50;
  let currentY = labelY + 28;

  // Line 1: Card Name
  const safeCardName = extractAsciiSafe(data.cardName, 'Card', data.englishName);
  ctx.fillStyle = MODERN_COLORS.textWhite;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let nameFontSize = 32;
  ctx.font = `bold ${nameFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  while (ctx.measureText(safeCardName).width > infoMaxWidth && nameFontSize > 18) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px 'Helvetica Neue', Arial, sans-serif`;
  }
  ctx.fillText(safeCardName, infoX, currentY);
  currentY += nameFontSize + 8;

  // Line 2: Context line
  ctx.fillStyle = MODERN_COLORS.textWhiteMuted;
  const setInfo = data.contextLine ? extractAsciiSafe(data.contextLine, '') : '';
  ctx.font = '22px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(setInfo, infoX, currentY);
  currentY += 28;

  // Line 3: Special Features
  if (data.specialFeatures) {
    const safeFeatures = extractAsciiSafe(data.specialFeatures, '');
    if (safeFeatures) {
      ctx.fillStyle = MODERN_COLORS.textGreen;
      ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(safeFeatures, infoX, currentY);
      currentY += 26;
    }
  }

  // Line 4: Serial Number
  ctx.fillStyle = MODERN_COLORS.textWhiteSubtle;
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText(data.serial, infoX, currentY);
}

/**
 * Draw the modern back label with QR code, grade, and sub-scores
 */
async function drawModernBackLabel(
  ctx: CanvasRenderingContext2D,
  data: CardImageData,
  qrCodeDataUrl: string,
  startY: number,
  contentWidth: number,
  borderWidth: number
) {
  const labelX = borderWidth;
  const labelY = startY;
  const labelWidth = contentWidth;
  const labelHeight = LABEL_HEIGHT;

  // Dark gradient background
  const bgGradient = ctx.createLinearGradient(labelX, labelY, labelX + labelWidth, labelY + labelHeight);
  bgGradient.addColorStop(0, MODERN_COLORS.bgDark1);
  bgGradient.addColorStop(0.5, MODERN_COLORS.bgDark2);
  bgGradient.addColorStop(1, MODERN_COLORS.bgDark1);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  // Subtle inner glow
  const glowGradient = ctx.createRadialGradient(
    labelX + labelWidth / 2, labelY + labelHeight / 2, 0,
    labelX + labelWidth / 2, labelY + labelHeight / 2, labelWidth / 2
  );
  glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
  glowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

  const padding = 24;

  // LEFT: QR Code with modern styled background
  const qrSize = 140;
  const qrX = labelX + padding;
  const qrY = labelY + (labelHeight - qrSize) / 2;

  // Dark background with purple glow border for QR
  const qrPadding = 10;
  const qrBgX = qrX - qrPadding;
  const qrBgY = qrY - qrPadding;
  const qrBgSize = qrSize + qrPadding * 2;

  // Purple glow behind QR
  ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#1a1625';
  ctx.fillRect(qrBgX, qrBgY, qrBgSize, qrBgSize);
  ctx.shadowBlur = 0;

  // Purple border
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(qrBgX, qrBgY, qrBgSize, qrBgSize);

  // White background for QR code itself (needed for scanning)
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);

  try {
    const qrImg = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.strokeStyle = COLORS.textLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX, qrY, qrSize, qrSize);
  }

  // "Founder" badge - star at top, FOUNDER sideways below it
  const founderX = qrX + qrSize + qrPadding + 18;
  const founderStartY = qrY + 8; // Align near top of QR

  // Gold star at top (not rotated)
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u2605', founderX, founderStartY);

  // "FOUNDER" text rotated -90 degrees below star (matches card details page)
  ctx.save();
  ctx.translate(founderX, founderStartY + 32);
  ctx.rotate(-Math.PI / 2); // Rotate -90 degrees (counterclockwise)

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOUNDER', 0, 0);

  ctx.restore();

  // CENTER: Large Grade + Condition (re-centered, no founding member text)
  const centerX = labelX + labelWidth / 2;
  const gradeText = formatGradeDisplay(data.grade);

  // Calculate vertical centering for grade + condition
  const gradeHeight = 72;
  const conditionHeight = data.conditionLabel ? 28 : 0;
  const totalCenterHeight = gradeHeight + conditionHeight;
  const centerStartY = labelY + (labelHeight - totalCenterHeight) / 2;

  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 72px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(gradeText, centerX, centerStartY);

  // Condition label (centered below grade)
  if (data.conditionLabel) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(data.conditionLabel.toUpperCase(), centerX, centerStartY + gradeHeight + 5);
  }

  // RIGHT: Four Sub-Grades (whole numbers, formatted as "Label: Score")
  if (data.subScores) {
    const rightEdge = labelX + labelWidth - padding;
    const subStartY = labelY + 32;
    const lineHeight = 42;

    const drawSubScore = (label: string, value: number, yOffset: number) => {
      const y = subStartY + yOffset;
      const scoreText = `${label}: ${Math.round(value)}`;

      ctx.fillStyle = MODERN_COLORS.textWhite;
      ctx.font = '18px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, rightEdge, y);
    };

    drawSubScore('Centering', data.subScores.centering, 0);
    drawSubScore('Corners', data.subScores.corners, lineHeight);
    drawSubScore('Edges', data.subScores.edges, lineHeight * 2);
    drawSubScore('Surface', data.subScores.surface, lineHeight * 3);
  }
}

/**
 * Generate a card image (front or back) with label
 */
async function generateCardImage(
  data: CardImageData,
  side: 'front' | 'back',
  logoDataUrl: string | undefined,
  qrCodeDataUrl: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH + 16; // Add border width
  canvas.height = TOTAL_HEIGHT + 16;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const borderWidth = 8;
  const cornerRadius = 16;
  const isModern = data.labelStyle === 'modern';

  // Background - white for traditional, dark for modern
  if (isModern) {
    ctx.fillStyle = MODERN_COLORS.bgDark1;
  } else {
    ctx.fillStyle = COLORS.white;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw slab border - modern or traditional
  if (isModern) {
    drawModernSlabBorder(ctx, 0, 0, canvas.width, canvas.height, borderWidth, cornerRadius);
  } else {
    drawMetallicSlabBorder(ctx, 0, 0, canvas.width, canvas.height, borderWidth, cornerRadius);
  }

  // Content area dimensions
  const contentWidth = canvas.width - borderWidth * 2;
  const contentX = borderWidth;

  // Draw appropriate label - modern or traditional
  if (isModern) {
    if (side === 'front') {
      await drawModernFrontLabel(ctx, data, logoDataUrl, borderWidth, contentWidth, borderWidth);
    } else {
      await drawModernBackLabel(ctx, data, qrCodeDataUrl, borderWidth, contentWidth, borderWidth);
    }
  } else {
    if (side === 'front') {
      await drawFrontLabel(ctx, data, logoDataUrl, borderWidth, contentWidth, borderWidth);
    } else {
      await drawBackLabel(ctx, data, qrCodeDataUrl, borderWidth, contentWidth, borderWidth);
    }
  }

  // Draw separator - modern or traditional
  const separatorY = borderWidth + LABEL_HEIGHT;
  if (isModern) {
    drawModernSeparator(ctx, borderWidth, separatorY, contentWidth, SEPARATOR_HEIGHT);
  } else {
    drawPurpleSeparator(ctx, borderWidth, separatorY, contentWidth, SEPARATOR_HEIGHT);
  }

  // Draw card image
  const cardImageY = separatorY + SEPARATOR_HEIGHT;
  const cardImageUrl = side === 'front' ? data.frontImageUrl : data.backImageUrl;

  try {
    const cardImg = await loadImage(cardImageUrl);

    // Calculate dimensions to fit card image maintaining aspect ratio
    const availableHeight = canvas.height - cardImageY - borderWidth;
    const availableWidth = contentWidth;

    // Card aspect ratio is typically 2.5:3.5
    const cardAspect = cardImg.width / cardImg.height;
    let drawWidth = availableWidth;
    let drawHeight = drawWidth / cardAspect;

    if (drawHeight > availableHeight) {
      drawHeight = availableHeight;
      drawWidth = drawHeight * cardAspect;
    }

    const drawX = contentX + (availableWidth - drawWidth) / 2;
    const drawY = cardImageY;

    ctx.drawImage(cardImg, drawX, drawY, drawWidth, drawHeight);
  } catch (error) {
    // Draw placeholder if image fails
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(contentX, cardImageY, contentWidth, canvas.height - cardImageY - borderWidth);
    ctx.fillStyle = COLORS.textLight;
    ctx.font = '24px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Card ${side === 'front' ? 'Front' : 'Back'} Image`,
      canvas.width / 2,
      cardImageY + (canvas.height - cardImageY - borderWidth) / 2
    );
  }

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
      0.95
    );
  });
}

/**
 * Generate both front and back card images
 */
export async function generateCardImages(data: CardImageData): Promise<{ front: Blob; back: Blob }> {
  // Generate QR code and load appropriate logo based on label style
  const isModern = data.labelStyle === 'modern';

  console.log('[CARD IMAGE GEN] Starting, isModern:', isModern);

  let qrCodeDataUrl: string;
  let logoDataUrl: string | undefined;

  try {
    console.log('[CARD IMAGE GEN] Generating QR code for:', data.cardUrl);
    qrCodeDataUrl = await generateQRCodePlain(data.cardUrl);
    console.log('[CARD IMAGE GEN] QR code generated successfully');
  } catch (err) {
    console.error('[CARD IMAGE GEN] QR code generation failed:', err);
    throw new Error('Failed to generate QR code');
  }

  try {
    console.log('[CARD IMAGE GEN] Loading logo, isModern:', isModern);
    logoDataUrl = isModern
      ? await loadWhiteLogoAsBase64().catch(() => undefined)
      : await loadLogoAsBase64().catch(() => undefined);
    console.log('[CARD IMAGE GEN] Logo loaded:', logoDataUrl ? 'success' : 'failed (using fallback)');
  } catch (err) {
    console.error('[CARD IMAGE GEN] Logo loading failed:', err);
    logoDataUrl = undefined;
  }

  // Generate both images in parallel
  console.log('[CARD IMAGE GEN] Generating front and back images...');
  const [frontBlob, backBlob] = await Promise.all([
    generateCardImage(data, 'front', logoDataUrl, qrCodeDataUrl),
    generateCardImage(data, 'back', logoDataUrl, qrCodeDataUrl)
  ]);
  console.log('[CARD IMAGE GEN] Images generated successfully');

  return { front: frontBlob, back: backBlob };
}

/**
 * Download card images as separate files
 */
export async function downloadCardImages(
  data: CardImageData,
  filenameBase: string
): Promise<void> {
  const { front, back } = await generateCardImages(data);

  // Create download link and trigger it
  const downloadBlob = (blob: Blob, filename: string): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup after a short delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, 150);
    });
  };

  // Download front image first
  await downloadBlob(front, `${filenameBase}-front.jpg`);

  // Longer delay between downloads to prevent browser blocking
  await new Promise(resolve => setTimeout(resolve, 500));

  // Download back image
  await downloadBlob(back, `${filenameBase}-back.jpg`);
}
