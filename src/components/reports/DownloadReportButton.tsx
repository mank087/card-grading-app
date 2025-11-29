'use client';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { CardGradingReport, ReportCardData } from './CardGradingReport';
import { getAuthenticatedClient } from '../../lib/directAuth';
import { getConditionFromGrade } from '../../lib/conditionAssessment';
import QRCode from 'qrcode';
import {
  FoldableLabelData,
  generateFoldableLabel,
  generateQRCodeWithLogo,
  loadLogoAsBase64
} from '../../lib/foldableLabelGenerator';
import { generateAveryLabel } from '../../lib/averyLabelGenerator';
import { AveryLabelModal } from './AveryLabelModal';

/**
 * Download Report Button Component
 * Generates and downloads a PDF grading report for a card
 * Now includes dropdown for Full Report and Foldable Label options
 */

interface DownloadReportButtonProps {
  card: any; // Card data from database
  variant?: 'default' | 'compact';
  cardType?: 'pokemon' | 'sports' | 'mtg' | 'lorcana' | 'other'; // For URL generation
}

export const DownloadReportButton: React.FC<DownloadReportButtonProps> = ({
  card,
  variant = 'default',
  cardType = 'sports'
}) => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatingType, setGeneratingType] = React.useState<'report' | 'label' | 'avery' | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isAveryModalOpen, setIsAveryModalOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Extract centering summary from card data
   */
  const extractCenteringSummary = (card: any): { front: string; back: string; combined: string } => {
    const frontSummary = card.conversational_corners_edges_surface?.front_centering?.summary || '';
    const backSummary = card.conversational_corners_edges_surface?.back_centering?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Centering analysis not available.';

    return {
      front: frontSummary || 'Centering analysis not available.',
      back: backSummary || 'Centering analysis not available.',
      combined
    };
  };

  /**
   * Extract corners summary from card data
   */
  const extractCornersSummary = (card: any): { front: string; back: string; combined: string } => {
    const frontSummary = card.conversational_corners_edges_surface?.front_corners?.summary || '';
    const backSummary = card.conversational_corners_edges_surface?.back_corners?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Corner analysis not available.';

    return {
      front: frontSummary || 'Corner analysis not available.',
      back: backSummary || 'Corner analysis not available.',
      combined
    };
  };

  /**
   * Extract edges summary from card data
   */
  const extractEdgesSummary = (card: any): { front: string; back: string; combined: string } => {
    const frontSummary = card.conversational_corners_edges_surface?.front_edges?.summary || '';
    const backSummary = card.conversational_corners_edges_surface?.back_edges?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Edge analysis not available.';

    return {
      front: frontSummary || 'Edge analysis not available.',
      back: backSummary || 'Edge analysis not available.',
      combined
    };
  };

  /**
   * Extract surface summary from card data
   */
  const extractSurfaceSummary = (card: any): { front: string; back: string; combined: string } => {
    const frontSummary = card.conversational_corners_edges_surface?.front_surface?.summary || '';
    const backSummary = card.conversational_corners_edges_surface?.back_surface?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Surface analysis not available.';

    return {
      front: frontSummary || 'Surface analysis not available.',
      back: backSummary || 'Surface analysis not available.',
      combined
    };
  };

  /**
   * Extract image quality description
   */
  const extractImageQuality = (card: any): string => {
    const confidence = card.conversational_image_confidence || 'N/A';

    const qualityMap: { [key: string]: string } = {
      'A': 'Excellent - High confidence in grade accuracy',
      'B': 'Good - Moderate confidence in grade accuracy',
      'C': 'Fair - Lower confidence due to image limitations',
      'D': 'Poor - Significant image quality issues affecting analysis',
    };

    return qualityMap[confidence] || 'Quality assessment not available';
  };

  /**
   * Generate QR code with DCM logo in center as base64 data URL
   */
  const generateQRCode = async (url: string): Promise<string> => {
    try {
      // Generate QR code to canvas
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
        throw new Error('Failed to get canvas context');
      }

      // Load and draw DCM logo in center
      const logo = new Image();
      logo.crossOrigin = 'anonymous';

      return new Promise((resolve, reject) => {
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

          // Convert to base64
          const qrDataUrl = canvas.toDataURL('image/png');
          resolve(qrDataUrl);
        };

        logo.onerror = () => {
          // If logo fails to load, return QR code without logo
          console.warn('[DOWNLOAD REPORT] Failed to load logo for QR code, using plain QR');
          resolve(canvas.toDataURL('image/png'));
        };

        logo.src = '/DCM-logo.png';
      });
    } catch (error) {
      console.error('[DOWNLOAD REPORT] Failed to generate QR code:', error);
      return '';
    }
  };

  /**
   * Convert image URL to base64 JPEG data URL for react-pdf
   * Converts WEBP and other formats to JPEG since react-pdf doesn't support WEBP
   */
  const imageToBase64 = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Convert to JPEG format (react-pdf compatible)
        const base64 = canvas.toDataURL('image/jpeg', 0.95);
        resolve(base64);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  /**
   * Handle PDF generation and download
   */
  const handleDownload = async () => {
    try {
      setIsGenerating(true);

      console.log('[DOWNLOAD REPORT] Card object keys:', Object.keys(card));
      console.log('[DOWNLOAD REPORT] Card image fields:', {
        front_url: card.front_url,
        back_url: card.back_url,
        front_path: card.front_path,
        back_path: card.back_path,
      });

      // Use existing signed URLs if available, otherwise generate new ones
      let frontImageUrl = card.front_url;
      let backImageUrl = card.back_url;

      if (!frontImageUrl || !backImageUrl) {
        console.log('[DOWNLOAD REPORT] No signed URLs found, generating from storage paths...');

        if (!card.front_path || !card.back_path) {
          console.error('[DOWNLOAD REPORT] ERROR: Missing storage paths!', {
            front_path: card.front_path,
            back_path: card.back_path,
          });
          throw new Error('Card images not found. Missing both URLs and storage paths.');
        }

        // Use authenticated client for signed URLs
        const authClient = getAuthenticatedClient();

        const { data: frontUrlData } = await authClient
          .storage
          .from('cards')
          .createSignedUrl(card.front_path, 60 * 60); // 1 hour expiry

        const { data: backUrlData } = await authClient
          .storage
          .from('cards')
          .createSignedUrl(card.back_path, 60 * 60); // 1 hour expiry

        if (!frontUrlData?.signedUrl || !backUrlData?.signedUrl) {
          throw new Error('Failed to generate signed URLs for card images');
        }

        frontImageUrl = frontUrlData.signedUrl;
        backImageUrl = backUrlData.signedUrl;
      } else {
        console.log('[DOWNLOAD REPORT] Using existing signed URLs from card data');
      }

      // Convert images to base64 for react-pdf compatibility
      console.log('[DOWNLOAD REPORT] Converting images to base64...');
      let frontImageBase64: string;
      let backImageBase64: string;

      try {
        frontImageBase64 = await imageToBase64(frontImageUrl);
        console.log('[DOWNLOAD REPORT] Front image converted to base64');
      } catch (error) {
        console.error('[DOWNLOAD REPORT] Failed to convert front image:', error);
        throw new Error('Failed to load front card image. Please try again.');
      }

      try {
        backImageBase64 = await imageToBase64(backImageUrl);
        console.log('[DOWNLOAD REPORT] Back image converted to base64');
      } catch (error) {
        console.error('[DOWNLOAD REPORT] Failed to convert back image:', error);
        throw new Error('Failed to load back card image. Please try again.');
      }

      console.log('[DOWNLOAD REPORT] All images converted successfully');

      // Generate QR code for the card URL
      const cardUrl = `${window.location.origin}/sports/${card.id}`;
      console.log('[DOWNLOAD REPORT] Generating QR code for URL:', cardUrl);
      const qrCodeDataUrl = await generateQRCode(cardUrl);
      console.log('[DOWNLOAD REPORT] QR code generated');

      // Extract card info
      const cardInfo = card.conversational_card_info || {};

      // Helper: Extract English name from bilingual format for PDF (react-pdf doesn't support Japanese fonts)
      const extractEnglishForPDF = (text: string | null | undefined): string | null => {
        if (!text) return null;

        // Check if text contains Japanese characters and bilingual format
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
        if (!hasJapanese) return text; // Already English-only

        // Extract English from "Japanese (English)" format
        const parts = text.split(/[/()（）]/);
        const englishPart = parts.find((p: string) => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));

        return englishPart ? englishPart.trim() : text;
      };

      // Build card details string (matches detail page format)
      // Extract English-only names for PDF compatibility
      const playerOrCharacter = extractEnglishForPDF(cardInfo.card_name || cardInfo.player_or_character || card.featured || card.card_name);
      // Handle "null" string and actual null values, then fall back to set_era
      const setNameRaw = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name :
                      (card.card_set && card.card_set !== 'null') ? card.card_set :
                      cardInfo.set_era || 'Unknown Set';
      const setNameBase = extractEnglishForPDF(setNameRaw);
      const year = cardInfo.year || card.release_date?.match(/\d{4}/)?.[0] || 'N/A';
      const cardNumber = cardInfo.card_number || card.card_number;
      const subset = cardInfo.subset || card.subset;
      // Combine set name with subset if available (matching foldable label format)
      const setName = subset ? `${setNameBase} - ${subset}` : setNameBase;

      // Build special features
      const features: string[] = [];
      if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true' || cardInfo.rookie_or_first === 'Yes') features.push('RC');
      if (cardInfo.autographed) features.push('Auto');
      const serialNum = cardInfo.serial_number;
      if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
        features.push(serialNum);
      }
      const specialFeatures = features.length > 0 ? features.join(' ') : '';
      const specialFeaturesString = features.length > 0 ? features.join(' • ') : ''; // New format with bullets

      // Build full card details: set - features - number - year (no duplicate card name/subset)
      const parts = [
        setName,
        specialFeatures,
        cardNumber,
        year
      ].filter(p => p && p.trim() !== '' && p !== 'N/A');
      const cardDetails = parts.join(' - ');

      // Transform card data for report
      const reportData: ReportCardData = {
        cardName: extractEnglishForPDF(cardInfo.card_name || card.card_name) || 'Unknown Card',
        playerName: playerOrCharacter || 'Unknown Player',
        setName: setName || 'Unknown Set',
        year: year,
        manufacturer: cardInfo.manufacturer || card.manufacturer_name || 'N/A',
        cardNumber: cardNumber || 'N/A',
        sport: cardInfo.sport_or_category || card.sport || 'N/A',
        frontImageUrl: frontImageBase64,
        backImageUrl: backImageBase64,
        grade: card.conversational_decimal_grade || 0,
        conditionLabel: card.conversational_condition_label || 'N/A',
        labelCondition: card.conversational_condition_label
          ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
          : (getConditionFromGrade(card.conversational_decimal_grade) || 'N/A'),
        gradeRange: (() => {
          // Extract just the uncertainty value (e.g., "10.0 ± 0.25" → "0.25")
          const uncertaintyStr = card.conversational_grade_uncertainty || '±0.25';
          const match = uncertaintyStr.match(/±\s*([\d.]+)/);
          const uncertaintyValue = match ? match[1] : '0.25';
          return `${card.conversational_decimal_grade || 0} ± ${uncertaintyValue}`;
        })(),
        serial: card.serial || `DCM-${card.id?.slice(0, 8)}`,
        cardDetails: cardDetails,
        specialFeaturesString: specialFeaturesString,
        cardUrl: cardUrl,
        qrCodeDataUrl: qrCodeDataUrl,
        professionalGrades: {
          psa: card.estimated_professional_grades?.PSA?.numeric_score || 'N/A',
          bgs: card.estimated_professional_grades?.BGS?.numeric_score || 'N/A',
          sgc: card.estimated_professional_grades?.SGC?.numeric_score || 'N/A',
          cgc: card.estimated_professional_grades?.CGC?.numeric_score || 'N/A',
        },
        subgrades: {
          centering: {
            score: card.conversational_weighted_sub_scores?.centering ||
                   card.conversational_sub_scores?.centering?.weighted || 0,
            frontScore: card.conversational_sub_scores?.centering?.front || 0,
            backScore: card.conversational_sub_scores?.centering?.back || 0,
            summary: extractCenteringSummary(card).combined,
            frontSummary: extractCenteringSummary(card).front,
            backSummary: extractCenteringSummary(card).back,
          },
          corners: {
            score: card.conversational_weighted_sub_scores?.corners ||
                   card.conversational_sub_scores?.corners?.weighted || 0,
            frontScore: card.conversational_sub_scores?.corners?.front || 0,
            backScore: card.conversational_sub_scores?.corners?.back || 0,
            summary: extractCornersSummary(card).combined,
            frontSummary: extractCornersSummary(card).front,
            backSummary: extractCornersSummary(card).back,
          },
          edges: {
            score: card.conversational_weighted_sub_scores?.edges ||
                   card.conversational_sub_scores?.edges?.weighted || 0,
            frontScore: card.conversational_sub_scores?.edges?.front || 0,
            backScore: card.conversational_sub_scores?.edges?.back || 0,
            summary: extractEdgesSummary(card).combined,
            frontSummary: extractEdgesSummary(card).front,
            backSummary: extractEdgesSummary(card).back,
          },
          surface: {
            score: card.conversational_weighted_sub_scores?.surface ||
                   card.conversational_sub_scores?.surface?.weighted || 0,
            frontScore: card.conversational_sub_scores?.surface?.front || 0,
            backScore: card.conversational_sub_scores?.surface?.back || 0,
            summary: extractSurfaceSummary(card).combined,
            frontSummary: extractSurfaceSummary(card).front,
            backSummary: extractSurfaceSummary(card).back,
          },
        },
        specialFeatures: {
          rookie: cardInfo.rookie_or_first === 'Yes' || cardInfo.rookie_or_first === true || card.rookie_card,
          autographed: cardInfo.autographed === true || card.autograph_type,
          serialNumbered: cardInfo.serial_number || card.serial_numbering || undefined,
          subset: cardInfo.subset || card.subset || undefined,
        },
        aiConfidence: card.conversational_image_confidence || 'N/A',
        imageQuality: extractImageQuality(card),
        overallSummary: card.conversational_final_grade_summary || undefined,
        generatedDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        reportId: card.id.substring(0, 8).toUpperCase(),
      };

      console.log('[DOWNLOAD REPORT] Generating PDF with data:', {
        ...reportData,
        frontImageUrl: frontImageBase64 ? `Base64 (${frontImageBase64.substring(0, 30)}...)` : 'MISSING',
        backImageUrl: backImageBase64 ? `Base64 (${backImageBase64.substring(0, 30)}...)` : 'MISSING',
      });

      // Generate PDF
      const blob = await pdf(<CardGradingReport cardData={reportData} />).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename using label details, serial, and report ID
      const sanitize = (text: string) => text.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '-');
      const playerNameClean = sanitize(reportData.playerName);
      const cardDetailsClean = sanitize(reportData.cardDetails);
      const serialClean = sanitize(reportData.serial);
      const reportIdClean = reportData.reportId;

      // Combine: DCM Report - PlayerName - CardDetails - Serial - ReportID
      const filenameParts = [playerNameClean, cardDetailsClean, serialClean, reportIdClean].filter(p => p);
      const filename = `DCM-Report-${filenameParts.join('-')}.pdf`;

      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

      console.log('[DOWNLOAD REPORT] ✅ PDF generated successfully');

    } catch (error) {
      console.error('[DOWNLOAD REPORT] ❌ Error generating report:', error);
      alert('Failed to generate report. Please try again or contact support if the issue persists.');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  /**
   * Handle Foldable Label generation and download
   */
  const handleDownloadLabel = async () => {
    try {
      setIsGenerating(true);
      setGeneratingType('label');
      setIsDropdownOpen(false);

      console.log('[FOLDABLE LABEL] Starting generation...');

      // Extract card info
      const cardInfo = card.conversational_card_info || {};

      // Helper: Extract English name from bilingual format
      const extractEnglishForPDF = (text: string | null | undefined): string | null => {
        if (!text) return null;
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
        if (!hasJapanese) return text;
        const parts = text.split(/[/()（）]/);
        const englishPart = parts.find((p: string) => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));
        return englishPart ? englishPart.trim() : text;
      };

      // Build player/character name (prioritize player_or_character for sports cards)
      const cardName = extractEnglishForPDF(
        cardInfo.player_or_character || card.featured || cardInfo.card_name || card.card_name
      ) || 'Unknown Card';

      // Build set name (include subset if available)
      const setNameRaw = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name :
                         (card.card_set && card.card_set !== 'null') ? card.card_set :
                         cardInfo.set_era || 'Unknown Set';
      const subset = cardInfo.subset || card.subset;
      const setNameWithSubset = subset ? `${extractEnglishForPDF(setNameRaw)} - ${subset}` : extractEnglishForPDF(setNameRaw);
      const setName = setNameWithSubset || 'Unknown Set';

      // Build special features
      const features: string[] = [];
      if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true' || cardInfo.rookie_or_first === 'Yes') features.push('RC');
      if (cardInfo.autographed) features.push('Auto');
      const serialNum = cardInfo.serial_number;
      if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
        features.push(serialNum);
      }
      const specialFeatures = features.length > 0 ? features.join(' • ') : undefined;

      // Get subgrades
      const weightedScores = card.conversational_weighted_sub_scores || {};
      const subScores = card.conversational_sub_scores || {};

      // Generate QR code and load logo
      const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;
      console.log('[FOLDABLE LABEL] Generating QR code for URL:', cardUrl);

      const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
        generateQRCodeWithLogo(cardUrl),
        loadLogoAsBase64().catch(() => undefined)
      ]);

      console.log('[FOLDABLE LABEL] QR code and logo loaded');

      // Get grade and condition
      const grade = card.conversational_decimal_grade ?? 0;
      const conditionLabel = card.conversational_condition_label
        ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
        : (getConditionFromGrade(grade) || 'N/A');

      // Build label data
      const labelData: FoldableLabelData = {
        cardName,
        setName,
        cardNumber: cardInfo.card_number || card.card_number,
        year: cardInfo.year || card.release_date?.match(/\d{4}/)?.[0],
        specialFeatures,
        serial: card.serial || `DCM-${card.id?.slice(0, 8)}`,
        grade,
        conditionLabel,
        subgrades: {
          centering: weightedScores.centering ?? subScores.centering?.weighted ?? 0,
          corners: weightedScores.corners ?? subScores.corners?.weighted ?? 0,
          edges: weightedScores.edges ?? subScores.edges?.weighted ?? 0,
          surface: weightedScores.surface ?? subScores.surface?.weighted ?? 0,
        },
        overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
        qrCodeDataUrl,
        cardUrl,
        logoDataUrl,
      };

      console.log('[FOLDABLE LABEL] Generating PDF with data:', {
        ...labelData,
        qrCodeDataUrl: qrCodeDataUrl ? 'present' : 'missing',
        logoDataUrl: logoDataUrl ? 'present' : 'missing',
      });

      // Generate PDF
      const blob = await generateFoldableLabel(labelData);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const sanitize = (text: string) => text.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '-');
      const cardNameClean = sanitize(cardName);
      const serialClean = sanitize(labelData.serial);
      const filename = `DCM-Label-${cardNameClean}-${serialClean}.pdf`;

      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

      console.log('[FOLDABLE LABEL] ✅ PDF generated successfully');

    } catch (error) {
      console.error('[FOLDABLE LABEL] ❌ Error generating label:', error);
      alert('Failed to generate foldable label. Please try again or contact support if the issue persists.');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  // Wrapper for full report download
  const handleDownloadReport = () => {
    setGeneratingType('report');
    setIsDropdownOpen(false);
    handleDownload();
  };

  // Open Avery label modal
  const handleOpenAveryModal = () => {
    setIsDropdownOpen(false);
    setIsAveryModalOpen(true);
  };

  /**
   * Handle Avery Label generation with selected position
   */
  const handleDownloadAveryLabel = async (positionIndex: number) => {
    try {
      setIsGenerating(true);
      setGeneratingType('avery');

      console.log('[AVERY LABEL] Starting generation at position:', positionIndex);

      // Extract card info (same logic as foldable label)
      const cardInfo = card.conversational_card_info || {};

      // Helper: Extract English name from bilingual format
      const extractEnglishForPDF = (text: string | null | undefined): string | null => {
        if (!text) return null;
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
        if (!hasJapanese) return text;
        const parts = text.split(/[/()（）]/);
        const englishPart = parts.find((p: string) => p.trim() && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(p));
        return englishPart ? englishPart.trim() : text;
      };

      // Build player/character name
      const cardName = extractEnglishForPDF(
        cardInfo.player_or_character || card.featured || cardInfo.card_name || card.card_name
      ) || 'Unknown Card';

      // Build set name
      const setNameRaw = (cardInfo.set_name && cardInfo.set_name !== 'null') ? cardInfo.set_name :
                         (card.card_set && card.card_set !== 'null') ? card.card_set :
                         cardInfo.set_era || 'Unknown Set';
      const subset = cardInfo.subset || card.subset;
      const setNameWithSubset = subset ? `${extractEnglishForPDF(setNameRaw)} - ${subset}` : extractEnglishForPDF(setNameRaw);
      const setName = setNameWithSubset || 'Unknown Set';

      // Build special features
      const features: string[] = [];
      if (cardInfo.rookie_or_first === true || cardInfo.rookie_or_first === 'true' || cardInfo.rookie_or_first === 'Yes') features.push('RC');
      if (cardInfo.autographed) features.push('Auto');
      const serialNum = cardInfo.serial_number;
      if (serialNum && serialNum !== 'N/A' && !serialNum.toLowerCase().includes('not present') && !serialNum.toLowerCase().includes('none')) {
        features.push(serialNum);
      }
      const specialFeatures = features.length > 0 ? features.join(' • ') : undefined;

      // Get subgrades
      const weightedScores = card.conversational_weighted_sub_scores || {};
      const subScores = card.conversational_sub_scores || {};

      // Generate QR code and load logo
      const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;
      console.log('[AVERY LABEL] Generating QR code for URL:', cardUrl);

      const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
        generateQRCodeWithLogo(cardUrl),
        loadLogoAsBase64().catch(() => undefined)
      ]);

      // Rotate QR code 180 degrees for Avery label (so it's upside down on printed label)
      // When the label folds over, this will appear right-side up on the back
      let rotatedQrCodeDataUrl = qrCodeDataUrl;
      if (qrCodeDataUrl) {
        try {
          const img = new Image();
          img.src = qrCodeDataUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load QR for rotation'));
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI); // 180 degrees
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            ctx.drawImage(img, 0, 0);
            rotatedQrCodeDataUrl = canvas.toDataURL('image/png');
            console.log('[AVERY LABEL] QR code rotated 180 degrees');
          }
        } catch (e) {
          console.warn('[AVERY LABEL] Could not rotate QR code, using original');
        }
      }

      // Get grade and condition
      const grade = card.conversational_decimal_grade ?? 0;
      const conditionLabel = card.conversational_condition_label
        ? card.conversational_condition_label.replace(/\s*\([A-Z]+\)/, '')
        : (getConditionFromGrade(grade) || 'N/A');

      // Build label data (same interface as foldable label)
      // Use the rotated QR code for Avery labels (appears upside down when printed,
      // right-side up when label is folded over the back of a one-touch slab)
      const labelData: FoldableLabelData = {
        cardName,
        setName,
        cardNumber: cardInfo.card_number || card.card_number,
        year: cardInfo.year || card.release_date?.match(/\d{4}/)?.[0],
        specialFeatures,
        serial: card.serial || `DCM-${card.id?.slice(0, 8)}`,
        grade,
        conditionLabel,
        subgrades: {
          centering: weightedScores.centering ?? subScores.centering?.weighted ?? 0,
          corners: weightedScores.corners ?? subScores.corners?.weighted ?? 0,
          edges: weightedScores.edges ?? subScores.edges?.weighted ?? 0,
          surface: weightedScores.surface ?? subScores.surface?.weighted ?? 0,
        },
        overallSummary: card.conversational_final_grade_summary || 'Card condition analysis not available.',
        qrCodeDataUrl: rotatedQrCodeDataUrl, // Use rotated QR for Avery label
        cardUrl,
        logoDataUrl,
      };

      console.log('[AVERY LABEL] Generating PDF...');

      // Generate PDF at selected position
      const blob = await generateAveryLabel(labelData, positionIndex);

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const sanitize = (text: string) => text.replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '-');
      const cardNameClean = sanitize(cardName);
      const serialClean = sanitize(labelData.serial);
      const filename = `DCM-AveryLabel-${cardNameClean}-${serialClean}.pdf`;

      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

      console.log('[AVERY LABEL] ✅ PDF generated successfully');
      setIsAveryModalOpen(false);

    } catch (error) {
      console.error('[AVERY LABEL] ❌ Error generating label:', error);
      alert('Failed to generate Avery label. Please try again or contact support if the issue persists.');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  // Dropdown menu items
  const menuItems = [
    {
      id: 'avery',
      label: 'One-Touch Magnetic Label',
      description: 'Avery 6871 (1-1/4" × 2-3/8")',
      onClick: handleOpenAveryModal,
    },
    {
      id: 'report',
      label: 'Full Grading Report',
      description: 'Complete PDF with all details',
      onClick: handleDownloadReport,
    },
    {
      id: 'label',
      label: 'Mini-Report',
      description: 'Fold or cut to 2.5" × 3.5"',
      onClick: handleDownloadLabel,
    },
  ];

  // Compact variant (smaller dropdown)
  if (variant === 'compact') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm text-sm font-medium"
          title="Download Options"
        >
          {isGenerating ? (
            <span>Generating...</span>
          ) : (
            <>
              <span>Download Label or Report</span>
              <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && !isGenerating && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className="w-full flex items-start px-4 py-3 hover:bg-purple-50 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Avery Label Position Modal */}
        <AveryLabelModal
          isOpen={isAveryModalOpen}
          onClose={() => setIsAveryModalOpen(false)}
          onConfirm={handleDownloadAveryLabel}
          isGenerating={isGenerating && generatingType === 'avery'}
        />
      </div>
    );
  }

  // Default variant (larger dropdown button)
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isGenerating}
        className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg font-semibold text-base"
        title="Download Options"
      >
        {isGenerating ? (
          <span>{generatingType === 'label' ? 'Generating Label...' : generatingType === 'avery' ? 'Generating Label...' : 'Generating Report...'}</span>
        ) : (
          <>
            <span>Download Label or Report</span>
            <svg className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && !isGenerating && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-start px-4 py-3 hover:bg-purple-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
            >
              <div>
                <div className="font-semibold text-gray-900">{item.label}</div>
                <div className="text-sm text-gray-500">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Avery Label Position Modal */}
      <AveryLabelModal
        isOpen={isAveryModalOpen}
        onClose={() => setIsAveryModalOpen(false)}
        onConfirm={handleDownloadAveryLabel}
        isGenerating={isGenerating && generatingType === 'avery'}
      />
    </div>
  );
};
