'use client';

import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { BatchCardGradingReport, ReportCardData } from './CardGradingReport';
import {
  FoldableLabelData,
  generateBatchFoldableLabels,
  generateQRCodeWithLogo,
  loadLogoAsBase64
} from '../../lib/foldableLabelGenerator';
import { getCardLabelData } from '../../lib/useLabelData';
import { extractAsciiSafe } from '../../lib/labelDataGenerator';
import { getAuthenticatedClient } from '../../lib/directAuth';
import { estimateProfessionalGrades, DcmGradingInput } from '../../lib/professionalGradeMapper';
import QRCode from 'qrcode';

interface CardData {
  id: string;
  card_name?: string;
  serial?: string;
  front_url?: string | null;
  back_url?: string | null;
  front_path?: string;
  back_path?: string;
  category?: string;
  featured?: string;
  pokemon_featured?: string;
  conversational_card_info?: Record<string, unknown>;
  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
  conversational_weighted_sub_scores?: Record<string, number>;
  conversational_sub_scores?: Record<string, { weighted?: number; front?: number; back?: number }>;
  conversational_final_grade_summary?: string;
  conversational_image_confidence?: string;
  conversational_grade_uncertainty?: string;
  conversational_corners_edges_surface?: Record<string, { summary?: string }>;
  estimated_professional_grades?: Record<string, { numeric_score?: string | number }>;
  dvg_decimal_grade?: number | null;
  manufacturer_name?: string;
  sport?: string;
  rookie_card?: boolean;
  autograph_type?: string;
  serial_numbering?: string;
  subset?: string;
  is_foil?: boolean;
  foil_type?: string;
  is_double_faced?: boolean;
  mtg_rarity?: string;
}

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: CardData[];
  cardType?: string;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  cardType = 'card'
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<'mini' | 'full' | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Helper to convert image URL to base64
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
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  // Generate QR code with logo
  const generateQRCode = async (url: string): Promise<string> => {
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, url, {
        width: 150,
        margin: 1,
        errorCorrectionLevel: 'H',
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas.toDataURL('image/png');

      const logo = new Image();
      logo.crossOrigin = 'anonymous';

      return new Promise((resolve) => {
        logo.onload = () => {
          const logoSize = canvas.width * 0.2;
          const logoX = (canvas.width - logoSize) / 2;
          const logoY = (canvas.height - logoSize) / 2;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, logoSize * 0.6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
          resolve(canvas.toDataURL('image/png'));
        };
        logo.onerror = () => resolve(canvas.toDataURL('image/png'));
        logo.src = '/DCM-logo.png';
      });
    } catch {
      return '';
    }
  };

  // Extract centering summary from card data
  const extractCenteringSummary = (card: CardData): { front: string; back: string; combined: string } => {
    const data = card.conversational_corners_edges_surface as Record<string, { summary?: string }> | undefined;
    const frontSummary = data?.front_centering?.summary || '';
    const backSummary = data?.back_centering?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Centering analysis not available.';

    return {
      front: frontSummary || 'Centering analysis not available.',
      back: backSummary || 'Centering analysis not available.',
      combined
    };
  };

  // Extract corners summary from card data
  const extractCornersSummary = (card: CardData): { front: string; back: string; combined: string } => {
    const data = card.conversational_corners_edges_surface as Record<string, { summary?: string }> | undefined;
    const frontSummary = data?.front_corners?.summary || '';
    const backSummary = data?.back_corners?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Corner analysis not available.';

    return {
      front: frontSummary || 'Corner analysis not available.',
      back: backSummary || 'Corner analysis not available.',
      combined
    };
  };

  // Extract edges summary from card data
  const extractEdgesSummary = (card: CardData): { front: string; back: string; combined: string } => {
    const data = card.conversational_corners_edges_surface as Record<string, { summary?: string }> | undefined;
    const frontSummary = data?.front_edges?.summary || '';
    const backSummary = data?.back_edges?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Edge analysis not available.';

    return {
      front: frontSummary || 'Edge analysis not available.',
      back: backSummary || 'Edge analysis not available.',
      combined
    };
  };

  // Extract surface summary from card data
  const extractSurfaceSummary = (card: CardData): { front: string; back: string; combined: string } => {
    const data = card.conversational_corners_edges_surface as Record<string, { summary?: string }> | undefined;
    const frontSummary = data?.front_surface?.summary || '';
    const backSummary = data?.back_surface?.summary || '';

    const combined = frontSummary && backSummary
      ? `Front: ${frontSummary} Back: ${backSummary}`
      : frontSummary || backSummary || 'Surface analysis not available.';

    return {
      front: frontSummary || 'Surface analysis not available.',
      back: backSummary || 'Surface analysis not available.',
      combined
    };
  };

  // Extract image quality description
  const extractImageQuality = (card: CardData): string => {
    const confidence = card.conversational_image_confidence || 'N/A';
    const qualityMap: { [key: string]: string } = {
      'A': 'Excellent - High confidence in grade accuracy',
      'B': 'Good - Moderate confidence in grade accuracy',
      'C': 'Fair - Lower confidence due to image limitations',
      'D': 'Poor - Significant image quality issues affecting analysis',
    };
    return qualityMap[confidence] || 'Quality assessment not available';
  };

  // Get card URLs with signed URL fallback
  const getCardUrls = async (card: CardData): Promise<{ front: string; back: string }> => {
    let frontUrl = card.front_url;
    let backUrl = card.back_url;

    if (!frontUrl || !backUrl) {
      if (card.front_path && card.back_path) {
        const authClient = getAuthenticatedClient();
        const [frontData, backData] = await Promise.all([
          authClient.storage.from('cards').createSignedUrl(card.front_path, 3600),
          authClient.storage.from('cards').createSignedUrl(card.back_path, 3600)
        ]);
        frontUrl = frontData.data?.signedUrl || '';
        backUrl = backData.data?.signedUrl || '';
      }
    }

    return { front: frontUrl || '', back: backUrl || '' };
  };

  // Build foldable label data for a card
  const buildLabelData = async (card: CardData): Promise<FoldableLabelData> => {
    const cleanLabelData = getCardLabelData(card as Parameters<typeof getCardLabelData>[0]);
    const weightedScores = card.conversational_weighted_sub_scores || {};
    const subScores = card.conversational_sub_scores || {};

    const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;
    const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
      generateQRCodeWithLogo(cardUrl),
      loadLogoAsBase64().catch(() => undefined)
    ]);

    const englishName = card.featured || card.pokemon_featured || card.card_name || undefined;

    return {
      cardName: cleanLabelData.primaryName,
      setName: cleanLabelData.setName || '',
      cardNumber: cleanLabelData.cardNumber || undefined,
      year: cleanLabelData.year || undefined,
      specialFeatures: cleanLabelData.featuresLine || undefined,
      serial: cleanLabelData.serial,
      englishName,
      grade: cleanLabelData.grade ?? 0,
      conditionLabel: cleanLabelData.condition,
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
  };

  // Build full report data for a card
  const buildReportData = async (card: CardData): Promise<ReportCardData> => {
    const cleanLabelData = getCardLabelData(card as Parameters<typeof getCardLabelData>[0]);
    const cardInfo = (card.conversational_card_info || {}) as Record<string, unknown>;

    const urls = await getCardUrls(card);
    const [frontImageBase64, backImageBase64] = await Promise.all([
      imageToBase64(urls.front),
      imageToBase64(urls.back)
    ]);

    const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;
    const qrCodeDataUrl = await generateQRCode(cardUrl);

    const englishName = card.featured || card.pokemon_featured || card.card_name || undefined;
    const safePrimaryName = extractAsciiSafe(cleanLabelData.primaryName, 'Card', englishName);
    const safeContextLine = cleanLabelData.contextLine ? extractAsciiSafe(cleanLabelData.contextLine, '') : '';
    const safeFeaturesLine = cleanLabelData.featuresLine ? extractAsciiSafe(cleanLabelData.featuresLine, '') : null;

    const subScores = card.conversational_sub_scores || {};
    const weightedScores = card.conversational_weighted_sub_scores || {};

    return {
      primaryName: safePrimaryName,
      contextLine: safeContextLine,
      featuresLine: safeFeaturesLine,
      serial: cleanLabelData.serial,
      grade: cleanLabelData.grade ?? 0,
      gradeFormatted: cleanLabelData.gradeFormatted,
      condition: cleanLabelData.condition,
      cardName: safePrimaryName,
      playerName: safePrimaryName,
      setName: cleanLabelData.setName ? extractAsciiSafe(cleanLabelData.setName, '') : '',
      year: cleanLabelData.year || '',
      cardNumber: cleanLabelData.cardNumber || '',
      manufacturer: (cardInfo.manufacturer as string) || card.manufacturer_name || '',
      sport: (cardInfo.sport_or_category as string) || card.sport || '',
      frontImageUrl: frontImageBase64,
      backImageUrl: backImageBase64,
      conditionLabel: card.conversational_condition_label || cleanLabelData.condition,
      labelCondition: cleanLabelData.condition,
      gradeRange: (() => {
        const uncertaintyStr = card.conversational_grade_uncertainty || '±0.25';
        const match = uncertaintyStr.match(/±\s*([\d.]+)/);
        const uncertaintyValue = match ? match[1] : '0.25';
        return `${cleanLabelData.grade ?? 0} ± ${uncertaintyValue}`;
      })(),
      cardDetails: safeContextLine,
      specialFeaturesString: safeFeaturesLine || '',
      cardUrl,
      qrCodeDataUrl,
      professionalGrades: (() => {
        // Use stored professional grades if available
        if (card.estimated_professional_grades?.PSA?.numeric_score !== undefined) {
          return {
            psa: card.estimated_professional_grades.PSA.numeric_score,
            bgs: card.estimated_professional_grades.BGS?.numeric_score || 'N/A',
            sgc: card.estimated_professional_grades.SGC?.numeric_score || 'N/A',
            cgc: card.estimated_professional_grades.CGC?.numeric_score || 'N/A',
          };
        }

        // Fallback: Calculate professional grade estimates from DCM grade
        // Same logic used by individual card detail pages
        const dcmGrade = cleanLabelData.grade ?? card.conversational_decimal_grade ?? card.dvg_decimal_grade;
        if (dcmGrade && typeof dcmGrade === 'number' && dcmGrade > 0) {
          try {
            const input: DcmGradingInput = {
              final_grade: dcmGrade,
              corners_score: subScores.corners?.weighted ?? weightedScores.corners,
              edges_score: subScores.edges?.weighted ?? weightedScores.edges,
              surface_score: subScores.surface?.weighted ?? weightedScores.surface,
            };
            const estimates = estimateProfessionalGrades(input);
            return {
              psa: estimates.PSA.numeric_score,
              bgs: estimates.BGS.numeric_score,
              sgc: estimates.SGC.numeric_score,
              cgc: estimates.CGC.numeric_score,
            };
          } catch (e) {
            console.error('[BatchDownloadModal] Failed to calculate professional grades:', e);
          }
        }

        return {
          psa: 'N/A',
          bgs: 'N/A',
          sgc: 'N/A',
          cgc: 'N/A',
        };
      })(),
      subgrades: {
        centering: {
          score: weightedScores.centering ?? subScores.centering?.weighted ?? 0,
          frontScore: subScores.centering?.front ?? 0,
          backScore: subScores.centering?.back ?? 0,
          summary: extractCenteringSummary(card).combined,
          frontSummary: extractCenteringSummary(card).front,
          backSummary: extractCenteringSummary(card).back,
        },
        corners: {
          score: weightedScores.corners ?? subScores.corners?.weighted ?? 0,
          frontScore: subScores.corners?.front ?? 0,
          backScore: subScores.corners?.back ?? 0,
          summary: extractCornersSummary(card).combined,
          frontSummary: extractCornersSummary(card).front,
          backSummary: extractCornersSummary(card).back,
        },
        edges: {
          score: weightedScores.edges ?? subScores.edges?.weighted ?? 0,
          frontScore: subScores.edges?.front ?? 0,
          backScore: subScores.edges?.back ?? 0,
          summary: extractEdgesSummary(card).combined,
          frontSummary: extractEdgesSummary(card).front,
          backSummary: extractEdgesSummary(card).back,
        },
        surface: {
          score: weightedScores.surface ?? subScores.surface?.weighted ?? 0,
          frontScore: subScores.surface?.front ?? 0,
          backScore: subScores.surface?.back ?? 0,
          summary: extractSurfaceSummary(card).combined,
          frontSummary: extractSurfaceSummary(card).front,
          backSummary: extractSurfaceSummary(card).back,
        },
      },
      specialFeatures: {
        rookie: (cardInfo.rookie_or_first === 'Yes' || cardInfo.rookie_or_first === true || card.rookie_card) as boolean,
        autographed: ((cardInfo.autographed as boolean) === true || !!card.autograph_type) as boolean,
        serialNumbered: (cardInfo.serial_number as string) || card.serial_numbering || undefined,
        subset: (cardInfo.subset as string) || card.subset || undefined,
        isFoil: card.is_foil || false,
        foilType: card.foil_type || undefined,
        isDoubleFaced: card.is_double_faced || false,
        rarity: card.mtg_rarity || undefined,
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
  };

  // Download mini-reports (foldable labels)
  const handleDownloadMiniReports = async () => {
    setIsGenerating(true);
    setGenerationType('mini');
    setError(null);
    setProgress({ current: 0, total: selectedCards.length });

    try {
      const labelDataArray: FoldableLabelData[] = [];

      for (let i = 0; i < selectedCards.length; i++) {
        setProgress({ current: i + 1, total: selectedCards.length });
        const labelData = await buildLabelData(selectedCards[i]);
        labelDataArray.push(labelData);
      }

      const blob = await generateBatchFoldableLabels(labelDataArray);

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `DCM-Mini-Reports-${selectedCards.length}-${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Batch mini-report generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate mini-reports');
    } finally {
      setIsGenerating(false);
      setGenerationType(null);
    }
  };

  // Download full reports
  const handleDownloadFullReports = async () => {
    setIsGenerating(true);
    setGenerationType('full');
    setError(null);
    setProgress({ current: 0, total: selectedCards.length });

    try {
      const reportDataArray: ReportCardData[] = [];

      for (let i = 0; i < selectedCards.length; i++) {
        setProgress({ current: i + 1, total: selectedCards.length });
        const reportData = await buildReportData(selectedCards[i]);
        reportDataArray.push(reportData);
      }

      // Generate batch PDF using react-pdf
      const blob = await pdf(<BatchCardGradingReport cardDataArray={reportDataArray} />).toBlob();

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `DCM-Full-Reports-${selectedCards.length}-${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Batch full report generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate full reports');
    } finally {
      setIsGenerating(false);
      setGenerationType(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Download Reports</h2>
              <p className="text-purple-100 text-sm mt-1">
                {selectedCards.length} cards selected
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="text-white/80 hover:text-white text-2xl font-light leading-none disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">
                Generating {generationType === 'mini' ? 'mini-reports' : 'full reports'}...
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Processing card {progress.current} of {progress.total}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm">
                Choose the type of report to download for all selected cards. Reports will be combined into a single PDF file.
              </p>

              {/* Mini-Reports Button */}
              <button
                onClick={handleDownloadMiniReports}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Mini-Reports (Foldable Labels)</h3>
                    <p className="text-sm text-gray-500">Compact labels for toploaders & display</p>
                  </div>
                </div>
              </button>

              {/* Full Reports Button */}
              <button
                onClick={handleDownloadFullReports}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Full Grading Reports</h3>
                    <p className="text-sm text-gray-500">Detailed analysis with images & subgrades</p>
                  </div>
                </div>
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Note: Large batches may take a few moments to generate
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
          >
            {isGenerating ? 'Please wait...' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchDownloadModal;
