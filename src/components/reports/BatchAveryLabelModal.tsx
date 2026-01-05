'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getAveryConfig, CalibrationOffsets, generateAveryLabelSheet } from '../../lib/averyLabelGenerator';
import { generateQRCodePlain, loadLogoAsBase64 } from '../../lib/foldableLabelGenerator';
import { getLabelData } from '../../lib/labelDataGenerator';
import { FoldableLabelData } from '../../lib/foldableLabelGenerator';
import LabelPositionGrid from './LabelPositionGrid';
import UnassignedCardsList from './UnassignedCardsList';

interface CardData {
  id: string;
  card_name?: string;
  serial?: string;
  front_image_url?: string;
  category?: string;
  conversational_card_info?: {
    card_name?: string;
  };
  conversational_decimal_grade?: number | null;
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
  conversational_weighted_sub_scores?: Record<string, number>;
  conversational_sub_scores?: Record<string, { weighted?: number }>;
  conversational_final_grade_summary?: string;
  dvg_decimal_grade?: number | null;
  featured?: string;
  pokemon_featured?: string;
  card_set?: string;
  card_number?: string;
  pokemon_api_data?: Record<string, unknown>;
}

interface BatchAveryLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: CardData[];
  cardType?: string;
}

const CALIBRATION_STORAGE_KEY = 'dcm_avery_calibration';
const MAX_LABELS = 18;

export const BatchAveryLabelModal: React.FC<BatchAveryLabelModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  cardType = 'card'
}) => {
  const config = getAveryConfig();

  // Card-to-position mapping (cardId -> position 0-17)
  const [positionMap, setPositionMap] = useState<Map<string, number>>(new Map());

  // Calibration
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate assigned card IDs
  const assignedCardIds = new Set(positionMap.keys());
  const assignedCount = assignedCardIds.size;
  const availablePositions = MAX_LABELS - assignedCount;

  // Load calibration from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const savedCalibration = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (savedCalibration) {
        try {
          const cal = JSON.parse(savedCalibration);
          if (typeof cal.x === 'number') setOffsetX(cal.x);
          if (typeof cal.y === 'number') setOffsetY(cal.y);
        } catch (e) {
          // Ignore parse errors
        }
      }
      // Clear preview when reopening
      setPreviewUrl(null);
      setIsPreviewing(false);
      setError(null);
    }
  }, [isOpen]);

  // Reset state when modal opens with new cards
  useEffect(() => {
    if (isOpen) {
      setPositionMap(new Map());
    }
  }, [isOpen, selectedCards]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle card drop onto grid
  const handleCardDrop = useCallback((cardId: string, position: number) => {
    setPositionMap(prev => {
      const next = new Map(prev);
      // Remove card from any existing position
      prev.forEach((pos, id) => {
        if (id === cardId) {
          next.delete(id);
        }
      });
      // Assign to new position
      next.set(cardId, position);
      return next;
    });
  }, []);

  // Handle card removal from grid
  const handleCardRemove = useCallback((cardId: string) => {
    setPositionMap(prev => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  // Handle swapping two cards
  const handleSwap = useCallback((fromPosition: number, toPosition: number) => {
    setPositionMap(prev => {
      const next = new Map(prev);
      let fromCardId: string | null = null;
      let toCardId: string | null = null;

      prev.forEach((pos, id) => {
        if (pos === fromPosition) fromCardId = id;
        if (pos === toPosition) toCardId = id;
      });

      if (fromCardId) next.set(fromCardId, toPosition);
      if (toCardId) next.set(toCardId, fromPosition);

      return next;
    });
  }, []);

  // Auto-fill: place unassigned cards in first available positions (starting from position 0)
  const handleAutoFill = useCallback(() => {
    setPositionMap(prev => {
      const next = new Map(prev);
      const occupiedPositions = new Set(prev.values());

      // Get cards not yet assigned
      const unassignedCards = selectedCards.filter(c => !prev.has(c.id));

      let nextPosition = 0;

      for (const card of unassignedCards) {
        // Find next available position starting from 0
        while (occupiedPositions.has(nextPosition) && nextPosition < MAX_LABELS) {
          nextPosition++;
        }
        if (nextPosition >= MAX_LABELS) break;

        next.set(card.id, nextPosition);
        occupiedPositions.add(nextPosition);
        nextPosition++;
      }

      return next;
    });
  }, [selectedCards]);

  // Clear all assignments
  const handleClearAll = useCallback(() => {
    setPositionMap(new Map());
  }, []);

  // Helper function to rotate an image 180 degrees
  const rotateImage180 = async (dataUrl: string): Promise<string> => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for rotation'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
    return dataUrl;
  };

  // Build label data for a card
  const buildLabelData = async (card: CardData): Promise<FoldableLabelData> => {
    const cleanLabelData = getLabelData(card as Parameters<typeof getLabelData>[0]);

    // Get subgrades
    const weightedScores = card.conversational_weighted_sub_scores || {};
    const subScores = card.conversational_sub_scores || {};

    // Generate QR code and load logo
    const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;

    const [qrCodeDataUrl, logoDataUrl] = await Promise.all([
      generateQRCodePlain(cardUrl),
      loadLogoAsBase64().catch(() => undefined)
    ]);

    // Rotate QR code and logo 180 degrees for folding
    let rotatedQrCodeDataUrl = qrCodeDataUrl;
    let rotatedLogoDataUrl: string | undefined = undefined;

    if (qrCodeDataUrl) {
      try {
        rotatedQrCodeDataUrl = await rotateImage180(qrCodeDataUrl);
      } catch (e) {
        // Use original if rotation fails
      }
    }

    if (logoDataUrl) {
      try {
        rotatedLogoDataUrl = await rotateImage180(logoDataUrl);
      } catch (e) {
        // Skip if rotation fails
      }
    }

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
      qrCodeDataUrl: rotatedQrCodeDataUrl,
      cardUrl,
      logoDataUrl,
      rotatedLogoDataUrl,
    };
  };

  // Generate the PDF
  const generatePDF = async (): Promise<Blob> => {
    // Get all assigned cards in order
    const entries = Array.from(positionMap.entries());

    // Build label data for each card
    const labelDataPromises = entries.map(async ([cardId]) => {
      const card = selectedCards.find(c => c.id === cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      return buildLabelData(card);
    });

    const labelDataArray = await Promise.all(labelDataPromises);
    const positionIndices = entries.map(([_, position]) => position);

    // Save calibration
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ x: offsetX, y: offsetY }));

    // Generate PDF
    const offsets: CalibrationOffsets = { x: offsetX, y: offsetY };
    return generateAveryLabelSheet(labelDataArray, positionIndices, offsets);
  };

  // Handle preview
  const handlePreview = async () => {
    if (assignedCount === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      const blob = await generatePDF();

      // Clean up old preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewing(true);
    } catch (err) {
      console.error('Preview generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (assignedCount === 0) return;

    setIsGenerating(true);
    setError(null);

    try {
      const blob = await generatePDF();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `DCM-AveryLabels-${assignedCount}-${timestamp}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      // Close modal after download
      onClose();
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle back from preview
  const handleBackFromPreview = () => {
    setIsPreviewing(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Format offset for display
  const formatOffset = (value: number): string => {
    const formatted = value.toFixed(3);
    return value >= 0 ? `+${formatted}` : formatted;
  };

  // Reset calibration to defaults
  const handleResetCalibration = () => {
    setOffsetX(0);
    setOffsetY(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Print Avery Labels</h2>
              <p className="text-purple-100 text-sm mt-1">
                {selectedCards.length} cards selected • {assignedCount} assigned • {availablePositions} positions available
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl font-light leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isPreviewing && previewUrl ? (
            // Preview Mode
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBackFromPreview}
                  className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                >
                  ← Back to arrangement
                </button>
                <span className="text-gray-500 text-sm">Preview Mode</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                <iframe
                  src={previewUrl}
                  className="w-full h-[500px]"
                  title="Label Preview"
                />
              </div>
            </div>
          ) : (
            // Arrangement Mode
            <div className="space-y-4">
              {/* Error display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Main layout - side by side on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Unassigned Cards */}
                <div>
                  <UnassignedCardsList
                    cards={selectedCards}
                    assignedCardIds={assignedCardIds}
                  />

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAutoFill}
                      disabled={assignedCount >= selectedCards.length || isGenerating}
                      className={`
                        flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${assignedCount < selectedCards.length && !isGenerating
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      Auto-fill
                    </button>
                    <button
                      onClick={handleClearAll}
                      disabled={assignedCount === 0 || isGenerating}
                      className={`
                        flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${assignedCount > 0 && !isGenerating
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Label Position Grid */}
                <LabelPositionGrid
                  positionMap={positionMap}
                  cards={selectedCards}
                  onCardDrop={handleCardDrop}
                  onCardRemove={handleCardRemove}
                  onSwap={handleSwap}
                />
              </div>

              {/* Calibration Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowCalibration(!showCalibration)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm font-medium text-gray-700 transition-colors"
                >
                  <span>Printer Calibration</span>
                  <span className={`transform transition-transform ${showCalibration ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {showCalibration && (
                  <div className="p-4 bg-white border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-4">
                      If labels print slightly off-center, adjust these offsets. Positive values move the label right/down, negative values move it left/up.
                    </p>

                    {/* Horizontal Offset */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">
                          Horizontal Offset
                        </label>
                        <span className="text-xs font-mono text-purple-600">
                          {formatOffset(offsetX)}"
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-0.1"
                        max="0.1"
                        step="0.005"
                        value={offsetX}
                        onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>-0.1" (left)</span>
                        <span>0</span>
                        <span>+0.1" (right)</span>
                      </div>
                    </div>

                    {/* Vertical Offset */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">
                          Vertical Offset
                        </label>
                        <span className="text-xs font-mono text-purple-600">
                          {formatOffset(offsetY)}"
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-0.1"
                        max="0.1"
                        step="0.005"
                        value={offsetY}
                        onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>-0.1" (up)</span>
                        <span>0</span>
                        <span>+0.1" (down)</span>
                      </div>
                    </div>

                    {/* Reset button */}
                    <button
                      onClick={handleResetCalibration}
                      className="text-xs text-purple-600 hover:text-purple-800 underline"
                    >
                      Reset to default (0, 0)
                    </button>

                    {/* Calibration status */}
                    {(offsetX !== 0 || offsetY !== 0) && (
                      <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-2">
                        <p className="text-xs text-purple-700">
                          Custom calibration active: {formatOffset(offsetX)}" horizontal, {formatOffset(offsetY)}" vertical
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tip */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-xs">
                  <strong>Tip:</strong> Print at 100% scale (no scaling) for proper alignment. Drag cards between positions to reorder, or click a card in the grid to remove it.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {!isPreviewing && (
            <button
              onClick={handlePreview}
              disabled={assignedCount === 0 || isGenerating}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all
                ${assignedCount > 0 && !isGenerating
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Preview
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={assignedCount === 0 || isGenerating}
            className={`
              px-6 py-2 rounded-lg font-semibold transition-all
              ${assignedCount > 0 && !isGenerating
                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Generating...
              </span>
            ) : (
              `Download PDF (${assignedCount})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchAveryLabelModal;
