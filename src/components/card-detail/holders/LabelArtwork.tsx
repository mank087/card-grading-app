'use client';

/**
 * The owner's ACTUAL label, as DOM — the four-way switch the legacy card
 * detail page already renders above the card, lifted out verbatim so V2 can
 * drop it into a holder's label slot.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` as of 2026-09-21
 * (sports equivalents in brackets — the two are identical in this region
 * apart from the category token in the QR/verify URL):
 *
 *   front switch (4 branches)   2894-3010   [2867-2983]
 *     heritage                  2896-2907   [2869-2880]
 *     modern / custom modern    2908-2923   [2881-2896]
 *     built-in classic          2924        [2897]
 *     custom traditional (inline) 2926-3010 [2899-2983]
 *   back switch (4 branches)    3056-3172   [3022-3138]
 *     heritage                  3058-3069   [3024-3035]
 *     modern / custom modern    3070-3088   [3036-3054]
 *     built-in classic          3089        [3055]
 *     custom traditional (inline) 3091-3172 [3057-3138]
 *   selection helpers           1568-1579   [1574-1585]
 *   heritage QR effect          1580-1589   [1586-1595]
 *   heritage / classic data     2632-2647   [2598-2613]
 *
 * The legacy clients are FROZEN for the whole redesign (plan §4), so this is a
 * copy and not a refactor of them; mirror any fix made there.
 *
 * SCOPE: artwork only. This component owns no holder chrome, no separator, no
 * slab wrapper and no card image — the holder composition owns all of that, so
 * the same artwork drops into the slab slot, a tile, or a bare preview.
 *
 * CATEGORY-AGNOSTIC: the only category-shaped input is `verifyUrl`, which the
 * caller builds (`${origin}/${category}/${id}`, exactly as legacy does at
 * 2680 [2646]).
 *
 * It renders at its own design width inside `ScaleToFit`, which is what lets a
 * 360px-designed HTML label sit legibly in a 150px slab slot: below the design
 * width the whole block transform-scales as one unit instead of reflowing.
 * The two SVG previews (Heritage, Classic) scale natively and need no wrapper.
 */

import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import type { LabelData } from '@/lib/labelDataGenerator';
import type { CustomLabelConfig, LabelColorOverrides } from '@/lib/labelPresets';
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign';
import { ModernFrontLabel } from '@/components/labels/ModernFrontLabel';
import { ModernBackLabel } from '@/components/labels/ModernBackLabel';
import { HeritageLabelPreview } from '@/components/labels/HeritageLabelPreview';
import { ClassicLabelPreview, useClassicQrDataUrl } from '@/components/labels/ClassicLabelPreview';
import { ScaleToFit } from '@/components/labels/ScaleToFit';
import {
  resolveHeritageSelection,
  isTraditionalSelection,
  isClassicSelection,
} from '@/lib/labels/labelStyleResolution';
import { toSlabLabelData } from '@/lib/labels/slabLabelDataAdapter';

export type LabelArtworkSide = 'front' | 'back';

export interface LabelArtworkOrgLogos {
  color: string | null;
  white: string | null;
  mark: string | null;
  scale: number;
  design: OrgLabelDesign | null;
}

export interface LabelArtworkProps {
  side: LabelArtworkSide;
  /** `getCardLabelData(card)` — the same object the print generators read. */
  labelData: LabelData;
  labelStyle: string | null | undefined;
  activeConfig: CustomLabelConfig | null;
  colorOverrides?: LabelColorOverrides;
  /** Resolved band palette for a heritage selection; [] when not heritage. */
  heritageBandColors: string[];
  /** `fetchBrandingForCard` result, or null for a consumer card. */
  orgLogos?: LabelArtworkOrgLogos | null;
  /** Weighted sub-scores, already rounded by the caller. */
  subScores?: { centering: number; corners: number; edges: number; surface: number } | null;
  emblems?: {
    showFounderEmblem?: boolean;
    showVipEmblem?: boolean;
    showCardLoversEmblem?: boolean;
  };
  /** `${origin}/${category}/${id}` — the QR destination, as legacy (2680). */
  verifyUrl: string;
  /** The modern label size. Legacy uses "lg" on the card page (2916). */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Heritage's QR, produced exactly as legacy does at 1580-1589: `qrcode` is
 * imported lazily and only when a heritage selection is actually active.
 */
function useHeritageQrDataUrl(active: boolean, verifyUrl: string): string {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    if (!active || !verifyUrl) return;
    let cancelled = false;
    import('qrcode')
      .then((q) =>
        q.default.toDataURL(verifyUrl, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 300,
          color: { dark: '#141414', light: '#ffffff' },
        }),
      )
      .then((u) => {
        if (!cancelled) setDataUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, verifyUrl]);
  return dataUrl;
}

export function LabelArtwork({
  side,
  labelData,
  labelStyle,
  activeConfig,
  colorOverrides,
  heritageBandColors,
  orgLogos,
  subScores,
  emblems,
  verifyUrl,
  size = 'lg',
}: LabelArtworkProps) {
  // Legacy 1568-1579.
  const heritageSel = resolveHeritageSelection(labelStyle, activeConfig);
  const isTraditionalLabel = isTraditionalSelection(labelStyle, activeConfig);
  const isClassicLabel = isClassicSelection(labelStyle, activeConfig);

  // Both hooks run unconditionally so the hook order never depends on style.
  const heritageQrDataUrl = useHeritageQrDataUrl(heritageSel.active, verifyUrl);
  const classicQrDataUrl = useClassicQrDataUrl(isClassicLabel && verifyUrl ? verifyUrl : null);

  const showFounderEmblem = !!emblems?.showFounderEmblem;
  const showVipEmblem = !!emblems?.showVipEmblem;
  const showCardLoversEmblem = !!emblems?.showCardLoversEmblem;

  // Legacy 2632-2647 — the same adapter feeds the preview and the print PDF.
  const heritageData = heritageSel.active
    ? toSlabLabelData(labelData, {
        qrCodeDataUrl: heritageQrDataUrl,
        subScores: subScores ?? undefined,
        showFounderEmblem,
        showVipEmblem,
        showCardLoversEmblem,
      })
    : null;
  const classicData = toSlabLabelData(labelData, { qrCodeDataUrl: classicQrDataUrl });

  // ── HERITAGE ─────────────────────────────────── legacy 2896 / 3058 ──
  if (heritageSel.active && heritageData) {
    return (
      <HeritageLabelPreview
        data={heritageData as never}
        side={side}
        pattern={heritageSel.pattern}
        blackLogoHref={orgLogos?.mark ?? undefined}
        colorLogoHref={orgLogos?.mark ?? undefined}
        logoScale={orgLogos?.scale ?? 1}
        design={orgLogos?.design ?? null}
        bandColors={heritageBandColors}
        gradeColors={heritageSel.gradeColors}
      />
    );
  }

  // ── MODERN (built-in and custom modern configs) ─ legacy 2908 / 3070 ──
  if (!isTraditionalLabel) {
    return side === 'front' ? (
      <ModernFrontLabel
        displayName={labelData.primaryName}
        setLineText={labelData.contextLine || 'Card Details'}
        features={labelData.features}
        serial={labelData.serial}
        grade={labelData.grade}
        condition={labelData.condition}
        isAlteredAuthentic={labelData.isAlteredAuthentic}
        logoColorSrc={orgLogos?.mark}
        logoWhiteSrc={orgLogos?.mark}
        logoScale={orgLogos?.scale ?? 1}
        design={orgLogos?.design ?? null}
        size={size}
        colorOverrides={colorOverrides}
      />
    ) : (
      <ModernBackLabel
        serial={labelData.serial}
        grade={labelData.grade}
        condition={labelData.condition}
        qrCodeUrl={verifyUrl}
        subScores={subScores ?? undefined}
        isAlteredAuthentic={labelData.isAlteredAuthentic}
        size={size}
        showFounderEmblem={showFounderEmblem}
        showVipEmblem={showVipEmblem}
        showCardLoversEmblem={showCardLoversEmblem}
        colorOverrides={colorOverrides}
      />
    );
  }

  // ── BUILT-IN CLASSIC ("traditional") ──────────── legacy 2924 / 3089 ──
  if (isClassicLabel) {
    return side === 'front' ? (
      <ClassicLabelPreview
        data={classicData}
        side="front"
        blackLogoHref={orgLogos?.mark ?? undefined}
      />
    ) : (
      <ClassicLabelPreview
        data={classicData}
        side="back"
        blackLogoHref={orgLogos?.mark ?? undefined}
        qrDataUrl={classicQrDataUrl}
        verifyUrl={verifyUrl}
      />
    );
  }

  // ── SAVED CUSTOM SLOT WITH style: 'traditional' ─ legacy 2926 / 3091 ──
  // Copied as-is: a customer designed this light label and still prints it,
  // so the preview has to keep it byte for byte.
  if (side === 'front') {
    return (
      <ScaleToFit designWidth={360}>
        <div className="bg-gradient-to-b from-gray-50 to-white p-3 min-h-[110px] flex">
          <div className="flex items-center justify-between h-full w-full">
            {/* Left: DCM Logo */}
            <div className="flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={orgLogos?.mark ?? '/DCM-logo.png'} alt="DCM" className="h-14 w-auto" />
            </div>

            {/* Center: Card Information - Unified 4-Line Structure (matches downloadable labels) */}
            <div className="flex-1 min-w-0 mx-3 flex flex-col justify-center gap-0.5">
              {/* Line 1: Primary Name (from unified labelData) */}
              <div
                className={`font-bold text-gray-900 leading-tight break-words ${
                  /[぀-ゟ゠-ヿ一-龯]/.test(labelData.primaryName)
                    ? 'font-noto-sans-jp'
                    : ''
                }`}
                style={{
                  fontSize: (() => {
                    const name = labelData.primaryName;
                    if (name.length > 60) return '9px';

                    if (name.length > 45) return '10px';

                    if (name.length > 35) return '11px';
                    if (name.length > 25) return '12px';
                    return '14px';
                  })(),
                }}
                title={labelData.primaryName}
              >
                {labelData.primaryName}
              </div>

              {/* Line 2: Context Line (Set • Subset • #Number • Year) */}
              <div
                className="text-gray-700 leading-tight"
                style={{
                  fontSize: labelData.contextLine.length > 30 ? '10px' : '11px',
                  wordBreak: 'break-word',
                }}
                title={labelData.contextLine}
              >
                {labelData.contextLine || 'Card Details'}
              </div>

              {/* Line 3: Special Features (from unified labelData) - Only if present */}
              {labelData.featuresLine && (
                <div className="text-blue-600 font-semibold text-[10px] leading-tight break-words">
                  {labelData.featuresLine}
                </div>
              )}

              {/* Line 4: DCM Serial Number */}
              <div className="text-gray-500 text-[10px] leading-tight font-mono">
                {labelData.serial}
              </div>
            </div>

            {/* Right: Grade Display (from unified labelData) */}
            <div className="text-center flex-shrink-0">
              <div className="font-bold text-purple-700 text-3xl leading-none">
                {labelData.gradeFormatted || 'N/A'}
              </div>
              {labelData.condition && (
                <>
                  <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
                  <div className="font-semibold text-purple-600 text-[0.65rem] leading-tight">
                    {labelData.condition}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ScaleToFit>
    );
  }

  return (
    <ScaleToFit designWidth={360}>
      <div className="bg-gradient-to-b from-gray-50 to-white h-[110px] p-4">
        <div className="flex items-center justify-between h-full gap-2">
          {/* LEFT: QR Code + Founder badge */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="bg-white p-1 rounded shadow-sm">
              <QRCodeCanvas
                value={verifyUrl}
                size={66}
                level="H"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>

            {/* Founder badge - star at top, FOUNDER sideways below */}
            {showFounderEmblem && (
              <div className="flex flex-col items-center justify-start h-full py-1">
                <span className="text-[14px] leading-none" style={{ color: '#d97706' }}>
                  ★
                </span>
                <span
                  className="text-[8px] font-bold"
                  style={{
                    color: '#7c3aed',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    marginTop: '2px',
                  }}
                >
                  FOUNDER
                </span>
              </div>
            )}

            {/* Card Lovers badge - heart at top, Card Lover sideways below */}
            {showCardLoversEmblem && (
              <div className="flex flex-col items-center justify-start h-full py-1">
                <span className="text-[14px] leading-none" style={{ color: '#f43f5e' }}>
                  ♥
                </span>
                <span
                  style={
                    {
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontWeight: 600,
                      fontSize: '8px',
                      color: '#f43f5e',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      marginTop: '3px',
                      letterSpacing: '0.5px',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility',
                    } as React.CSSProperties
                  }
                >
                  Card Lover
                </span>
              </div>
            )}

            {/* VIP badge - diamond at top, VIP sideways below */}
            {showVipEmblem && (
              <div className="flex flex-col items-center justify-start h-full py-1">
                <span className="text-[16px] leading-none" style={{ color: '#6366f1' }}>
                  ◆
                </span>
                <span
                  className="font-semibold uppercase tracking-wider"
                  style={{
                    fontSize: '9px',
                    color: '#6366f1',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    marginTop: '3px',
                    letterSpacing: '0.5px',
                  }}
                >
                  VIP
                </span>
              </div>
            )}
          </div>

          {/* CENTER: Large Grade + Condition */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="font-bold text-purple-700 text-4xl leading-none">
              {labelData.grade !== null
                ? Math.round(labelData.grade).toString()
                : labelData.isAlteredAuthentic
                  ? 'A'
                  : 'N/A'}
            </div>
            {(labelData.condition || labelData.isAlteredAuthentic) && (
              <div className="font-semibold text-purple-600 text-[10px] leading-tight mt-1 uppercase tracking-wide">
                {labelData.isAlteredAuthentic && labelData.grade === null
                  ? 'Authentic'
                  : labelData.condition}
              </div>
            )}
          </div>

          {/* RIGHT: Four Sub-Grades */}
          {subScores && (
            <div className="flex flex-col justify-center gap-0.5 flex-shrink-0 text-right">
              <div className="text-[10px] text-gray-700">
                Centering: {Math.round(subScores.centering)}
              </div>
              <div className="text-[10px] text-gray-700">
                Corners: {Math.round(subScores.corners)}
              </div>
              <div className="text-[10px] text-gray-700">Edges: {Math.round(subScores.edges)}</div>
              <div className="text-[10px] text-gray-700">
                Surface: {Math.round(subScores.surface)}
              </div>
            </div>
          )}
        </div>
      </div>
    </ScaleToFit>
  );
}

export default LabelArtwork;
