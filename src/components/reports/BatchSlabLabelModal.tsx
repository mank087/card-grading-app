'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateBatchSlabLabels, getSlabLabelConfig, SlabLabelData } from '../../lib/slabLabelGenerator';
import { generateBatchCustomSlabLabels } from '../../lib/customSlabLabelGenerator';
import { generateQRCodePlain, loadLogoAsBase64, loadWhiteLogoAsBase64 } from '../../lib/foldableLabelGenerator';
import { getCardLabelData } from '../../lib/useLabelData';
import { useCustomLabelStyle, type LabelStyleId } from '@/hooks/useCustomLabelStyle';
import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';

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
  // Emblem/badge fields
  show_founder_badge?: boolean;
  show_vip_badge?: boolean;
  show_card_lover_badge?: boolean;
  // User-edited label overrides
  custom_label_data?: Record<string, unknown> | null;
}

interface BatchSlabLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCards: CardData[];
  cardType?: string;
  labelStyle?: string;
  // Badge settings from user profile
  showFounderEmblem?: boolean;
  showVipEmblem?: boolean;
  showCardLoversEmblem?: boolean;
}

const LABELS_PER_PAGE = getSlabLabelConfig().labelsPerPage;

export const BatchSlabLabelModal: React.FC<BatchSlabLabelModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  cardType = 'card',
  labelStyle: labelStyleProp,
  showFounderEmblem = false,
  showVipEmblem = false,
  showCardLoversEmblem = false,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Use shared hook for style + custom styles
  const { labelStyle: hookLabelStyle, customStyles, activeConfig, switchStyle } = useCustomLabelStyle();

  // Local style state - initialized from prop or hook
  const [localStyle, setLocalStyle] = useState<LabelStyleId>(
    (labelStyleProp as LabelStyleId) || hookLabelStyle || 'modern'
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setProgress(0);
      setLocalStyle((labelStyleProp as LabelStyleId) || hookLabelStyle || 'modern');
    }
  }, [isOpen, labelStyleProp, hookLabelStyle]);

  // Resolve the active custom config for the local style
  const localActiveConfig = useMemo(() => {
    if (localStyle === 'modern' || localStyle === 'traditional') return null;
    return customStyles.find(s => s.id === localStyle)?.config || null;
  }, [localStyle, customStyles]);

  const handleStyleSwitch = (id: LabelStyleId) => {
    setLocalStyle(id);
  };

  // Build SlabLabelData for a single card
  const buildSlabLabelData = useCallback(async (
    card: CardData,
    logoDataUrl: string | undefined,
    whiteLogoDataUrl: string | undefined
  ): Promise<SlabLabelData> => {
    const labelData = getCardLabelData(card);
    const verifyUrl = `https://dcmgrading.com/verify/${card.serial || ''}`;

    const qrCodeDataUrl = await generateQRCodePlain(verifyUrl).catch(() => '');

    const weightedScores = card.conversational_weighted_sub_scores || {};
    const subScores = card.conversational_sub_scores || {};

    return {
      primaryName: labelData.primaryName,
      contextLine: labelData.contextLine,
      features: labelData.features,
      featuresLine: labelData.featuresLine,
      serial: labelData.serial,
      grade: labelData.grade,
      gradeFormatted: labelData.gradeFormatted,
      condition: labelData.condition,
      isAlteredAuthentic: labelData.isAlteredAuthentic,
      englishName: card.featured || card.pokemon_featured || card.card_name || undefined,
      qrCodeDataUrl,
      subScores: {
        centering: weightedScores.centering ?? (subScores.centering as any)?.weighted ?? 0,
        corners: weightedScores.corners ?? (subScores.corners as any)?.weighted ?? 0,
        edges: weightedScores.edges ?? (subScores.edges as any)?.weighted ?? 0,
        surface: weightedScores.surface ?? (subScores.surface as any)?.weighted ?? 0,
      },
      showFounderEmblem,
      showVipEmblem,
      showCardLoversEmblem,
      logoDataUrl,
      whiteLogoDataUrl,
    };
  }, [showFounderEmblem, showVipEmblem, showCardLoversEmblem]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Pre-load logos once
      const [logoDataUrl, whiteLogoDataUrl] = await Promise.all([
        loadLogoAsBase64().catch(() => undefined),
        loadWhiteLogoAsBase64().catch(() => undefined),
      ]);

      // Build label data for all selected cards
      const labelDataArray: SlabLabelData[] = [];

      for (let i = 0; i < selectedCards.length; i++) {
        const card = selectedCards[i];
        const labelData = await buildSlabLabelData(card, logoDataUrl, whiteLogoDataUrl);
        labelDataArray.push(labelData);
        setProgress(Math.round(((i + 1) / selectedCards.length) * 80));
      }

      setProgress(85);

      let blob: Blob;

      if (localActiveConfig) {
        // Custom style — use batch generator with same multi-up grid layout as standard
        blob = await generateBatchCustomSlabLabels(labelDataArray, localActiveConfig);
      } else {
        // Built-in style — use standard batch generator
        const builtInStyle: 'modern' | 'traditional' = localStyle === 'traditional' ? 'traditional' : 'modern';
        blob = await generateBatchSlabLabels(labelDataArray, builtInStyle);
      }

      setProgress(95);

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DCM-Slab-Labels-${selectedCards.length}-cards.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error('[SLAB LABEL] Error generating batch labels:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate labels');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedCards, localStyle, localActiveConfig, buildSlabLabelData, onClose]);

  const totalPages = Math.ceil(selectedCards.length / LABELS_PER_PAGE);
  const totalSheets = totalPages; // Each sheet = 1 front page + 1 back page

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Graded Slab Labels</h2>
              <p className="text-purple-200 text-sm">2.8&quot; × 0.8&quot; — Duplex printing with cut guides</p>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{selectedCards.length}</div>
                <div className="text-xs text-gray-500">Labels</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">{totalSheets}</div>
                <div className="text-xs text-gray-500">{totalSheets === 1 ? 'Sheet' : 'Sheets'} (duplex)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-700">{totalPages * 2}</div>
                <div className="text-xs text-gray-500">Pages total</div>
              </div>
            </div>
          </div>

          {/* Label Style Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Label Style</label>
            <LabelStyleDropdown
              labelStyle={localStyle}
              customStyles={customStyles}
              onSwitch={handleStyleSwitch}
            />
          </div>

          {/* Print Instructions */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Print Instructions:</p>
            <ul className="space-y-0.5 text-xs text-blue-700">
              <li>1. Print duplex (double-sided), flip on <strong>long edge</strong></li>
              <li>2. Front labels print on odd pages, back labels on even pages</li>
              <li>3. Cut along the dotted lines (scissor marks at corners)</li>
              <li>4. Each label fits your slab&apos;s 2.8&quot; × 0.8&quot; label slot</li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Generating labels...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedCards.length === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Generate {selectedCards.length} Label{selectedCards.length !== 1 ? 's' : ''} (PDF)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
