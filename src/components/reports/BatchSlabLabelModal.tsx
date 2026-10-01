'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateBatchSlabLabels, generateBatchFoldOverSlabLabels, getSlabLabelConfig, SlabLabelData } from '../../lib/slabLabelGenerator';
import { generateBatchCustomSlabLabels, generateBatchFoldOverCustomLabels } from '../../lib/customSlabLabelGenerator';
import { generateQRCodePlain, generateQRCodeWithLogo, loadLogoAsBase64, loadWhiteLogoAsBase64 } from '../../lib/foldableLabelGenerator';
import { loadLogosForCard, cardQrUrl } from '@/lib/orgBranding';
import { getCardLabelData } from '../../lib/useLabelData';
import { toSlabLabelData } from '@/lib/labels/slabLabelDataAdapter';
import { useCustomLabelStyle, type LabelStyleId } from '@/hooks/useCustomLabelStyle';
import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';
import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import { resolveSheetGeometry, isTrueSizeDensity, type SheetDensity } from '@/lib/labels/sheetGeometry';
import {
  readSheetCalibration,
  saveSheetCalibration,
  sheetLayoutFor,
  isDefaultSheetCalibration,
  toDisplayUnit,
  fromDisplayUnit,
  DEFAULT_SHEET_CALIBRATION,
  MAX_SHEET_OFFSET_IN,
  MM_PER_IN,
  type SheetCalibration,
} from '@/lib/labels/sheetCalibration';

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
  // Extracted card palette — drives the Heritage band per card
  card_colors?: {
    primary?: string; secondary?: string;
    palette?: string[]; topEdgeColors?: string[];
  } | null;
  // Enterprise org the card was graded under, when applicable
  org_id?: string | null;
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
  /**
   * A complete working design (Label Wizard). When present it wins over the
   * saved-style resolution AND hides the style dropdown — the design was
   * already chosen upstream. `style: 'heritage'` configs route through the
   * heritage vector batch exactly like a saved heritage slot would.
   */
  configOverride?: import('@/lib/labelPresets').CustomLabelConfig | null;
}

const LABELS_PER_PAGE = getSlabLabelConfig().labelsPerPage;

/** Remembered across sessions so a store that prints 20-up keeps printing 20-up. */
const DENSITY_STORAGE_KEY = 'dcm.labelSheetDensity';

function readStoredDensity(): SheetDensity {
  if (typeof window === 'undefined') return 'standard';
  try {
    const v = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    return v === 'dense' || v === 'up26' || v === 'up30' ? v : 'standard';
  } catch {
    return 'standard';
  }
}

type OffsetKey = keyof SheetCalibration['offsetsIn'];
const OFFSET_FIELDS: Array<{ key: OffsetKey; label: string; hint: string }> = [
  { key: 'globalX', label: 'Both sides X', hint: '+ moves right' },
  { key: 'globalY', label: 'Both sides Y', hint: '+ moves down' },
  { key: 'backX', label: 'Back only X', hint: '+ moves right (seen from the back)' },
  { key: 'backY', label: 'Back only Y', hint: '+ moves down' },
];

export const BatchSlabLabelModal: React.FC<BatchSlabLabelModalProps> = ({
  isOpen,
  onClose,
  selectedCards,
  cardType = 'card',
  labelStyle: labelStyleProp,
  showFounderEmblem = false,
  showVipEmblem = false,
  showCardLoversEmblem = false,
  configOverride = null,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [printFormat, setPrintFormat] = useState<'duplex' | 'foldover'>('duplex');
  // 10, 20, 26 or 30 (true-size, pre-perforated) labels per duplex sheet; fold-over owns its own layout.
  const [density, setDensity] = useState<SheetDensity>('standard');
  // Duplex flip edge + printer calibration (saved in this browser).
  const [calibration, setCalibration] = useState<SheetCalibration>(DEFAULT_SHEET_CALIBRATION);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationSaved, setCalibrationSaved] = useState(false);
  // Bumped when stored values replace what the inputs show (open, unit, reset),
  // so the uncontrolled offset inputs re-seed without fighting the user's typing.
  const [calibrationNonce, setCalibrationNonce] = useState(0);

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
      setDensity(readStoredDensity());
      setCalibration(readSheetCalibration());
      setCalibrationSaved(false);
      setCalibrationNonce(n => n + 1);
    }
  }, [isOpen, labelStyleProp, hookLabelStyle]);

  // Resolve the active custom config for the local style. A wizard
  // configOverride short-circuits the saved-slot lookup entirely.
  const localActiveConfig = useMemo(() => {
    if (configOverride) return configOverride;
    if (localStyle === 'modern' || localStyle === 'traditional' || localStyle === 'heritage') return null;
    return customStyles.find(s => s.id === localStyle)?.config || null;
  }, [configOverride, localStyle, customStyles]);

  const chooseDensity = (next: SheetDensity) => {
    setDensity(next);
    try { window.localStorage.setItem(DENSITY_STORAGE_KEY, next); } catch { /* private mode */ }
  };

  const updateCalibration = (patch: Partial<SheetCalibration>) => {
    setCalibration(prev => ({ ...prev, ...patch, offsetsIn: { ...prev.offsetsIn, ...(patch.offsetsIn || {}) } }));
    setCalibrationSaved(false);
  };

  const setOffsetFromInput = (key: OffsetKey, raw: string) => {
    const n = parseFloat(raw);
    const inches = isFinite(n) ? fromDisplayUnit(n, calibration.unit) : 0;
    const clamped = Math.max(-MAX_SHEET_OFFSET_IN, Math.min(MAX_SHEET_OFFSET_IN, inches));
    updateCalibration({ offsetsIn: { ...calibration.offsetsIn, [key]: clamped } });
  };

  const persistCalibration = () => {
    setCalibration(saveSheetCalibration(calibration));
    setCalibrationSaved(true);
  };

  const resetCalibration = () => {
    setCalibration(saveSheetCalibration({ ...DEFAULT_SHEET_CALIBRATION, unit: calibration.unit }));
    setCalibrationSaved(true);
    setCalibrationNonce(n => n + 1);
  };

  const downloadAlignmentTest = async () => {
    const { downloadPerforatedCalibrationSheet } = await import('@/lib/labels/sheetCalibrationPdf');
    downloadPerforatedCalibrationSheet({
      density: density === 'up26' ? 'up26' : 'up30',
      duplexFlip: calibration.duplexFlip,
      offsetsIn: calibration.offsetsIn,
    });
  };

  const handleStyleSwitch = (id: LabelStyleId) => {
    setLocalStyle(id);
  };

  // Build SlabLabelData for a single card
  const buildSlabLabelData = useCallback(async (
    card: CardData,
    logoDataUrl: string | undefined,
    whiteLogoDataUrl: string | undefined,
    qrLogoSrc?: string,
    orgSlug?: string,
    logoScale = 1
  ): Promise<SlabLabelData> => {
    const labelData = getCardLabelData(card);
    // Org batches: QR lands on the org's branded card page with the store
    // mark baked in; DCM batches keep the plain verify QR.
    const verifyUrl = cardQrUrl(card.id, card.serial, orgSlug ? { slug: orgSlug } : null);

    const qrCodeDataUrl = qrLogoSrc
      ? await generateQRCodeWithLogo(verifyUrl, qrLogoSrc).catch(() => '')
      : await generateQRCodePlain(verifyUrl).catch(() => '');

    const weightedScores = card.conversational_weighted_sub_scores || {};
    const subScores = card.conversational_sub_scores || {};

    return toSlabLabelData(labelData, {
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
      logoScale,
    });
  }, [showFounderEmblem, showVipEmblem, showCardLoversEmblem]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Pre-load logos once. A batch only carries a store's logos when EVERY
      // card was graded under the SAME org; mixed or DCM batches keep DCM.
      const [dcmLogoDataUrl, dcmWhiteLogoDataUrl] = await Promise.all([
        loadLogoAsBase64().catch(() => undefined),
        loadWhiteLogoAsBase64().catch(() => undefined),
      ]);
      const allSameOrg = selectedCards.length > 0 &&
        selectedCards.every(c => (c as any).org_id && (c as any).org_id === (selectedCards[0] as any).org_id);
      const orgLogos = allSameOrg ? await loadLogosForCard(selectedCards[0].id).catch(() => null) : null;
      const logoDataUrl = orgLogos?.branding ? orgLogos.mark : dcmLogoDataUrl;
      const whiteLogoDataUrl = orgLogos?.branding ? orgLogos.white : dcmWhiteLogoDataUrl;

      // Build label data for all selected cards
      const labelDataArray: SlabLabelData[] = [];

      for (let i = 0; i < selectedCards.length; i++) {
        const card = selectedCards[i];
        const labelData = await buildSlabLabelData(card, logoDataUrl, whiteLogoDataUrl,
          orgLogos?.branding ? orgLogos.color : undefined,
          orgLogos?.branding?.slug,
          orgLogos?.logoScale ?? 1);
        labelDataArray.push(labelData);
        setProgress(Math.round(((i + 1) / selectedCards.length) * 80));
      }

      setProgress(85);

      let blob: Blob;
      // Density + the saved duplex flip / printer calibration. Default
      // calibration passes the bare density, so those sheets are unchanged.
      const sheetLayout = sheetLayoutFor(density, calibration);

      // Heritage — built-in id or a saved custom config with style 'heritage'.
      // Its band palette is per-card, so it can't ride the config generators.
      // With a wizard configOverride, the CONFIG alone decides: the user's
      // stored default style must not leak into an explicit design.
      const heritageSel = resolveHeritageSelection(configOverride ? '' : localStyle, localActiveConfig);
      if (heritageSel.active) {
        const gen = await import('@/lib/labels/heritageSlabGenerator');
        const { resolveHeritageBandColors } = await import('@/lib/labelLab/heritageLayout');
        const items = labelDataArray.map((data, i) => ({
          // Org batches: front mark from Brand Setup (logoBlack), QR-centre
          // disc always the org COLOR mark (a white mark would vanish on the
          // white QR plate). DCM batches unchanged.
          data: orgLogos?.branding ? { ...data, logoDataUrl: orgLogos.color } : data,
          bandColors: heritageSel.bandColors ?? resolveHeritageBandColors(selectedCards[i]?.card_colors),
          logoBlack: orgLogos?.branding ? orgLogos.mark : undefined,
          logoScale: orgLogos?.logoScale ?? 1,
          design: orgLogos?.design ?? null,
          // Org serials don't resolve at /verify — point the printed QR at the
          // same branded URL the composited QR image already encodes.
          qrUrl: cardQrUrl(selectedCards[i].id, selectedCards[i].serial,
            orgLogos?.branding ? { slug: orgLogos.branding.slug } : null),
        }));
        // Non-standard sizes (Zion Mag Pro) flow from the active config; the
        // generator scales the standard-authored Heritage blocks to fit.
        const heritageDims = localActiveConfig
          ? { widthIn: localActiveConfig.width, heightIn: localActiveConfig.height }
          : undefined;
        blob = printFormat === 'foldover'
          ? await gen.generateBatchHeritageFoldOverLabelsVector(items, heritageSel.pattern, heritageSel.gradeColors, heritageDims)
          : await gen.generateBatchHeritageSlabLabelsVector(items, heritageSel.pattern, heritageSel.gradeColors, heritageDims, sheetLayout);
      } else {
        // Modern/custom dark labels render the whiteLogoDataUrl slot; the
        // on-screen previews show the Brand Setup mark there for org cards,
        // so the batch print must match. Consumer batches unchanged.
        const orgMark = orgLogos?.branding ? orgLogos.mark : null;
        const printArray = orgMark
          ? labelDataArray.map(d => ({ ...d, whiteLogoDataUrl: orgMark }))
          : labelDataArray;
        if (printFormat === 'foldover') {
          // Fold-over batch: multiple fold-over labels per page in a single PDF
          if (localActiveConfig) {
            blob = await generateBatchFoldOverCustomLabels(printArray, localActiveConfig);
          } else {
            const builtInStyle: 'modern' | 'traditional' = localStyle === 'traditional' ? 'traditional' : 'modern';
            blob = await generateBatchFoldOverSlabLabels(printArray, builtInStyle);
          }
        } else if (localActiveConfig) {
          // Custom style — use batch generator with same multi-up grid layout as standard
          blob = await generateBatchCustomSlabLabels(printArray, localActiveConfig, sheetLayout);
        } else {
          // Built-in style — use standard batch generator
          const builtInStyle: 'modern' | 'traditional' = localStyle === 'traditional' ? 'traditional' : 'modern';
          blob = await generateBatchSlabLabels(printArray, builtInStyle, sheetLayout);
        }
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
  }, [selectedCards, localStyle, localActiveConfig, configOverride, printFormat, density, calibration, buildSlabLabelData, onClose]);

  // Fold-over: ~10 labels per page (single-sided). Duplex: 10 per sheet at
  // standard density, 20 when the user picks the dense sheet — for a
  // non-standard slot (Zion) the count comes from that slot's real height.
  const FOLDOVER_ROWS_PER_PAGE = 10;
  const duplexPerSheet = useMemo(() => {
    if (density === 'standard') return LABELS_PER_PAGE;
    if (density === 'up26') return 26;
    if (density === 'up30') return 30;
    return resolveSheetGeometry({
      labelWIn: localActiveConfig?.width || 2.8,
      labelHIn: localActiveConfig?.height || 0.8,
      density: 'dense',
    }).labelsPerPage;
  }, [density, localActiveConfig]);
  const totalPages = printFormat === 'foldover'
    ? Math.ceil(selectedCards.length / FOLDOVER_ROWS_PER_PAGE)
    : Math.ceil(selectedCards.length / duplexPerSheet);
  const totalSheets = totalPages;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Graded Slab Labels</h2>
              <p className="text-purple-200 text-sm">
                {printFormat === 'foldover'
                  ? '5.6\u201d × 0.8\u201d — Single-sided fold-over with cut guides'
                  : isTrueSizeDensity(density)
                    ? `2.8\u201d × 0.8\u201d true size — ${density === 'up26' ? 26 : 30} per pre-perforated duplex sheet`
                    : '2.8\u201d × 0.8\u201d — Duplex printing with cut guides'}
              </p>
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
                <div className="text-xs text-gray-500">
                  {printFormat === 'foldover'
                    ? (totalSheets === 1 ? 'Page' : 'Pages')
                    : (totalSheets === 1 ? 'Sheet' : 'Sheets') + ' (duplex)'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-700">
                  {printFormat === 'foldover' ? totalPages : totalPages * 2}
                </div>
                <div className="text-xs text-gray-500">
                  {printFormat === 'foldover' ? 'Pages (single-sided)' : 'Pages total'}
                </div>
              </div>
            </div>
          </div>

          {/* Label Style Dropdown — hidden when the design arrives from the
              Label Wizard (configOverride), where style was already chosen. */}
          {!configOverride && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Label Style</label>
              <LabelStyleDropdown
                labelStyle={localStyle}
                customStyles={customStyles}
                onSwitch={handleStyleSwitch}
              />
            </div>
          )}

          {/* Print Instructions */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Print Instructions:</p>
            <ul className="space-y-0.5 text-xs text-blue-700">
              <li>1. Print duplex (double-sided), flip on <strong>{calibration.duplexFlip === 'short' ? 'short edge' : 'long edge'}</strong>, at 100% scale</li>
              <li>2. Front labels print on odd pages, back labels on even pages</li>
              {isTrueSizeDensity(density) ? (
                <>
                  <li>3. Load the pre-perforated {density === 'up26' ? '26' : '30'}-up sheets (2.8&quot; × 0.8&quot; labels{density === 'up30' ? ', printed sideways' : ''}) — no cutting</li>
                  <li>4. Print the alignment test under Duplex alignment before the first run</li>
                </>
              ) : (
                <>
                  <li>3. Cut along the dotted lines (scissor marks at corners)</li>
                  <li>4. Each label fits your slab&apos;s 2.8&quot; × 0.8&quot; label slot</li>
                </>
              )}
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

        {/* Print format toggle */}
        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-2">Print Format</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPrintFormat('duplex')}
              className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-colors ${
                printFormat === 'duplex'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              Duplex (Front + Back)
            </button>
            <button
              onClick={() => setPrintFormat('foldover')}
              className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-colors ${
                printFormat === 'foldover'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              Fold-Over (Single-Sided)
            </button>
          </div>
        </div>

        {/* Labels per sheet — duplex only; fold-over owns its own layout */}
        {printFormat === 'duplex' && (
          <div className="px-6 py-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Labels per Sheet</p>
            <div className="flex gap-2">
              <button
                onClick={() => chooseDensity('standard')}
                className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-colors ${
                  density === 'standard'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                10 per sheet
              </button>
              <button
                onClick={() => chooseDensity('dense')}
                className={`flex-1 text-xs py-2 px-3 rounded-lg border-2 transition-colors ${
                  density === 'dense'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                20 per sheet
              </button>
              <button
                onClick={() => chooseDensity('up26')}
                className={`flex-1 text-xs py-2 px-2 rounded-lg border-2 transition-colors ${
                  density === 'up26'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                26 per sheet
                <span className="block text-[10px] font-normal text-gray-500">true size</span>
              </button>
              <button
                onClick={() => chooseDensity('up30')}
                className={`flex-1 text-xs py-2 px-2 rounded-lg border-2 transition-colors ${
                  density === 'up30'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                30 per sheet
                <span className="block text-[10px] font-normal text-gray-500">true size, sideways</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {density === 'up26'
                ? '26 per sheet: full-size 2.8" × 0.8" labels, 2 across × 13 down, for pre-perforated sheets. No cutting.'
                : density === 'up30'
                  ? '30 per sheet: full-size 2.8" × 0.8" labels turned sideways, 10 across × 3 down, for pre-perforated sheets. No cutting.'
                  : '20 per sheet prints closer to the page edge; test one sheet first.'}
            </p>

            {/* Duplex alignment — flip edge + printer calibration, saved in this browser */}
            <div className="mt-3 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setCalibrationOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-600"
              >
                <span>
                  Duplex alignment
                  {!isDefaultSheetCalibration(calibration) && (
                    <span className="ml-2 font-normal text-purple-600">custom</span>
                  )}
                </span>
                <span>{calibrationOpen ? '−' : '+'}</span>
              </button>
              {calibrationOpen && (
                <div className="px-3 pb-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Printer flips on</p>
                    <div className="flex gap-2">
                      {(['long', 'short'] as const).map(edge => (
                        <button
                          key={edge}
                          type="button"
                          onClick={() => updateCalibration({ duplexFlip: edge })}
                          className={`flex-1 text-xs py-1.5 px-2 rounded-md border ${
                            calibration.duplexFlip === edge
                              ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                              : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {edge === 'long' ? 'Long edge (default)' : 'Short edge'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">Offsets</p>
                    <div className="flex gap-1">
                      {(['in', 'mm'] as const).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => { updateCalibration({ unit: u }); setCalibrationNonce(n => n + 1); }}
                          className={`text-xs px-2 py-0.5 rounded border ${
                            calibration.unit === u ? 'border-purple-500 text-purple-700' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {OFFSET_FIELDS.map(f => (
                      <label key={f.key} className="text-xs text-gray-600">
                        <span className="block">{f.label} ({calibration.unit})</span>
                        <input
                          key={`${f.key}-${calibrationNonce}`}
                          type="number"
                          step={calibration.unit === 'mm' ? 0.1 : 0.005}
                          min={-toDisplayUnit(MAX_SHEET_OFFSET_IN, calibration.unit)}
                          max={toDisplayUnit(MAX_SHEET_OFFSET_IN, calibration.unit)}
                          defaultValue={toDisplayUnit(calibration.offsetsIn[f.key], calibration.unit)}
                          onChange={e => setOffsetFromInput(f.key, e.target.value)}
                          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-800"
                        />
                        <span className="block text-[10px] text-gray-400">{f.hint}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    &quot;Both sides&quot; moves fronts and backs; &quot;Back only&quot; moves the backs page to line it up
                    behind the fronts. Max ±{MAX_SHEET_OFFSET_IN}&quot; ({(MAX_SHEET_OFFSET_IN * MM_PER_IN).toFixed(1)} mm).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={persistCalibration}
                      className="text-xs px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={resetCalibration}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700"
                    >
                      Reset
                    </button>
                    {isTrueSizeDensity(density) && (
                      <button
                        type="button"
                        onClick={downloadAlignmentTest}
                        className="text-xs px-3 py-1.5 rounded-md border border-purple-300 text-purple-700"
                      >
                        Download {density === 'up26' ? '26' : '30'}-up alignment test
                      </button>
                    )}
                    {calibrationSaved && <span className="text-xs text-green-600 self-center">Saved</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
