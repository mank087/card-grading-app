'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getAvery8167Config,
  CalibrationOffsets,
  ToploaderLabelData,
  generateToploaderLabelSheet,
  generateToploaderLabelSheetMultiPage,
  getAvery8167CardsPerPage
} from '../../lib/avery8167LabelGenerator';
import { getLabelData } from '../../lib/labelDataGenerator';
import LabelPositionGrid8167 from './LabelPositionGrid8167';
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

interface BatchAvery8167LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: CardData[];
  cardType?: string;
}

const CALIBRATION_STORAGE_KEY = 'dcm_avery8167_calibration';
const CARDS_PER_PAGE = 40; // 40 card pairs per page (80 labels)

export const BatchAvery8167LabelModal: React.FC<BatchAvery8167LabelModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  cardType = 'card'
}) => {
  const config = getAvery8167Config();

  // Card-to-position mapping (cardId -> global position: page * CARDS_PER_PAGE + positionOnPage)
  const [positionMap, setPositionMap] = useState<Map<string, number>>(new Map());

  // Current page being viewed (0-indexed)
  const [currentPage, setCurrentPage] = useState(0);

  // Calibration
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multi-page calculations
  const totalPages = Math.ceil(selectedCards.length / CARDS_PER_PAGE);
  const isMultiPageMode = selectedCards.length > CARDS_PER_PAGE;

  // Calculate assigned card IDs
  const assignedCardIds = new Set(positionMap.keys());
  const assignedCount = assignedCardIds.size;

  // Get position map for current page only (convert global positions to page positions 0-39)
  const currentPagePositionMap = useMemo(() => {
    const pageMap = new Map<string, number>();
    const pageStart = currentPage * CARDS_PER_PAGE;
    const pageEnd = pageStart + CARDS_PER_PAGE;

    positionMap.forEach((globalPos, cardId) => {
      if (globalPos >= pageStart && globalPos < pageEnd) {
        pageMap.set(cardId, globalPos - pageStart);
      }
    });

    return pageMap;
  }, [positionMap, currentPage]);

  // Count cards assigned to current page
  const cardsOnCurrentPage = currentPagePositionMap.size;
  const availableOnCurrentPage = CARDS_PER_PAGE - cardsOnCurrentPage;

  // Get cards assigned to each page for the page indicators
  const cardsPerPage = useMemo(() => {
    const counts: number[] = Array(totalPages).fill(0);
    positionMap.forEach((globalPos) => {
      const page = Math.floor(globalPos / CARDS_PER_PAGE);
      if (page < totalPages) {
        counts[page]++;
      }
    });
    return counts;
  }, [positionMap, totalPages]);

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
      setCurrentPage(0);
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

  // Handle card drop onto grid (position is 0-39 on current page)
  const handleCardDrop = useCallback((cardId: string, positionOnPage: number) => {
    const globalPosition = currentPage * CARDS_PER_PAGE + positionOnPage;

    setPositionMap(prev => {
      const next = new Map(prev);
      // Remove card from any existing position
      prev.forEach((pos, id) => {
        if (id === cardId) {
          next.delete(id);
        }
      });
      // Assign to new global position
      next.set(cardId, globalPosition);
      return next;
    });
  }, [currentPage]);

  // Handle card removal from grid
  const handleCardRemove = useCallback((cardId: string) => {
    setPositionMap(prev => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  // Handle swapping two cards (positions are 0-39 on current page)
  const handleSwap = useCallback((fromPositionOnPage: number, toPositionOnPage: number) => {
    const fromGlobal = currentPage * CARDS_PER_PAGE + fromPositionOnPage;
    const toGlobal = currentPage * CARDS_PER_PAGE + toPositionOnPage;

    setPositionMap(prev => {
      const next = new Map(prev);
      let fromCardId: string | null = null;
      let toCardId: string | null = null;

      prev.forEach((pos, id) => {
        if (pos === fromGlobal) fromCardId = id;
        if (pos === toGlobal) toCardId = id;
      });

      if (fromCardId) next.set(fromCardId, toGlobal);
      if (toCardId) next.set(toCardId, fromGlobal);

      return next;
    });
  }, [currentPage]);

  // Auto-fill current page: place unassigned cards in available positions on this page
  const handleAutoFillPage = useCallback(() => {
    setPositionMap(prev => {
      const next = new Map(prev);
      const pageStart = currentPage * CARDS_PER_PAGE;

      // Get occupied positions on current page
      const occupiedOnPage = new Set<number>();
      prev.forEach((globalPos) => {
        if (globalPos >= pageStart && globalPos < pageStart + CARDS_PER_PAGE) {
          occupiedOnPage.add(globalPos - pageStart);
        }
      });

      // Get unassigned cards
      const unassignedCards = selectedCards.filter(c => !prev.has(c.id));

      let nextPosition = 0;
      for (const card of unassignedCards) {
        // Find next available position on this page
        while (occupiedOnPage.has(nextPosition) && nextPosition < CARDS_PER_PAGE) {
          nextPosition++;
        }
        if (nextPosition >= CARDS_PER_PAGE) break;

        const globalPos = pageStart + nextPosition;
        next.set(card.id, globalPos);
        occupiedOnPage.add(nextPosition);
        nextPosition++;
      }

      return next;
    });
  }, [selectedCards, currentPage]);

  // Auto-fill ALL pages: assign all cards sequentially across all pages
  const handleAutoFillAll = useCallback(() => {
    setPositionMap(() => {
      const next = new Map<string, number>();

      selectedCards.forEach((card, index) => {
        next.set(card.id, index);
      });

      return next;
    });
  }, [selectedCards]);

  // Clear all assignments
  const handleClearAll = useCallback(() => {
    setPositionMap(new Map());
  }, []);

  // Clear current page only
  const handleClearPage = useCallback(() => {
    const pageStart = currentPage * CARDS_PER_PAGE;
    const pageEnd = pageStart + CARDS_PER_PAGE;

    setPositionMap(prev => {
      const next = new Map(prev);
      prev.forEach((globalPos, cardId) => {
        if (globalPos >= pageStart && globalPos < pageEnd) {
          next.delete(cardId);
        }
      });
      return next;
    });
  }, [currentPage]);

  // Build label data for a card
  const buildLabelData = (card: CardData): ToploaderLabelData => {
    const cleanLabelData = getLabelData(card as Parameters<typeof getLabelData>[0]);
    const cardUrl = `${window.location.origin}/${cardType}/${card.id}`;

    // Use primaryName from getLabelData - this uses intelligent category-specific logic
    // (e.g., player_or_character for Sports, pokemon name with variant for Pokemon, etc.)
    return {
      grade: cleanLabelData.grade ?? 0,
      conditionLabel: cleanLabelData.condition || 'N/A',
      qrCodeUrl: cardUrl,
      cardName: cleanLabelData.primaryName,
    };
  };

  // Generate the PDF
  const generatePDF = async (): Promise<Blob> => {
    // Get all assigned cards sorted by global position
    const entries = Array.from(positionMap.entries()).sort((a, b) => a[1] - b[1]);

    // Build label data for each card in position order
    const labelDataArray: ToploaderLabelData[] = entries.map(([cardId]) => {
      const card = selectedCards.find(c => c.id === cardId);
      if (!card) throw new Error(`Card not found: ${cardId}`);
      return buildLabelData(card);
    });

    // Save calibration
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ x: offsetX, y: offsetY }));

    const offsets: CalibrationOffsets = { x: offsetX, y: offsetY };

    // Check if we need multi-page
    const maxPosition = entries.length > 0 ? Math.max(...entries.map(([_, pos]) => pos)) : 0;
    const pagesNeeded = Math.floor(maxPosition / CARDS_PER_PAGE) + 1;

    if (pagesNeeded > 1) {
      // Multi-page: need to generate with specific positions across pages
      const globalPositions = entries.map(([_, pos]) => pos);
      return generateToploaderLabelSheetMultiPageWithPositions(labelDataArray, globalPositions, offsets);
    } else {
      // Single page: use specific position indices
      const positionIndices = entries.map(([_, position]) => position);
      return generateToploaderLabelSheet(labelDataArray, positionIndices, offsets);
    }
  };

  // Generate multi-page PDF with specific positions
  const generateToploaderLabelSheetMultiPageWithPositions = async (
    labelDataArray: ToploaderLabelData[],
    globalPositions: number[],
    offsets: CalibrationOffsets
  ): Promise<Blob> => {
    // Group labels by page
    const labelsByPage = new Map<number, { data: ToploaderLabelData; positionOnPage: number }[]>();

    labelDataArray.forEach((data, index) => {
      const globalPos = globalPositions[index];
      const pageIndex = Math.floor(globalPos / CARDS_PER_PAGE);
      const positionOnPage = globalPos % CARDS_PER_PAGE;

      if (!labelsByPage.has(pageIndex)) {
        labelsByPage.set(pageIndex, []);
      }
      labelsByPage.get(pageIndex)!.push({ data, positionOnPage });
    });

    // Sort pages
    const sortedPages = Array.from(labelsByPage.keys()).sort((a, b) => a - b);

    // Reorder labels for sequential generation with positions
    const reorderedLabels: ToploaderLabelData[] = [];
    const reorderedPositions: number[] = [];

    sortedPages.forEach(pageIndex => {
      const labelsOnPage = labelsByPage.get(pageIndex)!;
      labelsOnPage.forEach(({ data, positionOnPage }) => {
        reorderedLabels.push(data);
        reorderedPositions.push(pageIndex * CARDS_PER_PAGE + positionOnPage);
      });
    });

    // Use multi-page generator with positions
    return generateToploaderLabelSheetMultiPage(reorderedLabels, offsets, reorderedPositions);
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
      const pagesUsed = positionMap.size > 0
        ? Math.max(...Array.from(positionMap.values()).map(p => Math.floor(p / CARDS_PER_PAGE))) + 1
        : 1;
      const pageInfo = pagesUsed > 1 ? `-${pagesUsed}pages` : '';
      link.download = `DCM-ToploaderLabels-${assignedCount}cards${pageInfo}-${timestamp}.pdf`;

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
              <h2 className="text-xl font-bold text-white">Print Toploader Labels</h2>
              <p className="text-purple-100 text-sm mt-1">
                {selectedCards.length} cards selected • {assignedCount} assigned
                {isMultiPageMode && <> • {totalPages} pages</>}
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

              {/* Page Navigation (for multi-page) */}
              {isMultiPageMode && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          currentPage === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage === totalPages - 1}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          currentPage === totalPages - 1
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        Next →
                      </button>
                    </div>
                  </div>

                  {/* Page indicators */}
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          idx === currentPage
                            ? 'bg-purple-600 text-white'
                            : cardsPerPage[idx] > 0
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        P{idx + 1} ({cardsPerPage[idx]}/{CARDS_PER_PAGE})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main drag-drop layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Unassigned Cards */}
                <div>
                  <UnassignedCardsList
                    cards={selectedCards}
                    assignedCardIds={assignedCardIds}
                  />

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleAutoFillPage}
                        disabled={availableOnCurrentPage === 0 || assignedCount >= selectedCards.length || isGenerating}
                        className={`
                          flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                          ${availableOnCurrentPage > 0 && assignedCount < selectedCards.length && !isGenerating
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }
                        `}
                      >
                        Fill Page {currentPage + 1}
                      </button>
                      <button
                        onClick={handleClearPage}
                        disabled={cardsOnCurrentPage === 0 || isGenerating}
                        className={`
                          flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                          ${cardsOnCurrentPage > 0 && !isGenerating
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }
                        `}
                      >
                        Clear Page
                      </button>
                    </div>
                    {isMultiPageMode && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleAutoFillAll}
                          disabled={assignedCount >= selectedCards.length || isGenerating}
                          className={`
                            flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${assignedCount < selectedCards.length && !isGenerating
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                          `}
                        >
                          Fill All Pages
                        </button>
                        <button
                          onClick={handleClearAll}
                          disabled={assignedCount === 0 || isGenerating}
                          className={`
                            flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                            ${assignedCount > 0 && !isGenerating
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                          `}
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                    {!isMultiPageMode && (
                      <button
                        onClick={handleClearAll}
                        disabled={assignedCount === 0 || isGenerating}
                        className={`
                          px-3 py-2 rounded-lg text-sm font-medium transition-all
                          ${assignedCount > 0 && !isGenerating
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }
                        `}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Label Position Grid - shows current page */}
                <LabelPositionGrid8167
                  positionMap={currentPagePositionMap}
                  cards={selectedCards}
                  onCardDrop={handleCardDrop}
                  onCardRemove={handleCardRemove}
                  onSwap={handleSwap}
                  pageNumber={isMultiPageMode ? currentPage + 1 : undefined}
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
                      If labels print slightly off-center, adjust these offsets.
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
                  <strong>Tip:</strong> Print at 100% scale (no scaling) for proper alignment.
                  Drag cards to positions, or click a card in the grid to remove it.
                  {isMultiPageMode && ' Use page navigation to assign cards across multiple pages.'}
                  {' '}Apply front labels to toploader front, back labels to toploader back.
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

export default BatchAvery8167LabelModal;
