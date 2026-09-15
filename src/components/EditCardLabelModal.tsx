'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { CustomLabelFields } from '../lib/useLabelData';
import type { LabelData } from '../lib/labelDataGenerator';
import { getStoredSession } from '../lib/directAuth';
import { HeritageLabelPreview } from './labels/HeritageLabelPreview';
import { ClassicLabelPreview } from './labels/ClassicLabelPreview';
import { ModernFrontLabel } from './labels/ModernFrontLabel';
import { resolveHeritageSelection, isClassicSelection } from '../lib/labels/labelStyleResolution';
import { HERITAGE_BRAND_COLORS } from '../lib/labelLab/heritageLayout';
import type { CustomLabelConfig, LabelColorOverrides } from '../lib/labelPresets';
import type { SlabLabelData } from '../lib/slabLabelGenerator';

interface EditCardLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  /** Current label data (with any existing custom overrides applied) */
  labelData: LabelData;
  /** Whether this card already has custom overrides */
  hasCustomLabel: boolean;
  /** Callback after successful save or revert — parent should refresh card data */
  onSaved: () => void;
  /**
   * The account's active label style, so the preview shows the label the
   * customer will actually print (Heritage, Traditional or Modern) instead
   * of a fixed Modern mockup. Absent = Modern.
   */
  labelStyle?: string | null;
  activeConfig?: CustomLabelConfig | null;
  /** Per-card Heritage band palette (resolveHeritageBandColors). */
  heritageBandColors?: string[];
  colorOverrides?: LabelColorOverrides;
}

interface FieldConfig {
  key: keyof CustomLabelFields;
  label: string;
  guidance: string;
  placeholder: string;
  type?: 'text' | 'tags';
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'primaryName',
    label: 'Card Name',
    guidance: 'The main name displayed on the label. For sports cards this is the player name, for TCG cards this is the card name.',
    placeholder: 'e.g. Charizard EX, Tom Brady',
  },
  {
    key: 'setName',
    label: 'Set Name',
    guidance: 'The card set or product line. Appears in the second line of the label.',
    placeholder: 'e.g. Scarlet & Violet, Topps Chrome',
  },
  {
    key: 'subset',
    label: 'Subset / Variant',
    guidance: 'The subset, parallel, or variant type. Appears after the set name.',
    placeholder: 'e.g. Holo Rare, Refractor, Full Art',
  },
  {
    key: 'cardNumber',
    label: 'Card Number',
    guidance: 'The collector number as printed on the card. Include # prefix if desired.',
    placeholder: 'e.g. #25, 232/182, SM226',
  },
  {
    key: 'year',
    label: 'Year',
    guidance: 'The release year of the card or set.',
    placeholder: 'e.g. 2024',
  },
  {
    key: 'features',
    label: 'Special Features',
    guidance: 'Notable attributes like Rookie Card, Autograph, Serial Numbered, 1st Edition, etc. Separate with commas.',
    placeholder: 'e.g. RC, Auto, /99, 1st Edition',
    type: 'tags',
  },
];

export function EditCardLabelModal({
  isOpen,
  onClose,
  cardId,
  labelData,
  hasCustomLabel,
  onSaved,
  labelStyle = 'modern',
  activeConfig = null,
  heritageBandColors,
  colorOverrides,
}: EditCardLabelModalProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [featuresText, setFeaturesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize form from current label data
  useEffect(() => {
    if (isOpen) {
      setFields({
        primaryName: labelData.primaryName || '',
        setName: labelData.setName || '',
        subset: labelData.subset || '',
        cardNumber: labelData.cardNumber || '',
        year: labelData.year || '',
      });
      setFeaturesText((labelData.features || []).join(', '));
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, labelData]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setError(null);
    setSuccessMsg(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Build custom fields — only include fields that differ from empty
      const customFields: CustomLabelFields = {};

      if (fields.primaryName !== undefined) customFields.primaryName = fields.primaryName;
      if (fields.setName !== undefined) customFields.setName = fields.setName || null;
      if (fields.subset !== undefined) customFields.subset = fields.subset || null;
      if (fields.cardNumber !== undefined) customFields.cardNumber = fields.cardNumber || null;
      if (fields.year !== undefined) customFields.year = fields.year || null;

      // Parse features from comma-separated text
      const features = featuresText
        .split(',')
        .map(f => f.trim())
        .filter(f => f.length > 0);
      customFields.features = features;

      const session = getStoredSession();
      if (!session?.access_token) {
        setError('You must be logged in to edit labels');
        return;
      }

      const res = await fetch(`/api/cards/${cardId}/custom-label`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ customFields }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccessMsg('Label updated successfully');
      onSaved();

      // Close after brief delay
      setTimeout(() => onClose(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [fields, featuresText, cardId, onSaved, onClose]);

  const handleRevert = useCallback(async () => {
    setIsReverting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const session = getStoredSession();
      if (!session?.access_token) {
        setError('You must be logged in to revert labels');
        return;
      }

      const res = await fetch(`/api/cards/${cardId}/custom-label`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to revert');
        return;
      }

      setSuccessMsg('Label reverted to original');
      onSaved();

      setTimeout(() => onClose(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert');
    } finally {
      setIsReverting(false);
    }
  }, [cardId, onSaved, onClose]);

  if (!isOpen) return null;

  const isLoading = isSaving || isReverting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Edit Card Label</h2>
              <p className="text-purple-200 text-sm">Customize how this card appears on all labels</p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Preview: the label the account will actually print, redrawn live from the fields */}
          {(() => {
            const cardNumberText = fields.cardNumber
              ? (fields.cardNumber.trim().startsWith('#') ? fields.cardNumber.trim() : `#${fields.cardNumber.trim()}`)
              : '';
            const contextLine = [fields.setName, fields.subset, cardNumberText, fields.year]
              .map(v => (v || '').trim())
              .filter(Boolean)
              .join(' • ');
            const features = featuresText.split(',').map(f => f.trim()).filter(Boolean);
            const previewData = {
              primaryName: fields.primaryName || 'Card Name',
              contextLine: contextLine || 'Set details',
              features,
              serial: labelData.serial,
              grade: labelData.grade,
              gradeFormatted: labelData.gradeFormatted,
              condition: labelData.condition,
              isAlteredAuthentic: labelData.isAlteredAuthentic,
              qrCodeDataUrl: '',
              subScores: undefined,
            } as unknown as SlabLabelData;
            const heritageSel = resolveHeritageSelection(labelStyle, activeConfig);
            const classic = isClassicSelection(labelStyle, activeConfig);
            return (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Label Preview</p>
                <div className="rounded-lg overflow-hidden bg-white">
                  {heritageSel.active ? (
                    <HeritageLabelPreview
                      data={previewData}
                      side="front"
                      pattern={heritageSel.pattern}
                      bandColors={heritageSel.bandColors ?? heritageBandColors ?? HERITAGE_BRAND_COLORS}
                      gradeColors={heritageSel.gradeColors}
                    />
                  ) : classic ? (
                    <ClassicLabelPreview data={previewData} side="front" />
                  ) : (
                    <ModernFrontLabel
                      displayName={previewData.primaryName}
                      setLineText={previewData.contextLine}
                      features={features}
                      serial={labelData.serial}
                      grade={labelData.grade}
                      condition={labelData.condition}
                      isAlteredAuthentic={labelData.isAlteredAuthentic}
                      size="md"
                      colorOverrides={colorOverrides}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Form fields */}
          {FIELD_CONFIGS.map((config) => (
            <div key={config.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {config.label}
              </label>
              <p className="text-xs text-gray-500 mb-1.5">{config.guidance}</p>
              {config.type === 'tags' ? (
                <input
                  type="text"
                  value={featuresText}
                  onChange={(e) => {
                    setFeaturesText(e.target.value);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  placeholder={config.placeholder}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                />
              ) : (
                <input
                  type="text"
                  value={fields[config.key] || ''}
                  onChange={(e) => handleFieldChange(config.key, e.target.value)}
                  placeholder={config.placeholder}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                />
              )}
            </div>
          ))}

          {/* Info notice */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">Changes apply everywhere</p>
            <p className="text-blue-700">
              Your edits will update the label on the card details page, downloadable reports,
              printable labels, collection view, and search results. Grade and serial number
              cannot be changed.
            </p>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          {successMsg && (
            <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">{successMsg}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            {hasCustomLabel && (
              <button
                onClick={handleRevert}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
              >
                {isReverting ? 'Reverting...' : 'Revert to Original'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
